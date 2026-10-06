// Банк «Логика» 001-015: ответы на вычисления проверяются кодом.
// Выход: data/tasks/8/logic/bank-logic.yaml (руками не править).
import { writeFileSync, mkdirSync } from 'node:fs';

const q = (s) => `"${s}"`;
let id = 1;
const T = [];
const N = (o) => T.push({ id: `inf-8-logic-${String(id++).padStart(3, '0')}`, class: 8, topic: 'Элементы математической логики', ...o });
const F = (subj, meta = 'plan-actions') => `{ subject: [${subj}], meta: [${meta}] }`;
const B = (v) => (v ? 'истина' : 'ложь');

const SC = (o) => N({ type: 'single_choice', difficulty: o.d, cognitive_level: o.cog, points: o.pts, lesson: o.lesson,
  fgos_requirement: o.req, fgos_element: o.el, fgos: F(o.subj, o.meta),
  subtopic: o.sub, prompt: o.prompt,
  student_view: `{ options: [${o.opts.map((t, i) => `{ id: ${'ABCD'[i]}, text: "${t}" }`).join(', ')}] }`,
  auto_check: `{ method: exact_option }`,
  teacher_only: `{ answer: ${o.correct}, explanation: "${o.why}" }` });

// --- basic: что такое высказывание ---
SC({ d: 'basic', cog: 'remember', pts: 1, lesson: 'logic-01-utterances', req: 1.3, el: 1.5, subj: 'inf-8-logic-utter',
  sub: 'Понятие высказывания', prompt: 'Что из перечисленного является высказыванием?',
  opts: ['«Который час?»', '«Закрой окно!»', '«2 + 2 = 5»', '«Ура!»'], correct: 'C',
  why: 'Только повествовательное предложение с истинностью (здесь — ложное)' });
SC({ d: 'basic', cog: 'remember', pts: 1, lesson: 'logic-01-utterances', req: 1.3, el: 1.5, subj: 'inf-8-logic-utter',
  sub: 'Значения высказываний', prompt: 'Какие значения может принимать логическое высказывание?',
  opts: ['Только истину', 'Истину или ложь', 'Любое число', 'Да, нет или неизвестно'], correct: 'B',
  why: 'Третьего не дано: истина (1) или ложь (0)' });
SC({ d: 'basic', cog: 'remember', pts: 1, lesson: 'logic-01-utterances', req: 1.3, el: 1.5, subj: 'inf-8-logic-utter',
  sub: 'Составные высказывания', prompt: 'Какое высказывание составное?',
  opts: ['«Идет дождь»', '«Идет дождь и дует ветер»', '«Закрой окно»', '«2 × 2»'], correct: 'B',
  why: 'Два простых соединены связкой И' });

// --- basic: обозначения и таблицы-размер ---
SC({ d: 'basic', cog: 'remember', pts: 1, lesson: 'logic-02-operations', req: 1.3, el: 1.5, subj: 'inf-8-logic-ops',
  sub: 'Обозначения операций', prompt: 'Какой знак обозначает конъюнкцию (И)?',
  opts: ['∨', '¬', '∧', '='], correct: 'C', why: '∧ — И; ∨ — ИЛИ; ¬ — НЕ' });
SC({ d: 'basic', cog: 'remember', pts: 1, lesson: 'logic-02-operations', req: 1.3, el: 1.5, subj: 'inf-8-logic-ops',
  sub: 'Обозначения операций', prompt: 'Какой знак обозначает отрицание (НЕ)?',
  opts: ['∧', '∨', '¬', '≠'], correct: 'C', why: '¬ — НЕ' });
for (const n of [2, 3]) {
  const rows = 2 ** n;
  N({ type: 'numeric_base', difficulty: 'basic', cognitive_level: 'remember', points: 1, lesson: 'logic-03-truth-tables',
    fgos_requirement: 1.4, fgos_element: 1.6, fgos: F('inf-8-logic-tables'),
    subtopic: 'Размер таблицы истинности',
    prompt: `Сколько строк (без шапки) в таблице истинности для ${n} переменных? Запишите только число.`,
    student_view: `{ base: 10 }`, auto_check: `{ method: numeric_base, base: 10 }`,
    teacher_only: `{ accepted_values_decimal: [${rows}], answer_text: "${rows}", explanation: "2^${n} = ${rows}" }` });
}
N({ type: 'matching', difficulty: 'basic', cognitive_level: 'remember', points: 1, lesson: 'logic-02-operations',
  fgos_requirement: 1.3, fgos_element: 1.5, fgos: F('inf-8-logic-ops'),
  subtopic: 'Операции и знаки', prompt: 'Установите соответствие: операция — её знак.',
  student_view: `{ left: ["И", "ИЛИ", "НЕ"], right: ["¬", "∧", "∨"] }`,
  auto_check: `{ method: matching, partial: proportional }`,
  teacher_only: `{ answer_map: { "И": "∧", "ИЛИ": "∨", "НЕ": "¬" }, explanation: "И=∧, ИЛИ=∨, НЕ=¬" }` });

