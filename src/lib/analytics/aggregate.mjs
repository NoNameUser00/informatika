// Аналитика контрольных/проверочных: чистые функции без DOM и fs.
// Вход: строки журнала (answers/keys) + задания работы (tasks из checks-JSON).
// Правильность считается теми же чекерами, что на сдаче (check.mjs).
import { checkNumericBase, checkSingleChoice, checkMatching } from '../scoring/check.mjs';

/** Доля верных ответов -> уровень освоения темы. */
export function mastery(pct) {
  if (pct >= 75) return 'ok';
  if (pct >= 50) return 'shaky';
  return 'weak';
}

export const MASTERY_LABEL = { ok: 'освоено', shaky: 'шатко', weak: 'не освоено' };

function asMap(given) {
  if (given && typeof given === 'object') return given;
  const s = String(given ?? '').trim();
  if (!s.startsWith('{')) return null;
  try {
    const o = JSON.parse(s);
    return o && typeof o === 'object' ? o : null;
  } catch { return null; }
}

/** Верен ли ответ ученика на задание (полный балл). Неизвестный тип -> null (пропуск). */
export function taskCorrect(task, given) {
  if (task.type === 'numeric_base') {
    return checkNumericBase(task.expected, String(given ?? ''), task.base).isCorrect;
  }
  if (task.type === 'single_choice') {
    return checkSingleChoice(task.correct, String(given ?? '')).isCorrect;
  }
  if (task.type === 'matching') {
    if (!task.answerMap) return null;
    const m = asMap(given);
    if (!m) {
      // Формат "k=v, k=v" из тихой сдачи.
      const obj = {};
      for (const part of String(given ?? '').split(',')) {
        const i = part.indexOf('=');
        if (i > 0) obj[part.slice(0, i).trim()] = part.slice(i + 1).trim();
      }
      if (Object.keys(obj).length === 0) return false;
      return checkMatching(task.answerMap, obj, task.points).isCorrect;
    }
    return checkMatching(task.answerMap, m, task.points).isCorrect;
  }
  return null;
}

/**
 * Статистика работы: по заданиям и по темам (урокам).
 * rows — строки журнала одной работы (один test_code, опц. один класс).
 * tasks — задания checks-JSON.
 */
export function statsForWork(rows, tasks) {
  const perTask = tasks.map((t) => {
    let n = 0, correct = 0;
    for (const r of rows) {
      const v = taskCorrect(t, r.answers?.[t.id]);
      if (v === null) continue;
      n++;
      if (v) correct++;
    }
    return { id: t.id, prompt: t.prompt, lesson: t.lesson, points: t.points, n, correct, pct: n ? Math.round((correct / n) * 1000) / 10 : 0 };
  });
  const byLesson = new Map();
  for (const q of perTask) {
    if (!byLesson.has(q.lesson)) byLesson.set(q.lesson, { lesson: q.lesson, n: 0, correct: 0, questions: 0 });
    const L = byLesson.get(q.lesson);
    L.n += q.n; L.correct += q.correct; L.questions++;
  }
  const perLesson = [...byLesson.values()].map((L) => ({
    ...L, pct: L.n ? Math.round((L.correct / L.n) * 1000) / 10 : 0,
    level: mastery(L.n ? (L.correct / L.n) * 100 : 0),
  })).sort((a, b) => a.pct - b.pct);
  const answered = perTask.filter((q) => q.n > 0);
  const avgPct = answered.length
    ? Math.round((answered.reduce((s, q) => s + q.correct, 0) / answered.reduce((s, q) => s + q.n, 0)) * 1000) / 10
    : 0;
  return { students: rows.length, perTask, perLesson, avgPct };
}

/** Средний балл/процент сдавших из полей строки (как в журнале). */
export function summary(rows) {
  if (!rows.length) return { students: 0, avgPercent: 0, avgMark: 0 };
  const avgPercent = Math.round((rows.reduce((s, r) => s + (r.percent ?? 0), 0) / rows.length) * 10) / 10;
  const avgMark = Math.round((rows.reduce((s, r) => s + (r.proposed_mark ?? 0), 0) / rows.length) * 10) / 10;
  return { students: rows.length, avgPercent, avgMark };
}
