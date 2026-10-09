// Дописывает банки 8 класса по логике и алгоритмам — третий заход: 12 заданий.
//
//   data/tasks/8/logic/bank-logic.yaml    — 8 заданий (inf-8-logic-063 … inf-8-logic-070)
//   data/tasks/8/algorithms/bank-algo.yaml — 4 задания (inf-8-algo-069 … inf-8-algo-072)
//
// Устройство как в scripts/make-8-bank2.mjs и scripts/make-11-bank2.mjs:
//
//   * ответы НЕ пишутся руками — их считает код, и тут же сверяет assert-ом;
//   * истинность логических выражений считается перебором ВСЕХ наборов 0/1
//     (truthRows), а не «на глаз»: (A ∨ B) ∧ ¬A — это ¬A ∧ B, а не A ∧ B;
//   * эталоны code_run прогоняются локальным Python, expected_stdout берётся
//     из РЕАЛЬНОГО вывода solution_code;
//   * в single_choice правильный вариант задаётся ТЕКСТО, буква вычисляется кодом;
//   * в matching карта собирается кодом из массивов left/right;
//   * topic и subtopic цитируются (значение с двоеточием ломает YAML);
//   * запись идемпотентна: блок режется по своему маркеру MARK и пишется заново.
//
// Запуск: node scripts/make-8-logicalgo-bank3.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const MARK = '# ==== СГЕНЕРИРОВАНО scripts/make-8-logicalgo-bank3.mjs ====';

const BANK = {
  logic: { file: 'data/tasks/8/logic/bank-logic.yaml', pfx: 'inf-8-logic-' },
  algo: { file: 'data/tasks/8/algorithms/bank-algo.yaml', pfx: 'inf-8-algo-' },
};

// Темы — как у соседних заданий тех же файлов.
const T_L = 'Элементы математической логики';
const T_ANALYSIS = 'Анализ алгоритмов';
const T_PY_TYPES = 'Типы данных и ввод';
const T_PY_EXPR = 'Выражения и линейные алгоритмы';

// Требования и элементы ФРП + предметные указатели — как у соседей по темам.
const F = {
  utter: { req: 1.3, el: 1.5, subj: 'inf-8-logic-utter' },
  tables: { req: 1.4, el: 1.6, subj: 'inf-8-logic-tables' },
  elements: { req: 1.4, el: 1.7, subj: 'inf-8-logic-elements' },
  expr: { req: 1.4, el: 1.5, subj: 'inf-8-logic-ops' },
  laws: { req: 1.4, el: 1.5, subj: 'inf-8-logic-laws' },
  analysis: { req: 1.4, el: 1.5, subj: 'inf-8-algo-analysis' },
  pyTypes: { req: 1.4, el: 1.5, subj: 'inf-8-py-types' },
  pyExpr: { req: 1.4, el: 1.5, subj: 'inf-8-py-expr' },
};

// ─────────────────────────── assert-хелперы ───────────────────────────
let checks = 0;
function eq(got, want, msg) {
  checks += 1;
  if (got !== want) {
    throw new Error(`ASSERT FAIL: ${msg}: получено ${JSON.stringify(got)}, ожидалось ${JSON.stringify(want)}`);
  }
}
function ok(cond, msg) {
  checks += 1;
  if (!cond) throw new Error(`ASSERT FAIL: ${msg}`);
}

// ─────────────────────────── вычисления ───────────────────────────
/** Строка в двойных кавычках для YAML (совместима с JSON: \\, \", \n). */
const q = (s) => JSON.stringify(String(s));
const LETTERS = 'ABCD';
const list = (a) => a.join(', ');

// Логика 8 класса. Значение выражения — перебором ВСЕХ наборов значений.
const NOT = (a) => (a ? 0 : 1);
const AND = (...xs) => (xs.every(Boolean) ? 1 : 0);
const OR = (...xs) => (xs.some(Boolean) ? 1 : 0);
/** Исключающее ИЛИ: 1 тогда и только тогда, когда сигналы РАЗНЫЕ. */
const XOR = (a, b) => AND(OR(a, b), NOT(AND(a, b)));

/**
 * Все наборы значений n переменных в порядке учебника: 00, 01, 10, 11 (старший
 * разряд слева). Возвращает [{ vars: [0,1], v: 0|1 }].
 */
function truthRows(n, f) {
  const out = [];
  for (let mask = 0; mask < 2 ** n; mask++) {
    const vars = Array.from({ length: n }, (_, i) => (mask >> (n - 1 - i)) & 1);
    out.push({ vars, v: f(...vars) });
  }
  return out;
}
/** Сколько строк таблицы истинности дают 1. */
const countTrue = (n, f) => truthRows(n, f).filter((r) => r.v === 1).length;
/** Значения выражения на всех наборах — по порядку строк таблицы. */
const rowValues = (n, f) => truthRows(n, f).map((r) => r.v);

