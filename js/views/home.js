/* ============================================================================
   home.js — dashboard: greeting, quick actions, next event, community feed.
   ========================================================================== */
registerView('home', {
  tab: 'home',
  actions: function () { return '<button class="iconbtn" id="hbInquire" title="Ask us">✉️</button>'; },
  onAppbar: function () { var b = $('#hbInquire'); if (b) b.addEventListener('click', function () { go('inquiries'); }); },
  render: function (host) {
    var greet = greeting();
    host.innerHTML =
      '<div class="hero"><div class="spread">' +
        '<div><div class="hi">' + greet + ',</div><div class="name">' + esc(firstName(S.me && S.me.name)) + '</div></div>' +
        avatarHTML(S.me, 'lg') +
      '</div><div class="meta" id="heroMeta"></div></div>' +
      '<div class="card tap" data-q="rewards" style="display:flex;align-items:center;gap:12px;margin-bottom:14px">' +
        '<div style="font-size:24px">★</div><div class="grow" style="flex:1">' +
        '<div style="font-weight:700">Rewards</div><div class="muted small" id="loyStripSub">View your points</div></div>' +
        '<div class="chev">›</div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:4px">' +
        qtile('reserve', '📅', 'Reserve a table') +
        qtile('events', '🎉', 'Events') +
        qtile('history', '🧾', 'My orders') +
        qtile('inquiries', '💬', 'Ask us') +
      '</div>' +
      '<div id="nextEvent"></div>' +
      '<div class="section-title">Community feed <a id="feedRefresh">Refresh</a></div>' +
      '<div class="composer" id="composer">' + avatarHTML(S.me, 'md') +
        '<input class="field" id="composerInput" placeholder="Share something with the community…" readonly/></div>' +
      '<div id="feed">' + skeletonList(3) + '</div>';

    $$('#viewBody [data-q]').forEach(function (t) { t.addEventListener('click', function () { go(t.dataset.q); }); });
    $('#composer').addEventListener('click', Feed.compose);
    $('#feedRefresh').addEventListener('click', function () { load(); });
    load();

    function load() {
      apiSWR('home', {}, function (r) {
        if (!r || !r.ok) return;
        if (r.member) { S.me = r.member; saveSession(); }
        S.unread = r.unreadChat || 0; renderTabbar(Views.home);
        $('#heroMeta').innerHTML =
          '<span>👥 ' + (r.connections || 0) + ' connections</span>' +
          (r.requests ? '<span>🙋 ' + r.requests + ' request' + (r.requests > 1 ? 's' : '') + '</span>' : '') +
          (r.unreadChat ? '<span>💬 ' + r.unreadChat + ' unread</span>' : '');
        if (r.points != null) { var sub = $('#loyStripSub'); if (sub) sub.innerHTML = '<strong>' + r.points + ' points</strong> · ' + esc(r.tier || 'Bronze') + ' tier'; }
        $('#nextEvent').innerHTML = r.nextEvent ? '<div class="section-title">Next up</div>' + Events.cardHTML(r.nextEvent) : '';
        if (r.nextEvent) Events.wireCards($('#nextEvent'));
        Feed.renderInto($('#feed'), r.feed || []);
      });
    }
  },
});

function greeting() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
function firstName(n) { return String(n || 'there').trim().split(/\s+/)[0]; }
function qtile(q, ic, label) {
  return '<div class="card tap" data-q="' + q + '" style="margin:0;display:flex;align-items:center;gap:12px;padding:15px">' +
    '<div style="font-size:24px">' + ic + '</div><div style="font-weight:600;font-size:14px;line-height:1.2">' + label + '</div></div>';
}

