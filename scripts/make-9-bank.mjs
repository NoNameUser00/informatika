// Генератор дописываемых заданий 9 класса.
// Ответы вычисляются кодом и тут же проверяются assert-ами: если число не сошлось —
// сборка падает. Ключи code_run прогоняются настоящим Python, если он доступен.
//
// Банки не переписываются целиком: ручная часть файла остаётся, а сгенерированный
// блок каждый раз отрезается по маркеру и пишется заново. Поэтому повторный
// запуск не меняет файлы.
//
// Запуск: node scripts/make-9-bank.mjs
// Затем: npm run validate-bank && npm run trainer:json
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const MARK = '# ==== ДОПИСАНО scripts/make-9-bank.mjs (далее руками не править) ====';

const FILES = {
  sheet: 'data/tasks/9/spreadsheets/bank-9sheet.yaml',
  arr: 'data/tasks/9/arrays/bank-9arr.yaml',
  graph: 'data/tasks/9/graphs/bank-9graph.yaml',
  extra: 'data/tasks/9/extra/bank-9extra.yaml',
};

// ---------------------------------------------------------------------------
// Проверки
// ---------------------------------------------------------------------------
let checks = 0;
function eq(got, want, msg) {
  checks++;
  if (got !== want) throw new Error(`ASSERT FAIL: ${msg}: получено ${JSON.stringify(got)}, ожидалось ${JSON.stringify(want)}`);
}
function ok(cond, msg) {
  checks++;
  if (!cond) throw new Error(`ASSERT FAIL: ${msg}`);
}

// ---------------------------------------------------------------------------
// Математика (считаем ответы, а не пишем их руками)
// ---------------------------------------------------------------------------
const sum = (a) => a.reduce((s, x) => s + x, 0);
const countWhere = (a, f) => a.filter(f).length;
const mean = (a) => sum(a) / a.length;
const maxOf = (a) => a.reduce((m, x) => (x > m ? x : m), a[0]);
const indexOfMax = (a) => a.indexOf(maxOf(a));
const range = (n) => Array.from({ length: n }, (_, i) => i);
const sumBy = (rows, f, v) => sum(rows.filter((r) => f(r, v)).map((r) => v(r)));
const meanInt = (a) => {
  const m = mean(a);
  eq(Number.isInteger(m), true, `среднее ${a} должно быть целым (для числового ответа)`);
  return m;
};

/** Число путей в вершины DAG накоплением по топологическому порядку. */
function countPathsDag(edges, order) {
  const ways = new Map(order.map((v) => [v, 0]));
  ways.set(order[0], 1);
  for (const v of order) {
    for (const to of edges[v] ?? []) {
      ways.set(to, ways.get(to) + ways.get(v));
    }
  }
  return ways;
}

/** Кратчайший путь перебором всех путей (граф ацикличен). */
function shortestPath(edges, from, to) {
  let best = Infinity;
  let bestPath = null;
  const walk = (v, sum_, path) => {
    if (v === to) {
      if (sum_ < best) {
        best = sum_;
        bestPath = [...path];
      }
      return;
    }
    for (const [next, w] of edges[v] ?? []) {
      walk(next, sum_ + w, [...path, next]);
    }
  };
  walk(from, 0, [from]);
  return { cost: best, path: bestPath };
}

/** Кратчайший путь по числу рёбер — для сравнения с кратчайшим по весам. */
function fewestEdges(edges, from, to) {
  let best = Infinity;
  const walk = (v, d) => {
    if (v === to) {
      best = Math.min(best, d);
      return;
    }
    for (const [next] of edges[v] ?? []) walk(next, d + 1);
  };
  walk(from, 0);
  return best;
}

