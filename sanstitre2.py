import os, re

# ── NAV CORRECTES ────────────────────────────────────────────────────
NAV_ROOT = '''<ul class="nav-links">
      <li><a href="mechanics.html">Mechanics</a></li>
      <li><a href="matchup.html">Matchup</a></li>
      <li><a href="synergies.html">Synergies</a></li>
      <li><a href="build.html#build">Build Guide</a></li>
      <li><a href="build.html#runes">Runes</a></li>
      <li><a href="build.html#calculator">Calculator</a></li>
      <li><a href="build.html#forge">Forge</a></li>
    </ul>'''

NAV_SUB = '''<ul class="nav-links">
      <li><a href="../mechanics.html">Mechanics</a></li>
      <li><a href="../matchup.html">Matchup</a></li>
      <li><a href="../synergies.html">Synergies</a></li>
      <li><a href="../build.html#build">Build Guide</a></li>
      <li><a href="../build.html#runes">Runes</a></li>
      <li><a href="../build.html#calculator">Calculator</a></li>
      <li><a href="../build.html#forge">Forge</a></li>
    </ul>'''

def fix_encoding(text):
    # Corrige le double-encodage UTF-8 → Windows-1252 → UTF-8
    try:
        return text.encode('windows-1252', errors='replace').decode('utf-8', errors='replace')
    except:
        return text

nav_fixed = 0
enc_fixed = 0

for dirpath, dirnames, filenames in os.walk('.'):
    dirnames[:] = [d for d in dirnames if d not in {'.git', 'node_modules', '.cache'}]
    for f in filenames:
        if not f.endswith('.html'):
            continue
        p = os.path.join(dirpath, f)

        # Lire le fichier
        try:
            raw = open(p, encoding='utf-8', errors='replace').read()
        except:
            continue

        if 'nav-links' not in raw:
            continue

        # 1. Fixer l'encodage si corrompu (â€" = signe de corruption)
        if 'â€' in raw or 'â†' in raw or 'Ã' in raw:
            raw = fix_encoding(raw)
            enc_fixed += 1

        # 2. Appliquer la bonne nav selon profondeur
        # depth = nombre de séparateurs dans le chemin relatif
        rel = os.path.relpath(p, '.')
        depth = rel.count(os.sep)
        nav = NAV_ROOT if depth == 0 else NAV_SUB

        new = re.sub(r'<ul class="nav-links">.*?</ul>', nav, raw, flags=re.DOTALL)

        if new != raw:
            open(p, 'w', encoding='utf-8').write(new)
            nav_fixed += 1
            print(f'  ✓ {p}')
        elif raw != open(p, encoding='utf-8', errors='replace').read():
            # Encodage fixé mais pas la nav
            open(p, 'w', encoding='utf-8').write(raw)

print(f'\n✅ Nav fixée : {nav_fixed} fichiers')
print(f'✅ Encodage fixé : {enc_fixed} fichiers')