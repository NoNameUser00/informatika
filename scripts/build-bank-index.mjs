// Генератор индекса существующих id заданий.
//
// Зачем. Форма ввода заданий (src/pages/teacher/new.astro) не пишет файлы,
// но должна выдать задание с корректным id: inf-<класс>-<токен>-<NNN>. Токен
// выводится из имени банка, NNN — следующий свободный номер. В офлайн-сборке
// файловой системы нет, поэтому индекс собирается на этапе сборки и попадает
// в бандл как src/data/bank-index.json.
//
// Токен берётся из СУЩЕСТВУЮЩИХ id в банке, а не из имени файла: в репозитории
// одни и те же токены живут в файлах с разными именами (bank-10media.yaml →
// токен media, bank.yaml → token numsys). Брать токен из имени файла ненадёжно.
// Если в банке нет ни одного задания — берём токен из имени файла (последний
// сегмент без расширения и без ведущего номера класса).
//
// Запуск:
//   node scripts/build-bank-index.mjs
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith('.yaml')) acc.push(p);
  }
  return acc;
}

const ID_RE = /^inf-(\d+)-([a-z0-9]+)-(\d+)$/;

const banks = [];
const allIds = [];
const idSet = new Set();

for (const file of walk('data/tasks').sort()) {
  const tasks = parse(readFileSync(file, 'utf-8')) ?? [];
  const ids = [];
  const tokens = new Map();
  let maxNum = 0;
  let cls = null;

  for (const t of tasks) {
    if (!t || typeof t !== 'object' || typeof t.id !== 'string') continue;
    ids.push(t.id);
    allIds.push(t.id);
    const m = ID_RE.exec(t.id);
    if (m) {
      const c = Number(m[1]);
      const tok = m[2];
      const n = Number(m[3]);
      if (cls === null) cls = c;
      tokens.set(tok, (tokens.get(tok) ?? 0) + 1);
      if (n > maxNum) maxNum = n;
    }
  }

  // Токен: самый частый среди id, иначе — из имени файла.
  let token = null;
  if (tokens.size > 0) {
    token = [...tokens.entries()].sort((a, b) => b[1] - a[1])[0][0];
  } else {
    const base = file.split(/[\\/]/).pop().replace(/\.yaml$/, '');
    token = base.replace(/^bank-/, '').replace(/^\d+/, '') || base;
  }

  banks.push({
    file: file.replace(/\\/g, '/'),
    token,
    class: cls,
    count: ids.length,
    nextId: maxNum + 1,
    ids,
  });
}

// Проверка уникальности — дубль id ломает validate-bank.
const dupes = allIds.filter((id, i) => allIds.indexOf(id) !== i);
if (dupes.length) {
  console.error('ДУБЛИ id в банках:', dupes);
  process.exit(1);
}

const index = { banks, totalTasks: allIds.length, totalBanks: banks.length };
writeFileSync('src/data/bank-index.json', JSON.stringify(index, null, 2) + '\n', 'utf-8');
console.log(`банк-индекс: ${banks.length} банков, ${allIds.length} заданий`);