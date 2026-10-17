// Дописывает банк «Сети и безопасность», 11 класс — третий заход (19 заданий).
//
// Устройство как в scripts/make-11-bank2.mjs: ответы считает код, ключи сверяются,
// запись идемпотентна по маркеру MARK (файл режется по своему маркеру и пишется заново).
//
// Главное правило: ответы НЕ пишутся руками.
//  - числовые ответы вычисляются кодом (арифметика, перебор, разбор адресов) и сверяются assert-ом;
//  - эталоны code_run прогоняются локальным Python — expected_stdout берётся из реального
//    вывода solution_code, расхождение роняет сборку;
//  - в single_choice правильный вариант задаётся ТЕКСТОМ, буква вычисляется кодом;
//  - в matching соответствие собирается из массивов left/right.
//
// Запуск: node scripts/make-11-net-bank3.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const MARK = '# ==== СГЕНЕРИРОВАНО scripts/make-11-net-bank3.mjs ====';

const BANK = {
  net: { file: 'data/tasks/11/net/bank-11net.yaml', pfx: 'inf-11-net-', req: 1.1, el: 1.1 },
};

const q = (s) => JSON.stringify(String(s));
const POINTS = { basic: 1, intermediate: 2, advanced: 3 };
// По спецификации банка: basic → remember, intermediate → apply, advanced → analyze.
const COG = { basic: 'remember', intermediate: 'apply', advanced: 'analyze' };
const LETTERS = 'ABCD';

// ---------- состояние банка ----------

const out = { net: [] };
const heads = {};
const next = {};
// Все id, уже занятые в шапке банка: новые номера не должны с ними совпасть.
const takenIds = new Set();

for (const [name, b] of Object.entries(BANK)) {
  const raw = readFileSync(b.file, 'utf-8');
  const cut = raw.indexOf(MARK);
  const head = cut >= 0 ? raw.slice(0, cut) : raw;
  heads[name] = head.replace(/\s+$/, '');
  let max = 0;
  for (const m of heads[name].matchAll(new RegExp(`- id: (${b.pfx}\\d+)`, 'g'))) {
    const id = m[1];
    if (takenIds.has(id)) throw new Error(`${b.file}: повтор id ${id} в шапке`);
    takenIds.add(id);
    max = Math.max(max, Number(id.slice(b.pfx.length)));
  }
  if (max === 0) throw new Error(`${b.file}: не найдено ни одного id ${b.pfx}NNN`);
  next[name] = max + 1;
}

function put(bank, t) {
  const b = BANK[bank];
  const id = `${b.pfx}${String(next[bank]++).padStart(3, '0')}`;
  if (takenIds.has(id)) throw new Error(`id ${id} уже занят в файле`);
  takenIds.add(id);
  const L = [
    `- id: ${id}`,
    '  class: 11',
    `  topic: ${q(t.topic)}`,
    `  subtopic: ${q(t.sub)}`,
    `  type: ${t.type}`,
    `  difficulty: ${t.d}`,
    `  cognitive_level: ${t.cog}`,
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
    topic: o.topic, sub: o.sub, type: 'numeric_base', d: o.d, cog: COG[o.d], lesson: o.lesson,
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
  if (correct !== o.expectLetter) {
    throw new Error(`${o.lesson}: буква ${correct} != ожидаемая ${o.expectLetter} [sub=${o.sub}]`);
  }
  put(bank, {
    topic: o.topic, sub: o.sub, type: 'single_choice', d: o.d, cog: COG[o.d], lesson: o.lesson,
    subj: o.subj, prompt: o.prompt,
    sv: `{ options: [${opts.map((t, i) => `{ id: ${LETTERS[i]}, text: ${q(t)} }`).join(', ')}] }`,
    ac: `{ method: exact_option }`,
    to: `{ answer: ${q(correct)}, explanation: ${q(o.why)} }`,
  });
  return correct;
}

/** matching. Соответствие собирается кодом из left/right, проверяется на полноту и уникальность. */
function mt(bank, o) {
  const pairs = Object.entries(o.map);
  if (pairs.length !== o.left.length) throw new Error(`${o.lesson}: в соответствии ${pairs.length} пар на ${o.left.length} левых`);
  if (o.right.length !== o.left.length) throw new Error(`${o.lesson}: правых ${o.right.length} на ${o.left.length} левых`);
  const vals = pairs.map(([, v]) => v);
  if (new Set(vals).size !== vals.length) throw new Error(`${o.lesson}: правые варианты повторяются`);
  for (const v of vals) if (!o.right.includes(v)) throw new Error(`${o.lesson}: «${v}» нет среди правых`);
  for (const l of o.left) if (!o.map[l]) throw new Error(`${o.lesson}: нет пары для «${l}»`);
  put(bank, {
    topic: o.topic, sub: o.sub, type: 'matching', d: o.d, cog: COG[o.d], lesson: o.lesson,
    subj: o.subj, prompt: o.prompt,
    sv: `{ left: [${o.left.map(q).join(', ')}], right: [${o.right.map(q).join(', ')}] }`,
    ac: `{ method: matching, partial: proportional }`,
    to: `{ answer_map: { ${o.left.map((l) => `${q(l)}: ${q(o.map[l])}`).join(', ')} }, explanation: ${q(`${o.why} Верно: ${o.left.map((l) => `${l} = ${o.map[l]}`).join('; ')}.`)} }`,
  });
}

/** Локальный прогон эталона. Возвращает stdout без хвостовых переводов строк. */
function py(code) {
  const res = execFileSync('python3', ['-c', code], {
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
    topic: o.topic, sub: o.sub, type: 'code_run', d: o.d, cog: COG[o.d], lesson: o.lesson,
    subj: o.subj, prompt: o.prompt,
    sv: `{ language: python, template: ${q(o.template)} }`,
    ac: `{ method: code_stdout, timeout_s: 10 }`,
    to: `{ solution_code: ${q(o.solution)}, expected_stdout: ${q(outp)}, explanation: ${q(o.why)} }`,
  });
}

// ---------- математика для ответов (всё считает код) ----------

/** Число адресов узлов в подсети по префиксу: 2^(32−p) − 2 (минус сеть и широковещание). */
function hostsIn(prefix) {
  if (!Number.isInteger(prefix) || prefix < 1 || prefix > 31) throw new Error(`префикс /${prefix}`);
  return 2 ** (32 - prefix) - 2;
}

/** Базовый октет адреса сети для последнего байта длины блока (подсеть /p). */
function networkOctet(prefix) {
  const block = 2 ** (32 - prefix);
  const oct = Math.floor(64 / block) * block;
  if (oct + block > 256) throw new Error(`блок /${prefix} не помещается в октет 64`);
  return oct;
}

/** Побитовое И по префиксу: отсекает хостовую часть адреса. */
function maskNum(prefix) {
  return (0xffffffff ^ (2 ** (32 - prefix) - 1)) >>> 0;
}

/** IP-строка → 32-битное число, октет за октетом. */
function ipToNum(s) {
  const parts = s.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    throw new Error(`адрес «${s}» разобран неверно`);
  }
  return parts.reduce((acc, p) => (acc * 256 + p) >>> 0, 0);
}

