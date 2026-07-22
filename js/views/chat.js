/* ============================================================================
   chat.js — conversations list (Chat tab) + a live 1:1 conversation.
   Messages refresh by polling every few seconds (Apps Script has no push).
   ========================================================================== */
registerView('chat', {
  tab: 'chat',
  title: 'Messages',
  render: function (host) {
    host.innerHTML = '<div id="thList">' + skeletonList(3) + '</div>';
    apiSWR('threads', {}, function (r) {
      var list = (r && r.threads) || [];
      S.unread = list.reduce(function (a, t) { return a + (t.unread || 0); }, 0); renderTabbar(Views.chat);
      $('#thList').innerHTML = list.length ? '<div class="list">' + list.map(threadRow).join('') + '</div>'
        : emptyState('💬', 'No messages yet', 'Connect with members in the Community tab to start chatting.');
      $$('#thList [data-thread]').forEach(function (row) {
        row.addEventListener('click', function () { go('conversation', { threadId: row.dataset.thread, name: row.dataset.name }); });
      });
    });
  },
});
function threadRow(t) {
  return '<div class="item" data-thread="' + esc(t.id) + '" data-name="' + esc(t.name) + '">' + avatarHTML(t, 'md') +
    '<div class="grow"><div class="t">' + esc(t.name) + '</div><div class="s">' + esc(t.lastText || 'Say hello 👋') + '</div></div>' +
    '<div style="text-align:right"><div class="small muted">' + esc(timeAgo(t.lastMessageAt)) + '</div>' +
    (t.unread ? '<span class="badge red" style="margin-top:4px">' + t.unread + '</span>' : '') + '</div></div>';
}

// open (or create) a conversation with a member, then navigate to it
function openChatWith(memberId) {
  api('openThread', { memberId: memberId }).then(function (r) {
    if (!r || !r.ok) { toast((r && r.error) || 'Could not open chat.'); return; }
    go('conversation', { threadId: r.thread.id, name: r.thread.name });
  });
}

registerView('conversation', {
  nav: false,
  title: function (p) { return p.name || 'Chat'; },
  render: function (host, p) {
    host.className = '';           // edge-to-edge chat (no body padding)
    host.innerHTML =
      '<div class="chat-wrap"><div class="chat-scroll" id="chatScroll"></div>' +
      '<div class="chat-input"><input class="field" id="msgInput" placeholder="Message…" autocomplete="off"/>' +
      '<button class="btn accent" id="msgSend" style="border-radius:22px;padding:0 18px">➤</button></div></div>';
    var scroll = $('#chatScroll'), lastCount = -1;

    function draw(scrollDown) {
      api('messages', { threadId: p.threadId }).then(function (r) {
        var msgs = (r && r.messages) || [];
        if (msgs.length === lastCount) return; lastCount = msgs.length;
        var out = '', lastDay = '';
        msgs.forEach(function (m) {
          var d = parseDT(m.createdAt), day = d ? fmtDate(d) : '';
          if (day && day !== lastDay) { out += '<div class="day-sep">' + esc(day) + '</div>'; lastDay = day; }
          var mine = m.senderId === (S.me && S.me.id) || m.senderId === 'me';
          out += '<div class="bubble ' + (mine ? 'me' : 'them') + '">' + esc(m.text) +
            '<div class="bt">' + esc(fmtTime(m.createdAt)) + '</div></div>';
        });
        scroll.innerHTML = out || '<div class="empty"><div class="msg muted">Say hello 👋</div></div>';
        if (scrollDown !== false) scroll.scrollTop = scroll.scrollHeight;
      });
    }
    draw();
    S._poll = setInterval(function () { draw(); }, 4000);   // cleared by renderCurrent on navigation

    function send() {
      var inp = $('#msgInput'), text = inp.value.trim(); if (!text) return;
      inp.value = '';
      // optimistic bubble
      scroll.insertAdjacentHTML('beforeend', '<div class="bubble me">' + esc(text) + '<div class="bt">now</div></div>');
      scroll.scrollTop = scroll.scrollHeight; lastCount = -1;
      api('sendMessage', { threadId: p.threadId, text: text }).then(function () { draw(); });
    }
    $('#msgSend').addEventListener('click', send);
    $('#msgInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
  },
});
