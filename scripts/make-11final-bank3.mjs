// Дописывает банки заданий 11 класса — финальный добор (3 задания).
//
// Устройство как в scripts/make-11-bank2.mjs: ответы считает код, ключи сверяются,
// запись идемпотентна по маркеру MARK (файл режется по своему маркеру и пишется заново).
//
// Главное правило: ответы НЕ пишутся руками.
//  - числовые ответы вычисляются и сверяются assert-ом;
//  - в single_choice правильный вариант задаётся ТЕКСТОМ, буква вычисляется кодом.
//
// Запуск: node scripts/make-11final-bank3.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const MARK = '# ==== СГЕНЕРИРОВАНО scripts/make-11final-bank3.mjs ====';

const BANK = {
  algo: { file: 'data/tasks/11/algo/bank-11algo.yaml', pfx: 'inf-11-algo-', req: 1.4, el: 1.5 },
  net: { file: 'data/tasks/11/net/bank-11net.yaml', pfx: 'inf-11-net-', req: 1.1, el: 1.1 },
};

const q = (s) => JSON.stringify(String(s));
const POINTS = { basic: 1, intermediate: 2, advanced: 3 };
const COG = { basic: 'remember', intermediate: 'apply', advanced: 'analyze' };
const LETTERS = 'ABCD';

// ---------- состояние банков ----------

const out = { algo: [], net: [] };
const heads = {};
const next = {};

for (const [name, b] of Object.entries(BANK)) {
  const raw = readFileSync(b.file, 'utf-8');
  const cut = raw.indexOf(MARK);
  const head = cut >= 0 ? raw.slice(0, cut) : raw;
  heads[name] = head.replace(/\s+$/, '');
  let max = 0;
  for (const m of head.matchAll(new RegExp(`- id: ${b.pfx}(\\d+)`, 'g'))) max = Math.max(max, Number(m[1]));
  if (max === 0) throw new Error(`${b.file}: не найдено ни одного id ${b.pfx}NNN`);
  next[name] = max + 1;
}

function put(bank, t) {
  const b = BANK[bank];
  const id = `${b.pfx}${String(next[bank]++).padStart(3, '0')}`;
  const L = [
    `- id: ${id}`,
    '  class: 11',
    `  topic: ${q(t.topic)}`,
    `  subtopic: ${q(t.sub)}`,
    `  type: ${t.type}`,
    `  difficulty: ${t.d}`,
    `  cognitive_level: ${t.cog ?? COG[t.d]}`,
    `  points: ${POINTS[t.d]}`,
    `  lesson: ${t.lesson}`,
    `  fgos_requirement: ${b.req}`,
    `  fgos_element: ${b.el}`,
    `  fgos: { subject: [${t.subj}], meta: [plan-actions] }`,
    `  prompt: ${q(t.prompt)}`,
    `  student_view: ${t.sv}`,
    `  auto_check: ${t.ac}`,
    `  teacher_only: ${t.to}`,
  ];
  out[bank].push(L.join('\n'));
}

// ---------- эмиттеры ----------

/** numeric_base. Ключ сверяется: parseInt(answer_text, base) === value. */
function num(bank, o) {
  const base = o.base ?? 10;
  const text = o.text ?? String(o.value);
  if (!Number.isInteger(o.value)) throw new Error(`${o.lesson}: ответ ${o.value} не целый`);
  if (parseInt(text, base) !== o.value) {
    throw new Error(`${o.lesson}: ключ «${text}» (основание ${base}) != ${o.value} [sub=${o.sub}]`);
  }
  if (!o.why) throw new Error(`${o.lesson}: нет explanation [sub=${o.sub}]`);
  put(bank, {
    topic: o.topic, sub: o.sub, type: 'numeric_base', d: o.d, cog: o.cog, lesson: o.lesson,
    subj: o.subj, prompt: o.prompt,
    sv: `{ base: ${base} }`,
    ac: `{ method: numeric_base, base: ${base}, strip_affixes: true }`,
    to: `{ accepted_values_decimal: [${o.value}], answer_text: ${q(text)}, explanation: ${q(o.why)} }`,
  });
}

/**
 * single_choice. Варианты задаются массивом текстов, правильный — ТЕКСТОМ (correctText).
 * Буква вычисляется кодом, так что перестановка вариантов не ломает ключ.
 */
function sc(bank, o) {
  const opts = o.opts;
  if (opts.length < 2 || opts.length > 4) throw new Error(`${o.lesson}: вариантов ${opts.length}`);
  if (new Set(opts).size !== opts.length) throw new Error(`${o.lesson}: повторяющиеся варианты`);
  const idx = opts.indexOf(o.correctText);
  if (idx < 0) throw new Error(`${o.lesson}: правильного текста «${o.correctText}» нет среди вариантов`);
  const correct = LETTERS[idx];
  put(bank, {
    topic: o.topic, sub: o.sub, type: 'single_choice', d: o.d, cog: o.cog, lesson: o.lesson,
    subj: o.subj, prompt: o.prompt,
    sv: `{ options: [${opts.map((t, i) => `{ id: ${LETTERS[i]}, text: ${q(t)} }`).join(', ')}] }`,
    ac: `{ method: exact_option }`,
    to: `{ answer: ${q(correct)}, explanation: ${q(o.why)} }`,
  });
  return correct;
}

