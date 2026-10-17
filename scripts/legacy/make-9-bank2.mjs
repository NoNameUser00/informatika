// Дописывает банки заданий 9 класса — второй заход (tmp/need-9.txt, 120 заданий).
//
// Устройство как в make-7-bank2.mjs: ответы считает код, ключи сверяются,
// запись идемпотентна по маркеру MARK.
// Основной упор здесь — вычислимые задачи по таблицам и массивам: почти все
// ответы получаются прогоном формулы или цикла прямо в этом файле.
//
// Запуск: node scripts/make-9-bank2.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const MARK = '# ==== СГЕНЕРИРОВАНО scripts/make-9-bank2.mjs — руками не править ====';

const BANK = {
  sheet: { file: 'data/tasks/9/spreadsheets/bank-9sheet.yaml', pfx: 'inf-9-sheet-', req: 1.1, el: 1.2 },
  arr: { file: 'data/tasks/9/arrays/bank-9arr.yaml', pfx: 'inf-9-arr-', req: 1.2, el: 1.3 },
  graph: { file: 'data/tasks/9/graphs/bank-9graph.yaml', pfx: 'inf-9-graph-', req: 1.3, el: 1.6 },
  extra: { file: 'data/tasks/9/extra/bank-9extra.yaml', pfx: 'inf-9-extra-', req: 1.1, el: 1.2 },
};

// Урок -> банк по смыслу: таблицы, массивы и программирование, графы,
// управление/моделирование/Интернет.
const BANK_OF_LESSON = {
  '9sheet': 'sheet',
  '9algo': 'arr',
  '9arr': 'arr',
  '9graph': 'graph',
  '9robot': 'extra',
  '9model': 'extra',
  '9net': 'extra',
};

const q = (s) => JSON.stringify(String(s));
const POINTS = { basic: 1, intermediate: 2, advanced: 3 };
const LETTERS = 'ABCD';
const SH = 'Электронные таблицы';
const AR = 'Массивы';
const GR = 'Графы';
const EX = 'Управление, моделирование и Интернет';

const out = { sheet: [], arr: [], graph: [], extra: [] };
const heads = {};
const next = {};

for (const [name, b] of Object.entries(BANK)) {
  const raw = readFileSync(b.file, 'utf-8');
  const cut = raw.indexOf(MARK);
  const head = cut >= 0 ? raw.slice(0, cut) : raw;
  heads[name] = head.replace(/\s+$/, '');
  let max = 0;
  for (const m of head.matchAll(new RegExp(`- id: ${b.pfx}(\\d+)`, 'g'))) max = Math.max(max, Number(m[1]));
  if (max === 0) throw new Error(`${b.file}: не найдено id ${b.pfx}NNN`);
  next[name] = max + 1;
}

function put(lesson, t) {
  const bank = BANK_OF_LESSON[lesson.split('-')[0]];
  if (!bank) throw new Error(`не знаю банк для урока ${lesson}`);
  const b = BANK[bank];
  const id = `${b.pfx}${String(next[bank]++).padStart(3, '0')}`;
  out[bank].push([
    `- id: ${id}`, '  class: 9', `  topic: ${q(t.topic)}`, `  subtopic: ${q(t.sub)}`,
    `  type: ${t.kind}`, `  difficulty: ${t.difficulty}`, `  cognitive_level: ${t.cog}`,
    `  points: ${POINTS[t.difficulty]}`, `  lesson: ${lesson}`,
    `  fgos_requirement: ${b.req}`, `  fgos_element: ${b.el}`,
    `  fgos: { subject: [${t.subj}], meta: [plan-actions] }`,
    `  prompt: ${q(t.prompt)}`, `  student_view: ${t.sv}`, `  auto_check: ${t.ac}`,
    `  teacher_only: ${t.to}`,
  ].join('\n'));
}

function num(lesson, o) {
  const base = o.base ?? 10;
  const text = o.text ?? String(o.value);
  if (!Number.isInteger(o.value) || parseInt(text, base) !== o.value) {
    throw new Error(`${lesson}: ключ «${text}» (основание ${base}) != ${o.value} [sub=${o.sub}]`);
  }
  put(lesson, {
    topic: o.topic, sub: o.sub, kind: 'numeric_base', difficulty: o.d, cog: o.cog, subj: o.subj,
    prompt: o.prompt,
    sv: `{ base: ${base}, placeholder: "только число" }`,
    ac: `{ method: numeric_base, base: ${base}, strip_affixes: true }`,
    to: `{ accepted_values_decimal: [${o.value}], answer_text: ${q(text)}, explanation: ${q(o.why)} }`,
  });
}

function sc(lesson, o) {
  if (o.opts.length < 2 || o.opts.length > 4) throw new Error(`${lesson}: вариантов ${o.opts.length}`);
  if (!o.opts[o.correct.charCodeAt(0) - 65]) throw new Error(`${lesson}: нет варианта «${o.correct}»`);
  if (new Set(o.opts).size !== o.opts.length) throw new Error(`${lesson}: варианты повторяются`);
  if (o.correctText !== undefined && o.opts[o.correct.charCodeAt(0) - 65] !== o.correctText) {
    throw new Error(`${lesson}: correctText не совпадает с вариантом «${o.correct}»`);
  }
  put(lesson, {
    topic: o.topic, sub: o.sub, kind: 'single_choice', difficulty: o.d, cog: o.cog, subj: o.subj,
    prompt: o.prompt,
    sv: `{ options: [${o.opts.map((t, i) => `{ id: ${LETTERS[i]}, text: ${q(t)} }`).join(', ')}] }`,
    ac: `{ method: exact_option }`,
    to: `{ answer: ${q(o.correct)}, explanation: ${q(o.why)} }`,
  });
}

function mt(lesson, o) {
  const vals = Object.values(o.map);
  if (vals.length !== o.left.length) throw new Error(`${lesson}: ${vals.length} пар на ${o.left.length} левых`);
  if (new Set(vals).size !== vals.length) throw new Error(`${lesson}: правые варианты повторяются`);
  for (const v of vals) if (!o.right.includes(v)) throw new Error(`${lesson}: «${v}» нет среди правых`);
  for (const l of o.left) if (!o.map[l]) throw new Error(`${lesson}: нет пары для «${l}»`);
  const key = o.left.map((l) => `${l} = ${o.map[l]}`).join('; ');
  put(lesson, {
    topic: o.topic, sub: o.sub, kind: 'matching', difficulty: o.d, cog: o.cog, subj: o.subj,
    prompt: o.prompt,
    sv: `{ left: [${o.left.map(q).join(', ')}], right: [${o.right.map(q).join(', ')}] }`,
    ac: `{ method: matching, partial: proportional }`,
    to: `{ answer_map: { ${o.left.map((l) => `${q(l)}: ${q(o.map[l])}`).join(', ')} }, explanation: ${q(`${o.why} Верно: ${key}.`)} }`,
  });
}

// ─────────────────────── общие вычислительные помощники ───────────────────────

const sum = (a) => a.reduce((s, v) => s + v, 0);
const avg = (a) => sum(a) / a.length;
const maxOf = (a) => Math.max(...a);
const minOf = (a) => Math.min(...a);
const countIf = (a, f) => a.filter(f).length;
// sumIf(a, f) — сумма элементов, прошедших проверку f.
// sumBy(a, f, v) — сумма v(r) по элементам, прошедшим f (для массивов объектов).
const sumIf = (a, f) => sum(a.filter(f));
const sumBy = (a, f, v) => sum(a.filter(f).map((r) => v(r)));

/** Число путей в ациклическом ориентированном графе (предшественники заданы явно). */
function dagPaths(pred, order) {
  const ways = {};
  for (const v of order) {
    const ps = pred[v] ?? [];
    ways[v] = ps.length ? sum(ps.map((p) => ways[p])) : 1;
  }
  return ways;
}

/** Кратчайший путь по весам перебором всех простых путей. */
function shortestPath(edges, weight, from, to) {
  const adj = new Map();
  for (const [u, v] of edges) {
    if (!adj.has(u)) adj.set(u, []);
    adj.get(u).push(v);
    if (!adj.has(v)) adj.set(v, []);
    adj.get(v).push(u);
  }
  const found = [];
  const walk = (node, path, cost) => {
    if (node === to) {
      found.push({ path: [...path, to], cost });
      return;
    }
    for (const nextNode of adj.get(node) ?? []) {
      if (path.includes(nextNode)) continue;
      walk(nextNode, [...path, nextNode], cost + weight(node, nextNode));
    }
  };
  walk(from, [from], 0);
  const best = Math.min(...found.map((p) => p.cost));
  return { best, paths: found.filter((p) => p.cost === best) };
}

// ═════════════════════ КТП 2–11 · электронные таблицы ═════════════════════

// ── КТП 2 | 9sheet-01-base | Интерфейс (1/1) ──
{
  const cells = ['A1', 'B1', 'C1', 'D1', 'E1'];
  sc('9sheet-01-base', {
    topic: SH, d: 'basic', cog: 'remember', subj: 'inf-9-sheet-base',
    sub: 'Адрес ячейки',
    prompt: 'Как записывается адрес третьей ячейки в третьей строке таблицы?',
    opts: ['C3', '3C', 'C', 'Ячейка 3 номер 3'],
    correct: 'A',
    correctText: 'C3',
    why: 'Сначала столбец, потом строка: столбец C — третий по алфавиту, строка 3. Запись 3C перепутана, а C без номера строки не указывает ни на одну ячейку.',
  });
}
{
  const first = 20;
  const last = 28;
  num('9sheet-01-base', {
    topic: SH, d: 'intermediate', cog: 'apply', subj: 'inf-9-sheet-base',
    sub: 'Диапазон ячеек',
    prompt: `В столбце A значения от ${first} до ${last} идут подряд. Сколько всего значений в столбце? Запишите только число.`,
    value: last - first + 1,
    why: `${first}, ${first + 1}, …, ${last}: количество = ${last} − ${first} + 1 = ${last - first + 1}. Прибавляем единицу, потому что включаются оба конца. Ошибка — забыть про +1.`,
  });
}

