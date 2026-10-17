// Дописывает банки заданий 8 класса по tmp/need-8.txt: 41 задание.
//
// Устройство как в scripts/make-7-bank2.mjs:
//   * ответы НЕ пишутся руками — считаются кодом и сверяются тут же;
//   * истинность логических выражений считается перебором всех наборов 0/1;
//   * переводы систем счисления считаются через toString/parseInt;
//   * эталонные значения Python проверяются реальным запуском локального python;
//   * в single_choice правильный вариант задаётся ТЕКСТО, буква находится кодом;
//   * topic и subtopic всегда цитируются (значение с двоеточием ломает YAML);
//   * запись идемпотентна: блок режется по маркеру MARK и пишется заново.
//
// Запуск: node scripts/make-8-bank2.mjs
// Проверка: npm run validate-bank && npm run trainer:json
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { checkNumericBase, checkMatching } from '../src/lib/scoring/check.mjs';

const MARK = '# ==== СГЕНЕРИРОВАНО scripts/make-8-bank2.mjs ====';

const BANKS = {
  gen: { file: 'data/tasks/8/number-systems/bank-gen.yaml', prefix: 'inf-8-numsys-' },
  logic: { file: 'data/tasks/8/logic/bank-logic.yaml', prefix: 'inf-8-logic-' },
  algo: { file: 'data/tasks/8/algorithms/bank-algo.yaml', prefix: 'inf-8-algo-' },
};

// Все банки 8 класса — чтобы новый id не совпал с уже занятым в соседнем файле.
const ALL_8_BANKS = [
  'data/tasks/8/number-systems/bank.yaml',
  'data/tasks/8/number-systems/bank-gen.yaml',
  'data/tasks/8/logic/bank-logic.yaml',
  'data/tasks/8/algorithms/bank-algo.yaml',
  'data/tasks/8/code-run/bank-code.yaml',
];

// Квота из tmp/need-8.txt: урок -> [basic, intermediate, advanced].
const NEED = {
  'numsys-05-arith': [1, 1, 1],
  'logic-01-utterances': [1, 2, 1],
  'logic-05-expression': [2, 2, 2],
  'logic-06-laws': [2, 2, 2],
  'logic-03-truth-tables': [2, 3, 2],
  'logic-04-elements': [3, 3, 3],
  'py-05-data': [0, 1, 0],
  'py-06-linear': [0, 1, 0],
  'algo-01-results': [0, 1, 1],
  'algo-02-inputs': [0, 1, 1],
};
const NEED_TOTAL = Object.values(NEED).reduce((s, v) => s + v[0] + v[1] + v[2], 0);
if (NEED_TOTAL !== 41) throw new Error(`квота в NEED даёт ${NEED_TOTAL}, а в tmp/need-8.txt указано 41`);

// Темы — как в уже дописанных банках 8 класса.
const T_SS = 'Системы счисления';
const T_L = 'Элементы математической логики';
const T_PY_TYPES = 'Типы данных и ввод';
const T_PY_EXPR = 'Выражения и линейные алгоритмы';
const T_ALGO = 'Анализ алгоритмов';

// Требования и элементы ФРП — как у соседних заданий этих уроков.
const F = {
  ssArith: { req: 1.2, el: 1.4, subj: 'inf-8-numsys-arith' },
  utter: { req: 1.3, el: 1.5, subj: 'inf-8-logic-utter' },
  expr: { req: 1.4, el: 1.5, subj: 'inf-8-logic-ops' },
  laws: { req: 1.4, el: 1.5, subj: 'inf-8-logic-laws' },
  tables: { req: 1.4, el: 1.6, subj: 'inf-8-logic-tables' },
  elements: { req: 1.4, el: 1.7, subj: 'inf-8-logic-elements' },
  pyTypes: { req: 1.4, el: 1.5, subj: 'inf-8-py-types' },
  pyExpr: { req: 1.4, el: 1.5, subj: 'inf-8-py-expr' },
  analysis: { req: 1.4, el: 1.5, subj: 'inf-8-algo-analysis' },
};

// ─────────────────────────── проверки ───────────────────────────
let checks = 0;
function eq(got, want, msg) {
  checks += 1;
  if (got !== want) throw new Error(`ASSERT FAIL: ${msg}: получено ${JSON.stringify(got)}, ожидалось ${JSON.stringify(want)}`);
}
function ok(cond, msg) {
  checks += 1;
  if (!cond) throw new Error(`ASSERT FAIL: ${msg}`);
}

// ───────────────────────── вычисления ─────────────────────────
/** Строка в двойных кавычках для YAML (экранируем только \\ и "). */
const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const LETTERS = 'ABCD';
const sum = (a) => a.reduce((s, v) => s + v, 0);
const range = (a, b) => { const out = []; for (let i = a; i <= b; i++) out.push(i); return out; };

// Логика 8 класса. Значения выражений считаются перебором наборов 0/1.
const NOT = (a) => (a ? 0 : 1);
const AND = (...xs) => (xs.every(Boolean) ? 1 : 0);
const OR = (...xs) => (xs.some(Boolean) ? 1 : 0);
const IMPL = (a, b) => (a && !b ? 0 : 1);

/**
 * Все наборы значений n переменных в порядке учебника:
 * 00, 01, 10, 11 (старший разряд слева). Возвращает [{ vars: [0,1], v: 0|1 }].
 */
function truthRows(n, f) {
  const out = [];
  for (let mask = 0; mask < 2 ** n; mask++) {
    const vars = Array.from({ length: n }, (_, i) => (mask >> (n - 1 - i)) & 1);
    out.push({ vars, v: f(...vars) });
  }
  return out;
}
/** Сколько строк таблицы дают 1. */
const countTrue = (n, f) => truthRows(n, f).filter((r) => r.v === 1).length;
/** Сколько различных значений принимает выражение. */
const distinctCount = (n, f) => new Set(truthRows(n, f).map((r) => r.v)).size;
/** Сколько строк таблицы совпадают с заданным набором переменных. */
const rowsWith = (n, f, vars) => truthRows(n, f).filter((r) => r.vars.join('') === vars.join('')).length;

// Системы счисления: переводы считаем кодом.
const b2 = (n) => n.toString(2);
const o8 = (n) => n.toString(8);
const h16 = (n) => n.toString(16).toUpperCase();
const d = (s, base) => parseInt(s, base);

// Сумма цифр десятичного числа — как в заданиях про обратную задачу.
const digitSum = (n) => String(Math.abs(n)).split('').reduce((s, c) => s + Number(c), 0);

// ───────────────────── локальный Python (эталон) ─────────────────────
const PY = ['python', 'python3'].find((cmd) => {
  try { execFileSync(cmd, ['-c', 'pass']); return true; } catch { return false; }
});
function pyRun(code) {
  if (!PY) throw new Error('локальный Python не найден (нужен python или python3 в PATH)');
  try {
    return execFileSync(PY, ['-c', code], {
      encoding: 'utf-8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      timeout: 20000,
    }).trim();
  } catch (e) {
    throw new Error(`эталон Python не выполнился: ${String(e.stderr ?? e.message).trim()}`);
  }
}
/** Значение выражения Python (эталон) + проверка, что оно целое. */
function pyInt(code) {
  const raw = pyRun(`print(${code})`);
  const v = Number(raw);
  ok(Number.isInteger(v), `Python вернул не целое «${raw}» для ${code}`);
  return v;
}
/**
 * Запускает код, который обязан упасть, и возвращает текст ошибки.
 * stderr гасим: traceback ожидаемый, выводить его в консоль незачем.
 */
