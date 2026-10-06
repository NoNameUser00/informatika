from pypdf import PdfReader
import os
os.makedirs('tmp_u8', exist_ok=True)
r = PdfReader('material/uchebniki/Informatika_8_klass_Bosova_uchebnik.pdf')
for i in [0, 7, 8, 9, 10, 11]:
    pg = r.pages[i]
    imgs = list(pg.images)
    print(f'pdf_page {i+1}: images={len(imgs)}')
    for j, im in enumerate(imgs):
        ext = 'jpg' if 'DCT' in str(im.indirect_reference.get_object().get('/Filter', '')) else 'png'
        path = f'tmp_u8/u8_p{i+1}_{j}.{ext}'
        with open(path, 'wb') as f:
            f.write(im.data)
        print(' saved', path, len(im.data))
print('done')
