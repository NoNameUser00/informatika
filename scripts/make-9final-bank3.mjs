// Дописывает банки заданий 9 класса — финальный добор (tmp/BANK-SPEC.md, 3 задания).
//
// Устройство как в scripts/make-11-bank2.mjs: ответы считает код, ключи сверяются,
// запись идемпотентна по маркеру MARK (файл режется по своему маркеру и пишется заново).
//
// Главное правило: ответы НЕ пишутся руками.
//  - числовые ответы вычисляются и сверяются assert-ом;
//  - в single_choice правильный вариант задаётся ТЕКСТОМ, буква вычисляется кодом;
//  - в matching answer_map собирается кодом из массивов left/right.
//
// Запуск: node scripts/make-9final-bank3.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const MARK = '# ==== СГЕНЕРИРОВАНО scripts/make-9final-bank3.mjs ====';

const BANK = {
  sheet: { file: 'data/tasks/9/spreadsheets/bank-9sheet.yaml', pfx: 'inf-9-sheet-', req: 1.1, el: 1.2 },
  extra: { file: 'data/tasks/9/extra/bank-9extra.yaml', pfx: 'inf-9-extra-', req: 1.1, el: 1.2 },
};

const q = (s) => JSON.stringify(String(s));
const POINTS = { basic: 1, intermediate: 2, advanced: 3 };
const COG = { basic: 'remember', intermediate: 'apply', advanced: 'analyze' };
const LETTERS = 'ABCD';

// ---------- состояние банков ----------

const out = { sheet: [], extra: [] };
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
    '  class: 9',
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

/** matching. Проверяем, что правых вариантов ровно столько же и все использованы. */
function mt(bank, o) {
  const vals = Object.values(o.map);
  if (vals.length !== o.left.length) throw new Error(`${o.lesson}: в соответствии ${vals.length} пар на ${o.left.length} левых`);
  if (new Set(vals).size !== vals.length) throw new Error(`${o.lesson}: правые варианты повторяются`);
  for (const v of vals) if (!o.right.includes(v)) throw new Error(`${o.lesson}: «${v}» нет среди правых`);
  for (const l of o.left) if (!o.map[l]) throw new Error(`${o.lesson}: нет пары для «${l}»`);
  put(bank, {
    topic: o.topic, sub: o.sub, type: 'matching', d: o.d, cog: o.cog, lesson: o.lesson,
    subj: o.subj, prompt: o.prompt,
    sv: `{ left: [${o.left.map(q).join(', ')}], right: [${o.right.map(q).join(', ')}] }`,
    ac: `{ method: matching, partial: proportional }`,
    to: `{ answer_map: { ${o.left.map((l) => `${q(l)}: ${q(o.map[l])}`).join(', ')} }, explanation: ${q(`${o.why} Верно: ${o.left.map((l) => `${l} = ${o.map[l]}`).join('; ')}.`)} }`,
  });
}

// ═════════════════════ КТП 6 · логические функции ═════════════════════

const SHEET_TOPIC = 'Электронные таблицы';
const EXTRA_TOPIC = 'Управление, моделирование и Интернет';

// ── КТП 6 | 9sheet-04-logic | логические функции и расчёты по формулам (1) ──
{
  // СЧЁТ считает только числа: текст и пустые ячейки не идут в подсчёт.
  const cells = [12, 'текст «нет»', 7, 'пустая ячейка', 9, 'текст «нет»'];
  const numbers = cells.filter((v) => typeof v === 'number');
  const n = numbers.length;
  if (n !== 3) throw new Error(`СЧЁТ: ${n}`);
  num('sheet', {
    topic: SHEET_TOPIC, d: 'basic', cog: 'remember', lesson: '9sheet-04-logic', subj: 'inf-9-sheet-logic',
    sub: 'Функция СЧЁТ',
    prompt: `В диапазоне A1:A6 стоят: ${cells.join(', ')}. Сколько ячеек содержат числа (=СЧЁТ(A1:A6))? Запишите только число.`,
    value: n,
    why: `СЧЁТ считает только числа: ${numbers.join(', ')} — ${n} ячейки. Текст «нет» и пустая ячейка в подсчёт не идут. Если нужно посчитать числа по условию, берут СЧЁТЕСЛИ.`,
  });
}

