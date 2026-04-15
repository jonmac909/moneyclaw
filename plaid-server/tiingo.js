/**
 * Tiingo proxy — stock quotes + history with a hard 24h per-ticker cooldown.
 *
 * Rules (enforced here, not overridable from the client):
 *   - A given symbol can only hit Tiingo once per 24h.
 *   - Repeated requests inside the window return the cached value.
 *   - Results are persisted to disk so restarts don't burn the cache.
 *
 * Cache file: plaid-server/tiingo-cache.json
 */

const fs = require("fs");
const path = require("path");

const CACHE_FILE = path.join(__dirname, "tiingo-cache.json");
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 1 day — hard rule
const TIINGO_BASE = "https://api.tiingo.com";

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); }
  catch (_) { return { quotes: {}, history: {} }; }
}
function saveCache(cache) {
  const tmp = CACHE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, CACHE_FILE);
}

const inflight = new Map();

async function tiingoFetch(url) {
  const key = process.env.TIINGO_API_KEY;
  if (!key) throw new Error("TIINGO_API_KEY not set in .env");
  const r = await fetch(url, { headers: { "Content-Type": "application/json", Authorization: `Token ${key}` } });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Tiingo ${r.status}: ${body.slice(0, 200)}`);
  }
  return r.json();
}

/**
 * Get latest price for a list of symbols. Honors 24h cooldown per symbol.
 * Returns { quotes: [{symbol, price, asOf, stale, ...}], fromCache: [...] }
 */
async function getQuotes(symbols, { force = false } = {}) {
  const cache = loadCache();
  const now = Date.now();
  const out = [];
  const toFetch = [];
  for (const symRaw of symbols) {
    const sym = String(symRaw || "").trim().toUpperCase();
    if (!sym) continue;
    const cached = cache.quotes[sym];
    if (!force && cached && now - cached.asOf < COOLDOWN_MS) {
      out.push({ ...cached, symbol: sym, fromCache: true });
    } else {
      toFetch.push(sym);
    }
  }

  if (toFetch.length > 0) {
    const key = "quotes:" + toFetch.sort().join(",");
    let promise = inflight.get(key);
    if (!promise) {
      promise = (async () => {
        // Tiingo "iex" endpoint accepts comma-separated tickers, returns current quote
        const url = `${TIINGO_BASE}/iex/?tickers=${toFetch.join(",")}`;
        const data = await tiingoFetch(url);
        const byTicker = {};
        (Array.isArray(data) ? data : []).forEach(q => { byTicker[(q.ticker || "").toUpperCase()] = q; });
        return byTicker;
      })();
      inflight.set(key, promise);
      promise.finally(() => inflight.delete(key)).catch(() => {});
    }
    const byTicker = await promise;
    for (const sym of toFetch) {
      const q = byTicker[sym];
      if (!q) {
        const stale = cache.quotes[sym];
        if (stale) { out.push({ ...stale, symbol: sym, fromCache: true, stale: true }); }
        else { out.push({ symbol: sym, error: "not found in Tiingo" }); }
        continue;
      }
      const price = q.last ?? q.tngoLast ?? q.prevClose ?? null;
      const prevClose = q.prevClose ?? null;
      const changePct = price != null && prevClose ? ((price - prevClose) / prevClose) * 100 : null;
      const rec = {
        symbol: sym,
        price,
        prevClose,
        changePct,
        open: q.open ?? null,
        high: q.high ?? null,
        low: q.low ?? null,
        volume: q.volume ?? null,
        asOf: now,
        quoteTimestamp: q.timestamp ?? null,
      };
      cache.quotes[sym] = rec;
      out.push({ ...rec, fromCache: false });
    }
    saveCache(cache);
  }
  return { quotes: out };
}

function calcEMA(prices, period) {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
  return ema;
}

function calcRSI(prices, period) {
  if (prices.length <= period) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgG = gains / period, avgL = losses / period;
  for (let i = period + 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    avgG = (avgG * (period - 1) + Math.max(0, d)) / period;
    avgL = (avgL * (period - 1) + Math.max(0, -d)) / period;
  }
  return avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
}

/**
 * Get daily history for a single symbol. Returns Yahoo-compatible shape:
 * { symbol, price, ema8, ema21, ema50, ema200, rsi14 (weekly), rsi14Prev, signals,
 *   ath, low52, pctDown, asOf, bars }
 * Cache 24h per symbol.
 */
async function getHistory(symbol, { force = false, days = 400 } = {}) {
  const sym = String(symbol || "").trim().toUpperCase();
  if (!sym) throw new Error("symbol required");
  const cache = loadCache();
  const now = Date.now();
  const cached = cache.history[sym];
  if (!force && cached && now - cached.asOf < COOLDOWN_MS) {
    return { ...cached, symbol: sym, fromCache: true };
  }
  const key = "history:" + sym;
  let promise = inflight.get(key);
  if (!promise) {
    promise = (async () => {
      const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const url = `${TIINGO_BASE}/tiingo/daily/${sym}/prices?startDate=${startDate}`;
      return tiingoFetch(url);
    })();
    inflight.set(key, promise);
    promise.finally(() => inflight.delete(key)).catch(() => {});
  }
  const rows = await promise;
  if (!Array.isArray(rows) || !rows.length) {
    if (cached) return { ...cached, symbol: sym, fromCache: true, stale: true };
    throw new Error(`no data for ${sym}`);
  }
  const closes = rows.map(r => r.close || r.adjClose).filter(Boolean);
  const weeklyCloses = [];
  for (let i = 0; i < rows.length; i += 5) {
    const slice = rows.slice(i, i + 5).filter(r => r.close || r.adjClose);
    if (slice.length) weeklyCloses.push(slice[slice.length - 1].close || slice[slice.length - 1].adjClose);
  }

  const price = closes[closes.length - 1] || 0;
  const ema8 = calcEMA(closes, 8);
  const ema21 = calcEMA(closes, 21);
  const ema50 = calcEMA(closes, 50);
  const ema200 = calcEMA(closes, 200);
  const rsi14 = calcRSI(weeklyCloses, 14);
  const rsi14Prev = weeklyCloses.length > 15 ? calcRSI(weeklyCloses.slice(0, -1), 14) : null;
  const ath = Math.max(...closes);
  const last252 = closes.slice(-252);
  const low52 = last252.length ? Math.min(...last252) : price;

  const signals = [];
  if (ema8 !== null && price < ema8) signals.push("Below 8 EMA");
  if (ema8 !== null && price > ema8) signals.push("Above 8 EMA");
  if (ema21 !== null && price < ema21) signals.push("Below 21 EMA");
  if (ema50 !== null && price < ema50) signals.push("Below 50 EMA");
  if (ema200 !== null && price < ema200) signals.push("Below 200 EMA");
  if (ema200 !== null && price > ema200) signals.push("Above 200 EMA");
  if (ema8 !== null && ema21 !== null && ema8 > ema21) signals.push("8 EMA > 21 EMA");
  if (ema8 !== null && ema21 !== null && ema8 < ema21) signals.push("8 EMA < 21 EMA");
  if (rsi14 !== null && rsi14 < 30) signals.push("Weekly RSI Oversold");
  if (rsi14 !== null && rsi14 > 70) signals.push("Weekly RSI Overbought");
  if (rsi14 !== null && rsi14 >= 30 && rsi14 <= 70) signals.push("Weekly RSI Neutral");

  const rec = {
    symbol: sym,
    price,
    ema8: ema8 !== null ? +ema8.toFixed(2) : null,
    ema21: ema21 !== null ? +ema21.toFixed(2) : null,
    ema50: ema50 !== null ? +ema50.toFixed(2) : null,
    ema200: ema200 !== null ? +ema200.toFixed(2) : null,
    rsi14: rsi14 !== null ? +rsi14.toFixed(1) : null,
    rsi14Prev: rsi14Prev !== null ? +rsi14Prev.toFixed(1) : null,
    signals,
    ath,
    low52,
    pctDown: ath > 0 ? ((ath - price) / ath) * 100 : 0,
    asOf: now,
    bars: rows.length,
  };
  cache.history[sym] = rec;
  saveCache(cache);
  return { ...rec, fromCache: false };
}

function getCachedHistory(symbol) {
  const sym = String(symbol || "").trim().toUpperCase();
  const cache = loadCache();
  return cache.history[sym] || null;
}

function cacheSummary() {
  const cache = loadCache();
  const now = Date.now();
  const entries = [];
  for (const [sym, q] of Object.entries(cache.quotes)) {
    entries.push({ symbol: sym, type: "quote", price: q.price, ageHours: ((now - q.asOf) / 3600000).toFixed(1), nextAllowedInHours: Math.max(0, ((q.asOf + COOLDOWN_MS) - now) / 3600000).toFixed(1) });
  }
  for (const [sym, h] of Object.entries(cache.history)) {
    entries.push({ symbol: sym, type: "history", price: h.price, ageHours: ((now - h.asOf) / 3600000).toFixed(1), nextAllowedInHours: Math.max(0, ((h.asOf + COOLDOWN_MS) - now) / 3600000).toFixed(1) });
  }
  return { cooldown_hours: COOLDOWN_MS / 3600000, count: entries.length, entries };
}

module.exports = { getQuotes, getHistory, getCachedHistory, cacheSummary };
