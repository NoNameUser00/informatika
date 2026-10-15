// Сравнение вывода программы ученика с эталоном для PyRunner.
//
// Нормализация: CRLF -> LF, trailing-пробелы в строках, пустые строки в конце.
//
// Числа сравниваются ПО ЗНАЧЕНИЮ, а не по записи. Причина: в Python деление
// всегда даёт float, поэтому программа `print(20 / 4, len(a))` печатает «5.0 4»,
// а эталон в банке записан как «5 4». Посимвольное сравнение зачло бы верное
// решение как ошибку — ученик не виноват, что в задаче ничего не сказано про
// целочисленное деление. Сравнение идёт по токенам, и только если ОБЕ стороны
// разбираются как числа, сравниваются числа; иначе — как раньше, посимвольно.
//
// Чего сравнение НЕ делает (намеренно):
//  * не оценивает выражения — «0.1+0.2» не приравнивается к «0.3»;
//  * не трогает нечисловые токены — «0b1101» и «1101» остаются разными,
//    иначе задачи на системы счисления потеряют смысл;
//  * не прощает пропуск или перестановку токенов.

/** Приводит целое/дробное к строке-числу, иначе null. */
function asNumber(token) {
  const t = token.trim();
  if (!t) return null;
  // только обычная десятичная запись: знак, цифры, точка, экспонента
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

function normalizeOutput(s) {
  return String(s ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');
}

/** Одна строка: токены сравниваются попарно, число — по значению. */
function lineEquals(a, b) {
  const ta = a.split(/\s+/).filter((x) => x !== '');
  const tb = b.split(/\s+/).filter((x) => x !== '');
  if (ta.length !== tb.length) return false;
  for (let i = 0; i < ta.length; i++) {
    if (ta[i] === tb[i]) continue;
    const na = asNumber(ta[i]);
    const nb = asNumber(tb[i]);
    // разные записи одного и того же числа засчитываем как совпадение
    if (na !== null && nb !== null && na === nb) continue;
    return false;
  }
  return true;
}

export function compareOutput(actual, expected) {
  const a = normalizeOutput(actual);
  const b = normalizeOutput(expected);
  if (a === b) return true;
  const la = a.split('\n');
  const lb = b.split('\n');
  if (la.length !== lb.length) return false;
  for (let i = 0; i < la.length; i++) {
    if (!lineEquals(la[i], lb[i])) return false;
  }
  return true;
}