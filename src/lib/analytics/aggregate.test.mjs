// Unit-тесты агрегатора аналитики. Запуск: node src/lib/analytics/aggregate.test.mjs
import { strict as assert } from 'node:assert';
import { mastery, taskCorrect, statsForWork, summary } from './aggregate.mjs';

const tasks = [
  { id: 'q1', type: 'numeric_base', expected: 13, base: 10, lesson: 'l1', points: 2, prompt: 'P1' },
  { id: 'q2', type: 'single_choice', correct: 'B', lesson: 'l1', points: 1, prompt: 'P2' },
  { id: 'q3', type: 'matching', answerMap: { A: '1', B: '2' }, lesson: 'l2', points: 2, prompt: 'P3' },
  { id: 'q4', type: 'code_run', lesson: 'l2', points: 2, prompt: 'P4' },
];

// taskCorrect
assert.equal(taskCorrect(tasks[0], '13'), true);
assert.equal(taskCorrect(tasks[0], '1101'), false); // не та система — мимо
assert.equal(taskCorrect(tasks[0], ''), false);
assert.equal(taskCorrect(tasks[1], 'b'), true); // регистр не важен
assert.equal(taskCorrect(tasks[1], 'A'), false);
assert.equal(taskCorrect(tasks[2], { A: '1', B: '2' }), true);
assert.equal(taskCorrect(tasks[2], '{"A":"1","B":"2"}'), true); // JSON-строка из журнала
assert.equal(taskCorrect(tasks[2], 'A=1, B=2'), true); // формат тихой сдачи
assert.equal(taskCorrect(tasks[2], { A: '1', B: '9' }), false);
assert.equal(taskCorrect(tasks[3], 'print(1)'), null); // code_run пропускается

// mastery
assert.equal(mastery(100), 'ok');
assert.equal(mastery(75), 'ok');
assert.equal(mastery(74.9), 'shaky');
assert.equal(mastery(50), 'shaky');
assert.equal(mastery(49.9), 'weak');

// statsForWork: 4 ученика, q1 все верно, q2 половина, q3 один верный
const rows = [
  { answers: { q1: '13', q2: 'B', q3: '{"A":"1","B":"2"}' } },
  { answers: { q1: '13', q2: 'A', q3: '{"A":"1","B":"0"}' } },
  { answers: { q1: '13', q2: 'B', q3: '{}' } },
  { answers: { q1: '13', q2: 'C', q3: '' } },
];
const st = statsForWork(rows, tasks);
assert.equal(st.students, 4);
assert.deepEqual(st.perTask.map((q) => [q.id, q.n, q.correct]), [['q1', 4, 4], ['q2', 4, 2], ['q3', 4, 1], ['q4', 0, 0]]);
assert.equal(st.perTask[0].pct, 100);
assert.equal(st.perTask[1].pct, 50);
// темы: l1 (q1+q2) — 6/8 = 75% ok; l2 (q3) — 1/4 = 25% weak; сортировка от слабых
assert.equal(st.perLesson[0].lesson, 'l2');
assert.equal(st.perLesson[0].level, 'weak');
assert.equal(st.perLesson[1].lesson, 'l1');
assert.equal(st.perLesson[1].level, 'ok');

// summary
const s = summary([{ percent: 80, proposed_mark: 4 }, { percent: 60, proposed_mark: 3 }]);
assert.deepEqual(s, { students: 2, avgPercent: 70, avgMark: 3.5 });
assert.deepEqual(summary([]), { students: 0, avgPercent: 0, avgMark: 0 });

console.log('analytics aggregate: all ok');
