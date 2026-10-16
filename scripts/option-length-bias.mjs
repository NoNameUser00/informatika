// Смещение длины: в скольких заданиях верный вариант — самый длинный.
//
// Ученик, читая вопрос, может ответить не разбираясь: достаточно взять самую
// подробную формулировку. Если такое верно почти всегда, задание не проверяет
// знание, а проверяет внимательность к объёму текста.
//
// Сравниваем с тем, что вышло бы случайно: при 4 вариантах вероятность ~26 %.
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

const byBank = new Map();
let total = 0;
let longest = 0;
let ties = 0;

for (const f of walk('data/tasks')) {
  const rel = f.replace(/\\/g, '/');
  for (const t of parse(readFileSync(f, 'utf-8')) ?? []) {
    if (t?.type !== 'single_choice') continue;
    const opts = t.student_view?.options ?? [];
    if (opts.length < 2) continue;
    const key = t.teacher_only?.answer;
    const opt = opts.find((o) => String(o.id) === String(key));
    if (!opt) continue;

    const len = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().length;
    const max = Math.max(...opts.map((o) => len(o.text)));
    const mine = len(opt.text);
    const bank = `${rel.split('/')[2]}-${rel.split('/')[3]}`;
    const row = byBank.get(bank) ?? { n: 0, longest: 0 };
    row.n++;
    if (mine === max && opts.filter((o) => len(o.text) === max).length === 1) row.longest++;
    byBank.set(bank, row);

    total++;
    if (mine === max) {
      if (opts.filter((o) => len(o.text) === max).length === 1) longest++;
      else ties++;
    }
  }
}

const rows = [...byBank].sort((a, b) => b[1].longest / b[1].n - a[1].longest / a[1].n);
for (const [bank, r] of rows) {
  const share = Math.round((r.longest / r.n) * 100);
  console.log(`${bank.padEnd(26)} заданий ${String(r.n).padStart(3)}  верный — самый длинный: ${String(r.longest).padStart(3)} (${String(share).padStart(3)}%)`);
}
console.log(`\nИТОГО: ${total} заданий, верный вариант единственный самый длинный в ${longest} (${Math.round((longest / total) * 100)}%), ничья по длине ещё в ${ties}.`);
console.log(`При 4 вариантах вслепую ожидалось бы около 26 %.`);