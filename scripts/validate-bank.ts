// Валидация bank.yaml по Zod-схемам + проверка наполненности пулов под шаблон v1.
// Запуск: npm run validate-bank [файлы...] (по умолчанию оба банка)
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { bankSchema } from '../src/lib/tasks/schema.js';
import { LESSONS_7, LESSONS_8, LESSONS_9, LESSONS_10, LESSONS_11 } from '../src/data/lessons.js';

const paths = process.argv.slice(2);
const files = paths.length > 0 ? paths : ['data/tasks/8/number-systems/bank.yaml', 'data/tasks/8/number-systems/bank-gen.yaml', 'data/tasks/8/logic/bank-logic.yaml', 'data/tasks/8/algorithms/bank-algo.yaml', 'data/tasks/7/information/bank-7inf.yaml', 'data/tasks/7/base/bank-7base.yaml', 'data/tasks/7/media/bank-7media.yaml', 'data/tasks/8/code-run/bank-code.yaml', 'data/tasks/9/spreadsheets/bank-9sheet.yaml', 'data/tasks/9/arrays/bank-9arr.yaml', 'data/tasks/9/graphs/bank-9graph.yaml', 'data/tasks/9/extra/bank-9extra.yaml', 'data/tasks/10/base/bank-10base.yaml', 'data/tasks/10/ss/bank-10ss.yaml', 'data/tasks/10/logic/bank-10logic.yaml', 'data/tasks/10/media/bank-10media.yaml', 'data/tasks/11/data/bank-11data.yaml', 'data/tasks/11/db/bank-11db.yaml', 'data/tasks/11/algo/bank-11algo.yaml', 'data/tasks/11/net/bank-11net.yaml', 'data/tasks/11/graph/bank-11graph.yaml'];

let all: unknown[] = [];
for (const path of files) {
  const data = parse(readFileSync(path, 'utf-8'));
  const res = bankSchema.safeParse(data);
  if (!res.success) {
    console.error(`BANK INVALID: ${path}`);
    for (const issue of res.error.issues) console.error(`- ${issue.path.join('.')}: ${issue.message}`);
    process.exit(1);
  }
  console.log(`BANK OK: ${path} — ${res.data.length} заданий`);
  all = all.concat(res.data);
}

const ids = all.map((t) => (t as { id: string }).id);
if (new Set(ids).size !== ids.length) {
  console.error('BANK INVALID: дубли id между файлами');
  process.exit(1);
}

// Пулы под шаблон контрольной СС v1 (слоты 5/3/2): запас минимум ×3.
// Проверяются только файлы банка СС (по имени).
const need: Record<string, number> = { basic: 15, intermediate: 9, advanced: 6 };
const isNumsys = files.some((f) => f.includes('number-systems'));
if (isNumsys) {
  const pool = all.filter((t) => (t as { id: string }).id.startsWith('inf-8-numsys-'));
  for (const [d, min] of Object.entries(need)) {
    const n = pool.filter((t) => (t as { difficulty: string }).difficulty === d).length;
    console.log(`pool numsys/${d}: ${n} (мин. ${min})`);
    if (n < min) {
      console.error(`BANK INVALID: пул ${d} мал для 30 вариантов`);
      process.exit(1);
    }
  }
}
// Все lesson: в заданиях должны указывать на существующий урок из реестра.
// Иначе привязка молча теряется: задание не попадёт ни на одну страницу урока.
const LESSON_IDS = new Set(
  [...LESSONS_7, ...LESSONS_8, ...LESSONS_9, ...LESSONS_10, ...LESSONS_11].map((l) => l.id),
);
const dangling = new Map<string, string[]>();
for (const t of all as Array<{ id: string; lesson?: string }>) {
  const ref = t.lesson;
  if (!ref) continue;
  if (!LESSON_IDS.has(ref)) {
    const list = dangling.get(ref) ?? [];
    list.push(t.id);
    dangling.set(ref, list);
  }
}
if (dangling.size > 0) {
  console.error('BANK INVALID: lesson: ссылается на несуществующий урок');
  for (const [ref, ids] of dangling) console.error(`- ${ref}: ${ids.length} заданий (${ids.slice(0, 5).join(', ')}${ids.length > 5 ? ', …' : ''})`);
  process.exit(1);
}
console.log(`lesson: все ссылки разрешаются (${LESSON_IDS.size} уроков в реестре)`);

console.log(`BANK TOTAL: ${all.length} заданий, id уникальны`);
