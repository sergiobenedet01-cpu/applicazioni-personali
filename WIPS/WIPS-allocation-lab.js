/*
  WIPS · Allocazione
  Guida locale di riequilibrio: usa le posizioni e le quotazioni già presenti,
  ma non modifica mai portfolio, prezzi, CSV, backup o What-If globale.
*/
(function () {
  "use strict";

  var ALLOCATION_STORAGE_KEY = "wips_allocation_lab_v1";
  var DEFAULT_POOL = 5600;
  var DEFAULT_MAX_WEIGHT = 15;
  var MAX_POOL = 1000000;
  var TYPES = ["etf", "crypto", "fondi"];
  var allocationState = null;

  function finite(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function money(value, digits) {
    if (!Number.isFinite(value)) return '<span class="mu">—</span>';
    return N(value, digits === undefined ? 2 : digits, " €");
  }

  function plain(value, digits) {
    if (!Number.isFinite(value)) return "—";
    return formatDisplayNumber(value, digits === undefined ? 2 : digits);
  }

  function percent(value, digits) {
    if (!Number.isFinite(value)) return "—";
    return plain(value, digits === undefined ? 1 : digits) + "%";
  }

  function typeLabel(type) {
    return type === "crypto" ? "Crypto" : type === "etf" ? "ETF" : "Fondi";
  }

  function activeTypes(rows) {
    return TYPES.filter(function (type) { return rows.some(function (row) { return row.t === type; }); });
  }

  function defaultTargets(rows) {
    var active = activeTypes(rows);
    var values = { crypto: 0, etf: 0, fondi: 0 };
    if (active.length === 1) values[active[0]] = 100;
    else if (active.length === 2) { values[active[0]] = 50; values[active[1]] = 50; }
    else if (active.length === 3) { values.etf = 50; values.crypto = 40; values.fondi = 10; }
    return values;
  }

  function normalizedTargets(raw, rows) {
    var defaults = defaultTargets(rows);
    if (!raw || typeof raw !== "object") return defaults;
    var active = activeTypes(rows);
    var values = { crypto: 0, etf: 0, fondi: 0 };
    var total = 0;
    active.forEach(function (type) { values[type] = clamp(finite(raw[type], defaults[type]), 0, 100); total += values[type]; });
    if (total <= 0) return defaults;
    active.forEach(function (type) { values[type] = (values[type] / total) * 100; });
    return values;
  }

  function stateDefaults(rows) {
    return { pool: DEFAULT_POOL, maxWeight: DEFAULT_MAX_WEIGHT, scenario: "custom", allocations: {}, targets: defaultTargets(rows) };
  }

  function sanitizeState(raw, rows) {
    raw = raw && typeof raw === "object" ? raw : {};
    var defaults = stateDefaults(rows);
    var ids = rows.map(function (row) { return row.a.id; });
    var source = raw.allocations && typeof raw.allocations === "object" ? raw.allocations : {};
    var allocations = {};
    ids.forEach(function (id) {
      var amount = clamp(finite(source[id], 0), 0, MAX_POOL);
      if (amount > 0) allocations[id] = amount;
    });
    return {
      pool: clamp(finite(raw.pool, defaults.pool), 0, MAX_POOL),
      maxWeight: clamp(finite(raw.maxWeight, defaults.maxWeight), 3, 60),
      scenario: ["custom", "target", "etf", "crypto"].indexOf(raw.scenario) >= 0 ? raw.scenario : defaults.scenario,
      allocations: allocations,
      targets: normalizedTargets(raw.targets, rows),
    };
  }

  function baseRows(portfolio) {
    portfolio = portfolio || P;
    var rows = [];
    PORTFOLIO_TYPES.forEach(function (type) {
      (portfolio[type] || []).forEach(function (asset) {
        var result = calc(asset, 0);
        if (result.price !== null && result.price > 0) rows.push({ a: asset, t: type, c: result });
      });
    });
    return rows;
  }

  function getState(rows) {
    if (!allocationState) {
      var saved = null;
      try { var raw = localStorage.getItem(ALLOCATION_STORAGE_KEY); saved = raw ? JSON.parse(raw) : null; }
      catch (error) { console.warn("WIPS Allocazione: stato locale non leggibile", error); }
      allocationState = sanitizeState(saved, rows);
      saveState();
    } else allocationState = sanitizeState(allocationState, rows);
    return allocationState;
  }

  function saveState() {
    try { localStorage.setItem(ALLOCATION_STORAGE_KEY, JSON.stringify(allocationState)); }
    catch (error) { console.warn("WIPS Allocazione: impossibile salvare la simulazione", error); }
  }

  function categorySummary(rows, state, totalValue, postTotal) {
    var summary = {};
    TYPES.forEach(function (type) {
      var groupRows = rows.filter(function (row) { return row.t === type; });
      var current = groupRows.reduce(function (sum, row) { return sum + row.value; }, 0);
      var planned = groupRows.reduce(function (sum, row) { return sum + row.allocation; }, 0);
      var currentWeight = totalValue > 0 ? (current / totalValue) * 100 : 0;
      var afterWeight = postTotal > 0 ? ((current + planned) / postTotal) * 100 : 0;
      var target = state.targets[type] || 0;
      summary[type] = { type: type, rows: groupRows, current: current, planned: planned, currentWeight: currentWeight, afterWeight: afterWeight, target: target, delta: target - currentWeight, afterDelta: target - afterWeight };
    });
    return summary;
  }

  function buildSnapshot(portfolio) {
    var sourceRows = baseRows(portfolio);
    var state = getState(sourceRows);
    var totalValue = sourceRows.reduce(function (sum, row) { return sum + (row.c.va !== null ? row.c.va : row.c.cost); }, 0);
    var planned = Object.keys(state.allocations).reduce(function (sum, id) { return sum + Math.max(0, finite(state.allocations[id], 0)); }, 0);
    var postTotal = totalValue + planned;
    var capBase = totalValue + state.pool;
    var rows = sourceRows.map(function (base) {
      var value = base.c.va !== null ? base.c.va : base.c.cost;
      var allocation = Math.max(0, finite(state.allocations[base.a.id], 0));
      var weight = totalValue > 0 ? (value / totalValue) * 100 : 0;
      var postWeight = postTotal > 0 ? ((value + allocation) / postTotal) * 100 : 0;
      var gapFromPm = base.c.pm > 0 && base.c.price !== null ? ((base.c.price - base.c.pm) / base.c.pm) * 100 : 0;
      return { a: base.a, t: base.t, c: base.c, value: value, allocation: allocation, weight: weight, postWeight: postWeight, gapFromPm: gapFromPm, maxAllocation: Math.max(0, (state.maxWeight / 100) * capBase - value) };
    }).sort(function (left, right) { return left.t.localeCompare(right.t) || left.a.name.localeCompare(right.a.name); });
    return { rows: rows, state: state, totalValue: totalValue, postTotal: postTotal, planned: planned, remaining: state.pool - planned, categories: categorySummary(rows, state, totalValue, postTotal) };
  }

  function rowById(snapshot, id) { return snapshot.rows.find(function (row) { return row.a.id === id; }); }

  function simulate(row, amount) {
    var add = Math.max(0, finite(amount, 0));
    if (!row || row.c.price === null || row.c.price <= 0) return null;
    var quantity = row.a.qty + add / row.c.price;
    var cost = row.c.cost + add;
    var pm = quantity > 0 ? cost / quantity : row.c.pm;
    return { amount: add, pm: pm, changePct: row.c.pm > 0 ? ((pm - row.c.pm) / row.c.pm) * 100 : 0 };
  }

  function render() { renderAllocationLab(); }

  function setPool(value) {
    var snapshot = buildSnapshot();
    snapshot.state.pool = clamp(finite(value, snapshot.state.pool), 0, MAX_POOL);
    snapshot.state.scenario = "custom";
    saveState(); render();
  }

  function useBudgetLiquidity() {
    if (typeof window.bdgGetSnapshot !== "function") return;
    var snapshot = buildSnapshot();
    var budget = window.bdgGetSnapshot();
    snapshot.state.pool = Math.max(0, finite(budget && budget.investible, 0));
    snapshot.state.scenario = "custom";
    saveState(); render();
    if (typeof showToast === "function") showToast("Importo investibile del Budget applicato alla simulazione");
  }

  function setMaxWeight(value) {
    var snapshot = buildSnapshot();
    snapshot.state.maxWeight = clamp(finite(value, snapshot.state.maxWeight), 3, 60);
    snapshot.state.scenario = "custom";
    saveState(); render();
  }

  function setCategoryTarget(type, value) {
    var snapshot = buildSnapshot();
    var active = activeTypes(snapshot.rows);
    if (active.indexOf(type) < 0) return;
    var next = clamp(finite(value, snapshot.state.targets[type]), 0, 100);
    var others = active.filter(function (candidate) { return candidate !== type; });
    snapshot.state.targets[type] = next;
    if (!others.length) snapshot.state.targets[type] = 100;
    else {
      var available = 100 - next;
      var oldTotal = others.reduce(function (sum, candidate) { return sum + snapshot.state.targets[candidate]; }, 0);
      others.forEach(function (candidate) { snapshot.state.targets[candidate] = oldTotal > 0 ? (snapshot.state.targets[candidate] / oldTotal) * available : available / others.length; });
    }
    snapshot.state.scenario = "custom";
    saveState(); render();
  }

  function setAmount(id, value) {
    var snapshot = buildSnapshot();
    var row = rowById(snapshot, id);
    if (!row) return;
    var wanted = Math.max(0, finite(value, 0));
    var otherPlanned = snapshot.planned - row.allocation;
    var allowed = Math.min(row.maxAllocation, Math.max(0, snapshot.state.pool - otherPlanned));
    var applied = Math.min(wanted, allowed);
    if (applied > 0) snapshot.state.allocations[id] = applied;
    else delete snapshot.state.allocations[id];
    snapshot.state.scenario = "custom";
    saveState();
    if (wanted > allowed + 0.009 && typeof showToast === "function") showToast("Importo limitato dalla liquidità o dal limite di concentrazione");
    render();
  }

  function clearPlan() {
    var snapshot = buildSnapshot();
    snapshot.state.allocations = {};
    snapshot.state.scenario = "custom";
    saveState(); render();
    if (typeof showToast === "function") showToast("Piano di allocazione azzerato");
  }

  function distributeEvenly(rows, budget, allocations) {
    var remaining = Math.max(0, budget), active = rows.slice(), guard = 0;
    while (remaining > 0.01 && active.length && guard < 50) {
      var share = remaining / active.length, moved = 0;
      active = active.filter(function (row) {
        var already = allocations[row.a.id] || 0;
        var room = Math.max(0, row.maxAllocation - already);
        if (room <= 0.01) return false;
        var grant = Math.min(room, share);
        allocations[row.a.id] = already + grant;
        remaining -= grant; moved += grant;
        return room - grant > 0.01;
      });
      if (moved <= 0.01) break;
      guard++;
    }
    return remaining;
  }

  function scenarioTargets(kind, snapshot) {
    var targets = Object.assign({}, snapshot.state.targets);
    var active = activeTypes(snapshot.rows);
    var hasEtf = active.indexOf("etf") >= 0, hasCrypto = active.indexOf("crypto") >= 0;
    if (kind === "etf" && hasEtf) { targets.etf = hasCrypto ? 75 : 100; if (hasCrypto) targets.crypto = 25; if (active.indexOf("fondi") >= 0) targets.fondi = 0; }
    if (kind === "crypto" && hasCrypto) { targets.crypto = hasEtf ? 60 : 100; if (hasEtf) targets.etf = 40; if (active.indexOf("fondi") >= 0) targets.fondi = 0; }
    return normalizedTargets(targets, snapshot.rows);
  }

  function applyScenario(kind) {
    var snapshot = buildSnapshot();
    if (["target", "etf", "crypto"].indexOf(kind) < 0) return;
    var targets = scenarioTargets(kind, snapshot), allocations = {}, postTotal = snapshot.totalValue + snapshot.state.pool;
    TYPES.forEach(function (type) {
      var group = snapshot.categories[type];
      if (!group || !group.rows.length) return;
      var needed = Math.max(0, (targets[type] / 100) * postTotal - group.current);
      distributeEvenly(group.rows, needed, allocations);
    });
    snapshot.state.allocations = allocations;
    snapshot.state.scenario = kind;
    saveState(); render();
    if (typeof showToast === "function") showToast("Scenario trasparente aggiornato: " + scenarioLabel(kind));
  }

  function scenarioLabel(kind) { return kind === "target" ? "Verso i target" : kind === "etf" ? "Prevalenza ETF" : kind === "crypto" ? "Prevalenza Crypto" : "Personalizzato"; }

  function donut(snapshot) {
    var groups = { crypto: { value: 0, color: "#a78bfa", label: "Crypto" }, etf: { value: 0, color: "#38d9ff", label: "ETF" }, fondi: { value: 0, color: "#f0c040", label: "Fondi" } };
    snapshot.rows.forEach(function (row) { groups[row.t].value += row.value + row.allocation; });
    var cursor = 0, parts = [];
    TYPES.forEach(function (type) {
      var part = snapshot.postTotal > 0 ? (groups[type].value / snapshot.postTotal) * 100 : 0;
      if (part <= 0) return;
      parts.push(groups[type].color + " " + cursor.toFixed(2) + "% " + (cursor + part).toFixed(2) + "%"); cursor += part;
    });
    return { css: "conic-gradient(" + (parts.length ? parts.join(",") : "#202534 0 100%") + ")", groups: groups };
  }

  function concentration(snapshot) {
    return snapshot.rows.slice().sort(function (a, b) { return b.postWeight - a.postWeight; }).slice(0, 7).map(function (row) {
      var ratio = row.postWeight / snapshot.state.maxWeight;
      var tone = ratio > 1 ? "risk" : ratio > 0.75 ? "warn" : "good";
      var label = ratio > 1 ? "oltre limite" : ratio > 0.75 ? "vicino al limite" : "entro limite";
      return '<div class="alloc-conc-row"><span class="alloc-conc-name" title="' + escapeHtml(row.a.name) + '">' + escapeHtml(row.a.name) + '</span><div class="alloc-conc-track"><div class="alloc-conc-fill ' + tone + '" style="width:' + clamp(ratio * 100, 0, 100).toFixed(1) + '%"></div></div><span class="alloc-conc-state ' + (tone === "risk" ? "r" : tone === "warn" ? "y" : "g") + '">' + percent(row.postWeight, 1) + ' · ' + label + '</span></div>';
    }).join("");
  }

  function targetRows(snapshot) {
    return TYPES.filter(function (type) { return snapshot.categories[type].rows.length; }).map(function (type) {
      var group = snapshot.categories[type], deltaClass = group.delta > 0.1 ? "g" : group.delta < -0.1 ? "r" : "mu";
      var direction = group.delta > 0.1 ? "sotto target" : group.delta < -0.1 ? "sopra target" : "in linea";
      return '<div class="alloc-target-row"><div><span class="alloc-dot ' + type + '"></span><strong>' + typeLabel(type) + '</strong><small>Oggi ' + percent(group.currentWeight, 1) + ' · dopo piano ' + percent(group.afterWeight, 1) + '</small></div><label><span>Target</span><input class="alloc-input" type="number" min="0" max="100" step="1" value="' + group.target.toFixed(2) + '" aria-label="Target ' + typeLabel(type) + '" onchange="allocationSetCategoryTarget(\'' + type + '\', this.value)"><em>%</em></label><span class="alloc-target-delta ' + deltaClass + '">' + (group.delta > 0 ? "+" : "") + percent(group.delta, 1) + '<small>' + direction + '</small></span></div>';
    }).join("");
  }

  function mapRow(snapshot, row) {
    var simulation = simulate(row, row.allocation), pmChange = simulation ? simulation.changePct : null;
    var maxAmount = Math.max(row.allocation, Math.min(snapshot.state.pool, row.maxAllocation));
    var quote = JSON.stringify(row.a.id).replace(/\"/g, "&quot;");
    var pmText = pmChange === null ? '<span class="mu">—</span>' : '<span class="' + (pmChange < 0 ? "g" : pmChange > 0 ? "y" : "mu") + '">' + (pmChange < 0 ? "↓ " : pmChange > 0 ? "↑ " : "→ ") + percent(Math.abs(pmChange), 2) + "</span>";
    return '<div class="alloc-row"><div class="alloc-asset-name"><span class="alloc-type ' + (row.t === "crypto" ? "crypto" : row.t === "fondi" ? "fondi" : "") + '">' + typeLabel(row.t) + '</span><b title="' + escapeHtml(row.a.name) + '">' + escapeHtml(row.a.name) + '</b></div><div class="alloc-metric"><span class="' + (row.gapFromPm < 0 ? "g" : row.gapFromPm > 0 ? "y" : "mu") + '">' + (row.gapFromPm < 0 ? "↓ " : row.gapFromPm > 0 ? "↑ " : "→ ") + percent(Math.abs(row.gapFromPm), 2) + '</span><small>Prezzo vs P.M.</small></div><div class="alloc-metric">' + percent(row.weight, 1) + ' → <strong>' + percent(row.postWeight, 1) + '</strong><small>peso portfolio</small></div><div class="alloc-metric">' + pmText + '<small>variazione P.M. simulato</small></div><div class="alloc-plan-control"><input class="alloc-input" aria-label="Piano per ' + escapeHtml(row.a.name) + '" type="number" min="0" max="' + maxAmount.toFixed(2) + '" step="25" value="' + row.allocation.toFixed(2) + '" onchange="allocationSetAmount(' + quote + ', this.value)"><input class="alloc-range" type="range" min="0" max="' + maxAmount.toFixed(2) + '" step="25" value="' + Math.min(row.allocation, maxAmount).toFixed(2) + '" onchange="allocationSetAmount(' + quote + ', this.value)"' + (maxAmount <= 0.001 ? " disabled" : "") + '></div><div class="alloc-plan-note">Massimo ' + money(row.maxAllocation, 0) + ' con il limite attuale.</div></div>';
  }

  function mapRows(snapshot) {
    return TYPES.map(function (type) {
      var group = snapshot.categories[type]; if (!group.rows.length) return "";
      var delta = group.target - group.currentWeight;
      return '<details class="alloc-category" open><summary class="alloc-category-summary"><span class="alloc-category-title"><span class="alloc-dot ' + type + '"></span>' + typeLabel(type) + '</span><span class="alloc-category-count">' + group.rows.length + (group.rows.length === 1 ? " strumento" : " strumenti") + '</span><span class="alloc-category-metric">Oggi <strong>' + percent(group.currentWeight, 1) + '</strong></span><span class="alloc-category-metric">Target <strong>' + percent(group.target, 1) + '</strong></span><span class="alloc-category-metric">Scostamento <strong class="' + (delta > 0.1 ? "g" : delta < -0.1 ? "r" : "mu") + '">' + (delta > 0 ? "+" : "") + percent(delta, 1) + '</strong></span><span class="alloc-category-toggle" aria-hidden="true">⌄</span></summary><div class="alloc-category-body"><div class="alloc-map-head"><span>Asset</span><span>Prezzo vs P.M.</span><span>Peso</span><span>Nuovo P.M.</span><span>Piano €</span></div>' + group.rows.map(function (row) { return mapRow(snapshot, row); }).join("") + '</div></details>';
    }).join("");
  }

  function impactRows(snapshot) {
    var planned = snapshot.rows.filter(function (row) { return row.allocation > 0.009; });
    if (!planned.length) return '<div class="alloc-empty">Scegli uno scenario o inserisci un importo per vedere l’impatto stimato.</div>';
    return planned.sort(function (a, b) { return b.allocation - a.allocation; }).map(function (row) {
      var result = simulate(row, row.allocation), change = result ? result.changePct : 0;
      return '<div class="alloc-impact-row"><span>' + escapeHtml(row.a.name) + '</span><strong>' + money(row.allocation, 2) + '</strong><span>Nuovo P.M. ' + (result ? money(result.pm, 3) : "—") + '</span><em class="' + (change < 0 ? "g" : change > 0 ? "y" : "mu") + '">' + (change < 0 ? "↓ " : change > 0 ? "↑ " : "→ ") + percent(Math.abs(change), 2) + '</em></div>';
    }).join("");
  }

  function renderAllocationLab(portfolio) {
    var root = document.getElementById("sec-allocation");
    if (!root || typeof calc !== "function" || typeof P === "undefined") return;
    var snapshot = buildSnapshot(portfolio), state = snapshot.state, mix = donut(snapshot);
    var budget = typeof window.bdgGetSnapshot === "function" ? window.bdgGetSnapshot() : null;
    var budgetInvestible = Math.max(0, finite(budget && budget.investible, 0));
    var plannedCount = snapshot.rows.filter(function (row) { return row.allocation > 0; }).length;
    root.innerHTML = '<div class="alloc-wrap"><div class="alloc-hero"><section class="alloc-panel alloc-hero-main"><div class="alloc-eyebrow">Guida decisionale · simulazione locale</div><h1 class="alloc-title">Allocazione</h1><p class="alloc-copy">Leggi la distribuzione attuale, imposta i tuoi pesi di riferimento e prova una ripartizione della liquidità. Nessuna proposta modifica posizioni o prezzi reali.</p><div class="alloc-note"><span>ⓘ</span><span>I target sono un riferimento personale modificabile, non una raccomandazione. Gli importi restano una simulazione finché non decidi diversamente.</span></div></section><aside class="alloc-panel"><div class="alloc-control-grid"><label class="alloc-field"><span class="alloc-label">Liquidità da simulare<small>Puoi usare l’importo già calcolato nel Budget oppure inserirne uno diverso.</small></span><input class="alloc-input" type="number" min="0" step="50" value="' + state.pool.toFixed(2) + '" aria-label="Liquidità da simulare" onchange="allocationSetPool(this.value)"></label><label class="alloc-field"><span class="alloc-label">Limite per singola posizione<small>Protezione visiva contro una concentrazione eccessiva nel piano.</small></span><input class="alloc-input" type="number" min="3" max="60" step="1" value="' + state.maxWeight.toFixed(2) + '" aria-label="Limite per singola posizione" onchange="allocationSetMaxWeight(this.value)"></label><div class="alloc-actions"><button class="alloc-btn" type="button" onclick="allocationUseBudgetLiquidity()">Usa Budget: ' + money(budgetInvestible, 2) + '</button></div></div></aside></div><div class="alloc-kpis"><div class="alloc-kpi"><span class="alloc-label">Valore portfolio</span><strong>' + money(snapshot.totalValue, 2) + '</strong><small>Dati correnti</small></div><div class="alloc-kpi"><span class="alloc-label">Liquidità simulata</span><strong class="b">' + money(state.pool, 2) + '</strong><small>Non investita automaticamente</small></div><div class="alloc-kpi"><span class="alloc-label">Piano distribuito</span><strong class="' + (snapshot.planned > 0 ? "g" : "mu") + '">' + money(snapshot.planned, 2) + '</strong><small>Su ' + plannedCount + ' posizioni</small></div><div class="alloc-kpi ' + (snapshot.remaining < 0 ? "risk" : snapshot.remaining > 0 ? "warn" : "") + '"><span class="alloc-label">Da decidere</span><strong class="' + (snapshot.remaining > 0 ? "y" : "g") + '">' + money(snapshot.remaining, 2) + '</strong><small>' + (snapshot.remaining > 0 ? "Liquidità non ancora nel piano" : "Piano completo") + '</small></div></div><section class="alloc-card"><div class="alloc-card-head"><div><h2>1 · Distribuzione attuale e target</h2><p class="alloc-card-sub">Confronto diretto tra il peso effettivo, il riferimento che scegli e il risultato dopo il piano.</p></div></div><div class="alloc-targets">' + targetRows(snapshot) + '</div></section><section class="alloc-card alloc-scenario-card"><div><h2>2 · Prova una distribuzione</h2><p class="alloc-card-sub">Le proposte ripartiscono in modo uniforme dentro ogni categoria, rispettando i target e il limite per posizione. Ogni passaggio resta visibile e modificabile.</p></div><div class="alloc-actions" role="group" aria-label="Scenari di distribuzione"><button class="alloc-btn ' + (state.scenario === "target" ? "active" : "") + '" type="button" onclick="allocationApplyScenario(\'target\')">Verso i target</button><button class="alloc-btn ' + (state.scenario === "etf" ? "active" : "") + '" type="button" onclick="allocationApplyScenario(\'etf\')">Prevalenza ETF</button><button class="alloc-btn ' + (state.scenario === "crypto" ? "active" : "") + '" type="button" onclick="allocationApplyScenario(\'crypto\')">Prevalenza Crypto</button><button class="alloc-btn secondary" type="button" onclick="allocationClearPlan()">Azzera piano</button></div><div class="alloc-chips"><span class="alloc-chip">Scenario: ' + scenarioLabel(state.scenario) + '</span><span class="alloc-chip">Importi modificabili riga per riga</span></div></section><div class="alloc-grid"><section class="alloc-card"><h2>3 · Piano per asset</h2><p class="alloc-card-sub">Apri una categoria per modificare gli importi. Vedi insieme peso, distanza dal P.M. e nuovo P.M. stimato.</p><div class="alloc-map">' + mapRows(snapshot) + '</div></section><aside class="alloc-card"><h2>4 · Mix e concentrazione dopo il piano</h2><p class="alloc-card-sub">Il grafico rappresenta esclusivamente la simulazione in corso.</p><div class="alloc-composition"><div class="alloc-donut" style="--alloc-donut:' + mix.css + '"></div><div class="alloc-legend">' + TYPES.filter(function (type) { return mix.groups[type].value > 0; }).map(function (type) { var group = mix.groups[type]; var weight = snapshot.postTotal > 0 ? (group.value / snapshot.postTotal) * 100 : 0; return '<div class="alloc-legend-row"><i class="alloc-dot ' + type + '"></i><span>' + group.label + '</span><strong>' + percent(weight, 1) + '</strong></div>'; }).join("") + '</div></div><div class="alloc-separator"></div><h3>Concentrazione per posizione</h3><p class="alloc-card-sub">Il limite selezionato è ' + percent(state.maxWeight, 0) + ' del valore teorico dopo il piano.</p><div class="alloc-concentration">' + concentration(snapshot) + '</div></aside></div><section class="alloc-card"><h2>5 · Impatto stimato</h2><p class="alloc-card-sub">Riepilogo degli asset a cui hai assegnato liquidità: importo, nuovo prezzo medio e variazione rispetto al P.M. attuale.</p><div class="alloc-impact-list">' + impactRows(snapshot) + '</div></section><p class="alloc-disclaimer">Allocazione riusa esclusivamente dati e calcoli già presenti in WIPS. Non modifica portfolio, quotazioni, CSV, backup, Kraken, Budget o What‑If globale. I valori copiabili restano disponibili nelle tabelle.</p></div>';
  }

  window.renderAllocationLab = renderAllocationLab;
  window.allocationGetSnapshot = buildSnapshot;
  window.allocationSetPool = setPool;
  window.allocationUseBudgetLiquidity = useBudgetLiquidity;
  window.allocationSetMaxWeight = setMaxWeight;
  window.allocationSetCategoryTarget = setCategoryTarget;
  window.allocationSetAmount = setAmount;
  window.allocationClearPlan = clearPlan;
  window.allocationApplyScenario = applyScenario;
})();