/**
 * Все способы расставить скобки в цепочке высказываний (дерево, а не строка):
 * рекурсивно делим цепочку в каждой возможной точке. Для 4 высказываний — 5.
 */
function bracketTrees(items) {
  if (items.length === 1) return [items[0]];
  const out = [];
  for (let k = 0; k < items.length - 1; k++) {
    for (const l of bracketTrees(items.slice(0, k + 1))) {
      for (const r of bracketTrees(items.slice(k + 1))) out.push({ op: AND, l, r });
    }
  }
  return out;
}
const evalTree = (t, env) => (typeof t === 'string' ? env[t] : t.op(evalTree(t.l, env), evalTree(t.r, env)));
const renderTree = (t) => (typeof t === 'string' ? t : `(${renderTree(t.l)} ∧ ${renderTree(t.r)})`);

// ───────────────────── локальный Python (эталон) ─────────────────────
const PY = ['python', 'python3'].find((cmd) => {
  try { execFileSync(cmd, ['-c', 'pass']); return true; } catch { return false; }
});
/** Реальный stdout эталона: \r\n -> \n, хвостовые переводы строк срезаны. */
function pyRun(code) {
  if (!PY) throw new Error('локальный Python не найден (нужен python или python3 в PATH)');
  try {
    return execFileSync(PY, ['-c', code], {
      encoding: 'utf-8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      timeout: 20000,
    }).replace(/\r\n/g, '\n').replace(/\n+$/, '');
  } catch (e) {
    throw new Error(`эталон Python не выполнился: ${String(e.stderr ?? e.message).trim()}`);
  }
}

// ───────────────────────── конструкторы заданий ─────────────────────────
const POINTS = { basic: 1, intermediate: 2, advanced: 3 };
const COG_FOR = { basic: 'remember', intermediate: 'apply', advanced: 'analyze' };

const out = { logic: [], algo: [] };

function push(bank, o) {
  const points = POINTS[o.diff];
  if (!points) throw new Error(`${o.lesson}: неизвестная сложность ${o.diff}`);
  if (o.cog !== COG_FOR[o.diff]) {
    throw new Error(`${o.lesson}: cognitive_level ${o.cog} не соответствует сложности ${o.diff}`);
  }
  if (!o.lesson) throw new Error(`${bank}: задание без lesson`);
  if (!o.f || !o.f.subj) throw new Error(`${o.lesson}: не передан профиль ФРП (f)`);
  if (String(o.sub).includes(':')) throw new Error(`двоеточие в subtopic: ${o.sub}`);
  if (!String(o.prompt).trim()) throw new Error(`${o.lesson}: пустой вопрос`);
  if (o.topic !== T_L && o.topic !== T_ANALYSIS && o.topic !== T_PY_TYPES && o.topic !== T_PY_EXPR) {
    throw new Error(`${o.lesson}: незнакомая тема ${o.topic}`);
  }
  out[bank].push({
    lesson: o.lesson, topic: o.topic, sub: o.sub, type: o.type,
    diff: o.diff, cog: o.cog, points, subj: o.f.subj, req: o.f.req, el: o.f.el,
    prompt: o.prompt, sv: o.sv, ac: o.ac, to: o.to,
  });
}

/** numeric_base: значение обязано считаться кодом, ключ выводится из него. */
function nb(bank, o) {
  const value = o.calc();
  if (!Number.isInteger(value)) throw new Error(`${o.lesson}: ответ не целый — ${value}`);
  if (value < 0) throw new Error(`${o.lesson}: отрицательный ответ ${value}`);
  const base = o.base ?? 10;
  if (base !== 10) throw new Error(`${o.lesson}: в логике основание только 10`);
  const key = String(value);
  push(bank, {
    ...o, type: 'numeric_base',
    sv: `{ base: 10, placeholder: "только число" }`,
    ac: '{ method: numeric_base, base: 10, strip_affixes: true }',
    to: `{ accepted_values_decimal: [${value}], answer_text: ${q(key)}, explanation: ${q(o.why)} }`,
  });
}

/** single_choice: правильный вариант задаётся ТЕКСТО, буква вычисляется кодом. */
function sc(bank, o) {
  const texts = o.opts.map(String);
  if (texts.length < 2 || texts.length > 4) throw new Error(`${o.lesson}: вариантов ${texts.length} (нужно 2–4)`);
  if (new Set(texts).size !== texts.length) throw new Error(`${o.lesson}: варианты повторяются`);
  const i = texts.indexOf(String(o.correct));
  if (i < 0) throw new Error(`${o.lesson}: правильного варианта «${o.correct}» нет среди вариантов`);
  push(bank, {
    ...o, type: 'single_choice',
    sv: `{ options: [${texts.map((t, k) => `{ id: ${LETTERS[k]}, text: ${q(t)} }`).join(', ')}] }`,
    ac: '{ method: exact_option }',
    to: `{ answer: ${LETTERS[i]}, explanation: ${q(o.why)} }`,
  });
}

