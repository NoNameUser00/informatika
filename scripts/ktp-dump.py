#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Канонический разбор КТП -> src/data/ktp.ts (единый источник правды по урокам).
# Запуск: python3 scripts/ktp-dump.py
# Правила разбора (material/ktp/*.xlsx, Лист1):
#   столбец 1 — раздел (тема блока), заполнен без соседних B/C
#   столбец 2 — "урок N"
#   столбец 3 — тема урока
#   столбец 4 — дидактические единицы (строки ПОД каждой темой, идут ниже строки темы)
import io
import os
import re
import sys

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'material', 'ktp')
OUT = os.path.join(ROOT, 'src', 'data', 'ktp.ts')


def norm(s: str) -> str:
    return re.sub(r'\s+', ' ', str(s)).strip()


def parse():
    grades = {}
    for name in sorted(os.listdir(SRC)):
        if not name.endswith('.xlsx'):
            continue
        m = re.search(r'-(\d+)\.xlsx', name)
        if not m:
            continue
        grade = m.group(1)
        wb = openpyxl.load_workbook(os.path.join(SRC, name), data_only=True)
        ws = wb.worksheets[0]
        lessons, section, current = [], '', None
        for r in range(1, ws.max_row + 1):
            a = ws.cell(row=r, column=1).value
            b = ws.cell(row=r, column=2).value
            c = ws.cell(row=r, column=3).value
            bs = norm(b) if b is not None else ''
            cs = norm(c) if c is not None else ''
            if a and not b and not c:
                section = norm(a)
            mm = re.match(r'^урок\s+(\d+)$', bs, re.I)
            if mm:
                if current:
                    current['units'] = []
                current = {'n': int(mm.group(1)), 'section': section, 'topic': cs, 'units': []}
                lessons.append(current)
            elif current is not None and c and not b:
                current['units'].append(cs)
        if current:
            current['units'] = []
        # добираем ПОД: строки ниже темы читаем в отдельном проходе
        grades[grade] = {'lessons': lessons, 'file': name}
    return grades


def parse_units(grades):
    """Второй проход: дидактические единицы лежат в столбце 4 отдельными строками."""
    for grade, data in grades.items():
        wb = openpyxl.load_workbook(os.path.join(SRC, data['file']), data_only=True)
        ws = wb.worksheets[0]
        idx_by_row = {}
        for r in range(1, ws.max_row + 1):
            b = ws.cell(row=r, column=2).value
            mm = re.match(r'^урок\s+(\d+)$', norm(b) if b is not None else '', re.I)
            if mm:
                idx_by_row[r] = int(mm.group(1))
        by_n = {l['n']: l for l in data['lessons']}
        lesson_rows = sorted(idx_by_row)
        for pos, r in enumerate(lesson_rows):
            end = lesson_rows[pos + 1] - 1 if pos + 1 < len(lesson_rows) else ws.max_row
            units = []
            for rr in range(r + 1, end + 1):
                d = ws.cell(row=rr, column=4).value
                if d and not ws.cell(row=rr, column=2).value:
                    dv = norm(d)
                    if dv and dv not in units:
                        units.append(dv)
            by_n[idx_by_row[r]]['units'] = units


def js(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def main():
    grades = parse()
    parse_units(grades)
    buf = io.StringIO()
    buf.write('// СГЕНЕРИРОВАНО scripts/ktp-dump.py из material/ktp/*.xlsx — не править руками.\n')
    buf.write('// Единый источник правды по нумерации уроков: 36 уроков в каждом классе (7-11).\n')
    buf.write('export interface KtpLesson {\n')
    buf.write('  /** Номер урока в КТП, 1..36. */\n')
    buf.write('  n: number;\n')
    buf.write('  /** Раздел (тема блока) из столбца 1 КТП. */\n')
    buf.write('  section: string;\n')
    buf.write('  /** Тема урока из столбца 3 КТП. */\n')
    buf.write('  topic: string;\n')
    buf.write('  /** Дидактические единицы (столбец 4): строки ПОД под этой темой. */\n')
    buf.write('  units: string[];\n')
    buf.write('}\n\n')
    buf.write('export const KTP: Record<string, KtpLesson[]> = {\n')
    total = 0
    for grade in sorted(grades, key=int):
        ls = grades[grade]['lessons']
        total += len(ls)
        buf.write('  %s: [\n' % js(grade))
        for l in ls:
            buf.write('    { n: %d, section: %s, topic: %s, units: [%s] },\n' % (
                l['n'], js(l['section']), js(l['topic']),
                ', '.join(js(u) for u in l['units']),
            ))
        buf.write('  ],\n')
    buf.write('};\n\n')
    buf.write('export const KTP_GRADES: string[] = %s;\n' % (
        str([g for g in sorted(grades, key=int)]).replace("'", '"')))
    buf.write('export const KTP_LESSON_COUNT = %d;\n' % total)
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(buf.getvalue())
    print('KTP OK: %d уроков (%s) -> src/data/ktp.ts' % (
        total, ', '.join('%s=%d' % (g, len(grades[g]['lessons'])) for g in sorted(grades, key=int))))


if __name__ == '__main__':
    main()
