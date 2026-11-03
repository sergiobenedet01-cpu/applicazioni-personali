#!/usr/bin/env node
"use strict";

/*
 * Aggiorna soltanto le quotazioni ETF EUR di DEFAULT_PRICES in WIPS-data.js
 * dalla fonte pubblica Börse Frankfurt / Xetra. Non modifica portafoglio,
 * quantità, P.M., crypto, né esegue git.
 *
 * Uso:
 *   node update-wips-etf-prices.js
 *   node update-wips-etf-prices.js --dry-run
 *
 * Richiede Node.js 18+ (fetch nativo).
 */

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "WIPS-data.js");
const TIMEOUT_MS = 10_000;
const DRY_RUN = process.argv.includes("--dry-run");
const XETRA_MIC = "XETR";

// Ogni ISIN identifica la stessa quota detenuta; il ticker applicativo resta
// invariato anche quando il listing EUR Xetra usa un simbolo differente.
const ETF_XETRA = {
  "XAIX.DE": {
    name: "AI & Big Data",
    isin: "IE00BGV5VN51",
    listing: "Xetra · XAIX · EUR",
  },
  "WNUC.L": {
    name: "Uranium",
    isin: "IE0003BJ2JS4",
    listing: "Xetra · WNUC · EUR",
  },
  "QNTM.L": {
    name: "Quantum",
    isin: "IE0007Y8Y157",
    listing: "Xetra · QUTM · EUR",
  },
  "RBOT.L": {
    name: "Automation",
    isin: "IE00BYZK4552",
    listing: "Xetra · 2B76 · EUR",
  },
  CIBR: {
    name: "Cybersecurity",
    isin: "IE00BF16M727",
    listing: "Xetra · CBRS · EUR",
  },
  "CEA1.DE": {
    name: "Asia EM",
    isin: "IE00B5L8K969",
    listing: "Xetra · CEBL · EUR",
  },
  COPX: {
    name: "Copper Miners",
    isin: "IE0003Z9E2Y3",
    listing: "Xetra · 4COP · EUR",
  },
  FLXI: {
    name: "FTSE India",
    isin: "IE00BHZRQZ17",
    listing: "Xetra · FLXI · EUR",
  },
};

function findObjectBlock(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Blocco ${marker} non trovato`);
  const openIndex = source.indexOf("{", markerIndex + marker.length);
  if (openIndex < 0) throw new Error("Apertura oggetto DEFAULT_PRICES non trovata");
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return { start: openIndex, end: index + 1 };
  }
  throw new Error("Chiusura oggetto DEFAULT_PRICES non trovata");
}

async function fetchXetraQuote(id, config) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const endpoint =
      "https://api.boerse-frankfurt.de/v1/data/price_information/single?isin=" +
      encodeURIComponent(config.isin) +
      "&mic=" +
      XETRA_MIC;
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${id}: Börse Frankfurt HTTP ${response.status}`);
    const payload = await response.json();
    const price = Number(payload && payload.lastPrice);
    const currency = payload && payload.currency && payload.currency.originalValue;
    const timestamp = payload && payload.timestampLastPrice;
    if (!Number.isFinite(price) || price <= 0)
      throw new Error(`${id}: quotazione Xetra non valida`);
    if (currency !== "EUR") throw new Error(`${id}: valuta ricevuta ${currency || "assente"}`);
    if (payload.mic !== XETRA_MIC) throw new Error(`${id}: mercato ricevuto ${payload.mic || "assente"}`);
    if (!timestamp || Number.isNaN(Date.parse(timestamp)))
      throw new Error(`${id}: timestamp quotazione non valido`);
    return { id, ...config, price, timestamp };
  } finally {
    clearTimeout(timeout);
  }
}

function updateDefaultPrices(source, quotes) {
  const range = findObjectBlock(source, "DEFAULT_PRICES:");
  const before = source.slice(0, range.start);
  let block = source.slice(range.start, range.end);
  const after = source.slice(range.end);
  const changes = [];

  for (const quote of quotes) {
    const escapedId = quote.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `^(\\s*["']?${escapedId}["']?\\s*:\\s*)([0-9]+(?:\\.[0-9]+)?)(\\s*,?\\s*)$`,
      "m",
    );
    const match = block.match(pattern);
    if (!match) throw new Error(`Campo ETF non trovato in DEFAULT_PRICES: ${quote.id}`);
    const oldValue = Number(match[2]);
    block = block.replace(pattern, `$1${String(quote.price)}$3`);
    changes.push({ ...quote, oldValue });
  }
  return { content: before + block + after, changes };
}

function formatEuro(value) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 8 }).format(value) + " €";
}

async function main() {
  if (typeof fetch !== "function") throw new Error("Serve Node.js 18 o successivo (fetch nativo)");
  const source = fs.readFileSync(DATA_FILE, "utf8");
  const results = await Promise.allSettled(
    Object.entries(ETF_XETRA).map(([id, config]) => fetchXetraQuote(id, config)),
  );
  const rejected = results.filter((result) => result.status === "rejected");
  if (rejected.length) {
    for (const result of rejected) console.error("Quotazione non aggiornata:", result.reason.message);
    throw new Error("Aggiornamento annullato: nessun prezzo è stato scritto");
  }
  const quotes = results.map((result) => result.value);
  const result = updateDefaultPrices(source, quotes);

  console.log(`Börse Frankfurt / Xetra · ${DRY_RUN ? "simulazione" : "aggiornamento"}`);
  for (const change of result.changes)
    console.log(
      `${change.name} (${change.id}) · ${change.listing}: ${formatEuro(change.oldValue)} → ${formatEuro(change.price)} · ${change.timestamp}`,
    );

  if (DRY_RUN) {
    console.log("Nessun file scritto (--dry-run).");
    return;
  }
  fs.writeFileSync(DATA_FILE, result.content, "utf8");
  console.log("Aggiornato WIPS-data.js: solo DEFAULT_PRICES ETF. Nessun commit o push eseguito.");
}

main().catch((error) => {
  console.error("Aggiornamento ETF annullato:", error && error.message ? error.message : error);
  process.exitCode = 1;
});