/** matching: карта собирается кодом из столбцов, соответствие проверяется на полный балл. */
function mat(bank, o) {
  const left = o.left.map(String);
  const right = o.right.map(String);
  if (left.length !== right.length) throw new Error(`${o.lesson}: слева ${left.length}, справа ${right.length}`);
  if (new Set(left).size !== left.length) throw new Error(`${o.lesson}: левый столбец с повторами`);
  if (new Set(right).size !== right.length) throw new Error(`${o.lesson}: правый столбец с повторами`);
  const map = {};
  for (const k of left) {
    if (!(k in o.map)) throw new Error(`${o.lesson}: нет ответа для «${k}»`);
    const v = String(o.map[k]);
    if (!right.includes(v)) throw new Error(`${o.lesson}: ответ «${v}» нет среди правых вариантов`);
    map[k] = v;
  }
  if (new Set(Object.values(map)).size !== left.length) {
    throw new Error(`${o.lesson}: соответствие неоднозначно — правый столбец использован не весь`);
  }
  push(bank, {
    ...o, type: 'matching',
    sv: `{ left: [${left.map(q).join(', ')}], right: [${right.map(q).join(', ')}] }`,
    ac: '{ method: matching, partial: proportional }',
    to: `{ answer_map: { ${left.map((k) => `${q(k)}: ${q(map[k])}`).join(', ')} }, explanation: ${q(o.why)} }`,
  });
}

/** code_run: эталон реально исполняется, expected_stdout — из фактического вывода. */
function cr(bank, o) {
  const stdout = pyRun(o.solution);
  if (stdout !== o.expected) {
    throw new Error(`${o.lesson}: эталон не сошёлся\nожидалось: ${JSON.stringify(o.expected)}\nполучили:  ${JSON.stringify(stdout)}`);
  }
  ok(stdout.length > 0, `${o.lesson}: эталон ничего не вывел`);
  // Вывод декодирован как utf-8: русский текст обязан совпасть байт в байт с ожиданием.
  ok(typeof stdout === 'string' && !stdout.includes('\uFFFD'),
    `${o.lesson}: в выводе эталона битые символы — проверьте кодировку Python`);
  push(bank, {
    ...o, type: 'code_run',
    sv: `{ language: python, template: ${q(o.template)} }`,
    ac: '{ method: code_stdout, timeout_s: 10 }',
    to: `{ solution_code: ${q(o.solution)}, expected_stdout: ${q(stdout)}, explanation: ${q(o.why)} }`,
  });
}

// ═════════════════════ ЛОГИКА · 8 заданий ═════════════════════

// ── logic-01-utterances (1/0/0) · высказывание и его отрицание ──
{
  // У каждой пары «высказывание — его отрицание» ровно одно истинно.
  const pairs = [
    ['«9 делится на 5»', (x) => x % 5 === 0, (x) => x % 5 !== 0],
    ['«2² = 4»', (x) => x ** 2 === 4, (x) => x ** 2 !== 4],
    ['«В треугольнике четыре стороны»', () => false, () => true],
    ['«13 больше 20»', () => false, () => true],
  ];
  const truth = [
    pairs[0][1](9), pairs[0][2](9),
    pairs[1][1](2), pairs[1][2](2),
  ];
  eq(truth.join(' '), 'false true true false', 'истинность первых двух пар высказываний');
  for (const [, f, g] of pairs) {
    const a = f();
    const b = g();
    eq(a === b, false, 'отрицание должно менять истинность на противоположную');
    eq([a, b].filter(Boolean).length, 1, 'в паре «высказывание — отрицание» истинно ровно одно');
  }
  const left = pairs.map((p) => p[0]);
  const right = [
    '«13 не больше 20»',
    '«9 не делится на 5»',
    '«В треугольнике не четыре стороны»',
    '«2² ≠ 4»',
  ];
  mat('logic', {
    lesson: 'logic-01-utterances', topic: T_L, sub: 'Высказывание и его отрицание',
    diff: 'basic', cog: 'remember', f: F.utter,
    prompt: 'Установите соответствие: высказывание — его отрицание.',
    left, right,
    map: {
      [left[0]]: right[1],
      [left[1]]: right[3],
      [left[2]]: right[2],
      [left[3]]: right[0],
    },
    why: 'Отрицание меняет утверждение на противоположное по смыслу и потому всегда имеет противоположную истинность: в каждой паре истинно ровно одно высказывание. «9 делится на 5» ложно, значит «9 не делится на 5» истинно, а «2² = 4» истинно, значит «2² ≠ 4» ложно. В отрицании меняют сам знак отношения, а не только слово: «не больше» — это «меньше или равно».',
  });
}

