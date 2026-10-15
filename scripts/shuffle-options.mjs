// Перемешивает варианты ответов в single_choice заданиях банков.
//
// ЗАЧЕМ: генераторы ставили правильный вариант первым (буква A), и в банке
// накопился перекос — правильный ответ «A» шёл в 476 заданиях из 525.
// Ученик, который всегда отвечает «A», получал 91% по single_choice.
//
// Детерминирован: seed — fnv1a(id задания). Порядок перед перемешиванием
// приводится к каноническому (сортировка по тексту варианта), поэтому повторный
// запуск на уже перемешанном файле даёт тот же результат, а не «перемешивает
// ещё раз». Без этого скрипт портил файл при каждом запуске.
//
// ВАЖНО: после перестановки id перенумеровываются по новой позиции. Раньше
// этого не было, и answer писался буквой позиции при старых буквах в массиве —
// ключ указывал на чужой вариант. Так в банках накопилось 59 неверных ключей,
// которые пришлось чинить вручную.
//
// Запуск:
//   node scripts/shuffle-options.mjs                      — банки по списку FILES
//   node scripts/shuffle-options.mjs путь/к/файлу.yaml ... — только указанные файлы
import { readFileSync, writeFileSync } from 'node:fs';

const TARGETS = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const FILES = TARGETS.length
  ? TARGETS
  : [
  'data/tasks/7/information/bank-7inf.yaml',
  'data/tasks/7/base/bank-7base.yaml',
  'data/tasks/7/media/bank-7media.yaml',
  'data/tasks/8/number-systems/bank.yaml',
  'data/tasks/8/number-systems/bank-gen.yaml',
  'data/tasks/8/logic/bank-logic.yaml',
  'data/tasks/8/algorithms/bank-algo.yaml',
  'data/tasks/8/code-run/bank-code.yaml',
  'data/tasks/9/spreadsheets/bank-9sheet.yaml',
  'data/tasks/9/arrays/bank-9arr.yaml',
  'data/tasks/9/graphs/bank-9graph.yaml',
  'data/tasks/9/extra/bank-9extra.yaml',
  'data/tasks/10/base/bank-10base.yaml',
  'data/tasks/10/ss/bank-10ss.yaml',
  'data/tasks/10/logic/bank-10logic.yaml',
  'data/tasks/10/media/bank-10media.yaml',
  'data/tasks/11/data/bank-11data.yaml',
  'data/tasks/11/db/bank-11db.yaml',
  'data/tasks/11/algo/bank-11algo.yaml',
  'data/tasks/11/net/bank-11net.yaml',
  'data/tasks/11/graph/bank-11graph.yaml',
];

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const OPT_RE = /(\{ id: ([A-D]), text: ("(?:[^"\\]|\\.)*") \})/g;

/**
 * Снимает кавычки и экранирование со скалярного значения YAML. Нужна, чтобы
 * сравнивать ТЕКСТ варианта с answer_text, а не их записанные в исходнике формы:
 * форма может отличаться (`'` против `"`), а смысл один.
 */
function unquote(raw) {
  const s = raw.trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\(["\\])/g, '$1');
  }
  if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

let totalShuffled = 0;
let totalTasks = 0;
let fatal = 0;

for (const file of FILES) {
  const raw = readFileSync(file, 'utf-8');
  // Разбиваем на задания по "- id: " в начале строки
  const parts = raw.split(/^- id: /m).map((p, i) => (i === 0 ? p : '- id: ' + p));
  let changed = 0;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part.startsWith('- id: ')) continue;
    const idM = /^- id: (\S+)/.exec(part);
    if (!idM) continue;
    const id = idM[1];
    if (!/type: single_choice/.test(part)) continue;
    totalTasks++;

    // Находим student_view: { options: [...] }
    const svM = /student_view: \{ options: \[(.*)\] \}/.exec(part);
    if (!svM) {
      console.error(`  ! ${id}: не найдена секция options`);
      continue;
    }
    const inner = svM[1];
    const items = [];
    let m;
    OPT_RE.lastIndex = 0;
    while ((m = OPT_RE.exec(inner)) !== null) {
      items.push({ full: m[1], letter: m[2], text: m[3] });
    }
    if (items.length < 2) continue;

    // Верный вариант опознаём по ТЕКСТУ (teacher_only.answer_text), а не по букве.
    // Буква — производная от порядка вариантов, и опора на неё здесь и породила
    // 59 неверных ключей: массив перемешивался, а буквы оставались старые.
    const ansM = /teacher_only: \{ answer: "?([A-D])"?,?/.exec(part);
    if (!ansM) {
      console.error(`  ! ${id}: не найден answer`);
      fatal++;
      continue;
    }
    const oldLetter = ansM[1];
    const atM = /answer_text:\s*("(?:[^"\\]|\\.)*"|'(?:[^']|'')*')/.exec(part);
    if (!atM) {
      console.error(`  ! ${id}: нет answer_text — перемешивать нельзя, верный вариант не назван`);
      fatal++;
      continue;
    }
    const wantText = unquote(atM[1]);

    // Канонический порядок перед перемешиванием: по тексту варианта. Тогда
    // результат зависит только от seed и содержимого вариантов, а не от того, в каком
    // порядке они лежат в файле сейчас. Это и делает скрипт идемпотентным.
    const canonical = items
      .slice()
      .sort((a, b) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
    const oldIdx = canonical.findIndex((it) => unquote(it.text) === wantText);
    if (oldIdx < 0) {
      console.error(`  ! ${id}: текст «${wantText}» не найден среди вариантов`);
      fatal++;
      continue;
    }
    if (canonical[oldIdx].letter !== oldLetter) {
      // answer и answer_text разошлись: чинить надо в банке, а не молча брать
      // одну из сторон — иначе ошибка закрепится в файле.
      console.error(`  ! ${id}: answer=${oldLetter}, а answer_text указывает на ${canonical[oldIdx].letter}`);
      fatal++;
      continue;
    }

    // Перемешиваем
    const rng = mulberry32(fnv1a(id));
    const order = shuffle(canonical.map((_, k) => k), rng);
    const newItems = order.map((k) => canonical[k]);
    const newIdx = order.indexOf(oldIdx);

    // Перенумеровываем id ПО НОВЫЙ ПОЗИЦИИ. Без этого в файле остаются старые
    // буквы в перемешанном порядке, а answer ниже пишется буквой позиции — и
    // ключ указывает на чужой вариант. Именно так в банках оказалось 59
    // неверных ключей single_choice.
    const newInner = newItems
      .map((it, pos) => it.full.replace(/^(\{ id: )[A-D](, text:)/, `$1${'ABCD'[pos]}$2`))
      .join(', ');
    const newSv = `student_view: { options: [${newInner}] }`;
    let newPart = part.replace(svM[0], newSv);

    // answer — это буква позиции правильного варианта в новом порядке
    newPart = newPart.replace(
      /(teacher_only: \{ answer: "?)[A-D]("?,?)/,
      `$1${'ABCD'[newIdx]}$2`,
    );

    // Самопроверка на записанном тексте: буква, которую мы сейчас записали,
    // обязана указывать именно на вариант с answer_text. Дешёвая проверка,
    // которая ловит ошибку до того, как она попадёт в файл.
    const wrote = /\{ id: ([A-D]), text: ("(?:[^"\\]|\\.)*") \}/g;
    const written = [...newSv.matchAll(wrote)];
    if (unquote(written[newIdx]?.[2] ?? '""') !== wantText) {
      console.error(`  ! ${id}: после перестановки буква ${'ABCD'[newIdx]} указывает не на верный вариант`);
      fatal++;
      continue;
    }

    if (newPart !== part) {
      parts[i] = newPart;
      changed++;
      totalShuffled++;
    }
  }

  if (changed > 0) {
    writeFileSync(file, parts.join(''), 'utf-8');
    console.log(`SHUFFLE OK: ${file} — перемешано ${changed} заданий`);
  } else {
    console.log(`SHUFFLE: ${file} — без изменений`);
  }
}

console.log(`\nSHUFFLE ИТОГО: перемешано ${totalShuffled} из ${totalTasks} single_choice заданий`);
if (fatal > 0) {
  // Задания, которые не поддержаны форматом (например, блочный стиль), пропускаются
  // молча — это не ошибка. Но если поддержанное задание не сошлось, это дрейф данных,
  // и молчать о нём нельзя.
  console.error(`\nSHUFFLE: ошибок ${fatal} — файлы записаны, но ключи требуют разбора`);
  process.exit(1);
}
