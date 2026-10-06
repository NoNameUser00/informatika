from pypdf import PdfReader
import pdfplumber, os

files = [
 'material/Bosova_demo/bosova-8-ogl.pdf',
 'material/Bosova_demo/bosova-8-gl2.pdf',
 'material/uchebniki/Informatika_8_klass_Bosova_uchebnik.pdf',
]
out = []
for p in files:
    out.append('=' * 20 + ' ' + os.path.basename(p))
    try:
        r = PdfReader(p)
        out.append(f'pypdf pages: {len(r.pages)}')
        for i in [0, 1, 5]:
            if i < len(r.pages):
                pg = r.pages[i]
                t = pg.extract_text() or ''
                head = t[:80].replace('\n', '|')
                out.append(f'  pypdf p{i+1}: text_len={len(t)} images={len(pg.images)} head={head}')
    except Exception as e:
        out.append(f'  pypdf ERR {str(e)[:150]}')
    try:
        pdf = pdfplumber.open(p)
        out.append(f'plumber pages: {len(pdf.pages)}')
        for i in [0, 1, 5]:
            if i < len(pdf.pages):
                t = pdf.pages[i].extract_text() or ''
                head = t[:80].replace('\n', '|')
                out.append(f'  plumber p{i+1}: text_len={len(t)} head={head}')
        pdf.close()
    except Exception as e:
        out.append(f'  plumber ERR {str(e)[:150]}')

open('parse_compare.txt', 'w', encoding='utf-8').write('\n'.join(out))
print('saved parse_compare.txt')
