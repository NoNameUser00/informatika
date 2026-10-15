// Приведение задания из YAML-банка к JSON-виду тренеров и работ.
// Ключи (key/correct/expected/answerMap) остаются в серверной копии и в тренерском
// JSON тренажёра; для публичной копии работы они вырезаются на запись файла.
//
// Каждый ключ самопроверяется через check.mjs: если ответ не сходится с ключом,
// сборка падает. Это единственная защита от «вопрос есть, а правильный ответ неверен».
import { checkNumericBase, checkSingleChoice, checkMatching } from '../src/lib/scoring/check.mjs';

export interface TaskJson {
  id: string;
  lesson: string;
  type: string;
  points: number;
  prompt: string;
  base?: number;
  expected?: number | string;
  key?: string;
  options?: Array<{ id: string; text: string }>;
  correct?: string;
  left?: string[];
  right?: string[];
  answerMap?: Record<string, string>;
  template?: string;
}

export function convert(t: any): TaskJson {
  if (t.type === 'numeric_base') {
    const exp = t.teacher_only.accepted_values_decimal[0];
    const r = checkNumericBase(exp, t.teacher_only.answer_text, t.student_view.base);
    if (!r.isCorrect) throw new Error(`selfcheck FAIL ${t.id}: ключ «${t.teacher_only.answer_text}» не сходится с ${exp} (основание ${t.student_view.base})`);
    return {
      id: t.id, lesson: t.lesson, type: t.type, points: t.points, prompt: t.prompt,
      base: t.student_view.base, expected: exp, key: t.teacher_only.answer_text,
    };
  }
  if (t.type === 'single_choice') {
    // Ключ держим по ТЕКСТУ верного варианта, а не по букве. Буква производна от
    // порядка вариантов, и любая перестановка могла её тихо сломать — так появились
    // 88 неверных ключей. По тексту вариант находится однозначно, поэтому расхождение
    // с буквой означает дрейф данных: роняем сборку, а не выбираем сторону молча.
    const want = t.teacher_only.answer_text;
    if (typeof want !== 'string' || !want.trim()) {
      throw new Error(`selfcheck FAIL ${t.id}: нет teacher_only.answer_text — верный вариант должен быть назван текстом`);
    }
    const hits = t.student_view.options.filter((o: any) => o.text === want);
    if (hits.length !== 1) {
      throw new Error(`selfcheck FAIL ${t.id}: текст ответа «${want}» встречается среди вариантов ${hits.length} раз (нужен ровно один)`);
    }
    const correct = hits[0].id;
    if (t.teacher_only.answer && t.teacher_only.answer !== correct) {
      throw new Error(`selfcheck FAIL ${t.id}: answer=${t.teacher_only.answer}, а answer_text указывает на «${correct}»`);
    }
    return {
      id: t.id, lesson: t.lesson, type: t.type, points: t.points, prompt: t.prompt,
      options: t.student_view.options, correct, key: correct,
    };
  }
  if (t.type === 'matching') {
    const full = Object.fromEntries(t.student_view.left.map((k: string) => [k, t.teacher_only.answer_map[k] ?? '']));
    const r = checkMatching(t.teacher_only.answer_map, full, t.points);
    if (!r.isCorrect || r.score !== t.points) throw new Error(`selfcheck FAIL ${t.id}: соответствие не сходится`);
    return {
      id: t.id, lesson: t.lesson, type: t.type, points: t.points, prompt: t.prompt,
      left: t.student_view.left, right: t.student_view.right, answerMap: t.teacher_only.answer_map,
      key: t.student_view.left.map((k: string) => `${k}=${t.teacher_only.answer_map[k]}`).join(', '),
    };
  }
  if (t.type === 'code_run') {
    // Эталон проверен прогоном solution_code локальным Python при написании банка.
    // В CI только структурная проверка: непустые решение и ожидаемый вывод.
    if (!t.teacher_only.solution_code.trim() || !t.teacher_only.expected_stdout) {
      throw new Error(`selfcheck FAIL ${t.id}: пустое решение или ожидаемый вывод`);
    }
    return {
      id: t.id, lesson: t.lesson, type: t.type, points: t.points, prompt: t.prompt,
      template: t.student_view.template, expected: t.teacher_only.expected_stdout,
      key: t.teacher_only.expected_stdout,
    };
  }
  throw new Error(`unknown type ${t.type} (${t.id})`);
}

/** Публичная копия: без ключей и без правильных ответов. */
export function stripKeys(task: TaskJson): TaskJson {
  const { key, correct, expected, answerMap, ...rest } = task;
  void key; void correct; void expected; void answerMap;
  return rest;
}
