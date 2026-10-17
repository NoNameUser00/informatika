// Дозаполнение банков 8 класса по плану tmp/plan-8.txt.
//
// Правила (см. tmp/AUTHORING.md):
//   * ответы НЕ пишутся руками — считаются кодом и тут же проверяются;
//   * эталон code_run проверяется реальным запуском локального Python;
//   * генератор идемпотентен: уже дописанный блок в банк не пишется заново,
//     поэтому повторный запуск не меняет ни байта;
//   * в конце сверяется ровно тот список (урок -> b/i/a), что в плане.
//
// Запуск: node scripts/make-8-bank.mjs
// Затем: npm run validate-bank && npm run trainer:json
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// ─────────────────────────── проверки ───────────────────────────
function assert(cond, msg) {
  if (!cond) throw new Error(`make-8-bank: ${msg}`);
}
const eq = (got, want, what) => assert(got === want, `${what}: получено ${JSON.stringify(got)}, ожидалось ${JSON.stringify(want)}`);

// ─────────────────────────── вычисления ─────────────────────────
const q = (s) => JSON.stringify(String(s));                       // YAML-строка в двойных кавычках
const bin = (n) => n.toString(2);
const oct = (n) => n.toString(8);
const hex = (n) => n.toString(16).toUpperCase();
const range = (a, b, step = 1) => { const out = []; for (let i = a; i < b; i += step) out.push(i); return out; };
const fact = (n) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
const sum = (a) => a.reduce((s, v) => s + v, 0);
const digitSum = (n) => String(n).split('').reduce((s, d) => s + Number(d), 0);

// Логика 8 класса: значения выражений считаем перебором наборов 0/1.
const NOT = (a) => (a ? 0 : 1);
const AND = (a, b) => (a && b ? 1 : 0);
const OR = (a, b) => (a || b ? 1 : 0);
/** Значения выражения на всех наборах A, B (две переменные). */
const values = (fn) => [0, 1].flatMap((a) => [0, 1].map((b) => fn(a, b)));
const distinctValues = (fn) => new Set(values(fn)).size;

// Римская система — нужен и прямой, и обратный перевод (проверяем друг на друга).
const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'],
  [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
function toRoman(n) {
  let s = '';
  for (const [v, sym] of ROMAN) while (n >= v) { s += sym; n -= v; }
  return s;
}
function fromRoman(s) {
  const V = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) total += V[s[i]] < (V[s[i + 1]] ?? 0) ? -V[s[i]] : V[s[i]];
  return total;
}
const distinctSigns = (s) => new Set(s.split('')).size;

// Типы данных Python — классифицируем так же, как это делает интерпретатор.
function pyType(v) {
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
  if (typeof v === 'string') return 'str';
  return 'other';
}

// ───────────────────── конструкторы заданий ─────────────────────
const PTS = { basic: 1, intermediate: 2, advanced: 3 };
const COG = { basic: ['remember', 'apply'], intermediate: ['apply'], advanced: ['analyze'] };
const fgosOf = (subject, meta) => ({ subject: [subject], meta: [meta] });

/** numeric_base: ответ задаётся десятичным числом dec и строкой key в системе base. */
function num(o) {
  assert(COG[o.d].includes(o.cog ?? 'apply'), `${o.sub}: cognitive_level не подходит сложности ${o.d}`);
  // Ключ обязан сходиться с десятичным значением — та же проверка, что в check.mjs.
  const parsed = parseInt(String(o.key).toUpperCase(), o.base);
  eq(parsed, o.dec, `numeric ${o.sub}: ключ ${o.key} (основание ${o.base}) не даёт ${o.dec}`);
  return {
    kind: 'numeric_base', topic: o.topic, subtopic: o.sub, difficulty: o.d,
    cognitive_level: o.cog ?? 'apply', points: PTS[o.d], lesson: o.lesson,
    fgos_requirement: o.req ?? 1.4, fgos_element: o.elem ?? 1.5,
    fgos: fgosOf(o.subject, o.meta ?? 'plan-actions'),
    prompt: o.prompt, base: o.base, dec: o.dec, key: o.key, why: o.why,
  };
}

/** single_choice: opts — строки вариантов, correct — индекс правильного. */
function sc(o) {
  assert(o.opts.length >= 2 && o.opts.length <= 4, `${o.sub}: вариантов ${o.opts.length}`);
  assert(new Set(o.opts).size === o.opts.length, `${o.sub}: варианты повторяются`);
  assert(o.correct >= 0 && o.correct < o.opts.length, `${o.sub}: неверный индекс правильного ответа`);
  return {
    kind: 'single_choice', topic: o.topic, subtopic: o.sub, difficulty: o.d,
    cognitive_level: o.cog ?? 'apply', points: PTS[o.d], lesson: o.lesson,
    fgos_requirement: o.req ?? 1.4, fgos_element: o.elem ?? 1.5,
    fgos: fgosOf(o.subject, o.meta ?? 'plan-actions'),
    prompt: o.prompt, opts: o.opts, correct: o.correct, why: o.why, common: o.common,
  };
}

/** matching: map — соответствие «левая часть -> правая часть». */
function mt(o) {
  assert(o.map.length === o.left.length, `${o.sub}: в соответствии ${o.map.length} пар, а левых частей ${o.left.length}`);
  const rightUsed = o.map.map((p) => p[1]);
  assert(rightUsed.every((r) => o.right.includes(r)), `${o.sub}: ответ не найден среди правых частей`);
  // Правые части обычно различны; повтор допустим, когда правых вариантов всего два
  // (например «истинно / ложно») — тогда это помечается явно.
  if (!o.allowRepeat) eq(new Set(rightUsed).size, rightUsed.length, `${o.sub}: правые части повторяются`);
  return {
    kind: 'matching', topic: o.topic, subtopic: o.sub, difficulty: o.d,
    cognitive_level: o.cog ?? 'apply', points: PTS[o.d], lesson: o.lesson,
    fgos_requirement: o.req ?? 1.4, fgos_element: o.elem ?? 1.5,
    fgos: fgosOf(o.subject, o.meta ?? 'plan-actions'),
    prompt: o.prompt, left: o.left, right: o.right, map: o.map, why: o.why,
  };
}

/** code_run: эталон проверяется запуском solution_code локальным Python. */
function cr(o) {
  assert(COG[o.d].includes(o.cog ?? 'apply'), `${o.sub}: cognitive_level не подходит сложности ${o.d}`);
  return {
    kind: 'code_run', topic: o.topic, subtopic: o.sub, difficulty: o.d,
    cognitive_level: o.cog ?? 'apply', points: PTS[o.d], lesson: o.lesson,
    fgos_requirement: o.req ?? 1.4, fgos_element: o.elem ?? 1.5,
    fgos: fgosOf(o.subject, o.meta ?? 'plan-actions'),
    prompt: o.prompt, template: o.template, solution: o.solution, stdout: o.stdout, why: o.why,
  };
}

// ─────────────────────── локальный Python ───────────────────────
const PY = ['python', 'python3'].find((cmd) => {
  try { execFileSync(cmd, ['-c', 'pass']); return true; } catch { return false; }
});
/** Нормализация вывода как в src/lib/pyrun/compare.mjs. */
const normOut = (s) => String(s ?? '').replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n').replace(/\n+$/, '');
function runPython(code) {
  assert(PY, 'локальный Python не найден (нужен python или python3 в PATH)');
  try {
    return execFileSync(PY, ['-c', code], {
      encoding: 'utf-8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      timeout: 20000,
    });
  } catch (e) {
    throw new Error(`make-8-bank: эталон не выполнился: ${String(e.stderr ?? e.message).trim()}`);
  }
}

// ═════════════════════ СИСТЕМЫ СЧИСЛЕНИЯ ═════════════════════
// bank-gen.yaml, id 066-073
const TOPIC_SS = 'Системы счисления';
const FGS = (s) => ({ req: 1.2, elem: 1.3, subject: s });

