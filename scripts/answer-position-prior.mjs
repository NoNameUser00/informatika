// Измеряет, насколько часто верный ответ сидит на букве A.
//
// Зачем. Старая версия скрипта перемешивания переставляла МАССИВ вариантов, но
// оставляла буквы прежними. Значит сортировка по букве возвращает исходный
// порядок, в котором генератор всегда ставил верный ответ первым, то есть на A.
// А ключ при этом записывался буквой позиции в переставленном массиве — и
// уезжал на чужой вариант.
//
// Инструмент меряет это на данных, где истина известна: банки, проверенные
// учителем (листы в docs/review/keys/done/). Там доля «верный = A» — это
// измеренная надёжность правила, а не догадка.
//
// Для непроверенных банков та же доля — лишь ПРЕДСКАЗАНИЕ: сколько ключей
// придётся менять, если правило подтвердится. Ошибки в ~8 % случаев (правило
// срабатывает не всегда) учтены самим собой — их видно как задания с
// подтверждённым не-A ключом, и они перечислены отдельно.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

function walk(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (n.endsWith('.yaml')) acc.push(p);
  }
  return acc;
}

function doneBanks() {
  try {
    return new Set(
      readdirSync('docs/review/keys/done').map((f) => {
        const m = /^(\d\d)-(.+)\.md$/.exec(f);
        return m ? `${Number(m[1])}-${m[2]}` : f;
      }),
    );
  } catch {
    return new Set();
  }
}

const done = doneBanks();
const verified = [];
const pending = [];

for (const f of walk('data/tasks')) {
  const rel = f.replace(/\\/g, '/').split('/');
  const bank = `${Number(rel[2])}-${rel[3]}`;
  const row = { bank, n: 0, a: 0, isDone: done.has(bank) };
  for (const t of parse(readFileSync(f, 'utf-8')) ?? []) {
    if (t?.type !== 'single_choice') continue;
    row.n++;
    if (t.teacher_only?.answer === 'A') row.a++;
    if (row.isDone && t.teacher_only?.answer !== 'A') {
      verified.push(`${t.id} (${bank}): верный ${t.teacher_only.answer}, а не A`);
    }
  }
  if (!row.n) continue;
  (row.isDone ? verified : pending).push(row);
}

const share = (r) => Math.round((r.a / r.n) * 100);
const sum = (rows, f) => rows.reduce((a, r) => a + f(r), 0);

const vd = verified.filter((r) => r.n);
const vp = pending.filter((r) => r.n);
const dN = sum(vd, (r) => r.n);
const dA = sum(vd, (r) => r.a);
const pN = sum(vp, (r) => r.n);
const pA = sum(vp, (r) => r.a);

console.log('ПРОВЕРЕНО УЧИТЕЛЕМ (истина известна):');
for (const r of vd.sort((a, b) => share(b) - share(a))) {
  console.log(`  ${r.bank.padEnd(24)} ${String(r.n).padStart(3)} заданий, верный на A: ${String(r.a).padStart(3)} (${share(r)}%)`);
}
console.log(`  ИТОГО: ${dA} из ${dN} — ${Math.round((dA / dN) * 100)}%`);
console.log(`\n  Исключения (правило не сработало, ключ подтверждён и не A): ${verified.filter((r) => typeof r === 'string').length}`);
for (const s of verified.filter((r) => typeof r === 'string')) console.log(`    ${s}`);

console.log('\nНЕ ПРОВЕРЕНО (предсказание, а не вывод):');
for (const r of vp.sort((a, b) => share(b) - share(a))) {
  console.log(`  ${r.bank.padEnd(24)} ${String(r.n).padStart(3)} заданий, ключ на A: ${String(r.a).padStart(3)} (${share(r)}%)`);
}
console.log(`  ИТОГО: ${pA} из ${pN} — ${Math.round((pA / pN) * 100)}%`);
console.log(`\nЕсли правило подтвердится и на непроверенных, ключ придётся сменить примерно в ${pN - pA} заданиях.`);