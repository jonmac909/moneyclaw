/**
 * MoneyClaw — Plaid Integration Server
 *
 * A lightweight Express server that proxies Plaid API calls so your
 * client-side MoneyClaw app never touches API secrets directly.
 *
 * Usage:
 *   1. Copy .env.example → .env and fill in your Plaid keys
 *   2. npm install
 *   3. npm start
 *   4. MoneyClaw will call http://localhost:8484/api/plaid/*
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } = require("plaid");
const billing = require("./plaid-billing");
const tiingo = require("./tiingo");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "50mb" }));

const PORT = process.env.PORT || 8484;

/* ── Plaid client setup ── */
const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});
const plaid = new PlaidApi(config);

/* Persist connections to disk so they survive server restarts */
const CONN_FILE = path.join(__dirname, "connections.json");
let connections = [];
try { connections = JSON.parse(fs.readFileSync(CONN_FILE, "utf8")); } catch (_) {}
const saveConnections = () => fs.writeFileSync(CONN_FILE, JSON.stringify(connections, null, 2));

/* ─────────────────────────────────────────────
   1. CREATE LINK TOKEN
   The client calls this to get a token for Plaid Link UI
   ───────────────────────────────────────────── */
app.post("/api/plaid/create-link-token", async (req, res) => {
  try {
    const response = await billing.guardedCall("linkTokenCreate", null, () => plaid.linkTokenCreate({
      user: { client_user_id: "moneyclaw-user-1" },
      client_name: "MoneyClaw",
      products: [Products.Transactions],
      optional_products: [Products.Investments],
      country_codes: [CountryCode.Ca, CountryCode.Us],
      language: "en",
    }));
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error("create-link-token error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error_message || err.message });
  }
});

/* ─────────────────────────────────────────────
   2. EXCHANGE PUBLIC TOKEN
   After user completes Plaid Link, exchange the public_token
   for a permanent access_token
   ───────────────────────────────────────────── */
app.post("/api/plaid/exchange-token", async (req, res) => {
  try {
    const { public_token, institution } = req.body;
    const response = await billing.guardedCall("itemPublicTokenExchange", null, () => plaid.itemPublicTokenExchange({ public_token }));
    const { access_token, item_id } = response.data;

    const conn = {
      id: `conn_${Date.now()}`,
      institution: institution || "Unknown",
      accessToken: access_token,
      itemId: item_id,
      connectedAt: new Date().toISOString(),
    };
    connections.push(conn);
    saveConnections();

    console.log(`Connected: ${conn.institution} (${conn.id})`);
    res.json({ id: conn.id, institution: conn.institution, connectedAt: conn.connectedAt });
  } catch (err) {
    console.error("exchange-token error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error_message || err.message });
  }
});

/* ─────────────────────────────────────────────
   3. LIST CONNECTIONS
   ───────────────────────────────────────────── */
app.get("/api/plaid/connections", (req, res) => {
  res.json(connections.map(c => ({ id: c.id, institution: c.institution, connectedAt: c.connectedAt })));
});

/* Per-connection health: surfaces ITEM_LOGIN_REQUIRED etc. so the UI can
   tell the user whether to retry or re-authenticate via Plaid Link update-mode. */
/* ─────────────────────────────────────────────
   TIINGO (stock prices) — hard 24h cooldown per symbol
   Drop-in replacement for the Yahoo Finance-backed quote / history routes.
   ───────────────────────────────────────────── */
app.get("/api/stocks/quote", async (req, res) => {
  const symbols = String(req.query.symbols || "").split(",").map(s => s.trim()).filter(Boolean);
  const force = req.query.force === "1";
  if (!symbols.length) return res.status(400).json({ error: "symbols required" });
  try {
    const out = await tiingo.getQuotes(symbols, { force });
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/stocks/history", async (req, res) => {
  const symbol = String(req.query.symbol || "").trim();
  const force = req.query.force === "1";
  if (!symbol) return res.status(400).json({ error: "symbol required" });
  try {
    const out = await tiingo.getHistory(symbol, { force });
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/stocks/cache", (req, res) => {
  res.json(tiingo.cacheSummary());
});

/* ─────────────────────────────────────────────
   BILLING SAFEGUARD TELEMETRY & ADMIN
   ───────────────────────────────────────────── */
app.get("/api/plaid/usage", (req, res) => {
  res.json(billing.usageSummary());
});
app.post("/api/plaid/reset-breaker/:connId", (req, res) => {
  billing.resetBreaker(req.params.connId);
  res.json({ ok: true, connId: req.params.connId });
});
app.post("/api/plaid/reset-cooldown/:connId", (req, res) => {
  billing.resetCooldown(req.params.connId, req.query.endpoint);
  res.json({ ok: true, connId: req.params.connId, endpoint: req.query.endpoint || "all" });
});

/* Convert billing errors into 429 JSON instead of 500 */
app.use((err, req, res, next) => {
  if (err && err.code && err.status === 429) {
    return res.status(429).json({ error: err.message, error_code: err.code });
  }
  next(err);
});

app.get("/api/plaid/item-status", async (req, res) => {
  const results = await Promise.all(connections.map(async (conn) => {
    try {
      const r = await billing.guardedCall("itemGet", conn.id, () => plaid.itemGet({ access_token: conn.accessToken }));
      return {
        id: conn.id, institution: conn.institution,
        status: r.data.item?.error ? "error" : "ok",
        error_code: r.data.item?.error?.error_code || null,
        error_message: r.data.item?.error?.error_message || null,
        consent_expiration_time: r.data.item?.consent_expiration_time || null,
        webhook: r.data.item?.webhook || null,
      };
    } catch (err) {
      return {
        id: conn.id, institution: conn.institution, status: "fetch_error",
        error_code: err.response?.data?.error_code || null,
        error_message: err.response?.data?.error_message || err.message,
      };
    }
  }));
  res.json(results);
});

/* ─────────────────────────────────────────────
   4. GET ALL ACCOUNTS (balances) for a connection
   ───────────────────────────────────────────── */
app.get("/api/plaid/accounts/:connId", async (req, res) => {
  const conn = connections.find(c => c.id === req.params.connId);
  if (!conn) return res.status(404).json({ error: "Connection not found" });

  try {
    const response = await billing.guardedCall("accountsBalanceGet", conn.id, () => plaid.accountsBalanceGet({ access_token: conn.accessToken }));

    /* For investment accounts, try to get total value from holdings */
    let holdingsTotal = {};
    try {
      const hRes = await billing.guardedCall("investmentsHoldingsGet", conn.id, () => plaid.investmentsHoldingsGet({ access_token: conn.accessToken }));
      (hRes.data.holdings || []).forEach(h => {
        holdingsTotal[h.account_id] = (holdingsTotal[h.account_id] || 0) + (h.institution_value || 0);
      });
    } catch (_) { /* investments not supported for this connection — ignore */ }

    const accounts = response.data.accounts.map(a => ({
      id: a.account_id,
      name: a.name,
      officialName: a.official_name,
      type: a.type,           // depository, investment, credit, loan
      subtype: a.subtype,     // checking, savings, brokerage, rrsp, tfsa, etc.
      currency: a.balances.iso_currency_code || "CAD",
      balance: a.balances.current ?? a.balances.available ?? holdingsTotal[a.account_id] ?? null,
      available: a.balances.available,
      limit: a.balances.limit,
      mask: a.mask,           // last 4 digits
    }));
    res.json({ institution: conn.institution, accounts });
  } catch (err) {
    console.error("accounts error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error_message || err.message });
  }
});

/* ─────────────────────────────────────────────
   5. GET INVESTMENT HOLDINGS for a connection
   ───────────────────────────────────────────── */
app.get("/api/plaid/holdings/:connId", async (req, res) => {
  const conn = connections.find(c => c.id === req.params.connId);
  if (!conn) return res.status(404).json({ error: "Connection not found" });

  try {
    const response = await billing.guardedCall("investmentsHoldingsGet", conn.id, () => plaid.investmentsHoldingsGet({ access_token: conn.accessToken }));
    const securities = {};
    (response.data.securities || []).forEach(s => {
      securities[s.security_id] = {
        ticker: s.ticker_symbol,
        name: s.name,
        type: s.type,         // equity, etf, fixed income, mutual fund, cash, crypto, etc.
        currency: s.iso_currency_code,
        closePrice: s.close_price,
        closePriceAsOf: s.close_price_as_of,
      };
    });

    const holdings = (response.data.holdings || []).map(h => {
      const sec = securities[h.security_id] || {};
      return {
        securityId: h.security_id,
        accountId: h.account_id,
        ticker: sec.ticker,
        name: sec.name,
        type: sec.type,
        currency: sec.currency || h.iso_currency_code || "CAD",
        quantity: h.quantity,
        costBasis: h.cost_basis,
        currentValue: h.institution_value,
        currentPrice: sec.closePrice,
        priceDate: sec.closePriceAsOf,
      };
    });

    const accounts = (response.data.accounts || []).map(a => ({
      id: a.account_id,
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      currency: a.balances.iso_currency_code || "CAD",
      balance: a.balances.current,
    }));

    res.json({ institution: conn.institution, accounts, holdings });
  } catch (err) {
    console.error("holdings error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error_message || err.message });
  }
});

/* ─────────────────────────────────────────────
   6. GET TRANSACTIONS for a connection
   ───────────────────────────────────────────── */
app.post("/api/plaid/transactions/:connId", async (req, res) => {
  const conn = connections.find(c => c.id === req.params.connId);
  if (!conn) return res.status(404).json({ error: "Connection not found" });

  const { startDate, endDate } = req.body;
  const end = endDate || new Date().toISOString().slice(0, 10);
  const start = startDate || new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

  try {
    let allTxns = [];
    let hasMore = true;
    let offset = 0;

    let pageCount = 0;
    const MAX_PAGES = 20; // hard safety cap: max 10,000 txns per connection per call
    while (hasMore) {
      if (++pageCount > MAX_PAGES) {
        console.warn(`transactions page limit hit for ${conn.id} after ${pageCount} pages`);
        break;
      }
      const response = await billing.guardedCall("transactionsGet", conn.id, () => plaid.transactionsGet({
        access_token: conn.accessToken,
        start_date: start,
        end_date: end,
        options: { count: 500, offset },
      }), { force: pageCount > 1 }); // subsequent pages skip cooldown (same logical call)
      allTxns = allTxns.concat(response.data.transactions);
      hasMore = allTxns.length < response.data.total_transactions;
      offset = allTxns.length;
    }

    const transactions = allTxns.map(t => ({
      id: t.transaction_id,
      accountId: t.account_id,
      date: t.date,
      name: t.merchant_name || t.name,
      amount: t.amount,       // positive = money out, negative = money in (Plaid convention)
      currency: t.iso_currency_code || "CAD",
      category: t.personal_finance_category?.primary || t.category?.[0] || "Other",
      subcategory: t.personal_finance_category?.detailed || t.category?.[1] || "",
      pending: t.pending,
    }));

    res.json({ institution: conn.institution, transactions, startDate: start, endDate: end });
  } catch (err) {
    console.error("transactions error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error_message || err.message });
  }
});

/* ─────────────────────────────────────────────
   7. SYNC ALL — convenience endpoint that pulls everything
   ───────────────────────────────────────────── */
app.get("/api/plaid/sync-all", async (req, res) => {
  const perConn = connections.map(async (conn) => {
    const result = { id: conn.id, institution: conn.institution, accounts: [], holdings: [], error: null };
    try {
      // Balances
      const balRes = await billing.guardedCall("accountsBalanceGet", conn.id, () => plaid.accountsBalanceGet({ access_token: conn.accessToken }));
      result.accounts = balRes.data.accounts.map(a => ({
        id: a.account_id,
        name: a.name,
        officialName: a.official_name,
        type: a.type,
        subtype: a.subtype,
        currency: a.balances.iso_currency_code || "CAD",
        balance: a.balances.current ?? a.balances.available ?? null,
        available: a.balances.available,
        mask: a.mask,
      }));

      // Try investment holdings (will fail gracefully for non-investment accounts)
      try {
        const invRes = await billing.guardedCall("investmentsHoldingsGet", conn.id, () => plaid.investmentsHoldingsGet({ access_token: conn.accessToken }));
        const securities = {};
        (invRes.data.securities || []).forEach(s => { securities[s.security_id] = s; });
        result.holdings = (invRes.data.holdings || []).map(h => {
          const sec = securities[h.security_id] || {};
          return {
            accountId: h.account_id,
            securityId: h.security_id,
            ticker: sec.ticker_symbol, name: sec.name, type: sec.type,
            currency: sec.iso_currency_code || h.iso_currency_code || "CAD",
            quantity: h.quantity, costBasis: h.cost_basis,
            currentValue: h.institution_value, currentPrice: sec.close_price,
          };
        });
      } catch (_) { /* not an investment account — that's fine */ }
    } catch (err) {
      result.error = err.response?.data?.error_message || err.message;
    }
    return result;
  });

  const results = await Promise.all(perConn);
  res.json(results);
});

/* ─────────────────────────────────────────────
   8. REMOVE CONNECTION
   ───────────────────────────────────────────── */
app.delete("/api/plaid/connections/:connId", async (req, res) => {
  const idx = connections.findIndex(c => c.id === req.params.connId);
  if (idx === -1) return res.status(404).json({ error: "Connection not found" });

  try {
    await billing.guardedCall("itemRemove", connections[idx].id, () => plaid.itemRemove({ access_token: connections[idx].accessToken }));
  } catch (_) { /* best effort */ }

  const removed = connections.splice(idx, 1)[0];
  saveConnections();
  console.log(`Disconnected: ${removed.institution}`);
  res.json({ success: true });
});

/* ═══════════════════════════════════════════
   MARKET DATA — Yahoo Finance endpoints
   ═══════════════════════════════════════════ */
const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance();

/* Helper: calculate EMA from price array */
function calcEMA(prices, period) {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((s, p) => s + p, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

/* Helper: calculate MACD from price array — returns { macd, signal, histogram } */
function calcMACD(prices) {
  if (prices.length < 35) return null;
  const ema12arr = [], ema26arr = [];
  let ema12 = prices.slice(0, 12).reduce((s, p) => s + p, 0) / 12;
  let ema26 = prices.slice(0, 26).reduce((s, p) => s + p, 0) / 26;
  const k12 = 2 / 13, k26 = 2 / 27;
  for (let i = 0; i < prices.length; i++) {
    if (i >= 12) ema12 = prices[i] * k12 + ema12 * (1 - k12);
    if (i >= 26) ema26 = prices[i] * k26 + ema26 * (1 - k26);
    if (i >= 26) { ema12arr.push(ema12); ema26arr.push(ema26); }
  }
  const macdLine = ema12arr.map((e12, i) => e12 - ema26arr[i]);
  if (macdLine.length < 9) return null;
  let signal = macdLine.slice(0, 9).reduce((s, v) => s + v, 0) / 9;
  const k9 = 2 / 10;
  for (let i = 9; i < macdLine.length; i++) signal = macdLine[i] * k9 + signal * (1 - k9);
  const macd = macdLine[macdLine.length - 1];
  const histogram = macd - signal;
  const prevMacd = macdLine.length > 1 ? macdLine[macdLine.length - 2] : macd;
  let prevSignal = macdLine.slice(0, 9).reduce((s, v) => s + v, 0) / 9;
  for (let i = 9; i < macdLine.length - 1; i++) prevSignal = macdLine[i] * k9 + prevSignal * (1 - k9);
  const crossover = prevMacd <= prevSignal && macd > signal ? "bullish" : prevMacd >= prevSignal && macd < signal ? "bearish" : null;
  return { macd: +macd.toFixed(3), signal: +signal.toFixed(3), histogram: +histogram.toFixed(3), crossover };
}

/* Helper: calculate RSI from price array */
function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/* Helper: detect order blocks from OHLC candles.
   An order block is a candle with a small body and long wick (doji/hammer)
   showing institutional rejection. Returns array of { price, type, date, strength }. */
function detectOrderBlocks(candles) {
  const blocks = [];
  for (let i = 1; i < candles.length - 1; i++) {
    const c = candles[i];
    if (!c.open || !c.close || !c.high || !c.low) continue;
    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    if (range === 0) continue;
    const bodyRatio = body / range;
    const lowerWick = Math.min(c.open, c.close) - c.low;
    const upperWick = c.high - Math.max(c.open, c.close);

    // Demand block: small body + long lower wick (buyers stepped in)
    if (bodyRatio < 0.35 && lowerWick > body * 2) {
      const next = candles[i + 1];
      if (next && next.close > c.close) {
        blocks.push({
          price: Math.min(c.open, c.close),
          wickLow: c.low,
          type: "demand",
          date: c.date,
          strength: lowerWick / range,
        });
      }
    }
    // Supply block: small body + long upper wick (sellers stepped in)
    if (bodyRatio < 0.35 && upperWick > body * 2) {
      const next = candles[i + 1];
      if (next && next.close < c.close) {
        blocks.push({
          price: Math.max(c.open, c.close),
          wickHigh: c.high,
          type: "supply",
          date: c.date,
          strength: upperWick / range,
        });
      }
    }
  }
  return blocks.slice(-10);
}

/* Helper: check for bullish/bearish RSI divergence */
function detectDivergence(prices, rsiValues) {
  if (prices.length < 5 || rsiValues.length < 5) return null;
  const len = Math.min(prices.length, rsiValues.length);
  const recent = len - 1;
  const lookback = Math.max(0, len - 20);
  let priceLow1 = Infinity, priceLow1Idx = recent;
  let priceLow2 = Infinity, priceLow2Idx = recent;
  for (let i = recent; i >= lookback; i--) {
    if (prices[i] < priceLow1) {
      priceLow2 = priceLow1; priceLow2Idx = priceLow1Idx;
      priceLow1 = prices[i]; priceLow1Idx = i;
    } else if (prices[i] < priceLow2) {
      priceLow2 = prices[i]; priceLow2Idx = i;
    }
  }
  // Bullish divergence: price making lower low but RSI making higher low
  if (priceLow1Idx > priceLow2Idx && priceLow1 < priceLow2
      && rsiValues[priceLow1Idx] > rsiValues[priceLow2Idx]) {
    return "bullish";
  }
  // Bearish: price making higher high but RSI making lower high
  let priceHigh1 = -Infinity, priceHigh1Idx = recent;
  let priceHigh2 = -Infinity, priceHigh2Idx = recent;
  for (let i = recent; i >= lookback; i--) {
    if (prices[i] > priceHigh1) {
      priceHigh2 = priceHigh1; priceHigh2Idx = priceHigh1Idx;
      priceHigh1 = prices[i]; priceHigh1Idx = i;
    } else if (prices[i] > priceHigh2) {
      priceHigh2 = prices[i]; priceHigh2Idx = i;
    }
  }
  if (priceHigh1Idx > priceHigh2Idx && priceHigh1 > priceHigh2
      && rsiValues[priceHigh1Idx] < rsiValues[priceHigh2Idx]) {
    return "bearish";
  }
  return null;
}

/* 1. QUOTES — batch price data */
app.get("/api/market/quote", async (req, res) => {
  try {
    const symbols = (req.query.symbols || "").split(",").filter(Boolean);
    if (symbols.length === 0) return res.json({ quotes: [] });

    const results = await Promise.allSettled(
      symbols.map(s => yahooFinance.quote(s))
    );

    const quotes = results
      .filter(r => r.status === "fulfilled" && r.value)
      .map(r => {
        const q = r.value;
        const price = q.regularMarketPrice || 0;
        const ath = q.fiftyTwoWeekHigh || price;
        const low52 = q.fiftyTwoWeekLow || price;
        return {
          symbol: q.symbol,
          shortName: q.shortName || q.longName || q.symbol,
          price,
          previousClose: q.regularMarketPreviousClose || price,
          change: q.regularMarketChange || 0,
          changePct: q.regularMarketChangePercent || 0,
          ath,
          low52,
          pctDown: ath > 0 ? ((ath - price) / ath * 100) : 0,
          pctUp: price > 0 ? ((ath - price) / price * 100) : 0,
          marketCap: q.marketCap || null,
          currency: q.currency || "USD",
        };
      });

    res.json({ quotes });
  } catch (err) {
    console.error("market/quote error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* 2. HISTORY + TECHNICALS — per symbol */
app.get("/api/market/history", async (req, res) => {
  try {
    const symbol = req.query.symbol;
    if (!symbol) return res.status(400).json({ error: "symbol required" });

    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 1);

    const period3y = new Date();
    period3y.setFullYear(period3y.getFullYear() - 3);
    const [dailyResult, weeklyResult, monthlyResult] = await Promise.all([
      yahooFinance.chart(symbol, { period1, interval: "1d" }),
      yahooFinance.chart(symbol, { period1, interval: "1wk" }).catch(() => null),
      yahooFinance.chart(symbol, { period1: period3y, interval: "1mo" }).catch(() => null),
    ]);

    const quotes = dailyResult.quotes || [];
    const closes = quotes.map(q => q.close).filter(Boolean);

    // Daily RSI(14)
    const dailyRsi14 = calcRSI(closes, 14);
    const dailyRsi14Prev = closes.length > 15 ? calcRSI(closes.slice(0, -1), 14) : null;

    // Weekly candles + RSI
    const weeklyQuotes = weeklyResult?.quotes || [];
    const weeklyCloses = weeklyQuotes.map(q => q.close).filter(Boolean);
    const weeklyRsi14 = calcRSI(weeklyCloses, 14);
    const weeklyRsi14Prev = weeklyCloses.length > 15 ? calcRSI(weeklyCloses.slice(0, -1), 14) : null;

    // Monthly candles + RSI
    const monthlyQuotes = monthlyResult?.quotes || [];
    const monthlyCloses = monthlyQuotes.map(q => q.close).filter(Boolean);
    const monthlyRsi14 = calcRSI(monthlyCloses, 14);

    // Rolling RSI array for divergence detection
    const rollingRsi = [];
    for (let i = 15; i <= closes.length; i++) {
      rollingRsi.push(calcRSI(closes.slice(0, i), 14) || 0);
    }
    const divergence = detectDivergence(closes.slice(-rollingRsi.length), rollingRsi);
    const macd = calcMACD(closes);

    // Order blocks from weekly candles
    const weeklyOB = detectOrderBlocks(weeklyQuotes);

    // 52-week high for % from ATH
    const high52w = closes.length > 0 ? Math.max(...closes) : 0;

    const price = closes.length > 0 ? closes[closes.length - 1] : 0;
    const ema8 = calcEMA(closes, 8);
    const ema21 = calcEMA(closes, 21);
    const ema50 = calcEMA(closes, 50);
    const ema200 = calcEMA(closes, 200);

    // Generate signals
    const signals = [];
    if (ema8 !== null && price < ema8) signals.push("Below 8 EMA");
    if (ema8 !== null && price > ema8) signals.push("Above 8 EMA");
    if (ema21 !== null && price < ema21) signals.push("Below 21 EMA");
    if (ema50 !== null && price < ema50) signals.push("Below 50 EMA");
    if (ema200 !== null && price < ema200) signals.push("Below 200 EMA");
    if (ema200 !== null && price > ema200) signals.push("Above 200 EMA");
    if (ema8 !== null && ema21 !== null && ema8 > ema21) signals.push("8 EMA > 21 EMA");
    if (ema8 !== null && ema21 !== null && ema8 < ema21) signals.push("8 EMA < 21 EMA");
    if (dailyRsi14 !== null && dailyRsi14 < 30) signals.push("Daily RSI Oversold");
    if (dailyRsi14 !== null && dailyRsi14 < 40) signals.push("Daily RSI Weak");
    if (dailyRsi14 !== null && dailyRsi14 > 70) signals.push("Daily RSI Overbought");
    if (weeklyRsi14 !== null && weeklyRsi14 < 30) signals.push("Weekly RSI Oversold");
    if (weeklyRsi14 !== null && weeklyRsi14 > 70) signals.push("Weekly RSI Overbought");
    if (divergence === "bullish") signals.push("Bullish Divergence");
    if (divergence === "bearish") signals.push("Bearish Divergence");

    // Check proximity to order blocks
    const nearDemand = weeklyOB.filter(ob => ob.type === "demand" && price <= ob.price * 1.02 && price >= ob.wickLow * 0.98);
    const nearSupply = weeklyOB.filter(ob => ob.type === "supply" && price >= ob.price * 0.98 && price <= ob.wickHigh * 1.02);
    if (nearDemand.length > 0) signals.push("Near Weekly Demand Block");
    if (nearSupply.length > 0) signals.push("Near Weekly Supply Block");

    res.json({
      symbol, price, high52w,
      ema8: ema8 ? +ema8.toFixed(2) : null,
      ema21: ema21 ? +ema21.toFixed(2) : null,
      ema50: ema50 ? +ema50.toFixed(2) : null,
      ema200: ema200 ? +ema200.toFixed(2) : null,
      rsi14: dailyRsi14 ? +dailyRsi14.toFixed(1) : null,
      rsi14Prev: dailyRsi14Prev ? +dailyRsi14Prev.toFixed(1) : null,
      weeklyRsi14: weeklyRsi14 ? +weeklyRsi14.toFixed(1) : null,
      weeklyRsi14Prev: weeklyRsi14Prev ? +weeklyRsi14Prev.toFixed(1) : null,
      monthlyRsi14: monthlyRsi14 ? +monthlyRsi14.toFixed(1) : null,
      macd: macd || null,
      divergence,
      orderBlocks: weeklyOB,
      nearDemandBlock: nearDemand.length > 0 ? nearDemand[0] : null,
      nearSupplyBlock: nearSupply.length > 0 ? nearSupply[0] : null,
      signals,
    });
  } catch (err) {
    console.error("market/history error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* 3. NEWS — recent headlines */
app.get("/api/market/news", async (req, res) => {
  try {
    const symbols = (req.query.symbols || "").split(",").filter(Boolean);
    if (symbols.length === 0) return res.json({ news: [] });

    const allNews = [];
    for (const sym of symbols.slice(0, 15)) {
      try {
        const result = await yahooFinance.search(sym, { newsCount: 5, quotesCount: 0 });
        (result.news || []).forEach(n => {
          allNews.push({
            title: n.title,
            url: n.link,
            publisher: n.publisher,
            date: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : null,
            relatedTicker: sym,
          });
        });
      } catch (_) { /* skip failed tickers */ }
    }

    // Deduplicate by title and sort by date
    const seen = new Set();
    const unique = allNews.filter(n => {
      if (seen.has(n.title)) return false;
      seen.add(n.title);
      return true;
    }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    res.json({ news: unique.slice(0, 20) });
  } catch (err) {
    console.error("market/news error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── Health check ── */
app.get("/api/plaid/health", (req, res) => {
  res.json({
    status: "ok",
    env: process.env.PLAID_ENV || "sandbox",
    connections: connections.length,
    hasCredentials: !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET),
    twilioConfigured: !!twilioClient,
    alertPhoneConfigured: !!process.env.ALERT_PHONE_NUMBER,
  });
});

/* ── Forex Factory economic calendar (red + orange impact events) ── */
let calendarCache = { data: null, fetchedAt: 0 };
const CALENDAR_CACHE_MS = 10 * 60 * 1000; // 10 min — refresh often for actuals
const CALENDAR_FILE = path.join(__dirname, "..", "ff-calendar-cache.json");

async function fetchCalendar() {
  // Return cache if fresh
  if (calendarCache.data && Date.now() - calendarCache.fetchedAt < CALENDAR_CACHE_MS) {
    return calendarCache.data;
  }
  try {
    const resp = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json");
    const text = await resp.text();
    if (!text.startsWith("[")) throw new Error("Non-JSON response (rate limited)");
    const events = JSON.parse(text);
    const filtered = events.filter(e =>
      e.impact === "High" || e.impact === "Medium"
    ).map(e => ({
      title: e.title,
      country: e.country,
      date: e.date,
      time: e.time,
      impact: e.impact,
      forecast: e.forecast,
      previous: e.previous,
      actual: e.actual,
    }));
    calendarCache = { data: filtered, fetchedAt: Date.now() };
    // Persist to disk for next server restart
    try { fs.writeFileSync(CALENDAR_FILE, JSON.stringify({ events: filtered, fetchedAt: Date.now() })); } catch {}
    return filtered;
  } catch (err) {
    console.error("Calendar fetch error:", err.message);
    // Try disk cache
    if (!calendarCache.data) {
      try {
        if (fs.existsSync(CALENDAR_FILE)) {
          const raw = JSON.parse(fs.readFileSync(CALENDAR_FILE, "utf-8"));
          calendarCache = { data: raw.events, fetchedAt: raw.fetchedAt || 0 };
          return raw.events;
        }
      } catch {}
    }
    return calendarCache.data || [];
  }
}

app.get("/api/calendar", async (req, res) => {
  const events = await fetchCalendar();
  res.json({ events });
});

/* ── File-based persistence for MoneyClaw data ── */
const DATA_FILE = path.join(__dirname, "..", "moneyclaw-data.json");

app.post("/api/save", (req, res) => {
  try {
    /* Only save if incoming data has fewer uncategorized transactions than disk — prevents stale browser data from overwriting categorized data */
    const incomingUncat = (req.body?.cashflow?.transactions || []).filter(t => t.category === "Uncategorized").length;
    let diskUncat = 999;
    try { diskUncat = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"))?.cashflow?.transactions?.filter(t => t.category === "Uncategorized")?.length || 0; } catch {}
    if (incomingUncat > diskUncat) {
      return res.json({ ok: true, skipped: true, reason: `incoming has ${incomingUncat} uncat > disk ${diskUncat}` });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (err) {
    console.error("Save error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/load", (req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      res.json(JSON.parse(raw));
    } else {
      res.json(null);
    }
  } catch (err) {
    console.error("Load error:", err.message);
    res.json(null);
  }
});

/* ═══════════════════════════════════════════
   SMS ALERTS — Twilio integration
   ═══════════════════════════════════════════ */

let twilioClient = null;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require("twilio");
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
} catch (err) {
  console.warn("Twilio not available:", err.message);
}

/* Alert cooldown tracking — prevent duplicate SMS within cooldown window */
const alertCooldowns = {}; // key → timestamp of last send
const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours between same alert type

function checkCooldown(key) {
  const last = alertCooldowns[key] || 0;
  if (Date.now() - last < COOLDOWN_MS) return false;
  alertCooldowns[key] = Date.now();
  return true;
}

async function sendSMS(message) {
  if (!twilioClient || !process.env.ALERT_PHONE_NUMBER) return false;
  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_FROM_NUMBER,
      to: process.env.ALERT_PHONE_NUMBER,
    });
    console.log("[SMS] Sent:", message.substring(0, 80) + "...");
    return true;
  } catch (err) {
    console.error("[SMS] Send failed:", err.message);
    return false;
  }
}

/* Core alert checking engine — runs every 5 min during market hours */
async function runAlertCheck() {
  let data;
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch { return; }

  const smsAlerts = data?.settings?.smsAlerts;
  if (!smsAlerts || !smsAlerts.enabled) return;

  /* Gather all symbols to check */
  const symbols = new Set(["^VIX"]);
  const holdings = data?.portfolio?.holdings || [];
  holdings.forEach(h => { if (h.ticker && h.ticker !== "CASH") symbols.add(h.ticker); });
  const watchTickers = data?.watchlist?.tickers || [];
  watchTickers.forEach(t => { if (t.symbol) symbols.add(t.symbol); });
  /* Include all drop alert symbols */
  const dropAlerts = smsAlerts.dropAlerts || [];
  dropAlerts.forEach(da => { if (da.symbol) symbols.add(da.symbol); });

  if (symbols.size === 0) return;

  /* Fetch quotes in batch */
  let quotes = {};
  try {
    const results = await Promise.allSettled(
      [...symbols].map(s => yahooFinance.quote(s))
    );
    results.forEach(r => {
      if (r.status === "fulfilled" && r.value) {
        const q = r.value;
        const price = q.regularMarketPrice || 0;
        const ath = q.fiftyTwoWeekHigh || price;
        quotes[q.symbol] = {
          price,
          changePct: q.regularMarketChangePercent || 0,
          previousClose: q.regularMarketPreviousClose || 0,
          ath,
          pctFromHigh: ath > 0 ? ((ath - price) / ath * 100) : 0,
        };
      }
    });
  } catch (err) {
    console.error("[SMS] Quote fetch failed:", err.message);
    return;
  }

  /* Fetch technicals for held + watched symbols (skip VIX) */
  const techSymbols = [...symbols].filter(s => s !== "^VIX");
  const technicals = {};
  try {
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 1);
    const techResults = await Promise.allSettled(
      techSymbols.map(async (sym) => {
        const result = await yahooFinance.chart(sym, { period1, interval: "1d" });
        const closes = (result.quotes || []).map(q => q.close).filter(Boolean);
        const weeklyCloses = [];
        for (let i = 0; i < (result.quotes || []).length; i += 5) {
          const ws = (result.quotes || []).slice(i, i + 5).filter(q => q.close);
          if (ws.length > 0) weeklyCloses.push(ws[ws.length - 1].close);
        }
        return {
          symbol: sym,
          ema50: calcEMA(closes, 50),
          ema200: calcEMA(closes, 200),
          rsi14: calcRSI(weeklyCloses, 14),
        };
      })
    );
    techResults.forEach(r => {
      if (r.status === "fulfilled" && r.value) {
        technicals[r.value.symbol] = r.value;
      }
    });
  } catch (err) {
    console.error("[SMS] Technicals fetch failed:", err.message);
  }

  /* Check all alert conditions and collect triggered alerts */
  const alerts = [];

  /* 1. VIX thresholds */
  const vix = quotes["^VIX"];
  if (vix) {
    if (smsAlerts.vixAbove && vix.price >= smsAlerts.vixAbove) {
      if (checkCooldown("vix:above")) {
        alerts.push(`⚠️ VIX at ${vix.price.toFixed(1)} (above ${smsAlerts.vixAbove} threshold)`);
      }
    }
    if (smsAlerts.vixBelow && vix.price <= smsAlerts.vixBelow) {
      if (checkCooldown("vix:below")) {
        alerts.push(`VIX dropped to ${vix.price.toFixed(1)} (below ${smsAlerts.vixBelow} threshold)`);
      }
    }
  }

  /* 2. Daily % change alerts */
  if (smsAlerts.dailyChangePct) {
    const threshold = parseFloat(smsAlerts.dailyChangePct);
    Object.entries(quotes).forEach(([sym, q]) => {
      if (sym === "^VIX") return;
      if (Math.abs(q.changePct) >= threshold) {
        if (checkCooldown(`dailychg:${sym}`)) {
          const dir = q.changePct > 0 ? "📈" : "📉";
          alerts.push(`${dir} ${sym} moved ${q.changePct > 0 ? "+" : ""}${q.changePct.toFixed(1)}% today`);
        }
      }
    });
  }

  /* 3. Death cross / golden cross */
  if (smsAlerts.deathCross || smsAlerts.goldenCross) {
    Object.entries(technicals).forEach(([sym, t]) => {
      if (t.ema50 === null || t.ema200 === null) return;
      if (smsAlerts.deathCross && t.ema50 < t.ema200) {
        if (checkCooldown(`deathcross:${sym}`)) {
          alerts.push(`💀 ${sym} death cross — 50 EMA below 200 EMA. Bearish signal.`);
        }
      }
      if (smsAlerts.goldenCross && t.ema50 > t.ema200) {
        if (checkCooldown(`goldencross:${sym}`)) {
          alerts.push(`✨ ${sym} golden cross — 50 EMA above 200 EMA. Bullish signal.`);
        }
      }
    });
  }

  /* 4. RSI alerts */
  Object.entries(technicals).forEach(([sym, t]) => {
    if (t.rsi14 === null) return;
    if (smsAlerts.rsiOversold && t.rsi14 < 30) {
      if (checkCooldown(`rsi:oversold:${sym}`)) {
        alerts.push(`📊 ${sym} RSI oversold at ${t.rsi14.toFixed(0)} — potential buying opportunity`);
      }
    }
    if (smsAlerts.rsiOverbought && t.rsi14 > 70) {
      if (checkCooldown(`rsi:overbought:${sym}`)) {
        alerts.push(`📊 ${sym} RSI overbought at ${t.rsi14.toFixed(0)} — potential sell signal`);
      }
    }
  });

  /* 5. Portfolio price alerts (alertAbove/alertBelow/alertPctUp/alertPctDown) */
  if (smsAlerts.portfolioAlerts) {
    holdings.forEach(h => {
      if (!h.ticker || h.ticker === "CASH") return;
      const q = quotes[h.ticker];
      if (!q) return;
      if (h.alertAbove && q.price >= h.alertAbove) {
        if (checkCooldown(`price:${h.ticker}:above`)) {
          alerts.push(`🎯 ${h.ticker} hit $${q.price.toFixed(2)} (above your $${h.alertAbove} target)`);
        }
      }
      if (h.alertBelow && q.price <= h.alertBelow) {
        if (checkCooldown(`price:${h.ticker}:below`)) {
          alerts.push(`🎯 ${h.ticker} dropped to $${q.price.toFixed(2)} (below your $${h.alertBelow} target)`);
        }
      }
      if (h.alertPctUp && h.avgCost > 0) {
        const gainPct = ((q.price - h.avgCost) / h.avgCost) * 100;
        if (gainPct >= h.alertPctUp) {
          if (checkCooldown(`pctgain:${h.ticker}:up`)) {
            alerts.push(`🎯 ${h.ticker} up ${gainPct.toFixed(1)}% from your cost (above ${h.alertPctUp}% threshold)`);
          }
        }
      }
      if (h.alertPctDown && h.avgCost > 0) {
        const lossPct = ((h.avgCost - q.price) / h.avgCost) * 100;
        if (lossPct >= h.alertPctDown) {
          if (checkCooldown(`pctgain:${h.ticker}:down`)) {
            alerts.push(`🎯 ${h.ticker} down ${lossPct.toFixed(1)}% from your cost (below -${h.alertPctDown}% threshold)`);
          }
        }
      }
    });
  }

  /* 6. Watchlist buy targets */
  if (smsAlerts.buyTargets) {
    const buyTargets = data?.watchlist?.buyTargets || {};
    Object.entries(buyTargets).forEach(([sym, target]) => {
      const q = quotes[sym];
      if (!q || !target.triggerPct) return;
      const pctDown = q.previousClose > 0 ? ((q.previousClose - q.price) / q.previousClose * 100) : 0;
      if (pctDown >= target.triggerPct) {
        if (checkCooldown(`buytarget:${sym}`)) {
          alerts.push(`🛒 ${sym} buy target hit — down ${pctDown.toFixed(1)}% (trigger: ${target.triggerPct}%)`);
        }
      }
    });
  }

  /* 7. Tiered drop-from-high alerts */
  dropAlerts.forEach(da => {
    if (!da.symbol || !da.tiers || da.tiers.length === 0) return;
    const q = quotes[da.symbol];
    if (!q || q.pctFromHigh === undefined) return;
    const pctDown = q.pctFromHigh;
    // Find the highest tier that's been breached
    const sortedTiers = [...da.tiers].sort((a, b) => b - a); // highest first
    for (const tier of sortedTiers) {
      if (pctDown >= tier) {
        if (checkCooldown(`drop:${da.symbol}:${tier}`)) {
          alerts.push(`📉 ${da.symbol} is ${pctDown.toFixed(1)}% off its 52-week high ($${q.ath.toFixed(2)} → $${q.price.toFixed(2)}) — crossed ${tier}% drop threshold`);
        }
        break; // only alert on the highest breached tier
      }
    }
  });

  /* Send grouped SMS if any alerts triggered */
  if (alerts.length > 0) {
    const msg = `🦀 MoneyClaw Alerts:\n\n${alerts.join("\n\n")}`;
    // Twilio SMS limit is ~1600 chars; truncate if needed
    await sendSMS(msg.length > 1550 ? msg.substring(0, 1550) + "\n\n..." : msg);
  }
}

/* Schedule alert checks every 5 minutes during market hours */
setInterval(() => {
  const now = new Date();
  const etStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
  const etDate = new Date(etStr);
  const h = etDate.getHours();
  const m = etDate.getMinutes();
  const mins = h * 60 + m;
  const day = etDate.getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6;
  // Check 9:25 AM - 4:05 PM ET (slightly wider than market hours for pre/post signals)
  const isMarketHours = !isWeekend && mins >= 9 * 60 + 25 && mins <= 16 * 60 + 5;
  if (isMarketHours) {
    runAlertCheck().catch(err => console.error("[SMS] Alert check error:", err.message));
  }
}, 5 * 60 * 1000);

/* Alert API endpoints */
app.post("/api/alerts/test", async (req, res) => {
  if (!twilioClient) return res.status(400).json({ error: "Twilio not configured — add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to .env" });
  if (!process.env.ALERT_PHONE_NUMBER) return res.status(400).json({ error: "No ALERT_PHONE_NUMBER in .env" });
  try {
    await sendSMS("🦀 MoneyClaw test alert — SMS is working!");
    res.json({ ok: true, message: "Test SMS sent!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/alerts/status", (req, res) => {
  const phone = process.env.ALERT_PHONE_NUMBER || "";
  res.json({
    twilioConfigured: !!twilioClient,
    phoneConfigured: !!phone,
    phoneLast4: phone ? "•••" + phone.slice(-4) : null,
    cooldowns: Object.entries(alertCooldowns).map(([key, ts]) => ({
      key, lastSent: new Date(ts).toISOString(),
      cooldownEnds: new Date(ts + COOLDOWN_MS).toISOString(),
    })),
  });
});

app.post("/api/alerts/clear-cooldowns", (req, res) => {
  Object.keys(alertCooldowns).forEach(k => delete alertCooldowns[k]);
  res.json({ ok: true, message: "All cooldowns cleared" });
});

/* ─────────────────────────────────────────────
   AI-POWERED TRANSACTION CATEGORIZER
   Uses Claude CLI (your existing subscription — no extra API costs)
   to intelligently categorize transactions like a human bookkeeper.
   Requires `claude` CLI to be installed and authenticated.
   ───────────────────────────────────────────── */
const { spawn } = require("child_process");

function claudeCLI(prompt, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const proc = spawn("claude", ["--print"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => { proc.kill(); reject(new Error("Claude CLI timed out")); }, timeoutMs);
    proc.stdout.on("data", d => { stdout += d; });
    proc.stderr.on("data", d => { stderr += d; });
    proc.on("close", code => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `claude exited with code ${code}`));
    });
    proc.on("error", err => {
      clearTimeout(timer);
      reject(new Error(`Claude CLI not found: ${err.message}. Install with: npm install -g @anthropic-ai/claude-code`));
    });
    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

app.post("/api/categorize", async (req, res) => {
  const { transactions, categories } = req.body;
  if (!transactions || !transactions.length) {
    return res.json({ suggestions: [] });
  }

  /* Build the prompt with all available categories per bucket */
  const txList = transactions.slice(0, 80).map((t, i) =>
    `${i + 1}. "${t.description}" | ${t.type} | $${t.amount} ${t.currency || "CAD"} | Bucket: ${t.bucket}`
  ).join("\n");

  const catList = Object.entries(categories || {}).map(([bucket, cats]) =>
    `${bucket}: ${cats.join(", ")}`
  ).join("\n");

  const prompt = `You are a bookkeeper categorizing transactions for a Canadian business.

CATEGORIES BY BUCKET:
${catList}

RULES:
- "Moving Money" categories are for transfers between own accounts (FX conversions, bank transfers, CC payments, scheduled payments). These are NOT expenses.
- E-transfers SENT = Moving Money. E-transfers RECEIVED = Other Income.
- "PAYMENT - THANK YOU" or credit card payments = Moving Money CC Payments.
- Foreign exchange / currency conversion = Moving Money (not Bank Fees).
- Credits/refunds from hotels, airlines, merchants = the ORIGINAL expense category (e.g. hotel refund = "Business Travel", not income).
- Truncated merchant names are common (e.g., "Dashla Ne" = Dashlane password manager = Business Subscription/SaaS).
- Streaming services (Netflix, Spotify, Disney+, SiriusXM, etc.) = subscriptions, not entertainment/meals.
- Costco, Walmart, grocery stores = Groceries (not Shopping).
- Cabs/rideshare during travel = Business Travel.
- ICBC = car insurance = Business Auto.
- If you genuinely cannot identify the merchant, use "Business Misc" for business or "Personal Misc" for personal.

TRANSACTIONS TO CATEGORIZE:
${txList}

Respond with ONLY a JSON array of objects, one per transaction:
[{"index": 1, "category": "the category"}, ...]
No explanation, just the JSON array.`;

  try {
    console.log(`[AI Categorize] Processing ${transactions.length} transactions via Claude CLI...`);
    const result = await claudeCLI(prompt);

    /* Parse the JSON response — handle markdown code blocks */
    let parsed;
    try {
      const cleaned = result.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse Claude CLI response:", result.slice(0, 500));
      return res.status(500).json({ error: "Failed to parse AI response", raw: result.slice(0, 500) });
    }

    const suggestions = parsed.map(item => ({
      index: item.index,
      category: item.category,
    }));

    console.log(`[AI Categorize] Done — ${suggestions.length} suggestions`);
    res.json({ suggestions });
  } catch (err) {
    console.error("Categorize error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   CHAT BRIDGE — routes MoneyClaw Coach through Claude Code CLI
   via fakechat plugin + chat-forwarder.js.
   ───────────────────────────────────────────── */
const CHAT_FILE = path.join(__dirname, "..", "data", "chat.json");
const readChat = () => {
  try { return JSON.parse(fs.readFileSync(CHAT_FILE, "utf8")); } catch (_) { return []; }
};
const writeChat = (msgs) => {
  const tmp = CHAT_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(msgs, null, 2));
  fs.renameSync(tmp, CHAT_FILE);
};

app.get("/api/chat", (req, res) => {
  res.json(readChat());
});

app.post("/api/chat", (req, res) => {
  const { text, sender } = req.body || {};
  if (!text || typeof text !== "string") return res.status(400).json({ error: "text required" });
  const msgs = readChat();
  const msg = {
    id: "msg-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    text: text.trim(),
    sender: sender || "user",
    timestamp: Date.now(),
  };
  msgs.push(msg);
  writeChat(msgs);
  res.json(msg);
});

app.delete("/api/chat", (req, res) => {
  writeChat([]);
  res.json({ cleared: true });
});

app.listen(PORT, () => {
  console.log(`\n  MoneyClaw Plaid Server`);
  console.log(`  ─────────────────────`);
  console.log(`  Environment: ${process.env.PLAID_ENV || "sandbox"}`);
  console.log(`  Listening:   http://localhost:${PORT}`);
  console.log(`  Health:      http://localhost:${PORT}/api/plaid/health`);
  console.log(`  Chat:        http://localhost:${PORT}/api/chat`);
  console.log(`  Credentials: ${process.env.PLAID_CLIENT_ID ? "configured" : "MISSING — check .env"}\n`);
});
