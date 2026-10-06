// Сборка тренерского JSON из bank.yaml + bank-gen.yaml (single source — YAML).
// teacher_only НЕ попадает в JSON, кроме полей, нужных клиентской проверке тренажера
// (тренажерные ответы не секретны; боевые ключи контрольных — только через БД).
// Каждое задание самопроверяется через check.mjs: ключ обязан засчитываться.
// Запуск: npm run trainer:json
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import { checkNumericBase, checkSingleChoice, checkMatching } from '../src/lib/scoring/check.mjs';

const LESSON_ORDER = ['numsys-01-intro', 'numsys-02-binary', 'numsys-03-octal', 'numsys-04-hex', 'numsys-05-arith', 'numsys-06-review'];

const bank = ['data/tasks/8/number-systems/bank.yaml', 'data/tasks/8/number-systems/bank-gen.yaml']
  .flatMap((p) => parse(readFileSync(p, 'utf-8')));

const out = [];
for (const t of bank) {
  if (t.type === 'numeric_base') {
    const exp = t.teacher_only.accepted_values_decimal[0];
    const r = checkNumericBase(exp, t.teacher_only.answer_text, t.student_view.base);
    if (!r.isCorrect) throw new Error(`selfcheck FAIL ${t.id}: ключ "${t.teacher_only.answer_text}" не проходит (base ${t.student_view.base})`);
    out.push({ id: t.id, lesson: t.lesson, type: t.type, points: t.points, prompt: t.prompt,
      base: t.student_view.base, expected: exp, key: t.teacher_only.answer_text });
  } else if (t.type === 'single_choice') {
    const ok = t.student_view.options.some((o) => o.id === t.teacher_only.answer);
    if (!ok) throw new Error(`selfcheck FAIL ${t.id}: ответа ${t.teacher_only.answer} нет в опциях`);
    const r = checkSingleChoice(t.teacher_only.answer, t.teacher_only.answer);
    if (!r.isCorrect) throw new Error(`selfcheck FAIL ${t.id}: checker`);
    out.push({ id: t.id, lesson: t.lesson, type: t.type, points: t.points, prompt: t.prompt,
      options: t.student_view.options, correct: t.teacher_only.answer, key: t.teacher_only.answer });
  } else if (t.type === 'matching') {
    const left = t.student_view.left;
    const full = Object.fromEntries(left.map((k) => [k, t.teacher_only.answer_map[k] ?? '']));
    const r = checkMatching(t.teacher_only.answer_map, full, t.points);
    if (!r.isCorrect || r.score !== t.points) throw new Error(`selfcheck FAIL ${t.id}: эталон не дает полный балл`);
    out.push({ id: t.id, lesson: t.lesson, type: t.type, points: t.points, prompt: t.prompt,
      left, right: t.student_view.right, answerMap: t.teacher_only.answer_map,
      key: left.map((k) => `${k}=${t.teacher_only.answer_map[k]}`).join(', ') });
  } else {
    throw new Error(`unknown type ${t.type} (${t.id})`);
  }
}

out.sort((a, b) => LESSON_ORDER.indexOf(a.lesson) - LESSON_ORDER.indexOf(b.lesson) || (a.id < b.id ? -1 : 1));
const max = out.reduce((s, t) => s + t.points, 0);
const json = { test_code: 'numsys-pilot-v1', variant: 'trainer-v1', max_score: max,
  instruction: 'В ответе запишите только само число. Основание системы счисления (₂, ₈, ₁₀, ₁₆) указывать не нужно.',
  page_size: 5, tasks: out };
writeFileSync('src/data/numsys-tasks.json', JSON.stringify(json, null, 2) + '\n', 'utf-8');
console.log(`TRAINER JSON OK: ${out.length} заданий, max=${max}`);
