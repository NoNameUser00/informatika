// Дописывает два банка 10 класса — «Документы и мультимедиа» и «Алгебра логики».
//
// Устройство как в scripts/make-10-bank2.mjs и scripts/make-11-bank2.mjs: файл режется
// по своему маркеру MARK, блок пишется заново после него, нумерация продолжается с
// максимального уже существующего номера в своём файле. Второй запуск даёт тот же файл
// байт-в-байт.
//
// Главное правило: ответы считает код.
//  - числовые ответы вычисляются арифметикой и перебором, ключ сверяется assert-ом;
//  - истинность логических формул проверяется перебором ВСЕХ наборов значений
//    переменных (L() — разбор выражения, truthOnes() — подсчёт единиц,
//    equivalent() — равносильность подстановкой), ключ сверяется с ожиданием;
//  - эталоны code_run прогоняются локальным Python, expected_stdout берётся из
//    РЕАЛЬНОГО вывода solution_code, расхождение роняет сборку;
//  - в single_choice правильный вариант задаётся ТЕКСТОМ, буква вычисляется кодом;
//  - answer_map в matching собирается кодом из массивов left/right.
//
// Запуск: node scripts/make-10-medialogic-bank3.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// ═══════════════════════════════ маркер ═══════════════════════════════
const MARK = '# ==== СГЕНЕРИРОВАНО scripts/make-10-medialogic-bank3.mjs ====';

// ─────────────────────────────────────────────────────────────────────────────
// Проверки
// ─────────────────────────────────────────────────────────────────────────────
let checks = 0;
function ok(cond, msg) {
  checks++;
  if (!cond) throw new Error(`ASSERT FAIL: ${msg}`);
}
function eq(got, want, msg) {
  checks++;
  if (got !== want) {
    throw new Error(`ASSERT FAIL: ${msg}: получено ${JSON.stringify(got)}, ожидалось ${JSON.stringify(want)}`);
  }
}

/** Строка в двойных кавычках для YAML: кавычки и переводы строк экранируются. */
const ys = (s) =>
  `"${String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')}"`;

// сложность -> баллы и уровень мышления
const DIFF = {
  basic: { pts: 1, cog: 'remember' },
  intermediate: { pts: 2, cog: 'apply' },
  advanced: { pts: 3, cog: 'analyze' },
};

const LETTERS = 'ABCD';

/** Список целых от a до b включительно — для перебора множеств. */
const range = (a, b) => {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
};

// ═════════════════════ разбор и вычисление логических формул ═════════════════════
// Поддерживаются: скобки, константы 0/1, переменные A-Z, ¬ ∧ ∨ ⊕ → ↔.
// Приоритет как в учебнике: ¬ > ∧ > ∨ > ⊕ > → > ↔.

function L(src) {
  const s = String(src).replace(/\s+/g, '');
  let i = 0;
  const peek = () => s[i];
  const eat = (ch) => {
    ok(peek() === ch, `ожидался «${ch}» в выражении ${src} на позиции ${i}`);
    i++;
  };
  function parseEqv() {
    let left = parseImpl();
    while (peek() === '↔') {
      i++;
      const right = parseImpl();
      const l = left;
      left = (e) => (l(e) === right(e) ? 1 : 0);
    }
    return left;
  }
  function parseImpl() {
    let left = parseXor();
    while (peek() === '→') {
      i++;
      const right = parseXor();
      const l = left;
      left = (e) => (!l(e) || right(e) ? 1 : 0);
    }
    return left;
  }
  function parseXor() {
    let left = parseOr();
    while (peek() === '⊕') {
      i++;
      const right = parseOr();
      const l = left;
      left = (e) => (l(e) !== right(e) ? 1 : 0);
    }
    return left;
  }
  function parseOr() {
    let left = parseAnd();
    while (peek() === '∨') {
      i++;
      const right = parseAnd();
      const l = left;
      left = (e) => (l(e) || right(e) ? 1 : 0);
    }
    return left;
  }
  function parseAnd() {
    let left = parseNot();
    while (peek() === '∧') {
      i++;
      const right = parseNot();
      const l = left;
      left = (e) => (l(e) && right(e) ? 1 : 0);
    }
    return left;
  }
  function parseNot() {
    if (peek() === '¬') {
      i++;
      const x = parseNot();
      return (e) => (x(e) ? 0 : 1);
    }
    return parsePrim();
  }
  function parsePrim() {
    if (peek() === '(') {
      i++;
      const x = parseEqv();
      eat(')');
      return x;
    }
    const ch = s[i];
    if (ch === '0' || ch === '1') {
      i++;
      const c = Number(ch);
      return () => c;
    }
    ok(!!ch && /[A-Z]/.test(ch), `непонятный символ «${ch}» в выражении ${src} на позиции ${i}`);
    i++;
    return (e) => e[ch];
  }
  const fn = parseEqv();
  ok(i === s.length, `лишний хвост «${s.slice(i)}» в выражении ${src}`);
  return fn;
}

/** Переменные выражения в алфавитном порядке. */
const varsOf = (src) => [...new Set(String(src).match(/[A-Z]/g) ?? [])].sort();
const varsBoth = (a, b) => [...new Set([...varsOf(a), ...varsOf(b)])].sort();

/** Все наборы значений переменных: последняя буква меняется быстрее. */
function eachEnv(vars, fn) {
  const out = [];
  for (let mask = 0; mask < 2 ** vars.length; mask++) {
    const env = {};
    vars.forEach((v, k) => {
      env[v] = (mask >> (vars.length - 1 - k)) & 1;
    });
    out.push({ env, v: fn(env) });
  }
  return out;
}

/** Равносильность: проверяется подстановкой всех наборов значений переменных. */
function equivalent(a, b) {
  const vars = varsBoth(a, b);
  return eachEnv(vars, (e) => L(a)(e) === L(b)(e)).every((r) => r.v === true);
}

