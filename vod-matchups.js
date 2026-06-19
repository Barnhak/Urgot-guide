// ── VOD MATCHUPS — Auto-fetch pro games Urgot Top vs Adversaire via Leaguepedia Cargo API ─────
(function() {

// Noms à corriger pour matcher exactement le champ [Champion] de Leaguepedia
// (Leaguepedia est globalement cohérent avec les noms officiels Riot, mais on garde
// une table de secours pour les cas particuliers si jamais ça diverge)
var CARGO_NAME_FIX = {
  "Nunu & Willump": "Nunu",
};

function getChampName() {
  var h1 = document.querySelector('.hero-title');
  if (!h1) return null;
  var clone = h1.cloneNode(true);
  clone.querySelectorAll('span').forEach(function(s){ s.remove(); });
  return clone.textContent.trim() || h1.textContent.trim();
}

function cargoName(name) {
  return CARGO_NAME_FIX[name] || name;
}

// ── UI ──────────────────────────────────────────────────────────────
function createSection() {
  var section = document.createElement('div');
  section.id = 'vod-matchups-block';
  section.style.cssText = 'background:var(--bg-surface);border:1px solid var(--border);border-radius:4px;margin-top:1.5rem;overflow:hidden';
  section.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.5rem;border-bottom:1px solid var(--border);cursor:pointer" id="vm-header">' +
      '<p style="font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:var(--green);display:flex;align-items:center;gap:8px">' +
        '🎬 Pro VODs' +
        '<span id="vm-status" style="font-size:10px;color:var(--text-dim);letter-spacing:0.05em;font-family:\'Rajdhani\',sans-serif;font-weight:400"></span>' +
      '</p>' +
      '<span id="vm-arrow" style="color:var(--text-dim);font-size:12px">▼</span>' +
    '</div>' +
    '<div id="vm-body" style="display:none">' +
      '<div id="vm-content" style="padding:1rem 1.5rem;font-size:13px;color:var(--text);line-height:1.7"></div>' +
    '</div>';
  return section;
}

var loaded = false;
var open   = false;

function toggle(champName) {
  open = !open;
  var body  = document.getElementById('vm-body');
  var arrow = document.getElementById('vm-arrow');
  if (!body) return;
  body.style.display = open ? 'block' : 'none';
  if (arrow) arrow.textContent = open ? '▲' : '▼';
  if (open && !loaded) {
    loaded = true;
    fetchVods(champName);
  }
}

function setStatus(txt) {
  var el = document.getElementById('vm-status');
  if (el) el.textContent = txt;
}

function setContent(html) {
  var el = document.getElementById('vm-content');
  if (el) el.innerHTML = html;
}

// ── CACHE localStorage (24h) ──────────────────────────────────────────
var CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(enemyChampName) {
  return 'vod-matchups:Urgot:' + enemyChampName;
}

function readCache(enemyChampName) {
  try {
    var raw = localStorage.getItem(cacheKey(enemyChampName));
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (!parsed || !parsed.timestamp || !parsed.games) return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed.games;
  } catch (e) {
    return null;
  }
}

function writeCache(enemyChampName, games) {
  try {
    localStorage.setItem(cacheKey(enemyChampName), JSON.stringify({
      timestamp: Date.now(),
      games: games
    }));
  } catch (e) {
    // localStorage plein ou indisponible (navigation privée) : on ignore silencieusement
  }
}

// ── FETCH via Cargo API (self-join ScoreboardPlayers x2 sur le même GameId) ───
function fetchVods(enemyChampName) {
  var cached = readCache(enemyChampName);
  if (cached) {
    renderVods(cached, enemyChampName);
    setStatus(cached.length + ' game' + (cached.length > 1 ? 's' : '') + ' pro (cache)');
    return;
  }

  setStatus('⟳ Chargement...');

  var enemy = cargoName(enemyChampName);

  var fields = [
    'SG.Tournament=Tournament',
    'SG.DateTime_UTC=Date',
    'SG.Team1=Team1',
    'SG.Team2=Team2',
    'SG.VOD=VOD',
    'U.Team=UrgotTeam'
  ].join(',');

  var where =
    'U.Champion="Urgot" AND U.Role="Top" AND ' +
    'E.Champion="' + enemy.replace(/"/g, '\\"') + '" AND E.Role="Top" AND ' +
    'SG.VOD IS NOT NULL AND SG.VOD != ""';

  var params = {
    action: 'cargoquery',
    tables: 'ScoreboardPlayers=U,ScoreboardPlayers=E,ScoreboardGames=SG',
    join_on: 'U.GameId=E.GameId,U.GameId=SG.GameId',
    fields: fields,
    where: where,
    order_by: 'SG.DateTime_UTC DESC',
    limit: '5',
    format: 'json',
    origin: '*'
  };

  var qs = Object.keys(params)
    .map(function(k){ return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
    .join('&');

  var apiUrl = 'https://lol.fandom.com/api.php?' + qs;

  fetch(apiUrl)
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      if (data.error) throw new Error(data.error.info);
      var rows = data.cargoquery || [];
      if (!rows.length) throw new Error('no games found');
      var games = rows.map(function(row){ return row.title; });
      writeCache(enemyChampName, games);
      renderVods(games, enemyChampName);
      setStatus(games.length + ' game' + (games.length > 1 ? 's' : '') + ' pro trouvée' + (games.length > 1 ? 's' : ''));
    })
    .catch(function(err) {
      console.warn('VodMatchups fetch error:', err);
      setContent(
        '<p style="color:var(--text-dim)">Pas de VOD publique enregistrée sur Leaguepedia pour Urgot Top vs ' + enemyChampName + ' Top (les games pro régionales/amateurs sont rarement diffusées). Réessayez plus tard, la base se met à jour régulièrement.</p>'
      );
      setStatus('');
    });
}

// ── RENDER ────────────────────────────────────────────────────────────
function formatDate(dt) {
  if (!dt) return '';
  // Format Cargo: "2024-10-12 14:30:00"
  var d = new Date(dt.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return dt.split(' ')[0] || '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderVods(games, enemyChampName) {
  var html = '<div style="display:flex;flex-direction:column;gap:10px">';

  games.forEach(function(g) {
    var dateTxt = formatDate(g.Date);
    var matchup = (g.Team1 || '?') + ' vs ' + (g.Team2 || '?');

    html += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:4px;padding:0.9rem 1.1rem;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">';
    html += '<div>';
    html += '<div style="font-size:14px;font-weight:600;color:var(--text-bright)">' + matchup + '</div>';
    html += '<div style="font-size:11px;color:var(--text-dim);margin-top:2px">' + (g.Tournament || '') + (dateTxt ? ' · ' + dateTxt : '') + '</div>';
    html += '<div style="font-size:11px;color:var(--text-dim);margin-top:2px">Urgot — ' + (g.UrgotTeam || '?') + '</div>';
    html += '</div>';

    html += '<a href="' + g.VOD + '" target="_blank" rel="noopener" ' +
      'style="font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;' +
      'color:var(--text-bright);background:var(--green-dark);border-radius:3px;padding:6px 14px;text-decoration:none;flex-shrink:0">' +
      '▶ VOD ↗</a>';

    html += '</div>';
  });

  html += '</div>';
  html += '<p style="font-size:10px;color:var(--text-dim);margin-top:10px">' +
    'Données : Leaguepedia (LoL Esports) · pas de timestamp précis sur la lane phase</p>';

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

  document.getElementById('vm-header').addEventListener('click', function() {
    toggle(champName);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
