// Применяет переписанные варианты из ведомости docs/review/distractors.
//
// Зачем. Ученик выбирает самый подробный вариант и угадывает: в 143 заданиях
// верный длиннее второго более чем на половину. Ключ тут ни при чём — он верен,
// и гейт на правильность молчит. Ломать нечего, надо переписать формулировки.
//
// ЧТО ДЕЛАЕТ. Для каждой строки «новый текст: …» берётся новый текст варианта и
// вписывается в банк. Пустая строка — «оставить», поэтому правится только
// изменённое.
//
// ЯКОРЬ. Если переписан ВЕРНЫЙ вариант, его текст — это teacher_only.answer_text,
// то есть якорь, по которому ключ сверяется со списком вариантов. Переписанный
// текст автоматически становится новым якорем. Иначе сборка упала бы с
// «текст ответа встречается среди вариантов 0 раз».
//
// ПРОВЕРКИ. Два варианта с одинаковым текстом — ошибка: якорь перестаёт быть
// однозначным, и верным становится сразу два ответа. Пустой «новый текст» из
// одних пробелов считается за «оставить», а не за стирание варианта.
//
// ПОСЛЕ ПРИМЕНЕНИЯ. Ведомость пересобирается и сама убирает починенные задания:
// как только запас падает ниже порога, задание перестаёт туда попадать. Так
// список тает сам, без ручной разметки «сделано».
//
// Запуск:
//   node scripts/apply-distractor-review.mjs          применить
//   node scripts/apply-distractor-review.mjs --dry    только показать
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { loadAllTasks } from './audit-keys.mjs';

const REVIEW_DIR = 'docs/review/distractors';
// Хвост строки — «  _(14 симв.)_»: длина нужна только человеку, машине она мешает.
const OPTION_RE = /^\*\*([A-D])\.\*\* (.*?)\s*_\(\d+ симв\.\)_$/;
const NEW_RE = /^новый текст:[ \t]*(.*)$/;

