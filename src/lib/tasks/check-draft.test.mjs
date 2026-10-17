// Проверка черновика задания перед выдачей YAML.
import { checkDraft } from './check-draft.mjs';

let failed = 0;
const fail = (msg) => { failed++; console.log(`  FAIL ${msg}`); };

const base = {
  type: 'single_choice',
  bankFile: 'data/tasks/11/db/bank-11db.yaml',
  cls: 11,
  topic: 'Базы данных',
  subtopic: 'Ключи',
  prompt: 'Что годится в первичные ключи?',
  points: 1,
  difficulty: 'basic',
  cognitive_level: 'remember',
  lesson: '11db-01-databases',
  fgos_subject: 'inf-11-db-keys',
  fgos_meta: 'plan-actions',
  options: [
    { id: 'A', text: 'Рост' },
    { id: 'B', text: 'Любимый цвет' },
    { id: 'C', text: 'Номер личного дела' },
    { id: 'D', text: 'Имя' },
  ],
  answer: 'C',
  answer_text: 'Номер личного дела',
  explanation: 'Уникален и неизменен',
  common_errors: '',
};

// Корректное задание — ни ошибок, ни предупреждений (кроме модели, но она в warnings).
const r1 = checkDraft(base);
if (r1.errors.length) fail(`корректное задание дало ошибки: ${r1.errors.join('; ')}`);

// Дубль варианта
const r2 = checkDraft({ ...base, options: [{ id: 'A', text: 'x' }, { id: 'B', text: 'x' }, { id: 'C', text: 'y' }, { id: 'D', text: 'z' }] });
if (!r2.errors.some((e) => /повторя/i.test(e))) fail('дубль варианта не пойман');

// Якорь не совпал
const r3 = checkDraft({ ...base, answer: 'A', answer_text: 'Номер личного дела' });
if (!r3.errors.some((e) => /Якорь/i.test(e))) fail('несовпавший якорь не пойман');

// Длина > 50 %
const r4 = checkDraft({ ...base, options: [
  { id: 'A', text: 'короткий' },
  { id: 'B', text: 'средний вариант' },
  { id: 'C', text: 'самый длинный вариант здесь и ещё длиннее' },
  { id: 'D', text: 'короткий2' },
], answer: 'C', answer_text: 'самый длинный вариант здесь и ещё длиннее' });
if (!r4.errors.some((e) => /длиной/i.test(e))) fail('выдача длиной не поймана');
if (!r4.bypassSnippet) fail('нет сниппета обхода при длине');

// Конфликт ключа с пояснением: пояснение называет вариант A, а ключ стоит на B
const r5 = checkDraft({ ...base, explanation: 'Обработка естественного языка работает с текстом и речью', answer: 'B', answer_text: 'Компьютерное зрение', options: [{ id: 'A', text: 'Обработка естественного языка' }, { id: 'B', text: 'Компьютерное зрение' }, { id: 'C', text: 'Базы данных' }, { id: 'D', text: 'Робототехника' }] });
if (!r5.errors.some((e) => /противоречит/i.test(e))) fail('конфликт ключа не пойман');

// Пустое объяснение
const r6 = checkDraft({ ...base, explanation: '' });
if (!r6.errors.some((e) => /объяснение/i.test(e))) fail('пустое объяснение не поймано');

// Пустой вопрос
const r7 = checkDraft({ ...base, prompt: '' });
if (!r7.errors.some((e) => /вопрос/i.test(e))) fail('пустой вопрос не пойман');

// numeric_base: неверный ключ
const r8 = checkDraft({ ...base, type: 'numeric_base', base: 2, accepted: '7', answer_text: '10', explanation: 'x' });
if (!r8.errors.some((e) => /не сходится/i.test(e))) fail('numeric_base неверный ключ не пойман');

// numeric_base: корректный
const r9 = checkDraft({ ...base, type: 'numeric_base', base: 2, accepted: '7', answer_text: '111', explanation: 'x' });
if (r9.errors.length) fail(`numeric_base корректный дал ошибки: ${r9.errors.join('; ')}`);

// code_run: пустой solution_code
const r10 = checkDraft({ ...base, type: 'code_run', solution_code: '', expected_stdout: 'hi', template: 't', explanation: 'x' });
if (!r10.errors.some((e) => /solution_code/i.test(e))) fail('пустой solution_code не пойман');

// code_run: предупреждение про ключ
const r11 = checkDraft({ ...base, type: 'code_run', solution_code: 'print(1)', expected_stdout: '1', template: 't', explanation: 'x' });
if (!r11.warnings.some((w) => /не проверяется/i.test(w))) fail('code_run не предупредил про ключ');

// matching: разные длины
const r12 = checkDraft({ ...base, type: 'matching', left: ['a', 'b'], right: ['1'], answer_map: {}, explanation: 'x' });
if (!r12.errors.some((e) => /разной длины/i.test(e))) fail('matching разные длины не пойманы');

// matching: дубль значения в answer_map
const r13 = checkDraft({ ...base, type: 'matching', left: ['a', 'b'], right: ['1', '2'], answer_map: { a: '1', b: '1' }, explanation: 'x' });
if (!r13.errors.some((e) => /повторяются/i.test(e))) fail('matching дубль значения не пойман');

if (failed) {
  console.log(`\nCHECK-DRAFT: провалено проверок ${failed}`);
  process.exit(1);
}
console.log('  OK check-draft: все сценарии проходят');