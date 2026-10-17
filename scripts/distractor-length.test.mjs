// Запас длины как метрика: не должна выдавать верный вариант и не должна
// молчать там, где выдаёт.
//
// Проверяются три вещи:
//
//  1) isNumericLike отличает числа от текста с числами. Здесь была ошибка, и
//     ошибка молчаливая: вариант «24 строк, и учебный текст читается легче»
//     считался числом, потому что \w в JavaScript — это только [A-Za-z0-9_].
//     Задание выпадало из ведомости целиком, и никто об этом не узнавал.
//     Регрессия проверяется на реальном тексте из банка.
//  2) giveawayPct считает запас по второму по длине варианту и умеет давать
//     отрицательное значение (верный короче всех — тоже подсказка).
//  3) Согласованность с данными: ни одно задание, которое метрика считает
//     выдающим себя с запасом больше 50 %, не должно отсутствовать в ведомости.
//     Это страховка от молчаливых пропусков любого рода, а не только от той
//     ошибки, что была раньше.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { giveawayPct, isNumericLike, len } from './distractor-length.mjs';

let failed = 0;
const fail = (msg) => {
  failed++;
  console.log(`  FAIL ${msg}`);
};

// ── 1. числа против текста с числами ──
const NUMERIC = ['8', '9', '10', '7', '-3', '0,5', '1024', '2^10'];
for (const s of NUMERIC) {
  if (!isNumericLike(s)) fail(`isNumericLike должен считать числом: «${s}»`);
}
const NOT_NUMERIC = [
  '24 строк, и учебный текст в таком виде читается легче',
  '6 строк: остальные колонки переносятся на следующую страницу',
  '4 варианта по 6 кадров',
  'точка с запятой',
  '5 человек: это область A ∧ B',
  '',
  null,
];
for (const s of NOT_NUMERIC) {
  if (isNumericLike(s)) fail(`isNumericLike не должен считать числом: «${s}»`);
}

// Латиница тоже буква: «S3» — не число.
if (isNumericLike('S3')) fail('isNumericLike не должен считать числом: «S3»');

// ── 2. запас длины ──
const g = giveawayPct(
  [
    { id: 'A', text: 'короткий' },
    { id: 'B', text: 'подлиннее вариант' },
    { id: 'C', text: 'самый длинный вариант здесь' },
  ],
  'C',
);
if (!g || g.pct !== Math.round((g.mine - g.second) / g.second * 100)) {
  fail(`запас не сходится с собственной формулой: ${JSON.stringify(g)}`);
}
if (!g || g.second !== len('подлиннее вариант')) {
  fail(`второй по длине взят неверно: ${JSON.stringify(g)}`);
}
if (!g || g.pct <= 0) fail(`ожидался положительный запас, а получено ${g?.pct}`);

// Верный короче всех — запас отрицательный, а не 0.
const short = giveawayPct(
  [
    { id: 'A', text: 'очень длинный отвлекающий вариант' },
    { id: 'B', text: 'тоже длинный второй вариант' },
    { id: 'C', text: 'да' },
  ],
  'C',
);
if (!short || short.pct >= 0) fail(`верный короче всех должен давать отрицательный запас: ${short?.pct}`);

// Ключа среди вариантов нет — мерить нечего.
if (giveawayPct([{ id: 'A', text: 'да' }], 'Z') !== null) fail('нет варианта с таким ключом');
if (giveawayPct([{ id: 'A', text: 'да' }], 'A') !== null) fail('один вариант мерить нечего');

// ── 3. ведомость не должна пропускать выдающие себя задания ──
function walk(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (n.endsWith('.yaml')) acc.push(p);
  }
  return acc;
}

const THRESHOLD = 50;
const gross = new Map(); // id -> prompt, задания с запасом строго больше порога
for (const f of walk('data/tasks')) {
  for (const t of parse(readFileSync(f, 'utf-8')) ?? []) {
    if (t?.type !== 'single_choice') continue;
    const opts = t.student_view?.options ?? [];
    if (opts.length < 2) continue;
    if (opts.every((o) => isNumericLike(o.text))) continue;
    const m = giveawayPct(opts, t.teacher_only?.answer);
    if (m && m.pct > THRESHOLD) gross.set(t.id, t.prompt);
  }
}

const dir = 'docs/review/distractors';
let sheets = 0;
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.md') || f === 'README.md') continue;
  sheets++;
  const body = readFileSync(join(dir, f), 'utf-8');
  for (const id of gross.keys()) {
    if (!body.includes(id)) fail(`${id} выдаёт себя длиной, но его нет в ведомости ${f}`);
  }
}
if (!sheets) fail('в ведомости нет ни одного листа — проверка ничего не подтверждает');

// Наоборот: в ведомости не должно быть заданий, которые уже не выдают себя,
// иначе лист врёт и правки в нём бессмысленны.
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.md') || f === 'README.md') continue;
  for (const m of readFileSync(join(dir, f), 'utf-8').matchAll(/^## \d+\. (\S+)/gm)) {
    if (!gross.has(m[1])) fail(`${m[1]} перечислен в ведомости ${f}, но метрикой не ловится`);
  }
}

if (failed) {
  console.log(`\nЗАПАС ДЛИНЫ: провалено проверок ${failed}`);
  process.exit(1);
}
console.log(`  OK запас длины: выдающих себя заданий ${gross.size}, листов ведомости ${sheets}`);