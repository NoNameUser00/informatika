// Индекс существующих id заданий.
//
// Форма ввода заданий (src/pages/teacher/new.astro) не пишет файлы, но должна
// выдать задание с корректным id: inf-<класс>-<токен>-<NNN>. Токен и следующий
// свободный номер берутся из индекса, который собирается на сборке и попадает в
// бандл как src/data/bank-index.json.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let failed = 0;
const fail = (msg) => { failed++; console.log(`  FAIL ${msg}`); };

const idx = JSON.parse(readFileSync(join('src/data/bank-index.json'), 'utf-8'));

if (!Array.isArray(idx.banks) || idx.banks.length === 0) fail('индекс пуст');
if (typeof idx.totalTasks !== 'number' || idx.totalTasks < 1200) fail(`totalTasks подозрительно мал: ${idx.totalTasks}`);
if (idx.totalBanks !== idx.banks.length) fail(`totalBanks (${idx.totalBanks}) != banks.length (${idx.banks.length})`);

const allIds = [];
const files = new Set();
for (const b of idx.banks) {
  if (typeof b.file !== 'string' || !b.file.endsWith('.yaml')) fail(`${b.file}: неверный путь`);
  if (typeof b.token !== 'string' || !/^[a-z0-9]+$/.test(b.token)) fail(`${b.file}: токен «${b.token}»`);
  if (typeof b.nextId !== 'number' || b.nextId < 1) fail(`${b.file}: nextId ${b.nextId}`);
  if (!Array.isArray(b.ids)) fail(`${b.file}: ids не массив`);
  files.add(b.file);
  for (const id of b.ids) {
    allIds.push(id);
    if (!/^inf-\d+-[a-z0-9]+-\d+$/.test(id)) fail(`${id}: не в формате inf-<класс>-<токен>-<NNN>`);
  }
  // nextId должен быть на 1 больше максимального номера в банке
  const nums = b.ids.map((id) => Number(id.split('-').pop())).filter(Number.isFinite);
  const max = nums.length ? Math.max(...nums) : 0;
  if (b.nextId !== max + 1) fail(`${b.file}: nextId ${b.nextId}, а должен быть ${max + 1}`);
}

// Уникальность id по всему банку
const seen = new Set();
for (const id of allIds) {
  if (seen.has(id)) fail(`дубль id: ${id}`);
  seen.add(id);
}
if (allIds.length !== idx.totalTasks) fail(`totalTasks ${idx.totalTasks} != ${allIds.length}`);

// Все 21 банк присутствуют
if (files.size !== 21) fail(`банков в индексе ${files.size}, ожидалось 21`);

if (failed) {
  console.log(`\nБАНК-ИНДЕКС: провалено проверок ${failed}`);
  process.exit(1);
}
console.log(`  OK банк-индекс: ${idx.totalBanks} банков, ${idx.totalTasks} заданий, все id уникальны`);