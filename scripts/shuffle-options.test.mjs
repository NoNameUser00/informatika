// Регрессия на shuffle-options.mjs.
//
// Сначала скрипт перемешивал массив вариантов, но оставлял в нём СТАРЫЕ буквы,
// а answer писал буквой позиции. Ключ указывал на чужой вариант — так в банках
// накопилось 59 неверных ключей single_choice. Плюс повторный запуск «перемешивал
// ещё раз», хотя комментарий обещал идемпотентность.
//
// Тест гоняет настоящий скрипт на временном банке и требует:
//  * после перемешивания id идут строго по позициям A, B, C, D;
//  * отмеченный правильным вариант остаётся тем же по смыслу (текст);
//  * второй запуск не меняет файл.
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';

let failed = 0;
function eq(actual, expected, name) {
  if (actual === expected) console.log(`  ok ${name}`);
  else {
    failed++;
    console.log(`  FAIL ${name}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  }
}

const TASK = (id, opts, answer) => `
- id: ${id}
  class: 9
  topic: "Проверка"
  type: single_choice
  points: 1
  prompt: "Вопрос ${id}?"
  student_view: { options: [${opts.map((t, i) => `{ id: ${'ABCD'[i]}, text: "${t}" }`).join(', ')}] }
  auto_check: { method: exact_option }
  teacher_only: { answer: ${answer}, explanation: "верно ${opts['ABCD'.indexOf(answer)]}" }
`;

const BANK = [
  TASK('t-one', ['раз', 'два', 'три', 'четыре'], 'B'),
  TASK('t-two', ['альфа', 'бета', 'гамма', 'дельта'], 'A'),
  TASK('t-three', ['один', 'два', 'три'], 'C'),
].join('\n');

const dir = mkdtempSync(join(tmpdir(), 'shuffle-'));
const file = join(dir, 'bank.yaml');
writeFileSync(file, BANK, 'utf-8');

const run = () => execFileSync('node', ['scripts/shuffle-options.mjs', file], {
  encoding: 'utf-8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
const readTasks = () =>
  (parse(readFileSync(file, 'utf-8')) ?? []).filter((t) => t?.type === 'single_choice');

try {
  const before = readTasks();
  run();
  const first = readTasks();
  const textAfterFirst = readFileSync(file, 'utf-8');

  run();
  const second = readTasks();
  const textAfterSecond = readFileSync(file, 'utf-8');

  console.log('shuffle-options');

  eq(first.length, 3, 'все задания на месте');

  // 1. id строго по позициям
  const positional = first.every((t) => {
    const ids = t.student_view.options.map((o) => o.id);
    return JSON.stringify(ids) === JSON.stringify('ABCD'.slice(0, ids.length).split(''));
  });
  eq(positional, true, 'id идут по позициям A,B,C,D');

  // 2. правильный вариант не сменился (сравниваем текст, а не букву)
  const textOf = (t) =>
    t.student_view.options.find((o) => o.id === t.teacher_only.answer)?.text;
  const kept = first.every((t, i) => textOf(t) === textOf(before[i]));
  eq(kept, true, 'отмеченный правильным вариант тот же по смыслу');

  // 3. пояснение продолжает совпадать с отмеченным вариантом —
  //    именно это проверяет audit-keys
  const explMatches = first.every((t) => t.teacher_only.explanation.includes(textOf(t)));
  eq(explMatches, true, 'пояснение называет отмеченный вариант');

  // 4. идемпотентность
  eq(textAfterSecond === textAfterFirst, true, 'второй запуск не меняет файл');
  eq(
    second.every((t, i) => textOf(t) === textOf(first[i])),
    true,
    'повторный запуск сохраняет правильные варианты',
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (!existsSync(file)) console.log('  (временный каталог убран)');
console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nвсе проверки пройдены');
process.exit(failed ? 1 : 0);