from pypdf import PdfReader
import glob
lines = []
for p in sorted(glob.glob('material/uchebniki/*.pdf')):
    r = PdfReader(p)
    n = len(r.pages)
    lines.append('=' * 10 + ' ' + p.split('\\')[-1] + f' {n}')
    for i in [0, 1, 2, n-6, n-5, n-4, n-3, n-2, n-1]:
        t = r.pages[i].extract_text() or ''
        head = ''.join(c if ord(c) < 128 else '?' for c in t[:60]).replace('\n', '|')
        lines.append(f'  pdf{i+1}: text={len(t)} img={len(r.pages[i].images)} head={head}')
lines.append('done')
open('probe_all.txt', 'w', encoding='utf-8').write('\n'.join(lines))