function pyFails(code) {
  if (!PY) throw new Error('локальный Python не найден (нужен python или python3 в PATH)');
  try {
    execFileSync(PY, ['-c', code], {
      encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000,
    });
  } catch {
    return true;
  }
  return false;
}
/** Выполняет код и берёт последнюю строку вывода как целое число. */
function pyLastInt(code) {
  const raw = pyRun(code);
  const lines = raw.split('\n');
  const v = Number(lines[lines.length - 1]);
  ok(Number.isInteger(v), `Python вернул не целое «${raw}»`);
  return v;
}

/** Человекочитаемый список: 0, 1, 4, 9, 16 */
const list = (a) => a.join(', ');

// ───────────────────── конструкторы заданий ─────────────────────
const POINTS = { basic: 1, intermediate: 2, advanced: 3 };
const COG_OK = { basic: ['remember', 'apply'], intermediate: ['remember', 'apply'], advanced: ['analyze'] };
const state = { gen: [], logic: [], algo: [] };

function push(bank, o) {
  const points = POINTS[o.diff];
  if (!points) throw new Error(`неизвестная сложность: ${o.diff}`);
  if (!COG_OK[o.diff].includes(o.cog)) throw new Error(`${o.lesson}: cognitive_level ${o.cog} не подходит ${o.diff}`);
  if (!NEED[o.lesson]) throw new Error(`урока нет в tmp/need-8.txt: ${o.lesson}`);
  if (String(o.topic).includes(':')) throw new Error(`двоеточие в topic: ${o.topic}`);
  if (String(o.sub).includes(':')) throw new Error(`двоеточие в subtopic: ${o.sub}`);
  if (!String(o.prompt).trim()) throw new Error(`${o.lesson}: пустой вопрос`);
  if (!o.f || !o.f.subj) throw new Error(`${o.lesson}: не передан fgos-профиль (f)`);
  state[bank].push({
    lesson: o.lesson, topic: o.topic, sub: o.sub, type: o.type,
    diff: o.diff, cog: o.cog, points, subj: o.f.subj,
    req: o.f.req, el: o.f.el,
    prompt: o.prompt, sv: o.sv, ac: o.ac, to: o.to,
  });
}

/**
 * numeric_base: значение считает calc(), ключ — по нему же (или авторский),
 * если ключ задан — он обязан совпасть. Проверка идёт через check.mjs —
 * тем же кодом, что и scripts/build-trainer-json.ts.
 */
function nb(bank, o) {
  const value = o.calc();
  if (!Number.isInteger(value)) throw new Error(`${o.lesson}: ответ не целый — ${value}`);
  const base = o.base ?? 10;
  const key = o.key ?? (base === 10 ? String(value) : value.toString(base));
  if (o.key !== undefined) eq(d(String(o.key).toUpperCase(), base), value, `${o.lesson}: ключ «${o.key}» не даёт ${value} в основании ${base}`);
  const r = checkNumericBase(value, key, base);
  if (!r.isCorrect) throw new Error(`${o.lesson}: check.mjs не принял ключ «${key}» для ${value} в основании ${base}`);
  push(bank, {
    ...o, type: 'numeric_base',
    sv: `{ base: ${base}, placeholder: "только число" }`,
    ac: `{ method: numeric_base, base: ${base}, strip_affixes: true }`,
    to: `{ accepted_values_decimal: [${value}], answer_text: ${q(key)}, explanation: ${q(o.why)} }`,
  });
}

/** single_choice: правильный вариант задаётся ТЕКСТО, буква находится кодом. */
function sc(bank, o) {
  const texts = o.opts.map(String);
  if (texts.length < 2 || texts.length > 4) throw new Error(`${o.lesson}: вариантов ${texts.length} (нужно 2–4)`);
  if (new Set(texts).size !== texts.length) throw new Error(`${o.lesson}: варианты повторяются`);
  const i = texts.indexOf(String(o.correct));
  if (i < 0) throw new Error(`${o.lesson}: правильного варианта «${o.correct}» нет среди ${JSON.stringify(texts)}`);
  push(bank, {
    ...o, type: 'single_choice',
    sv: `{ options: [${texts.map((t, k) => `{ id: ${LETTERS[k]}, text: ${q(t)} }`).join(', ')}] }`,
    ac: '{ method: exact_option }',
    to: `{ answer: ${LETTERS[i]}, explanation: ${q(o.why)} }`,
  });
}

/** matching: карта собирается из левого столбца, полный балл проверяется check.mjs. */
function mat(bank, o) {
  const left = o.left.map(String);
  if (left.length < 1) throw new Error(`${o.lesson}: пустой столбец слева`);
  if (new Set(left).size !== left.length) throw new Error(`${o.lesson}: левый столбец с повторами`);
  const vals = left.map((k) => {
    if (!(k in o.map)) throw new Error(`${o.lesson}: нет ответа для «${k}»`);
    return String(o.map[k]);
  });
  if (new Set(vals).size !== vals.length) throw new Error(`${o.lesson}: правый столбец с повторами — соответствие неоднозначно`);
  for (const v of vals) if (!o.right.includes(v)) throw new Error(`${o.lesson}: ответ «${v}» нет среди правых вариантов`);
  const points = POINTS[o.diff];
  const r = checkMatching(o.map, Object.fromEntries(left.map((k, i) => [k, vals[i]])), points);
  if (!r.isCorrect || r.score !== points) throw new Error(`${o.lesson}: соответствие не сходится (${r.score} из ${points})`);
  push(bank, {
    ...o, type: 'matching',
    sv: `{ left: [${left.map(q).join(', ')}], right: [${o.right.map(q).join(', ')}] }`,
    ac: '{ method: matching, partial: proportional }',
    to: `{ answer_map: { ${left.map((k, i) => `${q(k)}: ${q(vals[i])}`).join(', ')} }, explanation: ${q(o.why)} }`,
  });
}