// --- КТП 1: numsys-01-intro (дописать 0 basic / 1 intermediate / 1 advanced) ---
// Развёрнутая форма в троичной системе: 2·3² + 1·3¹ + 2 = 212₃ = 23.
const TRO = 2 * 3 ** 2 + 1 * 3 + 2;
eq(TRO, 23, 'развёрнутая форма 212₃');
const numsys = [
  num({
    d: 'intermediate', cog: 'apply', lesson: 'numsys-01-intro', topic: TOPIC_SS, sub: 'Развёрнутая форма, троичная система',
    req: 1.1, elem: 1.1, subject: 'inf-8-numsys-represent', base: 10, dec: TRO, key: String(TRO),
    prompt: 'Число 212 записано в троичной системе счисления. Вычислите его развёрнутую форму 2×3² + 1×3¹ + 2. Запишите только число.',
    why: `2 · 9 + 1 · 3 + 2 = ${TRO}`,
  }),
];
// Алфавит римской записи: 3888 = MMM DCCC LXXX VIII — семь различных знаков.
{
  const r = toRoman(3888);
  eq(fromRoman(r), 3888, 'римская запись 3888');
  eq(r, 'MMMDCCCLXXXVIII', 'римская запись 3888');
  const n = distinctSigns(r);
  eq(n, 7, 'различных знаков в 3888');
  numsys.push(num({
    d: 'advanced', cog: 'analyze', lesson: 'numsys-01-intro', topic: TOPIC_SS, sub: 'Алфавит римской системы',
    req: 1.1, elem: 1.2, subject: 'inf-8-numsys-represent', meta: 'self-control', base: 10, dec: n, key: String(n),
    prompt: 'Запишите число 3888 в римской системе счисления и подсчитайте, сколько различных знаков в этой записи. Запишите только число.',
    why: `3888 = ${r}: знаки M, D, C, L, X, V, I — семь различных`,
  }));
}
// --- КТП 2: numsys-02-binary (0/0/1) ---
{
  const n = 2 ** 5;
  eq(n, 32, 'число двоичных записей длиной 5');
  numsys.push(num({
    d: 'advanced', cog: 'analyze', lesson: 'numsys-02-binary', topic: TOPIC_SS, sub: 'Число двоичных записей',
    ...FGS('inf-8-numsys-represent'), base: 10, dec: n, key: String(n),
    prompt: 'Сколько существует различных двоичных записей длиной ровно 5 цифр? Запишите только число.',
    why: 'В каждом из 5 разрядов стоит 0 или 1, поэтому записей 2⁵ = 32',
  }));
}
// --- КТП 3: numsys-03-octal (0/0/1) ---
{
  const n10 = 730;
  const o = oct(n10);
  const bits = bin(parseInt(o, 8));
  const ones = [...bits].filter((b) => b === '1').length;
  eq(parseInt(bits, 2), n10, 'цепочка 10 -> 8 -> 2');
  eq(ones, 6, 'единиц в двоичной записи 730');
  numsys.push(num({
    d: 'advanced', cog: 'analyze', lesson: 'numsys-03-octal', topic: TOPIC_SS, sub: 'Цепочка 10-8-2',
    ...FGS('inf-8-numsys-convert'), meta: 'self-control', base: 10, dec: ones, key: String(ones),
    prompt: 'Число 730₁₀ переведите в восьмеричную систему, затем результат — в двоичную, и подсчитайте количество единиц в двоичной записи. Запишите только число.',
    why: `730₁₀ = ${o}₈ = ${bits}₂, единиц: ${ones}`,
  }));
}
// --- КТП 4: numsys-04-hex (0/0/1) ---
{
  const a = parseInt('A', 16), b = 6;
  const v = a + b, key = hex(v);
  eq(v, 16, 'A₁₆ + 6₁₆');
  eq(key, '10', 'ключ 16 в шестнадцатеричной');
  numsys.push(num({
    d: 'advanced', cog: 'analyze', lesson: 'numsys-04-hex', topic: TOPIC_SS, sub: 'Арифметика в 16СС',
    ...FGS('inf-8-numsys-arith'), elem: 1.4, meta: 'self-control', base: 16, dec: v, key,
    prompt: 'Вычислите: A₁₆ + 6₁₆. Ответ дайте в шестнадцатеричной системе. Запишите только число.',
    why: `A = 10, 10 + 6 = 16₁₀, а это в шестнадцатеричной системе ${key}₁₆`,
  }));
}
// --- КТП 5: numsys-05-arith (0/0/1) ---
{
  const a = parseInt('1011', 2), b = parseInt('101', 2), v = a * b;
  eq(v, 55, '1011₂ × 101₂');
  numsys.push(num({
    d: 'advanced', cog: 'analyze', lesson: 'numsys-05-arith', topic: TOPIC_SS, sub: 'Умножение в двоичной',
    ...FGS('inf-8-numsys-arith'), elem: 1.4, meta: 'self-control', base: 10, dec: v, key: String(v),
    prompt: 'Вычислите: 1011₂ × 101₂. Ответ дайте в десятичной системе. Запишите только число.',
    why: `${a} × ${b} = ${v}, в двоичной это ${bin(v)}₂`,
  }));
}
// --- КТП 6: numsys-06-review (1 basic / 1 intermediate / 0 advanced) ---
{
  const v = parseInt('001101', 2);
  eq(v, 13, '001101₂ без ведущих нулей');
  numsys.push(num({
    d: 'basic', cog: 'apply', lesson: 'numsys-06-review', topic: TOPIC_SS, sub: 'Ведущие нули',
    ...FGS('inf-8-numsys-convert'), base: 10, dec: v, key: String(v),
    prompt: 'Переведите число 001101₂ в десятичную систему. Запишите только число.',
    why: `Ведущие нули значения не меняют: 001101₂ = 1101₂ = ${v}`,
  }));
}
{
  const v = parseInt('AF', 16), key = oct(v);
  eq(v, 175, 'AF₁₆');
  eq(key, '257', 'AF₁₆ в восьмеричной');
  numsys.push(num({
    d: 'intermediate', cog: 'apply', lesson: 'numsys-06-review', topic: TOPIC_SS, sub: 'Триады и тетрады',
    ...FGS('inf-8-numsys-convert'), base: 8, dec: v, key,
    prompt: 'Переведите число AF₁₆ в восьмеричную систему через двоичную. Запишите только число.',
    why: `AF₁₆ = 1010 1111₂, триады справа: 010 101 111 = ${key}₈`,
  }));
}

// ═════════════════════════ ЛОГИКА ═════════════════════════
// bank-logic.yaml, id 020-030
const TOPIC_L = 'Элементы математической логики';
const LOG = [];

