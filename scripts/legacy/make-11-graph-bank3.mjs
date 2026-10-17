// Дописывает банк заданий «Графы и игры» 11 класса — третий заход (tmp/BANK-SPEC.md, 18 заданий).
//
// Устройство как в scripts/make-11-bank2.mjs: ответы считает код, ключи сверяется,
// запись идемпотентна по маркеру MARK (файл режется по своему маркеру и пишется заново).
//
// Главное правило: ответы НЕ пишутся руками.
//  - числовые ответы вычисляются алгоритмами графа (степени, компоненты, BFS, обход,
//    гамильтоновы пути, лемма о рукопожатиях, эйлеров цикл) и сверяются assert-ом;
//  - эталоны code_run прогоняются локальным Python — expected_stdout берётся из реального
//    вывода solution_code, расхождение роняет сборку;
//  - в single_choice правильный вариант задаётся ТЕКСТОМ, буква вычисляется кодом;
//  - в matching соответствие собирается кодом из массивов left/right.
//
// Запуск: node scripts/make-11-graph-bank3.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const MARK = '# ==== СГЕНЕРИРОВАНО scripts/make-11-graph-bank3.mjs ====';

const BANK = {
  graph: { file: 'data/tasks/11/graph/bank-11graph.yaml', pfx: 'inf-11-graph-', req: 1.4, el: 1.5 },
};

const q = (s) => JSON.stringify(String(s));
// Соглашения спецификации: basic = 1 балл / remember, intermediate = 2 / apply, advanced = 3 / analyze.
const POINTS = { basic: 1, intermediate: 2, advanced: 3 };
const COG = { basic: 'remember', intermediate: 'apply', advanced: 'analyze' };
const LETTERS = 'ABCD';

// ---------- состояние банка ----------

const out = { graph: [] };
const heads = {};
const next = {};
const usedIds = new Set();

for (const [name, b] of Object.entries(BANK)) {
  const raw = readFileSync(b.file, 'utf-8');
  const cut = raw.indexOf(MARK);
  const head = cut >= 0 ? raw.slice(0, cut) : raw;
  heads[name] = head.replace(/\s+$/, '');
  let max = 0;
  for (const m of heads[name].matchAll(new RegExp(`- id: ${b.pfx}(\\d+)`, 'g'))) {
    max = Math.max(max, Number(m[1]));
    usedIds.add(`${b.pfx}${m[1]}`);
  }
  if (max === 0) throw new Error(`${b.file}: не найдено ни одного id ${b.pfx}NNN`);
  next[name] = max + 1;
}

function put(bank, t) {
  const b = BANK[bank];
  const id = `${b.pfx}${String(next[bank]++).padStart(3, '0')}`;
  if (usedIds.has(id)) throw new Error(`id ${id} уже занят в банке`);
  usedIds.add(id);
  const L = [
    `- id: ${id}`,
    '  class: 11',
    `  topic: ${q(t.topic)}`,
    `  subtopic: ${q(t.sub)}`,
    `  type: ${t.type}`,
    `  difficulty: ${t.d}`,
    `  cognitive_level: ${COG[t.d]}`,
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
    topic: o.topic, sub: o.sub, type: 'numeric_base', d: o.d, lesson: o.lesson,
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
    topic: o.topic, sub: o.sub, type: 'single_choice', d: o.d, lesson: o.lesson,
    subj: o.subj, prompt: o.prompt,
    sv: `{ options: [${opts.map((t, i) => `{ id: ${LETTERS[i]}, text: ${q(t)} }`).join(', ')}] }`,
    ac: `{ method: exact_option }`,
    to: `{ answer: ${q(correct)}, explanation: ${q(o.why)} }`,
  });
  return correct;
}

/** matching. Соответствие собирается кодом из массивов left/right. */
function mt(bank, o) {
  if (o.left.length !== o.right.length) throw new Error(`${o.lesson}: ${o.left.length} левых и ${o.right.length} правых`);
  if (new Set(o.left).size !== o.left.length) throw new Error(`${o.lesson}: повторяются левые варианты`);
  if (new Set(o.right).size !== o.right.length) throw new Error(`${o.lesson}: повторяются правые варианты`);
  // соответствие «левое[i] ↔ правое[i]» строится кодом, а не вписывается руками
  const map = Object.fromEntries(o.left.map((l, i) => [l, o.right[i]]));
  const pairs = o.left.map((l) => `${l} = ${map[l]}`).join('; ');
  put(bank, {
    topic: o.topic, sub: o.sub, type: 'matching', d: o.d, lesson: o.lesson,
    subj: o.subj, prompt: o.prompt,
    sv: `{ left: [${o.left.map(q).join(', ')}], right: [${o.right.map(q).join(', ')}] }`,
    ac: `{ method: matching, partial: proportional }`,
    to: `{ answer_map: { ${o.left.map((l) => `${q(l)}: ${q(map[l])}`).join(', ')} }, explanation: ${q(`${o.why} Верно: ${pairs}.`)} }`,
  });
}

