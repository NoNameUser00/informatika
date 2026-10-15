// Разовая правка ключей single_choice, выявленных аудитом.
//
// Правка идёт по ТЕКСТУ файла, а не через YAML-сериализацию: банки записаны
// в потоковом стиле, и пересборка YAML переставила бы кавычки, порядок полей
// и переносы во всех 1273 заданиях. Меняем только значение `answer` внутри
// блока нужного задания.
//
// Ключи выставлены по смыслу задания и сверены с пояснением учителя в банке;
// автоматически по эвристике они не восстанавливаются.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// id -> верный вариант
const FIXES = {
  // 10 класс: кодирование
  'inf-10-base-031': 'A', // нарушение Фано: 1 — начало 10
  'inf-10-base-062': 'A', // 001 читается и как АБ, и как ААВ
  'inf-10-base-080': 'A', // 2^3 = 8
  'inf-10-logic-008': 'A', // R = 1, S = 1 — запрещённая комбинация
  'inf-10-logic-009': 'A', // контрпример x = 3
  'inf-10-logic-017': 'A', // ДНФ: A ∧ ¬B
  'inf-10-logic-019': 'A', // A=1, B=0, C=0, D=0
  'inf-10-logic-042': 'A', // S = 1, R = 1
  'inf-10-logic-044': 'A', // 8 бит -> 8 триггеров
  'inf-10-logic-045': 'A', // ¬(1∧1) ∨ (1⊕0) = 0 ∨ 1 = 1
  'inf-10-ss-047': 'A', // 2^16 = 65 536
  // 11 класс
  'inf-11-algo-002': 'B', // 1010
  'inf-11-algo-039': 'A', // линейный поиск — O(n)
  'inf-11-algo-045': 'A', // a[5] -> IndexError
  'inf-11-data-013': 'A', // доли целого -> круговая
  'inf-11-graph-005': 'A', // единицы в столбцах 3 и 4
  'inf-11-graph-010': 'B', // победа на 2-м ходу
  // 7 класс
  'inf-7-base-023': 'A', // ищет программу в памяти и передаёт управление
  'inf-7-base-046': 'A', // порядок важен -> нумерованный список
  'inf-7-base-049': 'A', // .odt
  'inf-7-base-065': 'A', // среда разработки -> системы программирования
  'inf-7-inf-003': 'C', // 2^5 = 32
  'inf-7-inf-009': 'B', // 1 Кбайт = 1024 байта
  'inf-7-inf-013': 'B', // 2^3 = 8
  'inf-7-inf-021': 'A', // 320 : 8 = 40
  'inf-7-inf-040': 'A', // 64 = 2^6 -> i = 6 бит
  'inf-7-inf-041': 'A', // соответствие реальности -> объективность
  'inf-7-inf-042': 'A', // польза для конкретного человека -> ценность
  'inf-7-media-001': 'A', // план -> слайды -> монтаж -> репетиция
  'inf-7-media-036': 'A', // #FF0000
  'inf-7-media-042': 'A', // смена цвета или размера -> выделение
  'inf-7-media-050': 'A', // произвольный контур -> лассо
  'inf-7-media-051': 'A', // 2400 : 800 = 3
  'inf-7-media-054': 'A', // свободный векторный редактор -> Inkscape
  // 8 класс
  'inf-8-algo-017': 'A', // чётная ветка x / 2 = 10 -> x = 20
  'inf-8-algo-024': 'C', // в кавычках -> str
  'inf-8-algo-057': 'A', // одно условие -> не больше двух результатов
  'inf-8-algo-061': 'B', // 9 -> 10
  'inf-8-logic-014': 'C', // сначала НЕ
  'inf-8-logic-015': 'A', // поглощение: A ∨ (A ∧ B) = A
  'inf-8-logic-033': 'A', // ложное высказывание имеет значение 0
  'inf-8-logic-035': 'A', // A ∧ 1 = A
  'inf-8-logic-041': 'A', // ¬¬A = A
  'inf-8-logic-044': 'A', // разнесение A внутрь скобок
  'inf-8-logic-048': 'A', // 00, 01, 10, 11 -> третья строка
  'inf-8-logic-053': 'A', // ¬0 ∨ 1 = 1
  'inf-8-numsys-038': 'D', // старшая цифра 6 -> основание 7
  'inf-8-numsys-039': 'A', // четыре I подряд
  'inf-8-numsys-040': 'C', // цифры 0-7, всего 8
  // 9 класс
  'inf-9-extra-011': 'A', // картинка -> <img>
  'inf-9-extra-014': 'A', // четыре поворота -> квадрат
  'inf-9-extra-070': 'A', // тело страницы с содержимым
  'inf-9-sheet-012': 'A', // B1 = 25, C1 = 30
  'inf-9-sheet-029': 'A', // площади стран не дают 100 %
  'inf-9-sheet-038': 'A', // 3 >= 4 ложно -> «нет»
  'inf-9-sheet-039': 'A', // столбец C, строка 3 -> C3
  'inf-9-sheet-051': 'A', // 3 < 4 -> «меньше»
  'inf-9-sheet-053': 'A', // 85 >= 80 -> «отлично»
  'inf-9-sheet-054': 'B', // минимальная оценка 4 у Ани
};