// --- КТП 7: logic-01-utterances (0 basic / 1 intermediate / 1 advanced) ---
LOG.push(sc({
  d: 'intermediate', cog: 'apply', lesson: 'logic-01-utterances', topic: TOPIC_L, sub: 'Область истинности формы',
  req: 1.3, elem: 1.5, subject: 'inf-8-logic-utter',
  prompt: 'В высказывание «x — чётное число» вместо x подставили число 4. Истинно ли это высказывание?',
  opts: ['Истина', 'Ложь', 'Пока нельзя определить', 'Это не высказывание'], correct: 0,
  why: '4 делится на 2 без остатка, поэтому форма даёт истину. Область истинности — все чётные значения x.',
}));
{
  const checks = [
    ['15 делится на 5', 15 % 5 === 0],
    ['2² = 5', 2 ** 2 === 5],
    ['10 делится на 4', 10 % 4 === 0],
    ['2³ = 8', 2 ** 3 === 8],
  ];
  const left = checks.map(([t]) => t);
  const map = checks.map(([t, ok]) => [t, ok ? 'истинно' : 'ложно']);
  eq(map.filter(([, v]) => v === 'истинно').length, 2, 'истинных высказываний из четырёх');
  LOG.push(mt({
    d: 'advanced', cog: 'analyze', lesson: 'logic-01-utterances', topic: TOPIC_L, sub: 'Проверка истинности',
    req: 1.3, elem: 1.5, subject: 'inf-8-logic-utter', meta: 'self-control', left, right: ['истинно', 'ложно'], map,
    allowRepeat: true, prompt: 'Установите соответствие: высказывание — его истинность.',
    why: '15:5 = 3 — истинно; 2² = 5 — ложно; 10:4 = 2 (остаток 2) — ложно; 2³ = 8 — истинно',
  }));
}
// --- КТП 8: logic-02-operations (0/0/1) ---
{
  const rows = values((a, b) => AND(OR(a, b), NOT(b))).filter((v) => v === 1).length;
  eq(rows, 1, 'строк, где (A ∨ B) ∧ ¬B равно 1');
  LOG.push(num({
    d: 'advanced', cog: 'analyze', lesson: 'logic-02-operations', topic: TOPIC_L, sub: 'Подсчёт строк в таблице',
    req: 1.4, elem: 1.6, subject: 'inf-8-logic-tables', meta: 'self-control', base: 10, dec: rows, key: String(rows),
    prompt: 'В скольких строках таблицы истинности выражение (A ∨ B) ∧ ¬B равно 1? Запишите только число.',
    why: 'Единица получается только при A = 1, B = 0 — одна строка из четырёх',
  }));
}
// --- КТП 9: logic-05-expression (1/1/1) ---
{
  // Верная запись — И; каждый неверный вариант должен отличаться от условия хоть где-то.
  const phrase = (a) => a > 2 && a % 2 === 0;
  const variants = [(a) => a > 2 && a % 2 === 0, (a) => a > 2 || a % 2 === 0, (a) => a > 2 && a > 0, (a) => !(a > 2) || a % 2 === 0];
  for (let a = 1; a <= 10; a++) eq(variants[0](a), phrase(a), `верный вариант при a = ${a}`);
  for (const [i, f] of variants.entries()) {
    if (i === 0) continue;
    assert(range(1, 11).some((a) => f(a) !== phrase(a)), `вариант ${i} не отличается от условия — он тоже верен`);
  }
  LOG.push(sc({
    d: 'basic', cog: 'apply', lesson: 'logic-05-expression', topic: TOPIC_L, sub: 'Запись условия',
    req: 1.3, elem: 1.5, subject: 'inf-8-logic-ops',
    prompt: 'Запишите выражением условие «a больше 2 и a чётное».',
    opts: ['a > 2 ∧ (a mod 2 = 0)', 'a > 2 ∨ (a mod 2 = 0)', '(a > 2) ∧ (a > 0)', '¬(a > 2) ∨ (a mod 2 = 0)'], correct: 0,
    why: 'Оба условия должны выполняться одновременно — связка И. Проверка при a = 4: подходит только первый вариант.',
  }));
}
{
  const v = values((a) => AND(OR(a, 1), 0));
  eq(distinctValues((a) => AND(OR(a, 1), 0)), 1, 'различных значений (A ∨ 1) ∧ 0');
  eq(v[0], 0, '(A ∨ 1) ∧ 0');
  LOG.push(num({
    d: 'intermediate', cog: 'apply', lesson: 'logic-05-expression', topic: TOPIC_L, sub: 'Упрощение выражения',
    req: 1.4, elem: 1.5, subject: 'inf-8-logic-ops', base: 10, dec: v[0], key: String(v[0]),
    prompt: 'Упростите выражение (A ∨ 1) ∧ 0 и укажите, чему оно равно при любом значении A. Запишите только число.',
    why: 'По тождеству A ∨ 1 = 1, а 1 ∧ 0 = 0. Значение не зависит от A.',
  }));
}
{
  // Сколько целых значений x делают выражение истинным.
  const exprs = [
    ['x = 1 ∨ x = 5', (x) => x === 1 || x === 5],
    ['x = 1 ∧ x = 5', (x) => x === 1 && x === 5],
    ['x > 0 ∧ x < 5', (x) => x > 0 && x < 5],
  ];
  const counts = exprs.map(([, f]) => range(-5, 6).filter(f).length);
  eq(counts.join(','), '2,0,4', 'области истинности');
  const right = counts.map(String);
  eq(new Set(right).size, right.length, 'размеры областей истинности');
  LOG.push(mt({
    d: 'advanced', cog: 'analyze', lesson: 'logic-05-expression', topic: TOPIC_L, sub: 'Область истинности',
    req: 1.4, elem: 1.5, subject: 'inf-8-logic-ops', left: exprs.map(([t]) => t), right,
    map: exprs.map(([t], i) => [t, right[i]]),
    prompt: 'Установите соответствие: выражение — сколько целых значений x (от −5 до 5) делают его истинным.',
    why: 'x = 1 или x = 5 — два значения; x = 1 и x = 5 — ни одного; 0 < x < 5 — четыре значения (1, 2, 3, 4)',
  }));
}
// --- КТП 10: logic-06-laws (1/1/1) ---
{
  eq(distinctValues((a) => AND(a, NOT(a))), 1, 'различных значений A ∧ ¬A');
  eq(values((a) => AND(a, NOT(a)))[0], 0, 'A ∧ ¬A');
  LOG.push(num({
    d: 'basic', cog: 'remember', lesson: 'logic-06-laws', topic: TOPIC_L, sub: 'Закон противоречия',
    req: 1.4, elem: 1.5, subject: 'inf-8-logic-laws', base: 10, dec: 0, key: '0',
    prompt: 'Чему равно выражение A ∧ ¬A при любом значении A? Запишите только число.',
    why: 'Закон противоречия: A ∧ ¬A = 0. Проверка — при A = 1 получаем 1 ∧ 0 = 0, при A = 0 тоже 0.',
  }));
}
{
  for (const [a, b] of [[0, 0], [0, 1], [1, 0], [1, 1]]) assert(NOT(OR(a, b)) === AND(NOT(a), NOT(b)), `закон де Моргана не сошёлся при A = ${a}, B = ${b}`);
  LOG.push(sc({
    d: 'intermediate', cog: 'apply', lesson: 'logic-06-laws', topic: TOPIC_L, sub: 'Закон де Моргана',
    req: 1.4, elem: 1.5, subject: 'inf-8-logic-laws',
    prompt: 'Чему равносильно выражение ¬(A ∨ B)?',
    opts: ['¬A ∧ ¬B', '¬A ∨ ¬B', 'A ∧ B', '¬(A ∧ B)'], correct: 0,
    why: 'Закон де Моргана: отрицание дизъюнкции — конъюнкция отрицаний. Проверка при A = 1, B = 0: слева ¬1 = 0, справа 0 ∧ 1 = 0.',
  }));
}
{
  const n = distinctValues((a) => OR(a, NOT(a)));
  eq(n, 1, 'различных значений A ∨ ¬A');
  LOG.push(num({
    d: 'advanced', cog: 'analyze', lesson: 'logic-06-laws', topic: TOPIC_L, sub: 'Закон исключённого среднего',
    req: 1.4, elem: 1.5, subject: 'inf-8-logic-laws', meta: 'self-control', base: 10, dec: n, key: String(n),
    prompt: 'Сколько различных значений принимает выражение A ∨ ¬A при всех возможных значениях A? Запишите только число.',
    why: 'По закону исключённого среднего A ∨ ¬A всегда равно 1, значит различных значений ровно одно.',
  }));
}
// --- КТП 12: logic-04-elements (1 basic / 1 intermediate / 0 advanced) ---
LOG.push(sc({
  d: 'basic', cog: 'remember', lesson: 'logic-04-elements', topic: TOPIC_L, sub: 'Логические элементы',
  req: 1.4, elem: 1.7, subject: 'inf-8-logic-elements',
  prompt: 'У какого логического элемента один вход?',
  opts: ['И (конъюнктор)', 'ИЛИ (дизъюнктор)', 'НЕ (инвертор)', 'Повторитель сигнала'], correct: 2,
  why: 'У инвертора один вход и кружок инверсии на выходе; у И и ИЛИ входов два и больше.',
}));
{
  const v = AND(1, AND(1, 0));
  eq(v, 0, 'конъюнктор на входах 1, 1, 0');
  LOG.push(num({
    d: 'intermediate', cog: 'apply', lesson: 'logic-04-elements', topic: TOPIC_L, sub: 'Конъюнктор',
    req: 1.4, elem: 1.7, subject: 'inf-8-logic-elements', base: 10, dec: v, key: String(v),
    prompt: 'На входы логического элемента И поданы сигналы 1, 1 и 0. Что будет на выходе? Запишите только число.',
    why: 'Конъюнктор даёт 1, только если на всех входах единицы; здесь один вход 0 — значит выход 0.',
  }));
}

// ═══════════════ АЛГОРИТМЫ И ПРОГРАММИРОВАНИЕ ═══════════════
// bank-algo.yaml, id 021-062
const A_PROPS = 'Алгоритмы и исполнители';
const A_NOTAT = 'Способы записи алгоритмов';
const A_BRANCH = 'Ветвление';
const A_LOOP = 'Повторение';
const A_SEQ = 'Следование';
const A_DESIGN = 'Разработка алгоритмов';
const A_ANALYSIS = 'Анализ алгоритмов';
const PY_SYS = 'Основы Python';
const PY_TYPES = 'Типы данных и ввод';
const PY_EXPR = 'Выражения и линейные алгоритмы';
const PY_IF = 'Условный оператор';
const PY_WHILE = 'Циклы в Python';
const PY_FOR = 'Цикл for';
const PY_STR = 'Работа со строками';
const PY_CTRL = 'Итоговая контрольная работа';
const ALGO = [];

