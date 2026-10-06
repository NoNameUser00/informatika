import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { generateAll, validateVariant } from '../src/lib/variants/generator.mjs';

const raw = ['data/tasks/8/number-systems/bank.yaml', 'data/tasks/8/number-systems/bank-gen.yaml']
  .flatMap((p) => parse(readFileSync(p, 'utf-8')));
const bank = raw.map((t) => ({
  id: t.id, difficulty: t.difficulty, type: t.type,
  options: t.student_view.options, correct: t.teacher_only.answer,
  left: t.student_view.left, right: t.student_view.right, answerMap: t.teacher_only.answer_map,
  expected: t.teacher_only.accepted_values_decimal?.[0], key: t.teacher_only.answer_text,
}));
const template = { id: 'numsys-control-v1',
  slots: [{ difficulty: 'basic', count: 5, points_each: 1 }, { difficulty: 'intermediate', count: 3, points_each: 2 }, { difficulty: 'advanced', count: 2, points_each: 3 }],
  shuffle_questions: true, shuffle_options: true };
const all = generateAll(template, bank, 30, 'prod-salt-1');
let bad = 0;
for (const v of all) {
  const e = validateVariant(v, template, bank);
  if (e.length || v.max_points !== 17) { bad++; console.log('FAIL', v.variant_number, e); }
}
const freq = {};
for (const v of all) for (const q of v.questions) freq[q.task_id] = (freq[q.task_id] || 0) + 1;
const cov = Object.keys(freq).length;
const maxF = Math.max(...Object.values(freq));
const minF = Math.min(...Object.values(freq));
console.log(`variants bad: ${bad}/30, coverage: ${cov}/${bank.length} tasks, freq min=${minF} max=${maxF}`);
if (bad > 0) process.exit(1);
console.log('BANK-30 OK');