// ── КТП 9 | 9sheet-06-charts | визуализация данных (1) ──
{
  const opts = [
    'Легенда',
    'Заголовок',
    'Подпись оси',
    'Линия сетки',
  ];
  sc('sheet', {
    topic: SHEET_TOPIC, d: 'basic', cog: 'remember', lesson: '9sheet-06-charts', subj: 'inf-9-sheet-charts',
    sub: 'Элементы диаграммы',
    prompt: 'На диаграмме несколько рядов данных, каждый нарисован своим цветом. Какой элемент диаграммы объясняет, что означает каждый цвет?',
    opts, correctText: opts[0],
    why: 'Легенда расшифровывает цвета и ряды: какой столбик или какая линия чему соответствует. Заголовок отвечает на вопрос «о чём диаграмма», подпись оси — «в каких единицах», а сетка просто помогает считывать значения.',
  });
}

// ═════════════════════ КТП 32 · интернет-сервисы ═════════════════════

// ── КТП 32 | 9net-04-services | виды деятельности в сети и сервисы (1) ──
{
  const left = ['Поисковая система', 'Электронная почта', 'Форум', 'Облачный диск', 'Геоинформационная система', 'Онлайн-офис'];
  const right = ['искать информацию', 'переписываться', 'обсуждать вопросы на тему', 'хранить и передавать файлы', 'работать с картами и координатами', 'создавать документы и таблицы'];
  const map = Object.fromEntries(left.map((l, i) => [l, right[i]]));
  mt('extra', {
    topic: EXTRA_TOPIC, d: 'intermediate', cog: 'apply', lesson: '9net-04-services', subj: 'inf-9-extra-cloud',
    sub: 'Сервис и вид деятельности',
    prompt: 'Установите соответствие: интернет-сервис — для какой деятельности он нужен.',
    left, right, map,
    why: 'Каждый сервис закрывает свой вид деятельности: поиск ищет информацию, почта переписывается, форум собирает обсуждения, облако хранит файлы, ГИС работает с картами, онлайн-офис создаёт документы. Программа установлена на конкретный компьютер, а сервис работает через сеть: открыл сайт — и работаешь.',
  });
}

// ═════════════ проверка квот и запись ═════════════

const QUOTA = {
  '9sheet-04-logic': 1,
  '9sheet-06-charts': 1,
  '9net-04-services': 1,
};

const got = {};
const byDiff = { basic: 0, intermediate: 0, advanced: 0 };
const byBank = {};
for (const [name, items] of Object.entries(out)) {
  byBank[name] = items.length;
  for (const item of items) {
    const lesson = /^\s*lesson: (\S+)$/m.exec(item)?.[1];
    if (!lesson) throw new Error(`в ${name} задание без lesson`);
    got[lesson] = (got[lesson] ?? 0) + 1;
    const d = /^\s*difficulty: (\S+)$/m.exec(item)[1];
    if (!(d in byDiff)) throw new Error(`${lesson}: неизвестная сложность ${d}`);
    byDiff[d] += 1;
    // сверка difficulty ↔ points ↔ cognitive_level
    const pts = /^\s*points: (\d+)$/m.exec(item)[1];
    const cog = /^\s*cognitive_level: (\S+)$/m.exec(item)[1];
    if (Number(pts) !== POINTS[d]) throw new Error(`${lesson}: points ${pts} != ${POINTS[d]} для ${d}`);
    if (cog !== COG[d]) throw new Error(`${lesson}: cognitive_level ${cog} != ${COG[d]} для ${d}`);
  }
}
for (const [lesson, n] of Object.entries(QUOTA)) {
  if (got[lesson] !== n) throw new Error(`${lesson}: по плану ${n}, вышло ${got[lesson] ?? 0}`);
}
const TOTAL = Object.values(byBank).reduce((s, n) => s + n, 0);
if (TOTAL !== 3) throw new Error(`всего ожидали 3 задания, вышло ${TOTAL}`);
const extra = Object.keys(got).filter((l) => !(l in QUOTA));
if (extra.length) throw new Error(`лишние уроки: ${extra.join(', ')}`);
console.log(`КВОТЫ OK: по урокам tmp/BANK-SPEC.md; всего ${TOTAL}`);
console.log(`СЛОЖНОСТИ: basic=${byDiff.basic} intermediate=${byDiff.intermediate} advanced=${byDiff.advanced}`);
console.log(`БАНКИ: ${Object.entries(byBank).map(([n, k]) => `${n}=${k}`).join(' ')}`);

if (process.env.PREVIEW) {
  for (const [name, items] of Object.entries(out)) {
    for (const line of items) console.log(line + '\n');
  }
} else {
  for (const [name, b] of Object.entries(BANK)) {
    writeFileSync(b.file, `${heads[name]}\n\n${[MARK, ...out[name]].join('\n\n')}\n`, 'utf-8');
    console.log(`BANK-9-3 OK: ${b.file} — добавлено ${out[name].length} (последний id ${next[name] - 1})`);
  }
  console.log(`BANK-9-3 ИТОГО: ${TOTAL} заданий`);
}
