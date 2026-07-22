/* ============================================================================
   profile.js — your profile, interests, quick links, edit, and logout.
   ========================================================================== */
registerView('profile', {
  tab: 'profile',
  title: 'Profile',
  actions: function () { return '<button class="iconbtn" id="pfEdit" title="Edit">✏️</button>'; },
  onAppbar: function () { var b = $('#pfEdit'); if (b) b.addEventListener('click', function () { go('editProfile'); }); },
  render: function (host) {
    var m = S.me || {};
    host.innerHTML =
      '<div class="profile-head"><div class="avatar-edit" id="pfAvatar">' + avatarHTML(m, 'xl') + '<div class="cam">📷</div></div>' +
        '<div class="pn">' + esc(m.name || 'You') + '</div>' +
        '<div class="muted small">' + esc([m.city, m.email || m.phone].filter(Boolean).join(' · ')) + '</div></div>' +
      '<div class="stat-row" id="pfStats">' +
        '<div class="stat"><div class="v" id="pfConn">–</div><div class="l">Connections</div></div>' +
        '<div class="stat"><div class="v">' + ((m.hobbies || []).length) + '</div><div class="l">Interests</div></div></div>' +
      (m.bio ? '<div class="card center">' + esc(m.bio) + '</div>' : '') +
      (m.hobbies && m.hobbies.length ? '<div class="section-title">Interests</div><div class="chips">' +
        m.hobbies.map(function (h) { return '<span class="chip soft">' + esc(h) + '</span>'; }).join('') + '</div>' : '') +
      (S.me && (S.me.role === 'admin' || S.me.role === 'owner') ?
        '<div class="section-title">Staff</div><div class="list">' +
          navItem('admin', '🛡️', 'Admin panel', 'Manage events, bookings, members & rewards') + '</div>' : '') +
      '<div class="section-title">Your activity</div>' +
      '<div class="list">' +
        navItem('rewards', '★', 'Rewards & points', 'Redeem your loyalty points') +
        navItem('history', '🧾', 'My orders', 'Purchase history from the café') +
        navItem('myEvents', '🎉', 'My events', 'Events you\'re attending') +
        navItem('reserve', '📅', 'My reservations', 'Upcoming table bookings') +
        navItem('inquiries', '✉️', 'My inquiries', 'Questions & replies') +
      '</div>' +
      '<div class="section-title">Account</div>' +
      '<div class="list">' +
        '<div class="item" id="pfEdit2">' + '<div style="font-size:19px;width:34px;text-align:center">⚙️</div><div class="grow"><div class="t">Edit profile</div></div><div class="chev">›</div></div>' +
        '<div class="item" id="pfLogout"><div style="font-size:19px;width:34px;text-align:center">🚪</div><div class="grow"><div class="t" style="color:var(--red)">Log out</div></div></div>' +
      '</div>' +
      '<div class="center muted small mt16">' + esc(CROMA.APP_NAME + ' · ' + CROMA.VERSION) + '</div>';

    $$('#viewBody [data-nav]').forEach(function (it) { it.addEventListener('click', function () { go(it.dataset.nav); }); });
    $('#pfAvatar').addEventListener('click', changeAvatar);
    $('#pfEdit2').addEventListener('click', function () { go('editProfile'); });
    $('#pfLogout').addEventListener('click', doLogout);
    apiSWR('myConnections', {}, function (r) { var n = ((r && r.connections) || []).length; var e = $('#pfConn'); if (e) e.textContent = n; });
  },
});
function navItem(view, ic, title, sub) {
  return '<div class="item" data-nav="' + view + '"><div style="font-size:19px;width:34px;text-align:center">' + ic + '</div>' +
    '<div class="grow"><div class="t">' + title + '</div><div class="s">' + sub + '</div></div><div class="chev">›</div></div>';
}
function changeAvatar() {
  pickImage(function (dataUrl) {
    toast('Uploading…');
    api('uploadAvatar', { dataUrl: dataUrl }).then(function (r) {
      if (r && r.ok) { S.me.avatarUrl = r.avatarUrl || dataUrl; saveSession(); swrDrop('home', 'members', 'myConnections'); toast('Photo updated ✓'); renderCurrent(); }
      else toast((r && r.error) || 'Upload failed.');
    });
  });
}
function doLogout() {
  modal('<h3>Log out?</h3><p class="muted">You can sign back in anytime.</p>' +
    '<div class="modal-actions"><button class="btn ghost" id="loCancel">Cancel</button>' +
    '<button class="btn danger" id="loYes">Log out</button></div>');
  $('#loCancel').addEventListener('click', closeModal);
  $('#loYes').addEventListener('click', function () { api('logout'); closeModal(); showAuth(); });
}

