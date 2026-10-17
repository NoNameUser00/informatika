// Дописывает банк заданий 8 класса «Системы счисления» (data/tasks/8/number-systems/bank-gen.yaml):
// 17 заданий по квотам tmp/need-8-numsys3.txt.
//
// Устройство как в scripts/make-8-bank2.mjs:
//   * ответы НЕ пишутся руками — считаются кодом и сверяются на месте;
//   * переводы систем счисления считаются через toString/parseInt и перебором разрядов;
//   * двоичная арифметика моделируется поразрядно (как столбик в тетради);
//   * эталон code_run прогоняется локальным Python — expected_stdout берётся из реального вывода;
//   * в single_choice правильный вариант задаётся ТЕКСТОМ, буква находится кодом;
//   * ключи numeric_base дополнительно принимаются checker'ом src/lib/scoring/check.mjs;
//   * topic и subtopic всегда цитируются (значение с двоеточием ломает YAML);
//   * запись идемпотентна: блок режется по маркеру MARK и пишется заново.
//
// Нумерация id: собраны id из ОБОИХ банков системы счисления (bank.yaml + bank-gen.yaml)
// и из bank-code.yaml — максимум + 1, каждый новый id проверяется на совпадение.
//
// Запуск: node scripts/make-8-numsys-bank3.mjs
// Проверка: node scripts/validate-bank data/tasks/8/number-systems/bank.yaml data/tasks/8/number-systems/bank-gen.yaml
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { checkNumericBase, checkMatching } from '../src/lib/scoring/check.mjs';

const MARK = '# ==== СГЕНЕРИРОВАНО scripts/make-8-numsys-bank3.mjs ====';

const BANK = { file: 'data/tasks/8/number-systems/bank-gen.yaml', prefix: 'inf-8-numsys-' };

// Все банки 8 класса — чтобы новый id не совпал с уже занятым (в том числе в соседнем bank.yaml).
const ALL_8_BANKS = [
  'data/tasks/8/number-systems/bank.yaml',
  'data/tasks/8/number-systems/bank-gen.yaml',
  'data/tasks/8/code-run/bank-code.yaml',
];

// Квота: урок -> [basic, intermediate, advanced]. Сумма = 17.
const QUOTA = {
  'numsys-01-intro': [0, 3, 1],
  'numsys-02-binary': [0, 3, 1],
  'numsys-05-arith': [3, 0, 0],
  'numsys-06-review': [4, 2, 0],
};
const QUOTA_TOTAL = Object.values(QUOTA).reduce((s, v) => s + v[0] + v[1] + v[2], 0);
if (QUOTA_TOTAL !== 17) throw new Error(`квота даёт ${QUOTA_TOTAL}, а нужно 17`);

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

/** Строка в двойных кавычках для YAML. Именно JSON.stringify, а не ручная замена:
 *  переводы строк внутри многострочных полей (template, explanation) должны попасть в YAML
 *  как escape \n — иначе скаляр разрывается и файл не парсится. */
const q = (s) => JSON.stringify(String(s));
const LETTERS = 'ABCD';
const list = (a) => a.join(', ');
/** Перечисление по-русски: 1, 2 и 3 — так читается в объяснении. */
const ruList = (a) => (a.length < 2 ? list(a) : `${list(a.slice(0, -1))} и ${a[a.length - 1]}`);
const POINTS = { basic: 1, intermediate: 2, advanced: 3 };
const COG = { basic: 'remember', intermediate: 'apply', advanced: 'analyze' };

// Тема — как в соседних заданиях банка.
const T_SS = 'Системы счисления';

// Требования и элементы ФРП — как у соседей по теме (1.1/1.1 и 1.2/1.3 для переводов,
// 1.2/1.4 для арифметики в системе счисления).
const F = {
  represent: { req: 1.1, el: 1.1, subj: 'inf-8-numsys-represent' },
  convert: { req: 1.2, el: 1.3, subj: 'inf-8-numsys-convert' },
  arith: { req: 1.2, el: 1.4, subj: 'inf-8-numsys-arith' },
};

// ───────────────────────── вычисления ─────────────────────────
const b2 = (n) => n.toString(2);
const o8 = (n) => n.toString(8);
const h16 = (n) => n.toString(16).toUpperCase();
const d = (s, base) => parseInt(s, base);

/** Число цифр записи n в системе с основанием base (перебор делением). */
function digitsInBase(n, base) {
  let k = 0;
  let m = n;
  do {
    k += 1;
    m = Math.floor(m / base);
  } while (m > 0);
  return k;
}

/** Двоичная запись n, собранная разложением на степени двойки (как в тетради). */
function byPowersOfTwo(n) {
  const powers = [];
  let p = 1;
  while (p <= n) {
    powers.push(p);
    p *= 2;
  }
  let rem = n;
  const digits = [];
  for (const w of powers.reverse()) {
    const bit = rem >= w ? 1 : 0;
    digits.push(bit);
    if (bit) rem -= w;
  }
  eq(rem, 0, `разложение на степени двойки для ${n} не сошлось`);
  return digits.join('');
}

