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

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

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

/* In-memory store of access tokens — in production you'd persist these securely */
const connections = []; // { id, institution, accessToken, itemId, products, connectedAt }

/* ─────────────────────────────────────────────
   1. CREATE LINK TOKEN
   The client calls this to get a token for Plaid Link UI
   ───────────────────────────────────────────── */
app.post("/api/plaid/create-link-token", async (req, res) => {
  try {
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: "moneyclaw-user-1" },
      client_name: "MoneyClaw",
      products: [Products.Transactions, Products.Investments],
      country_codes: [CountryCode.Ca, CountryCode.Us],
      language: "en",
    });
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
    const response = await plaid.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = response.data;

    const conn = {
      id: `conn_${Date.now()}`,
      institution: institution || "Unknown",
      accessToken: access_token,
      itemId: item_id,
      connectedAt: new Date().toISOString(),
    };
    connections.push(conn);

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

/* ─────────────────────────────────────────────
   4. GET ALL ACCOUNTS (balances) for a connection
   ───────────────────────────────────────────── */
app.get("/api/plaid/accounts/:connId", async (req, res) => {
  const conn = connections.find(c => c.id === req.params.connId);
  if (!conn) return res.status(404).json({ error: "Connection not found" });

  try {
    const response = await plaid.accountsBalanceGet({ access_token: conn.accessToken });
    const accounts = response.data.accounts.map(a => ({
      id: a.account_id,
      name: a.name,
      officialName: a.official_name,
      type: a.type,           // depository, investment, credit, loan
      subtype: a.subtype,     // checking, savings, brokerage, rrsp, tfsa, etc.
      currency: a.balances.iso_currency_code || "CAD",
      balance: a.balances.current,
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
    const response = await plaid.investmentsHoldingsGet({ access_token: conn.accessToken });
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

    while (hasMore) {
      const response = await plaid.transactionsGet({
        access_token: conn.accessToken,
        start_date: start,
        end_date: end,
        options: { count: 500, offset },
      });
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
  const results = [];

  for (const conn of connections) {
    const result = { id: conn.id, institution: conn.institution, accounts: [], holdings: [], error: null };
    try {
      // Balances
      const balRes = await plaid.accountsBalanceGet({ access_token: conn.accessToken });
      result.accounts = balRes.data.accounts.map(a => ({
        id: a.account_id,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        currency: a.balances.iso_currency_code || "CAD",
        balance: a.balances.current,
      }));

      // Try investment holdings (will fail gracefully for non-investment accounts)
      try {
        const invRes = await plaid.investmentsHoldingsGet({ access_token: conn.accessToken });
        const securities = {};
        (invRes.data.securities || []).forEach(s => { securities[s.security_id] = s; });
        result.holdings = (invRes.data.holdings || []).map(h => {
          const sec = securities[h.security_id] || {};
          return {
            ticker: sec.ticker_symbol, name: sec.name, type: sec.type,
            currency: sec.iso_currency_code || "CAD",
            quantity: h.quantity, costBasis: h.cost_basis,
            currentValue: h.institution_value, currentPrice: sec.close_price,
          };
        });
      } catch (_) { /* not an investment account — that's fine */ }
    } catch (err) {
      result.error = err.response?.data?.error_message || err.message;
    }
    results.push(result);
  }

  res.json(results);
});

/* ─────────────────────────────────────────────
   8. REMOVE CONNECTION
   ───────────────────────────────────────────── */
app.delete("/api/plaid/connections/:connId", async (req, res) => {
  const idx = connections.findIndex(c => c.id === req.params.connId);
  if (idx === -1) return res.status(404).json({ error: "Connection not found" });

  try {
    await plaid.itemRemove({ access_token: connections[idx].accessToken });
  } catch (_) { /* best effort */ }

  const removed = connections.splice(idx, 1)[0];
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

    const result = await yahooFinance.chart(symbol, {
      period1,
      interval: "1d",
    });

    const quotes = result.quotes || [];
    const closes = quotes.map(q => q.close).filter(Boolean);

    // Weekly closes for weekly RSI
    const weeklyCloses = [];
    for (let i = 0; i < quotes.length; i += 5) {
      const weekSlice = quotes.slice(i, i + 5).filter(q => q.close);
      if (weekSlice.length > 0) weeklyCloses.push(weekSlice[weekSlice.length - 1].close);
    }

    const price = closes.length > 0 ? closes[closes.length - 1] : 0;
    const ema8 = calcEMA(closes, 8);
    const ema21 = calcEMA(closes, 21);
    const ema50 = calcEMA(closes, 50);
    const ema200 = calcEMA(closes, 200);
    const rsi14 = calcRSI(weeklyCloses, 14);

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
    if (rsi14 !== null && rsi14 < 30) signals.push("Weekly RSI Oversold");
    if (rsi14 !== null && rsi14 > 70) signals.push("Weekly RSI Overbought");
    if (rsi14 !== null && rsi14 >= 30 && rsi14 <= 70) signals.push("Weekly RSI Neutral");

    res.json({
      symbol, price,
      ema8: ema8 ? +ema8.toFixed(2) : null,
      ema21: ema21 ? +ema21.toFixed(2) : null,
      ema50: ema50 ? +ema50.toFixed(2) : null,
      ema200: ema200 ? +ema200.toFixed(2) : null,
      rsi14: rsi14 ? +rsi14.toFixed(1) : null,
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
    for (const sym of symbols.slice(0, 10)) {
      try {
        const result = await yahooFinance.search(sym, { newsCount: 3, quotesCount: 0 });
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

app.listen(PORT, () => {
  console.log(`\n  MoneyClaw Plaid Server`);
  console.log(`  ─────────────────────`);
  console.log(`  Environment: ${process.env.PLAID_ENV || "sandbox"}`);
  console.log(`  Listening:   http://localhost:${PORT}`);
  console.log(`  Health:      http://localhost:${PORT}/api/plaid/health`);
  console.log(`  Credentials: ${process.env.PLAID_CLIENT_ID ? "configured" : "MISSING — check .env"}\n`);
});
