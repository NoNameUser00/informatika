import { generateVariant, generateAll, validateVariant, dealVariants } from './generator.mjs';

const BANK = [
  { id: 'inf-8-numsys-001', difficulty: 'basic', type: 'numeric_base', expected: 13, key: '1101' },
  { id: 'inf-8-numsys-002', difficulty: 'basic', type: 'numeric_base', expected: 175, key: 'AF' },
  { id: 'inf-8-numsys-003', difficulty: 'basic', type: 'numeric_base', expected: 45, key: '45' },
  { id: 'inf-8-numsys-004', difficulty: 'basic', type: 'numeric_base', expected: 23, key: '23' },
  { id: 'inf-8-numsys-005', difficulty: 'basic', type: 'single_choice',
    options: [{ id: 'A', text: '2' }, { id: 'B', text: '3' }, { id: 'C', text: '4' }, { id: 'D', text: '1' }], correct: 'C' },
  { id: 'inf-8-numsys-011', difficulty: 'basic', type: 'numeric_base', expected: 11, key: '11' },
  { id: 'inf-8-numsys-012', difficulty: 'basic', type: 'single_choice',
    options: [{ id: 'A', text: 'Двоичная' }, { id: 'B', text: 'Римская' }, { id: 'C', text: 'Восьмеричная' }, { id: 'D', text: 'Шестнадцатеричная' }], correct: 'B' },
  { id: 'inf-8-numsys-013', difficulty: 'basic', type: 'numeric_base', expected: 14, key: '14' },
  { id: 'inf-8-numsys-006', difficulty: 'intermediate', type: 'numeric_base', expected: 58, key: '111010' },
  { id: 'inf-8-numsys-007', difficulty: 'intermediate', type: 'numeric_base', expected: 17, key: '17' },
  { id: 'inf-8-numsys-008', difficulty: 'intermediate', type: 'numeric_base', expected: 107, key: '153' },
  { id: 'inf-8-numsys-009', difficulty: 'advanced', type: 'matching',
    left: ['10', '16', '8'], right: ['1010₂', '1000₂', '10000₂'],
    answerMap: { '10': '1010₂', '16': '10000₂', '8': '1000₂' } },
  { id: 'inf-8-numsys-010', difficulty: 'advanced', type: 'numeric_base', expected: 3, key: '3' },
];

const TEMPLATE = {
  id: 'numsys-control-v1',
  slots: [
    { difficulty: 'basic', count: 5, points_each: 1 },
    { difficulty: 'intermediate', count: 3, points_each: 2 },
    { difficulty: 'advanced', count: 2, points_each: 3 },
  ],
  shuffle_questions: true,
  shuffle_options: true,
};

let fails = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `: got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
  if (!ok) fails++;
}

// 1. Детерминированность
const v1a = generateVariant(TEMPLATE, BANK, 1, 'salt-1');
const v1b = generateVariant(TEMPLATE, BANK, 1, 'salt-1');
eq('determinism', v1a.checksum, v1b.checksum);

// 2-4. Все 30 вариантов валидны, без повторов, одинаковый максимум
const all = generateAll(TEMPLATE, BANK, 30, 'salt-1');
let bad = 0;
for (const v of all) {
  const errs = validateVariant(v, TEMPLATE, BANK);
  if (errs.length > 0) { bad++; console.log('FAIL variant', v.variant_number, errs.join('; ')); }
  if (v.max_points !== 17) { bad++; console.log('FAIL max_points', v.variant_number, v.max_points); }
}
eq('30 variants valid, max=17', bad, 0);
eq('variant count', all.length, 30);

// 5. Покрытие банка: каждое задание используется, базовые — регулярно
const freq = {};
for (const v of all) for (const q of v.questions) freq[q.task_id] = (freq[q.task_id] || 0) + 1;
console.log('coverage:', JSON.stringify(freq));
eq('all bank tasks used', Object.keys(freq).length, BANK.length);
const minBasic = Math.min(...BANK.filter((t) => t.difficulty === 'basic').map((t) => freq[t.id] || 0));
console.log('min basic freq:', minBasic);
eq('basic min freq >= 8', minBasic >= 8, true);

// 6. Ключи корректны
let keyBad = 0;
for (const v of all) {
  for (const q of v.questions) {
    const t = BANK.find((x) => x.id === q.task_id);
    if (t.type === 'single_choice') {
      const want = t.options.find((o) => o.id === t.correct).text;
      if (q.key.correct_text !== want) keyBad++;
      if (q.options[q.key.position - 1].id !== t.correct) keyBad++;
    }
    if (t.type === 'matching' && JSON.stringify(q.key.answer_map) !== JSON.stringify(t.answerMap)) keyBad++;
    if (t.type === 'numeric_base' && q.key.expected !== t.expected) keyBad++;
  }
}
eq('keys correct', keyBad, 0);

// 7. Раздача: сбалансирована и детерминирована
const students = Array.from({ length: 35 }, (_, i) => `student_${String(i + 1).padStart(3, '0')}`);
const deal1 = dealVariants(30, students, 'klass-8sh');
const deal2 = dealVariants(30, students, 'klass-8sh');
eq('deal deterministic', deal1, deal2);
const counts = {};
Object.values(deal1).forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
eq('deal balanced (5x2 + 25x1)', Math.max(...Object.values(counts)) - Math.min(...Object.values(counts)) <= 1, true);

// 8. Другой salt -> другие варианты
const vSalt = generateVariant(TEMPLATE, BANK, 1, 'salt-2');
eq('salt changes variant', vSalt.checksum === v1a.checksum, false);

console.log(fails === 0 ? 'ALL OK' : `${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
