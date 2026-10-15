import { scoreOptions, findConflicts } from './audit-keys.mjs';

let failed = 0;
function eq(actual, expected, name) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failed++;
    console.log(`  FAIL ${name}\n    ожидалось ${JSON.stringify(expected)}\n    получено  ${JSON.stringify(actual)}`);
  } else {
    console.log(`  ok ${name}`);
  }
}

const task = (over) => ({
  id: 't', type: 'single_choice',
  student_view: { options: [{ id: 'A', text: 'x' }] },
  teacher_only: { answer: 'A' },
  ...over,
});
const opts = (...pairs) => pairs.map(([id, text]) => ({ id, text }));

console.log('scoreOptions');

// согласованный ключ: свидетельство в пользу названного варианта.
// «1024» названо в пояснении и текстом, и числом — поэтому вес 3 + 3.
eq(
  scoreOptions(task({
    student_view: { options: opts(['A', '1024'], ['B', '1000'], ['C', '8'], ['D', '256']) },
    teacher_only: { answer: 'A', explanation: 'В информатике кило — это 1024' },
  })).score,
  { A: 6, B: 0, C: 0, D: 0 },
  'названный вариант получает вес по обоим правилам',
);

// операнды в присваиваниях не считаются ответом
eq(
  scoreOptions(task({
    student_view: { options: opts(['A', 'A'], ['B', 'B'], ['C', '1'], ['D', '0']) },
    teacher_only: { answer: 'A', explanation: 'Поглощение: при A=1 всегда 1, при A=0 всегда 0' },
  })).score,
  { A: 0, B: 0, C: 0, D: 0 },
  'числа из «при A=1 ... A=0» не идут в вес',
);

// common_errors отвергает вариант
eq(
  scoreOptions(task({
    student_view: { options: opts(['A', '1024'], ['B', '1000']) },
    teacher_only: { answer: 'A', explanation: 'кило — это 1024', common_errors: ['1000'] },
  })).score,
  { A: 6, B: -4 },
  'вариант из common_errors получает минус',
);

// длинный текст с числами не ловится числовым правилом
eq(
  scoreOptions(task({
    student_view: { options: opts(['A', '8 символов: кодовое слово из трёх бит имеет 2³ = 8 вариантов'], ['B', '3 символа: столько бит в кодовом слове']) },
    teacher_only: { answer: 'A', explanation: 'Кодовое слово длиной 3 бита имеет ровно 2^3 = 8 различных записей' },
  })).score,
  { A: 0, B: 0 },
  'длинные варианты с числами не считаются названными',
);

console.log('\nfindConflicts');
const conf = (t) => findConflicts([{ ...t, __file: 'f.yaml' }]).length;

// ключ указывает не туда, куда указывает пояснение
eq(
  conf(task({
    student_view: { options: opts(['A', 'Планирование'], ['B', 'Монтаж'], ['C', 'Репетиция'], ['D', 'Слайды']) },
    teacher_only: { answer: 'B', explanation: 'Сначала идёт планирование' },
  })),
  1,
  'пояснение называет другой вариант — конфликт',
);

// ЗАФИКСИРОВАННОЕ ОГРАНИЧЕНИЕ: символические варианты нормализация съедает
// (∧/∨/¬ — не буквы), поэтому такие задания машинно не проверяются вовсе.
// Это осознанный предел инструмента, а не ошибка. Если когда-нибудь появится
// разбор символов, этот тест упадёт и заставит пересмотреть baseline.
eq(
  scoreOptions(task({
    student_view: { options: opts(['A', '∨'], ['B', '¬'], ['C', '∧'], ['D', '=']) },
    teacher_only: { answer: 'A', explanation: '∧ — И; ∨ — ИЛИ; ¬ — НЕ' },
  })).score,
  { A: 0, B: 0, C: 0, D: 0 },
  'символические варианты не проверяются машинно',
);

// согласованный ключ конфликта не даёт
eq(
  conf(task({
    student_view: { options: opts(['A', 'Планирование'], ['B', 'Монтаж'], ['C', 'Репетиция'], ['D', 'Слайды']) },
    teacher_only: { answer: 'A', explanation: 'Сначала идёт планирование' },
  })),
  0,
  'ключ совпадает с названным вариантом — чисто',
);

// пустые/кривые данные не роняют
eq(
  conf(task({
    student_view: { options: [] },
    teacher_only: { answer: 'A', explanation: '' },
  })),
  0,
  'пустые варианты — без конфликта',
);
eq(
  scoreOptions(task({ student_view: { options: opts(['A', 'x']) }, teacher_only: {} })).score,
  { A: 0 },
  'нет answer — вес не падает',
);

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nвсе проверки пройдены');
process.exit(failed ? 1 : 0);