// ═══════════════════ КТП 5 · numsys-05-arith (1/1/1) ═══════════════════
{
  // Вычитание с заёмом: 24 − 10 = 14. Заём — единица старшего разряда это две младших.
  const a = '11000';
  const b = '1010';
  const v = d(a, 2) - d(b, 2);
  eq(v, 14, '11000₂ − 1010₂');
  eq(d(b2(v), 2), v, 'контрольный перевод результата');
  nb('gen', {
    lesson: 'numsys-05-arith', topic: T_SS, sub: 'Вычитание в двоичной, ответ в десятичной',
    diff: 'basic', cog: 'apply', f: F.ssArith,
    calc: () => v,
    prompt: 'Вычислите: 11000₂ − 1010₂. Ответ дайте в десятичной системе.',
    why: `${d(a, 2)} − ${d(b, 2)} = ${v}. В двоичной это ${b2(v)}₂. Заём единицы из старшего разряда означает две единицы младшего, поэтому единицы не «исчезают».`,
  });
}
{
  // Деление уголком сводится к сравнению и вычитанию: 54 : 6 = 9, ответ в двоичной.
  const a = '110110';
  const b = '110';
  const q1 = Math.floor(d(a, 2) / d(b, 2));
  const r = d(a, 2) % d(b, 2);
  eq(r, 0, 'остаток при делении 110110₂ на 110₂');
  eq(d(b2(q1), 2) * d(b, 2), d(a, 2), 'проверка умножением');
  nb('gen', {
    lesson: 'numsys-05-arith', topic: T_SS, sub: 'Деление в двоичной системе',
    diff: 'intermediate', cog: 'apply', f: F.ssArith, base: 2,
    calc: () => q1,
    prompt: 'Вычислите: 110110₂ : 110₂. Ответ дайте в двоичной системе.',
    why: `${d(a, 2)} : ${d(b, 2)} = ${q1} — в двоичной это ${b2(q1)}₂, остаток ${r}. Деление уголком сводится к вычитанию: 54 = 6 · ${q1} + ${r}.`,
  });
}
{
  // Смешанное выражение: 64 − 27 + 5 = 42, ответ в двоичной — 101010₂.
  const x = d('1000000', 2);
  const y = d('11011', 2);
  const z = d('101', 2);
  const v = x - y + z;
  eq(v, 42, '1000000₂ − 11011₂ + 101₂');
  eq(d(b2(v), 2), v, '101010₂ = 42');
  nb('gen', {
    lesson: 'numsys-05-arith', topic: T_SS, sub: 'Смешанное выражение в 2СС',
    diff: 'advanced', cog: 'analyze', f: F.ssArith, base: 2,
    calc: () => v,
    prompt: 'Вычислите: 1000000₂ − 11011₂ + 101₂. Ответ дайте в двоичной системе.',
    why: `По порядку действий: ${x} − ${y} = ${x - y}, затем ${x - y} + ${z} = ${v}, а ${v} в двоичной системе — ${b2(v)}₂. Самопроверка: переведите результат в десятичную и повторите вычисление десятичными.`,
  });
}

// ═══════════════════ КТП 7 · logic-01-utterances (1/2/1) ═══════════════════
{
  // Место НЕ в середине фразы меняет смысл: из урока — три разных высказывания.
  const variants = [
    'Петя НЕ решил правильно все задания',
    'Петя решил НЕправильно все задания',
    'Петя решил правильно НЕ все задания',
  ];
  eq(variants.length, 3, 'вариантов с НЕ в разных местах');
  nb('logic', {
    lesson: 'logic-01-utterances', topic: T_L, sub: 'Место связки НЕ',
    diff: 'basic', cog: 'remember', f: F.utter,
    calc: () => variants.length,
    prompt: 'Связка НЕ стоит в середине фразы «Петя решил правильно НЕ все задания» и меняет смысл. Сколько разных высказываний можно получить из этой фразы, поставив НЕ в разные места? Запишите только число.',
    why: 'Место НЕ меняет высказывание: «Петя НЕ решил все задания», «Петя решил НЕправильно все» и «Петя решил правильно НЕ все» — это три разных высказывания, и у каждого своя истинность.',
  });
}
{
  // Область истинности формы «x делится на 5» на отрезке 1..20.
  const hits = range(1, 20).filter((x) => x % 5 === 0);
  eq(hits.join(','), '5,10,15,20', 'кратные 5 от 1 до 20');
  nb('logic', {
    lesson: 'logic-01-utterances', topic: T_L, sub: 'Область истинности, подсчёт значений',
    diff: 'intermediate', cog: 'apply', f: F.utter,
    calc: () => hits.length,
    prompt: 'В высказывание «x делится на 5» вместо x подставляют целые числа от 1 до 20. Сколько подстановок делают высказывание истинным? Запишите только число.',
    why: `x делится на 5, когда оканчивается на 0 или на 5: из 1..20 это ${list(hits)} — всего ${hits.length} значения. Остальные значения дают ложь: область истинности формы — только эти числа.`,
  });
}
{
  sc('logic', {
    lesson: 'logic-01-utterances', topic: T_L, sub: 'Ложь — это значение',
    diff: 'intermediate', cog: 'apply', f: F.utter,
    prompt: 'Чем ложное высказывание отличается от предложения, которое высказыванием не является?',
    opts: [
      'Ложное высказывание всё равно высказывание: у него есть значение 0',
      'Ничем: это одно и то же',
      'Ложное высказывание нельзя проверить, а проверить можно только истинные',
      'Ложное высказывание не содержит чисел и названий',
    ],
    correct: 'Ложное высказывание всё равно высказывание: у него есть значение 0',
    why: '«2 + 2 = 5» — высказывание, и оно ложно: значение 0 у него есть. А вот «Какой будет результат?» — вопрос, истинности у него нет вовсе, поэтому это не высказывание.',
  });
}
{
  const left = [
    '«7 — простое число»',
    '«На улице идёт дождь и дует ветер»',
    '«Поезд придёт вовремя или придёт с опозданием»',
    '«Ни один ученик не опоздал на урок»',
  ];
  const right = [
    'простое высказывание',
    'составное высказывание со связкой И',
    'составное высказывание со связкой ИЛИ',
    'составное высказывание со связкой НЕ',
  ];
  mat('logic', {
    lesson: 'logic-01-utterances', topic: T_L, sub: 'Простое и составное',
    diff: 'advanced', cog: 'analyze', f: F.utter,
    prompt: 'Установите соответствие: высказывание — его вид.',
    left, right,
    map: {
      [left[0]]: right[0],
      [left[1]]: right[1],
      [left[2]]: right[2],
      [left[3]]: right[3],
    },
    why: 'Простое высказывание описывает одно свойство или отношение, составное собрано из простых связками: «и», «или», «не». В составном высказывании связка всегда видна прямо в тексте.',
  });
}

