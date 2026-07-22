/* ============================================================================
   core.js — state, storage, API client (+ demo mode), UI helpers, router.
   Vanilla JS, no framework — mirrors the POS's small-helper style.
   ========================================================================== */

/* ------------------------------------------------------------------ state */
var S = {
  token: null,
  me: null,                 // current member object
  tab: 'home',              // active bottom tab
  stack: [],                // navigation stack: [{name, params}]
  cache: {},                // misc per-view caches
  unread: 0,                // unread chat count (drives badges)
};

/* ------------------------------------------------------------------ dom helpers */
function $(s, el) { return (el || document).querySelector(s); }
function $$(s, el) { return [].slice.call((el || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
  return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function el(tag, attrs, html) {
  var e = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  });
  if (html != null) e.innerHTML = html;
  return e;
}

/* ------------------------------------------------------------------ formatting */
function initials(name) {
  var p = String(name || '?').trim().split(/\s+/);
  return ((p[0] || '')[0] || '?').toUpperCase() + (p.length > 1 ? (p[p.length - 1][0] || '').toUpperCase() : '');
}
function avatarHTML(m, size) {
  size = size || 'md';
  var name = (m && (m.name || m.senderName)) || '?';
  var url = m && m.avatarUrl;
  if (url) return '<div class="avatar ' + size + '"><img src="' + esc(url) + '" style="width:100%;height:100%;object-fit:cover" alt=""/></div>';
  return '<div class="avatar ' + size + '">' + esc(initials(name)) + '</div>';
}
function money(n) { return '₱' + (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function two(n) { return (n < 10 ? '0' : '') + n; }
function parseDT(v) { // accepts 'yyyy-MM-dd HH:mm', ISO, or Date
  if (!v) return null;
  if (v instanceof Date) return v;
  var s = String(v).trim().replace(' ', 'T');
  var d = new Date(s);
  return isNaN(d) ? null : d;
}
function timeAgo(v) {
  var d = parseDT(v); if (!d) return '';
  var s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 604800) return Math.floor(s / 86400) + 'd';
  return fmtDate(d);
}
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function fmtDate(v) { var d = parseDT(v); if (!d) return ''; return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
function fmtDateTime(v) { var d = parseDT(v); if (!d) return ''; var h = d.getHours(), ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12;
  return MONTHS[d.getMonth()] + ' ' + d.getDate() + ' · ' + h + ':' + two(d.getMinutes()) + ' ' + ap; }
function fmtTime(v) { var d = parseDT(v); if (!d) return ''; var h = d.getHours(), ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; return h + ':' + two(d.getMinutes()) + ' ' + ap; }
function fmtEventWhen(v) { var d = parseDT(v); if (!d) return ''; return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ' · ' + fmtTime(d); }

/* ------------------------------------------------------------------ storage */
var STORE_KEY = 'croma_community';
function saveSession() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ token: S.token, me: S.me })); } catch (e) {}
}
function loadSession() {
  try { var r = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); S.token = r.token || null; S.me = r.me || null; } catch (e) {}
}
function clearSession() { S.token = null; S.me = null; try { localStorage.removeItem(STORE_KEY); } catch (e) {} }

/* ------------------------------------------------------------------ loading / toast / modal (from POS) */
var _load = 0;
function loadInc() { _load++; if (_load === 1) $('#loadingOverlay').classList.add('show'); }
function loadDec() { _load = Math.max(0, _load - 1); if (_load === 0) $('#loadingOverlay').classList.remove('show'); }
function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2400); }
function modal(html, opts) {
  opts = opts || {};
  var r = $('#modalRoot');
  r.innerHTML = '<div class="modal-backdrop"><div class="modal"><div class="grab"></div>' +
    (opts.noX ? '' : '<button class="modal-x" title="Close">&times;</button>') + html + '</div></div>';
  var x = r.querySelector('.modal-x'); if (x) x.addEventListener('click', closeModal);
  return r.querySelector('.modal');
}
function closeModal() { $('#modalRoot').innerHTML = ''; }

