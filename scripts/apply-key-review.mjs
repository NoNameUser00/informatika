// Применяет ответы из ведомостей docs/review/keys к банкам.
//
// Зачем. Ответ человека приходит в ведомости как строка «Вердикт: …». Переносить
// эти ответы в YAML руками — значит перенабрать 458 записей и получить ошибку
// где-нибудь на 300-й. Здесь ответ читается машиной и правится то поле, которое
// назвал человек.
//
// ЧТО МЕНЯЕТСЯ. У ключа два поля, и правятся оба сразу:
//   answer       — буква (производная),
//   answer_text  — текст верного варианта (якорь).
// Если править только букву, якорь останется указывать на старый вариант и
// гейт справедливо уронит сборку. Если править только якорь — буква разойдётся
// с ним. Поэтому всегда оба, из одного источника.
//
// ПРО ПУСТОЕ И ОШИБКИ. Пустой вердикт — задание не проверено, скрипт его
// пропускает и считает отдельно. Любой неопознанный текст («врно», «поправить
// на E», неизвестный id) — ошибка с ненулевым кодом выхода: лучше остановиться,
// чем применить половину.
//
// ИДЕМПОТЕНТНОСТЬ. Повторный запуск ничего не меняет: якорь уже указывает на
// новый вариант, и буква с ним совпадает.
//
// Запуск:
//   node scripts/apply-key-review.mjs           применить ответы
//   node scripts/apply-key-review.mjs --dry     только показать, что изменится
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { loadAllTasks } from './audit-keys.mjs';

const REVIEW_DIR = 'docs/review/keys';
const DONE_DIR = join(REVIEW_DIR, 'done');
const VERDICT_RE = /^Вердикт:[ \t]*(.*)$/m;
const HEADING_RE = /^## \d+\. (\S+)/;

