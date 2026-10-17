// Генераторы банков не должны появляться в scripts/.
//
// Проверены все 528 заданий: в каждом single_choice ключ выставлен человеком,
// варианты перемешаны и переставлены по буквам, отвлекающие выровнены по длине.
// Скрипт, который пишет в data/tasks/** целиком, способен это всё стереть без
// предупреждения — и выглядит при этом безобидно.
//
// Поэтому в scripts/ разрешён ровно один генератор банков: make-numsys-bank.mjs,
// он подключён к npm run bank:gen, ответы в его банке считает код, и каждая
// задача проходит check.mjs. Остальные одноразовые генераторы лежат в
// scripts/legacy — см. README там.
//
// Проверка статическая и намеренно грубая: ищет в исходнике литерал пути под
// data/tasks рядом с записью в файл. Эвристика может пропустить генератор,
// собирающий путь из кусков, — но задача здесь не в идеальной детекции, а в том,
// чтобы новый make-*.mjs не проскочил молча.
//
// make-numsys-bank.mjs и shuffle-options.mjs в ALLOWED — не потому, что им можно
// писать в банки, а потому, что у каждого есть код, который это проверяет, и
// он стоит в цепочке npm test.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED = new Map([
  [
    'make-numsys-bank.mjs',
    'живой генератор тренажёра СС: подключён к npm run bank:gen, ключи считает код, каждая задача проходит check.mjs',
  ],
  [
    'shuffle-options.mjs',
    'перестановка вариантов с сохранением ключа: детерминирована по id задания, идемпотентна, ключ ведёт за якорем answer_text. Проверяется scripts/shuffle-options.test.mjs и scripts/audit-keys.mjs (якорь ключа)',
  ],
]);

let failed = 0;

const files = readdirSync('scripts').filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'));
const offenders = [];

for (const f of files) {
  const src = readFileSync(join('scripts', f), 'utf-8');
  const writes = /writeFileSync|appendFileSync|createWriteStream/.test(src);
  const touchesBank = /['"`]data\/tasks\/[^'"`]*\.ya?ml['"`]/.test(src);
  if (writes && touchesBank && !ALLOWED.has(f)) offenders.push(f);
}

for (const f of offenders) {
  failed++;
  console.log(`  FAIL ${f} пишет в data/tasks и не значится живым генератором`);
}

if (failed) {
  console.log(
    '\nГЕНЕРАТОРЫ БАНКОВ: не считается авария, но молчаливую порчу данных надо исключать.\n' +
      'Либо перенесите скрипт в scripts/legacy (одноразовый), либо добавьте его в ALLOWED\n' +
      'в этом тесте с указанием, чем он проверяется.',
  );
  process.exit(1);
}

console.log(`  OK генераторы банков: скриптов в scripts/ ${files.length}, разрешённых ${ALLOWED.size}`);