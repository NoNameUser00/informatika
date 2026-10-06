from pypdf import PdfReader
r = PdfReader('material/uchebniki/Informatika_8_klass_Bosova_uchebnik.pdf')
print('total', len(r.pages))
import os
os.makedirs('tmp_u8', exist_ok=True)
for i in [3, 4, 5, 6, 60, 61, 126, 127, 270, 271, 272]:
    if i < len(r.pages):
        pg = r.pages[i]
        imgs = list(pg.images)
        print(f'pdf_p{i+1}: images={len(imgs)}')
        for j, im in enumerate(imgs[:1]):
            path = f'tmp_u8/u8_p{i+1}_{j}.jpg'
            with open(path, 'wb') as f:
                f.write(im.data)
            print(' saved', path)
print('done')
