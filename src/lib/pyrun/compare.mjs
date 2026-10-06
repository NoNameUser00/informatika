// Сравнение вывода программы ученика с эталоном для PyRunner.
// Нормализация: CRLF -> LF, trailing-пробелы в строках, пустые строки в конце.

export function normalizeOutput(s) {
  return String(s ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');
}

export function compareOutput(actual, expected) {
  return normalizeOutput(actual) === normalizeOutput(expected);
}
