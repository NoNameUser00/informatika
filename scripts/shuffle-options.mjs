// Перемешивает варианты ответов в single_choice заданиях банков.
//
// ЗАЧЕМ: генераторы ставили правильный вариант первым (буква A), и в банке
// накопился перекос — из 525 single_choice правильный ответ «A» в 476.
// Ученик, который всегда отвечает «A», получает 91% по single_choice.
//
// Скрипт детерминирован: seed для перемешивания — fnv1a(id задания),
// поэтому повторный запуск не меняет файл.
//
// Запуск: node scripts/shuffle-options.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const FILES = [
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

let totalShuffled = 0;
let totalTasks = 0;

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

    // Старый правильный ответ
    const ansM = /teacher_only: \{ answer: "?([A-D])"?,?/.exec(part);
    if (!ansM) {
      console.error(`  ! ${id}: не найден answer`);
      continue;
    }
    const oldLetter = ansM[1];
    const oldIdx = items.findIndex((it) => it.letter === oldLetter);
    if (oldIdx < 0) {
      console.error(`  ! ${id}: буква ${oldLetter} не найдена в options`);
      continue;
    }

    // Перемешиваем
    const rng = mulberry32(fnv1a(id));
    const order = shuffle(items.map((_, k) => k), rng);
    const newItems = order.map((k) => items[k]);
    const newIdx = order.indexOf(oldIdx);
    const newLetter = 'ABCD'[newIdx];

    // Собираем новую строку options
    const newInner = newItems.map((it) => it.full).join(', ');
    const newSv = `student_view: { options: [${newInner}] }`;
    let newPart = part.replace(svM[0], newSv);

    // Заменяем answer
    newPart = newPart.replace(
      /(teacher_only: \{ answer: "?)[A-D]("?,?)/,
      `$1${newLetter}$2`,
    );

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