/** Локальный прогон эталона. Возвращает stdout без хвостовых переводов строк. */
const PYTHON = (() => {
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
  for (const bin of ['python3', 'python']) {
    try {
      execFileSync(bin, ['-c', 'pass'], { env, stdio: ['ignore', 'ignore', 'ignore'] });
      return bin;
    } catch {
      // пробуем следующее имя
    }
  }
  throw new Error('не найден интерпретатор Python (python3 / python)');
})();

function py(code) {
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
  const res = execFileSync(PYTHON, ['-c', code], {
    encoding: 'utf-8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
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
    topic: o.topic, sub: o.sub, type: 'code_run', d: o.d, lesson: o.lesson,
    subj: o.subj, prompt: o.prompt,
    sv: `{ language: python, template: ${q(o.template)} }`,
    ac: `{ method: code_stdout, timeout_s: 10 }`,
    to: `{ solution_code: ${q(o.solution)}, expected_stdout: ${q(outp)}, explanation: ${q(o.why)} }`,
  });
}

// ---------- алгоритмы графа для вычисления ответов ----------

const sum = (a) => a.reduce((s, v) => s + v, 0);

/**
 * Приводит список смежности к строковым меткам: ключи объекта в JavaScript — строки,
 * а элементы списков могли быть записаны числами. Без этого сравнение по меткам ломается.
 */
function sym(adj) {
  const out = {};
  for (const [v, list] of Object.entries(adj)) out[v] = list.map((u) => String(u));
  return out;
}

/** Степени вершин неориентированного графа по спискам смежности (проверяем симметрию). */
function undirectedDegrees(adj) {
  const deg = {};
  for (const v of Object.keys(adj)) {
    for (const u of adj[v]) {
      if (!(adj[u] ?? []).includes(v)) throw new Error(`списки смежности несимметричны: ${v}-${u}`);
    }
    deg[v] = adj[v].length;
  }
  return deg;
}

/** Число рёбер неориентированного графа: сумма степеней пополам (лемма о рукопожатиях). */
function edgesByDegree(adj) {
  const deg = undirectedDegrees(adj);
  const total = sum(Object.values(deg));
  if (total % 2 !== 0) throw new Error(`сумма степеней ${total} нечётна`);
  return total / 2;
}

