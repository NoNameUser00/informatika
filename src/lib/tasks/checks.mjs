// Чистые проверки ключа и вариантов ответа.
//
// Живут в src/lib, чтобы и браузерная форма, и node-скрипты, и тесты
// работали с одним и тем же кодом. Никаких импортов node:* и yaml — иначе
// модуль не соберётся в браузерный бандл (см. src/lib/scoring/check.mjs).
//
// Зависимости: только ./scoring/check.mjs (checkNumericBase — чистая,
// без зависимостей, уже работает в браузере тренажёра).
import { checkNumericBase } from '../scoring/check.mjs';

/** Нормализация текста для сравнения: ё→е, строчные, только буквы/цифры/пробел. */
export function normText(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"']/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Числа из текста: ими пояснение называет конкретный вариант-число. */
export function numbersIn(s) {
  return new Set((String(s ?? '').match(/-?\d+(?:\.\d+)?/g) ?? []).map((x) => x.replace(',', '.')));
}

/** Длина видимого ученику текста: схлопнутые пробелы и обрезанные края. */
export function len(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().length;
}

/** То же, что len, но возвращает строку. */
export function flat(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Вариант — просто число?
 * «В варианте есть цифра и нет букв». Важно: буквы ВСЕХ алфавитов.
 * Прежняя запись /^[\W\d]*\d[\W\d]*$/ считала кириллицу «не-словом» и
 * молча выпадала из ведомости (см. scripts/distractor-length.mjs).
 */
export function isNumericLike(s) {
  const t = String(s ?? '').trim();
  return /\d/.test(t) && !/\p{L}/u.test(t);
}

/**
 * Вес свидетельства в пользу варианта:
 *  +3 — текст варианта прямо назван в пояснении;
 *  +3 — вариант короткий и числовой, и его значение названо в пояснении;
 *  -4 — вариант назван в common_errors, то есть это отвергнутая ошибка.
 */
export function scoreOptions(task) {
  const options = task?.student_view?.options ?? [];
  const answer = task?.teacher_only?.answer;
  const expl = String(task?.teacher_only?.explanation ?? '');
  const common = task?.teacher_only?.common_errors ?? [];
  const commonList = Array.isArray(common) ? common : common ? [common] : [];

  const eText = normText(expl);
  const eNums = numbersIn(expl);
  const hasAssignment = /=\s*-?\d/.test(expl);
  const cTexts = commonList.map(normText);

  const score = {};
  for (const o of options) {
    const tText = normText(o.text);
    let s = 0;
    // Числовое правило намеренно узкое. Иначе ловятся операнды, а не ответы:
    // в «Поглощение: при A=1 всегда 1, при A=0 всегда 0» детектор считал бы
    // ответом «0», хотя это значение операнда. Поэтому число засчитывается,
    // только если вариант короткий, содержит ровно одно число и в пояснении НЕТ
    // присваиваний вида «A = 1» (тогда числа в пояснении — операнды).
    if (tText.length >= 2 && eText.includes(tText)) s += 3;

    const words = tText.split(/\s+/).filter(Boolean);
    const tNums = numbersIn(o.text);
    if (!hasAssignment && words.length <= 5 && tNums.size === 1) {
      if (eNums.has([...tNums][0])) s += 3;
    }

    if (tText && cTexts.some((c) => c.includes(tText))) s -= 4;
    score[o.id] = s;
  }
  return { score, answer, options };
}

/** Конфликт: другой вариант выигрывает у ключа с отрывом. */
export function findConflicts(tasks) {
  const out = [];
  for (const t of tasks) {
    if (t?.type !== 'single_choice') continue;
    const { score, answer, options } = scoreOptions(t);
    if (!options.length || !(answer in score)) continue;
    const best = Object.keys(score).reduce((a, b) => (score[b] > score[a] ? b : a));
    if (score[best] >= 3 && score[best] > score[answer]) {
      out.push({
        id: t.id,
        file: t.__file,
        prompt: t.prompt,
        answer,
        answerText: options.find((o) => o.id === answer)?.text,
        suggested: best,
        suggestedText: options.find((o) => o.id === best)?.text,
        options: options.map((o) => ({ id: o.id, text: o.text })),
        explanation: t.teacher_only?.explanation ?? '',
        commonErrors: t.teacher_only?.common_errors ?? [],
        scoreAnswer: score[answer],
        scoreSuggested: score[best],
      });
    }
  }
  return out;
}

/**
 * Инвариант якоря ключа: teacher_only.answer_text обязан называть вариант,
 * на который указывает буква teacher_only.answer, — и ровно один.
 */
export function findAnchorProblems(tasks) {
  const out = [];
  for (const t of tasks) {
    if (t?.type !== 'single_choice') continue;
    const options = t.student_view?.options ?? [];
    const answer = t.teacher_only?.answer;
    const want = t.teacher_only?.answer_text;

    if (typeof want !== 'string' || !want.trim()) {
      out.push({ id: t.id, reason: 'нет answer_text', answer, answerText: want });
      continue;
    }
    const hits = options.filter((o) => o.text === want).map((o) => o.id);
    if (hits.length !== 1) {
      out.push({
        id: t.id,
        reason: `текст ответа встречается среди вариантов ${hits.length} раз(а)`,
        answer,
        answerText: want,
      });
      continue;
    }
    if (answer && hits[0] !== answer) {
      out.push({
        id: t.id,
        reason: `answer=${answer}, а answer_text указывает на ${hits[0]}`,
        answer,
        answerText: want,
      });
    }
  }
  return out;
}

/**
 * Запас длины в процентах для одного задания.
 * Возвращает { pct, margin, mine, second } либо null, если мерить нечего.
 */
export function giveawayPct(options, answer) {
  const opt = (options ?? []).find((o) => String(o.id) === String(answer));
  if (!opt) return null;
  const others = (options ?? []).filter((o) => String(o.id) !== String(opt.id));
  if (!others.length) return null;
  const second = Math.max(...others.map((o) => len(o.text)));
  const mine = len(opt.text);
  return {
    pct: second ? Math.round(((mine - second) / second) * 100) : 999,
    margin: mine - second,
    mine,
    second,
  };
}

/** Дубли вариантов: тексты не должны повторяться. */
export function checkDuplicateOptions(options) {
  const texts = (options ?? []).map((o) => String(o?.text ?? ''));
  return new Set(texts).size !== texts.length;
}

/** Проверка ключа numeric_base: answer_text должен сходиться с accepted_values_decimal. */
export function checkNumericKey(task) {
  const too = task?.teacher_only ?? {};
  const accepted = too.accepted_values_decimal ?? [];
  const base = task?.student_view?.base;
  const want = too.answer_text;
  if (accepted.length === 0) return { ok: false, reason: 'нет accepted_values_decimal' };
  if (typeof base !== 'number') return { ok: false, reason: 'нет основания' };
  const ok = accepted.some((v) => checkNumericBase(v, want, base)?.isCorrect === true);
  return { ok, reason: ok ? '' : 'несовпадение' };
}