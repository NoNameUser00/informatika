// Чистая проверка черновика задания перед выдачей YAML.
//
// Живёт в src/lib, чтобы форма в браузере и тесты работали с одним кодом.
// Никаких node-зависимостей. Импортирует только ./checks.mjs и ../scoring/check.mjs.
import { checkDuplicateOptions, checkNumericKey, findAnchorProblems, findConflicts, giveawayPct, isNumericLike, scoreOptions } from './checks.mjs';

/**
 * Проверяет черновик задания.
 * @param {object} draft — объект формы (см. TaskForm.tsx)
 * @returns {{ errors: string[], warnings: string[], bypassSnippet?: string }}
 */
export function checkDraft(draft) {
  const errors = [];
  const warnings = [];
  let bypassSnippet;

  // Общие поля
  if (!draft.bankFile) errors.push('Не выбран целевой банк');
  if (!draft.prompt || !String(draft.prompt).trim()) errors.push('Пустой вопрос');
  if (!draft.lesson || !String(draft.lesson).trim()) errors.push('Не выбран урок');
  if (!draft.topic || !String(draft.topic).trim()) errors.push('Пустая тема');
  if (!draft.subtopic || !String(draft.subtopic).trim()) errors.push('Пустая подтема');
  if (!draft.explanation || !String(draft.explanation).trim()) errors.push('Пустое объяснение (обязательное поле)');

  // points жёстко связаны со сложностью: basic=1, intermediate=2, advanced=3
  const expectedPoints = draft.difficulty === 'basic' ? 1 : draft.difficulty === 'intermediate' ? 2 : 3;
  if (draft.points !== expectedPoints) errors.push(`Баллы ${draft.points} не соответствуют сложности ${draft.difficulty} (ожидается ${expectedPoints})`);

  // Класс задания должен совпадать с классом выбранного банка
  if (draft.bankClass && draft.cls !== draft.bankClass) errors.push(`Класс задания (${draft.cls}) не совпадает с классом банка (${draft.bankClass})`);

  const type = draft.type;

  if (type === 'single_choice') {
    const options = draft.options ?? [];
    if (options.length < 2) errors.push('Нужно минимум 2 варианта');
    if (options.some((o) => !String(o.text ?? '').trim())) errors.push('Есть пустой вариант');

    // Дубли
    if (checkDuplicateOptions(options)) errors.push('Варианты повторяются');

    // Якорь
    const answerText = draft.answer_text || (options.find((o) => o.id === draft.answer)?.text ?? '');
    const task = {
      type: 'single_choice',
      student_view: { options },
      teacher_only: {
        answer: draft.answer,
        answer_text: answerText,
        explanation: draft.explanation ?? '',
        common_errors: String(draft.common_errors ?? '').split('\n').map((s) => s.trim()).filter(Boolean),
      },
    };
    const anchors = findAnchorProblems([task]);
    for (const a of anchors) errors.push(`Якорь ключа: ${a.reason}`);

    // Длина
    const m = giveawayPct(options, draft.answer);
    if (m && m.pct > 50 && !options.every((o) => isNumericLike(o.text))) {
      errors.push(`Верный вариант выдаёт себя длиной: +${m.margin} симв. (+${m.pct} %)`);
      bypassSnippet = JSON.stringify({ [draft.id || 'NEW']: 'причина' }, null, 2);
    }

    // Противоречие ключа и пояснения
    const conflicts = findConflicts([task]);
    if (conflicts.length > 0) {
      const c = conflicts[0];
      errors.push(`Ключ противоречит пояснению: ключ указывает на «${c.answerText}», а вес у варианта ${c.suggested} («${c.suggestedText}») больше`);
      bypassSnippet = JSON.stringify({ [draft.id || 'NEW']: 'причина' }, null, 2);
    }

    // Модель (ярус 3) — только предупреждение, не проверяем здесь
    warnings.push('Мнение модели по смыслу не проверено (ярус 3 — только при наличии сети)');
  }

  if (type === 'numeric_base') {
    const accepted = String(draft.accepted ?? '').split(',').map((s) => s.trim()).filter(Boolean).map(Number);
    if (accepted.length === 0 || accepted.some((n) => Number.isNaN(n))) errors.push('Неверные допустимые значения');
    if (!String(draft.answer_text ?? '').trim()) errors.push('Пустой ключ (answer_text)');
    const task = {
      type: 'numeric_base',
      student_view: { base: draft.base },
      teacher_only: {
        accepted_values_decimal: accepted,
        answer_text: draft.answer_text,
        explanation: draft.explanation ?? '',
      },
    };
    const nk = checkNumericKey(task);
    if (!nk.ok) errors.push(`Ключ не сходится с accepted_values_decimal: ${nk.reason}`);
    // placeholder опционален
    if (typeof draft.base !== 'number' || draft.base < 2) errors.push('Основание должно быть >= 2');
  }

  if (type === 'matching') {
    const left = (draft.left ?? []).map((s) => String(s).trim()).filter(Boolean);
    const right = (draft.right ?? []).map((s) => String(s).trim()).filter(Boolean);
    if (left.length < 1) errors.push('Пустая левая часть');
    if (right.length < 1) errors.push('Пустая правая часть');
    if (left.length !== right.length) errors.push('Левая и правая части разной длины');
    const map = draft.answer_map ?? {};
    for (const k of Object.keys(map)) {
      if (!left.includes(k)) errors.push(`Ключ «${k}» не из левой части`);
      if (!right.includes(map[k])) errors.push(`Значение «${map[k]}» не из правой части`);
    }
    const vals = Object.values(map);
    if (new Set(vals).size !== vals.length) errors.push('В answer_map повторяются значения');
  }

  if (type === 'code_run') {
    if (!String(draft.solution_code ?? '').trim()) errors.push('Пустой solution_code');
    if (!String(draft.expected_stdout ?? '').trim()) errors.push('Пустой expected_stdout');
    if (!String(draft.template ?? '').trim()) errors.push('Пустой template');
    // Ключ code_run проверить машиной нельзя — Pyodide тянется с CDN,
    // в офлайн-сборке его нет. Честно говорим об этом.
    warnings.push('Ключ code_run машиной не проверяется (нет офлайн-рантайма)');
  }

  return { errors, warnings, bypassSnippet };
}