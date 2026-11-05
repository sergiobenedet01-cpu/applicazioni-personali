/* WIPS · Grafici analitici locali
   Presentazione soltanto: i calcoli restano in calc() nel core WIPS. */
(function () {
  "use strict";

  function finite(value) {
    return typeof value === "number" && isFinite(value);
  }

  function esc(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function number(value, digits) {
    return Number(value).toLocaleString("it-IT", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits === undefined ? 2 : digits,
    });
  }

  function signed(value, suffix, digits) {
    if (!finite(value)) return "—";
    return (value > 0 ? "+" : value < 0 ? "−" : "") +
      number(Math.abs(value), digits) + (suffix || "");
  }

  function kind(row, aggregate) {
    if (!aggregate) return "";
    if (row.t === "crypto" || row.type === "crypto") return '<span class="wips-analytic-chart-kind">Crypto</span>';
    if (row.t === "etf" || row.type === "etf") return '<span class="wips-analytic-chart-kind">ETF</span>';
    return '<span class="wips-analytic-chart-kind">Fondi</span>';
  }

  function makeRows(rows) {
    return rows.filter(function (row) {
      return row && row.a && row.c && finite(row.c.price) && row.c.price > 0 && finite(row.c.pm) && row.c.pm > 0;
    });
  }

  function paretoNote(rows, metric, description) {
    var total = rows.reduce(function (sum, row) { return sum + Math.abs(metric(row)); }, 0);
    if (!total) return description;
    var top = rows.slice(0, Math.min(3, rows.length)).reduce(function (sum, row) { return sum + Math.abs(metric(row)); }, 0);
    return description + " · i primi " + Math.min(3, rows.length) + " spiegano " + number((top / total) * 100, 1) + "% dell’impatto";
  }

  function chartRow(row, value, metricHtml, aggregate, tone) {
    var signClass = tone || (value >= 0 ? "positive" : "negative");
    return '<div class="wips-analytic-chart-row" role="listitem" title="' + esc(row.a.name + ": " + metricHtml.replace(/<[^>]*>/g, "")) + '" aria-label="' + esc(row.a.name + ": " + metricHtml.replace(/<[^>]*>/g, "")) + '">' +
      '<div class="wips-analytic-chart-name">' + esc(row.a.name) + kind(row, aggregate) + '</div>' +
      '<div class="wips-analytic-chart-track" aria-hidden="true"><span class="wips-analytic-chart-bar ' + signClass + '" style="--bar-size:' + row._chartWidth + '"></span></div>' +
      '<div class="wips-analytic-chart-metric ' + signClass + '">' + metricHtml + '</div>' +
      '</div>';
  }

  function chart(title, rows, value, metric, description, aggregate, tone, legend) {
    var sorted = rows.slice().sort(function (left, right) {
      return Math.abs(value(right)) - Math.abs(value(left));
    });
    if (!sorted.length) {
      return '<section class="wips-analytic-chart" aria-label="' + esc(title) + '"><h2 class="wips-analytic-chart-title">' + esc(title) + '</h2><p class="wips-analytic-chart-empty">Nessun dato con prezzo e P.M. validi.</p></section>';
    }
    var maximum = sorted.reduce(function (max, row) { return Math.max(max, Math.abs(value(row))); }, 0) || 1;
    sorted.forEach(function (row) { row._chartWidth = Math.max(0.5, (Math.abs(value(row)) / maximum) * 100).toFixed(3); });
    var html = '<section class="wips-analytic-chart" aria-label="' + esc(title) + '">' +
      '<div class="wips-analytic-chart-header"><h2 class="wips-analytic-chart-title">' + esc(title) + '</h2>' +
      '<div class="wips-analytic-chart-note">' + esc(paretoNote(sorted, value, description)) + '</div>' +
      '<div class="wips-analytic-chart-legend">' + (legend || '<span><i class="positive"></i> profitto</span><span><i class="negative"></i> perdita</span>') + '</div></div>' +
      '<div role="list">';
    sorted.forEach(function (row) { html += chartRow(row, value(row), metric(row), aggregate, tone ? tone(row) : ""); });
    return html + '</div></section>';
  }

  function build(rows, scope) {
    var valid = makeRows(rows || []);
    var aggregate = scope === "all";
    var pnl = chart(
      "Profitto / perdita per asset",
      valid,
      function (row) { return row.c.re; },
      function (row) { return signed(row.c.re, " €", 2) + " · " + signed(row.c.rp, "%", 2); },
      "Pareto: valore assoluto del P&L in euro, decrescente",
      aggregate,
    );
    var mean = chart(
      "Nuovo P.M. con What‑If",
      valid,
      function (row) { return finite(row.c.dpp) ? row.c.dpp : 0; },
      function (row) {
        var delta = finite(row.c.dpp) ? row.c.dpp : 0;
        var arrow = delta < 0 ? "↓ " : delta > 0 ? "↑ +" : "→ ";
        return "Nuovo P.M. " + number(row.c.np, 3) + " € · " + arrow + number(Math.abs(delta), 3) + "%";
      },
      "Pareto: variazione percentuale assoluta del nuovo P.M., decrescente",
      aggregate,
      function (row) {
        if (!finite(row.c.dpp) || row.c.dpp === 0) return "neutral";
        return row.c.dpp < 0 ? "positive" : "warning";
      },
      '<span><i class="positive"></i> P.M. ridotto</span><span><i class="warning"></i> P.M. aumentato</span>',
    );
    return '<section class="wips-analytic-charts" aria-label="Grafici analitici ' + esc(scope === "all" ? "portafoglio globale" : scope) + '">' + pnl + mean + '</section>';
  }

  window.buildWipsAnalyticsCharts = build;
  window.renderWipsAnalyticsCharts = function (scope, portfolio, add) {
    var types = scope === "all" ? ["crypto", "etf", "fondi"] : [scope];
    var rows = [];
    types.forEach(function (type) {
      (portfolio[type] || []).forEach(function (asset) {
        rows.push({ a: asset, t: type, c: calc(asset, add || 0) });
      });
    });
    return build(rows, scope);
  };
})();
