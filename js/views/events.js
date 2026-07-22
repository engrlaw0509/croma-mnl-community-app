/* ============================================================================
   events.js — upcoming Croma MNL events + RSVP. Also exposes Events.cardHTML /
   wireCards so the Home dashboard can show the next event.
   ========================================================================== */
var Events = (function () {
  function cardHTML(e) {
    return '<div class="event-card" data-event="' + esc(e.id) + '">' +
      '<div class="banner" style="' + (e.imageUrl ? "background-image:url('" + esc(e.imageUrl) + "');background-size:cover;background-position:center" : '') + '">' +
        '<span class="badge" style="background:rgba(255,255,255,.9);color:var(--brand)">' + esc(fmtEventWhen(e.startAt)) + '</span></div>' +
      '<div class="ebody"><div class="etitle">' + esc(e.title) + '</div>' +
        '<div class="edesc">' + esc((e.description || '').slice(0, 110)) + ((e.description || '').length > 110 ? '…' : '') + '</div>' +
        '<div class="efoot"><span class="muted small">📍 ' + esc(e.location || 'Croma MNL') + ' · 👥 ' + (e.going || 0) + ' going</span>' +
        (e.rsvp ? '<span class="badge green">Going ✓</span>' : '<span class="badge soft">RSVP ›</span>') + '</div>' +
      '</div></div>';
  }
  function wireCards(scope) {
    $$('.event-card', scope).forEach(function (c) {
      c.addEventListener('click', function () { go('eventDetail', { eventId: c.dataset.event }); });
    });
  }
  return { cardHTML: cardHTML, wireCards: wireCards };
})();

registerView('events', {
  title: 'Events',
  render: function (host) {
    host.innerHTML = '<div id="evList">' + skeletonList(3) + '</div>';
    apiSWR('events', {}, function (r) {
      var evs = (r && r.events) || [];
      $('#evList').innerHTML = evs.length ? evs.map(Events.cardHTML).join('')
        : emptyState('🎉', 'No upcoming events', 'Check back soon — new ones are added often.');
      Events.wireCards($('#evList'));
    });
  },
});

registerView('eventDetail', {
  title: 'Event',
  nav: false,
  render: function (host, p) {
    host.innerHTML = skeletonList(2);
    api('eventDetail', { eventId: p.eventId }).then(function (r) {
      var e = r && r.event;
      if (!e) { host.innerHTML = emptyState('❓', 'Event not found'); return; }
      host.innerHTML =
        '<div class="event-card"><div class="banner" style="height:150px;' +
          (e.imageUrl ? "background-image:url('" + esc(e.imageUrl) + "');background-size:cover;background-position:center" : '') + '"></div>' +
        '<div class="ebody">' +
          '<div class="edate">' + esc(fmtEventWhen(e.startAt)) + '</div>' +
          '<div class="etitle" style="font-size:22px">' + esc(e.title) + '</div>' +
          '<div class="edesc" style="font-size:14.5px;white-space:pre-wrap">' + esc(e.description || '') + '</div>' +
          '<div class="mt16 row-gap"><span class="chip soft">📍 ' + esc(e.location || 'Croma MNL') + '</span>' +
          '<span class="chip soft">👥 ' + (e.going || 0) + (e.capacity ? ' / ' + e.capacity : '') + ' going</span></div>' +
        '</div></div>' +
        '<button class="btn ' + (e.rsvp ? 'ghost danger' : 'primary') + ' block big" id="rsvpBtn">' +
          (e.rsvp ? 'Cancel RSVP' : 'I\'m going 🎉') + '</button>';
      $('#rsvpBtn').addEventListener('click', function () {
        var going = !e.rsvp; this.disabled = true;
        api('rsvp', { eventId: e.id, going: going }).then(function (rr) {
          if (rr && rr.ok) { swrDrop('events', 'home', 'myEvents'); toast(going ? 'You\'re on the list! ✓' : 'RSVP cancelled.'); renderCurrent(); }
          else { toast((rr && rr.error) || 'Could not update RSVP.'); }
        });
      });
    });
  },
});