/** Наибольшее число, которое помещается в n разрядов системы с основанием base. */
const maxInDigits = (base, n) => base ** n - 1;

/** Сложение двоичных чисел столбиком: возвращает { sum, carryBits }. */
function binAdd(aStr, bStr) {
  eq(aStr.length, bStr.length, `в сложении ${aStr}₂ + ${bStr}₂ разряды выровнены по длине`);
  let carry = 0;
  let sum = '';
  const carries = [];
  for (let i = aStr.length - 1; i >= 0; i--) {
    const t = Number(aStr[i]) + Number(bStr[i]) + carry;
    sum = String(t % 2) + sum;
    carry = Math.floor(t / 2);
    carries.unshift(t);
  }
  if (carry) sum = String(carry) + sum;
  return { sum, carries };
}

/** Перебор: двоичные записи длиной len ровно с ones единицами. */
function masksWithOnes(len, ones) {
  const out = [];
  for (let mask = 0; mask < 2 ** len; mask++) {
    const s = mask.toString(2).padStart(len, '0');
    if ([...s].filter((c) => c === '1').length === ones) out.push(s);
  }
  return out;
}

// ───────────────────── локальный Python (эталон) ─────────────────────
const PY = ['python3', 'python'].find((cmd) => {
  try { execFileSync(cmd, ['-c', 'pass'], { stdio: 'ignore' }); return true; } catch { return false; }
});
function pyRun(code) {
  if (!PY) throw new Error('локальный Python не найден (нужен python3 или python в PATH)');
  return execFileSync(PY, ['-c', code], {
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    timeout: 20000,
  }).replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

// ───────────────────── конструкторы заданий ─────────────────────
const state = [];

function push(o) {
  const points = POINTS[o.diff];
  if (!points) throw new Error(`неизвестная сложность: ${o.diff}`);
  // cognitive_level строго по сложности: basic -> remember, intermediate -> apply, advanced -> analyze.
  const cog = o.cog ?? COG[o.diff];
  eq(cog, COG[o.diff], `${o.lesson}: cognitive_level для ${o.diff}`);
  if (!(o.lesson in QUOTA)) throw new Error(`урока нет в квотах: ${o.lesson}`);
  if (String(o.topic).includes(':')) throw new Error(`двоеточие в topic: ${o.topic}`);
  if (String(o.sub).includes(':')) throw new Error(`двоеточие в subtopic: ${o.sub}`);
  if (!String(o.prompt).trim()) throw new Error(`${o.lesson}: пустой вопрос`);
  if (!o.why) throw new Error(`${o.lesson}: нет explanation`);
  if (!o.f || !o.f.subj) throw new Error(`${o.lesson}: не передан fgos-профиль (f)`);
  state.push({ ...o, cog, points });
}

/**
 * numeric_base: значение считает calc(), ключ — по нему же (или авторский, если задан),
 * тогда ключ обязан совпасть. Приём ключа проверяется тем же checker'ом, что и в trainer.
 */
function nb(o) {
  const value = o.calc();
  ok(Number.isInteger(value), `${o.lesson}: ответ не целый — ${value}`);
  const base = o.base ?? 10;
  const key = o.key ?? (base === 10 ? String(value) : value.toString(base));
  eq(d(String(key).toUpperCase(), base), value, `${o.lesson}: ключ «${key}» не даёт ${value} в основании ${base}`);
  const r = checkNumericBase(value, key, base);
  ok(r.isCorrect, `${o.lesson}: check.mjs не принял ключ «${key}» для ${value} в основании ${base}`);
  push({
    ...o, type: 'numeric_base',
    sv: `{ base: ${base}, placeholder: "только число" }`,
    ac: `{ method: numeric_base, base: ${base}, strip_affixes: true }`,
    to: `{ accepted_values_decimal: [${value}], answer_text: ${q(key)}, explanation: ${q(o.why)} }`,
  });
}

/** single_choice: правильный вариант задаётся ТЕКСТОМ, буква находится кодом. */
function sc(o) {
  const texts = o.opts.map(String);
  ok(texts.length >= 2 && texts.length <= 4, `${o.lesson}: вариантов ${texts.length} (нужно 2–4)`);
  eq(new Set(texts).size, texts.length, `${o.lesson}: варианты повторяются`);
  const i = texts.indexOf(String(o.correct));
  ok(i >= 0, `${o.lesson}: правильного варианта «${o.correct}» нет среди ${JSON.stringify(texts)}`);
  push({
    ...o, type: 'single_choice',
    sv: `{ options: [${texts.map((t, k) => `{ id: ${LETTERS[k]}, text: ${q(t)} }`).join(', ')}] }`,
    ac: '{ method: exact_option }',
    to: `{ answer: ${LETTERS[i]}, explanation: ${q(o.why)} }`,
  });
}

/** matching: карта собирается из левого столбца, полный балл проверяется check.mjs. */
function mat(o) {
  const left = o.left.map(String);
  ok(left.length >= 1, `${o.lesson}: пустой столбец слева`);
  eq(new Set(left).size, left.length, `${o.lesson}: левый столбец с повторами`);
  const vals = left.map((k) => {
    ok(k in o.map, `${o.lesson}: нет ответа для «${k}»`);
    return String(o.map[k]);
  });
  eq(new Set(vals).size, vals.length, `${o.lesson}: правый столбец с повторами — соответствие неоднозначно`);
  for (const v of vals) ok(o.right.includes(v), `${o.lesson}: ответ «${v}» нет среди правых вариантов`);
  const r = checkMatching(o.map, Object.fromEntries(left.map((k, i) => [k, vals[i]])), POINTS[o.diff]);
  ok(r.isCorrect && r.score === POINTS[o.diff], `${o.lesson}: соответствие не сходится (${r.score} из ${POINTS[o.diff]})`);
  push({
    ...o, type: 'matching',
    sv: `{ left: [${left.map(q).join(', ')}], right: [${o.right.map(q).join(', ')}] }`,
    ac: '{ method: matching, partial: proportional }',
    to: `{ answer_map: { ${left.map((k, i) => `${q(k)}: ${q(vals[i])}`).join(', ')} }, explanation: ${q(o.why)} }`,
  });
}

/** code_run: эталон реально выполняется локальным Python, expected_stdout — его вывод. */
function cr(o) {
  const outp = pyRun(o.solution);
  ok(outp.length > 0, `${o.lesson}: эталон ничего не вывел`);
  if (o.expected !== undefined) eq(outp, o.expected, `${o.lesson}: эталон не сошёлся`);
  push({
    ...o, type: 'code_run',
    sv: `{ language: python, template: ${q(o.template)} }`,
    ac: '{ method: code_stdout, timeout_s: 10 }',
    to: `{ solution_code: ${q(o.solution)}, expected_stdout: ${q(outp)}, explanation: ${q(o.why)} }`,
  });
}

// ═════════════ КТП 1 · numsys-01-intro · позиционная система и алфавит (0/3/1) ═════════════

// Разряд и его вес: вес разряда — степень основания, считается справа налево.
{
  const base = 3;
  const n = 5;
  const pos = 3; // третий разряд слева
  const weights = Array.from({ length: n }, (_, i) => base ** (n - 1 - i));
  eq(weights.join(', '), '81, 27, 9, 3, 1', 'веса разрядов троичной системы');
  const weight = weights[pos - 1];
  eq(weight, 9, 'вес третьего разряда слева в троичной системе');
  eq(weight, base ** (n - pos), 'вес равен степени основания');
  nb({
    lesson: 'numsys-01-intro', topic: T_SS, sub: 'Вес разряда', diff: 'intermediate', f: F.represent,
    calc: () => weight,
    prompt: `Число записано в системе счисления с основанием ${base} пятью разрядами. Чему равен вес третьего разряда слева? Запишите только число.`,
    why: `Вес разряда — это степень основания, а считают веса справа налево: у пятиразрядной записи в системе с основанием ${base} это ${list(weights)}. Третий разряд слева — это ${base} в степени ${n - pos}, то есть ${base}^${n - pos} = ${weight}. При переходе на разряд вправо вес всегда уменьшается в ${base} раз, а младший разряд весит 1.`,
  });
}

// Соответствие «длина записи — наибольшее число в ней».
{
  const specs = [
    { base: 2, n: 4, sub: '₂' },
    { base: 8, n: 3, sub: '₈' },
    { base: 16, n: 2, sub: '₁₆' },
    { base: 10, n: 5, sub: '₁₀' },
  ];
  const maxes = specs.map((s) => maxInDigits(s.base, s.n));
  eq(maxes.join(', '), '15, 511, 255, 99999', 'наибольшие числа в записях разной длины');
  const left = specs.map((s) => `Запись длиной ${s.n} в системе с основанием ${s.base}`);
  const right = [
    `Наибольшее число в ней — ${maxes[2]}${specs[2].sub}`,
    `Наибольшее число в ней — ${maxes[3]}${specs[3].sub}`,
    `Наибольшее число в ней — ${maxes[0]}${specs[0].sub}`,
    `Наибольшее число в ней — ${maxes[1]}${specs[1].sub}`,
  ];
  const map = { [left[0]]: right[2], [left[1]]: right[3], [left[2]]: right[0], [left[3]]: right[1] };
  mat({
    lesson: 'numsys-01-intro', topic: T_SS, sub: 'Длина записи и наибольшее число', diff: 'intermediate', f: F.represent,
    prompt: 'Установите соответствие: вид записи — наибольшее число, которое в нём помещается.',
    left, right, map,
    why: `Наибольшее число в записи длиной n с основанием q получается, если во всех разрядах стоят старшие цифры алфавита: это qⁿ − 1. Считаем: ${specs.map((s) => `${s.base}^${s.n} − 1 = ${maxInDigits(s.base, s.n)}`).join('; ')}. Длина записи и основание вместе определяют диапазон, а внутри диапазона любое число записывается единственным набором цифр.`,
  });
}

// Сколько разрядов в записи числа в системе с основанием 3.
{
  const n = 100000;
  const base = 3;
  const len = digitsInBase(n, base);
  eq(len, 11, 'длина записи 100000 в троичной системе');
  eq(d(n.toString(base), base), n, 'контрольный перевод троичной записи обратно');
  ok(maxInDigits(base, len) >= n && maxInDigits(base, len - 1) < n, `запись длиной ${len} действительно подходит для ${n}`);
  nb({
    lesson: 'numsys-01-intro', topic: T_SS, sub: 'Длина записи', diff: 'intermediate', f: F.represent,
    calc: () => len,
    prompt: `Число ${n}₁₀ перевели в троичную систему счисления. Сколько разрядов (цифр) получилось в этой записи? Запишите только число.`,
    why: `Делим число на ${base} нацело и считаем шаги: 100000 → ${Math.floor(n / base)} → ... — всего ${len} шагов, значит в записи ${len} разрядов. Проверка по границам: ${base}^${len} = ${base ** len} > ${n}, а ${base}^${len - 1} = ${base ** (len - 1)} ≤ ${n}. Вес старшего разряда как раз и задаёт длину записи.`,
  });
}

// Сколько чисел записываются ровно четырьмя разрядами в четверичной системе.
{
  const base = 4;
  const n = 4;
  const first = base ** (n - 1);
  const last = maxInDigits(base, n);
  const byEnum = Array.from({ length: last - first + 1 }, (_, i) => first + i).length;
  const byFormula = last - first + 1;
  eq(byEnum, 192, 'перебором');
  eq(byFormula, 192, 'по границам диапазона');
  nb({
    lesson: 'numsys-01-intro', topic: T_SS, sub: 'Число записей заданной длины', diff: 'advanced', f: F.represent,
    calc: () => byEnum,
    prompt: `Сколько существует чисел, которые в системе счисления с основанием ${base} записываются ровно ${n} разрядами (старшая цифра не ноль)? Запишите только число.`,
    why: `Четыре разряда — это числа от ${base}^${n - 1} = ${first} до ${base}^${n} − 1 = ${last} включительно, всего ${byFormula}. Столько же даёт перебор всех чисел этого диапазона — ${byEnum}, значит границы взяты верно. Ведущий ноль число не меняет, но длину записи меняет: число ${first} записывается четырьмя разрядами в системе с основанием ${base}, а ноль — сразу одной цифрой, поэтому в этот диапазон не входит.`,
  });
}

// ═════════════ КТП 2 · numsys-02-binary · двоичная система (0/3/1) ═════════════

// Перевод по разложению на степени двойки.
{
  const n = 45;
  const key = byPowersOfTwo(n);
  eq(d(key, 2), n, `${key}₂ = ${n}`);
  eq(key, '101101', 'разложение 45 на степени двойки');
  nb({
    lesson: 'numsys-02-binary', topic: T_SS, sub: 'Перевод 10->2 по степеням двойки', diff: 'intermediate', f: F.convert,
    base: 2, calc: () => n,
    prompt: `Разложите число ${n}₁₀ на степени двойки: ${n} = 2⁵ + 2³ + 2² + 2⁰. Запишите это число в двоичной системе. Запишите только число.`,
    why: `Под каждым разрядом пишут его вес — степень двойки — и отмечают единицей те разряды, которые входят в разложение. Веса от 2⁵ до 2⁰: ${list([32, 16, 8, 4, 2, 1])}, разложение использует 32, 8, 4 и 1, поэтому запись ${key}₂. Проверка сложением весов отмеченных разрядов: 32 + 8 + 4 + 1 = ${n}, столько же было в условии.`,
  });
}

// Какая запись не может быть двоичной.
{
  const options = ['1100101₂', '101101₂', '111100₂', '10211₂'];
  const alphabet = '01';
  const bad = options.filter((s) => [...s.replace('₂', '')].some((ch) => !alphabet.includes(ch)));
  eq(bad.join(','), '10211₂', 'запись с цифрой вне двоичного алфавита');
  ok(options.filter((s) => s === bad[0]).length === 1, 'неверный вариант ровно один');
  sc({
    lesson: 'numsys-02-binary', topic: T_SS, sub: 'Двоичный алфавит', diff: 'intermediate', f: F.represent,
    prompt: 'В какой из записей есть цифра, которой нет в двоичной системе счисления?',
    opts: options, correct: bad[0],
    why: `Алфавит двоичной системы — это цифры ${list([...alphabet])} и ничего больше. В записи ${bad[0]} стоит цифра 2, поэтому такой записи в двоичной системе не бывает; остальные варианты состоят только из нулей и единиц и записаны вполне корректно.`,
  });
}

// Обратный перевод через веса разрядов.
{
  const s = '10110';
  const value = [...s].reduce((acc, ch, i) => acc + Number(ch) * 2 ** (s.length - 1 - i), 0);
  eq(value, 22, `${s}₂ = ${value}`);
  eq(d(s, 2), value, 'контрольный parseInt');
  eq(b2(value), s, 'контрольный toString');
  nb({
    lesson: 'numsys-02-binary', topic: T_SS, sub: 'Перевод 2->10 по весам разрядов', diff: 'intermediate', f: F.convert,
    calc: () => value,
    prompt: `У числа ${s}₂ разряды слева направо имеют веса 16, 8, 4, 2, 1. Чему равно значение этого числа в десятичной системе? Запишите только число.`,
    why: `Умножаем каждую цифру на вес её разряда и складываем: 1·16 + 0·8 + 1·4 + 1·2 + 0·1 = ${value}. Складывать можно только произведения цифры на вес — складывать сами разряды бессмысленно. Контроль: ${s}₂ — это и есть запись числа ${value}.`,
  });
}

// Наибольшее число с восемью разрядами и пятью единицами.
{
  const len = 8;
  const ones = 5;
  const masks = masksWithOnes(len, ones);
  eq(masks.length, 56, `число записей из ${len} разрядов с ${ones} единицами`);
  const best = masks.map((m) => d(m, 2)).reduce((a, b) => (b > a ? b : a));
  eq(best, 248, 'наибольшее число с пятью единицами в 8 разрядах');
  eq(masks.filter((m) => d(m, 2) === best).length, 1, 'максимум единственный');
  eq([...b2(best)].filter((c) => c === '1').length, ones, 'единиц в максимуме ровно столько, сколько задано');
  nb({
    lesson: 'numsys-02-binary', topic: T_SS, sub: 'Запись с заданным числом единиц', diff: 'advanced', f: F.represent,
    calc: () => best,
    prompt: `Двоичная запись числа содержит ровно ${len} разрядов, из которых ровно ${ones} — единицы. Чему равно наибольшее число с такой записью? Запишите только число.`,
    why: `Чтобы число было наибольшим, единицы надо сдвинуть в старшие разряды: веса разрядов убывают слева направо (${[...Array(len)].map((_, i) => 2 ** (len - 1 - i)).join(', ')}), поэтому запись ${b2(best)}₂ даёт ${best}. Таких записей перебор находит ${masks.length}: это число единиц в 8 разрядах, которое считается по формуле сочетаний. Проверка: сложив веса единиц, получаем ровно ${best}.`,
  });
}

// ═════════════ КТП 5 · numsys-05-arith · арифметика в двоичной системе (3/0/0) ═════════════

// Сложение столбиком кодом.
{
  const a = '1011';
  const b = '1101';
  const check = binAdd(a, b);
  eq(check.sum, '11000', `${a}₂ + ${b}₂ столбиком`);
  eq(d(check.sum, 2), d(a, 2) + d(b, 2), 'столбик сходится с переводом в десятичную');
  cr({
    lesson: 'numsys-05-arith', topic: T_SS, sub: 'Сложение двоичных чисел столбиком', diff: 'basic', f: F.arith,
    prompt: 'Напишите программу на Python, которая складывает два двоичных числа поразрядно, как это делают в столбик, и выводит сумму в двоичной системе без префикса 0b.',
    template: `# Складываем двоичные числа поразрядно: единицы в сумме 2 и больше дают 0 в этом разряде и единицу в следующий\ndef add_bin(a, b):\n    # строки равной длины, разряды считаем справа налево\n    res = ''\n    carry = 0\n    for i in range(len(a) - 1, -1, -1):\n        # TODO: сложить цифры разрядов вместе с переносом\n        ...\n    return res\n\n\nprint(add_bin('1011', '1101'))`,
    solution: `def add_bin(a, b):
    res = ''
    carry = 0
    for i in range(len(a) - 1, -1, -1):
        t = int(a[i]) + int(b[i]) + carry
        res = str(t % 2) + res
        carry = t // 2
    if carry:
        res = str(carry) + res
    return res


print(add_bin('1011', '1101'))`,
    expected: '11000',
    why: `Разряды складываются справа налево вместе с переносом: 1 + 1 = 2 → в разряд пишем 0, единицу переносим в следующий. Дальше 1 + 0 + 1 = 2 → снова 0 и перенос, затем 0 + 1 + 1 = 2 → 0 и перенос, и наконец 1 + 1 + 1 = 3 → в разряд 1, перенос 1 в новый старший разряд. Получается ${check.sum}₂. Функция bin() дала бы тот же результат, но к строке добавился бы префикс 0b, а здесь вывести надо чистую запись.`,
  });
}

// Сложение с переносом, ответ в двоичной системе.
{
  const a = '11011';
  const b = '1011';
  const value = d(a, 2) + d(b, 2);
  const key = b2(value);
  eq(value, 38, `${a}₂ + ${b}₂`);
  const { sum } = binAdd(a.padStart(a.length, '0'), b.padStart(a.length, '0'));
  eq(sum, key, 'столбик сходится с переводом');
  nb({
    lesson: 'numsys-05-arith', topic: T_SS, sub: 'Сложение в 2СС, ответ в 2СС', diff: 'basic', f: F.arith,
    base: 2, calc: () => value,
    prompt: `Вычислите: ${a}₂ + ${b}₂. Ответ дайте в двоичной системе. Запишите только число.`,
    why: `Складываем столбиком: ${d(a, 2)} + ${d(b, 2)} = ${value}, а в двоичной системе это ${key}₂. Проверка переводом результата обратно в десятичную: ${key}₂ = ${value}₁₀, столько же вышло и в столбике. В двоичной системе 1 + 1 даёт 0 в этом разряде и единицу в следующем — перенос.`,
  });
}

// Правило переноса при сложении столбиком.
{
  const one = 1;
  const carryIn = 1;
  const t = one + one + carryIn;
  const digit = t % 2;
  const carry = Math.floor(t / 2);
  eq(t, 3, '1 + 1 + перенос');
  eq(digit, 1, 'цифра в этом разряде');
  eq(carry, 1, 'перенос в следующий разряд');
  sc({
    lesson: 'numsys-05-arith', topic: T_SS, sub: 'Перенос при сложении', diff: 'basic', f: F.arith,
    prompt: 'При сложении столбиком в одном разряде сложились две единицы и единица переноса из предыдущего разряда. Что записывают в этот разряд и куда уходит перенос?',
    opts: [
      `В разряд записывают ${digit}, а единица переходит в следующий разряд`,
      'В разряд записывают 0, а единица переходит в следующий разряд',
      'В разряд записывают 2, а единица никуда не переходит',
      'В разряд записывают 3, а единица переходит в следующий разряд',
    ],
    correct: `В разряд записывают ${digit}, а единица переходит в следующий разряд`,
    why: `Всего в разряде ${one} + ${one} + ${carryIn} = ${t}. В двоичной системе 3 записывается как ${b2(t)}₂: в разряде стоит ${digit}, а единица уходит в следующий разряд переносом. Ошибка — записать в разряд само число ${t}: цифрой может быть только 0 или 1, всё остальное переносится на следующий разряд.`,
  });
}

// ═════════════ КТП 6 · numsys-06-review · решение задач (4/2/0) ═════════════

// Сложение в восьмеричной системе, ответ в десятичной.
{
  const a = '17';
  const b = '5';
  const value = d(a, 8) + d(b, 8);
  eq(value, 20, `${a}₈ + ${b}₈`);
  eq(value.toString(8), '24', 'контрольный перевод суммы в восьмеричную');
  nb({
    lesson: 'numsys-06-review', topic: T_SS, sub: 'Арифметика в 8СС, ответ в 10СС', diff: 'basic', f: F.arith,
    calc: () => value,
    prompt: `Вычислите: ${a}₈ + ${b}₈. Ответ дайте в десятичной системе. Запишите только число.`,
    why: `Переводим в десятичную и считаем: ${d(a, 8)} + ${d(b, 8)} = ${value}. В восьмеричной системе тот же результат записывается как ${value.toString(8)}₈ — в младшем разряде 7 + 5 = 12, а 12 больше 7, поэтому записываем 2 и переносим 1 в следующий разряд. Ошибка — сложить младшие разряды как десятичные и записать 12 прямо в разряд.`,
  });
}

// Вычитание в шестнадцатеричной системе, ответ в десятичной.
{
  const a = '2A';
  const b = '1F';
  const value = d(a, 16) - d(b, 16);
  eq(value, 11, `${a}₁₆ − ${b}₁₆`);
  eq(value.toString(16).toUpperCase(), 'B', 'контрольный перевод разности в 16СС');
  nb({
    lesson: 'numsys-06-review', topic: T_SS, sub: 'Арифметика в 16СС, ответ в 10СС', diff: 'basic', f: F.arith,
    calc: () => value,
    prompt: `Вычислите: ${a}₁₆ − ${b}₁₆. Ответ дайте в десятичной системе. Запишите только число.`,
    why: `В шестнадцатеричной системе A = 10, F = 15, поэтому ${d(a, 16)} − ${d(b, 16)} = ${value}. В самой системе считают по разрядам: в младшем разряде A − F требует займа из старшего разряда, после займа получается ${d(a, 16) + 16 - d(b, 16)}, то есть ${value.toString(16).toUpperCase()}. Ошибка — не взять заём и записать в младший разряд отрицательное число.`,
  });
}

// Сколько нулей в двоичной записи числа 64.
{
  const n = 64;
  const zeros = [...b2(n)].filter((c) => c === '0').length;
  eq(zeros, 6, `нулей в ${b2(n)}₂`);
  eq(d(b2(n), 2), n, 'контрольный перевод');
  nb({
    lesson: 'numsys-06-review', topic: T_SS, sub: 'Цепочка 10->2, счёт разрядов', diff: 'basic', f: F.convert,
    calc: () => zeros,
    prompt: `Переведите число ${n}₁₀ в двоичную систему и подсчитайте, сколько нулей оказалось в этой записи. Запишите только число.`,
    why: `${n}₁₀ — это 2 в шестой степени, поэтому запись получается ${b2(n)}₂: единица и ${zeros} нулей. Степень двойки записывается единицей с нулями, и число нулей равно самой степени — это быстрый способ проверить перевод.`,
  });
}

// Как выглядит число 25 в двоичной системе.
{
  const n = 25;
  const key = b2(n);
  const opts = ['11001₂', '10101₂', '10011₂', '11010₂'];
  const values = opts.map((o) => d(o.replace('₂', ''), 2));
  eq(values.join(', '), '25, 21, 19, 26', 'значения вариантов ответа');
  eq(values.filter((v) => v === n).length, 1, 'правильный вариант ровно один');
  const good = opts[values.indexOf(n)];
  sc({
    lesson: 'numsys-06-review', topic: T_SS, sub: 'Число и его двоичная запись', diff: 'basic', f: F.convert,
    prompt: `Как записывается число ${n}₁₀ в двоичной системе счисления?`,
    opts, correct: good,
    why: `${n} = 16 + 8 + 1 = 2⁴ + 2³ + 2⁰, поэтому запись ${key}₂. Остальные варианты дают ${ruList(values.filter((v) => v !== n).map(String))} — в них перепутаны разряды. Проверка ответа: 16 + 8 + 1 = ${n}, столько же получилось сложением весов единичных разрядов.`,
  });
}

// Соответствие «число — запись в другой системе».
{
  const rows = [
    { dec: 30, base: 16 },
    { dec: 20, base: 8 },
    { dec: 24, base: 2 },
  ];
  const subs = { 2: '₂', 8: '₈', 16: '₁₆' };
  const texts = rows.map((r) => r.dec.toString(r.base).toUpperCase() + subs[r.base]);
  eq(texts.join(' '), '1E₁₆ 24₈ 11000₂', 'записи чисел в своих системах');
  for (const r of rows) eq(d(r.dec.toString(r.base), r.base), r.dec, `контроль ${r.dec}`);
  const left = rows.map((r) => `${r.dec}₁₀`);
  const right = [texts[2], texts[0], texts[1]]; // правый столбец намеренно перемешан
  const map = { [left[0]]: right[1], [left[1]]: right[2], [left[2]]: right[0] };
  const byDec = rows.map((r) => `${r.dec}₁₀ = ${r.dec.toString(r.base).toUpperCase()}${subs[r.base]}`).join('; ');
  const back = rows.map((r) => `${r.dec.toString(r.base).toUpperCase()}${subs[r.base]} → ${d(r.dec.toString(r.base), r.base)}₁₀`).join(', ');
  mat({
    lesson: 'numsys-06-review', topic: T_SS, sub: 'Число и его запись в другой системе', diff: 'intermediate', f: F.convert,
    prompt: 'Установите соответствие: число в десятичной системе — его запись в указанной системе счисления.',
    left, right, map,
    why: `Переводим каждое число в свою систему: ${byDec}. Правый столбец намеренно перемешан, поэтому сначала приходится перевести число, а потом выбрать запись. Обратная проверка: ${back} — каждое число восстановилось, значит соответствие верное.`,
  });
}

// Длина двоичной записи числа 156 (через шестнадцатеричную).
{
  const n = 156;
  const hex = h16(n);
  const bin = b2(n);
  const len = bin.length;
  eq(hex, '9C', '156 в шестнадцатеричной');
  eq(len, 8, 'длина двоичной записи 156');
  eq(d(bin, 2), n, 'контрольный перевод двоичной записи');
  eq(len, 4 * Math.floor(h16(n).length), 'каждая шестнадцатеричная цифра даёт 4 двоичных разряда');
  nb({
    lesson: 'numsys-06-review', topic: T_SS, sub: 'Цепочка 10->16->2, длина записи', diff: 'intermediate', f: F.convert,
    calc: () => len,
    prompt: `Переведите число ${n}₁₀ в шестнадцатеричную систему, а результат — в двоичную. Сколько разрядов в полученной двоичной записи? Запишите только число.`,
    why: `${n}₁₀ = ${hex}₁₆, а каждая шестнадцатеричная цифра заменяется тетрадой из четырёх двоичных разрядов: ${hex}₁₆ = 1001 1100₂ = ${bin}₂. В записи ${len} разрядов. Считать можно и сразу в двоичной, но цепочка через 16СС короче и в ней легче заметить пропущенный разряд.`,
  });
}

// ─────────────────────── сборка файла ───────────────────────

const ORDER = ['class', 'topic', 'subtopic', 'type', 'difficulty', 'cognitive_level', 'points',
  'lesson', 'fgos_requirement', 'fgos_element', 'fgos', 'prompt', 'student_view', 'auto_check', 'teacher_only'];
if (ORDER.length !== 15) throw new Error('ORDER разъехался');

function readHead(file) {
  const raw = readFileSync(file, 'utf-8');
  const cut = raw.indexOf(MARK);
  return (cut >= 0 ? raw.slice(0, cut) : raw).replace(/\s+$/, '');
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
    points: String(t.points),
    lesson: t.lesson,
    fgos_requirement: String(t.f.req),
    fgos_element: String(t.f.el),
    fgos: `{ subject: [${t.f.subj}], meta: [${t.diff === 'advanced' ? 'self-control' : 'plan-actions'}] }`,
    prompt: q(t.prompt),
    student_view: t.sv,
    auto_check: t.ac,
    teacher_only: t.to,
  };
  for (const k of ORDER) if (fields[k] === undefined) throw new Error(`нет поля ${k}`);
  return [`- id: ${t.id}`, ...ORDER.map((k) => `  ${k}: ${fields[k]}`)].join('\n');
}

