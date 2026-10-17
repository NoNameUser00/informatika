// Дописывает банки заданий 10 класса — третий заход: «Железо и информация» (12)
// и «Системы счисления углублённо» (7).
//
// Устройство как в make-10-bank2.mjs: файл режется по маркеру MARK, наш блок
// пишется заново после него, ручная часть и блоки других генераторов остаются
// нетронутыми. Второй запуск даёт тот же файл байт-в-байт.
//
// Главное правило: ответы считает код.
//  - числовые ответы вычисляются арифметикой и сверяются assert-ом;
//  - эталоны code_run прогоняются локальным Python, expected_stdout берётся из
//    РЕАЛЬНОГО вывода solution_code, расхождение роняет сборку;
//  - в single_choice правильный вариант задаётся ТЕКСТОМ, буква вычисляется кодом;
//  - в matching соответствие собирается кодом из массивов left/right.
//
// Запуск: node scripts/make-10-bases-bank3.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const MARK = '# ==== СГЕНЕРИРОВАНО scripts/make-10-bases-bank3.mjs ====';

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

// сложность -> баллы и уровень мышления
const DIFF = {
  basic: { pts: 1, cog: 'remember' },
  intermediate: { pts: 2, cog: 'apply' },
  advanced: { pts: 3, cog: 'analyze' },
};

/** Строка в двойных кавычках для YAML: кавычки и переводы строк экранируются. */
const ys = (s) =>
  `"${String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')}"`;

const LETTERS = 'ABCD';

/** Разряды через пробел, как в остальных объяснениях банка: 1048576 -> «1 048 576». */
const sp = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ─────────────────────────────────────────────────────────────────────────────
// Числа: свой парсер записи в основании, чтобы ключ проверялся тем же правилом,
// что и ученический ответ.
// ─────────────────────────────────────────────────────────────────────────────
const ALPHABET = '0123456789ABCDEF';
function parseBase(s, base) {
  const t = String(s).trim().toUpperCase();
  if (!t) return NaN;
  const valid = ALPHABET.slice(0, base);
  let v = 0;
  for (const ch of t) {
    if (!valid.includes(ch)) return NaN;
    v = v * base + valid.indexOf(ch);
  }
  return v;
}
/** Запись неотрицательного целого в основании base. */
function toBase(n, base) {
  ok(Number.isInteger(n) && n >= 0, `toBase: нужно неотрицательное целое, получено ${n}`);
  if (n === 0) return '0';
  let out = '';
  let v = n;
  while (v > 0) {
    out = ALPHABET[v % base] + out;
    v = Math.floor(v / base);
  }
  return out;
}
/** Наименьшее i, для которого 2^i >= n. */
function bitLen(n) {
  ok(Number.isInteger(n) && n > 0, `bitLen: нужно положительное целое, получено ${n}`);
  let i = 0;
  while (2 ** i < n) i++;
  return i;
}
/** Двоичная запись без ведущих нулей. */
function bin(n) {
  return toBase(n, 2);
}

