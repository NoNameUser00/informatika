// Сборка проверочных и контрольных работ: пул по разделам КТП + 30 вариантов.
//
// Что делает:
//   1. читает YAML-банки, приводит задания к JSON-виду (scripts/task-json.mjs,
//      каждый ключ самопроверяется через check.mjs);
//   2. раскладывает задания по разделам КТП работы — по номеру КТП урока,
//      на который задание привязано, а не по банку-файлу;
//   3. набирает пул (60 заданий: 36 basic / 18 intermediate / 6 advanced),
//      равномерно по разделам и равномерно по подтемам внутри раздела;
//   4. собирает 30 вариантов детерминированным seed (fnv1a + mulberry32):
//      контрольная — 20 заданий, проверочная — 10 (срез basic+intermediate);
//   5. пишет серверную копию (с ключами) и публичную (без ключей).
//
// Пулы и варианты детерминированы: тот же вход — тот же байт-в-байт файл,
// поэтому CI может проверять git diff по src/data/checks.
//
// Запуск: npm run checks
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parse } from 'yaml';
import { fnv1a, mulberry32 } from '../src/lib/variants/generator.mjs';
import { convert, stripKeys } from './task-json';
import { ktpOf } from './lesson-ktp';
import { WORKS, SLOTS, POOL_QUOTA, VARIANTS } from './works';

const DIFFS = ['basic', 'intermediate', 'advanced'] as const;
type Diff = (typeof DIFFS)[number];

const SALT = 'works-v1';
const MIN_PER_SECTION = 6;
const PAGE_SIZE = 5;

