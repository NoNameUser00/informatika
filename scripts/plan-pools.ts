// План дозаполнения банков: сколько заданий нужно каждому УРОКУ.
//
// Считает квоты пулов по работам (scripts/works.ts) и раздаёт их на уроки
// пропорционально длине диапазона КТП. Один урок может входить в несколько
// работ (например, КТП 25 входит и в control-11net, и в control-11final) —
// тогда берётся максимум, а не сумма: задание одно, служит обеим работам.
//
// Запуск: npx esbuild scripts/plan-pools.ts --bundle ... && node .cjs
// Пишет tmp/plan.txt в UTF-8 (через консоль кириллица искажается).
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { WORKS, POOL_QUOTA } from './works';
import { ktpOf } from './lesson-ktp';

const DIFFS = ['basic', 'intermediate', 'advanced'] as const;
type Diff = (typeof DIFFS)[number];

function allocate(weights: number[], total: number, min: number): number[] {
  const n = weights.length;
  const out = new Array<number>(n).fill(min);
  let left = total - min * n;
  const sum = weights.reduce((s, w) => s + Math.max(w, 0), 0);
  if (sum === 0) return out;
  const exact = weights.map((w) => (left * Math.max(w, 0)) / sum);
  const floors = exact.map(Math.floor);
  let rest = left - floors.reduce((s, v) => s + v, 0);
  const order = exact.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rest > 0; k++, rest--) floors[order[k % n].i] += 1;
  for (let i = 0; i < n; i++) out[i] += floors[i];
  return out;
}

/** Урок -> номер КТП, из реестра. */
const lessonKtp = new Map<string, number>();
/** Урок -> класс. Берём из блоков LESSONS_7..LESSONS_11, а не по префиксу id:
 *  у 8 класса lesson-id начинаются с logic-, alg-, py-, numsys-, а не с «8». */
const lessonGrade = new Map<string, string>();
const SRC = readFileSync('src/data/lessons.ts', 'utf-8');
const RE = /id:\s*'([^']+)',\s*ktp:\s*(\d+)/g;
let m: RegExpExecArray | null;
while ((m = RE.exec(SRC)) !== null) lessonKtp.set(m[1], Number(m[2]));
const BLOCK = /export const LESSONS_(\d+): LessonMeta\[\] = \[([\s\S]*?)\n\];/g;
while ((m = BLOCK.exec(SRC)) !== null) {
  const grade = m[1];
  for (const id of m[2].matchAll(/id:\s*'([^']+)'/g)) lessonGrade.set(id[1], grade);
}

/**
 * Уроки СВОЕГО класса, попадающие в диапазоны раздела, с весом = число попаданий.
 * Класс берётся из реестра (lessonGrade): номера КТП у разных классов совпадают,
 * и префикс id для 8 класса не годится.
 */
function lessonsIn(ranges: Array<{ from: number; to: number }>, grade: string): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  for (const [id, n] of lessonKtp) {
    if (lessonGrade.get(id) !== grade) continue;
    let w = 0;
    for (const r of ranges) if (n >= r.from && n <= r.to) w += 1;
    if (w) out.push([id, w]);
  }
  return out;
}

// Требования по урокам: урок -> {basic, intermediate, advanced}
const need = new Map<string, Record<Diff, number>>();
for (const work of WORKS) {
  const sectionTotals = allocate(
    work.sections.map((s: any) => s.ktp.reduce((sum: number, r: any) => sum + (r.to - r.from + 1), 0)),
    POOL_QUOTA.total,
    6,
  );
  work.sections.forEach((sec: any, i: number) => {
    const lessons = lessonsIn(sec.ktp, work.grade);
    const totalW = lessons.reduce((s, [, w]) => s + w, 0) || 1;
    const dq = allocate(DIFFS.map((d) => POOL_QUOTA[d]), sectionTotals[i], 1);
    for (const [lesson, w] of lessons) {
      const row = need.get(lesson) ?? { basic: 0, intermediate: 0, advanced: 0 };
      DIFFS.forEach((d, k) => {
        row[d] = Math.max(row[d], Math.max(1, Math.round((sectionTotals[i] * w) / totalW * dq[k] / dq.reduce((s, v) => s + v, 0))));
      });
      need.set(lesson, row);
    }
  });
}