const head = readHead(BANK.file);

// id, уже занятые во всех банках 8 класса, — чтобы новые не совпали с чужими (в том числе с code-run).
const usedIds = new Set();
for (const file of ALL_8_BANKS) {
  const text = file === BANK.file ? head : readFileSync(file, 'utf-8');
  for (const m of text.matchAll(/^- id:\s*(\S+)/gm)) usedIds.add(m[1]);
}
const idBefore = Math.max(
  maxId(readFileSync('data/tasks/8/number-systems/bank.yaml', 'utf-8'), BANK.prefix),
  maxId(head, BANK.prefix),
);
ok(idBefore > 0, 'в банках системы счисления не найдено ни одного id');
let next = idBefore + 1;
const firstId = `${BANK.prefix}${String(next).padStart(3, '0')}`;

const blocks = state.map((t) => {
  const id = `${BANK.prefix}${String(next).padStart(3, '0')}`;
  ok(!usedIds.has(id), `id ${id} уже занят`);
  next += 1;
  usedIds.add(id);
  return yamlBlock({ ...t, id });
});

writeFileSync(BANK.file,
  `${head}\n\n${MARK}\n`
  + '# Ответы вычислены кодом (перебор разрядов, parseInt/toString, моделирование столбика, локальный Python)\n'
  + '# и проверены check.mjs. Повторный запуск перезаписывает только этот блок.\n\n'
  + `${blocks.join('\n\n')}\n`, 'utf-8');