// ---------- математика для ответов ----------

/** Наибольшая цифра десятичной записи числа. */
function maxDigit(n) {
  let m = 0;
  while (n > 0) {
    m = Math.max(m, n % 10);
    n = Math.floor(n / 10);
  }
  return m;
}

/** Номер первого члена последовательности, удовлетворяющего условию. */
function firstIndexWhere(a, pred) {
  for (let i = 0; i < a.length; i++) {
    if (pred(a[i])) return i + 1; // нумерация с единицы
  }
  return -1;
}

// ═════════════════════ КВОТА ═════════════════════

const QUOTA = {
  '11algo-03-digits': { basic: 1, intermediate: 0, advanced: 0 },
  '11algo-04-sequence': { basic: 0, intermediate: 1, advanced: 0 },
  '11ai-01-intel': { basic: 1, intermediate: 0, advanced: 0 },
};
const TOTAL = Object.values(QUOTA).reduce((s, v) => s + v.basic + v.intermediate + v.advanced, 0);

// ═════════════════════ ЗАДАНИЯ ═════════════════════

// ── 11algo-03-digits: наибольшая цифра числа (basic) ──
{
  const n = 7395;
  const d = maxDigit(n);
  if (d !== 9) throw new Error(`наибольшая цифра: ${d}`);
  num('algo', {
    topic: 'Анализ алгоритмов', d: 'basic', cog: 'remember', lesson: '11algo-03-digits', subj: 'inf-11-algo-digits',
    sub: 'Наибольшая цифра числа',
    prompt: `Найдите наибольшую цифру числа ${n}. Запишите только число.`,
    value: d,
    why: `Цифры числа ${n}: 7, 3, 9, 5. Наибольшая из них — ${d}.`,
  });
}

// ── 11algo-04-sequence: номер первого члена с условием (intermediate) ──
{
  const a = [3, 7, 12, 18, 25, 33];
  const idx = firstIndexWhere(a, (x) => x > 20);
  if (idx !== 5) throw new Error(`первый член > 20: номер ${idx}`);
  num('algo', {
    topic: 'Анализ алгоритмов', d: 'intermediate', cog: 'apply', lesson: '11algo-04-sequence', subj: 'inf-11-algo-seq',
    sub: 'Первый член с условием',
    prompt: `Дана последовательность: ${a.join(', ')}. Найдите номер первого члена, который больше 20. Запишите только число.`,
    value: idx,
    why: `Проверяем члены по порядку: ${a.slice(0, idx - 1).join(', ')} — все не больше 20, а ${a[idx - 1]} > 20. Первый член, больший 20, — ${idx}-й.`,
  });
}

// ── 11ai-01-intel: что умеет ИИ (basic) ──
{
  const opts = [
    'Компьютерное зрение',
    'Обработка естественного языка',
    'Робототехника',
    'Базы данных',
  ];
  sc('net', {
    topic: 'Безопасность и ИИ', d: 'basic', cog: 'remember', lesson: '11ai-01-intel', subj: 'inf-11-ai-ml',
    sub: 'Виды ИИ',
    prompt: 'Какой вид ИИ справляется с задачей распознавания изображений?',
    opts, correctText: opts[0],
    why: 'Компьютерное зрение — это область ИИ, которая занимается распознаванием изображений и видео. Обработка естественного языка работает с текстом и речью, робототехника — с физическими устройствами, а базы данных — это хранение информации.',
  });
}

// ---------- проверка квот ----------

const got = {};
for (const bank of ['algo', 'net']) {
  for (const block of out[bank]) {
    const m = block.match(/lesson: (\S+)/);
    const d = block.match(/difficulty: (\S+)/);
    if (!m || !d) throw new Error('не удалось извлечь lesson/difficulty');
    const lesson = m[1];
    const diff = d[1];
    if (!got[lesson]) got[lesson] = { basic: 0, intermediate: 0, advanced: 0 };
    got[lesson][diff] += 1;
  }
}

for (const [lesson, q] of Object.entries(QUOTA)) {
  const g = got[lesson] ?? { basic: 0, intermediate: 0, advanced: 0 };
  if (g.basic !== q.basic || g.intermediate !== q.intermediate || g.advanced !== q.advanced) {
    throw new Error(`квота ${lesson}: ожидалось ${JSON.stringify(q)}, получено ${JSON.stringify(g)}`);
  }
}
const extraLessons = Object.keys(got).filter((l) => !QUOTA[l]);
if (extraLessons.length) throw new Error(`лишние уроки: ${extraLessons.join(', ')}`);

console.log(`КВОТЫ OK: всего ${TOTAL}`);

// ---------- запись ----------

for (const [name, b] of Object.entries(BANK)) {
  if (!out[name].length) continue;
  writeFileSync(b.file, `${heads[name]}\n\n${[MARK, ...out[name]].join('\n\n')}\n`, 'utf-8');
  console.log(`${b.file}: добавлено ${out[name].length} заданий`);
}