/** Таблица истинности: строки со значением 1 и их количество. */
function truthOnes(src) {
  const vars = varsOf(src);
  const rows = eachEnv(vars, (e) => L(src)(e));
  const ones = rows.filter((r) => r.v === 1);
  return {
    vars,
    rows,
    ones,
    n: ones.length,
    text: ones.map((r) => vars.map((v) => `${v} = ${r.env[v]}`).join(', ')),
  };
}

/** Решения уравнения «выражение = значение», списком строк и количеством. */
function solveEq(src, target) {
  const vars = varsOf(src);
  const rows = eachEnv(vars, (e) => L(src)(e)).filter((r) => r.v === target);
  return {
    vars,
    rows,
    n: rows.length,
    text: rows.map((r) => vars.map((v) => `${v} = ${r.env[v]}`).join(', ')),
  };
}

// ═══════════════════════════════ банки ═══════════════════════════════

const BANKS = {
  media: {
    key: 'media',
    path: 'data/tasks/10/media/bank-10media.yaml',
    prefix: 'inf-10-media-',
    cls: 10,
    topic: 'Документы и мультимедиа',
    req: 1.1,
    el: 1.1,
    tasks: [],
  },
  logic: {
    key: 'logic',
    path: 'data/tasks/10/logic/bank-10logic.yaml',
    prefix: 'inf-10-logic-',
    cls: 10,
    topic: 'Алгебра логики',
    req: null, // у логики своя пара фгос на каждый урок — берём у соседей
    el: null,
    tasks: [],
  },
};
const use = (key) => {
  const b = BANKS[key];
  ok(!!b, `нет банка ${key}`);
  return b;
};

/** numeric_base: ответ — целое число в основании base (по умолчанию 10). */
function num(o) {
  const bank = use(o.bank);
  const base = o.base ?? 10;
  ok(Number.isInteger(o.dec) && o.dec >= 0, `${o.lesson} [${o.sub}]: нужен неотрицательный целый ответ, получено ${o.dec}`);
  const key = String(o.dec);
  ok(parseInt(key, base) === o.dec, `${o.lesson} [${o.sub}]: ключ «${key}» != ${o.dec} в основании ${base}`);
  ok(!!o.why, `${o.lesson} [${o.sub}]: нет explanation`);
  bank.tasks.push({
    type: 'numeric_base', d: o.d, lesson: o.lesson, sub: o.sub, subj: o.subj, req: o.req, el: o.el,
    prompt: o.prompt,
    view: `{ base: ${base}, placeholder: "только число" }`,
    check: `{ method: numeric_base, base: ${base}, strip_affixes: true }`,
    teacher: `{ accepted_values_decimal: [${o.dec}], answer_text: ${ys(key)}, explanation: ${ys(o.why)} }`,
  });
}

/** single_choice: правильный вариант задаётся ТЕКСТОМ, буква считается кодом. */
function sc(o) {
  const bank = use(o.bank);
  const at = o.opts.indexOf(o.answer);
  ok(at >= 0, `${o.lesson} [${o.sub}]: ответа «${o.answer}» нет среди вариантов ${JSON.stringify(o.opts)}`);
  ok(o.opts.length === 4, `${o.lesson} [${o.sub}]: вариантов должно быть ровно 4, а их ${o.opts.length}`);
  eq(new Set(o.opts).size, o.opts.length, `${o.lesson} [${o.sub}]: варианты повторяются`);
  ok(!!o.why, `${o.lesson} [${o.sub}]: нет explanation`);
  const common = (o.common ?? []).map((t) => ys(t)).join(', ');
  bank.tasks.push({
    type: 'single_choice', d: o.d, lesson: o.lesson, sub: o.sub, subj: o.subj, req: o.req, el: o.el,
    prompt: o.prompt,
    view: `{ options: [${o.opts.map((t, i) => `{ id: ${LETTERS[i]}, text: ${ys(t)} }`).join(', ')}] }`,
    check: `{ method: exact_option }`,
    teacher: `{ answer: ${LETTERS[at]}, explanation: ${ys(o.why)}${common ? `, common_errors: [${common}]` : ''} }`,
  });
  return LETTERS[at];
}

/** matching: слева и справа поровну, все правые ответы различны, ответ_map собирается кодом. */
function ma(o) {
  const bank = use(o.bank);
  ok(o.left.length >= 2, `${o.lesson} [${o.sub}]: в matching нужно минимум 2 пары`);
  eq(new Set(o.left).size, o.left.length, `${o.lesson} [${o.sub}]: левые варианты повторяются`);
  eq(new Set(o.right).size, o.right.length, `${o.lesson} [${o.sub}]: правые варианты повторяются`);
  eq(Object.keys(o.map).length, o.left.length, `${o.lesson} [${o.sub}]: answer_map должен покрыть все левые`);
  for (const k of o.left) {
    ok(!!o.map[k], `${o.lesson} [${o.sub}]: нет ответа для «${k}»`);
    ok(o.right.includes(o.map[k]), `${o.lesson} [${o.sub}]: ответ «${o.map[k]}» не среди правых`);
  }
  eq(new Set(Object.values(o.map)).size, o.left.length, `${o.lesson} [${o.sub}]: ответы соответствия повторяются`);
  ok(!!o.why, `${o.lesson} [${o.sub}]: нет explanation`);
  bank.tasks.push({
    type: 'matching', d: o.d, lesson: o.lesson, sub: o.sub, subj: o.subj, req: o.req, el: o.el,
    prompt: o.prompt,
    view: `{ left: [${o.left.map((x) => ys(x)).join(', ')}], right: [${o.right.map((x) => ys(x)).join(', ')}] }`,
    check: `{ method: matching, partial: proportional }`,
    teacher: `{ answer_map: { ${o.left.map((k) => `${ys(k)}: ${ys(o.map[k])}`).join(', ')} }, explanation: ${ys(o.why)} }`,
  });
}

/** Локальный прогон эталона: stdout без хвостовых переводов строк. */
function py(code) {
  const args = ['-c', code];
  const opts = { encoding: 'utf-8', env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } };
  let res;
  try {
    res = execFileSync('python3', args, opts);
  } catch {
    res = execFileSync('python', args, opts);
  }
  return res.replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