// --- КТП 13: alg-01-performers (0/0/1) ---
{
  // Вычислитель: 1 — вычесть 1, 2 — умножить на 3. Читаем команды слева направо.
  let x = 3;
  const steps = [];
  for (const c of '212212') { x = c === '2' ? x * 3 : x - 1; steps.push(x); }
  eq(steps.join(','), '9,8,24,72,71,213', 'Вычислитель 212212 над числом 3');
  eq(x, 213, 'Вычислитель 212212 над числом 3');
  ALGO.push(num({
    d: 'advanced', cog: 'analyze', lesson: 'alg-01-performers', topic: A_PROPS, sub: 'Вычислитель — длинный алгоритм',
    elem: 1.5, subject: 'inf-8-algo-performer', meta: 'self-control', base: 10, dec: x, key: String(x),
    prompt: 'Вычислитель (1 — вычти 1, 2 — умножь на 3) выполняет алгоритм 212212 над числом 3. Что получится? Запишите только число.',
    why: 'По порядку команды: ×3, −1, ×3, ×3, −1, ×3 — числа 9, 8, 24, 72, 71, 213',
  }));
}
// --- КТП 14: alg-02-notation (0/0/1) ---
{
  let x = 4; let y = 9;
  x = x + y; const s1 = `${x},${y}`;
  y = x - y; const s2 = `${x},${y}`;
  x = y * 2;
  eq(s1, '13,9', 'после x := x + y');
  eq(s2, '13,4', 'после y := x − y');
  eq(x, 8, 'после x := y · 2');
  ALGO.push(num({
    d: 'advanced', cog: 'analyze', lesson: 'alg-02-notation', topic: A_NOTAT, sub: 'Трассировка: цепочка присваиваний',
    elem: 1.5, subject: 'inf-8-algo-notation', base: 10, dec: x, key: String(x),
    prompt: 'Было x = 4, y = 9. Выполнили по порядку: x := x + y; y := x − y; x := y · 2. Чему равен x? Запишите только число.',
    why: 'Шаг 1: x = 13. Шаг 2: y = 13 − 9 = 4. Шаг 3: x = 4 · 2 = 8',
  }));
}
// --- КТП 15: py-01-basics (0 basic / 1 intermediate / 1 advanced; advanced — в банке кода) ---
ALGO.push(sc({
  d: 'intermediate', cog: 'apply', lesson: 'py-01-basics', topic: PY_SYS, sub: 'Система программирования',
  elem: 1.5, subject: 'inf-8-py-system',
  prompt: 'Какая часть системы программирования переводит текст программы в машинный код, понятный процессору?',
  opts: ['Редактор', 'Отладчик', 'Трансплятор', 'Исполнитель алгоритма'], correct: 2,
  why: 'Трансплятор (интерпретатор или компилятор) переводит программу в машинный код; отладчик ищет ошибки, редактор нужен для набора текста.',
}));
// --- КТП 16: py-05-data (1/1/1) ---
ALGO.push(sc({
  d: 'basic', cog: 'remember', lesson: 'py-05-data', topic: PY_TYPES, sub: 'Типы данных',
  elem: 1.5, subject: 'inf-8-py-types',
  prompt: 'Какой тип данных у значения \'12\' в Python?',
  opts: ['int', 'float', 'str', 'bool'], correct: 2,
  why: 'Кавычки делают запись строкой (str); без кавычек 12 — целое число int.',
}));
{
  const v = parseInt(' 12 ', 10) + parseInt('3', 10);
  eq(v, 15, "int(' 12 ') + int('3')");
  ALGO.push(num({
    d: 'intermediate', cog: 'apply', lesson: 'py-05-data', topic: PY_TYPES, sub: 'Преобразование типов',
    elem: 1.5, subject: 'inf-8-py-types', base: 10, dec: v, key: String(v),
    prompt: 'В программе a = int(\' 12 \') + int(\'3\'). Чему равно a? Запишите только число.',
    why: 'int() отбрасывает пробелы вокруг цифр и даёт число: 12 + 3 = 15',
  }));
}
{
  const values5 = [5, 3.14, 'Привет', true];
  const left = ['5', '3.14', "'Привет'", 'True'];
  const map = values5.map((v, i) => [left[i], pyType(v)]);
  eq(map.map(([, t]) => t).join(','), 'int,float,str,bool', 'типы значений Python');
  ALGO.push(mt({
    d: 'advanced', cog: 'analyze', lesson: 'py-05-data', topic: PY_TYPES, sub: 'Типы значений',
    elem: 1.5, subject: 'inf-8-py-types', meta: 'self-control', left, right: ['int', 'float', 'str', 'bool'], map,
    prompt: 'Установите соответствие: значение — его тип данных в Python.',
    why: '5 — int, 3.14 — float (точка вместо запятой), \'Привет\' — str (кавычки), True — bool',
  }));
}
// --- КТП 17: py-06-linear (1 basic / 1 intermediate / 1 advanced; advanced — в банке кода) ---
{
  const v = 17 % 5;
  eq(v, 2, '17 % 5');
  eq(Math.floor(17 / 5), 3, '17 // 5');
  ALGO.push(num({
    d: 'basic', cog: 'remember', lesson: 'py-06-linear', topic: PY_EXPR, sub: 'Остаток от деления',
    elem: 1.5, subject: 'inf-8-py-expr', base: 10, dec: v, key: String(v),
    prompt: 'Чему равен остаток от деления 17 на 5 (операция %)? Запишите только число.',
    why: '17 = 5 · 3 + 2, значит 17 % 5 = 2, а целая часть 17 // 5 = 3',
  }));
}
{
  const v = (2 + 3) * 2 ** 2;
  eq(v, 20, '(2 + 3) * 2 ** 2');
  ALGO.push(num({
    d: 'intermediate', cog: 'apply', lesson: 'py-06-linear', topic: PY_EXPR, sub: 'Приоритет операций',
    elem: 1.5, subject: 'inf-8-py-expr', base: 10, dec: v, key: String(v),
    prompt: 'Вычислите выражение (2 + 3) * 2 ** 2. Запишите только число.',
    why: 'Сначала скобки: 2 + 3 = 5. Затем степень: 2 ** 2 = 4. Произведение: 5 · 4 = 20',
  }));
}
// --- КТП 18: alg-05-sequence (1/1/1) ---
ALGO.push(sc({
  d: 'basic', cog: 'remember', lesson: 'alg-05-sequence', topic: A_SEQ, sub: 'Признак следования',
  elem: 1.5, subject: 'inf-8-algo-sequence',
  prompt: 'Чем следование отличается от ветвления?',
  opts: [
    'В следовании нет ни условия, ни цикла — команды идут строго по порядку',
    'В следовании есть условие, которое выбирает следующую команду',
    'В следовании есть цикл, повторяющий команды',
    'В следовании порядок команд можно менять без последствий',
  ], correct: 0,
  why: 'Следование — самая простая конструкция: ни ветвления, ни повторения, порядок команд задаёт всё.',
}));
{
  let x = 4; x = x * 2; x = x - 3;
  eq(x, 5, 'следование 4 → 8 → 5');
  ALGO.push(num({
    d: 'intermediate', cog: 'apply', lesson: 'alg-05-sequence', topic: A_SEQ, sub: 'Следование: порядок команд',
    elem: 1.5, subject: 'inf-8-algo-sequence', base: 10, dec: x, key: String(x),
    prompt: 'Выполните по порядку команды: x := 4; x := x · 2; x := x − 3. Чему равен x? Запишите только число.',
    why: '4 → 8 → 5: каждая команда использует значение x из предыдущего шага',
  }));
}
{
  const y = 30, x = y / 2 - 4;
  eq(x, 11, 'обратная задача');
  eq((x + 4) * 2, y, 'проверка обратной задачи');
  ALGO.push(num({
    d: 'advanced', cog: 'analyze', lesson: 'alg-05-sequence', topic: A_SEQ, sub: 'Обратная задача',
    elem: 1.5, subject: 'inf-8-algo-sequence', meta: 'self-control', base: 10, dec: x, key: String(x),
    prompt: 'Алгоритм: y := (x + 4) · 2. Известно, что в результате получилось y = 30. Каким было x? Запишите только число.',
    why: 'Идём от результата: 30 : 2 = 15, 15 − 4 = 11. Проверка: (11 + 4) · 2 = 30',
  }));
}
// --- КТП 19: alg-03-branching (0/0/1) ---
{
  const run = (n) => (n % 2 !== 0 ? 3 * n + 1 : n / 2);
  const results = [7, 4, 10].map(run);
  eq(results.join(','), '22,2,5', 'полная форма ветвления');
  const total = sum(results);
  eq(total, 29, 'сумма результатов ветвления');
  ALGO.push(num({
    d: 'advanced', cog: 'analyze', lesson: 'alg-03-branching', topic: A_BRANCH, sub: 'Проверка обеих веток',
    elem: 1.5, subject: 'inf-8-algo-branch', meta: 'self-control', base: 10, dec: total, key: String(total),
    prompt: 'Алгоритм: если n нечётно, то r := 3 · n + 1, иначе r := n : 2. Выполните его для n = 7, затем для n = 4 и для n = 10. Чему равна сумма трёх результатов? Запишите только число.',
    why: 'n = 7: 3 · 7 + 1 = 22; n = 4: 4 : 2 = 2; n = 10: 10 : 2 = 5. Сумма: 22 + 2 + 5 = 29',
  }));
}
// --- КТП 20: alg-06-branching-short (1/1/1) ---
ALGO.push(sc({
  d: 'basic', cog: 'remember', lesson: 'alg-06-branching-short', topic: A_BRANCH, sub: 'Неполная форма',
  elem: 1.5, subject: 'inf-8-algo-branch',
  prompt: 'Что происходит, если условие в неполной форме ветвления ложно?',
  opts: [
    'Выполняется ветка «иначе»',
    'Программа идёт дальше, ничего не выполняя',
    'Программа завершается с ошибкой',
    'Цикл повторяется заново',
  ], correct: 1,
  why: 'В неполной форме ветка «иначе» отсутствует: при ложном условии тело просто пропускается.',
}));
{
  const balance = 100;
  const v = balance < 30 ? balance + 50 : balance;
  eq(v, 100, 'пополнение баланса при 100');
  ALGO.push(num({
    d: 'intermediate', cog: 'apply', lesson: 'alg-06-branching-short', topic: A_BRANCH, sub: 'Пополнение баланса',
    elem: 1.5, subject: 'inf-8-algo-branch', base: 10, dec: v, key: String(v),
    prompt: 'Алгоритм: если balance < 30, то balance := balance + 50. Было balance = 100. Чему равен balance после выполнения? Запишите только число.',
    why: '100 < 30 ложно, поэтому действие не выполняется и balance остаётся 100',
  }));
}
{
  const x = -6;
  let y = x;
  if (x < 0) y = 0 - x;
  if (x % 2 === 0) y = y + 1;
  eq(y, 7, 'два неполных ветвления при x = −6');
  ALGO.push(num({
    d: 'advanced', cog: 'analyze', lesson: 'alg-06-branching-short', topic: A_BRANCH, sub: 'Два неполных ветвления',
    elem: 1.5, subject: 'inf-8-algo-branch', meta: 'self-control', base: 10, dec: y, key: String(y),
    prompt: 'Алгоритм: если x < 0, то y := 0 − x; если x чётно, то y := y + 1. При x = −6 чему равен y? Запишите только число.',
    why: 'Первое условие истинно: y = 0 − (−6) = 6. Второе тоже истинно: y = 6 + 1 = 7',
  }));
}
// --- КТП 21: alg-07-while (0/0/1) ---
{
  let n = 500000; let k = 0;
  while (n > 0) { n = Math.floor(n / 10); k += 1; }
  eq(k, 6, 'итераций цикла при n = 500000');
  ALGO.push(num({
    d: 'advanced', cog: 'analyze', lesson: 'alg-07-while', topic: A_LOOP, sub: 'Число итераций',
    elem: 1.5, subject: 'inf-8-algo-loops', meta: 'self-control', base: 10, dec: k, key: String(k),
    prompt: 'Цикл: нц пока n > 0 | n := n : 10 (целая часть) | кц. Сколько раз выполнится тело цикла при n = 500000? Запишите только число.',
    why: '500000 → 50000 → 5000 → 500 → 50 → 5 → 0: шесть делений, шесть шагов тела',
  }));
}
// --- КТП 22: alg-08-until (1/1/1) ---
ALGO.push(sc({
  d: 'basic', cog: 'remember', lesson: 'alg-08-until', topic: A_LOOP, sub: 'Условие окончания',
  elem: 1.5, subject: 'inf-8-algo-loops',
  prompt: 'Сколько раз минимум выполнится тело цикла с условием окончания?',
  opts: ['0 раз', '1 раз', '2 раза', 'Столько, сколько повторений указано в условии'], correct: 1,
  why: 'Тело стоит до проверки условия, поэтому выполняется хотя бы один раз — в отличие от цикла «пока».',
}));
{
  let n = 1; let steps = 0;
  do { n = n + 3; steps += 1; } while (n < 10);
  eq(n, 10, 'цикл с условием окончания при n = 1');
  eq(steps, 3, 'итераций цикла с условием окончания');
  ALGO.push(num({
    d: 'intermediate', cog: 'apply', lesson: 'alg-08-until', topic: A_LOOP, sub: 'Число итераций',
    elem: 1.5, subject: 'inf-8-algo-loops', base: 10, dec: n, key: String(n),
    prompt: 'Цикл с условием окончания: нц | n := n + 3 | пока n < 10 | кц. При n = 1 чему равно n после выхода из цикла? Запишите только число.',
    why: '1 → 4 → 7 → 10. При n = 10 условие «10 < 10» ложно, и цикл заканчивается',
  }));
}
ALGO.push(mt({
  d: 'advanced', cog: 'analyze', lesson: 'alg-08-until', topic: A_LOOP, sub: 'Виды циклов',
  elem: 1.5, subject: 'inf-8-algo-loops', meta: 'self-control',
  left: ['«Пока в очереди есть люди»', '«Пока не выучили таблицу»', '«Повторить 5 раз»'],
  right: ['Условие продолжения', 'Условие окончания', 'Заданное число повторений'],
  map: [
    ['«Пока в очереди есть люди»', 'Условие продолжения'],
    ['«Пока не выучили таблицу»', 'Условие окончания'],
    ['«Повторить 5 раз»', 'Заданное число повторений'],
  ],
  prompt: 'Установите соответствие: ситуация — вид цикла.',
  why: '«Пока есть люди» — работаем, пока условие истинно; «пока не выучили» — пока условие ложно; «повторить 5 раз» — счётчик повторений',
}));
// --- КТП 23: alg-09-for (1/1/1; advanced — в банке кода) ---
{
  const v = range(1, 5).length;
  eq(v, 4, 'длина range(1, 5)');
  ALGO.push(num({
    d: 'basic', cog: 'remember', lesson: 'alg-09-for', topic: A_LOOP, sub: 'Границы range',
    elem: 1.5, subject: 'inf-8-algo-loops', base: 10, dec: v, key: String(v),
    prompt: 'Сколько чисел содержит range(1, 5) в Python? Запишите только число.',
    why: 'Правая граница не входит: range(1, 5) даёт 1, 2, 3, 4 — четыре числа',
  }));
}
{
  const want = [2, 4, 6, 8];
  const variants = [range(2, 10, 2), range(2, 8), range(2, 8, 2), range(8, 1, -2)];
  const found = variants.filter((v) => v.join(',') === want.join(','));
  eq(found.length, 1, 'однозначность правильного range');
  ALGO.push(sc({
    d: 'intermediate', cog: 'apply', lesson: 'alg-09-for', topic: A_LOOP, sub: 'Шаг range',
    elem: 1.5, subject: 'inf-8-algo-loops',
    prompt: 'Какой вызов range даёт числа 2, 4, 6, 8?',
    opts: ['range(2, 10, 2)', 'range(2, 8)', 'range(2, 8, 2)', 'range(8, 2, -2)'], correct: 0,
    why: 'Начало 2, шаг 2, а правая граница не входит — чтобы дойти до 8, её надо взять равной 10',
  }));
}
// --- КТП 24: alg-10-pr-branching (1/1/1; advanced — в банке кода) ---
{
  let n = 100; let k = 0;
  while (n > 0) { n = Math.floor(n / 10); k += 1; }
  eq(k, 3, 'цифр в числе 100');
  ALGO.push(num({
    d: 'basic', cog: 'apply', lesson: 'alg-10-pr-branching', topic: A_LOOP, sub: 'Цикл с условием продолжения',
    elem: 1.5, subject: 'inf-8-algo-loops', base: 10, dec: k, key: String(k),
    prompt: 'Алгоритм подсчёта цифр: нц пока n > 0 | n := n : 10 | k := k + 1 | кц. Сколько цифр в числе 100? Запишите только число.',
    why: '100 → 10 → 1 → 0: три шага тела цикла',
  }));
}
{
  const out = range(0, 3).map((i) => String(i * 2));
  eq(out.join(' '), '0 2 4', 'вывод for i in range(3): print(i * 2)');
  ALGO.push(sc({
    d: 'intermediate', cog: 'apply', lesson: 'alg-10-pr-branching', topic: A_LOOP, sub: 'for и вывод',
    elem: 1.5, subject: 'inf-8-algo-loops',
    prompt: 'Что выведет программа for i in range(3): print(i * 2)? (каждое число — с новой строки)',
    opts: ['0 2 4', '1 3 5', '0 2 4 6', '2 4 6'], correct: 0,
    why: 'range(3) даёт 0, 1, 2, поэтому печатаются 0, 2 и 4 — по одному числу в строке',
  }));
}
// --- КТП 25: alg-11-design (1/1/1; advanced — в банке кода) ---
ALGO.push(sc({
  d: 'basic', cog: 'apply', lesson: 'alg-11-design', topic: A_DESIGN, sub: 'Выбор конструкций',
  elem: 1.5, subject: 'inf-8-algo-design',
  prompt: 'Какие конструкции нужны для задачи «посчитать количество чётных чисел от 1 до n»?',
  opts: ['Только цикл for', 'Только ветвление', 'Цикл for и ветвление', 'Только цикл с условием окончания'], correct: 2,
  why: 'for перебирает числа от 1 до n, а ветвление отбирает из них те, что делятся на 2 без остатка',
}));
{
  const v = range(1, 11).filter((i) => i % 2 === 0).length;
  eq(v, 5, 'чётных чисел от 1 до 10');
  ALGO.push(num({
    d: 'intermediate', cog: 'apply', lesson: 'alg-11-design', topic: A_DESIGN, sub: 'Проверка на данных',
    elem: 1.5, subject: 'inf-8-algo-design', base: 10, dec: v, key: String(v),
    prompt: 'Программа перебирает числа от 1 до 10 и считает те, что делятся на 2 без остатка. Что она выведет? Запишите только число.',
    why: 'Чётные числа 2, 4, 6, 8, 10 — всего пять',
  }));
}
// --- КТП 26: py-09-linear-pr (1/1/1; advanced — в банке кода) ---
{
  const v = 2024 % 100;
  eq(v, 24, '2024 % 100');
  ALGO.push(num({
    d: 'basic', cog: 'remember', lesson: 'py-09-linear-pr', topic: PY_EXPR, sub: 'Последние две цифры',
    elem: 1.5, subject: 'inf-8-py-expr', base: 10, dec: v, key: String(v),
    prompt: 'Что выведет print(2024 % 100)? Запишите только число.',
    why: 'Остаток от деления на 100 — это последние две цифры числа: 24',
  }));
}
{
  const n = 13, y = 5;
  const qq = Math.floor(n / y), r = n % y;
  eq(qq, 2, '13 // 5');
  eq(r, 3, '13 % 5');
  const v = qq * y + r;
  eq(v, n, 'проверка q · y + r = n');
  ALGO.push(num({
    d: 'intermediate', cog: 'apply', lesson: 'py-09-linear-pr', topic: PY_EXPR, sub: 'Проверка результата',
    elem: 1.5, subject: 'inf-8-py-expr', meta: 'self-control', base: 10, dec: v, key: String(v),
    prompt: 'Для числа 13 частное q = 13 : 5 = 2, остаток r = 13 % 5 = 3. Чему равно q · 5 + r? Запишите только число.',
    why: '2 · 5 + 3 = 13 — так проверяют деление с остатком',
  }));
}
// --- КТП 27: py-02-branching (0/0/1; целиком в банке кода) ---
// --- КТП 28: py-07-condition (1/1/1; intermediate и advanced — в банке кода) ---
ALGO.push(sc({
  d: 'basic', cog: 'remember', lesson: 'py-07-condition', topic: PY_IF, sub: 'Полная форма',
  elem: 1.5, subject: 'inf-8-py-if',
  prompt: 'Что выведет код x = 5; if x > 3: print(\'да\') else: print(\'нет\')?',
  opts: ['да', 'нет', 'ничего не выведется', 'Ошибка выполнения'], correct: 0,
  why: '5 > 3 истинно, поэтому выполняется ветка «то» и выводится «да»; ветка «иначе» пропускается',
}));
// --- КТП 29: py-03-loops (1 basic / 0 intermediate / 0 advanced) ---
ALGO.push(sc({
  d: 'basic', cog: 'remember', lesson: 'py-03-loops', topic: PY_WHILE, sub: 'Целая часть',
  elem: 1.5, subject: 'inf-8-py-while',
  prompt: 'Как в Python отбросить последнюю цифру целого числа n?',
  opts: ['n / 10', 'n // 10', 'n % 10', 'n ** 10'], correct: 1,
  why: '// даёт целую часть от деления (то есть число без последней цифры), / даёт дробь, % даёт саму цифру',
}));
// --- КТП 30: ss-30-control (1/1/1; intermediate — в банке кода) ---
{
  const v = parseInt(bin(40), 2);
  eq(v, 40, '40₁₀ в двоичной');
  ALGO.push(num({
    d: 'basic', cog: 'apply', lesson: 'ss-30-control', topic: PY_CTRL, sub: 'Перевод 10->2',
    req: 1.2, elem: 1.3, subject: 'inf-8-numsys-convert', base: 2, dec: v, key: bin(40),
    prompt: 'Переведите число 40₁₀ в двоичную систему. Запишите только число.',
    why: '40 = 32 + 8, значит в двоичной это 101000₂',
  }));
}
{
  let s = 0;
  for (let i = 1; i <= 9; i++) if (i % 3 === 0) s += i;
  eq(s, 18, 'сумма чисел, кратных 3, от 1 до 9');
  ALGO.push(num({
    d: 'advanced', cog: 'analyze', lesson: 'ss-30-control', topic: PY_CTRL, sub: 'Цикл и ветвление',
    elem: 1.5, subject: 'inf-8-algo-design', base: 10, dec: s, key: String(s),
    prompt: 'Алгоритм: s := 0; для i от 1 до 9: если i делится на 3, то s := s + i. Чему равен s? Запишите только число.',
    why: 'Суммируются 3, 6 и 9: s = 3 + 6 + 9 = 18',
  }));
}
// --- КТП 31: py-10-for-loops (1/1/1; intermediate и advanced — в банке кода) ---
{
  const v = fact(4);
  eq(v, 24, '4!');
  ALGO.push(num({
    d: 'basic', cog: 'remember', lesson: 'py-10-for-loops', topic: PY_FOR, sub: 'Факториал',
    elem: 1.5, subject: 'inf-8-py-for', base: 10, dec: v, key: String(v),
    prompt: 'Чему равен факториал 4! = 1 · 2 · 3 · 4? Запишите только число.',
    why: '1 · 2 = 2, 2 · 3 = 6, 6 · 4 = 24',
  }));
}
// --- КТП 32: py-11-for-loops-2 (1/1/1; advanced — в банке кода) ---
{
  const v = range(1, 11).filter((i) => i % 3 === 0).length;
  eq(v, 3, 'кратных 3 от 1 до 10');
  ALGO.push(num({
    d: 'basic', cog: 'remember', lesson: 'py-11-for-loops-2', topic: PY_FOR, sub: 'Счётчик внутри цикла',
    elem: 1.5, subject: 'inf-8-py-for', base: 10, dec: v, key: String(v),
    prompt: 'Сколько чисел от 1 до 10 делятся на 3 без остатка? Запишите только число.',
    why: 'Это числа 3, 6 и 9 — всего три',
  }));
}
{
  const v = range(0, 3).length * range(0, 2).length;
  eq(v, 6, 'вложенный цикл 3 × 2');
  ALGO.push(num({
    d: 'intermediate', cog: 'apply', lesson: 'py-11-for-loops-2', topic: PY_FOR, sub: 'Вложенные циклы',
    elem: 1.5, subject: 'inf-8-py-for', base: 10, dec: v, key: String(v),
    prompt: 'Вложенный цикл: для i от 0 до 2, внутри — для j от 0 до 1, в теле вывод. Сколько раз выполнится тело внешнего цикла вместе со всеми прогонами внутреннего? Запишите только число.',
    why: 'У i три значения, у j два, поэтому тело внешнего цикла выполнится 3 · 2 = 6 раз',
  }));
}
// --- КТП 34: py-08-strings-2 (1/1/1; advanced — в банке кода) ---
ALGO.push(sc({
  d: 'basic', cog: 'remember', lesson: 'py-08-strings-2', topic: PY_STR, sub: 'Сравнение строк',
  elem: 1.5, subject: 'inf-8-py-str',
  prompt: 'Что выведет print(\'10\' < \'9\')?',
  opts: ['True', 'False', 'Ошибку', 'Ничего'], correct: 0,
  why: 'Строки сравниваются посимвольно по кодам символов: \'1\' < \'9\', поэтому True, хотя как числа 10 больше 9',
}));
{
  const v = 'информатика'.indexOf('мат');
  eq(v, 5, "find('мат') в слове 'информатика'");
  ALGO.push(num({
    d: 'intermediate', cog: 'apply', lesson: 'py-08-strings-2', topic: PY_STR, sub: 'Поиск подстроки',
    elem: 1.5, subject: 'inf-8-py-str', base: 10, dec: v, key: String(v),
    prompt: 'Какой индекс вернёт выражение \'информатика\'.find(\'мат\')? Запишите только число.',
    why: 'Подстрока \'мат\' начинается с пятого символа при нумерации с нуля: 0 — и, 1 — н, 2 — ф, 3 — о, 4 — р, 5 — м',
  }));
}
// --- КТП 35: algo-01-results (1/1/1) ---
ALGO.push(sc({
  d: 'basic', cog: 'remember', lesson: 'algo-01-results', topic: A_ANALYSIS, sub: 'Число результатов',
  elem: 1.5, subject: 'inf-8-algo-analysis',
  prompt: 'Сколько различных результатов может дать ветвление с одним условием (две ветки)?',
  opts: ['Не больше двух', 'Ровно один', 'Четыре', 'Столько, сколько входных данных'], correct: 0,
  why: 'Каждая ветка даёт свой результат, а условие одно — значит путей два и результатов не больше двух',
}));
{
  let s = 0;
  for (let i = 1; i <= 5; i++) s += i;
  eq(s, 15, 'сумма чисел от 1 до 5');
  ALGO.push(num({
    d: 'intermediate', cog: 'apply', lesson: 'algo-01-results', topic: A_ANALYSIS, sub: 'Цикл в трассировке',
    elem: 1.5, subject: 'inf-8-algo-analysis', base: 10, dec: s, key: String(s),
    prompt: 'Программа: s := 0; для i от 1 до 5: s := s + i. Чему равен s после цикла? Запишите только число.',
    why: '1 + 2 + 3 + 4 + 5 = 15',
  }));
}
{
  const v = 2 * 2;
  eq(v, 4, 'два независимых ветвления');
  ALGO.push(num({
    d: 'advanced', cog: 'analyze', lesson: 'algo-01-results', topic: A_ANALYSIS, sub: 'Пути в алгоритме',
    elem: 1.5, subject: 'inf-8-algo-analysis', base: 10, dec: v, key: String(v),
    prompt: 'Сколько различных результатов может дать алгоритм с двумя независимыми полными ветвлениями? Запишите только число.',
    why: 'У каждого ветвления два пути, значит всего 2 · 2 = 4 сочетания — столько же разных результатов',
  }));
}
// --- КТП 36: algo-02-inputs (1/1/1) ---
ALGO.push(sc({
  d: 'basic', cog: 'remember', lesson: 'algo-02-inputs', topic: A_ANALYSIS, sub: 'Метод обратной задачи',
  elem: 1.5, subject: 'inf-8-algo-analysis',
  prompt: 'С чего начинается решение обратной задачи — найти входные данные по известному результату?',
  opts: [
    'С результата: определяем последнюю выполненную команду и решаем уравнение назад',
    'С самого начала программы, выполняя её на всех возможных данных',
    'С новой программы, которая делает то же самое',
    'С таблицы истинности',
  ], correct: 0,
  why: 'Идём от результата: находим последнюю команду, решаем уравнение назад и каждый найденный вход проверяем прямым прогоном',
}));
{
  const run = (x) => (x % 2 === 0 ? x * 2 : x + 1);
  const hits = range(1, 21).filter((x) => run(x) === 10);
  eq(hits.join(','), '9', 'входы, дающие результат 10');
  ALGO.push(sc({
    d: 'intermediate', cog: 'apply', lesson: 'algo-02-inputs', topic: A_ANALYSIS, sub: 'Восстановление входа',
    elem: 1.5, subject: 'inf-8-algo-analysis', meta: 'self-control',
    prompt: 'Программа: если x чётно, то y := x · 2, иначе y := x + 1. Вывод — 10. Каким было x?',
    opts: ['5', '9', '20', '4'], correct: 1,
    why: 'Проверяем все варианты: 5 → 6, 9 → 10 (верно), 20 → 40, 4 → 8. Подходит только 9',
  }));
}
{
  const fits = range(100, 1000).filter((n) => digitSum(n) === 26);
  eq(fits.length, 3, 'трёхзначных чисел с суммой цифр 26');
  eq(fits.join(','), '899,989,998', 'трёхзначные числа с суммой цифр 26');
  ALGO.push(num({
    d: 'advanced', cog: 'analyze', lesson: 'algo-02-inputs', topic: A_ANALYSIS, sub: 'Сумма цифр',
    elem: 1.5, subject: 'inf-8-algo-analysis', meta: 'self-control', base: 10, dec: fits.length, key: String(fits.length),
    prompt: 'Сколько трёхзначных чисел имеют сумму цифр 26? Запишите только число.',
    why: 'Подходят 899, 989 и 998 — всего три числа',
  }));
}

