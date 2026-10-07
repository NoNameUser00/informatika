// Сборка проверочных и контрольных работ из банков по явным спискам ID.
// Проверочная — облегчённая (меньше заданий, меньше цифры), контрольная — полная.
// Использование: node scripts/make-checks.mjs (выход: src/data/checks/*.json).
// Запуск входит в CI через npm run checks (см. package.json).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const BANK_FILES = [
  'src/data/numsys-tasks.json',
  'src/data/logic-tasks.json',
  'src/data/algo-tasks.json',
  'src/data/grade7-tasks.json',
];

const CHECKS = [
  { file: 'proverka-ss.json', code: 'numsys-proverka-v1', title: 'Проверочная: Системы счисления',
    instruction: 'В ответе запишите только само число.',
    ids: ['inf-8-numsys-061', 'inf-8-numsys-062', 'inf-8-numsys-063', 'inf-8-numsys-064', 'inf-8-numsys-065'] },
  { file: 'control-ss.json', code: 'numsys-control-v1', title: 'Контрольная: Системы счисления',
    instruction: 'В ответе запишите только само число. Основание системы счисления (₂, ₈, ₁₀, ₁₆) указывать не нужно.',
    ids: ['inf-8-numsys-001', 'inf-8-numsys-003', 'inf-8-numsys-004', 'inf-8-numsys-002', 'inf-8-numsys-006', 'inf-8-numsys-008', 'inf-8-numsys-007', 'inf-8-numsys-010'] },
  { file: 'proverka-logic.json', code: 'logic-proverka-v1', title: 'Проверочная: Логика',
    instruction: 'Отвечайте точно.',
    ids: ['inf-8-logic-004', 'inf-8-logic-009', 'inf-8-logic-017', 'inf-8-logic-019', 'inf-8-logic-018'] },
  { file: 'control-logic.json', code: 'logic-control-v1', title: 'Контрольная: Логика',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.',
    ids: ['inf-8-logic-001', 'inf-8-logic-002', 'inf-8-logic-003', 'inf-8-logic-004', 'inf-8-logic-005', 'inf-8-logic-009', 'inf-8-logic-012', 'inf-8-logic-016'] },
  { file: 'proverka-algo.json', code: 'algo-proverka-v1', title: 'Проверочная: Алгоритмы',
    instruction: 'Отвечайте точно.',
    ids: ['inf-8-algo-001', 'inf-8-algo-007', 'inf-8-algo-008', 'inf-8-algo-013', 'inf-8-algo-014'] },
  { file: 'control-algo.json', code: 'algo-control-v1', title: 'Контрольная: Алгоритмы',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.',
    ids: ['inf-8-algo-003', 'inf-8-algo-004', 'inf-8-algo-005', 'inf-8-algo-006', 'inf-8-algo-010', 'inf-8-algo-011', 'inf-8-algo-002', 'inf-8-algo-012'] },
  { file: 'proverka-7inf.json', code: 'grade7-proverka-v1', title: 'Проверочная: Информация',
    instruction: 'Отвечайте точно.',
    ids: ['inf-7-inf-001', 'inf-7-inf-005', 'inf-7-inf-009', 'inf-7-inf-013', 'inf-7-inf-014'] },
  { file: 'control-7inf.json', code: 'grade7-control-v1', title: 'Контрольная: Информация',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.',
    ids: ['inf-7-inf-001', 'inf-7-inf-002', 'inf-7-inf-003', 'inf-7-inf-006', 'inf-7-inf-007', 'inf-7-inf-008', 'inf-7-inf-010', 'inf-7-inf-011'] },
  { file: 'proverka-7base.json', code: 'grade7base-proverka-v1', title: 'Проверочная: Компьютер и софт',
    instruction: 'Отвечайте точно.',
    ids: ['inf-7-base-001', 'inf-7-base-002', 'inf-7-base-005', 'inf-7-base-010', 'inf-7-base-011'] },
  { file: 'control-7base.json', code: 'grade7base-control-v1', title: 'Контрольная: Компьютер и софт',
    instruction: 'Отвечайте точно. В числовых ответах запишите только число.',
    ids: ['inf-7-base-001', 'inf-7-base-003', 'inf-7-base-004', 'inf-7-base-006', 'inf-7-base-008', 'inf-7-base-009', 'inf-7-base-010', 'inf-7-base-012'] },
];

const pool = new Map();
for (const f of BANK_FILES) {
  const bank = JSON.parse(readFileSync(f, 'utf-8'));
  for (const t of bank.tasks) {
    if (pool.has(t.id)) throw new Error(`duplicate id ${t.id}`);
    pool.set(t.id, t);
  }
}

mkdirSync('src/data/checks', { recursive: true });
for (const c of CHECKS) {
  const tasks = c.ids.map((id) => {
    const t = pool.get(id);
    if (!t) throw new Error(`unknown id ${id} in ${c.file}`);
    return t;
  });
  const max = tasks.reduce((s, t) => s + t.points, 0);
  writeFileSync(
    `src/data/checks/${c.file}`,
    JSON.stringify({ test_code: c.code, variant: 'v1', max_score: max, instruction: c.instruction, page_size: 5, tasks }, null, 2) + '\n',
    'utf-8',
  );
  console.log(`CHECK OK: src/data/checks/${c.file} — ${tasks.length} заданий, max=${max}`);
}