/** Адрес после отсечения хостовой части маской /prefix (беззнаковое 32-битное). */
function networkOf(s, prefix) {
  return ((ipToNum(s) & maskNum(prefix)) >>> 0);
}

/** Адрес n-го узла подсети (нумерация с единицы). */
function hostAddr(octet, prefix, k) {
  const block = 2 ** (32 - prefix);
  const last = octet + block - 2;
  const first = octet + 1;
  const addr = first + (k - 1);
  if (k < 1 || addr > last) throw new Error(`узла ${k} нет в подсети ${octet}/${prefix}`);
  return addr;
}

const NET = 'Сети';
const SAF = 'Безопасность и ИИ';

// ═════════════ 11net-01-networks · локальная сеть и подсети ═════════════

// ── 11net-01-networks | сложные: адрес и подсети (1) ──
{
  const prefixes = [26, 27, 28, 26];
  const counts = prefixes.map(hostsIn);
  const total = counts.reduce((a, b) => a + b, 0);
  const list = prefixes.map((p, i) => `/${p} → 2^${32 - p} − 2 = ${counts[i]}`).join('; ');
  if (counts.join(',') !== '62,30,14,62') throw new Error(`узлы в подсетях: ${counts}`);
  if (total !== 168) throw new Error(`всего узлов: ${total}`);
  cr('net', {
    topic: NET, d: 'advanced', lesson: '11net-01-networks', subj: 'inf-11-net-mask',
    sub: 'Адреса узлов в нескольких подсетях',
    prompt: `Локальная сеть разделена на четыре подсети с масками ${prefixes.map((p) => `/${p}`).join(', ')}. Адрес сети и широковещательный адрес узлам не назначают. Сколько всего адресов узлов во всех четырёх подсетях? Выведите одно число.`,
    template: `# Для каждой маски посчитайте число адресов узлов
prefixes = [26, 27, 28, 26]
total = 0
for p in prefixes:
    # 2 ** (32 - p) значений, из них два заняты: сеть и все узлы
    hosts = ...
    total = total + hosts
print(total)`,
    solution: `prefixes = [26, 27, 28, 26]
total = 0
for p in prefixes:
    hosts = 2 ** (32 - p) - 2
    total = total + hosts
print(total)`,
    expected: '168',
    why: `Подсчёт по маскам: ${list}. Сумма: ${counts.join(' + ')} = ${total}. Чем короче префикс, тем больше адресов: в /26 их 62, в /27 — уже 30. Забыть про два зарезервированных адреса — самая частая ошибка: без неё получилось бы ${total + prefixes.length * 2}. Такой же расчёт в LibreOffice Calc делается формулой =2^(32−p)−2.`,
  });
}

// ═════════════ 11net-02-html · теги, атрибуты, доступность ═════════════

// ── 11net-02-html | базовые: атрибуты и формы (2) ──
{
  const opts = [
    'Задаёт текст, который показывается при наведении мыши',
    'Задаёт адрес, который откроется при переходе по ссылке',
    'Задаёт цвет текста ссылки',
    'Задаёт имя файла, в который браузер сохранит страницу',
  ];
  sc('net', {
    topic: NET, d: 'basic', lesson: '11net-02-html', subj: 'inf-11-net-html',
    sub: 'Атрибут href',
    prompt: 'У ссылки задан атрибут href="docs/lesson.html". Что он задаёт?',
    opts, correctText: opts[1], expectLetter: 'B',
    why: 'Адрес, который откроется по ссылке, пишут в атрибуте href тега <a>. Текст подсказки при наведении задают отдельно — атрибутом title, а цвет ссылки меняет стиль, а не атрибут у ссылки. Если href забыть, ссылка останется просто текстом.',
  });
}
{
  const opts = [
    'Подпись не связана с полем: её нужно продублировать вручную рядом с полем',
    'Подпись связана с нужным полем ввода: при щелчке по ней фокус переходит в поле, а экранные читалки читают её как имя поля',
    'Подпись отправляется на сервер вместе со значением поля в виде отдельного пункта',
    'Подпись скрывает поле, чтобы его нельзя было заполнить',
  ];
  sc('net', {
    topic: NET, d: 'basic', lesson: '11net-02-html', subj: 'inf-11-net-html',
    sub: 'Подпись поля формы',
    prompt: 'В форме есть поле для фамилии и подпись «Фамилия». Как её связать с полем, чтобы форма осталась доступной?',
    opts, correctText: opts[1], expectLetter: 'B',
    why: 'Связь делают атрибутом for у тега <label> и таким же значением id у поля: <label for="fam">Фамилия</label><input id="fam">. Без этой связи экранная читалка читает поле безымянным, а пользователь, работающий с клавиатуры, вынужден нажимать на сам input. Доступность формы начинается с имён её полей.',
  });
}