/** code_run: expected_stdout = реальный вывод solution_code. */
function cr(o) {
  const bank = use(o.bank);
  const outp = py(o.solution);
  ok(!!outp, `${o.lesson} [${o.sub}]: эталон ничего не вывел`);
  if (o.expected !== undefined && o.expected !== outp) {
    throw new Error(
      `ASSERT FAIL: ${o.lesson} [${o.sub}]: эталон не сошёлся\nожидалось: ${JSON.stringify(o.expected)}\nполучили:  ${JSON.stringify(outp)}`,
    );
  }
  ok(!!o.why, `${o.lesson} [${o.sub}]: нет explanation`);
  bank.tasks.push({
    type: 'code_run', d: o.d, lesson: o.lesson, sub: o.sub, subj: o.subj, req: o.req, el: o.el,
    prompt: o.prompt,
    view: `{ language: python, template: ${ys(o.template)} }`,
    check: `{ method: code_stdout, timeout_s: 10 }`,
    teacher: `{ solution_code: ${ys(o.solution)}, expected_stdout: ${ys(outp)}, explanation: ${ys(o.why)} }`,
  });
  return outp;
}

// ═══════════════════ КТП 32 | 10gfx-03-editor | растровый редактор ═══════════════════
// Повторяем сторону соседей: урок в файле 1.1/1.1, предмет inf-10-gfx-editor.
{
  const w = 2400;
  const dpi = 300;
  const inches = w / dpi;
  ok(Number.isInteger(inches), `дюймы не целые: ${inches}`);
  eq(inches, 8, 'ширина в дюймах');
  num({
    bank: 'media', d: 'basic', lesson: '10gfx-03-editor', sub: 'Печать и разрешение',
    subj: 'inf-10-gfx-editor', req: 1.1, el: 1.1,
    prompt: `Фотографию ${w} × 1800 пикселей печатают с разрешением ${dpi} точек на дюйм. Сколько дюймов она займёт по ширине? Запишите только число.`,
    dec: inches,
    why: `Ширина в дюймах равна числу пикселей, делённому на разрешение: ${w} / ${dpi} = ${inches}. Разрешение показывает, сколько пикселей приходится на один дюйм. Чем оно выше, тем меньше физический размер при том же числе пикселей, и наоборот: для печати крупного плана разрешение поднимают, добавляя пиксели.`,
  });
}
{
  const opts = [
    'Оттенок совпадает с образцом, поэтому заливка выглядит частью той же фотографии',
    'Пипетка запоминает цвет и сразу применяет его ко всем слоям изображения',
    'Пипетка выравнивает яркость и контраст всего изображения',
    'Пипетка уменьшает размер файла, потому что цвета становятся однообразными',
  ];
  sc({
    bank: 'media', d: 'basic', lesson: '10gfx-03-editor', sub: 'Пипетка и цвет',
    subj: 'inf-10-gfx-editor', req: 1.1, el: 1.1,
    prompt: 'В растровом редакторе цвет для заливки взяли пипеткой прямо с фотографии. Почему так надёжнее, чем подбирать цвет вручную в палитре?',
    opts,
    answer: opts[0],
    common: ['Пипетка нужна только для выбора чёрного или белого цвета'],
    why: 'Пипетка считывает значения каналов прямо с пикселя, поэтому попадает в тот самый оттенок, который уже есть в изображении. Подбор вручную почти всегда даёт близкий, но не совпадающий цвет, и закрашенная область заметно выделяется на снимке.',
  });
}

// ═══════════════════ КТП 33 | 10gfx-04-vector | векторная графика ═══════════════════
{
  const left = ['Прямоугольник', 'Эллипс', 'Многоугольник', 'Звёздочка'];
  const right = [
    'четыре прямые стороны под прямыми углами',
    'замкнутая кривая, у которой расстояние от центра до любой точки одинаково',
    'замкнутая ломаная из трёх и более отрезков',
    'фигура из чередующихся входящих и исходящих лучей',
  ];
  const map = Object.fromEntries(left.map((l, i) => [l, right[i]]));
  eq(Object.keys(map).length, 4, 'примитивы: число пар');
  ma({
    bank: 'media', d: 'basic', lesson: '10gfx-04-vector', sub: 'Примитивы вектора',
    subj: 'inf-10-gfx-vector', req: 1.1, el: 1.1,
    prompt: 'Установите соответствие: примитив векторного редактора — какой фигурой он является.',
    left, right, map,
    why: 'В векторном редакторе сложную схему собирают из готовых примитивов: прямоугольник и эллипс задаются положением сторон или радиусами, многоугольник — списком вершин, а звёздочка расставляется по чередующимся лучам. Плюс всех примитивов в том, что их можно объединять, группировать и менять размер без потери формы.',
  });
}
{
  const k = 3;
  const areaRatio = k * k;
  eq(areaRatio, 9, 'площадь при уменьшении в 3 раза');
  num({
    bank: 'media', d: 'basic', lesson: '10gfx-04-vector', sub: 'Масштаб и площадь',
    subj: 'inf-10-gfx-vector', req: 1.1, el: 1.1,
    prompt: `Векторный рисунок уменьшили в ${k} раза по каждой стороне. Во сколько раз уменьшилась площадь его фигур? Запишите только число.`,
    dec: areaRatio,
    why: `По стороне размер изменился в ${k} раза, а площадь растёт как квадрат размера: ${k} · ${k} = ${areaRatio}. Именно поэтому в векторе можно менять размер сколько угодно и качество не падает: координаты пересчитываются по формуле, а картинка не перерисовывается попиксельно.`,
  });
}

