// ── PATCH HISTORY — Auto-fetch from LoL Wiki ──────────────────────────
// Usage: ajouter <script src="../patch-history.js"></script> dans chaque page matchup
// Le script détecte le nom du champion depuis la page et fetch automatiquement

(function() {

// Correspondances noms → slugs wiki
var WIKI_SLUG = {
  "Aurelion Sol":"Aurelion_Sol","Bel'Veth":"Bel%27Veth",
  "Cho'Gath":"Cho%27Gath","Dr. Mundo":"Dr._Mundo",
  "Jarvan IV":"Jarvan_IV","K'Sante":"K%27Sante",
  "Kai'Sa":"Kai%27Sa","Kha'Zix":"Kha%27Zix",
  "Kog'Maw":"Kog%27Maw","Lee Sin":"Lee_Sin",
  "Master Yi":"Master_Yi","Miss Fortune":"Miss_Fortune",
  "Nunu & Willump":"Nunu_%26_Willump","Rek'Sai":"Rek%27Sai",
  "Renata Glasc":"Renata_Glasc","Tahm Kench":"Tahm_Kench",
  "Twisted Fate":"Twisted_Fate","Vel'Koz":"Vel%27Koz",
  "Wukong":"Wukong","Xin Zhao":"Xin_Zhao",
};
function wikiSlug(name) {
  return WIKI_SLUG[name] || name.replace(/\s/g,'_');
}

// Détecter le nom du champion depuis la page
function getChampName() {
  var h1 = document.querySelector('.hero-title');
  if (!h1) return null;
  return h1.textContent.trim();
}

// Créer la section HTML
function createSection() {
  var section = document.createElement('div');
  section.id = 'patch-history-block';
  section.style.cssText = 'background:var(--bg-surface);border:1px solid var(--border);border-radius:4px;margin-top:1.5rem;overflow:hidden;position:relative';
  section.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.5rem;border-bottom:1px solid var(--border);cursor:pointer" onclick="togglePatch()">
      <p style="font-family:'Cinzel',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:var(--green);display:flex;align-items:center;gap:8px">
        📋 Patch History
        <span id="patch-loading" style="font-size:10px;color:var(--text-dim);letter-spacing:0.05em;font-family:'Rajdhani',sans-serif;font-weight:400"></span>
      </p>
      <span id="patch-toggle-icon" style="color:var(--text-dim);font-size:12px;transition:transform 0.2s">▼</span>
    </div>
    <div id="patch-body" style="display:none;padding:1rem 1.5rem;max-height:420px;overflow-y:auto">
      <div id="patch-content" style="font-size:13px;color:var(--text);line-height:1.7"></div>
    </div>
  `;
  return section;
}

window.togglePatch = function() {
  var body = document.getElementById('patch-body');
  var icon = document.getElementById('patch-toggle-icon');
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (icon) icon.style.transform = open ? '' : 'rotate(180deg)';
};

// Parser le wikitext pour extraire les entrées de patch
function parsePatches(wikitext, maxEntries) {
  var lines = wikitext.split('\n');
  var patches = [];
  var current = null;
  var entryCount = 0;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();

    // Détecte un numéro de version (ex: ==V25.06== ou V25.06)
    var vMatch = line.match(/^=+\s*(V[\d.S]+[a-z]?(?:\s*-[^=]*)?)\s*=+$/) ||
                 line.match(/^(V[\d.S]+[a-z]?)(?:\s*-|\s*$)/);
    if (vMatch) {
      if (current && current.items.length > 0) {
        patches.push(current);
        entryCount++;
        if (entryCount >= maxEntries) break;
      }
      current = { version: vMatch[1], items: [] };
      continue;
    }

    if (!current) continue;

    // Ligne de contenu (bullet points)
    var content = line
      .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')  // retire wikilinks
      .replace(/\{\{[^}]+\}\}/g, '')                     // retire templates
      .replace(/'''?/g, '')                               // retire bold
      .replace(/\[\[|\]\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (content.startsWith('*')) {
      var depth = 0;
      var raw = content;
      while (raw.startsWith('*')) { depth++; raw = raw.slice(1).trim(); }
      if (raw.length > 0) {
        current.items.push({ depth: depth, text: raw });
      }
    }
  }

  if (current && current.items.length > 0 && entryCount < maxEntries) {
    patches.push(current);
  }

  return patches;
}

// Rendre les patches en HTML
function renderPatches(patches, champName) {
  if (!patches.length) {
    return '<p style="color:var(--text-dim);font-style:italic">Aucune donnée de patch disponible.</p>';
  }

  var TYPE_COLORS = {
    'buff':   '#4ADE80', 'increased':'#4ADE80', 'added':'#4ADE80', 'new effect':'#4ADE80',
    'nerf':   '#ef4444', 'reduced':'#ef4444', 'removed':'#ef4444',
    'bug fix':'#facc15', 'undocumented':'#94a3b8',
    'default':'#A8D4A0',
  };

  function getColor(text) {
    var t = text.toLowerCase();
    if (t.includes('bug fix')) return TYPE_COLORS['bug fix'];
    if (t.includes('new effect') || t.includes('added')) return TYPE_COLORS['buff'];
    if (t.includes('increased') || t.includes('buff')) return TYPE_COLORS['buff'];
    if (t.includes('reduced') || t.includes('removed') || t.includes('nerf')) return TYPE_COLORS['nerf'];
    if (t.includes('undocumented')) return TYPE_COLORS['undocumented'];
    return TYPE_COLORS['default'];
  }

  var html = '';
  patches.forEach(function(patch) {
    html += '<div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--border)">';
    html += '<div style="font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:0.15em;color:var(--green-mid);margin-bottom:0.5rem">' + patch.version + '</div>';
    patch.items.forEach(function(item) {
      var indent = (item.depth - 1) * 14;
      var color = getColor(item.text);
      html += '<div style="padding-left:' + indent + 'px;margin:2px 0;display:flex;gap:6px;align-items:flex-start">';
      html += '<span style="color:' + color + ';flex-shrink:0;margin-top:3px;font-size:10px">▸</span>';
      html += '<span style="color:var(--text);font-size:12px;line-height:1.5">' + item.text + '</span>';
      html += '</div>';
    });
    html += '</div>';
  });

  var wikiUrl = 'https://wiki.leagueoflegends.com/en-us/' + wikiSlug(champName) + '/Patch_history';
  html += '<a href="' + wikiUrl + '" target="_blank" rel="noopener" style="font-size:11px;color:var(--green-dark);text-decoration:none;letter-spacing:0.05em">→ Voir l\'historique complet sur le wiki ↗</a>';

  return html;
}

// Fetch depuis le wiki
function fetchPatches(champName) {
  var loading = document.getElementById('patch-loading');
  if (loading) loading.textContent = '⟳ Chargement...';

  var apiUrl = 'https://wiki.leagueoflegends.com/en-us/api.php'
    + '?action=query&titles=' + wikiSlug(champName) + '/Patch_history'
    + '&prop=revisions&rvprop=content&rvslots=main&format=json&origin=*';

  fetch(apiUrl)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var pages = data.query && data.query.pages;
      if (!pages) throw new Error('No pages');
      var page = Object.values(pages)[0];
      if (!page || !page.revisions) throw new Error('No revisions');
      var wikitext = page.revisions[0].slots.main['*'] || page.revisions[0]['*'] || '';
      var patches = parsePatches(wikitext, 10);
      var html = renderPatches(patches, champName);
      var content = document.getElementById('patch-content');
      if (content) content.innerHTML = html;
      if (loading) loading.textContent = patches.length + ' derniers patches';
    })
    .catch(function(err) {
      var content = document.getElementById('patch-content');
      var wikiUrl = 'https://wiki.leagueoflegends.com/en-us/' + wikiSlug(champName) + '/Patch_history';
      if (content) content.innerHTML = '<p style="color:var(--text-dim)">Impossible de charger les patches. <a href="' + wikiUrl + '" target="_blank" style="color:var(--green)">→ Voir sur le wiki ↗</a></p>';
      if (loading) loading.textContent = '';
    });
}

// Init — lancer après DOM ready
function init() {
  var champName = getChampName();
  if (!champName) return;

  // Chercher où insérer la section (fin de .page ou avant footer)
  var target = document.querySelector('.page') || document.querySelector('.main') || document.querySelector('main');
  if (!target) return;

  var section = createSection();
  target.appendChild(section);

  // Fetch au clic sur le header pour ne pas charger inutilement
  var header = section.querySelector('[onclick="togglePatch()"]');
  var fetched = false;
  header.addEventListener('click', function() {
    if (!fetched) {
      fetched = true;
      fetchPatches(champName);
    }
  }, { once: false });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();