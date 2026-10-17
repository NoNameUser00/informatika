// Ведомость для правки отвлекающих вариантов.
//
// Зачем. В 257 заданиях из 528 верный вариант длиннее остальных, и в 143
// из них — намного. Ученик выбирает самый подробный и угадывает, ничего не
// понимая в теме. Ключ при этом верен, поэтому гейт на правильность молчит:
// ловить здесь нечего, ломать нечего — нужно переписать формулировки.
//
// Что НЕ делает скрипт. Ничего не чинит сам: переписывать отвлекающие
// варианты — работа человека, который знает предмет. Скрипт только раскладывает
// задания по банкам, от худших к лучшим, и оставляет пустые строки под новый
// текст.
//
// ФОРМАТ ОТВЕТА. Под каждым вариантом — пустая строка «новый текст:». Пусто значит
// «оставить как есть», поэтому править нужно только то, что меняешь. Менять
// текст ВЕРНОГО варианта можно, но тогда придётся заново вписать якорь — это
// делает apply-distractor-review.mjs.
//
// Запуск:
//   node scripts/make-distractor-review.mjs             грубые случаи (запас > 50 %)
//   node scripts/make-distractor-review.mjs 20          порог 20 %
//   node scripts/make-distractor-review.mjs 20 --stats  только сводка
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const OUT_DIR = 'docs/review/distractors';
const pctArg = process.argv.slice(2).find((a) => /^\d+$/.test(a));
const THRESHOLD = pctArg ? Number(pctArg) : 50;
const statsOnly = process.argv.includes('--stats');

function walk(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (n.endsWith('.yaml')) acc.push(p);
  }
  return acc;
}

const len = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().length;
const flat = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Уже исправленные задания: берём их из раскладки, чтобы не гонять по кругу. */
const doneIds = new Set(
  existsSync(OUT_DIR)
    ? readdirSync(join(OUT_DIR, 'done')).map((f) => f.replace(/\.md$/, ''))
    : [],
);

const banks = new Map();

for (const f of walk('data/tasks')) {
  const rel = f.replace(/\\/g, '/').split('/');
  const bankKey = `${Number(rel[2])}-${rel[3]}`;
  for (const t of parse(readFileSync(f, 'utf-8')) ?? []) {
    if (t?.type !== 'single_choice') continue;
    if (doneIds.has(t.id)) continue;
    const opts = t.student_view?.options ?? [];
    if (opts.length < 2) continue;
    const opt = opts.find((o) => String(o.id) === String(t.teacher_only?.answer));
    if (!opt) continue;
    const others = opts.filter((o) => o.id !== opt.id);
    const second = Math.max(...others.map((o) => len(o.text)));
    const mine = len(opt.text);
    const pct = second ? Math.round(((mine - second) / second) * 100) : 999;
    if (pct <= THRESHOLD) continue;

    // Варианты в том порядке, в каком их увидит ученик: по букве.
    const shown = [...opts].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const row = banks.get(bankKey) ?? [];
    row.push({
      id: t.id,
      prompt: flat(t.prompt),
      pct,
      margin: mine - second,
      shown: shown.map((o) => ({
        id: o.id,
        text: flat(o.text),
        isCorrect: String(o.id) === String(t.teacher_only.answer),
        n: len(o.text),
      })),
    });
    banks.set(bankKey, row);
  }
}

if (!statsOnly) mkdirSync(OUT_DIR, { recursive: true });

let total = 0;
let files = 0;
const index = [
  '# Отвлекающие варианты, выдающие ответ длиной',
  '',
  `Порог: верный вариант длиннее второго по длине более чем на ${THRESHOLD} %.`,
  'При четырёх вариантах вслепую так бывает примерно в четверти заданий,',
  'так что ненулевая доля — не аномалия статистики, а подсказка ученику.',
  '',
  '**Как править.** Под каждым вариантом пустая строка «новый текст:». Пусто —',
  'оставить как есть. Менять нужно только отвлекающие: верный вариант обычно',
  'и должен быть подлиннее, но не настолько, чтобы выдавать себя один.',
  'Формулировки должны быть сопоставимы по форме: если верный ответ — фраза с',
  'объяснением, отвлекающие тоже фразы, а не голые существительные.',
  '',
  'Применить: `node scripts/apply-distractor-review.mjs`.',
  '',
  '| Файл | Заданий |',
  '| --- | ---: |',
];

for (const [bank, rows] of [...banks].sort()) {
  rows.sort((a, b) => b.pct - a.pct);
  const name = `${bank}.md`;
  const body = rows
    .map((r, i) => {
      const lines = [
        `## ${i + 1}. ${r.id}`,
        '',
        `**Вопрос.** ${r.prompt}`,
        '',
        `Запас длины: +${r.margin} симв. (+${r.pct} %)${r.shown.find((o) => o.isCorrect) ? '' : ''}`,
        '',
      ];
      for (const o of r.shown) {
        lines.push(
          `**${o.id}.** ${o.text}${o.isCorrect ? ' ← верный' : ''}  _(${o.n} симв.)_`,
          `новый текст: `,
          '',
        );
      }
      lines.push('---', '');
      return lines.join('\n');
    })
    .join('\n');

  if (!statsOnly) {
    writeFileSync(join(OUT_DIR, name), `# Отвлекающие варианты — ${bank}\n\n${body}`, 'utf-8');
  }
  index.push(`| [${name}](${name}) | ${rows.length} |`);
  total += rows.length;
  files++;
}

index.push('', `Всего заданий в ведомости: **${total}**.`, '');

if (!statsOnly) {
  writeFileSync(join(OUT_DIR, 'README.md'), index.join('\n'), 'utf-8');
}

console.log(`порог: +${THRESHOLD} %`);
console.log(`банков: ${files}, заданий: ${total}`);
console.log(statsOnly ? '(файлы не тронуты)' : `записано в ${OUT_DIR}/`);
