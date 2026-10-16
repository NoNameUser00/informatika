// Готовит порции заданий для внешней проверки ключей.
//
// КЛЮЧЕВОЕ: в порции НЕТ действующего ключа. Иначе проверяющий либо подыграет
// ему, либо начнёт «чинить» по подсказке, и проверка потеряет смысл. Наружу
// уходят только вопрос и варианты.
//
// Порции пишутся в docs/review/ai/, их читают сужащие агенты. Разбиение по
// банкам, а не вперемешку: так в порции однородная тема и её можно отдать
// модели целиком.
//
// Запуск:
//   node scripts/ai-judge-batches.mjs          пересобрать порции
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const OUT_DIR = 'docs/review/ai';
const PER_BANK = 40;

function walk(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (n.endsWith('.yaml')) acc.push(p);
  }
  return acc;
}

// Очередь: только те банки, чьи листы ещё не убраны в done/.
const done = new Set(
  readdirSync('docs/review/keys/done').map((f) => {
    const m = /^(\d\d)-(.+)\.md$/.exec(f);
    return m ? `${Number(m[1])}-${m[2]}` : f;
  }),
);

const banks = new Map();
for (const f of walk('data/tasks')) {
  const rel = f.replace(/\\/g, '/').split('/');
  const bank = `${Number(rel[2])}-${rel[3]}`;
  if (done.has(bank)) continue;
  const list = [];
  for (const t of parse(readFileSync(f, 'utf-8')) ?? []) {
    if (t?.type !== 'single_choice') continue;
    list.push({
      id: t.id,
      prompt: t.prompt,
      // Порядок по букве: ответ должен соответствовать тому, что увидит ученик.
      options: [...t.student_view.options]
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .map((o) => ({ id: o.id, text: o.text })),
    });
  }
  if (list.length) banks.set(bank, list);
}

if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

let n = 0;
let file = 0;
for (const [bank, tasks] of banks) {
  for (let i = 0; i < tasks.length; i += PER_BANK) {
    const chunk = tasks.slice(i, i + PER_BANK);
    file++;
    const name = `${String(file).padStart(2, '0')}-${bank}.md`;
    const body = chunk
      .map(
        (t, k) =>
          `${k + 1}. id=${t.id}\nВопрос: ${t.prompt}\n${t.options.map((o) => `${o.id}. ${o.text}`).join('\n')}`,
      )
      .join('\n\n');
    writeFileSync(
      join(OUT_DIR, name),
      `Задания ${bank}, часть ${i / PER_BANK + 1}. Всего в порции: ${chunk.length}.\n\n${body}\n`,
      'utf-8',
    );
    n += chunk.length;
  }
}

writeFileSync(
  join(OUT_DIR, 'index.json'),
  JSON.stringify(
    [...banks].map(([bank, tasks]) => ({ bank, total: tasks.length })),
    null,
    1,
  ),
  'utf-8',
);

console.log(`банков в очереди: ${banks.size}`);
console.log(`заданий: ${n}`);
console.log(`порций по ${PER_BANK}: ${file}`);
