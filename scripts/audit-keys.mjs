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

const ALLOW_FILE = 'data/tasks/key-conflicts.allow.json';

/** Поля, которые считаем «указанием на вариант» в пояснении. */
function normText(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"']/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Числа из текста: ими пояснение называет конкретный вариант-число. */
function numbersIn(s) {
  return new Set((String(s ?? '').match(/-?\d+(?:\.\d+)?/g) ?? []).map((x) => x.replace(',', '.')));
}

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

/**
 * Вес свидетельства в пользу варианта:
 *  +3 — текст варианта прямо назван в пояснении;
 *  +3 — вариант короткий и числовой, и его значение названо в пояснении;
 *  -4 — вариант назван в common_errors, то есть это отвергнутая ошибка.
 *
 * Числовое правило намеренно узкое. Иначе ловятся операнды, а не ответы:
 * в «Поглощение: при A=1 всегда 1, при A=0 всегда 0» детектор считал бы
 * ответом «0», хотя это значение операнда. Поэтому число засчитывается, только
 * если вариант короткий, содержит ровно одно число и в пояснении НЕТ присваиваний
 * вида «A = 1» (тогда числа в пояснении — операнды, а не результат).
 */
export function scoreOptions(task) {
  const options = task.student_view?.options ?? [];
  const answer = task.teacher_only?.answer;
  const expl = String(task.teacher_only?.explanation ?? '');
  const common = task.teacher_only?.common_errors ?? [];
  const commonList = Array.isArray(common) ? common : common ? [common] : [];

  const eText = normText(expl);
  const eNums = numbersIn(expl);
  const hasAssignment = /=\s*-?\d/.test(expl); // «A = 1», «A=0» — числа как операнды
  const cTexts = commonList.map(normText);

  const score = {};
  for (const o of options) {
    const tText = normText(o.text);
    let s = 0;
    if (tText.length >= 2 && eText.includes(tText)) s += 3;

    const words = tText.split(/\s+/).filter(Boolean);
    const tNums = numbersIn(o.text);
    if (!hasAssignment && words.length <= 5 && tNums.size === 1) {
      if (eNums.has([...tNums][0])) s += 3;
    }

    if (tText && cTexts.some((c) => c.includes(tText))) s -= 4;
    score[o.id] = s;
  }
  return { score, answer, options };
}

/** Конфликт: другой вариант выигрывает у ключа с отрывом. */
export function findConflicts(tasks) {
  const out = [];
  for (const t of tasks) {
    if (t?.type !== 'single_choice') continue;
    const { score, answer, options } = scoreOptions(t);
    if (!options.length || !(answer in score)) continue;
    const best = Object.keys(score).reduce((a, b) => (score[b] > score[a] ? b : a));
    if (score[best] >= 3 && score[best] > score[answer]) {
      out.push({
        id: t.id,
        file: t.__file,
        prompt: t.prompt,
        answer,
        answerText: options.find((o) => o.id === answer)?.text,
        suggested: best,
        suggestedText: options.find((o) => o.id === best)?.text,
        options: options.map((o) => ({ id: o.id, text: o.text })),
        explanation: t.teacher_only?.explanation ?? '',
        commonErrors: t.teacher_only?.common_errors ?? [],
        scoreAnswer: score[answer],
        scoreSuggested: score[best],
      });
    }
  }
  return out;
}

/**
 * Инвариант якоря ключа: teacher_only.answer_text обязан называть вариант,
 * на который указывает буква teacher_only.answer, — и ровно один.
 *
 * Зачем. Буква ключа производна от порядка вариантов: переставил варианты —
 * буква поехала, и если её не пересчитать, ключ указывает на чужой ответ
 * (так появились 88 неверных ключей). Сейчас верный вариант назван ТЕКСТОМ,
 * поэтому букву можно всегда пересчитать, а расхождение — это дрейф данных,
 * который надо увидеть, а не загладить.
 *
 * Возвращает список заданий с нарушениями; пустой список означает, что
 * перестановка вариантов больше не может тихо сломать ключ.
 */
export function findAnchorProblems(tasks) {
  const out = [];
  for (const t of tasks) {
    if (t?.type !== 'single_choice') continue;
    const options = t.student_view?.options ?? [];
    const answer = t.teacher_only?.answer;
    const want = t.teacher_only?.answer_text;

    if (typeof want !== 'string' || !want.trim()) {
      out.push({ id: t.id, reason: 'нет answer_text', answer, answerText: want });
      continue;
    }
    const hits = options.filter((o) => o.text === want).map((o) => o.id);
    if (hits.length !== 1) {
      out.push({
        id: t.id,
        reason: `текст ответа встречается среди вариантов ${hits.length} раз(а)`,
        answer,
        answerText: want,
      });
      continue;
    }
    if (answer && hits[0] !== answer) {
      out.push({
        id: t.id,
        reason: `answer=${answer}, а answer_text указывает на ${hits[0]}`,
        answer,
        answerText: want,
      });
    }
  }
  return out;
}

export function loadAllTasks() {
  const tasks = [];
  for (const f of yamlFiles('data/tasks')) {
    for (const t of parse(readFileSync(f, 'utf-8')) ?? []) {
      if (t && typeof t === 'object') tasks.push({ ...t, __file: f });
    }
  }
  return tasks;
}

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