// ═══════════════════ ЗАДАНИЯ С ПРОГРАММОЙ ═══════════════════
// bank-code.yaml, id 018-031. Эталоны проверяются запуском Python ниже.
const CODE = [];
const TOPIC_C = 'Код в тренажёре';

// КТП 15: py-01-basics, advanced
CODE.push(cr({
  d: 'advanced', cog: 'analyze', lesson: 'py-01-basics', topic: TOPIC_C, sub: 'print и повторение строки',
  elem: 1.5, subject: 'inf-8-code-str',
  prompt: 'Выведи треугольник из решёток: в первой строке одна решётка, во второй — три, в третьей — пять.',
  template: '# Решётки строятся умножением строки на число\nfor i in range(3):\n    print(...)',
  solution: "for i in range(3):\n    print('#' * (2 * i + 1))",
  stdout: '#\n###\n#####',
  why: 'Умножение строки на число повторяет её: 1 · 1, 1 · 3 и 1 · 5 символов',
}));
// КТП 17: py-06-linear, advanced
CODE.push(cr({
  d: 'advanced', cog: 'analyze', lesson: 'py-06-linear', topic: TOPIC_C, sub: 'Площадь и периметр',
  elem: 1.5, subject: 'inf-8-code-expr',
  prompt: 'Дан прямоугольник со сторонами 12 и 5. Выведи сначала площадь, затем периметр — каждое число с новой строки.',
  template: '# Прямоугольник 12 × 5\na, b = 12, 5\ns = a * b\np = ...\nprint(s)\nprint(...)',
  solution: 'a, b = 12, 5\ns = a * b\np = 2 * (a + b)\nprint(s)\nprint(p)',
  stdout: '60\n34',
  why: 'Площадь 12 · 5 = 60, периметр 2 · (12 + 5) = 34',
}));
// КТП 23: alg-09-for, advanced
CODE.push(cr({
  d: 'advanced', cog: 'analyze', lesson: 'alg-09-for', topic: TOPIC_C, sub: 'for и range',
  elem: 1.5, subject: 'inf-8-code-loop',
  prompt: 'Выведи числа от 1 до 5 и их квадраты: сначала само число, через пробел — его квадрат.',
  template: '# Квадраты чисел от 1 до 5\nfor i in range(1, 6):\n    print(...)',
  solution: 'for i in range(1, 6):\n    print(i, i * i)',
  stdout: '1 1\n2 4\n3 9\n4 16\n5 25',
  why: 'range(1, 6) даёт числа 1..5, а квадраты считаются умножением i * i',
}));
// КТП 24: alg-10-pr-branching, advanced
CODE.push(cr({
  d: 'advanced', cog: 'analyze', lesson: 'alg-10-pr-branching', topic: TOPIC_C, sub: 'Подсчёт цифр',
  elem: 1.5, subject: 'inf-8-code-while',
  prompt: 'Циклом while посчитай количество цифр в числе 98765 и выведи его.',
  template: '# Число укорачивается на одну цифру за шаг\nn, k = 98765, 0\nwhile n > 0:\n    n = ...\n    k = ...\nprint(k)',
  solution: 'n, k = 98765, 0\nwhile n > 0:\n    n = n // 10\n    k = k + 1\nprint(k)',
  stdout: '5',
  why: '98765 → 9876 → 987 → 98 → 9 → 0: пять шагов тела цикла',
}));
// КТП 25: alg-11-design, advanced
CODE.push(cr({
  d: 'advanced', cog: 'analyze', lesson: 'alg-11-design', topic: TOPIC_C, sub: 'Перебор с проверкой',
  elem: 1.5, subject: 'inf-8-code-loop',
  prompt: 'Посчитай, сколько чисел от 1 до 100 не делится на 7, и выведи результат.',
  template: '# Перебор чисел и проверка делимости\nn = 100\nk = 0\nfor i in range(1, n + 1):\n    if i % 7 ...:\n        k = k + 1\nprint(k)',
  solution: 'n = 100\nk = 0\nfor i in range(1, n + 1):\n    if i % 7 != 0:\n        k = k + 1\nprint(k)',
  stdout: '86',
  why: 'На 7 делятся 14 чисел (7, 14, …, 98), значит не делятся 100 − 14 = 86',
}));
// КТП 26: py-09-linear-pr, advanced
CODE.push(cr({
  d: 'advanced', cog: 'analyze', lesson: 'py-09-linear-pr', topic: TOPIC_C, sub: 'Деление вычитанием',
  elem: 1.5, subject: 'inf-8-code-loop',
  prompt: 'Найди делением вычитанием частное и остаток от деления 13 на 5 и выведи их одной строкой через пробел.',
  template: '# Вычитаем y, пока r не станет меньше y\nx = 13\ny = 5\nr = x\nq = 0\nwhile r >= y:\n    ...\nprint(q, r)',
  solution: 'x = 13\ny = 5\nr = x\nq = 0\nwhile r >= y:\n    r = r - y\n    q = q + 1\nprint(q, r)',
  stdout: '2 3',
  why: '13 − 5 = 8, затем 8 − 5 = 3: частное 2, остаток 3',
}));
// КТП 27: py-02-branching, advanced
CODE.push(cr({
  d: 'advanced', cog: 'analyze', lesson: 'py-02-branching', topic: TOPIC_C, sub: 'Максимум и минимум',
  elem: 1.5, subject: 'inf-8-code-if',
  prompt: 'Найди наибольшее и наименьшее из чисел 12, 4, 19 неполными if (без max и min) и выведи их одной строкой через пробел: сначала максимум, потом минимум.',
  template: '# Четыре неполных ветвления: два на максимум, два на минимум\na, b, c = 12, 4, 19\nmx = a\n...',
  solution: 'a, b, c = 12, 4, 19\nmx = a\nif b > mx:\n    mx = b\nif c > mx:\n    mx = c\nmn = a\nif b < mn:\n    mn = b\nif c < mn:\n    mn = c\nprint(mx, mn)',
  stdout: '19 4',
  why: 'Каждый кандидат сравнивается с текущим чемпионом: в итоге максимум 19, минимум 4',
}));
// КТП 28: py-07-condition, intermediate
CODE.push(cr({
  d: 'intermediate', cog: 'apply', lesson: 'py-07-condition', topic: TOPIC_C, sub: 'Сложное условие',
  elem: 1.5, subject: 'inf-8-code-if',
  prompt: 'Проверь условием «x внутри отрезка [0; 10]», чему равно x = 20, и вывери слово «внутри» или «снаружи».',
  template: '# Полная форма: if / else и связка and\nx = 20\nif x >= 0 and x <= 10:\n    print(\'внутри\')\nelse:\n    print(...)',
  solution: "x = 20\nif x >= 0 and x <= 10:\n    print('внутри')\nelse:\n    print('снаружи')",
  stdout: 'снаружи',
  why: 'Второе сравнение 20 <= 10 ложно, поэтому конъюнкция ложна и выполняется ветка «снаружи»',
}));
// КТП 28: py-07-condition, advanced
CODE.push(cr({
  d: 'advanced', cog: 'analyze', lesson: 'py-07-condition', topic: TOPIC_C, sub: 'Цепочка elif',
  elem: 1.5, subject: 'inf-8-code-if',
  prompt: 'Проверь x = 40 по цепочке условий: больше 100, от 51 до 100, от 11 до 50, не больше 10. Вывери подходящий вариант.',
  template: '# Проверки идут сверху вниз, срабатывает первая подходящая\nx = 40\nif x > 100:\n    print(\'больше 100\')\nelif x > 50:\n    print(\'от 51 до 100\')\nelif x > 10:\n    print(...)\nelse:\n    print(\'не больше 10\')',
  solution: "x = 40\nif x > 100:\n    print('больше 100')\nelif x > 50:\n    print('от 51 до 100')\nelif x > 10:\n    print('от 11 до 50')\nelse:\n    print('не больше 10')",
  stdout: 'от 11 до 50',
  why: 'Условия x > 100 и x > 50 ложны, а x > 10 истинно — срабатывает первое подходящее',
}));
// КТП 30: ss-30-control, intermediate
CODE.push(cr({
  d: 'intermediate', cog: 'apply', lesson: 'ss-30-control', topic: TOPIC_C, sub: 'Цикл и ветвление',
  elem: 1.5, subject: 'inf-8-code-loop',
  prompt: 'Выведи все числа от 1 до 10, которые делятся на 3 без остатка, каждое с новой строки.',
  template: '# Перебор чисел и проверка остатка\nfor i in range(1, 11):\n    if i % 3 == 0:\n        print(...)',
  solution: 'for i in range(1, 11):\n    if i % 3 == 0:\n        print(i)',
  stdout: '3\n6\n9',
  why: 'Из чисел от 1 до 10 на 3 делятся только 3, 6 и 9',
}));
// КТП 31: py-10-for-loops, intermediate
CODE.push(cr({
  d: 'intermediate', cog: 'apply', lesson: 'py-10-for-loops', topic: TOPIC_C, sub: 'Шаг в range',
  elem: 1.5, subject: 'inf-8-code-loop',
  prompt: 'Выведи все чётные числа до 7 включительно, каждое с новой строки (используй шаг в range).',
  template: '# Шаг 2 в range перебирает сразу чётные числа\nn = 7\nfor i in range(2, n + 1, 2):\n    print(i)',
  solution: 'n = 7\nfor i in range(2, n + 1, 2):\n    print(i)',
  stdout: '2\n4\n6',
  why: 'range(2, 8, 2) даёт 2, 4, 6 — а n + 1 нужно, чтобы включить само n',
}));
// КТП 31: py-10-for-loops, advanced
CODE.push(cr({
  d: 'advanced', cog: 'analyze', lesson: 'py-10-for-loops', topic: TOPIC_C, sub: 'Факториал',
  elem: 1.5, subject: 'inf-8-code-loop',
  prompt: 'Найди циклом for факториал 5! и выведи его.',
  template: '# Факториал: произведение чисел от 1 до n\nn = 5\nf = 1\nfor i in range(1, n + 1):\n    f = ...\nprint(f)',
  solution: 'n = 5\nf = 1\nfor i in range(1, n + 1):\n    f = f * i\nprint(f)',
  stdout: '120',
  why: '5! = 1 · 2 · 3 · 4 · 5 = 120',
}));
// КТП 32: py-11-for-loops-2, advanced
CODE.push(cr({
  d: 'advanced', cog: 'analyze', lesson: 'py-11-for-loops-2', topic: TOPIC_C, sub: 'Делители числа',
  elem: 1.5, subject: 'inf-8-code-loop',
  prompt: 'Выведи все делители числа 12 (без остатка), каждый с новой строки.',
  template: '# Проверяем делимость каждого числа от 1 до n\nn = 12\nfor i in range(1, n + 1):\n    if n % i == 0:\n        print(...)',
  solution: 'n = 12\nfor i in range(1, n + 1):\n    if n % i == 0:\n        print(i)',
  stdout: '1\n2\n3\n4\n6\n12',
  why: '12 делится без остатка на 1, 2, 3, 4, 6 и 12 — других делителей нет',
}));
// КТП 34: py-08-strings-2, advanced
CODE.push(cr({
  d: 'advanced', cog: 'analyze', lesson: 'py-08-strings-2', topic: TOPIC_C, sub: 'Разворот строки',
  elem: 1.5, subject: 'inf-8-code-str',
  prompt: 'Разверни строку \'Python\' срезом s[::-1] и выведи разворот и его длину одной строкой через пробел.',
  template: '# Срез с шагом −1 читает строку с конца\ns = \'Python\'\nb = s[::-1]\nprint(b, len(...))',
  solution: "s = 'Python'\nb = s[::-1]\nprint(b, len(b))",
  stdout: 'nohtyP 6',
  why: 'Срез s[::-1] даёт nohtyP, длина строки равна 6 символам',
}));

