// Насколько задание «выдаёт» правильный ответ длиной.
//
// Прежний счётчик отвечал на вопрос «верный ли самый длинный», но этого мало:
// важнее, насколько ОН ДЛИННЕЕ остальных. Один выбитый вариант — это угадывание,
// три одинаково коротких — уже нет.
//
// Метрика: запас = длина верного минус длина второго по длине варианта.
// Считаем в символах и отдельно в процентах.
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

const len = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().length;

const rows = [];
for (const f of walk('data/tasks')) {
  const rel = f.replace(/\\/g, '/').split('/');
  const bank = `${Number(rel[2])}-${rel[3]}`;
  for (const t of parse(readFileSync(f, 'utf-8')) ?? []) {
    if (t?.type !== 'single_choice') continue;
    const opts = t.student_view?.options ?? [];
    if (opts.length < 2) continue;
    const opt = opts.find((o) => String(o.id) === String(t.teacher_only?.answer));
    if (!opt) continue;

    const others = opts.filter((o) => o.id !== opt.id).map((o) => len(o.text));
    const mine = len(opt.text);
    const second = others.length ? Math.max(...others) : 0;
    const margin = mine - second;
    const pct = second ? Math.round((margin / second) * 100) : 999;

    rows.push({
      id: t.id, bank, mine, second, margin, pct,
      text: String(opt.text),
      others: opts.filter((o) => o.id !== opt.id).map((o) => `${o.id}. ${String(o.text).replace(/\s+/g, ' ').trim()}`),
      prompt: t.prompt,
    });
  }
}

rows.sort((a, b) => b.pct - a.pct || b.margin - a.margin);

const buckets = [
  ['выдаёт грубо: запас > 50 %', (r) => r.pct > 50],
  ['заметно: 20–50 %', (r) => r.pct > 20 && r.pct <= 50],
  ['слабо: 5–20 %', (r) => r.pct > 5 && r.pct <= 20],
  ['не выдаёт: до 5 %', (r) => r.pct <= 5],
];

console.log(`заданий: ${rows.length}\n`);
for (const [name, test] of buckets) {
  const hit = rows.filter(test);
  const sum = hit.reduce((a, r) => a + r.margin, 0);
  console.log(`${name.padEnd(30)} ${String(hit.length).padStart(3)} заданий, средний запас ${hit.length ? Math.round(sum / hit.length) : 0} симв.`);
}

const worst = rows.slice(0, 5);
console.log('\nСамые явные случаи:');
for (const r of worst) {
  console.log(`\n${r.id} (${r.bank}) — верный на ${r.mine} симв., второй ${r.second}, запас ${r.margin} (+${r.pct}%)`);
  console.log(`  ${r.prompt}`);
  console.log(`  ВЕРНЫЙ: ${r.text}`);
  for (const o of r.others) console.log(`    ${o}`);
}

// Расклад по банкам для грубых случаев — чтобы понимать, с чего начинать.
const hard = rows.filter((r) => r.pct > 50);
const byBank = new Map();
for (const r of hard) byBank.set(r.bank, (byBank.get(r.bank) ?? 0) + 1);
console.log('\nГрубые случаи по банкам:');
for (const [b, n] of [...byBank].sort((a, b) => b[1] - a[1])) console.log(`  ${b.padEnd(24)} ${n}`);
console.log(`  ИТОГО грубых: ${hard.length}`);