from pypdf import PdfReader, PdfWriter
import os

def split(src, dst_dir, parts, mode):
    """mode: 'scan' pdf_idx=book (0-based); 'text' pdf_idx=book-1"""
    os.makedirs(dst_dir, exist_ok=True)
    r = PdfReader(src)
    n = len(r.pages)
    print('=', src, n)
    for name, bf, bt in parts:
        if mode == 'scan':
            a, b = max(0, bf), min(n - 1, bt)
        else:
            a, b = max(0, bf - 1), min(n - 1, bt - 1)
        w = PdfWriter()
        for i in range(a, b + 1):
            w.add_page(r.pages[i])
        path = f'{dst_dir}/{name}.pdf'
        with open(path, 'wb') as f:
            w.write(f)
        print(f'  {name}: book {bf}-{bt} -> idx {a}-{b} ({b-a+1}p)')

# 7 класс, скан (offset как у 8): pdf_idx = book
split('material/uchebniki/Informatika_7_klass_Bosova_uchebnik.pdf', 'material/uchebniki/split/7', [
 ('00-vvedenie-tb', 3, 6),
 ('01-gl1-informatsiya-protsessy', 7, 45),
 ('02-gl2-kompyuter', 46, 127),
 ('03-gl3-tekst', 128, 191),
 ('04-gl4-grafika', 192, 225),
 ('05-gl5-multimedia', 226, 242),
 ('06-klyuchi-otvety-prilozhenie', 243, 254),
], 'scan')

# 9 класс, скан
split('material/uchebniki/Informatika_9_klass_Bosova_uchebnik.pdf', 'material/uchebniki/split/9', [
 ('00-vvedenie', 3, 4),
 ('01-gl1-algoritmy-programmirovanie', 5, 81),
 ('02-gl2-modelirovanie', 82, 151),
 ('03-gl3-tablitsy', 152, 205),
 ('04-gl4-ikt-obschestvo', 206, 265),
 ('05-klyuchi-otvety', 266, 272),
], 'scan')

# 10 класс, текст: pdf = book
split('material/uchebniki/Informatika_10_klass_Bosova_uchebnik.pdf', 'material/uchebniki/split/10', [
 ('01-gl1-informatsiya-protsessy', 5, 61),
 ('02-gl2-kompyuter', 62, 98),
 ('03-gl3-sozdanie-obrabotka', 99, 165),
 ('04-gl4-teoriya-mnozhestv-logika', 166, 231),
 ('05-gl5-sovremennye-tekhnologii', 232, 275),
], 'text')

# 11 класс, текст
split('material/uchebniki/Informatika_11_klass_Bosova_uchebnik.pdf', 'material/uchebniki/split/11', [
 ('01-gl1-tablitsy', 5, 62),
 ('02-gl2-bazy-dannyh', 63, 131),
 ('03-gl3-modelirovanie', 132, 192),
 ('04-gl4-seti', 193, 227),
 ('05-gl5-it-obschestvo', 228, 250),
], 'text')
print('done')
