// Ведомость ключей: разбор вердиктов и сохранность ответов при пересборке.
//
// Главное здесь — второе. Ответы человека лежат в самих файлах ведомости,
// поэтому любая пересборка обязана их сохранить. Стоит один раз потерять
// 458 ответов из-за неаккуратной перегенерации — и второй раз заполнять
// их никто не станет.
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from './make-key-review.mjs';
import { parseVerdict, parseVerdicts } from './apply-key-review.mjs';

let failed = 0;
function eq(actual, expected, name) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failed++;
    console.log(`  FAIL ${name}\n    ожидалось ${JSON.stringify(expected)}\n    получено  ${JSON.stringify(actual)}`);
  } else {
    console.log(`  ok ${name}`);
  }
}

console.log('parseVerdict');

eq(parseVerdict('').kind, 'skip', 'пустая строка — не проверено, а не ошибка');
eq(parseVerdict('верно').kind, 'ok', '«верно» — подтвердить');
eq(parseVerdict('Верно').kind, 'ok', 'регистр не важен');
eq(parseVerdict('поправить на C'), { kind: 'set', letter: 'C' }, '«поправить на C» — сменить ключ');
eq(parseVerdict('поправить на b'), { kind: 'set', letter: 'B' }, 'строчная буква приводится к верхней');
eq(parseVerdict('поправить на C.'), { kind: 'set', letter: 'C' }, 'точка в конце не мешает');

// Опечатка обязана быть ошибкой, а не «пропустить»: человек считает, что
// поправил, а ключ остался прежним.
eq(parseVerdict('врно').kind, 'bad', 'опечатка «врно» — ошибка');
eq(parseVerdict('поправить').kind, 'bad', '«поправить» без буквы — ошибка');
eq(parseVerdict('поправить на E').kind, 'bad', 'буквы вне списка — ошибка');
eq(parseVerdict('надо подумать').kind, 'bad', 'произвольный текст — ошибка');

console.log('\nparseVerdicts');
eq(
  parseVerdicts('## 1. inf-x-001\n\nВердикт: верно\n\n---\n\n## 2. inf-x-002\n\nВердикт:\n'),
  [{ id: 'inf-x-001', raw: 'верно' }, { id: 'inf-x-002', raw: '' }],
  'id и вердикт вытаскиваются из блоков',
);

console.log('\nпересборка ведомости');

const dir = mkdtempSync(join(tmpdir(), 'keyreview-'));
try {
  build(dir, { quiet: true });

  const names = readdirSync(dir);
  eq(names.filter((f) => /^\d\d-/.test(f)).length > 0, true, 'ведомости созданы');

  // Общая задача для всех банков: сколько их ни было, сумма заданий в ведомостях
  // должна совпасть с числом заданий без свидетельства.
  let inSheets = 0;
  for (const f of names.filter((n) => /^\d\d-.*\.md$/.test(n))) {
    inSheets += (readFileSync(join(dir, f), 'utf-8').match(/^## \d+\. /gm) ?? []).length;
  }
  const without = names
    .filter((n) => /^\d\d-.*\.md$/.test(n))
    .map((f) => readFileSync(join(dir, f), 'utf-8').match(/\*\*(\d+)\*\* в ведомости/)?.[1])
    .reduce((a, b) => a + Number(b), 0);
  eq(inSheets, without, `заданий в файлах столько же, сколько обещает заголовок (${without})`);

  // Вписываем ответы, как это сделает человек
  const sheet = join(dir, names.find((n) => n.startsWith('11-db')));
  const before = readFileSync(sheet, 'utf-8');
  writeFileSync(
    sheet,
    before.replace(/^Вердикт:[ \t]*$/m, 'Вердикт: поправить на A').replace(/^Вердикт:[ \t]*$/m, 'Вердикт: верно'),
    'utf-8',
  );

  build(dir, { quiet: true });
  const after = readFileSync(sheet, 'utf-8');

  eq(after.includes('Вердикт: поправить на A'), true, 'ответ «поправить на A» пережил пересборку');
  eq((after.match(/^Вердикт: верно$/gm) ?? []).length, 1, 'ответ «верно» пережил пересборку');
  eq(
    (after.match(/^Вердикт:[ \t]*$/gm) ?? []).length > 0,
    true,
    'непроверенные задания остались непроверенными',
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nвсе проверки пройдены');
process.exit(failed ? 1 : 0);