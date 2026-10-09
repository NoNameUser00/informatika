// Дописывает 3 задания в банки 7 и 8 класса — финальный добор пулов.
// Запуск: node scripts/make-78final-bank3.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const MARK = '# ==== СГЕНЕРИРОВАНО scripts/make-78final-bank3.mjs ====';

const BANK = {
  base7: { file: 'data/tasks/7/base/bank-7base.yaml', pfx: 'inf-7-base-', req: 1.1, el: 1.1 },
  algo8: { file: 'data/tasks/8/algorithms/bank-algo.yaml', pfx: 'inf-8-algo-', req: 1.4, el: 1.5 },
};

const q = (s) => JSON.stringify(String(s));
const POINTS = { basic: 1, intermediate: 2, advanced: 3 };
const COG = { basic: 'remember', intermediate: 'apply', advanced: 'analyze' };
const LETTERS = 'ABCD';

// ---------- состояние банков ----------

const out = { base7: [], algo8: [] };
const heads = {};
const next = {};

for (const [name, b] of Object.entries(BANK)) {
  const raw = readFileSync(b.file, 'utf-8');
  const cut = raw.indexOf(MARK);
  const head = cut >= 0 ? raw.slice(0, cut) : raw;
  heads[name] = head;
  const ids = [...raw.matchAll(new RegExp(`^- id: ${b.pfx}(\\d+)`, 'gm'))].map((m) => Number(m[1]));
  next[name] = ids.length ? Math.max(...ids) + 1 : 1;
}

// ---------- генерация заданий ----------

function emit(name, b, lesson, type, difficulty, prompt, studentView, autoCheck, teacherOnly) {
  const id = `${b.pfx}${String(next[name]).padStart(3, '0')}`;
  next[name]++;
  const item = [
    `- id: ${id}`,
    `  class: ${name === 'base7' ? 7 : 8}`,
    `  topic: ${q(name === 'base7' ? 'Текст' : 'Следование')}`,
    `  subtopic: ${q('Финальный добор')}`,
    `  type: ${type}`,
    `  difficulty: ${difficulty}`,
    `  cognitive_level: ${COG[difficulty]}`,
    `  points: ${POINTS[difficulty]}`,
    `  lesson: ${lesson}`,
    `  fgos_requirement: ${b.req}`,
    `  fgos_element: ${b.el}`,
    `  fgos: { subject: [${q(name === 'base7' ? 'inf-7-doc-style' : 'inf-8-algo-sequence')}], meta: [plan-actions] }`,
    `  prompt: ${q(prompt)}`,
    `  student_view: ${studentView}`,
    `  auto_check: ${autoCheck}`,
    `  teacher_only: ${teacherOnly}`,
  ].join('\n');
  out[name].push(item);
  return id;
}

// 1. 7doc-01-text intermediate — single_choice
{
  const correct = 'Отступ первой строки';
  const opts = [
    'Отступ первой строки',
    'Межстрочный интервал',
    'Выравнивание по ширине',
    'Интервал после абзаца',
  ];
  const letter = LETTERS[opts.indexOf(correct)];
  if (letter !== 'A') throw new Error('буква не A');
  emit('base7', BANK.base7, '7doc-01-text', 'single_choice', 'intermediate',
    'Автор хочет, чтобы все абзацы в документе начинались с красной строки. Какой параметр абзаца нужно изменить?',
    `{ options: [{ id: A, text: ${q(opts[0])} }, { id: B, text: ${q(opts[1])} }, { id: C, text: ${q(opts[2])} }, { id: D, text: ${q(opts[3])} }] }`,
    '{ method: exact_option }',
    `{ answer: ${q(letter)}, explanation: ${q('Красная строка — это отступ первой строки абзаца. Межстрочный интервал меняет расстояние между строками, выравнивание — положение строки по ширине, интервал после абзаца — пустое место до следующего абзаца.')} }`);
}