// ── logic-03-truth-tables (1/0/0) · полное исследование формулы ──
{
  // (A ∨ B) ∧ (A ∨ C) — полный перебор всех 8 наборов трёх переменных.
  const f = (a, b, c) => AND(OR(a, b), OR(a, c));
  const n = countTrue(3, f);
  eq(n, 5, 'единиц в (A ∨ B) ∧ (A ∨ C) среди 8 наборов');
  const rows = truthRows(3, f).filter((r) => r.v === 1).map((r) => r.vars.join(''));
  eq(rows.join(','), '011,100,101,110,111', 'строки с единицей');
  // По закону распределительности то же самое: A ∨ (B ∧ C).
  const g = (a, b, c) => OR(a, AND(b, c));
  eq(rowValues(3, f).join(''), rowValues(3, g).join(''), 'распределительность даёт ту же таблицу');
  nb('logic', {
    lesson: 'logic-03-truth-tables', topic: T_L, sub: 'Полное исследование формулы',
    diff: 'basic', cog: 'remember', f: F.tables,
    calc: () => n,
    prompt: 'Постройте таблицу истинности для трёх переменных и выясните, в скольких её строках выражение (A ∨ B) ∧ (A ∨ C) равно 1. Запишите только число.',
    why: `Перебираем все 8 наборов: единица получается в строках ${list(rows)}. При A = 1 обе скобки истинны, поэтому выражение истинно во всех четырёх таких строках; при A = 0 остаётся B ∧ C, и это единица только в строке 011. Итого ${n}. Проверка: по закону распределительности (A ∨ B) ∧ (A ∨ C) = A ∨ (B ∧ C) — таблица совпадает.`,
  });
}

// ── logic-04-elements (2/0/0) · исключающее ИЛИ и два инвертора подряд ──
{
  // Исключающее ИЛИ: 1 тогда и только тогда, когда сигналы на входах разные.
  const xor = (a, b) => AND(OR(a, b), NOT(AND(a, b)));
  const rows = truthRows(2, (a, b) => xor(a, b));
  eq(rows.map((r) => r.v).join(''), '0110', 'таблица исключающего ИЛИ');
  eq(rows.filter((r) => r.v === 1).map((r) => r.vars.join('')).join(','), '01,10', 'строки с единицей у исключающего ИЛИ');
  const out11 = xor(1, 1);
  eq(out11, 0, 'исключающее ИЛИ на сигналах 1 и 1');
  nb('logic', {
    lesson: 'logic-04-elements', topic: T_L, sub: 'Элемент исключающее ИЛИ',
    diff: 'basic', cog: 'remember', f: F.elements,
    calc: () => out11,
    prompt: 'На входы логического элемента исключающее ИЛИ (его называют также «неравнозначность») поданы сигналы 1 и 1. Что будет на выходе? Запишите только число.',
    why: 'Исключающее ИЛИ даёт единицу тогда и только тогда, когда сигналы на входах РАЗНЫЕ: по таблице это строки 01 и 10, а в строках 00 и 11 на выходе ноль. Поэтому на сигналах 1 и 1, которые одинаковы, выход равен 0. Обычный ИЛИ на тех же сигналах дал бы 1 — элементы похожи по названию, но работают по-разному.',
  });
}
{
  // Два инвертора подряд: выход схемы равен входу (двойное отрицание).
  const out = NOT(NOT(1));
  eq(out, 1, 'два элемента НЕ подряд на сигнале 1');
  eq(NOT(NOT(0)), 0, 'два элемента НЕ подряд на сигнале 0');
  ok(NOT(NOT(0)) === NOT(0) ? false : true, 'проверка двойного отрицания на обоих сигналах');
  eq([NOT(NOT(0)), NOT(NOT(1))].join(''), '01', 'двойное отрицание сохраняет сигнал');
  nb('logic', {
    lesson: 'logic-04-elements', topic: T_L, sub: 'Два инвертора подряд',
    diff: 'basic', cog: 'remember', f: F.elements,
    calc: () => out,
    prompt: 'Схема: выход элемента НЕ соединён со входом второго элемента НЕ. На вход схемы подали сигнал 1. Что будет на выходе схемы? Запишите только число.',
    why: 'Считаем по порядку, начиная с первого элемента: первый инвертор даёт 1 → 0, второй инвертор меняет этот сигнал на противоположный: 0 → 1. Два отрицания подряд отменяют друг друга, поэтому такая пара работает как провод, и сигнал на выходе совпадает с сигналом на входе. Лишнюю пару инверторов из схемы убирают — она ничего не меняет, но занимает место.',
  });
}