// ── 11net-02-html | сложные: проверка вложенности тегов (1) ──
{
  const stream = ['html', 'head', 'title', '/title', '/head', 'body', 'ul', 'li', 'p', 'b', '/p', '/li', '/b', '/ul', '/body', '/html'];
  const mism = [];
  const stack = [];
  let mm = 0;
  for (const t of stream) {
    if (t.startsWith('/')) {
      const top = stack.pop();
      if (top !== t.slice(1)) { mism.push(`/ завершает «${top}»`); mm += 1; }
    } else {
      stack.push(t);
    }
  }
  if (mm !== 3) throw new Error(`несовпадений: ${mm}`);
  if (stack.length !== 0) throw new Error(`в стеке осталось: ${stack.join(',')}`);
  if (mism.join('; ') !== '/ завершает «b»; / завершает «p»; / завершает «li»') {
    throw new Error(`разбор несовпадений: ${mism.join('; ')}`);
  }
  cr('net', {
    topic: NET, d: 'advanced', lesson: '11net-02-html', subj: 'inf-11-net-html',
    sub: 'Проверка вложенности стеком',
    prompt: 'Разметка страницы задана потоком тегов без содержимого: html, head, title, /title, /head, body, ul, li, p, b, /p, /li, /b, /ul, /body, /html. Закрывающий тег должен закрывать последний открытый. Проверьте разметку стеком: закрывающий тег снимает вершину стека, и если имя не совпало — засчитайте одно несовпадение и всё равно снимите вершину. Выведите сначала число несовпадений, затем итоговый размер стека — через пробел.',
    template: `# Разбор потока тегов стеком
stream = ['html', 'head', 'title', '/title', '/head', 'body', 'ul', 'li', 'p', 'b',
          '/p', '/li', '/b', '/ul', '/body', '/html']
stack = []
bad = 0
for t in stream:
    if t.startswith('/'):
        # снимаем вершину и сверяем имена
        ...
    else:
        stack.append(t)
print(bad, len(stack))`,
    solution: `stream = ['html', 'head', 'title', '/title', '/head', 'body', 'ul', 'li', 'p', 'b',
          '/p', '/li', '/b', '/ul', '/body', '/html']
stack = []
bad = 0
for t in stream:
    if t.startswith('/'):
        top = stack.pop()
        if top != t[1:]:
            bad = bad + 1
    else:
        stack.append(t)
print(bad, len(stack))`,
    expected: '3 0',
    why: `Стек разбирает поток так: /title, /head, /body и /ul закрывают то, что открыли, — несовпадений там нет. Дальше пошло скрещение тегов: /p пытается закрыть b, /li — p, /b — li, поэтому набралось ${mm} несовпадения, а стек в конце пуст (размер 0): все закрывающие теги на месте, но стоят не в том порядке. Браузер такое исправит молча и покажет не то, что задумано, поэтому проверять разметку стеком стоит до открытия страницы.`,
  });
}

// ═════════════ 11net-03-services · сервисы и работа с документами ═════════════

// ── 11net-03-services | базовые: программа и доступ к файлу (2) ──
{
  const opts = [
    'LibreOffice Writer — он открывает и редактирует текстовые документы формата .odt',
    'LibreOffice Impress — он открывает и редактирует текстовые документы формата .odt',
    'Веб-браузер — он открывает и редактирует текстовые документы формата .odt',
    'Просмотр изображений — он открывает и редактирует текстовые документы формата .odt',
  ];
  sc('net', {
    topic: NET, d: 'basic', lesson: '11net-03-services', subj: 'inf-11-net-services',
    sub: 'Открытие документа в LibreOffice',
    prompt: 'Учитель прислал отчёт об учебной практике в формате .odt. В какой программе его удобно открыть и исправить?',
    opts, correctText: opts[0], expectLetter: 'A',
    why: 'Расширение .odt — формат текстовых документов LibreOffice, и открывает его LibreOffice Writer. Impress отвечает за презентации, а браузер и просмотр изображений такие файлы просто не откроют. Формат .odt выбран ещё и потому, что такой файл можно бесплатно открыть на любом компьютере.',
  });
}
{
  const opts = [
    'Передать сам файл письмом и дописать пароль от архива в сообщении',
    'Скопировать файл себе, изменить имя и загрузить второй файл поверх первого',
    'Отправить ссылку с доступом на просмотр: пароль от учётной записи учителю передавать не нужно',
    'Распечатать файл на бумаге и передать её лично',
  ];
  sc('net', {
    topic: NET, d: 'basic', lesson: '11net-03-services', subj: 'inf-11-net-services',
    sub: 'Общий доступ к файлу',
    prompt: 'Отчёт лежит в облачном диске. Учитель с другого компьютера должен его посмотреть. Как передать доступ правильно?',
    opts, correctText: opts[2], expectLetter: 'C',
    why: 'В облачном диске доступ выдают ссылкой с нужными правами — часто только на просмотр, без возможности редактирования. Файл при этом остаётся один, а учителю не приходится передавать свой пароль, который мог бы увидеть кто-то ещё. Копирование файла «поверх» старого не решает задачу: права всё равно придётся раздавать заново.',
  });
}