// ═══════════════════ КТП 34 | 10gfx-05-3d | трёхмерное моделирование ═══════════════════
{
  const left = ['Примитив', 'Вытягивание', 'Тело вращения', 'Рендер'];
  const right = [
    'простое тело — куб, цилиндр, сфера, из которого собирают остальные детали',
    'профиль, протянутый вдоль прямой, даёт объёмное тело',
    'профиль, повёрнутый вокруг оси, даёт симметричное тело вращения',
    'расчёт изображения сцены с учётом материала, освещения и теней',
  ];
  const map = Object.fromEntries(left.map((l, i) => [l, right[i]]));
  eq(Object.keys(map).length, 4, '3D: число пар');
  ma({
    bank: 'media', d: 'basic', lesson: '10gfx-05-3d', sub: 'Приёмы моделирования',
    subj: 'inf-10-gfx-3d', req: 1.1, el: 1.1,
    prompt: 'Установите соответствие: приём работы в 3D-редакторе — что он делает.',
    left, right, map,
    why: 'Модель почти никогда не лепят с нуля: сначала берут примитив, потом получают форму вытягиванием профиля вдоль прямой или вращением его вокруг оси. Готовая сцена становится картинкой только после рендера — расчёта, который учитывает материал и свет.',
  });
}
{
  // Поверхность разбита на треугольники: считаем вершины по граням.
  const tris = 250;
  const perTri = 3;
  const shared = 2; // каждая вершина принадлежит двум треугольникам
  const verts = (tris * perTri) / shared;
  eq(tris * perTri, 750, 'вершин с повторениями');
  ok(Number.isInteger(verts), `вершины не целые: ${verts}`);
  eq(verts, 375, 'уникальных вершин');
  num({
    bank: 'media', d: 'basic', lesson: '10gfx-05-3d', sub: 'Вершины и грани модели',
    subj: 'inf-10-gfx-3d', req: 1.1, el: 1.1,
    prompt: `Поверхность детали в 3D-редакторе разбита на ${tris} треугольников, у каждого по ${perTri} вершины, но каждая вершина принадлежит сразу ${shared} треугольникам. Сколько уникальных вершин у модели? Запишите только число.`,
    dec: verts,
    why: `Если сложить вершины всех граней, получится ${tris} · ${perTri} = ${tris * perTri}, но каждая вершина посчитана ${shared} раза — по разу для каждого из двух треугольников, которые её используют. Поэтому делим на ${shared}: ${tris * perTri} / ${shared} = ${verts}. Именно так счётчики вершин и работают в 3D-редакторе при импорте моделей из игр.`,
  });
}

// ═══════════════════ КТП 30 | 10media-02-review | повторение блока ═══════════════════
{
  const left = ['Растровое изображение', 'Векторное изображение', 'Трёхмерная модель', 'Мультимедийный объект'];
  const right = [
    'хранит цвет каждого пикселя, поэтому при увеличении появляются блоки',
    'хранит форму фигур, поэтому масштабируется без потерь качества',
    'состоит из вершин, рёбер и граней и показывается с любого ракурса',
    'объединяет несколько видов информации: текст, графику, звук и видео',
  ];
  const map = Object.fromEntries(left.map((l, i) => [l, right[i]]));
  eq(Object.keys(map).length, 4, 'понятия блока: число пар');
  ma({
    bank: 'media', d: 'basic', lesson: '10media-02-review', sub: 'Понятия блока',
    subj: 'inf-10-media-review', req: 1.1, el: 1.1,
    prompt: 'Установите соответствие: понятие блока «графика и мультимедиа» — какой признак за ним стоит.',
    left, right, map,
    why: 'Четыре понятия различаются именно тем, что хранится в файле. Растр хранит пиксели, вектор — форму, 3D-модель — вершины и грани, а мультимедийный объект — несколько видов информации сразу. Путать их опасно: от того, что именно хранится, зависит, можно ли увеличить рисунок и переживёт ли файл перенос на другой компьютер.',
  });
}
{
  const opts = [
    'набрать текст и расставить заголовки стилями → вставить иллюстрации, добавить подписи и ссылки → проверить оглавление и номера страниц → сохранить готовый документ и его копию в PDF',
    'вставить все иллюстрации → набрать текст → проставить номера страниц вручную → сохранить документ',
    'набрать текст → сохранить документ → вставить иллюстрации → оформить заголовки стилями',
    'оформить заголовки стилями → вставить иллюстрации → набрать текст → сохранить документ',
  ];
  sc({
    bank: 'media', d: 'basic', lesson: '10media-02-review', sub: 'Порядок работы над документом',
    subj: 'inf-10-media-review', req: 1.1, el: 1.1,
    prompt: 'В каком порядке готовят документ со стилями, оглавлением и списком иллюстраций?',
    opts,
    answer: opts[0],
    why: 'Сначала создают структуру — текст и заголовки стилями, и только потом наполняют её иллюстрациями и подписями. Дальше проверяют то, что зависит от структуры: оглавление, перекрёстные ссылки и номера страниц. Иначе ссылки разъезжаются, а в оглавлении появляются пустые и неверные строки.',
  });
}

// ═══════════════════ КТП 31 | 10media-03-typeset | вёрстка и таблицы ═══════════════════
{
  const rows = 4;
  const cols = 3;
  const perCell = 8;
  const cells = rows * cols;
  const chars = cells * perCell;
  eq(cells, 12, 'ячейки таблицы');
  eq(chars, 96, 'символов в таблице');
  num({
    bank: 'media', d: 'basic', lesson: '10media-03-typeset', sub: 'Объём таблицы',
    subj: 'inf-10-media-typeset', req: 1.1, el: 1.1,
    prompt: `В документе таблица из ${rows} строк и ${cols} столбцов. В каждой ячейке в среднем ${perCell} символов. Сколько символов помещается во всей таблице? Запишите только число.`,
    dec: chars,
    why: `Сначала число ячеек: ${rows} · ${cols} = ${cells}. Потом символы по всем ячейкам: ${cells} · ${perCell} = ${chars}. В LibreOffice Writer то же даёт подсчёт слов и знаков при выделенном диапазоне таблицы.`,
  });
}
{
  const opts = [
    'Нумерация пересчитается сама при вставке пункта, а при наборе вручную придётся исправлять весь список',
    'Ручные номера видно сразу, а автоматические номера не видны в тексте',
    'Стиль списка не позволяет менять отступы, поэтому список приходится набирать вручную',
    'Стиль списка нельзя применить к уже набранному тексту, поэтому его пишут от руки',
  ];
  sc({
    bank: 'media', d: 'basic', lesson: '10media-03-typeset', sub: 'Стиль списка',
    subj: 'inf-10-media-typeset', req: 1.1, el: 1.1,
    prompt: 'Почему нумерованный список в документе оформляют стилем списка, а не проставляют номера вручную?',
    opts,
    answer: opts[0],
    common: ['Ручные номера не видны, а стиль списка их подставляет'],
    why: 'Стиль списка хранит не сами номера, а правило их построения. Если в середину списка вставить пункт, номера пересчитаются сами; если номера набраны вручную, придётся править их до конца списка. Тот же приём работает для заголовков: стиль «Заголовок» сам попадает в оглавление.',
  });
}

