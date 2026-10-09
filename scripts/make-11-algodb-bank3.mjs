// Дописывает два банка 11 класса — «Алгоритмы» и «Базы данных» (tmp/BANK-SPEC.md, 30 заданий).
//
// Устройство как в scripts/make-11-bank2.mjs: ответы считает код, ключи сверяются,
// запись идемпотентна по маркеру MARK (файл режется по своему маркеру и пишется заново).
//
// Главное правило: ответы НЕ пишутся руками.
//  - числовые ответы вычисляются (арифметика, перебор, обход матрицы, разбор строки)
//    и сверяются assert-ом;
//  - эталоны code_run прогоняются локальным Python — expected_stdout берётся из реального
//    вывода solution_code, расхождение роняет сборку;
//  - в single_choice правильный вариант задаётся ТЕКСТОМ, буква вычисляется кодом.
//
// Запуск: node scripts/make-11-algodb-bank3.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const MARK = '# ==== СГЕНЕРИРОВАНО scripts/make-11-algodb-bank3.mjs ====';

const BANK = {
  algo: { file: 'data/tasks/11/algo/bank-11algo.yaml', pfx: 'inf-11-algo-', req: 1.4, el: 1.5 },
  db: { file: 'data/tasks/11/db/bank-11db.yaml', pfx: 'inf-11-db-', req: 1.1, el: 1.1 },
};

const q = (s) => JSON.stringify(String(s));
const POINTS = { basic: 1, intermediate: 2, advanced: 3 };
const COG = { basic: 'remember', intermediate: 'apply', advanced: 'analyze' };
const LETTERS = 'ABCD';

// ---------- состояние банков ----------

const out = { algo: [], db: [] };
const heads = {};
const next = {};

for (const [name, b] of Object.entries(BANK)) {
  const raw = readFileSync(b.file, 'utf-8');
  const cut = raw.indexOf(MARK);
  const head = cut >= 0 ? raw.slice(0, cut) : raw;
  heads[name] = head.replace(/\s+$/, '');
  const ids = [...heads[name].matchAll(new RegExp(`- id: ${b.pfx}(\\d+)`, 'g'))].map((m) => Number(m[1]));
  let max = 0;
  for (const n of ids) max = Math.max(max, n);
  if (max === 0) throw new Error(`${b.file}: не найдено ни одного id ${b.pfx}NNN`);
  next[name] = max + 1;
}