// ═══════════════════ КТП 9 · logic-05-expression (2/2/2) ═══════════════════
{
  sc('logic', {
    lesson: 'logic-05-expression', topic: T_L, sub: 'Тождество A ∧ 1 = A',
    diff: 'basic', cog: 'remember', f: F.expr,
    prompt: 'Чему равно выражение A ∧ 1 при любом значении A?',
    opts: ['A', '1', '0', 'Значение зависит от A и его нельзя назвать заранее'],
    correct: 'A',
    why: 'Единичный операнд ничего не меняет: при A = 1 получаем 1 ∧ 1 = 1, при A = 0 — 0 ∧ 1 = 0. Единица сохраняет значение другого операнда, поэтому выражение равно A.',
  });
}
{
  const n = distinctCount(1, (a) => OR(a, 0));
  eq(n, 2, 'различных значений A ∨ 0');
  nb('logic', {
    lesson: 'logic-05-expression', topic: T_L, sub: 'Тождество A ∨ 0 = A',
    diff: 'basic', cog: 'remember', f: F.expr,
    calc: () => n,
    prompt: 'Сколько различных значений принимает выражение A ∨ 0 при всех возможных значениях A? Запишите только число.',
    why: 'Нулевой операнд не меняет другой операнд: A ∨ 0 = A. Перебор даёт при A = 0 значение 0, при A = 1 значение 1 — различных значений два.',
  });
}
{
  sc('logic', {
    lesson: 'logic-05-expression', topic: T_L, sub: 'Область действия НЕ',
    diff: 'intermediate', cog: 'apply', f: F.expr,
    prompt: 'Как правильно читается выражение ¬A ∧ B?',
    opts: [
      'как (¬A) ∧ B — отрицается только A',
      'как ¬(A ∧ B) — отрицается всё выражение',
      'как (¬A) ∧ (¬B) — отрицаются обе переменные',
      'как ¬A, а B к нему отношения не имеет',
    ],
    correct: 'как (¬A) ∧ B — отрицается только A',
    why: 'Операция НЕ меняет только следующую за ней конструкцию, поэтому ¬A ∧ B = (¬A) ∧ B. Чтобы отрицать всё выражение, нужны скобки: ¬(A ∧ B) — это уже другое выражение.',
  });
}
{
  const a = 0;
  const b = 1;
  const v = AND(NOT(a), b);
  eq(v, 1, '(¬A) ∧ B при A = 0, B = 1');
  nb('logic', {
    lesson: 'logic-05-expression', topic: T_L, sub: 'Подстановка значений',
    diff: 'intermediate', cog: 'apply', f: F.expr,
    calc: () => v,
    prompt: 'Вычислите значение выражения (¬A) ∧ B при A = 0 и B = 1. Запишите только число.',
    why: `A = 0, значит ¬A = 1. Затем 1 ∧ 1 = ${v}. Если считать ¬(A ∧ B), результат получился бы другим, поэтому скобки в записи обязательны.`,
  });
}
{
  const n = countTrue(2, (a, b) => OR(a, AND(a, b)));
  eq(n, 2, 'строк с A ∨ (A ∧ B) = 1');
  nb('logic', {
    lesson: 'logic-05-expression', topic: T_L, sub: 'Упрощение по законам',
    diff: 'advanced', cog: 'analyze', f: F.expr,
    calc: () => n,
    prompt: 'По закону поглощения A ∨ (A ∧ B) = A. В скольких строках таблицы истинности для двух переменных это выражение равно 1? Запишите только число.',
    why: 'После упрощения остаётся A, а A = 1 ровно в двух строках из четырёх: 10 и 11. Это и есть смысл законов: вместо громоздкой таблицы получаем одно значение.',
  });
}
{
  const left = [
    '«Число x положительное и делится на 5»',
    '«Число x равно 1 или равно 5»',
    '«Число x не больше 10»',
    '«Число x больше 3 и меньше 7»',
  ];
  const right = ['x > 0 ∧ (x mod 5 = 0)', 'x = 1 ∨ x = 5', 'x ≤ 10', 'x > 3 ∧ x < 7'];
  mat('logic', {
    lesson: 'logic-05-expression', topic: T_L, sub: 'От условия к формуле',
    diff: 'advanced', cog: 'analyze', f: F.expr,
    prompt: 'Установите соответствие: условие задачи — его запись логическим выражением.',
    left, right,
    map: {
      [left[0]]: right[0],
      [left[1]]: right[1],
      [left[2]]: right[2],
      [left[3]]: right[3],
    },
    why: 'Порядок такой: выписать условия отдельными строками, найти связку между ними, заменить слова операциями и расставить скобки. «Не больше» — это ≤, а «и» всегда даёт конъюнкцию ∧.',
  });
}

// ═══════════════════ КТП 10 · logic-06-laws (2/2/2) ═══════════════════
{
  sc('logic', {
    lesson: 'logic-06-laws', topic: T_L, sub: 'Закон двойного отрицания',
    diff: 'basic', cog: 'remember', f: F.laws,
    prompt: 'Чему равно выражение ¬¬A?',
    opts: ['A', '¬A', '1', '0'],
    correct: 'A',
    why: 'Два отрицания подряд отменяют друг друга: при A = 1 получаем ¬1 = 0, потом ¬0 = 1; при A = 0 наоборот, результат 0. Значит ¬¬A = A при любом значении.',
  });
}
{
  const n = distinctCount(2, (a, b) => AND(a, OR(a, b)));
  eq(n, 2, 'различных значений A ∧ (A ∨ B)');
  nb('logic', {
    lesson: 'logic-06-laws', topic: T_L, sub: 'Проверка поглощения перебором',
    diff: 'basic', cog: 'apply', f: F.laws,
    calc: () => n,
    prompt: 'Проверьте закон поглощения A ∧ (A ∨ B) = A перебором: сколько различных значений принимает левая часть? Запишите только число.',
    why: 'Перебор всех четырёх наборов даёт при A = 0 всегда 0, при A = 1 всегда 1 — то есть ровно те же два значения, что и у A. Совпадение значений и есть доказательство закона.',
  });
}
{
  // Де Морган для конъюнкции: проверяем на всех наборах.
  for (const [a, b] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    eq(NOT(AND(a, b)), OR(NOT(a), NOT(b)), `де Морган для ∧ при A = ${a}, B = ${b}`);
  }
  sc('logic', {
    lesson: 'logic-06-laws', topic: T_L, sub: 'Де Морган для конъюнкции',
    diff: 'intermediate', cog: 'apply', f: F.laws,
    prompt: 'Чему равносильно выражение ¬(A ∧ B)?',
    opts: ['¬A ∨ ¬B', '¬A ∧ ¬B', 'A ∨ B', '¬(A ∨ B)'],
    correct: '¬A ∨ ¬B',
    why: 'Закон де Моргана: отрицание конъюнкции — это дизъюнкция отрицаний. Проверка при A = 0, B = 0: слева ¬0 = 1, справа 1 ∨ 1 = 1; при A = 1, B = 1: слева 0, справа 0 ∨ 0 = 0.',
  });
}
{
  // A ∧ (B ∨ C) = (A ∧ B) ∨ (A ∧ C) — дистрибутивность, восемь наборов.
  const same = truthRows(3, (a, b, c) => AND(a, OR(b, c)))
    .every((r) => r.v === OR(AND(r.vars[0], r.vars[1]), AND(r.vars[0], r.vars[2])));
  ok(same, 'дистрибутивность не сошлась');
  sc('logic', {
    lesson: 'logic-06-laws', topic: T_L, sub: 'Закон распределительности',
    diff: 'intermediate', cog: 'apply', f: F.laws,
    prompt: 'Чему равно A ∧ (B ∨ C)?',
    opts: ['(A ∧ B) ∨ (A ∧ C)', '(A ∧ B) ∨ C', '(A ∨ B) ∧ C', 'A ∧ B ∧ C'],
    correct: '(A ∧ B) ∨ (A ∧ C)',
    why: 'Закон распределительности разносит A внутрь скобок с дизъюнкцией. Проверка при A = 0: слева 0, справа 0 ∨ 0 = 0; при A = 1 и B = 1, C = 0: слева 1, справа 1 ∨ 0 = 1. Ошибка — потерять скобку и записать (A ∧ B) ∨ C.',
  });
}
{
  // Совпадают ли ¬¬A и A на всех двух наборах — считаем расхождения.
  const diffs = truthRows(1, (a) => NOT(NOT(a))).filter((r) => r.v !== r.vars[0]).length;
  eq(diffs, 0, 'расхождений у ¬¬A и A');
  nb('logic', {
    lesson: 'logic-06-laws', topic: T_L, sub: 'Проверка закона подстановкой',
    diff: 'advanced', cog: 'analyze', f: F.laws,
    calc: () => diffs,
    prompt: 'Закон проверяется подстановкой всех наборов значений. Сколько наборов из двух (A = 0 и A = 1) дают разные значения у выражений ¬¬A и A? Запишите только число.',
    why: 'Подставляем оба значения: A = 0 даёт 0 и 0, A = 1 даёт 1 и 1. Расхождений нет ни в одном наборе, значит равенство держится всегда и это действительно закон.',
  });
}
{
  const left = [
    'Закон исключённого среднего',
    'Закон противоречия',
    'Закон двойного отрицания',
    'Закон поглощения',
  ];
  const right = ['A ∨ ¬A = 1', 'A ∧ ¬A = 0', '¬¬A = A', 'A ∧ (A ∨ B) = A'];
  mat('logic', {
    lesson: 'logic-06-laws', topic: T_L, sub: 'Соответствие закона и его записи',
    diff: 'advanced', cog: 'analyze', f: F.laws,
    prompt: 'Установите соответствие: название закона алгебры логики — его запись.',
    left, right,
    map: {
      [left[0]]: right[0],
      [left[1]]: right[1],
      [left[2]]: right[2],
      [left[3]]: right[3],
    },
    why: 'Исключённое среднее всегда истинно, противоречие всегда ложно, двойное отрицание снимается, а поглощение убирает лишний кусок схемы. Каждая запись верна при любых значениях букв.',
  });
}

