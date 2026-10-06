from pypdf import PdfReader
import os
os.makedirs('tmp_toc_full', exist_ok=True)
books = {
 'Informatika_7_klass_Bosova_uchebnik.pdf': [0, 1, 2, 250, 251, 252, 253, 254, 255, 256],
 'Informatika_8_klass_Bosova_uchebnik.pdf': [0, 1, 2, 266, 267, 268, 269, 270, 271, 272],
 'Informatika_9_klass_Bosova_uchebnik.pdf': [0, 1, 2, 266, 267, 268, 269, 270, 271, 272],
 'Informatika_10_klass_Bosova_uchebnik.pdf': [0, 1, 2, 281, 282, 283, 284, 285, 286, 287],
 'Informatika_11_klass_Bosova_uchebnik.pdf': [0, 1, 2, 249, 250, 251, 252, 253, 254, 255],
}
for book, pages in books.items():
    r = PdfReader(f'material/uchebniki/{book}')
    print(book, 'total', len(r.pages))
    for i in pages:
        if i < len(r.pages):
            imgs = list(r.pages[i].images)
            if imgs:
                tag = book.split('_')[1]
                path = f'tmp_toc_full/{tag}_pdf{i+1}.jpg'
                with open(path, 'wb') as f:
                    f.write(imgs[0].data)
                print(' saved', path)
print('done')