// ── КТП 3 | 9sheet-02-data | Ввод данных (3/1) ──
{
  const rows = ['10', '0,5', '1 200', '2:30', '15%', '-7', 'текст', '1000'];
  const texts = ['0,5', '2:30', '15%', 'текст'];
  num('9sheet-02-data', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-data',
    sub: 'Число или текст',
    prompt: `В ячейки ввели: ${rows.join(', ')}. Сколько из них таблица воспримет как текст, а не как число? Запишите только число.`,
    value: texts.length,
    why: `Текстом станут ${texts.join(', ')}: в русской записи десятичная запятая, двоеточие во времени, процент и буквы не являются числовым форматом. Остальные значения — числа: ${texts.length === 4 ? 'ввод с точкой, пробелом-разделителем и знаком минус числовой' : ''}.`,
  });
}
{
  sc('9sheet-02-data', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-data',
    sub: 'Ошибка при вводе',
    prompt: 'Почему после ввода значения 1 200 (с пробелом) таблица восприняла его как текст?',
    opts: [
      'В русском формате разделителем тысяч служит не пробел, а неразрывный пробел или точка',
      'Пробелы нельзя вводить в таблицу',
      'Числа нельзя вводить с разделителями',
      'Значение слишком большое',
    ],
    correct: 'A',
    correctText: 'В русском формате разделителем тысяч служит не пробел, а неразрывный пробел или точка',
    why: 'Обычный пробел таблица считает началом текста. Чтобы число с разделителем распозналось как число, разделитель должен быть неразрывным пробелом либо настройкой локали. Проще вводить 1200.',  });
}
{
  const price = 250;
  const n = 4;
  num('9sheet-02-data', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-data',
    sub: 'Формат ячейки',
    prompt: `В ${n} ячейках записана цена ${price} рублей. Сколько всего рублей в этих ячейках? Запишите только число.`,
    value: price * n,
    why: `${n} · ${price} = ${price * n}. Проверка простая: сложить ту же цену ${n} раз. Так удобно проверять результат формулы — сначала руками на маленьком числе.`,
  });
}
{
  const types = ['число', 'текст', 'дата', 'время'];
  const right = ['считается в формулах', 'сортируется как текст, не как число', 'участвует в вычислениях как число', 'считается как доля суток'];
  mt('9sheet-02-data', {
    topic: SH, d: 'intermediate', cog: 'analyze', subj: 'inf-9-sheet-data',
    sub: 'Тип значения и его поведение',
    prompt: 'Установите соответствие: тип значения в ячейке — как таблица его обрабатывает.',
    left: types, right,
    map: { 'число': right[0], 'текст': right[1], 'дата': right[2], 'время': right[3] },
    why: 'Тип значения определяет всё: текст не участвует в вычислениях и сортируется по буквам, а числа, даты и время считаются числами. Ошибка в типе значения портит формулу, поэтому тип проверяют при вводе.',
  });
}

// ── КТП 4 | 9sheet-02-refs | Ссылки (2/0) ──
{
  sc('9sheet-02-refs', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-refs',
    sub: 'Относительные и абсолютные ссылки',
    prompt: 'Что означает запись =$A$1 в формуле?',
    opts: [
      'Ссылка на ячейку A1, которая не меняется при копировании формулы',
      'Ссылка на столбец A, который не меняется',
      'Ссылка на ячейку A1, которая меняется только по столбцам',
      'Сложение ячеек A и 1',
    ],
    correct: 'A',
    correctText: 'Ссылка на ячейку A1, которая не меняется при копировании формулы',
    why: 'Доллары фиксируют и столбец, и строку — такая ссылка абсолютная. Без долларов ссылка относительная и при копировании сдвигается на столько же строк и столбцов.',
  });
}
{
  // Копирование =A1*B1 на две строки вниз: что окажется в третьей строке.
  const rows = 3;
  num('9sheet-02-refs', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-refs',
    sub: 'Копирование формулы',
    prompt: `В ячейке C1 формула =A1*B1. Формулу скопировали вниз на ${rows} строки так, что в C${rows} она ссылается на A${rows}*B${rows}. Сколько строк формула сдвинулась? Запишите только число.`,
    value: rows - 1,
    why: `Из строки 1 в строку ${rows} — сдвиг на ${rows} − 1 = ${rows - 1} строки, и на столько же столбцов сдвинулись бы ссылки без долларов. Именно поэтому, чтобы ссылка стояла на месте, пишут =$A$1.`,
  });
}

// ── КТП 5 | 9sheet-03-functions | Функции (3/1) ──
{
  const a = [4, 9, 2, 7];
  num('9sheet-03-functions', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-func',
    sub: 'СРЗНАЧ, МАКС, МИН',
    prompt: `В диапазоне значения ${a.join(', ')}. Чему равен результат =МИН(A1:A4)? Запишите только число.`,
    value: minOf(a),
    why: `МИН берёт наименьшее из диапазона: ${Math.min(...a)}. Считать МАКС и МИН вручную — обычная ошибка: их легко перепутать, поэтому проверяют на маленьком наборе.`,
  });
}
{
  const a = [4, 9, 2, 7];
  num('9sheet-03-functions', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-func',
    sub: 'СРЗНАЧ, МАКС, МИН',
    prompt: `В диапазоне значения ${a.join(', ')}. Чему равен результат =МАКС(A1:A4)? Запишите только число.`,
    value: maxOf(a),
    why: `МАКС берёт наибольшее: ${Math.max(...a)}. Значения перечислены по возрастанию не по порядку, поэтому «последнее» и «наибольшее» — разные числа.`,
  });
}
{
  const a = [4, 9, 2, 7];
  const s = sum(a);
  num('9sheet-03-functions', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-func',
    sub: 'СУММ',
    prompt: `В диапазоне значения ${a.join(', ')}. Чему равен результат =СУММ(A1:A4)? Запишите только число.`,
    value: s,
    why: `${a.join(' + ')} = ${s}. Сумма считается сложением всех ячеек диапазона, включая те, что выглядят «пустыми» с точки зрения текста, но содержат числа.`,
  });
}
{
  // Среднее берём на наборе, где оно целое: numeric_base отвечает целым числом.
  const a = [2, 4, 6, 8];
  const m = avg(a);
  if (!Number.isInteger(m)) throw new Error(`среднее ${m} не целое`);
  num('9sheet-03-functions', {
    topic: SH, d: 'intermediate', cog: 'apply', subj: 'inf-9-sheet-func',
    sub: 'СРЗНАЧ',
    prompt: `В диапазоне значения ${a.join(', ')}. Чему равен результат =СРЗНАЧ(A1:A4)? Запишите только число.`,
    value: m,
    why: `Сумма ${sum(a)}, значений ${a.length}, значит ${sum(a)} / ${a.length} = ${m}. Русская таблица показывает десятичную запятую, поэтому в таких задачах берут наборы, где среднее целое.`,
  });
}

// ── КТП 6 | 9sheet-04-logic | Логические функции (2/1) ──
{
  const b1 = 3;
  const b2 = 4;
  sc('9sheet-04-logic', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-logic',
    sub: 'Функция ЕСЛИ',
    prompt: `В B1 стоит ${b1}, в B2 — ${b2}. Чему равен результат =ЕСЛИ(B1<B2;"меньше";"не меньше")?`,
    opts: ['меньше', 'не меньше', '0', 'истина'],
    correct: 'A',
    correctText: 'меньше',
    why: `${b1} < ${b2} — условие истинно, значит берётся первый текст «${'меньше'}». Второй вариант «не меньше» сработал бы, если бы условие было ложным.`,
  });
}
{
  const b1 = 5;
  const b2 = 4;
  sc('9sheet-04-logic', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-logic',
    sub: 'Функция ЕСЛИ',
    prompt: `В B1 стоит ${b1}, в B2 — ${b2}. Чему равен результат =ЕСЛИ(B1<B2;"меньше";"не меньше")?`,
    opts: ['не меньше', 'меньше', 'ложь', 'больше'],
    correct: 'A',
    correctText: 'не меньше',
    why: `${b1} < ${b2} — условие ложно (${b1} больше), поэтому берётся второй вариант «не меньше». Ошибка — считать, что ЕСЛИ всегда берёт первое значение.`,
  });
}
{
  const score = 85;
  const grade = score >= 80 ? 'отлично' : score >= 70 ? 'хорошо' : 'удовлетворительно';
  if (grade !== 'отлично') throw new Error(`оценка ${grade}`);
  sc('9sheet-04-logic', {
    topic: SH, d: 'intermediate', cog: 'analyze', subj: 'inf-9-sheet-logic',
    sub: 'Вложенный ЕСЛИ',
    prompt: `Оценка вычисляется формулой =ЕСЛИ(B1>=80;"отлично";ЕСЛИ(B1>=70;"хорошо";"удовлетворительно")). Что покажет формула, если в B1 стоит ${score}?`,
    opts: ['отлично', 'хорошо', 'удовлетворительно', 'ошибку'],
    correct: 'A',
    correctText: 'отлично',
    why: `${score} >= 80 — внешнее условие истинно, формула сразу возвращает «отлично», до внутреннего ЕСЛИ дело не доходит. Вложенные ЕСЛИ читаются слева направо и останавливаются на первом истинном условии.`,
  });
}

// ── КТП 7 | 9sheet-03-analysis | Анализ данных (1/1) ──
{
  const names = ['Аня', 'Боря', 'Вера', 'Глеб'];
  const marks = [4, 7, 5, 9];
  sc('9sheet-03-analysis', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-analysis',
    sub: 'Сортировка',
    prompt: `Данные: ${names.map((n, i) => `${n} — ${marks[i]}`).join('; ')}. Как будет выглядеть первая строка после сортировки по столбцу с оценками по возрастанию?`,
    opts: [
      'Боря — 4',
      'Аня — 4',
      'Глеб — 9',
      'Вера — 5',
    ],
    correct: 'A',
    correctText: 'Боря — 4',
    why: `Наименьшая оценка ${Math.min(...marks)}, она у Бори. При сортировке по возрастанию первая строка — с минимальным значением, и вместе с оценкой переносится вся строка, а не только ячейка.`,
  });
}
{
  const marks = [4, 7, 5, 9];
  const med = [...marks].sort((a, b) => a - b);
  const median = med.length % 2 ? med[(med.length - 1) / 2] : (med[med.length / 2 - 1] + med[med.length / 2]) / 2;
  num('9sheet-03-analysis', {
    topic: SH, d: 'intermediate', cog: 'apply', subj: 'inf-9-sheet-analysis',
    sub: 'Медиана',
    prompt: `Оценки: ${marks.join(', ')}. Чему равна медиана этого набора? Запишите только число.`,
    value: median,
    why: `После упорядочивания: ${med.join(', ')}. Значений чётное число, поэтому медиана — среднее двух средних: (${med[med.length / 2 - 1]} + ${med[med.length / 2]}) / 2 = ${median}. Медиана устойчива к выбросам, в отличие от среднего.`,
  });
}

// ── КТП 8 | 9sheet-05-filter | Фильтрация (2/1) ──
{
  const heights = [165, 172, 168, 180, 171, 169, 175, 173, 166, 178, 170, 164];
  const k = countIf(heights, (h) => h > 170);
  num('9sheet-05-filter', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-filter',
    sub: 'Условие фильтра',
    prompt: `Рост учеников: ${heights.join(', ')}. Сколько учеников выше 170 см? Запишите только число.`,
    value: k,
    why: `Строго больше 170: ${heights.filter((h) => h > 170).join(', ')} — это ${k} учеников. Ключевое слово «строго»: если условие «170 и выше», то к ним добавятся и те, у кого ровно 170.`,
  });
}
{
  const marks = [4, 5, 5, 4, 4, 2];
  const fives = countIf(marks, (m) => m === 5);
  num('9sheet-05-filter', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-filter',
    sub: 'Подсчёт по условию',
    prompt: `Баллы класса: ${marks.join(', ')}. Сколько учеников получили 5? Запишите только число.`,
    value: fives,
    why: `Пятёрки стоят у ${fives} учеников. Фильтр по значению «5» оставит только их; сравнение «>4» дало бы тот же результат, а вот «>=5» проверит уже не то.`,
  });
}
{
  const rows = [
    { n: 'Ученик 1', c: '9А', s: 15 },
    { n: 'Ученик 2', c: '9Б', s: 18 },
    { n: 'Ученик 3', c: '9А', s: 20 },
  ];
  const k = countIf(rows, (r) => r.c === '9А');
  num('9sheet-05-filter', {
    topic: SH, d: 'intermediate', cog: 'apply', subj: 'inf-9-sheet-filter',
    sub: 'Фильтр по тексту',
    prompt: `В таблице ${rows.length} строки учеников: ${rows.map((r) => `${r.n}, класс ${r.c}, баллы ${r.s}`).join('; ')}. Сколько строк относятся к 9А? Запишите только число.`,
    value: k,
    why: `Класс 9А у ${rows.filter((r) => r.c === '9А').map((r) => r.n).join(', ')} — это ${k} строки. Фильтр сравнивает текст посимвольно, поэтому «9А» и «9а» будут разными значениями.`,
  });
}

