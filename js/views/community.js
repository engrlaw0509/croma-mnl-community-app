/* ============================================================================
   community.js — find and connect with fellow regulars; manage requests.
   ========================================================================== */
registerView('community', {
  tab: 'community',
  title: 'Community',
  render: function (host) {
    host.innerHTML =
      '<input class="field" id="cmSearch" placeholder="Search members by name or interest…"/>' +
      '<div id="cmRequests"></div>' +
      '<div class="section-title">Your connections</div><div id="cmConns">' + skeletonList(2) + '</div>' +
      '<div class="section-title">Discover</div><div id="cmDiscover">' + skeletonList(3) + '</div>';

    loadConns();
    search('');
    var t;
    $('#cmSearch').addEventListener('input', function () { var q = this.value.trim(); clearTimeout(t); t = setTimeout(function () { search(q); }, 220); });

    function loadConns() {
      apiSWR('myConnections', {}, function (r) {
        var reqs = (r && r.requests) || [], conns = (r && r.connections) || [];
        $('#cmRequests').innerHTML = reqs.length
          ? '<div class="section-title">Requests <span class="badge red">' + reqs.length + '</span></div><div class="list">' + reqs.map(reqRow).join('') + '</div>'
          : '';
        $('#cmConns').innerHTML = conns.length ? '<div class="list">' + conns.map(function (m) { return memberRow(m, 'connected'); }).join('') + '</div>'
          : emptyState('👋', 'No connections yet', 'Discover regulars below and say hi.');
        wire($('#cmRequests')); wire($('#cmConns'));
      });
    }
    function search(q) {
      apiSWR('members', { q: q }, function (r) {
        var list = ((r && r.members) || []).filter(function (m) { return m.id !== (S.me && S.me.id); });
        $('#cmDiscover').innerHTML = list.length ? '<div class="list">' + list.map(function (m) { return memberRow(m, m.status); }).join('') + '</div>'
          : emptyState('🔍', 'No members found');
        wire($('#cmDiscover'));
      });
    }
    function wire(scope) {
      $$('[data-open]', scope).forEach(function (row) { row.addEventListener('click', function (e) {
        if (e.target.closest('[data-act]')) return; go('memberProfile', { memberId: row.dataset.open });
      }); });
      $$('[data-act]', scope).forEach(function (btn) { btn.addEventListener('click', function (e) {
        e.stopPropagation(); doAction(btn.dataset.act, btn.dataset.id, btn);
      }); });
    }
    function doAction(act, mid, btn) {
      if (act === 'connect') { api('connect', { memberId: mid }).then(function () { swrDrop('myConnections', 'members', 'home'); toast('Request sent.'); btn.outerHTML = '<span class="badge soft">Requested</span>'; }); }
      else if (act === 'accept') { api('respondConnection', { memberId: mid, accept: true }).then(function () { swrDrop('myConnections', 'members', 'home'); toast('Connected! 🎉'); loadConns(); search($('#cmSearch').value.trim()); }); }
      else if (act === 'ignore') { api('respondConnection', { memberId: mid, accept: false }).then(function () { swrDrop('myConnections', 'members'); loadConns(); }); }
      else if (act === 'message') { openChatWith(mid); }
    }
  },
});

function memberRow(m, status) {
  var btn;
  if (status === 'connected') btn = '<button class="btn accent sm" data-act="message" data-id="' + esc(m.id) + '">Message</button>';
  else if (status === 'pending') btn = '<span class="badge soft">Requested</span>';
  else if (status === 'incoming') btn = '<button class="btn primary sm" data-act="accept" data-id="' + esc(m.id) + '">Accept</button>';
  else btn = '<button class="btn primary sm" data-act="connect" data-id="' + esc(m.id) + '">Connect</button>';
  return '<div class="item" data-open="' + esc(m.id) + '">' + avatarHTML(m, 'md') +
    '<div class="grow"><div class="t">' + esc(m.name) + '</div>' +
    '<div class="s">' + esc((m.city ? m.city + ' · ' : '') + ((m.hobbies || []).slice(0, 3).join(', ') || 'Croma regular')) + '</div></div>' + btn + '</div>';
}
function reqRow(m) {
  return '<div class="item" data-open="' + esc(m.id) + '">' + avatarHTML(m, 'md') +
    '<div class="grow"><div class="t">' + esc(m.name) + '</div><div class="s">wants to connect</div></div>' +
    '<div class="row-gap"><button class="btn primary sm" data-act="accept" data-id="' + esc(m.id) + '">Accept</button>' +
    '<button class="btn ghost sm" data-act="ignore" data-id="' + esc(m.id) + '">Ignore</button></div></div>';
}

registerView('memberProfile', {
  title: 'Profile',
  nav: false,
  render: function (host, p) {
    host.innerHTML = skeletonList(2);
    api('memberProfile', { memberId: p.memberId }).then(function (r) {
      var m = r && r.member; if (!m) { host.innerHTML = emptyState('❓', 'Member not found'); return; }
      host.innerHTML =
        '<div class="profile-head">' + avatarHTML(m, 'xl') +
          '<div class="pn">' + esc(m.name) + '</div>' +
          '<div class="muted small">' + esc(m.city || '') + '</div></div>' +
        (m.bio ? '<div class="card center" style="margin-top:14px">' + esc(m.bio) + '</div>' : '') +
        (m.hobbies && m.hobbies.length ? '<div class="section-title">Interests</div><div class="chips">' +
          m.hobbies.map(function (h) { return '<span class="chip soft">' + esc(h) + '</span>'; }).join('') + '</div>' : '') +
        '<div class="mt16" id="mpActions"></div>';
      var st = m.status || 'none', acts = '';
      if (st === 'connected') acts = '<button class="btn accent block big" id="mpMsg">💬 Message</button>';
      else if (st === 'incoming') acts = '<button class="btn primary block big" id="mpAccept">Accept request</button>';
      else if (st === 'pending') acts = '<button class="btn ghost block big" disabled>Request sent</button>';
      else acts = '<button class="btn primary block big" id="mpConnect">Connect</button>';
      $('#mpActions').innerHTML = acts;
      var b;
      if ((b = $('#mpMsg'))) b.addEventListener('click', function () { openChatWith(m.id); });
      if ((b = $('#mpConnect'))) b.addEventListener('click', function () { api('connect', { memberId: m.id }).then(function () { toast('Request sent.'); renderCurrent(); }); });
      if ((b = $('#mpAccept'))) b.addEventListener('click', function () { api('respondConnection', { memberId: m.id, accept: true }).then(function () { toast('Connected! 🎉'); renderCurrent(); }); });
    });
  },
});
