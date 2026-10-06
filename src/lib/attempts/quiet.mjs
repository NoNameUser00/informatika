// Тихая сдача ученика: только ответы, БЕЗ ключей, баллов и отметок.
// Правильность считает учитель/сервер позже — клиент ничего не решает.
// Чистые функции, тестируются в npm test.

export function plainAnswers(tasks, answers) {
  const out = {};
  for (const t of tasks) {
    const a = answers[t.id];
    out[t.id] = typeof a === 'string' ? a : JSON.stringify(a ?? '');
  }
  return out;
}

export function buildQuietAttempt({ surname, firstname, className, testType, testCode, variant, tasks, answers }) {
  const given = plainAnswers(tasks, answers);
  const answered = tasks.filter((t) => {
    const a = answers[t.id];
    if (a == null || a === '') return false;
    if (t.type === 'matching') return t.left.every((k) => a[k]);
    if (t.type === 'code_run') return String(a).trim() !== '';
    return true;
  }).length;
  return {
    surname: String(surname || '').trim(),
    firstname: String(firstname || '').trim(),
    class_name: String(className || ''),
    test_type: testType,
    test_code: testCode,
    variant,
    answers: given,
    answered,
    total: tasks.length,
    // ВАЖНО: здесь намеренно нет keys / auto_score / proposed_mark.
  };
}

export function quietStatus(attempt) {
  return `Ответы сохранены (${attempt.answered} из ${attempt.total}). Правильность и отметку скажет учитель.`;
}