// ── 11net-03-services | сложные: расчёт времени загрузки (1) ──
{
  const sizes = [41, 64, 35];
  const speed = 6;
  const sum = sizes.reduce((a, b) => a + b, 0);
  const secs = Math.ceil(sum / speed);
  const whole = Math.floor(sum / speed);
  if (sum !== 140) throw new Error(`объём: ${sum}`);
  if (whole !== 23 || secs !== 24) throw new Error(`время: ${whole}/${secs}`);
  cr('net', {
    topic: NET, d: 'advanced', lesson: '11net-03-services', subj: 'inf-11-net-services',
    sub: 'Время загрузки файлов',
    prompt: `В облако последовательно загружают три файла: ${sizes.join(' МБ, ')} МБ. Скорость загрузки — ${speed} МБ в секунду и не меняется. Через сколько секунд загрузятся все три файла? Дробные секунды округляйте вверх. Выведите одно целое число.`,
    template: `# Сложите объём файлов и разделите на скорость, округлив вверх
import math

sizes = [41, 64, 35]
speed = 6
total = 0
for s in sizes:
    # накапливаем общий объём в мегабайтах
    ...
# остаток секунды не считается за завершённую загрузку
print(math.ceil(total / speed))`,
    solution: `import math

sizes = [41, 64, 35]
speed = 6
total = 0
for s in sizes:
    total = total + s
print(math.ceil(total / speed))`,
    expected: '24',
    why: `Общий объём: ${sizes.join(' + ')} = ${sum} МБ. Деление на скорость даёт ${sum} / ${speed} = ${whole} с остатком, а загрузка не закончится раньше, чем придёт последний байт: округляем вверх и получаем ${secs}. Делить каждый файл на скорость отдельно и складывать округлённые значения нельзя — остатки накапливаются и ответ завышается.`,
  });
}

// ═════════════ 11net-04-control · контроль содержимого и адресация ═════════════

// ── 11net-04-control | базовое: фильтрация содержимого (1) ──
{
  const opts = [
    'Включить безопасный поиск в настройках поисковика и запретить показ сайтов для взрослых',
    'Ничего: фильтры влияют только на рекламу, а содержимое сайтов остаётся прежним',
    'Отключить интернет до конца урока — фильтр не работает при отключённой сети',
    'Удалить из выдачи все сайты, кроме одного, который нравится',
  ];
  sc('net', {
    topic: NET, d: 'basic', lesson: '11net-04-control', subj: 'inf-11-net-dev',
    sub: 'Фильтр содержимого',
    prompt: 'Что нужно сделать, чтобы в результатах поиска не появлялись сайты с неподходящим содержимым?',
    opts, correctText: opts[0], expectLetter: 'A',
    why: 'Фильтрация настраивается самим поисковиком: у него есть безопасный поиск, который не отдаёт в выдаче страницы для взрослых и с сомнительным содержанием. Ограничение живёт на стороне поисковика, а не на вашем компьютере, поэтому отключение интернета или правка настроек браузера его не отменяет. Раз родители выбрали режим «Детский», под фильтр попадает всё содержимое, а не одно название.',
  });
}

// ── 11net-04-control | среднее: адрес узла по номеру (1) ──
{
  const octet = 64;
  const prefix = 27;
  const k = 20;
  const addr = hostAddr(octet, prefix, k);
  const block = 2 ** (32 - prefix);
  const count = hostsIn(prefix);
  const net = networkOctet(prefix);
  if (net !== octet) throw new Error(`сеть: ${net} != ${octet}`);
  if (count !== 30) throw new Error(`узлов в /27: ${count}`);
  if (addr !== 84) throw new Error(`адрес ${k}-го узла: ${addr}`);
  num('net', {
    topic: NET, d: 'intermediate', lesson: '11net-04-control', subj: 'inf-11-net-mask',
    sub: 'Адрес узла по номеру',
    prompt: `Подсеть с адресом сети 192.168.4.${net} и маской /${prefix}: адреса узлов идут подряд с ${octet + 1} по ${octet + block - 2}. Какой последний октет будет у ${k}-го узла этой подсети? Запишите только число.`,
    value: addr,
    why: `Маска /${prefix} оставляет ${32 - prefix} бит под адрес узла, то есть ${block} адресов: ${net} — сама сеть, ${octet + block - 1} — все узлы сразу, а узлам принадлежат ${net + 1} … ${net + block - 2} (всего ${count}). Отсчёт ведём с единицы, поэтому ${k}-й узел стоит на ${k - 1} адрес дальше первого: ${octet + 1} + (${k} − 1) = ${addr}. Если забыть про адрес сети, ответ сдвинется на единицу — к ${addr - 1}, которого узлу не принадлежит.`,
  });
}