// ═══════════════════ КТП 35 | 10media-04-multimedia | мультимедиа ═══════════════════
{
  const rate = 8000; // Гц
  const bits = 16; // бит на отсэмпл
  const ch = 2; // стерео
  const sec = 5; // секунд
  const bytes = (rate * bits * ch * sec) / 8;
  const bitsTotal = rate * bits * ch * sec;
  ok(Number.isInteger(bytes), `байты не целые: ${bytes}`);
  eq(bytes, bitsTotal / 8, 'размер звукового файла = биты / 8');
  eq(bytes, 160000, 'размер звукового файла');
  num({
    bank: 'media', d: 'basic', lesson: '10media-04-multimedia', sub: 'Размер звукового файла',
    subj: 'inf-10-media-mm', req: 1.1, el: 1.1,
    prompt: `Звук записан с частотой дискретизации ${rate} Гц, глубиной звука ${bits} бит, в двух каналах (стерео), длительностью ${sec} секунд. Сколько байт займёт файл без сжатия? Запишите только число.`,
    dec: bytes,
    why: `Размер равен произведению частоты, глубины, числа каналов и времени: ${rate} · ${bits} · ${ch} · ${sec} = ${bitsTotal} бит. Один байт — это 8 бит, поэтому делим на 8 и получаем ${bytes} байт. В презентацию такой файл вставляют как объект, а не как ссылку, иначе он не заработает без исходника.`,
  });
}
{
  const opts = [
    'Перекодировать ролик в универсальный формат и встроить его в файл презентации',
    'Переименовать файл видео, чтобы расширение совпадало с расширением презентации',
    'Отправить ролик отдельным письмом и оставить в презентации только ссылку на него',
    'Ничего не делать: любой видеофайл воспроизводится на любом компьютере',
  ];
  sc({
    bank: 'media', d: 'basic', lesson: '10media-04-multimedia', sub: 'Совместимость видео',
    subj: 'inf-10-media-mm', req: 1.1, el: 1.1,
    prompt: 'Ролик вставлен в презентацию в том формате, который школьный компьютер не воспроизводит. Что нужно сделать до защиты?',
    opts,
    answer: opts[0],
    common: ['Достаточно переименовать файл видео в то же расширение, что у презентации'],
    why: 'Формат контейнера и кодек внутри него знают не все проигрыватели, поэтому запись может не открыться на чужом компьютере. Надёжный способ — сжать и перекодировать ролик в распространённый формат, встроить его в файл презентации и проверить показ на том же компьютере, с которого планируют выступать.',
  });
}

// ═══════════════════ КТП 36 | 10media-05-presentation | презентация ═══════════════════
{
  const sec = 30;
  const fps = 25;
  const w = 320;
  const h = 240;
  const bits = 24;
  const frames = sec * fps;
  const frameBytes = (w * h * bits) / 8;
  const total = frames * frameBytes;
  eq(frames, 750, 'кадров в ролике');
  eq(frameBytes, 230400, 'байт в кадре');
  eq(total, 172800000, 'байт всего ролика');
  const mib = Math.round((total / 1048576) * 10) / 10;
  eq(mib, 164.8, 'мегабайт без сжатия');
  cr({
    bank: 'media', d: 'basic', lesson: '10media-05-presentation', sub: 'Кадры и объём ролика',
    subj: 'inf-10-media-pres', req: 1.1, el: 1.1,
    prompt: `Ролик длится ${sec} секунд при ${fps} кадрах в секунду, каждый кадр — изображение ${w} × ${h} пикселей с глубиной цвета ${bits} бита. Напишите программу, которая посчитает общее число кадров и объём ролика без сжатия в байтах. Выведите два числа через пробел: сначала число кадров, затем объём в байтах.`,
    template: `# Посчитай кадры и объём ролика без сжатия\nsec = ${sec}\nfps = ${fps}\nw = ${w}\nh = ${h}\nbits = ${bits}\n\n# кадр — это w * h пикселей, на каждый пиксель приходится bits // 8 байт\nframe_bytes = ...\n# число кадров — это sec умножить на fps\nframes = ...\n\n# выведи сначала число кадров, затем объём всего ролика\nprint(frames, frames * frame_bytes)`,
    solution: `sec = ${sec}
fps = ${fps}
w = ${w}
h = ${h}
bits = ${bits}

frame_bytes = w * h * (bits // 8)
frames = sec * fps

print(frames, frames * frame_bytes)`,
    expected: '750 172800000',
    why: `Число кадров равно времени, умноженному на частоту кадров: ${sec} · ${fps} = ${frames}. Объём одного кадра — это ${w} · ${h} = ${w * h} пикселей по 3 байта (RGB), то есть ${frameBytes} байт. Весь ролик без сжатия занял бы ${frames} · ${frameBytes} = ${total} байт — это примерно ${String(mib).replace('.', ',')} Мбайт, поэтому видео обязательно сжимают перед тем, как вставлять в презентацию.`,
  });
}
{
  const opts = [
    'Переход задаёт, как один слайд сменяет другой, а анимация — как появляется или исчезает объект внутри слайда',
    'Переход и анимация делают одно и то же, поэтому в презентации достаточно только переходов',
    'Анимация нужна для смены слайдов, а переход — для появления текста на одном слайде',
    'Переходы применяют только к текстовым слайдам, анимацию — только к рисункам',
  ];
  sc({
    bank: 'media', d: 'basic', lesson: '10media-05-presentation', sub: 'Переходы и анимация',
    subj: 'inf-10-media-pres', req: 1.1, el: 1.1,
    prompt: 'Чем переход между слайдами отличается от анимации объекта на слайде?',
    opts,
    answer: opts[0],
    why: 'Переход отвечает за момент смены слайдов: жёлтый, «влево», «шахматная доска» и так далее. Анимация отвечает за поведение содержимого внутри слайда — как выезжает заголовок или исчезает старая картинка. И то и другое должно быть сдержанным: показ без лишних эффектов читается лучше.',
  });
}

