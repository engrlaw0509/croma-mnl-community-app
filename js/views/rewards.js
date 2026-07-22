/* ============================================================================
   rewards.js — loyalty: points balance, tier progress, reward catalog, and
   the codes to show at the counter. Points are earned from POS purchases.
   ========================================================================== */
var TIER_COLORS = { Bronze: '#a8722b', Silver: '#8a8f98', Gold: '#c79a3a' };

registerView('rewards', {
  title: 'Rewards',
  render: function (host) {
    host.innerHTML = '<div id="loyHero"></div><div id="loyBody">' + skeletonList(3) + '</div>';
    load();

    function load() {
      Promise.all([api('loyalty'), api('rewards'), api('myRedemptions')]).then(function (res) {
        var loy = res[0] || {}, rw = res[1] || {}, red = res[2] || {};
        var tierc = TIER_COLORS[loy.tier] || 'var(--accent)';
        $('#loyHero').innerHTML =
          '<div class="hero" style="background:linear-gradient(135deg,var(--brand),' + tierc + ')">' +
            '<div class="spread"><div><div class="hi">YOUR POINTS</div>' +
              '<div class="name" style="font-size:34px">' + (loy.points || 0) + '</div></div>' +
              '<span class="badge" style="background:rgba(255,255,255,.92);color:var(--brand);align-self:flex-start">★ ' + esc(loy.tier || 'Bronze') + '</span></div>' +
            progressBlock(loy) +
          '</div>' +
          '<div class="stat-row"><div class="stat"><div class="v">' + money(loy.lifetimeSpent || 0) + '</div><div class="l">Lifetime spend</div></div>' +
            '<div class="stat"><div class="v">' + (loy.visits || 0) + '</div><div class="l">Visits</div></div></div>';

        var reds = (red.redemptions || []).filter(function (r) { return r.status === 'active'; });
        var out = '';
        if (reds.length) {
          out += '<div class="section-title">Ready to claim</div>';
          out += reds.map(codeCard).join('');
        }
        out += '<div class="section-title">Redeem your points</div>';
        out += (rw.rewards || []).map(function (r) { return rewardCard(r); }).join('');
        out += '<div class="card" style="background:var(--surface2);box-shadow:none"><div class="small muted">' +
          '☕ Earn <strong>1 point for every ' + money(loy.pesoPerPoint || 10).replace('.00', '') + '</strong> you spend. Give your profile name at the counter so your purchases count.</div></div>';
        $('#loyBody').innerHTML = out;
        $$('#loyBody [data-redeem]').forEach(function (b) { b.addEventListener('click', function () { confirmRedeem(b.dataset.redeem, b.dataset.title, b.dataset.cost); }); });
      });
    }
    function progressBlock(loy) {
      if (!loy.nextTier) return '<div class="meta"><span>🏆 You\'ve reached the top tier!</span></div>';
      var pct = Math.round((loy.progress || 0) * 100);
      return '<div style="margin-top:14px"><div style="height:8px;border-radius:5px;background:rgba(255,255,255,.28);overflow:hidden">' +
        '<div style="height:100%;width:' + pct + '%;background:#fbf6ee;border-radius:5px"></div></div>' +
        '<div class="small" style="margin-top:7px;opacity:.9">' + (loy.toNextTier || 0) + ' more points to <strong>' + esc(loy.nextTier) + '</strong></div></div>';
    }
    function rewardCard(r) {
      return '<div class="card"><div class="spread" style="align-items:flex-start"><div style="flex:1">' +
        '<div style="font-weight:700;font-size:15px">' + esc(r.title) + '</div>' +
        '<div class="muted small mt8">' + esc(r.description || '') + '</div>' +
        '<div class="chip soft" style="margin-top:10px">★ ' + r.cost + ' pts</div></div>' +
        '<button class="btn ' + (r.canRedeem ? 'primary' : 'ghost') + ' sm" ' + (r.canRedeem ? '' : 'disabled ') +
          'data-redeem="' + esc(r.id) + '" data-title="' + esc(r.title) + '" data-cost="' + r.cost + '">' +
          (r.canRedeem ? 'Redeem' : 'Locked') + '</button></div></div>';
    }
    function codeCard(r) {
      return '<div class="card" style="border:1px dashed var(--accent)"><div class="spread"><div style="font-weight:700">' + esc(r.title) + '</div>' +
        '<span class="badge green">Active</span></div>' +
        '<div style="text-align:center;margin:12px 0 4px"><div class="muted small">Show this code at the counter</div>' +
        '<div style="font-size:30px;font-weight:800;letter-spacing:5px;color:var(--brand);font-family:\'Courier New\',monospace">' + esc(r.code) + '</div></div></div>';
    }
    function confirmRedeem(id, title, cost) {
      modal('<h3>Redeem reward?</h3><p class="muted">Use <strong>' + esc(cost) + ' points</strong> for <strong>' + esc(title) + '</strong>? ' +
        'You\'ll get a code to show at the counter.</p>' +
        '<div class="modal-actions"><button class="btn ghost" id="rdCancel">Cancel</button>' +
        '<button class="btn primary" id="rdYes">Redeem</button></div>');
      $('#rdCancel').addEventListener('click', closeModal);
      $('#rdYes').addEventListener('click', function () {
        this.disabled = true;
        api('redeemReward', { rewardId: id }).then(function (r) {
          closeModal();
          if (r && r.ok) { swrDrop('home', 'rewards', 'loyalty', 'myRedemptions'); toast('Redeemed! Show your code at the counter ☕'); load(); }
          else toast((r && r.error) || 'Could not redeem.');
        });
      });
    }
  },
});
