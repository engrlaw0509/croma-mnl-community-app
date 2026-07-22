/* ============================================================================
   menu.js — the café menu, read live from the POS Sheet (Categories + Products).
   ========================================================================== */
registerView('menu', {
  tab: 'menu',
  title: 'Menu',
  render: function (host) {
    host.innerHTML = '<div class="muted small mb8">Fresh from the counter. Prices in ₱.</div>' +
      '<input class="field" id="menuSearch" placeholder="Search the menu…"/>' +
      '<div id="menuList">' + skeletonList(4) + '</div>';
    var all = [];
    apiSWR('menu', {}, function (r) { all = (r && r.menu) || []; draw($('#menuSearch') ? $('#menuSearch').value.trim().toLowerCase() : ''); }, { freshFor: 300000 });
    $('#menuSearch').addEventListener('input', function () { draw(this.value.trim().toLowerCase()); });

    function draw(q) {
      var box = $('#menuList'), out = '';
      all.forEach(function (cat) {
        var items = (cat.items || []).filter(function (it) {
          return !q || it.name.toLowerCase().indexOf(q) >= 0 || (it.desc || '').toLowerCase().indexOf(q) >= 0;
        });
        if (!items.length) return;
        out += '<div class="menu-cat">' + esc(cat.category) + '</div><div class="card" style="padding:4px 16px">';
        items.forEach(function (it) {
          out += '<div class="menu-item"><div class="mi-grow"><div class="mi-name">' + esc(it.name) +
            (it.temp ? ' <span class="badge soft">🧊/☕</span>' : '') + '</div>' +
            (it.desc ? '<div class="mi-desc">' + esc(it.desc) + '</div>' : '') + '</div>' +
            '<div class="mi-price">' + money(it.price) + '</div></div>';
        });
        out += '</div>';
      });
      box.innerHTML = out || emptyState('🔍', 'Nothing found', 'Try another search.');
    }
  },
});
