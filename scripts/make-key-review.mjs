// Собирает ведомость для смысловой проверки ключей single_choice.
//
// Зачем. Объективное свидетельство есть только у 70 заданий из 528: там, где
// пояснение прямо называет верный вариант или вариант отвергнут в common_errors.
// Остальные 458 держатся на том, что их когда-то прочитал человек. Никакой
// автоматический разбор их не заменит — значит, нужен удобный способ их
// показать и удобный способ потом применить ответы без перенабора.
//
// Что делает. Одним файлом на банк раскладывает задания без свидетельства.
// Задания со свидетельством в ведомость не попадают, но их количество указано
// в заголовке банка — чтобы было видно, что они не потерялись.
//
// ПОВТОРНАЯ ГЕНЕРАЦИЯ СОХРАНЯЕТ ОТВЕТЫ. Файл ведомости правит человек, и
// перезапустить скрипт после заполнения первых разделов должно быть можно:
// строка «Вердикт:» подтягивается из прежней версии, всё остальное
// перерисовывается. Иначе любой запуск сносил бы работу.
//
// Запуск:
//   node scripts/make-key-review.mjs            пересобрать все ведомости
//   node scripts/make-key-review.mjs --stats    только сводка, файлы не трогать
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { scoreOptions, loadAllTasks } from './audit-keys.mjs';

const OUT_DIR = 'docs/review/keys';
const DONE_DIR = join(OUT_DIR, 'done');
// [ \t]*, а не \s*: внутри \s есть перевод строки, и вердикт «съедал» бы
// разделитель «---», оборачиваясь в мусор, который потом не распознаётся.
const VERDICT_RE = /^Вердикт:[ \t]*(.*)$/m;

/** Схлопывает переводы строк: в ведомости всё должно помещаться в строку. */
const flat = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Русское согласование: 1 имеет, 2 имеет, 5 имеют. */
function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Базовая часть имени: data/tasks/7/base/bank-7base.yaml -> 07-base */
function bankBase(file) {
  const parts = file.replace(/\\/g, '/').split('/'); // [data, tasks, 7, base, bank-7base.yaml]
  return `${parts[2].padStart(2, '0')}-${parts[3]}`;
}

/** Различающая часть имени файла: bank-7base.yaml -> 7base, bank-gen.yaml -> gen */
function bankToken(file) {
  const stem = file
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/\.yaml$/, '');
  const token = stem.replace(/^bank-?/, '');
  return token || stem; // у bank.yaml токен пустой — берём имя файла целиком
}

/**
 * В одном каталоге могут лежать два банка (например 08/number-systems: bank.yaml
 * и bank-gen.yaml). Наивное имя 08-number-systems.md у них совпадает, и второй
 * файл молча затирает первый — теряются задания. Поэтому сначала считаем, кому
 * имя уже занято, и добавляем различающий кусок только таким.
 */
function assignNames(rows) {
  const used = new Map();
  for (const [, row] of rows) {
    const base = bankBase(row.file);
    used.set(base, (used.get(base) ?? 0) + 1);
  }
  const out = new Map();
  for (const [file, row] of rows) {
    const base = bankBase(file);
    out.set(file, used.get(base) > 1 ? `${base}-${bankToken(file)}.md` : `${base}.md`);
  }
  return out;
}