// ── logic-05-expression (2/0/0) · приоритет операций и разбор ──
{
  // A ∨ B ∧ C: И выполняется раньше ИЛИ. Считаем обе расстановки скобок.
  const env = { A: 1, B: 1, C: 0 };
  const right = OR(env.A, AND(env.B, env.C));
  const wrong = AND(OR(env.A, env.B), env.C);
  eq(right, 1, 'A ∨ B ∧ C при A = 1, B = 1, C = 0');
  eq(wrong, 0, 'та же запись, прочитанная как (A ∨ B) ∧ C');
  ok(right !== wrong, 'скобки меняют результат — значит порядок операций важен');
  nb('logic', {
    lesson: 'logic-05-expression', topic: T_L, sub: 'Приоритет операций в записи',
    diff: 'basic', cog: 'remember', f: F.expr,
    calc: () => right,
    prompt: 'Вычислите значение выражения A ∨ B ∧ C при A = 1, B = 1, C = 0. Запишите только число.',
    why: `Сначала выполняется И — оно старше ИЛИ по приоритету: B ∧ C = 1 ∧ 0 = ${AND(env.B, env.C)}. Затем A ∨ 0 = 1 ∨ 0 = ${right}. Если же прочитать запись как (A ∨ B) ∧ C, получится ${OR(env.A, env.B)} ∧ 0 = ${wrong} — другой ответ, поэтому в записи важны скобки.`,
  });
}
{
  // «Ровно одно из двух» = исключающее ИЛИ; каждая альтернатива отличается от него.
  const exactlyOne = (a, b) => XOR(a, b);
  const variants = [
    ['(A ∧ ¬B) ∨ (¬A ∧ B)', (a, b) => OR(AND(a, NOT(b)), AND(NOT(a), b))],
    ['A ∧ B', (a, b) => AND(a, b)],
    ['A ∨ B', (a, b) => OR(a, b)],
    ['(A ∧ ¬B) ∧ (¬A ∧ B)', (a, b) => AND(AND(a, NOT(b)), AND(NOT(a), b))],
  ];
  const want = rowValues(2, exactlyOne).join('');
  eq(want, '0110', 'таблица «ровно одно из двух»');
  variants.forEach(([name, f], i) => {
    const got = rowValues(2, f).join('');
    if (i === 0) eq(got, want, `правильный вариант ${name} должен совпасть с «ровно одно»`);
    else ok(got !== want, `отвлекающий вариант ${name} не должен совпадать с «ровно одно»`);
  });
  const opts = variants.map((v) => v[0]);
  sc('logic', {
    lesson: 'logic-05-expression', topic: T_L, sub: 'Ровно одно из двух',
    diff: 'basic', cog: 'remember', f: F.expr,
    prompt: 'Запишите логическое выражение из двух высказываний A и B, которое истинно тогда и только тогда, когда ровно одно из них истинно.',
    opts, correct: opts[0],
    why: 'Формула «ровно одно» разбирается на два случая: A истинно, B ложно — или наоборот. Это две конъюнкции (A ∧ ¬B) и (¬A ∧ B), соединённые ИЛИ, то есть (A ∧ ¬B) ∨ (¬A ∧ B). Проверка перебором всех четырёх наборов: эта запись истинна в строках 01 и 10. Вариант A ∧ B истинна только при обоих единицах, вариант A ∨ B — ещё и при 11, а двойное И вообще всегда ложно.',
  });
}

// ── logic-06-laws (2/0/0) · ассоциативность и название закона ──
{
  // Все способы расставить скобки в конъюнкции из 4 высказываний дают одно значение.
  const vars = ['A', 'B', 'C', 'D'];
  const trees = bracketTrees(vars);
  eq(trees.length, 5, 'число расстановок скобок в конъюнкции из 4 высказываний');
  const table = trees.map((t) => rowValues(4, (...vals) => evalTree(t, Object.fromEntries(vars.map((v, i) => [v, vals[i]])))).join(''));
  ok(new Set(table).size === 1, 'все расстановки скобок должны давать одинаковую таблицу');
  eq(table.length, 5, 'совпали все 5 расстановок');
  nb('logic', {
    lesson: 'logic-06-laws', topic: T_L, sub: 'Закон ассоциативности',
    diff: 'basic', cog: 'remember', f: F.laws,
    calc: () => trees.length,
    prompt: 'Скобки в конъюнкции из четырёх высказываний A, B, C и D расставляют разными способами. Сколько существует таких расстановок, при которых значение выражения одинаково при любых значениях A, B, C и D? Запишите только число.',
    why: `Расстановок скобок в цепочке из четырёх высказываний пять: ${trees.map(renderTree).join('; ')}. Закон ассоциативности (A ∧ B) ∧ C = A ∧ (B ∧ C) говорит, что переносить скобки можно свободно, поэтому совпадают значения всех пяти записей — это проверяется перебором всех 16 наборов значений. Для дизъюнкции дело обстоит так же, а вот для смеси ∧ и ∨ закон не действует: там скобки обязательны.`,
  });
}
{
  // Название закона: равенство A ∨ B = B ∨ A — это коммутативность.
  const comm = (a, b) => (OR(a, b) === OR(b, a) ? 1 : 0);
  eq(rowValues(2, comm).join(''), '1111', 'перестановка операндов ИЛИ не меняет значения');
  // У каждого названного закона своя запись — путать их нельзя.
  const laws = {
    'закон коммутативности': (a, b) => OR(a, b) === OR(b, a),
    'закон ассоциативности': (a, b, c) => OR(OR(a, b), c) === OR(a, OR(b, c)),
    'закон дистрибутивности': (a, b, c) => AND(a, OR(b, c)) === OR(AND(a, b), AND(a, c)),
    'закон де Моргана': (a, b) => NOT(OR(a, b)) === AND(NOT(a), NOT(b)),
  };
  eq(Object.keys(laws).length, 4, 'число названных законов');
  // Ассоциативность — про три переменные, проверяем на всех 8 наборах.
  eq(rowValues(3, (a, b, c) => (OR(OR(a, b), c) === OR(a, OR(b, c)) ? 1 : 0)).join(''), '11111111', 'ассоциативность ИЛИ');
  eq(rowValues(3, (a, b, c) => (AND(AND(a, b), c) === AND(a, AND(b, c)) ? 1 : 0)).join(''), '11111111', 'ассоциативность И');
  const opts = Object.keys(laws);
  sc('logic', {
    lesson: 'logic-06-laws', topic: T_L, sub: 'Название закона по записи',
    diff: 'basic', cog: 'remember', f: F.laws,
    prompt: 'Какой закон алгебры логики записывается равенством A ∨ B = B ∨ A?',
    opts, correct: 'закон коммутативности',
    why: 'Коммутативность — переставимость операндов: от перестановки A и B ∨ значение не меняется, поэтому в записи оба слагаемых меняются местами. Ассоциативность переставляет не операнды, а скобки: (A ∨ B) ∨ C = A ∨ (B ∨ C). Дистрибутивность разносит множитель в скобки: A ∧ (B ∨ C) = (A ∧ B) ∨ (A ∧ C). Закон де Моргана отрицание переносит внутрь: ¬(A ∨ B) = ¬A ∧ ¬B.',
  });
}

