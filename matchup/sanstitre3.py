import os, re

# 1. Ajouter patch-history.js a toutes les pages matchup
n = 0
for f in os.listdir('matchup'):
    if not f.endswith('.html'): continue
    p = os.path.join('matchup', f)
    c = open(p, encoding='utf-8', errors='replace').read()
    if 'patch-history.js' in c: continue
    new = c.replace('</body>', '<script src="../patch-history.js"></script></body>')
    if new != c:
        open(p, 'w', encoding='utf-8').write(new)
        n += 1
print(f'Patch script added: {n} files')

# 2. Corriger le parsing dans patch-history.js
js = open('patch-history.js', encoding='utf-8').read()

old = r"var vMatch = line.match(/^=+\s*(V[\d.S]+[a-z]?)\s*=+$/) ||" + "\n" + \
      r"                 line.match(/^(V[\d.S]+[a-z]?)\s*$/);"

new = r"var vMatch = line.match(/^=+\s*(V[\d.S.]+[a-z]?(?:\s*-[^=]*)?)\s*=+$/) ||" + "\n" + \
      r"                 line.match(/^(V[\d.S.]+[a-z]?)(?:\s*-|\s*$)/);"

if old in js:
    js = js.replace(old, new, 1)
    print('Parser regex fixed')
else:
    # Remplacement plus large si le format exact differe
    js = re.sub(
        r'var vMatch = line\.match\(/\^=\+.*?\$\/\)[^;]+;',
        r'var vMatch = line.match(/^=+\\s*(V[\\d.S]+[a-z]?(?:\\s*-[^=]*)?)\\s*=+$/) ||\n                 line.match(/^(V[\\d.S]+[a-z]?)(?:\\s*-|\\s*$)/);',
        js, flags=re.DOTALL
    )
    print('Parser regex replaced (fallback)')

open('patch-history.js', 'w', encoding='utf-8').write(js)
print('Done')