// ── 11net-04-control | сложные: разбор адресов по подсетям (1) ──
{
  const addrs = ['192.168.10.1', '192.168.10.65', '192.168.11.5', '192.168.10.200', '10.0.0.1'];
  const net24 = '192.168.10.0';
  const net26 = '192.168.10.64';
  const in24 = addrs.filter((s) => networkOf(s, 24) === ipToNum(net24));
  const in26 = addrs.filter((s) => networkOf(s, 26) === ipToNum(net26));
  if (in24.join(',') !== '192.168.10.1,192.168.10.65,192.168.10.200') throw new Error(`/24: ${in24.join(',')}`);
  if (in26.join(',') !== '192.168.10.65') throw new Error(`/26: ${in26.join(',')}`);
  if (in24.length !== 3 || in26.length !== 1) throw new Error(`счётчики: ${in24.length}/${in26.length}`);
  cr('net', {
    topic: NET, d: 'advanced', lesson: '11net-04-control', subj: 'inf-11-net-mask',
    sub: 'Отбор адресов по подсетям',
    prompt: `Список адресов узлов: ${addrs.join(', ')}. Определите, сколько из них принадлежат подсети 192.168.10.0/24, а сколько — более узкой подсети 192.168.10.64/26. Переведите каждый адрес в одно число и отсеките хостовую часть маской. Выведите два числа через пробел: сначала для /24, затем для /26.`,
    template: `# Переведите адрес в число и примените маску побитово
addrs = ['192.168.10.1', '192.168.10.65', '192.168.11.5', '192.168.10.200', '10.0.0.1']

def to_num(s):
    n = 0
    for part in s.split('.'):
        n = n * 256 + int(part)
    return n

def mask(prefix):
    return (2 ** 32 - 1) ^ (2 ** (32 - prefix) - 1)

n24 = 0
n26 = 0
for s in addrs:
    a = to_num(s)
    # сравниваем с адресом сети после отсечения хостовой части
    ...
print(n24, n26)`,
    solution: `addrs = ['192.168.10.1', '192.168.10.65', '192.168.11.5', '192.168.10.200', '10.0.0.1']

def to_num(s):
    n = 0
    for part in s.split('.'):
        n = n * 256 + int(part)
    return n

def mask(prefix):
    return (2 ** 32 - 1) ^ (2 ** (32 - prefix) - 1)

n24 = 0
n26 = 0
for s in addrs:
    a = to_num(s)
    if (a & mask(24)) == to_num('192.168.10.0'):
        n24 = n24 + 1
    if (a & mask(26)) == to_num('192.168.10.64'):
        n26 = n26 + 1
print(n24, n26)`,
    expected: '3 1',
    why: `Переводим адрес в одно число октет за октетом, а маску строим как ${'2³² − 1'} минус единицы в хвостовых битах. Побитовое И отсекает хостовую часть: в подсети 192.168.10.0/24 остались ${in24.join(', ')} — всего ${in24.length}, а адрес 192.168.11.5 отпал уже по третьему октету. Подсеть /26 — это 192.168.10.64–192.168.10.127, из неё подходит только 192.168.10.65: у 192.168.10.200 третий байт после маски равен 192, а не 64. Обратите внимание: 192.168.10.200 входит в /24 и не входит в /26 — подсети вложены, и это нормально.`,
  });
}

// ═════════════ 11net-05-etiquette · этикет, поиск, достоверность ═════════════

// ── 11net-05-etiquette | базовое: оценка источника (1) ──
{
  const opts = [
    'На источник опираться нельзя: не указаны автор, дата обновления и первоисточники',
    'Источник надёжный: сайт работает и открывается без ошибок',
    'Источник надёжный: в нём есть регистрация и счётчик посещений',
    'Источник надёжный: текст написан грамотно и без ошибок',
  ];
  sc('net', {
    topic: NET, d: 'basic', lesson: '11net-05-etiquette', subj: 'inf-11-net-fake',
    sub: 'Оценка сайта-источника',
    prompt: 'На странице нет ни автора, ни даты обновления, ни ссылок на первоисточники, зато есть форма запроса персональных данных. Как такой источник оценить?',
    opts, correctText: opts[0], expectLetter: 'A',
    why: 'Работающий сайт, грамотный текст и счётчик посещений ничего не говорят о достоверности. Критерии строгие: автор, дата, возможность перепроверить факт по первоисточнику и понятные условия работы с данными. Их отсутствие — повод не ссылаться на такой источник в работе, тем более когда страница требует персональные данные.',
  });
}

// ── 11net-05-etiquette | среднее: признаки надёжного источника (1) ──
{
  const left = ['Автор и его контакты', 'Дата публикации и обновления', 'Ссылки на первоисточники', 'Условия работы с данными'];
  // right[i] — смысл для left[i], порядок соответствия задан индексами (см. map ниже).
  const right = ['кто и на каком основании это утверждает', 'когда информация перестала быть актуальной', 'можно ли перепроверить сам факт', 'что сервис сделает с введёнными данными'];
  const map = Object.fromEntries(left.map((l, i) => [l, right[i]]));
  mt('net', {
    topic: NET, d: 'intermediate', lesson: '11net-05-etiquette', subj: 'inf-11-net-fake',
    sub: 'Признаки надёжного источника',
    prompt: 'Установите соответствие: что смотрят на сайте — какой это признак надёжного источника.',
    left, right, map,
    why: 'Четыре проверки независимы, и проверить надо каждую: подпись сайта есть, а автора нет — источник всё равно слабый. Самая недооценённая — последняя: если правила обработки данных непонятны, отправлять форму с персональными данными такому сайту не стоит.',
  });
}

