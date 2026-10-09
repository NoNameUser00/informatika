// Дописывает банки заданий 11 класса (tmp/plan-11.txt): 88 заданий.
//
// Главное правило: ответы НЕ пишутся руками.
//  - числовые ответы вычисляются и сверяются с ключом через parseInt/арифметику;
//  - эталоны code_run прогоняются локальным Python — expected_stdout берётся
//    из реального вывода solution_code, расхождение роняет сборку;
//  - соответствия проверяются на биекцию (правых вариантов ровно столько же).
//
// Повторный запуск идемпонентен: файл режется по маркеру MARK и пишется заново,
// поэтому diff после второго запуска пустой.
//
// Запуск: node scripts/make-11-bank.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const MARK = '# ==== СГЕНЕРИРОВАНО scripts/make-11-bank.mjs — руками не править ====';

const BANK = {
  data: { file: 'data/tasks/11/data/bank-11data.yaml', pfx: 'inf-11-data-', req: 1.1, el: 1.1 },
  db: { file: 'data/tasks/11/db/bank-11db.yaml', pfx: 'inf-11-db-', req: 1.1, el: 1.1 },
  algo: { file: 'data/tasks/11/algo/bank-11algo.yaml', pfx: 'inf-11-algo-', req: 1.4, el: 1.5 },
  net: { file: 'data/tasks/11/net/bank-11net.yaml', pfx: 'inf-11-net-', req: 1.1, el: 1.1 },
  graph: { file: 'data/tasks/11/graph/bank-11graph.yaml', pfx: 'inf-11-graph-', req: 1.4, el: 1.5 },
};

const q = (s) => JSON.stringify(String(s));
const POINTS = { basic: 1, intermediate: 2, advanced: 3 };
const COG = { basic: 'apply', intermediate: 'apply', advanced: 'analyze' };

// ---------- состояние банков ----------

const out = { data: [], db: [], algo: [], net: [], graph: [] };
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
  const row = {
    id,
    class: '11',
    topic: q(t.topic),
    subtopic: q(t.sub),
    type: t.type,
    difficulty: t.d,
    cognitive_level: t.cog ?? COG[t.d],
    points: String(POINTS[t.d]),
    lesson: t.lesson,
    fgos_requirement: String(t.req ?? b.req),
    fgos_element: String(t.el ?? b.el),
    fgos: `{ subject: [${t.subj.join(', ')}], meta: [plan-actions] }`,
    prompt: q(t.prompt),
    student_view: t.sv,
    auto_check: t.ac,
    teacher_only: t.to,
  };
  const L = [`- id: ${row.id}`];
  for (const k of ['class', 'topic', 'subtopic', 'type', 'difficulty', 'cognitive_level', 'points',
    'lesson', 'fgos_requirement', 'fgos_element', 'fgos', 'prompt', 'student_view', 'auto_check', 'teacher_only']) {
    L.push(`  ${k}: ${row[k]}`);
  }
  out[bank].push(L.join('\n'));
}

// ---------- эмиттеры ----------

/** numeric_base. Ответ сверяется: parseInt(answer_text, base) === value. */
function num(bank, o) {
  const base = o.base ?? 10;
  const text = o.text ?? String(o.value);
  const parsed = parseInt(text, base);
  if (!Number.isInteger(o.value) || parsed !== o.value) {
    throw new Error(`base ${bank} ${o.lesson}: ключ «${text}» (основание ${base}) != ${o.value}`);
  }
  if (!o.why) throw new Error(`base ${bank} ${o.lesson}: нет explanation`);
  put(bank, {
    topic: o.topic, sub: o.sub, type: 'numeric_base', d: o.d, cog: o.cog, lesson: o.lesson,
    req: o.req, el: o.el, subj: o.subj, prompt: o.prompt,
    sv: `{ base: ${base} }`,
    ac: `{ method: numeric_base, base: ${base}, strip_affixes: true }`,
    to: `{ accepted_values_decimal: [${o.value}], answer_text: ${q(text)}, explanation: ${q(o.why)} }`,
  });
}

/**
 * single_choice. Варианты задаются либо объектом { A: …, B: … }, либо массивом
 * (тогда буквы проставляются по порядку: A, B, C, D).
 * correct — буква ответа. Если передан correctText, он обязан совпадать с текстом
 * правильного варианта: так ключ проверяется текстом, а не только буквой.
 */
function sc(bank, o) {
  const isArray = Array.isArray(o.opts);
  const keys = isArray ? o.opts.map((_, i) => 'ABCD'[i]) : Object.keys(o.opts);
  const texts = isArray ? o.opts.slice() : keys.map((k) => o.opts[k]);
  if (keys.length < 2 || keys.length > 4) throw new Error(`${o.lesson}: вариантов ${keys.length}`);
  for (const k of keys) if (!'ABCD'.includes(k) || keys.indexOf(k) !== k.charCodeAt(0) - 65) {
    throw new Error(`${o.lesson}: ключ варианта «${k}» вне A..D`);
  }
  if (!keys.includes(o.correct)) throw new Error(`${o.lesson}: ответа «${o.correct}» нет среди вариантов`);
  if (new Set(texts).size !== texts.length) throw new Error(`${o.lesson}: повторяющиеся варианты`);
  if (o.correctText !== undefined && texts[o.correct.charCodeAt(0) - 65] !== o.correctText) {
    throw new Error(`${o.lesson}: correctText не совпадает с вариантом «${o.correct}»`);
  }
  put(bank, {
    topic: o.topic, sub: o.sub, type: 'single_choice', d: o.d, cog: o.cog, lesson: o.lesson,
    req: o.req, el: o.el, subj: o.subj, prompt: o.prompt,
    sv: `{ options: [${keys.map((k, i) => `{ id: ${k}, text: ${q(texts[i])} }`).join(', ')}] }`,
    ac: `{ method: exact_option }`,
    to: `{ answer: ${q(o.correct)}, explanation: ${q(o.why)} }`,
  });
}

/** matching. Проверяем, что правых вариантов ровно столько же и все использованы. */
function mt(bank, o) {
  const vals = Object.values(o.map);
  if (vals.length !== o.left.length) throw new Error(`${o.lesson}: в соответствии ${vals.length} пар на ${o.left.length} левых`);
  if (new Set(vals).size !== vals.length) throw new Error(`${o.lesson}: правые варианты повторяются`);
  for (const v of vals) if (!o.right.includes(v)) throw new Error(`${o.lesson}: «${v}» нет среди правых`);
  for (const l of o.left) if (!o.map[l]) throw new Error(`${o.lesson}: нет пары для «${l}»`);
  const key = o.left.map((l) => `${l} = ${o.map[l]}`).join('; ');
  put(bank, {
    topic: o.topic, sub: o.sub, type: 'matching', d: o.d, cog: o.cog, lesson: o.lesson,
    req: o.req, el: o.el, subj: o.subj, prompt: o.prompt,
    sv: `{ left: [${o.left.map(q).join(', ')}], right: [${o.right.map(q).join(', ')}] }`,
    ac: `{ method: matching, partial: proportional }`,
    to: `{ answer_map: { ${o.left.map((l) => `${q(l)}: ${q(o.map[l])}`).join(', ')} }, explanation: ${q(`${o.why} ${key}`)} }`,
  });
}