// ─────────────────────── сверка с квотой ───────────────────────

const DIFFS = ['basic', 'intermediate', 'advanced'];
const got = new Map();
const tally = { basic: 0, intermediate: 0, advanced: 0 };
for (const t of state) {
  const row = got.get(t.lesson) ?? { basic: 0, intermediate: 0, advanced: 0 };
  row[t.diff] += 1;
  got.set(t.lesson, row);
  tally[t.diff] += 1;
  // сверка difficulty ↔ points ↔ cognitive_level ↔ lesson на каждом задании
  eq(t.points, POINTS[t.diff], `${t.lesson}: points для ${t.diff}`);
  eq(t.cog, COG[t.diff], `${t.lesson}: cognitive_level для ${t.diff}`);
  ok(t.lesson.length > 0, 'задание без урока');
  ok(['numeric_base', 'single_choice', 'matching', 'code_run'].includes(t.type), `неизвестный тип ${t.type}`);
}
for (const [lesson, want] of Object.entries(QUOTA)) {
  const have = got.get(lesson) ?? { basic: 0, intermediate: 0, advanced: 0 };
  eq(DIFFS.map((d) => have[d]).join('/'), want.join('/'), `${lesson}: нужно ${want.join('/')}, сделано ${DIFFS.map((d) => have[d]).join('/')}`);
}
for (const lesson of got.keys()) ok(lesson in QUOTA, `лишний урок вне квоты: ${lesson}`);
const total = DIFFS.reduce((s, d) => s + tally[d], 0);
eq(total, QUOTA_TOTAL, `всего ${total}, а по квоте ${QUOTA_TOTAL}`);

