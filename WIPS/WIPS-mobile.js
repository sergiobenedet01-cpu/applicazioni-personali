/* WIPS Mobile
 * Solo presentazione e preferenze UI. Le formule restano esclusivamente in calc(). */
(function () {
  "use strict";

  var LAYOUT_KEY = "wips_layout_mode_v1";
  var UI_KEY = "wips_mobile_ui_v1";
  var DEFAULT_UI = { section: "portfolio", filter: "all", selectedAsset: null };
  var ui = readUi();
  var lastDataStatus = { message: "Dati locali pronti", state: "ok" };

  /* Il renderer desktop può aver già prodotto questo messaggio prima del
     caricamento del modulo Mobile: lo riutilizziamo, senza nuova richiesta. */
  var initialStatusNode = document.getElementById("cryptoQuoteStatus");
  if (initialStatusNode && initialStatusNode.textContent) {
    lastDataStatus = {
      message: initialStatusNode.textContent,
      state: initialStatusNode.classList.contains("error")
        ? "error"
        : initialStatusNode.classList.contains("warn")
          ? "warn"
          : initialStatusNode.classList.contains("ok")
            ? "ok"
            : "",
    };
  }

  function cloneDefaultUi() {
    return {
      section: DEFAULT_UI.section,
      filter: DEFAULT_UI.filter,
      selectedAsset: DEFAULT_UI.selectedAsset,
    };
  }

  function readUi() {
    try {
      var raw = window.localStorage.getItem(UI_KEY);
      if (!raw) return cloneDefaultUi();
      var value = JSON.parse(raw);
      if (!value || typeof value !== "object") return cloneDefaultUi();
      return {
        section: ["portfolio", "whatif", "analytics", "tools"].indexOf(value.section) >= 0
          ? value.section
          : "portfolio",
        filter: ["all", "crypto", "etf", "fondi"].indexOf(value.filter) >= 0
          ? value.filter
          : "all",
        selectedAsset:
          typeof value.selectedAsset === "string" ? value.selectedAsset : null,
      };
    } catch (error) {
      return cloneDefaultUi();
    }
  }

  function saveUi() {
    try {
      window.localStorage.setItem(UI_KEY, JSON.stringify(ui));
    } catch (error) {
      /* La UI resta utilizzabile anche se il browser blocca localStorage. */
    }
  }

  function isMobileMode() {
    return document.body.classList.contains("mode-mobile");
  }

  function esc(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function num(value, digits, suffix) {
    return N(value, digits, suffix || "");
  }

  function money(value) {
    return num(value, 3) + " €";
  }

  function signedMoney(value) {
    return S(value, 3, "€");
  }

  function numberOrZero(value) {
    var parsed = Number(value);
    return isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function pnlClass(value) {
    return value > 0 ? "m-pnl-positive" : value < 0 ? "m-pnl-negative" : "m-pnl-neutral";
  }

  function typeLabel(type) {
    if (type === "crypto") return "Crypto";
    if (type === "etf") return "ETF";
    return "Fondi BCC";
  }

  function makeRows(portfolio, add) {
    var rows = [];
    PORTFOLIO_TYPES.forEach(function (type) {
      (portfolio[type] || []).forEach(function (asset) {
        var c = calc(asset, add);
        rows.push({ a: asset, c: c, type: type, value: c.va !== null ? c.va : c.cost });
      });
    });
    return rows;
  }

  function preferredAsset(rows) {
    var found = rows.filter(function (row) {
      return row.a.id === ui.selectedAsset;
    })[0];
    if (found) return found;
    ui.selectedAsset = rows.length ? rows[0].a.id : null;
    return rows[0] || null;
  }

  function countPriced(rows) {
    return rows.filter(function (row) {
      return row.c.price !== null;
    }).length;
  }

  function totals(rows) {
    return rows.reduce(
      function (result, row) {
        result.invested += row.c.cost;
        if (row.c.va !== null) result.value += row.c.va;
        return result;
      },
      { invested: 0, value: 0 },
    );
  }

  function quoteStatusText() {
    if (lastDataStatus && lastDataStatus.message) return lastDataStatus.message;
    if (typeof cryptoQuoteMeta !== "undefined" && cryptoQuoteMeta && cryptoQuoteMeta.updatedAt) {
      return "Kraken aggiornato: " + new Date(cryptoQuoteMeta.updatedAt).toLocaleString("it-IT");
    }
    return "Prezzi salvati localmente. Apri Dettagli per gli aggiornamenti.";
  }

  function assetCard(row, add) {
    var a = row.a;
    var c = row.c;
    var pnl = c.re === null ? 0 : c.re;
    var pct = c.rp === null ? null : c.rp;
    var whatIf = add > 0 && c.np !== null
      ? '<div class="m-detail-row"><span class="m-detail-label">Nuovo P.M.</span><span class="m-detail-value">' +
          money(c.np) +
          (c.dpp !== null ? ' <span class="' + pnlClass(-c.dpp) + '">' + (c.dpp < 0 ? "↓ " : c.dpp > 0 ? "↑ +" : "→ ") + num(Math.abs(c.dpp), 3) + "%</span>" : "") +
        "</span></div>"
      : "";
    return (
      '<details class="m-asset-card">' +
      '<summary class="m-asset-summary">' +
      '<div class="m-asset-primary"><div><div class="m-asset-title">' + esc(a.name) + '</div><div class="m-asset-type">' + typeLabel(row.type) + " · " + esc(a.id) + '</div></div><div class="m-asset-value">' + money(row.value) + "</div></div>" +
      '<div class="m-asset-pnl m-row"><span class="' + pnlClass(pnl) + '">' + signedMoney(pnl) + '</span><span class="m-pct ' + pnlClass(pct || 0) + '">' + (pct === null ? "—" : (pct >= 0 ? "+" : "") + num(pct, 3) + "%") + "</span></div>" +
      "</summary>" +
      '<div class="m-asset-detail">' +
      '<div class="m-detail-row"><span class="m-detail-label">Capitale investito</span><span class="m-detail-value">' + money(c.cost) + "</span></div>" +
      '<div class="m-detail-row"><span class="m-detail-label">Quantità</span><span class="m-detail-value">' + num(a.qty, 3) + "</span></div>" +
      '<div class="m-detail-row"><span class="m-detail-label">P.M. attuale</span><span class="m-detail-value">' + money(c.pm) + "</span></div>" +
      '<div class="m-detail-row"><span class="m-detail-label">Prezzo oggi</span><span class="m-detail-value">' + (c.price === null ? "—" : money(c.price)) + "</span></div>" +
      whatIf +
      '<button class="m-secondary-btn" type="button" onclick="mobileSelectAsset(\'' + esc(a.id) + "', 'whatif')\">Simula su questo asset</button>" +
      "</div></details>"
    );
  }

  function portfolioPanel(rows, add) {
    var filterRows = ui.filter === "all" ? rows : rows.filter(function (row) { return row.type === ui.filter; });
    var filters = ["all", "crypto", "etf"];
    if (rows.some(function (row) { return row.type === "fondi"; })) filters.push("fondi");
    var chips = filters.map(function (filter) {
      return '<button type="button" aria-pressed="' + String(ui.filter === filter) + '" onclick="mobileSetFilter(\'' + filter + "')\">" + (filter === "all" ? "Tutti" : typeLabel(filter)) + "</button>";
    }).join("");
    return (
      '<section class="m-panel" aria-label="Portafoglio mobile">' +
      '<h1 class="m-panel-title">Portafoglio</h1>' +
      '<div class="m-filter-row">' + chips + "</div>" +
      (filterRows.length ? filterRows.sort(function (a, b) { return b.value - a.value; }).map(function (row) { return assetCard(row, add); }).join("") : '<div class="m-empty">Nessuna posizione in questa sezione.</div>') +
      "</section>"
    );
  }

  function whatIfPanel(rows, add) {
    var selected = preferredAsset(rows);
    if (!selected) return '<div class="m-empty">Nessun asset da simulare.</div>';
    var c = selected.c;
    var quick = [100, 500, 1000, 2500].map(function (amount) {
      return '<button type="button" onclick="mobileSetGlobalWhatIf(' + amount + ')">+' + amount.toLocaleString("it-IT") + " €</button>";
    }).join("");
    var pmDelta = c.dpp === null ? "—" : (c.dpp < 0 ? "↓ " : c.dpp > 0 ? "↑ +" : "→ ") + num(Math.abs(c.dpp), 3) + "%";
    return (
      '<section class="m-panel" aria-label="Simulazione What-If">' +
      '<h1 class="m-panel-title">What‑If</h1>' +
      '<div class="m-surface">' +
      '<div class="m-whatif-head"><div><div class="m-section-label">Importo aggiuntivo</div><div class="m-whatif-current">Si applica agli stessi calcoli del desktop.</div></div><strong class="m-asset-value">' + money(add) + "</strong></div>" +
      '<div class="m-slider-wrap"><input aria-label="Importo aggiuntivo What-If" type="range" min="0" max="10000" step="1" value="' + add + '" oninput="mobileSetGlobalWhatIf(this.value)"></div>' +
      '<input class="m-number-input" aria-label="Importo What-If in euro" type="number" min="0" max="10000" step="1" value="' + add + '" oninput="mobileSetGlobalWhatIf(this.value)">' +
      '<div class="m-quick-row">' + quick + "</div></div>" +
      '<div class="m-surface"><div class="m-whatif-head"><div><div class="m-section-label">Asset selezionato</div><div class="m-asset-title">' + esc(selected.a.name) + "</div></div><button class=\"m-secondary-btn\" type=\"button\" onclick=\"mobileSetSection('portfolio')\">Cambia</button></div>" +
      '<div class="m-whatif-grid" style="margin-top:12px;">' +
      '<div class="m-kpi"><span class="m-label">Nuovo P.M.</span><strong class="m-kpi-value">' + money(c.np) + "</strong></div>" +
      '<div class="m-kpi"><span class="m-label">Variazione P.M.</span><strong class="m-kpi-value ' + pnlClass(-(c.dpp || 0)) + '">' + pmDelta + "</strong></div>" +
      '<div class="m-kpi"><span class="m-label">Quantità nuova</span><strong class="m-kpi-value">' + num(c.nq, 3) + "</strong></div>" +
      '<div class="m-kpi"><span class="m-label">Titoli aggiunti</span><strong class="m-kpi-value b">' + num(c.ta, 3) + "</strong></div>" +
      "</div></div></section>"
    );
  }

  function analyticsPanel(rows) {
    var total = totals(rows);
    var pnl = total.value - total.invested;
    var pct = total.invested > 0 ? (pnl / total.invested) * 100 : 0;
    return (
      '<section class="m-panel" aria-label="Analisi mobile">' +
      '<h1 class="m-panel-title">Analisi</h1>' +
      '<div class="m-kpi-grid">' +
      '<div class="m-kpi"><span class="m-label">Investito</span><strong class="m-kpi-value">' + money(total.invested) + "</strong></div>" +
      '<div class="m-kpi"><span class="m-label">Valore</span><strong class="m-kpi-value">' + money(total.value) + "</strong></div>" +
      '<div class="m-kpi"><span class="m-label">P&L</span><strong class="m-kpi-value ' + pnlClass(pnl) + '">' + signedMoney(pnl) + "</strong></div>" +
      '<div class="m-kpi"><span class="m-label">P&L %</span><strong class="m-kpi-value ' + pnlClass(pct) + '">' + (pct >= 0 ? "+" : "") + num(pct, 3) + "%</strong></div>" +
      '</div><div class="m-surface"><div class="m-section-label">Priorità e piano liquidità</div><div class="m-whatif-current">Ranking Global, Crypto ed ETF e piano di distribuzione sono riuniti in Allocazione.</div><button class="m-secondary-btn" type="button" style="margin-top:12px" onclick="mobileOpenDesktopTab(\'allocation\')">Apri Allocazione</button></div>' +
      "</section>"
    );
  }

  function toolCard(title, description, action, label, primary) {
    return '<div class="m-tool-card"><div><strong>' + title + "</strong><p>" + description + '</p></div><button class="' + (primary ? "m-primary-btn" : "") + '" type="button" onclick="' + action + '">' + label + "</button></div>";
  }

  function toolsPanel(rows) {
    var coverage = countPriced(rows) + "/" + rows.length;
    var cryptoTime = typeof cryptoQuoteMeta !== "undefined" && cryptoQuoteMeta && cryptoQuoteMeta.updatedAt
      ? new Date(cryptoQuoteMeta.updatedAt).toLocaleString("it-IT")
      : "nessun aggiornamento Kraken in questa sessione";
    return (
      '<section class="m-panel" aria-label="Strumenti e dati">' +
      '<h1 class="m-panel-title">Dettagli e strumenti</h1>' +
      '<div id="mobile-data-status" class="m-data-status ' + esc(lastDataStatus.state || "") + '">' + esc(quoteStatusText()) + "</div>" +
      '<div class="m-surface"><div class="m-section-label">Copertura prezzi</div><div class="m-whatif-current"><strong>' + coverage + "</strong> posizioni con quotazione disponibile · Kraken: " + esc(cryptoTime) + "</div></div>" +
      toolCard("Aggiorna crypto", "Quotazioni spot EUR da Kraken: flusso invariato rispetto al desktop.", "mobileRefreshCrypto()", "↻ Kraken", true) +
      toolCard("Budget", "Liquidità, spese e capitale investibile prima dello stipendio.", "mobileOpenDesktopTab('budget')", "Apri") +
      toolCard("Allocazione", "Laboratorio visuale di distribuzione della liquidità.", "mobileOpenDesktopTab('allocation')", "Apri") +
      toolCard("Portfolio / prezzi", "Modifica posizioni e inserisci i prezzi manuali ETF.", "mobileOpenDesktopTab('edit')", "Apri") +
      toolCard("Backup dati", "Esporta un JSON completo, senza modificare il portafoglio.", "exportFullBackup()", "Esporta") +
      toolCard("Ripristino", "Importa un backup validato con anteprima.", "openBackupImport()", "Importa") +
      toolCard("CSV", "Scarica la tabella completa del portafoglio.", "exportCSV()", "CSV") +
      '<div class="m-mobile-footer"><button type="button" onclick="setWipsLayoutMode(\'desktop\')">Passa alla modalità Desktop</button></div>' +
      "</section>"
    );
  }

  function renderMobileExperience(portfolio) {
    if (!isMobileMode()) return;
    var root = document.getElementById("mobile-shell");
    if (!root || typeof calc !== "function" || typeof P === "undefined") return;
    portfolio = portfolio || portfolioSnapshot();
    var addInput = document.getElementById("addAmt");
    var add = numberOrZero(addInput ? addInput.value : 0);
    var rows = makeRows(portfolio, add);
    var summary = totals(rows);
    var pnl = summary.value - summary.invested;
    var pct = summary.invested > 0 ? (pnl / summary.invested) * 100 : 0;
    var content = ui.section === "whatif" ? whatIfPanel(rows, add) : ui.section === "analytics" ? analyticsPanel(rows) : ui.section === "tools" ? toolsPanel(rows) : portfolioPanel(rows, add);
    root.innerHTML =
      '<div class="m-hero">' +
      '<div class="m-hero-top"><span class="m-overline">WIPS · modalità mobile</span><span class="m-overline">' + rows.length + " asset</span></div>" +
      '<div class="m-hero-main">' + money(summary.value) + "</div>" +
      '<div class="m-hero-metrics"><div class="m-hero-metric"><span class="m-label">P&L complessivo</span><strong class="' + pnlClass(pnl) + '">' + signedMoney(pnl) + '</strong></div><div class="m-hero-metric"><span class="m-label">Rendimento</span><strong class="' + pnlClass(pct) + '">' + (pct >= 0 ? "+" : "") + num(pct, 3) + "%</strong></div></div>" +
      "</div>" +
      '<nav class="m-nav" aria-label="Navigazione mobile">' +
      mobileNavButton("portfolio", "Portfolio") + mobileNavButton("whatif", "What‑If") + mobileNavButton("analytics", "Analisi") + mobileNavButton("tools", "Strumenti") +
      "</nav>" + content;
  }

  function mobileNavButton(section, label) {
    return '<button type="button" aria-pressed="' + String(ui.section === section) + '" onclick="mobileSetSection(\'' + section + "')\">" + label + "</button>";
  }

  /* Esposto deliberatamente: il renderer principale richiama questa funzione
     dopo ogni aggiornamento dei dati, senza introdurre un secondo stato. */
  window.renderMobileExperience = renderMobileExperience;

  window.setWipsLayoutMode = function (mode, options) {
    var nextMode = mode === "mobile" ? "mobile" : "desktop";
    var persist = !options || options.persist !== false;
    document.body.classList.toggle("mode-mobile", nextMode === "mobile");
    document.body.classList.toggle("mode-desktop", nextMode === "desktop");
    var desktopButton = document.getElementById("mode-desktop");
    var mobileButton = document.getElementById("mode-mobile");
    if (desktopButton) desktopButton.setAttribute("aria-pressed", String(nextMode === "desktop"));
    if (mobileButton) mobileButton.setAttribute("aria-pressed", String(nextMode === "mobile"));
    if (persist) {
      try { window.localStorage.setItem(LAYOUT_KEY, nextMode); } catch (error) {}
    }
    if (typeof renderAll === "function") renderAll();
  };

  window.mobileSetSection = function (section) {
    if (["portfolio", "whatif", "analytics", "tools"].indexOf(section) < 0) return;
    ui.section = section;
    saveUi();
    renderMobileExperience();
  };

  window.mobileSetFilter = function (filter) {
    if (["all", "crypto", "etf", "fondi"].indexOf(filter) < 0) return;
    ui.filter = filter;
    saveUi();
    renderMobileExperience();
  };

  window.mobileSelectAsset = function (assetId, section) {
    ui.selectedAsset = String(assetId || "");
    ui.section = section === "whatif" ? "whatif" : "portfolio";
    saveUi();
    renderMobileExperience();
  };

  window.mobileSetGlobalWhatIf = function (value) {
    var amount = Math.min(10000, Math.max(0, numberOrZero(value)));
    if (typeof syncIn === "function") syncIn(amount);
    if (typeof syncSl === "function") syncSl(amount);
    if (typeof renderAll === "function") renderAll();
  };

  window.mobileOpenDesktopTab = function (tab) {
    window.setWipsLayoutMode("desktop");
    if (typeof switchTab === "function") switchTab(tab);
  };

  window.mobileRefreshCrypto = function () {
    if (typeof refreshCryptoQuotes === "function") refreshCryptoQuotes();
  };

  window.updateMobileDataStatus = function (message, state) {
    lastDataStatus = { message: message || "Dati aggiornati", state: state || "" };
    var node = document.getElementById("mobile-data-status");
    if (!node) return;
    node.className = "m-data-status " + (lastDataStatus.state || "");
    node.textContent = lastDataStatus.message;
  };

  function initialiseLayout() {
    var saved = null;
    try { saved = window.localStorage.getItem(LAYOUT_KEY); } catch (error) {}
    var initialMode = saved === "desktop" || saved === "mobile"
      ? saved
      : window.matchMedia && window.matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop";
    window.setWipsLayoutMode(initialMode, { persist: false });
  }

  initialiseLayout();
})();