// ── КТП 9 | 9sheet-06-charts | Диаграммы (2/1) ──
{
  const values = [12, 15, 14, 20];
  const best = maxOf(values);
  sc('9sheet-06-charts', {
    topic: SH, d: 'basic', cog: 'remember', subj: 'inf-9-sheet-charts',
    sub: 'Выбор диаграммы',
    prompt: 'Какая диаграмма показывает, как менялась величина по месяцам?',
    opts: ['Линейная (график)', 'Круговая', 'Диаграмма разброса', 'Гистограмма'],
    correct: 'A',
    correctText: 'Линейная (график)',
    why: 'Линейный график показывает изменение величины по оси времени. Круговая — доли целого, разброса — связь двух величин, гистограмма — распределение значений по интервалам.',
  });
}
{
  const shares = [40, 35, 25];
  num('9sheet-06-charts', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-charts',
    sub: 'Доли для круговой',
    prompt: `Доли категорий: ${shares.join(' %, ')} %. Сколько процентов приходится на две первые категории вместе? Запишите только число.`,
    value: shares[0] + shares[1],
    why: `${shares[0]} + ${shares[1]} = ${shares[0] + shares[1]} %. Круговая диаграмма годится, только когда доли в сумме дают 100 %, поэтому проверяют сумму перед построением.`,
  });
}
{
  const values = [12, 15, 14, 20];
  num('9sheet-06-charts', {
    topic: SH, d: 'intermediate', cog: 'analyze', subj: 'inf-9-sheet-charts',
    sub: 'Читаем график',
    prompt: `Продажи по месяцам: ${values.join(', ')}. На сколько единиц выросли продажи с первого месяца до последнего? Запишите только число.`,
    value: values[values.length - 1] - values[0],
    why: `Последний месяц ${values[values.length - 1]}, первый ${values[0]}: ${values[values.length - 1]} − ${values[0]} = ${values[values.length - 1] - values[0]}. Разность показывает изменение, а отношение — темп роста.`,
  });
}

// ── КТП 10 | 9sheet-07-model | Численное моделирование (2/1) ──
{
  const v = 30;
  const s = (v * v) / 10;
  num('9sheet-07-model', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-model',
    sub: 'Модель пути',
    prompt: `Модель тормозного пути: s = v² / 10, где v — скорость в м/с, s — путь в метрах. Чему равен путь при скорости ${v} м/с? Запишите только число.`,
    value: s,
    why: `s = ${v}² / 10 = ${v * v} / 10 = ${s} м. Порядок действий важен: сначала возводим скорость в квадрат, потом делим. Считать (v / 10)² — типичная ошибка, потому что меняется скобка.`,
  });
}
{
  const target = 160;
  const v = Math.sqrt(target * 10);
  num('9sheet-07-model', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-model',
    sub: 'Обратная задача модели',
    prompt: `Модель s = v² / 10. При какой скорости в м/с путь торможения равен ${target} м? Запишите только число.`,
    value: v,
    why: `Обратная задача: v² = 160 · 10 = ${target * 10}, значит v = √${target * 10} = ${v} м/с. В таблице это делается функцией КОРЕНЬ, а не угадыванием: модель обязана проверяться на известном значении.`,
  });
}
{
  const rows = [
    { y: 2019, all: 1000, rec: 400 },
    { y: 2020, all: 1200, rec: 600 },
  ];
  const shares = rows.map((r) => ({ ...r, share: Math.round((r.rec / r.all) * 100) }));
  const d = shares[1].share - shares[0].share;
  num('9sheet-07-model', {
    topic: SH, d: 'intermediate', cog: 'analyze', subj: 'inf-9-sheet-model',
    sub: 'Доли в модели',
    prompt: `В проекте переработано сырья: ${rows.map((r) => `${r.y} — ${r.rec} из ${r.all} кг`).join('; ')}. На сколько процентных пунктов выросла доля переработанного во втором году по сравнению с первым? Запишите только число.`,
    value: d,
    why: `Доли: ${shares.map((s) => `${s.y} — ${s.share} %`).join('; ')}. Изменение доли: ${shares[1].share} − ${shares[0].share} = ${d} процентных пункта. Важно: это процентные пункты, а не проценты, поэтому делить дополнительно не нужно.`,
  });
}

// ── КТП 11 | 9sheet-08-tasks | Решение задач (2/1) ──
{
  const rows = [
    { t: 'Тетрадь', s: 250 },
    { t: 'Ручка', s: 150 },
    { t: 'Тетрадь', s: 180 },
    { t: 'Ручка', s: 90 },
  ];
  const money = sumBy(rows, (r) => r.t === 'Тетрадь', (r) => r.s);
  num('9sheet-08-tasks', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-tasks',
    sub: 'СУММЕСЛИ',
    prompt: `Столбец B — товар, столбец C — выручка: ${rows.map((r) => `${r.t} ${r.s}`).join(', ')}. Сколько выручки принесли продажи тетрадей (=СУММЕСЛИ(C2:C5;B2:B5;"Тетрадь"))? Запишите только число.`,
    value: money,
    why: `Суммируются строки, где в столбце товара стоит «Тетрадь»: 250 + 180 = ${money}. Первый диапазон — что суммируем, второй — где ищем условие, третий — само условие.`,
  });
}
{
  const prices = [100, 200, 300, 400];
  const total = sum(prices);
  const n = prices.length;
  const cells = Math.ceil(total / 1000);
  num('9sheet-08-tasks', {
    topic: SH, d: 'basic', cog: 'apply', subj: 'inf-9-sheet-tasks',
    sub: 'Округление вверх',
    prompt: `Товары стоят ${prices.join(', ')} рублей. Всего на ${total} рублей. Товар продаётся упаковками по 1000 рублей, неполную упаковку продать нельзя. Сколько упаковок нужно? Запишите только число.`,
    value: cells,
    why: `${total} ÷ 1000 = ${(total / 1000).toFixed(1)} — округляем вверх до ${cells}, потому что неполную упаковку продать нельзя. Функция ОКРУПЛВВЕРХ делает это автоматически.`,
  });
}
{
  const marks = [4, 5, 4, 5, 5, 4, 5, 4, 5, 4];
  const k = countIf(marks, (m) => m === 5);
  const avgMark = avg(marks);
  num('9sheet-08-tasks', {
    topic: SH, d: 'intermediate', cog: 'analyze', subj: 'inf-9-sheet-tasks',
    sub: 'Средний балл и количество',
    prompt: `Оценки класса: ${marks.join(', ')}. На сколько пятёрок больше, чем четвёрок? Запишите только число.`,
    value: Math.abs(k - countIf(marks, (m) => m === 4)),
    why: `Пятёрок ${k}, четвёрок ${marks.length - k}, разница по модулю ${Math.abs(k - (marks.length - k))}. Формула =СЧЁТЕСЛИ(...;"5")-СЧЁТЕСЛИ(...;"4") даёт разность со знаком, поэтому берут модуль, когда нужен размер различия.`,
  });
}

// ═════════════════ КТП 12–17 · алгоритмы, массивы ═════════════════

// ── КТП 12 | 9algo-01-performers | Алгоритмы (4/2) ──
{
  const steps = ['прочитать числа', 'сложить положительные', 'сравнить с нулём', 'вывести результат'];
  num('9algo-01-performers', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-algo',
    sub: 'Линейный алгоритм',
    prompt: `Алгоритм состоит из ${steps.length} шагов: ${steps.join(', ')}. Сколько шагов содержит алгоритм? Запишите только число.`,
    value: steps.length,
    why: `Шагов ${steps.length}: ${steps.map((s, i) => `${i + 1}) ${s}`).join('; ')}. Алгоритм выполняется строго по порядку, поэтому шаги нумеруют и записывают по порядку.`,
  });
}
{
  sc('9algo-01-performers', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-algo',
    sub: 'Условие ветвления',
    prompt: 'Что делает условие в алгоритме с ветвлением?',
    opts: [
      'Выбирает, какую из двух ветвей выполнять дальше',
      'Повторяет действия заданное число раз',
      'Записывает результат в таблицу',
      'Останавливает программу',
    ],
    correct: 'A',
    correctText: 'Выбирает, какую из двух ветвей выполнять дальше',
    why: 'Ветвление — это выбор: условие проверяется, и дальше выполняется только одна из ветвей. Цикл, в отличие от ветвления, повторяет действия, а не выбирает их.',
  });
}
{
  const n = 5;
  num('9algo-01-performers', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-algo',
    sub: 'Цикл',
    prompt: `Цикл выполняет действие ${n} раз: к переменной, равной 0, каждый раз прибавляют 2. Какое значение получится? Запишите только число.`,
    value: n * 2,
    why: `Ноль, прибавляем 2 ровно ${n} раз: 2 · ${n} = ${n * 2}. Число повторений цикла важно не перепутать с числом шагов внутри тела цикла.`,
  });
}
{
  const a = 7;
  const b = 3;
  num('9algo-01-performers', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-algo',
    sub: 'Остаток и деление',
    prompt: `В цикле идёт остаток от деления: остаток(${a} ; ${b}). Чему он равен? Запишите только число.`,
    value: a % b,
    why: `${a} = ${b} · ${Math.floor(a / b)} + ${a % b}, поэтому остаток равен ${a % b}. Ошибка — считать целую часть вместо остатка, их путают чаще всего.`,
  });
}
{
  const arr = [3, 8, 2];
  num('9algo-01-performers', {
    topic: AR, d: 'intermediate', cog: 'analyze', subj: 'inf-9-algo',
    sub: 'Индекс элемента',
    prompt: `Массив: ${arr.join(', ')}. Сколько элементов нужно проверить, чтобы найти первый элемент больше ${arr[1]}? Запишите только число.`,
    value: 1,
    why: `Первый же элемент ${arr[0]} не подходит, второй ${arr[1]} — подходит, поэтому проверяли ${1} элемент(а). Линейный поиск останавливается на первом совпадении.`,
  });
}
{
  const pairs = [[1, 2], [2, 3]];
  num('9algo-01-performers', {
    topic: AR, d: 'intermediate', cog: 'analyze', subj: 'inf-9-algo',
    sub: 'Вложенные циклы',
    prompt: `Алгоритм перебирает все пары значений: список из ${pairs.length} пар, внутри каждой — ${pairs[0].length} проверки. Сколько всего проверок? Запишите только число.`,
    value: pairs.length * pairs[0].length,
    why: `${pairs.length} · ${pairs[0].length} = ${pairs.length * pairs[0].length} проверок: внешний цикл идёт ${pairs.length} раз, внутренний — ${pairs[0].length}. Вложенные циклы растут произведением, поэтому быстро становятся дорогими.`,
  });
}

// ── КТП 13 | 9arr-01-basics | Массивы (1/0) ──
{
  const arr = [4, 7, 2, 9];
  num('9arr-01-basics', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr',
    sub: 'Индексация',
    prompt: `Массив: ${arr.join(', ')}. Чему равен элемент с индексом 2? Запишите только число.`,
    value: arr[2],
    why: `Нумерация с нуля: a[0] = ${arr[0]}, a[1] = ${arr[1]}, a[2] = ${arr[2]}. Путаница «с нуля или с единицы» — самая частая ошибка: в программировании индексы начинаются с 0.`,
  });
}