/** Разбирает одну ведомость: id -> сырой текст вердикта. */
export function parseVerdicts(md) {
  const out = [];
  for (const block of md.split(/(?=^## \d+\. )/m)) {
    const id = HEADING_RE.exec(block)?.[1];
    if (!id) continue;
    const raw = VERDICT_RE.exec(block)?.[1]?.trim() ?? '';
    out.push({ id, raw });
  }
  return out;
}

/**
 * Кириллица в буквах вариантов. Глазом «А» и «A» не отличить, а для машины это
 * разные символы, и русскоговорящий учитель печатает кириллицу естественно.
 * Приводим к латинице; остальное — опечатка.
 */
const CYRILLIC_LETTERS = { А: 'A', В: 'B', С: 'C', Д: 'D' };

function normalizeLetter(ch) {
  const up = ch.toUpperCase();
  return CYRILLIC_LETTERS[up] ?? up;
}

/**
 * Вердикт -> действие. Пусто — пропустить. «верно» — подтвердить без правки.
 * «поправить на X» (и естественные варианты формулировки) — сменить ключ. Всё
 * остальное — ошибка: молча пропускать опечатку нельзя, иначе человек будет
 * думать, что поправил.
 */
export function parseVerdict(raw) {
  if (!raw) return { kind: 'skip' };
  const t = raw.trim();
  // Разделитель блока, однажды попавший в строку вердикта при сборке с битым
  // регексом. Ответом он быть не может — считаем «не проверено».
  if (t === '---') return { kind: 'skip' };
  const lower = t.toLowerCase();
  if (['верно', 'да', 'всё верно', 'все верно', 'правильно', 'без вопросов'].includes(lower)) {
    return { kind: 'ok' };
  }
  // «поправь на A», «поправить: B», «заменить на C», «правильный ответ D»
  const m = /^(?:поправь|поправить|заменить|правильный ответ)\s*(?:на|:)?\s*([A-Za-zА-Яа-я])\.?$/.exec(lower);
  if (m) {
    const letter = normalizeLetter(m[1]);
    if (!'ABCD'.includes(letter)) return { kind: 'bad', why: `буква «${m[1]}» вне списка A–D` };
    return { kind: 'set', letter };
  }
  if (/поправ|замени|правильн/.test(lower)) return { kind: 'bad', why: 'не разобрана буква (ожидается A, B, C или D)' };
  return { kind: 'bad', why: 'неизвестная формулировка' };
}

function collect() {
  const files = readdirSync(REVIEW_DIR).filter((f) => /^\d\d-.*\.md$/.test(f));
  const verdicts = [];
  for (const f of files) {
    for (const v of parseVerdicts(readFileSync(join(REVIEW_DIR, f), 'utf-8'))) {
      verdicts.push({ ...v, file: f });
    }
  }
  return verdicts;
}

/**
 * Полностью заполненные ведомости уходят в done/.
 *
 * Зачем. Ответ записан буквой, а буква — производная от порядка вариантов. Стоит
 * позже перемешать варианты, и в ведомости останутся буквы, указывающие на
 * ДРУГИЕ варианты: повторный запуск скрипта молча переписал бы ключ. Поэтому
 * применённый лист убирается из очереди, а буквы в нём остаются только для
 * истории.
 *
 * Переносится только то, где заполнены ВСЕ строки: прерванную на середине
 * проверку терять нельзя.
 */
export function archiveFinished(reviewDir = REVIEW_DIR, doneDir = DONE_DIR) {
  const files = readdirSync(reviewDir).filter((f) => /^\d\d-.*\.md$/.test(f));
  if (!files.length) return { moved: [], partial: [] };

  const moved = [];
  const partial = [];
  for (const f of files) {
    const all = parseVerdicts(readFileSync(join(reviewDir, f), 'utf-8'));
    if (!all.length) continue;
    const done = all.filter((v) => parseVerdict(v.raw).kind !== 'skip').length;
    if (done === all.length) {
      mkdirSync(doneDir, { recursive: true });
      renameSync(join(reviewDir, f), join(doneDir, f));
      moved.push(`${f} (${done})`);
    } else {
      partial.push(`${f} (${done}/${all.length})`);
    }
  }
  return { moved, partial };
}

function main() {
const dry = process.argv.includes('--dry');
const verdicts = collect();
const tasks = new Map(loadAllTasks().filter((t) => t?.type === 'single_choice').map((t) => [t.id, t]));

const problems = [];
const planned = [];
let confirmed = 0;
let untouched = 0;

for (const v of verdicts) {
  const action = parseVerdict(v.raw);
  if (action.kind === 'skip') {
    untouched++;
    continue;
  }
  if (action.kind === 'bad') {
    problems.push(`${v.file} / ${v.id}: «${v.raw}» — ${action.why}`);
    continue;
  }
  const task = tasks.get(v.id);
  if (!task) {
    problems.push(`${v.file} / ${v.id}: задания нет в банках`);
    continue;
  }
  if (action.kind === 'ok') {
    confirmed++;
    continue;
  }
  const opt = (task.student_view?.options ?? []).find((o) => String(o.id) === action.letter);
  if (!opt) {
    problems.push(`${v.file} / ${v.id}: варианта «${action.letter}» среди вариантов нет`);
    continue;
  }
  if (task.teacher_only?.answer === action.letter) {
    confirmed++;
    continue;
  }
  planned.push({
    id: v.id,
    file: task.__file,
    from: task.teacher_only?.answer,
    to: action.letter,
    fromText: task.teacher_only?.answer_text,
    toText: opt.text,
  });
}

console.log(`ведомостей прочитано: ${collect().length ? new Set(verdicts.map((v) => v.file)).size : 0}`);
console.log(`вердиктов: ${verdicts.length} — подтверждено ${confirmed}, поправить ${planned.length}, не проверено ${untouched}`);

if (problems.length) {
  console.error(`\nПРОВЕРКА НЕ ПРОЙДЕНА: ${problems.length} строк разобрать не удалось:`);
  for (const p of problems.slice(0, 40)) console.error(`  ${p}`);
  if (problems.length > 40) console.error(`  ... ещё ${problems.length - 40}`);
  console.error('\nНичего не применено. Правьте формулировки и запускайте снова.');
  process.exit(1);
}

if (!planned.length) {
  console.log('\nПрименять нечего: подтверждённые ключи совпадают с банком.');
  if (!dry) reportArchive();
  process.exit(0);
}

for (const p of planned) {
  console.log(`  ${p.id}: ${p.from} «${p.fromText}» -> ${p.to} «${p.toText}»`);
}
console.log(`\n${dry ? 'СУХОЙ ПРОГОН: файлы не тронуты' : 'применяю...'}`);

if (dry) process.exit(0);

// Правка по id внутри нужного файла: тот же приём, что в add-answer-text.mjs, —
// читаем значение разбором YAML, а букву и якорь переписываем точечно.
function yamlEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

const byFile = new Map();
for (const p of planned) {
  if (!byFile.has(p.file)) byFile.set(p.file, []);
  byFile.get(p.file).push(p);
}

for (const [file, changes] of byFile) {
  const src = readFileSync(file, 'utf-8');
  const parts = src.split(/(?=\n- id: )/);
  let done = 0;

  for (let i = 1; i < parts.length; i++) {
    const change = changes.find((c) => new RegExp(`^\\s*- id:\\s*${c.id}\\s*$`, 'm').test(parts[i]));
    if (!change) continue;
    let block = parts[i];

    // answer: буква. Формат бывает потоковым (`teacher_only: { answer: A, ... }`)
    // и блочным (`teacher_only:` / `answer: A`), поэтому правим оба.
    block = block.replace(
      /(teacher_only:\s*\{\s*answer:\s*)("?)[A-D]\2/,
      (m, pre, q) => `${pre}${q}${change.to}${q}`,
    );
    block = block.replace(
      /^([ \t]*)answer:[ \t]*"?[A-D]"?[ \t]*$/m,
      (m, indent) => `${indent}answer: ${change.to}`,
    );

    // answer_text: якорь. Значение берём из варианта, а не из прежнего текста.
    block = block.replace(
      /(answer_text:\s*)"(?:[^"\\]|\\.)*"/,
      (m, pre) => `${pre}"${yamlEscape(change.toText)}"`,
    );

    if (block === parts[i]) {
      problems.push(`${change.id}: не удалось переписать ключ в ${file}`);
      continue;
    }
    parts[i] = block;
    done++;
  }

  if (done !== changes.length) {
    console.error(`  ! ${file}: переписано ${done} из ${changes.length} — не трогаю файл`);
    problems.push(`${file}: переписано ${done} из ${changes.length}`);
    continue;
  }
  writeFileSync(file, parts.join(''), 'utf-8');
  console.log(`  записан ${file} (${done})`);
}

if (problems.length) {
  console.error(`\nЧасть файлов не записана: ${problems.length}`);
  process.exit(1);
}
console.log(`\nГотово: изменено ${planned.length} ключей. Дальше — node scripts/audit-keys.mjs и npm run checks.`);
reportArchive();
}

/** Печатает, что ушло в done/, и напоминает про незаконченные листы. */
function reportArchive() {
  const { moved, partial } = archiveFinished();
  if (moved.length) {
    console.log(`\nВ очередь больше не попадут (ответы уже в банке): ${moved.join(', ')}`);
    console.log('Файлы перенесены в docs/review/keys/done/ — это история, ключи оттуда не применяются.');
  }
  if (partial.length) {
    console.log(`\nПроверка не закончена, листы остаются в очереди: ${partial.join(', ')}`);
  }
}

// CLI запускается только при прямом вызове файла: тест импортирует
// parseVerdicts/parseVerdict, и без этой ограды он бы применял ответы и уходил
// по process.exit прямо во время запуска тестов.
if (existsSync(import.meta.filename ?? '') && process.argv[1] === import.meta.filename) {
  main();
}