/* ============================================================================
   admin.js — in-app admin panel (owner/admin only; role auto-granted from the
   shared POS Employees). Sections: Overview, Events, Reservations, Inquiries,
   Members, Posts (moderation), Rewards.
   ========================================================================== */
function toLocalInput(s) {
  var d = parseDT(s); if (!d) return '';
  function p(n) { return ('0' + n).slice(-2); }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
}

registerView('admin', {
  title: 'Admin',
  nav: false,
  render: function (host) {
    var SECTIONS = [
      { id: 'dash', label: 'Overview' }, { id: 'events', label: 'Events' },
      { id: 'reservations', label: 'Reservations' }, { id: 'inquiries', label: 'Inquiries' },
      { id: 'members', label: 'Members' }, { id: 'posts', label: 'Posts' }, { id: 'rewards', label: 'Rewards' }
    ];
    var active = S.cache.adminSection || 'dash';
    host.innerHTML =
      '<div class="chips" style="overflow-x:auto;flex-wrap:nowrap;padding-bottom:6px;margin-bottom:14px" id="admTabs">' +
      SECTIONS.map(function (s) { return '<span class="chip' + (s.id === active ? ' on' : '') + '" data-sec="' + s.id + '" style="white-space:nowrap">' + s.label + '</span>'; }).join('') +
      '</div><div id="admBody"></div>';
    $$('#admTabs .chip').forEach(function (c) { c.addEventListener('click', function () {
      S.cache.adminSection = c.dataset.sec;
      $$('#admTabs .chip').forEach(function (x) { x.classList.remove('on'); }); c.classList.add('on');
      renderSection(c.dataset.sec);
    }); });
    renderSection(active);

    function renderSection(sec) {
      var body = $('#admBody'); body.innerHTML = skeletonList(3);
      ({ dash: dash, events: events, reservations: reservations, inquiries: inquiries, members: members, posts: posts, rewards: rewards }[sec] || dash)(body);
    }

    // ---- overview ----
    function dash(body) {
      api('adminSummary').then(function (r) {
        if (!r || !r.ok) { body.innerHTML = emptyState('🔒', (r && r.error) || 'Admins only'); return; }
        body.innerHTML =
          '<div class="stat-row"><div class="stat"><div class="v">' + r.pendingReservations + '</div><div class="l">Pending bookings</div></div>' +
          '<div class="stat"><div class="v">' + r.openInquiries + '</div><div class="l">Open inquiries</div></div></div>' +
          '<div class="stat-row"><div class="stat"><div class="v">' + r.members + '</div><div class="l">Members</div></div>' +
          '<div class="stat"><div class="v">' + r.posts + '</div><div class="l">Posts</div></div></div>' +
          '<div class="muted small center mt16">You\'re an admin because your email matches a POS owner/admin. Use the tabs above to manage the community.</div>';
      });
    }

    // ---- events ----
    function events(body) {
      api('adminEvents').then(function (r) {
        var evs = (r && r.events) || [];
        body.innerHTML = '<button class="btn primary block big mb8" id="admAddEvent">+ Add event</button>' +
          (evs.length ? '<div class="list">' + evs.map(function (e) {
            return '<div class="item" data-ev="' + esc(e.id) + '"><div class="grow"><div class="t">' + esc(e.title) + (e.active ? '' : ' <span class="badge red">Hidden</span>') + '</div>' +
              '<div class="s">' + esc(fmtEventWhen(e.startAt)) + ' · ' + e.going + ' going</div></div><div class="chev">›</div></div>';
          }).join('') + '</div>' : emptyState('🎉', 'No events yet'));
        $('#admAddEvent').addEventListener('click', function () { editEvent(null); });
        $$('#admBody [data-ev]').forEach(function (row) { row.addEventListener('click', function () { editEvent(evs.filter(function (x) { return x.id === row.dataset.ev; })[0]); }); });
      });
    }
    function editEvent(ev) {
      ev = ev || {};
      modal('<h3>' + (ev.id ? 'Edit event' : 'Add event') + '</h3>' +
        '<label class="lbl">Title</label><input class="field" id="evT" value="' + esc(ev.title || '') + '"/>' +
        '<label class="lbl">Date &amp; time</label><input class="field" id="evS" type="datetime-local" value="' + esc(toLocalInput(ev.startAt)) + '"/>' +
        '<label class="lbl">Location</label><input class="field" id="evL" value="' + esc(ev.location || 'Croma MNL Café') + '"/>' +
        '<label class="lbl">Capacity (0 = no limit)</label><input class="field" id="evC" type="number" min="0" value="' + (ev.capacity || 0) + '"/>' +
        '<label class="lbl">Description</label><textarea class="field" id="evD">' + esc(ev.description || '') + '</textarea>' +
        (ev.id ? '<label class="lbl" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="evA" style="width:auto" ' + (ev.active !== false ? 'checked' : '') + '/> Visible in the app</label>' : '') +
        '<div class="modal-actions">' + (ev.id ? '<button class="btn ghost danger" id="evDel">Delete</button>' : '') +
        '<button class="btn ghost" id="evX">Cancel</button><button class="btn primary" id="evSave">Save</button></div>');
      $('#evX').addEventListener('click', closeModal);
      var del = $('#evDel'); if (del) del.addEventListener('click', function () {
        api('adminDeleteEvent', { id: ev.id }).then(function (r) { if (r && r.ok) { closeModal(); swrDrop('events', 'home', 'myEvents'); toast('Deleted.'); renderSection('events'); } else toast((r && r.error) || 'Error'); });
      });
      $('#evSave').addEventListener('click', function () {
        var payload = { id: ev.id || '', title: $('#evT').value.trim(), startAt: $('#evS').value, location: $('#evL').value.trim(), capacity: Number($('#evC').value) || 0, description: $('#evD').value.trim() };
        if (ev.id) payload.active = $('#evA') ? $('#evA').checked : true;
        if (!payload.title || !payload.startAt) { toast('Title and date/time are required.'); return; }
        this.disabled = true;
        api('adminSaveEvent', { event: payload }).then(function (r) { if (r && r.ok) { closeModal(); swrDrop('events', 'home', 'myEvents'); toast('Saved.'); renderSection('events'); } else { toast((r && r.error) || 'Error'); } });
      });
    }

    // ---- reservations ----
    function reservations(body) {
      api('adminReservations').then(function (r) {
        var list = (r && r.reservations) || [];
        body.innerHTML = list.length ? list.map(function (v) {
          var badge = v.status === 'confirmed' ? 'green' : v.status === 'cancelled' ? 'red' : 'amber';
          var acts = v.status === 'cancelled' ? '' : '<button class="btn primary sm" data-conf="' + esc(v.id) + '">Confirm</button> <button class="btn ghost danger sm" data-canc="' + esc(v.id) + '">Cancel</button>';
          return '<div class="card"><div class="spread"><div><div style="font-weight:700">' + esc(fmtDate(v.date)) + ' · ' + esc(v.time) + '</div>' +
            '<div class="muted small mt8">' + esc(v.name) + ' · party of ' + esc(v.partySize) + (v.phone ? ' · ' + esc(v.phone) : '') + (v.notes ? ' · ' + esc(v.notes) : '') + '</div></div>' +
            '<span class="badge ' + badge + '">' + esc(v.status) + '</span></div>' + (acts ? '<div class="row-gap" style="margin-top:12px">' + acts + '</div>' : '') + '</div>';
        }).join('') : emptyState('📅', 'No reservations');
        $$('#admBody [data-conf]').forEach(function (b) { b.addEventListener('click', function () { resStatus(b.dataset.conf, 'confirmed'); }); });
        $$('#admBody [data-canc]').forEach(function (b) { b.addEventListener('click', function () { resStatus(b.dataset.canc, 'cancelled'); }); });
      });
    }
    function resStatus(id, status) { api('adminReservationStatus', { id: id, status: status }).then(function (r) { if (r && r.ok) { toast('Reservation ' + status + '.'); renderSection('reservations'); } else toast((r && r.error) || 'Error'); }); }

    // ---- inquiries ----
    function inquiries(body) {
      api('adminInquiries').then(function (r) {
        var list = (r && r.inquiries) || [];
        body.innerHTML = list.length ? list.map(function (q) {
          return '<div class="card"><div class="spread"><div style="font-weight:700">' + esc(q.subject) + '</div><span class="badge ' + (q.status === 'answered' ? 'green' : 'amber') + '">' + esc(q.status) + '</span></div>' +
            '<div class="muted small mt8">' + esc(q.name || '') + (q.email ? ' · ' + esc(q.email) : '') + ' · ' + esc(timeAgo(q.createdAt)) + '</div>' +
            '<div style="margin-top:8px;font-size:14px">' + esc(q.message) + '</div>' +
            (q.reply ? '<div class="card" style="background:var(--surface2);box-shadow:none;margin:10px 0 0"><div class="small" style="font-weight:700;color:var(--brand)">Your reply</div><div style="font-size:14px;margin-top:4px">' + esc(q.reply) + '</div></div>' : '') +
            '<button class="btn ghost sm" style="margin-top:10px" data-reply="' + esc(q.id) + '">' + (q.status === 'answered' ? 'Edit reply' : 'Reply') + '</button></div>';
        }).join('') : emptyState('✉️', 'No inquiries');
        $$('#admBody [data-reply]').forEach(function (b) { b.addEventListener('click', function () { replyInq(list.filter(function (x) { return x.id === b.dataset.reply; })[0]); }); });
      });
    }
    function replyInq(q) {
      modal('<h3>' + esc(q.subject) + '</h3><div class="muted small mb8">From ' + esc(q.name || 'member') + (q.email ? ' · ' + esc(q.email) : '') + '</div>' +
        '<div class="card" style="background:var(--surface2);box-shadow:none">' + esc(q.message) + '</div>' +
        '<label class="lbl">Your reply' + (q.email ? ' (also emailed to the member)' : '') + '</label><textarea class="field" id="inqR">' + esc(q.reply || '') + '</textarea>' +
        '<div class="modal-actions"><button class="btn ghost" id="inqX">Cancel</button><button class="btn primary" id="inqSend">Send</button></div>');
      $('#inqX').addEventListener('click', closeModal);
      $('#inqSend').addEventListener('click', function () { var reply = $('#inqR').value.trim(); if (!reply) { toast('Write a reply.'); return; } this.disabled = true;
        api('adminReplyInquiry', { id: q.id, reply: reply }).then(function (r) { if (r && r.ok) { closeModal(); toast('Reply sent.'); renderSection('inquiries'); } else { toast((r && r.error) || 'Error'); } }); });
    }

    // ---- members (open + moderate) ----
    function members(body) {
      body.innerHTML = '<input class="field" id="admMemQ" placeholder="Search members by name or email…"/><div id="admMemList">' + skeletonList(3) + '</div>';
      var t; $('#admMemQ').addEventListener('input', function () { var q = this.value.trim(); clearTimeout(t); t = setTimeout(function () { loadMembers(q); }, 250); });
      loadMembers('');
      function loadMembers(q) {
        api('adminMembers', { q: q }).then(function (r) {
          var list = (r && r.members) || [];
          $('#admMemList').innerHTML = list.length ? '<div class="list">' + list.map(function (m) {
            var tag = m.role === 'admin' ? ' <span class="badge soft">admin</span>' : (m.active ? '' : ' <span class="badge red">banned</span>');
            return '<div class="item">' + avatarHTML(m, 'sm') + '<div class="grow"><div class="t">' + esc(m.name) + tag + '</div><div class="s">' + esc(m.email || m.phone || '') + '</div></div>' +
              (m.id === (S.me && S.me.id) ? '<span class="muted small">you</span>' : '<button class="btn ghost small" data-mem="' + esc(m.id) + '">Manage</button>') + '</div>';
          }).join('') + '</div>' : emptyState('👥', 'No members found');
          $$('#admMemList [data-mem]').forEach(function (b) { b.addEventListener('click', function () { manageMember(list.filter(function (x) { return x.id === b.dataset.mem; })[0], loadMembers, q); }); });
        });
      }
      function manageMember(m, reload, q) {
        modal('<h3>' + esc(m.name) + '</h3><div class="muted small mb8">' + esc(m.email || m.phone || '') + (m.role === 'admin' ? ' · admin' : '') + '</div>' +
          '<div class="modal-actions" style="flex-direction:column">' +
          (m.active ? '<button class="btn ghost danger block" id="memBan">Ban (block sign-in)</button>' : '<button class="btn ghost block" id="memUnban">Un-ban</button>') +
          '<button class="btn ghost danger block" id="memDel">Remove permanently</button>' +
          '<button class="btn ghost block" id="memX">Close</button></div>');
        $('#memX').addEventListener('click', closeModal);
        function act(action, msg) { api('adminMemberAction', { memberId: m.id, action: action }).then(function (r) { if (r && r.ok) { closeModal(); swrDrop('members', 'myConnections', 'home'); toast(msg); reload(q); } else toast((r && r.error) || 'Error'); }); }
        var b; if ((b = $('#memBan'))) b.addEventListener('click', function () { act('ban', 'Member banned.'); });
        if ((b = $('#memUnban'))) b.addEventListener('click', function () { act('unban', 'Member un-banned.'); });
        $('#memDel').addEventListener('click', function () { if (this.dataset.armed) act('delete', 'Member removed.'); else { this.dataset.armed = '1'; this.textContent = 'Tap again to confirm removal'; } });
      }
    }

    // ---- feed moderation ----
    function posts(body) {
      api('adminPosts').then(function (r) {
        var list = (r && r.posts) || [];
        body.innerHTML = list.length ? list.map(function (p) {
          return '<div class="card"><div class="spread"><div style="font-weight:600">' + esc(p.name) + (p.active ? '' : ' <span class="badge red">Hidden</span>') + '</div><div class="muted small">' + esc(timeAgo(p.createdAt)) + '</div></div>' +
            '<div style="margin-top:6px;font-size:14px;white-space:pre-wrap;word-break:break-word">' + esc(p.text) + '</div>' +
            (p.imageUrl ? '<img src="' + esc(p.imageUrl) + '" style="width:100%;border-radius:10px;margin-top:8px"/>' : '') +
            '<div class="row-gap" style="margin-top:10px">' +
            (p.active ? '<button class="btn ghost small" data-hide="' + esc(p.id) + '">Hide</button>' : '<button class="btn ghost small" data-show="' + esc(p.id) + '">Un-hide</button>') +
            '<button class="btn ghost small danger" data-delp="' + esc(p.id) + '">Delete</button></div></div>';
        }).join('') : emptyState('📝', 'No posts');
        $$('#admBody [data-hide]').forEach(function (b) { b.addEventListener('click', function () { hidePost(b.dataset.hide, true); }); });
        $$('#admBody [data-show]').forEach(function (b) { b.addEventListener('click', function () { hidePost(b.dataset.show, false); }); });
        $$('#admBody [data-delp]').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.armed) delPost(b.dataset.delp); else { b.dataset.armed = '1'; b.textContent = 'Confirm delete'; } }); });
      });
    }
    function hidePost(id, hide) { api('adminHidePost', { postId: id, hide: hide }).then(function (r) { if (r && r.ok) { swrDrop('home', 'feed'); toast(hide ? 'Post hidden.' : 'Post visible.'); renderSection('posts'); } else toast((r && r.error) || 'Error'); }); }
    function delPost(id) { api('adminDeletePost', { postId: id }).then(function (r) { if (r && r.ok) { swrDrop('home', 'feed'); toast('Post deleted.'); renderSection('posts'); } else toast((r && r.error) || 'Error'); }); }

    // ---- rewards catalog ----
    function rewards(body) {
      api('adminRewards').then(function (r) {
        var list = (r && r.rewards) || [];
        body.innerHTML = '<button class="btn primary block big mb8" id="admAddRw">+ Add reward</button>' +
          (list.length ? '<div class="list">' + list.map(function (rw) {
            return '<div class="item" data-rw="' + esc(rw.id) + '"><div class="grow"><div class="t">' + esc(rw.title) + (rw.active ? '' : ' <span class="badge red">Off</span>') + '</div><div class="s">★ ' + rw.cost + ' pts' + (rw.description ? ' · ' + esc(rw.description) : '') + '</div></div><div class="chev">›</div></div>';
          }).join('') + '</div>' : emptyState('★', 'No rewards'));
        $('#admAddRw').addEventListener('click', function () { editReward(null); });
        $$('#admBody [data-rw]').forEach(function (row) { row.addEventListener('click', function () { editReward(list.filter(function (x) { return x.id === row.dataset.rw; })[0]); }); });
      });
    }
    function editReward(rw) {
      rw = rw || {};
      modal('<h3>' + (rw.id ? 'Edit reward' : 'Add reward') + '</h3>' +
        '<label class="lbl">Title</label><input class="field" id="rwT" value="' + esc(rw.title || '') + '"/>' +
        '<label class="lbl">Points cost</label><input class="field" id="rwC" type="number" min="1" value="' + (rw.cost || 50) + '"/>' +
        '<label class="lbl">Description</label><input class="field" id="rwD" value="' + esc(rw.description || '') + '"/>' +
        (rw.id ? '<label class="lbl" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="rwA" style="width:auto" ' + (rw.active !== false ? 'checked' : '') + '/> Available to redeem</label>' : '') +
        '<div class="modal-actions">' + (rw.id ? '<button class="btn ghost danger" id="rwDel">Delete</button>' : '') +
        '<button class="btn ghost" id="rwX">Cancel</button><button class="btn primary" id="rwSave">Save</button></div>');
      $('#rwX').addEventListener('click', closeModal);
      var del = $('#rwDel'); if (del) del.addEventListener('click', function () { api('adminDeleteReward', { id: rw.id }).then(function (r) { if (r && r.ok) { closeModal(); toast('Deleted.'); renderSection('rewards'); } else toast((r && r.error) || 'Error'); }); });
      $('#rwSave').addEventListener('click', function () {
        var payload = { id: rw.id || '', title: $('#rwT').value.trim(), cost: Number($('#rwC').value) || 0, description: $('#rwD').value.trim() };
        if (rw.id) payload.active = $('#rwA') ? $('#rwA').checked : true;
        if (!payload.title || payload.cost <= 0) { toast('Title and a points cost are required.'); return; }
        this.disabled = true;
        api('adminSaveReward', { reward: payload }).then(function (r) { if (r && r.ok) { closeModal(); toast('Saved.'); renderSection('rewards'); } else { toast((r && r.error) || 'Error'); } });
      });
    }
  }
});