// Пул inf-8-numsys- после генерации должен перекрывать минимумы validate-bank.
// Считаем по блокам заданий, а не регуляркой «id ... difficulty», иначе блоки слипаются.
const pool = { basic: 0, intermediate: 0, advanced: 0 };
for (const file of ['data/tasks/8/number-systems/bank.yaml', BANK.file]) {
  const text = file === BANK.file
    ? `${head}\n\n${MARK}\n${blocks.join('\n\n')}\n`
    : readFileSync(file, 'utf-8');
  for (const block of text.split(/^- id: /m)) {
    const idm = block.match(/^(\S+)/);
    const dm = block.match(/^ {2}difficulty: (basic|intermediate|advanced)$/m);
    if (idm && dm && idm[1].startsWith(BANK.prefix)) pool[dm[1]] += 1;
  }
}
for (const [d, min] of Object.entries({ basic: 15, intermediate: 9, advanced: 6 })) {
  ok(pool[d] >= min, `пул numsys/${d}: ${pool[d]} < ${min}`);
}

console.log(`BANK OK: ${BANK.file} — ${blocks.length} заданий (${firstId}-${BANK.prefix}${String(next - 1).padStart(3, '0')}), старт с max+1 = ${idBefore + 1}`);
console.log(`ПРОВЕРОК: ${checks} (assert + локальный Python${PY ? ` через ${PY}` : ''})`);
console.log(`КВОТЫ OK: всего ${total}`);
for (const [lesson, want] of Object.entries(QUOTA)) {
  console.log(`  ${lesson}: ${want.join('/')} (basic/intermediate/advanced)`);
}
console.log(`ПУЛ numsys после генерации: basic ${pool.basic}, intermediate ${pool.intermediate}, advanced ${pool.advanced} (минимумы 15/9/6)`);
console.log(`ИТОГО по сложности: basic ${tally.basic}, intermediate ${tally.intermediate}, advanced ${tally.advanced}`);