// Дописывает банки заданий 11 класса — второй заход (tmp/need-11.txt, 40 заданий).
//
// Устройство как в scripts/make-9-bank2.mjs: ответы считает код, ключи сверяются,
// запись идемпотентна по маркеру MARK (файл режется по своему маркеру и пишется заново).
//
// Главное правило: ответы НЕ пишутся руками.
//  - числовые ответы вычисляются (арифметика, перебор, обход графа) и сверяются assert-ом;
//  - эталоны code_run прогоняются локальным Python — expected_stdout берётся из реального
//    вывода solution_code, расхождение роняет сборку;
//  - в single_choice правильный вариант задаётся ТЕКСТОМ, буква вычисляется кодом.
//
// Запуск: node scripts/make-11-bank2.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const MARK = '# ==== СГЕНЕРИРОВАНО scripts/make-11-bank2.mjs ====';

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
const LETTERS = 'ABCD';

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

/** Локальный прогон эталона. Возвращает stdout без хвостовых переводов строк. */
function py(code) {
  const res = execFileSync('python', ['-c', code], {
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  });
  return res.replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

/** code_run. expected_stdout = реальный вывод solution_code (проверяется локально). */
function cr(bank, o) {
  const outp = py(o.solution);
  if (o.expected !== undefined && o.expected !== outp) {
    throw new Error(`${o.lesson}: эталон не сошёлся\nожидалось: ${JSON.stringify(o.expected)}\nполучили:  ${JSON.stringify(outp)}`);
  }
  if (!outp) throw new Error(`${o.lesson}: эталон ничего не вывел`);
  put(bank, {
    topic: o.topic, sub: o.sub, type: 'code_run', d: o.d, cog: o.cog, lesson: o.lesson,
    subj: o.subj, prompt: o.prompt,
    sv: `{ language: python, template: ${q(o.template)} }`,
    ac: `{ method: code_stdout, timeout_s: 10 }`,
    to: `{ solution_code: ${q(o.solution)}, expected_stdout: ${q(outp)}, explanation: ${q(o.why)} }`,
  });
}

// ---------- математика для ответов ----------

const sum = (a) => a.reduce((s, v) => s + v, 0);
const maxOf = (a) => Math.max(...a);
const minOf = (a) => Math.min(...a);
const countIf = (a, f) => a.filter(f).length;

/** Сумма, среднее, медиана набора. */
function mean(a) {
  return sum(a) / a.length;
}
function median(a) {
  const b = [...a].sort((x, y) => x - y);
  const n = b.length;
  return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2;
}

/** Линейная регрессия y = kx + b по методу наименьших квадратов. */
function linreg(x, y) {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
  }
  const k = sxy / sxx;
  return { k, b: my - k * mx };
}