// ═══════════════════ КТП 20 | 10logic-01-ops | логические операции ═══════════════════
{
  const expr = '¬(1 ∧ 1) ∨ (1 ⊕ 0)';
  const shown = '¬(1 ∧ 1) ∨ (1 ⊕ 0)';
  const value = L(expr)({});
  eq(value, 1, `${expr} должно быть равно 1`);
  ok(equivalent(expr, '1'), `${expr} должно быть тождественно истинным`);
  ok(!equivalent(expr, '0'), `${expr} не должно быть тождественно ложным`);
  const opts = [
    '1',
    '0',
    'Вычислить нельзя: выражение записано не в базисе И, ИЛИ и НЕ',
    'Значение зависит от того, в каком порядке выполнить операции',
  ];
  sc({
    bank: 'logic', d: 'basic', lesson: '10logic-01-ops', sub: 'Вычисление выражения',
    subj: 'inf-10-logic-ops', req: 1.3, el: 1.5,
    prompt: `Вычислите значение выражения ${shown}. Здесь 1 — истина, 0 — ложь.`,
    opts,
    answer: opts[0],
    common: ['«Значение зависит от порядка операций»: порядок выполнения в выражении задан скобками'],
    why: `Сначала конъюнкция: 1 ∧ 1 = 1, поэтому ¬1 = 0. Затем исключающее ИЛИ: 1 ⊕ 0 = 1, потому что значения различаются. И наконец дизъюнкция: 0 ∨ 1 = ${value}. Порядок операций менять нельзя: сначала отрицание и связки внутри скобок, потом связки между ними. Формулу можно проверить перебором всех наборов значений переменных — здесь переменных нет, поэтому набор всего один.`,
  });
}

// ═══════════════════ КТП 21 | 10logic-03-truth | таблицы истинности ═══════════════════
{
  const imp = 'A → B';
  const vars = varsOf(imp);
  eq(vars.join(','), 'A,B', 'переменные импликации');
  const rows = eachEnv(vars, (e) => L(imp)(e));
  eq(rows.length, 4, 'строк в таблице истинности');
  const zeros = rows.filter((r) => r.v === 0);
  const ones = rows.filter((r) => r.v === 1);
  eq(zeros.length, 1, 'у импликации ровно одна нулевая строка');
  eq(zeros[0].env.A, 1, 'в нулевой строке A = 1');
  eq(zeros[0].env.B, 0, 'в нулевой строке B = 0');
  eq(ones.length, 3, 'истинных строк три');
  const counter = eachEnv(vars, (e) => L('B → A')(e)).find((r) => r.env.B === 1 && r.env.A === 0 && r.v === 0);
  ok(!!counter, 'обратная импликация должна иметь контрпример B = 1, A = 0');
  ok(!equivalent(imp, 'B → A'), 'импликация не равносильна обратной');
  ok(L('A ∨ B')({ A: 1, B: 1 }) === 1, 'при A = B = 1 дизъюнкция истинна');
  const opts = [
    'Если A истинно, то B обязательно истинно',
    'Если B истинно, то A обязательно истинно',
    'A всегда истинно, иначе импликация была бы ложной',
    'A и B не могут быть одновременно истинны',
  ];
  sc({
    bank: 'logic', d: 'basic', lesson: '10logic-03-truth', sub: 'Условие и следствие',
    subj: 'inf-10-logic-truth', req: 1.3, el: 1.5,
    prompt: 'Из истинного условия A → B что следует?',
    opts,
    answer: opts[0],
    why: `Импликация A → B ложна только в одной строке таблицы: A = 1, B = 0. Во всех остальных строках, а их ${ones.length} из ${rows.length}, она истинна. Поэтому из условия следует, что при истинном A значение B обязательно истинно — это прямое утверждение импликации. Обратное («из B следует A») неверно: при A = 0, B = 1 условие истинно, а B → A ложно, поэтому равносильными они не являются.`,
  });
}

// ═══════════════════ КТП 23 | 10logic-04-normal | нормальные формы ═══════════════════
{
  const src = '(A ∨ B) ∧ C';
  const { vars, n, text } = truthOnes(src);
  eq(vars.join(','), 'A,B,C', 'переменные');
  eq(n, 3, 'число строк с единицей');
  ok(equivalent(src, 'C ∧ (A ∨ B)'), `${src} должно совпадать с C ∧ (A ∨ B)`);
  ok(!equivalent(src, 'A ∧ B ∧ C'), `${src} не должно совпадать с A ∧ B ∧ C`);
  num({
    bank: 'logic', d: 'basic', lesson: '10logic-04-normal', sub: 'Строки с единицей и ДНФ',
    subj: 'inf-10-logic-nf', req: 1.4, el: 1.6,
    prompt: `Постройте таблицу истинности выражения ${src}. Сколько конъюнкций (строк, где значение равно 1) войдёт в его совершенную ДНФ? Запишите только число.`,
    dec: n,
    why: `Строка даёт единицу, только если C = 1 и при этом хотя бы одно из A и B истинно. Таких строк ${n}: ${text.join('; ')}. Каждой такой строке соответствует одна конъюнкция совершенной ДНФ, поэтому конъюнкций тоже ${n}. Дальше выражение упрощают до C ∧ (A ∨ B), и конъюнкций станет две, но у совершенной ДНФ лишние скобки не сокращают: её считают по строкам таблицы.`,
  });
}

