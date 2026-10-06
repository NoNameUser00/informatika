from pypdf import PdfReader
import os
os.makedirs('tmp_verify_all', exist_ok=True)
lines = []
# сканы: первая страница картинкой
for path in ['material/uchebniki/split/7/01-gl1-informatsiya-protsessy.pdf',
              'material/uchebniki/split/9/01-gl1-algoritmy-programmirovanie.pdf',
              'material/uchebniki/split/7/02-gl2-kompyuter.pdf',
              'material/uchebniki/split/9/02-gl2-modelirovanie.pdf']:
    r = PdfReader(path)
    imgs = list(r.pages[0].images)
    tag = path.split('/')[-2] + '_' + os.path.basename(path).replace('.pdf', '')
    if imgs:
        with open(f'tmp_verify_all/{tag}.jpg', 'wb') as f:
            f.write(imgs[0].data)
        lines.append(f'{tag}: pages={len(r.pages)} img_saved')
    else:
        lines.append(f'{tag}: pages={len(r.pages)} NO_IMAGE text={(r.pages[0].extract_text() or "")[:60]}')
# текстовые 10/11
for path in ['material/uchebniki/split/10/01-gl1-informatsiya-protsessy.pdf',
              'material/uchebniki/split/11/01-gl1-tablitsy.pdf']:
    r = PdfReader(path)
    t = (r.pages[0].extract_text() or '')[:120].replace('\n', '|')
    lines.append(f'{path}: pages={len(r.pages)} head={t[:100]}')
open('tmp_verify_all/report.txt', 'w', encoding='utf-8').write('\n'.join(lines))
print('saved')
