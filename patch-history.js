// ── PATCH HISTORY — Auto-fetch from LoL Wiki ─────────────────────────
(function() {

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

function getChampName() {
  var h1 = document.querySelector('.hero-title');
  if (!h1) return null;
  // Clone sans les spans enfants pour avoir juste le texte
  var clone = h1.cloneNode(true);
  clone.querySelectorAll('span').forEach(function(s){ s.remove(); });
  return clone.textContent.trim() || h1.textContent.trim();
}

function createSection() {
  var section = document.createElement('div');
  section.id = 'patch-history-block';
  section.style.cssText = 'background:var(--bg-surface);border:1px solid var(--border);border-radius:4px;margin-top:1.5rem;overflow:hidden';
  section.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.5rem;border-bottom:1px solid var(--border);cursor:pointer" id="ph-header">' +
      '<p style="font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:var(--green);display:flex;align-items:center;gap:8px">' +
        '📋 Patch History' +
        '<span id="ph-status" style="font-size:10px;color:var(--text-dim);letter-spacing:0.05em;font-family:\'Rajdhani\',sans-serif;font-weight:400"></span>' +
      '</p>' +
      '<span id="ph-arrow" style="color:var(--text-dim);font-size:12px">▼</span>' +
    '</div>' +
    '<div id="ph-body" style="display:none">' +
      '<div id="ph-content" style="padding:1rem 1.5rem;max-height:440px;overflow-y:auto;font-size:13px;color:var(--text);line-height:1.7"></div>' +
    '</div>';
  return section;
}

var loaded = false;
var open   = false;

function toggle(champName) {
  open = !open;
  var body  = document.getElementById('ph-body');
  var arrow = document.getElementById('ph-arrow');
  if (!body) return;
  body.style.display = open ? 'block' : 'none';
  if (arrow) arrow.textContent = open ? '▲' : '▼';
  if (open && !loaded) {
    loaded = true;
    fetchPatches(champName);
  }
}

function setStatus(txt) {
  var el = document.getElementById('ph-status');
  if (el) el.textContent = txt;
}

function setContent(html) {
  var el = document.getElementById('ph-content');
  if (el) el.innerHTML = html;
}

// ── FETCH via API parse (HTML rendu, plus fiable que wikitext) ────────
function fetchPatches(champName) {
  setStatus('⟳ Chargement...');

  var slug = wikiSlug(champName);
  var apiUrl = 'https://wiki.leagueoflegends.com/en-us/api.php' +
    '?action=parse&page=' + slug + '/Patch_history' +
    '&prop=text&format=json&origin=*&disableeditsection=1';

  fetch(apiUrl)
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      if (data.error) throw new Error(data.error.info);
      var html = data.parse && data.parse.text && data.parse.text['*'];
      if (!html) throw new Error('empty response');
      var patches = parseHTML(html, 10);
      if (!patches.length) throw new Error('no patches found');
      renderPatches(patches, champName);
      setStatus(patches.length + ' derniers patches');
    })
    .catch(function(err) {
      console.warn('PatchHistory fetch error:', err);
      var wikiUrl = 'https://wiki.leagueoflegends.com/en-us/' + slug + '/Patch_history';
      setContent(
        '<p style="color:var(--text-dim);margin-bottom:8px">Données indisponibles.</p>' +
        '<a href="' + wikiUrl + '" target="_blank" rel="noopener" ' +
        'style="color:var(--green);text-decoration:none;font-size:12px">' +
        '→ Voir l\'historique sur le wiki ↗</a>'
      );
      setStatus('');
    });
}