// 2. 7doc-04-lists intermediate — matching
{
  const left = ['Объединить ячейки', 'Разбить ячейку', 'Сортировать данные', 'Суммировать столбец'];
  const right = ['шапка на всю ширину таблицы', 'многострочная ячейка', 'упорядоченные строки', 'итог под столбцом'];
  const am = Object.fromEntries(left.map((l, i) => [l, right[i]]));
  const amStr = Object.entries(am).map(([k, v]) => `${q(k)}: ${q(v)}`).join(', ');
  emit('base7', BANK.base7, '7doc-04-lists', 'matching', 'intermediate',
    'Установите соответствие: действие в таблице — его результат.',
    `{ left: [${left.map(q).join(', ')}], right: [${right.map(q).join(', ')}] }`,
    '{ method: matching, partial: proportional }',
    `{ answer_map: { ${amStr} }, explanation: ${q('Объединение ячеек даёт шапку на всю ширину, разбиение — многострочную ячейку, сортировка упорядочивает строки, суммирование ставит итог под столбцом.')} }`);
}

// 3. alg-05-sequence basic — numeric_base
{
  const y0 = 10, y1 = y0 / 2, y2 = y1 + 7;
  if (y2 !== 12) throw new Error(`ожидалось 12, получено ${y2}`);
  emit('algo8', BANK.algo8, 'alg-05-sequence', 'numeric_base', 'basic',
    'Выполните по порядку команды: y := 10; y := y / 2; y := y + 7. Какое получилось значение? Запишите только число.',
    '{ base: 10, placeholder: "только число" }',
    '{ method: numeric_base, base: 10, strip_affixes: true }',
    `{ accepted_values_decimal: [${y2}], answer_text: ${q(String(y2))}, explanation: ${q('Следование выполняется строго по порядку: y = 10, затем y = 10 / 2 = 5, затем y = 5 + 7 = 12.')} }`);
}

// ---------- проверка квот и запись ----------

const QUOTA = {
  '7doc-01-text': { intermediate: 1 },
  '7doc-04-lists': { intermediate: 1 },
  'alg-05-sequence': { basic: 1 },
};

const got = {};
for (const [name, items] of Object.entries(out)) {
  for (const item of items) {
    const lesson = /^\s*lesson: (\S+)$/m.exec(item)?.[1];
    if (!lesson) throw new Error(`в ${name} задание без lesson`);
    const d = /^\s*difficulty: (\S+)$/m.exec(item)[1];
    if (!(d in POINTS)) throw new Error(`${lesson}: неизвестная сложность ${d}`);
    got[lesson] = got[lesson] || {};
    got[lesson][d] = (got[lesson][d] || 0) + 1;
  }
}
for (const [lesson, row] of Object.entries(QUOTA)) {
  for (const [d, n] of Object.entries(row)) {
    if ((got[lesson]?.[d] || 0) !== n) throw new Error(`${lesson}/${d}: по плану ${n}, вышло ${got[lesson]?.[d] || 0}`);
  }
}
const extra = Object.keys(got).filter((l) => !(l in QUOTA));
if (extra.length) throw new Error(`лишние уроки: ${extra.join(', ')}`);
const TOTAL = Object.values(out).reduce((s, a) => s + a.length, 0);
if (TOTAL !== 3) throw new Error(`всего ожидали 3 задания, вышло ${TOTAL}`);
console.log(`КВОТЫ OK: всего ${TOTAL}`);

if (process.env.PREVIEW) {
  for (const [name, items] of Object.entries(out)) {
    for (const line of items) console.log(line + '\n');
  }
} else {
  for (const [name, b] of Object.entries(BANK)) {
    writeFileSync(b.file, `${heads[name]}\n\n${[MARK, ...out[name]].join('\n\n')}\n`, 'utf-8');
    console.log(`BANK OK: ${b.file} — добавлено ${out[name].length} (последний id ${next[name] - 1})`);
  }
  console.log(`ИТОГО: ${TOTAL} заданий`);
}
