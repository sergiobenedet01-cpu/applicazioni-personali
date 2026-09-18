#!/usr/bin/env node
"use strict";

/*
 * Aggiorna soltanto le otto quotazioni crypto di DEFAULT_PRICES in
 * WIPS-data.js. Non modifica portafoglio, quantità, P.M., né esegue git.
 * Richiede Node.js 18+ (fetch nativo).
 *
 * Uso:
 *   node update-wips-crypto-prices.js
 *   node update-wips-crypto-prices.js --dry-run
 */

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "WIPS-data.js");
const TIMEOUT_MS = 10_000;
const DRY_RUN = process.argv.includes("--dry-run");

const PAIRS = {
  bitcoin: { pair: "XBTEUR", aliases: ["XXBTZEUR", "XBTEUR", "BTCEUR"] },
  ethereum: { pair: "ETHEUR", aliases: ["XETHZEUR", "ETHEUR"] },
  solana: { pair: "SOLEUR", aliases: ["SOLEUR"] },
  polkadot: { pair: "DOTEUR", aliases: ["DOTEUR"] },
  ripple: { pair: "XRPEUR", aliases: ["XXRPZEUR", "XRPEUR"] },
  avalanche: { pair: "AVAXEUR", aliases: ["AVAXEUR"] },
  dogecoin: { pair: "DOGEEUR", aliases: ["XDGEUR", "DOGEEUR"] },
  cardano: { pair: "ADAEUR", aliases: ["ADAEUR"] },
};

function normalisePair(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function findObjectBlock(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Blocco ${marker} non trovato`);
  const openIndex = source.indexOf("{", markerIndex + marker.length);
  if (openIndex < 0) throw new Error("Apertura oggetto DEFAULT_PRICES non trovata");

  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return { start: openIndex, end: index + 1 };
  }
  throw new Error("Chiusura oggetto DEFAULT_PRICES non trovata");
}

function quoteForAsset(tickers, assetId) {
  const config = PAIRS[assetId];
  for (const [pair, ticker] of Object.entries(tickers || {})) {
    if (!config.aliases.includes(normalisePair(pair)) || !ticker || !ticker.c) continue;
    const quote = Number(ticker.c[0]);
    if (Number.isFinite(quote) && quote > 0) return quote;
  }
  return null;
}

async function fetchKrakenQuotes() {
  const pairs = Object.values(PAIRS)
    .map((config) => config.pair)
    .join(",");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://api.kraken.com/0/public/Ticker?pair=${encodeURIComponent(pairs)}`,
      { headers: { Accept: "application/json" }, signal: controller.signal },
    );
    if (!response.ok) throw new Error(`Kraken HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload || (payload.error && payload.error.length) || !payload.result)
      throw new Error("Risposta Kraken non valida");

    const quotes = {};
    for (const assetId of Object.keys(PAIRS)) {
      const quote = quoteForAsset(payload.result, assetId);
      if (quote === null) throw new Error(`Quotazione EUR mancante o non valida: ${assetId}`);
      quotes[assetId] = quote;
    }
    return quotes;
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

  for (const assetId of Object.keys(PAIRS)) {
    const pattern = new RegExp(`^(\\s*${assetId}\\s*:\\s*)([0-9]+(?:\\.[0-9]+)?)(\\s*,?\\s*)$`, "m");
    const match = block.match(pattern);
    if (!match) throw new Error(`Campo crypto non trovato in DEFAULT_PRICES: ${assetId}`);
    const oldValue = Number(match[2]);
    const newValue = quotes[assetId];
    block = block.replace(pattern, `$1${String(newValue)}$3`);
    changes.push({ assetId, oldValue, newValue });
  }

  return { content: before + block + after, changes };
}

function formatEuro(value) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 8 }).format(value) + " €";
}

async function main() {
  if (typeof fetch !== "function") throw new Error("Serve Node.js 18 o successivo (fetch nativo)");
  const source = fs.readFileSync(DATA_FILE, "utf8");
  const quotes = await fetchKrakenQuotes();
  const result = updateDefaultPrices(source, quotes);

  console.log(`Kraken · ${new Date().toLocaleString("it-IT")} · ${DRY_RUN ? "simulazione" : "aggiornamento"}`);
  for (const change of result.changes)
    console.log(
      `${change.assetId}: ${formatEuro(change.oldValue)} → ${formatEuro(change.newValue)}`,
    );

  if (DRY_RUN) {
    console.log("Nessun file scritto (--dry-run).");
    return;
  }
  fs.writeFileSync(DATA_FILE, result.content, "utf8");
  console.log("Aggiornato WIPS-data.js: solo DEFAULT_PRICES delle crypto. Nessun commit o push eseguito.");
}

main().catch((error) => {
  console.error("Aggiornamento annullato:", error && error.message ? error.message : error);
  process.exitCode = 1;
});