// ═══════════════════ КТП 11 · logic-03-truth-tables (2/3/2) ═══════════════════
{
  const n = 4;
  const rows = 2 ** n;
  eq(rows, 16, 'строк для 4 переменных');
  nb('logic', {
    lesson: 'logic-03-truth-tables', topic: T_L, sub: 'Число строк для 4 переменных',
    diff: 'basic', cog: 'remember', f: F.tables,
    calc: () => rows,
    prompt: 'Сколько строк (без шапки) в таблице истинности для выражения с 4 переменными? Запишите только число.',
    why: `Для n переменных строк всегда 2ⁿ, шапка не считается: 2⁴ = ${rows}. Все наборы нулей и единиц перебираются полностью, ничего не пропускается.`,
  });
}
{
  // Наборы идут как счёт 00, 01, 10, 11 — третья строка это 10.
  const row3 = truthRows(2, (a, b) => AND(a, b))[2];
  eq(row3.vars.join(''), '10', 'третья строка таблицы');
  eq(row3.v, AND(1, 0), 'A ∧ B в третьей строке');
  sc('logic', {
    lesson: 'logic-03-truth-tables', topic: T_L, sub: 'Порядок наборов',
    diff: 'basic', cog: 'remember', f: F.tables,
    prompt: 'В таблице истинности для двух переменных наборы записывают как двоичные числа от 0 до 3. Какая строка (без шапки) соответствует набору A = 1, B = 0?',
    opts: ['Третья', 'Вторая', 'Первая', 'Четвёртая'],
    correct: 'Третья',
    why: 'Порядок наборов: 00, 01, 10, 11. Значит A = 1, B = 0 — это третья строка. Начинать таблицу с 01 нельзя: строка 00 тоже нужна, иначе один набор потеряется.',
  });
}
{
  const n = countTrue(2, (a, b) => OR(a, b));
  eq(n, 3, 'строк с A ∨ B = 1');
  nb('logic', {
    lesson: 'logic-03-truth-tables', topic: T_L, sub: 'Подсчёт строк',
    diff: 'intermediate', cog: 'apply', f: F.tables,
    calc: () => n,
    prompt: 'В скольких строках таблицы истинности для двух переменных выражение A ∨ B равно 1? Запишите только число.',
    why: `Дизъюнкция истинна, если хотя бы одна переменная равна 1: это наборы 01, 10 и 11 — ${n} строки из четырёх. Ложной остаётся только строка 00.`,
  });
}
{
  const v = AND(OR(1, 0), NOT(0));
  eq(v, 1, '(A ∨ B) ∧ ¬C при 1, 0, 0');
  nb('logic', {
    lesson: 'logic-03-truth-tables', topic: T_L, sub: 'Вычисление значения',
    diff: 'intermediate', cog: 'apply', f: F.tables,
    calc: () => v,
    prompt: 'Вычислите значение выражения (A ∨ B) ∧ ¬C при A = 1, B = 0, C = 0. Запишите только число.',
    why: `Сначала промежуточные столбцы: A ∨ B = 1 ∨ 0 = 1, ¬C = ¬0 = 1. Затем результат: 1 ∧ 1 = ${v}. Порядок именно такой: сначала НЕ, потом И, потом ИЛИ.`,
  });
}
{
  // F = (A ∨ B) ∧ ¬C истинно в строках, где C = 0 и хотя бы одна из A, B равна 1.
  const good = truthRows(3, (a, b, c) => AND(OR(a, b), NOT(c)))
    .filter((r) => r.v === 1).map((r) => r.vars.join(''));
  eq(good.join(' '), '010 100 110', 'строки с F = 1');
  eq(good.length, 3, 'строк с F = 1');
  nb('logic', {
    lesson: 'logic-03-truth-tables', topic: T_L, sub: 'Анализ таблицы',
    diff: 'intermediate', cog: 'apply', f: F.tables,
    calc: () => good.length,
    prompt: 'В скольких строках таблицы истинности для трёх переменных выражение F = (A ∨ B) ∧ ¬C равно 1? Запишите только число.',
    why: `Единица получается там, где C = 0 и хотя бы одна из A, B равна 1: это строки ${list(good)} — всего ${good.length} из восьми. Столбцы считаем по приоритету: сначала ¬C, потом A ∨ B, потом результат.`,
  });
}
{
  const n = countTrue(3, (a, b, c) => AND(a, AND(b, c)));
  eq(n, 1, 'строк с A ∧ B ∧ C = 1');
  nb('logic', {
    lesson: 'logic-03-truth-tables', topic: T_L, sub: 'Разбор готовой таблицы',
    diff: 'advanced', cog: 'analyze', f: F.tables,
    calc: () => n,
    prompt: 'В скольких строках таблицы истинности для трёх переменных выражение A ∧ B ∧ C равно 1? Запишите только число.',
    why: `Конъюнкция трёх переменных истинна только там, где все три равны 1, то есть в наборе 111. Такая строка одна из восьми, поэтому ответ ${n}.`,
  });
}
{
  const n = rowsWith(2, (a, b) => OR(NOT(a), b), [0, 1]);
  eq(n, 1, 'строк с ¬A ∨ B = 1 при A = 0, B = 1');
  sc('logic', {
    lesson: 'logic-03-truth-tables', topic: T_L, sub: 'Чтение столбца',
    diff: 'advanced', cog: 'analyze', f: F.tables,
    prompt: 'В готовой таблице истинности для двух переменных в наборе A = 0, B = 1 вычисляется выражение ¬A ∨ B. Какое значение стоит в этом столбце?',
    opts: ['1', '0', 'Значение зависит от того, как расположены столбцы', 'Вычислять нужно только после НЕ, иначе таблица неверна'],
    correct: '1',
    why: 'Считаем по промежуточным столбцам: ¬A = ¬0 = 1, затем 1 ∨ 1 = 1. Порядок столбцов не влияет на результат вычисления — влияет только на то, в какой колонке стоит число.',
  });
}

