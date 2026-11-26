/* Dashboard: sola presentazione dei calcoli correnti condivisi da WIPS. */
(function () {
  "use strict";
  var palette = ["#50dfbb", "#8f96ff", "#ffaf66", "#61bdf5", "#e788bc", "#e0ce73", "#b0a0ed", "#73c8aa", "#efa782", "#82b2b9"];
  var selected = "all";
  var selectedAsset = null;
  function esc(x) { return String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function money(x) { return N(x, 2, " €"); }
  function signed(x) { return S(x, 2, "€"); }
  function pct(x) { return x === null ? "—" : (x > 0 ? "+" : "") + x.toLocaleString("it-IT", { maximumFractionDigits: 2 }) + "%"; }
  function tone(x) { return x > 0 ? "positive" : x < 0 ? "negative" : "neutral"; }
  function rows(portfolio) {
    var result = [];
    PORTFOLIO_TYPES.forEach(function (type) {
      (portfolio[type] || []).forEach(function (asset) { result.push({ a: asset, type: type, c: calc(asset, 0) }); });
    });
    return result;
  }
  function summary(items) {
    var result = { cost: 0, pricedCost: 0, value: 0, missing: 0, gains: 0, losses: 0 };
    items.forEach(function (r) { result.cost += r.c.cost; if (r.c.va === null) { result.missing++; return; } result.pricedCost += r.c.cost; result.value += r.c.va; if (r.c.re > 0) result.gains += r.c.re; else result.losses += r.c.re; });
    result.pnl = result.value - result.pricedCost;
    result.pct = result.pricedCost > 0 ? result.pnl / result.pricedCost * 100 : null;
    return result;
  }
  function donut(title, items) {
    var priced = items.filter(function (r) { return r.c.va !== null && r.c.va > 0; }).sort(function (a,b) { return b.c.va - a.c.va; });
    var total = priced.reduce(function (s,r) { return s + r.c.va; }, 0), offset = 0;
    if (!total) return '<article class="dash-card"><h3>' + title + '</h3><p class="dash-muted">Nessun valore disponibile.</p></article>';
    var circles = priced.map(function (r,i) { var part = r.c.va / total * 100, start = offset; offset += part; return '<circle class="dash-slice" tabindex="0" role="button" aria-label="' + esc(r.a.name) + ' ' + pct(part) + '" onclick="dashboardSelectAsset(' + JSON.stringify(r.a.id).replace(/"/g, '&quot;') + ')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click()}" cx="60" cy="60" r="45" pathLength="100" fill="none" stroke="' + palette[i % palette.length] + '" stroke-width="13" stroke-dasharray="' + part + ' ' + (100-part) + '" stroke-dashoffset="' + (-start) + '"><title>' + esc(r.a.name) + ': ' + esc(formatDisplayNumber(r.c.va,2)) + ' € (' + pct(part) + ')</title></circle>'; }).join("");
    var legend = priced.map(function (r,i) { return '<li><button type="button" onclick="dashboardSelectAsset(' + JSON.stringify(r.a.id).replace(/"/g, '&quot;') + ')" aria-pressed="' + (selectedAsset === r.a.id) + '"><i style="background:' + palette[i % palette.length] + '"></i><span>' + esc(r.a.name) + '</span><strong>' + pct(r.c.va / total * 100).replace(/^\+/, "") + '</strong></button></li>'; }).join("");
    var cursor = 0, sides = { left: [], right: [] };
    priced.forEach(function(r,i) { var share = r.c.va / total, angle = (cursor + share / 2) * Math.PI * 2 - Math.PI / 2; cursor += share; if (i < 4) sides[Math.cos(angle) < 0 ? 'left' : 'right'].push({ row:r, index:i, angle:angle, share:share }); });
    var pointers = ['left','right'].map(function(side) { return sides[side].sort(function(a,b) { return Math.sin(a.angle)-Math.sin(b.angle); }).map(function(item,i,group) { var x=150+56.25*Math.cos(item.angle), y=100+56.25*Math.sin(item.angle), endX=side === 'left' ? 48 : 252, bendX=side === 'left' ? 80 : 220, endY=100+(i-(group.length-1)/2)*28, anchor=side === 'left' ? 'end' : 'start', textX=side === 'left' ? 45 : 255, name=item.row.a.name; if(name.length>16) name=name.slice(0,15)+'…'; return '<path d="M'+x.toFixed(1)+' '+y.toFixed(1)+' L'+bendX+' '+endY+' H'+endX+'" stroke="'+palette[item.index % palette.length]+'" fill="none"/><text x="'+textX+'" y="'+(endY-4)+'" text-anchor="'+anchor+'">'+esc(name)+'</text><text x="'+textX+'" y="'+(endY+7)+'" text-anchor="'+anchor+'">'+pct(item.share*100).replace(/^\+/,'')+'</text>'; }).join(''); }).join('');
    return '<article class="dash-card dash-donut-card"><h3>' + title + '</h3><div class="dash-donut-layout"><div class="dash-donut-visual"><div class="dash-ring"><svg viewBox="0 0 120 120" aria-label="Distribuzione ' + esc(title) + '"><circle cx="60" cy="60" r="45" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="13"/><g transform="rotate(-90 60 60)">' + circles + '</g></svg><div><small>VALORE</small><strong>' + money(total) + '</strong></div></div><svg class="dash-pointers" viewBox="0 0 300 200" aria-hidden="true">' + pointers + '</svg></div><details class="dash-legend-details"><summary>Tutte le posizioni (' + priced.length + ')</summary><ul class="dash-legend">' + legend + '</ul></details></div></article>';
  }
  function categoryCard(label, items) {
    var s = summary(items);
    return '<article class="dash-card dash-category"><h3>' + label + '</h3><div class="dash-category-main ' + tone(s.pnl) + '">' + (s.pricedCost || s.value ? signed(s.pnl) : '—') + '</div><span class="dash-muted">P&L netto · ' + pct(s.pct) + '</span><div class="dash-split"><span>Profitti <b class="positive">' + signed(s.gains) + '</b></span><span>Perdite <b class="negative">' + signed(s.losses) + '</b></span></div></article>';
  }
  function concentration(items) {
    var list = items.filter(function(r) { return r.c.va !== null && r.c.va > 0; }).sort(function(a,b) { return b.c.va-a.c.va; });
    var total = list.reduce(function(sum,r) { return sum+r.c.va; },0), cursor = 0;
    if (!total) return '<p class="dash-muted">Nessun valore disponibile.</p>';
    var rects = list.map(function(r) { var width = r.c.va / total * 1000, start = cursor; cursor += width; var label = r.a.name + ' · ' + formatDisplayNumber(r.c.va,2) + ' € · ' + pct(r.c.rp); return '<g class="dash-map-item" role="button" tabindex="0" aria-label="' + esc(label) + '" onclick="dashboardSelectAsset(' + JSON.stringify(r.a.id).replace(/"/g,'&quot;') + ')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click()}"><title>' + esc(label) + '</title><rect x="' + start + '" y="0" width="' + width + '" height="100" class="' + tone(r.c.re) + '" stroke="#101525" stroke-width="2"/>' + (width > 65 ? '<text x="' + (start+width/2) + '" y="45" text-anchor="middle">' + esc(r.a.name.length > 13 ? r.a.name.slice(0,12)+'…' : r.a.name) + '</text><text x="' + (start+width/2) + '" y="62" text-anchor="middle">' + pct(r.c.rp) + '</text>' : '') + '</g>'; }).join('');
    return '<article class="dash-card dash-map-card"><div class="dash-section-head"><div><span class="dash-eyebrow">CONCENTRAZIONE</span><h2>Il peso delle posizioni</h2><p>La larghezza indica il peso sul valore totale; verde e rosso indicano profitto o perdita. Seleziona una posizione per approfondire.</p></div></div><svg class="dash-map" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-label="Mappa delle posizioni">' + rects + '</svg><div class="dash-map-key"><span>■ Profitto</span><span>■ Perdita</span><span>■ In pari</span></div></article>';
  }
  function comparison(items) {
    var list = items.filter(function (r) { return r.c.va !== null && (!selectedAsset || r.a.id === selectedAsset); }).sort(function (a,b) { return b.c.cost - a.c.cost; });
    if (!list.length) return '<p class="dash-muted">Nessuna posizione con prezzo disponibile.</p>';
    var rawMax = Math.max.apply(null, list.map(function (r) { return Math.max(r.c.cost, r.c.va); })) || 1;
    var step = 500;
    var max = Math.ceil(rawMax / step) * step, ticks = Math.round(max / step);
    var axis = '<div class="dash-axis">' + Array.from({length:ticks+1}, function(_,i) { return '<span class="' + (i % 2 === 0 ? 'major' : 'minor') + '">' + esc(formatDisplayNumber(i*step, 0)) + '</span>'; }).join('') + '</div>';
    return (selectedAsset ? '<button type="button" class="dash-clear" onclick="dashboardSelectAsset(null)">Mostra tutte le posizioni ×</button>' : '') + '<div class="dash-chart-scroll"><div class="dash-chart-inner" style="--ticks:' + ticks + '">' + axis + '<div class="dash-compare">' + list.map(function (r) {
      return '<div class="dash-compare-row"><div class="dash-asset"><strong>' + esc(r.a.name) + '</strong><small>' + (r.type === "etf" ? "ETF" : r.type === "crypto" ? "Crypto" : "Fondi") + '</small></div><div class="dash-bars" style="--grid-step:' + (100/ticks) + '%" aria-label="Investito ' + esc(formatDisplayNumber(r.c.cost,2)) + ' euro, valore ' + esc(formatDisplayNumber(r.c.va,2)) + ' euro"><div class="dash-bar cost" style="width:' + (r.c.cost/max*100) + '%"><span>' + esc(formatDisplayNumber(r.c.cost,2)) + ' €</span></div><div class="dash-bar market ' + tone(r.c.re) + '" style="width:' + (r.c.va/max*100) + '%"><span>' + esc(formatDisplayNumber(r.c.va,2)) + ' €</span></div></div><div class="dash-compare-values"><span>' + money(r.c.cost) + ' → ' + money(r.c.va) + '</span><strong class="' + tone(r.c.re) + '">' + signed(r.c.re) + ' · ' + pct(r.c.rp) + '</strong></div></div>';
    }).join("") + '</div></div></div>';
  }
  window.buildPortfolioDashboard = function (portfolio) {
    var all = rows(portfolio), s = summary(all), crypto = all.filter(function (r) { return r.type === "crypto"; }), etf = all.filter(function (r) { return r.type === "etf"; });
    var shown = selected === "all" ? all : all.filter(function (r) { return r.type === selected; });
    var missing = s.missing ? '<p class="dash-warning">' + s.missing + ' posizioni senza prezzo: valore e P&L riguardano soltanto le posizioni quotate. Investito comprende tutte le posizioni.</p>' : '';
    return '<div class="dash-wrap"><div class="dash-heading"><div><span class="dash-eyebrow">PORTAFOGLIO · SITUAZIONE ATTUALE</span><h1>La tua dashboard</h1><p>Una fotografia delle posizioni, senza simulazioni What‑If.</p></div><span class="dash-badge">' + (all.length-s.missing) + '/' + all.length + ' prezzi disponibili</span></div>' + missing + '<div class="dash-kpis"><article class="dash-kpi"><small>Capitale investito</small><strong>' + money(s.cost) + '</strong></article><article class="dash-kpi featured"><small>Valore attuale' + (s.missing ? ' · parziale' : '') + '</small><strong>' + money(s.value) + '</strong></article><article class="dash-kpi"><small>P&L non realizzato' + (s.missing ? ' · parziale' : '') + '</small><strong class="' + tone(s.pnl) + '">' + (all.length > s.missing ? signed(s.pnl) : '—') + '</strong></article><article class="dash-kpi"><small>Rendimento' + (s.missing ? ' · parziale' : '') + '</small><strong class="' + tone(s.pnl) + '">' + pct(s.pct) + '</strong></article></div><div class="dash-categories">' + categoryCard('Crypto', crypto) + categoryCard('ETF', etf) + '</div><div class="dash-section-head"><div><span class="dash-eyebrow">COMPOSIZIONE</span><h2>Dove si trova il capitale</h2><p>Quote calcolate sul valore di mercato delle posizioni con prezzo disponibile.</p></div></div><div class="dash-donuts">' + donut('Portafoglio totale', all) + donut('Crypto', crypto) + donut('ETF', etf) + '</div>' + concentration(all) + '<article class="dash-card"><div class="dash-section-head"><div><span class="dash-eyebrow">CONFRONTO PER POSIZIONE</span><h2>Investito e valore attuale</h2><p>Due barre affiancate: la differenza è il profitto o la perdita non realizzata.</p></div><div class="dash-filters" role="group" aria-label="Filtra confronto">' + ['all','crypto','etf'].map(function (id) { return '<button type="button" aria-pressed="' + (selected === id) + '" onclick="setDashboardFilter(\'' + id + '\')">' + (id === 'all' ? 'Tutti' : id === 'etf' ? 'ETF' : 'Crypto') + '</button>'; }).join('') + '</div></div><div class="dash-bar-key"><span><i class="cost"></i>Investito</span><span><i class="market"></i>Valore attuale</span></div>' + comparison(shown) + '</article><p class="dash-foot">Prezzi disponibili in WIPS al momento della visualizzazione. Importi e rendimenti sono indicativi e non includono necessariamente costi o imposte.</p></div>';
  };
  window.renderPortfolioDashboard = function (portfolio) { var el = document.getElementById('sec-dashboard'); if (el) el.innerHTML = window.buildPortfolioDashboard(portfolio || portfolioSnapshot()); };
  function rerender() { if (document.body.classList.contains('mode-mobile') && typeof window.renderMobileExperience === 'function') window.renderMobileExperience(); else window.renderPortfolioDashboard(); }
  window.dashboardSelectAsset = function (id) { selectedAsset = selectedAsset === id ? null : id; selected = 'all'; rerender(); };
  window.setDashboardFilter = function (value) { if (['all','crypto','etf'].indexOf(value) < 0) return; selected = value; selectedAsset = null; rerender(); };
})();
