// Добавляет teacher_only.answer_text — ЯВНЫЙ указатель верного варианта по тексту.
//
// Зачем. Ключ single_choice хранился буквой: `answer: A`. Эта буква — производная
// от порядка вариантов, поэтому любая перестановка могла тихо её сломать (так
// появились 88 неверных ключей). Если же хранить ТЕКСТ верного варианта, то
// буква перестаёт быть источником истины: её можно пересчитать всегда.
//
// Что делает скрипт: для каждого single_choice дописывает в teacher_only поле
// answer_text со значением варианта, помеченного текущим answer. Скрипт
// ОДНОКРАТНЫЙ и идемпотентный: поле уже есть — проверяется, что оно совпадает
// с answer, и при расхождении скрипт падает (это сигнал, что ключ надо чинить
// руками, а не молча перезаписать).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const FLOW_ANSWER = /(teacher_only:\s*\{\s*answer:\s*)("?)([A-D])\2(\s*,)/;
const BLOCK_ANSWER = /^([ \t]*)answer:[ \t]*("?)([A-D])\2[ \t]*$/m;
const HAS_TEXT = /\banswer_text:\s*"/;

function yamlFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yamlFiles(p, acc);
    else if (name.endsWith('.yaml')) acc.push(p);
  }
  return acc;
}

/**
 * Текст варианта по его id. Банки записаны двумя способами: потоковым
 * (`student_view: { options: [{ id: A, text: "..." }] }`) и блочным. Регуляркой
 * над исходником брать нельзя: в исходнике текст УЖЕ экранирован (\\"), и повторное
 * экранирование при записи дало бы двойные слэши. Поэтому значение читаем
 * разбором YAML — получаем ровно то, что видит загрузчик.
 */
function optionText(block, letter) {
  let obj;
  try {
    // Банки записаны с CRLF, а разделитель блоков съедает один \n, из-за чего
    // блок кончается одиночным \r. YAML считает его отдельным разрывом строки и
    // отвергает документ целиком («Unexpected scalar at node end»), поэтому
    // перед разбором хвост отбрасываем.
    obj = parse(block.replace(/\s+$/, ''));
  } catch {
    return null;
  }
  // Блок начинается с `- id:`, поэтому разбор возвращает МАССИВ из одного
  // задания, а не объект. Без распаковки обращение к полям молча даёт undefined.
  const task = Array.isArray(obj) ? obj[0] : obj;
  const opts = task?.student_view?.options ?? [];
  const hit = opts.find((o) => String(o.id) === letter);
  return hit ? String(hit.text) : null;
}

/** Экранирование для строки в двойных кавычках YAML. */
function yamlEscape(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Вставляет answer_text сразу после answer — в том же стиле, в каком записан
 * сам teacher_only.
 */
function insertAnswerText(block, want) {
  if (FLOW_ANSWER.test(block)) {
    return block.replace(
      FLOW_ANSWER,
      (m, pre, q, cur, tail) => `${pre}${q}${cur}${q}${tail} answer_text: "${want}",`,
    );
  }
  const bm = BLOCK_ANSWER.exec(block);
  if (bm) {
    return block.replace(
      BLOCK_ANSWER,
      (m, indent, q, cur) => `${indent}answer: ${q}${cur}${q}\n${indent}answer_text: "${want}"`,
    );
  }
  return null;
}

function answerLetter(block) {
  return FLOW_ANSWER.exec(block)?.[3] ?? BLOCK_ANSWER.exec(block)?.[3] ?? null;
}

let added = 0;
let present = 0;
const problems = [];
const perFile = [];

for (const file of yamlFiles('data/tasks')) {
  const original = readFileSync(file, 'utf-8');
  const parts = original.split(/(?=\n- id: )/);
  let out = parts[0];
  let fileAdded = 0;
  let filePresent = 0;

  for (let i = 1; i < parts.length; i++) {
    let block = parts[i];
    const id = block.match(/^\s*- id:\s*(\S+)/)?.[1];
    if (!id || !/type: single_choice/.test(block)) {
      out += block;
      continue;
    }
    const ansLetter = answerLetter(block);
    if (!ansLetter) {
      problems.push(`${id}: не разобран teacher_only.answer`);
      out += block;
      continue;
    }
    const letter = ansLetter;
    const raw = optionText(block, letter);
    if (raw === null) {
      problems.push(`${id}: нет варианта с id ${letter}`);
      out += block;
      continue;
    }
    const want = yamlEscape(raw);

    if (HAS_TEXT.test(block)) {
      const have = /answer_text:\s*"((?:[^"\\]|\\.)*)"/.exec(block)?.[1];
      if (have !== want) {
        problems.push(`${id}: answer_text расходится с answer=${letter}`);
      }
      filePresent++;
      present++;
    } else {
      const nb = insertAnswerText(block, want);
      if (nb === null) {
        problems.push(`${id}: не удалось вставить answer_text`);
        out += block;
        continue;
      }
      block = nb;
      fileAdded++;
      added++;
    }
    out += block;
  }

  if (fileAdded || filePresent) {
    writeFileSync(file, out, 'utf-8');
    perFile.push(`${file}: +${fileAdded} / было ${filePresent}`);
  }
}

console.log(`добавлено answer_text: ${added}`);
console.log(`уже было: ${present}`);
for (const l of perFile) console.log('  ' + l);
for (const p of problems) console.error(`! ${p}`);
process.exit(problems.length ? 1 : 0);