/** Минимальное i, для которого 2^i >= n, — тонкая обёртка над bitLen. */
function bitsNeeded(n) {
  return bitLen(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// Локальный прогон эталона: expected_stdout берётся из реального вывода.
// ─────────────────────────────────────────────────────────────────────────────
function py(code) {
  const res = execFileSync('python3', ['-c', code], {
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  });
  return String(res).replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

/**
 * Проверка заготовки code_run: она должна разбираться как Python.
 * Многоточие вместо недостающей строки — допустимое выражение, поэтому
 * заготовку можно скомпилировать как есть, ничего не подменяя.
 * Возвращает '' при успехе или текст ошибки SyntaxError.
 */
function templateSyntax(tpl) {
  const src =
    'try:\n' +
    '    compile(' + JSON.stringify(tpl) + ', "template", "exec")\n' +
    'except SyntaxError as e:\n' +
    '    print("TEMPLATE FAIL:", e)';
  return py(src);
}

// ─────────────────────────────────────────────────────────────────────────────
// Банки
// ─────────────────────────────────────────────────────────────────────────────
const BANKS = [
  { key: 'base', path: 'data/tasks/10/base/bank-10base.yaml', prefix: 'inf-10-base', topic: 'Устройство и информация', tasks: [] },
  { key: 'ss', path: 'data/tasks/10/ss/bank-10ss.yaml', prefix: 'inf-10-ss', topic: 'Системы счисления углублённо', tasks: [] },
];
const use = (key) => {
  const b = BANKS.find((x) => x.key === key);
  ok(!!b, `нет банка ${key}`);
  return b;
};

/** numeric_base: ответ — число, записанное в основании o.base. */
function num(o) {
  const bank = use(o.bank);
  const base = o.base ?? 10;
  ok(Number.isInteger(o.dec), `${o.lesson} [${o.sub}]: ответ должен быть целым, получено ${o.dec}`);
  eq(parseBase(o.key, base), o.dec, `${o.lesson} [${o.sub}]: ключ «${o.key}» в основании ${base}`);
  bank.tasks.push({
    type: 'numeric_base', d: o.d, lesson: o.lesson, sub: o.sub, subj: o.subj, req: o.req, el: o.el,
    prompt: o.prompt,
    view: `{ base: ${base}, placeholder: "только число" }`,
    check: `{ method: numeric_base, base: ${base}, strip_affixes: true }`,
    teacher: `{ accepted_values_decimal: [${o.dec}], answer_text: ${ys(o.key)}, explanation: ${ys(o.why)} }`,
  });
}

/** single_choice: правильный вариант задаётся ТЕКСТОМ, буква считается кодом. */
function sc(o) {
  const bank = use(o.bank);
  const at = o.opts.indexOf(o.answer);
  ok(at >= 0, `${o.lesson} [${o.sub}]: ответа «${o.answer}» нет среди вариантов ${JSON.stringify(o.opts)}`);
  ok(o.opts.length >= 2 && o.opts.length <= 4, `${o.lesson} [${o.sub}]: вариантов должно быть 2-4`);
  eq(new Set(o.opts).size, o.opts.length, `${o.lesson} [${o.sub}]: варианты повторяются`);
  bank.tasks.push({
    type: 'single_choice', d: o.d, lesson: o.lesson, sub: o.sub, subj: o.subj, req: o.req, el: o.el,
    prompt: o.prompt,
    view: `{ options: [${o.opts.map((t, i) => `{ id: ${LETTERS[i]}, text: ${ys(t)} }`).join(', ')}] }`,
    check: `{ method: exact_option }`,
    teacher: `{ answer: ${LETTERS[at]}, explanation: ${ys(o.why)} }`,
  });
}

/** matching: слева и справа поровну, все правые ответы различны и входят в right. */
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
  bank.tasks.push({
    type: 'matching', d: o.d, lesson: o.lesson, sub: o.sub, subj: o.subj, req: o.req, el: o.el,
    prompt: o.prompt,
    view: `{ left: [${o.left.map((x) => ys(x)).join(', ')}], right: [${o.right.map((x) => ys(x)).join(', ')}] }`,
    check: `{ method: matching, partial: proportional }`,
    teacher: `{ answer_map: { ${o.left.map((k) => `${ys(k)}: ${ys(o.map[k])}`).join(', ')} }, explanation: ${ys(o.why)} }`,
  });
}

/** code_run: expected_stdout — реальный вывод solution_code локальным Python. */
function cr(o) {
  const bank = use(o.bank);
  const badTpl = templateSyntax(o.template);
  if (badTpl) throw new Error(`${o.lesson} [${o.sub}]: заготовка не разбирается как Python — ${badTpl}`);
  checks++;
  const real = py(o.solution);
  ok(real.length > 0, `${o.lesson} [${o.sub}]: эталон ничего не вывел`);
  if (o.expected !== undefined) {
    eq(real, o.expected, `${o.lesson} [${o.sub}]: эталон не сошёлся с реальным выводом`);
  }
  bank.tasks.push({
    type: 'code_run', d: o.d, lesson: o.lesson, sub: o.sub, subj: o.subj, req: o.req, el: o.el,
    prompt: o.prompt,
    view: `{ language: python, template: ${ys(o.template)} }`,
    check: `{ method: code_stdout, timeout_s: 10 }`,
    teacher: `{ solution_code: ${ys(o.solution)}, expected_stdout: ${ys(real)}, explanation: ${ys(o.why)} }`,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// Банк «Железо и информация» — 12 заданий
// ═════════════════════════════════════════════════════════════════════════════

// ── КТП 1 | 10hw-01-pc | подбор комплектующих (0/1/0) ──
{
  const mods = [
    [4, 1500],
    [8, 2600],
    [16, 4800],
  ];
  const budget = 12000;
  // Тройки модулей перебираем с повторениями: одинаковые планки покупать можно.
  let bestGb = 0;
  let bestCost = 0;
  let triples = 0;
  for (const a of mods) {
    for (const b of mods) {
      for (const c of mods) {
        triples++;
        const gb = a[0] + b[0] + c[0];
        const cost = a[1] + b[1] + c[1];
        if (cost <= budget && gb > bestGb) {
          bestGb = gb;
          bestCost = cost;
        }
      }
    }
  }
  eq(triples, 27, `троек модулей: ${triples}`);
  eq(bestGb, 36, `лучший объём памяти: ${bestGb}`);
  eq(bestCost, 11100, `стоимость лучшего варианта: ${bestCost}`);
  const solution = `mods = [(4, 1500), (8, 2600), (16, 4800)]
budget = 12000
best_gb = 0
best_cost = 0
for a in mods:
    for b in mods:
        for c in mods:
            gb = a[0] + b[0] + c[0]
            cost = a[1] + b[1] + c[1]
            if cost <= budget:
                if gb > best_gb:
                    best_gb = gb
                    best_cost = cost
print(best_gb, best_cost)`;
  cr({
    bank: 'base', d: 'intermediate', lesson: '10hw-01-pc', sub: 'Подбор памяти по бюджету',
    subj: 'inf-10-pc-mem', req: 1.1, el: 1.2,
    prompt:
      'В магазине есть модули оперативной памяти: 4 ГБ за 1500 рублей, 8 ГБ за 2600 рублей и 16 ГБ за 4800 рублей. ' +
      'Нужно купить ровно три модуля и уложиться в 12 000 рублей. Переберите все варианты и выведите два числа через пробел: ' +
      'наибольший суммарный объём памяти в ГБ, который можно купить, и стоимость этого варианта в рублях.',
    template: `# Переберите все тройки модулей и найдите лучшую\nmods = [(4, 1500), (8, 2600), (16, 4800)]\nbudget = 12000\nbest_gb = 0\nbest_cost = 0\nfor a in mods:\n    for b in mods:\n        for c in mods:\n            gb = ...\n            cost = ...\n            # пропускаем слишком дорогие варианты, лучший запоминаем\n            ...\nprint(best_gb, best_cost)`,
    solution,
    expected: '36 11100',
    why:
      `Тройки перебираются с повторениями: одинаковые планки покупать можно, поэтому всего вариантов 3 · 3 · 3 = ${triples}. ` +
      `Лучший из уложившихся в бюджет — 16 + 16 + 4 ГБ: это ${bestGb} ГБ за ${sp(bestCost)} рублей. ` +
      `На 40 ГБ денег уже не хватает: 16 + 16 + 8 ГБ стоят ${sp(12200)} рублей, а на 36 ГБ остаётся ещё ${sp(budget - bestCost)}. ` +
      'Так и работают с комплектующими: сначала ограничение (бюджет и число слотов), потом перебор вариантов, и только потом выбор.',
  });
}

// ── КТП 2 | 10hw-02-config | разрешение и частота обновления (1/0/0) ──
{
  const opts = [
    'Частоту 144 Гц монитор через этот кабель не получит: система вернёт 60 Гц или попросит кабель, который её поддерживает',
    '144 Гц применится, потому что частоту ограничивает только видеокарта, а кабель на это не влияет',
    'Монитор сломается: частота выше его паспортной недопустима',
    'Разрешение уменьшится до 1280 × 720, а частота поднимется до 144 Гц',
  ];
  sc({
    bank: 'base', d: 'basic', lesson: '10hw-02-config', sub: 'Частота обновления и кабель',
    subj: 'inf-10-pc-arch', req: 1.1, el: 1.2,
    prompt:
      'Видеокарта умеет выводить изображение 1920 × 1080 с частотой обновления 144 Гц, но монитор подключён кабелем, ' +
      'который передаёт только 1080p 60 Гц. Что произойдёт, если в настройках видео выбрать 144 Гц?',
    opts, answer: opts[0],
    why:
      'Частоту обновления ограничивает самое слабое звено цепочки «видеокарта — кабель — монитор». ' +
      'Здесь кабель пропускает только 60 Гц, поэтому запас видеокарты просто не используется, и монитор работает на 60 Гц. ' +
      'В настройках видео полезно смотреть все три значения: сколько умеет карта, сколько поддерживает монитор и что пропускает подключение.',
  });
}

// ── КТП 3 | 10hw-03-trends | закон Мура (1/0/0) ──
{
  const opts = [
    'Число элементов на единицу площади кристалла примерно удваивается каждые два года',
    'Производительность любого процессора удваивается каждые два года',
    'Объём оперативной памяти компьютера удваивается каждый год',
    'Тактовая частота процессора удваивается каждые пять лет',
  ];
  sc({
    bank: 'base', d: 'basic', lesson: '10hw-03-trends', sub: 'Закон Мура',
    subj: 'inf-10-pc-arch', req: 1.1, el: 1.2,
    prompt: 'О чём говорит закон Мура?',
    opts, answer: opts[0],
    why:
      'Закон Мура относится к плотности элементов на кристалле: совершенствование технологии позволяет упаковывать на той же площади ' +
      'примерно вдвое больше элементов раз в два года. Отсюда растут и объёмы памяти, и число ядер, но формулировка ' +
      '«производительность удваивается каждые два года» — это эмпирическое наблюдение, а не сам закон. ' +
      'Действует закон не бесконечно: когда транзисторы уменьшить не удаётся, развитие уходит в новые архитектуры и специализированные вычислители.',
  });
}

// ── КТП 4 | 10hw-04-software | совместимость версий (1/0/0) ──
{
  const opts = [
    'Формат файла в новой версии изменился и обратной совместимости не предусмотрено — нужна копия документа, сохранённая в старом формате',
    'Файл повредился при обновлении: программа перезаписала его принудительно',
    'Ничего: файл нужно открывать только самой новой версией программы',
    'Обновление всегда удаляет старые файлы, поэтому их придётся заранее копировать вручную',
  ];
  sc({
    bank: 'base', d: 'basic', lesson: '10hw-04-software', sub: 'Совместимость версий',
    subj: 'inf-10-pc-license', req: 1.1, el: 1.3,
    prompt:
      'Файл, созданный в старой версии программы, перестал открываться после обновления. Почему так бывает и как подстраховаться?',
    opts, answer: opts[0],
    why:
      'Формат файла — это договорённость между версиями программы. Когда разработчик меняет структуру, он не обязан добавлять чтение ' +
      'старого варианта: новая версия открывает новое, старая — старое. Надёжный приём — при сдаче работы сохранять копию в исходном ' +
      'формате и хранить её рядом с новой версией.',
  });
}

// ── КТП 5 | 10hw-05-files | расширения файлов (1/0/0) ──
{
  const opts = [
    'В LibreOffice Writer: этот формат сохраняет текстовый документ вместе с оформлением',
    'В LibreOffice Calc: расширение .odt используется для таблиц',
    'В растровом графическом редакторе: .odt — это формат изображений',
    'Только в текстовом редакторе, потому что .odt — обычный текст без разметки',
  ];
  sc({
    bank: 'base', d: 'basic', lesson: '10hw-05-files', sub: 'Формат .odt',
    subj: 'inf-10-pc-arch', req: 1.1, el: 1.3,
    prompt: 'Документ сохранён в файле «Отчёт.odt». В какой программе его можно открыть и редактировать?',
    opts, answer: opts[0],
    why:
      'Расширение .odt — открытый формат текстового документа LibreOffice Writer: в нём хранятся и буквы, и оформление, и таблицы. ' +
      'Формат открытый, поэтому документ можно открыть и другими программами. Если программа формат не поддерживает, она покажет текст ' +
      'без разметки — это не значит, что файл испорчен.',
  });
}

// ── КТП 5 | 10hw-05-files | объём файлов по типам (1/0/0) ──
{
  const photos = 9;
  const photoSize = 3;
  const docs = 6;
  const docSize = 0.5;
  const onlyPhotos = photos * photoSize;
  const all = onlyPhotos + docs * docSize;
  eq(onlyPhotos, 27, `объём фотографий: ${onlyPhotos}`);
  eq(all, 30, `объём всей папки: ${all}`);
  num({
    bank: 'base', d: 'basic', lesson: '10hw-05-files', sub: 'Объём фотографий в папке', base: 10,
    subj: 'inf-10-pc-arch', req: 1.1, el: 1.3,
    prompt:
      `В папке лежат 15 файлов: ${photos} фотографий по ${String(photoSize).replace('.', ',')} Мбайта и ${docs} документов по ${String(docSize).replace('.', ',')} Мбайта. ` +
      'Сколько мегабайт занимают только фотографии? Запишите только число.',
    key: String(onlyPhotos), dec: onlyPhotos,
    why:
      `Каждая фотография занимает ${photoSize} Мбайта, их ${photos}: ${photos} · ${photoSize} = ${onlyPhotos} Мбайта. ` +
      `Документы в этот объём не входят — вместе со всеми файлами папка весит ${onlyPhotos} + ${docs} · ${String(docSize).replace('.', ',')} = ${all} Мбайта. ` +
      'Разница между «всей папкой» и «только фотографиями» и объясняет, зачем при очистке места считать по типам файлов.',
  });
}

// ── КТП 6 | 10hw-06-licenses | требование GPL (1/0/0) ──
{
  const opts = [
    'Исходный текст программы: по этой лицензии любой может её изучить, изменить и распространять дальше',
    'Ничего: открывать исходный текст необязательно, запрет касается только продажи',
    'Только название автора и год создания, без исходного текста',
    'Исходный текст, но только для компаний, купивших лицензию',
  ];
  sc({
    bank: 'base', d: 'basic', lesson: '10hw-06-licenses', sub: 'Что требует GPL',
    subj: 'inf-10-pc-license', req: 1.1, el: 1.3,
    prompt: 'Программист распространяет свою программу под лицензией GNU GPL. Что он обязан предоставить вместе с ней?',
    opts, answer: opts[0],
    why:
      'Свободная лицензия GNU GPL требует доступности исходного текста: в этом и состоит право изучать и изменять программу. ' +
      'Закрыть исходники и при этом распространять программу по GPL нельзя. Отсюда и другое правило: производные работы ' +
      'распространяются на тех же условиях, поэтому GPL называют заражающей лицензией.',
  });
}

// ── КТП 6 | 10hw-06-licenses | нарушения лицензии (1/0/0) ──
{
  const left = [
    'Скопировали платную программу с одного компьютера на второй',
    'Удалили из бесплатной программы строку об авторских правах',
    'Передали свою программу по лицензии GPL, не приложив исходный текст',
    'Купили лицензию на одно рабочее место и поставили программу на 20 компьютеров',
  ];
  const right = [
    'копирование без разрешения правообладателя',
    'нарушение требования сохранять уведомление об авторских правах',
    'нарушение условия о передаче исходного текста',
    'превышение числа лицензированных рабочих мест',
  ];
  const map = Object.fromEntries(left.map((l, i) => [l, right[i]]));
  ma({
    bank: 'base', d: 'basic', lesson: '10hw-06-licenses', sub: 'Что нарушает лицензию',
    subj: 'inf-10-pc-license', req: 1.1, el: 1.3,
    prompt: 'Установите соответствие: действие пользователя — чем оно нарушает лицензию.',
    left, right, map,
    why:
      'Почти каждое нарушение связано с копированием или распространением: копия платной программы на чужом компьютере, ' +
      'удаление обязательного уведомления об авторских правах, передача своей программы без исходного текста и установка ' +
      'на 20 компьютеров копии с одной лицензией. Пользоваться программой, установленной законно, можно: претензии возникают ' +
      'там, где появляются копии.',
  });
}

// ── КТП 7 | 10info-02-fano | алфавит по длине кода (1/0/0) ──
{
  const len = 3;
  const alphabet = 2 ** len;
  eq(alphabet, 8, `символов в коде длиной ${len} бита: ${alphabet}`);
  const opts = [
    '8 символов: кодовое слово из трёх бит имеет 2³ = 8 вариантов',
    '3 символа: столько бит в кодовом слове',
    '16 символов: три бита и ещё один бит на разделитель',
    'Столько, сколько нужно: длина слова не ограничивает алфавит',
  ];
  sc({
    bank: 'base', d: 'basic', lesson: '10info-02-fano', sub: 'Число символов по длине кода',
    subj: 'inf-10-info-fano', req: 1.4, el: 1.6,
    prompt: 'В системе кодирования каждый символ заменяется кодовым словом длиной 3 бита. Сколько различных символов такая система способна закодировать?',
    opts, answer: opts[0],
    why:
      `Кодовое слово длиной ${len} бита имеет ровно 2^${len} = ${alphabet} различных записей, и каждой отводится один символ алфавита. ` +
      'Это равномерный код: все символы занимают одинаковое число бит, и сообщение просто складывается из кодовых слов. ' +
      'Больше символов такая система не закодирует — записей просто не хватит.',
  });
}

// ── КТП 8 | 10info-03-content | разряд одного символа (1/0/0) ──
{
  const alphabet = 66;
  const bits = bitsNeeded(alphabet);
  eq(bits, 7, `бит на символ при алфавите ${alphabet}: ${bits}`);
  eq(2 ** (bits - 1), 64, `2^${bits - 1}: ${2 ** (bits - 1)}`);
  num({
    bank: 'base', d: 'basic', lesson: '10info-03-content', sub: 'Разряд одного символа', base: 10,
    subj: 'inf-10-info-shannon', req: 1.4, el: 1.6,
    prompt:
      'Алфавит текста содержит 66 символов: 52 латинские буквы, 10 цифр и 4 знака. Сколько бит нужно отвести на один символ, ' +
      'чтобы закодировать весь алфавит? Запишите только число.',
    key: String(bits), dec: bits,
    why:
      `Ищем наименьшее i, для которого 2^i не меньше ${alphabet}: 2^${bits - 1} = ${2 ** (bits - 1)} — на один символ не хватает, ` +
      `а 2^${bits} = ${2 ** bits} — хватает. Значит на символ отводят ${bits} бит, и один код останется неиспользованным. ` +
      'Округлять надо вверх: при 6 битах последние два символа получили бы одинаковый код, и расшифровать текст было бы невозможно.',
  });
}

// ── КТП 10 | 10info-04-processes | цена переключения (1/0/0) ──
{
  const switches = 9000;
  const one = 0.002;
  const lost = switches * one;
  eq(lost, 18, `время на переключения: ${lost}`);
  eq(Math.round((lost / 60) * 100), 30, `доля минуты: ${(lost / 60) * 100}`);
  num({
    bank: 'base', d: 'basic', lesson: '10info-04-processes', sub: 'Цена переключения контекста', base: 10,
    subj: 'inf-10-info-channel', req: 1.4, el: 1.6,
    prompt:
      'Компьютер поочерёдно выполняет три программы, переключаясь между ними. Одно переключение занимает 2 миллисекунды. ' +
      'За минуту работы система выполнила 9000 переключений. Сколько секунд из этой минуты заняли сами переключения? Запишите только число.',
    key: String(lost), dec: lost,
    why:
      `Каждое переключение занимает ${String(one).replace('.', ',')} с, а их было ${switches}: ${switches} · ${String(one).replace('.', ',')} = ${lost} с. ` +
      `Это почти треть минуты — плата за многозадачность, которая ничего не вычисляла: сохранялись и восстанавливались состояния процессов. ` +
      'Чем короче программы работают по очереди, тем больше доля таких потерь, поэтому системе приходится задавать потокам разные приоритеты.',
  });
}

// ── КТП 11 | 10info-05-tasks | тест, на котором программа не проходит (1/0/0) ──
{
  const opts = [
    'Тест выявил ошибку: по нему ищут причину в коде, исправляют её и прогоняют всю проверку заново',
    'Лишний тест: его надо удалить из набора, он не соответствует задаче',
    'Программа готова: остальные тесты прошли, а этот можно не учитывать',
    'Ошибка в самом тесте: правильный ответ нужно заменить на результат программы',
  ];
  sc({
    bank: 'base', d: 'basic', lesson: '10info-05-tasks', sub: 'Тест, на котором программа не проходит',
    subj: 'inf-10-info-task', req: 1.4, el: 1.6,
    prompt: 'При проверке программы один тест не совпал с ожидаемым результатом. Что это означает и что делают дальше?',
    opts, answer: opts[0],
    why:
      'Тест, на котором программа не проходит, — это описание найденной ошибки, а не повод отмахнуться. ' +
      'Сначала по нему локализуют причину, потом правят код, и только после этого прогоняют весь набор заново, чтобы убедиться, ' +
      'что исправление ничего не сломало. Подменять ожидаемый ответ выводом программы нельзя: иначе ошибка станет новым правилом.',
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// Банк «Системы счисления углублённо» — 7 заданий
// ═════════════════════════════════════════════════════════════════════════════

// ── КТП 17 | 10gfx-01-image | объём двух изображений (1/0/0) ──
{
  const sizes = [
    [640, 480],
    [1024, 768],
  ];
  const depth = 24;
  const bytes = sizes.map(([w, h]) => w * h * (depth / 8));
  eq(bytes[0], 921600, `объём ${sizes[0][0]}×${sizes[0][1]}: ${bytes[0]}`);
  eq(bytes[1], 2359296, `объём ${sizes[1][0]}×${sizes[1][1]}: ${bytes[1]}`);
  eq(sizes[0][0] * sizes[0][1], 307200, `пикселей первого: ${sizes[0][0] * sizes[0][1]}`);
  eq(sizes[1][0] * sizes[1][1], 786432, `пикселей второго: ${sizes[1][0] * sizes[1][1]}`);
  const solution = `sizes = [(640, 480), (1024, 768)]
depth = 24
volumes = []
for w, h in sizes:
    # объём в байтах: пиксели умножаем на глубину и переводим биты в байты
    volumes.append(w * h * depth // 8)
print(*volumes)`;
  cr({
    bank: 'ss', d: 'basic', lesson: '10gfx-01-image', sub: 'Объём двух изображений',
    subj: 'inf-10-gfx-image', req: 1.2, el: 1.3,
    prompt:
      'Посчитайте объём (в байтах) двух изображений, сохранённых без сжатия: 640 × 480 пикселей и 1024 × 768 пикселей, ' +
      'оба с глубиной цвета 24 бита. Выведите два объёма через пробел: сначала для первого изображения, затем для второго.',
    template:
      '# Объём изображения = пиксели * глубина цвета / 8\nsizes = [(640, 480), (1024, 768)]\ndepth = 24\nvolumes = []\nfor w, h in sizes:\n    # соберите объём в байтах для каждого размера\n    ...\nprint(*volumes)',
    solution,
    expected: '921600 2359296',
    why:
      `Объём без сжатия равен числу пикселей, умноженному на глубину цвета. Для ${sizes[0][0]} · ${sizes[0][1]} = ${sp(sizes[0][0] * sizes[0][1])} пикселей ` +
      `получаем ${sp(bytes[0])} байт, для ${sizes[1][0]} · ${sizes[1][1]} = ${sp(sizes[1][0] * sizes[1][1])} пикселей — ${sp(bytes[1])} байт. ` +
      'Делить на 8 нужно потому, что глубина задана в битах, а объём считают в байтах. ' +
      'На втором изображении пикселей больше в 2,56 раза, во столько же раз больше и объём.',
  });
}

// ── КТП 18 | 10gfx-02-sound | число отсчётов (1/0/0) ──
{
  const rate = 16000;
  const seconds = 5;
  const samples = rate * seconds;
  eq(samples, 80000, `отсчётов: ${samples}`);
  num({
    bank: 'ss', d: 'basic', lesson: '10gfx-02-sound', sub: 'Число отсчётов', base: 10,
    subj: 'inf-10-gfx-sound', req: 1.2, el: 1.3,
    prompt:
      `Звук длится ${seconds} секунд, частота дискретизации 16 000 Гц. Сколько отсчётов будет записано за это время? Запишите только число.`,
    key: String(samples), dec: samples,
    why:
      `Частота дискретизации 16 000 Гц означает 16 000 отсчётов в секунду, за ${seconds} секунд их будет 16 000 · ${seconds} = ${sp(samples)}. ` +
      'Разрядность на это число не влияет: она определяет, сколько бит занимает каждый отсчёт. ' +
      'Поэтому объём звукового файла считают как число отсчётов, умноженное на разрядность в битах и делённое на 8.',
  });
}

// ── КТП 13 | 10ss-02-transfer | длина двоичной записи (1/0/0) ──
{
  const n = 45;
  const digits = bin(n);
  eq(digits, '101101', `двоичная запись ${n}: ${digits}`);
  eq(digits.length, 6, `цифр в записи: ${digits.length}`);
  eq(2 ** 5, 32, `2^5 = ${2 ** 5}`);
  eq(2 ** 6, 64, `2^6 = ${2 ** 6}`);
  num({
    bank: 'ss', d: 'basic', lesson: '10ss-02-transfer', sub: 'Длина двоичной записи', base: 10,
    subj: 'inf-10-ss-base', req: 1.2, el: 1.3,
    prompt:
      `Число ${n} записано в двоичной системе счисления. Сколько цифр в этой записи, если ведущие нули не записывают? Запишите только число.`,
    key: String(digits.length), dec: digits.length,
    why:
      `Перевод делением с остатками даёт запись ${digits}: ${n} = 32 + 8 + 4 + 1, в ней ${digits.length} цифр. ` +
      `Число цифр показывает порядок величины: 2^6 = 64 > ${n}, а 2^5 = 32 < ${n}, поэтому шестизначная запись здесь минимальна. ` +
      'Запись растёт медленно: число 1 000 000 в двоичной системе занимает всего 20 цифр.',
  });
}

// ── КТП 14 | 10ss-03-arith | сложение двоичных чисел в столбик (1/0/0) ──
{
  const a = '10110';
  const b = '1101';
  const decA = parseBase(a, 2);
  const decB = parseBase(b, 2);
  eq(decA, 22, `10110₂ = ${decA}`);
  eq(decB, 13, `1101₂ = ${decB}`);
  eq(decA + decB, 35, `сумма в десятичной: ${decA + decB}`);
  eq(bin(decA + decB), '100011', `сумма в двоичной: ${bin(decA + decB)}`);
  const solution = `a = list('10110')
b = list('1101')
i = len(a) - 1
j = len(b) - 1
carry = 0
res = []
while i >= 0 or j >= 0 or carry > 0:
    x = 0
    y = 0
    if i >= 0:
        x = int(a[i])
        i = i - 1
    if j >= 0:
        y = int(b[j])
        j = j - 1
    # складываем текущие разряды вместе с переносом
    s = x + y + carry
    # в разряд пишем остаток от деления на 2, перенос уходит в старший разряд
    res.append(str(s % 2))
    carry = s // 2
answer = ''.join(reversed(res))
print(answer)
print(int(answer, 2))`;
  cr({
    bank: 'ss', d: 'basic', lesson: '10ss-03-arith', sub: 'Сложение двоичных чисел в столбик',
    subj: 'inf-10-ss-arith', req: 1.2, el: 1.3,
    prompt:
      `Сложите двоичные числа ${a} и ${b} столбиком, не переводя их в десятичную систему: складывайте поразрядно с переносом. ` +
      'Выведите результат в двоичной системе счисления, а на следующей строке — его десятичное значение.',
    template:
      '# Сложение двоичных чисел поразрядно с переносом\na = list(\'10110\')\nb = list(\'1101\')\ni = len(a) - 1\nj = len(b) - 1\ncarry = 0\nres = []\nwhile i >= 0 or j >= 0 or carry > 0:\n    x = 0\n    y = 0\n    # берём текущие разряды, если они ещё не закончились\n    ...\n    # суммируем с переносом, в разряд идёт остаток, перенос уходит дальше\n    ...\nanswer = \'\'\nprint(answer)\nprint(int(answer, 2))',
    solution,
    expected: '100011\n35',
    why:
      `Складываем справа налево: 0 + 1 = 1, 1 + 0 = 1, затем 1 + 1 = 10 — в разряд пишем 0, а перенос 1 отдаём в следующий разряд; ` +
      `дальше снова 1 + 1 + 1 = 11, в разряд идёт 1 и перенос 1. В сумме получается 100011₂. ` +
      `Проверка в десятичной системе: ${decA} + ${decB} = ${decA + decB}. ` +
      'Переносом может быть только 0 или 1, потому что два двоичных разряда вместе с переносом дают не больше 3.',
  });
}

// ── КТП 15 | 10ss-04-memory | число адресов памяти (1/0/0) ──
{
  const addrBits = 20;
  const addresses = 2 ** addrBits;
  eq(addresses, 1048576, `адресов при ${addrBits} разрядах: ${addresses}`);
  num({
    bank: 'ss', d: 'basic', lesson: '10ss-04-memory', sub: 'Число адресов памяти', base: 10,
    subj: 'inf-10-ss-float', req: 1.2, el: 1.3,
    prompt: `Адресная шина компьютера имеет ${addrBits} разрядов. Сколько различных адресов памяти она позволяет получить? Запишите только число.`,
    key: String(addresses), dec: addresses,
    why:
      `Каждый разряд адресной шины принимает два значения — 0 или 1, поэтому число адресов равно 2^${addrBits} = ${sp(addresses)}. ` +
      'Это тот же приём, что и в формуле 2^i = N: длина записи задаёт число её вариантов. ' +
      'Адрес нужен, чтобы обратиться к нужной ячейке, поэтому реальный объём памяти всегда чуть меньше такой степени двойки.',
  });
}

// ── КТП 16 | 10ss-05-text | сколько символов в Unicode (1/0/0) ──
{
  const bits = 16;
  const count = 2 ** bits;
  eq(count, 65536, `символов при ${bits} битах: ${count}`);
  const opts = [
    '65 536 символов: 2¹⁶ возможных кодов',
    '256 символов: 16 бит — это 16 · 16',
    '16 символов: по одному на каждый бит',
    '65 535 символов, потому что код 0 не используется',
  ];
  sc({
    bank: 'ss', d: 'basic', lesson: '10ss-05-text', sub: 'Сколько символов в Unicode',
    subj: 'inf-10-ss-utf', req: 1.2, el: 1.3,
    prompt: 'Символ в таблице Unicode хранится 16 битами. Сколько различных символов в ней помещается?',
    opts, answer: opts[0],
    why:
      `Шестнадцать бит дают 2^16 = ${sp(count)} возможных кодов, и каждый отдан одному символу: латинской букве, кириллической, знаку или эмодзи. ` +
      'Поэтому кодировку UTF-16 называют двухбайтовой: один символ занимает ровно 2 байта, независимо от того, кириллица это или символ другого письма.',
  });
}

// ── КТП 19 | 10ss-06-tasks | объём кадра экрана (1/0/0) ──
{
  const w = 1280;
  const h = 1024;
  const depth = 32;
  const pixels = w * h;
  const bytes = pixels * (depth / 8);
  const mb = bytes / (1024 * 1024);
  eq(pixels, 1310720, `пикселей: ${pixels}`);
  eq(bytes, 5242880, `байт: ${bytes}`);
  eq(mb, 5, `мегабайт: ${mb}`);
  num({
    bank: 'ss', d: 'basic', lesson: '10ss-06-tasks', sub: 'Объём кадра экрана', base: 10,
    subj: 'inf-10-ss-task', req: 1.2, el: 1.3,
    prompt:
      `Один кадр изображения экрана ${w} × ${h} пикселя сохраняется без сжатия с глубиной цвета ${depth} бита. ` +
      'Сколько мегабайт он занимает? Запишите только число.',
    key: String(mb), dec: mb,
    why:
      `Сначала объём в байтах: ${w} · ${h} = ${sp(pixels)} пикселей, по ${depth} бита на пиксель — ${sp(bytes)} байт. ` +
      `Переводим в мегабайты делением на 1024 · 1024 = ${sp(1024 * 1024)} и получаем ровно ${mb} Мбайт. ` +
      'Делить на 8 нужно потому, что глубина задана в битах; вместо двух делений на 1024 можно сразу делить на 2²⁰.',
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// Проверка квот и запись
// ═════════════════════════════════════════════════════════════════════════════

// Квоты из задания: lesson -> сложность -> число заданий.
const QUOTA = {
  '10hw-01-pc': { basic: 0, intermediate: 1, advanced: 0 },
  '10hw-02-config': { basic: 1, intermediate: 0, advanced: 0 },
  '10hw-03-trends': { basic: 1, intermediate: 0, advanced: 0 },
  '10hw-04-software': { basic: 1, intermediate: 0, advanced: 0 },
  '10hw-05-files': { basic: 2, intermediate: 0, advanced: 0 },
  '10hw-06-licenses': { basic: 2, intermediate: 0, advanced: 0 },
  '10info-02-fano': { basic: 1, intermediate: 0, advanced: 0 },
  '10info-03-content': { basic: 1, intermediate: 0, advanced: 0 },
  '10info-04-processes': { basic: 1, intermediate: 0, advanced: 0 },
  '10info-05-tasks': { basic: 1, intermediate: 0, advanced: 0 },
  '10gfx-01-image': { basic: 1, intermediate: 0, advanced: 0 },
  '10gfx-02-sound': { basic: 1, intermediate: 0, advanced: 0 },
  '10ss-02-transfer': { basic: 1, intermediate: 0, advanced: 0 },
  '10ss-03-arith': { basic: 1, intermediate: 0, advanced: 0 },
  '10ss-04-memory': { basic: 1, intermediate: 0, advanced: 0 },
  '10ss-05-text': { basic: 1, intermediate: 0, advanced: 0 },
  '10ss-06-tasks': { basic: 1, intermediate: 0, advanced: 0 },
};
const WANT_TOTAL = Object.values(QUOTA).reduce(
  (s, d) => s + d.basic + d.intermediate + d.advanced,
  0,
);

const EXPECT = { base: 12, ss: 7 };

function emit(cfg) {
  const raw = readFileSync(cfg.path, 'utf-8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const cut = raw.indexOf(MARK);
  const prefix = (cut === -1 ? raw : raw.slice(0, cut)).replace(/\s+$/, '');
  const nums = [...prefix.matchAll(new RegExp(`^- id: ${cfg.prefix}-(\\d+)$`, 'gm'))].map((m) => Number(m[1]));
  ok(nums.length > 0, `${cfg.path}: не найдено существующих id ${cfg.prefix}-NNN`);
  let next = Math.max(...nums) + 1;
  const used = new Set(nums.map((x) => `${cfg.prefix}-${String(x).padStart(3, '0')}`));
  const head = [];
  const body = cfg.tasks
    .map((t) => {
      const id = `${cfg.prefix}-${String(next++).padStart(3, '0')}`;
      ok(!used.has(id), `id ${id} уже занят в ${cfg.path}`);
      used.add(id);
      head.push(id);
      return [
        `- id: ${id}`,
        '  class: 10',
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
  ok(cfg.tasks.length === EXPECT[cfg.key], `${cfg.key}: ожидалось ${EXPECT[cfg.key]} заданий, вышло ${cfg.tasks.length}`);
  const text =
    [
      prefix,
      MARK,
      '# Ответы посчитаны кодом (parseBase, toBase, bitLen) и проверены assert-ами:',
      '# если число или формула не сошлись, сборка падает. Эталоны code_run прогоняются',
      '# локальным Python, expected_stdout взят из реального вывода solution_code.',
      '# Блок перезаписывается целиком при каждом запуске.',
      `# Новые id: ${head[0]} … ${head[head.length - 1]} (${head.length} заданий).`,
      body,
    ].join(eol) + eol;
  if (process.env.PREVIEW) {
    console.log(text);
  } else {
    writeFileSync(cfg.path, text, 'utf-8');
  }
  return head;
}

// ── Сверка квот, сложностей, обязательных полей и формулировок ──

// Проектные запреты: канцелярит-«давайте», чужие языки и офисные пакеты, вымышленные ФИО.
const BANNED = [
  /\bдавайте\b/i,
  /\bпаскаль\b/i,
  /\bpascal\b/i,
  /\bdelphi\b/i,
  /\bmicrosoft\b/i,
  /\bopenoffice\b/i,
  /\bword\b(?! processors?)/i,
  /\bexcel\b/i,
  /\bИванов\b|Петров\b|Сидорова\b|Коля\b/i,
];
function checkText(where, s) {
  for (const re of BANNED) {
    const hit = s.match(re);
    if (hit) throw new Error(`${where}: запрещённое в тексте «${hit[0]}» (${re})`);
    checks++;
  }
}

const got = new Map();
let total = 0;
for (const b of BANKS) {
  for (const t of b.tasks) {
    const key = `${b.key}|${t.lesson}`;
    if (!got.has(key)) got.set(key, { basic: 0, intermediate: 0, advanced: 0 });
    got.get(key)[t.d] += 1;
    // difficulty ↔ points ↔ cognitive_level
    eq(DIFF[t.d].pts, t.d === 'basic' ? 1 : t.d === 'intermediate' ? 2 : 3, `${t.lesson}: points для ${t.d}`);
    ok(!!t.lesson, `${b.key}: задание «${t.sub}» без lesson`);
    ok(!!t.subj, `${t.lesson}: задание «${t.sub}» без fgos.subject`);
    ok([1.1, 1.2, 1.4].includes(t.req), `${t.lesson} [${t.sub}]: недопустимый fgos_requirement ${t.req}`);
    ok([1.1, 1.2, 1.3, 1.6].includes(t.el), `${t.lesson} [${t.sub}]: недопустимый fgos_element ${t.el}`);
    checkText(`${t.lesson} [${t.sub}] subtopic`, t.sub);
    checkText(`${t.lesson} [${t.sub}] prompt`, t.prompt);
    checkText(`${t.lesson} [${t.sub}] student_view`, t.view);
    checkText(`${t.lesson} [${t.sub}] teacher_only`, t.teacher);
    total += 1;
  }
}
for (const [lesson, want] of Object.entries(QUOTA)) {
  const bankKey = lesson.startsWith('10ss-') || lesson.startsWith('10gfx-') ? 'ss' : 'base';
  const have = got.get(`${bankKey}|${lesson}`);
  const w = `${want.basic}/${want.intermediate}/${want.advanced}`;
  if (!have) throw new Error(`${lesson}: не вышло ни одного задания (план ${w})`);
  const h = `${have.basic}/${have.intermediate}/${have.advanced}`;
  if (h !== w) throw new Error(`${lesson}: по плану ${w}, вышло ${h}`);
}
for (const key of got.keys()) {
  const [bankKey, lesson] = key.split('|');
  if (!(lesson in QUOTA)) throw new Error(`${bankKey}: лишний урок ${lesson}`);
}
eq(total, WANT_TOTAL, `ожидали ${WANT_TOTAL} заданий, вышло ${total}`);
console.log(`КВОТЫ OK: всего ${total}`);
console.log(
  Object.entries(QUOTA)
    .map(([l, d]) => `  ${l}: ${d.basic}/${d.intermediate}/${d.advanced}`)
    .join('\n'),
);

for (const b of BANKS) {
  const ids = emit(b);
  const counts = { basic: 0, intermediate: 0, advanced: 0 };
  for (const t of b.tasks) counts[t.d] += 1;
  console.log(
    `BANK-10-3 OK: ${b.path} — ${ids.length} заданий (${ids[0]} … ${ids[ids.length - 1]}), ` +
      `сложности b/i/a = ${counts.basic}/${counts.intermediate}/${counts.advanced}`,
  );
}
console.log(`Проверок выполнено: ${checks}`);