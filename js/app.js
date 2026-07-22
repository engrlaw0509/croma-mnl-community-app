/* ============================================================================
   app.js — boot. Restores the session, routes to the app or the login screen,
   and wires the hardware back button (Android / Capacitor).
   ========================================================================== */
(function () {
  function boot() {
    loadSession();
    if (S.token && S.me) {
      // optimistic: show the app, then refresh the profile in the background
      if (!S.me.onboarded) { Auth.onboarding(); }
      else { go('home'); setTimeout(prefetch, 1800); }
      api('me').then(function (r) {
        if (r && r.ok && r.member) { S.me = r.member; saveSession(); if (current() && current().name === 'profile') renderCurrent(); }
        else if (r && r.ok === false && /session|token|auth/i.test(r.error || '')) { showAuth(); }
      });
    } else {
      showAuth();
    }
  }

  // Android hardware back button (Capacitor). Falls back to browser history on web.
  document.addEventListener('backbutton', function (e) {
    if ($('#modalRoot').innerHTML) { closeModal(); return; }
    if ($('#mainScreen').classList.contains('active')) { back(); }
  }, false);

  // Web: keep the browser back button roughly sane while previewing.
  window.addEventListener('popstate', function () {
    if ($('#modalRoot').innerHTML) { closeModal(); return; }
    if ($('#mainScreen').classList.contains('active') && S.stack.length > 1) { back(); }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
