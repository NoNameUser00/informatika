// Генератор банка СС 014-060: ответы вычисляются кодом, а не руками.
// Ручной банк 001-013 не трогаем. Выход: data/tasks/8/number-systems/bank-gen.yaml
// Проверка: build-trainer-json.mjs прогоняет каждый ключ через check.mjs.
import { writeFileSync } from 'node:fs';

const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sub = (n) => String(n).split('').map((d) => SUB[d]).join('');
const sup = (n) => String(n).split('').map((d) => SUP[d]).join('');
const bin = (n) => n.toString(2);
const oct = (n) => n.toString(8);
const hex = (n) => n.toString(16).toUpperCase();
const q = (s) => `"${s}"`;

function fromRoman(s) {
  const V = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = V[s[i]], next = V[s[i + 1]] ?? 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

let id = 14;
const T = [];
const N = (o) => T.push({ id: `inf-8-numsys-${String(id++).padStart(3, '0')}`, class: 8, topic: 'Системы счисления', ...o });

const cvt = (o) => N({ type: 'numeric_base', difficulty: o.d, cognitive_level: o.cog ?? 'apply',
  points: o.pts, lesson: o.lesson, fgos_requirement: o.req, fgos_element: 1.3,
  fgos: `{ subject: [inf-8-numsys-convert], meta: [plan-actions] }`,
  student_view: `{ base: ${o.to}, placeholder: "только число" }`,
  auto_check: `{ method: numeric_base, base: ${o.to}, strip_affixes: true }`,
  teacher_only: `{ accepted_values_decimal: [${o.dec}], answer_text: "${o.key}", explanation: "${o.why}" }`,
  prompt: o.prompt, subtopic: o.sub });

// --- basic: переводы ---
for (const n of [26, 91, 150, 200]) // 10 -> 2
  cvt({ d: 'basic', pts: 1, lesson: 'numsys-02-binary', req: 1.2, sub: 'Перевод 10->2', to: 2, dec: n, key: bin(n),
    prompt: `Переведите число ${n}₁₀ в двоичную систему. Запишите только число.`, why: `${n} = ${bin(n)}_2` });
for (const s of ['11001', '100111', '1010101', '1110001']) // 2 -> 10
  cvt({ d: 'basic', pts: 1, lesson: 'numsys-02-binary', req: 1.2, sub: 'Перевод 2->10', to: 10, dec: parseInt(s, 2), key: String(parseInt(s, 2)),
    prompt: `Переведите число ${s}₂ в десятичную систему. Запишите только число.`, why: `${s}_2 = ${parseInt(s, 2)}` });
for (const n of [83, 150]) // 10 -> 8
  cvt({ d: 'basic', pts: 1, lesson: 'numsys-03-octal', req: 1.2, sub: 'Перевод 10->8', to: 8, dec: n, key: oct(n),
    prompt: `Переведите число ${n}₁₀ в восьмеричную систему. Запишите только число.`, why: `${n} = ${oct(n)}_8` });
for (const s of ['57', '145']) // 8 -> 10
  cvt({ d: 'basic', pts: 1, lesson: 'numsys-03-octal', req: 1.2, sub: 'Перевод 8->10', to: 10, dec: parseInt(s, 8), key: String(parseInt(s, 8)),
    prompt: `Переведите число ${s}₈ в десятичную систему. Запишите только число.`, why: `${s}_8 = ${parseInt(s, 8)}` });
for (const n of [92, 200]) // 10 -> 16
  cvt({ d: 'basic', pts: 1, lesson: 'numsys-04-hex', req: 1.2, sub: 'Перевод 10->16', to: 16, dec: n, key: hex(n),
    prompt: `Переведите число ${n}₁₀ в шестнадцатеричную систему. Запишите только число.`, why: `${n} = ${hex(n)}_16` });
for (const s of ['2F', 'A4']) // 16 -> 10
  cvt({ d: 'basic', pts: 1, lesson: 'numsys-04-hex', req: 1.2, sub: 'Перевод 16->10', to: 10, dec: parseInt(s, 16), key: String(parseInt(s, 16)),
    prompt: `Переведите число ${s}₁₆ в десятичную систему. Запишите только число.`, why: `${s}_16 = ${parseInt(s, 16)}` });

// --- basic: римские (проверяем fromRoman) ---
for (const [s, want] of [['IX', 9], ['XLIV', 44], ['XCIX', 99]]) {
  const got = fromRoman(s);
  if (got !== want) throw new Error(`roman ${s}: ${got} != ${want}`);
  N({ type: 'numeric_base', difficulty: 'basic', cognitive_level: 'remember', points: 1, lesson: 'numsys-01-intro',
    fgos_requirement: 1.1, fgos_element: 1.2, fgos: `{ subject: [inf-8-numsys-represent], meta: [self-control] }`,
    subtopic: 'Римская система', prompt: `Переведите число ${s} из римской системы в десятичную. Запишите только число.`,
    student_view: `{ base: 10 }`, auto_check: `{ method: numeric_base, base: 10 }`,
    teacher_only: `{ accepted_values_decimal: [${want}], answer_text: "${want}", explanation: "${s} = ${want}" }` });
}

// --- basic: развернутая форма ---
for (const s of ['11010', '10011']) {
  const v = parseInt(s, 2);
  const terms = s.split('').map((b, i) => `${b}×2${sup(s.length - 1 - i)}`).join(' + ');
  N({ type: 'numeric_base', difficulty: 'basic', cognitive_level: 'remember', points: 1, lesson: 'numsys-01-intro',
    fgos_requirement: 1.1, fgos_element: 1.1, fgos: `{ subject: [inf-8-numsys-represent], meta: [plan-actions] }`,
    subtopic: 'Развернутая форма', prompt: `Вычислите ${terms}. Запишите только число.`,
    student_view: `{ base: 10 }`, auto_check: `{ method: numeric_base, base: 10 }`,
    teacher_only: `{ accepted_values_decimal: [${v}], answer_text: "${v}", explanation: "Развернутая форма ${s}_2 = ${v}" }` });
}

// --- basic: одиночный выбор ---
const SC = [
  { lesson: 'numsys-02-binary', sub: 'Количество нулей', prompt: 'Сколько нулей в двоичной записи числа 128₁₀?',
    opts: ['6', '7', '8', '9'], correct: 'B', why: '128 = 10000000_2: один и семь нулей' },
  { lesson: 'numsys-02-binary', sub: 'Количество единиц', prompt: 'Сколько единиц в двоичной записи числа 255₁₀?',
    opts: ['8', '7', '9', '10'], correct: 'A', why: '255 = 11111111_2: восемь единиц' },
  { lesson: 'numsys-01-intro', sub: 'Минимальное основание', prompt: 'Укажите минимальное основание системы счисления, в которой может быть записано число 123.',
    opts: ['3', '5', '4', '8'], correct: 'C', why: 'Старшая цифра 3, основание > 3, минимальное 4' },
  { lesson: 'numsys-01-intro', sub: 'Минимальное основание', prompt: 'Укажите минимальное основание системы счисления, в которой может быть записано число 506.',
    opts: ['8', '6', '9', '7'], correct: 'D', why: 'Старшая цифра 6, минимальное основание 7' },
  { lesson: 'numsys-01-intro', sub: 'Правило римской записи', prompt: 'Какая запись нарушает правило «не более трёх одинаковых знаков подряд»?',
    opts: ['IIII', 'XIV', 'XL', 'MCM'], correct: 'A', why: 'IIII — четыре I подряд, надо IV' },
  { lesson: 'numsys-03-octal', sub: 'Алфавит системы', prompt: 'Сколько цифр в алфавите восьмеричной системы счисления?',
    opts: ['7', '16', '8', '10'], correct: 'C', why: 'Цифры 0-7, всего 8' },
];
for (const s of SC)
  N({ type: 'single_choice', difficulty: 'basic', cognitive_level: 'remember', points: 1, lesson: s.lesson,
    fgos_requirement: 1.1, fgos_element: 1.1, fgos: `{ subject: [inf-8-numsys-represent], meta: [plan-actions] }`,
    subtopic: s.sub, prompt: s.prompt,
    student_view: `{ options: [${s.opts.map((t, i) => `{ id: ${'ABCD'[i]}, text: "${t}" }`).join(', ')}] }`,
    auto_check: `{ method: exact_option }`,
    teacher_only: `{ answer: ${s.correct}, explanation: "${s.why}" }` });

// --- intermediate: родственные системы ---
for (const [s, to] of [['101110', 8], ['110101', 8]]) // 2 -> 8
  cvt({ d: 'intermediate', pts: 2, lesson: 'numsys-03-octal', req: 1.2, sub: 'Перевод 2->8', to, dec: parseInt(s, 2), key: parseInt(s, 2).toString(to),
    prompt: `Переведите число ${s}₂ в восьмеричную систему. Запишите только число.`, why: `Триады: ${s}_2 = ${parseInt(s, 2).toString(to)}_8` });
for (const [s, to] of [['57', 2], ['123', 2]]) // 8 -> 2
  cvt({ d: 'intermediate', pts: 2, lesson: 'numsys-03-octal', req: 1.2, sub: 'Перевод 8->2', to, dec: parseInt(s, 8), key: parseInt(s, 8).toString(to),
    prompt: `Переведите число ${s}₈ в двоичную систему. Запишите только число.`, why: `Триады: ${s}_8 = ${parseInt(s, 8).toString(to)}_2` });
for (const [s, to] of [['B4', 2], ['5D', 2]]) // 16 -> 2
  cvt({ d: 'intermediate', pts: 2, lesson: 'numsys-04-hex', req: 1.2, sub: 'Перевод 16->2', to, dec: parseInt(s, 16), key: parseInt(s, 16).toString(to),
    prompt: `Переведите число ${s}₁₆ в двоичную систему. Запишите только число.`, why: `Тетрады: ${s}_16 = ${parseInt(s, 16).toString(to)}_2` });
cvt({ d: 'intermediate', pts: 2, lesson: 'numsys-04-hex', req: 1.2, sub: 'Перевод 2->16', to: 16, dec: parseInt('101101', 2), key: hex(45), // 2 -> 16
  prompt: `Переведите число 101101₂ в шестнадцатеричную систему. Запишите только число.`, why: `Тетрады: 101101_2 = 2D_16` });
cvt({ d: 'intermediate', pts: 2, lesson: 'numsys-03-octal', req: 1.2, sub: 'Перевод 8->16', to: 16, dec: parseInt('27', 8), key: hex(23), // 8 -> 16
  prompt: `Переведите число 27₈ в шестнадцатеричную систему. Запишите только число.`, why: `Через двоичную: 27_8 = 10111_2 = 17_16` });
cvt({ d: 'intermediate', pts: 2, lesson: 'numsys-04-hex', req: 1.2, sub: 'Перевод 16->8', to: 8, dec: parseInt('F5', 16), key: oct(245), // 16 -> 8
  prompt: `Переведите число F5₁₆ в восьмеричную систему. Запишите только число.`, why: `Через двоичную: F5_16 = 11110101_2 = 365_8` });

// --- intermediate: арифметика, ответ в десятичной ---
for (const [a, op, b] of [[12, '-', 5], [5, '×', 3], [21, '+', 13]]) {
  const v = op === '+' ? a + b : op === '-' ? a - b : a * b;
  cvt({ d: 'intermediate', pts: 2, lesson: 'numsys-05-arith', req: 1.2, sub: 'Арифметика 2СС, ответ в 10СС', to: 10, dec: v, key: String(v),
    prompt: `Вычислите: ${bin(a)}₂ ${op} ${bin(b)}₂. Ответ дайте в десятичной системе.`,
    why: `${a} ${op} ${b} = ${v}; проверка через десятичную` });
}

// --- advanced: соответствия ---
const M = [
  { left: ['12', '10', '6'], map: { '12': '1100₂', '10': '1010₂', '6': '110₂' } },
  { left: ['10', '15', '12'], map: { '10': 'A₁₆', '15': 'F₁₆', '12': 'C₁₆' } },
];
for (const m of M) {
  const right = [...new Set(Object.values(m.map))];
  const key = m.left.map((k) => `${k}=${m.map[k]}`).join(', ');
  N({ type: 'matching', difficulty: 'advanced', cognitive_level: 'analyze', points: 3, lesson: 'numsys-06-review',
    fgos_requirement: 1.2, fgos_element: 1.3, fgos: `{ subject: [inf-8-numsys-represent, inf-8-numsys-convert], meta: [plan-actions] }`,
    subtopic: 'Соответствие записей', prompt: 'Установите соответствие: число в десятичной — его запись.',
    student_view: `{ left: [${m.left.map((x) => `"${x}"`).join(', ')}], right: [${right.map((x) => `"${x}"`).join(', ')}] }`,
    auto_check: `{ method: matching, partial: proportional }`,
    teacher_only: `{ answer_map: { ${m.left.map((k) => `"${k}": "${m.map[k]}"`).join(', ')} }, explanation: "${key}" }` });
}

// --- advanced: цепочки и минимальное основание ---
for (const [s, from, count, what] of [['F0', 16, 4, 'нулей'], ['73', 8, 5, 'единиц']]) {
  const bits = parseInt(s, from).toString(2);
  const n = bits.split('').filter((b) => b === (what === 'нулей' ? '0' : '1')).length;
  if (n !== count) throw new Error(`chain ${s}: ${n} != ${count}`);
  const baseSub = sub(from);
  N({ type: 'numeric_base', difficulty: 'advanced', cognitive_level: 'analyze', points: 3, lesson: 'numsys-06-review',
    fgos_requirement: 1.2, fgos_element: 1.3, fgos: `{ subject: [inf-8-numsys-convert, inf-8-numsys-arith], meta: [self-control] }`,
    subtopic: 'Цепочка переводов',
    prompt: `Число ${s}${baseSub} переведите в двоичную, затем подсчитайте количество ${what}. Запишите только число.`,
    student_view: `{ base: 10 }`, auto_check: `{ method: numeric_base, base: 10 }`,
    teacher_only: `{ accepted_values_decimal: [${n}], answer_text: "${n}", explanation: "${s}_${from} = ${bits}_2, ${what}: ${n}" }` });
}
for (const [s, want] of [['352', 6], ['2012', 3]]) {
  const need = Math.max(...s.split('').map(Number)) + 1;
  if (need !== want) throw new Error(`minbase ${s}: ${need} != ${want}`);
  N({ type: 'numeric_base', difficulty: 'advanced', cognitive_level: 'analyze', points: 3, lesson: 'numsys-06-review',
    fgos_requirement: 1.1, fgos_element: 1.1, fgos: `{ subject: [inf-8-numsys-represent], meta: [plan-actions] }`,
    subtopic: 'Минимальное основание',
    prompt: `Укажите минимальное основание системы счисления, в которой может быть записано число ${s}. Запишите только число.`,
    student_view: `{ base: 10 }`, auto_check: `{ method: numeric_base, base: 10 }`,
    teacher_only: `{ accepted_values_decimal: [${want}], answer_text: "${want}", explanation: "Старшая цифра ${Math.max(...s.split('').map(Number))}, основание > неё" }` });
}

// --- advanced: сравнение чисел в разных СС ---
const CMP = [
  { opts: ['10111₂', '1F₁₆', '27₈', '30₈'], vals: [23, 31, 23, 24], ask: 'наибольшее' },
  { opts: ['FF₁₆', '777₈', '11111111₂', '1000₁₀'], vals: [255, 511, 255, 1000], ask: 'наибольшее' },
];
for (const c of CMP) {
  const best = Math.max(...c.vals);
  if (c.vals.filter((v) => v === best).length !== 1) throw new Error('compare not unique');
  const ci = c.vals.indexOf(best);
  N({ type: 'single_choice', difficulty: 'advanced', cognitive_level: 'analyze', points: 3, lesson: 'numsys-06-review',
    fgos_requirement: 1.2, fgos_element: 1.3, fgos: `{ subject: [inf-8-numsys-represent, inf-8-numsys-convert], meta: [plan-actions] }`,
    subtopic: 'Сравнение чисел',
    prompt: `Какое из чисел ${c.ask === 'наибольшее' ? 'наибольшее' : 'наименьшее'}?`,
    student_view: `{ options: [${c.opts.map((t, i) => `{ id: ${'ABCD'[i]}, text: "${t}" }`).join(', ')}] }`,
    auto_check: `{ method: exact_option }`,
    teacher_only: `{ answer: ${'ABCD'[ci]}, explanation: "Значения: ${c.opts.map((t, i) => `${t}=${c.vals[i]}`).join(', ')}" }` });
}

if (id - 14 !== 47) throw new Error(`Ожидали 47 заданий (014-060), вышло ${id - 14}`);

const yaml = `# Сгенерировано scripts/make-numsys-bank.mjs — руками не править.\n# Ответы вычислены кодом (parseInt/toString/fromRoman).\n` + T.map((t) => {
  const L = [];
  L.push(`- id: ${t.id}`);
  for (const k of ['class', 'topic', 'subtopic', 'type', 'difficulty', 'cognitive_level', 'points', 'lesson', 'fgos_requirement', 'fgos_element'])
    L.push(`  ${k}: ${t[k]}`);
  L.push(`  fgos: ${t.fgos}`);
  L.push(`  prompt: ${q(t.prompt)}`);
  L.push(`  student_view: ${t.student_view}`);
  L.push(`  auto_check: ${t.auto_check}`);
  L.push(`  teacher_only: ${t.teacher_only}`);
  return L.join('\n');
}).join('\n\n') + '\n';

writeFileSync('data/tasks/8/number-systems/bank-gen.yaml', yaml, 'utf-8');
console.log(`BANK-GEN OK: ${T.length} заданий (014-${String(id - 1).padStart(3, '0')})`);
