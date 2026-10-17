// Пересобирает ВСЕ пересобираемые файлы одной командой.
//
// Зачем. Генераторов четыре: trainer:json, checks, bank:30, edge:sync. Каждый
// пишет свою часть репозитория, и забыть любой из них невозможно без последствий
// — но последствия настигают только на CI, через `git diff --exit-code`. За одну
// сессию это случилось дважды: менялись ключи в 8 классе, я прогонял checks и
// забывал trainer:json, и сборка падала на `src/data/numsys-tasks.json`.
//
// Порядок важен и не произволен:
//   1. trainer:json — тренерские задания из банков;
//   2. checks       — 44 работы из тех же банков;
//   3. bank:30      — проверка 30 уникальных вариантов;
//   4. edge:sync    — копии банков в supabase/functions/submit-attempt/vendor,
//      которые обязаны совпадать с src/data/checks побайтно.
//
// Шаг сорвёлся — дальше не идём: иначе следующий генератор перезапишет следы
// предыдущего и непонятно, где собственно поломалось.
//
// Запуск:
//   node scripts/rebuild-all.mjs           пересобрать
//   node scripts/rebuild-all.mjs --check   пересобрать и сказать, осталось ли
//                                           что-то незакоммиченное (код 1, если да)
import { execFileSync } from 'node:child_process';

const checkOnly = process.argv.includes('--check');

const STEPS = [
  { name: 'bank:index', cmd: 'npm run bank:index', about: 'индекс существующих id' },
  { name: 'trainer:json', cmd: 'npm run trainer:json', about: 'тренерские задания' },
  { name: 'checks', cmd: 'npm run checks', about: '44 работы' },
  { name: 'bank:30', cmd: 'npm run bank:30', about: 'проверка 30 вариантов' },
  { name: 'edge:sync', cmd: 'npm run edge:sync', about: 'копии банков для edge-функции' },
];

for (const [i, step] of STEPS.entries()) {
  process.stdout.write(`[${i + 1}/${STEPS.length}] ${step.name} — ${step.about} ... `);
  try {
    // shell: true обязателен. На Windows `npm` — это npm.cmd, и без оболочки
    // запуск молча падает с кодом null и пустым stderr: выглядит как «segfault»,
    // хотя дело в поиске исполняемого файла. Строка команды берётся из
    // package.json, поэтому расхождений с npm-скриптами быть не может.
    execFileSync(step.cmd, { shell: true, stdio: ['ignore', 'ignore', 'pipe'] });
    process.stdout.write('ок\n');
  } catch (e) {
    process.stdout.write('ПРОВАЛ\n');
    const err = Buffer.isBuffer(e.stderr) ? e.stderr.toString() : String(e.stderr ?? '');
    for (const line of err.trim().split('\n').filter(Boolean).slice(-20)) console.error(`    ${line}`);
    console.error(`\nОстановились на шаге «${step.name}». Дальше не идём, чтобы не затереть следы.`);
    process.exit(1);
  }
}

if (!checkOnly) {
  console.log('\nВсё пересобрано. Осталось закоммитить изменённые файлы вместе с правкой источника.');
  process.exit(0);
}

// --check: показываем, не забыт ли какой-нибудь генератор. Молча проходить мимо
// незакоммиченных пересобранных файлов нельзя — именно на этом CI и падает.
let dirty = [];
try {
  const out = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf-8' });
  dirty = out.split('\n').filter(Boolean);
} catch {
  console.log('\nНе удалось прочитать git status — пропускаю проверку чистоты.');
  process.exit(0);
}

const generated = dirty.filter((l) =>
  /src\/data\/(checks\/|.*-tasks\.json|manifest\.json)|supabase\/functions\/submit-attempt\/vendor\/bank\//.test(l),
);

if (generated.length) {
  console.error(`\nПРОВЕРКА НЕ ПРОЙДЕНА: после пересборки изменено ${generated.length} пересобираемых файлов, они не закоммичены.`);
  for (const l of generated.slice(0, 20)) console.error(`  ${l}`);
  if (generated.length > 20) console.error(`  ... ещё ${generated.length - 20}`);
  console.error('\nЗакоммитьте их вместе с правкой источника — иначе CI упадёт на git diff.');
  process.exit(1);
}

console.log('\nПересобранные файлы совпадают с закоммиченными.');