/** Коэффициент корреляции Пирсона. */
function pearson(x, y) {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

/** Число путей в ациклическом графе накоплением (в источнике — пустой путь). */
function dagWays(pred, order) {
  const ways = {};
  for (const v of order) {
    const ps = pred[v] ?? [];
    ways[v] = ps.length ? sum(ps.map((p) => ways[p])) : 1;
  }
  return ways;
}

/** Все простые пути между двумя вершинами невзвешенного графа: [[вершины], ...]. */
function allPaths(edges, from, to) {
  const res = [];
  const go = (v, path) => {
    if (v === to) {
      res.push([...path]);
      return;
    }
    for (const [u, w] of edges) {
      const nextNode = u === v ? w : w === v ? u : null;
      if (!nextNode || path.includes(nextNode)) continue;
      go(nextNode, [...path, nextNode]);
    }
  };
  go(from, [from]);
  return res;
}

/**
 * Кратчайший путь и число путей минимальной длины во взвешенном неориентированном графе.
 * Всё перебором простых путей: так же, как это делается в тетради.
 */
function shortest(edges, weight, from, to) {
  const found = [];
  const go = (v, path, cost) => {
    if (v === to) {
      found.push({ path: [...path], cost });
      return;
    }
    for (const [u, w] of edges) {
      const nextNode = u === v ? w : w === v ? u : null;
      if (!nextNode || path.includes(nextNode)) continue;
      go(nextNode, [...path, nextNode], cost + weight(u, w));
    }
  };
  go(from, [from], 0);
  const best = Math.min(...found.map((p) => p.cost));
  return {
    best,
    paths: found.filter((p) => p.cost === best).map((p) => p.path),
    all: found.map((p) => ({ path: p.path, cost: p.cost })),
  };
}

/** Минимальная стоимость до вершины в ациклическом графе: min по предшественникам + вес ребра. */
function dagMinCost(predW, order) {
  const cost = {};
  for (const v of order) {
    const ps = predW[v] ?? [];
    cost[v] = ps.length ? Math.min(...ps.map(([p, w]) => cost[p] + w)) : 0;
  }
  return cost;
}

/**
 * Разметка игры W/L для правил «берём moves, проигрывает взявший последний камень».
 * Позиция 0 не размечается: камень уже взят, игрок ходить не должен.
 */
function loseTakeLast(limit, moves) {
  const win = { 0: true }; // соперник только что взял последний и проиграл
  for (let s = 1; s <= limit; s++) {
    win[s] = moves.some((k) => k < s && !win[s - k]);
  }
  return win;
}

/** Разметка игры «ходы +moves, выигрывает тот, кто сделает сумму не меньше limit». */
function winReach(limit, moves) {
  const win = {};
  for (let s = limit - 1; s >= 1; s--) {
    win[s] = moves.some((d) => s + d >= limit || !win[s + d]);
  }
  return win;
}

/** Число ходов, ведущих из позиции s в проигрышную (win[s - k] === false). */
function winningMoves(s, moves, win) {
  return moves.filter((k) => k < s && !win[s - k]);
}

/** Число обменов сортировки выбором. */
function selectionSwaps(a) {
  const b = [...a];
  let swaps = 0;
  for (let i = 0; i < b.length - 1; i++) {
    let m = i;
    for (let j = i + 1; j < b.length; j++) if (b[j] < b[m]) m = j;
    if (m !== i) {
      [b[i], b[m]] = [b[m], b[i]];
      swaps += 1;
    }
  }
  return swaps;
}

/** Слияние двух отсортированных списков с подсчётом сравнений. */
function mergeCount(a, b) {
  const res = [];
  let i = 0, j = 0, cmp = 0;
  while (i < a.length && j < b.length) {
    cmp += 1;
    if (a[i] <= b[j]) res.push(a[i++]);
    else res.push(b[j++]);
  }
  while (i < a.length) res.push(a[i++]);
  while (j < b.length) res.push(b[j++]);
  return { res, cmp };
}

/** Обход в ширину из стартовой вершины: порядок посещения и расстояния. */
function bfs(adj, from) {
  const dist = { [from]: 0 };
  const order = [from];
  const queue = [from];
  while (queue.length) {
    const v = queue.shift();
    for (const u of adj[v] ?? []) {
      if (dist[u] !== undefined) continue;
      dist[u] = dist[v] + 1;
      order.push(u);
      queue.push(u);
    }
  }
  return { order, dist };
}

// ═════════════════════ КТП 2–6 · анализ данных ═════════════════════

const DT = 'Анализ данных';
const MO = 'Модели и моделирование';

// ── КТП 2 | 11data-02-stats | статистическая обработка данных (1) ──
{
  const vals = [12, 15, 9, 18, 14];
  const r = maxOf(vals) - minOf(vals);
  if (r !== 9) throw new Error(`размах: ${r}`);
  num('data', {
    topic: DT, d: 'basic', cog: 'apply', lesson: '11data-02-stats', subj: 'inf-11-data-stats',
    sub: 'Размах данных',
    prompt: `Температура воздуха в течение пяти дней (°C): ${vals.join(', ')}. Чему равен размах этого набора? Запишите только число.`,
    value: r,
    why: `Размах = максимум − минимум: ${maxOf(vals)} − ${minOf(vals)} = ${r}. Размах показывает, насколько данные разбросаны, и зависит от одного крайнего значения — в отличие от стандартного отклонения, которое учитывает все точки.`,
  });
}

// ── КТП 3 | 11data-03-diagrams | диаграммы результатов анализа (1) ──
{
  const shares = [30, 25, 45];
  const diff = shares[2] - shares[0];
  if (diff !== 15) throw new Error(`доли: ${diff}`);
  num('data', {
    topic: DT, d: 'intermediate', cog: 'analyze', lesson: '11data-03-diagrams', subj: 'inf-11-data-viz',
    sub: 'Доли для круговой диаграммы',
    prompt: `Доли категорий товара: ${shares.join(' %, ')} % (в сумме 100 %). На сколько процентных пунктов доля первой категории меньше доли третьей? Запишите только число.`,
    value: diff,
    why: `Доли даны в процентах, поэтому разность считаем в процентных пунктах: ${shares[2]} − ${shares[0]} = ${diff}. Делить дополнительно не нужно — проценты к процентам не относятся.`,
  });
}

// ── КТП 4 | 11data-04-correlation | коэффициент корреляции (1) ──
{
  const x = [1, 2, 3, 4, 5];
  const y = [3, 5, 4, 6, 7];
  const r = pearson(x, y);
  if (Math.abs(r - 0.9) > 1e-9) throw new Error(`корреляция: ${r}`);
  cr('data', {
    topic: DT, d: 'advanced', cog: 'analyze', lesson: '11data-04-correlation', subj: 'inf-11-data-corr',
    sub: 'Коэффициент корреляции Пирсона',
    prompt: `Даны пары значений: x = ${x.join(', ')}; y = ${y.join(', ')}. Вычислите коэффициент корреляции Пирсона по формуле r = Σ(xᵢ − x̄)(yᵢ − ȳ) / √[Σ(xᵢ − x̄)² · Σ(yᵢ − ȳ)²] и выведите результат, округлённый до сотых.`,
    template: `# Считаем средние, потом числитель и знаменатель\nx = [1, 2, 3, 4, 5]\ny = [3, 5, 4, 6, 7]\nn = len(x)\nmx = ...\nmy = ...\nsxy = 0\nsxx = 0\nsyy = 0\nfor i in range(n):\n    # накапливаем отклонения\n    ...\nr = ...\nprint(round(r, 2))`,
    solution: `x = [1, 2, 3, 4, 5]
y = [3, 5, 4, 6, 7]
n = len(x)
mx = sum(x) / n
my = sum(y) / n
sxy = 0
sxx = 0
syy = 0
for i in range(n):
    dx = x[i] - mx
    dy = y[i] - my
    sxy = sxy + dx * dy
    sxx = sxx + dx * dx
    syy = syy + dy * dy
r = sxy / (sxx * syy) ** 0.5
print(round(r, 2))`,
    expected: '0.9',
    why: `Средние: x̄ = 3, ȳ = 5. Числитель: (−2)(−2) + (−1)(0) + 0(−1) + 1·1 + 2·2 = 9. Знаменатель: √(10 · 10) = 10. Значит r = 9/10 = ${r}. Положительный знак — прямая связь, модуль близок к 1 — сильная. В LibreOffice Calc то же считает функция КОРРЕЛ.`,
  });
}

// ── КТП 5 | 11data-05-equation | численное решение уравнения (1) ──
{
  const from = 1, to = 3, step = 0.1;
  const points = Math.round((to - from) / step) + 1;
  if (points !== 21) throw new Error(`точек: ${points}`);
  num('data', {
    topic: DT, d: 'basic', cog: 'apply', lesson: '11data-05-equation', subj: 'inf-11-data-fit',
    sub: 'Шаг перебора',
    prompt: `Корень уравнения ищут перебором на отрезке [${from}; ${to}] с шагом ${String(step).replace('.', ',')}. Сколько значений параметра проверят, если отрезок включается целиком с обоих концов? Запишите только число.`,
    value: points,
    why: `Отрезок разбивают на отрезки длиной ${String(step).replace('.', ',')}: их (${to} − ${from}) / ${String(step).replace('.', ',')} = 20, а точек перебора на одну больше, чем отрезков, — обе границы тоже проверяют. Отсюда 20 + 1 = ${points}. Забыть про границы — самая частая ошибка.`,
  });
}

// ── КТП 6 | 11data-06-optimize | задачи оптимизации (1) ──
{
  // Перебор всех разбиений 4 кг на посылки по 1 кг (200 ₽) и 2 кг (350 ₽).
  const need = 4;
  const sizes = [1, 2];
  const prices = { 1: 200, 2: 350 };
  const combos = [];
  const walk = (left, acc, cost) => {
    if (left === 0) {
      combos.push({ acc: [...acc], cost });
      return;
    }
    for (const s of sizes) {
      if (s > left) continue;
      walk(left - s, [...acc, s], cost + prices[s]);
    }
  };
  walk(need, [], 0);
  const best = combos.reduce((m, c) => (c.cost < m.cost ? c : m));
  if (best.cost !== 700 || best.acc.join('+') !== '2+2') throw new Error(`минимум: ${JSON.stringify(best)}`);
  const list = combos.map((c) => `${c.acc.join('+')} = ${c.cost}`).join('; ');
  num('data', {
    topic: DT, d: 'advanced', cog: 'analyze', lesson: '11data-06-optimize', subj: 'inf-11-data-opt',
    sub: 'Минимум затрат',
    prompt: 'Почтовый тариф: посылка массой 1 кг стоит 200 рублей, посылка массой 2 кг — 350 рублей. Нужно отправить ровно 4 кг. Какую минимальную сумму придётся заплатить? Запишите только число.',
    value: best.cost,
    why: `Перебираем все разбиения 4 кг: ${list}. Минимум — ${best.acc.join(' + ')} кг, то есть ${best.cost} рублей. По одной посылке дороже, чем две двухкилограммовые, хотя 200 · 2 = 400 — почти вдвое больше 350. Задача на минимум решается так же, как задача на максимум: перебором значений параметра и сравнением.`,
  });
}

// ── КТП 20 | 11model-01-modeling | модели и моделирование (7) ──
{
  const left = ['Объекты и их свойства', 'Связи между объектами', 'Ограничения', 'Цель'];
  const right = ['какие величины значимы для задачи', 'какие величины зависят друг от друга', 'что запрещено, какие значения недопустимы', 'что требуется найти или оптимизировать'];
  mt('data', {
    topic: MO, d: 'basic', cog: 'remember', lesson: '11model-01-modeling', subj: 'inf-11-model-formal',
    sub: 'Четыре шага формализации',
    prompt: 'Установите соответствие: что выписывают при формализации задачи — какой это пункт.',
    left, right,
    map: { 'Объекты и их свойства': right[0], 'Связи между объектами': right[1], 'Ограничения': right[2], 'Цель': right[3] },
    why: 'Формализация идёт именно в этом порядке: сначала что моделируем, потом как связаны величины, затем что запрещено и, наконец, что ищем. Пропуск любого пункта приводит к программе, которая решает не ту задачу.',
  });
}
{
  const v = 15, t = 40;
  const s = v * t;
  if (s !== 600) throw new Error(`путь: ${s}`);
  num('data', {
    topic: MO, d: 'basic', cog: 'apply', lesson: '11model-01-modeling', subj: 'inf-11-model-motion',
    sub: 'Равномерное движение',
    prompt: `Автомобиль движется равномерно со скоростью ${v} м/с в течение ${t} с. Какой путь он пройдёт по модели s = v · t? Запишите только число.`,
    value: s,
    why: `Модель равномерного движения s = v · t: ${v} · ${t} = ${s} м. Размерность проверяется сразу: м/с · с = м, скорость со временем сложить нельзя.`,
  });
}
{
  const sum0 = 20000, rate = 0.1, years = 2;
  const exact = sum0 * (1 + rate) ** years;
  const total = Math.round(exact);
  if (Math.abs(exact - total) > 1e-6) throw new Error(`проценты: ${exact}`);
  num('data', {
    topic: MO, d: 'intermediate', cog: 'apply', lesson: '11model-01-modeling', subj: 'inf-11-model-percent',
    sub: 'Сложные проценты',
    prompt: `Вклад ${sum0} рублей под ${rate * 100} % годовых. Проценты начисляют в конце каждого года и добавляют к вкладу. Сколько денег будет на счёте через ${years} года? Запишите только число.`,
    value: total,
    why: `Сложные проценты: каждый год к сумме прибавляют ${rate * 100} % от неё же, то есть умножают на 1,${String(rate).slice(2)}. За два года: ${sum0} · 1,${String(rate).slice(2)} = ${sum0 * (1 + rate)}, затем ещё раз — ${exact.toFixed(0)} рублей. Простые проценты дали бы ${sum0 * (1 + rate * years)}: разница ${total - sum0 * (1 + rate * years)} рублей и есть эффект сложного процента.`,
  });
}
{
  const n0 = 1250, r = 0.08, years = 2;
  const exact = n0 * (1 + r) ** years;
  const n2 = Math.round(exact);
  if (Math.abs(exact - n2) > 1e-6) throw new Error(`популяция: ${exact}`);
  num('data', {
    topic: MO, d: 'intermediate', cog: 'apply', lesson: '11model-01-modeling', subj: 'inf-11-model-growth',
    sub: 'Модель роста популяции',
    prompt: `Популяция численностью ${n0} особей растёт на ${r * 100} % в год. Через ${years} года по модели N = N₀ · (1 + r)ᵗ население составит особей? Запишите только число.`,
    value: n2,
    why: `N = ${n0} · 1,${String(r).slice(2)}² = ${n0} · ${(1 + r) ** years} = ${n2} особей. Модель биологического роста составлена для постоянного процента прироста: если он меняется по годам, формулу применяют по частям.`,
  });
}
{
  const opts = [
    'Никакая: скорость и время складывать можно, это обычное сложение чисел',
    'Единицы измерения не совпадают: у s метры, а у v и t — метры в секунду и секунды',
    'Единицы измерения совпадают, поэтому проверить формулу нечем',
    'Проверять нужно только знак результата, единицы тут ни при чём',
  ];
  sc('data', {
    topic: MO, d: 'intermediate', cog: 'analyze', lesson: '11model-01-modeling', subj: 'inf-11-model-unit',
    sub: 'Проверка размерности',
    prompt: 'При проверке модели записали формулу s = v + t. Что скажет проверка размерности?',
    opts, correctText: opts[1],
    why: 'Проверка размерности — самый быстрый способ найти ошибку в формуле. У пройденного пути единица измерения — метры, а складываются метры в секунду и секунды, то есть м/с + с. Складывать величины разной размерности бессмысленно: так у модели нет физического смысла.',
  });
}
{
  // Максимум параболы y = −x² + 4x: вершина при x = 2, значение 4.
  let bestX = null, bestY = null;
  for (let x = 0; x <= 10; x++) {
    const y = -x * x + 4 * x;
    if (bestY === null || y > bestY) { bestY = y; bestX = x; }
  }
  if (bestX !== 2 || bestY !== 4) throw new Error(`вершина: ${bestX}/${bestY}`);
  num('data', {
    topic: MO, d: 'advanced', cog: 'analyze', lesson: '11model-01-modeling', subj: 'inf-11-model-graph',
    sub: 'Экстремум по графику функции',
    prompt: 'Постройте таблицу значений функции y = −x² + 4x для x от 0 до 10 и найдите наибольшее значение функции. Запишите только число.',
    value: bestY,
    why: `Таблица даёт максимум при x = ${bestX}: y = −${bestX}² + 4 · ${bestX} = ${bestY}. Проверка по формуле: у параболы с ветвями вниз вершина в x = −b/(2a) = ${bestX}. График показывает экстремум наглядно — этого нет в таблице значений, если точек мало.`,
  });
}
{
  const opts = [
    'Ничего: правильная формула на одном наборе данных работает и дальше',
    'Модель проверяют на нескольких наборах данных и на граничных значениях',
    'Достаточно одного набора: если сошлось, формула верна',
    'Нужно только нарисовать график — он заменяет проверку',
  ];
  sc('data', {
    topic: MO, d: 'advanced', cog: 'analyze', lesson: '11model-01-modeling', subj: 'inf-11-model-check',
    sub: 'Проверка модели',
    prompt: 'Модель совпала с наблюдением для одной точки данных. Почему этой проверки недостаточно?',
    opts, correctText: opts[1],
    why: 'Совпадение в одной точке — случайность, а не доказательство: формулу можно подогнать под любое единственное измерение. Модель проверяют на нескольких независимых данных, на граничных значениях и на размерности, и только потом используют для прогноза.',
  });
}

// ═════════════════════ КТП 8 · базы данных: запросы ═════════════════════

const DBT = 'Базы данных';

// ── КТП 8 | 11db-02-queries | работа с готовой базой: запросы (4) ──
{
  const opts = [
    'ORDER BY — группирует строки по значениям поля',
    'GROUP BY — группирует строки по значениям поля, чтобы посчитать для каждой группы',
    'WHERE — группирует строки по значениям поля',
    'FROM — группирует строки по значениям поля',
  ];
  sc('db', {
    topic: DBT, d: 'basic', cog: 'remember', lesson: '11db-02-queries', subj: 'inf-11-db-sql',
    sub: 'Группировка строк',
    prompt: 'Нужно узнать, сколько записей у каждого класса. Какое ключевое слово группирует строки так, чтобы для каждой группы можно было применить COUNT или SUM?',
    opts, correctText: opts[1],
    why: 'GROUP BY собирает строки с одинаковым значением поля в группу, после чего COUNT или SUM считают по каждой группе отдельно. ORDER BY только меняет порядок строк, а WHERE и вовсе ничего не группирует.',
  });
}
{
  // Таблица «Оценки» (ученик, предмет, балл) — считаем строки по условию.
  const rows = [
    [1, 'Математика', 85], [1, 'Физика', 74],
    [2, 'Математика', 91], [2, 'Физика', 68],
    [3, 'Математика', 77], [3, 'Физика', 88],
    [4, 'Математика', 64], [4, 'Физика', 95],
  ];
  const hit = rows.filter((r) => r[2] >= 80);
  const n = hit.length;
  if (n !== 4) throw new Error(`COUNT: ${n}`);
  num('db', {
    topic: DBT, d: 'intermediate', cog: 'apply', lesson: '11db-02-queries', subj: 'inf-11-db-sql',
    sub: 'Число строк по условию',
    prompt: `Таблица «Оценки» (№ ученика, предмет, балл): ${rows.map((r) => `${r[0]} ${r[1]} ${r[2]}`).join('; ')}. Сколько строк вернёт запрос SELECT * FROM Оценки WHERE балл >= 80? Запишите только число.`,
    value: n,
    why: `Условию «балл >= 80» удовлетворяют строки ${hit.map((r) => `№ ${r[0]}, ${r[1]} — ${r[2]}`).join('; ')} — всего ${n}. Сравнение нестрогое: 80 входит, а 64, 68 и 74 отпадают.`,
  });
}
{
  // Сумма количества по условию — считаем перебором строк.
  const sklad = [
    [1, 'Тетрадь', 120], [2, 'Ручка', 300], [3, 'Тетрадь', 80], [4, 'Карандаш', 250],
  ];
  const hit = sklad.filter((r) => r[2] >= 100);
  const total = sum(hit.map((r) => r[2]));
  if (total !== 670) throw new Error(`SUM: ${total}`);
  num('db', {
    topic: DBT, d: 'intermediate', cog: 'apply', lesson: '11db-02-queries', subj: 'inf-11-db-sql',
    sub: 'Сумма по условию',
    prompt: `Таблица «Склад» (код, название, количество): ${sklad.map((r) => `${r[0]} ${r[1]} ${r[2]}`).join('; ')}. Чему равен результат запроса SELECT SUM(количество) FROM Склад WHERE количество >= 100? Запишите только число.`,
    value: total,
    why: `WHERE отбирает строки с количеством не меньше 100: ${hit.map((r) => `${r[1]} — ${r[2]}`).join('; ')}. Сумма: ${hit.map((r) => r[2]).join(' + ')} = ${total}. Порядок работы такой: сначала условие WHERE отбирает строки, потом SUM считает только по ним.`,
  });
}
{
  // Число строк после соединения таблиц и двух условий.
  const post = [
    [1, 1, 2], [1, 2, 1], [2, 3, 5], [2, 1, 3], [3, 1, 4], [3, 2, 2],
  ];
  const blyuda = { 1: 'Борщ', 2: 'Котлета', 3: 'Каша' };
  const joined = post.filter(([, code]) => code in blyuda);
  const hit = joined.filter(([, code, qty]) => qty > 2 && code < 3);
  const n = hit.length;
  if (joined.length !== 6 || n !== 2) throw new Error(`JOIN: ${joined.length}/${n}`);
  num('db', {
    topic: DBT, d: 'advanced', cog: 'analyze', lesson: '11db-02-queries', subj: 'inf-11-db-sql',
    sub: 'Соединение с двумя условиями',
    prompt: `Таблица «Блюда»: код 1 — Борщ, код 2 — Котлета, код 3 — Каша. Таблица «Поставки»: ${post.map((r) => `(ученик ${r[0]}, код ${r[1]}, ${r[2]} шт)`).join('; ')}. Сколько строк вернёт запрос SELECT * FROM Поставки JOIN Блюда ON Поставки.код = Блюда.код WHERE Поставки.количество > 2 AND Блюда.код < 3? Запишите только число.`,
    value: n,
    why: `Соединение по внешнему ключу «код» находит блюдо для каждой из ${joined.length} строк поставок — все коды есть в справочнике. Дальше работают оба условия: количество больше 2 и код меньше 3. Подходят строки ${hit.map((r) => `ученик ${r[0]}, ${blyuda[r[1]]}, ${r[2]} шт`).join('; ')} — это ${n} строки. Условия в WHERE соединяют словом AND, а не запятой.`,
  });
}

// ═════════════════════ КТП 14–15 · сортировки и матрицы ═════════════════════

const STR = 'Сортировки и структуры';

// ── КТП 14 | 11algo-06-sorting | алгоритмы сортировки (2) ──
{
  const a = [7, 2, 9, 4, 1, 8];
  const swaps = selectionSwaps(a);
  const sorted = [...a].sort((x, y) => x - y);
  if (swaps !== 4) throw new Error(`обменов: ${swaps}`);
  num('algo', {
    topic: STR, d: 'basic', cog: 'apply', lesson: '11algo-06-sorting', subj: 'inf-11-algo-sort',
    sub: 'Число обменов',
    prompt: `Список: ${a.join(', ')}. Сколько обменов сделает сортировка выбором, если на каждом шаге найденный минимум остатка меняется местами с элементом на текущей позиции? Запишите только число.`,
    value: swaps,
    why: `Сортировка выбором: ${a.join(', ')} → ${sorted.join(', ')}. Обмен происходит только там, где минимум стоял не на текущей позиции: таких обменов ${swaps}. Сравнений же она делает всегда n(n − 1)/2 = ${(a.length * (a.length - 1)) / 2} — сравнений и обменов путать нельзя, это разные величины.`,
  });
}
{
  const left = [1, 4, 7, 9];
  const right = [2, 3, 8];
  const { res, cmp } = mergeCount(left, right);
  if (res.join(' ') !== '1 2 3 4 7 8 9' || cmp !== 6) throw new Error(`слияние: ${res}/${cmp}`);
  cr('algo', {
    topic: STR, d: 'advanced', cog: 'analyze', lesson: '11algo-06-sorting', subj: 'inf-11-algo-sort',
    sub: 'Сортировка слиянием',
    prompt: `Слейте два отсортированных списка ${left.join(', ')} и ${right.join(', ')} в один отсортированный список и посчитайте число сравнений при слиянии. Сравнивайте текущие элементы и берйте меньший, пока оба списка не кончатся. Выведите сначала слитый список через пробел, затем на новой строке — число сравнений.`,
    template: `# Допиши слияние с подсчётом сравнений\nleft = [1, 4, 7, 9]\nright = [2, 3, 8]\nres = []\ni = 0\nj = 0\ncmp = 0\nwhile ...:\n    # сравниваем текущие элементы\n    ...\nprint(*res)\nprint(cmp)`,
    solution: `left = [1, 4, 7, 9]
right = [2, 3, 8]
res = []
i = 0
j = 0
cmp = 0
while i < len(left) and j < len(right):
    cmp = cmp + 1
    if left[i] <= right[j]:
        res.append(left[i])
        i = i + 1
    else:
        res.append(right[j])
        j = j + 1
while i < len(left):
    res.append(left[i])
    i = i + 1
while j < len(right):
    res.append(right[j])
    j = j + 1
print(*res)
print(cmp)`,
    expected: '1 2 3 4 7 8 9\n6',
    why: `Слияние даёт ${res.join(', ')} за ${cmp} сравнений. Когда один список кончился, оставшиеся элементы другого просто дописывают — сравнений для них не нужно, поэтому счётчик не растёт. Сортировка слиянием всегда работает примерно за n log n сравнений, но требует дополнительной памяти для промежуточного массива.`,
  });
}

// ── КТП 15 | 11algo-07-matrix | двумерные массивы: матрицы (2) ──
{
  const m = [
    [3, 1, 4],
    [5, 9, 2],
    [8, 6, 7],
  ];
  const col = m.map((r) => r[1]);
  const s = sum(col);
  if (s !== 16) throw new Error(`столбец: ${s}`);
  num('algo', {
    topic: STR, d: 'intermediate', cog: 'apply', lesson: '11algo-07-matrix', subj: 'inf-11-algo-matrix',
    sub: 'Сумма столбца',
    prompt: `Матрица 3 × 3:\n${m.map((r) => r.join(' ')).join('\n')}\nНайдите сумму элементов второго столбца. Запишите только число.`,
    value: s,
    why: `Второй столбец — это ${col.join(', ')} (индекс 1 в каждой строке): ${col.join(' + ')} = ${s}. Столбец обходят внешним циклом по номеру столбца j и вложенным — по номеру строки i, то есть наоборот, чем строку.`,
  });
}
{
  const m = [
    [3, 8, 2],
    [7, 4, 9],
    [5, 1, 6],
  ];
  cr('algo', {
    topic: STR, d: 'advanced', cog: 'analyze', lesson: '11algo-07-matrix', subj: 'inf-11-algo-matrix',
    sub: 'Максимум и его позиция',
    prompt: `Дана матрица a = [[${m[0].join(', ')}], [${m[1].join(', ')}], [${m[2].join(', ')}]]. Найдите наибольший элемент и номер его строки и столбца. Выведите три числа через пробел: сначала сам элемент, затем номер строки и номер столбца (нумерация с единицы).`,
    template: `# Допиши поиск максимума с запоминанием индексов\na = [[3, 8, 2], [7, 4, 9], [5, 1, 6]]\nbest = a[0][0]\nbi = 0\nbj = 0\nfor i in range(len(a)):\n    for j in range(len(a[i])):\n        # сравниваем с текущим максимумом\n        ...\nprint(best, bi + 1, bj + 1)`,
    solution: `a = [[3, 8, 2], [7, 4, 9], [5, 1, 6]]
best = a[0][0]
bi = 0
bj = 0
for i in range(len(a)):
    for j in range(len(a[i])):
        if a[i][j] > best:
            best = a[i][j]
            bi = i
            bj = j
print(best, bi + 1, bj + 1)`,
    expected: '9 2 3',
    why: 'Максимум нашли двойным циклом: при новом большем значении запоминаем не только его, но и оба индекса. Индексы при этом нумеруются с нуля, поэтому для вывода с единицы прибавляют 1: a[1][2] — это вторая строка, третий столбец, значение 9.',
  });
}

// ═════════════════════ КТП 21–22 · графы, пути ═════════════════════

const GRF = 'Графы и деревья';

// ── КТП 21 | 11graph-01-graphs | графы и деревья (3) ──
{
  const opts = [
    'Обход в ширину и обход в глубину дают один и тот же порядок посещения вершин',
    'Обход в ширину идёт по уровням: сначала все вершины на расстоянии 1, потом на расстоянии 2',
    'Обход в ширину идёт по одной ветви до конца, а потом возвращается — это обход в глубину',
    'Обход в ширину находит самый дешёвый путь по весам рёбер',
  ];
  sc('graph', {
    topic: GRF, d: 'basic', cog: 'remember', lesson: '11graph-01-graphs', subj: 'inf-11-graph-bfs',
    sub: 'Обход в ширину и в глубину',
    prompt: 'Чем обход в ширину (BFS) отличается от обхода в глубину (DFS)?',
    opts, correctText: opts[1],
    why: 'BFS обрабатывает вершины по расстоянию от стартовой, поэтому находит кратчайшие пути по числу рёбер. DFS идёт по одной ветви до конца и только потом возвращается — он находит, например, путь до вершины, но не обязательно самый короткий. Путать их опасно: от выбора обхода зависит ответ задачи.',
  });
}
{
  // Матрица смежности 4 × 4: каждое ребро записано дважды (строка и столбец).
  const m = [
    [0, 1, 1, 0],
    [1, 0, 1, 1],
    [1, 1, 0, 0],
    [0, 1, 0, 0],
  ];
  const half = sum(m.flat()) / 2;
  const deg = m.map((r) => sum(r));
  if (half !== 4) throw new Error(`рёбра: ${half}`);
  num('graph', {
    topic: GRF, d: 'intermediate', cog: 'analyze', lesson: '11graph-01-graphs', subj: 'inf-11-graph-matrix',
    sub: 'Число рёбер по матрице смежности',
    prompt: `Матрица смежности графа из четырёх вершин (строки — «откуда», столбцы — «куда»):\n${m.map((r) => r.join(' ')).join('\n')}\nСколько рёбер в этом графе? Запишите только число.`,
    value: half,
    why: `Сумма всех элементов матрицы равна ${sum(m.flat())}, но каждое ребро записано дважды: один раз в строке откуда, второй — в столбце куда. Поэтому число рёбер равно половине суммы: ${sum(m.flat())} / 2 = ${half}. По строкам видно степени вершин: ${deg.join(', ')} — их сумма тоже ${sum(deg)}, то есть вдвое больше рёбер.`,
  });
}
{
  // Обход в ширину из вершины 1: порядок посещения.
  const adj = {
    1: [2, 3],
    2: [4],
    3: [4, 5],
    4: [6],
    5: [6],
    6: [],
  };
  const { order } = bfs(adj, 1);
  const got = order.join(' ');
  if (got !== '1 2 3 4 5 6') throw new Error(`BFS: ${got}`);
  cr('graph', {
    topic: GRF, d: 'advanced', cog: 'analyze', lesson: '11graph-01-graphs', subj: 'inf-11-graph-bfs',
    sub: 'Обход в ширину кодом',
    prompt: 'Граф задан списком смежности: 1 → 2, 3; 2 → 4; 3 → 4, 5; 4 → 6; 5 → 6; 6 → ничего. Выполните обход в ширину из вершины 1 (сначала все вершины на расстоянии 1, потом на расстоянии 2 и так далее) и выведите порядок посещения через пробел.',
    template: `# Допиши обход в ширину\nadj = {1: [2, 3], 2: [4], 3: [4, 5], 4: [6], 5: [6], 6: []}\nseen = [1]\nqueue = [1]\nwhile ...:\n    # забираем вершину из очереди, смотрим её соседей\n    ...\nprint(*seen)`,
    solution: `adj = {1: [2, 3], 2: [4], 3: [4, 5], 4: [6], 5: [6], 6: []}
seen = [1]
queue = [1]
while len(queue) > 0:
    v = queue.pop(0)
    for u in adj[v]:
        if u not in seen:
            seen.append(u)
            queue.append(u)
print(*seen)`,
    expected: '1 2 3 4 5 6',
    why: 'Обход идёт по уровням: сначала 1, потом её соседи 2 и 3, потом вершины на расстоянии 2 — 4 и 5, потом 6. Порядок 1 2 3 4 5 6 разный по сравнению с обходом в глубину, который пошёл бы 1 → 2 → 4 → 6. Отметки о посещении нужны, чтобы не зациклиться.',
  });
}

// ── КТП 22 | 11graph-02-paths | оптимальный путь и число путей (7) ──
{
  const pred = { B: ['A'], C: ['A', 'B'], D: ['C'], E: ['C', 'D'] };
  const ways = dagWays(pred, ['A', 'B', 'C', 'D', 'E']);
  if (ways.E !== 4) throw new Error(`путей в E: ${ways.E}`);
  const list = allPaths([['A', 'B'], ['A', 'C'], ['B', 'C'], ['C', 'D'], ['C', 'E'], ['D', 'E']], 'A', 'E');
  if (list.length !== ways.E) throw new Error(`перебор ${list.length} != накопление ${ways.E}`);
  num('graph', {
    topic: GRF, d: 'basic', cog: 'apply', lesson: '11graph-02-paths', subj: 'inf-11-graph-dag',
    sub: 'Накопление в две ступени',
    prompt: 'В ориентированном ациклическом графе рёбра A→B, A→C, B→C, C→D, C→E, D→E. Сколько путей ведёт из A в E? Запишите только число.',
    value: ways.E,
    why: `Считаем накоплением в топологическом порядке: в B — 1 путь, в C складываются пути из A и B: 1 + 1 = ${ways.C}, в D столько же, сколько в C, — ${ways.D}, а в E складываются пути из C и D: ${ways.C} + ${ways.D} = ${ways.E}. Проверка перебором: ${list.map((p) => p.join('→')).join('; ')} — тоже ${list.length}.`,
  });
}
{
  const pred = { B: ['A'], C: ['A'], D: ['B', 'C'], E: ['B', 'C'], F: ['D', 'E'] };
  const ways = dagWays(pred, ['A', 'B', 'C', 'D', 'E', 'F']);
  if (ways.A !== 1) throw new Error(`в источнике: ${ways.A}`);
  num('graph', {
    topic: GRF, d: 'basic', cog: 'remember', lesson: '11graph-02-paths', subj: 'inf-11-graph-dag',
    sub: 'Пустой путь в источнике',
    prompt: 'При подсчёте числа путей в вершину-источник A, у которой нет входящих рёбер, сколько путей в неё засчитывают? Запишите только число.',
    value: ways.A,
    why: `В вершину-источник засчитывают один пустой путь — тот, что состоит из самой вершины и ничего не содержит. Если поставить 0, все остальные значения тоже станут нулевыми: например, в D было бы 0 + 0 = 0 вместо ${ways.D}. Это главная ловушка накопления, поэтому её проверяют отдельно.`,
  });
}
{
  const edges = [['A', 'B'], ['A', 'C'], ['C', 'B'], ['B', 'D'], ['C', 'D']];
  const w = { 'A|B': 5, 'A|C': 1, 'C|B': 2, 'B|D': 3, 'C|D': 10 };
  const weight = (u, v) => w[`${u}|${v}`] ?? w[`${v}|${u}`];
  const { best, all } = shortest(edges, weight, 'A', 'D');
  if (best !== 6) throw new Error(`кратчайший: ${best}`);
  num('graph', {
    topic: GRF, d: 'intermediate', cog: 'analyze', lesson: '11graph-02-paths', subj: 'inf-11-graph-weight',
    sub: 'Кратчайший путь перебором',
    prompt: 'Взвешенный граф: веса рёбер A–B = 5, A–C = 1, C–B = 2, B–D = 3, C–D = 10. Чему равна длина кратчайшего пути из A в D? Запишите только число.',
    value: best,
    why: `Выписываем все пути с суммами: ${all.map((p) => `${p.path.join('→')} = ${p.cost}`).join('; ')}. Минимум — ${best}. Прямой путь A→B→D стоит 8, а через C выходит дешевле: 1 + 2 + 3 = ${best}. Путь с меньшим числом рёбер не значит более дешёвый, поэтому сравнивают суммы весов, а не длины маршрутов.`,
  });
}
{
  // Минимальная стоимость в ациклическом графе: min по предшественникам + вес ребра.
  const predW = { B: [['A', 4]], C: [['A', 2], ['B', 1]], D: [['B', 5], ['C', 1]], E: [['C', 6], ['D', 2]] };
  const cost = dagMinCost(predW, ['A', 'B', 'C', 'D', 'E']);
  if (cost.E !== 5) throw new Error(`стоимость E: ${cost.E}`);
  num('graph', {
    topic: GRF, d: 'intermediate', cog: 'analyze', lesson: '11graph-02-paths', subj: 'inf-11-graph-weight',
    sub: 'Минимальная стоимость до вершины',
    prompt: 'В ациклическом графе рёбра A→B (4), A→C (2), B→C (1), B→D (5), C→D (1), C→E (6), D→E (2). Сколько стоит самый дешёвый путь из A в E, если стоимость вершины равна минимуму по предшественникам плюс вес ребра? Запишите только число.',
    value: cost.E,
    why: `Считаем по вершинам: стоимость(A) = 0; стоимость(B) = 0 + 4 = ${cost.B}; стоимость(C) = min(0 + 2; ${cost.B} + 1) = min(2; ${cost.B + 1}) = ${cost.C}; стоимость(D) = min(${cost.B} + 5; ${cost.C} + 1) = ${cost.D}; стоимость(E) = min(${cost.C} + 6; ${cost.D} + 2) = ${cost.E}. Важно брать минимум по каждому предшественнику отдельно: в C входят сразу два ребра с разными весами.`,
  });
}
{
  const pred = { B: ['A'], C: ['A'], D: ['B', 'C'], E: ['C', 'D'], F: ['D', 'E'], G: ['E', 'F'] };
  const ways = dagWays(pred, ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  if (ways.G !== 8) throw new Error(`путей в G: ${ways.G}`);
  num('graph', {
    topic: GRF, d: 'intermediate', cog: 'analyze', lesson: '11graph-02-paths', subj: 'inf-11-graph-dag',
    sub: 'Число путей в семи вершин',
    prompt: 'В ориентированном ациклическом графе семь вершин и рёбра A→B, A→C, B→D, C→D, C→E, D→E, D→F, E→F, E→G, F→G. Сколько путей ведёт из A в G? Запишите только число.',
    value: ways.G,
    why: `Накопление по порядку: A = 1, B = 1, C = 1, D = 1 + 1 = ${ways.D}, E = 1 + ${ways.D} = ${ways.E}, F = ${ways.D} + ${ways.E} = ${ways.F}, G = ${ways.E} + ${ways.F} = ${ways.G}. Значение растёт быстро: каждый новый уровень складывает уже накопленные числа, поэтому у последней вершины путей заметно больше, чем у первой.`,
  });
}
{
  const edges = [['A', 'B'], ['A', 'C'], ['B', 'C'], ['B', 'D'], ['C', 'D'], ['A', 'D']];
  const w = { 'A|B': 2, 'A|C': 2, 'B|C': 1, 'B|D': 5, 'C|D': 5, 'A|D': 7 };
  const weight = (u, v) => w[`${u}|${v}`] ?? w[`${v}|${u}`];
  const { best, paths, all } = shortest(edges, weight, 'A', 'D');
  if (best !== 7 || paths.length !== 3) throw new Error(`кратчайших: ${paths.length} по ${best}`);
  num('graph', {
    topic: GRF, d: 'advanced', cog: 'analyze', lesson: '11graph-02-paths', subj: 'inf-11-graph-weight',
    sub: 'Число кратчайших путей',
    prompt: 'Взвешенный граф: веса рёбер A–B = 2, A–C = 2, B–C = 1, B–D = 5, C–D = 5, A–D = 7. Сколько различных путей из A в D имеют минимальную сумму весов, если эта минимальная сумма равна 7? Запишите только число.',
    value: paths.length,
    why: `Все пути с суммами: ${all.map((p) => `${p.path.join('→')} = ${p.cost}`).join('; ')}. Минимальная сумма ${best} достигается ${paths.length} способами: ${paths.map((p) => p.join('→')).join('; ')}. Длинный путь A→B→C→D стоит 8 и не подходит, хотя ребер в нём больше всех. Ответы «длина» и «число способов» считают отдельно.`,
  });
}
{
  // Число путей в DAG кодом — тем же накоплением, что и в тетради.
  const pred = { A: [], B: ['A'], C: ['A'], D: ['B', 'C'], E: ['C', 'D'], F: ['D', 'E'] };
  const ways = dagWays(pred, ['A', 'B', 'C', 'D', 'E', 'F']);
  if (ways.F !== 5) throw new Error(`F: ${ways.F}`);
  cr('graph', {
    topic: GRF, d: 'advanced', cog: 'analyze', lesson: '11graph-02-paths', subj: 'inf-11-graph-dag',
    sub: 'Число путей в DAG кодом',
    prompt: 'Граф: рёбра A→B, A→C, B→D, C→D, C→E, D→E, D→F, E→F. Посчитайте число путей из A в F накоплением в топологическом порядке: число путей в вершину равно сумме чисел путей во всех её предшественников, а в вершину-источник A засчитывается один пустой путь. Выведите число путей в A и число путей в F через пробел.',
    template: `# Допиши накопление по топологическому порядку\npred = {\n    'A': [],\n    'B': ['A'],\n    'C': ['A'],\n    'D': ['B', 'C'],\n    'E': ['C', 'D'],\n    'F': ['D', 'E'],\n}\norder = ['A', 'B', 'C', 'D', 'E', 'F']\nways = {}\nfor v in order:\n    # суммируем по предшественникам, а у источника — 1\n    ...\nprint(ways['A'], ways['F'])`,
    solution: `pred = {
    'A': [],
    'B': ['A'],
    'C': ['A'],
    'D': ['B', 'C'],
    'E': ['C', 'D'],
    'F': ['D', 'E'],
}
order = ['A', 'B', 'C', 'D', 'E', 'F']
ways = {}
for v in order:
    if len(pred[v]) == 0:
        ways[v] = 1
    else:
        ways[v] = 0
        for p in pred[v]:
            ways[v] = ways[v] + ways[p]
print(ways['A'], ways['F'])`,
    expected: '1 5',
    why: `Порядок обхода — топологический: каждая вершина идёт после всех своих предшественников, иначе нужное значение ещё не посчитано. В A — пустой путь, дальше B = 1, C = 1, D = 1 + 1 = 2, E = 1 + 2 = 3, F = 2 + 3 = ${ways.F}. Ошибка «поставить 0 в источник» уменьшила бы все значения вдвое.`,
  });
}

// ═════════════════════ КТП 23–24 · игры и таблица стратегии ═════════════════════

const GAM = 'Выигрышные стратегии';

// ── КТП 23 | 11graph-02-games | дискретные игры двух игроков (1) ──
{
  const win = winReach(11, [1, 2]);
  const losing = Object.entries(win).filter(([, v]) => !v).map(([k]) => Number(k)).sort((a, b) => a - b);
  const winning = Object.values(win).filter(Boolean).length;
  if (losing.join(',') !== '2,5,8' || winning !== 7) throw new Error(`разметка: ${losing}/${winning}`);
  num('graph', {
    topic: GAM, d: 'basic', cog: 'apply', lesson: '11graph-02-games', subj: 'inf-11-graph-games',
    sub: 'Выигрышные позиции',
    prompt: 'В игре куча камней: за ход прибавляют 1 или 2 камня, выигрывает тот, кто первым сделает сумму не меньше 11. Позиции размечают от 10 вниз, помечая проигрышные буквой L. Сколько позиций среди 1, 2, …, 10 окажутся выигрышными? Запишите только число.',
    value: winning,
    why: `Разметка даёт проигрышные позиции ${losing.join(', ')}: из каждой из них любой ход ведёт в выигрышную, поэтому их ${losing.length}. Остальные ${winning} позиций выигрышные — из них есть ход в проигрышную. Проверка: из 8 ходы ведут в 9 и 10, а обе выигрышные, значит 8 проигрышная.`,
  });
}

// ── КТП 24 | 11graph-03-table | выигрышная стратегия в табличной форме (5) ──
// Практическая работа урока: «куча камней, берём 1 или 3, проигрывает взявший
// последний, старт 21». Разметка одна на все пять заданий — GAME_WIN не MARK.
const GAME_MOVES = [1, 3];
const START = 21;
const GAME_WIN = loseTakeLast(START, GAME_MOVES);
const GAME_L = Object.entries(GAME_WIN).filter(([k, v]) => !v && Number(k) > 0).map(([k]) => Number(k)).sort((a, b) => a - b);
if (GAME_L.join(',') !== '1,3,5,7,9,11,13,15,17,19,21') throw new Error(`проигрышные: ${GAME_L}`);
{
  const n = GAME_L.length;
  num('graph', {
    topic: GAM, d: 'basic', cog: 'analyze', lesson: '11graph-03-table', subj: 'inf-11-graph-table',
    sub: 'Число проигрышных позиций',
    prompt: `В игре из кучи камней за ход берут 1 или 3 камня, а проигрывает тот, кто взял последний камень. Старт — ${START} камень. Позиции размечают от 1 вверх. Сколько проигрышных позиций среди 1, 2, …, ${START}? Запишите только число.`,
    value: n,
    why: `Таблица заполняется снизу вверх: позиция 1 проигрышная (единственный ход забирает последний камень), 2 и 3 — выигрышные (можно оставить сопернику 1), дальше правило повторяется. Проигрышными оказались позиции ${GAME_L.join(', ')} — их ${n}. Заметьте: сюда попала и стартовая позиция ${START}.`,
  });
}
{
  const opts = [
    'Сверху вниз: сначала позиции, которые встречаются в первых ходах',
    'Снизу вверх: от терминальных позиций, ходы из которых уже размечены',
    'В случайном порядке: результат от порядка не зависит',
    'Сверху вниз, но только по позициям одного игрока',
  ];
  sc('graph', {
    topic: GAM, d: 'basic', cog: 'remember', lesson: '11graph-03-table', subj: 'inf-11-graph-table',
    sub: 'Порядок заполнения таблицы',
    prompt: 'В каком порядке заполняют таблицу игры, размечая позиции буквами W и L?',
    opts, correctText: opts[1],
    why: 'Отметка позиции зависит только от отметок тех позиций, в которые из неё ведут ходы, а те дальше по числу камней. Поэтому таблицу заполняют снизу вверх: сначала терминальные позиции, у которых ходов нет или они проигрышны, потом остальные. Разметка сверху вниз даёт неверные отметки почти везде.',
  });
}
{
  const s = 20;
  const good = winningMoves(s, GAME_MOVES, GAME_WIN);
  if (good.length !== 2 || good.join(',') !== '1,3') throw new Error(`ходы из ${s}: ${good}`);
  num('graph', {
    topic: GAM, d: 'intermediate', cog: 'analyze', lesson: '11graph-03-table', subj: 'inf-11-graph-table',
    sub: 'Выигрышные ходы из позиции',
    prompt: `В игре берут 1 или 3 камня, проигрывает взявший последний. Позиция ${s} камней. Сколько ходов из неё ведут в проигрышную позицию? Запишите только число.`,
    value: good.length,
    why: `Из ${s} можно взять ${good.map((k) => `${k} камня`).join(' или ')}: останется ${good.map((k) => s - k).join(' или ')}, а обе позиции проигрышные. Значит ходов в L столько же — ${good.length}. Стратегия выбирает любой из них, но проверяют оба: против хода соперника должен быть ответ.`,
  });
}
{
  // Партия по таблице: первый всегда берёт 3, второй оставляет нечётную позицию.
  let s = START, firstMoves = 0, secondMoves = 0;
  while (s > 1) {
    s -= 3; firstMoves += 1;
    if (s <= 1) break;
    s -= 1; secondMoves += 1;
  }
  if (firstMoves !== 5 || secondMoves !== 5 || s !== 1) throw new Error(`партия: ${s}/${firstMoves}/${secondMoves}`);
  num('graph', {
    topic: GAM, d: 'advanced', cog: 'analyze', lesson: '11graph-03-table', subj: 'inf-11-graph-table',
    sub: 'Длина партии по таблице',
    prompt: `В игре берут 1 или 3 камня, проигрывает взявший последний, старт — ${START}. Первый игрок всегда берёт 3 камня, второй отвечает по стратегии: оставляет сопернику проигрышную (нечётную) позицию. Сколько ходов сделает второй игрок до конца партии? Запишите только число.`,
    value: secondMoves,
    why: `Партия по таблице: 21 →(3) 18 →(1) 17 →(3) 14 →(1) 13 →(3) 10 →(1) 9 →(3) 6 →(1) 5 →(3) 2 →(1) 1. Второй игрок сделал ${secondMoves} ходов, первый столько же, а последний камень остался первому — он и проиграл. Разметка показывает стратегию целиком: против любого хода соперника есть ответ, ведущий в проигрышную позицию.`,
  });
}
{
  cr('graph', {
    topic: GAM, d: 'advanced', cog: 'analyze', lesson: '11graph-03-table', subj: 'inf-11-graph-table',
    sub: 'Таблица игры кодом',
    prompt: `Разметьте позиции игры: куча камней, за ход берут ${GAME_MOVES.join(' или ')} камня, проигрывает тот, кто взял последний камень. Позиция проигрышная, если ни один ход не ведёт в проигрышную позицию соперника; ход, забирающий весь остаток, проигрывает сразу. Выведите все проигрышные позиции от 1 до ${START}, каждую с новой строки.`,
    template: `# Допиши разметку снизу вверх\nmoves = [1, 3]\nlimit = ${START}\nwin = {}\nfor s in range(1, limit + 1):\n    # позиция выигрышная, если есть ход в проигрышную\n    ...\nfor s in range(1, limit + 1):\n    if not win[s]:\n        print(s)`,
    solution: `moves = [1, 3]
limit = ${START}
win = {}
for s in range(1, limit + 1):
    win[s] = False
    for k in moves:
        # ход, забирающий все камни, сразу проигрывает
        if k < s and not win[s - k]:
            win[s] = True
for s in range(1, limit + 1):
    if not win[s]:
        print(s)`,
    expected: GAME_L.join('\n'),
    why: `Разметка идёт от малых позиций к большим: результат позиции зависит только от меньших. Ход, забирающий весь остаток (k == s), сразу проигрывает, поэтому его в проверке пропускают — условие k < s. Проигрышными вышли нечётные позиции ${GAME_L.join(', ')}, значит от стартовой позиции ${START} выигрывает второй игрок.`,
  });
}

// ═════════════════════ КТП 26–29 · сети, HTML, сервисы, этикет ═════════════════════

const NET = 'Сети';

// ── КТП 26 | 11net-04-control | итоговая: интернет и доменные имена (1) ──
{
  const bits = 128;
  if (bits !== 128) throw new Error(`IPv6: ${bits}`);
  num('net', {
    topic: NET, d: 'basic', cog: 'remember', lesson: '11net-04-control', subj: 'inf-11-net-ip',
    sub: 'Разрядность IPv6',
    prompt: 'Сколько бит содержится в адресе протокола IPv6? Запишите только число.',
    value: bits,
    why: `IPv6 записывается восемью группами по 16 бит, то есть 8 · 16 = ${bits} бит. У IPv4 адрес короче вчетверо — 32 бита, поэтому адресов IPv4 хватает на всех, а IPv6 даёт практически неисчерпаемый запас.`,
  });
}

// ── КТП 27 | 11net-02-html | язык гипертекстовой разметки (1) ──
{
  const opts = [
    '<p><b>жирный текст</p></b>',
    '<b><p>жирный</b> текст</p>',
    '<p><b>жирный</b> текст</p>',
    '<p>жирный <b> текст</b></p>',
  ];
  sc('net', {
    topic: NET, d: 'intermediate', cog: 'analyze', lesson: '11net-02-html', subj: 'inf-11-net-html',
    sub: 'Вложенность тегов',
    prompt: 'Нужно разметить абзац, в котором слово «жирный» выделено полужирным начертанием. Какой код верен?',
    opts, correctText: opts[0],
    why: 'Вложенный тег закрывают раньше внешнего: сначала </b>, потом </p>. В варианте со скрещёнными тегами браузер попытается исправить разметку сам, и результат окажется непредсказуемым. Порядок открытия — как в порядке закрытия, только наоборот.',
  });
}

// ── КТП 28 | 11net-03-services | сервисы Интернета и цифровая культура (1) ──
{
  const opts = [
    'Положение определяется точно, вплоть до сантиметров, поэтому ошибок быть не может',
    'Точность зависит только от количества спутников, а о погрешности можно не думать',
    'Положение определяется приблизительно: у геолокации всегда есть погрешность',
    'Геолокация вообще не измеряет, а берёт данные из записной книжки телефона',
  ];
  sc('net', {
    topic: NET, d: 'intermediate', cog: 'analyze', lesson: '11net-03-services', subj: 'inf-11-net-gis',
    sub: 'Погрешность геолокации',
    prompt: 'Навигатор показывает, что точность определения местоположения составляет 12 метров. Как это следует понимать при работе с геоинформационной системой?',
    opts, correctText: opts[0],
    why: 'Геолокация определяет положение по сигналам башен связи, спутникам и точкам Wi-Fi, поэтому у результата всегда есть погрешность. В ГИС эту точность указывают явно, и выводы делают с её учётом: судить по карте можно о том, где что находится, но не о расстоянии в пару метров.',
  });
}

// ── КТП 29 | 11net-05-etiquette | сетевой этикет и поисковые запросы (1) ──
{
  const opts = [
    'Ищет только документы определённого типа: методичка filetype:pdf — методички в формате PDF',
    'Ограничивает поиск одним сайтом, как оператор site:',
    'Требует, чтобы запрос был точным выражением, как кавычки в поисковой строке',
    'Исключает из выдачи документы со словом «методичка», как оператор «минус»',
  ];
  sc('net', {
    topic: NET, d: 'basic', cog: 'apply', lesson: '11net-05-etiquette', subj: 'inf-11-net-search',
    sub: 'Оператор filetype',
    prompt: 'Что делает оператор filetype: в поисковом запросе?',
    opts, correctText: opts[0],
    why: 'Оператор filetype: оставляет в выдаче только файлы нужного типа: методичка filetype:pdf найдёт методички в формате PDF. Запомнить его проще всего рядом с другими: site: ищет внутри сайта, кавычки — точную фразу, минус убирает лишнее.',
  });
}
// ═════════════ ДОПИС ПО tmp/need-11.txt · КТП 2–6 и КТП 20 ═════════════

// ── КТП 2 | 11data-02-stats | статистическая обработка данных (3) ──
{
  const marks = [5, 4, 5, 3, 5, 4, 2];
  const counts = {};
  for (const m of marks) counts[m] = (counts[m] ?? 0) + 1;
  let mode = marks[0];
  let bestN = 0;
  for (const k of Object.keys(counts)) {
    if (counts[k] > bestN) { bestN = counts[k]; mode = Number(k); }
  }
  if (mode !== 5 || bestN !== 3) throw new Error(`мода: ${mode} x${bestN}`);
  num('data', {
    topic: DT, d: 'basic', cog: 'apply', lesson: '11data-02-stats', subj: 'inf-11-data-stats',
    sub: 'Мода ряда',
    prompt: `Оценки класса за четверть: ${marks.join(', ')}. Какая оценка встречается чаще всего (мода ряда)? Запишите только число.`,
    value: mode,
    why: `Сортируем ряд: ${[...marks].sort((a, b) => a - b).join(', ')}. Пятёрка встречается ${bestN} раза, четвёрка — ${counts[4]} раза, остальные по одному, поэтому мода равна ${mode}. В LibreOffice Calc её считает функция РЕЖИМ.`,
  });
}
{
  const series = [120, 150, 135, 180];
  const chain = series.slice(1).map((v, i) => v - series[i]);
  const avg = (series[series.length - 1] - series[0]) / (series.length - 1);
  if (avg !== 20 || chain.join(',') !== '30,-15,45') throw new Error(`прирост: ${avg}/${chain}`);
  num('data', {
    topic: DT, d: 'intermediate', cog: 'analyze', lesson: '11data-02-stats', subj: 'inf-11-data-stats',
    sub: 'Средний абсолютный прирост',
    prompt: `Продажи по месяцам (единиц): январь — ${series[0]}, февраль — ${series[1]}, март — ${series[2]}, апрель — ${series[3]}. На сколько в среднем единиц продажи растут за один месяц? Запишите только число.`,
    value: avg,
    why: `Цепные приросты: ${chain.join('; ')} — всего ${sum(chain)} единиц за ${series.length - 1} интервала, значит в среднем ${sum(chain)} / ${series.length - 1} = ${avg}. То же даёт формула (последнее − первое) / (число интервалов) = (${series[series.length - 1]} − ${series[0]}) / ${series.length - 1}.`,
  });
}
{
  const salaries = [50000, 52000, 200000];
  const med = median(salaries);
  const avg = Math.round(mean(salaries));
  if (med !== 52000 || avg !== 100667) throw new Error(`меры центра: ${med}/${avg}`);
  const opts = [
    `Медиану: она равна ${med} и не смещается от выброса в 200 000`,
    'Среднее: оно учитывает все три значения, поэтому надёжнее',
    'Размах: он покажет типичный доход точнее любой средней',
    'Любую из них: на трёх значениях медиана и среднее совпадают',
  ];
  sc('data', {
    topic: DT, d: 'advanced', cog: 'analyze', lesson: '11data-02-stats', subj: 'inf-11-data-stats',
    sub: 'Выбор меры центра',
    prompt: `Зарплаты трёх сотрудников: ${salaries.join(', ')} рублей. Какую величину предпочтительнее назвать, чтобы описать типичный доход в этом коллективе?`,
    opts, correctText: opts[0],
    why: `Медиана упорядочивает ряд и берёт середину: здесь она равна ${med} рублям, а среднее арифметическое — ${avg}, и его увеличивает единственный выброс 200 000. Выбирать между ними нужно по распределению: если выбросов нет, берут среднее, если есть — медиану.`,
  });
}

// ── КТП 3 | 11data-03-diagrams | диаграммы результатов анализа (3) ──
{
  const opts = [
    'Диаграмму разброса (XY): по одной оси одна величина, по другой — вторая',
    'Круговую: она показывает доли целого',
    'Линейную: по ней видно изменение показателя по месяцам',
    'Гистограмму: она показывает распределение значений по интервалам',
  ];
  sc('data', {
    topic: DT, d: 'basic', cog: 'remember', lesson: '11data-03-diagrams', subj: 'inf-11-data-viz',
    sub: 'Диаграмма разброса',
    prompt: 'Нужно проверить, связаны ли температура воздуха и число проданных за день порций мороженого. Какую диаграмму построят?',
    opts, correctText: opts[0],
    why: 'Диаграмма разброса кладёт пары значений как точки: по оси X — температура, по оси Y — продажи, и облако точек сразу показывает направление связи. Круговая нужна для долей, линейная — для времени, гистограмма — для распределения значений.',
  });
}
{
  const left = ['Заголовок', 'Подпись оси с единицами измерения', 'Источник данных'];
  const right = ['показывает, что вообще изображено', 'позволяет понять, в каких единицах посчитано', 'позволяет проверить, откуда взяты числа'];
  mt('data', {
    topic: DT, d: 'intermediate', cog: 'apply', lesson: '11data-03-diagrams', subj: 'inf-11-data-viz',
    sub: 'Оформление диаграммы',
    prompt: 'Установите соответствие: элемент диаграммы — зачем он нужен.',
    left, right,
    map: {
      'Заголовок': right[0],
      'Подпись оси с единицами измерения': right[1],
      'Источник данных': right[2],
    },
    why: 'Без заголовка непонятно, что показано; без единиц значения не читаются («15 — чего?»); без источника данные нельзя проверить. Эти три элемента обязательны на любой диаграмме аналитической работы, остальное — по желанию.',
  });
}
{
  const values = [3, 5, 9, 11, 13, 17, 19, 24];
  const from = 10, to = 20;
  const hit = values.filter((v) => v >= from && v <= to);
  if (hit.length !== 4 || hit.join(',') !== '11,13,17,19') throw new Error(`интервал: ${hit}`);
  num('data', {
    topic: DT, d: 'advanced', cog: 'analyze', lesson: '11data-03-diagrams', subj: 'inf-11-data-viz',
    sub: 'Интервалы гистограммы',
    prompt: `Показатель за восемь дней: ${values.join(', ')}. При построении гистограммы значения разбивают на интервалы по 10. Сколько значений попадёт в интервал от ${from} до ${to} включительно? Запишите только число.`,
    value: hit.length,
    why: `В интервал [${from}; ${to}] попадают ${hit.join(', ')} — это ${hit.length} значения. Меньше ${from}: ${values.filter((v) => v < from).join(', ')}; больше ${to}: ${values.filter((v) => v > to).join(', ')}. Гистограмма показывает именно количество значений в каждом интервале, поэтому границы интервала нужно оговаривать явно.`,
  });
}

// ── КТП 4 | 11data-04-correlation | регрессия и корреляция (3) ──
{
  const x = [1, 2, 3, 4];
  const y = [12, 24, 36, 48];
  const { k, b } = linreg(x, y);
  if (k !== 12 || b !== 0) throw new Error(`регрессия: ${k}/${b}`);
  num('data', {
    topic: DT, d: 'basic', cog: 'apply', lesson: '11data-04-correlation', subj: 'inf-11-data-fit',
    sub: 'Коэффициент регрессии',
    prompt: `Продажи Y при X = ${x.join(', ')} составили ${y.join(', ')} единиц. Линия тренда имеет вид y = kx + b. Чему равен коэффициент регрессии k — на сколько продажи растут при увеличении X на единицу? Запишите только число.`,
    value: k,
    why: `Каждый шаг X на единицу добавляет ровно ${y[1] - y[0]} к продажам, поэтому k = ${k}. Свободный член b получился равным ${b}: линия проходит через начало координат. Коэффициент k показывает скорость роста в единицах Y на единицу X, а не процентах.`,
  });
}
{
  const opts = [
    'Будет близок к нулю: линейной связи нет, хотя связь есть',
    'Будет равен 1: обе величины растут одновременно',
    'Будет равен −1: величины связаны противоположно',
    'Определить нельзя: для расчёта нужны одинаковые единицы измерения',
  ];
  sc('data', {
    topic: DT, d: 'intermediate', cog: 'analyze', lesson: '11data-04-correlation', subj: 'inf-11-data-corr',
    sub: 'Нелинейная связь',
    prompt: 'Радиус круга увеличивают вдвое, а площадь при этом растёт вчетверо. Что покажет коэффициент корреляции Пирсона, вычисленный по этим данным?',
    opts, correctText: opts[0],
    why: 'Площадь пропорциональна квадрату радиуса, то есть зависимость нелинейная, и r будет близок к нулю. Отсюда важное ограничение: r = 0 означает отсутствие ЛИНЕЙНОЙ связи, а не отсутствие связи вообще. Единицы измерения на значение r не влияют.',
  });
}
{
  const left = ['k', 'b', 'r', 'Прогноз значения Y'];
  const right = ['сила и направление линейной связи, число от −1 до 1', 'на сколько Y меняется при изменении X на единицу', 'значение Y, которое получается при X = 0', 'подстановка предполагаемого X в уравнение тренда'];
  mt('data', {
    topic: DT, d: 'advanced', cog: 'analyze', lesson: '11data-04-correlation', subj: 'inf-11-data-fit',
    sub: 'Смысл величин регрессии',
    prompt: 'Установите соответствие: величина регрессионного анализа — что она означает.',
    left, right,
    map: { 'k': right[1], 'b': right[2], 'r': right[0], 'Прогноз значения Y': right[3] },
    why: 'Коэффициенты k и b задают саму прямую y = kx + b, коэффициент r измеряет её качество, а прогноз — применение модели к новому значению X. Путать их нельзя: k показывает рост, r — силу связи, а прогноз получают подстановкой, а не сложением k и r.',
  });
}

// ── КТП 5 | 11data-05-equation | численное решение уравнения (3) ──
{
  const opts = [
    'Нет: график функции не пересекает ось X, поэтому искать корень не нужно',
    'Да: корни обязательно есть, достаточно взять шаг перебора побольше',
    'Да: корни есть, причём их бесконечно много',
    'Ответить нельзя, пока корень не вычислен',
  ];
  sc('data', {
    topic: DT, d: 'basic', cog: 'apply', lesson: '11data-05-equation', subj: 'inf-11-data-fit',
    sub: 'Существование корня',
    prompt: 'Решают уравнение x² + 4 = 0 численным методом подбора параметра. Имеет ли смысл запускать перебор?',
    opts, correctText: opts[0],
    why: 'x² не бывает отрицательным, поэтому x² + 4 всегда больше нуля и график лежит выше оси X: корней нет. Перебор не приблизит ответ, он только потратит время — поэтому существование корня проверяют графиком самым первым шагом.',
  });
}
{
  const sol = `def f(x):
    return x ** 3 - 2 * x - 5

best_x = None
best = None
k = 0
while k <= 5:
    x = 2.0 + 0.1 * k
    # проверяем очередное значение параметра и запоминаем лучшее
    v = abs(f(x))
    if best is None or v < best:
        best = v
        best_x = x
    k = k + 1
print(best_x, round(f(best_x), 3))`;
  cr('data', {
    topic: DT, d: 'intermediate', cog: 'apply', lesson: '11data-05-equation', subj: 'inf-11-data-fit',
    sub: 'Подбор с фиксированным шагом',
    prompt: 'Уравнение x³ − 2x − 5 = 0 решают подбором параметра. Переберите x от 2,0 до 2,5 с шагом 0,1 и найдите то значение, где значение функции по модулю минимально. Выведите сначала найденное x, затем через пробел значение функции, округлённое до тысячных.',
    template: `# Найдите значение x, где |f(x)| минимально\ndef f(x):\n    return x ** 3 - 2 * x - 5\n\nbest_x = None\nbest = None\nk = 0\nwhile k <= 5:\n    x = 2.0 + 0.1 * k\n    # сравниваем модуль значения с лучшим найденным\n    ...\nprint(best_x, round(f(best_x), 3))`,
    solution: sol,
    why: 'При x = 2,0 получаем f = −1, а при x = 2,1 уже f ≈ 0,061 — это лучшее из значений с шагом 0,1. Перебор идёт по сетке значений, поэтому шаг задаёт точность: уменьшив его, получим приближение ближе к настоящему корню около 2,094.',
  });
}
{
  const opts = [
    'Уменьшить шаг перебора или уточнить найденный отрезок методом бисекции',
    'Остановиться: численный метод даёт точный ответ',
    'Изменить единицы измерения, чтобы число стало целым',
    'Дописать больше знаков после запятой, не меняя самого расчёта',
  ];
  sc('data', {
    topic: DT, d: 'advanced', cog: 'analyze', lesson: '11data-05-equation', subj: 'inf-11-data-fit',
    sub: 'Повышение точности',
    prompt: 'Численное решение получено с точностью до 0,1. Как повысить точность, не меняя формулы метода?',
    opts, correctText: opts[0],
    why: 'Приближение уточняют только пересчётом: меньшим шагом перебора или сужением отрезка вокруг найденной точки методом бисекции, который делит отрезок пополам. Дописать разряды «по смыслу» — значит выдумать цифры, которых никто не вычислял.',
  });
}

// ── КТП 6 | 11data-06-optimize | задачи оптимизации (3) ──
{
  const opts = [
    'Количество товара: его нужно максимизировать',
    'Бюджет: его нужно максимизировать',
    'Время покупки: его нужно минимизировать',
    'Ничего: бюджет задан, а значит, оптимизировать нечего',
  ];
  sc('data', {
    topic: DT, d: 'basic', cog: 'apply', lesson: '11data-06-optimize', subj: 'inf-11-data-opt',
    sub: 'Цель и ограничение',
    prompt: 'В задаче «купить максимум товара в рамках бюджета 5000 рублей» что именно оптимизируется?',
    opts, correctText: opts[0],
    why: 'Бюджет 5000 рублей — это ограничение, оно задаёт допустимые варианты. А оптимизируемая (целевая) величина — количество товара, и её надо максимизировать. Путать цель с ограничением — самая частая ошибка: ограничение задаёт рамку, а не результат.',
  });
}
{
  const maxX = 40;
  const fixed = 500;
  const k = 20;
  const c = 1200;
  const profit = (x) => (c - k * x) * x - fixed;
  let bestX = 0;
  let bestV = profit(0);
  for (let x = 1; x <= maxX; x++) {
    const v = profit(x);
    if (v > bestV) { bestV = v; bestX = x; }
  }
  const near = [bestX - 1, bestX + 1].map((x) => `${x} → ${profit(x)}`);
  if (bestX !== 30 || bestV !== 17500) throw new Error(`оптимум: ${bestX}/${bestV}`);
  num('data', {
    topic: DT, d: 'intermediate', cog: 'apply', lesson: '11data-06-optimize', subj: 'inf-11-data-opt',
    sub: 'Максимум целевой функции',
    prompt: `Цена товара зависит от числа проданных единиц: p(x) = ${c} − ${k}x рублей. Постоянные затраты — ${fixed} рублей, продать можно не больше ${maxX} единиц. Найдите максимальную прибыль (выручка минус ${fixed} рублей) при целом x от 0 до ${maxX}. Запишите только число.`,
    value: bestV,
    why: `Считаем прибыль по всему диапазону: максимум получается при x = ${bestX} и равен ${bestV}. Рядом с ним значения меньше (${near.join('; ')}), поэтому это настоящий максимум, а не первое же понравившееся число. В таблице тот же результат даёт функция МАКС по столбцу, а на графике видна вершина кривой.`,
  });
}
{
  const opts = [
    'Задача не имеет решения: ресурсов не хватает, чтобы выполнить все требования',
    'У задачи бесконечно много оптимальных решений',
    'Нужно лишь увеличить точность расчёта',
    'Ограничения выполнены автоматически, проверять их не нужно',
  ];
  sc('data', {
    topic: DT, d: 'advanced', cog: 'analyze', lesson: '11data-06-optimize', subj: 'inf-11-data-opt',
    sub: 'Неограниченная область',
    prompt: 'В задаче линейного программирования область допустимых решений оказалась неограниченной: ни одно из ограничений не замыкает её. Что это означает?',
    opts, correctText: opts[0],
    why: 'Если область не ограничена, целевую функцию можно увеличивать сколько угодно — это не оптимум, а отсутствие ограничений. В практической задаче так выглядит нехватка ресурсов: например, рабочих хватает на любой объём, а станок один. Лечится добавлением реальных ограничений, а не округлением ответа.',
  });
}

// ── КТП 20 | 11model-01-modeling | модели и моделирование (10) ──
{
  const f = (x) => x * x - 9;
  const roots = [];
  for (let x = -4; x <= 4; x++) if (f(x) === 0) roots.push(x);
  if (roots.join(',') !== '-3,3') throw new Error(`нули: ${roots}`);
  num('data', {
    topic: MO, d: 'basic', cog: 'apply', lesson: '11model-01-modeling', subj: 'inf-11-model-graph',
    sub: 'Нули функции',
    prompt: 'По графику функции y = x² − 9 находят нули — точки, где значение равно нулю. Сколько нулей у этой функции на отрезке [−4; 4]? Запишите только число.',
    value: roots.length,
    why: `x² = 9 даёт x = ±3, и оба корня (${roots.join(' и ')}) лежат на отрезке [−4; 4], поэтому нулей ${roots.length}. Нули — это точки пересечения графика с осью X: если корень вышел за границы рассматриваемого участка, на участке нулей не будет вовсе.`,
  });
}
{
  const opts = [
    'Нельзя: модель верна там, где прирост постоянен, а на сроке в 200 лет он точно изменится',
    'Можно: формула работает при любом t, поэтому результат точен',
    'Можно, если округлить результат до целого числа особей',
    'Нельзя, потому что N₀ — это количество, а не число',
  ];
  sc('data', {
    topic: MO, d: 'intermediate', cog: 'analyze', lesson: '11model-01-modeling', subj: 'inf-11-model-check',
    sub: 'Область применимости модели',
    prompt: 'Модель роста популяции N = N₀ · (1 + r)ᵗ выведена при постоянном процента прироста r. Можно ли по ней спрогнозировать население страны на 200 лет вперёд?',
    opts, correctText: opts[0],
    why: 'Модель верна только там, где выполнены её предположения. За пределами этого диапазона — ресурсы, миграция, эпидемии, войны — предсказание бессмысленно, сколько бы формула ни считала. Отсюда правило проверки модели: граничные значения и сравнение с другими данными.',
  });
}
{
  const v0 = 20;
  const a = -4;
  const t = -v0 / a;
  const s = v0 * t + (a * t * t) / 2;
  if (t !== 5 || s !== 50) throw new Error(`торможение: ${t}/${s}`);
  num('data', {
    topic: MO, d: 'advanced', cog: 'analyze', lesson: '11model-01-modeling', subj: 'inf-11-model-motion',
    sub: 'Равноускоренное торможение',
    prompt: `Автомобиль движется со скоростью ${v0} м/с и тормозит равноускоренно с ускорением ${a} м/с² (скорость каждую секунду уменьшается на 4 м/с). Какой путь в метрах он пройдёт до полной остановки по модели s = v₀t + at²/2? Запишите только число.`,
    value: s,
    why: `Сначала время до остановки: v = v₀ + at = 0, откуда t = (0 − ${v0}) / (${a}) = ${t} с. Затем путь: s = ${v0} · ${t} + (${a}) · ${t}² / 2 = ${v0 * t} − ${Math.abs(a) * t * t / 2} = ${s} м. Обратите внимание на знак: при торможении путь вдвое меньше, чем при постоянной скорости.`,
  });
}

// ═════════════ ДОПИС ПО tmp/need-11.txt · КТП 7–8 · базы данных ═════════════

// ── КТП 7 | 11db-01-databases | реляционные базы данных (4) ──
{
  const opts = [
    'Название блюда повторяется в каждой строке: при его изменении придётся править все строки',
    'Две строки об одном ученике хранить в одной таблице нельзя',
    'Дата не может быть полем таблицы',
    'Ничего плохого: повторы в базе допустимы',
  ];
  sc('db', {
    topic: DBT, d: 'basic', cog: 'remember', lesson: '11db-01-databases', subj: 'inf-11-db-normal',
    sub: 'Повторы в одной таблице',
    prompt: 'В одной таблице столовой записаны вместе ученик, блюдо, дата и количество. Ученик Иванов в ней встречается дважды — с одним и тем же блюдом, но в разные даты. Почему хранить так плохо?',
    opts, correctText: opts[0],
    why: 'Сведения о блюде повторяются в каждой строке, где его брали. Стоит переименовать блюдо или исправить калорийность — и придётся править все эти строки, причём легко пропустить одну. Нормализация выносит блюда в отдельный справочник, а в таблице поставок остаётся только код блюда.',
  });
}
{
  const opts = [
    'Нарушена первая нормальная форма: в одной ячейке должно быть одно значение',
    'Нарушена вторая нормальная форма: поле зависит от части ключа',
    'Нарушена третья нормальная форма: есть транзитивная зависимость',
    'Ничего не нарушено: в ячейке можно писать что угодно',
  ];
  sc('db', {
    topic: DBT, d: 'intermediate', cog: 'apply', lesson: '11db-01-databases', subj: 'inf-11-db-normal',
    sub: 'Первая нормальная форма',
    prompt: 'В таблице «Поставки» в одной ячейке записано «Борщ, Каша», а в другой — «Борщ, Компот». Какое требование нарушено?',
    opts, correctText: opts[0],
    why: 'Первая нормальная форма требует атомарности: в одной ячейке одно значение и нет повторяющихся групп. Список блюд в ячейке нельзя ни сравнить, ни посчитать, ни соединить с таблицей «Блюда» по коду. Каждое блюдо должно стать отдельной строкой.',
  });
}
{
  const steps = ['предметная область', 'атрибуты', 'ключи', 'связи', 'нормальные формы'];
  if (steps.length !== 5) throw new Error('шаги проектирования');
  const opts = [
    'С определения предметной области: какие сущности есть — ученики, блюда, поставки',
    'С написания запросов, которые понадобятся',
    'С создания всех таблиц и ввода данных',
    'С выбора программы для работы с базой данных',
  ];
  sc('db', {
    topic: DBT, d: 'intermediate', cog: 'apply', lesson: '11db-01-databases', subj: 'inf-11-db-design',
    sub: 'Шаги проектирования',
    prompt: 'С чего начинают проектирование многотабличной базы данных для школьной столовой?',
    opts, correctText: opts[0],
    why: `Порядок проектирования такой: ${steps.join(' → ')}. Начать с запросов — значит проектировать вслепую: непонятно, какие сущности вообще нужны и какие у них атрибуты. Сначала предметная область, потом ключи и связи, и только в конце приведение таблиц к нормальным формам.`,
  });
}
{
  const rows = [
    ['Иванов', 'Борщ'], ['Иванов', 'Борщ'], ['Петров', 'Каша'],
    ['Петров', 'Компот'], ['Сидорова', 'Борщ'], ['Сидорова', 'Борщ'],
  ];
  const sol = `rows = [
    ('Иванов', 'Борщ'),
    ('Иванов', 'Борщ'),
    ('Петров', 'Каша'),
    ('Петров', 'Компот'),
    ('Сидорова', 'Борщ'),
    ('Сидорова', 'Борщ'),
]
dishes = []
for _, name in rows:
    # название попадает в справочник только один раз
    if name not in dishes:
        dishes.append(name)
print(len(dishes), len(rows) - len(dishes))`;
  cr('db', {
    topic: DBT, d: 'advanced', cog: 'analyze', lesson: '11db-01-databases', subj: 'inf-11-db-normal',
    sub: 'Нормализация кодом',
    prompt: 'Даны строки одной таблицы столовой, где ученик и блюдо повторяются: [(Иванов, Борщ), (Иванов, Борщ), (Петров, Каша), (Петров, Компот), (Сидорова, Борщ), (Сидорова, Борщ)]. Вынесите блюда в отдельный справочник и выведите два числа через пробел: сколько строк окажется в справочнике «Блюда» (каждое различное название — одна строка) и на сколько строк придётся убрать из таблицы поставок.',
    template: `# Соберите справочник блюд и посчитайте повторы\nrows = [\n    ('Иванов', 'Борщ'),\n    ('Иванов', 'Борщ'),\n    ('Петров', 'Каша'),\n    ('Петров', 'Компот'),\n    ('Сидорова', 'Борщ'),\n    ('Сидорова', 'Борщ'),\n]\ndishes = []\nfor _, name in rows:\n    # название попадает в справочник только один раз\n    ...\nprint(len(dishes), len(rows) - len(dishes))`,
    solution: sol,
    why: `В справочнике окажется 3 строки: Борщ, Каша и Компот. Строк с повторяющимся названием — ${rows.length} − 3 = 3: именно столько копий сведений о блюде исчезнет из таблицы поставок, где останется только код. Важно: сами записи о питании при этом не пропадают — пропадает только повтор названия.`,
  });
}

// ── КТП 8 | 11db-02-queries | работа с готовой базой: запросы (7) ──
{
  const opts = [
    "WHERE название LIKE 'К%'",
    "WHERE название LIKE '%К'",
    "WHERE название = 'К'",
    "WHERE название LIKE '*К'",
  ];
  sc('db', {
    topic: DBT, d: 'basic', cog: 'apply', lesson: '11db-02-queries', subj: 'inf-11-db-sql',
    sub: 'Поиск по образцу LIKE',
    prompt: 'Нужно вывести все блюда, название которых начинается с буквы «К». Какое условие подойдёт?',
    opts, correctText: opts[0],
    why: 'В условии LIKE символ % означает любую последовательность символов, поэтому \'К%\' ищет слова, начинающиеся с К. Звёздочка в SQL не используется, а точное равенство требует полного совпадения строки, то есть названия из одной буквы.',
  });
}
{
  const bluda = [
    [1, 'Борщ', 250], [2, 'Котлета', 320], [3, 'Каша', 180], [4, 'Компот', 90], [5, 'Салат', 210],
  ];
  const hit = bluda.filter((r) => r[2] > 150);
  const avg = sum(hit.map((r) => r[2])) / hit.length;
  if (avg !== 240 || hit.length !== 4) throw new Error(`AVG: ${avg}`);
  num('db', {
    topic: DBT, d: 'intermediate', cog: 'apply', lesson: '11db-02-queries', subj: 'inf-11-db-sql',
    sub: 'Среднее по условию',
    prompt: `Таблица «Блюда» (№, название, калорийность): ${bluda.map((r) => `${r[0]} ${r[1]} ${r[2]}`).join('; ')}. Чему равен результат запроса SELECT AVG(калорийность) FROM Блюда WHERE калорийность > 150? Запишите только число.`,
    value: avg,
    why: `Условие оставляет строки ${hit.map((r) => r[1]).join(', ')}: Компот со 90 отпадает. Их сумма ${sum(hit.map((r) => r[2]))} делится на ${hit.length} строки и даёт ${avg}. Важен порядок: сначала WHERE отбирает строки, и только потом AVG считает среднее по отобранным.`,
  });
}
{
  const names = ['Борщ', 'Каша', 'Компот', 'Котлета', 'Салат', 'Кисель'];
  const sol = `names = ['Борщ', 'Каша', 'Компот', 'Котлета', 'Салат', 'Кисель']
found = []
for name in names:
    # условие поиска по образцу: название начинается с буквы К
    if name.startswith('К'):
        found.append(name)
for name in found:
    print(name)
print(len(found))`;
  cr('db', {
    topic: DBT, d: 'advanced', cog: 'apply', lesson: '11db-02-queries', subj: 'inf-11-db-sql',
    sub: 'Поиск по образцу кодом',
    prompt: 'Список названий блюд: [' + names.map((n) => `'${n}'`).join(', ') + ']. Выберите все названия, начинающиеся с буквы «К» (как условие LIKE \'К%\'), и выведите их в исходном порядке, каждое с новой строки. На последней строке выведите количество найденных названий.',
    template: `# Отберите названия, начинающиеся с буквы К\nnames = ['Борщ', 'Каша', 'Компот', 'Котлета', 'Салат', 'Кисель']\nfound = []\nfor name in names:\n    # проверяем первый символ названия\n    ...\nfor name in found:\n    print(name)\nprint(len(found))`,
    solution: sol,
    why: 'Условие LIKE \'К%\' в базе и проверка первого символа в программе делают одно и то же: оставляют только те строки, которые начинаются с нужной буквы. Порядок найденных строк сохраняется — как и при обычном запросе без сортировки. Такой же отбор даёт фильтр в LibreOffice Calc.',
  });
}

// ═════════════ ДОПИС ПО tmp/need-11.txt · КТП 10–19 · алгоритмы ═════════════

// ── КТП 10 | 11algo-02-debug | этапы решения и отладка (3) ──
{
  const opts = [
    'Деление на ноль: программа завершится с ошибкой',
    'Программа выведет 0: это правильный ответ для пустого набора',
    'Программа выведет 1: количество элементов заменяют единицей',
    'Ошибки не будет: цикл просто не выполнится',
  ];
  sc('algo', {
    topic: STR, d: 'basic', cog: 'apply', lesson: '11algo-02-debug', subj: 'inf-11-algo-debug',
    sub: 'Пустой массив',
    prompt: 'Программа находит среднее: сумму элементов делит на их количество. Какую проверку нужно обязательно выполнить?',
    opts, correctText: opts[0],
    why: 'Количество элементов пустого списка равно нулю, поэтому получается деление на ноль и программа падает. Пустой набор — одно из граничных значений, которые проверяют всегда, наряду с одним элементом, нулём и максимумом диапазона.',
  });
}
{
  const opts = [
    'for i in range(n): число повторений задано заранее',
    'while: он всегда выполняется заданное число раз',
    'Никакого: список приходится обходить вручную',
    'Оба цикла равноценны, разницы нет',
  ];
  sc('algo', {
    topic: STR, d: 'intermediate', cog: 'apply', lesson: '11algo-02-debug', subj: 'inf-11-algo-debug',
    sub: 'Выбор цикла',
    prompt: 'Нужно обработать все элементы списка, и их количество известно заранее. Какой цикл удобнее?',
    opts, correctText: opts[0],
    why: 'range задаёт число повторений сам, поэтому тело выполнится ровно n раз и лишней проверки не будет. Цикл while работает, пока условие истинно, и без границы может не остановиться: счётчик придётся заводить вручную.',
  });
}
{
  const sol = `tests = [[1], [], [5, 3, 9], [-2, -7]]
expected = [1, 0, 9, -2]


def max_value(a):
    # пустой список обрабатываем отдельно, иначе будет ошибка
    if len(a) == 0:
        return 0
    best = a[0]
    for x in a:
        if x > best:
            best = x
    return best


ok = 0
for i in range(len(tests)):
    if max_value(tests[i]) == expected[i]:
        ok = ok + 1
print(ok, max_value([-2, -7]))`;
  cr('algo', {
    topic: STR, d: 'advanced', cog: 'analyze', lesson: '11algo-02-debug', subj: 'inf-11-algo-debug',
    sub: 'Тесты граничных значений',
    prompt: 'Напишите функцию max_value(a), которая возвращает наибольший элемент списка, а для пустого списка возвращает 0. Проверьте её на четырёх наборах: [1], [], [5, 3, 9], [-2, -7] с ожидаемыми результатами 1, 0, 9, −2. Выведите сначала количество наборов, на которых результат совпал с ожидаемым, затем через пробел результат для набора [-2, -7].',
    template: `# Напишите функцию и проверьте её на четырёх наборах\ntests = [[1], [], [5, 3, 9], [-2, -7]]\nexpected = [1, 0, 9, -2]\n\n\ndef max_value(a):\n    # пустой список обрабатываем отдельно\n    ...\n\n\nok = 0\nfor i in range(len(tests)):\n    # сравниваем результат с ожидаемым\n    ...\nprint(ok, max_value([-2, -7]))`,
    solution: sol,
    why: 'Проверка даёт 4 из 4: пустой список отработал как 0, а максимум в списке из отрицательных чисел равен −2, а не 0. Ошибка была бы именно здесь — если начать с best = 0, то для [-2, -7] ответом станет 0. Граничные тесты ловят такие случаи до того, как программу увидят пользователи.',
  });
}

// ── КТП 11 | 11algo-03-digits | обработка цифр числа (1) ──
{
  const n = 9575, p = 12;
  const rem = n % p;
  if (rem !== 11) throw new Error(`остаток: ${rem}`);
  num('algo', {
    topic: STR, d: 'basic', cog: 'apply', lesson: '11algo-03-digits', subj: 'inf-11-algo-digits',
    sub: 'Остаток при делении на основание',
    prompt: `Цифры числа в системе счисления с основанием ${p} получают последовательным делением с остатком. Чему равен остаток ${n} % ${p}? Запишите только число.`,
    value: rem,
    why: `${p} · 797 = 9564, поэтому ${n} − 9564 = ${rem}. Так как основание больше 10, в записи числа появится цифра со значением ${rem} — в системе с основанием 16 такие цифры обозначают буквами A–F, и обычным сложением их не получить.`,
  });
}

// ── КТП 12 | 11algo-04-sequence | обработка последовательности (1) ──
{
  const a = [2, 5, 8, 11, 14];
  const sol = `a = [2, 5, 8, 11, 14]
s = 0
for x in a:
    s = s + x
first = a[0]
last = a[len(a) - 1]
n = len(a)
# сумма арифметической прогрессии по формуле
formula = (first + last) * n // 2
print(s, formula)
print(s == formula)`;
  cr('algo', {
    topic: STR, d: 'advanced', cog: 'analyze', lesson: '11algo-04-sequence', subj: 'inf-11-algo-seq',
    sub: 'Формула против цикла',
    prompt: 'Последовательность a = [2, 5, 8, 11, 14] — арифметическая прогрессия. Посчитайте её сумму двумя способами: обычным циклом и по формуле S = (a₁ + aₙ) · n / 2. Выведите обе суммы через пробел, а на новой строке — True, если они совпали, и False иначе.',
    template: `# Сравните сумму по циклу и по формуле\na = [2, 5, 8, 11, 14]\ns = 0\nfor x in a:\n    # суммируем элементы\n    ...\nfirst = a[0]\nlast = a[len(a) - 1]\nn = len(a)\n# сумма арифметической прогрессии по формуле\n...\nprint(s, formula)\nprint(s == formula)`,
    solution: sol,
    why: `Цикл даёт 40, формула тоже даёт 40: (2 + 14) · 5 / 2 = 40. Формула работает только для арифметической прогрессии, а прямой подсчёт — для любой последовательности, поэтому в программе надёжнее цикл, а формула удобна для проверки.`,
  });
}

// ── КТП 13 | 11algo-05-enumeration | метод перебора (1) ──
{
  const n = 14;
  const subsets = 2 ** n;
  if (subsets !== 16384) throw new Error(`подмножества: ${subsets}`);
  num('algo', {
    topic: STR, d: 'basic', cog: 'apply', lesson: '11algo-05-enumeration', subj: 'inf-11-algo-enum',
    sub: 'Число подмножеств',
    prompt: `Перебирают все подмножества множества из ${n} элементов. Сколько проверок выполнит цикл? Запишите только число.`,
    value: subsets,
    why: `Число подмножеств множества из n элементов равно 2ⁿ: каждый элемент либо входит в подмножество, либо нет. Для n = ${n} это 2^${n} = ${subsets} проверок. Рост показателен: для 10 элементов их всего 1024, а для 20 — уже около миллиона, поэтому перебор подмножеств годится только для малых n.`,
  });
}

// ── КТП 14 | 11algo-06-sorting | алгоритмы сортировки (5) ──
{
  const opts = [
    'Массив уже отсортирован: цикл можно досрочно остановить',
    'Программа ошиблась: за проход обмены должны быть обязательно',
    'Нужно начать проход заново с первого элемента',
    'Ничего: проходы всё равно идут до самого конца',
  ];
  sc('algo', {
    topic: STR, d: 'basic', cog: 'apply', lesson: '11algo-06-sorting', subj: 'inf-11-algo-sort',
    sub: 'Досрочная остановка',
    prompt: 'В пузырьковой сортировке за один проход не было ни одного обмена. Что это означает?',
    opts, correctText: opts[0],
    why: 'Если за проход ничего не поменялось, элементы уже стоят в нужном порядке, и следующий проход тоже ничего не изменит. На почти отсортированных данных эта проверка делает сортировку намного быстрее, поэтому условие выхода добавляют почти всегда.',
  });
}
{
  const n = 1000;
  const quick = Math.round(Math.log2(n)) * n;
  const sel = (n * (n - 1)) / 2;
  if (quick !== 10000) throw new Error(`быстрая: ${quick}`);
  num('algo', {
    topic: STR, d: 'intermediate', cog: 'apply', lesson: '11algo-06-sorting', subj: 'inf-11-algo-sort',
    sub: 'Быстрая сортировка',
    prompt: `Быстрая сортировка в среднем выполняет примерно n · log₂ n сравнений. Сколько сравнений это примерно даст для списка из ${n} элементов? Запишите только число.`,
    value: quick,
    why: `log₂ ${n} ≈ 10, поэтому получаем ${n} · 10 = ${quick} сравнений. Сортировка выбором на том же наборе всегда делает n(n − 1)/2 = ${sel} сравнений — почти в ${Math.round(sel / quick)} раз больше. Именно поэтому большие массивы сортируют быстрой сортировкой или слиянием.`,
  });
}
{
  const a = [1, 3, 2, 5, 4];
  const sol = `a = [1, 3, 2, 5, 4]
n = len(a)
passes = 0
done = False
while not done:
    # за один проход наибольший элемент остатка "всплывает" в конец
    changed = False
    for i in range(0, n - 1):
        if a[i] > a[i + 1]:
            a[i], a[i + 1] = a[i + 1], a[i]
            changed = True
    passes = passes + 1
    if not changed:
        done = True
print(*a)
print(passes)`;
  cr('algo', {
    topic: STR, d: 'advanced', cog: 'analyze', lesson: '11algo-06-sorting', subj: 'inf-11-algo-sort',
    sub: 'Пузырьковая с проходами',
    prompt: `Отсортируйте список ${JSON.stringify(a)} пузырьковой сортировкой, считая каждый проход. Если за проход не было ни одного обмена, сортировку остановить. Выведите сначала отсортированный список через пробел, затем на новой строке — число выполненных проходов.`,
    template: `# Сортировка пузырьком с досрочным выходом\na = [1, 3, 2, 5, 4]\nn = len(a)\npasses = 0\ndone = False\nwhile not done:\n    # сравниваем соседние элементы и меняем их местами\n    ...\nprint(*a)\nprint(passes)`,
    solution: sol,
    why: 'Первый проход ставит на место 5, второй — 4, а третий уже ничего не меняет, поэтому цикл завершается после ${2 + 1} проходов. Флаг changed как раз и реализует досрочный выход: без него программа гоняла бы пустые проходы до конца списка.',
  });
}

// ── КТП 15 | 11algo-07-matrix | двумерные массивы (5) ──
{
  const opts = [
    'Все строки станут ссылками на один список: изменение одной затронет все',
    'Так матрица получится прямоугольной, а не квадратной',
    'Списки в Python нельзя умножать',
    'Ничего: так программа работает даже быстрее',
  ];
  sc('algo', {
    topic: STR, d: 'basic', cog: 'remember', lesson: '11algo-07-matrix', subj: 'inf-11-algo-matrix',
    sub: 'Создание матрицы',
    prompt: 'Почему нельзя создавать матрицу строк так: a = [[0] * m] * n?',
    opts, correctText: opts[0],
    why: 'Список создаётся один раз, а умножение даёт n ссылок на него же — все «строки» окажутся одним и тем же списком. Правильно — [[0] * m for _ in range(n)]: на каждой строке создаётся свой список, и строки можно менять независимо.',
  });
}
{
  const m = [
    [3, -2, 0],
    [7, -5, 1],
    [0, 4, -8],
  ];
  const pos = countIf(m.flat(), (v) => v > 0);
  if (pos !== 4) throw new Error(`положительных: ${pos}`);
  num('algo', {
    topic: STR, d: 'intermediate', cog: 'apply', lesson: '11algo-07-matrix', subj: 'inf-11-algo-matrix',
    sub: 'Количество положительных',
    prompt: `Матрица 3 × 3:\n${m.map((r) => r.join(' ')).join('\n')}\nСколько в ней положительных элементов? Запишите только число.`,
    value: pos,
    why: `Положительные элементы — ${m.flat().filter((v) => v > 0).join(', ')}: их ${pos}. Ноль не считается ни положительным, ни отрицательным, потому что проверка a[i][j] > 0 для нуля даёт False. Счётчик увеличивают только внутри условия, обходя матрицу двойным циклом.`,
  });
}
{
  const m = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];
  const sol = `a = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
n = len(a)
m = len(a[0])
# каждую строку создаём отдельно, иначе все строки будут одним списком
b = [[0] * m for _ in range(n)]
for i in range(n):
    for j in range(m):
        # меняем местами индексы строки и столбца
        b[j][i] = a[i][j]
for i in range(n):
    print(*b[i])`;
  cr('algo', {
    topic: STR, d: 'advanced', cog: 'analyze', lesson: '11algo-07-matrix', subj: 'inf-11-algo-matrix',
    sub: 'Транспонирование',
    prompt: 'Дана матрица a = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]. Постройте транспонированную матрицу: элемент строки i и столбца j переходит на место строки j и столбца i. Выведите новую матрицу построчно, элементы через пробел.',
    template: `# Транспонируйте матрицу\na = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]\nn = len(a)\nm = len(a[0])\nb = [[0] * m for _ in range(n)]\nfor i in range(n):\n    for j in range(m):\n        # меняем местами индексы строки и столбца\n        ...\nfor i in range(n):\n    print(*b[i])`,
    solution: sol,
    why: 'Транспонирование — это просто обмен индексов: b[j][i] = a[i][j]. Матрица 1 2 3 / 4 5 6 / 7 8 9 превращается в 1 4 7 / 2 5 8 / 3 6 9. Новую матрицу обязательно создают списком для каждой строки отдельно: общий список строк даст ошибку из-за ссылок на одни и те же данные.',
  });
}

// ── КТП 16 | 11algo-08-strings | инструменты обработки строк (3) ──
{
  const word = 'информатика';
  const cut = word.slice(1, 3);
  if (cut !== 'нф') throw new Error(`срез: ${cut}`);
  const opts = [
    `'${cut}' — символы с индексами 1 и 2`,
    "'инф' — символы с индексами 1, 2 и 3",
    "'форматика' — всё, кроме первого символа",
    "'инфо' — первые четыре символа",
  ];
  sc('algo', {
    topic: STR, d: 'basic', cog: 'apply', lesson: '11algo-08-strings', subj: 'inf-11-algo-strings',
    sub: 'Срез строки',
    prompt: `Что вернёт выражение '${word}'[1:3]?`,
    opts, correctText: opts[0],
    why: `Срез s[a:b] берёт символы с индекса a по b − 1: правая граница не включается. В слове «${word}» это буквы «${cut}» — всего ${cut.length} символа. Ошибка «включить правую границу» — самая частая при работе со срезами.`,
  });
}
{
  const code = 'ё'.codePointAt(0);
  if (code !== 1105) throw new Error(`ord('ё'): ${code}`);
  num('algo', {
    topic: STR, d: 'intermediate', cog: 'apply', lesson: '11algo-08-strings', subj: 'inf-11-algo-strings',
    sub: 'Коды символов',
    prompt: 'Функция ord() возвращает код символа в таблице Unicode. Чему равен код русской буквы «ё»? Запишите только число.',
    value: code,
    why: `ord('ё') даёт ${code} — это номер символа в таблице Unicode. Именно по таким кодам Python сравнивает строки, поэтому «А» и «а» считаются разными символами, а сортировка букв идёт по кодам, а не по алфавиту, принятому в школе.`,
  });
}
{
  const words = ['яблоко', 'Абрикос', 'банан', 'Вишня', 'айва'];
  const sol = `words = ['яблоко', 'Абрикос', 'банан', 'Вишня', 'айва']
# строки сравниваются посимвольно по кодам, поэтому регистр важен
words.sort()
print(*words)
longest = 0
for w in words:
    if len(w) > longest:
        longest = len(w)
print(longest)`;
  cr('algo', {
    topic: STR, d: 'advanced', cog: 'analyze', lesson: '11algo-08-strings', subj: 'inf-11-algo-strings',
    sub: 'Сравнение строк по кодам',
    prompt: `Отсортируйте список слов ${JSON.stringify(words)} обычным сравнением строк (посимвольно по кодам символов) и выведите их через пробел в одну строку. На новой строке выведите длину самого длинного слова.`,
    template: `# Отсортируйте слова и найдите самое длинное\nwords = ['яблоко', 'Абрикос', 'банан', 'Вишня', 'айва']\n# сравнение строк идёт по кодам символов\nwords.sort()\nprint(*words)\nlongest = 0\nfor w in words:\n    # ищем самое длинное слово\n    ...\nprint(longest)`,
    solution: sol,
    why: 'Сортировка вышла в порядке кодов: сначала заглавные «Абрикос» и «Вишня», затем строчные «айва», «банан», «яблоко» — регистр в сравнении участвует. Самое длинное слово — «яблоко», в нём 6 символов. Если нужен порядок без учёта регистра, сравнивают строки, переведённые в lower().',
  });
}

// ── КТП 17 | 11algo-09-text-edit | редактирование текста (3) ──
{
  const opts = [
    'Нет: строки неизменяемы, а replace возвращает новую строку, её нужно присвоить',
    'Да: replace изменяет строку на месте',
    'Да, но только в Python 3',
    'Нет, но строка превратится в новую, а старая останется в памяти программиста',
  ];
  sc('algo', {
    topic: STR, d: 'basic', cog: 'apply', lesson: '11algo-09-text-edit', subj: 'inf-11-algo-text',
    sub: 'Результат replace',
    prompt: "В программе записано: s = 'a-b'; s.replace('-', '+'). Изменится ли строка s?",
    opts, correctText: opts[0],
    why: "В Python строки неизменяемы: replace создаёт новый объект, а исходная строка остаётся прежней. Правильно писать s = s.replace('-', '+'). Забыть присваивание — самая частая ошибка при редактировании текста, и снаружи она выглядит как «программа ничего не сделала».",
  });
}
{
  const word = 'барабан';
  const positions = [];
  for (let i = 0; i < word.length; i++) if (word[i] === 'а') positions.push(i);
  if (positions.join(',') !== '1,3,5') throw new Error(`позиции: ${positions}`);
  num('algo', {
    topic: STR, d: 'intermediate', cog: 'apply', lesson: '11algo-09-text-edit', subj: 'inf-11-algo-text',
    sub: 'Поиск вхождений',
    prompt: `В слове «${word}» найдите позицию второго вхождения буквы «а» (индексы считаются с нуля). Запишите только число.`,
    value: positions[1],
    why: `Проходим строку слева направо: б (0), а (${positions[0]}) — первое вхождение, р (2), а (${positions[1]}) — второе, затем а (${positions[2]}) — третье. Второе вхождение стоит на индексе ${positions[1]}. Цикл ведут по индексам от 0 до len(s) − 1 и запоминают позиции в отдельном списке.`,
  });
}
{
  const word = 'информатика';
  const position = word.indexOf('мат');
  if (position !== 5) throw new Error(`позиция «мат»: ${position}`);
  num('algo', {
    topic: STR, d: 'advanced', cog: 'analyze', lesson: '11algo-09-text-edit', subj: 'inf-11-algo-text',
    sub: 'Смещение после вставки',
    prompt: `В слове «${word}» нашли позицию первого вхождения подстроки «мат» — она равна ${position}. Затем вставили букву «о» сразу после найденной подстроки. На какой позиции окажется первый символ вставленной буквы? Индексы считаются с нуля. Запишите только число.`,
    value: position + 3,
    why: `Подстрока «мат» занимает позиции ${position}, ${position + 1} и ${position + 2}, то есть ${3} символа. Вставка сдвигает всё, что стоит правее, на длину вставки, поэтому «о» займёт позицию ${position} + 3 = ${position + 3}.`,
  });
}

// ── КТП 19 | 11algo-11-complexity | оценка сложности (3) ──
{
  const n = 1000;
  const steps = Math.floor(Math.log2(n)) + 1;
  if (steps !== 10) throw new Error(`бинарный поиск: ${steps}`);
  num('algo', {
    topic: STR, d: 'basic', cog: 'apply', lesson: '11algo-11-complexity', subj: 'inf-11-algo-complex',
    sub: 'Бинарный поиск',
    prompt: `Бинарный поиск в отсортированном массиве работает за O(log n) сравнений. Сколько сравнений понадобится в худшем случае для массива из ${n} элементов? Запишите только число.`,
    value: steps,
    why: `Каждое сравнение уменьшает диапазон вдвое: ${n} → 500 → 250 → … После ${steps} сравнений в диапазоне остаётся меньше одного элемента, поэтому ответ ⌊log₂ ${n}⌋ + 1 = ${steps}. Линейный поиск на том же массиве потребовал бы до ${n} сравнений.`,
  });
}
{
  const opts = [
    'Результат может оказаться неверным: алгоритм отбрасывает половину диапазона, опираясь на порядок элементов',
    'Ничего страшного: бинарный поиск найдёт элемент в любом массиве',
    'Программа сразу завершится с ошибкой',
    'Результат будет верным, но времени уйдёт заметно больше',
  ];
  sc('algo', {
    topic: STR, d: 'intermediate', cog: 'analyze', lesson: '11algo-11-complexity', subj: 'inf-11-algo-complex',
    sub: 'Бинарный поиск без сортировки',
    prompt: 'Массив не отсортирован, но решено применить к нему бинарный поиск. Что произойдёт?',
    opts, correctText: opts[0],
    why: 'Бинарный поиск сравнивает элемент с серединой и отбрасывает половину диапазона — это верно только для упорядоченных данных. На неотсортированном массиве нужный элемент может попасть в отброшенную половину и потеряться, поэтому сначала сортируют данные, а потом ищут ими.',
  });
}
{
  const sol = `a = list(range(1, 1001))
target = 1000
# линейный поиск: просматриваем элементы подряд
linear = 0
for x in a:
    linear = linear + 1
    if x == target:
        break
# бинарный поиск: делим диапазон пополам
left = 0
right = len(a) - 1
binary = 0
while left <= right:
    middle = (left + right) // 2
    binary = binary + 1
    if a[middle] == target:
        break
    if a[middle] < target:
        left = middle + 1
    else:
        right = middle - 1
print(linear, binary)`;
  cr('algo', {
    topic: STR, d: 'advanced', cog: 'analyze', lesson: '11algo-11-complexity', subj: 'inf-11-algo-complex',
    sub: 'Линейный и бинарный поиск',
    prompt: 'В отсортированном списке от 1 до 1000 найдите число 1000 дважды: линейным поиском и бинарным. Считайте сравнения в обоих случаях и выведите их через пробел: сначала число сравнений линейного поиска, затем бинарного.',
    template: `# Сравните линейный и бинарный поиск\n a = list(range(1, 1001))\ntarget = 1000\nlinear = 0\nfor x in a:\n    # линейный поиск: идём подряд\n    ...\nleft = 0\nright = len(a) - 1\nbinary = 0\nwhile left <= right:\n    # бинарный поиск: смотрим в середину диапазона\n    ...\nprint(linear, binary)`,
    solution: sol,
    why: 'Число 1000 стоит последним, поэтому линейный поиск просмотрел весь массив — это 1000 сравнений, рост O(n). Бинарный поиск урезает диапазон вдвое и уложился в 10 сравнений, рост O(log n). Плата за это — предварительная сортировка, которая не бесплатна.',
  });
}

// ═════════════ ДОПИС ПО tmp/need-11.txt · КТП 21–24 · графы и игры ═════════════

/** Расстояния от вершины в дереве (каждое ребро весит 1). */
function treeDistances(edges, from) {
  const adj = {};
  for (const [u, v] of edges) {
    (adj[u] ??= []).push(v);
    (adj[v] ??= []).push(u);
  }
  const dist = { [from]: 0 };
  const queue = [from];
  while (queue.length) {
    const v = queue.shift();
    for (const u of adj[v] ?? []) {
      if (dist[u] !== undefined) continue;
      dist[u] = dist[v] + 1;
      queue.push(u);
    }
  }
  return dist;
}

/** Диаметр дерева: наибольшее расстояние между двумя вершинами по числу рёбер. */
function treeDiameter(edges) {
  const vertices = [...new Set(edges.flat())];
  let best = 0;
  for (const v of vertices) {
    for (const d of Object.values(treeDistances(edges, v))) best = Math.max(best, d);
  }
  return best;
}

/** Алгоритм Дейкстры в JavaScript — сверка с эталоном на Python. */
function dijkstra(nodes, adjW, from) {
  const dist = {};
  for (const n of nodes) dist[n] = Infinity;
  const used = new Set();
  dist[from] = 0;
  while (used.size < nodes.length) {
    let cur = null;
    for (const n of nodes) if (!used.has(n) && (cur === null || dist[n] < dist[cur])) cur = n;
    used.add(cur);
    for (const [u, w] of adjW[cur] ?? []) dist[u] = Math.min(dist[u], dist[cur] + w);
  }
  return dist;
}

/** Листья дерева игры: сколько законченных партий (разбиений суммы ходами). */
function gameLeaves(start, moves) {
  const go = (s) => (s === 0 ? 1 : sum(moves.filter((k) => k <= s).map((k) => go(s - k))));
  return go(start);
}

// ── КТП 21 | 11graph-01-graphs | графы и деревья (8) ──
{
  const opts = [
    'Убрать любое ребро: связный граф распадётся на две части',
    'Посчитать вершины и рёбра: их количества должны совпадать',
    'Проверить, что у каждой вершины ровно два ребра',
    'Нарисовать граф и посмотреть на него глазами',
  ];
  sc('graph', {
    topic: GRF, d: 'basic', cog: 'apply', lesson: '11graph-01-graphs', subj: 'inf-11-graph-tree',
    sub: 'Проверка дерева',
    prompt: 'Как проверить, что связный граф без циклов является деревом, не выписывая все пути?',
    opts, correctText: opts[0],
    why: 'В дереве между любыми двумя вершинами ровно один простой путь, поэтому удаление любого ребра разъединяет граф. Обратная проверка: добавление любого ребра создаёт цикл. Число рёбер на одно меньше, чем вершин, — не признак дерева, а следствие: сравнивать надо с единицей, а не искать равенство.',
  });
}
{
  const opts = [
    'Нет: граф несвязный, он распадается на две части A–B и C–D',
    'Да: циклов нет, значит это дерево',
    'Да: рёбер меньше, чем вершин',
    'Нельзя определить, пока не нарисуешь граф',
  ];
  sc('graph', {
    topic: GRF, d: 'intermediate', cog: 'analyze', lesson: '11graph-01-graphs', subj: 'inf-11-graph-tree',
    sub: 'Связность графа',
    prompt: 'Граф состоит из четырёх вершин A, B, C, D и двух рёбер: A–B и C–D. Является ли он деревом?',
    opts, correctText: opts[0],
    why: 'Дерево должно быть связным: из любой вершины можно дойти до любой другой. Здесь из A не попасть в C, поэтому граф состоит из двух компонент связности и деревом не является. Проверять связность обязательно — отсутствие циклов само по себе недостаточно.',
  });
}
{
  const left = ['Схема метро', 'Файловая система', 'Граф родства', 'Интернет'];
  const right = ['страницы — вершины, гиперссылки — рёбра', 'станции — вершины, участки пути — рёбра', 'люди — вершины, родственные связи — рёбра', 'папки — вершины, вложенность — рёбра'];
  mt('graph', {
    topic: GRF, d: 'intermediate', cog: 'apply', lesson: '11graph-01-graphs', subj: 'inf-11-graph-bfs',
    sub: 'Граф вокруг нас',
    prompt: 'Установите соответствие: пример графа — что в нём вершины, а что рёбра.',
    left, right,
    map: {
      'Схема метро': right[1],
      'Файловая система': right[3],
      'Граф родства': right[2],
      'Интернет': right[0],
    },
    why: 'Граф — это любой набор вершин и связей между ними, поэтому важно правильно назначить вершины и рёбра. Ошибка частая: в схеме метро вершина — станция, а не участок пути, во вложенности папок ребро означает «лежит внутри», а в родословной — «является родственником».',
  });
}
{
  const edges = [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['C', 'F'], ['F', 'G']];
  const diam = treeDiameter(edges);
  if (diam !== 5) throw new Error(`диаметр: ${diam}`);
  const dist = treeDistances(edges, 'E');
  if (dist.G !== 5) throw new Error(`E→G: ${dist.G}`);
  num('graph', {
    topic: GRF, d: 'advanced', cog: 'analyze', lesson: '11graph-01-graphs', subj: 'inf-11-graph-tree',
    sub: 'Диаметр дерева',
    prompt: 'В дереве семь вершин и рёбра A–B, A–C, B–D, B–E, C–F, F–G. Диаметр дерева — наибольшее расстояние между двумя его вершинами по числу рёбер. Чему равен диаметр? Запишите только число.',
    value: diam,
    why: `Самые далькие вершины — E и G: путь E–B–A–C–F–G содержит ${diam} рёбер, и короче пути нет. Проверяют так: из каждой вершины запускают обход в ширину и берут наибольшее расстояние. В дереве путь между вершинами единственный, поэтому расстояние всегда считается однозначно.`,
  });
}
{
  const adj = { 1: [2, 3], 2: [4], 3: [2, 5], 4: [5], 5: [6], 6: [] };
  const sol = `adj = {1: [2, 3], 2: [4], 3: [2, 5], 4: [5], 5: [6], 6: []}
seen = []


def dfs(v):
    seen.append(v)
    for u in adj[v]:
        if u not in seen:
            dfs(u)


dfs(1)
print(*seen)`;
  cr('graph', {
    topic: GRF, d: 'advanced', cog: 'analyze', lesson: '11graph-01-graphs', subj: 'inf-11-graph-bfs',
    sub: 'Обход в глубину кодом',
    prompt: 'Граф задан списком смежности: 1 → 2, 3; 2 → 4; 3 → 2, 5; 4 → 5; 5 → 6; 6 → ничего. Выполните обход в глубину из вершины 1: идите по ветви до конца, возвращайтесь и только потом берите следующую, отмечая посещённые вершины. Выведите порядок посещения через пробел.',
    template: `# Допиши обход в глубину\nadj = {1: [2, 3], 2: [4], 3: [2, 5], 4: [5], 5: [6], 6: []}\nseen = []\n\n\ndef dfs(v):\n    # отмечаем вершину и идём по её соседям\n    ...\n\n\ndfs(1)\nprint(*seen)`,
    solution: sol,
    why: 'Обход идёт по ветви: 1 → 2 → 4 → 5 → 6, а уже потом возвращается и берёт 3 — получается 1 2 4 5 6 3. Обход в ширину на том же графе дал бы другой порядок: сначала все вершины на расстоянии 1. Отметки о посещении нужны и здесь, иначе рекурсия зациклится.',
  });
}

// ── КТП 22 | 11graph-02-paths | оптимальный путь и число путей (10) ──
{
  const opts = [
    'Ориентированный граф без циклов: следуя по рёбрам, вернуться в начальную вершину нельзя',
    'Ориентированный граф, у каждой вершины которого ровно одно входящее ребро',
    'Граф, у которого у вершины не больше одного ребра',
    'Любой ориентированный граф: проверять циклы не нужно',
  ];
  sc('graph', {
    topic: GRF, d: 'basic', cog: 'remember', lesson: '11graph-02-paths', subj: 'inf-11-graph-dag',
    sub: 'Ациклический ориентированный граф',
    prompt: 'Какой граф называют направленным ациклическим (DAG)?',
    opts, correctText: opts[0],
    why: 'Ацикличность нужна, чтобы считать пути накоплением: в топологическом порядке каждый предшественник посчитан раньше вершины. Если бы цикл существовал, вершины в нём зависели бы друг от друга и топологического порядка не существовало бы вовсе.',
  });
}
{
  const opts = [
    'Чтобы к моменту подсчёта вершины все её предшественники уже были посчитаны',
    'Чтобы вершины шли в порядке алфавита',
    'Чтобы иначе получились бы дробные числа',
    'Порядок не важен: результат от него не зависит',
  ];
  sc('graph', {
    topic: GRF, d: 'intermediate', cog: 'analyze', lesson: '11graph-02-paths', subj: 'inf-11-graph-dag',
    sub: 'Топологический порядок',
    prompt: 'Почему число путей в ациклическом графе считают именно в топологическом порядке?',
    opts, correctText: opts[0],
    why: 'Число путей в вершину — это сумма чисел путей во всех её предшественников, поэтому считать нужно только после них. Топологический порядок это гарантирует. Если считать «как попало», можно опереться на ещё не вычисленное значение и получить неверный ответ, причём ошибку заметить трудно.',
  });
}
{
  const adjW = {
    A: [['B', 4], ['C', 2]],
    B: [['D', 5]],
    C: [['B', 1], ['D', 8]],
    D: [],
  };
  const dist = dijkstra(['A', 'B', 'C', 'D'], adjW, 'A');
  if (dist.B !== 3 || dist.C !== 2 || dist.D !== 8) throw new Error(`Дейкстра: ${JSON.stringify(dist)}`);
  const sol = `INF = 10 ** 9
# граф: вершина -> список пар (сосед, вес)
graph = {
    'A': [('B', 4), ('C', 2)],
    'B': [('A', 4), ('D', 5)],
    'C': [('A', 2), ('B', 1), ('D', 8)],
    'D': [('B', 5), ('C', 8)],
}
dist = {'A': 0, 'B': INF, 'C': INF, 'D': INF}
used = set()
while len(used) < 4:
    # берём ещё не посещённую вершину с наименьшим расстоянием
    cur = None
    for v in ['A', 'B', 'C', 'D']:
        if v not in used and (cur is None or dist[v] < dist[cur]):
            cur = v
    used.add(cur)
    for u, w in graph[cur]:
        if dist[cur] + w < dist[u]:
            dist[u] = dist[cur] + w
print(dist['B'], dist['C'], dist['D'])`;
  cr('graph', {
    topic: GRF, d: 'advanced', cog: 'analyze', lesson: '11graph-02-paths', subj: 'inf-11-graph-weight',
    sub: 'Алгоритм Дейкстры',
    prompt: 'Дан взвешенный граф с неориентированными рёбрами: A–B = 4, A–C = 2, C–B = 1, B–D = 5, C–D = 8. Реализуйте алгоритм Дейкстры для вершины A: на каждом шаге выбирайте ещё не посещённую вершину с наименьшим найденным расстоянием и обновляйте расстояния до её соседей. Выведите через пробел расстояния от A до B, C и D в таком порядке.',
    template: `# Допиши алгоритм Дейкстры\nINF = 10 ** 9\ngraph = {\n    'A': [('B', 4), ('C', 2)],\n    'B': [('A', 4), ('D', 5)],\n    'C': [('A', 2), ('B', 1), ('D', 8)],\n    'D': [('B', 5), ('C', 8)],\n}\ndist = {'A': 0, 'B': INF, 'C': INF, 'D': INF}\nused = set()\nwhile len(used) < 4:\n    # выбираем вершину с наименьшим расстоянием и обновляем соседей\n    ...\nprint(dist['B'], dist['C'], dist['D'])`,
    solution: sol,
    why: `От A сразу посещается C (2), из неё — B со значением ${dist.B}, а уже потом D со значением ${dist.D}. Именно жадный выбор самой близкой ещё не посещённой вершины даёт правило Дейкстры: путь, который проходит через дальнюю вершину, не может оказаться короче уже найденного. Перебор всех путей на больших графах не годится — там нужен этот алгоритм.`,
  });
}

// ── КТП 23 | 11graph-02-games | дискретные игры двух игроков (6) ──
{
  const opts = [
    'Первый ход и ответ на любой ход соперника',
    'Только первый ход, ведущий в проигрышную позицию',
    'Только последний ход партии',
    'Набор правил игры без разбора позиций',
  ];
  sc('graph', {
    topic: GAM, d: 'basic', cog: 'remember', lesson: '11graph-02-games', subj: 'inf-11-graph-games',
    sub: 'Состав выигрышной стратегии',
    prompt: 'Что должно входить в описание выигрышной стратегии в дискретной игре двух игроков?',
    opts, correctText: opts[0],
    why: 'Стратегия — это план на всю партию, а не один удачный ход: найдя ход в проигрышную позицию, нужно ещё иметь ответ на любой ход соперника. Дерево игры показывает такой план наглядно, а таблица сжимает его до одной строки на позицию.',
  });
}
{
  const stones = 5;
  const leaves = gameLeaves(stones, [1, 2]);
  if (leaves !== 8) throw new Error(`партий из ${stones}: ${leaves}`);
  num('graph', {
    topic: GAM, d: 'intermediate', cog: 'apply', lesson: '11graph-02-games', subj: 'inf-11-graph-games',
    sub: 'Число партий',
    prompt: `В игре куча из ${stones} камней, за ход берут 1 или 2 камня, а партия заканчивается, когда камней не осталось. Сколько различных партий (листьев дерева игры) возможно? Запишите только число.`,
    value: leaves,
    why: `Партия — это любая последовательность из 1 и 2 с суммой ${stones}: 1+1+1+1+1, 1+1+1+2, 1+1+2+1, 1+2+1+1, 2+1+1+1, 1+2+2, 2+1+2, 2+2+1 — всего ${leaves}. Именно поэтому дерево растёт очень быстро, и стратегию удобнее описывать таблицей, а не строить целиком.`,
  });
}
{
  const win12 = loseTakeLast(10, [1, 2]);
  const lose12 = Object.entries(win12).filter(([k, v]) => !v && Number(k) > 0).map(([k]) => Number(k)).sort((a, b) => a - b);
  if (lose12.join(',') !== '1,4,7,10') throw new Error(`проигрышные: ${lose12}`);
  num('graph', {
    topic: GAM, d: 'intermediate', cog: 'analyze', lesson: '11graph-02-games', subj: 'inf-11-graph-games',
    sub: 'Разметка позиций',
    prompt: 'В игре из кучи камней за ход берут 1 или 2 камня, а проигрывает тот, кто взял последний камень. Позиции размечают от 1 вверх. Сколько проигрышных позиций среди 1, 2, …, 10? Запишите только число.',
    value: lose12.length,
    why: `Разметка снизу вверх даёт проигрышные позиции ${lose12.join(', ')} — их ${lose12.length}. Проверка: из 10 ходы ведут в 9 и 8, обе выигрышны, значит 10 проигрышная; из 7 ходы ведут в 6 и 5, и обе выигрышны. Ход, забирающий весь остаток камней, проигрывает сразу, поэтому в проверке его пропускают.`,
  });
}
{
  const opts = [
    'Сыграть несколько партий по правилам таблицы: против любого хода соперника должен быть ответ',
    'Достаточно того, что из стартовой позиции есть ход в проигрышную',
    'Нужно лишь посчитать число проигрышных позиций',
    'Никак: сама разметка таблицы уже доказывает всё',
  ];
  sc('graph', {
    topic: GAM, d: 'advanced', cog: 'analyze', lesson: '11graph-02-games', subj: 'inf-11-graph-games',
    sub: 'Проверка стратегии',
    prompt: 'Стратегия найдена по таблице игры. Как убедиться, что она действительно выигрышная?',
    opts, correctText: opts[0],
    why: 'Один выигрышный первый ход ещё не стратегия: соперник может ответить неожиданно. Проверка перебором партий показывает, что против любого ответа есть ход в проигрышную позицию, то есть стратегия работает при любой игре соперника. Именно эту проверку и просят на практической работе.',
  });
}
{
  const leaves = gameLeaves(4, [1, 2]);
  if (leaves !== 5) throw new Error(`листьев: ${leaves}`);
  const sol = `moves = [1, 2]
start = 4


def leaves(s):
    if s == 0:
        # куча опустела — это лист дерева игры
        return 1
    total = 0
    for k in moves:
        if k <= s:
            total = total + leaves(s - k)
    return total


print(leaves(start))`;
  cr('graph', {
    topic: GAM, d: 'advanced', cog: 'analyze', lesson: '11graph-02-games', subj: 'inf-11-graph-games',
    sub: 'Дерево игры кодом',
    prompt: 'Постройте дерево игры: куча из 4 камней, за ход берут 1 или 2 камня, партия заканчивается, когда камней не осталось. Лист дерева — законченная партия. Выведите число листьев дерева.',
    template: `# Посчитайте листья дерева игры\nmoves = [1, 2]\nstart = 4\n\n\ndef leaves(s):\n    if s == 0:\n        # куча опустела — это лист дерева\n        return 1\n    total = 0\n    for k in moves:\n        if k <= s:\n            # считаем партии для каждого хода\n            ...\n    return total\n\n\nprint(leaves(start))`,
    solution: sol,
    why: `Ответ ${leaves}: это партии 1+1+1+1, 1+1+2, 1+2+1, 2+1+1 и 2+2. Лист — это любая завершённая партия, поэтому считаем не «победы», а все партии. Такое дерево удобно для проверки стратегии: видно, сколько ответов нужно предусмотреть и какие позиции встречаются чаще всего.`,
  });
}

// ── КТП 24 | 11graph-03-table | выигрышная стратегия в таблице (8) ──
{
  const opts = [
    'Любой ход из этой позиции в позицию, помеченную L',
    'Самый длинный ход, который возможен из позиции',
    'Тот ход соперника, который нужно предусмотреть',
    'Ничего: все ходы и так перечислены в отдельных столбцах',
  ];
  sc('graph', {
    topic: GAM, d: 'basic', cog: 'apply', lesson: '11graph-03-table', subj: 'inf-11-graph-table',
    sub: 'Столбец «лучший ход»',
    prompt: 'В таблице стратегии есть столбец «лучший ход». Что в нём указывают?',
    opts, correctText: opts[0],
    why: 'Стратегия — всегда ходить в позицию L: соперник из L вынужден отдать W, и мы снова возвращаемся в L. Поэтому в столбце записывают конкретный ход, который оставляет сопернику проигрышную позицию, а если таких ходов несколько — любой из них.',
  });
}
{
  const pos = 18;
  const mark = GAME_WIN[pos] ? 'W' : 'L';
  const wins = winningMoves(pos, GAME_MOVES, GAME_WIN);
  if (mark !== 'W' || wins.join(',') !== '1,3') throw new Error(`${pos}: ${mark}/${wins}`);
  const opts = [
    `W: из неё можно взять ${wins.join(' или ')} камня и оставить сопернику проигрышную позицию ${pos - wins[0]} или ${pos - wins[1]}`,
    'L: любой ход из неё передаёт сопернику выигрышную позицию',
    'W: потому что 18 — чётное число камней',
    'Отметку поставить нельзя: позиция не терминальная',
  ];
  sc('graph', {
    topic: GAM, d: 'intermediate', cog: 'analyze', lesson: '11graph-03-table', subj: 'inf-11-graph-table',
    sub: 'Отметка позиции',
    prompt: `В игре берут ${GAME_MOVES.join(' или ')} камня, проигрывает взявший последний, разметка ведётся от меньших позиций к большим. Какой отметкой помечена позиция ${pos} камней?`,
    opts, correctText: opts[0],
    why: `В этой игре проигрышные позиции нечётные, поэтому и ${pos - wins[0]}, и ${pos - wins[1]} проигрышные, а из ${pos} можно взять ${wins.join(' или ')} камня и оставить одну из них. Значит ${pos} выигрышная (W). Сама чётность числа камней ничего не решает: важно только, есть ли ход в проигрышную позицию.`,
  });
}
{
  const left = ['Позиция', 'Отметка', 'Ходы', 'Лучший ход'];
  const right = ['число камней, из которого сделан ход', 'W или L для того, кто будет ходить', 'позиции, в которые ведут все ходы из этой позиции', 'ход, который оставляет сопернику позицию L'];
  mt('graph', {
    topic: GAM, d: 'advanced', cog: 'analyze', lesson: '11graph-03-table', subj: 'inf-11-graph-table',
    sub: 'Столбцы таблицы',
    prompt: 'Установите соответствие: столбец таблицы стратегии — что в нём записывают.',
    left, right,
    map: {
      'Позиция': right[0],
      'Отметка': right[1],
      'Ходы': right[2],
      'Лучший ход': right[3],
    },
    why: 'Таблица читается по столбцам: сначала позиция, затем её отметка W или L для того, кто будет ходить, затем — все позиции, в которые ведут ходы. Столбец «лучший ход» — практический вывод: какой ход оставляет сопернику проигрышную позицию.',
  });
}

// ═════════════ ДОПИС ПО tmp/need-11.txt · КТП 26–32 · сети и безопасность ═════════════

const SAF = 'Безопасность и ИИ';

/** Число адресов узлов в сети с указанной длиной маски (без адреса сети и широковещания). */
function hostCount(prefix) {
  return 2 ** (32 - prefix) - 2;
}

// ── КТП 26 | 11net-04-control | Интернет и доменные имена (4) ──
{
  const opts = [
    'Первые три октета задают адрес сети, четвёртый — номер узла',
    'Четвёртый октет задаёт адрес сети, остальные — номер узла',
    'Маска запрещает использовать в адресе нули',
    'Маска указывает, сколько узлов в сети ровно',
  ];
  sc('net', {
    topic: NET, d: 'basic', cog: 'apply', lesson: '11net-04-control', subj: 'inf-11-net-mask',
    sub: 'Что задаёт маска /24',
    prompt: 'Что означает маска подсети 255.255.255.0 (её же записывают как /24)?',
    opts, correctText: opts[0],
    why: 'В маске единицы отмечают разряды адреса сети, а нули — адреса узла. В 255.255.255.0 единиц ровно 24, поэтому сеть задают первые три октета, а номер узла — последнее число. Отсюда же берётся 254 доступных адреса узла в такой сети.',
  });
}
{
  const domain = 'www.example.ru';
  const levels = domain.split('.').length;
  if (levels !== 3) throw new Error(`уровней: ${levels}`);
  num('net', {
    topic: NET, d: 'intermediate', cog: 'apply', lesson: '11net-04-control', subj: 'inf-11-net-dns',
    sub: 'Уровни доменного имени',
    prompt: `Доменное имя записано как ${domain}. Сколько уровней оно содержит, если корневой уровень не считать? Запишите только число.`,
    value: levels,
    why: `Имя разбирается справа налево: ru — домен верхнего уровня, ${domain.split('.')[1]}.ru — домен второго уровня, ${domain} — третьего. Всего частей ${levels}, а корень не считают. DNS работает как телефонная книга: имя превращается в числовой IP-адрес.`,
  });
}
{
  const octets = [192, 168, 37, 15];
  const prefix = 24;
  const network = octets.slice(0, 3).concat(0).join('.');
  const host = hostCount(prefix);
  if (network !== '192.168.37.0' || host !== 254) throw new Error(`сеть: ${network}/${host}`);
  const opts = [
    `${network}: маска /24 отделяет первые 24 бита, поэтому номер узла обнуляется`,
    '192.168.0.0: так выглядит адрес сети при любой маске',
    `${octets.join('.')}: адрес узла и есть адрес сети`,
    '15.37.168.192: октеты записываются справа налево',
  ];
  sc('net', {
    topic: NET, d: 'advanced', cog: 'analyze', lesson: '11net-04-control', subj: 'inf-11-net-mask',
    sub: 'Адрес сети по маске',
    prompt: `Узел имеет адрес ${octets.join('.')}, маска сети /24. Каков адрес самой сети? В сети доступно ${host} адреса узла.`,
    opts, correctText: opts[0],
    why: `Маска /24 отделяет первые 24 бита адреса, поэтому три первых октета — адрес сети, а последнее число — номер узла в ней. Обнулив номер узла, получаем ${network}; по этой же причине в сети /24 доступно 254 адреса, а не 256.`,
  });
}

// ── КТП 27 | 11net-02-html | язык гипертекстовой разметки (4) ──
{
  const opts = [
    'В нём нет циклов и вычислений: он только размечает, где заголовок, абзац или картинка',
    'В нём нельзя вычислять, потому что нет команды печати',
    'Разметку выполняет браузер, поэтому язык не считается программированием',
    'В нём используются латинские буквы, а это не язык программирования',
  ];
  sc('net', {
    topic: NET, d: 'basic', cog: 'remember', lesson: '11net-02-html', subj: 'inf-11-net-html',
    sub: 'Разметка, а не программирование',
    prompt: 'Почему HTML называют языком разметки, а не языком программирования?',
    opts, correctText: opts[0],
    why: 'В HTML нет циклов, условий и вычислений — он задаёт структуру документа: вот заголовок, вот абзац, вот изображение. Логику на страницу добавляют языком программирования, который выполняется в браузере, а разметку пишет человек, и браузер только показывает результат.',
  });
}
{
  const opts = [
    'Значение надёжно не воспримется: без кавычек адрес закончится на первом пробеле и разметка станет непредсказуемой',
    'Ничего не произойдёт: кавычки в атрибутах не обязательны',
    'Ссылка откроется в новом окне браузера',
    'Браузер сам расставит кавычки и всё исправит',
  ];
  sc('net', {
    topic: NET, d: 'intermediate', cog: 'analyze', lesson: '11net-02-html', subj: 'inf-11-net-html',
    sub: 'Кавычки у значения атрибута',
    prompt: 'Ссылка записана так: <a href="https://school.ru/page">Курсы</a>. Что произойдёт, если убрать кавычки вокруг значения атрибута href?',
    opts, correctText: opts[0],
    why: 'Значения атрибутов пишут в кавычках — тогда пробелы и спецсимволы внутри значения не ломают разметку. Без кавычек значение заканчивается на первом пробеле, и адрес может получиться неверным: браузер не станет исправлять ошибку за автора.',
  });
}
{
  const opts = [
    'Теги заголовков задают структуру документа, а выделить текст внутри абзаца можно тегами <b> и <i>',
    'Ничего неверного: тег <h1> просто делает текст крупнее',
    'Тег <h1> можно использовать сколько угодно раз, ограничений нет',
    'Вместо <h1> нужно писать <title>',
  ];
  sc('net', {
    topic: NET, d: 'advanced', cog: 'analyze', lesson: '11net-02-html', subj: 'inf-11-net-html',
    sub: 'Структура против оформления',
    prompt: 'Верстальщик оформил каждый абзац текста тегом <h1>, чтобы выделить его. Что здесь неверно?',
    opts, correctText: opts[0],
    why: 'Теги h1–h6 описывают структуру документа: один главный заголовок и подзаголовки под ним. Их роль — навигация и доступность, а не оформление; выделение внутри абзаца делают тегами <b>, <i>, <u>. Иначе экранный диктор и поисковик увидят страницу из одних заголовков.',
  });
}

// ── КТП 28 | 11net-03-services | сервисы Интернета и цифровая культура (4) ──
{
  const opts = [
    'Нет: у открытого ресурса указаны автор, источник и подходящий уровень, по которым видно, что его можно использовать в обучении',
    'Да: материал доступен из интернета, значит он открытый',
    'Да, если материал написан на русском языке',
    'Нет, потому что открытые ресурсы бывают только зарубежные',
  ];
  sc('net', {
    topic: NET, d: 'basic', cog: 'apply', lesson: '11net-03-services', subj: 'inf-11-net-services',
    sub: 'Открытый образовательный ресурс',
    prompt: 'Материал по теме урока лежит в открытом интернете, на него может зайти любой человек. Обязательно ли это делает его открытым образовательным ресурсом?',
    opts, correctText: opts[0],
    why: 'Одна доступность ещё ничего не значит. Открытый образовательный ресурс — это материал, свободно доступный для обучения: у него указаны автор, источник и уровень сложности, а лицензия разрешает использование. Именно эти признаки проверяют при выборе материала.',
  });
}
{
  const opts = [
    'Потому что решения принимают по анализу данных: они дают выгоду тому, кто умеет их собирать и использовать',
    'Потому что данные можно продать как обычный товар',
    'Потому что данные занимают место на дисках и стоят денег',
    'Потому что данные не могут быть потеряны',
  ];
  sc('net', {
    topic: NET, d: 'intermediate', cog: 'analyze', lesson: '11net-03-services', subj: 'inf-11-net-service-econ',
    sub: 'Данные как актив',
    prompt: 'В цифровой экономике говорят, что данные — это актив. Почему?',
    opts, correctText: opts[0],
    why: 'Актив приносит пользу владельцу. Анализ продаж, логи и данные о клиентах позволяют принимать решения и сокращать издержки — в этом ценность данных. Одновременно их нужно защищать: утечка превращает актив в уязвимость, поэтому доступ к данным разграничивают.',
  });
}
{
  const left = ['Достоверность', 'Актуальность', 'Автор', 'Условия использования'];
  const right = ['есть ли разрешение на использование и платные функции', 'указан ли автор и организация', 'совпадают ли сведения с первоисточником', 'когда материал обновляли'];
  mt('net', {
    topic: NET, d: 'advanced', cog: 'analyze', lesson: '11net-03-services', subj: 'inf-11-net-service-eval',
    sub: 'Критерии оценки сервиса',
    prompt: 'Установите соответствие: критерий оценки интернет-ресурса — как его проверяют.',
    left, right,
    map: {
      'Достоверность': right[2],
      'Актуальность': right[3],
      'Автор': right[1],
      'Условия использования': right[0],
    },
    why: 'Оценка сервиса идёт по четырём критериям: правдивость, свежесть, авторство и законность использования. Одного «красивого сайта» мало — материал должен выдерживать проверку первоисточником и иметь понятные условия использования.',
  });
}

// ── КТП 29 | 11net-05-etiquette | сетевой этикет и поисковые запросы (4) ──
{
  const opts = [
    'Нет: написанное в сети может сохраниться и всплыть спустя годы — интернет не анонимен',
    'Да: после удаления сообщения следов не остаётся',
    'Да, если удалить все свои аккаунты и сообщения',
    'Нет, но только потому, что за грубость снижают оценку в школе',
  ];
  sc('net', {
    topic: NET, d: 'basic', cog: 'apply', lesson: '11net-05-etiquette', subj: 'inf-11-net-etiquette',
    sub: 'Интернет не анонимен',
    prompt: 'Ученик написал в комментарии резкую грубость и решил удалить сообщение. Достаточно ли этого?',
    opts, correctText: opts[0],
    why: 'Интернет не анонимен: скриншоты, архивы и чужие копии остаются, и написанное всплывает спустя годы. Сетевой этикет — это обычный этикет плюс понимание того, что запись сохраняется и влияет на репутацию человека и класса.',
  });
}
{
  const opts = [
    'Нет: сайты могли перепечатать один источник, поэтому подтверждать нужно независимые источники и первоисточник',
    'Да: пять сайтов — это уже большинство',
    'Да, если все пять сайтов доступны и работают',
    'Нет, потому что подтверждений должно быть ровно три',
  ];
  sc('net', {
    topic: NET, d: 'intermediate', cog: 'analyze', lesson: '11net-05-etiquette', subj: 'inf-11-net-fake',
    sub: 'Независимость источников',
    prompt: 'Пять сайтов повторяют одно и то же сообщение об опасности. Можно ли считать информацию достоверной, потому что её подтверждают пять источников?',
    opts, correctText: opts[0],
    why: 'Совпадение текстов не даёт независимости: сайты копируют друг друга, и все пять ссылаются на один первоисточник. Проверять надо автора, дату публикации, ссылку на первоисточник и то, подтверждают ли сведения независимые организации.',
  });
}
{
  const opts = [
    'Использовать её можно только с разрешения правообладателя либо как цитату с указанием источника',
    'Картинку из интернета можно использовать свободно: она опубликована в открытом доступе',
    'Достаточно уменьшить картинку и изменить её размер',
    'Достаточно написать в подписи слово «источник» без адреса',
  ];
  sc('net', {
    topic: NET, d: 'advanced', cog: 'analyze', lesson: '11net-05-etiquette', subj: 'inf-11-net-copyright',
    sub: 'Картинка из интернета',
    prompt: 'В свою работу ученик вставил картинку, найденную в интернете. Что верно?',
    opts, correctText: opts[0],
    why: 'Авторское право охраняет изображение независимо от того, что оно лежит в открытом интернете. Законный путь — разрешение правообладателя либо цитирование с указанием источника. Изменение размера или подпись без адреса авторства не делают использование законным.',
  });
}

// ── КТП 30 | 11safe-01-security | защита информации и ЭП (1) ──
{
  const opts = [
    'Только защиту соединения: данные передаются в зашифрованном виде, но честность сайта не гарантируется',
    'Что сайт честный и не обманет пользователя',
    'Что сайт принадлежит государству',
    'Что на сайте нет вирусов и вредоносных программ',
  ];
  sc('net', {
    topic: SAF, d: 'advanced', cog: 'analyze', lesson: '11safe-01-security', subj: 'inf-11-net-cert',
    sub: 'Сертификат безопасности',
    prompt: 'В адресной строке браузера у сайта показан замок — соединение защищено сертификатом. Что этот значок гарантирует?',
    opts, correctText: opts[0],
    why: 'Сертификат подтверждает, что соединение зашифровано и данные нельзя перехватить по дороге. Но сертификат есть и у мошеннических сайтов, поэтому замок — не гарантия добросовестности: отдельно проверяют домен, реквизиты организации и подтверждение подписи.',
  });
}

// ── КТП 31 | 11safe-02-malware | вредоносное ПО и защита (2) ──
{
  const opts = [
    'Она не заражает файлы, а подключает компьютер к ботнету и рассылает по нему спам',
    'Она шифрует файлы и требует выкуп',
    'Она распространяется по сети сама, как червь',
    'Она показывает баннеры и меняет поиск по умолчанию',
  ];
  sc('net', {
    topic: SAF, d: 'basic', cog: 'remember', lesson: '11safe-02-malware', subj: 'inf-11-safe-mal',
    sub: 'Программа-бот',
    prompt: 'Чем вредоносная программа-бот отличается от вируса?',
    opts, correctText: opts[0],
    why: 'Бот не размножается в чужих файлах: он незаметно подключает компьютер к ботнету и ждёт команд с сервера управления. Типичный признак такого заражения — постоянный исходящий трафик, которого в обычной работе быть не должно. Шифрование файлов — работа вымогателя, а самораспространение по сети — червя.',
  });
}
{
  const left = ['Открыли вложение в письме от незнакомца', 'Скачали программу с сайта с рекламой', 'Взяли в библиотеке чужую флешку', 'Установили обновление с неофициального сервера'];
  const right = ['заражение через съёмный носитель', 'чаще всего троян, маскирующийся под полезную программу', 'червь или троян распространился по сети', 'вредоносный код попал в файл обновления'];
  mt('net', {
    topic: SAF, d: 'intermediate', cog: 'apply', lesson: '11safe-02-malware', subj: 'inf-11-safe-mal',
    sub: 'Пути заражения',
    prompt: 'Установите соответствие: действие пользователя — как оно приводит к заражению компьютера.',
    left, right,
    map: {
      'Открыли вложение в письме от незнакомца': right[3],
      'Скачали программу с сайта с рекламой': right[1],
      'Взяли в библиотеке чужую флешку': right[0],
      'Установили обновление с неофициального сервера': right[2],
    },
    why: 'Заражение почти всегда начинается с действия самого пользователя: открытого файла, установленной программы, взятой флешки или подозрительного обновления. Отсюда и защита: осторожность, проверка источника и регулярные обновления с официальных серверов.',
  });
}

// ── КТП 32 | 11safe-03-archive | личный архив информации (2) ──
{
  const opts = [
    'Чтобы убедиться, что копия рабочая: повреждённая копия бесполезна в тот момент, когда понадобится',
    'Чтобы копия не устарела морально',
    'Чтобы система увеличила размер копии',
    'Чтобы система сама пересчитала копию — иначе она перестанет работать',
  ];
  sc('net', {
    topic: SAF, d: 'basic', cog: 'apply', lesson: '11safe-03-archive', subj: 'inf-11-safe-archive',
    sub: 'Проверка копии',
    prompt: 'Зачем раз в месяц открывают несколько файлов из резервной копии личного архива?',
    opts, correctText: opts[0],
    why: 'Копию нужно проверять: единственный экземпляр может оказаться повреждённым, неполным или просто не открываться — тогда она бесполезна ровно в тот момент, когда понадобится. Поэтому раз в месяц открывают файлы и сверяют их с оригиналом.',
  });
}
{
  const left = ['Копия лежит на том же диске, что и оригинал', 'Пароль от архива записан рядом с архивом', 'Два варианта одного документа с разными именами', 'Проект разложен по папкам рабочего стола'];
  const right = ['при отказе диска пропадёт и копия', 'любой, кто получит архив, получит и пароль', 'непонятно, какой из них свежий и верный', 'проект невозможно найти целиком и собрать в архив'];
  mt('net', {
    topic: SAF, d: 'advanced', cog: 'analyze', lesson: '11safe-03-archive', subj: 'inf-11-safe-archive',
    sub: 'Ошибки организации архива',
    prompt: 'Установите соответствие: ошибка в организации личного архива — к чему она приводит.',
    left, right,
    map: {
      'Копия лежит на том же диске, что и оригинал': right[0],
      'Пароль от архива записан рядом с архивом': right[1],
      'Два варианта одного документа с разными именами': right[2],
      'Проект разложен по папкам рабочего стола': right[3],
    },
    why: 'Каждая ошибка лишает копию смысла: копия на том же носителе не переживёт его отказ, пароль рядом с архивом не защищает, дубли мешают выбрать нужное, а разбросанный по рабочему столу проект невозможно собрать. Архив — это система, а не просто папка с файлами.',
  });
}

// ═════════════ проверка квот и запись ═════════════

const QUOTA = {
  "11data-02-stats": 1,
  "11data-03-diagrams": 1,
  "11data-04-correlation": 1,
  "11data-05-equation": 1,
  "11data-06-optimize": 1,
  "11db-02-queries": 4,
  "11algo-06-sorting": 2,
  "11algo-07-matrix": 2,
  "11model-01-modeling": 7,
  "11graph-01-graphs": 3,
  "11graph-02-paths": 7,
  "11graph-02-games": 1,
  "11graph-03-table": 5,
  "11net-04-control": 1,
  "11net-02-html": 1,
  "11net-03-services": 1,
  "11net-05-etiquette": 1
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
  }
}
for (const [lesson, n] of Object.entries(QUOTA)) {
  if (got[lesson] !== n) throw new Error(`${lesson}: по плану ${n}, вышло ${got[lesson] ?? 0}`);
}
const TOTAL = Object.values(byBank).reduce((s, n) => s + n, 0);
if (TOTAL !== 40) throw new Error(`всего ожидали 40 заданий, вышло ${TOTAL}`);
const extra = Object.keys(got).filter((l) => !(l in QUOTA));
if (extra.length) throw new Error(`лишние уроки: ${extra.join(', ')}`);
console.log(`КВОТЫ OK: по урокам tmp/need-11.txt; всего ${TOTAL}`);
console.log(`СЛОЖНОСТИ: basic=${byDiff.basic} intermediate=${byDiff.intermediate} advanced=${byDiff.advanced}`);
console.log(`БАНКИ: ${Object.entries(byBank).map(([n, k]) => `${n}=${k}`).join(' ')}`);

if (process.env.PREVIEW) {
  for (const [name, items] of Object.entries(out)) {
    for (const line of items) console.log(line + '\n');
  }
} else {
  for (const [name, b] of Object.entries(BANK)) {
    writeFileSync(b.file, `${heads[name]}\n\n${[MARK, ...out[name]].join('\n\n')}\n`, 'utf-8');
    console.log(`BANK-11-2 OK: ${b.file} — добавлено ${out[name].length} (последний id ${next[name] - 1})`);
  }
  console.log(`BANK-11-2 ИТОГО: ${TOTAL} заданий`);
}