// ═══════════════════ КТП 12 · logic-04-elements (3/3/3) ═══════════════════
{
  const v = NOT(1);
  eq(v, 0, 'инвертор на входе 1');
  nb('logic', {
    lesson: 'logic-04-elements', topic: T_L, sub: 'Инвертор',
    diff: 'basic', cog: 'apply', f: F.elements,
    calc: () => v,
    prompt: 'На вход инвертора (элемента НЕ) подали сигнал 1. Что будет на выходе? Запишите только число.',
    why: `Инвертор меняет сигнал на противоположный: вход 1 даёт выход ${v}. Кружок инверсии на схеме стоит именно на выходе этого элемента.`,
  });
}
{
  const v = OR(0, 0);
  eq(v, 0, 'дизъюнктор на входах 0, 0');
  nb('logic', {
    lesson: 'logic-04-elements', topic: T_L, sub: 'Дизъюнктор',
    diff: 'basic', cog: 'apply', f: F.elements,
    calc: () => v,
    prompt: 'На входы логического элемента ИЛИ (дизъюнктора) поданы сигналы 0 и 0. Что будет на выходе? Запишите только число.',
    why: `Дизъюнктор даёт 0, только когда на всех входах нули, поэтому 0 ∨ 0 = ${v}. Стоит появиться хотя бы одной единице, и выход станет 1.`,
  });
}
{
  sc('logic', {
    lesson: 'logic-04-elements', topic: T_L, sub: 'Кружок инверсии',
    diff: 'basic', cog: 'remember', f: F.elements,
    prompt: 'Где на схеме рисуют кружок инверсии у логического элемента?',
    opts: [
      'На выходе элемента — он и означает НЕ',
      'На каждом входе элемента',
      'На корпусе элемента, независимо от входов и выхода',
      'Кружка нет ни на одном логическом элементе',
    ],
    correct: 'На выходе элемента — он и означает НЕ',
    why: 'Кружок на выходе превращает обычный элемент в инвертор: сигнал на выходе берётся с противоположным значением. На входах кружков нет — там просто приходят сигналы.',
  });
}
{
  // Схема: A и B на конъюнктор, его выход — на вход инвертора. A = 1, B = 0.
  const a = 1;
  const b = 0;
  const inner = AND(a, b);
  const out = NOT(inner);
  eq(inner, 0, 'конъюнктор на 1 и 0');
  eq(out, 1, 'инвертор после конъюнктора');
  nb('logic', {
    lesson: 'logic-04-elements', topic: T_L, sub: 'Комбинация элементов',
    diff: 'intermediate', cog: 'apply', f: F.elements,
    calc: () => out,
    prompt: 'Схема: на входы элемента И поданы A = 1 и B = 0, а его выход соединён со входом элемента НЕ. Что будет на выходе схемы? Запишите только число.',
    why: `Сначала конъюнктор: 1 ∧ 0 = ${inner}. Потом инвертор меняет этот сигнал на противоположный: ${NOT(inner)}. Схема из двух элементов работает как выражение ¬(A ∧ B).`,
  });
}
{
  // Схема: ИЛИ из двух входов, сигналы 1 и 0.
  const v = OR(1, 0);
  eq(v, 1, 'дизъюнктор на 1 и 0');
  nb('logic', {
    lesson: 'logic-04-elements', topic: T_L, sub: 'Дизъюнктор даёт единицу',
    diff: 'intermediate', cog: 'apply', f: F.elements,
    calc: () => v,
    prompt: 'На входы логического элемента ИЛИ поданы сигналы 1 и 0. Что будет на выходе? Запишите только число.',
    why: `Дизъюнктору достаточно хотя бы одной единицы: 1 ∨ 0 = ${v}. Проверка по правилу: ноль получается только когда на всех входах нули, а здесь не все входы нулевые.`,
  });
}
{
  // Два конъюнктора последовательно: (1 ∧ 1) ∧ (0 ∧ 1).
  const left = AND(1, 1);
  const right = AND(0, 1);
  const out = AND(left, right);
  eq(left, 1, 'первый конъюнктор');
  eq(right, 0, 'второй конъюнктор');
  eq(out, 0, 'два конъюнктора подряд');
  nb('logic', {
    lesson: 'logic-04-elements', topic: T_L, sub: 'Два конъюнктора подряд',
    diff: 'intermediate', cog: 'apply', f: F.elements,
    calc: () => out,
    prompt: 'Схема из двух элементов И, соединённых последовательно: на входы первого поданы 1 и 1, на входы второго — 0 и 1. Что будет на выходе схемы? Запишите только число.',
    why: `Первый конъюнктор даёт 1 ∧ 1 = ${left}, второй — 0 ∧ 1 = ${right}. Выход схемы равен их конъюнкции: ${left} ∧ ${right} = ${out}. Результат нельзя угадать по одному входу — считают по порядку, начиная с первого элемента.`,
  });
}
{
  // Правила элементов проверяем перебором наборов, а не пишем руками.
  const rows2 = truthRows(2, (a, b) => AND(a, b));
  eq(rows2.filter((r) => r.v === 1).length, 1, 'у И единица только наборе 11');
  eq(rows2.filter((r) => r.v === 0).length, 3, 'у И нуль в остальных наборах');
  eq(truthRows(2, (a, b) => OR(a, b)).filter((r) => r.v === 0).length, 1, 'у ИЛИ ноль только наборе 00');
  eq(truthRows(1, (a) => NOT(a)).every((r) => r.v !== r.vars[0]), true, 'у НЕ выход противоположен входу');
  const left = ['Элемент И (конъюнктор)', 'Элемент ИЛИ (дизъюнктор)', 'Элемент НЕ (инвертор)'];
  const right = [
    'на выходе 1 только тогда, когда на всех входах единицы',
    'на выходе 0 только тогда, когда на всех входах нули',
    'на выходе значение, противоположное входному',
  ];
  const map = { [left[0]]: right[0], [left[1]]: right[1], [left[2]]: right[2] };
  const pts = POINTS.advanced;
  const r = checkMatching(map, map, pts);
  ok(r.isCorrect && r.score === pts, 'соответствие правил элементов не сходится');
  push('logic', {
    lesson: 'logic-04-elements', topic: T_L, sub: 'Правила работы элементов', type: 'matching',
    diff: 'advanced', cog: 'analyze', f: F.elements,
    prompt: 'Установите соответствие: логический элемент — правило его работы.',
    sv: `{ left: [${left.map(q).join(', ')}], right: [${right.map(q).join(', ')}] }`,
    ac: '{ method: matching, partial: proportional }',
    to: `{ answer_map: { ${left.map((k) => `${q(k)}: ${q(map[k])}`).join(', ')} }, explanation: ${q('Проверка перебором наборов: конъюнктор даёт единицу только на наборе 11 и ноль в остальных трёх наборах, дизъюнктор даёт ноль только на наборе 00, а инвертор на каждом наборе выдаёт противоположное значение.')} }`,
  });
}
{
  // Упрощение схемы по поглощению: A ∧ (A ∨ B) = A — остаётся один элемент И.
  const scheme = [{ el: 'И', inputs: ['A', 'B'] }, { el: 'ИЛИ', inputs: ['A', 'B'] }];
  const simplified = ['A'];
  eq(scheme.length - simplified.length, 1, 'снято элементов при упрощении');
  eq(simplified.length, 1, 'элементов осталось');
  nb('logic', {
    lesson: 'logic-04-elements', topic: T_L, sub: 'Упрощение схемы по поглощению',
    diff: 'advanced', cog: 'analyze', f: F.elements,
    calc: () => simplified.length,
    prompt: 'Инженер собрал схему по выражению A ∧ (A ∨ B): элемент ИЛИ на входах A и B, его выход — на вход элемента И вместе с A. Он применил закон поглощения и упростил схему. Сколько элементов осталось в схеме? Запишите только число.',
    why: `До упрощения в схеме ${scheme.length} элемента (${scheme.map((e) => e.el).join(' и ')}). По поглощению A ∧ (A ∨ B) = A, поэтому остаётся вычисление самого A — это один элемент И. Лишний кусок схемы убрали: элементов стало ${simplified.length}, схема дешевле и работает быстрее.`,
  });
}
{
  // Инвертор на выходе дизъюнктора из трёх входов — схема «ИЛИ, затем НЕ».
  const left = OR(0, 0, 1);
  const out = NOT(left);
  eq(left, 1, 'дизъюнктор на 0, 0, 1');
  eq(out, 0, 'инвертор после дизъюнктора');
  const ones = truthRows(3, (a, b, c) => NOT(OR(a, b, c))).filter((r) => r.v === 1).length;
  eq(ones, 1, 'строк с ¬(A ∨ B ∨ C) = 1');
  nb('logic', {
    lesson: 'logic-04-elements', topic: T_L, sub: 'Элемент НЕ после ИЛИ',
    diff: 'advanced', cog: 'analyze', f: F.elements,
    calc: () => out,
    prompt: 'Схема: три входа элемента ИЛИ (A, B, C), его выход соединён со входом элемента НЕ. На входы поданы 0, 0 и 1. Что будет на выходе схемы? Запишите только число.',
    why: `Дизъюнктор из трёх входов даёт единицу, если хотя бы на одном входе есть 1: 0 ∨ 0 ∨ 1 = ${left}. Инвертор меняет этот сигнал на противоположный, поэтому выход схемы ${out}. По таблице истинности выражение ¬(A ∨ B ∨ C) истинно в одной строке из восьми — там, где все три входа нули.`,
  });
}