/** Локальный прогон эталона. Возвращает stdout без хвостовых переводов строк. */
function py(code) {
  const res = execFileSync('python', ['-c', code], {
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  });
  return res.replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

/** code_run. expected_stdout = реальный вывод solution_code. */
function cr(bank, o) {
  const outp = py(o.solution);
  if (o.expected && o.expected !== outp) {
    throw new Error(`${o.lesson}: эталон сошёлся неверно\nожидалось: ${JSON.stringify(o.expected)}\nполучили:  ${JSON.stringify(outp)}`);
  }
  if (!outp) throw new Error(`${o.lesson}: эталон ничего не вывел`);
  put(bank, {
    topic: o.topic, sub: o.sub, type: 'code_run', d: o.d, cog: o.cog ?? 'apply', lesson: o.lesson,
    req: o.req, el: o.el, subj: o.subj, prompt: o.prompt,
    sv: `{ language: python, template: ${q(o.template)} }`,
    ac: `{ method: code_stdout, timeout_s: 10 }`,
    to: `{ solution_code: ${q(o.solution)}, expected_stdout: ${q(outp)}, explanation: ${q(o.why)} }`,
  });
}

// ---------- математика для ответов ----------

const sum = (a) => a.reduce((s, v) => s + v, 0);
const mean = (a) => sum(a) / a.length;
function median(a) {
  const b = [...a].sort((x, y) => x - y);
  const n = b.length;
  return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2;
}
function linreg(x, y) {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  const k = sxy / sxx;
  return { k, b: my - k * mx };
}
/** Все простые пути между двумя вершинами взвешенного графа: [вершины, вес]. */
function allPaths(adj, from, to) {
  const res = [];
  const go = (v, seen, w) => {
    if (v === to) { res.push({ path: seen, w }); return; }
    for (const [u, wt] of adj[v] ?? []) if (!seen.has(u)) { seen.add(u); go(u, seen, w + wt); seen.delete(u); }
  };
  go(from, new Set([from]), 0);
  return res;
}
/** Число путей в DAG накоплением (в источнике 1 — пустой путь). */
function dagPaths(nodes, edges) {
  const inc = new Map(nodes.map((v) => [v, []]));
  for (const [a, b] of edges) inc.get(b).push(a);
  const cnt = new Map(nodes.map((v) => [v, 0]));
  cnt.set(nodes[0], 1);
  for (const v of nodes) for (const p of inc.get(v)) cnt.set(v, cnt.get(v) + cnt.get(p));
  return cnt;
}
/** W/L для игры «берём к камней, взявший последний проиграл». */
function loseTakeLast(limit, moves) {
  const win = new Map();
  for (let s = 1; s <= limit; s++) {
    let w = false;
    for (const k of moves) if (k < s && !win.get(s - k)) { w = true; break; }
    win.set(s, w);
  }
  return win;
}

const DT = 'Анализ данных';
const ALG = 'Анализ алгоритмов';
const STR = 'Сортировки и структуры';
const NET = 'Сети';
const SEC = 'Безопасность и ИИ';
const GRF = 'Графы и деревья';
const GAM = 'Выигрышные стратегии';
const DBT = 'Базы данных';

// =====================================================================
// 11data-01-analysis — этапы компьютерно-математического моделирования
// Нужно дописать: 0/0/1
// =====================================================================
{
  const left = ['Описать', 'Найти закономерность', 'Прогнозировать', 'Оптимизировать'];
  const right = ['среднее, разброс, доля', 'что с чем связано', 'что будет дальше', 'как получить лучший результат'];
  if (new Set(right).size !== right.length) throw new Error('анализ: правые повторяются');
  mt('data', {
    topic: DT, d: 'advanced', lesson: '11data-01-analysis', subj: ['inf-11-data-tasks'],
    sub: 'Задачи анализа',
    prompt: 'Установите соответствие: задача анализа данных — что она требует от данных.',
    left, right,
    map: { 'Описать': right[0], 'Найти закономерность': right[1], 'Прогнозировать': right[2], 'Оптимизировать': right[3] },
    why: 'Четыре задачи анализа данных.',
  });
}

// =====================================================================
// 11data-02-stats — статистическая обработка (LibreOffice Calc)
// Нужно дописать: 1/1/1
// =====================================================================
{
  const marks = [4, 5, 5, 3, 5, 4, 3];
  const m = median(marks);
  if (!Number.isInteger(m) || m !== 4) throw new Error(`медиана: ${m}`);
  num('data', {
    topic: DT, d: 'basic', lesson: '11data-02-stats', subj: ['inf-11-data-stats'], sub: 'Медиана',
    prompt: `Оценки класса за четверть: ${marks.join(', ')}. Найдите медиану оценок. Запишите только число.`,
    value: m,
    why: `Упорядочили: 3, 3, 4, 4, 5, 5, 5 — седьмой элемент (середина ряда) равен ${m}.`,
  });

  const prev = 400, now = 500;
  const pct = ((now - prev) / prev) * 100;
  if (pct !== 25) throw new Error(`прирост: ${pct}`);
  num('data', {
    topic: DT, d: 'intermediate', lesson: '11data-02-stats', subj: ['inf-11-data-stats'], sub: 'Относительный прирост',
    prompt: 'Продажи выросли с 400 до 500 единиц за месяц. Найдите относительный прирост в процентах. Запишите только число.',
    value: pct,
    why: '(500 − 400) / 400 · 100 % = 25 %. Абсолютный прирост здесь 100 единиц, а относительный показывает, во сколько раз.',
  });

  const left = ['СРЗНАЧ', 'МЕДИАНА', 'РЕЖИМ', 'МАКС'];
  const right = ['среднее арифметическое', 'середина упорядоченного ряда', 'самое частое значение', 'наибольшее значение'];
  mt('data', {
    topic: DT, d: 'advanced', lesson: '11data-02-stats', subj: ['inf-11-data-stats'], sub: 'Функции Calc',
    prompt: 'Установите соответствие: функция LibreOffice Calc — что она вычисляет.',
    left, right,
    map: { 'СРЗНАЧ': right[0], 'МЕДИАНА': right[1], 'РЕЖИМ': right[2], 'МАКС': right[3] },
    why: 'Функции статистической обработки в редакторе таблиц.',
  });
}

// =====================================================================
// 11data-03-diagrams — диаграммы результатов анализа
// Нужно дописать: 1/1/1
// =====================================================================
sc('data', {
  topic: DT, d: 'basic', cog: 'remember', lesson: '11data-03-diagrams', subj: ['inf-11-data-viz'],
  sub: 'Диаграмма долей',
  prompt: 'Доли категорий: 40 %, 35 %, 25 % — в сумме дают 100 %. Какую диаграмму выбрать для их сравнения?',
  opts: [
    'Круговую: она показывает доли целого, сумма которых 100 %',
    'Линейную: по ней видно изменение показателя по месяцам',
    'Диаграмму разброса: она показывает связь двух величин',
    'Линейчатую с обрезанной осью: так разница кажется заметнее',
  ],
  correct: 'A', correctText: 'Круговую: она показывает доли целого, сумма которых 100 %',
  why: 'Доли целого со знаменателем 100 % — это круговая диаграмма; линейная нужна для времени, разброса — для связи двух величин.',
});
{
  const sales = [12, 15, 14, 20];
  const months = ['январь', 'февраль', 'март', 'апрель'];
  const best = sales.indexOf(Math.max(...sales)) + 1;
  if (best !== 4) throw new Error(`месяц максимума: ${best}`);
  num('data', {
    topic: DT, d: 'intermediate', lesson: '11data-03-diagrams', subj: ['inf-11-data-viz'], sub: 'Максимум на графике',
    prompt: `Продажи по месяцам (единиц): январь — ${sales[0]}, февраль — ${sales[1]}, март — ${sales[2]}, апрель — ${sales[3]}. В каком месяце продажи максимальны? Запишите номер месяца.`,
    value: best,
    why: `${Math.max(...sales)} единиц — максимум, это ${months[best - 1]}, ${best}-й месяц; график показывает пик нагляднее таблицы.`,
  });
}
sc('data', {
  topic: DT, d: 'advanced', lesson: '11data-03-diagrams', subj: ['inf-11-data-viz'], sub: 'Искажение масштаба',
  prompt: 'График строят по значениям от 90 до 100, и ось Y начинают с 90, а не с нуля. К чему это приводит?',
  opts: [
    'Небольшая разница выглядит резким ростом, хотя на самом деле она невелика',
    'График становится точнее: масштаб добавляет точность данным',
    'Ни к чему: масштаб оси не влияет на сами значения',
    'Ось обязана начинаться с единицы, иначе диаграмма не строится',
  ],
  correct: 'A', correctText: 'Небольшая разница выглядит резким ростом, хотя на самом деле она невелика',
  why: 'Для сравнения величин ось начинают с нуля: иначе график искажает данные — этот приём руками настраивается в диаграмме.',
});

// =====================================================================
// 11data-04-correlation — регрессионный анализ, коэффициент корреляции
// Нужно дописать: 1/1/1
// =====================================================================
sc('data', {
  topic: DT, d: 'basic', cog: 'remember', lesson: '11data-04-correlation', subj: ['inf-11-data-corr'],
  sub: 'Нулевая корреляция',
  prompt: 'Коэффициент корреляции Пирсона r = 0. Что это означает?',
  opts: [
    'Линейной связи нет, но нелинейная связь при этом возможна',
    'Связи нет вообще никакой',
    'Связь идеальная: точки лежат на одной прямой',
    'Данные посчитаны неверно: r не бывает нулём',
  ],
  correct: 'A', correctText: 'Линейной связи нет, но нелинейная связь при этом возможна',
  why: 'r = 0 говорит только об отсутствии ЛИНЕЙНОЙ связи; например, радиус и площадь круга связаны нелинейно.',
});
{
  const x = [1, 2, 3, 4, 5];
  const y = [12, 15, 18, 21, 24];
  const { k, b } = linreg(x, y);
  const prog = k * 8 + b;
  if (k !== 3 || b !== 9 || prog !== 33) throw new Error(`регрессия: k=${k} b=${b} прогноз=${prog}`);
  num('data', {
    topic: DT, d: 'intermediate', lesson: '11data-04-correlation', subj: ['inf-11-data-fit'], sub: 'Прогноз по регрессии',
    prompt: 'Продажи Y росли при значениях X = 1, 2, 3, 4, 5 как 12, 15, 18, 21, 24. Постройте линию тренда y = kx + b и предскажите Y при X = 8. Запишите только число.',
    value: prog,
    why: `Линия тренда y = ${k}x + ${b}: k = 3 — на 3 единицы продаж в месяц, b = ${b}; при X = 8 получаем ${prog}.`,
  });
}
{
  const left = ['Прямая', 'Обратная', 'Нулевая', 'Нелинейная'];
  const right = ['рост и размер обуви', 'цена и спрос', 'номер автобуса и скорость', 'радиус и площадь круга'];
  mt('data', {
    topic: DT, d: 'advanced', lesson: '11data-04-correlation', subj: ['inf-11-data-corr'], sub: 'Вид связи',
    prompt: 'Установите соответствие: вид связи между величинами — пример такой связи.',
    left, right,
    map: { 'Прямая': right[0], 'Обратная': right[1], 'Нулевая': right[2], 'Нелинейная': right[3] },
    why: 'Вид связи определяется тем, как меняется Y при росте X; нелинейная связь есть, но r её не показывает.',
  });
}

// =====================================================================
// 11data-05-equation — численное решение уравнения подбором параметра
// Нужно дописать: 1/1/1
// =====================================================================
sc('data', {
  topic: DT, d: 'basic', cog: 'remember', lesson: '11data-05-equation', subj: ['inf-11-data-fit'],
  sub: 'Первый шаг метода',
  prompt: 'Уравнение x³ − 2x − 5 = 0 нельзя решить формулой. С чего начинается численное решение подбором параметра?',
  opts: [
    'Проверяют, что корень существует: строят график и смотрят, пересекает ли функция ось X',
    'Сразу записывают ответ с пятью знаками после запятой',
    'Подставляют в формулу корни и выбирают подходящий',
    'Берут середину заданного отрезка, не проверяя знаки функции',
  ],
  correct: 'A', correctText: 'Проверяют, что корень существует: строят график и смотрят, пересекает ли функция ось X',
  why: 'Численный метод даёт приближение, а корень может и не существовать: сначала график, потом отрезок и перебор.',
});
{
  let len = 2, iter = 0;
  while (len > 0.25) { len /= 2; iter += 1; }
  if (iter !== 3) throw new Error(`бисекция: ${iter}`);
  num('data', {
    topic: DT, d: 'intermediate', lesson: '11data-05-equation', subj: ['inf-11-data-fit'], sub: 'Итерации бисекции',
    prompt: 'Метод бисекции сужает отрезок вдвое за каждую итерацию. Отрезок [1; 3] имеет длину 2. Сколько итераций нужно, чтобы длина отрезка стала не больше 0,25? Запишите только число.',
    value: iter,
    why: 'Длина уменьшается так: 2 → 1 → 0,5 → 0,25, то есть три итерации; точность растёт, а формулы для корня так и нет.',
  });
}
{
  const left = ['Шаг 1', 'Шаг 2', 'Шаг 3', 'Шаг 4'];
  const right = ['построить график и проверить, что корень есть', 'задать начальный отрезок', 'найти точку, где значение меняет знак', 'сузить отрезок вокруг неё'];
  mt('data', {
    topic: DT, d: 'advanced', lesson: '11data-05-equation', subj: ['inf-11-data-fit'], sub: 'Шаги подбора',
    prompt: 'Установите соответствие: шаг численного метода — что на этом шаге делают.',
    left, right,
    map: { 'Шаг 1': right[0], 'Шаг 2': right[1], 'Шаг 3': right[2], 'Шаг 4': right[3] },
    why: 'Порядок подбора параметра: график → отрезок → смена знака → сужение отрезка.',
  });
}

// =====================================================================
// 11data-06-optimize — задачи оптимизации
// Нужно дописать: 1/1/1
// =====================================================================
sc('data', {
  topic: DT, d: 'basic', cog: 'remember', lesson: '11data-06-optimize', subj: ['inf-11-data-opt'], sub: 'Поиск экстремума',
  prompt: 'В LibreOffice Calc прибыль посчитана формулами в столбце из 101 строки. Как найти наибольшее значение без ручного просмотра?',
  opts: [
    'Функцией МАКС по диапазону столбца',
    'Функцией СРЗНАЧ по диапазону столбца',
    'Функцией МИН по диапазону столбца',
    'Только вручную: таблица не умеет искать максимум',
  ],
  correct: 'A', correctText: 'Функцией МАКС по диапазону столбца',
  why: 'МАКС находит наибольшее значение диапазона; среднее и минимум дают другие величины, а без функции пришлось бы просматривать вручную.',
});
{
  const price0 = 1000, cost = 600;
  const demand = { 0: 10, 10: 20, 20: 40, 30: 45 };
  const rows = Object.entries(demand).map(([d, qty]) => {
    const price = Math.round(price0 * (1 - Number(d) / 100));
    return { d: Number(d), qty, price, profit: price * qty - cost * qty };
  });
  const best = rows.reduce((m, r) => (r.profit > m.profit ? r : m));
  if (best.profit !== 8000 || best.d !== 20) throw new Error(`оптимум: ${JSON.stringify(best)}`);
  num('data', {
    topic: DT, d: 'intermediate', lesson: '11data-06-optimize', subj: ['inf-11-data-opt'], sub: 'Максимальная прибыль',
    prompt: 'Цена товара 1000, себестоимость 600. Спрос зависит от скидки: без скидки берут 10 штук, при скидке 10 % — 20, при 20 % — 40, при 30 % — 45. Найдите максимальную прибыль (выручка минус затраты по себестоимости). Запишите только число.',
    value: best.profit,
    why: rows.map((r) => `${r.d} %: ${r.price * r.qty} − ${cost * r.qty} = ${r.profit}`).join('; ') + '. Максимум — 8 000.',
  });
}
sc('data', {
  topic: DT, d: 'advanced', lesson: '11data-06-optimize', subj: ['inf-11-data-opt'], sub: 'Выполнимость оптимума',
  prompt: 'Максимум прибыли найден по таблице, но для его реализации не хватает сотрудников. О чём это говорит?',
  opts: [
    'Найденный оптимум получен без учёта всех ограничений и может быть невыполнимым',
    'Расчёт прибыли выполнен с ошибкой: нужно пересчитать',
    'Ограничения нужно убрать, тогда максимум станет достижимым',
    'Задача оптимизации решена полностью и окончательно',
  ],
  correct: 'A', correctText: 'Найденный оптимум получен без учёта всех ограничений и может быть невыполнимым',
  why: 'Ограничения задачи задают допустимые варианты; неполный набор ограничений даёт максимум, который в жизни нереализуем.',
});

// =====================================================================
// 11model-01-modeling — модели и моделирование, формализация
// Нужно дописать: 1/1/1
// =====================================================================
sc('data', {
  topic: DT, d: 'basic', cog: 'remember', lesson: '11model-01-modeling', subj: ['inf-11-data-model'], sub: 'Единицы измерения',
  prompt: 'Зачем при формализации задачи указывают единицы измерения величин?',
  opts: [
    'Чтобы можно было проверить размерность и не сложить скорость с расстоянием',
    'Чтобы отчёт выглядел длиннее и солиднее',
    'Чтобы программа работала быстрее',
    'Чтобы не приводить числа к целому виду',
  ],
  correct: 'A', correctText: 'Чтобы можно было проверить размерность и не сложить скорость с расстоянием',
  why: 'Проверка размерности — самый простой способ найти ошибку в формуле: складывать м/с и метры бессмысленно.',
});
{
  const v0 = 20, v = 60, t = 10;
  const a = (v - v0) / t;
  if (a !== 4) throw new Error(`ускорение: ${a}`);
  num('data', {
    topic: DT, d: 'intermediate', lesson: '11model-01-modeling', subj: ['inf-11-data-model'], sub: 'Ускорение',
    prompt: 'Автомобиль разгоняется с 20 м/с до 60 м/с за 10 с равноускоренно. Найдите ускорение. Запишите только число.',
    value: a,
    why: `Из v = v₀ + at получаем a = (v − v₀) / t = (60 − 20) / 10 = ${a} м/с².`,
  });
  const s = v0 * t + (a * t * t) / 2;
  if (s !== 400) throw new Error(`путь: ${s}`);
  num('data', {
    topic: DT, d: 'advanced', lesson: '11model-01-modeling', subj: ['inf-11-data-model'], sub: 'Путь по модели',
    prompt: 'В том же движении (20 м/с, ускорение 4 м/с², 10 с) найдите путь, пройденный за эти 10 секунд. Запишите только число.',
    value: s,
    why: `Модель s = v₀t + at²/2 даёт s = 20 · 10 + 4 · 100 / 2 = 200 + 200 = ${s} м. Модель проверена подстановкой.`,
  });
}

// =====================================================================
// 11db-01-databases — реляционные базы данных
// Нужно дописать: 0/0/1
// =====================================================================
{
  const left = ['Первая нормальная форма', 'Вторая нормальная форма', 'Третья нормальная форма'];
  const right = [
    'в одной ячейке одно значение, нет повторяющихся групп',
    'каждое неключевое поле зависит только от всего ключа, а не от его части',
    'нет транзитивных зависимостей: неключевые поля зависят только от ключа',
  ];
  mt('db', {
    topic: DBT, d: 'advanced', lesson: '11db-01-databases', subj: ['inf-11-db-normal'], sub: 'Нормальные формы',
    prompt: 'Установите соответствие: нормальная форма — её требование.',
    left, right,
    map: { 'Первая нормальная форма': right[0], 'Вторая нормальная форма': right[1], 'Третья нормальная форма': right[2] },
    why: 'Нормализация устраняет повторы: факты должны зависеть только от ключа.',
  });
}

// =====================================================================
// 11db-02-queries — работа с готовой базой данных: запросы
// Нужо дописать: 1/1/1
// =====================================================================
sc('db', {
  topic: DBT, d: 'basic', cog: 'remember', lesson: '11db-02-queries', subj: ['inf-11-db-sql'], sub: 'Сортировка в SQL',
  prompt: 'Какое ключевое слово SQL сортирует результат запроса?',
  opts: ['ORDER BY', 'WHERE', 'FROM', 'SELECT'],
  correct: 'A', correctText: 'ORDER BY',
  why: 'ORDER BY сортирует строки результата (ASC — по возрастанию, DESC — по убыванию); WHERE задаёт условие отбора, а SELECT и FROM выбирают столбцы и таблицу.',
});
{
  const uch = [
    [1, 'Мария', '11А', 85],
    [2, 'Пётр', '11А', 74],
    [3, 'Света', '10Б', 91],
    [4, 'Коля', '11А', 68],
    [5, 'Аня', '11Б', 83],
  ];
  const n = uch.filter(([, , kl, bal]) => kl === '11А' && bal > 70).length;
  if (n !== 2) throw new Error(`выборка: ${n}`);
  num('db', {
    topic: DBT, d: 'intermediate', lesson: '11db-02-queries', subj: ['inf-11-db-sql'], sub: 'Число строк выборки',
    prompt: 'Таблица «Ученики» (№, фамилия, класс, балл): 1 Мария 11А 85; 2 Пётр 11А 74; 3 Света 10Б 91; 4 Коля 11А 68; 5 Аня 11Б 83. Сколько строк вернёт запрос SELECT * FROM Ученики WHERE класс = \'11А\' AND балл > 70? Запишите только число.',
    value: n,
    why: 'Условию удовлетворяют Мария (85) и Пётр (74): у Коли класс подходит, но балл 68 не больше 70.',
  });
}
{
  const blyuda = [[1, 'Борщ'], [2, 'Котлета'], [3, 'Каша']];
  const post = [[1, 1, 2], [1, 2, 1], [2, 3, 5], [2, 1, 3]];
  const joined = post.filter(([, code]) => blyuda.some(([c]) => c === code)).length;
  const n = joined === post.length ? post.filter(([, , qty]) => qty > 1).length : -1;
  if (joined !== 4 || n !== 3) throw new Error(`join: ${joined}/${n}`);
  num('db', {
    topic: DBT, d: 'advanced', lesson: '11db-02-queries', subj: ['inf-11-db-sql'], sub: 'Запрос с JOIN',
    prompt: 'Таблица «Блюда»: код 1 — Борщ, код 2 — Котлета, код 3 — Каша. Таблица «Поставки»: (№ дела 1, код 1, 2 шт), (№ дела 1, код 2, 1 шт), (№ дела 2, код 3, 5 шт), (№ дела 2, код 1, 3 шт). Сколько строк вернёт запрос SELECT ученики.фамилия, блюда.название FROM поставки JOIN блюда ON поставки.код = блюда.код WHERE поставки.количество > 1? Запишите только число.',
    value: n,
    why: `Соединение по внешнему ключу «код» даёт ${joined} строки — все коды найдены; условие «количество > 1» оставляет ${n} из них.`,
  });
}

// =====================================================================
// 11algo-01-analysis — задачи анализа алгоритмов
// Нужно дописать: 0/0/1
// =====================================================================
{
  const left = ['Проследить структуру', 'Восстановить предпоследний шаг', 'Отсечь невозможное', 'Проверить прямым прогоном'];
  const right = [
    'что делает последний шаг и какие у него условия',
    'от результата — каким он мог получиться',
    'по ограничениям самого алгоритма',
    'найденные варианты — подставить в алгоритм',
  ];
  mt('algo', {
    topic: ALG, d: 'advanced', lesson: '11algo-01-analysis', subj: ['inf-11-algo-auto'], sub: 'Рассуждение без прогона',
    prompt: 'Установите соответствие: приём анализа алгоритма — что он делает.',
    left, right,
    map: {
      'Проследить структуру': right[0],
      'Восстановить предпоследний шаг': right[1],
      'Отсечь невозможное': right[2],
      'Проверить прямым прогоном': right[3],
    },
    why: 'Обратную задачу решают от результата к предыдущим шагам и обязательно проверяют прямым прогоном.',
  });
}

// =====================================================================
// 11algo-02-debug — этапы решения задач на компьютере, отладка
// Нужно дописать: 1/1/1
// =====================================================================
sc('algo', {
  topic: ALG, d: 'basic', cog: 'remember', lesson: '11algo-02-debug', subj: ['inf-11-algo-debug'], sub: 'Негативный тест',
  prompt: 'Что проверяет негативный тест?',
  opts: [
    'Что на некорректных данных (пусто, ноль, текст вместо числа) программа сообщает об ошибке, а не выдаёт мусор',
    'Что программа работает быстрее всех остальных',
    'Что результат программы всегда положительный',
    'Что код программы написан аккуратно',
  ],
  correct: 'A', correctText: 'Что на некорректных данных (пусто, ноль, текст вместо числа) программа сообщает об ошибке, а не выдаёт мусор',
  why: 'Позитивные тесты проверяют верный результат, негативные — поведение при недопустимых данных.',
});
cr('algo', {
  topic: ALG, d: 'intermediate', lesson: '11algo-02-debug', subj: ['inf-11-algo-debug'], sub: 'Среднее и границы',
  prompt: 'Дан список a = [2, 4, 6, 8]. Найдите среднее арифметическое элементов списка и количество элементов. Выведите два числа через пробел: сначала среднее, затем количество.',
  template: '# Допиши код\n# a = [2, 4, 6, 8]\n# s = 0\n# for x in a:\n#     ...\nprint(среднее, количество)',
  solution: `a = [2, 4, 6, 8]
s = 0
for x in a:
    s = s + x
print(s // len(a), len(a))`,
  why: 'Сумма 20 делится на 4 элемента без остатка: 20 // 4 = 5, элементов 4.',
});
{
  const left = ['Трассировка', 'Отладочный вывод', 'Точка останова', 'Тестирование границ'];
  const right = [
    'таблица «шаг → значения переменных»',
    'печать промежуточных значений прямо в программу',
    'остановка программы на нужном шаге',
    'проверка крайних допустимых значений',
  ];
  mt('algo', {
    topic: ALG, d: 'advanced', lesson: '11algo-02-debug', subj: ['inf-11-algo-debug'], sub: 'Методы отладки',
    prompt: 'Установите соответствие: метод отладки — что он делает.',
    left, right,
    map: {
      'Трассировка': right[0],
      'Отладочный вывод': right[1],
      'Точка останова': right[2],
      'Тестирование границ': right[3],
    },
    why: 'Отладка показывает, где именно значения свернули не туда.',
  });
}

// =====================================================================
// 11algo-03-digits — обработка цифр числа в разных системах счисления
// Нужно дописать: 1/1/1
// =====================================================================
{
  const n = 9575;
  let s = 0, t = n;
  while (t > 0) { s += t % 10; t = Math.floor(t / 10); }
  if (s !== 26) throw new Error(`сумма цифр: ${s}`);
  num('algo', {
    topic: ALG, d: 'basic', lesson: '11algo-03-digits', subj: ['inf-11-algo-digits'], sub: 'Сумма цифр',
    prompt: 'Найдите сумму цифр числа 9575. Запишите только число.',
    value: s,
    why: 'Остатки 5, 7, 5, 9 от деления на 10 дают 5 → 12 → 17 → 26.',
  });
  num('algo', {
    topic: ALG, d: 'intermediate', lesson: '11algo-03-digits', subj: ['inf-11-algo-digits'], sub: 'Перевод в систему с основанием P',
    base: 8,
    prompt: 'Переведите число 100 в восьмеричную систему счисления. Запишите только число (без подстрочных индексов).',
    value: 100, text: '144',
    why: '100 % 8 = 4, 100 // 8 = 12; 12 % 8 = 4, 12 // 8 = 1, 1 % 8 = 1. Читаем с конца: 144₈ = 64 + 32 + 4 = 100.',
  });
}
cr('algo', {
  topic: ALG, d: 'advanced', lesson: '11algo-03-digits', subj: ['inf-11-algo-digits'], sub: 'Двоичная запись циклом',
  prompt: 'Число n = 9575. Получите его двоичную запись последовательным делением: остаток n % 2 — очередная цифра, затем делим n на 2 целочисленно. Выведите полученную строку.',
  template: "# Допиши цикл\nn = 9575\ndigits = ''\nwhile ...:\n    # digits — накапливаем в начало\n    ...\nprint(digits)",
  solution: `n = 9575
digits = ''
while n > 0:
    digits = str(n % 2) + digits
    n = n // 2
print(digits)`,
  why: '9575 = 8192 + 1024 + 256 + 64 + 32 + 4 + 2 + 1, поэтому запись состоит из единиц и нулей в этих разрядах.',
});

// =====================================================================
// 11algo-04-sequence — обработка числовой последовательности
// Нужно дописать: 1/1/1
// =====================================================================
{
  const a = [3, 7, 5, 2];
  const s = sum(a);
  if (s !== 17) throw new Error(`сумма: ${s}`);
  num('algo', {
    topic: ALG, d: 'basic', lesson: '11algo-04-sequence', subj: ['inf-11-algo-seq'], sub: 'Сумма элементов',
    prompt: 'Найдите сумму элементов последовательности 3, 7, 5, 2. Запишите только число.',
    value: s,
    why: 'Накопитель начинаем с 0: 0 + 3 = 3, + 7 = 10, + 5 = 15, + 2 = 17.',
  });
  const p = a.reduce((x, y) => x * y, 1);
  if (p !== 210) throw new Error(`произведение: ${p}`);
  num('algo', {
    topic: ALG, d: 'intermediate', lesson: '11algo-04-sequence', subj: ['inf-11-algo-seq'], sub: 'Произведение элементов',
    prompt: 'Найдите произведение элементов последовательности 3, 7, 5, 2. Запишите только число.',
    value: p,
    why: 'Накопитель произведения начинают с 1, а не с 0: 1 · 3 = 3, · 7 = 21, · 5 = 105, · 2 = 210.',
  });
}
cr('algo', {
  topic: ALG, d: 'advanced', lesson: '11algo-04-sequence', subj: ['inf-11-algo-seq'], sub: 'Один проход, две величины',
  prompt: 'Дан список a = [3, -7, 5, -2, 0, 8]. За один проход найдите сумму всех элементов и количество положительных элементов. Выведите два числа через пробел: сначала сумму, затем количество.',
  template: '# Допиши код\n# a = [3, -7, 5, -2, 0, 8]\n# s = 0\n# k = 0\nprint(s, k)',
  solution: `a = [3, -7, 5, -2, 0, 8]
s = 0
k = 0
for x in a:
    s = s + x
    if x > 0:
        k = k + 1
print(s, k)`,
  why: 'Сумма 3 − 7 + 5 − 2 + 0 + 8 = 7, положительных элементов три: 3, 5 и 8. Оба результата — за один проход.',
});

// =====================================================================
// 11algo-05-enumeration — метод перебора
// Нужно дописать: 1/1/1
// =====================================================================
{
  const roots = [];
  for (let x = -20; x <= 20; x++) if (x * x - 5 * x + 6 === 0) roots.push(x);
  if (roots.length !== 2) throw new Error(`корни: ${roots.join(',')}`);
  num('algo', {
    topic: ALG, d: 'basic', lesson: '11algo-05-enumeration', subj: ['inf-11-algo-enum'], sub: 'Перебор значений',
    prompt: 'Сколько целых значений x в диапазоне от −20 до 20 обращают в ноль выражение x² − 5x + 6? Запишите только число.',
    value: roots.length,
    why: `Перебор даёт два корня: x = ${roots[0]} и x = ${roots[1]} (2 · 3 = 6, 2 + 3 = 5).`,
  });
  const n = 100 * 50;
  if (n !== 5000) throw new Error(`пары: ${n}`);
  num('algo', {
    topic: ALG, d: 'intermediate', lesson: '11algo-05-enumeration', subj: ['inf-11-algo-enum'], sub: 'Оценка числа проверок',
    prompt: 'Перебираются сочетания двух величин: первая принимает 100 значений, вторая — 50. Сколько сочетаний проверит цикл с двумя вложенными циклами? Запишите только число.',
    value: n,
    why: 'Вложенные циклы проверяют n · m = 100 · 50 = 5000 сочетаний; при тысячах значений такой перебор уже недопустим.',
  });
}
cr('algo', {
  topic: ALG, d: 'advanced', lesson: '11algo-05-enumeration', subj: ['inf-11-algo-enum'], sub: 'Перебор цифр числа',
  prompt: 'Найдите все трёхзначные числа, у которых третья цифра равна сумме первых двух (сумма не больше 9). Выведите каждое число с новой строки.',
  template: '# Допиши вложенные циклы\nfor a in range(1, 10):\n    for b in range(10):\n        c = ...\n        if c <= 9:\n            print(100 * a + 10 * b + c)',
  solution: `for a in range(1, 10):
    for b in range(10):
        c = a + b
        if c <= 9:
            print(100 * a + 10 * b + c)`,
  why: 'Для первой цифры a подходит 10 − a вариантов второй цифры, всего 9 + 8 + … + 1 = 45 чисел — перебор их и находит.',
});

// =====================================================================
// 11algo-06-sorting — алгоритмы сортировки
// Нужно дописать: 0/1/1
// =====================================================================
{
  const n = 20;
  const cmp = (n * (n - 1)) / 2;
  if (cmp !== 190) throw new Error(`сравнения: ${cmp}`);
  num('algo', {
    topic: STR, d: 'intermediate', lesson: '11algo-06-sorting', subj: ['inf-11-algo-sort'], sub: 'Число сравнений',
    prompt: 'Сколько сравнений делает сортировка выбором для списка из 20 элементов? Запишите только число.',
    value: cmp,
    why: `Сортировка выбором всегда делает n(n − 1)/2 = 20 · 19 / 2 = ${cmp} сравнений — независимо от исходных данных.`,
  });
}
cr('algo', {
  topic: STR, d: 'advanced', lesson: '11algo-06-sorting', subj: ['inf-11-algo-sort'], sub: 'Сортировка выбором кодом',
  prompt: 'Отсортируйте список [5, 3, 8, 1, 4] сортировкой выбором: на каждом шаге найдите минимум в остатке и поставьте на своё место, считая каждое сравнение элементов. Выведите сначала отсортированный список через пробел, затем на новой строке — число сравнений.',
  template: '# Допиши сортировку выбором\n# a = [5, 3, 8, 1, 4]\n# n = len(a)\n# cmp = 0\nprint(*a)\nprint(cmp)',
  solution: `a = [5, 3, 8, 1, 4]
n = len(a)
cmp = 0
for i in range(n - 1):
    m = i
    for j in range(i + 1, n):
        cmp = cmp + 1
        if a[j] < a[m]:
            m = j
    a[i], a[m] = a[m], a[i]
print(*a)
print(cmp)`,
  why: 'Сортировка выбором всегда делает n(n − 1)/2 = 5 · 4 / 2 = 10 сравнений, независимо от того, как расположены элементы.',
});

// =====================================================================
// 11algo-07-matrix — двумерные массивы: матрицы
// Нужно дописать: 0/1/1
// =====================================================================
{
  const a = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
  const d = sum(a.map((r, i) => r[i]));
  if (d !== 15) throw new Error(`диагональ: ${d}`);
  num('algo', {
    topic: STR, d: 'intermediate', lesson: '11algo-07-matrix', subj: ['inf-11-algo-matrix'], sub: 'Главная диагональ',
    prompt: 'Дана матрица 3 × 3: 1 2 3; 4 5 6; 7 8 9. Найдите сумму элементов главной диагонали. Запишите только число.',
    value: d,
    why: 'У главной диагонали индексы равны: a[0][0] + a[1][1] + a[2][2] = 1 + 5 + 9 = 15.',
  });
}
cr('algo', {
  topic: STR, d: 'advanced', lesson: '11algo-07-matrix', subj: ['inf-11-algo-matrix'], sub: 'Обе диагонали',
  prompt: 'Дана матрица 3 × 3: [[2, 7, 1], [8, 5, 3], [4, 9, 6]]. Выведите сумму главной диагонали и сумму вторичной диагонали через пробел: сначала главную, затем вторичную.',
  template: '# Допиши код\n# a = [[2, 7, 1], [8, 5, 3], [4, 9, 6]]\n# n = len(a)\n# s1 = 0\n# s2 = 0\nprint(s1, s2)',
  solution: `a = [[2, 7, 1], [8, 5, 3], [4, 9, 6]]
n = len(a)
s1 = 0
s2 = 0
for i in range(n):
    s1 = s1 + a[i][i]
    s2 = s2 + a[i][n - 1 - i]
print(s1, s2)`,
  why: 'Главная диагональ: 2 + 5 + 6 = 13. Вторичная: 1 + 5 + 4 = 10 — у неё сумма индексов равна n − 1.',
});

// =====================================================================
// 11algo-08-strings — инструменты и алгоритмы обработки строк
// Нужно дописать: 1/1/1
// =====================================================================
{
  const w = 'информатика';
  if ([...w].length !== 11) throw new Error(`длина: ${w.length}`);
  num('algo', {
    topic: STR, d: 'basic', lesson: '11algo-08-strings', subj: ['inf-11-algo-str'], sub: 'Длина строки',
    prompt: 'Сколько символов в слове «информатика»? Запишите только число.',
    value: [...w].length,
    why: 'Функция len() считает символы строки: в слове «информатика» их 11.',
  });
  const word = 'барабан';
  const k = [...word].filter((c) => c === 'а').length;
  if (k !== 3) throw new Error(`букв "а": ${k}`);
  num('algo', {
    topic: STR, d: 'intermediate', lesson: '11algo-08-strings', subj: ['inf-11-algo-str'], sub: 'Подсчёт символа',
    prompt: 'Сколько раз буква «а» встречается в слове «барабан»? Запишите только число.',
    value: k,
    why: 'Перебираем строку посимвольно и увеличиваем счётчик на втором, четвёртом и шестом символах — всего 3 раза.',
  });
}
cr('algo', {
  topic: STR, d: 'advanced', lesson: '11algo-08-strings', subj: ['inf-11-algo-str'], sub: 'Палиндромы',
  prompt: 'Дан список слов: ["довод", "компьютер", "шалаш", "питон"]. Выведите те слова, которые читаются одинаково в обе стороны, каждое с новой строки. Сравнивайте слово с его разворотом s[::-1].',
  template: '# Допиши код\nwords = ["довод", "компьютер", "шалаш", "питон"]\nfor w in words:\n    if w == w[::-1]:\n        print(w)',
  solution: `words = ["довод", "компьютер", "шалаш", "питон"]
for w in words:
    if w == w[::-1]:
        print(w)`,
  why: 'Разворот s[::-1] даёт «довод» и «шалаш» — только эти слова совпадают с исходным; «компьютер» и «питон» — нет.',
});

// =====================================================================
// 11algo-09-text-edit — практическая работа: редактирование текста
// Нужно дописать: 1/1/1
// =====================================================================
{
  const pos = 'информатика'.indexOf('мат');
  if (pos !== 5) throw new Error(`позиция: ${pos}`);
  num('algo', {
    topic: STR, d: 'basic', lesson: '11algo-09-text-edit', subj: ['inf-11-algo-edit'], sub: 'Поиск подстроки',
    prompt: 'В слове «информатика» найдите позицию первого вхождения подстроки «мат» (индексы считаются с нуля). Запишите только число.',
    value: pos,
    why: 'Подстрока начинается с шестой буквы, её индекс равен 5: и-н-ф-о-р-м, значит s[5:8] = «мат».',
  });
}
cr('algo', {
  topic: STR, d: 'intermediate', lesson: '11algo-09-text-edit', subj: ['inf-11-algo-edit'], sub: 'Замена символа',
  prompt: 'В строке "a-b-c-d" замените все дефисы на плюсы и выведите результат. Строку соберите посимвольно: в цикле добавляйте к результату нужный символ.',
  template: "# Допиши код\ns = 'a-b-c-d'\nres = ''\nfor ch in s:\n    if ch == '-':\n        res = ...\n    else:\n        res = res + ch\nprint(res)",
  solution: `s = 'a-b-c-d'
res = ''
for ch in s:
    if ch == '-':
        res = res + '+'
    else:
        res = res + ch
print(res)`,
  why: 'Строка в Python неизменяема, поэтому новую собирают в отдельной переменной res: дефисы заменяются плюсами, остальные символы переносятся как есть.',
});
cr('algo', {
  topic: STR, d: 'advanced', lesson: '11algo-09-text-edit', subj: ['inf-11-algo-edit'], sub: 'Все вхождения',
  prompt: 'Найдите все позиции буквы «а» в слове «ананас» и выведите их через пробел. Индексы считаются с нуля.',
  template: "# Допиши код\ns = 'ананас'\npos = []\nfor i in range(len(s)):\n    if s[i] == ...:\n        pos.append(i)\nprint(*pos)",
  solution: `s = 'ананас'
pos = []
for i in range(len(s)):
    if s[i] == 'а':
        pos.append(i)
print(*pos)`,
  why: 'Сравниваем каждый символ с образцом и запоминаем его индекс: буква «а» стоит на позициях 0, 2 и 4.',
});

// =====================================================================
// 11algo-10-subs — подпрограммы, рекурсия, функции
// Нужно дописать: 0/0/1
// =====================================================================
cr('algo', {
  topic: STR, d: 'advanced', lesson: '11algo-10-subs', subj: ['inf-11-algo-rec'], sub: 'Сумма цифр рекурсивно',
  prompt: 'Напишите рекурсивную функцию суммы цифр: для n = 0 вернуть 0, иначе вернуть n % 10 плюс сумму цифр от n // 10. Вызовите её для числа 9575 и выведите результат.',
  template: '# Допиши рекурсивную функцию\ndef сумма_цифр(n):\n    if n == 0:\n        return 0\n    return n % 10 + сумма_цифр(n // 10)\n\n\nprint(сумма_цифр(9575))',
  solution: `def сумма_цифр(n):
    if n == 0:
        return 0
    return n % 10 + сумма_цифр(n // 10)


print(сумма_цифр(9575))`,
  why: 'Базовый случай обязателен: без него рекурсия не остановится. 5 + 7 + 5 + 9 = 26.',
});

// =====================================================================
// 11algo-11-complexity — оценка сложности вычислений
// Нужно дописать: 1/0/1
// =====================================================================
sc('algo', {
  topic: ALG, d: 'basic', cog: 'remember', lesson: '11algo-11-complexity', subj: ['inf-11-algo-complex'], sub: 'Сложность поиска',
  prompt: 'Какая сложность у линейного поиска элемента в неотсортированном массиве?',
  opts: ['O(n)', 'O(log n)', 'O(1)', 'O(n²)'],
  correct: 'A', correctText: 'O(n)',
  why: 'Линейный поиск просматривает элементы подряд, поэтому растёт вместе с n; O(log n) — это бинарный поиск по отсортированному массиву.',
});
{
  const n = 1000;
  const ops = n * n;
  if (ops !== 1000000) throw new Error(`операции: ${ops}`);
  num('algo', {
    topic: ALG, d: 'advanced', lesson: '11algo-11-complexity', subj: ['inf-11-algo-complex'], sub: 'Рост вложенных циклов',
    prompt: 'Сколько раз выполнится тело двух вложенных циклов, каждый из которых проходит по 1000 элементов? Запишите только число.',
    value: ops,
    why: 'Внутренний цикл выполняется целиком для каждого значения внешнего: 1000 · 1000 = 1 000 000 — это рост O(n²).',
  });
}

// =====================================================================
// 11net-01-networks — компьютерные сети и сетевые протоколы
// Нужно дописать: 0/0/1
// =====================================================================
{
  const left = ['Сетевой адаптер', 'Коммутатор', 'Маршрутизатор', 'Точка доступа'];
  const right = [
    'подключает компьютер к сети',
    'соединяет устройства внутри одной сети',
    'соединяет разные сети и выбирает маршрут пакета',
    'обеспечивает беспроводной доступ',
  ];
  mt('net', {
    topic: NET, d: 'advanced', lesson: '11net-01-networks', subj: ['inf-11-net-dev'], sub: 'Сетевое оборудование',
    prompt: 'Установите соответствие: устройство — его назначение в сети.',
    left, right,
    map: {
      'Сетевой адаптер': right[0],
      'Коммутатор': right[1],
      'Маршрутизатор': right[2],
      'Точка доступа': right[3],
    },
    why: 'Коммутатор соединяет устройства внутри сети, маршрутизатор — разные сети; их путают чаще всего.',
  });
}

// =====================================================================
// 11net-04-control — итоговая контрольная, Интернет и доменные имена
// Нужно дописать: 1/1/1
// =====================================================================
{
  const bits = 4 * 8;
  if (bits !== 32) throw new Error(`биты: ${bits}`);
  num('net', {
    topic: NET, d: 'basic', lesson: '11net-04-control', subj: ['inf-11-net-ip'], sub: 'Разрядность IPv4',
    prompt: 'Сколько бит содержится в адресе протокола IPv4? Запишите только число.',
    value: bits,
    why: 'IPv4 — четыре числа по 8 бит, то есть 4 · 8 = 32 бита; в IPv6 их 128.',
  });
  const hosts = 2 ** 8 - 2;
  if (hosts !== 254) throw new Error(`узлы: ${hosts}`);
  num('net', {
    topic: NET, d: 'intermediate', lesson: '11net-04-control', subj: ['inf-11-net-mask'], sub: 'Число адресов узлов',
    prompt: 'Сеть задана маской /24 (255.255.255.0): адрес сети заканчивается октетом 0, широковещательный — октетом 255. Сколько адресов узлов доступно в такой сети? Запишите только число.',
    value: hosts,
    why: 'Последний октет принимает 2⁸ = 256 значений, из них 0 — вся сеть и 255 — все узлы, поэтому остаётся 256 − 2 = 254.',
  });
}
sc('net', {
  topic: NET, d: 'advanced', lesson: '11net-04-control', subj: ['inf-11-net-mask'], sub: 'Зарещённые октеты',
  prompt: 'Почему адресу узла нельзя назначить октет 0 или октет 255?',
  opts: [
    'Октет 0 обозначает всю сеть, а 255 — все узлы сети (широковещательный адрес)',
    'Эти октеты зарезервированы для серверов провайдера',
    'Они не помещаются в восемь бит',
    'С ними не работает DNS',
  ],
  correct: 'A', correctText: 'Октет 0 обозначает всю сеть, а 255 — все узлы сети (широковещательный адрес)',
  why: 'Поэтому в сети /24 остаётся 254 адреса узла, а не 256: эти два значения заняты под сеть и широковещание.',
});

// =====================================================================
// 11net-02-html — язык гипертекстовой разметки
// Нужно дописать: 1/1/1
// =====================================================================
sc('net', {
  topic: NET, d: 'basic', cog: 'remember', lesson: '11net-02-html', subj: ['inf-11-net-html'], sub: 'Кодировка страницы',
  prompt: 'Зачем в раздел <head> страницы пишут <meta charset="utf-8">?',
  opts: [
    'Чтобы русский текст не показывался «кракозябрами»',
    'Чтобы страница загружалась заметно быстрее',
    'Чтобы задать текст заголовка вкладки браузера',
    'Чтобы браузер не закрывал страницу при ошибке разметки',
  ],
  correct: 'A', correctText: 'Чтобы русский текст не показывался «кракозябрами»',
  why: 'Заголовок вкладки задаёт тег <title>, а кодировку — именно <meta charset>; без неё русские буквы превращаются в мусор.',
});
sc('net', {
  topic: NET, d: 'intermediate', lesson: '11net-02-html', subj: ['inf-11-net-html'], sub: 'Изображение и alt',
  prompt: 'Какой код вставит на страницу картинку pic.jpg с её описанием для тех, кто не видит изображение?',
  opts: [
    '<img src="pic.jpg" alt="Рисунок">',
    '<img src="pic.jpg">',
    '<picture alt="Рисунок">',
    '<a href="pic.jpg" alt="Рисунок">',
  ],
  correct: 'A', correctText: '<img src="pic.jpg" alt="Рисунок">',
  why: 'Адрес файла пишут в атрибуте src, а описание — в alt; без alt страница недоступна для незвуковых пользователей.',
});
{
  const left = ['<h1>', '<p>', '<ul>', '<a>', '<img>'];
  const right = ['ссылка', 'изображение', 'абзац текста', 'заголовок первого уровня', 'маркированный список'];
  mt('net', {
    topic: NET, d: 'advanced', lesson: '11net-02-html', subj: ['inf-11-net-html'], sub: 'Основные теги',
    prompt: 'Установите соответствие: тег HTML — что он размечает.',
    left, right,
    map: { '<h1>': right[3], '<p>': right[2], '<ul>': right[4], '<a>': right[0], '<img>': right[1] },
    why: 'Пункты списка лежат внутри <ul> в тегах <li>; почти у каждого тега есть закрывающая пара.',
  });
}

// =====================================================================
// 11net-03-services — сервисы Интернета и цифровая культура
// Нужно дописать: 1/1/1
// =====================================================================
sc('net', {
  topic: NET, d: 'basic', cog: 'remember', lesson: '11net-03-services', subj: ['inf-11-net-services'], sub: 'Выбор сервиса',
  prompt: 'Какой сервис нужен, чтобы построить маршрут от дома до школы?',
  opts: [
    'Карты и навигатор — геоинформационная система',
    'Электронная почта',
    'Видеохостинг',
    'Онлайн-таблица',
  ],
  correct: 'A', correctText: 'Карты и навигатор — геоинформационная система',
  why: 'ГИС собирает, хранит и отображает данные о местоположении объектов — на них и строят маршрут.',
});
sc('net', {
  topic: NET, d: 'intermediate', lesson: '11net-03-services', subj: ['inf-11-net-services'], sub: 'Двухфакторная аутентификация',
  prompt: 'Зачем при входе на портал государственных услуг нужен код подтверждения с телефона, если пароль уже введён?',
  opts: [
    'Украденный пароль сам по себе не даст доступа к учётной записи',
    'Чтобы код занимал меньше символов, чем пароль',
    'Чтобы сайт открывался быстрее',
    'Чтобы не нужно было запоминать пароль',
  ],
  correct: 'A', correctText: 'Украденный пароль сам по себе не даст доступа к учётной записи',
  why: 'Двухфакторная аутентификация требует и пароль, и подтверждение: по одному паролю вход не выполняется.',
});
{
  const left = ['Поиск информации', 'Общение', 'Работа с документами', 'Покупки'];
  const right = ['маркетплейс', 'мессенджеры и электронная почта', 'поисковики и электронные библиотеки', 'онлайн-офис и облачный диск'];
  mt('net', {
    topic: NET, d: 'advanced', lesson: '11net-03-services', subj: ['inf-11-net-services'], sub: 'Задача и сервис',
    prompt: 'Установите соответствие: задача пользователя — сервис Интернета, который её решает.',
    left, right,
    map: {
      'Поиск информации': right[2],
      'Общение': right[1],
      'Работа с документами': right[3],
      'Покупки': right[0],
    },
    why: 'Сервис выбирают под задачу: универсального «сервиса для всего» нет.',
  });
}

// =====================================================================
// 11net-05-etiquette — сетевой этикет и язык поисковых запросов
// Нужно дописать: 1/1/1
// =====================================================================
sc('net', {
  topic: NET, d: 'basic', cog: 'remember', lesson: '11net-05-etiquette', subj: ['inf-11-net-search'], sub: 'Оператор минус',
  prompt: 'Что делает оператор «-» (минус перед словом) в поисковом запросе?',
  opts: [
    'Исключает из выдачи документы, в которых встречается это слово',
    'Требует, чтобы это слово обязательно было на странице',
    'Ищет только внутри одного сайта',
    'Ограничивает поиск по дате публикации',
  ],
  correct: 'A', correctText: 'Исключает из выдачи документы, в которых встречается это слово',
  why: 'Минус убирает нежелательные совпадения: запрос «Python -джава» ищет Python без упоминания джавы.',
});
sc('net', {
  topic: NET, d: 'intermediate', lesson: '11net-05-etiquette', subj: ['inf-11-net-fake'], sub: 'Признаки фейка',
  prompt: 'Сообщение: «СРОЧНО! ВСЕ ДОЛЖНЫ перейти по ссылке и переслать друзьям, иначе будет поздно». Какие признаки недостоверной информации здесь есть?',
  opts: [
    'Срочность, категоричность, требование сразу распространить и отсутствие источника',
    'Признаков нет: сообщение слишком короткое',
    'Только требование распространить',
    'Только отсутствие автора',
  ],
  correct: 'A', correctText: 'Срочность, категоричность, требование сразу распространить и отсутствие источника',
  why: 'Фейк давит чувством срочности и страха и просит переслать; проверить такое сообщение можно только по источнику и дате.',
});
{
  const left = ['AND', 'OR', 'минус перед словом', 'кавычки "..."', 'site:'];
  const right = [
    'исключает документы с этим словом',
    'требует наличия обоих слов',
    'достаточно хотя бы одного из слов',
    'ищет в документах сайта, указанного после оператора',
    'ищет точную фразу',
  ];
  mt('net', {
    topic: NET, d: 'advanced', lesson: '11net-05-etiquette', subj: ['inf-11-net-search'], sub: 'Операторы поиска',
    prompt: 'Установите соответствие: оператор поискового запроса — что он делает.',
    left, right,
    map: {
      'AND': right[1],
      'OR': right[2],
      'минус перед словом': right[0],
      'кавычки "..."': right[4],
      'site:': right[3],
    },
    why: 'Операторы работают как логика: AND, OR, отрицание и точная фраза сужают выдачу.',
  });
}

// =====================================================================
// 11safe-01-security — защита информации и правовое обеспечение
// Нужно дописать: 0/1/1
// =====================================================================
{
  const left = ['Конфиденциальность', 'Целостность', 'Доступность'];
  const right = ['утечка', 'подмена', 'отказ в обслуживании'];
  mt('net', {
    topic: SEC, d: 'intermediate', lesson: '11safe-01-security', subj: ['inf-11-safe-triad'], sub: 'Триада CIA',
    prompt: 'Установите соответствие: задача информационной безопасности — как выглядит её нарушение.',
    left, right,
    map: { 'Конфиденциальность': right[0], 'Целостность': right[1], 'Доступность': right[2] },
    why: 'Три задачи: конфиденциальность, целостность, доступность — и типичные нарушения для каждой.',
  });
}
sc('net', {
  topic: SEC, d: 'advanced', lesson: '11safe-01-security', subj: ['inf-11-safe-sign'], sub: 'Хеш и подпись',
  prompt: 'Почему при усиленной электронной подписи подписывают хеш документа, а не сам документ?',
  opts: [
    'Хеш короткий, а любое изменение документа меняет хеш, и подпись перестаёт совпадать',
    'Документ слишком большой, чтобы подписать его целиком',
    'Хеш шифрует документ и хранит его в зашифрованном виде',
    'Чтобы подпись можно было прочитать без закрытого ключа',
  ],
  correct: 'A', correctText: 'Хеш короткий, а любое изменение документа меняет хеш, и подпись перестаёт совпадать',
  why: 'Хеш — короткий отпечаток документа; изменили хоть один символ — хеш стал другим, и подпись уже не подтверждает подлинность.',
});

// =====================================================================
// 11safe-02-malware — вредоносное ПО и защита
// Нужно дописать: 1/1/1
// =====================================================================
sc('net', {
  topic: SEC, d: 'basic', cog: 'remember', lesson: '11safe-02-malware', subj: ['inf-11-safe-mal'], sub: 'Признаки заражения',
  prompt: 'Компьютер стал работать заметно медленнее, а в списке подключений появился незнакомый постоянный сетевой трафик. Что сделать в первую очередь?',
  opts: [
    'Запустить полную проверку антивирусом и обновить его базы',
    'Переустановить систему с флешки',
    'Отключить антивирус, чтобы компьютер не тормозил',
    'Ничего не делать: так бывает всегда',
  ],
  correct: 'A', correctText: 'Запустить полную проверку антивирусом и обновить его базы',
  why: 'Медленная работа и лишний сетевой трафик — признаки заражения; их чаще всего вызывают программы, которые сами себя не показывают.',
});
{
  const left = ['Вирус', 'Червь', 'Троян', 'Вирус-вымогатель'];
  const right = [
    'шифрует файлы и требует выкуп',
    'встраивается в файл и размножается при запуске',
    'маскируется под полезную программу',
    'распространяется сам по сети через уязвимости',
  ];
  mt('net', {
    topic: SEC, d: 'intermediate', lesson: '11safe-02-malware', subj: ['inf-11-safe-mal'], sub: 'Виды вредоносного ПО',
    prompt: 'Установите соответствие: вид вредоносной программы — как она действует.',
    left, right,
    map: {
      'Вирус': right[1],
      'Червь': right[3],
      'Троян': right[2],
      'Вирус-вымогатель': right[0],
    },
    why: 'Вирусу нужен запуск файла, червь распространяется сам, троян маскируется, вымогатель шифрует данные.',
  });
}
sc('net', {
  topic: SEC, d: 'advanced', lesson: '11safe-02-malware', subj: ['inf-11-safe-mal'], sub: 'Ложное срабатывание',
  prompt: 'Антивирус сообщил об угрозе в файле, который вы точно установили сами из официального источника. Что правильно сделать?',
  opts: [
    'Проверить файл и добавить его в исключения осознанно, не отключая защиту целиком',
    'Сразу отключить антивирус, чтобы он не мешал работе',
    'Удалить все файлы, на которые он ругается',
    'Ничего не менять и больше не включать компьютер',
  ],
  correct: 'A', correctText: 'Проверить файл и добавить его в исключения осознанно, не отключая защиту целиком',
  why: 'Ложное срабатывание бывает; исключение добавляют точечно и осознанно — отключение защиты открывает компьютер настоящим угрозам.',
});

// =====================================================================
// 11safe-03-archive — организация личного архива информации
// Нужно дописать: 1/1/1
// =====================================================================
sc('net', {
  topic: SEC, d: 'basic', cog: 'remember', lesson: '11safe-03-archive', subj: ['inf-11-safe-archive'], sub: 'Правило трёх копий',
  prompt: 'Из чего состоит правило трёх копий?',
  opts: [
    'Оригинал, копия на другом носителе и копия в другом месте',
    'Три копии на одном диске с разными именами',
    'Оригинал и две копии в облаке',
    'Три архиватора, установленных подряд',
  ],
  correct: 'A', correctText: 'Оригинал, копия на другом носителе и копия в другом месте',
  why: 'Три копии защищают от отказа носителя и от кражи или пожара в одном помещении.',
});
sc('net', {
  topic: SEC, d: 'intermediate', lesson: '11safe-03-archive', subj: ['inf-11-safe-crypt'], sub: 'Шифрование и пароль',
  prompt: 'Чем шифрование отличается от пароля на архив?',
  opts: [
    'При шифровании данные математически изменяются, и без ключа их не восстановить даже вычислительными средствами',
    'Шифрование только дольше открывает файл, а пароль ничего не делает',
    'Пароль не защищает файл, а шифрование защищает',
    'Разницы нет: это одно и то же',
  ],
  correct: 'A', correctText: 'При шифровании данные математически изменяются, и без ключа их не восстановить даже вычислительными средствами',
  why: 'Пароль просто спрашивается, а при шифровании содержимое преобразовано по ключу; потерянный ключ означает потерянные данные.',
});
{
  const left = ['Имя файла', 'Структура папок', 'Пароль от архива', 'Резервная копия'];
  const right = ['в другом месте, лучше в другом здании', 'записывается отдельно от архива', 'понятное, а не «Документ1»', 'по темам, а не всё в одной папке'];
  mt('net', {
    topic: SEC, d: 'advanced', lesson: '11safe-03-archive', subj: ['inf-11-safe-archive'], sub: 'Правила архива',
    prompt: 'Установите соответствие: элемент архива — какое требование к нему предъявляется.',
    left, right,
    map: {
      'Имя файла': right[2],
      'Структура папок': right[3],
      'Пароль от архива': right[1],
      'Резервная копия': right[0],
    },
    why: 'Архив работает, когда имена понятны, папки разложены по темам, пароль хранится отдельно, а копия лежит в другом месте.',
  });
}

// =====================================================================
// 11ai-01-intel — средства искусственного интеллекта
// Нужно дописать: 1/1/1
// =====================================================================
sc('net', {
  topic: SEC, d: 'basic', cog: 'remember', lesson: '11ai-01-intel', subj: ['inf-11-ai-ml'], sub: 'Машинное обучение',
  prompt: 'Чем машинное обучение отличается от обычной программы?',
  opts: [
    'Правила не пишет человек: модель выводит закономерности из данных',
    'Работает медленнее любой обычной программы',
    'Ему не нужны данные, только текст задачи',
    'Всегда выдаёт правильный ответ',
  ],
  correct: 'A', correctText: 'Правила не пишет человек: модель выводит закономерности из данных',
  why: 'В обычной программе правила записаны человеком, а в машинном обучении модель подбирает внутренние параметры по примерам.',
});
{
  const left = ['Обучение с учителем', 'Обучение без учителя', 'Обучение с подкреплением'];
  const right = ['только данные, без готовых ответов', 'примеры с готовыми ответами', 'награда за верные действия'];
  mt('net', {
    topic: SEC, d: 'intermediate', lesson: '11ai-01-intel', subj: ['inf-11-ai-ml'], sub: 'Виды обучения',
    prompt: 'Установите соответствие: вид машинного обучения — что ему нужно.',
    left, right,
    map: {
      'Обучение с учителем': right[1],
      'Обучение без учителя': right[0],
      'Обучение с подкреплением': right[2],
    },
    why: 'Фильтр спама учится на примерах с пометками «спам / не спам», группировка покупателей — без ответов, робот — по награде.',
  });
}
sc('net', {
  topic: SEC, d: 'advanced', lesson: '11ai-01-intel', subj: ['inf-11-ai-risk'], sub: 'Предвзятость данных',
  prompt: 'Модель ИИ для отбора резюме систематически отклоняет кандидатов без опыта работы в конкретной сфере. Что это иллюстрирует?',
  opts: [
    'Предвзятость: модель наследует и усиливает перекосы обучающих данных',
    '«Чёрный ящик»: непонятно, как именно модель считает',
    'Дипфейк: подделка изображения',
    'То, что ИИ не понимает смысл текста',
  ],
  correct: 'A', correctText: 'Предвзятость: модель наследует и усиливает перекосы обучающих данных',
  why: 'Модель повторяет закономерности обучающей выборки, включая её перекосы, — это и есть предвзятость.',
});

// =====================================================================
// 11ai-02-pr — практическая работа: интернет-приложения на основе ИИ
// Нужно дописать: 1/1/1
// =====================================================================
sc('net', {
  topic: SEC, d: 'basic', cog: 'remember', lesson: '11ai-02-pr', subj: ['inf-11-ai-check'], sub: 'Ошибки перевода',
  prompt: 'При переводе фраза «проверка не выполняется» превратилась в «проверка выполняется». Что это за типичная ошибка ИИ-сервиса?',
  opts: [
    'Потеря отрицания: смысл фразы изменился на противоположный',
    'Искажение числа',
    'Неверный перевод термина',
    'Придуманный источник',
  ],
  correct: 'A', correctText: 'Потеря отрицания: смысл фразы изменился на противоположный',
  why: 'Отрицания, числа и имена проверяют в первую очередь: ошибка в них меняет смысл высказывания полностью.',
});
sc('net', {
  topic: SEC, d: 'intermediate', lesson: '11ai-02-pr', subj: ['inf-11-ai-prompt'], sub: 'Постановка задачи',
  prompt: 'Какой запрос к ИИ-сервису лучше сформулирован для подготовки реферата?',
  opts: [
    'Сделай план реферата из пяти разделов об искусственном интеллекте в школе для 11 класса',
    'Реферат про ИИ',
    'ИИ',
    'Напиши как можно больше текста про ИИ',
  ],
  correct: 'A', correctText: 'Сделай план реферата из пяти разделов об искусственном интеллекте в школе для 11 класса',
  why: 'Чёткая постановка важнее длины запроса: указаны вид работы, объём, тема и адресат.',
});
{
  const left = ['Факты', 'Термины', 'Числа и формулы', 'Логика'];
  const right = ['вручную, пересчётом', 'по отраслевому словарю', 'смысловая проверка на противоречия', 'по учебнику или первоисточнику'];
  mt('net', {
    topic: SEC, d: 'advanced', lesson: '11ai-02-pr', subj: ['inf-11-ai-check'], sub: 'Что и как проверять',
    prompt: 'Установите соответствие: что проверяют в результате ИИ — как именно проверяют.',
    left, right,
    map: {
      'Факты': right[3],
      'Термины': right[1],
      'Числа и формулы': right[0],
      'Логика': right[2],
    },
    why: 'Эти четыре проверки обязательны: результат ИИ сдавать без них нельзя.',
  });
}

// =====================================================================
// 11ai-05-pr2 — практическая работа: приложения ИИ, продолжение
// Нужно дописать: 1/1/1
// =====================================================================
sc('net', {
  topic: SEC, d: 'basic', cog: 'remember', lesson: '11ai-05-pr2', subj: ['inf-11-ai-face'], sub: 'Распознавание лиц',
  prompt: 'Чем распознавание лиц отличается от распознавания изображений?',
  opts: [
    'Распознавание лиц отвечает на вопрос «кто изображён», а распознавание изображений — «что изображено»',
    'Ничем не отличаются: это одно и то же',
    'Распознавание лиц работает только с фотографиями людей',
    'Распознавание лиц не использует машинное обучение',
  ],
  correct: 'A', correctText: 'Распознавание лиц отвечает на вопрос «кто изображён», а распознавание изображений — «что изображено»',
  why: 'Распознавание лиц — частный случай: не «что изображено», а «кто изображён».',
});
{
  const left = ['Мигание и движения головы', 'Рассинхронизация губ и звука', 'Артефакты на кистях рук'];
  const right = ['лишние или размытые пальцы', '«плавающие» пиксели при движении', 'задержка звука относительно речи'];
  mt('net', {
    topic: SEC, d: 'intermediate', lesson: '11ai-05-pr2', subj: ['inf-11-ai-deepfake'], sub: 'Артефакты дипфейка',
    prompt: 'Установите соответствие: что наблюдаем в поддельном видео — как это выглядит на экране.',
    left, right,
    map: {
      'Мигание и движения головы': right[1],
      'Рассинхронизация губ и звука': right[2],
      'Артефакты на кистях рук': right[0],
    },
    why: 'Дипфейк выдают артефакты: «плавающие» пиксели, лишние пальцы, рассинхрон звука и губ.',
  });
}
sc('net', {
  topic: SEC, d: 'advanced', lesson: '11ai-05-pr2', subj: ['inf-11-ai-privacy'], sub: 'Персональные данные',
  prompt: 'Сервис распознавания лиц работает без согласия людей, сохраняет их данные и передаёт их третьим лицам. Какое правило нарушено?',
  opts: [
    'Личные данные — только с согласия человека и в объёме, необходимом для задачи',
    'Данные нужно шифровать, а это не сделано',
    'Нельзя хранить данные на сервере вообще',
    'Нарушения нет: сервис публичный',
  ],
  correct: 'A', correctText: 'Личные данные — только с согласия человека и в объёме, необходимом для задачи',
  why: 'Согласие и минимизация объёма — базовые правила работы с персональными данными; их нарушают чаще всего.',
});

// =====================================================================
// 11ai-04-pr3 — итоговая практическая работа: приложения на основе ИИ
// Нужно дописать: 1/1/1
// =====================================================================
sc('net', {
  topic: SEC, d: 'basic', cog: 'remember', lesson: '11ai-04-pr3', subj: ['inf-11-ai-project'], sub: 'Обязательный этап',
  prompt: 'Какая часть проектной работы обязательна, даже если всё остальное сделано хорошо?',
  opts: [
    'Проверка результата по фактам, терминам, числам и логике',
    'Титульный лист с красивым шрифтом',
    'Презентация ровно на двадцать слайдов',
    'Скриншоты «невероятных» результатов',
  ],
  correct: 'A', correctText: 'Проверка результата по фактам, терминам, числам и логике',
  why: 'Работа без проверки результата — главная потеря баллов: её нельзя заменить оформлением.',
});
sc('net', {
  topic: SEC, d: 'intermediate', lesson: '11ai-04-pr3', subj: ['inf-11-ai-project'], sub: 'Ценность работы',
  prompt: 'Что в проектной работе по ИИ-сервисам приводится в первую очередь?',
  opts: [
    'Конкретные примеры ошибок сервиса с объяснением, почему они возникли',
    'Полный текст, сгенерированный ИИ целиком',
    'Скриншоты с самыми красивыми ответами',
    'Список всех сервисов без разбора результата',
  ],
  correct: 'A', correctText: 'Конкретные примеры ошибок сервиса с объяснением, почему они возникли',
  why: 'Главная ценность такой работы — найденные конкретные ошибки: по ним видно, где ИИ не справляется.',
});
{
  const left = ['Постановка задачи', 'Корректность применения', 'Проверка результата', 'Анализ ошибок'];
  const right = ['проверка выполнена по пунктам, а не «на глаз»', 'инструмент выбран обоснованно', 'задача сформулирована явно', 'найдены конкретные ошибки'];
  mt('net', {
    topic: SEC, d: 'advanced', lesson: '11ai-04-pr3', subj: ['inf-11-ai-project'], sub: 'Критерии оценки',
    prompt: 'Установите соответствие: критерий оценки проектной работы — что по нему оценивается.',
    left, right,
    map: {
      'Постановка задачи': right[2],
      'Корректность применения': right[1],
      'Проверка результата': right[0],
      'Анализ ошибок': right[3],
    },
    why: 'Выводы должны следовать из работы: поэтому важны и проверка по пунктам, и конкретные найденные ошибки.',
  });
}

// =====================================================================
// 11graph-02-paths — анализ графов: оптимальный путь и число путей (1/1/1)
// =====================================================================
{
  // Число путей в ориентированном ациклическом графе считаем накоплением:
  // в вершину-источник — 1 (пустой путь), дальше сумма по предшественникам.
  const pred = { B: ['A'], C: ['A'], D: ['B', 'C'] };
  const order = ['A', 'B', 'C', 'D'];
  const ways = { A: 1 };
  for (const v of ['B', 'C', 'D']) ways[v] = pred[v].reduce((s, p) => s + ways[p], 0);
  if (ways.D !== 2) throw new Error(`путей в D: ${ways.D}`);
  num('graph', {
    topic: GRF, d: 'basic', cog: 'apply', lesson: '11graph-02-paths', subj: ['inf-11-graph-dag'],
    sub: 'Число путей в ациклическом графе',
    prompt: 'В ориентированном ациклическом графе есть рёбра A→B, A→C, B→D, C→D. Сколько путей ведёт из A в D? Запишите только число.',
    value: ways.D,
    why: 'Пути считают накоплением от начала: в B попадает 1 путь, в C тоже 1, а в D складываются пути из обоих предшественников — 1 + 1 = 2. Это пути A→B→D и A→C→D; в вершину-источник засчитывается пустой путь.',
  });
}
{
  // Кратчайший путь перебором всех простых путей: минимум суммы весов.
  const w = {
    'A|B': 4, 'A|C': 2, 'C|B': 1, 'B|D': 5, 'C|D': 8,
  };
  const undirected = [
    ['A', 'B'], ['A', 'C'], ['C', 'B'], ['B', 'D'], ['C', 'D'],
  ];
  const weight = (u, v) => w[`${u}|${v}`] ?? w[`${v}|${u}`];
  const allPaths = [];
  const walk = (node, path, cost) => {
    if (node === 'D') {
      allPaths.push({ path: [...path, 'D'], cost });
      return;
    }
    for (const [u, v] of undirected) {
      const nextNode = u === node ? v : v === node ? u : null;
      if (!nextNode || path.includes(nextNode)) continue;
      walk(nextNode, [...path, nextNode], cost + weight(node, nextNode));
    }
  };
  walk('A', ['A'], 0);
  const best = Math.min(...allPaths.map((p) => p.cost));
  const bestPath = allPaths.filter((p) => p.cost === best);
  if (best !== 8) throw new Error(`кратчайший путь: ${best}`);
  num('graph', {
    topic: GRF, d: 'intermediate', cog: 'apply', lesson: '11graph-02-paths', subj: ['inf-11-graph-weight'],
    sub: 'Кратчайший путь по весам',
    prompt: 'Взвешенный граф: веса рёбер A–B = 4, A–C = 2, C–B = 1, B–D = 5, C–D = 8. Чему равна длина кратчайшего пути из A в D? Запишите только число.',
    value: best,
    why: `Складываем веса вдоль каждого пути: A→B→D = 9, A→C→D = 10, A→C→B→D = ${bestPath[0].path.map((v, i) => (i ? '' : '') + v).join('→')} = ${w['A|C']} + ${w['C|B']} + ${w['B|D']} = ${best}. Путь с наименьшим числом рёбер не обязательно самый лёгкий, поэтому сравнивают суммы весов.`,
  });
}
{
  const left = ['Кратчайший путь', 'Число путей в ациклическом графе', 'Весовая матрица', 'Матрица смежности'];
  const right = [
    'минимальная из сумм весов вдоль путей',
    'сумма чисел путей по всем предшественникам',
    'вес ребра, а если ребра нет — ноль',
    'единица, если ребро есть, и ноль, если нет',
  ];
  mt('graph', {
    topic: GRF, d: 'advanced', cog: 'analyze', lesson: '11graph-02-paths', subj: ['inf-11-graph-weight'],
    sub: 'Величины и что они считают',
    prompt: 'Установите соответствие: величина в задачах о графах — как её получают.',
    left, right,
    map: {
      'Кратчайший путь': right[0],
      'Число путей в ациклическом графе': right[1],
      'Весовая матрица': right[2],
      'Матрица смежности': right[3],
    },
    why: 'Смысл у всех четырёх разный: длину сравнивают, число путей накапливают, а матрицы только хранят рёбра. Путать их опасно — считают не то.',
  });
}

// =====================================================================
// 11graph-03-table — выигрышная стратегия в табличной форме (1/1/1)
// =====================================================================

// Разметка W/L для игры «куча камней»: ходы +1 и +2, выигрывает тот,
// кто сделает сумму не меньше 11. Общая для трёх заданий этого урока.
const LIMIT = 11;
// GAME_MARK[позиция] = 'W' | 'L'. Имя не MARK: MARK уже занят маркером секции.
const GAME_MARK = {};
// Разметка идёт С КОНЦА (от 10 вниз): позиция зависит от больших,
// которые к этому моменту уже размечены.
for (let s = LIMIT - 1; s >= 1; s--) {
  if ([1, 2].some((d) => s + d >= LIMIT)) {
    GAME_MARK[s] = 'W'; // можно выиграть одним ходом
    continue;
  }
  const nexts = [1, 2].map((d) => s + d);
  GAME_MARK[s] = nexts.some((t) => GAME_MARK[t] === 'L') ? 'W' : 'L';
}
const LOSING = Object.entries(GAME_MARK).filter(([, v]) => v === 'L').map(([k]) => Number(k)).sort((a, b) => a - b);
if (LOSING.join(',') !== '2,5,8') throw new Error(`проигрышные позиции: ${LOSING}`);

{
  const losing = LOSING;
  num('graph', {
    topic: GAM, d: 'basic', cog: 'apply', lesson: '11graph-03-table', subj: ['inf-11-graph-game'],
    sub: 'Число проигрышных позиций',
    prompt: 'В игре куча камней: за ход прибавляют 1 или 2 камня, выигрывает тот, кто первым сделает сумму не меньше 11. Позиции размечают от 10 вниз. Сколько проигрышных позиций среди 1, 2, …, 10? Запишите только число.',
    value: losing.length,
    why: `Позиция проигрышная, когда любой ход отдаёт сопернику выигрышную позицию. Разметка от 10 вниз даёт проигрышные позиции ${losing.join(', ')} — их ${losing.length}. Проверка: из 8 ходы ведут в 9 и 10, а обе позиции выигрышные.`,
  });
}
{
  sc('graph', {
    topic: GAM, d: 'intermediate', cog: 'apply', lesson: '11graph-03-table', subj: ['inf-11-graph-game'],
    sub: 'Разметка таблицы стратегии',
    prompt: 'В таблице стратегии позиции отмечают буквами W и L. Что означает отметка L у позиции?',
    opts: [
      'Любой ход из этой позиции передаёт сопернику выигрышную (W)',
      'Из этой позиции есть ход в проигрышную (L)',
      'Позиция стоит в конце игры, ходов из неё нет',
      'Позиция выиграна игроком, который сейчас ходит',
    ],
    correct: 'A',
    correctText: 'Любой ход из этой позиции передаёт сопернику выигрышную (W)',
    why: 'Позиция проигрышная именно тогда, когда все ходы ведут в выигрышные для соперника позиции. Отметка W означает обратное — есть хотя бы один ход в проигрышную.',
  });
}
{
  // Первый игрок из 7 всегда ходит в проигрышную для соперника позицию.
  // Считаем, сколько своих ходов он сделает при любом ответе соперника.
  const isLosing = (s) => GAME_MARK[s] === 'L';
  const playOut = (opponentDelta) => {
    let s = 7;
    let mine = 0;
    while (s < LIMIT) {
      s += isLosing(s + 1) ? 1 : 2; // наш ход: оставляем сопернику L
      mine += 1;
      if (s >= LIMIT) break;
      s += opponentDelta;
    }
    return mine;
  };
  const forBoth = [playOut(1), playOut(2)];
  if (forBoth[0] !== forBoth[1]) throw new Error(`стратегия зависит от ответа соперника: ${forBoth}`);
  num('graph', {
    topic: GAM, d: 'advanced', cog: 'analyze', lesson: '11graph-03-table', subj: ['inf-11-graph-game'],
    sub: 'Длина выигрышной стратегии',
    prompt: 'В игре куча камней за ход прибавляют 1 или 2, выигрывает тот, кто сделает сумму не меньше 11. Первый игрок начинает с 7 и ходит по выигрышной стратегии: оставляет сопернику проигрышную позицию. Сколько своих ходов он сделает до конца партии при любом ответе соперника? Запишите только число.',
    value: forBoth[0],
    why: `Первый ход: 7 + 1 = 8 — сопернику достаётся проигрышная позиция. Соперник вынужден отдать 9 или 10, и оба ответа добьюются вторым ходом: 9 + 2 = 11 или 10 + 1 = 11. Значит своих ходов всегда ${forBoth[0]}, независимо от ответа.`,
  });
}

// =====================================================================
// Запись файлов
// =====================================================================

let total = 0;
for (const [name, b] of Object.entries(BANK)) {
  const body = [MARK, ...out[name]].join('\n\n');
  writeFileSync(b.file, `${heads[name]}\n\n${body}\n`, 'utf-8');
  total += out[name].length;
  console.log(`BANK-11 OK: ${b.file} — добавлено ${out[name].length} (${next[name] - 1})`);
}

const expect = { data: 19, db: 4, algo: 26, net: 33, graph: 6 };
for (const [name, n] of Object.entries(expect)) {
  if (out[name].length !== n) throw new Error(`${name}: ожидали ${n} заданий, вышло ${out[name].length}`);
}
if (total !== 88) throw new Error(`всего ожидали 88 заданий, вышло ${total}`);
console.log(`BANK-11 ИТОГО: ${total} заданий`);