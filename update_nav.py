import os, re, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."

# Cible le href="../matchup.html" ou href="matchup.html" etc.
# et insère le lien Synergies juste après le </li> correspondant

PATTERNS = [
    # Sous-dossiers : href="../matchup.html"
    (r'(<li><a [^>]*href=["\']\.\.\/matchup\.html["\'][^>]*>[^<]*</a></li>)',
     r'\1\n      <li><a href="../synergies.html">Synergies</a></li>'),
    # Racine : href="matchup.html"
    (r'(<li><a [^>]*href=["\']matchup\.html["\'][^>]*>[^<]*</a></li>)',
     r'\1\n      <li><a href="synergies.html">Synergies</a></li>'),
    # Chemin absolu : href="/Urgot-guide/matchup.html"
    (r'(<li><a [^>]*href=["\'][^"\']*\/matchup\.html["\'][^>]*>[^<]*</a></li>)',
     r'\1\n      <li><a href="/Urgot-guide/synergies.html">Synergies</a></li>'),
]

updated, already, no_match = [], [], []

for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in {'.git','node_modules','.cache'}]
    for fname in filenames:
        if not fname.endswith('.html'): continue
        fpath = os.path.join(dirpath, fname)
        try:
            content = open(fpath, encoding='utf-8', errors='replace').read()
        except: continue

        if 'synergies.html' in content:
            already.append(fpath); continue

        new = content
        for pat, rep in PATTERNS:
            result = re.sub(pat, rep, new, flags=re.IGNORECASE)
            if result != new:
                new = result; break

        if new != content:
            open(fpath, 'w', encoding='utf-8').write(new)
            updated.append(fpath)
        else:
            no_match.append(fpath)

print(f"✅ Mis à jour : {len(updated)}")
for f in updated: print(f"   {f}")
print(f"⏭  Déjà OK   : {len(already)}")
print(f"⚪ Pas de nav : {len(no_match)}")