/* ------------------------------------------------------------------ API client */
// Every backend action returns {ok:true,...} or {ok:false,error}. To dodge CORS
// preflight against Apps Script we POST text/plain with a JSON string body.
function api(action, params, silent) {
  params = params || {};
  var payload = Object.assign({ action: action, token: S.token }, params);
  if (!CROMA.API_URL) return DEMO.handle(action, payload);     // demo mode
  var timer = silent ? 0 : setTimeout(loadInc, 240), shown = !silent;
  return fetch(CROMA.API_URL, {
    method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  }).then(function (r) { return r.json(); })
    .then(function (j) { if (timer) clearTimeout(timer); if (shown) loadDec(); shown = false; return j; })
    .catch(function (e) { if (timer) clearTimeout(timer); if (shown) loadDec(); shown = false;
      return { ok: false, error: 'Network error — check your connection.' }; });
}
// convenience: resolves with data or throws the error string (for try/catch flows)
function apiOrThrow(action, params) {
  return api(action, params).then(function (r) { if (!r || !r.ok) throw new Error((r && r.error) || 'Something went wrong.'); return r; });
}

// Stale-while-revalidate cache → instant re-navigation, refresh in the background.
// onData(result, isCached) is called with cached data first (if any), then fresh
// data (unless unchanged). opts.freshFor: skip the network if cache is younger.
var _swr = {};
function _swrKey(a, p) { return a + '|' + JSON.stringify(p || {}); }
function apiSWR(action, params, onData, opts) {
  opts = opts || {};
  var key = _swrKey(action, params), hit = _swr[key], served = false;
  if (hit) {
    served = true; try { onData(hit.data, true); } catch (e) {}
    if (opts.freshFor && (Date.now() - hit.ts) < opts.freshFor) return Promise.resolve(hit.data);   // fresh enough — no network
  }
  return api(action, params, served).then(function (r) {
    if (r && r.ok !== false) _swr[key] = { data: r, ts: Date.now() };
    if (served && hit) { try { if (JSON.stringify(hit.data) === JSON.stringify(r)) return r; } catch (e) {} }  // unchanged — skip re-render
    try { onData(r, false); } catch (e) {}
    return r;
  });
}
// drop cached entries for the given action name(s) after a mutation
function swrDrop() {
  var names = [].slice.call(arguments);
  Object.keys(_swr).forEach(function (k) { names.forEach(function (n) { if (k.indexOf(n + '|') === 0) delete _swr[k]; }); });
}
// warm the cache for the other tabs in the background (no loading overlay), so the
// first tap into each feels instant.
function prefetch() {
  ['menu', 'threads', 'myConnections', 'events'].forEach(function (a) {
    if (_swr[_swrKey(a, {})]) return;
    api(a, {}, true).then(function (r) { if (r && r.ok !== false) _swr[_swrKey(a, {})] = { data: r, ts: Date.now() }; });
  });
}

/* ------------------------------------------------------------------ router */
var Views = {};
function registerView(name, def) { Views[name] = def; }

var TABS = [
  { id: 'home', ic: '\u{1F3E0}', label: 'Home' },
  { id: 'menu', ic: '☕', label: 'Menu' },
  { id: 'community', ic: '\u{1F465}', label: 'Community' },
  { id: 'chat', ic: '\u{1F4AC}', label: 'Chat' },
  { id: 'profile', ic: '\u{1F642}', label: 'Profile' },
];

function go(name, params, opts) {
  opts = opts || {};
  var def = Views[name];
  if (!def) { console.warn('no view', name); return; }
  if (def.tab) { S.tab = def.tab; S.stack = [{ name: name, params: params || {} }]; }   // a tab root resets the stack
  else if (opts.replace) S.stack[S.stack.length - 1] = { name: name, params: params || {} };
  else S.stack.push({ name: name, params: params || {} });
  renderCurrent();
}
function back() {
  if (S.stack.length > 1) { S.stack.pop(); renderCurrent(); }
  else if (Views[S.tab]) { go(S.tab); }
}
function current() { return S.stack[S.stack.length - 1]; }

function renderCurrent() {
  if (S._poll) { clearInterval(S._poll); S._poll = null; }   // stop any chat/live polling from the previous view
  var cur = current(); if (!cur) { go('home'); return; }
  var def = Views[cur.name];
  $('#mainScreen').classList.add('active');
  $('#authScreen').classList.remove('active');
  renderAppbar(def, cur);
  renderTabbar(def);
  var body = $('#viewBody');
  body.className = 'body' + (def.nav === false ? ' no-nav' : '');
  body.innerHTML = '';
  window.scrollTo(0, 0);
  try { def.render(body, cur.params || {}); }
  catch (e) { console.error(e); body.innerHTML = '<div class="empty"><div class="ico">⚠️</div><div class="msg">' + esc(e.message) + '</div></div>'; }
}