// ═══════════════════════ проверка code_run ═══════════════════════
let codeChecked = 0;
for (const t of CODE) {
  const got = normOut(runPython(t.solution));
  eq(got, normOut(t.stdout), `code_run ${t.sub} (урок ${t.lesson}): вывод эталона`);
  t.checked = true;
  codeChecked += 1;
}

// ═══════════════════════ план tmp/plan-8.txt ═══════════════════════
// урок -> сколько дописать: [basic, intermediate, advanced]
const PLAN = {
  'numsys-01-intro': [0, 1, 1],
  'numsys-02-binary': [0, 0, 1],
  'numsys-03-octal': [0, 0, 1],
  'numsys-04-hex': [0, 0, 1],
  'numsys-05-arith': [0, 0, 1],
  'numsys-06-review': [1, 1, 0],
  'logic-01-utterances': [0, 1, 1],
  'logic-02-operations': [0, 0, 1],
  'logic-05-expression': [1, 1, 1],
  'logic-06-laws': [1, 1, 1],
  'logic-04-elements': [1, 1, 0],
  'alg-01-performers': [0, 0, 1],
  'alg-02-notation': [0, 0, 1],
  'py-01-basics': [0, 1, 1],
  'py-05-data': [1, 1, 1],
  'py-06-linear': [1, 1, 1],
  'alg-05-sequence': [1, 1, 1],
  'alg-03-branching': [0, 0, 1],
  'alg-06-branching-short': [1, 1, 1],
  'alg-07-while': [0, 0, 1],
  'alg-08-until': [1, 1, 1],
  'alg-09-for': [1, 1, 1],
  'alg-10-pr-branching': [1, 1, 1],
  'alg-11-design': [1, 1, 1],
  'py-09-linear-pr': [1, 1, 1],
  'py-02-branching': [0, 0, 1],
  'py-07-condition': [1, 1, 1],
  'py-03-loops': [1, 0, 0],
  'ss-30-control': [1, 1, 1],
  'py-10-for-loops': [1, 1, 1],
  'py-11-for-loops-2': [1, 1, 1],
  'py-08-strings-2': [1, 1, 1],
  'algo-01-results': [1, 1, 1],
  'algo-02-inputs': [1, 1, 1],
};
const IDX = { basic: 0, intermediate: 1, advanced: 2 };