// ═══════════════════ КТП 24 | 10logic-05-equations | логические уравнения ═══════════════════
{
  const src = 'A ⊕ B ⊕ C';
  const shown = 'A ⊕ B ⊕ C';
  const target = 0;
  const { vars, n, text } = solveEq(src, target);
  eq(vars.join(','), 'A,B,C', 'переменные');
  eq(n, 4, 'число решений уравнения');
  eq(n, truthOnes('¬(' + src + ')').n, 'число решений = числу строк, где выражение ложно');
  const nOnes = truthOnes(src).n;
  eq(nOnes, 4, 'строк с единицей тоже четыре');
  eq(n + nOnes, 2 ** vars.length, 'все строки перебраны');
  num({
    bank: 'logic', d: 'basic', lesson: '10logic-05-equations', sub: 'Уравнение с исключающим ИЛИ',
    subj: 'inf-10-logic-eq', req: 1.4, el: 1.6,
    prompt: `Сколько решений имеет уравнение ${shown} = ${target}, где A, B и C — высказывания? Запишите только число.`,
    dec: n,
    why: `Перебираем все ${2 ** vars.length} наборов значений. Выражение ${shown} равно нулю тогда и только тогда, когда истинных высказываний среди A, B и C чётное число. Решений ${n}: ${text.join('; ')}. Строк с единицей тоже ${nOnes}, поэтому если бы в правой части стояла единица, решений было бы столько же.`,
  });
}

// ═══════════════════ КТП 25 | 10logic-06-venn | диаграммы Венна ═══════════════════
{
  const all = 28;
  const hockey = 16;
  const football = 13;
  const both = 7;
  // Состав класса задаём списками: сначала те, кто любит оба вида спорта,
  // затем только хоккей, затем только футбол, в конце — не любящие ни одного.
  const bothIds = range(1, both);
  const hockeyOnly = range(both + 1, hockey);
  const footballOnly = range(hockey + 1, hockey + (football - both));
  const neither = range(hockey + (football - both) + 1, all);
  eq(bothIds.length + hockeyOnly.length, hockey, 'всего любит хоккей');
  eq(bothIds.length + footballOnly.length, football, 'всего любит футбол');
  const unionIds = [...bothIds, ...hockeyOnly, ...footballOnly];
  const unionSize = unionIds.length;
  eq(unionSize, hockey + football - both, 'объединение по формуле включений-исключений');
  const outside = neither.length;
  eq(outside, all - unionSize, 'вне обоих множеств');
  eq(outside, 6, 'ответ: вне обоих множеств');
  num({
    bank: 'logic', d: 'basic', lesson: '10logic-06-venn', sub: 'Вне обоих множеств',
    subj: 'inf-10-logic-venn', req: 1.4, el: 1.6,
    prompt: `В классе ${all} человек. Хоккей любят ${hockey}, футбол — ${football}, и то и другое — ${both}. Сколько человек не любят ни хоккей, ни футбол? Запишите только число.`,
    dec: outside,
    why: `По формуле включений-исключений хотя бы один вид спорта любят ${hockey} + ${football} − ${both} = ${unionSize} человек: тех, кто любит оба, пришлось вычесть один раз, иначе они посчитаны дважды. Значит, не любят ни того, ни другого ${all} − ${unionSize} = ${outside} человек — это область вне обоих кругов на диаграмме Венна.`,
  });
}

// ═══════════════════ КТП 26 | 10logic-07-scheme | логические схемы ═══════════════════
{
  const src = '(A ∨ B) ∧ ¬C';
  const { n, rows } = truthOnes(src);
  eq(n, 3, 'строк с единицей');
  eq(rows.length - n, 5, 'строк с нулём');
  const table = rows.map((r) => `${r.env.A} ${r.env.B} ${r.env.C} — ${r.v}`).join('; ');
  cr({
    bank: 'logic', d: 'basic', lesson: '10logic-07-scheme', sub: 'Схема «ИЛИ-НЕ» перебором',
    subj: 'inf-10-logic-gates', req: 1.3, el: 1.5,
    prompt: 'Логическая схема имеет три входа A, B, C и выход Y = (A ∨ B) ∧ ¬C. Напишите программу, которая переберёт все 8 наборов значений входов и выведет два числа через пробел: сколько наборов дают Y = 1 и сколько — Y = 0.',
    template: `# Перебери все наборы значений трёх входов\ncount1 = 0\ncount0 = 0\nfor a in range(2):\n    for b in range(2):\n        for c in range(2):\n            # вычисли значение схемы и посчитай, сколько раз получилась 1 и сколько 0\n            ...\nprint(count1, count0)`,
    solution: `count1 = 0
count0 = 0
for a in range(2):
    for b in range(2):
        for c in range(2):
            y = 1 if (a == 1 or b == 1) and c == 0 else 0
            if y == 1:
                count1 += 1
            else:
                count0 += 1
print(count1, count0)`,
    expected: '3 5',
    why: `Схема срабатывает, когда на вход C подаётся 0, а на A или B — хотя бы единица. Перебор всех наборов: ${table}. Единиц получается ${n}, нулей — ${rows.length - n}, всего 8. Проверять схему перебором надёжнее, чем «на глаз»: ошибку в одном элементе сразу видно по подсчёту строк.`,
  });
}

// ═══════════════════════ запись в банки ═══════════════════════

const EXPECT = { media: 14, logic: 6 };

