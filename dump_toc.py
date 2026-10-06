from pypdf import PdfReader
import glob, os, re
os.makedirs('tmp_toc', exist_ok=True)
files = sorted(glob.glob('material/Bosova_demo/*ogl.pdf'))
for p in files:
    r = PdfReader(p)
    name = os.path.splitext(os.path.basename(p))[0]
    text = []
    for i, pg in enumerate(r.pages):
        t = pg.extract_text() or ''
        text.append(f'--- pdf_p{i+1} ---\n' + t)
    open(f'tmp_toc/{name}.txt', 'w', encoding='utf-8').write('\n'.join(text))
    print('saved', name, 'pages=', len(r.pages))
# also full-book page counts
for p in sorted(glob.glob('material/uchebniki/*.pdf')):
    r = PdfReader(p)
    print(os.path.basename(p), 'full_pages=', len(r.pages))
print('done')
