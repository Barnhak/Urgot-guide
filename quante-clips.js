// ── QUANTE CLIPS — Clips Twitch/YouTube de Quante illustrant le matchup ───────
(function() {

var CLIPS_JSON_PATH = '../quante-clips.json';

function getChampName() {
  var h1 = document.querySelector('.hero-title');
  if (!h1) return null;
  var clone = h1.cloneNode(true);
  clone.querySelectorAll('span').forEach(function(s){ s.remove(); });
  return clone.textContent.trim() || h1.textContent.trim();
}

// ── PARSING D'URL → infos d'embed ─────────────────────────────────────
// Supporte : Twitch VOD (avec ou sans timestamp ?t=), Twitch Clip, YouTube
function parseClipUrl(url) {
  var twitchVod = url.match(/twitch\.tv\/videos\/(\d+)(?:\?t=([\w\d]+))?/);
  if (twitchVod) {
    return { type: 'twitch-vod', id: twitchVod[1], time: twitchVod[2] || null };
  }

  var twitchClipShort = url.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)/);
  var twitchClipLong  = url.match(/twitch\.tv\/\w+\/clip\/([A-Za-z0-9_-]+)/);
  var clipSlug = twitchClipShort ? twitchClipShort[1] : (twitchClipLong ? twitchClipLong[1] : null);
  if (clipSlug) {
    return { type: 'twitch-clip', id: clipSlug };
  }

  var yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})(?:.*?[?&]t=([\w\d]+))?/);
  if (yt) {
    return { type: 'youtube', id: yt[1], time: yt[2] || null };
  }

  return null;
}

function buildEmbedSrc(parsed) {
  var parentParam = 'parent=' + encodeURIComponent(window.location.hostname);

  if (parsed.type === 'twitch-vod') {
    var src = 'https://player.twitch.tv/?video=' + parsed.id + '&' + parentParam;
    if (parsed.time) src += '&time=' + parsed.time;
    return src;
  }

  if (parsed.type === 'twitch-clip') {
    return 'https://clips.twitch.tv/embed?clip=' + parsed.id + '&' + parentParam;
  }

  if (parsed.type === 'youtube') {
    var ytSrc = 'https://www.youtube.com/embed/' + parsed.id;
    if (parsed.time) {
      // Convertit "1h23m" / "45m" / "90" (secondes) en secondes pour YouTube (?start=)
      var seconds = timeToSeconds(parsed.time);
      if (seconds) ytSrc += '?start=' + seconds;
    }
    return ytSrc;
  }

  return null;
}

function timeToSeconds(t) {
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  var h = t.match(/(\d+)h/);
  var m = t.match(/(\d+)m/);
  var s = t.match(/(\d+)s/);
  return (h ? parseInt(h[1], 10) * 3600 : 0) +
         (m ? parseInt(m[1], 10) * 60 : 0) +
         (s ? parseInt(s[1], 10) : 0);
}

// ── UI ──────────────────────────────────────────────────────────────
function createSection() {
  var section = document.createElement('div');
  section.id = 'quante-clips-block';
  section.style.cssText = 'background:var(--bg-surface);border:1px solid var(--border);border-radius:4px;margin-top:1.5rem;overflow:hidden';
  section.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.5rem;border-bottom:1px solid var(--border);cursor:pointer" id="qc-header">' +
      '<p style="font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:var(--green);display:flex;align-items:center;gap:8px">' +
        '🎥 Clips de Quante' +
        '<span id="qc-status" style="font-size:10px;color:var(--text-dim);letter-spacing:0.05em;font-family:\'Rajdhani\',sans-serif;font-weight:400"></span>' +
      '</p>' +
      '<span id="qc-arrow" style="color:var(--text-dim);font-size:12px">▼</span>' +
    '</div>' +
    '<div id="qc-body" style="display:none">' +
      '<div id="qc-content" style="padding:1rem 1.5rem;font-size:13px;color:var(--text);line-height:1.7"></div>' +
    '</div>';
  return section;
}

var loaded = false;
var open   = false;

function toggle(champName) {
  open = !open;
  var body  = document.getElementById('qc-body');
  var arrow = document.getElementById('qc-arrow');
  if (!body) return;
  body.style.display = open ? 'block' : 'none';
  if (arrow) arrow.textContent = open ? '▲' : '▼';
  if (open && !loaded) {
    loaded = true;
    loadClips(champName);
  }
}

function setStatus(txt) {
  var el = document.getElementById('qc-status');
  if (el) el.textContent = txt;
}

function setContent(html) {
  var el = document.getElementById('qc-content');
  if (el) el.innerHTML = html;
}

// ── LOAD JSON + RENDER ────────────────────────────────────────────────
function loadClips(champName) {
  setStatus('⟳ Chargement...');

  fetch(CLIPS_JSON_PATH)
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      var clips = data[champName];
      if (!clips || !clips.length) throw new Error('no clips for this champion');
      renderClips(clips);
      setStatus(clips.length + ' clip' + (clips.length > 1 ? 's' : ''));
    })
    .catch(function(err) {
      console.warn('QuanteClips error:', err);
      setContent(
        '<p style="color:var(--text-dim)">Pas encore de clip pour ce matchup. Revenez plus tard !</p>'
      );
      setStatus('');
    });
}

function renderClips(clips) {
  var html = '<div style="display:flex;flex-direction:column;gap:1.25rem">';

  clips.forEach(function(clip) {
    var parsed = parseClipUrl(clip.url);
    if (!parsed) {
      console.warn('QuanteClips: URL non reconnue —', clip.url);
      return;
    }
    var src = buildEmbedSrc(parsed);
    if (!src) return;

    html += '<div>';
    if (clip.label) {
      html += '<div style="font-size:13px;font-weight:600;color:var(--text-bright);margin-bottom:8px">' + clip.label + '</div>';
    }
    html += '<div style="position:relative;width:100%;padding-top:56.25%;border-radius:4px;overflow:hidden;border:1px solid var(--border)">';
    html += '<iframe src="' + src + '" ' +
      'style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" ' +
      'allowfullscreen scrolling="no" frameborder="0"></iframe>';
    html += '</div>';
    html += '</div>';
  });

  html += '</div>';
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

  document.getElementById('qc-header').addEventListener('click', function() {
    toggle(champName);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