// ── PARSER HTML rendu par MediaWiki ───────────────────────────────────
function parseHTML(html, maxEntries) {
  // Créer un DOM temporaire
  var tmp = document.createElement('div');
  tmp.innerHTML = html;

  var patches = [];
  var current = null;

  // Les versions sont dans des <h2> ou <h3> avec id comme "V25.14"
  // Les changements sont dans des <ul><li> après chaque version header

  var nodes = tmp.querySelectorAll('h2, h3, h4, ul');

  nodes.forEach(function(node) {
    if (node.tagName === 'H2' || node.tagName === 'H3' || node.tagName === 'H4') {
      var txt = node.textContent.replace(/\[.*?\]/g, '').trim();
      var vMatch = txt.match(/^(V[\d]+\.[\d.S]+[a-z]?)/i);
      if (vMatch) {
        if (current && current.items.length > 0 && patches.length < maxEntries) {
          patches.push(current);
        }
        if (patches.length >= maxEntries) return;
        current = { version: vMatch[1], items: [] };
      }
    } else if (node.tagName === 'UL' && current && patches.length < maxEntries) {
      // Extraire les <li> de premier niveau
      var items = node.querySelectorAll('li');
      items.forEach(function(li) {
        // Calculer la profondeur (li dans ul dans ul = depth 2)
        var depth = 0;
        var p = li.parentElement;
        while (p && p !== node.parentElement) {
          if (p.tagName === 'UL') depth++;
          p = p.parentElement;
        }

        // Texte du li sans les sous-listes
        var clone = li.cloneNode(true);
        clone.querySelectorAll('ul').forEach(function(sub) { sub.remove(); });
        var text = clone.textContent.trim();

        // Nettoyer le texte (retirer les références wiki)
        text = text.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();

        if (text.length > 3) {
          current.items.push({ depth: depth, text: text });
        }
      });
    }
  });

  if (current && current.items.length > 0 && patches.length < maxEntries) {
    patches.push(current);
  }

  return patches;
}

// ── RENDER ────────────────────────────────────────────────────────────
function getTypeColor(text) {
  var t = text.toLowerCase();
  if (t.includes('bug fix') || t.startsWith('bug'))      return '#facc15';
  if (t.includes('new effect') || t.includes('added'))   return '#4ADE80';
  if (t.includes('increased') || t.includes('buff'))     return '#4ADE80';
  if (t.includes('reduced') || t.includes('removed') ||
      t.includes('decreased') || t.includes('nerf'))     return '#f87171';
  if (t.includes('undocumented'))                        return '#94a3b8';
  return '#A8D4A0';
}

function renderPatches(patches, champName) {
  var html = '';
  patches.forEach(function(patch, idx) {
    html += '<div style="margin-bottom:1rem' + (idx < patches.length-1 ? ';padding-bottom:1rem;border-bottom:1px solid var(--border)' : '') + '">';
    html += '<div style="font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:0.15em;color:var(--green-mid);margin-bottom:0.5rem">' + patch.version + '</div>';
    patch.items.forEach(function(item) {
      var indent = Math.min(item.depth, 3) * 14;
      var color  = getTypeColor(item.text);
      html += '<div style="padding-left:' + indent + 'px;margin:2px 0;display:flex;gap:6px;align-items:flex-start">';
      html += '<span style="color:' + color + ';flex-shrink:0;margin-top:4px;font-size:9px">▸</span>';
      html += '<span style="font-size:12px;line-height:1.5;color:var(--text)">' + item.text + '</span>';
      html += '</div>';
    });
    html += '</div>';
  });
  var slug = wikiSlug(champName);
  html += '<a href="https://wiki.leagueoflegends.com/en-us/' + slug + '/Patch_history" ' +
    'target="_blank" rel="noopener" style="font-size:11px;color:var(--green-dark);text-decoration:none">' +
    '→ Voir l\'historique complet sur le wiki ↗</a>';
  setContent(html);
}

// ── INIT ─────────────────────────────────────────────────────────────
function init() {
  var champName = getChampName();
  if (!champName) return;

  var target = document.querySelector('.page') || document.querySelector('.main') || document.querySelector('main');
  if (!target) return;

  var section = createSection();
  target.appendChild(section);

  document.getElementById('ph-header').addEventListener('click', function() {
    toggle(champName);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();