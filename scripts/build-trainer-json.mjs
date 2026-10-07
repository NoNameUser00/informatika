// Сборка тренерских JSON из YAML-банков (single source — YAML).
// teacher_only НЕ попадает в JSON, кроме полей клиентской проверки тренажера.
// Каждый ключ самопроверяется через check.mjs.
// Запуск: npm run trainer:json
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import { checkNumericBase, checkSingleChoice, checkMatching } from '../src/lib/scoring/check.mjs';

const LESSON_ORDER = ['numsys-01-intro', 'numsys-02-binary', 'numsys-03-octal', 'numsys-04-hex', 'numsys-05-arith', 'numsys-06-review',
  'logic-01-utterances', 'logic-02-operations', 'logic-03-truth-tables', 'logic-04-elements',
  'alg-01-performers', 'alg-02-notation', 'alg-03-branching', 'alg-04-loops',
  '7inf-01-info', '7inf-02-coding', '7inf-03-measure', '7inf-04-textvolume'];

const JOBS = [
  { inputs: ['data/tasks/8/number-systems/bank.yaml', 'data/tasks/8/number-systems/bank-gen.yaml'],
    output: 'src/data/numsys-tasks.json', test_code: 'numsys-pilot-v1', variant: 'trainer-v1',
    instruction: 'В ответе запишите только само число. Основание системы счисления (₂, ₈, ₁₀, ₁₆) указывать не нужно.' },
  { inputs: ['data/tasks/8/logic/bank-logic.yaml'],
    output: 'src/data/logic-tasks.json', test_code: 'logic-pilot-v1', variant: 'trainer-v1',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.' },
  { inputs: ['data/tasks/8/algorithms/bank-algo.yaml'],
    output: 'src/data/algo-tasks.json', test_code: 'algo-pilot-v1', variant: 'trainer-v1',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.' },
  { inputs: ['data/tasks/7/information/bank-7inf.yaml', 'data/tasks/7/base/bank-7base.yaml'],
    output: 'src/data/grade7-tasks.json', test_code: 'grade7-info-v1', variant: 'trainer-v1',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.' },
  { inputs: ['data/tasks/8/code-run/bank-code.yaml'],
    output: 'src/data/code-tasks.json', test_code: 'code-pilot-v1', variant: 'trainer-v1',
    instruction: 'Напиши код, запусти его кнопкой и добейся совпадения вывода с ожидаемым.' },
  { inputs: ['data/tasks/9/spreadsheets/bank-9sheet.yaml'],
    output: 'src/data/sheet9-tasks.json', test_code: 'sheet9-v1', variant: 'trainer-v1',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.' },
  { inputs: ['data/tasks/9/arrays/bank-9arr.yaml'],
    output: 'src/data/arr9-tasks.json', test_code: 'arr9-v1', variant: 'trainer-v1',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.' },
  { inputs: ['data/tasks/9/graphs/bank-9graph.yaml'],
    output: 'src/data/graph9-tasks.json', test_code: 'graph9-v1', variant: 'trainer-v1',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.' },
  { inputs: ['data/tasks/9/extra/bank-9extra.yaml'],
    output: 'src/data/extra9-tasks.json', test_code: 'extra9-v1', variant: 'trainer-v1',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.' },
  { inputs: ['data/tasks/10/base/bank-10base.yaml'],
    output: 'src/data/base10-tasks.json', test_code: 'base10-v1', variant: 'trainer-v1',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.' },
  { inputs: ['data/tasks/10/ss/bank-10ss.yaml'],
    output: 'src/data/ss10-tasks.json', test_code: 'ss10-v1', variant: 'trainer-v1',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.' },
  { inputs: ['data/tasks/10/logic/bank-10logic.yaml'],
    output: 'src/data/logic10-tasks.json', test_code: 'logic10-v1', variant: 'trainer-v1',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.' },
  { inputs: ['data/tasks/10/media/bank-10media.yaml'],
    output: 'src/data/media10-tasks.json', test_code: 'media10-v1', variant: 'trainer-v1',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.' },
];

function convert(t) {
  if (t.type === 'numeric_base') {
    const exp = t.teacher_only.accepted_values_decimal[0];
    const r = checkNumericBase(exp, t.teacher_only.answer_text, t.student_view.base);
    if (!r.isCorrect) throw new Error(`selfcheck FAIL ${t.id}`);
    return { id: t.id, lesson: t.lesson, type: t.type, points: t.points, prompt: t.prompt,
      base: t.student_view.base, expected: exp, key: t.teacher_only.answer_text };
  }
  if (t.type === 'single_choice') {
    if (!t.student_view.options.some((o) => o.id === t.teacher_only.answer)) throw new Error(`selfcheck FAIL ${t.id}`);
    return { id: t.id, lesson: t.lesson, type: t.type, points: t.points, prompt: t.prompt,
      options: t.student_view.options, correct: t.teacher_only.answer, key: t.teacher_only.answer };
  }
  if (t.type === 'matching') {
    const full = Object.fromEntries(t.student_view.left.map((k) => [k, t.teacher_only.answer_map[k] ?? '']));
    const r = checkMatching(t.teacher_only.answer_map, full, t.points);
    if (!r.isCorrect || r.score !== t.points) throw new Error(`selfcheck FAIL ${t.id}`);
    return { id: t.id, lesson: t.lesson, type: t.type, points: t.points, prompt: t.prompt,
      left: t.student_view.left, right: t.student_view.right, answerMap: t.teacher_only.answer_map,
      key: t.student_view.left.map((k) => `${k}=${t.teacher_only.answer_map[k]}`).join(', ') };
  }
  if (t.type === 'code_run') {
    // Эталон проверен прогоном solution_code локальным Python при написании банка.
    // В CI только структурная проверка: непустые решение и ожидаемый вывод.
    if (!t.teacher_only.solution_code.trim() || !t.teacher_only.expected_stdout) throw new Error(`selfcheck FAIL ${t.id}`);
    return { id: t.id, lesson: t.lesson, type: t.type, points: t.points, prompt: t.prompt,
      template: t.student_view.template, expected: t.teacher_only.expected_stdout,
      key: t.teacher_only.expected_stdout };
  }
  throw new Error(`unknown type ${t.type} (${t.id})`);
}

for (const job of JOBS) {
  const bank = job.inputs.flatMap((p) => parse(readFileSync(p, 'utf-8')));
  const tasks = bank.map(convert);
  tasks.sort((a, b) => LESSON_ORDER.indexOf(a.lesson) - LESSON_ORDER.indexOf(b.lesson) || (a.id < b.id ? -1 : 1));
  const max = tasks.reduce((s, t) => s + t.points, 0);
  writeFileSync(job.output,
    JSON.stringify({ test_code: job.test_code, variant: job.variant, max_score: max, instruction: job.instruction, page_size: 5, tasks }, null, 2) + '\n',
    'utf-8');
  console.log(`TRAINER JSON OK: ${job.output} — ${tasks.length} заданий, max=${max}`);
}
