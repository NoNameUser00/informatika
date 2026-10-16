// Порядок вариантов в собранных заданиях.
//
// Ученик должен видеть A, B, C, D — в любом случае, в каком порядке варианты
// лежат в банке. Перестановка меняет ПИСЬМО варианта, а не набор, и путаный
// порядок читается как сбой. Ключ при этом указывает на ту же формулировку,
// что и до сортировки, — проверяется отдельно тем, что после сортировки
// буква ключа всё ещё указывает на anchor_text.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let failed = 0;

const files = readdirSync('src/data').filter((f) => f.endsWith('.json'));
let checked = 0;
const wrong = [];

for (const f of files) {
  const data = JSON.parse(readFileSync(join('src/data', f), 'utf-8'));
  const list = Array.isArray(data) ? data : (data.tasks ?? []);
  for (const t of list) {
    if (t?.type !== 'single_choice' || !t.options?.length) continue;
    checked++;
    const ids = t.options.map((o) => o.id).join('');
    if (ids !== 'ABCD'.slice(0, t.options.length)) wrong.push(`${f}: ${t.id} -> ${ids}`);
  }
}

if (wrong.length) {
  failed++;
  console.log(`  FAIL варианты не по алфавиту: ${wrong.length}`);
  for (const w of wrong.slice(0, 8)) console.log(`    ${w}`);
} else {
  console.log(`  ok варианты строго A,B,C,D (проверено ${checked} заданий в ${files.length} файлах)`);
}

// Второе свойство: сортировка не должна была сдвинуть ключ. Если correct
// указывает на букву, которой в списке нет, — значит буквы и варианты
// разъехались.
const missing = [];
for (const f of files) {
  const data = JSON.parse(readFileSync(join('src/data', f), 'utf-8'));
  const list = Array.isArray(data) ? data : (data.tasks ?? []);
  for (const t of list) {
    if (t?.type !== 'single_choice' || !t.options?.length) continue;
    if (!t.options.some((o) => o.id === t.correct)) missing.push(`${f}: ${t.id} correct=${t.correct}`);
  }
}
if (missing.length) {
  failed++;
  console.log(`  FAIL ключ указывает на отсутствующую букву: ${missing.length}`);
  for (const m of missing.slice(0, 8)) console.log(`    ${m}`);
} else {
  console.log('  ok ключ указывает на существующий вариант');
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nвсе проверки пройдены');
process.exit(failed ? 1 : 0);