// ═════════════════════ АЛГОРИТМЫ · 4 задания ═════════════════════

// ── algo-01-results (1/0/0) · значения переменной за время работы цикла ──
{
  // n := 1; пока n < 20: n := n · 2. Считаем ВСЕ значения переменной, а не последнее.
  const seen = [];
  let n = 1;
  while (n < 20) { seen.push(n); n = n * 2; }
  seen.push(n);
  eq(seen.join(','), '1,2,4,8,16,32', 'значения n за всё время работы программы');
  eq(seen.length, 6, 'сколько значений принимает n');
  eq(new Set(seen).size, 6, 'все значения n различны');
  nb('algo', {
    lesson: 'algo-01-results', topic: T_ANALYSIS, sub: 'Значения переменной в цикле с условием',
    diff: 'basic', cog: 'remember', f: F.analysis,
    calc: () => seen.length,
    prompt: 'Программа: n := 1; затем, пока n < 20, выполняется команда n := n · 2. Сколько различных значений примет переменная n за всё время работы программы? Запишите только число.',
    why: `Трассируем по шагам: ${seen.join(' → ')}. Условие проверяется в начале, поэтому значение ${seen[seen.length - 1]} уже записано в n, и только потом цикл заканчивается — оно тоже считается. Значений ${seen.length}, и все они различны. Частая ошибка — назвать только последнее значение 32: переменная менялась, а значит, и промежуточные результаты относятся к работе программы.`,
  });
}

// ── algo-02-inputs (1/0/0) · перебор входов, приводящих к результату ──
{
  // y := x · 3; если y делится на 10, то y := y : 10. Ищем все x из 1..40 с y = 6.
  const run = (x) => { let y = x * 3; if (y % 10 === 0) y = Math.trunc(y / 10); return y; };
  const hits = [];
  for (let x = 1; x <= 40; x++) if (run(x) === 6) hits.push(x);
  eq(hits.join(','), '2,20', 'входы, дающие вывод 6');
  eq(hits.length, 2, 'число подходящих входов');
  eq(run(2), 6, 'прямой прогон для x = 2');
  eq(run(20), 6, 'прямой прогон для x = 20');
  nb('algo', {
    lesson: 'algo-02-inputs', topic: T_ANALYSIS, sub: 'Перебор входов, приводящих к результату',
    diff: 'basic', cog: 'remember', f: F.analysis,
    calc: () => hits.length,
    prompt: 'Программа: y := x · 3; затем, если y делится на 10, выполняется команда y := y : 10. Сколько целых значений x от 1 до 40 дают на выходе y = 6? Запишите только число.',
    why: `Ищем все входы, а не один. Ветка без деления: 3x = 6, откуда x = ${hits[0]}, и 6 на 10 не делится, поэтому y остаётся 6. Ветка с делением: 3x = 60, откуда x = ${hits[1]}, и 60 делится на 10, значит y = 60 : 10 = 6. Проверяем прямым прогоном: ${hits.map((x) => `x = ${x} → y = ${run(x)}`).join('; ')}. Других целых x нет, поэтому подходящих значений ${hits.length}.`,
  });
}

