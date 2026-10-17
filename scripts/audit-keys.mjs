// Гейт согласованности ключа single_choice с пояснением учителя.
//
// Зачем. В банках варианты ответа перемешаны и им присвоены новые id, но
// teacher_only.answer иногда остаётся от прежнего порядка — и ключ указывает
// на неверный вариант. Признак ловится объективно: банк сам пишет верный
// ответ в teacher_only.explanation (его показывают учителю в разборе ключей)
// или называет отвергнутый вариант в teacher_only.common_errors. Если
// пояснение называет другой вариант — ключ и пояснение противоречат друг другу.
//
// Проверка смыслом не занимается: она не решает, какой вариант верен, а лишь
// находит задания, где ключ не согласуется с собственным пояснением банка.
// Такие задания нужно разобрать глазами, а не чинить автоматически.
//
// ВТОРАЯ ПРОВЕРКА — якорь ключа. teacher_only.answer_text называет верный
// вариант ТЕКСТОМ, а буква answer обязана указывать именно на него. Это не
// проверка правильности (о том, какой вариант верен, по-прежнему решает
// человек), а проверка целостности записи: пока якорь на месте, перестановка
// вариантов физически не может тихо сломать ключ, как это случилось 88 раз.
//
// ЧЕСТНО О ГРАНИЦАХ. Инструмент ловит не всё, и это зафиксировано тестами:
//  1) Символические варианты (∧, ∨, ¬, «=») нормализация съедает как «не буквы»,
//     поэтому задания на знаки операций (например inf-8-logic-004) машинно НЕ
//     проверяются. Их ключи держим на себе.
//  2) Пояснение, перечисляющее отвлекающие варианты («O(log n) — это бинарный
//     поиск»), даёт им тот же вес, что и верному. Такие случаи разбираются вручную
//     и записываются в ALLOW_FILE с причиной.
// Значит гейт ловит новый дрейф в текстовых заданиях, но не является полной
// проверкой правильности ключей.
//
// Запуск:
//   node scripts/audit-keys.mjs            отчёт, ненулевой код выхода при конфликтах
//   node scripts/audit-keys.mjs --json     тот же отчёт в JSON
//   node scripts/audit-keys.mjs --full     показать все варианты конфликтных заданий
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { findAnchorProblems, findConflicts, normText, numbersIn, scoreOptions } from '../src/lib/tasks/checks.mjs';

const ALLOW_FILE = 'data/tasks/key-conflicts.allow.json';

// normText, numbersIn — в src/lib/tasks/checks.mjs, переэкспортируются ниже.

function yamlFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yamlFiles(p, acc);
    else if (name.endsWith('.yaml')) acc.push(p);
  }
  return acc;
}

function loadAllow() {
  try {
    const raw = JSON.parse(readFileSync(ALLOW_FILE, 'utf-8'));
    return new Map(Object.entries(raw).map(([k, v]) => [k, v.reason ?? '']));
  } catch {
    return new Map();
  }
}

// scoreOptions, findConflicts, findAnchorProblems — в src/lib/tasks/checks.mjs,
// переэкспортируются ниже.

export function loadAllTasks() {
  const tasks = [];
  for (const f of yamlFiles('data/tasks')) {
    for (const t of parse(readFileSync(f, 'utf-8')) ?? []) {
      if (t && typeof t === 'object') tasks.push({ ...t, __file: f });
    }
  }
  return tasks;
}

// Переэкспорт чистых функций из src/lib, чтобы тесты и скрипты работали
// как раньше, а браузерная форма могла импортировать их из src/lib.
export { findAnchorProblems, findConflicts, normText, numbersIn, scoreOptions } from '../src/lib/tasks/checks.mjs';

// ── запуск из командной строки ──
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2);
  const tasks = loadAllTasks();
  const allow = loadAllow();
  const all = findConflicts(tasks);
  const conflicts = all.filter((c) => !allow.has(c.id));
  const allowed = all.filter((c) => allow.has(c.id));
  const anchors = findAnchorProblems(tasks);

  if (argv.includes('--json')) {
    console.log(JSON.stringify({ total: all.length, conflicts }, null, 2));
  } else {
    const single = tasks.filter((t) => t?.type === 'single_choice');
    console.log('='.repeat(74));
    console.log('СОГЛАСОВАННОСТЬ КЛЮЧА single_choice С ПОЯСНЕНИЕМ');
    console.log('='.repeat(74));
    console.log(`single_choice всего: ${single.length}`);
    console.log(`конфликтов ключа с пояснением: ${all.length}`);
    console.log(`  из них ожидаемых (allow): ${allowed.length}`);
    console.log(`  требующих разбора: ${conflicts.length}\n`);
    const show = argv.includes('--full') ? conflicts : conflicts.slice(0, 40);
    for (const c of show) {
      console.log(`${c.id}  (${c.file})`);
      console.log(`  ключ answer=${c.answer} -> «${c.answerText}»  [вес ${c.scoreAnswer}]`);
      console.log(`  вес у варианта ${c.suggested} -> «${c.suggestedText}»  [вес ${c.scoreSuggested}]`);
      if (argv.includes('--full')) {
        console.log(`  ${c.prompt}`);
        for (const o of c.options) console.log(`     ${o.id}: ${o.text}`);
      }
      console.log(`  explanation: ${c.explanation}`);
      console.log();
    }
    if (!argv.includes('--full') && conflicts.length > 40) {
      console.log(`... ещё ${conflicts.length - 40}. Полный список: node scripts/audit-keys.mjs --full`);
    }
    if (allowed.size) {
      console.log('ОЖИДАЕМЫЕ РАСХОЖДЕНИЯ (по allow-листу):');
      for (const c of allowed) console.log(`  ${c.id}: ${allow.get(c.id)}`);
      // запись, которая больше не срабатывает, — мусор: эвристику усилили или ключ починили
      const stale = [...allow.keys()].filter((id) => !all.some((c) => c.id === id));
      if (stale.length) {
        console.log('');
        console.log(`УСТАРЕВШИЕ записи allow-листа (${stale.length}) — можно удалить:`);
        for (const id of stale) console.log(`  ${id}`);
      }
    }
  }
  if (conflicts.length) {
    console.error(
      `\nПРОВЕРКА НЕ ПРОЙДЕНА: ${conflicts.length} заданий, где ключ single_choice ` +
        `противоречит пояснению. Ключ выставляется по смыслу, автоматически чинить нельзя.`,
    );
    process.exit(1);
  }
  if (anchors.length) {
    console.error(`\nЯКОРЬ КЛЮЧА НАРУШЕН (${anchors.length}):`);
    for (const a of anchors.slice(0, 40)) console.error(`  ${a.id}: ${a.reason}`);
    if (anchors.length > 40) console.error(`  ... ещё ${anchors.length - 40}`);
    console.error(
      '\nПРОВЕРКА НЕ ПРОЙДЕНА: верный вариант должен быть назван текстом ' +
        '(teacher_only.answer_text), и буква answer обязана указывать именно на него.',
    );
    process.exit(1);
  }
  console.log('\nПроверка пройдена: ключи не противоречат пояснениям, якорь answer_text цел.');
}
