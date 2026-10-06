from pypdf import PdfReader
lines = []
for book in ['material/uchebniki/Informatika_10_klass_Bosova_uchebnik.pdf', 'material/uchebniki/Informatika_11_klass_Bosova_uchebnik.pdf']:
    r = PdfReader(book)
    lines.append('=' * 20 + ' ' + book)
    for i in range(len(r.pages)):
        t = r.pages[i].extract_text() or ''
        if 'главление' in t.lower() or 'оглавление' in t.lower():
            lines.append(f'--- pdf{i+1} ---')
            lines.append(t[:3000])
open('toc_10_11.txt', 'w', encoding='utf-8').write('\n'.join(lines))
print('saved')
