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
 * После шага каждый элемент не меньше min (добираем у тех, где есть запас).
 */
function allocate(weights: number[], total: number, min: number): number[] {
  const n = weights.length;
  const out = new Array<number>(n).fill(min);
  let left = total - min * n;
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

/** Раскладывает пул по разделам и сложностям; возвращает дефициты для отчёта. */
function buildPool(work: any, byLesson: Map<string, Raw[]>): { sections: any[]; gaps: string[] } {
  const gaps: string[] = [];
  const sectionTotals = allocate(
    work.sections.map((s: any) => lessonCount(s.ktp)),
    POOL_QUOTA.total,
    MIN_PER_SECTION,
  );
  const diffWeights = DIFFS.map((d) => POOL_QUOTA[d]);

  const sections = work.sections.map((sec: any, i: number) => {
    const tasks: Raw[] = [];
    for (const [lesson, list] of byLesson) {
      const ktp = ktpOf(lesson);
      if (ktp !== null && inRanges(ktp, sec.ktp)) tasks.push(...list);
    }
    // Раскладываем квоту по сложностям внутри раздела.
    const quota = allocate(diffWeights, sectionTotals[i], 1);
    const picked: Raw[] = [];
    for (const d of DIFFS) {
      const bucket = tasks.filter((t) => t.difficulty === d);
      const need = quota[DIFFS.indexOf(d)];
      if (bucket.length < need) {
        gaps.push(`${work.file} / «${sec.title}» / ${d}: нужно ${need}, есть ${bucket.length}`);
      }
      picked.push(...pickSpread(bucket, need));
    }
    picked.sort((a, b) => (a.lesson < b.lesson ? -1 : a.lesson > b.lesson ? 1 : a.json.id < b.json.id ? -1 : 1));
    return { title: sec.title, ktp: sec.ktp, quota: sectionTotals[i], tasks: picked };
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

/** Набирает count заданий из раздела в порядке сложностей (basic -> advanced). */
function takeFor(section: any, count: number, diffs: Diff[], rng: () => number): Raw[] {
  const buckets: Raw[][] = diffs.map((d) => shuffle(section.tasks.filter((t: Raw) => t.difficulty === d), rng));
  const out: Raw[] = [];
  let guard = 0;
  while (out.length < count && guard++ < 200) {
    let added = false;
    for (const b of buckets) {
      if (out.length >= count) break;
      if (b.length) {
        const task = b.pop();
        if (task) out.push(task);
        added = true;
      }
    }
    if (!added) break;
  }
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
    const take = Math.min(perSection[i], s.tasks.filter((t: Raw) => diffs.includes(t.difficulty)).length);
    picked.push(...takeFor(s, take, diffs, rng));
  });

  // Добор до нормы, если раздел не дал нужного количества.
  const all = diffs.flatMap((d) => usable.flatMap((s: any) => s.tasks.filter((t: Raw) => t.difficulty === d)));
  const used = new Set(picked.map((t) => t.json.id));
  const spare = shuffle(all.filter((t) => !used.has(t.json.id)), rng);
  while (picked.length < spec.perVariant && spare.length) {
    const task = spare.pop();
    if (task) picked.push(task);
  }

  // Порядок вопросов перемешан: вариант не выглядит «по разделам».
  const questions = shuffle(picked, rng).slice(0, spec.perVariant);
  // Перестановка вариантов ответа внутри задания — косметика варианта:
  // ученик шлёт id варианта (A/B/C/D), поэтому на проверку это не влияет.
  const orders: Record<string, { options?: string[]; right?: string[] }> = {};
  for (const q of questions) {
    if (q.json.options) {
      orders[q.json.id] = { options: shuffle(q.json.options.map((o) => o.id), rng) };
    } else if (q.json.right) {
      orders[q.json.id] = { right: shuffle(q.json.right, rng) };
    }
  }
  const maxScore = questions.reduce((s, q) => s + q.json.points, 0);
  return { number: n, task_ids: questions.map((q) => q.json.id), orders, max_score: maxScore };
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
  const variants = Array.from({ length: VARIANTS }, (_, i) => buildVariant(work, sections, i + 1, work.kind));
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
