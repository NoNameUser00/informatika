// Чистые функции проверки. Без зависимостей. Сервер + тренажер используют один код.
const CYR_TO_LAT = { 'А': 'A', 'В': 'B', 'С': 'C', 'Д': 'D', 'Е': 'E', 'Ф': 'F', 'Ё': 'E', 'а': 'a', 'в': 'b', 'с': 'c', 'д': 'd', 'е': 'e', 'ф': 'f', 'ё': 'e' };
// Подстрочные цифры (как пишут основание в школе: 10110₂) -> обычные
const SUB_TO_DIG = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };

export function normalizeBaseString(s) {
  if (typeof s !== 'string') return '';
  let t = s.trim().replace(/\s+/g, '');
  // Подстрочный суффикс основания (₂ ₈ ₁₀ ₁₆) — срезать целиком ДО мэппинга:
  // '1101₂' -> '1101'. Голые цифры конца ('111010') НЕ трогаем — там суффикс неоднозначен.
  t = t.replace(/[₀₁₂₃₄₅₆₇₈₉]+$/, '');
  t = t.split('').map((ch) => SUB_TO_DIG[ch] ?? CYR_TO_LAT[ch] ?? ch).join('');
  t = t.toUpperCase();
  // срезать префиксы 0b/0o/0x
  t = t.replace(/^0(B|O|X)/, '');
  // срезать ТОЛЬКО явные суффиксы: _2 _8 _10 _16 или (2) (8) (10) (16).
  // Голые trailing-цифры НЕ трогаем: '111010' (двоичное) нельзя резать до '1110'.
  const suf = t.match(/^(.*?)(?:_(2|8|10|16)|\((2|8|10|16)\))$/);
  if (suf) t = suf[1];
  // разделители внутри числа (пробелы уже убраны, подчеркивания — убрать)
  t = t.replace(/_/g, '');
  return t;
}

const ALPHABET = '0123456789ABCDEF';

export function parseInBase(input, base) {
  const t = normalizeBaseString(input);
  if (!t) return NaN;
  const valid = ALPHABET.slice(0, base);
  for (const ch of t) if (!valid.includes(ch)) return NaN;
  let v = 0;
  for (const ch of t) v = v * base + valid.indexOf(ch);
  return v;
}

export function checkNumericBase(expectedDecimal, studentInput, base) {
  const v = parseInBase(studentInput, base);
  const ok = Number.isInteger(expectedDecimal) && v === expectedDecimal;
  return { score: ok ? 1 : 0, maxScore: 1, isCorrect: ok, value: v };
}

export function checkSingleChoice(correctId, selectedId) {
  const n = (x) => String(x ?? '').trim().toUpperCase();
  const ok = n(correctId) !== '' && n(correctId) === n(selectedId);
  return { score: ok ? 1 : 0, maxScore: 1, isCorrect: ok };
}

export function checkMatching(expectedMap, studentMap, points = 1) {
  const keys = Object.keys(expectedMap);
  if (keys.length === 0) return { score: 0, maxScore: points, isCorrect: false };
  let hit = 0;
  for (const k of keys) {
    const e = String(expectedMap[k] ?? '').trim();
    const s = String(studentMap?.[k] ?? '').trim();
    if (e === s) hit++;
  }
  const score = Math.round((hit / keys.length) * points * 100) / 100;
  return { score, maxScore: points, isCorrect: hit === keys.length, matched: hit, total: keys.length };
}

export function percentToMark(percent, t = { five: 90, four: 75, three: 50 }) {
  if (percent >= t.five) return 5;
  if (percent >= t.four) return 4;
  if (percent >= t.three) return 3;
  return 2;
}