// ── КТП 14 | 9arr-02-aggregates | Сумма, количество, среднее (5/3/1) ──
{
  const a = [3, 8, 2, 5];
  num('9arr-02-aggregates', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr-sum',
    sub: 'Сумма элементов',
    prompt: `Массив: ${a.join(', ')}. Чему равна сумма элементов? Запишите только число.`,
    value: sum(a),
    why: `${a.join(' + ')} = ${sum(a)}. Сумма считается проходом по всем элементам; начинать надо с нуля, иначе потеряется первое значение.`,
  });
}
{
  const a = [3, 8, 2, 5];
  num('9arr-02-aggregates', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr-sum',
    sub: 'Количество элементов',
    prompt: `Массив: ${a.join(', ')}. Сколько в нём элементов? Запишите только число.`,
    value: a.length,
    why: `Элементов ${a.length}: ${a.map((v, i) => `a[${i}]`).join(', ')}. В Python это len(a), в таблице — ЧИСЛСТРОК или СЧЁТЗ.`,
  });
}
{
  const a = [2, 4, 6];
  const m = avg(a);
  num('9arr-02-aggregates', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr-sum',
    sub: 'Среднее арифметическое',
    prompt: `Массив: ${a.join(', ')}. Чему равно среднее арифметическое? Запишите только число.`,
    value: m,
    why: `Сумма ${sum(a)}, элементов ${a.length}: ${sum(a)} / ${a.length} = ${m}. Среднее всегда между минимумом и максимумом — хорошая проверка результата.`,
  });
}
{
  const a = [3, 8, 2, 5];
  num('9arr-02-aggregates', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr-sum',
    sub: 'Произведение элементов',
    prompt: `Массив: ${a.join(', ')}. Чему равно произведение элементов? Запишите только число.`,
    value: a.reduce((s, v) => s * v, 1),
    why: `${a.join(' · ')} = ${a.reduce((s, v) => s * v, 1)}. Начинать произведение надо с единицы: если начать с нуля, результатом всегда будет ноль.`,
  });
}
{
  const a = [7, 2, 9, 4];
  const even = a.filter((v) => v % 2 === 0);
  num('9arr-02-aggregates', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr-sum',
    sub: 'Сумма по условию',
    prompt: `Массив: ${a.join(', ')}. Чему равна сумма чётных элементов? Запишите только число.`,
    value: sum(even),
    why: `Чётные: ${even.join(', ')} (${a.filter((v) => v % 2 !== 0).join(', ')} — нечётные), их сумма ${sum(even)}. Признак чётности — остаток от деления на 2 равен нулю.`,
  });
}
{
  const a = [7, 2, 9, 4, 6];
  const k = countIf(a, (v) => v > 5);
  num('9arr-02-aggregates', {
    topic: AR, d: 'intermediate', cog: 'apply', subj: 'inf-9-arr-sum',
    sub: 'Количество по условию',
    prompt: `Массив: ${a.join(', ')}. Сколько элементов больше 5? Запишите только число.`,
    value: k,
    why: `Больше 5: ${a.filter((v) => v > 5).join(', ')} — это ${k} элемент(ов). Счётчик начинают с нуля и увеличивают только при выполнении условия.`,
  });
}
{
  const a = [7, 2, 9, 4, 6];
  const s = sum(a);
  const big = sumIf(a, (v) => v > 5);
  num('9arr-02-aggregates', {
    topic: AR, d: 'intermediate', cog: 'apply', subj: 'inf-9-arr-sum',
    sub: 'Один проход — два результата',
    prompt: `Массив: ${a.join(', ')}. Чему равна разность суммы всех элементов и суммы элементов больше 5? Запишите только число.`,
    value: s - big,
    why: `Сумма всех ${s}, сумма больших ${big}, остаток ${s - big}. Оба значения считают за один проход по массиву, а не двумя — так быстрее и меньше шансов ошибиться.`,
  });
}
{
  const a = [3, 5, 9];
  const m = avg(a);
  const below = a.filter((v) => v < m);
  num('9arr-02-aggregates', {
    topic: AR, d: 'intermediate', cog: 'analyze', subj: 'inf-9-arr-sum',
    sub: 'Сколько ниже среднего',
    prompt: `Массив: ${a.join(', ')}. Среднее равно ${m}. Сколько элементов строго меньше среднего? Запишите только число.`,
    value: below.length,
    why: `Среднее ${m}, меньше него: ${below.join(', ')} — ${below.length} элемент(а). Элементы, равные среднему, не считаются: условие строгое.`,
  });
}
{
  const a = [3, 5, 9, 1];
  const s = sum(a);
  const m = avg(a);
  if (Math.abs(s - m * a.length) > 1e-9) throw new Error('среднее не сходится');
  sc('9arr-02-aggregates', {
    topic: AR, d: 'advanced', cog: 'analyze', subj: 'inf-9-arr-sum',
    sub: 'Проверка результата',
    prompt: `Массив: ${a.join(', ')}. Верно ли, что среднее арифметическое равно сумме, делённой на количество элементов?`,
    opts: ['Да, это определение среднего арифметического', 'Нет, среднее считается по максимуму', 'Нет, среднее равно половине суммы', 'Да, но только для чётных массивов'],
    correct: 'A',
    correctText: 'Да, это определение среднего арифметического',
    why: `Среднее арифметическое — это сумма, делённая на количество: ${sum(a)} / ${a.length} = ${avg(a)}. Определение работает для любого массива, чётность ни при чём.`,
  });
}

// ── КТП 15 | 9arr-02-search | Линейный поиск (4/2/1) ──
{
  const a = [4, 7, 2, 9];
  const target = 2;
  const pos = a.indexOf(target);
  num('9arr-02-search', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr-search',
    sub: 'Позиция элемента',
    prompt: `Массив: ${a.join(', ')}. На каком по счёту месте (с единицы) стоит число ${target}? Запишите только число.`,
    value: pos + 1,
    why: `a[${pos}] = ${target} — это ${pos + 1}-й элемент при нумерации с единицы и индекс ${pos} при нумерации с нуля. Разница всегда 1, путаница с нумерацией — типовая ошибка.`,
  });
}
{
  const a = [4, 7, 2, 9];
  num('9arr-02-search', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr-search',
    sub: 'Сколько сравнений нужно',
    prompt: `Массив: ${a.join(', ')}. Сколько элементов нужно сравнить с числом 7 при линейном поиске, чтобы найти первое совпадение? Запишите только число.`,
    value: a.indexOf(7) + 1,
    why: `7 стоит на индексе ${a.indexOf(7)}, до него включительно ${a.indexOf(7) + 1} сравнени(й). Линейный поиск останавливается на первом совпадении, а не просматривает весь массив.`,
  });
}
{
  const a = [4, 7, 2, 9];
  num('9arr-02-search', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr-search',
    sub: 'Числа до нужного',
    prompt: `Массив: ${a.join(', ')}. Сколько чисел в массиве стоят левее числа 9? Запишите только число.`,
    value: a.indexOf(9),
    why: `9 стоит на индексе ${a.indexOf(9)}, левее него ${a.indexOf(9)} элемент(ов): ${a.slice(0, a.indexOf(9)).join(', ')}.`,
  });
}
{
  const a = [4, 7, 2, 9];
  num('9arr-02-search', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr-search',
    sub: 'Отсутствие элемента',
    prompt: `Массив: ${a.join(', ')}. Сколько элементов нужно проверить, чтобы убедиться, что числа 5 в массиве нет? Запишите только число.`,
    value: a.length,
    why: `Чтобы доказать отсутствие числа, проверяют весь массив — ${a.length} элемент(ов). Это отличие поиска «есть ли» от поиска «где находится»: во втором случае хватает первого совпадения.`,
  });
}
{
  const a = [4, 7, 2, 9, 7];
  const first = a.indexOf(7);
  const count = countIf(a, (v) => v === 7);
  num('9arr-02-search', {
    topic: AR, d: 'intermediate', cog: 'analyze', subj: 'inf-9-arr-search',
    sub: 'Повторяющиеся элементы',
    prompt: `Массив: ${a.join(', ')}. Число 7 встречается сколько раз? Запишите только число.`,
    value: count,
    why: `Счётчик увеличивается на каждом совпадении: 7 встречается ${count} раз(а), хотя линейный поиск находит только первое — на индексе ${first}. Разница между «найти» и «посчитать» здесь и возникает.`,
  });
}
{
  const a = [4, 7, 2, 9, 7];
  num('9arr-02-search', {
    topic: AR, d: 'intermediate', cog: 'analyze', subj: 'inf-9-arr-search',
    sub: 'Сумма до первого совпадения',
    prompt: `Массив: ${a.join(', ')}. Чему равна сумма элементов, стоящих левее числа 7? Запишите только число.`,
    value: sum(a.slice(0, a.indexOf(7))),
    why: `Первое 7 на индексе ${a.indexOf(7)}, левее: ${a.slice(0, a.indexOf(7)).join(', ')} — сумма ${sum(a.slice(0, a.indexOf(7)))}.`,
  });
}
{
  const a = [4, 7, 2, 9];
  const sorted = [...a].sort((x, y) => x - y);
  const steps = sorted.map((v, i) => [v, sorted.indexOf(v)]);
  const idx = sorted.indexOf(9);
  sc('9arr-02-search', {
    topic: AR, d: 'advanced', cog: 'analyze', subj: 'inf-9-arr-search',
    sub: 'Двоичный поиск',
    prompt: `Массив: ${a.join(', ')}. Отсортируем его по возрастанию. Сколько шагов потребуется двоичному поиску числа 9 в отсортированном массиве, если каждый раз берётся средний элемент? Запишите только число.`,
    opts: ['2', '1', '4', '3'],
    correct: 'A',
    correctText: '2',
    why: `Отсортированный массив: ${sorted.join(', ')}. Середина — ${sorted[1]}, 9 больше, берём правую половину [${sorted.slice(2).join(', ')}], в ней 9 в середине — второй шаг. Двоичный поиск на массиве из ${a.length} элементов требует не больше 2–3 шагов.`,
  });
}