// ═══════════════════ КТП 16 · py-05-data (0/1/0) ═══════════════════
{
  // int('3,5') в Python не работает: запятая не разделитель целой части.
  const okInt = pyInt("int(' 12 ')");
  eq(okInt, 12, "int(' 12 ')");
  ok(pyFails("int('3,5')"), "int('3,5') не должен отработать");
  sc('algo', {
    lesson: 'py-05-data', topic: T_PY_TYPES, sub: 'Что понимает int()',
    diff: 'intermediate', cog: 'apply', f: F.pyTypes,
    prompt: 'Что произойдёт в Python при выполнении a = int(\'3,5\')?',
    opts: [
      'Программа остановится с ошибкой: в int() передают точку, а не запятую',
      'a станет числом 3,5',
      'a станет числом 35',
      'a станет числом 0',
    ],
    correct: 'Программа остановится с ошибкой: в int() передают точку, а не запятую',
    why: 'int() понимает только цифры, знак и пробелы вокруг них, поэтому int(\' 12 \') работает. Запятая десятичным разделителем в Python не считается — дробные числа вводят через float(\'3.5\') с точкой.',
  });
}

// ═══════════════════ КТП 17 · py-06-linear (0/1/0) ═══════════════════
{
  // Присваивание считается справа налево, используются старые значения.
  const code = [
    'x = 2',
    'y = 5',
    'x = x + y',
    'print(x)',
  ].join('\n');
  const v = pyLastInt(code);
  eq(v, 7, 'x = 2; y = 5; x = x + y');
  nb('algo', {
    lesson: 'py-06-linear', topic: T_PY_EXPR, sub: 'Присваивание и старые значения',
    diff: 'intermediate', cog: 'apply', f: F.pyExpr,
    calc: () => v,
    prompt: 'Было x = 2, y = 5. Затем выполнили команду x = x + y. Чему равен x? Запишите только число.',
    why: `Сначала считается правая часть, и там используются старые значения: 2 + 5 = 7. Только потом 7 кладётся в x, поэтому x = ${v}. Если бы сначала обновили x, получилось бы совсем другое.`,
  });
}

// ═══════════════════ КТП 35 · algo-01-results (0/1/1) ═══════════════════
{
  // Трассировка по таблице: a = 5 → 10, a = 0 → 1, a = −4 → −3, a = 3 → 4.
  const run = (a) => (a > 3 ? a * 2 : a + 1);
  const inputs = [5, 0, -4, 3];
  const results = inputs.map(run);
  eq(results.join(','), '10,1,-3,4', 'результаты ветвления из урока');
  nb('algo', {
    lesson: 'algo-01-results', topic: T_ALGO, sub: 'Трассировка ветвления',
    diff: 'intermediate', cog: 'apply', f: F.analysis,
    calc: () => results[0],
    prompt: `Алгоритм: если a > 3, то a := a · 2, иначе a := a + 1. При a = ${inputs[0]} чему равен результат? Запишите только число.`,
    why: `Проверяем условие: ${inputs[0]} > 3 истинно, поэтому выполняется верхняя ветка и a = ${inputs[0]} · 2 = ${results[0]}. Остальные входы дают ${results.slice(1).map((v) => String(v).replace('-', '−')).join(', ')} — результат зависит от входных данных, поэтому проверяют каждую ветку отдельно.`,
  });
}
{
  const run = (n) => (n % 2 === 0 ? n * 2 : n + 1);
  const inputs = [1, 2, 3, 4];
  const distinct = [...new Set(inputs.map(run))].sort((a, b) => a - b);
  eq(distinct.join(','), '2,4,8', 'различные результаты');
  nb('algo', {
    lesson: 'algo-01-results', topic: T_ALGO, sub: 'Число различных результатов',
    diff: 'advanced', cog: 'analyze', f: F.analysis,
    calc: () => distinct.length,
    prompt: `Алгоритм: если n чётно, то r := n · 2, иначе r := n + 1. При n = ${inputs.join(', ')} сколько различных значений r получается? Запишите только число.`,
    why: `Прогоняем все входы: ${inputs.map((n) => `${n} → ${run(n)}`).join(', ')}. Различные результаты — ${list(distinct)}, то есть ${distinct.length} значения: у входов ${inputs.filter((n) => run(n) === distinct[1]).join(' и ')} результат совпал, поэтому значений меньше, чем входов.`,
  });
}

// ═══════════════════ КТП 36 · algo-02-inputs (0/1/1) ═══════════════════
{
  // Программа: чётное x делит пополам, нечётное — x · 2 + 1. Вывод 10.
  const run = (x) => (x % 2 === 0 ? x / 2 : x * 2 + 1);
  const target = 10;
  const hits = range(-20, 21).filter((x) => run(x) === target);
  eq(hits.join(','), '20', 'обратная задача: вывод 10');
  nb('algo', {
    lesson: 'algo-02-inputs', topic: T_ALGO, sub: 'Обратная задача с проверкой прогона',
    diff: 'intermediate', cog: 'apply', f: F.analysis,
    calc: () => hits.length === 1 ? hits[0] : (() => { throw new Error('ожидался ровно один вход'); })(),
    prompt: `Программа: если x чётно, то y := x : 2, иначе y := x · 2 + 1. Вывод — ${target}. Каким могло быть x? Запишите только число.`,
    why: `Ветка чётного: x : 2 = ${target} → x = ${target * 2}. Ветка нечётного: x · 2 + 1 = ${target} → x = ${String((target - 1) / 2).replace('.', ',')}, а это не целое число, значит нечётным x быть не мог. Проверка прогоном: ${target * 2} чётное → ${target * 2} : 2 = ${target}. Ответ единственный: x = ${target * 2}.`,
  });
}
{
  // Сумма цифр: какое наименьшее число даёт сумму цифр 20.
  const target = 20;
  const smallest = range(1, 9999).find((n) => digitSum(n) === target);
  eq(smallest, 299, 'наименьшее число с суммой цифр 20');
  eq(digitSum(smallest), target, `сумма цифр ${smallest}`);
  // Все меньшие числа сумму цифр 20 не дают — иначе ответ был бы не наименьшим.
  eq(range(1, smallest - 1).some((n) => digitSum(n) === target), false, 'меньших подходящих чисел нет');
  // Двух цифр для суммы 20 недостаточно — прикидываем диапазон.
  eq(digitSum(99) < target, true, 'двух цифр недостаточно');
  nb('algo', {
    lesson: 'algo-02-inputs', topic: T_ALGO, sub: 'Обратная задача с прикидкой диапазона',
    diff: 'advanced', cog: 'analyze', f: F.analysis,
    calc: () => smallest,
    prompt: `Программа складывает цифры числа. Вывод — ${target}. Какое наименьшее положительное число даёт такой вывод? Запишите только число.`,
    why: `Идём от результата: цифры должны в сумме дать ${target}. Двух цифр не хватит — их максимум 9 + 9 = ${digitSum(99)}, значит число трёхзначное. Чтобы число было наименьшим, сотни берём наименьшей возможной: на разряд остаётся ${target} − 2 = ${target - 2}, а это ровно 9 + ${target - 2 - 9}. Получаем ${smallest}, и проверяем прямым прогоном: ${String(smallest).split('').join(' + ')} = ${digitSum(smallest)}.`,
  });
}