/* ------------------------------------------------------------------ Feed (shared) */
var Feed = (function () {
  function postCardHTML(p) {
    var mine = p.memberId === (S.me && S.me.id);
    return '<div class="post" data-post="' + esc(p.id) + '">' +
      '<div class="phead">' + avatarHTML({ name: p.name, avatarUrl: p.avatarUrl }, 'md') +
        '<div class="grow" style="flex:1"><div class="pname">' + esc(p.name) + '</div>' +
        '<div class="ptime">' + esc(timeAgo(p.createdAt)) + (mine ? ' · you' : '') + '</div></div></div>' +
      '<div class="ptext">' + linkify(p.text) + '</div>' +
      (p.imageUrl ? '<img class="pimg" src="' + esc(p.imageUrl) + '" alt=""/>' : '') +
      '<div class="pacts">' +
        '<button data-act="like" class="' + (p.liked ? 'liked' : '') + '">' + (p.liked ? '❤️' : '🤍') + ' <span class="lc">' + (p.likeCount || 0) + '</span></button>' +
        '<button data-act="comment">💬 <span>' + (p.commentCount || 0) + '</span></button>' +
      '</div></div>';
  }
  function linkify(t) { return esc(t).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }

  function renderInto(elm, posts) {
    if (!posts.length) { elm.innerHTML = emptyState('📝', 'No posts yet', 'Be the first to share something.'); return; }
    elm.innerHTML = posts.map(postCardHTML).join('');
    $$('.post', elm).forEach(function (card) { wireCard(card); });
  }
  function wireCard(card) {
    var pid = card.dataset.post;
    card.querySelector('[data-act="like"]').addEventListener('click', function () {
      var btn = this, liked = btn.classList.toggle('liked');
      btn.firstChild.textContent = liked ? '❤️ ' : '🤍 ';
      var lc = btn.querySelector('.lc'); lc.textContent = Math.max(0, (parseInt(lc.textContent, 10) || 0) + (liked ? 1 : -1));
      api('likePost', { postId: pid });
    });
    card.querySelector('[data-act="comment"]').addEventListener('click', function () { openComments(pid); });
  }
  function compose() {
    var img = '';
    modal('<h3>Share with the community</h3>' +
      '<textarea class="field" id="cpText" maxlength="500" placeholder="What\'s on your mind?" style="min-height:110px"></textarea>' +
      '<div id="cpPreview"></div>' +
      '<button class="btn ghost block" id="cpPhoto">📷 Add photo</button>' +
      '<div class="modal-actions"><button class="btn ghost" id="cpCancel">Cancel</button>' +
      '<button class="btn primary" id="cpPost">Post</button></div>');
    $('#cpCancel').addEventListener('click', closeModal);
    $('#cpPhoto').addEventListener('click', function () { pickImage(function (d) { img = d; $('#cpPreview').innerHTML = '<img src="' + d + '" style="width:100%;border-radius:12px;margin:8px 0"/>'; }); });
    $('#cpPost').addEventListener('click', function () {
      var text = $('#cpText').value.trim();
      if (!text && !img) { toast('Write something or add a photo.'); return; }
      this.disabled = true;
      api('createPost', { text: text, imageUrl: img }).then(function (r) {
        closeModal();
        if (r && r.ok) { swrDrop('home', 'feed'); toast('Posted!'); if (current().name === 'home') renderCurrent(); }
        else toast((r && r.error) || 'Could not post.');
      });
    });
  }
  function openComments(pid) {
    modal('<h3>Comments</h3><div id="cmList">' + skeletonList(2) + '</div>' +
      '<div class="composer" style="margin:12px 0 0">' + avatarHTML(S.me, 'sm') +
      '<input class="field" id="cmInput" placeholder="Add a comment…"/></div>' +
      '<div class="modal-actions"><button class="btn primary block" id="cmSend">Send</button></div>');
    function draw() {
      api('listComments', { postId: pid }).then(function (r) {
        var list = (r && r.comments) || [];
        $('#cmList').innerHTML = list.length ? list.map(function (c) {
          return '<div style="display:flex;gap:10px;margin-bottom:12px">' + avatarHTML({ name: c.name }, 'sm') +
            '<div><div style="font-weight:600;font-size:13px">' + esc(c.name) + ' <span class="muted small">· ' + esc(timeAgo(c.createdAt)) + '</span></div>' +
            '<div style="font-size:14px">' + esc(c.text) + '</div></div></div>';
        }).join('') : '<div class="muted small center" style="padding:14px">No comments yet.</div>';
      });
    }
    draw();
    $('#cmSend').addEventListener('click', function () {
      var t = $('#cmInput').value.trim(); if (!t) return;
      $('#cmInput').value = '';
      api('commentPost', { postId: pid, text: t }).then(draw);
    });
    $('#cmInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#cmSend').click(); });
  }
  return { renderInto: renderInto, compose: compose, postCardHTML: postCardHTML };
})();
