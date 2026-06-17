import os, re

NAV = '''<ul class="nav-links">
  <li><a href="../mechanics.html">Mechanics</a></li>
  <li><a href="../matchup.html">Matchup</a></li>
  <li><a href="../synergies.html">Synergies</a></li>
  <li><a href="../build.html#build">Build Guide</a></li>
  <li><a href="../build.html#runes">Runes</a></li>
  <li><a href="../build.html#calculator">Calculator</a></li>
  <li><a href="../build.html#forge">Forge</a></li>
</ul>'''

n = 0
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in {'.git','node_modules','.cache'}]
    for f in files:
        if not f.endswith('.html'): continue
        p = os.path.join(root, f)
        c = open(p, encoding='utf-8', errors='replace').read()
        if 'nav-links' not in c: continue
        new = re.sub(r'<ul class="nav-links">.*?</ul>', NAV, c, flags=re.DOTALL)
        if new != c:
            open(p, 'w', encoding='utf-8').write(new)
            n += 1
            print(f'  ✓ {p}')

print(f'\n✅ {n} fichiers mis à jour')