function put(bank, t) {
  const b = BANK[bank];
  const id = `${b.pfx}${String(next[bank]++).padStart(3, '0')}`;
  if (out[bank].some((x) => x.startsWith(`- id: ${id}`))) throw new Error(`повтор id ${id}`);
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
  if (opts.length !== 4) throw new Error(`${o.lesson}: вариантов ${opts.length}, нужно 4`);
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
const countOf = (s, ch) => [...s].filter((c) => c === ch).length;
const digits = (n) => String(n).split('').map(Number);

// ═════════════ БАНК «Алгоритмы» · 23 задания ═════════════

const STR = 'Сортировки и структуры';

// ── КТП 10 | 11algo-02-debug | этапы решения задач и отладка (3) ──
{
  const n = 5;
  const opts = [
    'Программа завершится с ошибкой: при i = 4 обращение к a[5] выходит за границу списка',
    'Программа выведет правильный максимум: лишний шаг цикла ничего не меняет',
    'Программа выведет 0: несуществующий элемент считается нулём',
    'Программа зациклится и будет обращаться к a[5], a[6], a[7] и дальше',
  ];
  sc('algo', {
    topic: STR, d: 'basic', lesson: '11algo-02-debug', subj: 'inf-11-algo-debug',
    sub: 'Выход за границу списка',
    prompt: `Программа ищет наибольший элемент списка из ${n} чисел так: for i in range(len(a)): если a[i + 1] > best, best = a[i + 1]. Что произойдёт?`,
    opts, correctText: opts[0],
    why: `Обращение идёт к элементу с индексом i + 1, а цикл доходит до i = ${n - 1}. Тогда программа просит a[${n}], а такого элемента нет — Python сообщает IndexError. Классическая ошибка на единицу: либо цикл строят от 0 до n − 2, либо последний элемент обрабатывают отдельно.`,
  });
}
{
  const a = [-5, -3, -8];
  let shown = 0;
  for (const x of a) if (x > shown) shown = x;
  const right = Math.max(...a);
  if (shown !== 0 || right !== -3) throw new Error(`отладка максимума: ${shown}/${right}`);
  num('algo', {
    topic: STR, d: 'basic', lesson: '11algo-02-debug', subj: 'inf-11-algo-debug',
    sub: 'Ошибка начального значения',
    prompt: `Программа ищет наибольший элемент списка a = [${a.join(', ')}], но сначала присваивает best = 0, а затем сравнивает с ним каждый элемент. Какое значение она выведет? Запишите только число.`,
    value: shown,
    why: `Правильный ответ — ${right}, но ни один отрицательный элемент не больше нуля, поэтому best так и останется равным ${shown}. Защита простая: первым берут сам элемент (best = a[0]) либо отдельно проверяют, что список не пуст. Тест из одних отрицательных чисел этот случай ловит сразу.`,
  });
}
{
  const a = [8, 15, 3, 22, 9, 30];
  const limit = 50;
  let s = 0;
  let step = 0;
  const trace = [];
  for (const x of a) {
    s += x;
    step += 1;
    trace.push(`${step}: ${s}`);
    if (s > limit) break;
  }
  if (step !== 5 || s !== 57) throw new Error(`трассировка: ${step}/${s}`);
  cr('algo', {
    topic: STR, d: 'intermediate', lesson: '11algo-02-debug', subj: 'inf-11-algo-debug',
    sub: 'Трассировка до остановки',
    prompt: `Дан список a = [${a.join(', ')}]. Программа накапливает сумму и останавливается, как только сумма превысила ${limit}. Выполните её и выведите через пробел номер шага, на котором произошла остановка, и сумму на этом шаге.`,
    template: `# Считайте сумму и остановитесь, как только она стала больше ${limit}\na = [${a.join(', ')}]\ns = 0\nstep = 0\nfor x in a:\n    s = ...\n    step = ...\n    if s > ${limit}:\n        break\nprint(step, s)`,
    solution: `a = [${a.join(', ')}]
s = 0
step = 0
for x in a:
    s = s + x
    step = step + 1
    if s > ${limit}:
        break
print(step, s)`,
    expected: '5 57',
    why: `Промежуточные суммы: ${trace.join('; ')}. Порог ${limit} превышен только на пятом шаге — до этого сумма была ${trace[3].split(': ')[1]}. Прерывание цикла командой break выводит программу из цикла сразу, а счётчик шагов при этом уже увеличен.`,
  });
}

// ── КТП 11 | 11algo-03-digits | обработка цифр числа (1) ──
{
  const n = 5074;
  const ds = digits(n);
  const product = ds.filter((v) => v !== 0).reduce((p, v) => p * v, 1);
  if (product !== 140) throw new Error(`ненулевые цифры: ${product}`);
  num('algo', {
    topic: STR, d: 'basic', lesson: '11algo-03-digits', subj: 'inf-11-algo-digits',
    sub: 'Произведение ненулевых цифр',
    prompt: `В числе ${n} найдите произведение его ненулевых цифр. Запишите только число.`,
    value: product,
    why: `Цифры числа: ${ds.join(', ')}. Нулевые цифры в произведение не входят — иначе результат сразу стал бы нулём, поэтому их пропускают. Остальные перемножают: ${ds.filter((v) => v !== 0).join(' · ')} = ${product}.`,
  });
}

// ── КТП 12 | 11algo-04-sequence | обработка последовательности (1) ──
{
  const a1 = 7;
  const d = 4;
  const k = 100;
  const ak = a1 + (k - 1) * d;
  if (ak !== 403) throw new Error(`сотый член: ${ak}`);
  num('algo', {
    topic: STR, d: 'basic', lesson: '11algo-04-sequence', subj: 'inf-11-algo-seq',
    sub: 'Член арифметической прогрессии',
    prompt: `Арифметическая прогрессия начинается с ${a1}, а её разность равна ${d}. Чему равен сотый член прогрессии? Запишите только число.`,
    value: ak,
    why: `Общий член арифметической прогрессии: aₙ = a₁ + (n − 1) · d. Для сотого члена это a₁ + 99 · d = ${a1} + 99 · ${d} = ${ak}. Множитель именно 99, а не 100: между первым и сотым членом всего ${k - 1} шагов.`,
  });
}

// ── КТП 13 | 11algo-05-enumeration | метод перебора (1) ──
{
  let threeDigit = 0;
  const check = [];
  for (let a = 1; a <= 9; a++) {
    for (let b = 0; b <= 9; b++) {
      for (let c = 0; c <= 9; c++) {
        if (a !== b && b !== c && a !== c) threeDigit += 1;
      }
    }
  }
  const byFormula = 9 * 9 * 8;
  if (threeDigit !== 648 || threeDigit !== byFormula) throw new Error(`различные цифры: ${threeDigit}/${byFormula}`);
  num('algo', {
    topic: STR, d: 'basic', lesson: '11algo-05-enumeration', subj: 'inf-11-algo-enum',
    sub: 'Перебор с условием на цифры',
    prompt: 'Сколько существует трёхзначных чисел, у которых все три цифры различны? Запишите только число.',
    value: threeDigit,
    why: `Перебор трёх вложенных циклов даёт ${threeDigit}. Проверка формулой: первую цифру выбираем ${9} способами (1–9), вторую — ${9} способами (0–9, кроме первой цифры), третью — ${8} способами. Итого 9 · 9 · 8 = ${byFormula}. Ноль первой цифрой быть не может — иначе число окажется двузначным.`,
  });
}

// ── КТП 14 | 11algo-06-sorting | алгоритмы сортировки (4) ──
{
  const n = 10;
  const perPass = n - 1;
  if (perPass !== 9) throw new Error(`сравнений за проход: ${perPass}`);
  num('algo', {
    topic: STR, d: 'basic', lesson: '11algo-06-sorting', subj: 'inf-11-algo-sort',
    sub: 'Один проход пузырьковой сортировки',
    prompt: `За один полный проход пузырьковой сортировки по списку из ${n} элементов сколько раз сравниваются соседние элементы? Запишите только число.`,
    value: perPass,
    why: `Соседних пар в списке из ${n} элементов ровно на одну меньше, чем элементов: ${n} − 1 = ${perPass} (пары 0–1, 1–2, …, ${n - 2}–${n - 1}). Именно столько сравнений делает внутренний цикл за один проход, а за весь алгоритм — не больше n(n − 1)/2.`,
  });
}
{
  const opts = [
    'Выстраивает элементы по количеству их значений, не сравнивая элементы попарно',
    'Считает число сравнений и печатает его в конце работы',
    'Сортирует только числа, а строки оставляет в исходном порядке',
    'Удаляет из списка повторяющиеся элементы',
  ];
  sc('algo', {
    topic: STR, d: 'basic', lesson: '11algo-06-sorting', subj: 'inf-11-algo-sort',
    sub: 'Сортировка подсчётом',
    prompt: 'Чем отличается сортировка подсчётом от остальных способов сортировки?',
    opts, correctText: opts[0],
    why: 'Сортировка подсчётом сначала подсчитывает, сколько раз встречается каждое значение, а затем выкладывает элементы по этим частотам. Сравнения элементов между собой при этом не нужны совсем, поэтому она работает за O(n + k), где k — число различных значений. Побочная сторона: значения должны быть небольшими целыми числами.',
  });
}
{
  const a = [5, 2, 8, 1, 9];
  const sorted = [...a].sort((x, y) => x - y);
  const worst = (a.length * (a.length - 1)) / 2;
  // Тот же алгоритм в JS — для числа сравнений и для проверки порядка.
  const work = [...a];
  let cmp = 0;
  for (let i = 1; i < work.length; i++) {
    const key = work[i];
    let j = i - 1;
    while (j >= 0 && work[j] > key) {
      work[j + 1] = work[j];
      j -= 1;
      cmp += 1;
    }
    work[j + 1] = key;
  }
  if (work.join(' ') !== sorted.join(' ') || cmp !== 4) throw new Error(`вставками: ${work}/${cmp}`);
  const sol = `a = [${a.join(', ')}]
n = len(a)
cmp = 0
for i in range(1, n):
    key = a[i]
    j = i - 1
    while j >= 0 and a[j] > key:
        a[j + 1] = a[j]
        j = j - 1
        cmp = cmp + 1
    a[j + 1] = key
print(*a)
print(cmp)`;
  cr('algo', {
    topic: STR, d: 'intermediate', lesson: '11algo-06-sorting', subj: 'inf-11-algo-sort',
    sub: 'Сортировка вставками',
    prompt: `Отсортируйте список ${JSON.stringify(a)} сортировкой вставками: просматривайте элементы слева направо и вставляйте каждый в уже отсортированную часть, сдвигая элементы вправо. Сравнением считайте каждое срабатывание условия «элемент больше вставляемого». Выведите сначала отсортированный список через пробел, затем на новой строке — число сравнений.`,
    template: `# Сортировка вставками со счётом сравнений\na = ${JSON.stringify(a)}\nn = len(a)\ncmp = 0\nfor i in range(1, n):\n    key = a[i]\n    j = i - 1\n    while ...:\n        # сдвигаем элемент вправо и считаем сравнение\n        ...\n    a[j + 1] = key\nprint(*a)\nprint(cmp)`,
    solution: sol,
    why: `Сортировка вставками дала ${sorted.join(', ')} всего за ${cmp} сравнения, а не ${worst}: элемент 2 встал на место после одного сдвига, 8 — без единого сравнения, а 1 сдвинул за собой три элемента. В худшем случае (обратный порядок) сравнений будет n(n − 1)/2 = ${worst}, то есть столько же, сколько у сортировки выбором.`,
  });
}
{
  const items = [[1, 70], [2, 90], [3, 70], [4, 50]];
  const sol = `items = [${items.map((it) => `(${it[0]}, ${it[1]})`).join(', ')}]
n = len(items)
swaps = 0
for i in range(n - 1):
    for j in range(0, n - 1 - i):
        # слева меньше балл, чем справа — меняем пары местами
        if items[j][1] < items[j + 1][1]:
            items[j], items[j + 1] = items[j + 1], items[j]
            swaps = swaps + 1
for it in items:
    print(it[0], it[1])
print(swaps)`;
  cr('algo', {
    topic: STR, d: 'intermediate', lesson: '11algo-06-sorting', subj: 'inf-11-algo-sort',
    sub: 'Сортировка по ключу',
    prompt: `Даны пары (№ работы, балл): ${items.map((it) => `(${it[0]}, ${it[1]})`).join(', ')}. Отсортируйте их пузырьковой сортировкой по убыванию балла: меняйте местами соседние пары, только если балл слева меньше балла справа. Выведите пары построчно — сначала номер, затем балл, — в полученном порядке, а на последней строке — число обменов.`,
    template: `# Сортировка пар по второму элементу — по убыванию\nitems = [${items.map((it) => `(${it[0]}, ${it[1]})`).join(', ')}]\nn = len(items)\nswaps = 0\nfor i in range(n - 1):\n    for j in range(0, n - 1 - i):\n        # сравниваем баллы, а не номера\n        ...\nfor it in items:\n    print(it[0], it[1])\nprint(swaps)`,
    solution: sol,
    why: 'Первый же проход ставит на место пару (2, 90), дальше обменов нет — всего 1 обмен. Важная деталь: пары (1, 70) и (3, 70) не поменялись местами, потому что мы меняем элементы только при строгом неравенстве. Именно поэтому пузырьковая сортировка устойчива: элементы с равными ключами сохраняют взаимный порядок.',
  });
}

// ── КТП 15 | 11algo-07-matrix | двумерные массивы: матрицы (4) ──
{
  const rows = 4;
  const cols = 3;
  const i = 3;
  const j = 2;
  const pos = (i - 1) * cols + j;
  if (pos !== 8) throw new Error(`линейный номер: ${pos}`);
  num('algo', {
    topic: STR, d: 'basic', lesson: '11algo-07-matrix', subj: 'inf-11-algo-matrix',
    sub: 'Номер элемента при построчном обходе',
    prompt: `Матрица ${rows} × ${cols} обходится построчно: сначала целиком первая строка, затем вторая и так далее, а внутри строки элементы идут слева направо. Какой номер получит элемент в третьей строке второго столбца, если нумерация начинается с 1? Запишите только число.`,
    value: pos,
    why: `Перед третьей строкой уже пройдено (3 − 1) · ${cols} = ${(i - 1) * cols} элементов, а внутри строки до второго столбца добавляются ещё ${j}. Итого ${(i - 1) * cols} + ${j} = ${pos}. Формула работает именно для построчного обхода: при обходе по столбцам роли строки и столбца меняются местами.`,
  });
}
{
  const n = 5;
  const below = (n * n - n) / 2;
  if (below !== 10) throw new Error(`ниже диагонали: ${below}`);
  num('algo', {
    topic: STR, d: 'basic', lesson: '11algo-07-matrix', subj: 'inf-11-algo-matrix',
    sub: 'Число элементов под диагональю',
    prompt: `В матрице ${n} × ${n} сколько элементов расположено строго ниже главной диагонали? Запишите только число.`,
    value: below,
    why: `Всего элементов ${n * n}, из них ${n} лежат на главной диагонали. Остальные делятся поровну между областями выше и ниже диагонали: (${n * n} − ${n}) / 2 = ${below}. Проверка построчно: под диагональю в строках 2, 3, 4, 5 лежит соответственно 1, 2, 3, 4 элемента, а 1 + 2 + 3 + 4 = ${below}.`,
  });
}
{
  const total = 36;
  const diag = [1, 2, 3, 4];
  const off = total - sum(diag);
  if (off !== 26) throw new Error(`вне диагонали: ${off}`);
  num('algo', {
    topic: STR, d: 'basic', lesson: '11algo-07-matrix', subj: 'inf-11-algo-matrix',
    sub: 'Сумма вне главной диагонали',
    prompt: `Сумма всех элементов матрицы 4 × 4 равна ${total}, а на главной диагонали стоят числа ${diag.join(', ')}. Чему равна сумма элементов, расположенных вне главной диагонали? Запишите только число.`,
    value: off,
    why: `На главной диагонали сумма ${diag.join(' + ')} = ${sum(diag)}. Всего элементов ${total}, поэтому вне диагонали остаётся ${total} − ${sum(diag)} = ${off}. Так считают быстрее, чем обходя матрицу заново: известную часть вычитают.`,
  });
}
{
  const m = [[1, 2, 3], [9, 8, 7], [4, 4, 4], [2, 3, 4]];
  const rowSums = m.map((r) => sum(r));
  const bestI = rowSums.indexOf(Math.max(...rowSums)) + 1;
  const bestS = Math.max(...rowSums);
  if (bestI !== 2 || bestS !== 24) throw new Error(`строка с максимумом: ${bestI}/${bestS}`);
  cr('algo', {
    topic: STR, d: 'intermediate', lesson: '11algo-07-matrix', subj: 'inf-11-algo-matrix',
    sub: 'Строка с наибольшей суммой',
    prompt: `Дана матрица a = [${m.map((r) => `[${r.join(', ')}]`).join(', ')}]. Найдите строку с наибольшей суммой элементов. Выведите номер этой строки (нумерация с единицы) и её сумму через пробел.`,
    template: `# Найдите строку с наибольшей суммой элементов\na = [${m.map((r) => `[${r.join(', ')}]`).join(', ')}]\nbest_i = 0\nbest_s = -1\nfor i in range(len(a)):\n    s = 0\n    for j in range(len(a[i])):\n        # накапливаем сумму строки\n        ...\n    if s > best_s:\n        best_s = ...\n        best_i = ...\nprint(best_i + 1, best_s)`,
    solution: `a = [${m.map((r) => `[${r.join(', ')}]`).join(', ')}]
best_i = 0
best_s = -1
for i in range(len(a)):
    s = 0
    for j in range(len(a[i])):
        s = s + a[i][j]
    if s > best_s:
        best_s = s
        best_i = i
print(best_i + 1, best_s)`,
    expected: `${bestI} ${bestS}`,
    why: `Суммы строк: ${rowSums.map((v, i) => `строка ${i + 1} — ${v}`).join('; ')}. Наибольшая у второй строки, поэтому ответ ${bestI} и ${bestS}. Начальное значение best_s взяли равным −1, а не 0: иначе матрица из одних нулей или отрицательных чисел осталась бы нерассмотренной.`,
  });
}

// ── КТП 16 | 11algo-08-strings | инструменты обработки строк (3) ──
{
  const name = 'Олег';
  const age = 17;
  const line = `Имя: ${name}, возраст: ${age}`;
  const lenLine = line.length;
  if (lenLine !== 22) throw new Error(`длина f-строки: ${lenLine}`);
  num('algo', {
    topic: STR, d: 'basic', lesson: '11algo-08-strings', subj: 'inf-11-algo-strings',
    sub: 'Длина строки из f-строки',
    prompt: `В программе заданы имя «${name}» и возраст ${age}, а строка собирается так: f'Имя: {name}, возраст: {age}'. Сколько символов окажется в полученной строке? Запишите только число.`,
    value: lenLine,
    why: `Подстановка в f-строку даёт «${line}». Считаем: «Имя: » — 5 символов, «${name}» — ${name.length}, запятая — 1, пробел — 1, «возраст:» — 8, пробел — 1, «${age}» — ${String(age).length}. Всего ${lenLine} символа с учётом пробелов и знаков препинания — функция len() считает и их тоже.`,
  });
}
{
  const word = 'Объектно-ориентированное программирование';
  const cnt = countOf(word.toLowerCase(), 'о');
  if (cnt !== 7) throw new Error(`букв «о»: ${cnt}`);
  num('algo', {
    topic: STR, d: 'basic', lesson: '11algo-08-strings', subj: 'inf-11-algo-strings',
    sub: 'Подсчёт без учёта регистра',
    prompt: `В строке «${word}» сколько раз встречается буква «о» в любом регистре — строчная «о» и прописная «О» вместе? Запишите только число.`,
    value: cnt,
    why: `Чтобы не считать дважды, строку сначала приводят к одному регистру: s = s.lower(). После этого буква «о» встречается ${cnt} раз. Прямое сравнение s[i] == 'о' на исходном тексте нашло бы только строчные буквы, а заглавная «О» в начале слова потерялась бы.`,
  });
}
{
  const word = 'информатика';
  const outLine = `${word} (${word.length} символов)`;
  cr('algo', {
    topic: STR, d: 'intermediate', lesson: '11algo-08-strings', subj: 'inf-11-algo-strings',
    sub: 'Сборка строки через f-строку',
    prompt: `Дано слово word = «${word}». Соберите строку вида «<слово> (<количество символов> символов)» с помощью f-строки и выведите её.`,
    template: `# Соберите строку через f-строку\nword = '${word}'\ntext = ...\nprint(text)`,
    solution: `word = '${word}'\ntext = f'{word} ({len(word)} символов)'\nprint(text)`,
    expected: outLine,
    why: `Внутри фигурных скобок f-строки можно писать любое выражение — здесь вызов len(word). Так строка собирается без склейки через плюс и без отдельной переменной для длины. Пробелы вокруг скобок пишут прямо в шаблоне строки.`,
  });
}

// ── КТП 17 | 11algo-09-text-edit | редактирование текста (3) ──
{
  const s = 'ООО Ромашка';
  const cnt = countOf(s.toLowerCase(), 'о');
  if (cnt !== 4) throw new Error(`«о» без регистра: ${cnt}`);
  num('algo', {
    topic: STR, d: 'basic', lesson: '11algo-09-text-edit', subj: 'inf-11-algo-text',
    sub: 'Подсчёт буквы в строке',
    prompt: `В строке «${s}» сколько раз встречается буква «о» — строчная и прописная вместе? Запишите только число.`,
    value: cnt,
    why: `Приводим строку к нижнему регистру и считаем: три «о» в начале плюс одно «о» в слове «ромашка» — всего ${cnt}. Отдельный подсчёт по регистрам дал бы другое число, поэтому для такого вопроса регистр всегда нормализуют.`,
  });
}
{
  const s = 'питон-2019';
  const cleaned = s.replace(/[0-9]/g, '');
  if (cleaned.length !== 6) throw new Error(`после удаления цифр: ${cleaned}`);
  num('algo', {
    topic: STR, d: 'basic', lesson: '11algo-09-text-edit', subj: 'inf-11-algo-text',
    sub: 'Удаление символов по условию',
    prompt: `Из строки «${s}» удалили все цифры. Сколько символов осталось в строке? Запишите только число.`,
    value: cleaned.length,
    why: `Удаляются цифры 2, 0, 1, 9 — это ${s.length - cleaned.length} символа из ${s.length}. Остаётся «${cleaned}», то есть ${cleaned.length} символов. Длина строки не равна числу слов: считаются все символы, включая дефис.`,
  });
}
{
  const s = 'мама мыла раму, мама помогала';
  const after = 'мать мыла раму, мать помогала';
  const cnt = (s.match(/мама/g) ?? []).length;
  if (cnt !== 2 || s.replaceAll('мама', 'мать') !== after) throw new Error(`замена: ${cnt}`);
  cr('algo', {
    topic: STR, d: 'intermediate', lesson: '11algo-09-text-edit', subj: 'inf-11-algo-text',
    sub: 'Замена всех вхождений',
    prompt: `В строке «${s}» замените все вхождения слова «мама» на слово «мать» и выведите полученную строку, а на новой строке — число сделанных замен.`,
    template: `# Замените все вхождения и посчитайте их количество\ns = '${s}'\n# число вхождений подстроки\ncnt = ...\n# замена всех вхождений сразу\nprint(...)\nprint(cnt)`,
    solution: `s = '${s}'\ncnt = s.count('мама')\nprint(s.replace('мама', 'мать'))\nprint(cnt)`,
    expected: `${after}\n${cnt}`,
    why: `Метод replace заменяет сразу все вхождения, а count заранее говорит, сколько их было: ${cnt}. Результат нужно присвоить или напечатать — строки в Python неизменяемы, и просто вызвав replace без присваивания, мы потеряли бы правки.`,
  });
}

// ── КТП 19 | 11algo-11-complexity | оценка сложности (3) ──
{
  const opts = [
    'O(log n): на каждом шаге отбрасывается половина диапазона',
    'O(n): просматриваются все элементы подряд',
    'O(n²): проверяются все пары элементов',
    'O(1): поиск занимает ровно одно действие',
  ];
  sc('algo', {
    topic: STR, d: 'basic', lesson: '11algo-11-complexity', subj: 'inf-11-algo-complex',
    sub: 'Сложность двоичного поиска',
    prompt: 'Какая сложность у двоичного (бинарного) поиска в отсортированном массиве?',
    opts, correctText: opts[0],
    why: 'Двоичный поиск сравнивает элемент с серединой диапазона и отбрасывает половину: 1000 элементов превращаются в 500, 250 и так далее. Диапазон падает вдвое на каждом шаге, поэтому время растёт как O(log n). Линейный поиск, который просматривает элементы подряд, требует O(n) сравнений.',
  });
}
{
  const n = 50;
  const worst = (n * (n - 1)) / 2;
  if (worst !== 1225) throw new Error(`худший случай: ${worst}`);
  num('algo', {
    topic: STR, d: 'basic', lesson: '11algo-11-complexity', subj: 'inf-11-algo-complex',
    sub: 'Сравнения в худшем случае',
    prompt: `Сколько сравнений соседних элементов сделает пузырьковая сортировка в худшем случае для списка из ${n} элементов, расположенных в обратном порядке? Запишите только число.`,
    value: worst,
    why: `В обратном порядке обмен происходит на каждом сравнении, поэтому делается максимум: n(n − 1)/2 = ${n} · ${n - 1} / 2 = ${worst}. Это рост O(n²) — при ${n * 100} элементах сравнений стало бы уже около пяти миллионов, поэтому большие массивы сортируют слиянием или быстрой сортировкой.`,
  });
}
{
  const sizes = [10, 20, 40];
  const work = sizes.map((k) => k * k);
  const sol = `for n in [${sizes.join(', ')}]:
    cnt = 0
    for i in range(n):
        for j in range(n):
            cnt = cnt + 1
    print(n, cnt)`;
  cr('algo', {
    topic: STR, d: 'intermediate', lesson: '11algo-11-complexity', subj: 'inf-11-algo-complex',
    sub: 'Как растёт работа вложенного цикла',
    prompt: `Вложенный цикл считает пары: внешний проходит по n значениям, внутренний — тоже по n. Выполните его для n = ${sizes.join(', ')} и выведите для каждого значения через пробел само n и число выполнений тела цикла (строка на каждое значение).`,
    template: `# Измерьте работу вложенного цикла\nfor n in [${sizes.join(', ')}]:\n    cnt = 0\n    for i in range(n):\n        for j in range(n):\n            # одно выполнение тела цикла\n            ...\n    print(n, cnt)`,
    solution: sol,
    expected: sizes.map((k, i) => `${k} ${work[i]}`).join('\n'),
    why: `Получилось ${sizes.join(' → ')} элементов работы: ${work.join(' → ')}. При каждом удвоении n число операций увеличивается вчетверо — это и есть признак роста O(n²). Линейный алгоритм на тех же данных дал бы ${sizes.join(' → ')}.`,
  });
}

// ═════════════ БАНК «Базы данных» · 7 заданий ═════════════

const DBT = 'Базы данных';

// ── КТП 7 | 11db-01-databases | реляционные модели (4) ──
{
  const opts = [
    'Один ко многим: каждому ученику соответствует ровно один класс, а в классе может быть много учеников',
    'Многие ко многим: ученик может состоять сразу в нескольких классах, а класс — включать много учеников',
    'Один к одному: каждому ученику соответствует ровно один класс, и наоборот',
    'Связи нет: две таблицы просто стоят рядом и никак не зависят друг от друга',
  ];
  sc('db', {
    topic: DBT, d: 'basic', lesson: '11db-01-databases', subj: 'inf-11-db-rel',
    sub: 'Тип связи между таблицами',
    prompt: 'В школе каждый ученик состоит ровно в одном классе, а в классе учатся несколько учеников. Какой тип связи описывает таблица «Ученики» со справочником «Классы»?',
    opts, correctText: opts[0],
    why: 'Это связь «один ко многим»: со стороны ученика поле «код класса» хранит ссылку на одну строку справочника, а на один класс ссылаются многие строки таблицы учеников. Такой столбец называется внешним ключом. Связь «многие ко многим» потребовала бы отдельной таблицы-перекрёстка, а «один к одному» здесь просто противоречит жизни.',
  });
}
{
  const left = ['Сущность', 'Атрибут', 'Связь', 'Первичный ключ'];
  const right = [
    'признак, который однозначно выделяет одну строку среди всех остальных строк таблицы',
    'объект предметной области, которому соответствует строка таблицы: ученик, класс, блюдо',
    'свойство объекта: номер личного дела, фамилия, код класса',
    'отношение между сущностями: ученик состоит в классе',
  ];
  mt('db', {
    topic: DBT, d: 'basic', lesson: '11db-01-databases', subj: 'inf-11-db-design',
    sub: 'Элементы реляционной модели',
    prompt: 'Установите соответствие: элемент реляционной модели — как он устроен на примере школьной базы.',
    left, right,
    map: {
      'Сущность': right[1],
      'Атрибут': right[2],
      'Связь': right[3],
      'Первичный ключ': right[0],
    },
    why: 'Сущность отвечает на вопрос «что описываем» и превращается в таблицу, атрибут — на вопрос «что о нём знаем» и превращается в столбец. Первичный ключ выделяет строку среди остальных: его значения не повторяются и не меняются. Связь показывает, как таблицы зависят друг от друга, и реализуется внешним ключом.',
  });
}
{
  const klassy = [
    { id: 1, name: '11А' },
    { id: 2, name: '11Б' },
  ];
  const uch = [];
  for (let i = 1; i <= 30; i++) uch.push({ id: i, klass: i <= 15 ? 1 : 2 });
  const post = [];
  for (const u of uch) for (let k = 1; k <= 3; k++) post.push({ uch: u.id, k });
  let joined = 0;
  for (const k of klassy) {
    for (const u of uch.filter((x) => x.klass === k.id)) {
      for (const p of post.filter((x) => x.uch === u.id)) joined += 1;
    }
  }
  if (joined !== 90 || post.length !== 90) throw new Error(`двойное соединение: ${joined}/${post.length}`);
  num('db', {
    topic: DBT, d: 'intermediate', lesson: '11db-01-databases', subj: 'inf-11-db-rel',
    sub: 'Число строк после двух соединений',
    prompt: `Таблица «Классы»: код 1 — 11А, код 2 — 11Б, всего ${klassy.length} строки. Таблица «Ученики»: ${uch.length} строк, первые 15 учеников относятся к коду 1, остальные 15 — к коду 2. Таблица «Поставки»: ${post.length} строк, у каждого ученика ровно 3 записи. Сколько строк вернёт запрос SELECT * FROM Классы JOIN Ученики ON Классы.код = Ученики.код_класса JOIN Поставки ON Ученики.номер_дела = Поставки.ученик? Запишите только число.`,
    value: joined,
    why: `Первое соединение даёт ${uch.length} строк: каждый ученик попадает ровно в одну строку справочника «Классы», дублей не возникает. Второе соединение берёт для каждого ученика все его записи из «Поставок» — по 3, то есть ${uch.length} · 3 = ${joined}. Строки не теряются: соединение отбрасывает запись только тогда, когда в справочнике нет подходящего ключа.`,
  });
}
{
  const rows = [
    [1, 'Математика', '02.09'],
    [1, 'Математика', '02.09'],
    [1, 'Физика', '03.09'],
    [2, 'Математика', '02.09'],
    [2, 'Физика', '05.09'],
    [2, 'Физика', '05.09'],
  ];
  const keys = [];
  let dups = 0;
  for (const r of rows) {
    if (keys.some((k) => k.join('|') === r.join('|'))) dups += 1;
    else keys.push(r);
  }
  if (keys.length !== 4 || dups !== 2) throw new Error(`составной ключ: ${keys.length}/${dups}`);
  cr('db', {
    topic: DBT, d: 'advanced', lesson: '11db-01-databases', subj: 'inf-11-db-keys',
    sub: 'Составной ключ',
    prompt: `Таблица «Посещения» хранит тройки (№ ученика, предмет, дата): ${rows.map((r) => `(${r[0]}, «${r[1]}», «${r[2]}»)`).join('; ')}. Составной первичный ключ образуют все три поля вместе: (№ ученика, предмет, дата). Выведите через пробел два числа: сколько различных составных ключей осталось в таблице и сколько строк-полных повторов пришлось удалить.`,
    template: `# Соберите множество составных ключей\nrows = [\n${rows.map((r) => `    (${r[0]}, '${r[1]}', '${r[2]}'),`).join('\n')}\n]\nkeys = []\ndups = 0\nfor row in rows:\n    # полный повтор уже встречался?\n    ...\nprint(len(keys), dups)`,
    solution: `rows = [
${rows.map((r) => `    (${r[0]}, '${r[1]}', '${r[2]}'),`).join('\n')}
]
keys = []
dups = 0
for row in rows:
    if row in keys:
        dups = dups + 1
    else:
        keys.append(row)
print(len(keys), dups)`,
    expected: `${keys.length} ${dups}`,
    why: `По отдельности ни номер ученика, ни предмет, ни дата не дают уникальности: ученик 1 был и на математике, и на физике. Уникальной становится только тройка целиком, поэтому составной ключ даёт ${keys.length} различных значений, а ${dups} полных повтора — это строки, которые база не приняла бы при вставке.`,
  });
}

// ── КТП 8 | 11db-02-queries | запросы к готовой базе (3) ──
{
  const opts = [
    'DISTINCT: оставляет в результате только различные значения выбранного поля',
    'ORDER BY: оставляет в результате только различные значения выбранного поля',
    'GROUP BY: оставляет в результате только различные значения выбранного поля',
    'COUNT: оставляет в результате только различные значения выбранного поля',
  ];
  sc('db', {
    topic: DBT, d: 'basic', lesson: '11db-02-queries', subj: 'inf-11-db-sql',
    sub: 'Убираем повторы в результате',
    prompt: 'Блюдо «Борщ» заказывали четыре раза, и в результате запроса его название встретилось четыре раза подряд. Какое ключевое слово оставит в результате только одно название?',
    opts, correctText: opts[0],
    why: 'DISTINCT убирает одинаковые значения выбранного поля: SELECT DISTINCT название FROM Поставки вернёт «Борщ» один раз. ORDER BY только меняет порядок строк, GROUP BY собирает строки в группы для подсчёта, а COUNT считает их количество — ни одно из этих слов повторы в результате не удаляет.',
  });
}
{
  const opts = [
    'ORDER BY балл DESC',
    'ORDER BY балл ASC',
    'GROUP BY балл DESC',
    'WHERE балл DESC',
  ];
  sc('db', {
    topic: DBT, d: 'basic', lesson: '11db-02-queries', subj: 'inf-11-db-sql',
    sub: 'Сортировка по убыванию',
    prompt: 'Нужно вывести записи о работах так, чтобы они шли от самой высокой оценки к самой низкой. Как закончится запрос?',
    opts, correctText: opts[0],
    why: 'ORDER BY задаёт порядок строк результата, а DESC означает «по убыванию». По умолчанию сортировка и так идёт по возрастанию, поэтому ASC можно не писать, но для читаемости его часто оставляют. GROUP BY не сортирует строки, а объединяет одинаковые значения в группы, а DESC в WHERE не существует вовсе.',
  });
}
{
  const works = [
    [1, 'Программа', 72],
    [2, 'Проект', 91],
    [3, 'Тест', 64],
    [4, 'Эссе', 88],
  ];
  const max = Math.max(...works.map((w) => w[2]));
  const who = works.find((w) => w[2] === max);
  if (max !== 91) throw new Error(`MAX: ${max}`);
  num('db', {
    topic: DBT, d: 'basic', lesson: '11db-02-queries', subj: 'inf-11-db-sql',
    sub: 'Наибольшее значение поля',
    prompt: `Таблица «Работы» (№, тема, балл): ${works.map((w) => `${w[0]} ${w[1]} ${w[2]}`).join('; ')}. Чему равен результат запроса SELECT MAX(балл) FROM Работы? Запишите только число.`,
    value: max,
    why: `Баллы в таблице: ${works.map((w) => `${w[1]} — ${w[2]}`).join('; ')}. Наибольший из них ${max}, он у работы «${who[1]}». Функция MAX возвращает само значение, а не строку: чтобы узнать, чья это работа, добавляют ORDER BY балл DESC LIMIT 1 либо ищут строку с баллом, равным результату.`,
  });
}

// ═════════════ самопроверка, квоты и запись ═════════════

// 1. Каждое сгенерированное задание согласовано само с собой.
const COG_FOR = { basic: 'remember', intermediate: 'apply', advanced: 'analyze' };
for (const [name, items] of Object.entries(out)) {
  for (const item of items) {
    const id = /^- id: (\S+)$/m.exec(item)?.[1];
    const d = /^\s*difficulty: (\S+)$/m.exec(item)?.[1];
    const p = Number(/^\s*points: (\S+)$/m.exec(item)?.[1]);
    const c = /^\s*cognitive_level: (\S+)$/m.exec(item)?.[1];
    const lesson = /^\s*lesson: (\S+)$/m.exec(item)?.[1];
    if (!id || !d || !lesson) throw new Error(`${name}: не разобрано задание ${JSON.stringify(item.slice(0, 60))}`);
    if (!(d in POINTS)) throw new Error(`${id}: неизвестная сложность ${d}`);
    if (p !== POINTS[d]) throw new Error(`${id}: ${d} = ${p} баллов, должно быть ${POINTS[d]}`);
    if (c !== COG_FOR[d]) throw new Error(`${id}: сложность ${d}, а cognitive_level = ${c}`);
    if (!/^\s*subtopic: /m.test(item) || !/^\s*topic: /m.test(item)) throw new Error(`${id}: нет topic/subtopic`);
    if (!/^\s*fgos_requirement: /m.test(item) || !/^\s*fgos: /m.test(item)) throw new Error(`${id}: нет fgos`);
  }
}

// 2. Квоты из задания: урок → { сложность: количество }. Сумма = 30.
const QUOTA = {
  "11algo-02-debug": { basic: 2, intermediate: 1 },
  "11algo-03-digits": { basic: 1 },
  "11algo-04-sequence": { basic: 1 },
  "11algo-05-enumeration": { basic: 1 },
  "11algo-06-sorting": { basic: 2, intermediate: 2 },
  "11algo-07-matrix": { basic: 3, intermediate: 1 },
  "11algo-08-strings": { basic: 2, intermediate: 1 },
  "11algo-09-text-edit": { basic: 2, intermediate: 1 },
  "11algo-11-complexity": { basic: 2, intermediate: 1 },
  "11db-01-databases": { basic: 2, intermediate: 1, advanced: 1 },
  "11db-02-queries": { basic: 3 },
};

const got = {};
const byDiff = { basic: 0, intermediate: 0, advanced: 0 };
const byBank = {};
for (const [name, items] of Object.entries(out)) {
  byBank[name] = items.length;
  for (const item of items) {
    const lesson = /^\s*lesson: (\S+)$/m.exec(item)?.[1];
    if (!lesson) throw new Error(`в ${name} задание без lesson`);
    const d = /^\s*difficulty: (\S+)$/m.exec(item)?.[1];
    if (!(d in byDiff)) throw new Error(`${lesson}: неизвестная сложность ${d}`);
    byDiff[d] += 1;
    got[lesson] ??= { basic: 0, intermediate: 0, advanced: 0 };
    got[lesson][d] += 1;
  }
}
for (const lesson of Object.keys(got)) {
  if (!(lesson in QUOTA)) throw new Error(`лишний урок: ${lesson}`);
}
for (const [lesson, want] of Object.entries(QUOTA)) {
  const have = got[lesson] ?? { basic: 0, intermediate: 0, advanced: 0 };
  for (const d of ['basic', 'intermediate', 'advanced']) {
    if (have[d] !== (want[d] ?? 0)) {
      throw new Error(`${lesson}/${d}: по плану ${want[d] ?? 0}, вышло ${have[d]}`);
    }
  }
}
const TOTAL = Object.values(byBank).reduce((s, n) => s + n, 0);
const PLAN = Object.values(QUOTA).reduce((s, v) => s + Object.values(v).reduce((a, b) => a + b, 0), 0);
if (TOTAL !== PLAN) throw new Error(`всего ожидали ${PLAN} заданий, вышло ${TOTAL}`);
if (TOTAL !== 30) throw new Error(`всего ожидали 30 заданий, вышло ${TOTAL}`);
console.log(`КВОТЫ OK: всего ${TOTAL}`);
console.log(`СЛОЖНОСТИ: basic=${byDiff.basic} intermediate=${byDiff.intermediate} advanced=${byDiff.advanced}`);
console.log(`БАНКИ: ${Object.entries(byBank).map(([n, k]) => `${n}=${k}`).join(' ')}`);
for (const [lesson, want] of Object.entries(QUOTA)) {
  console.log(`  ${lesson}: basic ${got[lesson].basic} / intermediate ${got[lesson].intermediate} / advanced ${got[lesson].advanced}`);
}

if (process.env.PREVIEW) {
  for (const [name, items] of Object.entries(out)) {
    for (const line of items) console.log(line + '\n');
  }
} else {
  for (const [name, b] of Object.entries(BANK)) {
    writeFileSync(b.file, `${heads[name]}\n\n${[MARK, ...out[name]].join('\n\n')}\n`, 'utf-8');
    console.log(`BANK-11-ALGODB-3 OK: ${b.file} — добавлено ${out[name].length} (последний id ${next[name] - 1})`);
  }
  console.log(`BANK-11-ALGODB-3 ИТОГО: ${TOTAL} заданий`);
}