// --- intermediate: вычисления (ответы считает код) ---
const CALC = [
  { expr: 'A ∧ B', A: 1, B: 0, fn: (a, b) => a && b, lesson: 'logic-02-operations' },
  { expr: 'A ∨ B', A: 0, B: 0, fn: (a, b) => a || b, lesson: 'logic-02-operations' },
  { expr: '¬A', A: 0, B: 0, fn: (a) => !a, lesson: 'logic-02-operations' },
  { expr: 'A ∧ ¬B', A: 1, B: 1, fn: (a, b) => a && !b, lesson: 'logic-02-operations' },
  { expr: '¬(A ∨ B)', A: 0, B: 1, fn: (a, b) => !(a || b), lesson: 'logic-03-truth-tables' },
];
for (const c of CALC) {
  const v = !!c.fn(!!c.A, !!c.B);
  SC({ d: 'intermediate', cog: 'apply', pts: 2, lesson: c.lesson, req: 1.4, el: 1.5, subj: 'inf-8-logic-ops', meta: 'self-control',
    sub: 'Вычисление выражения',
    prompt: `При A=${c.A}, B=${c.B} вычислите ${c.expr}.`,
    opts: ['Истина', 'Ложь'], correct: v ? 'A' : 'B',
    why: `Подстановка даёт ${v ? 1 : 0}` });
}
SC({ d: 'intermediate', cog: 'apply', pts: 2, lesson: 'logic-02-operations', req: 1.4, el: 1.5, subj: 'inf-8-logic-ops',
  sub: 'Приоритет операций',
  prompt: 'Какая операция выполняется первой в выражении A ∨ ¬B ∧ C?',
  opts: ['ИЛИ', 'И', 'НЕ', 'Все одновременно'], correct: 'C',
  why: 'Сначала НЕ, потом И, потом ИЛИ' });

// --- advanced ---
SC({ d: 'advanced', cog: 'analyze', pts: 3, lesson: 'logic-04-elements', req: 1.4, el: 1.7, subj: 'inf-8-logic-elements',
  sub: 'Равносильность', prompt: 'Чему равносильно выражение A ∨ (A ∧ B)?',
  opts: ['A', 'B', 'A ∧ B', '0'], correct: 'A',
  why: 'Поглощение: при A=1 всегда 1, при A=0 всегда 0' });
N({ type: 'numeric_base', difficulty: 'advanced', cognitive_level: 'analyze', points: 3, lesson: 'logic-03-truth-tables',
  fgos_requirement: 1.4, fgos_element: 1.6, fgos: F('inf-8-logic-tables', 'self-control'),
  subtopic: 'Анализ таблицы',
  prompt: 'В скольких строках таблицы истинности выражение A ∧ B истинно? Запишите только число.',
  student_view: `{ base: 10 }`, auto_check: `{ method: numeric_base, base: 10 }`,
  teacher_only: `{ accepted_values_decimal: [1], answer_text: "1", explanation: "Только набор 11 из четырёх" }` });

if (id - 1 !== 16) throw new Error(`Ожидали 16 заданий, вышло ${id - 1}`);

const yaml = `# Сгенерировано scripts/make-logic-bank.mjs — руками не править.\n` + T.map((t) => {
  const L = [`- id: ${t.id}`];
  for (const k of ['class', 'topic', 'subtopic', 'type', 'difficulty', 'cognitive_level', 'points', 'lesson', 'fgos_requirement', 'fgos_element'])
    L.push(`  ${k}: ${t[k]}`);
  L.push(`  fgos: ${t.fgos}`, `  prompt: "${t.prompt}"`, `  student_view: ${t.student_view}`,
    `  auto_check: ${t.auto_check}`, `  teacher_only: ${t.teacher_only}`);
  return L.join('\n');
}).join('\n\n') + '\n';

mkdirSync('data/tasks/8/logic', { recursive: true });
writeFileSync('data/tasks/8/logic/bank-logic.yaml', yaml, 'utf-8');
console.log(`LOGIC BANK OK: ${T.length} заданий`);