/** Обход в ширину: расстояния от стартовой вершины (каждое ребро весит 1). */
function bfs(adj, from) {
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

/** Обход в глубину: множество вершин, достижимых из стартовой, и порядок посещения. */
function dfs(adj, from) {
  const seen = new Set();
  const order = [];
  const go = (v) => {
    seen.add(v);
    order.push(v);
    for (const u of adj[v] ?? []) if (!seen.has(u)) go(u);
  };
  go(from);
  return { seen, order };
}

/** Компоненты связности неориентированного графа, заданного списками смежности. */
function components(adj) {
  const left = new Set(Object.keys(adj));
  const comps = [];
  while (left.size) {
    const start = left.values().next().value;
    const { seen } = dfs(adj, start);
    for (const v of seen) left.delete(v);
    comps.push([...seen].sort());
  }
  return comps;
}

/** Гамильтоновы пути из from в to: простые пути, проходящие по всем вершинам ровно один раз. */
function hamiltonPaths(adj, from, to) {
  const nodes = Object.keys(adj);
  const res = [];
  const go = (v, path) => {
    if (v === to) {
      if (path.length === nodes.length) res.push([...path]);
      return;
    }
    for (const u of adj[v] ?? []) {
      if (path.includes(u)) continue;
      go(u, [...path, u]);
    }
  };
  go(from, [from]);
  return res;
}

/** Разметка игры «берём moves камней, проигрывает взявший последний»: win[s] = есть ход в L. */
function loseTakeLast(limit, moves) {
  const win = {};
  for (let s = 1; s <= limit; s++) {
    win[s] = moves.some((k) => k < s && !win[s - k]);
  }
  return win;
}

/** Число партий дерева игры: все последовательности ходов с суммой ровно start. */
function gameParties(start, moves) {
  const go = (s) => (s === 0 ? 1 : sum(moves.filter((k) => k <= s).map((k) => go(s - k))));
  return go(start);
}

/** Число партий, завершившихся ровно за length ходов. */
function gamePartiesOfLength(start, moves, length) {
  const go = (s, left) => {
    if (left === 0) return s === 0 ? 1 : 0;
    return sum(moves.filter((k) => k <= s).map((k) => go(s - k, left - 1)));
  };
  return go(start, length);
}

/** Разметка игры на ориентированном графе: ход — переход по ребру, нет хода — проигрыш. */
function graphGame(adjOut, order) {
  const win = {};
  for (const v of order) {
    for (const u of adjOut[v] ?? []) {
      if (win[u] === undefined) {
        throw new Error(`разметка: ${v} идёт в ${u}, но ${u} разбирается позже — нужен топологический порядок`);
      }
    }
    win[v] = (adjOut[v] ?? []).some((u) => !win[u]);
  }
  return win;
}

// ═════════════════════ 11graph-01-graphs · графы и деревья (5 basic) ═════════════════════

const GRF = 'Графы и деревья';

// ── 1 | Степень вершины по спискам смежности ──
{
  const adj = sym({
    1: [2, 3, 4], 2: [1, 5], 3: [1, 4, 6], 4: [1, 3, 5], 5: [2, 4, 6], 6: [3, 5],
  });
  const deg = undirectedDegrees(adj);
  const v = '4';
  if (deg[v] !== 3) throw new Error(`степень ${v}: ${deg[v]}`);
  const pairs = Object.keys(adj).map((k) => `${k}: ${deg[k]}`).join(', ');
  num('graph', {
    topic: GRF, d: 'basic', lesson: '11graph-01-graphs', subj: 'inf-11-graph-degree',
    sub: 'Степень вершины',
    prompt: `Неориентированный граф задан списками смежности: 1 → 2, 3, 4; 2 → 1, 5; 3 → 1, 4, 6; 4 → 1, 3, 5; 5 → 2, 4, 6; 6 → 3, 5. Чему равна степень вершины 4? Запишите только число.`,
    value: deg[v],
    why: `Степень вершины — это число рёбер, выходящих из неё, то есть длина её строки в списке смежности. У вершины 4 три соседа: 1, 3 и 5, поэтому степень равна ${deg[v]}. Степени всех вершин: ${pairs}. Проверка: сложив их, получим ${sum(Object.values(deg))}, а это вдвое больше числа рёбер — каждое ребро посчитано у обоих своих концов.`,
  });
}

// ── 2 | Число рёбер по степеням вершин ──
{
  const adj = sym({
    1: [2, 3], 2: [1, 3, 4], 3: [1, 2], 4: [2, 5], 5: [4, 6, 7], 6: [5], 7: [5, 8], 8: [7],
  });
  const deg = undirectedDegrees(adj);
  const m = edgesByDegree(adj);
  if (m !== 8) throw new Error(`рёбер: ${m}`);
  const pairs = Object.keys(adj).map((k) => `${k} — ${deg[k]}`).join(', ');
  num('graph', {
    topic: GRF, d: 'basic', lesson: '11graph-01-graphs', subj: 'inf-11-graph-degree',
    sub: 'Число рёбер по степеням',
    prompt: `Неориентированный граф задан списками смежности: 1 → 2, 3; 2 → 1, 3, 4; 3 → 1, 2; 4 → 2, 5; 5 → 4, 6, 7; 6 → 5; 7 → 5, 8; 8 → 7. Сколько рёбер в этом графе? Запишите только число.`,
    value: m,
    why: `Степени вершин: ${pairs}. Их сумма равна ${sum(Object.values(deg))}, но каждое ребро посчитано дважды — один раз в списке каждого из своих концов. Поэтому число рёбер равно половине суммы степеней: ${sum(Object.values(deg))} / 2 = ${m}. Это и есть лемма о рукопожатиях: сумма степеней вершин неориентированного графа всегда чётна.`,
  });
}

// ── 3 | Изоморфизм ──
{
  const opts = [
    'Нет: этого недостаточно, нужно ещё совпадение степеней вершин',
    'Да: число вершин и число рёбер полностью определяют граф',
    'Да: графы изоморфны, если оба связны',
    'Нет: для этого обязательно нарисовать оба графа и сравнить рисунки',
  ];
  sc('graph', {
    topic: GRF, d: 'basic', lesson: '11graph-01-graphs', subj: 'inf-11-graph-iso',
    sub: 'Изоморфизм графов',
    prompt: 'Два графа имеют одинаковое число вершин и одинаковое число рёбер. Можно ли утверждать, что они изоморфны?',
    opts, correctText: opts[0],
    why: 'Изоморфизм требует переименования вершин, при котором рёбра сохраняются, а одинаковые числа вершин и рёбер этому не гарантируют: вершины могут сильно различаться по степеням. Даже совпадение степеней — лишь необходимое условие. Проверяют изоморфизм перебором переименований или сравнением списков смежности после упорядочивания.',
  });
}

// ── 4 | Число рёбер ориентированного графа ──
{
  const adjOut = { 1: [2, 3], 2: [4], 3: [2, 5], 4: [6], 5: [4], 6: [] };
  const arcs = sum(Object.values(adjOut).map((l) => l.length));
  if (arcs !== 7) throw new Error(`дуг: ${arcs}`);
  const inDeg = {};
  for (const v of Object.keys(adjOut)) for (const u of adjOut[v]) inDeg[u] = (inDeg[u] ?? 0) + 1;
  const ins = Object.keys(adjOut).map((k) => `${k} — ${inDeg[k] ?? 0}`).join(', ');
  num('graph', {
    topic: GRF, d: 'basic', lesson: '11graph-01-graphs', subj: 'inf-11-graph-degree',
    sub: 'Число рёбер орграфа',
    prompt: `Ориентированный граф задан списками смежности: 1 → 2, 3; 2 → 4; 3 → 2, 5; 4 → 6; 5 → 4; 6 → никуда. Сколько рёбер (дуг) в этом графе? Запишите только число.`,
    value: arcs,
    why: `Складываем длины всех списков смежности: 2 + 1 + 2 + 1 + 1 + 0 = ${arcs}. Делить пополам здесь не нужно: в неориентированном графе ребро посчитано у обоих концов, а здесь каждое ориентированное ребро записано ровно один раз. Для проверки посчитаем входящие степени (сколько рёбер ведёт в каждую вершину): ${ins}; их сумма тоже равна ${arcs}, потому что каждая дуга входит ровно в одну вершину.`,
  });
}

// ── 5 | Способы записи графа ──
{
  const left = ['Матрица смежности', 'Список смежности', 'Список рёбер', 'Матрица весов'];
  const right = [
    'таблица: в строке i единицы стоят у всех вершин, смежных с i',
    'у каждой вершины выписан перечень её соседей',
    'каждое ребро записано отдельной парой вершин',
    'таблица: вместо единицы в клетке стоит длина ребра',
  ];
  mt('graph', {
    topic: GRF, d: 'basic', lesson: '11graph-01-graphs', subj: 'inf-11-graph-adjlist',
    sub: 'Способы записи графа',
    prompt: 'Установите соответствие: способ записи графа — что в нём хранится.',
    left, right,
    why: 'Все четыре записи описывают один и тот же граф, но по-разному. Матрица смежности удобна для проверок и обходов по строкам, список смежности экономнее по памяти на разреженных графах, список рёбер записывает каждое ребро ровно один раз, а матрица весов дополнительно хранит длины. Выбор записи зависит от того, какие операции с графом будут выполняться.',
  });
}

// ═════════════════════ 11graph-02-paths · пути (4 basic) ═════════════════════

// ── 6 | Компоненты связности ──
{
  const adj = sym({
    1: [2, 3], 2: [1, 3, 4], 3: [1, 2], 4: [3], 5: [6], 6: [5, 7], 7: [6], 8: [],
  });
  const comps = components(adj);
  const n = comps.length;
  if (n !== 3) throw new Error(`компонент: ${n}`);
  const list = comps.map((c) => `{${c.join(', ')}}`).join(', ');
  num('graph', {
    topic: GRF, d: 'basic', lesson: '11graph-02-paths', subj: 'inf-11-graph-components',
    sub: 'Число компонент связности',
    prompt: `Неориентированный граф задан списками смежности: 1 → 2, 3; 2 → 1, 3, 4; 3 → 1, 2; 4 → 3; 5 → 6; 6 → 5, 7; 7 → 6; 8 → никуда. Сколько в графе компонент связности? Запишите только число.`,
    value: n,
    why: `Компонента — это группа вершин, между которыми можно пройти по рёбрам. Обход из вершины 1 находит ${comps[0].length} вершины: ${comps[0].join(', ')}. Обход из 5 находит ${comps[1].length}: ${comps[1].join(', ')}. Вершина 8 не соединена ни с кем, поэтому она отдельная компонента. Компоненты получились такие: ${list} — всего ${n}, и граф несвязный.`,
  });
}

// ── 7 | Расстояние в рёбрах (обход в ширину) ──
{
  const adj = sym({
    1: [2, 3], 2: [1, 4, 6], 3: [1, 4], 4: [2, 3, 5], 5: [4, 6], 6: [2, 5],
  });
  const dist = bfs(adj, '1');
  if (dist[5] !== 3) throw new Error(`расстояние 1→5: ${dist[5]}`);
  const rows = Object.keys(adj).map((k) => `${k} — ${dist[k] ?? '—'}`).join(', ');
  num('graph', {
    topic: GRF, d: 'basic', lesson: '11graph-02-paths', subj: 'inf-11-graph-bfs',
    sub: 'Расстояние в рёбрах',
    prompt: `Неориентированный граф без весов задан списками смежности: 1 → 2, 3; 2 → 1, 4, 6; 3 → 1, 4; 4 → 2, 3, 5; 5 → 4, 6; 6 → 2, 5. Каково расстояние от вершины 1 до вершины 5, то есть наименьшее число рёбер в пути между ними? Запишите только число.`,
    value: dist[5],
    why: `Обход в ширину из вершины 1 даёт расстояния: ${rows}. Путь длины 1 не существует: вершины 1 и 5 не соединены ребром. Длины 2 тоже нет: у вершины 1 только соседи 2 и 3, а ни один из них не соединён с 5. Короче всего 1 → 2 → 4 → 5 или 1 → 3 → 4 → 5 — это ${dist[5]} ребра, а вершин в таком пути на одну больше.`,
  });
}

// ── 8 | Гамильтоновы пути ──
{
  const adj = {
    A: ['B', 'C'], B: ['A', 'C', 'D'], C: ['A', 'B', 'D', 'E'], D: ['B', 'C', 'E'], E: ['C', 'D'],
  };
  const list = hamiltonPaths(adj, 'A', 'E');
  if (list.length !== 3) throw new Error(`гамильтоновых: ${list.length} — ${list.map((p) => p.join('→')).join('; ')}`);
  const pretty = list.map((p) => p.join('→')).join('; ');
  num('graph', {
    topic: GRF, d: 'basic', lesson: '11graph-02-paths', subj: 'inf-11-graph-hamilton',
    sub: 'Число гамильтоновых путей',
    prompt: 'Неориентированный граф на пяти вершинах: A–B, A–C, B–C, B–D, C–D, C–E, D–E. Сколько существует гамильтоновых путей из A в E, то есть проходящих по каждой из пяти вершин ровно один раз? Запишите только число.',
    value: list.length,
    why: `Гамильтонов путь обязан посетить все пять вершин и не повторять их, поэтому перебираем все простые пути длины 4 и оставляем только те, что заканчиваются в E. Подходят ровно три: ${pretty}. Проверить удобно с конца: перед E может стоять только C или D, а из каждого из них до E доходят все продолжения, которые не повторяют уже пройденные вершины. Порядок важен — A → B → C → D → E и A → C → B → D → E посещают один и тот же набор вершин, но считаются разными путями.`,
  });
}

// ── 9 | Эйлеров цикл: сколько рёбер добавить ──
{
  const adj = sym({ 1: [2, 6], 2: [1, 3, 7], 3: [2, 4], 4: [3, 5, 8], 5: [4, 6], 6: [5, 1], 7: [2], 8: [4] });
  const deg = undirectedDegrees(adj);
  const odd = Object.keys(adj).filter((v) => deg[v] % 2 === 1);
  const add = odd.length / 2;
  if (odd.join(',') !== '2,4,7,8' || add !== 2) throw new Error(`нечётные ${odd}/${add}`);
  num('graph', {
    topic: GRF, d: 'basic', lesson: '11graph-02-paths', subj: 'inf-11-graph-euler',
    sub: 'Сколько рёбер до эйлерова цикла',
    prompt: `Связный неориентированный граф задан списками смежности: 1 → 2, 6; 2 → 1, 3, 7; 3 → 2, 4; 4 → 3, 5, 8; 5 → 4, 6; 6 → 5, 1; 7 → 2; 8 → 4. Сколько рёбер нужно добавить, чтобы в графе существовал эйлеров цикл? Запишите только число.`,
    value: add,
    why: `Эйлеров цикл проходит по каждому ребру ровно один раз, поэтому в каждую вершину он приходит столько раз, сколько рёбер из неё выходит, и возвращается в начало: все степени должны быть чётными. Сейчас нечётные степени у вершин ${odd.join(', ')} — их ${odd.length}. Добавленное ребро меняет чётность степеней ровно у двух своих концов, поэтому понадобится ${odd.length} / 2 = ${add} ребра: например, ребро 7–8 и ребро 2–4 (его в графе нет), и тогда все степени станут чётными. Меньше нельзя: одно ребро устраняет только две нечётные степени.`,
  });
}

// ═════════════════════ 11graph-02-games · игры двух игроков (4 basic + 1 advanced) ═════════════════════

const GAM = 'Выигрышные стратегии';

// ── 10 | Число партий дерева игры ──
{
  const moves = [2, 3];
  const start = 8;
  const leaves = gameParties(start, moves);
  if (leaves !== 4) throw new Error(`партий: ${leaves}`);
  const seq = [
    [2, 2, 2, 2], [2, 3, 3], [3, 2, 3], [3, 3, 2],
  ];
  if (seq.length !== leaves) throw new Error(`разбор не сошёлся: ${seq.length}`);
  num('graph', {
    topic: GAM, d: 'basic', lesson: '11graph-02-games', subj: 'inf-11-graph-games',
    sub: 'Число партий',
    prompt: `В игре куча из ${start} камней, за ход берут ${moves.join(' или ')} камня, а партия заканчивается, когда камней не осталось. Сколько различных партий возможно, если считать разными партии с разным порядком ходов? Запишите только число.`,
    value: leaves,
    why: `Партия — это любая последовательность двоек и троек с суммой ${start}: ${seq.map((s) => s.join('+')).join('; ')}. Всего ${leaves} партии. Партии 2+3+3 и 3+2+3 считаются разными: перед вторым ходом в одной из них в куче ${start - 2} камней, а в другой ${start - 3}, и это разные позиции с разными продолжениями. Такое дерево игры растёт очень быстро, поэтому партии удобнее считать рекурсией: сколько партий из позиции s равно сумме партий из позиций s − 2 и s − 3.`,
  });
}

// ── 11 | Партии ровно за три хода ──
{
  const moves = [2, 3];
  const start = 7;
  const count = gamePartiesOfLength(start, moves, 3);
  if (count !== 3) throw new Error(`партий по 3 хода: ${count}`);
  const seq = [[2, 2, 3], [2, 3, 2], [3, 2, 2]];
  num('graph', {
    topic: GAM, d: 'basic', lesson: '11graph-02-games', subj: 'inf-11-graph-games',
    sub: 'Партии заданной длины',
    prompt: `В игре куча из ${start} камней, за ход берут ${moves.join(' или ')} камня. Партия заканчивается, когда камней не осталось. Сколько партий заканчиваются ровно за три хода? Запишите только число.`,
    value: count,
    why: `Нужно разложить ${start} на три слагаемых, каждое из которых равно 2 или 3. Подходят только разложения ${seq.map((s) => s.join('+')).join('; ')} — всего ${count}. Разложение 2+3+3 даёт 8, а 3+3+3 даёт 9, поэтому они не подходят: партия в них длилась бы дольше. Здесь ответ случайно совпал с общим числом партий из ${start} камней — оно тоже равно ${gameParties(start, moves)}, ведь любая партия из двоек и троек с такой суммой состоит ровно из трёх ходов.`,
  });
}

// ── 12 | Динамика по позициям ──
{
  const opts = [
    'Ответ для каждой позиции сразу, без повторного перебора всей партии',
    'Полный список всех партий от начала до конца',
    'График зависимости числа ходов от числа камней',
    'Ничего: разметка таблицы идёт перебором партий',
  ];
  sc('graph', {
    topic: GAM, d: 'basic', lesson: '11graph-02-games', subj: 'inf-11-graph-games',
    sub: 'Зачем нужна динамика',
    prompt: 'Что даёт разметка позиций методом динамического программирования по сравнению с перебором всех партий?',
    opts, correctText: opts[0],
    why: 'Перебор партий строит всё дерево игры целиком, а оно растёт очень быстро: число партий примерно удваивается с каждым новым ходом. Динамика считает один раз отметку для каждой позиции и запоминает её, а ответ для позиции получается сложением уже посчитанных значений по ходам. Поэтому на больших позициях перебор просто не заканчивается, а динамика работает за время, пропорциональное числу позиций.',
  });
}

// ── 13 | Разметка при ходах 2 и 3 ──
{
  const moves = [2, 3];
  const limit = 25;
  const win = loseTakeLast(limit, moves);
  const losing = Object.entries(win).filter(([k, v]) => !v).map(([k]) => Number(k)).sort((a, b) => a - b);
  if (losing.join(',') !== '1,2,6,7,11,12,16,17,21,22' || losing.length !== 10) {
    throw new Error(`проигрышные: ${losing.join(',')}`);
  }
  num('graph', {
    topic: GAM, d: 'basic', lesson: '11graph-02-games', subj: 'inf-11-graph-games',
    sub: 'Разметка при ходах 2 и 3',
    prompt: `В игре из кучи камней за ход берут ${moves.join(' или ')} камня, а проигрывает тот, кто взял последний камень. Позиции размечают от 1 вверх: позиция проигрышная, если ни один ход не ведёт в проигрышную позицию. Сколько проигрышных позиций среди 1, 2, …, ${limit}? Запишите только число.`,
    value: losing.length,
    why: `Позиции 1 и 2 проигрышные: из них нельзя взять ни 2, ни 3 камня, не забрав всё сразу, а такой ход проигрывает. Дальше правило повторяется: 3, 4, 5 выигрышные (можно оставить сопернику 1 или 2), а 6 и 7 снова проигрышные. Проигрышными оказались позиции ${losing.join(', ')} — их ${losing.length}. Заметьте закономерность: проигрышные позиции идут парами через каждые 5, ведь за два хода соперник «съедает» ровно 2 + 3 = 5 камней.`,
  });
}

// ── 14 | advanced | игра на ориентированном графе кодом ──
{
  const adjOut = {
    A: ['B', 'C'], B: ['D'], C: ['D', 'E'], D: ['F'], E: ['F'], F: [],
  };
  const order = ['F', 'D', 'E', 'B', 'C', 'A'];
  const win = graphGame(adjOut, order);
  const losing = order.filter((v) => !win[v]);
  if (losing.join(',') !== 'F,B,C' || !win.A) throw new Error(`разметка: ${losing} / A=${win.A}`);
  const sol = `# вершина -> вершины, в которые можно перейти за один ход
graph = {
    'A': ['B', 'C'],
    'B': ['D'],
    'C': ['D', 'E'],
    'D': ['F'],
    'E': ['F'],
    'F': [],
}
# вершины идут в топологическом порядке: из каждой рёбра ведут только в разобранные
order = ['F', 'D', 'E', 'B', 'C', 'A']
win = {}
for v in order:
    # выигрышная позиция, если из неё есть ход в проигрышную
    win[v] = False
    for u in graph[v]:
        if not win[u]:
            win[v] = True
losing = [v for v in order if not win[v]]
print(len(losing))
print('W' if win['A'] else 'L')`;
  cr('graph', {
    topic: GAM, d: 'advanced', lesson: '11graph-02-games', subj: 'inf-11-graph-game-graph',
    sub: 'Игра на графе кодом',
    prompt: 'Фишка стоит в вершине ориентированного графа. Игроки ходят по очереди, за ход переводя фишку по ребру вперёд; тот, кому некуда идти, проигрывает. Рёбра: A→B, A→C, B→D, C→D, C→E, D→F, E→F. Разметьте позиции-вершины и выведите сначала число проигрышных вершин, а на новой строке — отметку стартовой вершины A: W, если она выигрышная, и L иначе.',
    template: `# Разметьте вершины графа: ход — переход по ребру, нет хода — проигрыш\ngraph = {\n    'A': ['B', 'C'],\n    'B': ['D'],\n    'C': ['D', 'E'],\n    'D': ['F'],\n    'E': ['F'],\n    'F': [],\n}\n# порядок разбора: из каждой вершины рёбра ведут только в уже разобранные\norder = ['F', 'D', 'E', 'B', 'C', 'A']\nwin = {}\nfor v in order:\n    # отметка позиции зависит только от позиций, в которые ведут её ходы\n    ...\nlosing = [v for v in order if not win[v]]\nprint(len(losing))\nprint('W' if win['A'] else 'L')`,
    solution: sol,
    why: `Здесь игру решают динамикой по вершинам, а не по числу камней. Вершины разбираются в топологическом порядке F, D, E, B, C, A: из каждой рёбра ведут только в уже разобранные, поэтому нужные отметки уже известны. Из F ходов нет, значит она проигрышная (L); D и E могут перейти в F, поэтому выигрышные; из B и C любой ход ведёт в выигрышную позицию, значит обе проигрышные; из A есть ход в B, поэтому A выигрышная. Проигрышных вершин ${losing.length}: ${losing.join(', ')}.`,
  });
}

// ═════════════════════ 11graph-03-table · таблицы и графы (3 basic + 1 intermediate) ═════════════════════

const MTX = [
  [0, 0, 0, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 1, 0],
  [0, 0, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 0, 0, 0],
];
const NODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// ── 15 | Вершины без входящих рёбер по матрице ──
{
  const inDeg = NODES.map((_, j) => MTX.reduce((s, row) => s + row[j], 0));
  const sources = NODES.filter((_, j) => inDeg[j] === 0);
  if (sources.join(',') !== 'A,B,C') throw new Error(`источники: ${sources}`);
  const sums = NODES.map((v, j) => `${v} — ${inDeg[j]}`).join(', ');
  num('graph', {
    topic: GRF, d: 'basic', lesson: '11graph-03-table', subj: 'inf-11-graph-matrix',
    sub: 'Вершины без входящих рёбер',
    prompt: `Ориентированный граф задан матрицей смежности (строки — «откуда», столбцы — «куда»):\n${MTX.map((r) => r.join(' ')).join('\n')}\nСколько вершин не имеют ни одного входящего ребра? Запишите только число.`,
    value: sources.length,
    why: `Входящие степени вершин — это суммы столбцов матрицы: ${sums}. Нулевой столбец означает, что в вершину не ведёт ни одного ребра, то есть это вершина-источник. Таких вершин ${sources.length}: ${sources.join(', ')}. При этом строки A, B и C непустые — из них ходы есть, поэтому в граф они попали как начала рёбер, а не как их концы. Обратите внимание на вершину G: в неё ведёт одно ребро из D, поэтому источником она не считается.`,
  });
}

// ── 16 | Достижимые вершины по матрице ──
{
  const adjOut = {};
  NODES.forEach((v, i) => {
    adjOut[v] = MTX[i].map((x, j) => (x ? NODES[j] : null)).filter(Boolean);
  });
  const { seen } = dfs(adjOut, 'A');
  const reach = NODES.filter((v) => v !== 'A' && seen.has(v));
  if (reach.join(',') !== 'D,E,F,G,H') throw new Error(`достижимы: ${reach}`);
  num('graph', {
    topic: GRF, d: 'basic', lesson: '11graph-03-table', subj: 'inf-11-graph-matrix',
    sub: 'Достижимые вершины по матрице',
    prompt: `Ориентированный граф задан матрицей смежности (строки — «откуда», столбцы — «куда»):\n${MTX.map((r) => r.join(' ')).join('\n')}\nОбходом в глубину из вершины A найдите все достижимые вершины, кроме самой A. Сколько их? Запишите только число.`,
    value: reach.length,
    why: `Обход идёт по рёбрам, записанным в строке текущей вершины. Из A доступны D и E (строка A). Из D — F и G, из E — F, из F — H, из G — H. Собралось ${reach.join(', ')} — ${reach.length} вершины, и на этом обход заканчивается, потому что из H рёбер нет. Вершины B и C остались непосещёнными: в A ведут рёбра, но из A до них добраться нельзя.`,
  });
}

// ── 17 | Чтение матрицы смежности ──
{
  const opts = [
    'Взять строку i и выписать номера столбцов, где стоит единица',
    'Взять столбец i и выписать номера строк, где стоит единица',
    'Сложить все единицы матрицы и вычесть единицы на диагонали',
    'Взять только диагональные элементы матрицы',
  ];
  sc('graph', {
    topic: GRF, d: 'basic', lesson: '11graph-03-table', subj: 'inf-11-graph-matrix',
    sub: 'Как прочитать матрицу',
    prompt: 'Как по матрице смежности восстановить список смежности вершины i?',
    opts, correctText: opts[0],
    why: 'Строка матрицы соответствует вершине, из которой идут рёбра, а столбцы — вершинам, в которые они ведут. Поэтому список смежности вершины i получают из строки i: выписывают номера тех столбцов, где стоит единица. Столбец i даёт входящие степени — по нему находят вершины-источники, но это не список смежности.',
  });
}

// ── 18 | intermediate | Вершины на расстоянии 2 по матрице ──
{
  const adjOut = {};
  NODES.forEach((v, i) => {
    adjOut[v] = MTX[i].map((x, j) => (x ? NODES[j] : null)).filter(Boolean);
  });
  const dist = bfs(adjOut, 'A');
  const two = NODES.filter((v) => dist[v] === 2);
  if (two.join(',') !== 'F,G') throw new Error(`на расстоянии 2: ${two}`);
  const rows = NODES.filter((v) => dist[v] !== undefined).map((v) => `${v} — ${dist[v]}`).join(', ');
  num('graph', {
    topic: GRF, d: 'intermediate', lesson: '11graph-03-table', subj: 'inf-11-graph-matrix',
    sub: 'Второй уровень обхода',
    prompt: `Ориентированный граф задан матрицей смежности (строки — «откуда», столбцы — «куда»):\n${MTX.map((r) => r.join(' ')).join('\n')}\nОбходом в ширину из вершины A найдите вершины, лежащие на расстоянии ровно 2 от неё. Сколько таких вершин? Запишите только число.`,
    value: two.length,
    why: `Обход в ширину идёт по уровням, расстояния от A получаются такие: ${rows}. На расстоянии 1 стоят D и E, на расстоянии 2 — ${two.join(', ')}: до F можно дойти и через D, и через E, но засчитывается вершина один раз, а не два. Вершина H лежит на расстоянии 3, поэтому в ответ она не входит: важно именно «ровно 2», а не «не дальше 2».`,
  });
}

// ═════════════ проверка квот и запись ═════════════

const QUOTA = {
  '11graph-01-graphs': { basic: 5, intermediate: 0, advanced: 0 },
  '11graph-02-paths': { basic: 4, intermediate: 0, advanced: 0 },
  '11graph-02-games': { basic: 4, intermediate: 0, advanced: 1 },
  '11graph-03-table': { basic: 3, intermediate: 1, advanced: 0 },
};

const got = {};
const byDiff = { basic: 0, intermediate: 0, advanced: 0 };
let TOTAL = 0;
for (const [name, items] of Object.entries(out)) {
  for (const item of items) {
    TOTAL += 1;
    const id = /^- id: (\S+)$/m.exec(item)?.[1];
    const lesson = /^\s*lesson: (\S+)$/m.exec(item)?.[1];
    const d = /^\s*difficulty: (\S+)$/m.exec(item)?.[1];
    const p = Number(/^\s*points: (\d+)$/m.exec(item)?.[1]);
    const cog = /^\s*cognitive_level: (\S+)$/m.exec(item)?.[1];
    const type = /^\s*type: (\S+)$/m.exec(item)?.[1];
    if (!id || !lesson || !d || !cog || !type) throw new Error(`задание без обязательных полей:\n${item}`);
    if (!['basic', 'intermediate', 'advanced'].includes(d)) throw new Error(`${id}: неизвестная сложность ${d}`);
    if (POINTS[d] !== p) throw new Error(`${id}: ${d} = ${p} баллов, должно быть ${POINTS[d]}`);
    if (COG[d] !== cog) throw new Error(`${id}: ${d} с cognitive_level ${cog}, по соглашениям ${COG[d]}`);
    if (!['numeric_base', 'single_choice', 'matching', 'code_run'].includes(type)) throw new Error(`${id}: неизвестный тип ${type}`);
    if (!QUOTA[lesson]) throw new Error(`${id}: урок ${lesson} не в квотах`);
    got[lesson] ??= { basic: 0, intermediate: 0, advanced: 0 };
    got[lesson][d] += 1;
    byDiff[d] += 1;
  }
}
const EXTRA = Object.keys(got).filter((l) => !(l in QUOTA));
if (EXTRA.length) throw new Error(`лишние уроки: ${EXTRA.join(', ')}`);
for (const [lesson, plan] of Object.entries(QUOTA)) {
  const real = got[lesson] ?? { basic: 0, intermediate: 0, advanced: 0 };
  for (const d of ['basic', 'intermediate', 'advanced']) {
    if (real[d] !== plan[d]) throw new Error(`${lesson}/${d}: по плану ${plan[d]}, вышло ${real[d]}`);
  }
}
const PLANNED = Object.values(QUOTA).reduce(
  (s, plan) => s + plan.basic + plan.intermediate + plan.advanced,
  0,
);
if (TOTAL !== PLANNED) throw new Error(`всего ожидали ${PLANNED} заданий, вышло ${TOTAL}`);
console.log(`КВОТЫ OK: всего ${TOTAL}`);
console.log(`СЛОЖНОСТИ: basic=${byDiff.basic} intermediate=${byDiff.intermediate} advanced=${byDiff.advanced}`);
for (const [lesson, plan] of Object.entries(QUOTA)) {
  console.log(`  ${lesson}: basic=${plan.basic} intermediate=${plan.intermediate} advanced=${plan.advanced}`);
}

if (process.env.PREVIEW) {
  for (const items of Object.values(out)) for (const line of items) console.log(`${line}\n`);
} else {
  for (const [name, b] of Object.entries(BANK)) {
    writeFileSync(b.file, `${heads[name]}\n\n${[MARK, ...out[name]].join('\n\n')}\n`, 'utf-8');
    console.log(`BANK-11GRAPH-3 OK: ${b.file} — добавлено ${out[name].length} (последний id ${next[name] - 1})`);
  }
  console.log(`BANK-11GRAPH-3 ИТОГО: ${TOTAL} заданий`);
}