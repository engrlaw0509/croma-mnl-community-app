/* ============================================================================
   inquiries.js — send a question to Croma MNL and track replies.
   ========================================================================== */
registerView('inquiries', {
  title: 'Ask Croma MNL',
  render: function (host) {
    host.innerHTML =
      '<div class="card">' +
        '<label class="lbl">Subject</label><input class="field" id="inqSubj" maxlength="80" placeholder="e.g. Do you have oat milk?"/>' +
        '<label class="lbl">Message</label><textarea class="field" id="inqMsg" maxlength="600" placeholder="How can we help?"></textarea>' +
        '<button class="btn primary block big" id="inqSend">Send inquiry</button>' +
      '</div>' +
      '<div class="section-title">Your inquiries</div><div id="inqList">' + skeletonList(2) + '</div>';
    $('#inqSend').addEventListener('click', function () {
      var subj = $('#inqSubj').value.trim(), msg = $('#inqMsg').value.trim();
      if (!subj || !msg) { toast('Add a subject and message.'); return; }
      this.disabled = true; var btn = this;
      api('inquire', { subject: subj, message: msg }).then(function (r) {
        btn.disabled = false;
        if (r && r.ok) { toast('Sent! We\'ll get back to you.'); $('#inqSubj').value = ''; $('#inqMsg').value = ''; load(); }
        else toast((r && r.error) || 'Could not send.');
      });
    });
    load();
    function load() {
      api('myInquiries').then(function (r) {
        var list = (r && r.inquiries) || [];
        $('#inqList').innerHTML = list.length ? list.map(rowHTML).join('') : emptyState('✉️', 'No inquiries yet');
      });
    }
    function rowHTML(q) {
      var answered = q.status === 'answered';
      return '<div class="card"><div class="spread"><div style="font-weight:700">' + esc(q.subject) + '</div>' +
        '<span class="badge ' + (answered ? 'green' : 'amber') + '">' + (answered ? 'Answered' : 'Open') + '</span></div>' +
        '<div class="muted small mt8">' + esc(timeAgo(q.createdAt)) + '</div>' +
        '<div style="margin-top:10px;font-size:14px">' + esc(q.message) + '</div>' +
        (answered && q.reply ? '<div class="card" style="background:var(--surface2);margin:12px 0 0;box-shadow:none">' +
          '<div class="small" style="font-weight:700;color:var(--brand)">Croma MNL replied</div>' +
          '<div style="margin-top:6px;font-size:14px">' + esc(q.reply) + '</div></div>' : '') +
        '</div>';
    }
  },
});
