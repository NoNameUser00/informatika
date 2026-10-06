// Валидация bank.yaml по Zod-схемам + проверка наполненности пулов под шаблон v1.
// Запуск: npm run validate-bank [файлы...] (по умолчанию оба банка)
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { bankSchema } from '../src/lib/tasks/schema.js';

const paths = process.argv.slice(2);
const files = paths.length > 0 ? paths : ['data/tasks/8/number-systems/bank.yaml', 'data/tasks/8/number-systems/bank-gen.yaml', 'data/tasks/8/logic/bank-logic.yaml', 'data/tasks/8/algorithms/bank-algo.yaml'];

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
console.log(`BANK TOTAL: ${all.length} заданий, id уникальны`);