// ── py-05-data (1/0/0) · список, подсчёт и f-строка ──
{
  // Список один и тот же и в задании, и в эталоне: собираем его кодом.
  const marks = [4, 5, 5, 3, 5, 4, 5];
  const fives = marks.filter((m) => m === 5).length;
  eq(fives, 4, 'пятёрок в списке');
  eq(marks.length, 7, 'оценок в списке');
  const lst = marks.join(', ');
  const solution = `marks = [${lst}]
n = marks.count(5)
print(f"Пятёрок: {n} из {len(marks)}")`;
  const template = `marks = [${lst}]
# найди количество пятёрок в списке
n = ...
print(f"Пятёрок: {n} из {len(marks)}")`;
  const expected = `Пятёрок: ${fives} из ${marks.length}`;
  eq(pyRun(solution), expected, 'эталон py-05-data печатает оговоренную строку');
  cr('algo', {
    lesson: 'py-05-data', topic: T_PY_TYPES, sub: 'Список, подсчёт и f-строка',
    diff: 'basic', cog: 'remember', f: F.pyTypes,
    prompt: `Дан список оценок marks = [${lst}]. Посчитайте количество пятёрок и выведите f-строкой строку вида «Пятёрок: N из M», где N — количество пятёрок, а M — длина списка.`,
    template, solution, expected,
    why: `Метод count(5) считает, сколько элементов списка равны 5, а len(marks) даёт длину списка — всего оценок ${marks.length}, из них пятёрок ${fives}. f-строка подставляет оба значения прямо в текст между двоеточием и «из», поэтому готовый вывод читается как обычная фраза. Кавычки в списке не нужны: числа хранятся без них, и сравнение с числом 5 работает сразу.`,
  });
}

// ── py-06-linear (1/0/0) · линейный алгоритм, старые значения переменных ──
{
  const solution = `a = 3
b = 7
a = a + b
b = a - b
a = a - b
print(a, b)`;
  const template = `a = 3
b = 7
# поменяй a и b местами, не заводя третью переменную
a = ...
b = ...
a = ...
print(a, b)`;
  const expected = '7 3';
  // Прогон шагов в JS — такой же, как у эталона на Python.
  const steps = [];
  let a = 3, b = 7;
  a = a + b; steps.push(`a = ${a}, b = ${b}`);
  b = a - b; steps.push(`a = ${a}, b = ${b}`);
  a = a - b; steps.push(`a = ${a}, b = ${b}`);
  eq(steps.join(' | '), 'a = 10, b = 7 | a = 10, b = 3 | a = 7, b = 3', 'пошаговое выполнение обмена');
  eq(`${a} ${b}`, expected, 'значения после обмена совпадают с эталоном Python');
  cr('algo', {
    lesson: 'py-06-linear', topic: T_PY_EXPR, sub: 'Обмен значений без третьей переменной',
    diff: 'basic', cog: 'remember', f: F.pyExpr,
    prompt: 'В программе a = 3 и b = 7. Требуется поменять их значения местами, не заводя третьей переменной: сначала выполнить a = a + b, затем b = a - b, затем a = a - b. Выполните команды по порядку и выведите a и b через пробел.',
    template, solution, expected,
    why: `Команды выполняются по порядку, а правая часть вычисляется из текущих значений: ${steps.join(', затем ')}. В итоге a = ${a} и b = ${b} — значения действительно поменялись местами, и в схеме обмена не появилось лишней переменной. Работает такой обмен потому, что во второй команде из уже увеличенной a вычитается b, а в третьей — оставшаяся часть суммы.`,
  });
}

// ═════════════════════ СВЕРКА difficulty / points / cognitive_level / lesson ═════════════════════

for (const [bank, items] of Object.entries(out)) {
  for (const t of items) {
    eq(t.points, POINTS[t.diff], `${t.lesson}: баллы не соответствуют сложности`);
    eq(t.cog, COG_FOR[t.diff], `${t.lesson}: cognitive_level не соответствует сложности`);
    ok(typeof t.lesson === 'string' && t.lesson.length > 0, `${bank}: задание без lesson`);
    ok(t.req === 1.3 || t.req === 1.4, `${t.lesson}: недопустимый fgos_requirement ${t.req}`);
    ok([1.5, 1.6, 1.7].includes(t.el), `${t.lesson}: недопустимый fgos_element ${t.el}`);
  }
}

// ═════════════════════ КВОТЫ ═════════════════════

const QUOTA = {
  'logic-01-utterances': { basic: 1, intermediate: 0, advanced: 0 },
  'logic-03-truth-tables': { basic: 1, intermediate: 0, advanced: 0 },
  'logic-04-elements': { basic: 2, intermediate: 0, advanced: 0 },
  'logic-05-expression': { basic: 2, intermediate: 0, advanced: 0 },
  'logic-06-laws': { basic: 2, intermediate: 0, advanced: 0 },
  'algo-01-results': { basic: 1, intermediate: 0, advanced: 0 },
  'algo-02-inputs': { basic: 1, intermediate: 0, advanced: 0 },
  'py-05-data': { basic: 1, intermediate: 0, advanced: 0 },
  'py-06-linear': { basic: 1, intermediate: 0, advanced: 0 },
};
const QUOTA_TOTAL = Object.values(QUOTA).reduce((s, v) => s + v.basic + v.intermediate + v.advanced, 0);
eq(QUOTA_TOTAL, 12, 'сумма квот');