/** Разбирает ведомость: id -> { 'A': 'новый текст', ... } (только непустые). */
export function parseSheet(md) {
  const out = new Map();
  for (const block of md.split(/(?=^## \d+\. )/m)) {
    const id = /^## \d+\. (\S+)/.exec(block)?.[1];
    if (!id) continue;
    const lines = block.split('\n');
    const changes = {};
    for (let i = 0; i < lines.length; i++) {
      const m = OPTION_RE.exec(lines[i]);
      if (!m) continue;
      const next = NEW_RE.exec(lines[i + 1] ?? '');
      const value = (next?.[1] ?? '').replace(/\s+/g, ' ').trim();
      if (value) changes[m[1]] = value;
    }
    if (Object.keys(changes).length) out.set(id, changes);
  }
  return out;
}

const dry = process.argv.includes('--dry');
const files = readdirSync(REVIEW_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md');

const changes = new Map();
for (const f of files) {
  for (const [id, ch] of parseSheet(readFileSync(join(REVIEW_DIR, f), 'utf-8'))) {
    if (changes.has(id)) {
      console.error(`! ${id}: задание встречается в двух ведомостях`);
      process.exit(1);
    }
    changes.set(id, { ...ch, __file: f });
  }
}

const tasks = new Map(loadAllTasks().filter((t) => t?.type === 'single_choice').map((t) => [t.id, t]));

const problems = [];
const planned = [];

for (const [id, ch] of changes) {
  const task = tasks.get(id);
  if (!task) {
    problems.push(`${id}: задания нет в банках`);
    continue;
  }
  const opts = task.student_view?.options ?? [];
  const final = opts.map((o) => ({
    id: o.id,
    text: ch[String(o.id)] ?? String(o.text).replace(/\s+/g, ' ').trim(),
  }));

  // Одинаковые формулировки: якорь перестал бы указывать на один вариант.
  const seen = new Map();
  for (const o of final) seen.set(o.text, (seen.get(o.text) ?? 0) + 1);
  const dupes = [...seen].filter(([, n]) => n > 1);
  if (dupes.length) {
    problems.push(`${id}: после правки повторяется текст — «${dupes[0][0]}»`);
    continue;
  }

  const answer = String(task.teacher_only.answer);
  const correct = final.find((o) => o.id === answer);
  if (!correct) {
    problems.push(`${id}: среди вариантов нет буквы ${answer}`);
    continue;
  }
  // Правка ВЕРНОГО варианта допустима: его текст и есть якорь, поэтому новый
  // текст автоматически становится новым якорем (ниже). Раньше здесь стояла
  // проверка «новый текст обязан совпасть со старым якорем» — она отвергала бы
  // именно ту правку, ради которой и затевалась, и была бессмысленной.
  const touchesCorrect = Boolean(ch[answer]);

  const changed = final.filter((o, i) => o.text !== String(opts[i].text).replace(/\s+/g, ' ').trim());
  if (!changed.length) continue;

  planned.push({ id, file: task.__file, final, changed, answerText: correct.text, touchesCorrect });
}

function flatNow(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

if (problems.length) {
  console.error(`\nПРОВЕРКА НЕ ПРОЙДЕНА: ${problems.length}`);
  for (const p of problems.slice(0, 30)) console.error(`  ${p}`);
  if (problems.length > 30) console.error(`  ... ещё ${problems.length - 30}`);
  console.error('\nНичего не применено.');
  process.exit(1);
}

const touchedCorrect = planned.filter((p) => p.touchesCorrect).length;
console.log(`заданий с правками: ${changes.size}, изменятся: ${planned.length}`);
console.log(`из них меняется текст ВЕРНОГО варианта: ${touchedCorrect} (обновится и якорь)`);

if (!planned.length) {
  console.log('\nПрименять нечего.');
  process.exit(0);
}

for (const p of planned) {
  console.log(`  ${p.id}:`);
  for (const c of p.changed) {
    const was = tasks.get(p.id).student_view.options.find((o) => String(o.id) === c.id).text;
    console.log(`    ${c.id}: «${String(was).replace(/\s+/g, ' ').trim().slice(0, 60)}» -> «${c.text.slice(0, 60)}»`);
  }
}

if (dry) {
  console.log('\nСУХОЙ ПРОГОН: файлы не тронуты.');
  process.exit(0);
}

const escape = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const byFile = new Map();
for (const p of planned) {
  if (!byFile.has(p.file)) byFile.set(p.file, []);
  byFile.get(p.file).push(p);
}

for (const [file, list] of byFile) {
  const src = readFileSync(file, 'utf-8');
  const parts = src.split(/(?=\n- id: )/);
  let done = 0;

  for (let i = 1; i < parts.length; i++) {
    const p = list.find((x) => new RegExp(`^\\s*- id:\\s*${x.id}\\s*$`, 'm').test(parts[i]));
    if (!p) continue;
    let block = parts[i];

    for (const o of p.final) {
      // Вариант записан потоком: { id: A, text: "..." }
      const re = new RegExp(`(\\{ id:\\s*"?${o.id}"?,\\s*text:\\s*)"(?:[^"\\\\]|\\\\.)*"`);
      if (!re.test(block)) {
        problems.push(`${p.id}: не найден вариант ${o.id} в ${file}`);
        continue;
      }
      block = block.replace(re, (m, pre) => `${pre}"${escape(o.text)}"`);
    }

    if (p.touchesCorrect) {
      block = block.replace(
        /(answer_text:\s*)"(?:[^"\\]|\\.)*"/,
        (m, pre) => `${pre}"${escape(p.answerText)}"`,
      );
    }

    parts[i] = block;
    done++;
  }

  if (done !== list.length) {
    console.error(`  ! ${file}: переписано ${done} из ${list.length} — не трогаю файл`);
    problems.push(`${file}: переписано ${done} из ${list.length}`);
    continue;
  }
  writeFileSync(file, parts.join(''), 'utf-8');
  console.log(`  записан ${file} (${done})`);
}

if (problems.length) {
  console.error(`\nЧасть файлов не записана: ${problems.length}`);
  process.exit(1);
}
console.log('\nГотово. Дальше: node scripts/make-distractor-review.mjs и npm run rebuild:check.');