from pypdf import PdfReader, PdfWriter
import os
# PDF index (0-based) == номер книжной страницы для контентных страниц (проверено: pdf61->кн.60, pdf127->кн.126)
SRC = 'material/uchebniki/Informatika_8_klass_Bosova_uchebnik.pdf'
DST = 'material/uchebniki/split/8'
os.makedirs(DST, exist_ok=True)
r = PdfReader(SRC)
N = len(r.pages)
print('total', N)

def save(name, book_from, book_to):
    w = PdfWriter()
    # book page B lives at pdf index B (0-based) for B>=3; clamp
    a = max(0, book_from)
    b = min(N - 1, book_to)
    for i in range(a, b + 1):
        w.add_page(r.pages[i])
    path = f'{DST}/{name}.pdf'
    with open(path, 'wb') as f:
        w.write(f)
    print(f'{name}: book {book_from}-{book_to} -> pdf_idx {a}-{b}, pages={b-a+1} -> {path}')

# Главы (книжные страницы из оглавления pdf271-272)
save('00-vvedenie', 3, 4)
save('01-gl1-sistemy-schisleniya', 5, 38)
save('01a-p1.1-obschie-svedeniya', 5, 13)
save('01b-p1.2-dvoichnaya', 14, 21)
save('01c-p1.3-rodstvennye-dvoichnoy', 22, 29)
save('01d-p1.4-predstavlenie-v-kompyutere', 30, 35)
save('01e-testy-samokontrol-gl1', 36, 38)
save('02-gl2-matalogika', 39, 72)
save('03-gl3-algoritmizatsiya', 73, 145)
save('04-gl4-pascal', 146, 201)
save('05-gl5-python', 202, 259)
save('06-klyuchi-otvety-prilozheniya', 260, 272)
print('done')
