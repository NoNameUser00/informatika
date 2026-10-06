from pypdf import PdfReader
import os
os.makedirs('tmp_verify8', exist_ok=True)
checks = {
 'material/uchebniki/split/8/01a-p1.1-obschie-svedeniya.pdf': 0,
 'material/uchebniki/split/8/01b-p1.2-dvoichnaya.pdf': 0,
 'material/uchebniki/split/8/01c-p1.3-rodstvennye-dvoichnoy.pdf': 0,
 'material/uchebniki/split/8/01d-p1.4-predstavlenie-v-kompyutere.pdf': 0,
 'material/uchebniki/split/8/02-gl2-matalogika.pdf': 0,
 'material/uchebniki/split/8/03-gl3-algoritmizatsiya.pdf': 0,
}
for path, idx in checks.items():
    r = PdfReader(path)
    imgs = list(r.pages[idx].images)
    tag = os.path.basename(path).replace('.pdf', '')
    if imgs:
        with open(f'tmp_verify8/{tag}.jpg', 'wb') as f:
            f.write(imgs[0].data)
        print('saved', tag)
    else:
        print('NO IMAGE', tag)
print('done')
