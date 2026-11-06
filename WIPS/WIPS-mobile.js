/* WIPS Mobile — presentazione adattata; dati, formule e persistenza restano unici. */
(function () {
  "use strict";

  var LAYOUT_KEY = "wips_layout_mode_v1";
  var UI_KEY = "wips_mobile_ui_v1";
  var SECTIONS = ["portfolio", "whatif", "analysis", "allocation", "budget", "tools"];
  var DEFAULT_UI = { section: "portfolio", filter: "all", selectedAsset: null };
  var ui = readUi();
  var lastDataStatus = { message: "Dati locali pronti", state: "ok" };

  function cloneDefaultUi() { return { section: DEFAULT_UI.section, filter: DEFAULT_UI.filter, selectedAsset: DEFAULT_UI.selectedAsset }; }
  function readUi() {
    try {
      var raw = window.localStorage.getItem(UI_KEY), value = raw ? JSON.parse(raw) : null;
      if (!value || typeof value !== "object") return cloneDefaultUi();
      return { section: SECTIONS.indexOf(value.section) >= 0 ? value.section : "portfolio", filter: ["all", "crypto", "etf", "fondi"].indexOf(value.filter) >= 0 ? value.filter : "all", selectedAsset: typeof value.selectedAsset === "string" ? value.selectedAsset : null };
    } catch (error) { return cloneDefaultUi(); }
  }
  function saveUi() { try { window.localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (error) {} }
  function isMobileMode() { return document.body.classList.contains("mode-mobile"); }
  function esc(value) { return String(value === undefined || value === null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function num(value, digits, suffix) { return N(value, digits, suffix || ""); }
  function money(value) { return num(value, 3) + " €"; }
  function signedMoney(value) { return S(value, 3, "€"); }
  function numberOrZero(value) { var parsed = Number(value); return isFinite(parsed) && parsed > 0 ? parsed : 0; }
  function pnlClass(value) { return value > 0 ? "m-pnl-positive" : value < 0 ? "m-pnl-negative" : "m-pnl-neutral"; }
  function typeLabel(type) { return type === "crypto" ? "Crypto" : type === "etf" ? "ETF" : "Fondi BCC"; }

  function makeRows(portfolio, add) {
    var rows = [];
    PORTFOLIO_TYPES.forEach(function (type) { (portfolio[type] || []).forEach(function (asset) { var c = calc(asset, add); rows.push({ a: asset, c: c, type: type, value: c.va !== null ? c.va : c.cost }); }); });
    return rows;
  }
  function totals(rows) { return rows.reduce(function (result, row) { result.invested += row.c.cost; if (row.c.va !== null) result.value += row.c.va; return result; }, { invested: 0, value: 0 }); }
  function countPriced(rows) { return rows.filter(function (row) { return row.c.price !== null; }).length; }
  function preferredAsset(rows) { var found = rows.filter(function (row) { return row.a.id === ui.selectedAsset; })[0]; if (found) return found; ui.selectedAsset = rows.length ? rows[0].a.id : null; return rows[0] || null; }
  function quoteStatusText() { if (lastDataStatus && lastDataStatus.message) return lastDataStatus.message; return "Prezzi salvati localmente. Apri Strumenti per gli aggiornamenti."; }

  function assetCard(row, add) {
    var a = row.a, c = row.c, pnl = c.re === null ? 0 : c.re, pct = c.rp;
    var whatIf = add > 0 && c.np !== null ? '<div class="m-detail-row"><span class="m-detail-label">Nuovo P.M.</span><span class="m-detail-value">' + money(c.np) + (c.dpp !== null ? ' <span class="' + pnlClass(-c.dpp) + '">' + (c.dpp < 0 ? "↓ " : c.dpp > 0 ? "↑ +" : "→ ") + num(Math.abs(c.dpp), 3) + "%</span>" : "") + "</span></div>" : "";
    var selectButton = '<button class="m-secondary-btn" type="button" onclick="mobileSelectAsset(\'' + esc(a.id) + '\', \'whatif\')">Simula su questo asset</button>';
    return '<details class="m-asset-card"><summary class="m-asset-summary"><div class="m-asset-primary"><div><div class="m-asset-title">' + esc(a.name) + '</div><div class="m-asset-type">' + typeLabel(row.type) + " · " + esc(a.id) + '</div></div><div class="m-asset-value">' + money(row.value) + '</div></div><div class="m-asset-pnl m-row"><span class="' + pnlClass(pnl) + '">' + signedMoney(pnl) + '</span><span class="m-pct ' + pnlClass(pct || 0) + '">' + (pct === null ? "—" : (pct >= 0 ? "+" : "") + num(pct, 3) + "%") + '</span></div></summary><div class="m-asset-detail"><div class="m-detail-row"><span class="m-detail-label">Capitale investito</span><span class="m-detail-value">' + money(c.cost) + '</span></div><div class="m-detail-row"><span class="m-detail-label">Quantità</span><span class="m-detail-value">' + num(a.qty, 3) + '</span></div><div class="m-detail-row"><span class="m-detail-label">P.M. attuale</span><span class="m-detail-value">' + money(c.pm) + '</span></div><div class="m-detail-row"><span class="m-detail-label">Prezzo oggi</span><span class="m-detail-value">' + (c.price === null ? "—" : money(c.price)) + '</span></div>' + whatIf + selectButton + '</div></details>';
  }

  function portfolioPanel(rows, add) {
    var filterRows = ui.filter === "all" ? rows : rows.filter(function (row) { return row.type === ui.filter; });
    var filters = ["all", "crypto", "etf"];
    if (rows.some(function (row) { return row.type === "fondi"; })) filters.push("fondi");
    var chips = filters.map(function (filter) { return '<button type="button" aria-pressed="' + String(ui.filter === filter) + '" onclick="mobileSetFilter(\'' + filter + '\')">' + (filter === "all" ? "Tutti" : typeLabel(filter)) + '</button>'; }).join("");
    return '<section class="m-panel" aria-label="Portafoglio mobile"><h1 class="m-panel-title">Portafoglio</h1><div class="m-filter-row">' + chips + '</div>' + (filterRows.length ? filterRows.slice().sort(function (a, b) { return b.value - a.value; }).map(function (row) { return assetCard(row, add); }).join("") : '<div class="m-empty">Nessuna posizione in questa sezione.</div>') + '</section>';
  }

  function whatIfPanel(rows, add) {
    var selected = preferredAsset(rows); if (!selected) return '<div class="m-empty">Nessun asset da simulare.</div>';
    var c = selected.c, quick = [100, 500, 1000, 2500].map(function (amount) { return '<button type="button" onclick="mobileSetGlobalWhatIf(' + amount + ')">+' + amount.toLocaleString("it-IT") + ' €</button>'; }).join("");
    var pmDelta = c.dpp === null ? "—" : (c.dpp < 0 ? "↓ " : c.dpp > 0 ? "↑ +" : "→ ") + num(Math.abs(c.dpp), 3) + "%";
    return '<section class="m-panel" aria-label="Simulazione What-If"><h1 class="m-panel-title">What‑If</h1><div class="m-surface"><div class="m-whatif-head"><div><div class="m-section-label">Importo aggiuntivo</div><div class="m-whatif-current">Stessi calcoli della modalità Desktop.</div></div><strong class="m-asset-value">' + money(add) + '</strong></div><div class="m-slider-wrap"><input aria-label="Importo aggiuntivo What-If" type="range" min="0" max="10000" step="1" value="' + add + '" oninput="mobileSetGlobalWhatIf(this.value)"></div><input class="m-number-input" aria-label="Importo What-If in euro" type="number" min="0" max="10000" step="1" value="' + add + '" oninput="mobileSetGlobalWhatIf(this.value)"><div class="m-quick-row">' + quick + '</div></div><div class="m-surface"><div class="m-whatif-head"><div><div class="m-section-label">Asset selezionato</div><div class="m-asset-title">' + esc(selected.a.name) + '</div></div><button class="m-secondary-btn m-inline-btn" type="button" onclick="mobileSetSection(\'portfolio\')">Cambia</button></div><div class="m-whatif-grid"><div class="m-kpi"><span class="m-label">Nuovo P.M.</span><strong class="m-kpi-value">' + money(c.np) + '</strong></div><div class="m-kpi"><span class="m-label">Variazione P.M.</span><strong class="m-kpi-value ' + pnlClass(-(c.dpp || 0)) + '">' + pmDelta + '</strong></div><div class="m-kpi"><span class="m-label">Quantità nuova</span><strong class="m-kpi-value">' + num(c.nq, 3) + '</strong></div><div class="m-kpi"><span class="m-label">Titoli aggiunti</span><strong class="m-kpi-value b">' + num(c.ta, 3) + '</strong></div></div></div></section>';
  }

  function analyticsPanel(rows) {
    var total = totals(rows), pnl = total.value - total.invested, pct = total.invested > 0 ? (pnl / total.invested) * 100 : 0;
    var chartRows = ui.filter === "all" ? rows : rows.filter(function (row) { return row.type === ui.filter; });
    var charts = typeof window.buildWipsAnalyticsCharts === "function" ? window.buildWipsAnalyticsCharts(chartRows, ui.filter === "all" ? "all" : ui.filter) : "";
    return '<section class="m-panel" aria-label="Analisi mobile"><h1 class="m-panel-title">Analisi</h1><div class="m-kpi-grid"><div class="m-kpi"><span class="m-label">Investito</span><strong class="m-kpi-value">' + money(total.invested) + '</strong></div><div class="m-kpi"><span class="m-label">Valore</span><strong class="m-kpi-value">' + money(total.value) + '</strong></div><div class="m-kpi"><span class="m-label">P&L</span><strong class="m-kpi-value ' + pnlClass(pnl) + '">' + signedMoney(pnl) + '</strong></div><div class="m-kpi"><span class="m-label">P&L %</span><strong class="m-kpi-value ' + pnlClass(pct) + '">' + (pct >= 0 ? "+" : "") + num(pct, 3) + '%</strong></div></div>' + charts + '<div class="m-surface"><div class="m-section-label">Distribuzione liquidità</div><div class="m-whatif-current">Target personali, liquidità e impatto del piano sono disponibili nella sezione Allocazione.</div><button class="m-secondary-btn" type="button" onclick="mobileSetSection(\'allocation\')">Apri Allocazione</button></div></section>';
  }

  function allocationPanel() {
    if (typeof window.allocationGetSnapshot !== "function") return '<div class="m-empty">Allocazione non disponibile.</div>';
    var snapshot = window.allocationGetSnapshot(), state = snapshot.state;
    var categories = ["etf", "crypto", "fondi"].filter(function (type) { return snapshot.categories[type] && snapshot.categories[type].rows.length; });
    var categoryCards = categories.map(function (type) {
      var group = snapshot.categories[type], delta = group.delta, tone = delta > .1 ? "m-pnl-positive" : delta < -.1 ? "m-pnl-negative" : "m-pnl-neutral";
      return '<div class="m-allocation-category"><div><strong>' + typeLabel(type) + '</strong><small>Oggi ' + num(group.currentWeight, 2) + '% · dopo piano ' + num(group.afterWeight, 2) + '%</small></div><label><span>Target</span><input class="m-number-input" type="number" min="0" max="100" step="1" value="' + group.target.toFixed(2) + '" onchange="mobileSetAllocationTarget(\'' + type + '\', this.value)"><em>%</em></label><b class="' + tone + '">' + (delta > 0 ? "+" : "") + num(delta, 2) + '%</b></div>';
    }).join("");
    var rows = snapshot.rows.map(function (row) {
      return '<details class="m-allocation-asset"><summary><span>' + esc(row.a.name) + '</span><strong>' + money(row.allocation) + '</strong></summary><div><span>Peso ' + num(row.weight, 2) + '% → ' + num(row.postWeight, 2) + '%</span><input class="m-number-input" aria-label="Piano per ' + esc(row.a.name) + '" type="number" min="0" max="' + Math.max(row.allocation, Math.min(state.pool, row.maxAllocation)).toFixed(2) + '" step="25" value="' + row.allocation.toFixed(2) + '" onchange="mobileSetAllocationAmount(\'' + esc(row.a.id) + '\', this.value)"></div></details>';
    }).join("");
    return '<section class="m-panel" aria-label="Allocazione mobile"><h1 class="m-panel-title">Allocazione</h1><div class="m-surface"><div class="m-section-label">Liquidità da simulare</div><input class="m-number-input" type="number" min="0" step="50" value="' + state.pool.toFixed(2) + '" onchange="mobileSetAllocationPool(this.value)"><div class="m-quick-row"><button type="button" onclick="mobileUseBudgetLiquidity()">Usa Budget</button><button type="button" onclick="mobileClearAllocationPlan()">Azzera piano</button></div></div><div class="m-kpi-grid"><div class="m-kpi"><span class="m-label">Piano</span><strong class="m-kpi-value">' + money(snapshot.planned) + '</strong></div><div class="m-kpi"><span class="m-label">Da decidere</span><strong class="m-kpi-value ' + (snapshot.remaining > 0 ? "m-pnl-neutral" : "m-pnl-positive") + '">' + money(snapshot.remaining) + '</strong></div></div><div class="m-surface"><div class="m-section-label">Target personali</div><div class="m-allocation-categories">' + categoryCards + '</div></div><div class="m-surface"><div class="m-section-label">Scenari trasparenti</div><div class="m-quick-row"><button type="button" onclick="mobileApplyAllocationScenario(\'target\')">Verso target</button><button type="button" onclick="mobileApplyAllocationScenario(\'etf\')">Più ETF</button><button type="button" onclick="mobileApplyAllocationScenario(\'crypto\')">Più Crypto</button></div><p class="m-whatif-current">Ripartizione uniforme nelle categorie, con limite di concentrazione già impostato.</p></div><details class="m-surface m-details"><summary>Modifica il piano per asset</summary><div class="m-allocation-assets">' + rows + '</div></details></section>';
  }

  function budgetCalendar(events) {
    if (!events || !events.length) return '<div class="m-empty">Nessun evento datato nei prossimi due mesi.</div>';
    var grouped = {};
    events.forEach(function (event) { var key = event.date && event.date.toISOString ? event.date.toISOString().slice(0, 10) : ""; if (!key) return; if (!grouped[key]) grouped[key] = { date: event.date, events: [] }; grouped[key].events.push(event); });
    return Object.keys(grouped).sort().map(function (key) { var group = grouped[key]; return '<div class="m-calendar-day"><strong>' + new Date(group.date).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" }) + '</strong>' + group.events.map(function (event) { return '<span><i class="' + (event.kind === "income" ? "income" : "expense") + '"></i>' + esc(event.name) + (event.amount > 0 ? '<em>' + money(event.amount) + '</em>' : "") + '</span>'; }).join("") + '</div>'; }).join("");
  }

  function budgetPanel() {
    var budget = typeof window.bdgGetSnapshot === "function" ? window.bdgGetSnapshot() : null;
    if (!budget) return '<div class="m-empty">Budget non disponibile.</div>';
    var tone = budget.investible < 0 ? "m-pnl-negative" : budget.statusType === "warn" ? "m-pnl-neutral" : "m-pnl-positive";
    return '<section class="m-panel" aria-label="Budget mobile"><h1 class="m-panel-title">Budget</h1><div class="m-surface m-budget-hero"><div class="m-section-label">Liquidità attuale</div><input class="m-number-input" type="number" min="0" step="10" value="' + budget.liq.toFixed(2) + '" oninput="mobileSetBudgetLiquidity(this.value)"><p class="m-whatif-current">Aggiorna subito spese riservate, margine e importo disponibile.</p></div><div class="m-kpi-grid"><div class="m-kpi"><span class="m-label">Uscite previste</span><strong class="m-kpi-value">' + money(budget.expenseTotal) + '</strong></div><div class="m-kpi"><span class="m-label">Margine</span><strong class="m-kpi-value">' + money(budget.safety) + '</strong></div><div class="m-kpi"><span class="m-label">Investibile</span><strong class="m-kpi-value ' + tone + '">' + money(budget.investible) + '</strong></div><div class="m-kpi"><span class="m-label">Prossimo stipendio</span><strong class="m-kpi-value">' + budget.days + ' g</strong></div></div><div class="m-surface"><div class="m-section-label">Stato decisionale</div><div class="m-whatif-current"><strong class="' + tone + '">' + esc(budget.statusLabel) + '</strong> · ' + esc(budget.nextExpense) + '</div><button class="m-secondary-btn" type="button" onclick="mobileSetSection(\'allocation\')">Usa nella simulazione di Allocazione</button></div><details class="m-surface m-details" open><summary>Calendario decisionale · due mesi</summary><div class="m-calendar-list">' + budgetCalendar(budget.calendarItems) + '</div></details><button class="m-secondary-btn" type="button" onclick="mobileOpenDesktopTab(\'budget\')">Gestisci voci e scadenze</button></section>';
  }

  function toolCard(title, description, action, label, primary) { return '<div class="m-tool-card"><div><strong>' + title + '</strong><p>' + description + '</p></div><button class="' + (primary ? "m-primary-btn" : "") + '" type="button" onclick="' + action + '">' + label + '</button></div>'; }
  function toolsPanel(rows) {
    var coverage = countPriced(rows) + "/" + rows.length;
    var cryptoTime = typeof cryptoQuoteMeta !== "undefined" && cryptoQuoteMeta && cryptoQuoteMeta.updatedAt ? new Date(cryptoQuoteMeta.updatedAt).toLocaleString("it-IT") : "nessun aggiornamento Kraken in questa sessione";
    return '<section class="m-panel" aria-label="Strumenti e dati"><h1 class="m-panel-title">Strumenti</h1><div id="mobile-data-status" class="m-data-status ' + esc(lastDataStatus.state || "") + '">' + esc(quoteStatusText()) + '</div><div class="m-surface"><div class="m-section-label">Copertura prezzi</div><div class="m-whatif-current"><strong>' + coverage + '</strong> posizioni con quotazione · Kraken: ' + esc(cryptoTime) + '</div></div>' + toolCard("Aggiorna crypto", "Quotazioni spot EUR da Kraken: stesso flusso del desktop.", "mobileRefreshCrypto()", "↻ Kraken", true) + toolCard("Portfolio / prezzi", "Modifica posizioni e inserisci i prezzi manuali ETF.", "mobileOpenDesktopTab('edit')", "Apri") + toolCard("Backup dati", "Esporta un JSON completo, senza modificare il portafoglio.", "exportFullBackup()", "Esporta") + toolCard("Ripristino", "Importa un backup validato con anteprima.", "openBackupImport()", "Importa") + toolCard("CSV", "Scarica la tabella completa del portafoglio.", "exportCSV()", "CSV") + '<div class="m-mobile-footer"><button type="button" onclick="setWipsLayoutMode(\'desktop\')">Passa alla modalità Desktop</button></div></section>';
  }

  function renderMobileExperience(portfolio) {
    if (!isMobileMode()) return;
    var root = document.getElementById("mobile-shell"); if (!root || typeof calc !== "function" || typeof P === "undefined") return;
    portfolio = portfolio || portfolioSnapshot();
    var addInput = document.getElementById("addAmt"), add = numberOrZero(addInput ? addInput.value : 0), rows = makeRows(portfolio, add), summary = totals(rows), pnl = summary.value - summary.invested, pct = summary.invested > 0 ? (pnl / summary.invested) * 100 : 0;
    var panels = { portfolio: function () { return portfolioPanel(rows, add); }, whatif: function () { return whatIfPanel(rows, add); }, analysis: function () { return analyticsPanel(rows); }, allocation: allocationPanel, budget: budgetPanel, tools: function () { return toolsPanel(rows); } };
    root.innerHTML = '<div class="m-hero"><div class="m-hero-top"><span class="m-overline">WIPS · modalità mobile</span><span class="m-overline">' + rows.length + ' asset</span></div><div class="m-hero-main">' + money(summary.value) + '</div><div class="m-hero-metrics"><div class="m-hero-metric"><span class="m-label">P&L complessivo</span><strong class="' + pnlClass(pnl) + '">' + signedMoney(pnl) + '</strong></div><div class="m-hero-metric"><span class="m-label">Rendimento</span><strong class="' + pnlClass(pct) + '">' + (pct >= 0 ? "+" : "") + num(pct, 3) + '%</strong></div></div></div><nav class="m-nav" aria-label="Navigazione mobile">' + mobileNavButton("portfolio", "Portfolio") + mobileNavButton("whatif", "What‑If") + mobileNavButton("analysis", "Analisi") + mobileNavButton("allocation", "Allocazione") + mobileNavButton("budget", "Budget") + mobileNavButton("tools", "Strumenti") + '</nav>' + panels[ui.section]();
  }
  function mobileNavButton(section, label) { return '<button type="button" aria-pressed="' + String(ui.section === section) + '" onclick="mobileSetSection(\'' + section + '\')">' + label + '</button>'; }

  window.renderMobileExperience = renderMobileExperience;
  window.setWipsLayoutMode = function (mode, options) {
    var nextMode = mode === "mobile" ? "mobile" : "desktop", persist = !options || options.persist !== false;
    document.body.classList.toggle("mode-mobile", nextMode === "mobile"); document.body.classList.toggle("mode-desktop", nextMode === "desktop");
    var desktopButton = document.getElementById("mode-desktop"), mobileButton = document.getElementById("mode-mobile");
    if (desktopButton) desktopButton.setAttribute("aria-pressed", String(nextMode === "desktop")); if (mobileButton) mobileButton.setAttribute("aria-pressed", String(nextMode === "mobile"));
    if (persist) try { window.localStorage.setItem(LAYOUT_KEY, nextMode); } catch (error) {}
    if (typeof renderAll === "function") renderAll();
  };
  window.mobileSetSection = function (section) { if (SECTIONS.indexOf(section) < 0) return; ui.section = section; saveUi(); renderMobileExperience(); };
  window.mobileSetFilter = function (filter) { if (["all", "crypto", "etf", "fondi"].indexOf(filter) < 0) return; ui.filter = filter; saveUi(); renderMobileExperience(); };
  window.mobileSelectAsset = function (assetId, section) { ui.selectedAsset = String(assetId || ""); ui.section = section === "whatif" ? "whatif" : "portfolio"; saveUi(); renderMobileExperience(); };
  window.mobileSetGlobalWhatIf = function (value) { var amount = Math.min(10000, Math.max(0, numberOrZero(value))); if (typeof syncIn === "function") syncIn(amount); if (typeof syncSl === "function") syncSl(amount); if (typeof renderAll === "function") renderAll(); };
  window.mobileSetBudgetLiquidity = function (value) { if (typeof window.bdgSetLiquidity === "function") window.bdgSetLiquidity(value); else renderMobileExperience(); };
  window.mobileSetAllocationPool = function (value) { if (typeof window.allocationSetPool === "function") window.allocationSetPool(value); renderMobileExperience(); };
  window.mobileUseBudgetLiquidity = function () { if (typeof window.allocationUseBudgetLiquidity === "function") window.allocationUseBudgetLiquidity(); renderMobileExperience(); };
  window.mobileSetAllocationTarget = function (type, value) { if (typeof window.allocationSetCategoryTarget === "function") window.allocationSetCategoryTarget(type, value); renderMobileExperience(); };
  window.mobileSetAllocationAmount = function (id, value) { if (typeof window.allocationSetAmount === "function") window.allocationSetAmount(id, value); renderMobileExperience(); };
  window.mobileApplyAllocationScenario = function (kind) { if (typeof window.allocationApplyScenario === "function") window.allocationApplyScenario(kind); renderMobileExperience(); };
  window.mobileClearAllocationPlan = function () { if (typeof window.allocationClearPlan === "function") window.allocationClearPlan(); renderMobileExperience(); };
  window.mobileOpenDesktopTab = function (tab) { window.setWipsLayoutMode("desktop"); if (typeof switchTab === "function") switchTab(tab); };
  window.mobileRefreshCrypto = function () { if (typeof refreshCryptoQuotes === "function") refreshCryptoQuotes(); };
  window.updateMobileDataStatus = function (message, state) { lastDataStatus = { message: message || "Dati aggiornati", state: state || "" }; var node = document.getElementById("mobile-data-status"); if (node) { node.className = "m-data-status " + (lastDataStatus.state || ""); node.textContent = lastDataStatus.message; } };

  (function initialiseLayout() {
    var saved = null; try { saved = window.localStorage.getItem(LAYOUT_KEY); } catch (error) {}
    var initialMode = saved === "desktop" || saved === "mobile" ? saved : window.matchMedia && window.matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop";
    window.setWipsLayoutMode(initialMode, { persist: false });
  })();
})();