interface Raw {
  json: ReturnType<typeof convert>;
  lesson: string;
  ktp: number;
  difficulty: Diff;
  subtopic: string;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Пропорциональное распределение total по весам методом наибольших остатков.
 * min — минимум на элемент: число или массив по элементам. Распределяемый остаток
 * добирается у тех, где есть запас.
 */
function allocate(weights: number[], total: number, min: number | number[]): number[] {
  const n = weights.length;
  const mins = Array.isArray(min) ? min.slice() : new Array(n).fill(min);
  const out = mins.slice();
  let left = total - mins.reduce((s, v) => s + v, 0);
  if (left < 0) throw new Error(`allocate: total ${total} < min*${n}`);
  const sum = weights.reduce((s, w) => s + Math.max(w, 0), 0);
  if (sum === 0) {
    // равномерно
    const base = Math.floor(left / n);
    for (let i = 0; i < n; i++) out[i] += base;
    left -= base * n;
    for (let i = 0; i < left; i++) out[i] += 1;
    return out;
  }
  const exact = weights.map((w) => (left * Math.max(w, 0)) / sum);
  const floors = exact.map(Math.floor);
  let rest = left - floors.reduce((s, v) => s + v, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rest > 0; k++, rest--) floors[order[k % n].i] += 1;
  for (let i = 0; i < n; i++) out[i] += floors[i];
  return out;
}

function inRanges(ktp: number, ranges: Array<{ from: number; to: number }>): boolean {
  return ranges.some((r) => ktp >= r.from && ktp <= r.to);
}

function lessonCount(ranges: Array<{ from: number; to: number }>): number {
  return ranges.reduce((s, r) => s + (r.to - r.from + 1), 0);
}

/**
 * Раскладывает квоту одной сложности по разделам «водопадом»: сначала по
 * единице в каждый раздел, у которого есть запас, затем снова по кругу, пока
 * квота не кончится или резервы не исчерпаются.
 *
 * Так квота уходит туда, где задания реально есть, и не сгорает на разделах с
 * короткими банками. Распределение детерминированное.
 */
function allocateWaterfall(caps: number[], quota: number, minEach: number): number[] {
  const out = caps.map(() => 0);
  const mins = caps.map((c) => Math.min(c, minEach));
  let sumMin = mins.reduce((s, v) => s + v, 0);
  if (sumMin > quota) {
    // квоты не хватает даже на минимумы — режем по порядку разделов
    let left = quota;
    for (let i = 0; i < mins.length && left > 0; i++) {
      const take = Math.min(mins[i], left);
      out[i] = take;
      left -= take;
    }
    return out;
  }
  for (let i = 0; i < mins.length; i++) out[i] = mins[i];
  let left = quota - sumMin;
  for (let guard = 0; guard < 200 && left > 0; guard++) {
    let added = 0;
    for (let i = 0; i < caps.length && left > 0; i++) {
      if (out[i] < caps[i]) {
        out[i]++;
        left--;
        added++;
      }
    }
    if (!added) break;
  }
  return out;
}

/** Сколько всего заданий нужной сложности есть в разделах работы. */
function capacity(sections: any[], difficulty: Diff): number[] {
  return sections.map((s) => s.tasks.filter((t: Raw) => t.difficulty === difficulty).length);
}

/** Раскладывает пул по разделам и сложностям; возвращает дефициты для отчёта. */
function buildPool(work: any, byLesson: Map<string, Raw[]>): { sections: any[]; gaps: string[] } {
  const gaps: string[] = [];
  const sectionTotals = allocate(
    work.sections.map((s: any) => lessonCount(s.ktp)),
    POOL_QUOTA.total,
    MIN_PER_SECTION,
  );

  // Шаги 1-3: разделы с заданиями и их суммарная квота.
  const picked = work.sections.map(() => [] as Raw[]);
  const buckets = work.sections.map((sec: any) => {
    const tasks: Raw[] = [];
    for (const [lesson, list] of byLesson) {
      const ktp = ktpOf(lesson);
      if (ktp !== null && inRanges(ktp, sec.ktp)) tasks.push(...list);
    }
    return tasks;
  });

  // Сначала добираем basic и intermediate: именно их берёт проверочная, и они
  // должны вырабатываться целиком. Квота 36/18 — ориентир; если банк столько не
  // набирает, берём всё, что есть, и пишем в отчёт, а не затыкаем дыру
  // advanced-заданиями, которые проверочная всё равно не использует.
  const order: Array<[Diff, number, number]> = [
    ['basic', POOL_QUOTA.basic, 1],
    ['intermediate', POOL_QUOTA.intermediate, 1],
  ];
  for (const [d, quota, minEach] of order) {
    const caps = buckets.map((tasks: Raw[]) => tasks.filter((t: Raw) => t.difficulty === d).length);
    const share = allocateWaterfall(caps, quota, minEach);
    buckets.forEach((tasks: Raw[], i: number) => {
      const bucket = tasks.filter((t: Raw) => t.difficulty === d);
      picked[i].push(...pickSpread(bucket, share[i]));
      if (share[i] > bucket.length) {
        gaps.push(`${work.file} / «${work.sections[i].title}» / ${d}: нужно ${share[i]}, есть ${bucket.length}`);
      }
    });
  }

  // Остаток до 60 добираем advanced — его использует только контрольная.
  const capAdv = buckets.map((tasks: Raw[]) => tasks.filter((t: Raw) => t.difficulty === 'advanced').length);
  const usedBefore = picked.map((p: Raw[]) => p.length);
  const leftTotal = POOL_QUOTA.total - usedBefore.reduce((s: number, v: number) => s + v, 0);
  const shareAdv = allocateWaterfall(capAdv, Math.max(leftTotal, 0), 0);
  buckets.forEach((tasks: Raw[], i: number) => {
    const bucket = tasks.filter((t: Raw) => t.difficulty === 'advanced');
    picked[i].push(...pickSpread(bucket, shareAdv[i]));
    if (usedBefore[i] + shareAdv[i] < MIN_PER_SECTION) {
      gaps.push(`${work.file} / «${work.sections[i].title}»: набрано ${usedBefore[i] + shareAdv[i]} из ${sectionTotals[i]}`);
    }
  });

  const sections = work.sections.map((sec: any, i: number) => {
    picked[i].sort((a: Raw, b: Raw) =>
      a.lesson < b.lesson ? -1 : a.lesson > b.lesson ? 1 : a.json.id < b.json.id ? -1 : 1,
    );
    return { title: sec.title, ktp: sec.ktp, quota: sectionTotals[i], tasks: picked[i] };
  });

  return { sections, gaps };
}

/**
 * Выбор n заданий равномерно по подтемам: сначала по одному из каждой подтемы
 * (подтемы перемешаны детерминированно), затем второй круг и так далее.
 * Так пул не скатывается в один подтему, даже если банк отсортирован по нему.
 */
function pickSpread(bucket: Raw[], n: number): Raw[] {
  if (n <= 0 || bucket.length === 0) return [];
  const rng = mulberry32(fnv1a(`spread|${bucket.map((t) => t.json.id).join(',')}`));
  const bySub = new Map<string, Raw[]>();
  for (const t of shuffle(bucket, rng)) {
    const list = bySub.get(t.subtopic) ?? [];
    list.push(t);
    bySub.set(t.subtopic, list);
  }
  const keys = shuffle([...bySub.keys()], rng);
  const out: Raw[] = [];
  let round = 0;
  while (out.length < n) {
    let added = 0;
    for (const k of keys) {
      if (out.length >= n) break;
      const list = bySub.get(k)!;
      if (list.length > round) {
        out.push(list[round]);
        added++;
      }
    }
    if (added === 0) break;
    round++;
  }
  return out;
}

/**
 * Набирает count заданий из раздела, двигая окно по вариантам.
 *
 * Порядок внутри бакета задаётся один раз на пару (раздел, сложность) и от
 * номера варианта не зависит, а вот старт окна сдвигается линейно:
 * off = floor(n * m / VARIANTS). За 30 вариантов окно проходит весь бакет,
 * поэтому каждое задание пула попадает хотя бы в один вариант.
 *
 * Раньше порядок перемешивался заново на каждый вариант и брался с конца, из-за
 * чего часть пула не выбиралась ни разу: до 27 заданий из 60 в проверочных.
 *
 * Квоту между сложностями делим пропорционально их размерам, а НЕ по очереди:
 * при поочерёдном разборе проверочная (в ней allowed basic + intermediate)
 * выбирала только basic, и intermediate не использовалась вообще.
 */
function takeFor(section: any, count: number, diffs: Diff[], seedBase: string, n: number): Raw[] {
  const tasks: Raw[] = section.tasks;
  const buckets: Raw[][] = diffs
    .map((d) => shuffle(tasks.filter((t: Raw) => t.difficulty === d), mulberry32(fnv1a(`${seedBase}|${d}`))))
    .filter((b) => b.length > 0);
  if (!buckets.length) return [];

  const sizes = buckets.map((b) => b.length);
  const total = sizes.reduce((s, v) => s + v, 0);
  const want = Math.min(count, total);

  // Порядок сложностей сдвигается по вариантам. Без этого разделы, которым
  // достаётся одно задание, отдавали его всегда в basic (он больше), и
  // intermediate не попадала ни в один из 30 вариантов — до 13 заданий в
  // proverka-11net оставались неиспользованными.
  const start = n % buckets.length;
  const order = buckets.slice(start).concat(buckets.slice(0, start));
  // Если заданий не больше, чем сложностей, берём по одной из первых want:
  // так каждая сложность гарантированно участвует.
  const quota =
    want <= order.length
      ? order.map((_, k) => (k < want ? 1 : 0))
      : allocate(order.map((b) => b.length), want, order.map(() => 0));

  const out: Raw[] = [];
  order.forEach((b: Raw[], k: number) => {
    const m = b.length;
    const take = Math.min(quota[k], m);
    if (!take) return;
    const off = Math.floor((n * m) / VARIANTS) % m;
    for (let j = 0; j < take; j++) out.push(b[(off + j) % m]);
  });
  return out;
}

function buildVariant(work: any, sections: any[], n: number, kind: string): any {
  const spec = SLOTS[kind as 'control' | 'proverka'];
  const diffs = spec.difficulties as unknown as Diff[];
  const usable = sections.filter((s: any) => s.tasks.some((t: Raw) => diffs.includes(t.difficulty)));
  const poolCounts = usable.map((s: any) => s.tasks.filter((t: Raw) => diffs.includes(t.difficulty)).length);
  const perSection = allocate(poolCounts, spec.perVariant, usable.length === 0 ? 0 : 1);

  const rng = mulberry32(fnv1a(`${work.code}|${n}|${SALT}`));
  const picked: Raw[] = [];
  usable.forEach((s, i) => {
    const avail = s.tasks.filter((t: Raw) => diffs.includes(t.difficulty)).length;
    const take = Math.min(perSection[i], avail);
    picked.push(...takeFor(s, take, diffs, `${work.code}|${s.title}|${n}`, n));
  });

  // Добор до нормы, если раздел не дал нужного количества. Окно по spare тоже
  // сдвигается, иначе добор каждый раз тянул бы из одного и того же хвоста.
  const all = diffs.flatMap((d) => usable.flatMap((s: any) => s.tasks.filter((t: Raw) => t.difficulty === d)));
  const used = new Set(picked.map((t) => t.json.id));
  const spare = shuffle(all.filter((t) => !used.has(t.json.id)), rng);
  let off = spare.length ? Math.floor((n * spare.length) / VARIANTS) % spare.length : 0;
  while (picked.length < spec.perVariant && spare.length) {
    picked.push(spare[off % spare.length]);
    off++;
  }

  // Порядок вопросов перемешан: вариант не выглядит «по разделам».
  const questions = shuffle(picked, rng).slice(0, spec.perVariant);
  // Перестановка вариантов ответа внутри задания — косметика варианта:
  // ученик шлёт id варианта (A/B/C/D), поэтому на проверку это не влияет.
  // Seed задаётся на само задание и номер варианта, а не берётся из общего потока
  // rng: тогда перестановка не зависит от порядка набора и в вариант можно
  // безопасно подставить другое задание (см. repairCoverage).
  const orders: Record<string, { options?: string[]; right?: string[] }> = {};
  for (const q of questions) {
    const r = mulberry32(fnv1a(`${work.code}|${q.json.id}|${n}|${SALT}`));
    if (q.json.options) {
      orders[q.json.id] = { options: shuffle(q.json.options.map((o) => o.id), r) };
    } else if (q.json.right) {
      orders[q.json.id] = { right: shuffle(q.json.right, r) };
    }
  }
  const maxScore = questions.reduce((s, q) => s + q.json.points, 0);
  return { number: n, task_ids: questions.map((q) => q.json.id), orders, max_score: maxScore };
}

/**
 * Гарантирует выработку пула: задания, не попавшие ни в один вариант,
 * подменяются наименее востребованными в том варианте, где есть перебор.
 *
 * Сдвиг окна в takeFor покрывает бакет обычно, но в разделах с неудобным
 * соотношением размеров остаются единичные «хвосты». Этот проход не полагается
 * на арифметику сдвига и доводит покрытие до конца.
 *
 * Важно: пропуском считается только задание, которое в этот вид работы входит по
 * норме. В проверочной advanced не берётся, и вставлять его нельзя — иначе
 * работа по содержанию перестанет быть проверочной.
 *
 * Инварианты: размер варианта и отсутствие повторов внутри него сохраняются,
 * подставленное задание не вытесняется следующей подменой, баллы пересчитываются,
 * порядок обхода детерминированный.
 */
function repairCoverage(
  variants: any[],
  poolById: Map<string, any>,
  poolDiff: Map<string, string>,
  allowed: Set<string>,
): string[] {
  const count = new Map<string, number>();
  for (const id of poolById.keys()) count.set(id, 0);
  for (const v of variants) for (const id of v.task_ids as string[]) count.set(id, (count.get(id) ?? 0) + 1);

  const missing = [...count.keys()].filter((id) => count.get(id) === 0 && allowed.has(poolDiff.get(id) ?? ''));
  if (!missing.length) return [];

  const inserted = new Set<string>();
  const notes: string[] = [];
  for (const id of missing) {
    const target = variants.find((v) => !(v.task_ids as string[]).includes(id));
    if (!target) break;
    // выкидываем наименее востребованное, но не то, что только что подставили
    let worst: string | null = null;
    for (const t of target.task_ids as string[]) {
      if (inserted.has(t)) continue;
      if (worst === null || (count.get(t) ?? 0) < (count.get(worst) ?? 0)) worst = t;
    }
    if (worst === null) break;
    const at = (target.task_ids as string[]).indexOf(worst);
    (target.task_ids as string[])[at] = id;
    count.set(id, 1);
    count.set(worst, (count.get(worst) ?? 1) - 1);
    inserted.add(id);
    notes.push(`в${target.number}: ${id} вместо ${worst}`);
  }
  if (inserted.size) {
    for (const v of variants) {
      v.max_score = (v.task_ids as string[]).reduce(
        (s: number, tid) => s + (poolById.get(tid)?.points ?? 0),
        0,
      );
    }
  }
  return notes;
}

function checkVariant(work: any, v: any, pool: Map<string, any>, kind: string): string[] {
  const errs: string[] = [];
  const want = SLOTS[kind as 'control' | 'proverka'].perVariant;
  if (v.task_ids.length !== want) errs.push(`заданий ${v.task_ids.length} вместо ${want}`);
  if (new Set(v.task_ids).size !== v.task_ids.length) errs.push('повторы заданий');
  for (const id of v.task_ids as string[]) if (!pool.has(id)) errs.push(`нет в пуле: ${id}`);
  const sum = (v.task_ids as string[]).reduce((s: number, id: string) => s + (pool.get(id)?.points ?? 0), 0);
  if (sum !== v.max_score) errs.push('сумма баллов != max_score');
  return errs;
}

// ───────────────────────────── сборка ─────────────────────────────

const cache = new Map<string, Map<string, Raw>>();
function bankOf(path: string): Map<string, Raw> {
  let m = cache.get(path);
  if (m) return m;
  m = new Map();
  for (const t of parse(readFileSync(path, 'utf-8'))) {
    m.set(t.id, {
      json: convert(t),
      lesson: t.lesson,
      ktp: ktpOf(t.lesson) ?? 0,
      difficulty: t.difficulty as Diff,
      subtopic: t.subtopic,
    });
  }
  cache.set(path, m);
  return m;
}

mkdirSync('src/data/checks', { recursive: true });
const allGaps: string[] = [];
const report: string[] = [];
const manifests: Array<{ code: string; file: string; grade: string; kind: string; title: string }> = [];

for (const work of WORKS) {
  // Пул наполняем из банков работы; уроки вне её разделов в пул не попадают.
  const byLesson = new Map<string, Raw[]>();
  for (const path of work.banks) {
    for (const raw of bankOf(path).values()) {
      if (!byLesson.has(raw.lesson)) byLesson.set(raw.lesson, []);
      byLesson.get(raw.lesson)!.push(raw);
    }
  }
  const { sections, gaps } = buildPool(work, byLesson);
  allGaps.push(...gaps);

  const poolTasks = sections.flatMap((s) => s.tasks);
  const poolById = new Map(poolTasks.map((t) => [t.json.id, t.json]));
  const poolDiff = new Map(poolTasks.map((t) => [t.json.id, t.difficulty as string]));
  const allowed = new Set<string>(SLOTS[work.kind as 'control' | 'proverka'].difficulties as string[]);
  const variants = Array.from({ length: VARIANTS }, (_, i) => buildVariant(work, sections, i + 1, work.kind));
  // Доводим выработку пула: задания, не взятые ни одним вариантом, вставляем
  // на место наименее востребованных. После подмены баллы пересчитаны в repairCoverage.
  const repairs = repairCoverage(variants, poolById, poolDiff, allowed);
  if (repairs.length) report.push(`  выработка: подстановок ${repairs.length} — ${repairs.join('; ')}`);
  const soft = gaps.length > 0 && process.env.ALLOW_POOL_GAPS === '1';
  for (const v of variants) {
    const errs = checkVariant(work, v, poolById, work.kind);
    // Неполный пул даёт короткий вариант — это ожидаемо, пока банк не дополнен.
    if (errs.length && !soft) throw new Error(`${work.file}, вариант ${v.number}: ${errs.join('; ')}`);
    if (errs.length && soft && v.number === 1) report.push(`  ! вариант короче нормы: ${errs.join('; ')}`);
  }

  const spec = SLOTS[work.kind as 'control' | 'proverka'];
  const meta = {
    test_code: work.code,
    kind: work.kind,
    grade: work.grade,
    title: work.title,
    instruction: work.instruction,
    page_size: PAGE_SIZE,
    variant_count: VARIANTS,
    per_variant: spec.perVariant,
    final: Boolean(work.final),
    ktp_to: work.ktpTo ?? null,
  };
  const variantsOut = variants.map((v) => ({
    number: v.number,
    task_ids: v.task_ids,
    orders: v.orders,
    max_score: v.max_score,
  }));

  const write = (suffix: string, strip: boolean) => {
    const tasks = poolTasks.map((t) => (strip ? stripKeys(t.json) : t.json));
    const out = {
      ...meta,
      sections: sections.map((s: any) => ({ title: s.title, ktp: s.ktp, task_ids: s.tasks.map((t: Raw) => t.json.id) })),
      pool: tasks,
      variants: variantsOut,
    };
    writeFileSync(`src/data/checks/${work.file}${suffix}.json`, JSON.stringify(out, null, 2) + '\n', 'utf-8');
  };
  write('', false);
  write('-public', true);
  manifests.push({ code: work.code, file: work.file, grade: work.grade, kind: work.kind, title: work.title });

  const cov = new Set(variants.flatMap((v) => v.task_ids)).size;
  report.push(
    `${work.file.padEnd(20)} ${work.kind.padEnd(8)} пул=${String(poolTasks.length).padStart(3)} ` +
    `вариантов=${VARIANTS} по ${spec.perVariant} шт. покрытие=${cov}/${poolTasks.length} разделов=${sections.length}`,
  );
}

writeFileSync('src/data/checks/manifest.json', JSON.stringify(manifests, null, 2) + '\n', 'utf-8');
for (const line of report) console.log(`CHECK ${line}`);
console.log(`WORKS OK: ${WORKS.length} работ, по ${VARIANTS} вариантов`);

if (allGaps.length) {
  console.error(`\nНЕХВАТКА ЗАДАНИЙ (${allGaps.length}):`);
  for (const g of allGaps) console.error(`  - ${g}`);
  if (process.env.ALLOW_POOL_GAPS !== '1') process.exit(1);
  console.error('\nALLOW_POOL_GAPS=1 — сборка продолжена, но пулы меньше нормы.');
}