// Сколько заданий уже есть в банках.
const has = new Map<string, Record<Diff, number>>();
const GRADE_FILES: Record<string, string[]> = {
  '7': ['data/tasks/7/information/bank-7inf.yaml', 'data/tasks/7/base/bank-7base.yaml', 'data/tasks/7/media/bank-7media.yaml'],
  '8': ['data/tasks/8/number-systems/bank.yaml', 'data/tasks/8/number-systems/bank-gen.yaml', 'data/tasks/8/logic/bank-logic.yaml',
    'data/tasks/8/algorithms/bank-algo.yaml', 'data/tasks/8/code-run/bank-code.yaml'],
  '9': ['data/tasks/9/spreadsheets/bank-9sheet.yaml', 'data/tasks/9/arrays/bank-9arr.yaml',
    'data/tasks/9/graphs/bank-9graph.yaml', 'data/tasks/9/extra/bank-9extra.yaml'],
  '10': ['data/tasks/10/base/bank-10base.yaml', 'data/tasks/10/ss/bank-10ss.yaml',
    'data/tasks/10/logic/bank-10logic.yaml', 'data/tasks/10/media/bank-10media.yaml'],
  '11': ['data/tasks/11/data/bank-11data.yaml', 'data/tasks/11/db/bank-11db.yaml',
    'data/tasks/11/algo/bank-11algo.yaml', 'data/tasks/11/net/bank-11net.yaml', 'data/tasks/11/graph/bank-11graph.yaml'],
};
for (const [grade, files] of Object.entries(GRADE_FILES)) {
  for (const f of files) {
    for (const t of readFileSync(f, 'utf-8').split(/^- id: /m).slice(1)) {
      const ls = /lesson:\s*(\S+)/.exec(t)?.[1] ?? '?';
      const d = (/difficulty:\s*(\S+)/.exec(t)?.[1] ?? 'basic') as Diff;
      const row = has.get(ls) ?? { basic: 0, intermediate: 0, advanced: 0 };
      row[d] = (row[d] ?? 0) + 1;
      has.set(ls, row);
    }
  }
}

const rows: string[] = [];
let totalNeed = 0;
let totalHave = 0;
for (const lesson of [...lessonKtp.keys()].sort((a, b) => (lessonKtp.get(a) ?? 0) - (lessonKtp.get(b) ?? 0) || (a < b ? -1 : 1))) {
  const n = need.get(lesson);
  if (!n) continue;
  const h = has.get(lesson) ?? { basic: 0, intermediate: 0, advanced: 0 };
  const dn = n.basic + n.intermediate + n.advanced;
  const dh = h.basic + h.intermediate + h.advanced;
  totalNeed += dn;
  totalHave += dh;
  const miss = n.basic - h.basic > 0 || n.intermediate - h.intermediate > 0 || n.advanced - h.advanced > 0;
  rows.push(
    `${miss ? 'ДОПИСАТЬ' : '  есть  '} КТП ${String(lessonKtp.get(lesson)).padStart(2)} ${lesson.padEnd(22)} ` +
    `нужно b/i/a=${n.basic}/${n.intermediate}/${n.advanced} (${dn})  есть=${h.basic}/${h.intermediate}/${h.advanced} (${dh})  ` +
    `дописать b/i/a=${Math.max(0, n.basic - h.basic)}/${Math.max(0, n.intermediate - h.intermediate)}/${Math.max(0, n.advanced - h.advanced)}`,
  );
}
console.log(rows.join('\n'));
console.log(`\nВсего нужно заданий по урокам: ${totalNeed}, есть: ${totalHave}, дописать: ${totalNeed - totalHave}`);
mkdirSync('tmp', { recursive: true });
writeFileSync('tmp/plan.txt', rows.join('\n') + `\n\nВсего нужно заданий по урокам: ${totalNeed}, есть: ${totalHave}, дописать: ${totalNeed - totalHave}\n`, 'utf-8');
