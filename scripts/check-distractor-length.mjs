// Гейт: верный вариант single_choice не должен выдавать себя длиной.
//
// Зачем. В 125 заданиях из 528 верный вариант был длиннее остальных более чем
// на 50 %, и ученик угадывал, ничего не понимая в теме. Ключ при этом верен,
// поэтому гейт на правильность молчит. Ловить здесь нечего, ломать нечего —
// нужно переписать формулировки, но не вставлять в банк новые такие задания.
//
// Исключение — варианты, состоящие только из чисел (inf-11-graph-008 и т.п.):
// длина у чисел ничего не выдаёт. Правило isNumericLike — «есть цифра и нет
// букв», буквы любого алфавита.
//
// Обход — запись в allow-листе с причиной. Allow-лист лежит в git, виден всем.
//
// Запуск:
//   node scripts/check-distractor-length.mjs           отчёт, ненулевой код при нарушениях
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { giveawayPct, isNumericLike } from '../src/lib/tasks/checks.mjs';

const ALLOW_FILE = 'data/tasks/distractor-length.allow.json';

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

const allow = loadAllow();
const offenders = [];

for (const f of yamlFiles('data/tasks')) {
  for (const t of parse(readFileSync(f, 'utf-8')) ?? []) {
    if (t?.type !== 'single_choice') continue;
    const opts = t.student_view?.options ?? [];
    if (opts.length < 2) continue;
    if (opts.every((o) => isNumericLike(o.text))) continue;
    const m = giveawayPct(opts, t.teacher_only?.answer);
    if (m && m.pct > 50 && !allow.has(t.id)) {
      offenders.push({ id: t.id, file: f, pct: m.pct, margin: m.margin });
    }
  }
}

if (offenders.length) {
  console.error(`\nДЛИНА ОТВЛЕКАЮЩИХ: ${offenders.length} заданий выдают ответ длиной:`);
  for (const o of offenders) console.error(`  ${o.id} (${o.file}): +${o.margin} симв. (+${o.pct} %)`);
  console.error('\nЛибо выровнять формулировки, либо добавить в allow-лист с причиной.');
  process.exit(1);
}

console.log('Длина отвлекающих: грубых случаев нет (или все в allow-листе).');