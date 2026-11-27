/* Dashboard: sola presentazione dei calcoli correnti condivisi da WIPS. */
(function () {
  "use strict";
  var palette = ["#50dfbb", "#8f96ff", "#ffaf66", "#61bdf5", "#e788bc", "#e0ce73", "#b0a0ed", "#73c8aa", "#efa782", "#82b2b9"];
  var selected = "all";
  var selectedAsset = null;
  var mapFilter = "all", mapMode = "cost", colorMap = {};
  function color(r) { return colorMap[r.a.id] || palette[0]; }
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
    var circles = priced.map(function (r,i) { var part = r.c.va / total * 100, start = offset; offset += part; return '<circle class="dash-slice" tabindex="0" role="button" aria-label="' + esc(r.a.name) + ' ' + pct(part) + '" onclick="dashboardSelectAsset(' + JSON.stringify(r.a.id).replace(/"/g, '&quot;') + ')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click()}" cx="60" cy="60" r="45" pathLength="100" fill="none" stroke="' + color(r) + '" stroke-width="13" stroke-dasharray="' + part + ' ' + (100-part) + '" stroke-dashoffset="' + (-start) + '"><title>' + esc(r.a.name) + ': ' + esc(formatDisplayNumber(r.c.va,2)) + ' € (' + pct(part) + ')</title></circle>'; }).join("");
    var legend = priced.map(function (r,i) { return '<li><button type="button" onclick="dashboardSelectAsset(' + JSON.stringify(r.a.id).replace(/"/g, '&quot;') + ')" aria-pressed="' + (selectedAsset === r.a.id) + '"><i style="background:' + color(r) + '"></i><span>' + esc(r.a.name) + '</span><strong>' + pct(r.c.va / total * 100).replace(/^\+/, "") + '</strong></button></li>'; }).join("");
    var cursor = 0, sides = { left: [], right: [] };
    priced.forEach(function(r,i) { var share = r.c.va / total, angle = (cursor + share / 2) * Math.PI * 2 - Math.PI / 2; cursor += share; if (share >= 0.03) sides[Math.cos(angle) < 0 ? 'left' : 'right'].push({ row:r, index:i, angle:angle, share:share }); });
    var pointers = ['left','right'].map(function(side) { return sides[side].sort(function(a,b) { return Math.sin(a.angle)-Math.sin(b.angle); }).map(function(item,i,group) { var x=150+56.25*Math.cos(item.angle), y=100+56.25*Math.sin(item.angle), endX=side === 'left' ? 48 : 252, bendX=side === 'left' ? 80 : 220, endY=100+(i-(group.length-1)/2)*22, anchor=side === 'left' ? 'end' : 'start', textX=side === 'left' ? 45 : 255, name=item.row.a.name; if(name.length>16) name=name.slice(0,15)+'…'; return '<path d="M'+x.toFixed(1)+' '+y.toFixed(1)+' L'+bendX+' '+endY+' H'+endX+'" stroke="'+color(item.row)+'" fill="none"/><text x="'+textX+'" y="'+(endY-4)+'" text-anchor="'+anchor+'">'+esc(name)+'</text><text x="'+textX+'" y="'+(endY+7)+'" text-anchor="'+anchor+'">'+pct(item.share*100).replace(/^\+/,'')+'</text>'; }).join(''); }).join('');
    return '<article class="dash-card dash-donut-card"><h3>' + title + '</h3><div class="dash-donut-layout"><div class="dash-donut-visual"><div class="dash-ring"><svg viewBox="0 0 120 120" aria-label="Distribuzione ' + esc(title) + '"><circle cx="60" cy="60" r="45" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="13"/><g transform="rotate(-90 60 60)">' + circles + '</g></svg><div><small>VALORE</small><strong>' + money(total) + '</strong></div></div><svg class="dash-pointers" viewBox="0 0 300 200" aria-hidden="true">' + pointers + '</svg></div><details class="dash-legend-details" open><summary>Tutte le posizioni (' + priced.length + ')</summary><ul class="dash-legend">' + legend + '</ul></details></div></article>';
  }
  function categoryCard(label, items) {
    var s = summary(items);
    return '<article class="dash-card dash-category"><h3>' + label + '</h3><div class="dash-category-main ' + tone(s.pnl) + '">' + (s.pricedCost || s.value ? signed(s.pnl) : '—') + '</div><span class="dash-muted">P&L netto · ' + pct(s.pct) + '</span><div class="dash-split"><span>Profitti <b class="positive">' + signed(s.gains) + '</b></span><span>Perdite <b class="negative">' + signed(s.losses) + '</b></span></div></article>';
  }
  function concentration(items) {
    var list = items.filter(function(r) { return r.c.cost > 0 && (mapMode === 'cost' || r.c.va !== null) && (mapFilter === 'all' || r.type === mapFilter); }).sort(function(a,b) { return b.c.cost-a.c.cost; });
    var total = list.reduce(function(sum,r) { return sum+r.c.cost; },0);
    if (!total) return '<p class="dash-muted">Nessun valore disponibile.</p>';
    function layout(group,x,y,w,h) {
      if (group.length === 1) return [{r:group[0],x:x,y:y,w:w,h:h}];
      var sum = group.reduce(function(s,r){return s+r.c.cost;},0), acc=0, cut=0;
      while(cut < group.length-1 && acc + group[cut].c.cost <= sum/2) { acc += group[cut].c.cost; cut++; }
      if (!cut) { cut=1; acc=group[0].c.cost; }
      var fraction=acc/sum;
      return w >= h ? layout(group.slice(0,cut),x,y,w*fraction,h).concat(layout(group.slice(cut),x+w*fraction,y,w*(1-fraction),h)) : layout(group.slice(0,cut),x,y,w,h*fraction).concat(layout(group.slice(cut),x,y+h*fraction,w,h*(1-fraction)));
    }
    var rects = layout(list,0,0,1000,480).map(function(box) { var r=box.r, label=r.a.name+' · investito '+formatDisplayNumber(r.c.cost,2)+' € · quota '+pct(r.c.cost/total*100).replace(/^\+/,'')+' · P&L '+(r.c.re === null ? 'non disponibile' : formatDisplayNumber(r.c.re,2)+' € · '+pct(r.c.rp)); var content=box.w>85 && box.h>50 ? '<text x="'+(box.x+8)+'" y="'+(box.y+20)+'">'+esc(r.a.name.length>Math.floor(box.w/8) ? r.a.name.slice(0,Math.max(3,Math.floor(box.w/8)-1))+'…' : r.a.name)+'</text><text x="'+(box.x+8)+'" y="'+(box.y+37)+'">'+esc(mapMode === 'cost' ? formatDisplayNumber(r.c.cost,0)+' €' : pct(r.c.rp))+'</text>'+(box.h>70 ? '<text x="'+(box.x+8)+'" y="'+(box.y+54)+'">'+esc(mapMode === 'cost' ? pct(r.c.cost/total*100).replace(/^\+/,'') : formatDisplayNumber(r.c.re,0)+' €')+'</text>' : '') : ''; var fill=mapMode === 'cost' ? color(r) : r.c.re>0 ? '#50dfbb' : r.c.re<0 ? '#ff8490' : '#aab7ce'; return '<g class="dash-map-item'+(selectedAsset===r.a.id?' selected':'')+'" role="button" tabindex="0" aria-pressed="'+(selectedAsset===r.a.id)+'" aria-label="'+esc(label)+'" onclick="dashboardSelectAsset('+JSON.stringify(r.a.id).replace(/"/g,'&quot;')+')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click()}"><title>'+esc(label)+'</title><rect x="'+box.x+'" y="'+box.y+'" width="'+box.w+'" height="'+box.h+'" fill="'+fill+'" stroke="#101525" stroke-width="3"/>'+content+'</g>'; }).join('');
    var controls=['all','crypto','etf'].map(function(id){return '<button type="button" aria-pressed="'+(mapFilter===id)+'" onclick="setDashboardMapFilter(\''+id+'\')">'+(id==='all'?'Tutti':id==='etf'?'ETF':'Crypto')+'</button>';}).join('');
    var modes=['cost','performance'].map(function(id){return '<button type="button" aria-pressed="'+(mapMode===id)+'" onclick="setDashboardMapMode(\''+id+'\')">'+(id==='cost'?'Capitale investito':'Rendimenti')+'</button>';}).join('');
    return '<article class="dash-card dash-map-card"><div class="dash-section-head"><div><span class="dash-eyebrow">CONCENTRAZIONE</span><h2>Mosaico del portafoglio</h2><p>Area proporzionale al capitale investito. '+(mapMode==='cost'?'Colori degli asset come negli anelli.':'Verde: profitto · rosso: perdita. Le posizioni senza prezzo sono escluse.')+'</p></div><div><div class="dash-filters" role="group" aria-label="Tipo di mosaico">'+modes+'</div><div class="dash-filters dash-map-filters" role="group" aria-label="Filtra mosaico">'+controls+'</div></div></div><svg class="dash-map" viewBox="0 0 1000 480" aria-label="Mosaico delle posizioni">' + rects + '</svg><p class="dash-muted">Passa sopra o seleziona un asset per i dettagli. Le posizioni più piccole sono consultabili anche nelle legende degli anelli.</p></article>';
  }
  function comparison(items) {
    var list = items.filter(function (r) { return r.c.va !== null && (!selectedAsset || r.a.id === selectedAsset); }).sort(function (a,b) { return b.c.cost - a.c.cost; });
    if (!list.length) return '<p class="dash-muted">Nessuna posizione con prezzo disponibile.</p>';
    var rawMax = Math.max.apply(null, list.map(function (r) { return Math.max(r.c.cost, r.c.va); })) || 1;
    var step = 1000;
    var max = Math.ceil(rawMax / step) * step, ticks = Math.round(max / step);
    var axis = '<div class="dash-axis-row"><div></div><div class="dash-axis">' + Array.from({length:ticks+1}, function(_,i) { return '<span class="' + (i % 5 === 0 ? 'major' : 'minor') + '">' + esc(formatDisplayNumber(i*step, 0)) + '</span>'; }).join('') + '</div><div></div></div>';
    return (selectedAsset ? '<div class="dash-selection">Filtro attivo: <strong>' + esc(list[0].a.name) + '</strong> <button type="button" class="dash-clear" onclick="dashboardSelectAsset(null)">Mostra tutte le posizioni ×</button></div>' : '') + '<div class="dash-chart-scroll"><div class="dash-chart-inner" style="--ticks:' + ticks + '">' + axis + '<div class="dash-compare">' + list.map(function (r) {
      return '<div class="dash-compare-row"><div class="dash-asset"><strong>' + esc(r.a.name) + '</strong><small>' + (r.type === "etf" ? "ETF" : r.type === "crypto" ? "Crypto" : "Fondi") + '</small></div><div class="dash-bars" style="--grid-step:' + (100/ticks) + '%" aria-label="Investito ' + esc(formatDisplayNumber(r.c.cost,2)) + ' euro, valore ' + esc(formatDisplayNumber(r.c.va,2)) + ' euro"><div class="dash-bar cost" style="width:' + (r.c.cost/max*100) + '%"><span>' + esc(formatDisplayNumber(r.c.cost,2)) + ' €</span></div><div class="dash-bar market ' + tone(r.c.re) + '" style="width:' + (r.c.va/max*100) + '%"><span>' + esc(formatDisplayNumber(r.c.va,2)) + ' €</span></div></div><div class="dash-compare-values"><span>' + money(r.c.cost) + ' → ' + money(r.c.va) + '</span><strong class="' + tone(r.c.re) + '">' + signed(r.c.re) + ' · ' + pct(r.c.rp) + '</strong></div></div>';
    }).join("") + '</div></div></div>';
  }
  window.buildPortfolioDashboard = function (portfolio) {
    var all = rows(portfolio), s = summary(all), crypto = all.filter(function (r) { return r.type === "crypto"; }), etf = all.filter(function (r) { return r.type === "etf"; });
    all.slice().sort(function(a,b){return (b.c.va || 0)-(a.c.va || 0);}).forEach(function(r,i){colorMap[r.a.id]=palette[i % palette.length];});
    var shown = selected === "all" ? all : all.filter(function (r) { return r.type === selected; });
    var missing = s.missing ? '<p class="dash-warning">' + s.missing + ' posizioni senza prezzo: valore e P&L riguardano soltanto le posizioni quotate. Investito comprende tutte le posizioni.</p>' : '';
    return '<div class="dash-wrap"><div class="dash-heading"><div><span class="dash-eyebrow">PORTAFOGLIO · SITUAZIONE ATTUALE</span><h1>La tua dashboard</h1><p>Una fotografia delle posizioni, senza simulazioni What‑If.</p></div><span class="dash-badge">' + (all.length-s.missing) + '/' + all.length + ' prezzi disponibili</span></div>' + missing + '<div class="dash-kpis"><article class="dash-kpi"><small>Capitale investito</small><strong>' + money(s.cost) + '</strong></article><article class="dash-kpi featured"><small>Valore attuale' + (s.missing ? ' · parziale' : '') + '</small><strong>' + money(s.value) + '</strong></article><article class="dash-kpi"><small>P&L non realizzato' + (s.missing ? ' · parziale' : '') + '</small><strong class="' + tone(s.pnl) + '">' + (all.length > s.missing ? signed(s.pnl) : '—') + '</strong></article><article class="dash-kpi"><small>Rendimento' + (s.missing ? ' · parziale' : '') + '</small><strong class="' + tone(s.pnl) + '">' + pct(s.pct) + '</strong></article></div><div class="dash-categories">' + categoryCard('Crypto', crypto) + categoryCard('ETF', etf) + '</div><div class="dash-section-head"><div><span class="dash-eyebrow">COMPOSIZIONE</span><h2>Dove si trova il capitale</h2><p>Quote calcolate sul valore di mercato delle posizioni con prezzo disponibile.</p></div></div><div class="dash-donuts">' + donut('Portafoglio totale', all) + donut('Crypto', crypto) + donut('ETF', etf) + '</div>' + concentration(all) + '<article class="dash-card"><div class="dash-section-head"><div><span class="dash-eyebrow">CONFRONTO PER POSIZIONE</span><h2>Investito e valore attuale</h2><p>Due barre affiancate: la differenza è il profitto o la perdita non realizzata.</p></div><div class="dash-filters" role="group" aria-label="Filtra confronto">' + ['all','crypto','etf'].map(function (id) { return '<button type="button" aria-pressed="' + (selected === id) + '" onclick="setDashboardFilter(\'' + id + '\')">' + (id === 'all' ? 'Tutti' : id === 'etf' ? 'ETF' : 'Crypto') + '</button>'; }).join('') + '</div></div><div class="dash-bar-key"><span><i class="cost"></i>Investito</span><span><i class="market"></i>Valore attuale</span></div>' + comparison(shown) + '</article><p class="dash-foot">Prezzi disponibili in WIPS al momento della visualizzazione. Importi e rendimenti sono indicativi e non includono necessariamente costi o imposte.</p></div>';
  };
  window.renderPortfolioDashboard = function (portfolio) { var el = document.getElementById('sec-dashboard'); if (el) el.innerHTML = window.buildPortfolioDashboard(portfolio || portfolioSnapshot()); };
  function rerender() { var y=window.scrollY; if (document.body.classList.contains('mode-mobile') && typeof window.renderMobileExperience === 'function') window.renderMobileExperience(); else window.renderPortfolioDashboard(); window.scrollTo(0,y); }
  window.dashboardSelectAsset = function (id) { selectedAsset = selectedAsset === id ? null : id; selected = 'all'; rerender(); };
  window.setDashboardMapFilter = function (value) { if (['all','crypto','etf'].indexOf(value) < 0) return; mapFilter = value; rerender(); };
  window.setDashboardMapMode = function (value) { if (['cost','performance'].indexOf(value) < 0) return; mapMode = value; rerender(); };
  window.setDashboardFilter = function (value) { if (['all','crypto','etf'].indexOf(value) < 0) return; selected = value; selectedAsset = null; rerender(); };
})();
