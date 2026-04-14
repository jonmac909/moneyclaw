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
      promise.finally(() => inflight.delete(key));
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

/**
 * Get daily history for a single symbol (used for RSI/EMA/ATH).
 * Cache 24h — same rule.
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
    promise.finally(() => inflight.delete(key));
  }
  const rows = await promise;
  if (!Array.isArray(rows) || !rows.length) {
    if (cached) return { ...cached, symbol: sym, fromCache: true, stale: true };
    throw new Error(`no data for ${sym}`);
  }
  // RSI(14) + EMA(50) + EMA(200) — same conventions as the old Yahoo code
  const closes = rows.map(r => r.close || r.adjClose);
  const ema = (p) => {
    const k = 2 / (p + 1);
    let e = closes.slice(0, p).reduce((a, b) => a + b, 0) / p;
    for (let i = p; i < closes.length; i++) e = closes[i] * k + e * (1 - k);
    return e;
  };
  const rsi = (p) => {
    if (closes.length <= p) return null;
    let gains = 0, losses = 0;
    for (let i = 1; i <= p; i++) {
      const d = closes[i] - closes[i - 1];
      if (d > 0) gains += d; else losses -= d;
    }
    let avgG = gains / p, avgL = losses / p;
    for (let i = p + 1; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      avgG = (avgG * (p - 1) + Math.max(0, d)) / p;
      avgL = (avgL * (p - 1) + Math.max(0, -d)) / p;
    }
    return avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  };
  const rsi14 = rsi(14);
  // previous RSI (for direction)
  const prev = closes.slice(0, -1);
  const rsiPrev = (() => {
    if (prev.length <= 14) return null;
    const saved = closes;
    const origCloses = closes;
    let gains = 0, losses = 0;
    for (let i = 1; i <= 14; i++) {
      const d = prev[i] - prev[i - 1];
      if (d > 0) gains += d; else losses -= d;
    }
    let avgG = gains / 14, avgL = losses / 14;
    for (let i = 15; i < prev.length; i++) {
      const d = prev[i] - prev[i - 1];
      avgG = (avgG * 13 + Math.max(0, d)) / 14;
      avgL = (avgL * 13 + Math.max(0, -d)) / 14;
    }
    return avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  })();
  const ema50 = closes.length >= 50 ? ema(50) : null;
  const ema200 = closes.length >= 200 ? ema(200) : null;
  const ath = Math.max(...closes);
  const price = closes[closes.length - 1];
  const rec = {
    symbol: sym,
    price,
    ath,
    pctDown: ath > 0 ? ((ath - price) / ath) * 100 : 0,
    rsi14,
    rsi14Prev: rsiPrev,
    ema50,
    ema200,
    asOf: now,
    bars: rows.length,
  };
  cache.history[sym] = rec;
  saveCache(cache);
  return { ...rec, fromCache: false };
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

module.exports = { getQuotes, getHistory, cacheSummary };