/** Заголовок человеческим языком: класс + самая частая тема банка. */
function bankTitle(file, tasks) {
  const parts = file.replace(/\\/g, '/').split('/');
  const counts = new Map();
  for (const t of tasks) {
    const k = flat(t.topic) || 'без темы';
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  const more = counts.size > 1 ? ` и ещё ${counts.size - 1}` : '';
  return `${parts[2]} класс — ${top}${more}`;
}

/**
 * Прежние вердикты по id задания. Читаем из уже существующей ведомости, чтобы
 * повторный запуск не уничтожил ответы человека.
 *
 * Значение «---» отбрасываем: это не ответ, а разделитель блока. Такой мусор
 * однажды попал в файлы, когда сборка шла по старой версии с \s* в регексе:
 * разделитель переезжал в строку вердикта и дальше воспроизводился сам.
 */
function loadVerdicts(file) {
  if (!existsSync(file)) return new Map();
  const src = readFileSync(file, 'utf-8');
  const out = new Map();
  for (const block of src.split(/(?=^## \d+\. )/m)) {
    const id = /^## \d+\. (\S+)/.exec(block)?.[1];
    if (!id) continue;
    const v = VERDICT_RE.exec(block)?.[1]?.trim();
    if (v && v !== '---') out.set(id, v);
  }
  return out;
}

function renderTask(t, index, verdict) {
  const to = t.teacher_only ?? {};
  const answer = to.answer;
  const answerText = flat(to.answer_text);

  const options = (t.student_view?.options ?? [])
    .map((o) => `* **${o.id}.** ${flat(o.text)}${o.id === answer ? ' ← сейчас ключ' : ''}`)
    .join('\n');

  const errors = Array.isArray(to.common_errors)
    ? to.common_errors.map(flat).join('; ')
    : flat(to.common_errors);

  return [
    `## ${index}. ${t.id}`,
    '',
    `**Вопрос.** ${flat(t.prompt)}`,
    '',
    options,
    '',
    `**Ключ сейчас: ${answer}** — ${answerText}`,
    '',
    `**Почему так.** ${flat(to.explanation) || '(пояснения нет)'}`,
    errors ? `**Ошибки учеников.** ${errors}` : null,
    '',
    `Урок: \`${t.lesson ?? '—'}\` · ${flat(t.difficulty) || '—'} · ${t.points ?? 1} балл.`,
    '',
    `Вердикт:${verdict ? ` ${verdict}` : ''}`,
    '',
    '---',
    '',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

function renderBank({ file, tasks, withEvidence, name }, outDir = OUT_DIR) {
  const verdicts = loadVerdicts(join(outDir, name));
  const body = tasks
    .map((t, i) => renderTask(t, i + 1, verdicts.get(t.id) ?? ''))
    .join('\n');

  return `# ${bankTitle(file, tasks)}

В этом банке ${tasks.length + withEvidence} ${plural(tasks.length + withEvidence, 'задание', 'задания', 'заданий')} single_choice, из них **${tasks.length}** в ведомости.
Ещё ${withEvidence} ${plural(withEvidence, 'имеет', 'имеют', 'имеют')} объективное свидетельство (пояснение прямо называет верный
вариант или вариант отвергнут в \`common_errors\`) — их ключ машина проверяет сама,
поэтому в список они не попали.

**Как отвечать.** Меняйте только строку \`Вердикт:\`:

* \`Вердикт: верно\` — ключ правильный, ничего менять не нужно;
* \`Вердикт: поправить на C\` — верный вариант другой.

Пустую строку скрипт применения пропустит и посчитает как «ещё не проверено».
Любой другой текст он считает опечаткой и останавливается — чтобы ошибка не
прошла молча.

Применить ответы: \`node scripts/apply-key-review.mjs\`.

---

${body}`;
}

export function build(outDir = OUT_DIR, { stats = false, quiet = false } = {}) {
  const all = loadAllTasks().filter((t) => t?.type === 'single_choice');

  const groups = new Map();
  let skipped = 0;
  for (const t of all) {
    const { score, answer } = scoreOptions(t);
    const evidence = (score[answer] ?? 0) >= 3;
    const row = groups.get(t.__file) ?? { file: t.__file, tasks: [], withEvidence: 0 };
    if (evidence) {
      row.withEvidence++;
      skipped++;
    } else {
      row.tasks.push(t);
    }
    groups.set(t.__file, row);
  }

  if (!stats) mkdirSync(outDir, { recursive: true });

  // Порядок — по классу, а не по строке пути: иначе «10-base» встаёт перед
// «07-base», и человеку приходится прыгать по списку.
const rows = [...groups].sort(
    (a, b) =>
      bankBase(a[1].file).localeCompare(bankBase(b[1].file)) ||
      bankToken(a[1].file).localeCompare(bankToken(b[1].file)),
  );
  const names = assignNames(rows);
  // done/ ищем ВНУТРИ outDir, а не по константе модуля: иначе сборка в
  // тестовую папку всё равно опиралась бы на настоящий репозиторий и молча
  // пропускала бы банки, которые там уже применены.
  const doneDir = join(outDir, 'done');
  const done = [];
  let index = [
    '# Ведомость ключей single_choice',
    '',
    `Из ${all.length} заданий ${skipped} проверяются машиной, ${all.length - skipped} ждут человека.`,
    'Ниже — по банкам. В каждом файле задание со всеми вариантами и текущим ключом.',
    '',
    '| Файл | Заданий | Из них без свидетельства |',
    '| --- | ---: | ---: |',
  ];

  for (const [file, row] of rows) {
    if (!row.tasks.length) continue;
    const name = names.get(file);
    // Банк, который уже проверен и применён, лежит в done/. Возвращать его в
    // очередь нельзя: ответы в нём записаны буквами, а после перемешивания
    // вариантов буквы сменятся — и старый вердикт применился бы повторно уже
    // к другому варианту.
    if (existsSync(join(doneDir, name))) {
      done.push(`| [done/${name}](done/${name}) | ${row.tasks.length + row.withEvidence} | применён |`);
      continue;
    }
    if (!stats) {
      writeFileSync(join(outDir, name), renderBank({ ...row, name }, outDir), 'utf-8');
    }
    index.push(`| [${name}](${name}) | ${row.tasks.length + row.withEvidence} | ${row.tasks.length} |`);
  }

  if (!stats) {
    if (done.length) {
      index.push('', '## Уже проверено и применено', '', '| Файл | Заданий | Статус |', '| --- | ---: | --- |', ...done, '');
    }
    index.push(
      '',
      '## Порядок работы',
      '',
      '1. Открыть файл, пройти задания сверху вниз, вписать вердикт.',
      '2. Раз в раздел (или реже) запустить `node scripts/apply-key-review.mjs` —',
      '   он применит ответы и покажет, что осталось непроверенным.',
      '3. После применения прогнать `node scripts/audit-keys.mjs` и `npm run checks`.',
      '',
      'Повторный запуск `make-key-review.mjs` ответы не сносит: строка «Вердикт:»',
      'подтягивается из прежней версии файла.',
      '',
    );
    writeFileSync(join(outDir, 'README.md'), index.join('\n'), 'utf-8');
  }

  if (quiet) return { total: all.length, skipped, waiting: all.length - skipped, banks: rows.filter((r) => r[1].tasks.length).length };

  console.log(`single_choice всего: ${all.length}`);
  console.log(`проверяются машиной: ${skipped}`);
  console.log(`ждут человека: ${all.length - skipped}`);
  console.log(`ведомостей: ${rows.filter((r) => r[1].tasks.length).length}`);
}

// Запуск только при прямом вызове файла. Проверка «файл существует» тут была бы
// ловушкой: import.meta.filename определён и при импорте, и тест звал бы
// пересборку настоящих ведомостей вместо своей временной папки.
if (process.argv[1] && import.meta.filename && process.argv[1] === import.meta.filename) {
  build(OUT_DIR, { stats: process.argv.includes('--stats') });
}