registerView('myEvents', {
  title: 'My events',
  nav: false,
  render: function (host) {
    host.innerHTML = '<div id="meList">' + skeletonList(2) + '</div>';
    api('myEvents').then(function (r) {
      var evs = (r && r.events) || [];
      $('#meList').innerHTML = evs.length ? evs.map(Events.cardHTML).join('')
        : emptyState('🎟️', 'No events yet', 'RSVP to events and they\'ll appear here.');
      Events.wireCards($('#meList'));
    });
  },
});

registerView('editProfile', {
  title: 'Edit profile',
  nav: false,
  render: function (host) {
    var m = S.me || {}; var hobbies = (m.hobbies || []).slice();
    host.innerHTML =
      '<div class="profile-head"><div class="avatar-edit" id="epAvatar">' + avatarHTML(m, 'xl') + '<div class="cam">📷</div></div></div>' +
      '<div class="card">' +
        '<label class="lbl">Name</label><input class="field" id="epName" value="' + esc(m.name || '') + '"/>' +
        '<label class="lbl">City</label><input class="field" id="epCity" value="' + esc(m.city || '') + '"/>' +
        '<label class="lbl">Phone</label><input class="field" id="epPhone" type="tel" value="' + esc(m.phone || '') + '"/>' +
        '<label class="lbl">Bio</label><textarea class="field" id="epBio" maxlength="160">' + esc(m.bio || '') + '</textarea>' +
        '<label class="lbl">Interests <span class="muted">(tap to remove, or add below)</span></label>' +
        '<div class="chips" id="epHobbies"></div>' +
        '<input class="field mt8" id="epAddHobby" placeholder="Add an interest + Enter"/>' +
      '</div>' +
      '<button class="btn primary block big" id="epSave">Save changes</button>';
    drawHobbies();
    $('#epAvatar').addEventListener('click', changeAvatar);
    $('#epAddHobby').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && this.value.trim()) { var h = this.value.trim(); this.value = ''; if (hobbies.indexOf(h) < 0) { hobbies.push(h); drawHobbies(); } }
    });
    $('#epSave').addEventListener('click', function () {
      var btn = this; btn.disabled = true;
      api('updateProfile', { name: $('#epName').value.trim(), city: $('#epCity').value.trim(),
        phone: $('#epPhone').value.trim(), bio: $('#epBio').value.trim(), hobbies: hobbies }).then(function (r) {
        btn.disabled = false;
        if (r && r.ok) { S.me = r.member || S.me; saveSession(); swrDrop('home', 'members', 'myConnections'); toast('Saved ✓'); go('profile'); }
        else toast((r && r.error) || 'Could not save.');
      });
    });
    function drawHobbies() {
      $('#epHobbies').innerHTML = hobbies.map(function (h, i) { return '<span class="chip on" data-i="' + i + '">' + esc(h) + ' ✕</span>'; }).join('') || '<span class="muted small">No interests yet.</span>';
      $$('#epHobbies .chip').forEach(function (c) { c.addEventListener('click', function () { hobbies.splice(parseInt(c.dataset.i, 10), 1); drawHobbies(); }); });
    }
  },
});
