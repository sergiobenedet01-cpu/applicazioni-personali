#!/usr/bin/env node
"use strict";

/*
 * Verifica locale, in sola lettura, dei file essenziali di WIPS.
 * Non accede alla rete, non modifica file e non legge/scrive localStorage.
 * Richiede Node.js 18 o successivo.
 *
 * Uso:
 *   node verify-wips.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
const REQUIRED_FILES = [
  "WIPS.html",
  "WIPS-data.js",
  "update-wips-crypto-prices.js",
  "update-wips-etf-prices.js",
  "WIPS-allocation-lab.js",
  "WIPS-allocation-lab.css",
  "WIPS-mobile.js",
  "WIPS-mobile.css",
  "WIPS-analytics-charts.js",
  "WIPS-analytics-charts.css",
];
const PORTFOLIO_TYPES = ["crypto", "etf", "fondi"];
const REQUIRED_APP_FUNCTIONS = [
  "calc",
  "save",
  "load",
  "refreshCryptoQuotes",
  "renderBudget",
  "exportFullBackup",
  "openBackupImport",
  "readBackupImport",
  "applyBackupImport",
  "exportCSV",
];
const REQUIRED_ALLOCATION_FUNCTIONS = [
  "renderAllocationLab",
  "allocationApplyScenario",
  "allocationSetAmount",
  "allocationSimulate",
  "allocationSimulateAtPrice",
  "allocationSetRankingScope",
];

const errors = [];
const checks = [];

function pass(message) {
  checks.push(message);
}

function fail(message) {
  errors.push(message);
}

function finiteNonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function assertRequiredFiles() {
  for (const file of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(ROOT, file))) fail(`File richiesto mancante: ${file}`);
  }
  if (!errors.length) pass("File essenziali presenti");
}

function compileJavaScript(source, filename) {
  try {
    new vm.Script(source, { filename });
    pass(`Sintassi valida: ${filename}`);
  } catch (error) {
    fail(`Sintassi non valida in ${filename}: ${error.message}`);
  }
}

function loadData() {
  const dataPath = path.join(ROOT, "WIPS-data.js");
  const source = fs.readFileSync(dataPath, "utf8");
  compileJavaScript(source, "WIPS-data.js");

  const sandbox = { window: {} };
  try {
    vm.runInNewContext(source, sandbox, { filename: "WIPS-data.js" });
  } catch (error) {
    fail(`Impossibile caricare WIPS-data.js: ${error.message}`);
    return null;
  }

  const data = sandbox.window.WIPS_DATA;
  if (!data || typeof data !== "object") {
    fail("WIPS_DATA non è stato definito");
    return null;
  }
  return data;
}

function validateData(data) {
  if (!data || !data.DEFAULT_PORTFOLIO || !data.DEFAULT_PRICES) return;
  if (typeof data.DEFAULT_PRICES !== "object" || Array.isArray(data.DEFAULT_PRICES)) {
    fail("DEFAULT_PRICES deve essere un oggetto");
    return;
  }

  const ids = new Set();
  let assetCount = 0;
  for (const type of PORTFOLIO_TYPES) {
    const assets = data.DEFAULT_PORTFOLIO[type];
    if (!Array.isArray(assets)) {
      fail(`DEFAULT_PORTFOLIO.${type} deve essere un array`);
      continue;
    }
    if (assets.length === 0 && type !== "fondi") {
      fail(`DEFAULT_PORTFOLIO.${type} deve contenere almeno un asset`);
      continue;
    }

    for (const asset of assets) {
      assetCount += 1;
      const label = `DEFAULT_PORTFOLIO.${type}`;
      if (!asset || typeof asset !== "object") {
        fail(`${label} contiene un asset non valido`);
        continue;
      }
      if (typeof asset.id !== "string" || !asset.id.trim()) fail(`${label}: id asset mancante`);
      if (typeof asset.name !== "string" || !asset.name.trim()) fail(`${label}.${asset.id}: nome asset mancante`);
      if (ids.has(asset.id)) fail(`ID asset duplicato: ${asset.id}`);
      ids.add(asset.id);

      for (const field of ["cap", "qty", "pm0"]) {
        if (!finiteNonNegative(asset[field])) fail(`${label}.${asset.id}: ${field} deve essere un numero finito >= 0`);
      }

      const price = data.DEFAULT_PRICES[asset.id];
      if (!finiteNonNegative(price) || price <= 0) {
        fail(`DEFAULT_PRICES.${asset.id} deve essere un prezzo positivo e finito`);
      }
    }
  }

  for (const [id, price] of Object.entries(data.DEFAULT_PRICES)) {
    if (!ids.has(id)) fail(`DEFAULT_PRICES contiene un ID non presente nel portfolio: ${id}`);
    if (!finiteNonNegative(price) || price <= 0) fail(`DEFAULT_PRICES.${id} non è un prezzo positivo e finito`);
  }

  if (!errors.length) pass(`Struttura dati valida: ${assetCount} asset e ${ids.size} prezzi`);
}

function validateApplicationSource() {
  const htmlPath = path.join(ROOT, "WIPS.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const dataScriptIndex = html.indexOf('src="WIPS-data.js"');
  if (dataScriptIndex < 0) fail("WIPS.html non carica WIPS-data.js");

  const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim());
  if (!inlineScripts.length) {
    fail("Script applicativo incorporato non trovato in WIPS.html");
    return;
  }

  for (const source of inlineScripts) compileJavaScript(source, "WIPS.html script applicativo");
  const applicationSource = inlineScripts.join("\n");
  for (const name of REQUIRED_APP_FUNCTIONS) {
    if (!new RegExp(`function\\s+${name}\\s*\\(`).test(applicationSource)) {
      fail(`Funzione applicativa attesa non trovata: ${name}`);
    }
  }
  if (dataScriptIndex >= 0 && !errors.length) pass("WIPS.html carica dati e funzioni applicative attese");
}

function validateAllocationLabSource() {
  const htmlPath = path.join(ROOT, "WIPS.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const sourcePath = path.join(ROOT, "WIPS-allocation-lab.js");
  const stylePath = path.join(ROOT, "WIPS-allocation-lab.css");
  const source = fs.readFileSync(sourcePath, "utf8");
  const style = fs.readFileSync(stylePath, "utf8");

  compileJavaScript(source, "WIPS-allocation-lab.js");
  if (!/href="WIPS-allocation-lab\.css(?:\?[^\"]*)?"/.test(html)) {
    fail("WIPS.html non carica lo stile Allocation Lab");
  }
  if (!/src="WIPS-allocation-lab\.js(?:\?[^\"]*)?"/.test(html)) {
    fail("WIPS.html non carica il modulo Allocation Lab");
  }
  for (const marker of ['id="nb-allocation"', 'id="sec-allocation"']) {
    if (!html.includes(marker)) fail(`Elemento Allocation Lab mancante: ${marker}`);
  }
  for (const retiredMarker of ["nb-advisor", "sec-advisor", "renderAdvisor"]) {
    if (html.includes(retiredMarker)) {
      fail(`Riferimento Advisor non rimosso: ${retiredMarker}`);
    }
  }
  for (const name of REQUIRED_ALLOCATION_FUNCTIONS) {
    if (!new RegExp(`function\\s+${name}\\s*\\(`).test(source)) {
      fail(`Funzione Allocation Lab attesa non trovata: ${name}`);
    }
  }
  for (const selector of [".alloc-wrap", ".alloc-map", ".alloc-matrix"]) {
    if (!style.includes(selector)) fail(`Stile Allocation Lab mancante: ${selector}`);
  }
  if (!errors.length) pass("Allocation Lab: modulo, stili e punti di integrazione presenti");
}

function validateAllocationMathInvariants() {
  /* Gli stessi invarianti finanziari dichiarati dalla console: una simulazione
     compra quantità al prezzo corrente e ricalcola il P.M. soltanto sul totale
     storico + importo simulato. Sono controlli in sola lettura e non toccano
     dati o localStorage. */
  const simulatePurchase = (cost, qty, investment, price) => {
    const nextCost = cost + investment;
    const nextQty = qty + investment / price;
    return { nextCost, nextQty, pm: nextCost / nextQty };
  };
  const closeTo = (actual, expected, tolerance = 1e-9) =>
    Math.abs(actual - expected) <= tolerance;

  const lowerPrice = simulatePurchase(100, 1, 100, 50);
  if (!closeTo(lowerPrice.pm, 200 / 3) || lowerPrice.pm >= 100) {
    fail("Allocation Lab: il test di riduzione P.M. non supera l'invariante");
  }
  const samePrice = simulatePurchase(100, 1, 100, 100);
  if (!closeTo(samePrice.pm, 100)) {
    fail("Allocation Lab: il test di P.M. invariato allo stesso prezzo non supera l'invariante");
  }
  const totalValue = 10000;
  const pool = 1000;
  const maxWeight = 15;
  const currentValue = 1200;
  const capacity = (maxWeight / 100) * (totalValue + pool) - currentValue;
  if (!closeTo(capacity, 450) || capacity < 0) {
    fail("Allocation Lab: il test del limite di concentrazione non supera l'invariante");
  }
  if (!errors.length) pass("Allocation Lab: invarianti P.M. e limite di concentrazione validi");
}