// ── 11net-05-etiquette | сложные: отбор выдачи по запросу (1) ──
{
  const titles = [
    'Основы Python: переменные и циклы',
    'Python для начинающих: первый проект',
    'История и будущее Python',
    'Алгоритмы на Python: сортировка',
    'Основы сетей и протоколов TCP',
    'Основы Python: файлы и данные',
  ];
  const words = ['python', 'основы'];
  const found = titles.filter((t) => words.every((w) => t.toLowerCase().includes(w)));
  if (found.length !== 2) throw new Error(`совпадений: ${found.length} [${found.join('; ')}]`);
  if (found.join('|') !== 'Основы Python: переменные и циклы|Основы Python: файлы и данные') {
    throw new Error(`подбор заголовков: ${found.join('; ')}`);
  }
  cr('net', {
    topic: NET, d: 'advanced', lesson: '11net-05-etiquette', subj: 'inf-11-net-search',
    sub: 'Отбор заголовков по ключевым словам',
    prompt: `Заголовки из поисковой выдачи: ${titles.map((t) => `«${t}»`).join(', ')}. Запрос содержит два ключевых слова: ${words.join(' и ')}. Считайте подходящими только те заголовки, в которых есть оба слова (регистр не учитывается). Выведите одно число — сколько таких заголовков.`,
    template: `# Отберите заголовки, где есть все ключевые слова
titles = [
    'Основы Python: переменные и циклы',
    'Python для начинающих: первый проект',
    'История и будущее Python',
    'Алгоритмы на Python: сортировка',
    'Основы сетей и протоколов TCP',
    'Основы Python: файлы и данные',
]
words = ['python', 'основы']
good = 0
for t in titles:
    low = t.lower()
    ok = True
    for w in words:
        # проверяем наличие каждого слова и сбрасываем признак при неудаче
        ...
    if ok:
        good = good + 1
print(good)`,
    solution: `titles = [
    'Основы Python: переменные и циклы',
    'Python для начинающих: первый проект',
    'История и будущее Python',
    'Алгоритмы на Python: сортировка',
    'Основы сетей и протоколов TCP',
    'Основы Python: файлы и данные',
]
words = ['python', 'основы']
good = 0
for t in titles:
    low = t.lower()
    ok = True
    for w in words:
        if w not in low:
            ok = False
    if ok:
        good = good + 1
print(good)`,
    expected: '2',
    why: `Условие «оба слова» — это логическое И: заголовок подходит, только если ни одно слово не потерялось. Подошли ${found.length} заголовка — «Основы Python: переменные и циклы» и «Основы Python: файлы и данные». «Python для начинающих» содержит одно слово из двух, а «Основы сетей и протоколов TCP» — другое. В реальном поиске то же делает запрос со знаком AND: без него выдача шире и в неё попадают страницы «про Python», в которых нужной темы нет.`,
  });
}

// ═════════════ 11safe-01-security · защита информации ═════════════

// ── 11safe-01-security | среднее: стойкий пароль (1) ──
{
  const opts = [
    'Короткая фраза из нескольких несвязанных слов, не используемая в других сервисах',
    'Дата рождения, чтобы её было легко вспомнить',
    'Имя класса и год выпуска — их знают все одноклассники',
    'Один и тот же надёжный пароль на все сайты, чтобы не путаться',
  ];
  sc('net', {
    topic: SAF, d: 'intermediate', lesson: '11safe-01-security', subj: 'inf-11-safe-layers',
    sub: 'Надёжный пароль',
    prompt: 'Какой из этих паролей разумно выбрать для учётной записи на школьном портале?',
    opts, correctText: opts[0], expectLetter: 'A',
    why: 'Надёжность пароля определяется длиной и непредсказуемостью, а не экзотическими символами. Фраза из четырёх несвязанных слов, не связанных ни с вами, ни со школой, запоминается легко, а подобрать перебором почти невозможно. Дата рождения и класс не подходят: их знают посторонние, а один пароль на все сайты опасен — утечка на любом из них открывает остальные. Запоминать длинные пароли помогает диспетчер паролей: он хранит пароли и подставляет их на нужных сайтах.',
  });
}

// ── 11safe-01-security | сложные: хеш документа (1) ──
{
  const solution = `import hashlib

doc = 'Отчёт по лабораторной работе'
h1 = hashlib.sha256(doc.encode('utf-8')).hexdigest()
changed = doc[:-1] + 'ы'
h2 = hashlib.sha256(changed.encode('utf-8')).hexdigest()
print(h1[:8], h2[:8])`;
  cr('net', {
    topic: SAF, d: 'advanced', lesson: '11safe-01-security', subj: 'inf-11-safe-sign',
    sub: 'Хеш документа и его правки',
    prompt: 'Электронная подпись считается по хешу документа. Возьмите фразу «Отчёт по лабораторной работе», вычислите её хеш SHA-256 и выведите первые 8 символов. Затем замените в фразе последний символ на «ы» и вычислите хеш снова — выведите первые 8 символов второго хеша. Оба значения выведите через пробел.',
    template: `# SHA-256 даёт строку из 16 шестнадцатеричных цифр
import hashlib

doc = 'Отчёт по лабораторной работе'
h1 = hashlib.sha256(doc.encode('utf-8')).hexdigest()
changed = doc[:-1] + 'ы'
# вычисляем хеш изменённой фразы и берём от обоих по 8 символов
...
print(h1[:8], h2[:8])`,
    solution,
    why: 'Хеш — короткий отпечаток документа: изменился один символ, и отпечаток стал другим полностью. Именно поэтому подпись считают по хешу: при попытке подменить документ подпись просто перестанет совпадать. Заодно видно и второе свойство хеша — по нему нельзя восстановить исходный текст, поэтому хеш и называют односторонним. Никакой длины пароля тут не понадобилось: подпись защищает содержимое, а не тайну входа.',
  });
}

// ═════════════ 11safe-02-malware · вредоносное ПО ═════════════

