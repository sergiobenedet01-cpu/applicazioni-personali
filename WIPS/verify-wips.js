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
];
const PORTFOLIO_TYPES = ["crypto", "etf", "fondi"];
const REQUIRED_APP_FUNCTIONS = [
  "calc",
  "save",
  "load",
  "refreshCryptoQuotes",
  "renderAdvisor",
  "renderBudget",
  "exportCSV",
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
    if (!Array.isArray(assets) || assets.length === 0) {
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