const got = {};
for (const items of Object.values(out)) {
  for (const t of items) {
    const row = got[t.lesson] ?? { basic: 0, intermediate: 0, advanced: 0 };
    row[t.diff] += 1;
    got[t.lesson] = row;
  }
}
for (const [lesson, want] of Object.entries(QUOTA)) {
  const have = got[lesson] ?? { basic: 0, intermediate: 0, advanced: 0 };
  for (const d of ['basic', 'intermediate', 'advanced']) {
    eq(have[d], want[d], `${lesson}/${d}: нужно ${want[d]}, сделано ${have[d]}`);
  }
}
for (const lesson of Object.keys(got)) {
  ok(lesson in QUOTA, `лишний урок вне квоты: ${lesson}`);
}
const TOTAL = Object.values(out).reduce((s, items) => s + items.length, 0);
eq(TOTAL, QUOTA_TOTAL, `всего заданий ${TOTAL}, а по квотам ${QUOTA_TOTAL}`);

// Урок обязан попасть в свой банк: логика — в bank-logic, остальное — в bank-algo.
const LESSON_BANK = (lesson) => (lesson.startsWith('logic-') ? 'logic' : 'algo');
for (const [bank, items] of Object.entries(out)) {
  for (const t of items) eq(LESSON_BANK(t.lesson), bank, `${t.lesson} попал в банк ${bank}`);
}

// ═════════════════════ СБОРКА ФАЙЛОВ ═════════════════════

const ORDER = ['class', 'topic', 'subtopic', 'type', 'difficulty', 'cognitive_level', 'points',
  'lesson', 'fgos_requirement', 'fgos_element', 'fgos', 'prompt', 'student_view', 'auto_check', 'teacher_only'];
eq(ORDER.length, 15, 'ORDER разъехался');

function yamlBlock(t, id) {
  const fields = {
    class: '8',
    topic: q(t.topic),
    subtopic: q(t.sub),
    type: t.type,
    difficulty: t.diff,
    cognitive_level: t.cog,
    points: String(t.points),
    lesson: t.lesson,
    fgos_requirement: String(t.req),
    fgos_element: String(t.el),
    fgos: `{ subject: [${t.subj}], meta: [${t.diff === 'advanced' ? 'self-control' : 'plan-actions'}] }`,
    prompt: q(t.prompt),
    student_view: t.sv,
    auto_check: t.ac,
    teacher_only: t.to,
  };
  for (const k of ORDER) if (fields[k] === undefined) throw new Error(`нет поля ${k} у ${t.lesson}`);
  return [`- id: ${id}`, ...ORDER.map((k) => `  ${k}: ${fields[k]}`)].join('\n');
}

function maxId(head, pfx) {
  let max = 0;
  for (const m of head.matchAll(new RegExp(`- id: ${pfx}(\\d+)`, 'g'))) max = Math.max(max, Number(m[1]));
  return max;
}

const usedIds = new Set();
const report = [];

for (const [bank, cfg] of Object.entries(BANK)) {
  const raw = readFileSync(cfg.file, 'utf-8');
  const cut = raw.indexOf(MARK);
  // Всё до нашего маркера сохраняем: чужие сгенерированные блоки остаются на месте.
  const head = (cut >= 0 ? raw.slice(0, cut) : raw).replace(/\s+$/, '');
  const before = maxId(head, cfg.pfx);
  if (before === 0) throw new Error(`${cfg.file}: не найдено ни одного id ${cfg.pfx}NNN`);
  let next = before + 1;

  const blocks = out[bank].map((t) => {
    const id = cfg.pfx + String(next).padStart(3, '0');
    if (usedIds.has(id)) throw new Error(`id ${id} уже занят`);
    usedIds.add(id);
    next += 1;
    return yamlBlock(t, id);
  });

  const text = `${head}\n\n${MARK}\n`
    + '# Ответы вычислены кодом: логические формулы — перебором всех наборов 0/1,\n'
    + '# эталоны code_run — реальным запуском локального Python.\n\n'
    + `${blocks.join('\n\n')}\n`;
  writeFileSync(cfg.file, text, 'utf-8');
  report.push(`BANK OK: ${cfg.file} — ${blocks.length} заданий `
    + `(${cfg.pfx}${String(before + 1).padStart(3, '0')}–${cfg.pfx}${String(next - 1).padStart(3, '0')})`);
}

console.log(report.join('\n'));
console.log(`ПРОВЕРОК: ${checks} (assert + перебор всех наборов 0/1 + локальный Python)`);
console.log(`КВОТЫ OK: всего ${TOTAL}`);
for (const [lesson, want] of Object.entries(QUOTA)) {
  console.log(`  ${lesson}: ${want.basic}/${want.intermediate}/${want.advanced} (b/i/a)`);
}