// ── 11safe-02-malware | базовое: исполняемый файл в архиве (1) ──
{
  const opts = [
    'Так выглядит фишинг: под видом документа присылают программу, которая запустится сама',
    'Ничего: в архиве не может быть опасных файлов',
    'Так передают большие файлы — исполняемый файл просто не открывается',
    'Так делают антивирусные проверки, поэтому файл нужно запустить прямо из архива',
  ];
  sc('net', {
    topic: SAF, d: 'basic', lesson: '11safe-02-malware', subj: 'inf-11-safe-mal',
    sub: 'Исполняемый файл в архиве',
    prompt: 'В «объявлении об олимпиаде» пришёл архив, а внутри файл setup.exe. Почему такая находка подозрительна?',
    opts, correctText: opts[0], expectLetter: 'A',
    why: 'Исполняемый файл в архиве, присланном без предупреждения, — типовая удочка фишинга: документ обещают, а присылают программу, которая запускается и ищет данные. Архив используют, чтобы обойти почтовую проверку: вложение не видно без распаковки. Программу из непроверенного письма не запускают — сначала проверяют антивирусом и смотрят, кто отправитель.',
  });
}

// ── 11safe-02-malware | среднее: признак и проверка (1) ──
{
  const left = [
    'Компьютер стал заметно медленнее',
    'Появился незнакомый сетевой трафик',
    'Файлы пропали, а их имена стали странными',
    'Браузер открывает не те страницы',
  ];
  // right[i] — проверка для left[i], соответствие собирается по индексам.
  const right = [
    'открыть диспетчер задач и посмотреть, какой процесс грузит процессор',
    'сравнить список подключений с программами, которые запущены сейчас',
    'проверить компьютер антивирусом и не выполнять требования о выкупе',
    'отключить расширения браузера и проверить настройки прокси',
  ];
  const map = Object.fromEntries(left.map((l, i) => [l, right[i]]));
  mt('net', {
    topic: SAF, d: 'intermediate', lesson: '11safe-02-malware', subj: 'inf-11-safe-mal',
    sub: 'Признак заражения и проверка',
    prompt: 'Установите соответствие: что наблюдается на компьютере — как это проверяют.',
    left, right, map,
    why: 'Каждому симптому соответствует своя проверка, и они независимы: антивирус не покажет, какой процесс грузит процессор, а диспетчер задач не увидит подменённые настройки прокси. При вымогательстве главное — не выполнять требование, потому что оплата гарантии не даёт, а уничтожает ключ расшифровки.',
  });
}

// ═════════════ 11safe-03-archive · архивирование и копии ═════════════

// ── 11safe-03-archive | базовое: что даёт архив (1) ──
{
  const opts = [
    'Файлы собираются в один файл, повторяющиеся данные сжимаются, а случайно удалить файл из архива нельзя',
    'Файлы шифруются паролем, поэтому их нельзя прочитать без него',
    'Файлы копируются на сервер, поэтому они больше не занимают место на компьютере',
    'Файлы переводятся в другой формат, чтобы их нельзя было открыть',
  ];
  sc('net', {
    topic: SAF, d: 'basic', lesson: '11safe-03-archive', subj: 'inf-11-safe-archive',
    sub: 'Что даёт архивирование',
    prompt: 'Что реально происходит, когда папку с документами сжимают в архив?',
    opts, correctText: opts[0], expectLetter: 'A',
    why: 'Архив решает три задачи: файлы лежат в одном месте, размер уменьшается за счёт повторяющихся данных, а удалить один файл из архива случайно нельзя — он лежит внутри. Шифрование здесь ни при чём: пароль в архиве не обязателен. Уменьшить размер удаётся не всегда: фотографии, видео и архивы уже сжаты, и упаковка увеличит их размер на пару процентов.',
  });
}

// ── 11safe-03-archive | среднее: размер архива (1) ──
{
  const sizes = [12, 8, 24];
  const ratios = [0.2, 0.9, 1.0];
  // Считаем в десятых долях мегабайта: дробная арифметика не даёт «хвостов» вида 2.4000000000000004.
  const partsTenths = sizes.map((s, i) => Math.round(s * ratios[i] * 10));
  const parts = partsTenths.map((v) => v / 10);
  const totalTenths = partsTenths.reduce((a, b) => a + b, 0);
  const totalRaw = totalTenths / 10;
  const total = Math.round(totalRaw);
  const kinds = ['текстовый документ', 'PDF с картинками', 'фотографии и видео'];
  if (partsTenths.join(',') !== '24,72,240') throw new Error(`части: ${partsTenths}`);
  if (totalTenths !== 336) throw new Error(`сумма в десятых: ${totalTenths}`);
  if (totalRaw !== 33.6 || total !== 34) throw new Error(`размер архива: ${totalRaw}/${total}`);
  const sol = `sizes = [12, 8, 24]
ratios = [0.2, 0.9, 1.0]
total = 0.0
for i in range(len(sizes)):
    # доля файла после сжатия
    part = sizes[i] * ratios[i]
    total = total + part
print(round(total))`;
  cr('net', {
    topic: SAF, d: 'intermediate', lesson: '11safe-03-archive', subj: 'inf-11-safe-archive',
    sub: 'Размер архива по типам файлов',
    prompt: `В папке лежат три группы файлов: ${kinds.map((k, i) => `${sizes[i]} МБ (${k})`).join(', ')}. В архиве текст сжимается в 5 раз, PDF с картинками — примерно к 90 % от исходного размера, а фотографии и видео не сжимаются вовсе. Сколько мегабайт займёт архив? Выведите целое число (округление до ближайшего целого).`,
    template: `# Умножьте размер каждой группы на коэффициент сжатия и сложите
sizes = [12, 8, 24]
ratios = [0.2, 0.9, 1.0]
total = 0.0
for i in range(len(sizes)):
    # доля файла после сжатия
    part = ...
    total = total + part
print(round(total))`,
    solution: sol,
    expected: '34',
    why: `Считаем по частям: ${sizes[0]} · ${ratios[0]} = ${parts[0]}, ${sizes[1]} · ${ratios[1]} = ${parts[1]}, ${sizes[2]} · ${ratios[2]} = ${parts[2]}. Сумма ${parts.join(' + ')} = ${totalRaw.toFixed(1)} МБ, округляем до ${total}. Вывод здесь важнее арифметики: из ${sizes.reduce((a, b) => a + b, 0)} МБ исходных данных почти не сжались ${sizes[2]} МБ фотографий и видео — они уже в сжатом виде, и повторное сжатие лишь добавляет проценты. Ради одних фотографий архив и не делают.`,
  });
}

