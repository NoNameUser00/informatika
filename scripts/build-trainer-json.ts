// Сборка тренерских JSON из YAML-банков (single source — YAML).
// teacher_only НЕ попадает в JSON, кроме полей клиентской проверки тренажера.
// Каждый ключ самопроверяется через check.mjs (scripts/task-json.ts).
// Порядок заданий — по номеру КТП урока (scripts/lesson-ktp.ts).
// Запуск: npm run trainer:json
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import { convert } from './task-json';
import { ktpRank } from './lesson-ktp';

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
  { inputs: ['data/tasks/7/information/bank-7inf.yaml', 'data/tasks/7/base/bank-7base.yaml', 'data/tasks/7/media/bank-7media.yaml'],
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
  { inputs: ['data/tasks/11/data/bank-11data.yaml'],
    output: 'src/data/data11-tasks.json', test_code: 'data11-v1', variant: 'trainer-v1',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.' },
  { inputs: ['data/tasks/11/db/bank-11db.yaml'],
    output: 'src/data/db11-tasks.json', test_code: 'db11-v1', variant: 'trainer-v1',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.' },
  { inputs: ['data/tasks/11/algo/bank-11algo.yaml'],
    output: 'src/data/algo11-tasks.json', test_code: 'algo11-v1', variant: 'trainer-v1',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.' },
  { inputs: ['data/tasks/11/net/bank-11net.yaml'],
    output: 'src/data/net11-tasks.json', test_code: 'net11-v1', variant: 'trainer-v1',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.' },
  { inputs: ['data/tasks/11/graph/bank-11graph.yaml'],
    output: 'src/data/graph11-tasks.json', test_code: 'graph11-v1', variant: 'trainer-v1',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.' },
];

for (const job of JOBS) {
  const bank = job.inputs.flatMap((p: string) => parse(readFileSync(p, 'utf-8')));
  const tasks = bank.map(convert);
  // Порядок — по КТП: тренажёр идёт вместе с уроками, а не по имени файла.
  tasks.sort((a, b) => ktpRank(a.lesson) - ktpRank(b.lesson) || (a.id < b.id ? -1 : 1));
  const max = tasks.reduce((s, t) => s + t.points, 0);
  writeFileSync(job.output,
    JSON.stringify({ test_code: job.test_code, variant: job.variant, max_score: max, instruction: job.instruction, page_size: 5, tasks }, null, 2) + '\n',
    'utf-8');
  console.log(`TRAINER JSON OK: ${job.output} — ${tasks.length} заданий, max=${max}`);
}