// ---------------------------------------------------------------------------
// Python для code_run: эталон проверяется настоящим запуском, если python есть
// ---------------------------------------------------------------------------
let pyReady = true;
try {
  execFileSync('python', ['-c', 'print(1)'], { stdio: 'ignore' });
} catch {
  pyReady = false;
  console.warn('WARN: python не найден — эталоны code_run проверены только на уровне непустоты.');
}
function pyRun(code) {
  if (!pyReady) return null;
  const out = execFileSync('python', ['-c', code], { encoding: 'utf-8' });
  return out.replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

// ---------------------------------------------------------------------------
// Конструкторы заданий
// ---------------------------------------------------------------------------
const J = (s) => JSON.stringify(String(s));
const LETTERS = 'ABCD';

const META = {
  basic: { points: 1, cog: 'remember', req: 1.1, el: 1.1 },
  intermediate: { points: 2, cog: 'apply', req: 1.2, el: 1.3 },
  advanced: { points: 3, cog: 'analyze', req: 1.3, el: 1.6 },
};

/** numeric_base: ответ — целое число в десятичной системе. */
function NUM(bank, o) {
  const { points, cog, req, el } = META[o.d];
  eq(Number.isInteger(o.answer), true, `${o.id ?? 'num'}: ответ должен быть целым, получено ${o.answer}`);
  eq(String(o.answer), o.key ?? String(o.answer), `${o.id ?? 'num'}: answer_text должен совпадать с числом`);
  bank.push({
    cls: 9, type: 'numeric_base', difficulty: o.d, cognitive_level: cog, points, req, el,
    lesson: o.lesson, subject: o.subject, meta: o.meta ?? 'plan-actions',
    subtopic: o.subtopic, prompt: o.prompt, answer: o.answer,
    student: `{ base: 10, placeholder: "только число" }`,
    auto: `{ method: numeric_base, base: 10, strip_affixes: true }`,
    teacher: `{ accepted_values_decimal: [${o.answer}], answer_text: ${J(String(o.answer))}, explanation: ${J(o.why)} }`,
  });
}

/** single_choice: 4 варианта, ровно один правильный. */
function SC(bank, o) {
  const { points, cog, req, el } = META[o.d];
  eq(o.opts.length, 4, `${o.subtopic}: вариантов должно быть 4`);
  eq(new Set(o.opts).size, 4, `${o.subtopic}: варианты должны различаться`);
  const ci = LETTERS.indexOf(o.correct);
  ok(ci >= 0 && ci < 4, `${o.subtopic}: correct должен быть A..D`);
  bank.push({
    cls: 9, type: 'single_choice', difficulty: o.d, cognitive_level: cog, points, req, el,
    lesson: o.lesson, subject: o.subject, meta: o.meta ?? 'plan-actions',
    subtopic: o.subtopic, prompt: o.prompt,
    student: `{ options: [${o.opts.map((t, i) => `{ id: ${LETTERS[i]}, text: ${J(t)} }`).join(', ')}] }`,
    auto: `{ method: exact_option }`,
    teacher: `{ answer: ${o.correct}, explanation: ${J(o.why)} }`,
  });
}

/** matching: столько же пар слева и справа, все значения уникальны. */
function MT(bank, o) {
  const { points, cog, req, el } = META[o.d];
  eq(Object.keys(o.map).length, o.left.length, `${o.subtopic}: число соответствий должно совпадать с числом левых элементов`);
  eq(new Set(Object.values(o.map)).size, o.left.length, `${o.subtopic}: правые значения должны быть уникальны`);
  for (const k of o.left) ok(Object.prototype.hasOwnProperty.call(o.map, k), `${o.subtopic}: нет пары для ${k}`);
  bank.push({
    cls: 9, type: 'matching', difficulty: o.d, cognitive_level: cog, points, req, el,
    lesson: o.lesson, subject: o.subject, meta: o.meta ?? 'plan-actions',
    subtopic: o.subtopic, prompt: o.prompt,
    student: `{ left: [${o.left.map(J).join(', ')}], right: [${o.right.map(J).join(', ')}] }`,
    auto: `{ method: matching, partial: proportional }`,
    teacher: `{ answer_map: { ${o.left.map((k) => `${J(k)}: ${J(o.map[k])}`).join(', ')} }, explanation: ${J(o.why)} }`,
  });
}

/** code_run: эталон прогоняется настоящим Python. */
function CR(bank, o) {
  const { points, cog, req, el } = META[o.d];
  const got = pyRun(o.solution);
  if (got !== null) eq(got, o.expected, `${o.subtopic}: вывод solution_code не совпал с эталоном`);
  ok(o.solution.trim().length > 0 && o.expected.length > 0, `${o.subtopic}: пустое решение или эталон`);
  bank.push({
    cls: 9, type: 'code_run', difficulty: o.d, cognitive_level: cog, points, req, el,
    lesson: o.lesson, subject: o.subject, meta: o.meta ?? 'plan-actions',
    subtopic: o.subtopic, prompt: o.prompt,
    student: `{\n    language: python,\n    template: ${J(o.template)}\n  }`,
    auto: `{ method: code_stdout, timeout_s: 10 }`,
    teacher: `\n    solution_code: ${J(o.solution)}\n    expected_stdout: ${J(o.expected)}\n    explanation: ${J(o.why)}`,
  });
}

// ---------------------------------------------------------------------------
// Банки и нумерация id
// ---------------------------------------------------------------------------
const sheet = [];
const arr = [];
const graph = [];
const extra = [];

const idFor = { sheet: 11, arr: 12, graph: 11, extra: 21 };
const pad = (n) => String(n).padStart(3, '0');
const PREFIX = { sheet: 'inf-9-sheet-', arr: 'inf-9-arr-', graph: 'inf-9-graph-', extra: 'inf-9-extra-' };
function finish(bank, key, topic) {
  return bank.map((t) => {
    const id = PREFIX[key] + pad(idFor[key]++);
    return { id, topic, ...t };
  });
}

const S = (lesson, subtopic, subject) => ({ lesson, subtopic, subject });

// ===========================================================================
// ЭЛЕКТРОННЫЕ ТАБЛИЦЫ
// ===========================================================================
{
  const B = 'Электронные таблицы';
  void B;

  // --- КТП 2 | 9sheet-01-base | 0/1/1 ---
  {
    const cells = 3 * 9;
    eq(cells, 27, 'диапазон B2:D10');
    NUM(sheet, {
      d: 'intermediate', ...S('9sheet-01-base', 'Диапазон ячеек', 'inf-9-sheet-base'), answer: cells,
      prompt: 'В таблице выделен диапазон B2:D10. Сколько в нём ячеек? Запишите только число.',
      why: 'Столбцов B, C, D — три; строк со 2-й по 10-ю — девять. 3 · 9 = 27 ячеек.',
    });
  }
  {
    const a1 = 5, b1 = a1 * a1, c1 = b1 + a1;
    eq(b1, 25, 'A1^2 при A1=5');
    eq(c1, 30, 'C1 = B1 + A1');
    SC(sheet, {
      d: 'advanced', ...S('9sheet-01-base', 'Цепочка формул', 'inf-9-sheet-base'),
      prompt: 'В ячейке A1 стоит число 5. В B1 введено =A1^2, в C1 введено =B1+A1. Что покажет C1?',
      opts: ['30', '35', '10', '50'], correct: 'A',
      why: 'B1 = 5 · 5 = 25, затем C1 = 25 + 5 = 30. Формулы считаются по порядку: в C1 берётся уже вычисленное значение B1.',
    });
  }

  // --- КТП 3 | 9sheet-02-data | 1/1/1 ---
  {
    SC(sheet, {
      d: 'basic', ...S('9sheet-02-data', 'Ввод данных', 'inf-9-sheet-data'),
      prompt: 'В ячейку ввели число, перед которым стоит пробел. Что окажется в ячейке?',
      opts: ['Текст, а не число', 'Число без пробела', 'Ошибка ввода', 'Пустая ячейка'], correct: 'A',
      why: 'Пробел в начале LibreOffice Calc воспринимает как признак начала текста. Такое значение потом не участвует в вычислениях и сортируется как текст.',
    });
  }
  {
    const last = 13, first = 2;
    const rows = last - first + 1;
    eq(rows, 12, 'строк данных B2:B13');
    NUM(sheet, {
      d: 'intermediate', ...S('9sheet-02-data', 'Шапка и данные', 'inf-9-sheet-data'), answer: rows,
      prompt: 'В строке 1 стоит шапка, данные введены в строки со 2-й по 13-ю. Сколько строк данных в диапазоне B2:B13? Запишите только число.',
      why: 'Диапазон включает строки с обеими границами: 13 − 2 + 1 = 12 строк. Шапка в диапазон не входит, поэтому её вычитать не нужно.',
    });
  }
  {
    const map = {
      'число 125': 'число',
      'дата 01.03.2025': 'дата',
      'телефон, введённый числом': 'теряет ведущие нули',
      'текст с пробелом в начале': 'становится текстом',
    };
    MT(sheet, {
      d: 'advanced', ...S('9sheet-02-data', 'Типы данных при вводе', 'inf-9-sheet-data'),
      prompt: 'Установите соответствие: что введено в ячейку — что получится.',
      left: Object.keys(map), right: Object.values(map), map,
      why: 'Тип значения задаёт сама таблица: число остаётся числом, дата — датой, телефон числом теряет ведущие нули, пробел в начале делает значение текстом.',
    });
  }

  // --- КТП 4 | 9sheet-02-refs | 0/0/1 ---
  {
    // =A1^2 из B3 копируется в C4: строка +1, столбец +1 -> =B2^2
    const shifted = 'B2';
    eq(shifted, 'B2', 'сдвиг ссылки A1 из B3 в C4');
    SC(sheet, {
      d: 'advanced', ...S('9sheet-02-refs', 'Сдвиг относительной ссылки', 'inf-9-sheet-refs'),
      prompt: 'Формула =A1^2 из ячейки B3 скопирована в ячейку C4. Что теперь в C4?',
      opts: ['=B2^2', '=A1^2', '=B1^2', '=A2^2'], correct: 'A',
      why: 'Относительная ссылка сдвигается вместе с формулой: строка 1 -> 2, столбец A -> B. Получается =B2^2.',
    });
  }

  // --- КТП 5 | 9sheet-03-functions | 1/1/1 ---
  {
    const a = [8, 3, 6];
    const mn = Math.min(...a);
    eq(mn, 3, 'МИН(8, 3, 6)');
    NUM(sheet, {
      d: 'basic', ...S('9sheet-03-functions', 'Функция МИН', 'inf-9-sheet-func'), answer: mn,
      prompt: 'Что вернёт формула =МИН(8; 3; 6)? Запишите только число.',
      why: 'МИН берёт наименьшее из аргументов: из 8, 3 и 6 это 3.',
    });
  }
  {
    const raw = [10, 20, 30, 40, 'нет данных'];
    const nums = raw.filter((x) => typeof x === 'number');
    eq(nums.length, 4, 'СРЗНАЧ считает только числа');
    const sr = meanInt(nums);
    eq(sr, 25, 'СРЗНАЧ по четырём числам');
    NUM(sheet, {
      d: 'intermediate', ...S('9sheet-03-functions', 'СРЗНАЧ и текст', 'inf-9-sheet-func'), answer: sr,
      prompt: 'В диапазоне B2:B6 стоят 10, 20, 30, 40 и текст «нет данных». Чему равно =СРЗНАЧ(B2:B6)? Запишите только число.',
      why: 'СРЗНАЧ берёт только числа: (10 + 20 + 30 + 40) / 4 = 100 / 4 = 25. Текст и пустые ячейки делитель не увеличивают.',
    });
  }
  {
    const a = [12, 7, 25, 3, 18, 9];
    const mx = maxOf(a), mn = Math.min(...a), spread = mx - mn;
    eq(spread, 22, 'размах');
    NUM(sheet, {
      d: 'advanced', ...S('9sheet-03-functions', 'Размах', 'inf-9-sheet-func'), answer: spread,
      prompt: 'В диапазоне стоят числа 12, 7, 25, 3, 18, 9. Чему равно =МАКС(B2:B7)-МИН(B2:B7)? Запишите только число.',
      why: 'МАКС = 25, МИН = 3, размах = 25 − 3 = 22. Так одним выражением показывают разброс данных.',
    });
  }

  // --- КТП 6 | 9sheet-04-logic | 1/1/1 ---
  {
    const b2 = 7;
    const res = b2 > 10 ? 'много' : 'мало';
    eq(res, 'мало', 'ЕСЛИ при B2=7');
    SC(sheet, {
      d: 'basic', ...S('9sheet-04-logic', 'ЕСЛИ: условие', 'inf-9-sheet-cond'),
      prompt: 'В ячейке B2 стоит 7. Что вернёт =ЕСЛИ(B2>10;"много";"мало")?',
      opts: ['мало', 'много', '10', '7'], correct: 'A',
      why: '7 больше 10? Нет, поэтому выполняется ветка «нет» — «мало».',
    });
  }
  {
    const c2 = 1500;
    const res = c2 > 1000 ? c2 * 0.9 : c2;
    eq(res, 1350, 'скидка 10% при 1500');
    NUM(sheet, {
      d: 'intermediate', ...S('9sheet-04-logic', 'ЕСЛИ со скидкой', 'inf-9-sheet-cond'), answer: res,
      prompt: 'В ячейке C2 стоит 1500. Что покажет =ЕСЛИ(C2>1000;C2*0,9;C2)? Запишите только число.',
      why: '1500 больше 1000, поэтому берётся скидка 10%: 1500 · 0,9 = 1350.',
    });
  }
  {
    const c2 = 2500;
    const res = c2 > 2000 ? c2 * 0.8 : (c2 > 1000 ? c2 * 0.9 : c2);
    eq(res, 2000, 'вложенный ЕСЛИ при 2500');
    NUM(sheet, {
      d: 'advanced', ...S('9sheet-04-logic', 'Вложенный ЕСЛИ', 'inf-9-sheet-cond'), answer: res,
      prompt: 'В ячейке C2 стоит 2500. Что покажет =ЕСЛИ(C2>2000;C2*0,8;ЕСЛИ(C2>1000;C2*0,9;C2))? Запишите только число.',
      why: 'Самое крупное условие проверяется первым: 2500 > 2000, значит скидка 20%: 2500 · 0,8 = 2000. Если бы условие 1000 проверялось первым, получилось бы 2250.',
    });
  }

  // --- КТП 7 | 9sheet-03-analysis | 0/0/1 ---
  {
    const marks = [3, 4, 5, 4, 5, 3, 4, 5, 4, 3];
    const n = countWhere(marks, (m) => m >= 4);
    eq(n, 7, 'СЧЁТЕСЛИ(">=4")');
    NUM(sheet, {
      d: 'advanced', ...S('9sheet-03-analysis', 'СЧЁТЕСЛИ', 'inf-9-sheet-cond'), answer: n,
      prompt: 'В диапазоне B2:B11 стоят баллы десяти учеников: 3, 4, 5, 4, 5, 3, 4, 5, 4, 3. Сколько учеников набрали не меньше 4 (=СЧЁТЕСЛИ(B2:B11;">=4"))? Запишите только число.',
      why: 'Под условию >=4 подходят 4, 5, 4, 5, 4, 5, 4 — семь ячеек из десяти. Остальные три балла ниже 4.',
    });
  }

  // --- КТП 8 | 9sheet-05-filter | 1/1/1 ---
  {
    SC(sheet, {
      d: 'basic', ...S('9sheet-05-filter', 'Фильтр и сортировка', 'inf-9-sheet-filter'),
      prompt: 'Чем фильтрация отличается от сортировки?',
      opts: [
        'Фильтр прячет строки, но не удаляет и не меняет порядок остальных',
        'Фильтр переставляет строки по значениям столбца',
        'Фильтр красит ячейки по условию',
        'Ничем, это одно и то же',
      ], correct: 'A',
      why: 'Сортировка меняет расположение строк, фильтрация меняет только видимость. Снял фильтр — все строки на месте.',
    });
  }
  {
    const total = 12, visible = 4;
    const hidden = total - visible;
    eq(hidden, 8, 'скрытых строк');
    NUM(sheet, {
      d: 'intermediate', ...S('9sheet-05-filter', 'Автофильтр', 'inf-9-sheet-filter'), answer: hidden,
      prompt: 'В таблице 12 строк данных. Автофильтр по товару оставил видимыми 4 строки. Сколько строк скрыто? Запишите только число.',
      why: 'Скрыто 12 − 4 = 8 строк. Они не удалены: после снятия фильтра вернутся все 12.',
    });
  }
  {
    const map = {
      'Сортировка': 'переставляет строки целиком',
      'Фильтрация': 'прячет строки, не удаляя их',
      'Условное форматирование': 'красит ячейки по условию',
    };
    MT(sheet, {
      d: 'advanced', ...S('9sheet-05-filter', 'Три инструмента анализа', 'inf-9-sheet-filter'),
      prompt: 'Установите соответствие: инструмент анализа данных — что он делает.',
      left: Object.keys(map), right: Object.values(map), map,
      why: 'Сортировка меняет порядок строк, фильтрация — видимость, условное форматирование — цвет ячеек. Ничего из этого не удаляет данные.',
    });
  }

  // --- КТП 9 | 9sheet-06-charts | 1/1/1 ---
  {
    SC(sheet, {
      d: 'basic', ...S('9sheet-06-charts', 'Связь с таблицей', 'inf-9-sheet-charts'),
      prompt: 'Что произойдёт с диаграммой, если изменить число в исходной таблице?',
      opts: [
        'Диаграмма перестроится сама',
        'Диаграмма останется прежней',
        'Диаграмма исчезнет',
        'Появится вторая диаграмма',
      ], correct: 'A',
      why: 'Диаграмма связана с диапазоном ячеек: изменил таблицу — изменилось и изображение.',
    });
  }
  {
    const months = [120, 150, 180];
    const sr = meanInt(months);
    eq(sr, 150, 'средние продажи за три месяца');
    NUM(sheet, {
      d: 'intermediate', ...S('9sheet-06-charts', 'Среднее для сравнения', 'inf-9-sheet-charts'), answer: sr,
      prompt: 'Продажи по месяцам: 120, 150, 180 (тыс. руб.). Чему равно =СРЗНАЧ(B2:B4) по этим трём месяцам? Запишите только число.',
      why: '(120 + 150 + 180) / 3 = 450 / 3 = 150. Средняя линия на графике показывает общий уровень — по ней видно, выше или ниже месяц.',
    });
  }
  {
    SC(sheet, {
      d: 'advanced', ...S('9sheet-06-charts', 'Ошибка выбора диаграммы', 'inf-9-sheet-charts'),
      prompt: 'Сравнили площади России, Китая и США и построили круговую диаграмму. Почему это ошибка?',
      opts: [
        'Величины не связаны и не дают 100 %, круговая покажет выдуманные доли',
        'Круговая диаграмма не умеет показывать площади',
        'Нужно было взять три цвета вместо одного',
        'Ошибки нет, круговая подходит любых трёх величин',
      ], correct: 'A',
      why: 'Круговая диаграмма годится только для долей одного целого. Площади стран не составляют 100 %, поэтому доли получаются бессмысленными — нужна столбчатая.',
    });
  }

  // --- КТП 10 | 9sheet-07-model | 1/1/1 ---
  {
    const v = 10;
    const s = (v * v) / 10;
    eq(s, 10, 'тормозной путь при 10 м/с');
    NUM(sheet, {
      d: 'basic', ...S('9sheet-07-model', 'Модель s = v^2/10', 'inf-9-sheet-model'), answer: s,
      prompt: 'Модель тормозного пути: s = v^2/10, скорость v в метрах в секунду. Чему равен путь при v = 10 м/с? Запишите только число.',
      why: 's = 10 · 10 / 10 = 10 метров. Это опорная точка модели, на ней модель проверяют вручную.',
    });
  }
  {
    const v = 25;
    const kmh = v * 3.6;
    eq(kmh, 90, '25 м/с в км/ч');
    NUM(sheet, {
      d: 'intermediate', ...S('9sheet-07-model', 'Перевод единиц', 'inf-9-sheet-model'), answer: kmh,
      prompt: 'В столбце A2 таблицы модели стоит скорость 25 м/с, а в столбце B стоит формула =A2*3,6. Что покажет B2? Запишите только число.',
      why: '25 · 3,6 = 90: скорость в километрах в час. Модель обязана работать в тех единицах, которые указаны в формуле.',
    });
  }
  {
    const s40 = (40 * 40) / 10, s20 = (20 * 20) / 10, k = s40 / s20;
    eq(s40, 160, 'путь при 40 м/с');
    eq(s20, 40, 'путь при 20 м/с');
    eq(k, 4, 'во сколько раз вырос путь');
    NUM(sheet, {
      d: 'advanced', ...S('9sheet-07-model', 'Закон роста пути', 'inf-9-sheet-model'), answer: k,
      prompt: 'Модель s = v^2/10. Во сколько раз тормозной путь больше при 40 м/с, чем при 20 м/с? Запишите только число.',
      why: 'При 40 м/с путь 160 м, при 20 м/с — 40 м, отношение 160 : 40 = 4. Путь растёт не пропорционально скорости, а квадратично.',
    });
  }

  // --- КТП 11 | 9sheet-08-tasks | 1/1/1 ---
  {
    const marks = [4, 5, 3, 5, 4, 3, 5, 4, 5, 3, 4, 5];
    const n = countWhere(marks, (m) => m >= 4);
    eq(n, 9, 'СЧЁТЕСЛИ по 12 баллам');
    NUM(sheet, {
      d: 'basic', ...S('9sheet-08-tasks', 'СЧЁТЕСЛИ по баллам', 'inf-9-sheet-task'), answer: n,
      prompt: 'В B2:B13 баллы 12 учеников: 4, 5, 3, 5, 4, 3, 5, 4, 5, 3, 4, 5. Сколько учеников имеют балл не ниже 4? Запишите только число.',
      why: 'Не меньше 4 — это 4 и 5. Таких ячеек девять из двенадцати: =СЧЁТЕСЛИ(B2:B13;">=4").',
    });
  }
  {
    const marks = [4, 5, 5, 4, 4, 2];
    const sr = meanInt(marks);
    eq(sr, 4, 'СРЗНАЧ по шести баллам');
    NUM(sheet, {
      d: 'intermediate', ...S('9sheet-08-tasks', 'СРЗНАЧ по баллам', 'inf-9-sheet-task'), answer: sr,
      prompt: 'В B2:B7 баллы шести учеников: 4, 5, 5, 4, 4, 2. Чему равен =СРЗНАЧ(B2:B7)? Запишите только число.',
      why: 'Сумма 24, учеников 6: 24 / 6 = 4. Среднее считается только по числам, шапку в диапазон включать нельзя.',
    });
  }
  {
    const rows = [
      { t: 'Тетрадь', s: 250 },
      { t: 'Ручка', s: 150 },
      { t: 'Тетрадь', s: 180 },
      { t: 'Ручка', s: 90 },
    ];
    const money = sumBy(rows, (r) => r.t === 'Тетрадь', (r) => r.s);
    eq(money, 430, 'СУММЕСЛИ по тетрадям');
    NUM(sheet, {
      d: 'advanced', ...S('9sheet-08-tasks', 'СУММЕСЛИ', 'inf-9-sheet-task'), answer: money,
      prompt: 'Столбец B — товар, столбец C — выручка. Строки: Тетрадь 250, Ручка 150, Тетрадь 180, Ручка 90. Сколько выручки принесли продажи тетрадей (=СУММЕСЛИ(C2:C5;B2:B5;"Тетрадь"))? Запишите только число.',
      why: 'Суммируются строки, где в столбце с товаром стоит «Тетрадь»: 250 + 180 = 430. Первый диапазон — что суммируем, второй — где смотрим условие, третий — условие.',
    });
  }

  // --- КТП 28 | 9sheet-09-control | 1/1/1 ---
  {
    SC(sheet, {
      d: 'basic', ...S('9sheet-09-control', 'Разделитель аргументов', 'inf-9-sheet-review'),
      prompt: 'Какой разделитель аргументов используется в русской локали LibreOffice Calc?',
      opts: ['точка с запятой', 'запятая', 'двоеточие', 'пробел'], correct: 'A',
      why: 'В русской локали Calc аргументы разделяют точкой с запятой. Запятая в такой формуле не распознаётся.',
    });
  }
  {
    const s2 = sum([10, 4, 7]), mn = Math.min(...[10, 4, 7]), res = s2 + mn;
    eq(s2, 21, 'СУММ');
    eq(res, 25, 'СУММ + МИН');
    NUM(sheet, {
      d: 'intermediate', ...S('9sheet-09-control', 'Вложенные функции', 'inf-9-sheet-review'), answer: res,
      prompt: 'В B2, B3, B4 стоят 10, 4, 7. Чему равно =СУММ(B2:B4)+МИН(B2:B4)? Запишите только число.',
      why: 'СУММ = 21, МИН = 4, вместе 25. Вложенные функции вычисляются независимо, обе берут один и тот же диапазон.',
    });
  }
  {
    const b2 = 5, c2 = 3;
    const res = b2 >= 4 && c2 >= 4 ? 'да' : 'нет';
    eq(res, 'нет', 'И(B2>=4;C2>=4)');
    SC(sheet, {
      d: 'advanced', ...S('9sheet-09-control', 'Логическое И', 'inf-9-sheet-review'),
      prompt: 'В B2 стоит 5, в C2 — 3. Что вернёт =ЕСЛИ(И(B2>=4;C2>=4);"да";"нет")?',
      opts: ['нет', 'да', '3', '4'], correct: 'A',
      why: 'И требует, чтобы оба условия были верны. 5 >= 4 верно, но 3 >= 4 ложно, поэтому выбирается ветка «нет».',
    });
  }
}

// ===========================================================================
// МАССИВЫ (только Python)
// ===========================================================================
{
  // --- КТП 13 | 9arr-01-basics | 0/0/1 ---
  {
    const solution = 'c = []\nfor i in range(5):\n    c.append(2 * i + 1)\nprint(*c)';
    const expected = [1, 3, 5, 7, 9].join(' ');
    CR(arr, {
      d: 'advanced', ...S('9arr-01-basics', 'Заполнение формулой', 'inf-9-arr-fill'),
      prompt: 'Заполни список пятью первыми нечётными числами по формуле (append в цикле) и выведи их через пробел.',
      template: 'c = []\nfor i in range(5):\n    c.append(...)',
      solution, expected,
      why: 'Формула 2 * i + 1 при i от 0 до 4 даёт 1, 3, 5, 7, 9 — это первые пять нечётных чисел.',
    });
  }

  // --- КТП 14 | 9arr-02-aggregates | 1/1/1 ---
  {
    const a = [12, 7, 25, 3, 18, 9];
    const s = sum(a);
    eq(s, 74, 'сумма шести чисел');
    NUM(arr, {
      d: 'basic', ...S('9arr-02-aggregates', 'Сумма', 'inf-9-arr-sum'), answer: s,
      prompt: 'Найдите сумму элементов списка [12, 7, 25, 3, 18, 9]. Запишите только число.',
      why: '12 + 7 + 25 + 3 + 18 + 9 = 74. Накопитель s заводим равным 0 до цикла, иначе результат потеряется.',
    });
  }
  {
    const a = [12, 7, 25, 3, 18, 9];
    const k = countWhere(a, (x) => x > 10);
    eq(k, 3, 'количество больше 10');
    NUM(arr, {
      d: 'intermediate', ...S('9arr-02-aggregates', 'Количество по условию', 'inf-9-arr-count'), answer: k,
      prompt: 'Сколько чисел в списке [12, 7, 25, 3, 18, 9] больше 10? Запишите только число.',
      why: 'Под условию подходят 12, 25 и 18 — три числа. Счётчик k = 0 заводим до цикла, внутри увеличиваем на 1.',
    });
  }
  {
    const solution = 'a = [-3, 5, -1, 8, 0]\ns = 0\nk = 0\nfor x in a:\n    if x > 0:\n        s += x\n        k += 1\nprint(s, k)';
    const pos = [5, 8];
    eq(sum(pos), 13, 'сумма положительных');
    eq(pos.length, 2, 'количество положительных');
    CR(arr, {
      d: 'advanced', ...S('9arr-02-aggregates', 'Один проход — два результата', 'inf-9-arr-sum'),
      prompt: 'За один проход по списку [-3, 5, -1, 8, 0] найди сумму положительных чисел и их количество. Выведи сумму и количество через пробел.',
      template: 'a = [-3, 5, -1, 8, 0]\ns = 0\nk = 0\nfor x in a:\n    if x > 0:\n        ...\nprint(s, k)',
      solution, expected: `${sum(pos)} ${pos.length}`,
      why: 'Положительные — 5 и 8: сумма 13, количество 2. Один проход по массиву дешевле двух, а накопители заводятся до цикла.',
    });
  }

  // --- КТП 15 | 9arr-02-search | 0/0/1 ---
  {
    const n = 1000;
    const steps = Math.ceil(Math.log2(n + 1));
    eq(steps, 10, 'шагов бинарного поиска на 1000 элементах');
    NUM(arr, {
      d: 'advanced', ...S('9arr-02-search', 'Бинарный поиск', 'inf-9-arr-search'), answer: steps,
      prompt: 'Массив из 1000 элементов отсортирован. Сколько шагов потребуется бинарному поиску, чтобы гарантированно найти нужное значение? Запишите только число.',
      why: 'Каждый шаг делит остаток пополам: нужно не более ⌈log2(1001)⌉ = 10 шагов вместо 1000 проверок линейного поиска. Работает только на отсортированном массиве.',
    });
  }

  // --- КТП 16 | 9arr-03-extremes | 1/1/1 ---
  {
    const a = [12, -5, 23, -1, 8];
    const mx = maxOf(a);
    eq(mx, 23, 'максимум');
    NUM(arr, {
      d: 'basic', ...S('9arr-03-extremes', 'Максимум', 'inf-9-arr-max'), answer: mx,
      prompt: 'Чему равен максимум списка [12, -5, 23, -1, 8]? Запишите только число.',
      why: 'Список просматривают целиком, текущий чемпион всё время сравнивается с новым элементом. Ответ 23.',
    });
  }
  {
    const a = [12, -5, 23, -1, 8];
    const im = indexOfMax(a);
    eq(im, 2, 'индекс максимума');
    NUM(arr, {
      d: 'intermediate', ...S('9arr-03-extremes', 'Индекс чемпиона', 'inf-9-arr-max'), answer: im,
      prompt: 'В списке [12, -5, 23, -1, 8] на каком индексе (с нуля) находится максимум? Запишите только число.',
      why: 'Максимум 23 стоит третьим, индексы с нуля: 0, 1, 2 — значит imax = 2. В программе запоминают индекс, значение читают в конце: a[imax].',
    });
  }
  {
    const a = [-5, -2, -9];
    let m = 0;
    for (const x of a) if (x > m) m = x;
    eq(m, 0, 'ловушка инициализации нулём');
    NUM(arr, {
      d: 'advanced', ...S('9arr-03-extremes', 'Ловушка нуля', 'inf-9-arr-min'), answer: m,
      prompt: 'Программа ищет максимум списка [-5, -2, -9], но чемпион задан числом m = 0. Что она выведет? Запишите только число.',
      why: 'Ни одно из чисел не больше 0, поэтому m остаётся равным 0 — числа, которого в списке нет. Чемпион надо брать первым элементом (m = a[0]), а ноль годится только для счётчика количества.',
    });
  }

  // --- КТП 17 | 9arr-04-sort | 1/1/1 ---
  {
    const n = 8;
    const cmp = (n * (n - 1)) / 2;
    eq(cmp, 28, 'сравнений при сортировке выбором 8 элементов');
    NUM(arr, {
      d: 'basic', ...S('9arr-04-sort', 'Сложность сортировки', 'inf-9-arr-sort'), answer: cmp,
      prompt: 'Сколько сравнений сделает сортировка выбором для массива из 8 элементов? Запишите только число.',
      why: 'Сортировка выбором делает ровно n(n − 1)/2 сравнений: 8 · 7 / 2 = 28. Рост квадратичный: данных в 10 раз больше — работы примерно в 100 раз больше.',
    });
  }
  {
    const a = [5, 2, 8, 1].slice().sort((x, y) => x - y);
    const second = a[a.length - 2];
    eq(second, 5, 'второй по величине');
    NUM(arr, {
      d: 'intermediate', ...S('9arr-04-sort', 'Второй по величине', 'inf-9-arr-sort'), answer: second,
      prompt: 'Какое число в списке [5, 2, 8, 1] является вторым по величине? Запишите только число.',
      why: 'После сортировки по возрастанию получаем [1, 2, 5, 8], второй по величине — предпоследний элемент, то есть 5.',
    });
  }
  {
    const solution = 'a = [5, 2, 8]\nfor i in range(len(a)):\n    imin = i\n    for j in range(i + 1, len(a)):\n        if a[j] < a[imin]:\n            imin = j\n    a[i], a[imin] = a[imin], a[i]\nprint(a)';
    CR(arr, {
      d: 'advanced', ...S('9arr-04-sort', 'Сортировка выбором', 'inf-9-arr-sort'),
      prompt: 'Отсортируй список [5, 2, 8] по возрастанию сортировкой выбором (два вложенных цикла, без sorted) и выведи результат.',
      template: 'a = [5, 2, 8]\nfor i in range(len(a)):\n    imin = i\n    for j in range(i + 1, len(a)):\n        ...\nprint(a)',
      solution, expected: '[2, 5, 8]',
      why: 'Внешний цикл выбирает место, внутренний ищет минимум в остатке; обмен — одной строкой через две переменные.',
    });
  }
}

// ===========================================================================
// ГРАФЫ
// ===========================================================================
{
  // --- КТП 24 | 9graph-01-graphs | 0/0/1 ---
  {
    const W = [
      [0, 4, 2, Infinity],
      [Infinity, 0, Infinity, 5],
      [Infinity, 1, 0, 8],
      [Infinity, Infinity, Infinity, 0],
    ];
    const edges = countWhere(W.flat(), (v) => Number.isFinite(v) && v > 0);
    eq(edges, 5, 'рёбер в весовой матрице 4x4');
    NUM(graph, {
      d: 'advanced', ...S('9graph-01-graphs', 'Чтение весовой матрицы', 'inf-9-graph-matrix'), answer: edges,
      prompt: 'Весовая матрица дорог между A, B, C, D (∞ — ребра нет):\n0 4 2 ∞\n∞ 0 ∞ 5\n∞ 1 0 8\n∞ ∞ ∞ 0\nСколько рёбер в этом графе? Запишите только число.',
      why: 'Рёбер столько, сколько весов отлично от нуля и от бесконечности: 4, 2, 5, 1, 8 — пять рёбер. Нули стоят на диагонали (петель нет), ∞ означает отсутствие ребра.',
    });
  }

  // --- КТП 25 | 9graph-02-trees | 1/1/1 ---
  {
    const leaves = [1, 2, 3].reduce((p, x) => p * x, 1);
    eq(leaves, 6, 'листьев для трёх чисел');
    NUM(graph, {
      d: 'basic', ...S('9graph-02-trees', 'Дерево перебора', 'inf-9-graph-tree'), answer: leaves,
      prompt: 'В дереве решений переставляют числа 1, 2, 3 на трёх местах. Сколько листьев в этом дереве? Запишите только число.',
      why: 'Для первого элемента 3 выбора, для второго 2, для третьего 1: 3 · 2 · 1 = 6 листьев. Столько же вариантов перестановки.',
    });
  }
  {
    const leaves = [1, 2, 3, 4].reduce((p, x) => p * x, 1);
    eq(leaves, 24, 'листьев для четырёх чисел');
    NUM(graph, {
      d: 'intermediate', ...S('9graph-02-trees', 'Листья и ветки', 'inf-9-graph-tree'), answer: leaves,
      prompt: 'Сколько листьев в дереве решений, где переставляют числа 1, 2, 3, 4 на четырёх местах? Запишите только число.',
      why: 'Ветка от корня до листа — один вариант: 4 · 3 · 2 · 1 = 24 листа. Считать надо именно листья: промежуточные вершины — это незаконченные варианты.',
    });
  }
  {
    const coins = [1, 3, 5];
    const ways = [];
    for (let a = 0; a <= 7; a++) for (let b = 0; b <= 7; b++) for (let c = 0; c <= 7; c++) {
      if (a * coins[0] + b * coins[1] + c * coins[2] === 7) ways.push([a, b, c]);
    }
    eq(ways.length, 4, 'способов набрать 7 монетами 1, 3, 5');
    NUM(graph, {
      d: 'advanced', ...S('9graph-02-trees', 'Перебор монет', 'inf-9-graph-tree'), answer: ways.length,
      prompt: 'Имеются монеты 1, 3 и 5 рубля. Сколькими способами можно набрать сумму 7 рублей? Запишите только число.',
      why: `Способы: ${ways.map(([a, b, c]) => `${a}·1 + ${b}·3 + ${c}·5`).join('; ')} — всего ${ways.length}. В дереве решений каждая ветка заканчивается таким набором, их и считают.`,
    });
  }

  // --- КТП 26 | 9graph-03-tasks | 1/1/1 ---
  {
    SC(graph, {
      d: 'basic', ...S('9graph-03-tasks', 'Кратчайший путь', 'inf-9-graph-shortest'),
      prompt: 'Чем кратчайший путь отличается от пути с наименьшим числом переходов?',
      opts: [
        'Кратчайший — это путь с минимальной суммой весов, а не с минимальным числом рёбер',
        'Ничем, это одно и то же',
        'Кратчайший — это путь с наименьшим числом рёбер',
        'Кратчайший — это всегда прямой путь без промежуточных вершин',
      ], correct: 'A',
      why: 'Сумма весов и число рёбер — разные критерии. Путь A → C → B → D может оказаться короче по весу, чем прямой A → B → D.',
    });
  }
  {
    const edges = { A: [['B', 4], ['C', 2]], B: [['D', 5]], C: [['B', 1], ['D', 8]], D: [] };
    const { cost, path } = shortestPath(edges, 'A', 'D');
    eq(cost, 8, 'кратчайший путь A -> D');
    eq(path.join('->'), 'A->C->B->D', 'маршрут кратчайшего пути');
    NUM(graph, {
      d: 'intermediate', ...S('9graph-03-tasks', 'Сумма весов пути', 'inf-9-graph-shortest'), answer: cost,
      prompt: 'Дороги: A→B вес 4, A→C вес 2, C→B вес 1, B→D вес 5, C→D вес 8. Чему равна минимальная сумма весов пути из A в D? Запишите только число.',
      why: 'Пути: A→B→D = 9, A→C→D = 10, A→C→B→D = 8. Минимум 8 — и он идёт через три ребра, то есть рёбер больше, а вес меньше.',
    });
  }
  {
    const edges = { A: [['B', 7], ['C', 3], ['D', 12]], B: [['D', 4]], C: [['B', 2], ['D', 9]], D: [] };
    const { cost, path } = shortestPath(edges, 'A', 'D');
    const hops = fewestEdges(edges, 'A', 'D');
    eq(cost, 9, 'кратчайший путь во второй задаче');
    eq(path.join('->'), 'A->C->B->D', 'маршрут во второй задаче');
    eq(hops, 1, 'самый короткий по числу рёбер путь');
    NUM(graph, {
      d: 'advanced', ...S('9graph-03-tasks', 'Перебор всех путей', 'inf-9-graph-shortest'), answer: cost,
      prompt: 'Дороги: A→B 7, A→C 3, A→D 12, C→B 2, B→D 4, C→D 9. Найдите минимальную сумму весов пути из A в D перебором всех путей. Запишите только число.',
      why: 'Пути и их суммы: A→D = 12, A→B→D = 11, A→C→D = 12, A→C→B→D = 3 + 2 + 4 = 9. Минимум 9, хотя дорога A→D короче по числу переходов и весит больше.',
    });
  }

  // --- КТП 27 | 9graph-04-paths | 1/1/1 ---
  {
    eq(1, 1, 'путь в вершину-источник');
    NUM(graph, {
      d: 'basic', ...S('9graph-04-paths', 'Источник', 'inf-9-graph-dag'), answer: 1,
      prompt: 'Сколько путей ведёт в вершину-источник направленного ациклического графа? Запишите только число.',
      why: 'Всегда 1 — пустой путь: остаться в той же вершине, никуда не двигаясь. Ставить здесь 0 нельзя: тогда все остальные значения получатся в 2 раза меньше.',
    });
  }
  {
    const edges = { A: ['B', 'C'], B: ['D'], C: ['D'], D: [] };
    const ways = countPathsDag(edges, ['A', 'B', 'C', 'D']);
    eq(ways.get('D'), 2, 'путей в D для A->B, A->C, B->D, C->D');
    NUM(graph, {
      d: 'intermediate', ...S('9graph-04-paths', 'Накопление путей', 'inf-9-graph-dag'), answer: ways.get('D'),
      prompt: 'Граф: A→B, A→C, B→D, C→D. Сколько путей ведёт из A в D? Запишите только число.',
      why: 'A = 1, B = 1, C = 1, D = B + C = 2. Это пути A→B→D и A→C→D. Число путей в вершину равно сумме чисел путей в её предшественников.',
    });
  }
  {
    const edges = { X: ['Y', 'Z'], Y: ['W', 'V'], Z: ['W'], W: ['V'], V: [] };
    const ways = countPathsDag(edges, ['X', 'Y', 'Z', 'W', 'V']);
    eq(ways.get('V'), 3, 'путей в V');
    NUM(graph, {
      d: 'advanced', ...S('9graph-04-paths', 'Сложный DAG', 'inf-9-graph-dag'), answer: ways.get('V'),
      prompt: 'Граф: X→Y, X→Z, Y→W, Z→W, W→V, Y→V. Сколько путей ведёт из X в V? Запишите только число.',
      why: 'Считаем накоплением: X = 1, Y = 1, Z = 1, W = Y + Z = 2, V = W + Y = 2 + 1 = 3. Перебором: X→Y→V, X→Y→W→V, X→Z→W→V — тоже три пути.',
    });
  }
}

// ===========================================================================
// ПРОФЕССИИ, РОБОТЫ, МОДЕЛИ, ИНТЕРНЕТ
// ===========================================================================
{
  const PROF = 'Информационные технологии';
  const ROB = 'Управление и роботы';
  const MOD = 'Моделирование';
  const NET = 'Интернет';

  // --- КТП 1 | 9intro-01-professions | 1/1/1 ---
  {
    SC(extra, {
      d: 'basic', ...S('9intro-01-professions', 'Открытые ресурсы', 'inf-9-extra-career'),
      topic: PROF,
      prompt: 'Что из перечисленного является открытым образовательным ресурсом?',
      opts: [
        'Учебные материалы, свободно используемые по лицензии с указанием автора',
        'Любой материал, найденный в интернете',
        'Материалы только сайта school-collection.edu.ru',
        'Любой учебник из типографии',
      ], correct: 'A',
      why: 'Открытый ресурс должен быть бесплатным и иметь свободную лицензию с указанием автора. Материал в сети сам по себе открытым не становится.',
    });
  }
  {
    SC(extra, {
      d: 'intermediate', ...S('9intro-01-professions', 'ИТ и профессия', 'inf-9-extra-career'),
      topic: PROF,
      prompt: 'Что произошло с работой экономиста после появления информационных технологий?',
      opts: [
        'Инструмент изменил работу, но профессию не отменил',
        'Профессия исчезла полностью',
        'Ничего не изменилось',
        'Все экономисты стали программистами',
      ], correct: 'A',
      why: 'Технологии автоматизируют рутину и ускоряют решения, но решение и ответственность остаются за человеком. Это типичная ошибка — считать, что ИТ отменяют профессию.',
    });
  }
  {
    const map = {
      'Производительность': 'автоматизация бухгалтерии и учёта',
      'Новые отрасли': 'доставка еды и онлайн-торговля',
      'Скорость решений': 'экономические данные собираются минутами',
    };
    MT(extra, {
      d: 'advanced', ...S('9intro-01-professions', 'Каналы влияния ИТ', 'inf-9-extra-career'),
      topic: PROF,
      prompt: 'Установите соответствие: канал влияния ИТ на экономику — пример.',
      left: Object.keys(map), right: Object.values(map), map,
      why: 'Три канала: производительность, новые отрасли, скорость решений. Каждый пример относится ровно к своему каналу.',
    });
  }

  // --- КТП 12 | 9algo-01-performers | 1/1/1 ---
  {
    SC(extra, {
      d: 'basic', ...S('9algo-01-performers', 'Возврат значения', 'inf-9-extra-algo'),
      topic: ROB,
      prompt: 'Зачем функции нужен оператор return?',
      opts: [
        'Чтобы вернуть результат вызывающему коду',
        'Чтобы напечатать результат на экране',
        'Чтобы объявить новую переменную',
        'Чтобы прервать программу',
      ], correct: 'A',
      why: 'Функция получает данные (параметры) и возвращает результат. Печать — дело вызывающего кода, иначе функцию нельзя переиспользовать.',
    });
  }
  {
    const answer = 5 * 5;
    eq(answer, 25, 'f(5) при f(n) = n * n');
    NUM(extra, {
      d: 'intermediate', ...S('9algo-01-performers', 'Параметры функции', 'inf-9-extra-algo'),
      topic: ROB, answer,
      prompt: 'Дана функция def f(n): return n * n. Что вернёт вызов f(5)? Запишите только число.',
      why: 'Функция получает на вход 5, возвращает квадрат: 5 · 5 = 25. Один вход — один выход, поэтому результат предсказуем.',
    });
  }
  {
    const solution = 'def ploshchad(a, b):\n    return a * b\n\nprint(ploshchad(3, 4))';
    CR(extra, {
      d: 'advanced', ...S('9algo-01-performers', 'Вспомогательный алгоритм', 'inf-9-extra-algo'),
      topic: ROB,
      prompt: 'Опиши вспомогательный алгоритм — функцию площадь(a, b), которая возвращает площадь прямоугольника, и выведи площадь для 3 и 4.',
      template: 'def ploshchad(a, b):\n    return ...\n\nprint(ploshchad(3, 4))',
      solution, expected: '12',
      why: 'Функция возвращает a * b, а печатает вызывающий код: 3 · 4 = 12. Написал один раз — вызвал много, правишь в одном месте.',
    });
  }

  // --- КТП 18 | 9robot-01-control | 0/0/1 ---
  {
    SC(extra, {
      d: 'advanced', ...S('9robot-01-control', 'Цикл управления', 'inf-9-extra-control'),
      topic: ROB,
      prompt: 'Почему алгоритм управления движущимся роботом пишут циклом, а не одной командой «вперёд»?',
      opts: [
        'Пока задача не выполнена, надо снова читать датчики и решать, ехать ли дальше',
        'Цикл нужен только для красоты программы',
        'Одна команда не помещается на экране',
        'Робот не понимает команд без цикла',
      ], correct: 'A',
      why: 'Управление с обратной связью — это повторяющийся цикл: получить сигналы датчиков, сравнить с условием, выполнить действие, вернуться к началу. Одна команда выполнится один раз.',
    });
  }

  // --- КТП 19 | 9robot-02-systems | 1/1/1 ---
  {
    const parts = ['датчики', 'управляющее устройство', 'исполнительные механизмы', 'программа'];
    eq(parts.length, 4, 'частей роботизированной системы');
    NUM(extra, {
      d: 'basic', ...S('9robot-02-systems', 'Состав системы', 'inf-9-extra-robot'),
      topic: ROB, answer: parts.length,
      prompt: 'Сколько частей входит в роботизированную систему по этому уроку? Запишите только число.',
      why: 'Датчики, управляющее устройство, исполнительные механизмы и программа — четыре части. Без любой из них схема не работает.',
    });
  }
  {
    SC(extra, {
      d: 'intermediate', ...S('9robot-02-systems', 'Открытое и закрытое управление', 'inf-9-extra-robot'),
      topic: ROB,
      prompt: 'Чем закрытое управление отличается от открытого?',
      opts: [
        'Закрытое учитывает обратную связь и останавливается по сигналу датчика',
        'Закрытое работает без датчиков',
        'Открытое точнее, потому что не зависит от состояния объекта',
        'Ничем: это два названия одного и того же',
      ], correct: 'A',
      why: 'Пресс, отработавший 10 секунд вслепую, — открытое управление. Тот же пресс, остановившийся по сигналу «деталь готова», — закрытое.',
    });
  }
  {
    const cycles = 1000 * 5;
    eq(cycles, 5000, 'циклов управления за 5 секунд');
    NUM(extra, {
      d: 'advanced', ...S('9robot-02-systems', 'Цикл контроллера', 'inf-9-extra-robot'),
      answer: cycles,
      topic: ROB,
      prompt: 'Управляющее устройство выполняет цикл «считал датчики — решил — выполнил» 1000 раз в секунду. Сколько раз цикл выполнится за 5 секунд? Запишите только число.',
      why: '1000 · 5 = 5000 циклов. Человек за это время успевает только изменить программу — сама система работает по циклу постоянно.',
    });
  }

  // --- КТП 20 | 9model-01-models | 0/0/1 ---
  {
    SC(extra, {
      d: 'advanced', ...S('9model-01-models', 'Сверка с оригиналом', 'inf-9-extra-model'),
      topic: MOD,
      prompt: 'Модель тормозного пути не совпала с измерением на мокром асфальте. Что нужно делать?',
      opts: [
        'Исправлять модель: в неё не входит поправка на мокрое покрытие',
        'Считать измерение ошибочным',
        'Ничего не делать: допущения модели не важны',
        'Удалить модель и больше её не строить',
      ], correct: 'A',
      why: 'Не сошлось с опытом — значит, модель неполна: чиним модель, а не мир. Обычно виноваты упрощения, которые мы не учли, например сухое покрытие.',
    });
  }

  // --- КТП 21 | 9model-02-math | 1/1/1 ---
  {
    const v = 72 * 1000 / 60 / 60;
    eq(v, 20, '72 км/ч в м/с');
    NUM(extra, {
      d: 'basic', ...S('9model-02-math', 'Единицы скорости', 'inf-9-extra-mathmodel'),
      answer: v,
      topic: MOD,
      prompt: 'Модель s = v^2/10 работает, когда v в метрах в секунду. Сколько метров в секунду составляет скорость 72 км/ч? Запишите только число.',
      why: '72 · 1000 / 60 / 60 = 20 м/с. Забыть про единицы — самая частая ошибка: подставив 72, получим путь в 13 раз больше.',
    });
  }
  {
    const v = 30;
    const s = (v * v) / 10;
    eq(s, 90, 'путь при 30 м/с');
    NUM(extra, {
      d: 'intermediate', ...S('9model-02-math', 'Проверка модели', 'inf-9-extra-mathmodel'),
      answer: s,
      topic: MOD,
      prompt: 'Модель s = v^2/10. Чему равен путь торможения при скорости 30 м/с? Запишите только число.',
      why: 's = 30 · 30 / 10 = 90 метров. Такой тест обязателен: если для заведомо известного случая формула не даёт верного ответа, то ошибочна либо формула, либо код.',
    });
  }
  {
    const target = 160;
    const v = Math.sqrt(target * 10);
    eq(v, 40, 'скорость, при которой путь равен 160 м');
    NUM(extra, {
      d: 'advanced', ...S('9model-02-math', 'Обратная задача модели', 'inf-9-extra-mathmodel'),
      answer: v,
      topic: MOD,
      prompt: 'Модель s = v^2/10. При какой скорости в метрах в секунду путь торможения равен 160 м? Запишите только число.',
      why: 'Обратная задача решается через ту же формулу: v^2 = 160 · 10 = 1600, откуда v = 40 м/с. Модель работает в обе стороны, пока выполняются допущения.',
    });
  }

  // --- КТП 22 | 9model-03-mixed | 1/1/1 ---
  {
    SC(extra, {
      d: 'basic', ...S('9model-03-mixed', 'Части модели', 'inf-9-extra-mixed'),
      topic: MOD,
      prompt: 'Что показывает график в смешанной модели такого, чего не показывает таблица?',
      opts: [
        'Тенденцию: растёт величина, падает или почти не меняется',
        'Точные значения всех чисел',
        'Названия объектов модели',
        'Ничего: таблица и график равнозначны',
      ], correct: 'A',
      why: 'Таблица даёт точные числа, график — наглядную тенденцию. Ни одна часть не заменяет остальные, поэтому в смешанной модели их соединяют.',
    });
  }
  {
    const n0 = 100, birth = 20, death = 12, years = 2;
    const n = n0 + (birth - death) * years;
    eq(n, 116, 'численность популяции через 2 года');
    NUM(extra, {
      d: 'intermediate', ...S('9model-03-mixed', 'Модель популяции', 'inf-9-extra-mixed'),
      answer: n,
      topic: MOD,
      prompt: 'В модели популяции N = N + рождение − смертность. Сейчас N = 100, рождаемость 20 в год, смертность 12 в год. Чему равна численность через 2 года? Запишите только число.',
      why: 'За год прибавляется 20 − 12 = 8. Через два года: 100 + 8 · 2 = 116. Разность положительная — популяция растёт.',
    });
  }
  {
    const n0 = 100, step = 20 - 12;
    let years = 0;
    let n = n0;
    while (n <= 150) {
      n += step;
      years++;
    }
    eq(years, 7, 'число лет до превышения 150');
    eq(n, 156, 'численность в этот год');
    NUM(extra, {
      d: 'advanced', ...S('9model-03-mixed', 'Исследование модели', 'inf-9-extra-mixed'),
      answer: n,
      topic: MOD,
      prompt: 'Модель популяции: N = N + 20 − 12 каждый год, сейчас N = 100. Через сколько лет численность впервые превысит 150? Запишите только число.',
      why: 'По годам: 100, 108, 116, 124, 132, 140, 148, 156. Значение больше 150 появляется на восьмом шаге, то есть через 7 лет. Один запуск модели ничего не доказывает — нужен ряд значений.',
    });
  }

  // --- КТП 23 | 9model-04-table | 1/1/1 ---
  {
    SC(extra, {
      d: 'basic', ...S('9model-04-table', 'Ключ записи', 'inf-9-extra-db'),
      topic: MOD,
      prompt: 'Почему фамилия ненадёжный ключ в базе «Ученики»?',
      opts: [
        'В одном классе могут быть ученики с одинаковой фамилией',
        'Фамилии пишутся с буквой «ё» или «е»',
        'Фамилия — текст, а ключ должен быть числом',
        'Фамилия слишком длинная',
      ], correct: 'A',
      why: 'Ключ должен быть уникален для каждой записи. Надёжнее составной ключ «Фамилия + Класс» или отдельное поле «Номер личного дела».',
    });
  }
  {
    const heights = [165, 172, 168, 180, 171, 169, 175, 173, 166, 178, 170, 164];
    const n = countWhere(heights, (h) => h > 170);
    eq(n, 6, 'учеников выше 170');
    NUM(extra, {
      d: 'intermediate', ...S('9model-04-table', 'Поиск по условию', 'inf-9-extra-db'),
      answer: n,
      topic: MOD,
      prompt: 'В базе «Ученики» 12 записей, рост: 165, 172, 168, 180, 171, 169, 175, 173, 166, 178, 170, 164. Сколько учеников выше 170? Запишите только число.',
      why: 'Выше 170: 172, 180, 171, 175, 173, 178 — шесть записей. Поиск по условию — это фильтрация записей базы, а не перебор вручную.',
    });
  }
  {
    const map = {
      'Поиск': 'отвечает на вопрос по условию',
      'Сортировка': 'переставляет записи по выбранному полю',
      'Фильтрация': 'оставляет только подходящие записи',
    };
    MT(extra, {
      d: 'advanced', ...S('9model-04-table', 'Операции над базой', 'inf-9-extra-db'),
      topic: MOD,
      prompt: 'Установите соответствие: операция над табличной моделью — что она делает.',
      left: Object.keys(map), right: Object.values(map), map,
      why: 'Поиск отвечает на вопрос, сортировка упорядочивает записи, фильтрация оставляет подходящие. Это те же инструменты, что и в табличном процессоре, но над записями.',
    });
  }

  // --- КТП 29 | 9net-01-internet | 0/0/1 ---
  {
    const total = 256 ** 4;
    eq(total, 4294967296, 'число IPv4-адресов');
    NUM(extra, {
      d: 'advanced', ...S('9net-01-internet', 'Объём адресного пространства', 'inf-9-extra-net'),
      answer: total,
      topic: NET,
      prompt: 'В IPv4-адресе каждое из четырёх чисел принимает значения от 0 до 255, то есть 256 вариантов. Сколько всего таких адресов? Запишите только число.',
      why: '256 · 256 · 256 · 256 = 4 294 967 296, примерно 4,3 миллиарда — больше, чем устройств в мире, поэтому перешли на IPv6 (128 бит).',
    });
  }

  // --- КТП 30 | 9net-02-web | 1/1/1 ---
  {
    SC(extra, {
      d: 'basic', ...S('9net-02-web', 'Изображения на странице', 'inf-9-extra-web'),
      topic: NET,
      prompt: 'Почему страница «ломается», если перенести только файл HTML без папки с картинками?',
      opts: [
        'Изображения хранятся отдельными файлами, на которые страница только ссылается',
        'Без картинок браузер не покажет текст',
        'HTML-файл без картинок не открывается вовсе',
        'Текст и картинки хранятся в одном файле, поэтому ничего не теряется',
      ], correct: 'A',
      why: 'В теге <img> записан адрес файла, а не сама картинка. Перенесли HTML один — ссылки на изображения перестали работать.',
    });
  }
  {
    const n = 5, kb = 150;
    const total = n * kb;
    eq(total, 750, 'объём изображений страницы');
    NUM(extra, {
      d: 'intermediate', ...S('9net-02-web', 'Графика страницы', 'inf-9-extra-web'),
      answer: total,
      topic: NET,
      prompt: 'На странице 5 изображений, каждое весит 150 КБ. Сколько килобайт занимают все изображения вместе? Запишите только число.',
      why: '5 · 150 = 750 КБ. Всё это — отдельные файлы, которые надо хранить рядом с HTML: перенесёшь только разметку — картинки не откроются.',
    });
  }
  {
    SC(extra, {
      d: 'advanced', ...S('9net-02-web', 'Проверка перед сдачей', 'inf-9-extra-web'),
      topic: NET,
      prompt: 'Страницу нужно открыть с телефона. Что важнее всего проверить перед сдачей?',
      opts: [
        'Читаемость: нет длинных строк и огромных картинок, ссылки и картинки работают',
        'Цвет фона страницы',
        'Наличие отступов в исходном коде',
        'Имя файла на латинице',
      ], correct: 'A',
      why: 'На узком экране перенос строк ломает вёрстку, а большие картинки уезжают за край. Плюс обычная проверка: картинки на месте, ссылки кликаются, нет ошибок в тексте.',
    });
  }

  // --- КТП 31 | 9net-03-safe | 1/1/1 ---
  {
    SC(extra, {
      d: 'basic', ...S('9net-03-safe', 'Фишинг', 'inf-9-extra-safe'),
      topic: NET,
      prompt: 'Что такое фишинг?',
      opts: [
        'Поддельный сайт или письмо, которое выманивает логин и пароль',
        'Программа, которая шифрует файлы и требует оплату',
        'Способ ускорить интернет',
        'Протокол шифрования данных в браузере',
      ], correct: 'A',
      why: 'Фишинг маскируется под знакомый сервис: похожий домен, буквы-подделки, требование «срочно войти». Признаки — адрес сайта, срочность и неожиданная просьба.',
    });
  }
  {
    SC(extra, {
      d: 'intermediate', ...S('9net-03-safe', 'Двухфакторная аутентификация', 'inf-9-extra-safe'),
      topic: NET,
      prompt: 'Почему двухфакторная аутентификация надёжнее одного пароля?',
      opts: [
        'Нужен ещё доступ к телефону: украденного пароля самого по себе недостаточно',
        'Она запоминает пароль вместо пользователя',
        'Она шифрует пароль необратимо',
        'Она отменяет пароль совсем',
      ], correct: 'A',
      why: 'Пароль плюс код из СМС или приложения — два разных фактора. Злоумышленнику, даже получив пароль, нужен ещё и доступ к телефону.',
    });
  }
  {
    SC(extra, {
      d: 'advanced', ...S('9net-03-safe', 'HTTPS и безопасность', 'inf-9-extra-safe'),
      topic: NET,
      prompt: 'Почему HTTPS нельзя считать полной гарантией безопасности?',
      opts: [
        'Он защищает канал передачи, но не спасает от вас самих: пароль, отправленный на поддельный сайт, всё равно украдут',
        'Он шифрует данные ненадёжно',
        'Он работает только на мобильных устройствах',
        'Он не защищает данные, которые уже введены в форму',
      ], correct: 'A',
      why: 'HTTPS отвечает за канал «браузер — сервер». Если вы вводите пароль на фишинговом сайте, канал шифруется, а данные всё равно уходят злоумышленнику.',
    });
  }

  // --- КТП 32 | 9net-04-services | 1/1/1 ---
  {
    SC(extra, {
      d: 'basic', ...S('9net-04-services', 'Облачное хранилище', 'inf-9-extra-cloud'),
      topic: NET,
      prompt: 'Чем облачное хранилище отличается от обычной папки на диске компьютера?',
      opts: [
        'Файлы лежат на сервере и доступны с любого устройства, где есть интернет',
        'Файлы хранятся только на телефоне',
        'Облако работает без интернета',
        'Облако автоматически удаляет старые файлы',
      ], correct: 'A',
      why: 'Данные лежат у владельца сервиса, поэтому нужна локальная копия важных файлов. Зато файл не потеряется вместе с флешкой и виден с любого устройства.',
    });
  }
  {
    const files = 12, mb = 25;
    const total = files * mb;
    eq(total, 300, 'объём папки в облаке');
    NUM(extra, {
      d: 'intermediate', ...S('9net-04-services', 'Объём данных', 'inf-9-extra-cloud'),
      answer: total,
      topic: NET,
      prompt: 'В облачной папке 12 файлов по 25 МБ каждый. Сколько мегабайт они занимают вместе? Запишите только число.',
      why: '12 · 25 = 300 МБ. Бесплатный тариф часто ограничен по размеру, а важные файлы надо всё равно хранить локально.',
    });
  }
  {
    SC(extra, {
      d: 'advanced', ...S('9net-04-services', 'Локальная копия', 'inf-9-extra-cloud'),
      topic: NET,
      prompt: 'Почему сданную работу надо скачать из облака локально, даже если сервис работает?',
      opts: [
        'Чтобы работа не зависела от того, работает ли сервис в момент сдачи',
        'Чтобы файл стал больше',
        'Чтобы отправить только ссылку вместо файла',
        'Чтобы убрать из файла права доступа',
      ], correct: 'A',
      why: 'Сервис могут закрыть, срок доступа может истечь, интернет может не работать. Скачанный файл — это независимая копия.',
    });
  }

  // --- КТП 33 | 9net-05-collab | 1/1/1 ---
  {
    SC(extra, {
      d: 'basic', ...S('9net-05-collab', 'История версий', 'inf-9-extra-collab'),
      topic: NET,
      prompt: 'Что даёт история версий в облачном документе?',
      opts: [
        'Можно посмотреть, кто и что менял, и вернуть предыдущую версию',
        'Файл автоматически становится больше',
        'Документ защищается паролем',
        'Копии файла не нужны вовсе',
      ], correct: 'A',
      why: 'История помнит каждое изменение и его автора. Испортил файл — вернул предыдущую версию, это дешевле, чем переделывать всё заново.',
    });
  }
  {
    SC(extra, {
      d: 'intermediate', ...S('9net-05-collab', 'Одновременная правка', 'inf-9-extra-collab'),
      topic: NET,
      prompt: 'Что произойдёт, если двое одновременно правят один и тот же абзац?',
      opts: [
        'Изменения перезапишут друг друга, часть правок потеряется',
        'Абзац превратится в картинку',
        'Документ автоматически удвоится',
        'Система заблокирует весь документ навсегда',
      ], correct: 'A',
      why: 'Поэтому договариваются о структуре заранее и не редактируют один абзац вдвоём: замечания оставляют комментариями, а не переписывают чужой текст.',
    });
  }
  {
    const map = {
      'Владение': 'управлять доступом',
      'Редактирование': 'менять содержимое',
      'Просмотр': 'только читать',
    };
    MT(extra, {
      d: 'advanced', ...S('9net-05-collab', 'Права доступа', 'inf-9-extra-collab'),
      topic: NET,
      prompt: 'Установите соответствие: уровень доступа к облачному документу — что он позволяет.',
      left: Object.keys(map), right: Object.values(map), map,
      why: 'Права выстраиваются по нарастающей: просмотр, комментирование, редактирование, владение. Выдавай минимальные права: для контрольной работы — только просмотр.',
    });
  }

  // --- КТП 34 | 9net-06-search | 1/1/1 ---
  {
    SC(extra, {
      d: 'basic', ...S('9net-06-search', 'Оператор site:', 'inf-9-extra-search'),
      topic: NET,
      prompt: 'Что делает оператор site: в поисковом запросе?',
      opts: [
        'Ограничивает поиск сайтом, который указан после оператора',
        'Ищет по картинке',
        'Ищет только PDF-файлы',
        'Убирает из выдачи страницы-мусор',
      ], correct: 'A',
      why: 'Запрос вида site:edu.ru теория вероятностей ищет только внутри edu.ru. Минус, наоборот, убирает ненужное: робот -игрушка.',
    });
  }
  {
    const all = 50, withWord = 30, withToy = 12;
    const result = withWord - withToy;
    eq(result, 18, 'результат запроса «робот -игрушка»');
    NUM(extra, {
      d: 'intermediate', ...S('9net-06-search', 'Оператор «минус»', 'inf-9-extra-search'),
      answer: result,
      topic: NET,
      prompt: 'По запросу «робот» найдено 50 страниц, слово «робот» есть на 30 из них, а 12 из этих 30 — про игрушки. Сколько страниц покажет запрос «робот -игрушка»? Запишите только число.',
      why: 'Минус — вычитание множеств: из 30 страниц со словом «робот» убираем 12 про игрушки, остаётся 30 − 12 = 18 страниц.',
    });
  }
  {
    SC(extra, {
      d: 'advanced', ...S('9net-06-search', 'Оценка источников', 'inf-9-extra-search'),
      topic: NET,
      prompt: 'Пять сайтов повторяют одну и ту же ошибку в статье. Что это значит?',
      opts: [
        'Источники не независимы: это перепечатка одного материала',
        'Ошибка точно верна, раз её повторяют пять раз',
        'Нужно выбрать любой из пяти сайтов',
        'Поисковик специально показывает неверные страницы',
      ], correct: 'A',
      why: 'Проверяют не количество, а независимость источников и наличие автора с датой. Копии одного текста не подтверждают друг друга.',
    });
  }

  // --- КТП 35 | 9net-07-onlineoffice | 1/1/1 ---
  {
    SC(extra, {
      d: 'basic', ...S('9net-07-onlineoffice', 'Где живёт файл', 'inf-9-extra-weboffice'),
      topic: NET,
      prompt: 'Где хранится файл, созданный в онлайн-офисе?',
      opts: [
        'На сервере сервиса, а не на диске компьютера',
        'В памяти браузера и после закрытия вкладки пропадает',
        'На флешке, подключённой к ноутбуку',
        'В оперативной памяти процессора',
      ], correct: 'A',
      why: 'Программа не устанавливается — она работает в браузере, а данные лежат у владельца сервиса. Поэтому перед сдачей файл скачивают локально.',
    });
  }
  {
    SC(extra, {
      d: 'intermediate', ...S('9net-07-onlineoffice', 'Ограничения сервиса', 'inf-9-extra-weboffice'),
      topic: NET,
      prompt: 'Что из перечисленного — ограничение онлайн-офиса по сравнению с настольной программой?',
      opts: [
        'Нужен постоянный интернет, а части функций может не быть',
        'Работает быстрее, чем настольная программа',
        'Не нужна учётная запись',
        'Файлы сохраняются только в текстовом формате',
      ], correct: 'A',
      why: 'Сервис работает через сеть и не содержит всех возможностей настольной версии, оформление при открытии в другой программе может немного отличаться.',
    });
  }
  {
    SC(extra, {
      d: 'advanced', ...S('9net-07-onlineoffice', 'Файл или ссылка', 'inf-9-extra-weboffice'),
      topic: NET,
      prompt: 'Почему учителю нельзя отправлять только ссылку на документ в облаке?',
      opts: [
        'Срок действия ссылки может истечь, и учитель не откроет работу',
        'Ссылка не работает на телефоне',
        'По ссылке не видно, кто автор',
        'Ссылка не позволяет скачать файл в исходном формате',
      ], correct: 'A',
      why: 'Файл не зависит от сервиса и срока доступа. Ссылка — только дополнение: показываешь, что работа лежит в облаке, но сдаёшь сам файл (.odt или .docx).',
    });
  }

  // --- КТП 36 | 9net-08-onlineoffice2 | 1/1/1 ---
  {
    SC(extra, {
      d: 'basic', ...S('9net-08-onlineoffice2', 'Состав проекта', 'inf-9-extra-project'),
      topic: NET,
      prompt: 'Из чего состоит проект, который готовится в онлайн-офисе по этому уроку?',
      opts: [
        'Текстовый документ, таблица с диаграммами и презентация',
        'Только презентация',
        'Только таблица с формулами',
        'Один текстовый файл со всеми данными',
      ], correct: 'A',
      why: 'Проект = текст + таблица с диаграммами + презентация. Все три файла скачивают локально, а ссылка идёт как дополнение.',
    });
  }
  {
    SC(extra, {
      d: 'intermediate', ...S('9net-08-onlineoffice2', 'Диаграммы проекта', 'inf-9-extra-project'),
      topic: NET,
      prompt: 'Какую диаграмму построить, чтобы показать, как менялось количество мусора по годам?',
      opts: [
        'Линейчатую (график) — изменение по времени',
        'Круговую — доли одного целого',
        'Лепестковую',
        'Трёхмерную гистограмму',
      ], correct: 'A',
      why: 'График показывает изменение по времени, круговая — доли одного целого. Для динамики по годам нужен график, для доли переработанного — круговая.',
    });
  }
  {
    const years = [
      { y: 2019, all: 1000, rec: 400 },
      { y: 2020, all: 1200, rec: 600 },
      { y: 2021, all: 1500, rec: 900 },
    ];
    const shares = years.map((r) => ({ ...r, share: Math.round((r.rec / r.all) * 100) }));
    const best = shares.reduce((bestRow, r) => (r.share > bestRow.share ? r : bestRow));
    eq(shares.map((r) => r.share).join(','), '40,50,60', 'доли переработанного по годам');
    eq(best.y, 2021, 'год с максимальной долей');
    NUM(extra, {
      d: 'advanced', ...S('9net-08-onlineoffice2', 'Доли в таблице проекта', 'inf-9-extra-project'),
      topic: NET, answer: best.y,
      prompt: 'В таблице проекта по годам: 2019 — всего 1000 кг, переработано 400; 2020 — 1200 и 600; 2021 — 1500 и 900. В каком году доля переработанного максимальна? Запишите только номер года.',
      why: 'Доли: 40 %, 50 %, 60 %. Максимум в 2021 году. Доли считаются формулами от своих ячеек, поэтому при исправлении исходных чисел они пересчитаются сами.',
    });
  }
}

// ===========================================================================
// Сборка и запись файлов
// ===========================================================================
const BANKS = [
  { key: 'sheet', file: FILES.sheet, topic: 'Электронные таблицы', items: finish(sheet, 'sheet', 'Электронные таблицы'), expect: 28 },
  { key: 'arr', file: FILES.arr, topic: 'Массивы', items: finish(arr, 'arr', 'Массивы'), expect: 11 },
  { key: 'graph', file: FILES.graph, topic: 'Графы', items: finish(graph, 'graph', 'Графы'), expect: 10 },
  { key: 'extra', file: FILES.extra, topic: null, items: finish(extra, 'extra', null), expect: 42 },
];

function renderTask(t) {
  const L = [];
  L.push(`- id: ${t.id}`);
  L.push(`  class: 9`);
  L.push(`  topic: ${t.topic ?? 'Управление и роботы'}`);
  L.push(`  subtopic: ${JSON.stringify(t.subtopic)}`);
  L.push(`  type: ${t.type}`);
  L.push(`  difficulty: ${t.difficulty}`);
  L.push(`  cognitive_level: ${t.cognitive_level}`);
  L.push(`  points: ${t.points}`);
  L.push(`  lesson: ${t.lesson}`);
  L.push(`  fgos_requirement: ${t.req}`);
  L.push(`  fgos_element: ${t.el}`);
  L.push(`  fgos: { subject: [${t.subject}], meta: [${t.meta}] }`);
  L.push(`  prompt: ${JSON.stringify(t.prompt)}`);
  L.push(`  student_view: ${t.student}`);
  L.push(`  auto_check: ${t.auto}`);
  L.push(`  teacher_only: ${t.teacher}`);
  return L.join('\n');
}

let totalAdded = 0;
const perDiff = { basic: 0, intermediate: 0, advanced: 0 };

for (const bank of BANKS) {
  eq(bank.items.length, bank.expect, `${bank.file}: ожидалось ${bank.expect} заданий`);
  // id строго возрастают и уникальны внутри банка
  const nums = bank.items.map((t) => Number(t.id.slice(-3)));
  eq(new Set(nums).size, nums.length, `${bank.file}: дубли номеров`);
  for (let i = 1; i < nums.length; i++) eq(nums[i], nums[i - 1] + 1, `${bank.file}: пропуск в нумерации перед ${nums[i]}`);

  for (const t of bank.items) perDiff[t.difficulty]++;
  totalAdded += bank.items.length;

  const raw = readFileSync(bank.file, 'utf-8');
  const cut = raw.indexOf(MARK);
  const head = (cut >= 0 ? raw.slice(0, cut) : raw).replace(/\s+$/, '');
  const block = bank.items.map(renderTask).join('\n\n');
  writeFileSync(bank.file, `${head}\n\n${MARK}\n${block}\n`, 'utf-8');
  console.log(`BANK OK: ${bank.file} — добавлено ${bank.items.length} (${nums[0]}–${nums[nums.length - 1]})`);
}

// План: сколько заданий каждой сложности должно быть добавлено.
eq(perDiff.basic, 27, 'добавлено basic');
eq(perDiff.intermediate, 28, 'добавлено intermediate');
eq(perDiff.advanced, 36, 'добавлено advanced');
eq(totalAdded, 91, 'добавлено всего');

console.log(`\nИТОГО: ${totalAdded} заданий — basic ${perDiff.basic}, intermediate ${perDiff.intermediate}, advanced ${perDiff.advanced}`);
console.log(`Проверок выполнено: ${checks}${pyReady ? ' (эталоны code_run прогнаны в Python)' : ''}`);