// ═════════════ САМОПРОВЕРКА ЗАДАНИЙ ═════════════

for (const [name, items] of Object.entries(out)) {
  for (const item of items) {
    const id = /^- id: (\S+)$/m.exec(item)[1];
    const d = /^\s*difficulty: (\S+)$/m.exec(item)[1];
    const pts = Number(/^\s*points: (\d+)$/m.exec(item)[1]);
    const cog = /^\s*cognitive_level: (\S+)$/m.exec(item)[1];
    const lesson = /^\s*lesson: (\S+)$/m.exec(item)[1];
    const type = /^\s*type: (\S+)$/m.exec(item)[1];
    if (!lesson) throw new Error(`${id}: нет lesson`);
    if (!(d in POINTS)) throw new Error(`${id}: неизвестная сложность «${d}»`);
    if (pts !== POINTS[d]) throw new Error(`${id}: points ${pts} != ${POINTS[d]} для ${d}`);
    if (cog !== COG[d]) throw new Error(`${id}: cognitive_level ${cog} != ${COG[d]} для ${d}`);
    if (!['numeric_base', 'single_choice', 'matching', 'code_run'].includes(type)) {
      throw new Error(`${id}: неизвестный тип «${type}»`);
    }
    if (!/^\s*teacher_only: \{/m.test(item)) throw new Error(`${id}: нет teacher_only`);
    if (d === 'advanced' && pts !== 3) throw new Error(`${id}: advanced должен стоить 3 балла`);
  }
  if (items.length === 0) throw new Error(`${name}: ничего не сгенерировано`);
}

// ═════════════ КВОТЫ ═════════════

// урок → { сложность → сколько заданий }
const QUOTA = {
  '11net-01-networks': { basic: 0, intermediate: 0, advanced: 1 },
  '11net-02-html': { basic: 2, intermediate: 0, advanced: 1 },
  '11net-03-services': { basic: 2, intermediate: 0, advanced: 1 },
  '11net-04-control': { basic: 1, intermediate: 1, advanced: 1 },
  '11net-05-etiquette': { basic: 1, intermediate: 1, advanced: 1 },
  '11safe-01-security': { basic: 0, intermediate: 1, advanced: 1 },
  '11safe-02-malware': { basic: 1, intermediate: 1, advanced: 0 },
  '11safe-03-archive': { basic: 1, intermediate: 1, advanced: 0 },
};
const TOTAL_QUOTA = 19;

const got = {};
const byDiff = { basic: 0, intermediate: 0, advanced: 0 };
const byType = {};
for (const [name, items] of Object.entries(out)) {
  for (const item of items) {
    const lesson = /^\s*lesson: (\S+)$/m.exec(item)[1];
    const d = /^\s*difficulty: (\S+)$/m.exec(item)[1];
    const t = /^\s*type: (\S+)$/m.exec(item)[1];
    got[lesson] = got[lesson] ?? { basic: 0, intermediate: 0, advanced: 0 };
    got[lesson][d] += 1;
    byDiff[d] += 1;
    byType[t] = (byType[t] ?? 0) + 1;
  }
}
for (const [lesson, plan] of Object.entries(QUOTA)) {
  const f = got[lesson] ?? { basic: 0, intermediate: 0, advanced: 0 };
  for (const d of ['basic', 'intermediate', 'advanced']) {
    if (f[d] !== plan[d]) {
      throw new Error(`${lesson}/${d}: ожидалось ${plan[d]}, получено ${f[d]}`);
    }
  }
}
const extra = Object.keys(got).filter((l) => !(l in QUOTA));
if (extra.length) throw new Error(`лишние уроки: ${extra.join(', ')}`);
const TOTAL = Object.values(byDiff).reduce((s, n) => s + n, 0);
if (TOTAL !== TOTAL_QUOTA) throw new Error(`всего ${TOTAL} заданий, а нужно ${TOTAL_QUOTA}`);

console.log(`КВОТЫ OK: всего ${TOTAL}`);
console.log(`по сложности: basic=${byDiff.basic} intermediate=${byDiff.intermediate} advanced=${byDiff.advanced}`);
console.log(`по типам: ${Object.entries(byType).map(([t, k]) => `${t}=${k}`).join(' ')}`);
for (const [lesson, plan] of Object.entries(QUOTA)) {
  console.log(`  ${lesson}: basic=${plan.basic} intermediate=${plan.intermediate} advanced=${plan.advanced}`);
}

if (process.env.PREVIEW) {
  for (const [name, items] of Object.entries(out)) {
    for (const line of items) console.log(line + '\n');
  }
} else {
  for (const [name, b] of Object.entries(BANK)) {
    writeFileSync(b.file, `${heads[name]}\n\n${[MARK, ...out[name]].join('\n\n')}\n`, 'utf-8');
    console.log(`BANK-11-NET-3 OK: ${b.file} — добавлено ${out[name].length} (последний id ${next[name] - 1})`);
  }
}