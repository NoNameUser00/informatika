"""Каноническое извлечение текста из PDF — только локально, без hosted API.

Проверяет текстовый слой (pdfplumber) и печатает статистику + текст.
Сканы без слоя в текст не превращает: сообщает об этом и выходит с кодом 2
(такие читаются глазами постранично, см. AGENTS.md).

Использование:
  python3 scripts/pdf-text.py <файл.pdf> [--pages 1-3] [--out out.txt]

Коды выхода: 0 — текст извлечён, 1 — ошибка аргументов/файла, 2 — нет слоя.
"""

import argparse
import sys


def parse_pages(spec, total):
    if not spec:
        return list(range(total))
    out = []
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-", 1)
            a = int(a) - 1
            b = int(b)  # включительно -> range end
        else:
            a = int(part) - 1
            b = a + 1
        for i in range(max(a, 0), min(b, total)):
            if i not in out:
                out.append(i)
    return sorted(out)


def main():
    ap = argparse.ArgumentParser(description="Локальное извлечение текста из PDF")
    ap.add_argument("pdf", help="Путь к PDF-файлу")
    ap.add_argument("--pages", default="", help="Диапазон страниц 1-based, напр. 1-3 или 1,5-7")
    ap.add_argument("--out", default="", help="Куда сохранить текст (иначе stdout)")
    args = ap.parse_args()

    try:
        import pdfplumber
    except ImportError:
        print("Нет pdfplumber: установите (pip install pdfplumber) и повторите", file=sys.stderr)
        return 1

    try:
        pdf = pdfplumber.open(args.pdf)
    except Exception as e:
        print(f"Не открыть файл: {e}", file=sys.stderr)
        return 1

    try:
        total = len(pdf.pages)
    except Exception as e:
        print(f"Не прочитать страницы: {e}", file=sys.stderr)
        return 1

    try:
        idx = parse_pages(args.pages, total)
    except ValueError:
        print("Формат --pages: 1-3 или 1,5-7 (номера с 1)", file=sys.stderr)
        return 1

    chars = sum(len((pdf.pages[i].extract_text() or "")) for i in range(total))
    print(f"Страниц: {total}, символов текстового слоя всего: {chars}")
    if chars == 0:
        print("Текстового слоя нет (скан). В текст не превращаю: читайте постранично глазами.", file=sys.stderr)
        return 2

    chunks = []
    for i in idx:
        t = pdf.pages[i].extract_text() or ""
        chunks.append(f"--- стр. {i + 1} ---\n{t}")
    text = "\n".join(chunks) + "\n"
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"Сохранено: {args.out} ({len(text)} символов)")
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