function renderAppbar(def, cur) {
  var bar = $('#appbar');
  var isRoot = !!def.tab;
  var title = typeof def.title === 'function' ? def.title(cur.params || {}) : (def.title || CROMA.APP_NAME);
  var h = '';
  if (isRoot && cur.name === 'home') {
    h += '<img class="logo" src="' + (window.CROMA_LOGO || '') + '" alt="Croma MNL"/>';
    h += '<div><div class="title">Community</div></div>';
  } else if (isRoot) {
    h += '<div class="title">' + esc(title) + '</div>';
  } else {
    h += '<button class="back" aria-label="Back">‹</button><div class="title">' + esc(title) + '</div>';
  }
  h += '<div class="actions">' + (def.actions ? def.actions(cur.params || {}) : '') + '</div>';
  bar.innerHTML = h;
  var b = bar.querySelector('.back'); if (b) b.addEventListener('click', back);
  if (def.onAppbar) def.onAppbar(bar, cur.params || {});
}

function renderTabbar(def) {
  var bar = $('#tabbar');
  if (def.nav === false) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  bar.innerHTML = TABS.map(function (t) {
    var badge = (t.id === 'chat' && S.unread > 0) ? '<span class="badge-dot">' + (S.unread > 99 ? '99+' : S.unread) + '</span>' : '';
    return '<button data-tab="' + t.id + '" class="' + (S.tab === t.id ? 'active' : '') + '">' +
      badge + '<span class="ic">' + t.ic + '</span>' + t.label + '</button>';
  }).join('');
  $$('#tabbar button').forEach(function (btn) {
    btn.addEventListener('click', function () { go(btn.dataset.tab); });
  });
}

/* ------------------------------------------------------------------ auth flow bridge */
function showAuth() {
  clearSession();
  $('#mainScreen').classList.remove('active');
  $('#authScreen').classList.add('active');
  Auth.render();
}
function onLoggedIn(r) {          // r = {ok, token, member}
  S.token = r.token; S.me = r.member; saveSession();
  if (!S.me || !S.me.onboarded) { $('#authScreen').classList.remove('active'); Auth.onboarding(); return; }
  go('home');
  setTimeout(prefetch, 1500);
}

/* ------------------------------------------------------------------ tiny UI atoms shared by views */
function emptyState(icon, msg, sub) {
  return '<div class="empty"><div class="ico">' + icon + '</div><div class="msg">' + esc(msg) + '</div>' +
    (sub ? '<div class="small muted mt8">' + esc(sub) + '</div>' : '') + '</div>';
}
function skeletonList(n) {
  var s = ''; for (var i = 0; i < (n || 4); i++) s += '<div class="card" style="height:70px"><div class="skeleton" style="width:60%;height:14px"></div><div class="skeleton" style="width:40%;height:12px;margin-top:10px"></div></div>';
  return s;
}
// pick a file as a data URL (for avatar / post / event images)
function pickImage(cb) {
  var inp = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  inp.addEventListener('change', function () {
    var f = inp.files && inp.files[0]; if (!f) return;
    if (f.size > 6 * 1024 * 1024) { toast('Image too large (max 6MB).'); return; }
    var rd = new FileReader();
    rd.onload = function () { downscale(rd.result, 1280, cb); };
    rd.readAsDataURL(f);
  });
  document.body.appendChild(inp); inp.click();
  setTimeout(function () { try { document.body.removeChild(inp); } catch (e) {} }, 60000);
}
// shrink big photos client-side so uploads stay small
function downscale(dataUrl, max, cb) {
  var img = new Image();
  img.onload = function () {
    var w = img.width, h = img.height, sc = Math.min(1, max / Math.max(w, h));
    var c = el('canvas'); c.width = Math.round(w * sc); c.height = Math.round(h * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    try { cb(c.toDataURL('image/jpeg', 0.82)); } catch (e) { cb(dataUrl); }
  };
  img.onerror = function () { cb(dataUrl); };
  img.src = dataUrl;
}