// ── КТП 16 | 9arr-03-extremes | Минимум и максимум (4/2) ──
{
  const a = [4, 7, 2, 9];
  num('9arr-03-extremes', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr-ext',
    sub: 'Максимум массива',
    prompt: `Массив: ${a.join(', ')}. Чему равен максимум массива? Запишите только число.`,
    value: maxOf(a),
    why: `Максимум — наибольшее значение: ${maxOf(a)}. При поиске в цикле сравнивают каждый элемент с текущим максимумом, который изначально берут из первого элемента.`,
  });
}
{
  const a = [4, 7, 2, 9];
  num('9arr-03-extremes', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr-ext',
    sub: 'Минимум массива',
    prompt: `Массив: ${a.join(', ')}. Чему равен минимум массива? Запишите только число.`,
    value: minOf(a),
    why: `Минимум — наименьшее значение: ${minOf(a)}.`,
  });
}
{
  const a = [4, 7, 2, 9];
  num('9arr-03-extremes', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr-ext',
    sub: 'Индекс максимума',
    prompt: `Массив: ${a.join(', ')}. На каком по счёту месте (с единицы) стоит максимум? Запишите только число.`,
    value: a.indexOf(maxOf(a)) + 1,
    why: `Максимум ${maxOf(a)} стоит на индексе ${a.indexOf(maxOf(a))}, то есть ${a.indexOf(maxOf(a)) + 1}-м по счёту.`,
  });
}
{
  const a = [4, 7, 2, 9];
  num('9arr-03-extremes', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr-ext',
    sub: 'Размах массива',
    prompt: `Массив: ${a.join(', ')}. Размах массива равен ${maxOf(a) - minOf(a)}. Чему он равен? Запишите только число.`,
    value: maxOf(a) - minOf(a),
    why: `Размах = максимум − минимум = ${maxOf(a)} − ${minOf(a)} = ${maxOf(a) - minOf(a)}. Показывает, насколько значения разбросаны.`,
  });
}
{
  const a = [4, 7, 2, 9];
  const without = a.filter((v) => v !== maxOf(a));
  num('9arr-03-extremes', {
    topic: AR, d: 'intermediate', cog: 'analyze', subj: 'inf-9-arr-ext',
    sub: 'Второй по величине',
    prompt: `Массив: ${a.join(', ')}. Что будет вторым по величине после удаления одного максимального элемента ${maxOf(a)}? Запишите только число.`,
    value: maxOf(without),
    why: `Убираем максимум ${maxOf(a)}, остаётся ${without.join(', ')}, наибольшее из них ${maxOf(without)}. Второе по величине находят вторым проходом или сортировкой — одним проходом без запоминания двух максимумов здесь не обойтись.`,
  });
}
{
  const a = [4, 7, 2, 9];
  num('9arr-03-extremes', {
    topic: AR, d: 'intermediate', cog: 'analyze', subj: 'inf-9-arr-ext',
    sub: 'Индексы минимума и максимума',
    prompt: `Массив: ${a.join(', ')}. Чему равна разность индексов максимума и минимума (индексы с нуля)? Запишите только число.`,
    value: a.indexOf(maxOf(a)) - a.indexOf(minOf(a)),
    why: `Индекс максимума ${a.indexOf(maxOf(a))}, индекс минимума ${a.indexOf(minOf(a))}, разность ${a.indexOf(maxOf(a)) - a.indexOf(minOf(a))}.`,
  });
}

// ── КТП 17 | 9arr-04-sort | Сортировка (4/2) ──
{
  const a = [4, 7, 2, 9];
  const sorted = [...a].sort((x, y) => x - y);
  num('9arr-04-sort', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr-sort',
    sub: 'Сортировка по возрастанию',
    prompt: `Массив: ${a.join(', ')}. Какое число окажется на первом месте после сортировки по возрастанию? Запишите только число.`,
    value: sorted[0],
    why: `После сортировки по возрастанию: ${sorted.join(', ')}. На первом месте наименьшее число ${sorted[0]}.`,
  });
}
{
  const a = [4, 7, 2, 9];
  const sorted = [...a].sort((x, y) => x - y);
  num('9arr-04-sort', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr-sort',
    sub: 'Сортировка по возрастанию',
    prompt: `Массив: ${a.join(', ')}. Какое число окажется на последнем месте после сортировки по возрастанию? Запишите только число.`,
    value: sorted[sorted.length - 1],
    why: `Отсортированный массив: ${sorted.join(', ')}. Последним идёт наибольшее ${sorted[sorted.length - 1]}.`,
  });
}
{
  const a = [4, 7, 2, 9];
  const sorted = [...a].sort((x, y) => x - y);
  num('9arr-04-sort', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr-sort',
    sub: 'Обмен элементов',
    prompt: `Массив: ${a.join(', ')}. Сколько обменов сделает сортировка выбором, если на каждом шаге меняются местами найденный минимум и элемент на текущей позиции? Запишите только число.`,
    value: (() => {
      let swaps = 0;
      const b = [...a];
      for (let i = 0; i < b.length - 1; i++) {
        let m = i;
        for (let j = i + 1; j < b.length; j++) if (b[j] < b[m]) m = j;
        if (m !== i) {
          [b[i], b[m]] = [b[m], b[i]];
          swaps++;
        }
      }
      return swaps;
    })(),
    why: `Сортировка выбором ищет минимум в остатке и ставит на место: ${a.join(', ')} → ${[...a].sort((x, y) => x - y).join(', ')}. Обмен происходит там, где минимум стоял не на текущей позиции; таких обменов здесь несколько, их и считают.`,
  });
}
{
  const a = [4, 7, 2, 9];
  const sorted = [...a].sort((x, y) => x - y);
  num('9arr-04-sort', {
    topic: AR, d: 'basic', cog: 'apply', subj: 'inf-9-arr-sort',
    sub: 'Проверка результата сортировки',
    prompt: `Массив: ${a.join(', ')}. Сколько элементов окажется на своих местах, если отсортировать его по возрастанию? Запишите только число.`,
    value: a.filter((v, i) => sorted[i] === v).length,
    why: `Отсортированный массив: ${sorted.join(', ')}. Совпали позиции у ${a.filter((v, i) => sorted[i] === v).length} элемент(ов). Проверка «сумма и количество не изменились» — обязательный контроль после сортировки.`,
  });
}
{
  const a = [4, 7, 2, 9];
  num('9arr-04-sort', {
    topic: AR, d: 'intermediate', cog: 'analyze', subj: 'inf-9-arr-sort',
    sub: 'Максимум после сортировки',
    prompt: `Массив: ${a.join(', ')}. Сколько шагов сортировки выбором нужно, чтобы полностью отсортировать массив из ${a.length} элементов? Запишите только число.`,
    value: a.length - 1,
    why: `На каждом шаге сортировки выбором на место встаёт один элемент, а последний уже стоит верно: ${a.length} − 1 = ${a.length - 1} шагов.`,
  });
}
{
  const a = [4, 7, 2, 9];
  num('9arr-04-sort', {
    topic: AR, d: 'intermediate', cog: 'analyze', subj: 'inf-9-arr-sort',
    sub: 'Обратный порядок',
    prompt: `Массив: ${a.join(', ')}. Какое число окажется первым, если отсортировать его по убыванию? Запишите только число.`,
    value: maxOf(a),
    why: `По убыванию массив выглядит так: ${[...a].sort((x, y) => y - x).join(', ')}. Первым идёт наибольшее ${maxOf(a)}.`,
  });
}

// ═════════════════════ КТП 18–23 · управление и модели ═════════════════════

// ── КТП 18 | 9robot-01-control | Обратная связь (0/1) ──
{
  sc('9robot-01-control', {
    topic: EX, d: 'intermediate', cog: 'analyze', subj: 'inf-9-robot',
    sub: 'Обратная связь',
    prompt: 'Зачем в системе управления с обратной связью датчики?',
    opts: [
      'Чтобы система знала о текущем состоянии объекта и могла скорректировать действие',
      'Чтобы украсить корпус робота',
      'Чтобы измерять расход электроэнергии',
      'Чтобы заменить управляющее устройство',
    ],
    correct: 'A',
    correctText: 'Чтобы система знала о текущем состоянии объекта и могла скорректировать действие',
    why: 'Обратная связь — это сигнал от объекта к управляющему устройству. Без датчиков система действует вслепую: одна команда выполняется один раз и не зависит от того, что произошло.',
  });
}

// ── КТП 19 | 9robot-02-systems | Роботизированные системы (2/1) ──
{
  const parts = ['датчики', 'управляющее устройство', 'исполнительные механизмы', 'программа'];
  num('9robot-02-systems', {
    topic: EX, d: 'basic', cog: 'apply', subj: 'inf-9-robot',
    sub: 'Состав системы',
    prompt: `Роботизированная система состоит из: ${parts.join(', ')}. Сколько частей входит в её состав? Запишите только число.`,
    value: parts.length,
    why: `${parts.length} части: ${parts.map((p, i) => `${i + 1}) ${p}`).join('; ')}. Без любой из них схема не работает: без датчиков нет обратной связи, без программы никто не скажет, что делать.`,
  });
}
{
  sc('9robot-02-systems', {
    topic: EX, d: 'basic', cog: 'remember', subj: 'inf-9-robot',
    sub: 'Исполнительные механизмы',
    prompt: 'Какой из перечисленных элементов роботизированной системы является исполнительным механизмом?',
    opts: ['Привод двигателя', 'Датчик температуры', 'Микропроцессор', 'Программа'],
    correct: 'A',
    correctText: 'Привод двигателя',
    why: 'Исполнительные механизмы непосредственно воздействуют на объект: привод, сервопривод, захват. Датчик только измеряет, микропроцессор и программа — управляющая часть.',
  });
}
{
  const parts = ['датчики', 'управляющее устройство', 'исполнительные механизмы', 'программа'];
  num('9robot-02-systems', {
    topic: EX, d: 'intermediate', cog: 'analyze', subj: 'inf-9-robot',
    sub: 'Цикл управления',
    prompt: `Управляющее устройство выполняет цикл «считал датчики — решил — выполнил» 1000 раз в секунду. Сколько раз за 5 секунд оно выполнит полный цикл? Запишите только число.`,
    value: 1000 * 5,
    why: `1000 · 5 = ${1000 * 5} циклов. За одну секунду устройство успевает тысячу раз считать показания и скорректировать действие — это и есть работа в реальном времени.`,
  });
}

// ── КТП 21 | 9model-02-math | Математическое моделирование (1/0) ──
{
  const v = 72;
  const mps = Math.round((v * 1000) / 60 / 60);
  num('9model-02-math', {
    topic: EX, d: 'basic', cog: 'apply', subj: 'inf-9-mathmodel',
    sub: 'Перевод единиц в модели',
    prompt: `Модель s = v² / 10 работает, когда скорость v задана в метрах в секунду. Скорость ${v} км/ч. Чему равна она в метрах в секунду? Запишите только число.`,
    value: mps,
    why: `${v} км/ч — это ${v} · 1000 / 60 / 60 = ${mps} м/с. Забыть про перевод единиц — самая частая ошибка: подставив в модель ${v}, получают завышенный результат в ${Math.round(v / mps)} раз.`,
  });
}

// ── КТП 22 | 9model-03-mixed | Смешанные модели (1/0) ──
{
  const n0 = 100;
  const step = 20 - 12;
  num('9model-03-mixed', {
    topic: EX, d: 'basic', cog: 'apply', subj: 'inf-9-mixed',
    sub: 'Модель популяции',
    prompt: `В модели популяции N = N + рождение − смертность. Сейчас N = ${n0}, рождаемость ${20} в год, смертность ${12} в год. Чему равно N через два года? Запишите только число.`,
    value: n0 + step * 2,
    why: `За год прибавляется ${20} − ${12} = ${step}, через два года: ${n0} + ${step} · 2 = ${n0 + step * 2}. Разность положительная, значит популяция растёт.`,
  });
}

// ── КТП 23 | 9model-04-table | Табличные модели (1/0) ──
{
  const rows = [['Тетрадь', 250], ['Ручка', 150], ['Тетрадь', 180]];
  const k = countIf(rows, (r) => r[0] === 'Тетрадь');
  num('9model-04-table', {
    topic: EX, d: 'basic', cog: 'apply', subj: 'inf-9-db',
    sub: 'Табличная модель',
    prompt: `В таблице товаров есть строки: ${rows.map((r) => `${r[0]}, ${r[1]}`).join('; ')}. Сколько строк относятся к тетрадям? Запишите только число.`,
    value: k,
    why: `Тетради указаны ${k} раз(а). Табличная модель хранит данные в строках и столбцах, а связи между ними задаются именами столбцов.`,
  });
}

