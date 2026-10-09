// Карта «урок → номер КТП» из реестра уроков (src/data/lessons.ts).
// Читается один раз; нужен и make-checks, и build-trainer-json, чтобы порядок
// заданий в тренажёрах совпадал с порядком уроков в КТП.
import { readFileSync } from 'node:fs';

const SRC = readFileSync('src/data/lessons.ts', 'utf-8');

/** id урока -> номер КТП. */
export const LESSON_KTP = new Map<string, number>();
const RE = /id:\s*'([^']+)',\s*ktp:\s*(\d+)/g;
let m: RegExpExecArray | null;
while ((m = RE.exec(SRC)) !== null) {
  LESSON_KTP.set(m[1], Number(m[2]));
}

export function ktpOf(lesson: string): number | null {
  return LESSON_KTP.get(lesson) ?? null;
}

/** Уроки класса, отсортированные по КТП: [lessonId, ktp][]. */
export function lessonsByKtp(grade: string): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  for (const [id, n] of LESSON_KTP) {
    if (id.startsWith(`${grade}`)) out.push([id, n]);
  }
  return out.sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
}

/** Порядковый номер урока в КТП; -1 если урока нет (сортируется в конец). */
export function ktpRank(lesson: string): number {
  const n = LESSON_KTP.get(lesson);
  return n === undefined ? Number.MAX_SAFE_INTEGER : n;
}