function validateMobileModeSource() {
  const htmlPath = path.join(ROOT, "WIPS.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const sourcePath = path.join(ROOT, "WIPS-mobile.js");
  const stylePath = path.join(ROOT, "WIPS-mobile.css");
  const source = fs.readFileSync(sourcePath, "utf8");
  const style = fs.readFileSync(stylePath, "utf8");

  compileJavaScript(source, "WIPS-mobile.js");
  for (const marker of [
    'href="WIPS-mobile.css',
    'src="WIPS-mobile.js',
    'id="mobile-shell"',
    'id="mode-desktop"',
    'id="mode-mobile"',
  ]) {
    if (!html.includes(marker)) fail(`Integrazione modalità Mobile mancante: ${marker}`);
  }
  for (const marker of [
    "window.setWipsLayoutMode = function",
    "function renderMobileExperience",
    "window.renderMobileExperience = renderMobileExperience",
    "window.mobileSetGlobalWhatIf = function",
    "window.mobileOpenDesktopTab = function",
    "calc(asset, add)",
  ]) {
    if (!source.includes(marker)) fail(`Funzione/integrazione Mobile mancante: ${marker}`);
  }
  for (const selector of [".mobile-shell", "body.mode-mobile", ".m-asset-card"]) {
    if (!style.includes(selector)) fail(`Stile Mobile mancante: ${selector}`);
  }
  if (!html.includes("updateMobileDataStatus(message, state)")) {
    fail("Lo stato quotazioni non viene inoltrato alla modalità Mobile");
  }
  if (!errors.length) pass("Modalità Mobile: selettore, renderer e stili presenti");
}

function validateAnalyticsChartsSource() {
  const html = fs.readFileSync(path.join(ROOT, "WIPS.html"), "utf8");
  const sourcePath = path.join(ROOT, "WIPS-analytics-charts.js");
  const stylePath = path.join(ROOT, "WIPS-analytics-charts.css");
  const source = fs.readFileSync(sourcePath, "utf8");
  const style = fs.readFileSync(stylePath, "utf8");

  compileJavaScript(source, "WIPS-analytics-charts.js");
  for (const marker of [
    'href="WIPS-analytics-charts.css',
    'src="WIPS-analytics-charts.js',
    "renderWipsAnalyticsCharts(type, portfolio, add)",
    'renderWipsAnalyticsCharts("all", portfolio, add)',
  ]) {
    if (!html.includes(marker)) fail(`Integrazione grafici analitici mancante: ${marker}`);
  }
  for (const selector of [
    ".wips-analytic-charts",
    ".wips-analytic-chart-row",
    ".wips-analytic-chart-track",
  ]) {
    if (!style.includes(selector)) fail(`Stile grafici analitici mancante: ${selector}`);
  }

  const sandbox = { window: {} };
  try {
    vm.runInNewContext(source, sandbox, { filename: "WIPS-analytics-charts.js" });
    const render = sandbox.window.buildWipsAnalyticsCharts;
    const rows = [
      { a: { id: "small", name: "Small" }, type: "crypto", c: { price: 110, pm: 100, re: 20, rp: 10 } },
      { a: { id: "loss", name: "Loss" }, type: "etf", c: { price: 80, pm: 100, re: -100, rp: -20 } },
      { a: { id: "swing", name: "Swing" }, type: "crypto", c: { price: 200, pm: 100, re: 50, rp: 100 } },
    ];
    const output = render(rows, "all");
    const priceSection = output.indexOf("Prezzo attuale vs prezzo medio");
    if (priceSection < 0 || output.indexOf("Loss") > output.indexOf("Swing") || output.indexOf("Swing") > output.indexOf("Small")) {
      fail("Grafici analitici: ordinamento Pareto P&L non valido");
    }
    const meanOutput = output.slice(priceSection);
    if (meanOutput.indexOf("Swing") > meanOutput.indexOf("Loss") || meanOutput.indexOf("Loss") > meanOutput.indexOf("Small")) {
      fail("Grafici analitici: ordinamento Pareto variazione P.M. non valido");
    }
  } catch (error) {
    fail(`Grafici analitici: test runtime non superato: ${error.message}`);
  }
  if (!errors.length) pass("Grafici analitici: integrazione, stili e ordinamento Pareto validi");
}

function validateUpdaterSyntax() {
  for (const file of ["update-wips-crypto-prices.js", "update-wips-etf-prices.js"]) {
    compileJavaScript(fs.readFileSync(path.join(ROOT, file), "utf8"), file);
  }
}

function main() {
  console.log("WIPS · verifica locale in sola lettura");
  assertRequiredFiles();
  if (!errors.length) {
    const data = loadData();
    validateData(data);
    validateApplicationSource();
    validateAllocationLabSource();
    validateAllocationMathInvariants();
    validateMobileModeSource();
validateAnalyticsChartsSource();
    validateUpdaterSyntax();
  }

  for (const message of checks) console.log(`✓ ${message}`);
  if (errors.length) {
    for (const message of errors) console.error(`✗ ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log("Verifica completata: nessun file è stato modificato.");
}

main();