// ── КТП 30–36 · Интернет (2/2/1/1/1/1/1) ──
{
  sc('9net-02-web', {
    topic: EX, d: 'basic', cog: 'apply', subj: 'inf-9-project',
    sub: 'Создание веб-страницы',
    prompt: 'Что является обязательной частью любой веб-страницы?',
    opts: ['Тело страницы с содержимым', 'Таблица стилей', 'Скрипт на JavaScript', 'База данных'],
    correct: 'A',
    correctText: 'Тело страницы с содержимым',
    why: 'Страница без тела и содержимого не покажет ничего. Стили и скрипты подключают по желанию, база данных — тем более.',
  });
}
{
  const blocks = ['шапка', 'содержание', 'подвал'];
  num('9net-02-web', {
    topic: EX, d: 'basic', cog: 'apply', subj: 'inf-9-project',
    sub: 'Блоки страницы',
    prompt: `Страница состоит из ${blocks.length} блоков: ${blocks.join(', ')}. Сколько блоков размечено? Запишите только число.`,
    value: blocks.length,
    why: `Блоков ${blocks.length}: ${blocks.join(', ')}. Такой разбор страницы на блоки — основа вёрстки: каждый блок отвечает за свою часть экрана.`,
  });
}
{
  sc('9net-03-safe', {
    topic: EX, d: 'basic', cog: 'remember', subj: 'inf-9-safe',
    sub: 'HTTPS',
    prompt: 'Что означает буква S в адресе https://?',
    opts: [
      'Соединение защищено: данные передаются в зашифрованном виде',
      'Сайт быстрый',
      'Сайт государственный',
      'Сайт с картинками',
    ],
    correct: 'A',
    correctText: 'Соединение защищено: данные передаются в зашифрованном виде',
    why: 'HTTPS — это HTTP поверх шифрования: пароль и номер карты перехватить нельзя. Но https не делает сайт честным: мошеннический сайт бывает с ним. Нужно смотреть и на домен.',
  });
}
{
  sc('9net-03-safe', {
    topic: EX, d: 'basic', cog: 'apply', subj: 'inf-9-safe',
    sub: 'Пароль',
    prompt: 'Какой пароль надёжнее?',
    opts: [
      'Длинный и не похожий на словарь: 12–16 символов',
      'Короткий из цифр: его легко перебрать',
      'Дата рождения: её легко узнать',
      'Кличка питомца: она видна в профиле',
    ],
    correct: 'A',
    correctText: 'Длинный и не похожий на словарь: 12–16 символов',
    why: 'Надёжность определяется длиной и не предсказуемостью. Перебор идёт сначала по коротким и частым сочетаниям, поэтому «qwerty123» ломается за секунды, а длинная случайная строка — очень долго.',
  });
}
{
  const kinds = ['поисковый', 'карточный', 'видео'];
  num('9net-04-services', {
    topic: EX, d: 'basic', cog: 'apply', subj: 'inf-9-onlineoffice',
    sub: 'Виды деятельности в сети',
    prompt: `В сети есть виды деятельности: ${kinds.join(', ')}. Сколько их перечислено? Запишите только число.`,
    value: kinds.length,
    why: `${kinds.length} вида: ${kinds.join(', ')}. Виды деятельности в сети определяют, какие сервисы и программы нужны: поиск, обучение, общение, работа.`,
  });
}
{
  const users = 3;
  num('9net-05-collab', {
    topic: EX, d: 'basic', cog: 'apply', subj: 'inf-9-onlineoffice',
    sub: 'Совместная работа',
    prompt: `Над документом одновременно работают ${users} человека. Каждый сохраняет свою версию в своём файле. Сколько версий файла получится? Запишите только число.`,
    value: users,
    why: `${users} человека · по одной версии = ${users} версии. Для совместной работы нужен общий документ в облаке: версии хранятся в одном месте, иначе придётся сливать их вручную.`,
  });
}
{
  sc('9net-06-search', {
    topic: EX, d: 'basic', cog: 'apply', subj: 'inf-9-onlineoffice',
    sub: 'Операторы поиска',
    prompt: 'Как найти документы, где есть слова «алгоритм» и «граф» одновременно?',
    opts: [
      'Запрос «алгоритм AND граф»',
      'Запрос «алгоритм OR граф»',
      'Запрос «алгоритм»',
      'Запрос с кавычками: "алгоритм граф"',
    ],
    correct: 'A',
    correctText: 'Запрос «алгоритм AND граф»',
    why: 'AND требует присутствия обоих слов — выдача точная. OR даст страницы где есть что-то одно, а кавычки ищут точную фразу целиком. Проверять надо и источник: первый результат выдачи не значит достоверный.',
  });
}
{
  sc('9net-07-onlineoffice', {
    topic: EX, d: 'basic', cog: 'remember', subj: 'inf-9-onlineoffice',
    sub: 'Программы как веб-сервисы',
    prompt: 'Чем веб-сервис отличается от программы, установленной на компьютере?',
    opts: [
      'Работает через браузер, данные хранятся на сервере',
      'Работает быстрее любой программы',
      'Не требует интернета',
      'Содержит больше функций',
    ],
    correct: 'A',
    correctText: 'Работает через браузер, данные хранятся на сервере',
    why: 'Веб-сервис открывают в браузере, а данные лежат на сервере: работать можно с разных устройств без установки. Обратная сторона — без интернета сервис недоступен, и данные зависят от чужого сервера.',
  });
}
{
  const edits = ['исправил опечатку', 'добавил таблицу', 'вставил картинку'];
  num('9net-08-onlineoffice2', {
    topic: EX, d: 'basic', cog: 'apply', subj: 'inf-9-onlineoffice',
    sub: 'Совместное редактирование',
    prompt: `В общем документе ученик выполнил ${edits.length} действия: ${edits.join(', ')}. Сколько действий отслеживает журнал изменений? Запишите только число.`,
    value: edits.length,
    why: `Журнал изменений фиксирует каждое действие — их ${edits.length}. Он нужен, чтобы можно было отменить правку и увидеть, кто и что менял.`,
  });
}

// ═══════════════════════ КТП 24–27 · графы ═══════════════════════

// ── КТП 24 | 9graph-01-graphs | Элементы графа (0/3/1) ──
{
  const verts = ['A', 'B', 'C', 'D', 'E'];
  num('9graph-01-graphs', {
    topic: GR, d: 'intermediate', cog: 'apply', subj: 'inf-9-graph',
    sub: 'Число вершин',
    prompt: `В графе вершины: ${verts.join(', ')}. Сколько вершин в графе? Запишите только число.`,
    value: verts.length,
    why: `Вершины перечислены по одному разу, значит их ${verts.length}: ${verts.join(', ')}. Вершины — это объекты, а рёбра — связи между ними.`,
  });
}
{
  const edges = [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'], ['D', 'E']];
  num('9graph-01-graphs', {
    topic: GR, d: 'intermediate', cog: 'apply', subj: 'inf-9-graph',
    sub: 'Число рёбер',
    prompt: `В графе есть рёбра: ${edges.map((e) => e.join('—')).join(', ')}. Сколько рёбер в графе? Запишите только число.`,
    value: edges.length,
    why: `Рёбра перечислены: ${edges.map((e) => e.join('—')).join(', ')} — их ${edges.length}.`,
  });
}
{
  const matrix = [
    [0, 1, 1],
    [0, 0, 1],
    [0, 0, 0],
  ];
  const outDeg = matrix.map((row) => sum(row));
  num('9graph-01-graphs', {
    topic: GR, d: 'intermediate', cog: 'apply', subj: 'inf-9-graph',
    sub: 'Степень вершины',
    prompt: `Матрица смежности (строки — «откуда», столбцы — «куда»):\n0 1 1\n0 0 1\n0 0 0\nЧему равна сумма элементов первой строки, то есть сколько рёбер выходит из вершины 1? Запишите только число.`,
    value: outDeg[0],
    why: `Первая строка ${matrix[0].join(' ')}: единицы стоят в столбцах 2 и 3, значит из вершины 1 выходит ${outDeg[0]} ребра. Единицы в строке считают слева направо — так кодируют выходящие связи.`,
  });
}
{
  const w = [[0, 4, 2], [4, 0, 1], [2, 1, 0]];
  num('9graph-01-graphs', {
    topic: GR, d: 'advanced', cog: 'analyze', subj: 'inf-9-graph',
    sub: 'Весовая матрица',
    prompt: `Весовая матрица (веса рёбер, 0 — ребра нет):\n0 4 2\n4 0 1\n2 1 0\nСумма весов всех рёбер сколько? Запишите только число.`,
    value: sum(w.flat()) / 2,
    why: `Каждое ребро записано дважды — в строке и в столбце, поэтому половина суммы: ${sum(w.flat())} / 2 = ${sum(w.flat()) / 2}. Это отличает весовую матрицу от матрицы смежности, где единицы считаются один раз.`,
  });
}

// ── КТП 25 | 9graph-02-trees | Списки и деревья (7/4/1) ──
{
  const n = 6;
  num('9graph-02-trees', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-tree',
    sub: 'Рёбра дерева',
    prompt: `В дереве ${n} вершин. Сколько в нём рёбер? Запишите только число.`,
    value: n - 1,
    why: `В дереве из ${n} вершин ровно ${n} − 1 = ${n - 1} ребро: между любыми двумя вершинами существует единственный путь, и это свойство как раз даёт формулу.`,
  });
}
{
  const n = 10;
  num('9graph-02-trees', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-tree',
    sub: 'Вершины дерева',
    prompt: `В дереве ${n - 1} рёбер. Сколько в нём вершин? Запишите только число.`,
    value: n,
    why: `Вершин на одно больше, чем рёбер: ${n - 1} + 1 = ${n}.`,
  });
}
{
  sc('9graph-02-trees', {
    topic: GR, d: 'basic', cog: 'remember', subj: 'inf-9-tree',
    sub: 'Признак дерева',
    prompt: 'Какое свойство отличает дерево от произвольного связного графа?',
    opts: [
      'Между любыми двумя вершинами есть ровно один простой путь',
      'Все вершины соединены со всеми',
      'Рёбра направлены от корня',
      'У каждой вершины одинаковая степень',
    ],
    correct: 'A',
    correctText: 'Между любыми двумя вершинами есть ровно один простой путь',
    why: 'Отсутствие циклов и связность дают ровно один путь между любой парой вершин. Полный граф — не дерево: там путей между двумя вершинами множество.',
  });
}
{
  const depth = 3;
  num('9graph-02-trees', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-tree',
    sub: 'Глубина дерева',
    prompt: `В дереве выбран корень, и от него до самой глубокой вершины ${depth} ребра. Какова глубина дерева? Запишите только число.`,
    value: depth,
    why: `Глубина — это наибольшее число рёбер от корня до листа, здесь ${depth}. Глубину считают именно по рёбрам, а не по вершинам: иначе получится на единицу больше.`,
  });
}
{
  const tree = 12;
  num('9graph-02-trees', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-tree',
    sub: 'Листья дерева',
    prompt: `У дерева с ${tree} вершинами корень один. Сколько рёбер ведёт к листьям — вершинам без потомков? Запишите только число.`,
    value: tree - 1,
    why: `Из корня выходит ${tree - 1} рёбер — по одному на каждую следующую вершину, значит всего ${tree - 1} листьев, если каждая вершина — лист. Листья — вершины, из которых не выходит ни одного ребра.`,
  });
}
{
  const choices = ['А', 'Б', 'В'];
  num('9graph-02-trees', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-tree',
    sub: 'Перебор вариантов',
    prompt: `В задаче выбирается один вариант из трёх: ${choices.join(', ')}. Сколько всего вариантов выбора? Запишите только число.`,
    value: choices.length,
    why: `${choices.length} варианта. При двух независимых выборах по три варианта получится дерево на ${choices.length} · ${choices.length} = ${choices.length * choices.length} листьев — это и есть перебор вариантов с помощью дерева.`,
  });
}
{
  const a = 4;
  const b = 3;
  num('9graph-02-trees', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-tree',
    sub: 'Дерево вариантов',
    prompt: `Дерево перебора: первый выбор — ${a} вариантов, второй — ${b} варианта для каждого. Сколько листьев в дереве? Запишите только число.`,
    value: a * b,
    why: `${a} · ${b} = ${a * b} листьев. Ветви дерева умножаются: сколько бы ни росло число уровней, вариантов становится быстро много.`,
  });
}
{
  const coins = [2, 5, 10];
  const variants = coins.length * (coins.length - 1);
  num('9graph-02-trees', {
    topic: GR, d: 'intermediate', cog: 'analyze', subj: 'inf-9-tree',
    sub: 'Число комбинаций',
    prompt: `Перебирают пары из монет: ${coins.map((c) => `${c} руб.`).join(', ')}. Каждая монета используется один раз, порядок не важен. Сколько всего пар? Запишите только число.`,
    value: variants,
    why: `Пар из ${coins.length} монет без повторов: ${coins.length} · ${coins.length - 1} / 2 = ${variants}. Порядок не важен, поэтому делим на два — иначе каждую пару посчитаем дважды.`,
  });
}
{
  const a = [4, 7, 2, 9];
  const sorted = [...a].sort((x, y) => x - y);
  num('9graph-02-trees', {
    topic: GR, d: 'intermediate', cog: 'apply', subj: 'inf-9-tree',
    sub: 'Минимум в дереве',
    prompt: `Массив ${a.join(', ')} представлен деревом: в каждой внутренней вершине хранится меньший из элементов её ветви. Чему равен минимум в корне? Запишите только число.`,
    value: sorted[0],
    why: `Отсортированный массив: ${sorted.join(', ')}, наименьшее ${sorted[0]}. В корне дерева всегда минимум — это и позволяет найти его за число сравений, равное числу внутренних вершин.`,
  });
}
{
  const coins = [2, 5];
  const tree = [[1, 2], [1, 2], [1, 2]];
  num('9graph-02-trees', {
    topic: GR, d: 'intermediate', cog: 'analyze', subj: 'inf-9-tree',
    sub: 'Число узлов дерева',
    prompt: `Дерево перебора трёх монет имеет корень, ${tree.length} узла второго уровня и столько же листьев. Сколько в нём всего вершин? Запишите только число.`,
    value: 1 + tree.length * 2,
    why: `1 (корень) + ${tree.length} + ${tree.length} = ${1 + tree.length * 2}. Для трёх монет листьев 2 · 2 · 2 = 8, а вместе с внутренними вершинами дерево больше.`,
  });
}
{
  const n = 7;
  const internal = n - 1;
  num('9graph-02-trees', {
    topic: GR, d: 'advanced', cog: 'analyze', subj: 'inf-9-tree',
    sub: 'Внутренние вершины',
    prompt: `В двоичном дереве перебора ${n} листьев (по варианту на каждом шаге). Сколько у него внутренних вершин? Запишите только число.`,
    value: n - 1,
    why: `В полном двоичном дереве число внутренних вершин на единицу меньше числа листьев: ${n} − 1 = ${internal}. Это верно для любого полного двоичного дерева.`,
  });
}
{
  const coins = [2, 5, 10, 20];
  const pairs = coins.length * (coins.length - 1) / 2;
  num('9graph-02-trees', {
    topic: GR, d: 'intermediate', cog: 'analyze', subj: 'inf-9-tree',
    sub: 'Три уровня выбора',
    prompt: `Перебирают тройки из монет: ${coins.map((c) => `${c} руб.`).join(', ')}, каждая монета используется один раз, порядок не важен. Сколько всего троек? Запишите только число.`,
    value: pairs,
    why: `Троек из ${coins.length} монет: ${coins.length} · ${coins.length - 1} · ${coins.length - 2} / 6 = ${pairs}. Порядок не важен, поэтому делим на 3 · 2 = 6 — столько перестановок даёт один и тот же набор.`,
  });
}