// ─────────────────────── сборка файлов ───────────────────────

const ORDER = ['class', 'topic', 'subtopic', 'type', 'difficulty', 'cognitive_level', 'points',
  'lesson', 'fgos_requirement', 'fgos_element', 'fgos', 'prompt', 'student_view', 'auto_check', 'teacher_only'];
if (ORDER.length !== 15) throw new Error('ORDER разъехался');

/**
 * Любой маркер make-8-bank2 (в т.ч. оставшийся от параллельного запуска с другим
 * суффиксом) режется, чтобы в банке остался ровно один сгенерированный блок
 * и квота tmp/need-8.txt не удваивалась.
 */
const ANY_MARK = /^# ==== СГЕНЕРИРОВАНО scripts\/make-8-bank2\.mjs[^\n]*====$/gm;

function readHead(file) {
  const raw = readFileSync(file, 'utf-8');
  const hits = [...raw.matchAll(ANY_MARK)];
  const at = hits.length ? hits[0].index : -1;
  const head = (at === -1 ? raw : raw.slice(0, at)).replace(/\s+$/, '');
  return { head, staleBlocks: hits.length };
}

function maxId(head, prefix) {
  let max = 0;
  const re = new RegExp(`- id: ${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d{3})`, 'g');
  for (const m of head.matchAll(re)) max = Math.max(max, Number(m[1]));
  return max;
}

/** YAML-блок одного задания. topic и subtopic цитируются: двоеточие ломает разбор. */
function yamlBlock(t) {
  const fields = {
    class: '8',
    topic: q(t.topic),
    subtopic: q(t.sub),
    type: t.type,
    difficulty: t.diff,
    cognitive_level: t.cog,
    points: t.points,
    lesson: t.lesson,
    fgos_requirement: String(t.req),
    fgos_element: String(t.el),
    fgos: `{ subject: [${t.subj}], meta: [${t.diff === 'advanced' ? 'self-control' : 'plan-actions'}] }`,
    prompt: q(t.prompt),
    student_view: t.sv,
    auto_check: t.ac,
    teacher_only: t.to,
  };
  for (const k of ORDER) if (fields[k] === undefined) throw new Error(`нет поля ${k}`);
  return [`- id: ${t.id}`, ...ORDER.map((k) => `  ${k}: ${fields[k]}`)].join('\n');
}

// Головы всех банков читаем заранее: старый сгенерированный блок срезается,
// поэтому повторный запуск видит банк ровно в том виде, каким он был до записи.
const heads = {};
for (const [bank, cfg] of Object.entries(BANKS)) {
  const cut = readHead(cfg.file);
  heads[bank] = cut.head;
  heads[`stale:${bank}`] = cut.staleBlocks;
}

// id, уже занятые во всех банках 8 класса, — чтобы новые не совпали с чужими.
const usedIds = new Set();
for (const file of ALL_8_BANKS) {
  const head = Object.values(BANKS).some((c) => c.file === file) ? readHead(file).head : readFileSync(file, 'utf-8');
  for (const m of head.matchAll(/- id:\s*(\S+)/g)) usedIds.add(m[1]);
}

const perLesson = new Map();
const tally = { basic: 0, intermediate: 0, advanced: 0 };
const DIFFS = ['basic', 'intermediate', 'advanced'];

for (const [bank, cfg] of Object.entries(BANKS)) {
  const head = heads[bank];
  const staleBlocks = heads[`stale:${bank}`];
  let next = maxId(head, cfg.prefix) + 1;
  const blocks = state[bank].map((t) => {
    const id = cfg.prefix + String(next).padStart(3, '0');
    if (usedIds.has(id)) throw new Error(`id ${id} уже занят`);
    if (t.lesson !== cfgLessonCheck(bank, t.lesson)) throw new Error('внутренняя ошибка распределения по банкам');
    next += 1;
    usedIds.add(id);
    const row = perLesson.get(t.lesson) ?? { basic: 0, intermediate: 0, advanced: 0 };
    row[t.diff] += 1;
    perLesson.set(t.lesson, row);
    tally[t.diff] += 1;
    return yamlBlock({ ...t, id });
  });
  const out = `${head}\n\n${MARK}\n`
    + '# Ответы вычислены кодом (перебор наборов, parseInt/toString, локальный Python) и проверены check.mjs.\n\n'
    + `${blocks.join('\n\n')}\n`;
  writeFileSync(cfg.file, out, 'utf-8');
  console.log(`BANK OK: ${cfg.file} — ${blocks.length} заданий (${cfg.prefix}${String(maxId(head, cfg.prefix) + 1).padStart(3, '0')}-${cfg.prefix}${String(next - 1).padStart(3, '0')})${staleBlocks ? ` [перезаписан старый блок: ${staleBlocks}]` : ''}`);
}

/** Урок обязан попасть в свой банк: логика — в bank-logic, числа — в bank-gen. */
function cfgLessonCheck(bank, lesson) {
  const want = lesson.startsWith('logic-') ? 'logic'
    : lesson.startsWith('numsys-') ? 'gen'
      : 'algo';
  if (want !== bank) throw new Error(`урок ${lesson} попал в банк ${bank}, а должен в ${want}`);
  return lesson;
}

// ─────────────────────── сверка с tmp/need-8.txt ───────────────────────

for (const lesson of Object.keys(NEED)) {
  const got = perLesson.get(lesson) ?? { basic: 0, intermediate: 0, advanced: 0 };
  const want = NEED[lesson];
  eq(DIFFS.map((d) => got[d]).join('/'), want.join('/'),
    `${lesson}: нужно ${want.join('/')}, сделано ${DIFFS.map((d) => got[d]).join('/')}`);
}
for (const lesson of perLesson.keys()) {
  if (!(lesson in NEED)) throw new Error(`лишний урок вне tmp/need-8.txt: ${lesson}`);
}
const total = DIFFS.reduce((s, d) => s + tally[d], 0);
if (total !== NEED_TOTAL) throw new Error(`всего ${total}, а в tmp/need-8.txt указано ${NEED_TOTAL}`);

console.log(`ПРОВЕРОК: ${checks} (assert + чтение таблиц истинности перебором)`);
console.log(`ИТОГО: ${total} заданий — basic ${tally.basic}, intermediate ${tally.intermediate}, advanced ${tally.advanced}`);
for (const [lesson, want] of Object.entries(NEED)) {
  const got = perLesson.get(lesson);
  console.log(`  ${lesson}: ${want.join('/')} (b/i/a)`);
}