// Пояснение к ключу, где пояснение само себе противоречит.
const EXPLANATION_FIXES = {
  'inf-9-sheet-054': [
    ['она у Бори', 'она у Ани'],
  ],
};

function yamlFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yamlFiles(p, acc);
    else if (name.endsWith('.yaml')) acc.push(p);
  }
  return acc;
}

let changedFiles = 0;
let changedTasks = 0;
const done = new Set();
const alreadyOk = new Set();
const found = new Set();
const notFound = [];

for (const file of yamlFiles('data/tasks')) {
  const src = readFileSync(file, 'utf-8');
  // блоки заданий начинаются со строки «- id: ...»
  const parts = src.split(/(?=\n- id: )/);
  let out = parts[0];
  let fileChanged = false;

  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];
    // блок начинается с «- id: », но после split в нём остался ведущий \n
    // якорь именно ^: в JS нет \A, он трактуется как литеральная «A»
    const idMatch = block.match(/^\s*- id:\s*(\S+)/);
    const id = idMatch?.[1];
    if (!id || !(id in FIXES)) {
      out += block;
      continue;
    }
    const want = FIXES[id];
    // правим только teacher_only.answer, не задевая answer_text / answer_map.
    // часть банков пишет answer: "C" в кавычках — стиль сохраняем.
    const answerRe = /(\bteacher_only:\s*\{[^}]*?\banswer:\s*)(["']?)([A-D])\2(\s*[,}])/;
    const cur = block.match(answerRe)?.[3];
    if (cur === undefined) notFound.push(id);
    else if (cur === want) alreadyOk.add(id);
    let nb = block.replace(answerRe, (m, pre, q, c, tail) =>
      c === want ? m : pre + q + want + q + tail,
    );
    for (const [from, to] of EXPLANATION_FIXES[id] ?? []) {
      nb = nb.split(from).join(to);
    }
    if (nb !== block) {
      changedTasks++;
      done.add(id);
      fileChanged = true;
    } else if (alreadyOk.has(id)) {
      // ключ уже стоял верно — скрипт идемпотентен, это не ошибка
      found.add(id);
    }
    out += nb;
  }

  if (fileChanged) {
    writeFileSync(file, out, 'utf-8');
    changedFiles++;
  }
}

for (const id of Object.keys(FIXES)) {
  if (!done.has(id) && !alreadyOk.has(id)) {
    if (!notFound.includes(id)) notFound.push(id);
  }
}

console.log(`заданий исправлено: ${changedTasks}`);
console.log(`уже стоял верный ключ: ${alreadyOk.size}`);
console.log(`всего в правке: ${Object.keys(FIXES).length} (изменено + уже верных = ${done.size + alreadyOk.size})`);
console.log(`файлов изменено: ${changedFiles}`);
if (notFound.length) {
  console.error(`НЕ НАЙДЕНЫ в банках (${notFound.length}): ${notFound.join(', ')}`);
  process.exit(1);
}