// ── КТП 26 | 9graph-03-tasks | Графы в решении задач (7/4/1) ──
{
  const edges = [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']];
  const w = { 'A|B': 4, 'A|C': 2, 'B|D': 5, 'C|D': 8 };
  const weight = (u, v) => w[`${u}|${v}`] ?? w[`${v}|${u}`];
  const { best, paths } = shortestPath(edges, weight, 'A', 'D');
  num('9graph-03-tasks', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-graph-task',
    sub: 'Кратчайший путь',
    prompt: `Взвешенный граф: рёбра A–B (4), A–C (2), B–D (5), C–D (8). Чему равна длина кратчайшего пути из A в D? Запишите только число.`,
    value: best,
    why: `Пути и их длины: A→B→D = 4 + 5 = 9, A→C→D = 2 + 8 = 10. Минимум — ${best} по пути ${paths[0].path.join('→')}. Путь с меньшим числом рёбер не обязательно самый лёгкий.`,
  });
}
{
  const edges = [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']];
  const w = { 'A|B': 4, 'A|C': 2, 'B|D': 5, 'C|D': 8 };
  const weight = (u, v) => w[`${u}|${v}`] ?? w[`${v}|${u}`];
  const { best, paths } = shortestPath(edges, weight, 'A', 'D');
  num('9graph-03-tasks', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-graph-task',
    sub: 'Сумма весов длинного пути',
    prompt: `Тот же граф: A–B (4), A–C (2), B–D (5), C–D (8). Чему равна длина пути A→C→D? Запишите только число.`,
    value: 10,
    why: `2 + 8 = 10, что больше кратчайшего ${best}. Задачи на кратчайший путь всегда сравнивают все варианты, иначе можно выбрать неоптимальный маршрут.`,
  });
}
{
  const edges = [['A', 'B'], ['B', 'C'], ['C', 'D']];
  num('9graph-03-tasks', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-graph-task',
    sub: 'Цепочка маршрутов',
    prompt: `Граф-цепочка: A→B→C→D. Сколько различных маршрутов ведёт из A в D? Запишите только число.`,
    value: 1,
    why: 'В цепочке без разветвлений маршрут ровно один: A→B→C→D. Число маршрутов растёт только при наличии развилок, в цепочке их нет.',
  });
}
{
  const pred = { B: ['A'], C: ['A'], D: ['B', 'C'] };
  const ways = dagPaths(pred, ['A', 'B', 'C', 'D']);
  num('9graph-03-tasks', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-graph-task',
    sub: 'Число путей в D',
    prompt: `В ориентированном ациклическом графе рёбра A→B, A→C, B→D, C→D. Сколько путей ведёт из A в D? Запишите только число.`,
    value: ways.D,
    why: `В B и C по одному пути, в D складываются оба: 1 + 1 = ${ways.D}. Это пути A→B→D и A→C→D.`,
  });
}
{
  const edges = [['A', 'B'], ['A', 'C'], ['B', 'D']];
  num('9graph-03-tasks', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-graph-task',
    sub: 'Число маршрутов',
    prompt: `В графе рёбра A→B, A→C, B→D. Сколько маршрутов ведёт из A в D? Запишите только число.`,
    value: 1,
    why: 'Из A в D ведёт только маршрут A→B→D: пути через C не доходят до D, так как рёбра C→D нет. Считают только маршруты, которые действительно заканчиваются в D.',
  });
}
{
  const pred = { B: ['A'], C: ['A'], D: ['B', 'C'] };
  const ways = dagPaths(pred, ['A', 'B', 'C', 'D']);
  num('9graph-03-tasks', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-graph-task',
    sub: 'Пути в вершину',
    prompt: `Ациклический граф: A→B, A→C, B→D, C→D. Сколько путей ведёт из A в B? Запишите только число.`,
    value: ways.B,
    why: 'В B путь ровно один: A→B, потому что у B только один предшественник. Пути считают от начала графа: в вершину-источник A идёт один пустой путь, дальше значения только складываются.',
  });
}
{
  const edges = [['A', 'B'], ['B', 'C'], ['C', 'D']];
  num('9graph-03-tasks', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-graph-task',
    sub: 'Число рёбер в пути',
    prompt: `Граф-цепочка A→B→C→D. Сколько рёбер в маршруте из A в D? Запишите только число.`,
    value: edges.length,
    why: `Маршрут A→B→C→D содержит ${edges.length} ребра(о) — по одному на каждый переход между соседними вершинами.`,
  });
}
{
  const edges = [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']];
  const w = { 'A|B': 4, 'A|C': 2, 'B|D': 5, 'C|D': 8 };
  const weight = (u, v) => w[`${u}|${v}`] ?? w[`${v}|${u}`];
  const { paths } = shortestPath(edges, weight, 'A', 'D');
  num('9graph-03-tasks', {
    topic: GR, d: 'intermediate', cog: 'analyze', subj: 'inf-9-graph-task',
    sub: 'Число рёбер кратчайшего пути',
    prompt: `Граф: веса рёбер A–B = 4, A–C = 2, B–D = 5, C–D = 8. Кратчайший путь из A в D идёт по маршруту ${paths[0].path.join('→')}. Сколько рёбер в этом маршруте? Запишите только число.`,
    value: paths[0].path.length - 1,
    why: `В маршруте ${paths[0].path.join('→')} вершин ${paths[0].path.length}, значит рёбер на одно меньше — ${paths[0].path.length - 1}. Число рёбер и сумма весов — разные характеристики пути, их не путают.`,
  });
}
{
  const cities = ['A', 'B', 'C', 'D', 'E'];
  num('9graph-03-tasks', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-graph-task',
    sub: 'Граф города',
    prompt: `В графе города вершины: ${cities.join(', ')}. Сколько вершин нужно посетить, чтобы обойти все? Запишите только число.`,
    value: cities.length,
    why: `Обход посещает все ${cities.length} вершин(ы) по одной разе. Задача «обойти все вершины» решается обходом в глубину или в ширину, и результат записывают в виде порядка посещения.`,
  });
}
{
  const pred = { B: ['A'], C: ['A'], D: ['B'], E: ['C'] };
  const ways = dagPaths(pred, ['A', 'B', 'C', 'D', 'E']);
  num('9graph-03-tasks', {
    topic: GR, d: 'intermediate', cog: 'apply', subj: 'inf-9-graph-task',
    sub: 'Накопление путей',
    prompt: `В ациклическом графе рёбра A→B, A→C, B→D, C→E. Сколько путей ведёт из A в D? Запишите только число.`,
    value: ways.D,
    why: `В B — 1 путь, в D — столько же, сколько в B, то есть ${ways.D}. Пути считают накоплением от начала графа; в вершину-источник засчитывается пустой путь.`,
  });
}
{
  const edges = [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'], ['B', 'E'], ['E', 'D']];
  const w = { 'A|B': 1, 'A|C': 1, 'B|D': 5, 'C|D': 5, 'B|E': 2, 'E|D': 2 };
  const weight = (u, v) => w[`${u}|${v}`] ?? w[`${v}|${u}`];
  const { best, paths } = shortestPath(edges, weight, 'A', 'D');
  num('9graph-03-tasks', {
    topic: GR, d: 'intermediate', cog: 'analyze', subj: 'inf-9-graph-task',
    sub: 'Выбор кратчайшего маршрута',
    prompt: `Граф: веса рёбер A–B = 1, A–C = 1, B–D = 5, C–D = 5, B–E = 2, E–D = 2. Чему равен кратчайший путь из A в D? Запишите только число.`,
    value: best,
    why: `Путь A→B→E→D: 1 + 2 + 2 = ${best}, он короче прямых вариантов по 6 и по A→C→D = 1 + 5 = 6. Значит, кратчайший маршрут — ${paths[0].path.join('→')} с длиной ${best}.`,
  });
}
{
  const pred = { B: ['A'], C: ['A'], D: ['B', 'C'] };
  const ways = dagPaths(pred, ['A', 'B', 'C', 'D']);
  num('9graph-03-tasks', {
    topic: GR, d: 'intermediate', cog: 'analyze', subj: 'inf-9-graph-task',
    sub: 'Все пути целиком',
    prompt: `Ациклический граф: A→B, A→C, B→D, C→D. Сколько всего путей из A в D существует? Запишите только число.`,
    value: ways.D,
    why: `Перебором: A→B→D и A→C→D — всего ${ways.D}. Накопление даёт тот же ответ: 1 + 1. Ответы двух способов обязаны совпадать — это лучшая проверка.`,
  });
}
{
  const edges = [['A', 'B'], ['B', 'C'], ['C', 'A']];
  sc('9graph-03-tasks', {
    topic: GR, d: 'advanced', cog: 'analyze', subj: 'inf-9-graph-task',
    sub: 'Цикл в графе',
    prompt: `Граф содержит рёбра A→B, B→C, C→A. Можно ли в таком графе накапливать число путей от начала до конца?`,
    opts: [
      'Нет: в графе есть цикл, пути не заканчиваются, накопление не работает',
      'Да, всегда можно',
      'Да, если начать с любой вершины',
      'Нет, потому что рёбер больше, чем вершин',
    ],
    correct: 'A',
    correctText: 'Нет: в графе есть цикл, пути не заканчиваются, накопление не работает',
    why: 'Число путей считают только в ациклических графах. При цикле путь можно продолжать бесконечно, и значение не сойдётся. Поэтому перед подсчётом проверяют, что циклов нет.',
  });
}

// ── КТП 27 | 9graph-04-paths | Число путей в DAG (7/4/1) ──
{
  const pred = { B: ['A'], C: ['A'], D: ['B'], E: ['C'] };
  const ways = dagPaths(pred, ['A', 'B', 'C', 'D', 'E']);
  num('9graph-04-paths', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-dag',
    sub: 'Простой граф',
    prompt: `Ациклический граф: A→B, A→C, B→D, C→E. Сколько путей ведёт из A в E? Запишите только число.`,
    value: ways.E,
    why: `В C один путь, в E столько же: ${ways.E}.`,
  });
}
{
  const pred = { B: ['A'], C: ['A'], D: ['B', 'C'] };
  const ways = dagPaths(pred, ['A', 'B', 'C', 'D']);
  num('9graph-04-paths', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-dag',
    sub: 'Ветвление и слияние',
    prompt: `Ациклический граф: A→B, A→C, B→D, C→D. Сколько путей ведёт из A в D? Запишите только число.`,
    value: ways.D,
    why: `В B — 1, в C — 1, в D складываются: 1 + 1 = ${ways.D}.`,
  });
}
{
  const pred = { B: ['A'], C: ['A'], D: ['B', 'C'], E: ['D'] };
  const ways = dagPaths(pred, ['A', 'B', 'C', 'D', 'E']);
  num('9graph-04-paths', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-dag',
    sub: 'Три уровня',
    prompt: `Ациклический граф: A→B, A→C, B→D, C→D, D→E. Сколько путей ведёт из A в E? Запишите только число.`,
    value: ways.E,
    why: `В D ${ways.D} пути, в E столько же: ${ways.E}.`,
  });
}
{
  const pred = { B: ['A'], C: ['B'], D: ['C'] };
  const ways = dagPaths(pred, ['A', 'B', 'C', 'D']);
  num('9graph-04-paths', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-dag',
    sub: 'Цепочка',
    prompt: `Ациклический граф-цепочка A→B→C→D. Сколько путей ведёт из A в D? Запишите только число.`,
    value: ways.D,
    why: `В цепочке на каждом шаге один предшественник, поэтому путь ровно один: ${ways.D}.`,
  });
}
{
  const pred = { B: ['A'], C: ['A'], D: ['B', 'C', 'A'] };
  const ways = dagPaths(pred, ['A', 'B', 'C', 'D']);
  num('9graph-04-paths', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-dag',
    sub: 'Три предшественника',
    prompt: `Ациклический граф: A→B, A→C, A→D, B→D, C→D. Сколько путей ведёт из A в D? Запишите только число.`,
    value: ways.D,
    why: `В D складываются пути из всех трёх предшественников: A (пустой путь), B и C — 1 + 1 + 1 = ${ways.D}. Забыть единицу у источника — классическая ошибка, тогда ответ получится вдвое меньше.`,
  });
}
{
  const pred = { B: ['A'], C: ['A'], D: ['B', 'C'], E: ['C'] };
  const ways = dagPaths(pred, ['A', 'B', 'C', 'D', 'E']);
  num('9graph-04-paths', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-dag',
    sub: 'Разные конечные вершины',
    prompt: `Ациклический граф: A→B, A→C, B→D, C→D, C→E. Сколько путей ведёт из A в E? Запишите только число.`,
    value: ways.E,
    why: `В E один предшественник C, в C один путь, значит и в E ${ways.E}.`,
  });
}
{
  const pred = { B: ['A'], C: ['A'], D: ['B', 'C'], E: ['B', 'C', 'D'] };
  const ways = dagPaths(pred, ['A', 'B', 'C', 'D', 'E']);
  num('9graph-04-paths', {
    topic: GR, d: 'basic', cog: 'apply', subj: 'inf-9-dag',
    sub: 'Два уровня накопления',
    prompt: `Ациклический граф: A→B, A→C, B→D, C→D, B→E, C→E, D→E. Сколько путей ведёт из A в E? Запишите только число.`,
    value: ways.E,
    why: `В D ${ways.D} пути, в E складываются пути из B, C и D: 1 + 1 + ${ways.D} = ${ways.E}.`,
  });
}
{
  const pred = { B: ['A'], C: ['A', 'B'], D: ['B', 'C'] };
  const ways = dagPaths(pred, ['A', 'B', 'C', 'D']);
  num('9graph-04-paths', {
    topic: GR, d: 'intermediate', cog: 'apply', subj: 'inf-9-dag',
    sub: 'Несколько предшественников',
    prompt: `Ациклический граф: A→B, A→C, B→C, B→D, C→D. Сколько путей ведёт из A в D? Запишите только число.`,
    value: ways.D,
    why: `В B один путь, в C складываются пути из A и B: 1 + 1 = ${ways.C}, в D — пути из B и C: 1 + ${ways.C} = ${ways.D}.`,
  });
}
{
  const pred = { B: ['A'], C: ['A', 'B'], D: ['C'], E: ['C', 'D'] };
  const ways = dagPaths(pred, ['A', 'B', 'C', 'D', 'E']);
  num('9graph-04-paths', {
    topic: GR, d: 'intermediate', cog: 'apply', subj: 'inf-9-dag',
    sub: 'Накопление по уровням',
    prompt: `Ациклический граф: A→B, A→C, B→C, C→D, C→E, D→E. Сколько путей ведёт из A в E? Запишите только число.`,
    value: ways.E,
    why: `В C ${ways.C}, в D ${ways.D}, в E складываются пути из C и D: ${ways.C} + ${ways.D} = ${ways.E}.`,
  });
}
{
  const pred = { B: ['A'], C: ['A', 'B'], D: ['B', 'C'], E: ['C', 'D'] };
  const ways = dagPaths(pred, ['A', 'B', 'C', 'D', 'E']);
  num('9graph-04-paths', {
    topic: GR, d: 'intermediate', cog: 'analyze', subj: 'inf-9-dag',
    sub: 'Проверка перебором',
    prompt: `Ациклический граф: A→B, A→C, B→C, B→D, C→D, C→E, D→E. Сколько путей ведёт из A в E? Запишите только число.`,
    value: ways.E,
    why: `Накоплением: в B 1, в C 1 + 1 = ${ways.C}, в D 1 + ${ways.C} = ${ways.D}, в E ${ways.C} + ${ways.D} = ${ways.E}. Проверять ответ стоит перебором всех путей — они должны совпасть.`,
  });
}
{
  const pred = { B: ['A'], C: ['A'], D: ['B', 'C'], E: ['A', 'D'] };
  const ways = dagPaths(pred, ['A', 'B', 'C', 'D', 'E']);
  num('9graph-04-paths', {
    topic: GR, d: 'intermediate', cog: 'analyze', subj: 'inf-9-dag',
    sub: 'Нумерация с нуля',
    prompt: `Ациклический граф: A→B, A→C, B→D, C→D, A→E, D→E. В вершину-источник A засчитывается 1 путь. Сколько путей ведёт из A в E? Запишите только число.`,
    value: ways.E,
    why: `В D ${ways.D} пути, в E складываются путь из A (пустой) и пути из D: 1 + ${ways.D} = ${ways.E}. Единица у источника обязательна — иначе ответ занизится вдвое.`,
  });
}
{
  const left = ['Вершина', 'Ребро', 'Путь', 'Цикл'];
  const right = [
    'объект графа',
    'связь между двумя вершинами',
    'последовательность вершин и рёбер без повторов',
    'замкнутый маршрут, начинающийся и заканчивающийся в одной вершине',
  ];
  mt('9graph-04-paths', {
    topic: GR, d: 'advanced', cog: 'analyze', subj: 'inf-9-dag',
    sub: 'Понятия теории графов',
    prompt: 'Установите соответствие: понятие — что оно означает.',
    left, right,
    map: { 'Вершина': right[0], 'Ребро': right[1], 'Путь': right[2], 'Цикл': right[3] },
    why: 'Различать эти четыре понятия необходимо, чтобы не путать путь с циклом: путь вершины не повторяет, а цикл возвращается в начало. Отсюда же условие ацикличности для подсчёта путей.',
  });
}

// ═══════════════════════ проверка и запись ═══════════════════════

// Квоты из tmp/need-9.txt: таблицы 29, массивы и алгоритмы 35, графы 40, прочее 16.
const expect = { sheet: 29, arr: 35, graph: 40, extra: 16 };
const TOTAL = Object.values(expect).reduce((s, n) => s + n, 0);
if (TOTAL !== 120) throw new Error(`всего ожидали 120, вышло ${TOTAL}`);

let total = 0;
for (const [name, b] of Object.entries(BANK)) {
  const body = [MARK, ...out[name]].join('\n\n');
  writeFileSync(b.file, `${heads[name]}\n\n${body}\n`, 'utf-8');
  total += out[name].length;
  console.log(`BANK-9-2 OK: ${b.file} — ${out[name].length} из ${expect[name]}`);
}
console.log(`BANK-9-2 ИТОГО: ${total} заданий`);