// ═══════════════════════════ сериализация ═══════════════════════════
function yamlTask(t) {
  // topic/subtopic цитируются всегда: без кавычек значение с двоеточием
  // («Трассировка: цепочка присваиваний») YAML принимает за вложенный маппинг.
  const L = [`- id: ${t.id}`, '  class: 8', `  topic: ${q(t.topic)}`, `  subtopic: ${q(t.subtopic)}`,
    `  type: ${t.kind}`, `  difficulty: ${t.difficulty}`, `  cognitive_level: ${t.cognitive_level}`,
    `  points: ${t.points}`, `  lesson: ${t.lesson}`, `  fgos_requirement: ${t.fgos_requirement}`,
    `  fgos_element: ${t.fgos_element}`,
    `  fgos: { subject: [${t.fgos.subject.join(', ')}], meta: [${t.fgos.meta.join(', ')}] }`,
    `  prompt: ${q(t.prompt)}`];
  if (t.kind === 'numeric_base') {
    L.push(`  student_view: { base: ${t.base}, placeholder: "только число" }`);
    L.push(`  auto_check: { method: numeric_base, base: ${t.base}, strip_affixes: true }`);
    L.push(`  teacher_only: { accepted_values_decimal: [${t.dec}], answer_text: ${q(t.key)}, explanation: ${q(t.why)} }`);
  } else if (t.kind === 'single_choice') {
    const opts = t.opts.map((text, i) => `{ id: ${'ABCD'[i]}, text: ${q(text)} }`).join(', ');
    L.push(`  student_view: { options: [${opts}] }`);
    L.push('  auto_check: { method: exact_option }');
    L.push(`  teacher_only: { answer: ${'ABCD'[t.correct]}, explanation: ${q(t.why)} }`);
  } else if (t.kind === 'matching') {
    L.push(`  student_view: { left: [${t.left.map(q).join(', ')}], right: [${t.right.map(q).join(', ')}] }`);
    L.push('  auto_check: { method: matching, partial: proportional }');
    const map = t.map.map(([k, v]) => `${q(k)}: ${q(v)}`).join(', ');
    L.push(`  teacher_only: { answer_map: { ${map} }, explanation: ${q(t.why)} }`);
  } else {
    L.push('  student_view:', '    language: python', `    template: ${q(t.template)}`);
    L.push('  auto_check: { method: code_stdout, timeout_s: 10 }');
    L.push('  teacher_only:', `    solution_code: ${q(t.solution)}`, `    expected_stdout: ${q(t.stdout)}`,
      `    explanation: ${q(t.why)}`);
  }
  return L.join('\n');
}

