// Ведомость ключей: разбор вердиктов и сохранность ответов при пересборке.
//
// Главное здесь — второе. Ответы человека лежат в самих файлах ведомости,
// поэтому любая пересборка обязана их сохранить. Стоит один раз потерять
// 458 ответов из-за неаккуратной перегенерации — и второй раз заполнять
// их никто не станет.
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from './make-key-review.mjs';
import { parseVerdict, parseVerdicts, archiveFinished } from './apply-key-review.mjs';

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
// Разделитель блока однажды записался в строку вердикта при сборке с битым
// регексом \s* и размножился на все 458 заданий. Он не должен ни ломать
// разбор, ни выглядеть ответом.
eq(parseVerdict('---').kind, 'skip', 'разделитель «---» считается «не проверено»');
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

// Нашлось на первой же настоящей проверке: учитель пишет «поправь на А» —
// повелительное наклонение и КИРИЛЛИЧЕСКАЯ буква. Глазом от латинской не
// отличить, для машины это разные символы, и раньше такой ответ считался мусором.
eq(parseVerdict('поправь на А'), { kind: 'set', letter: 'A' }, '«поправь на А» (кириллица) — сменить на A');
eq(parseVerdict('поправь на В'), { kind: 'set', letter: 'B' }, '«поправь на В» (кириллица) — сменить на B');
eq(parseVerdict('поправь на C'), { kind: 'set', letter: 'C' }, '«поправь на C» (латиница) — сменить на C');
eq(parseVerdict('заменить на Б'.replace('Б', 'В')), { kind: 'set', letter: 'B' }, '«заменить на В» — тоже принимается');
eq(parseVerdict('поправить: А'), { kind: 'set', letter: 'A' }, 'двоеточие вместо «на» принимается');
eq(parseVerdict('поправь на Ж').kind, 'bad', 'кириллическая буква вне A–D — ошибка');

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

  // Мусорный вердикт-разделитель не должен пережить пересборку: иначе он
  // снова окажется в файлах и снова размножится.
  writeFileSync(sheet, readFileSync(sheet, 'utf-8').replace(/^Вердикт:[ \t]*$/m, 'Вердикт: ---'), 'utf-8');

  build(dir, { quiet: true });
  const after = readFileSync(sheet, 'utf-8');

  eq(after.includes('Вердикт: поправить на A'), true, 'ответ «поправить на A» пережил пересборку');
  eq((after.match(/^Вердикт: верно$/gm) ?? []).length, 1, 'ответ «верно» пережил пересборку');
  eq(after.includes('Вердикт: ---'), false, 'разделитель в вердикте не переживает пересборку');
  eq(
    (after.match(/^Вердикт:[ \t]*$/gm) ?? []).length > 0,
    true,
    'непроверенные задания остались непроверенными',
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('\nархив применённых листов');
{
  const queue = mkdtempSync(join(tmpdir(), 'keyreview-queue-'));
  try {
    const doneDir = join(queue, 'done');
    const block = (id, verdict) => `## 1. ${id}\n\nВердикт:${verdict ? ` ${verdict}` : ''}\n\n---\n\n`;
    writeFileSync(
      join(queue, '11-db.md'),
      block('inf-11-db-001', 'верно') + block('inf-11-db-003', 'поправить на A'),
      'utf-8',
    );
    writeFileSync(
      join(queue, '07-base.md'),
      block('inf-7-base-001', 'верно') + block('inf-7-base-002', ''),
      'utf-8',
    );

    const res = archiveFinished(queue, doneDir);
    eq(res.moved, ['11-db.md (2)'], 'полностью заполненный лист уходит в done/');
    eq(res.partial, ['07-base.md (1/2)'], 'недополненный остаётся в очереди');
    eq(existsSync(join(doneDir, '11-db.md')), true, 'файл действительно перенесён');
    eq(existsSync(join(queue, '11-db.md')), false, 'из очереди он исчез');
    eq(existsSync(join(queue, '07-base.md')), true, 'недополненный на месте');
  } finally {
    rmSync(queue, { recursive: true, force: true });
  }
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nвсе проверки пройдены');
process.exit(failed ? 1 : 0);