function emit(cfg) {
  const raw = readFileSync(cfg.path, 'utf-8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const cut = raw.indexOf(MARK);
  const prefix = (cut === -1 ? raw : raw.slice(0, cut)).replace(/\s+$/, '');
  const nums = [...prefix.matchAll(new RegExp(`^- id: ${cfg.prefix}(\\d+)$`, 'gm'))].map((m) => Number(m[1]));
  ok(nums.length > 0, `${cfg.path}: не найдено ни одного id ${cfg.prefix}NNN`);
  let next = Math.max(...nums) + 1;
  const used = new Set(nums.map((x) => `${cfg.prefix}${String(x).padStart(3, '0')}`));
  const ids = [];
  const body = cfg.tasks
    .map((t) => {
      const id = `${cfg.prefix}${String(next++).padStart(3, '0')}`;
      ok(!used.has(id), `${cfg.path}: id ${id} уже занят`);
      used.add(id);
      ids.push(id);
      // самопроверка полей задания
      eq(DIFF[t.d].pts, t.d === 'basic' ? 1 : t.d === 'intermediate' ? 2 : 3, `${id}: баллы за сложность ${t.d}`);
      ok(typeof t.req === 'number' && [1.1, 1.2, 1.3, 1.4].includes(t.req), `${id}: fgos_requirement ${t.req} вне 1.1–1.4`);
      ok(typeof t.el === 'number' && [1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7].includes(t.el), `${id}: fgos_element ${t.el} вне 1.1–1.7`);
      ok(!!t.lesson, `${id}: нет lesson`);
      ok(!!t.subj, `${id}: пустой fgos.subject`);
      ok(!!t.sub, `${id}: пустой subtopic`);
      return [
        `- id: ${id}`,
        `  class: ${cfg.cls}`,
        `  topic: ${ys(cfg.topic)}`,
        `  subtopic: ${ys(t.sub)}`,
        `  type: ${t.type}`,
        `  difficulty: ${t.d}`,
        `  cognitive_level: ${DIFF[t.d].cog}`,
        `  points: ${DIFF[t.d].pts}`,
        `  lesson: ${t.lesson}`,
        `  fgos_requirement: ${t.req}`,
        `  fgos_element: ${t.el}`,
        `  fgos: { subject: [${t.subj}], meta: [plan-actions] }`,
        `  prompt: ${ys(t.prompt)}`,
        `  student_view: ${t.view}`,
        `  auto_check: ${t.check}`,
        `  teacher_only: ${t.teacher}`,
      ].join(eol);
    })
    .join(eol + eol);
  eq(cfg.tasks.length, EXPECT[cfg.key], `${cfg.key}: заданий`);
  const text = [
    prefix,
    MARK,
    '# Ответы посчитаны кодом (арифметика по размерам файлов, L() — разбор логических',
    '# выражений, truthOnes() и solveEq() — перебор всех наборов значений переменных,',
    '# equivalent() — равносильность подстановкой, питон — прогон эталона code_run) и',
    '# проверены assert-ами: если число или формула не сошлись, сборка падает.',
    `# Новые id: ${ids[0]} … ${ids[ids.length - 1]} (${ids.length} заданий).`,
    body,
  ].join(eol) + eol;
  writeFileSync(cfg.path, text, 'utf-8');
  return ids;
}

const mediaIds = emit(BANKS.media);
const logicIds = emit(BANKS.logic);

// ═══════════════════════ проверка квот ═══════════════════════

// lesson -> { basic, intermediate, advanced }
const QUOTA = {
  '10gfx-03-editor': { basic: 2, intermediate: 0, advanced: 0 },
  '10gfx-04-vector': { basic: 2, intermediate: 0, advanced: 0 },
  '10gfx-05-3d': { basic: 2, intermediate: 0, advanced: 0 },
  '10media-02-review': { basic: 2, intermediate: 0, advanced: 0 },
  '10media-03-typeset': { basic: 2, intermediate: 0, advanced: 0 },
  '10media-04-multimedia': { basic: 2, intermediate: 0, advanced: 0 },
  '10media-05-presentation': { basic: 2, intermediate: 0, advanced: 0 },
  '10logic-01-ops': { basic: 1, intermediate: 0, advanced: 0 },
  '10logic-03-truth': { basic: 1, intermediate: 0, advanced: 0 },
  '10logic-04-normal': { basic: 1, intermediate: 0, advanced: 0 },
  '10logic-05-equations': { basic: 1, intermediate: 0, advanced: 0 },
  '10logic-06-venn': { basic: 1, intermediate: 0, advanced: 0 },
  '10logic-07-scheme': { basic: 1, intermediate: 0, advanced: 0 },
};

const got = {};
const byDiff = { basic: 0, intermediate: 0, advanced: 0 };
const byBank = {};
for (const [key, cfg] of Object.entries(BANKS)) {
  byBank[key] = cfg.tasks.length;
  for (const t of cfg.tasks) {
    const d = t.d;
    ok(d in DIFF, `${t.lesson}: неизвестная сложность ${d}`);
    byDiff[d] += 1;
    got[t.lesson] = got[t.lesson] ?? { basic: 0, intermediate: 0, advanced: 0 };
    got[t.lesson][d] += 1;
    // сверка difficulty <-> points <-> cognitive_level
    eq(DIFF[d].pts, t.d === 'basic' ? 1 : t.d === 'intermediate' ? 2 : 3, `${t.lesson}: баллы за ${d}`);
  }
}
for (const [lesson, want] of Object.entries(QUOTA)) {
  const have = got[lesson];
  ok(!!have, `${lesson}: заданий нет, а по квоте нужно ${want.basic + want.intermediate + want.advanced}`);
  for (const d of ['basic', 'intermediate', 'advanced']) {
    eq(have[d], want[d], `${lesson}/${d}`);
  }
}
const extra = Object.keys(got).filter((l) => !(l in QUOTA));
ok(extra.length === 0, `лишние уроки: ${extra.join(', ')}`);
const TOTAL = Object.values(byBank).reduce((s, n) => s + n, 0);
const WANT_TOTAL = Object.values(QUOTA).reduce((s, q) => s + q.basic + q.intermediate + q.advanced, 0);
eq(TOTAL, WANT_TOTAL, 'всего заданий');

console.log(`КВОТЫ OK: всего ${TOTAL} (media=${byBank.media}, logic=${byBank.logic})`);
console.log(`По сложности: basic=${byDiff.basic} intermediate=${byDiff.intermediate} advanced=${byDiff.advanced}`);
console.log(`assert-проверок: ${checks}`);
console.log(`media: ${mediaIds[0]} … ${mediaIds[mediaIds.length - 1]}`);
console.log(`logic: ${logicIds[0]} … ${logicIds[logicIds.length - 1]}`);
console.log('БАНК-10-MEDIALOGIC-3 OK: задания записаны, повторный запуск ничего не меняет');