/** Дописывает недостающие блоки в конец банка; уже дописанное не трогает. */
function appendTo(file, prefix, start, tasks) {
  const raw = readFileSync(file, 'utf-8');
  const existing = [...raw.matchAll(/^- id:\s*(\S+)\s*$/gm)].map((m) => m[1]);
  const mine = new Set(tasks.map((t) => t.id));
  assert(mine.size === tasks.length, `${file}: в генераторе повторяются id`);
  // Новые id не должны налезать на уже существующие.
  for (const id of existing) {
    if (mine.has(id)) continue;
    const n = Number(id.slice(prefix.length));
    assert(Number.isFinite(n) && n < start, `${file}: существующий id ${id} занимает место новых заданий (начинаем с ${prefix}${start})`);
  }
  const fresh = tasks.filter((t) => !existing.includes(t.id));
  if (!fresh.length) {
    console.log(`  ${file}: новых нет, все ${tasks.length} заданий уже в банке`);
    return 0;
  }
  const body = `${raw.trimEnd()}\n\n${fresh.map(yamlTask).join('\n\n')}\n`;
  writeFileSync(file, body, 'utf-8');
  console.log(`  ${file}: дописано ${fresh.length} (${prefix}${String(start).padStart(3, '0')}-${prefix}${String(start + fresh.length - 1).padStart(3, '0')})`);
  return fresh.length;
}

// ═══════════════════════════ сборка ═══════════════════════════
const BANKS = [
  { file: 'data/tasks/8/number-systems/bank-gen.yaml', prefix: 'inf-8-numsys-', start: 66, tasks: numsys },
  { file: 'data/tasks/8/logic/bank-logic.yaml', prefix: 'inf-8-logic-', start: 20, tasks: LOG },
  { file: 'data/tasks/8/algorithms/bank-algo.yaml', prefix: 'inf-8-algo-', start: 21, tasks: ALGO },
  { file: 'data/tasks/8/code-run/bank-code.yaml', prefix: 'inf-8-code-', start: 18, tasks: CODE },
];

// Сверка с планом ДО записи: ровно то, что в tmp/plan-8.txt.
const got = new Map(Object.keys(PLAN).map((l) => [l, [0, 0, 0]]));
for (const b of BANKS) {
  for (const t of b.tasks) {
    assert(got.has(t.lesson), `урок ${t.lesson} есть в плане, а в задании — нет`);
    got.get(t.lesson)[IDX[t.difficulty]] += 1;
  }
}
let planTotal = 0;
for (const [lesson, want] of Object.entries(PLAN)) {
  const have = got.get(lesson);
  planTotal += want[0] + want[1] + want[2];
  eq(have.join('/'), want.join('/'), `урок ${lesson}: сложности не совпали с планом`);
}
const allTasks = BANKS.flatMap((b) => b.tasks);
eq(allTasks.length, planTotal, 'всего заданий против плана');

console.log('ДОПИСЫВАЮ В БАНКИ 8 КЛАССА:');
let written = 0;
for (const b of BANKS) {
  b.tasks.forEach((t, i) => { t.id = `${b.prefix}${String(b.start + i).padStart(3, '0')}`; });
  written += appendTo(b.file, b.prefix, b.start, b.tasks);
}

// Итоги.
const byDiff = { basic: 0, intermediate: 0, advanced: 0 };
for (const t of allTasks) byDiff[t.difficulty] += 1;
const byKind = {};
for (const t of allTasks) byKind[t.kind] = (byKind[t.kind] ?? 0) + 1;
console.log(`\nВсего новых заданий: ${allTasks.length} (план: ${planTotal})`);
console.log(`Сложности: basic ${byDiff.basic}, intermediate ${byDiff.intermediate}, advanced ${byDiff.advanced}`);
console.log(`Типы: ${Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`Эталоны code_run проверены запуском ${PY ?? '—'}: ${codeChecked} из ${CODE.length}`);
console.log(`Записано в банки: ${written} заданий${written === 0 ? ' (повторный запуск — файлы не изменены)' : ''}`);