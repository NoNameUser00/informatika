// Тесты выбора варианта и сборки вопросов варианта (src/lib/variants/resolve.mjs).
import { pickVariantNumber, findVariant, materialize, resolveWork } from './resolve.mjs';

let fails = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `: got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
  if (!ok) fails++;
}

const POOL = [
  { id: 't1', type: 'single_choice', points: 1, prompt: 'p1',
    options: [{ id: 'A', text: 'a' }, { id: 'B', text: 'b' }, { id: 'C', text: 'c' }, { id: 'D', text: 'd' }] },
  { id: 't2', type: 'numeric_base', points: 2, prompt: 'p2' },
  { id: 't3', type: 'matching', points: 3, prompt: 'p3', left: ['x'], right: ['1', '2'] },
  { id: 't4', type: 'numeric_base', points: 1, prompt: 'p4' },
];
const DATA = {
  test_code: 'x-control-v1',
  variant_count: 3,
  pool: POOL,
  variants: [
    { number: 1, task_ids: ['t1', 't2'], orders: { t1: { options: ['C', 'A', 'D', 'B'] } }, max_score: 3 },
    { number: 2, task_ids: ['t3', 't4'], orders: { t3: { right: ['2', '1'] } }, max_score: 4 },
    { number: 3, task_ids: ['t4', 't3'], max_score: 4 },
  ],
};

// 1. Явный ?v= побеждает.
eq('requested wins', pickVariantNumber(3, '2', 'Иванов'), 2);

// 2. Без ФИО и без ?v= — первый вариант.
eq('empty seed -> 1', pickVariantNumber(3, null, '   '), 1);

// 3. От ФИО детерминированно и всегда в диапазоне.
const a = pickVariantNumber(30, null, 'Иванов Иван');
const b = pickVariantNumber(30, null, 'Иванов Иван');
eq('deterministic by seed', a, b);
eq('in range', a >= 1 && a <= 30, true);

// 4. Два ученика не гарантированно разные — но диапазон соблюдён.
const many = Array.from({ length: 200 }, (_, i) => pickVariantNumber(30, null, `student_${i + 1}`));
eq('all in range', many.every((v) => v >= 1 && v <= 30), true);
eq('variants spread', new Set(many).size > 1, true);

// 5. Мусор в ?v= игнорируется, как будто его нет.
eq('garbage ?v= ignored', pickVariantNumber(3, 'abc', 'Петров') === pickVariantNumber(3, null, 'Петров'), true);

// 6. Выход за границы не ломает: число остаётся валидным.
const wrapped = pickVariantNumber(3, '7', 'x');
eq('out of range wrapped', wrapped >= 1 && wrapped <= 3, true);

// 7. Перестановка вариантов ответа применена, id сохранены.
const v1 = findVariant(DATA, 1);
const tasks1 = materialize(DATA, v1);
eq('variant 1 order', tasks1.map((t) => t.id), ['t1', 't2']);
eq('options reordered', tasks1[0].options.map((o) => o.id), ['C', 'A', 'D', 'B']);
eq('option texts follow ids', tasks1[0].options.map((o) => o.text), ['c', 'a', 'd', 'b']);

// 8. Перестановка правой части соответствий.
const v2 = findVariant(DATA, 2);
eq('matching right reordered', materialize(DATA, v2)[0].right, ['2', '1']);

// 9. Без перестановки задание берётся как есть.
const v3 = findVariant(DATA, 3);
const tasks3 = materialize(DATA, v3);
eq('no orders -> as is', tasks3[0].options === undefined && tasks3[0].id, 't4');

// 10. resolveWork собирает всё вместе и не падает на неизвестном номере.
const r = resolveWork(DATA, { requested: '1', seedText: 'x' });
eq('resolve number', r.number, 1);
eq('resolve tasks', r.tasks.length, 2);
eq('unknown variant -> first', findVariant(DATA, 99).number, 1);

// 11. Пул заданий не мутируется: порядок вариантов — копия.
const before = POOL[0].options.map((o) => o.id);
materialize(DATA, v1);
eq('pool not mutated', POOL[0].options.map((o) => o.id), before);

console.log(fails === 0 ? 'ALL OK' : `${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
