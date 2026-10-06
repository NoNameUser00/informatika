import glob, re
SUB = str.maketrans('0123456789', '₀₁₂₃₄₅₆₇₈₉')
pat = re.compile(r'([0-9A-F]+)_(\d{1,2})')
for p in sorted(glob.glob('src/content/lessons/8/*.md')):
    t = open(p, encoding='utf-8').read()
    n = len(pat.findall(t))
    t = pat.sub(lambda m: m.group(1) + m.group(2).translate(SUB), t)
    open(p, 'w', encoding='utf-8').write(t)
    print(f'{p}: замен {n}')
print('done')
