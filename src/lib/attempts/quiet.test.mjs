import { buildQuietAttempt, plainAnswers, quietStatus } from './quiet.mjs';

let n = 0;
function eq(name, got, want) {
  n++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) {
    console.error(`FAIL ${name}: got ${a}, want ${b}`);
    process.exitCode = 1;
  } else console.log(`ok ${n} ${name}`);
}

const tasks = [
  { id: 't1', type: 'numeric_base' },
  { id: 't2', type: 'single_choice' },
  { id: 't3', type: 'matching', left: ['a', 'b'] },
  { id: 't4', type: 'code_run' },
];

eq('plain string', plainAnswers(tasks, { t1: '11' }).t1, '11');
eq('plain matching', plainAnswers(tasks, { t3: { a: 'x' } }).t3, '{"a":"x"}');
eq('plain missing', plainAnswers(tasks, {}).t2, '""');

const full = buildQuietAttempt({
  surname: 'Иванов', firstname: 'Иван', className: '8-Ю',
  testType: 'proverka', testCode: 'x', variant: 'v1',
  tasks, answers: { t1: '11', t2: 'C', t3: { a: 'x', b: 'y' }, t4: 'print(1)' },
});
eq('answered all', full.answered, 4);
eq('no keys', 'keys' in full, false);
eq('no score', 'auto_score' in full, false);
eq('no mark', 'proposed_mark' in full, false);

const part = buildQuietAttempt({
  surname: 'И', firstname: 'И', className: '8-Ю',
  testType: 'trainer', testCode: 'x', variant: 'v1',
  tasks, answers: { t1: '11' },
});
eq('answered part', part.answered, 1);
eq('status text', quietStatus(part), 'Ответы сохранены (1 из 4). Правильность и отметку скажет учитель.');
