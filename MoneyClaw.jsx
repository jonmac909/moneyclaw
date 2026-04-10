import React, { useState, useMemo, useRef, useCallback, useEffect, useReducer } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend, CartesianGrid, Area, AreaChart
} from "recharts";

/* ═══════════════════════════════════════════════════════════
   THEME & COLOURS
   ═══════════════════════════════════════════════════════════ */
const themes = {
  dark: {
    bg: "#0b1121", bg2: "#111827", card: "#1e293b", card2: "#334155", border: "#475569",
    accent: "#38bdf8", accent2: "#818cf8", green: "#34d399", red: "#f87171",
    orange: "#fb923c", pink: "#f472b6", yellow: "#facc15", cyan: "#22d3ee",
    text: "#f1f5f9", muted: "#94a3b8", white: "#ffffff",
  },
  light: {
    bg: "#f8fafc", bg2: "#ffffff", card: "#ffffff", card2: "#f1f5f9", border: "#e2e8f0",
    accent: "#0284c7", accent2: "#6366f1", green: "#059669", red: "#dc2626",
    orange: "#ea580c", pink: "#db2777", yellow: "#ca8a04", cyan: "#0891b2",
    text: "#1e293b", muted: "#64748b", white: "#1e293b",
  },
};
const PIE_COLORS = ["#38bdf8","#818cf8","#34d399","#fb923c","#f472b6","#facc15","#22d3ee","#f87171","#a78bfa","#2dd4bf"];

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const fmt = (n, cur = "CAD") => {
  if (n == null || isNaN(n)) return "$0.00";
  const sym = cur === "GBP" ? "£" : "$";
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n < 0 ? "-" : "") + sym + (abs / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (n < 0 ? "-" : "") + sym + (abs / 1e3).toFixed(1) + "K";
  return (n < 0 ? "-" : "") + sym + abs.toFixed(2);
};
const fmtFull = (n, cur = "CAD") => {
  const sym = cur === "GBP" ? "£" : "$";
  return (Number(n) < 0 ? "-" : "") + sym + Math.abs(Number(n || 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const pct = (n) => (n * 100).toFixed(1) + "%";
const mask = (str, hidden) => hidden ? "•••••" : str;
const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const toMonthKey = (d) => { const dt = new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`; };
const monthLabel = (k) => { if (!k) return ""; const [y,m] = k.split("-"); return `${months[+m-1]} ${y}`; };

/* CSV parser */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, "").toLowerCase().replace(/[^a-z0-9_]/g, "_"));
  return lines.slice(1).map(line => {
    const vals = []; let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === "," && !inQ) { vals.push(cur.trim().replace(/^["']|["']$/g, "")); cur = ""; }
      else cur += ch;
    }
    vals.push(cur.trim().replace(/^["']|["']$/g, ""));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return obj;
  });
}

/* ═══════════════════════════════════════════════════════════
   UNDO/REDO SYSTEM
   ═══════════════════════════════════════════════════════════ */
function useUndoRedo(initial) {
  const [history, setHistory] = useState({ past: [], present: initial, future: [] });
  const set = useCallback((val) => {
    setHistory(h => ({
      past: [...h.past.slice(-50), h.present],
      present: typeof val === "function" ? val(h.present) : val,
      future: [],
    }));
  }, []);
  const undo = useCallback(() => {
    setHistory(h => {
      if (h.past.length === 0) return h;
      return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
    });
  }, []);
  const redo = useCallback(() => {
    setHistory(h => {
      if (h.future.length === 0) return h;
      return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
    });
  }, []);
  return [history.present, set, undo, redo, history.past.length > 0, history.future.length > 0];
}

/* ═══════════════════════════════════════════════════════════
   DEFAULT DATA & CATEGORIES
   ═══════════════════════════════════════════════════════════ */
const BUCKETS = ["Opco", "Holdco", "Jon", "Jacqueline"];
const BUCKET_COLORS = { Opco: "#38bdf8", Holdco: "#818cf8", Jon: "#34d399", Jacqueline: "#f472b6" };

const DEFAULT_TAX_CATS = {
  Opco: ["Advertising & Promotion", "Business Meals & Entertainment", "Office Supplies", "Professional Fees", "Rent", "Salaries & Wages", "Software & Subscriptions", "Travel", "Utilities", "Bank Fees", "Insurance", "Vehicle Expenses", "Other Business Expense"],
  Holdco: ["Management Fees", "Professional Fees", "Investment Expenses", "Bank Fees", "Insurance", "Other Holdco Expense"],
  Jon: ["Housing", "Food & Groceries", "Dining Out", "Transportation", "Healthcare", "Personal Care", "Entertainment", "Clothing", "Subscriptions", "Education", "Gifts", "One-Time Purchase", "Bills", "Other Personal"],
  Jacqueline: ["Housing", "Food & Groceries", "Dining Out", "Transportation", "Healthcare", "Personal Care", "Entertainment", "Clothing", "Subscriptions", "Education", "Gifts", "One-Time Purchase", "Bills", "Other Personal"],
};

const INCOME_CATS = {
  Opco: ["Revenue - Sales", "Revenue - Services", "Revenue - Other", "Interest Income", "Other Income"],
  Holdco: ["Dividends from Opco", "Management Fees", "Interest Income", "Investment Income", "Capital Gains", "Other Income"],
  Jon: ["Salary", "Dividends from Holdco", "Dividends from Opco", "Freelance", "Interest", "Other Income"],
  Jacqueline: ["Salary", "Dividends from Holdco", "Dividends from Opco", "Freelance", "Interest", "Other Income"],
};

const DEFAULT_DEDUCTIONS = [
  { id: "ded-jacq-tax", label: "Jacqueline Personal Tax", value: 20000 },
  { id: "ded-jon-tax", label: "Jon Personal Tax", value: 20000 },
  { id: "ded-shareholder", label: "Shareholder Loan Repayment", value: 20000 },
  { id: "ded-corp-tax", label: "Corp Tax", value: 10000 },
];

const DEFAULT_SETTINGS = {
  dateFormat: "YYYY-MM-DD",
  fiscalYearStart: 1,
  baseCurrency: "CAD",
  taxRateIneligible: 30,
  taxRateEligible: 21,
  province: "BC",
  bucketNames: { Opco: "Opco Assets", Holdco: "Holdco Assets", Jon: "Jon", Jacqueline: "Jacqueline" },
  /* High-range overrides for net worth range */
  highTaxRate: 20,
  autoHideMinutes: 1,
};

/* ── Demo Data ── */
function makeDemoData() {
  const nw = {
    snapshots: [
      {
        id: uid(), month: "2026-03", notes: "March snapshot - house valued at 2.7M assumption",
        journal: "Good month. Opco revenue strong. Paid down some of the mortgage.",
        deductions: DEFAULT_DEDUCTIONS.map(d => ({ ...d })),
        items: [
          { id: uid(), bucket: "Opco", name: "CAD Cheq", currency: "CAD", value: 824.69, isLiability: false },
          { id: uid(), bucket: "Opco", name: "USD Cheq", currency: "USD", value: 126543.17, isLiability: false },
          { id: uid(), bucket: "Opco", name: "PayPal", currency: "CAD", value: 1679.00, isLiability: false },
          { id: uid(), bucket: "Opco", name: "CAD VISA", currency: "CAD", value: 3660.12, isLiability: true },
          { id: uid(), bucket: "Opco", name: "USD VISA", currency: "USD", value: 12651.37, isLiability: true },
          { id: uid(), bucket: "Holdco", name: "RBC CAD Cheq + GIC", currency: "CAD", value: 748.88, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "GLE350 Car", currency: "CAD", value: 55000.00, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "TD Stocks", currency: "USD", value: 87159.40, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "Interactive Brokers Stocks", currency: "USD", value: 132890.00, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "RBC Dominion Bonds", currency: "USD", value: 463059.51, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "RBC Dominion Hi Int Cash", currency: "CAD", value: 237786.41, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "RBC Dominion 60/40", currency: "USD", value: 298775.62, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "RBC USD Cheq", currency: "USD", value: 2705.45, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "RBC CAD House Fund", currency: "CAD", value: 2256.82, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "CAD Crypto", currency: "CAD", value: 8756.00, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "USD Silver", currency: "USD", value: 111819.40, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "USD Gold", currency: "USD", value: 6462.29, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "Numismatic Coins", currency: "CAD", value: 1000.00, isLiability: false },
          { id: uid(), bucket: "Jon", name: "RBC CAD Cheq", currency: "CAD", value: 271.60, isLiability: false },
          { id: uid(), bucket: "Jon", name: "RBC USD Cheq", currency: "USD", value: 8.14, isLiability: false },
          { id: uid(), bucket: "Jon", name: "CAD RRSP", currency: "CAD", value: 52731.56, isLiability: false },
          { id: uid(), bucket: "Jon", name: "Safe Money", currency: "CAD", value: 21440.00, isLiability: false },
          { id: uid(), bucket: "Jon", name: "CAD VISA", currency: "CAD", value: 2225.99, isLiability: true },
          { id: uid(), bucket: "Jon", name: "USD VISA", currency: "USD", value: 7049.01, isLiability: true },
          { id: uid(), bucket: "Jon", name: "RBC Direct Investing USD", currency: "USD", value: 89050.00, isLiability: false },
          { id: uid(), bucket: "Jon", name: "RBC Direct Investing CAD", currency: "CAD", value: 1136.00, isLiability: false },
          { id: uid(), bucket: "Jon", name: "TD Bank USD", currency: "USD", value: 3075.65, isLiability: false },
          { id: uid(), bucket: "Jon", name: "House (50%)", currency: "CAD", value: 1350000.00, isLiability: false },
          { id: uid(), bucket: "Jon", name: "Mortgage (50%)", currency: "CAD", value: 321152.07, isLiability: true },
          { id: uid(), bucket: "Jacqueline", name: "TD CAD Cheq", currency: "CAD", value: 10532.49, isLiability: false },
          { id: uid(), bucket: "Jacqueline", name: "TD CAD TFSA", currency: "CAD", value: 2892.99, isLiability: false },
          { id: uid(), bucket: "Jacqueline", name: "RBC GIC CAD", currency: "CAD", value: 0, isLiability: false },
          { id: uid(), bucket: "Jacqueline", name: "RBC CAD Sav", currency: "CAD", value: 110024.59, isLiability: false },
          { id: uid(), bucket: "Jacqueline", name: "RBC USD Sav", currency: "USD", value: 17709.95, isLiability: false },
          { id: uid(), bucket: "Jacqueline", name: "RBC CAD VISA", currency: "CAD", value: 78.00, isLiability: true },
          { id: uid(), bucket: "Jacqueline", name: "HSBC UK", currency: "GBP", value: 5000.00, isLiability: false },
          { id: uid(), bucket: "Jacqueline", name: "Fidelity Clearpath 2045", currency: "CAD", value: 27455.00, isLiability: false },
          { id: uid(), bucket: "Jacqueline", name: "House (50%)", currency: "CAD", value: 1350000.00, isLiability: false },
          { id: uid(), bucket: "Jacqueline", name: "Mortgage (50%)", currency: "CAD", value: 321152.07, isLiability: true },
        ],
      },
      {
        id: uid(), month: "2026-02", notes: "February snapshot",
        journal: "Quieter month. Markets were flat.",
        deductions: DEFAULT_DEDUCTIONS.map(d => ({ ...d })),
        items: [
          { id: uid(), bucket: "Opco", name: "CAD Cheq", currency: "CAD", value: 1200.00, isLiability: false },
          { id: uid(), bucket: "Opco", name: "USD Cheq", currency: "USD", value: 118000.00, isLiability: false },
          { id: uid(), bucket: "Opco", name: "PayPal", currency: "CAD", value: 2100.00, isLiability: false },
          { id: uid(), bucket: "Opco", name: "CAD VISA", currency: "CAD", value: 4200.00, isLiability: true },
          { id: uid(), bucket: "Opco", name: "USD VISA", currency: "USD", value: 11000.00, isLiability: true },
          { id: uid(), bucket: "Holdco", name: "RBC CAD Cheq + GIC", currency: "CAD", value: 1200.00, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "GLE350 Car", currency: "CAD", value: 55000.00, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "TD Stocks", currency: "USD", value: 84000.00, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "Interactive Brokers Stocks", currency: "USD", value: 128000.00, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "RBC Dominion Bonds", currency: "USD", value: 460000.00, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "RBC Dominion Hi Int Cash", currency: "CAD", value: 235000.00, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "RBC Dominion 60/40", currency: "USD", value: 290000.00, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "RBC USD Cheq", currency: "USD", value: 3100.00, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "RBC CAD House Fund", currency: "CAD", value: 2256.82, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "CAD Crypto", currency: "CAD", value: 7800.00, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "USD Silver", currency: "USD", value: 105000.00, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "USD Gold", currency: "USD", value: 6200.00, isLiability: false },
          { id: uid(), bucket: "Holdco", name: "Numismatic Coins", currency: "CAD", value: 1000.00, isLiability: false },
          { id: uid(), bucket: "Jon", name: "RBC CAD Cheq", currency: "CAD", value: 500.00, isLiability: false },
          { id: uid(), bucket: "Jon", name: "CAD RRSP", currency: "CAD", value: 52000.00, isLiability: false },
          { id: uid(), bucket: "Jon", name: "Safe Money", currency: "CAD", value: 21440.00, isLiability: false },
          { id: uid(), bucket: "Jon", name: "CAD VISA", currency: "CAD", value: 1800.00, isLiability: true },
          { id: uid(), bucket: "Jon", name: "USD VISA", currency: "USD", value: 5500.00, isLiability: true },
          { id: uid(), bucket: "Jon", name: "RBC Direct Investing USD", currency: "USD", value: 86000.00, isLiability: false },
          { id: uid(), bucket: "Jon", name: "RBC Direct Investing CAD", currency: "CAD", value: 1100.00, isLiability: false },
          { id: uid(), bucket: "Jon", name: "TD Bank USD", currency: "USD", value: 3075.65, isLiability: false },
          { id: uid(), bucket: "Jon", name: "House (50%)", currency: "CAD", value: 1350000.00, isLiability: false },
          { id: uid(), bucket: "Jon", name: "Mortgage (50%)", currency: "CAD", value: 323000.00, isLiability: true },
          { id: uid(), bucket: "Jacqueline", name: "TD CAD Cheq", currency: "CAD", value: 8900.00, isLiability: false },
          { id: uid(), bucket: "Jacqueline", name: "TD CAD TFSA", currency: "CAD", value: 2800.00, isLiability: false },
          { id: uid(), bucket: "Jacqueline", name: "RBC CAD Sav", currency: "CAD", value: 108000.00, isLiability: false },
          { id: uid(), bucket: "Jacqueline", name: "RBC USD Sav", currency: "USD", value: 17500.00, isLiability: false },
          { id: uid(), bucket: "Jacqueline", name: "RBC CAD VISA", currency: "CAD", value: 150.00, isLiability: true },
          { id: uid(), bucket: "Jacqueline", name: "HSBC UK", currency: "GBP", value: 5000.00, isLiability: false },
          { id: uid(), bucket: "Jacqueline", name: "Fidelity Clearpath 2045", currency: "CAD", value: 27000.00, isLiability: false },
          { id: uid(), bucket: "Jacqueline", name: "House (50%)", currency: "CAD", value: 1350000.00, isLiability: false },
          { id: uid(), bucket: "Jacqueline", name: "Mortgage (50%)", currency: "CAD", value: 323000.00, isLiability: true },
        ],
      },
    ],
    goals: [{ id: uid(), name: "Net Worth $5M", target: 5000000, current: 3405479 }],
  };
  const portfolio = {
    holdings: [
      /* ── IB (Interactive Brokers) — Holdco ── */
      { id: uid(), name: "iShares Bitcoin Trust", ticker: "IBIT", bucket: "Holdco", account: "IB", type: "ETF", currency: "USD", lots: [{ id: uid(), date: "2024-06-01", qty: 1220, costPerUnit: 44.32, currentPrice: 40.57 }], tags: ["Crypto"], targetType: "percentage", targetValue: 5, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },  /* Note: IBIT correlates 92% with Nasdaq — behaves like leveraged tech */
      { id: uid(), name: "Microsoft", ticker: "MSFT", bucket: "Holdco", account: "IB", type: "Stock", currency: "USD", lots: [{ id: uid(), date: "2024-08-01", qty: 32, costPerUnit: 490.48, currentPrice: 374.00 }], tags: ["Tech"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Vanguard S&P 500", ticker: "VOO", bucket: "Holdco", account: "IB", type: "ETF", currency: "USD", lots: [{ id: uid(), date: "2024-07-01", qty: 16, costPerUnit: 618.43, currentPrice: 620.38 }], tags: ["Index"], targetType: "percentage", targetValue: 10, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "NVIDIA", ticker: "NVDA", bucket: "Holdco", account: "IB", type: "Stock", currency: "USD", lots: [{ id: uid(), date: "2024-09-01", qty: 30, costPerUnit: 182.35, currentPrice: 181.90 }], tags: ["Tech"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Invesco QQQ Trust", ticker: "QQQ", bucket: "Holdco", account: "IB", type: "ETF", currency: "USD", lots: [{ id: uid(), date: "2024-10-01", qty: 9, costPerUnit: 609.06, currentPrice: 605.35 }], tags: ["Index"], targetType: "percentage", targetValue: 7, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Amazon", ticker: "AMZN", bucket: "Holdco", account: "IB", type: "Stock", currency: "USD", lots: [{ id: uid(), date: "2024-05-01", qty: 22, costPerUnit: 238.96, currentPrice: 221.75 }], tags: ["Tech"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "SPDR Dow Jones", ticker: "DIA", bucket: "Holdco", account: "IB", type: "ETF", currency: "USD", lots: [{ id: uid(), date: "2024-11-01", qty: 10, costPerUnit: 472.64, currentPrice: 478.00 }], tags: ["Index"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Meta Platforms", ticker: "META", bucket: "Holdco", account: "IB", type: "Stock", currency: "USD", lots: [{ id: uid(), date: "2024-12-01", qty: 3, costPerUnit: 668.57, currentPrice: 615.68 }], tags: ["Tech"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Visa", ticker: "V", bucket: "Holdco", account: "IB", type: "Stock", currency: "USD", lots: [{ id: uid(), date: "2025-01-01", qty: 3, costPerUnit: 342.69, currentPrice: 308.93 }], tags: ["Financials"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Apple", ticker: "AAPL", bucket: "Holdco", account: "IB", type: "Stock", currency: "USD", lots: [{ id: uid(), date: "2025-01-15", qty: 3, costPerUnit: 274.96, currentPrice: 257.38 }], tags: ["Tech"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Alphabet", ticker: "GOOG", bucket: "Holdco", account: "IB", type: "Stock", currency: "USD", lots: [{ id: uid(), date: "2025-02-01", qty: 1, costPerUnit: 302.94, currentPrice: 315.88 }], tags: ["Tech"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "IB Cash", ticker: "CASH", bucket: "Holdco", account: "IB", type: "Cash", currency: "USD", lots: [{ id: uid(), date: "2025-04-09", qty: 1, costPerUnit: 37075, currentPrice: 37075 }], tags: [], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      /* ── TD Direct Investing — Holdco ── */
      { id: uid(), name: "TD Bank", ticker: "TD", bucket: "Holdco", account: "TD Direct Investing", type: "Stock", currency: "CAD", lots: [{ id: uid(), date: "2024-06-15", qty: 300, costPerUnit: 85.20, currentPrice: 79.50 }], tags: ["Canadian Banks"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Royal Bank", ticker: "RY", bucket: "Holdco", account: "TD Direct Investing", type: "Stock", currency: "CAD", lots: [{ id: uid(), date: "2024-03-10", qty: 150, costPerUnit: 132.00, currentPrice: 148.75 }], tags: ["Canadian Banks"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Enbridge", ticker: "ENB", bucket: "Holdco", account: "TD Direct Investing", type: "Stock", currency: "CAD", lots: [{ id: uid(), date: "2024-04-01", qty: 400, costPerUnit: 48.50, currentPrice: 55.30 }], tags: ["Energy", "Dividend"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "TD Cash", ticker: "CASH", bucket: "Holdco", account: "TD Direct Investing", type: "Cash", currency: "CAD", lots: [{ id: uid(), date: "2025-04-09", qty: 1, costPerUnit: 51126, currentPrice: 51126 }], tags: [], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      /* ── RBC Dominion Securities — Holdco ── */
      { id: uid(), name: "RBC Bond Portfolio", ticker: "BONDS", bucket: "Holdco", account: "RBC Dominion", type: "Bond", currency: "USD", lots: [{ id: uid(), date: "2023-03-10", qty: 1, costPerUnit: 450000, currentPrice: 463059.51 }], tags: ["Fixed Income"], targetType: "percentage", targetValue: 30, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "RBC Balanced 60/40 Fund", ticker: "BAL", bucket: "Holdco", account: "RBC Dominion", type: "Fund", currency: "USD", lots: [{ id: uid(), date: "2024-01-15", qty: 1, costPerUnit: 280000, currentPrice: 298775.62 }], tags: ["Balanced"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "RBC Dominion Hi Int Cash", ticker: "CASH", bucket: "Holdco", account: "RBC Dominion", type: "Cash", currency: "CAD", lots: [{ id: uid(), date: "2025-04-09", qty: 1, costPerUnit: 237786.41, currentPrice: 237786.41 }], tags: ["High Interest"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Silver (Physical)", ticker: "SLV", bucket: "Holdco", account: "RBC Dominion", type: "Precious Metal", currency: "USD", lots: [{ id: uid(), date: "2024-08-01", qty: 1100, costPerUnit: 85, currentPrice: 101.65 }], tags: ["Commodities"], targetType: "percentage", targetValue: 4, alertAbove: 115, alertBelow: 80, alertPctUp: 20, alertPctDown: 15 },
      { id: uid(), name: "Gold (Physical)", ticker: "GLD", bucket: "Holdco", account: "RBC Dominion", type: "Precious Metal", currency: "USD", lots: [{ id: uid(), date: "2025-01-10", qty: 3, costPerUnit: 1900, currentPrice: 2154.10 }], tags: ["Commodities"], targetType: "percentage", targetValue: 8, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Numismatic Coins", ticker: "COINS", bucket: "Holdco", account: "RBC Dominion", type: "Precious Metal", currency: "CAD", lots: [{ id: uid(), date: "2024-01-01", qty: 1, costPerUnit: 1000, currentPrice: 1000 }], tags: ["Collectibles"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      /* ── RBC Direct Investing — Jon ── */
      { id: uid(), name: "Shopify", ticker: "SHOP", bucket: "Jon", account: "RBC Direct Investing", type: "Stock", currency: "CAD", lots: [{ id: uid(), date: "2023-06-01", qty: 200, costPerUnit: 78.50, currentPrice: 125.40 }], tags: ["Tech"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Canadian National Railway", ticker: "CNR", bucket: "Jon", account: "RBC Direct Investing", type: "Stock", currency: "CAD", lots: [{ id: uid(), date: "2023-08-15", qty: 100, costPerUnit: 155.00, currentPrice: 168.30 }], tags: ["Infrastructure"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Brookfield Asset Mgmt", ticker: "BAM", bucket: "Jon", account: "RBC Direct Investing", type: "Stock", currency: "CAD", lots: [{ id: uid(), date: "2024-01-10", qty: 250, costPerUnit: 52.00, currentPrice: 62.80 }], tags: ["Financials"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "RBC Direct Cash", ticker: "CASH", bucket: "Jon", account: "RBC Direct Investing", type: "Cash", currency: "CAD", lots: [{ id: uid(), date: "2025-04-09", qty: 1, costPerUnit: 65525, currentPrice: 65525 }], tags: [], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Jon RRSP", ticker: "RRSP", bucket: "Jon", account: "RBC Direct Investing", type: "Fund", currency: "CAD", lots: [{ id: uid(), date: "2022-01-01", qty: 1, costPerUnit: 45000, currentPrice: 52731.56 }], tags: ["Retirement"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      /* ── Crypto ── */
      { id: uid(), name: "Crypto (BTC/ETH mix)", ticker: "BTC", bucket: "Holdco", account: "IB", type: "Crypto", currency: "CAD", lots: [{ id: uid(), date: "2024-04-01", qty: 1, costPerUnit: 6000, currentPrice: 8756 }], tags: ["Digital Assets"], targetType: "percentage", targetValue: 3, alertAbove: null, alertBelow: null, alertPctUp: 30, alertPctDown: 20 },
      /* ── Retirement Funds ── */
      { id: uid(), name: "Fidelity Clearpath 2045", ticker: "FID2045", bucket: "Jacqueline", account: "Jacqueline RRSP", type: "Fund", currency: "CAD", lots: [{ id: uid(), date: "2022-01-01", qty: 1, costPerUnit: 22000, currentPrice: 27455 }], tags: ["Retirement", "Target Date"], targetType: "dollars", targetValue: 50000, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      /* ── Cash Accounts (from NW sheet) ── */
      /* Opco */
      { id: uid(), name: "Opco CAD Cheq + PayPal", ticker: "CASH", bucket: "Opco", account: "Opco", type: "Cash", currency: "CAD", lots: [{ id: uid(), date: "2026-03-01", qty: 1, costPerUnit: 2503.69, currentPrice: 2503.69 }], tags: [], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Opco USD Cheq", ticker: "CASH", bucket: "Opco", account: "Opco", type: "Cash", currency: "USD", lots: [{ id: uid(), date: "2026-03-01", qty: 1, costPerUnit: 126543.17, currentPrice: 126543.17 }], tags: [], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      /* Holdco */
      { id: uid(), name: "Holdco CAD Cash", ticker: "CASH", bucket: "Holdco", account: "Holdco", type: "Cash", currency: "CAD", lots: [{ id: uid(), date: "2026-03-01", qty: 1, costPerUnit: 3005.70, currentPrice: 3005.70 }], tags: [], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Holdco USD Cash", ticker: "CASH", bucket: "Holdco", account: "Holdco", type: "Cash", currency: "USD", lots: [{ id: uid(), date: "2026-03-01", qty: 1, costPerUnit: 2705.45, currentPrice: 2705.45 }], tags: [], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      /* Jon */
      { id: uid(), name: "Jon CAD Cash", ticker: "CASH", bucket: "Jon", account: "Jon Personal", type: "Cash", currency: "CAD", lots: [{ id: uid(), date: "2026-03-01", qty: 1, costPerUnit: 21711.60, currentPrice: 21711.60 }], tags: ["Safe Money"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Jon USD Cash", ticker: "CASH", bucket: "Jon", account: "Jon Personal", type: "Cash", currency: "USD", lots: [{ id: uid(), date: "2026-03-01", qty: 1, costPerUnit: 3083.79, currentPrice: 3083.79 }], tags: [], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      /* Jacqueline */
      { id: uid(), name: "Jacqueline CAD Cash", ticker: "CASH", bucket: "Jacqueline", account: "Jacqueline Personal", type: "Cash", currency: "CAD", lots: [{ id: uid(), date: "2026-03-01", qty: 1, costPerUnit: 123450.07, currentPrice: 123450.07 }], tags: ["TD Cheq", "TFSA", "RBC Sav"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Jacqueline USD Cash", ticker: "CASH", bucket: "Jacqueline", account: "Jacqueline Personal", type: "Cash", currency: "USD", lots: [{ id: uid(), date: "2026-03-01", qty: 1, costPerUnit: 17709.95, currentPrice: 17709.95 }], tags: ["RBC USD Sav"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      { id: uid(), name: "Jacqueline GBP Cash", ticker: "CASH", bucket: "Jacqueline", account: "Jacqueline Personal", type: "Cash", currency: "GBP", lots: [{ id: uid(), date: "2026-03-01", qty: 1, costPerUnit: 5000, currentPrice: 5000 }], tags: ["HSBC UK"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
      /* ── Other Assets ── */
      { id: uid(), name: "GLE350 Car", ticker: "CAR", bucket: "Holdco", account: "Holdco", type: "Other", currency: "CAD", lots: [{ id: uid(), date: "2024-01-01", qty: 1, costPerUnit: 55000, currentPrice: 55000 }], tags: ["Vehicle"], targetType: null, targetValue: null, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },
    ],
  };
  const cashflow = {
    transactions: [
      { id: uid(), date: "2026-03-01", bucket: "Opco", type: "income", category: "Revenue - Sales", description: "March e-commerce revenue", amount: 45000, currency: "CAD" },
      { id: uid(), date: "2026-03-05", bucket: "Opco", type: "expense", category: "Software & Subscriptions", description: "Shopify", amount: 399, currency: "CAD" },
      { id: uid(), date: "2026-03-10", bucket: "Opco", type: "expense", category: "Advertising & Promotion", description: "Meta Ads", amount: 3200, currency: "CAD" },
      { id: uid(), date: "2026-03-15", bucket: "Holdco", type: "income", category: "Dividends from Opco", description: "Q1 dividend from Opco", amount: 25000, currency: "CAD" },
      { id: uid(), date: "2026-03-15", bucket: "Opco", type: "expense", category: "Other Business Expense", description: "Dividend to Holdco", amount: 25000, currency: "CAD", isTransfer: true, transferMatch: "Holdco" },
      { id: uid(), date: "2026-03-20", bucket: "Jacqueline", type: "income", category: "Dividends from Holdco", description: "Personal dividend", amount: 8000, currency: "CAD" },
      { id: uid(), date: "2026-03-20", bucket: "Holdco", type: "expense", category: "Other Holdco Expense", description: "Dividend to Jacqueline", amount: 8000, currency: "CAD", isTransfer: true, transferMatch: "Jacqueline" },
      { id: uid(), date: "2026-03-03", bucket: "Jacqueline", type: "expense", category: "Food & Groceries", description: "Save-On-Foods", amount: 187.50, currency: "CAD" },
      { id: uid(), date: "2026-03-07", bucket: "Jacqueline", type: "expense", category: "Subscriptions", description: "Netflix", amount: 22.99, currency: "CAD" },
      { id: uid(), date: "2026-03-12", bucket: "Jon", type: "expense", category: "Transportation", description: "Gas", amount: 95.00, currency: "CAD" },
      { id: uid(), date: "2026-03-14", bucket: "Jon", type: "expense", category: "Dining Out", description: "Restaurant", amount: 120.00, currency: "CAD" },
      { id: uid(), date: "2026-03-01", bucket: "Jon", type: "expense", category: "Bills", description: "BC Hydro", amount: 142.00, currency: "CAD" },
      { id: uid(), date: "2026-03-01", bucket: "Jacqueline", type: "expense", category: "Housing", description: "Mortgage payment", amount: 3200.00, currency: "CAD" },
      { id: uid(), date: "2026-02-01", bucket: "Opco", type: "income", category: "Revenue - Sales", description: "February e-commerce revenue", amount: 38000, currency: "CAD" },
      { id: uid(), date: "2026-02-10", bucket: "Opco", type: "expense", category: "Advertising & Promotion", description: "Google Ads", amount: 2800, currency: "CAD" },
      { id: uid(), date: "2026-02-15", bucket: "Jacqueline", type: "expense", category: "One-Time Purchase", description: "New laptop", amount: 2199.00, currency: "CAD" },
    ],
    budgets: [
      { id: uid(), bucket: "Jacqueline", category: "Food & Groceries", monthlyLimit: 800, rollover: true },
      { id: uid(), bucket: "Jacqueline", category: "Dining Out", monthlyLimit: 400, rollover: false },
      { id: uid(), bucket: "Jacqueline", category: "Subscriptions", monthlyLimit: 200, rollover: false },
      { id: uid(), bucket: "Jon", category: "Food & Groceries", monthlyLimit: 600, rollover: true },
      { id: uid(), bucket: "Jon", category: "Dining Out", monthlyLimit: 500, rollover: false },
      { id: uid(), bucket: "Opco", category: "Advertising & Promotion", monthlyLimit: 5000, rollover: false },
    ],
    recurring: [
      { id: uid(), bucket: "Jacqueline", type: "expense", category: "Subscriptions", description: "Netflix", amount: 22.99, frequency: "monthly", currency: "CAD" },
      { id: uid(), bucket: "Jacqueline", type: "expense", category: "Housing", description: "Mortgage payment", amount: 3200, frequency: "monthly", currency: "CAD" },
      { id: uid(), bucket: "Jon", type: "expense", category: "Bills", description: "BC Hydro", amount: 142, frequency: "monthly", currency: "CAD" },
      { id: uid(), bucket: "Opco", type: "expense", category: "Software & Subscriptions", description: "Shopify", amount: 399, frequency: "monthly", currency: "CAD" },
    ],
    catRules: { "save-on-foods": { Jon: "Food & Groceries", Jacqueline: "Food & Groceries" }, "netflix": { Jon: "Subscriptions", Jacqueline: "Subscriptions" }, "shopify": { Opco: "Software & Subscriptions" }, "bc hydro": { Jon: "Bills", Jacqueline: "Bills" } },
    bankAccounts: {},
  };
  return { nw, portfolio, cashflow };
}

/* ═══════════════════════════════════════════════════════════
   REUSABLE UI COMPONENTS
   ═══════════════════════════════════════════════════════════ */
function S(theme) {
  const C = themes[theme];
  return {
    card: { background: C.card, borderRadius: 12, padding: 20, border: `1px solid ${C.border}`, marginBottom: 16 },
    btn: { background: C.accent, color: theme === "dark" ? "#0b1121" : "#fff", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap" },
    btnSm: { background: C.card2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" },
    btnDanger: { background: "transparent", color: C.red, border: `1px solid ${C.red}33`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 },
    btnGhost: { background: "transparent", color: C.muted, border: "none", cursor: "pointer", fontSize: 13, padding: "4px 8px" },
    input: { background: C.card2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" },
    select: { background: C.card2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 14, outline: "none" },
    th: { textAlign: "left", padding: "10px 12px", borderBottom: `2px solid ${C.border}`, color: C.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer", userSelect: "none" },
    td: { padding: "10px 12px", borderBottom: `1px solid ${C.card2}`, color: C.text, fontSize: 14 },
    badge: (color) => ({ background: color + "18", color, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, display: "inline-block" }),
    section: { marginBottom: 24 },
    h2: { margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: C.text },
    h3: { margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: C.text },
    mono: { fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 13 },
    muted: { color: C.muted, fontSize: 13 },
    row: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 },
  };
}

function StatCard({ label, value, sub, color, C }) {
  return (
    <div style={{ background: C.card, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}`, textAlign: "center", flex: 1, minWidth: 0, overflow: "hidden" }}>
      <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || C.white, fontFamily: "'SF Mono', monospace", whiteSpace: "nowrap", textAlign: "center" }}>{value}</div>
      {sub && <div style={{ color: C.muted, fontSize: 10, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
    </div>
  );
}

function CSVUpload({ onImport, templateCols, label, s, C }) {
  const ref = useRef();
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginBottom: 8 }}>
      <button style={s.btnSm} onClick={() => setShow(!show)}>{show ? "Close" : `Import CSV — ${label}`}</button>
      {show && (
        <div style={{ marginTop: 8, padding: 12, background: C.card2, borderRadius: 8, fontSize: 13 }}>
          <div style={{ color: C.muted, marginBottom: 6 }}>Expected columns: <strong style={{ color: C.accent }}>{templateCols.join(", ")}</strong></div>
          <input ref={ref} type="file" accept=".csv" style={{ color: C.text, fontSize: 13 }}
            onChange={(e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { onImport(parseCSV(ev.target.result)); setShow(false); }; r.readAsText(f); }} />
        </div>
      )}
    </div>
  );
}

function SortableTable({ columns, data, s, C, onSort, sortKey, sortDir }) {
  return (
    <div className="mc-table-wrap" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{columns.map(col => (
            <th key={col.key} style={{ ...s.th, textAlign: col.align || "left" }}
              onClick={() => onSort && onSort(col.key)}>
              {col.label} {sortKey === col.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
            </th>
          ))}</tr>
        </thead>
        <tbody>{data.map((row, i) => (
          <tr key={row.id || i} style={{ background: i % 2 === 0 ? "transparent" : C.card2 + "33" }}>
            {columns.map(col => <td key={col.key} style={{ ...s.td, textAlign: col.align || "left", ...(col.style || {}) }}>{col.render ? col.render(row) : row[col.key]}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function useSortable(defaultKey = "", defaultDir = "desc") {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);
  const onSort = (key) => {
    if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };
  const sortFn = (data) => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      av = String(av || ""); bv = String(bv || "");
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  };
  return { sortKey, sortDir, onSort, sortFn };
}

function ChartTooltip({ active, payload, label, C }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
      <div style={{ color: C.muted, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.text }}>{p.name}: <strong>{fmtFull(p.value)}</strong></div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CONVERT TO BASE CURRENCY
   ═══════════════════════════════════════════════════════════ */
function toBase(value, currency, rates, base = "CAD") {
  if (currency === base) return value;
  if (currency === "USD" && base === "CAD") return value * (rates.USDCAD || 1.37);
  if (currency === "GBP" && base === "CAD") return value * (rates.GBPCAD || 1.72);
  if (currency === "CAD" && base === "USD") return value / (rates.USDCAD || 1.37);
  if (currency === "GBP" && base === "USD") return value * (rates.GBPCAD || 1.72) / (rates.USDCAD || 1.37);
  return value;
}
function fromCAD(cadValue, toCurrency, rates) {
  if (toCurrency === "CAD") return cadValue;
  if (toCurrency === "USD") return cadValue / (rates.USDCAD || 1.37);
  if (toCurrency === "GBP") return cadValue / (rates.GBPCAD || 1.72);
  return cadValue;
}

/* ═══════════════════════════════════════════════════════════
   TAB 1 — NET WORTH
   ═══════════════════════════════════════════════════════════ */
function NetWorthTab({ data, setData, settings, rates, theme, hide }) {
  const C = themes[theme]; const s = S(theme);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [compareMonth, setCompareMonth] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingJournal, setEditingJournal] = useState(null);
  const [newItem, setNewItem] = useState({ bucket: "Opco", name: "", currency: "CAD", value: "", isLiability: false });

  const snaps = data.snapshots || [];
  const currentMonthKey = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; })();

  /* Auto-create the current month from last month's accounts if it doesn't exist */
  useEffect(() => {
    const existing = snaps.find(sn => sn.month === currentMonthKey);
    if (!existing && snaps.length > 0) {
      const latest = [...snaps].sort((a, b) => b.month.localeCompare(a.month))[0];
      const newMonth = {
        id: uid(), month: currentMonthKey, notes: "", journal: "",
        saved: false, /* flag: values haven't been confirmed yet */
        items: latest.items.map(i => ({ ...i, id: uid() })),
        deductions: latest.deductions ? latest.deductions.map(d => ({ ...d })) : DEFAULT_DEDUCTIONS.map(d => ({ ...d })),
      };
      setData({ ...data, snapshots: [newMonth, ...snaps] });
    }
  }, []);

  const sortedMonths = [...new Set(snaps.map(sn => sn.month))].sort().reverse();
  const activeMonth = selectedMonth || currentMonthKey;
  const activeSnap = snaps.find(sn => sn.month === activeMonth);
  const isCurrentMonth = activeMonth === currentMonthKey;
  const isSaved = activeSnap?.saved !== false;
  const prevMonth = compareMonth || sortedMonths.find(m => m < activeMonth) || sortedMonths[0] || "";
  const prevSnap = snaps.find(sn => sn.month === prevMonth);

  /* compute bucket totals in base currency */
  const computeBucketTotals = (snap) => {
    if (!snap) return { Opco: 0, Holdco: 0, Jon: 0, Jacqueline: 0, total: 0, totalHigh: 0, corpTotal: 0, personalTotal: 0 };
    const totals = { Opco: 0, Holdco: 0, Jon: 0, Jacqueline: 0 };
    snap.items.forEach(item => {
      const val = Number(item.value || 0) * (item.isLiability ? -1 : 1);
      totals[item.bucket] = (totals[item.bucket] || 0) + val;
    });
    const corpTotal = totals.Opco + totals.Holdco;
    const personalTotal = totals.Jon + totals.Jacqueline;
    const grossTotal = corpTotal + personalTotal;

    /* === LOW RANGE (conservative) === */
    const deductions = (snap.deductions || []).reduce((s, d) => s + Number(d.value || 0), 0);
    const corpAfterDeductions = corpTotal - deductions;
    const corpForHaircut = Math.max(0, corpAfterDeductions);
    const taxHaircut = corpForHaircut * (settings.taxRateIneligible / 100);
    const afterTaxCorp = corpAfterDeductions - taxHaircut;
    const totalDeductions = deductions + taxHaircut;
    const total = afterTaxCorp + personalTotal;

    /* === HIGH RANGE (optimistic: lower tax rate) === */
    const highTaxRate = settings.highTaxRate || 20;
    const taxHaircutHigh = corpForHaircut * (highTaxRate / 100);
    const afterTaxCorpHigh = corpAfterDeductions - taxHaircutHigh;
    const totalDeductionsHigh = deductions + taxHaircutHigh;
    const totalHigh = afterTaxCorpHigh + personalTotal;

    return {
      ...totals, corpTotal, personalTotal, grossTotal, corpAfterDeductions, corpForHaircut,
      taxHaircut, afterTaxCorp, deductions, totalDeductions, total,
      taxHaircutHigh, afterTaxCorpHigh, totalDeductionsHigh, totalHigh,
    };
  };

  const current = computeBucketTotals(activeSnap);
  const prev = computeBucketTotals(prevSnap);
  const nwChange = current.total - prev.total;
  const nwChangePct = prev.total !== 0 ? nwChange / Math.abs(prev.total) : 0;

  /* trend chart data */
  const trendData = useMemo(() => {
    return sortedMonths.slice().reverse().map(m => {
      const snap = snaps.find(sn => sn.month === m);
      const t = computeBucketTotals(snap);
      return { month: monthLabel(m), netWorth: t.total, netWorthHigh: t.totalHigh, gross: t.grossTotal, corp: t.corpTotal, personal: t.personalTotal };
    });
  }, [snaps, rates, settings]);

  const addItem = () => {
    if (!newItem.name || !newItem.value) return;
    if (!activeSnap) return;
    const updated = snaps.map(sn => sn.month === activeMonth ? { ...sn, items: [...sn.items, { ...newItem, id: uid(), value: parseFloat(newItem.value) }] } : sn);
    setData({ ...data, snapshots: updated });
    setNewItem({ ...newItem, name: "", value: "" });
  };

  const removeItem = (itemId) => {
    const updated = snaps.map(sn => sn.month === activeMonth ? { ...sn, items: sn.items.filter(i => i.id !== itemId) } : sn);
    setData({ ...data, snapshots: updated });
  };

  const [newMonthInput, setNewMonthInput] = useState("");
  const [showNewMonth, setShowNewMonth] = useState(false);
  const [unsavedBannerDismissed, setUnsavedBannerDismissed] = useState(false);

  const addNewMonth = (monthStr) => {
    const mk = monthStr || (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; })();
    if (snaps.find(sn => sn.month === mk)) { setSelectedMonth(mk); setShowNewMonth(false); return; }
    const lastSnap = snaps.sort((a, b) => b.month.localeCompare(a.month))[0];
    const newSnap = {
      id: uid(), month: mk, notes: `Snapshot created ${new Date().toISOString().slice(0, 10)}`, journal: "",
      items: lastSnap ? lastSnap.items.map(i => ({ ...i, id: uid() })) : [],
      deductions: lastSnap?.deductions ? lastSnap.deductions.map(d => ({ ...d })) : DEFAULT_DEDUCTIONS.map(d => ({ ...d })),
    };
    setData({ ...data, snapshots: [newSnap, ...snaps] });
    setSelectedMonth(mk);
    setShowNewMonth(false);
  };

  /* inline value editing */
  const updateItemValue = (itemId, newValue) => {
    const updated = snaps.map(sn => sn.month === activeMonth ? {
      ...sn, items: sn.items.map(i => i.id === itemId ? { ...i, value: parseFloat(newValue) || 0 } : i)
    } : sn);
    setData({ ...data, snapshots: updated });
  };

  /* deduction editing */
  const updateDeduction = (dedId, newValue) => {
    const updated = snaps.map(sn => sn.month === activeMonth ? {
      ...sn, deductions: (sn.deductions || []).map(d => d.id === dedId ? { ...d, value: parseFloat(newValue) || 0 } : d)
    } : sn);
    setData({ ...data, snapshots: updated });
  };
  const addDeduction = () => {
    const label = prompt("Deduction name:");
    if (!label) return;
    const updated = snaps.map(sn => sn.month === activeMonth ? {
      ...sn, deductions: [...(sn.deductions || []), { id: uid(), label, value: 0 }]
    } : sn);
    setData({ ...data, snapshots: updated });
  };
  const removeDeduction = (dedId) => {
    const updated = snaps.map(sn => sn.month === activeMonth ? {
      ...sn, deductions: (sn.deductions || []).filter(d => d.id !== dedId)
    } : sn);
    setData({ ...data, snapshots: updated });
  };

  /* Mark current month as saved/confirmed */
  const saveMonth = () => {
    const updated = snaps.map(sn => sn.month === activeMonth ? { ...sn, saved: true } : sn);
    setData({ ...data, snapshots: updated });
  };

  /* ── Excel / CSV import for net worth ── */
  /* Known account names mapped to bucket, currency, liability status */
  const KNOWN_ACCOUNTS = {
    /* Opco */
    "cad cheq": { bucket: "Opco", currency: "CAD", isLiability: false },
    "usd cheq": { bucket: "Opco", currency: "USD", isLiability: false },
    "paypal": { bucket: "Opco", currency: "CAD", isLiability: false },
    "cad visa": { bucket: "Opco", currency: "CAD", isLiability: true },
    "usd visa": { bucket: "Opco", currency: "USD", isLiability: true },
    "wise": { bucket: "Opco", currency: "CAD", isLiability: false },
    /* Holdco */
    "rbc cad cheq + gic": { bucket: "Holdco", currency: "CAD", isLiability: false },
    "rbc cad cheq": { bucket: "Holdco", currency: "CAD", isLiability: false },
    "gle350 car": { bucket: "Holdco", currency: "CAD", isLiability: false },
    "td stocks": { bucket: "Holdco", currency: "USD", isLiability: false },
    "td stocks usd": { bucket: "Holdco", currency: "USD", isLiability: false },
    "interactive brokers stocks": { bucket: "Holdco", currency: "USD", isLiability: false },
    "interactive brokers stocks usd": { bucket: "Holdco", currency: "USD", isLiability: false },
    "rbc dominion bonds": { bucket: "Holdco", currency: "USD", isLiability: false },
    "rbc dominion bonds usd": { bucket: "Holdco", currency: "USD", isLiability: false },
    "rbc dominion hi int cash": { bucket: "Holdco", currency: "CAD", isLiability: false },
    "rbc dominion hi int cash cad": { bucket: "Holdco", currency: "CAD", isLiability: false },
    "rbc dominion 60/40": { bucket: "Holdco", currency: "USD", isLiability: false },
    "rbc usd cheq": { bucket: "Holdco", currency: "USD", isLiability: false },
    "rbc cad house fund": { bucket: "Holdco", currency: "CAD", isLiability: false },
    "cad crypto": { bucket: "Holdco", currency: "CAD", isLiability: false },
    "usd silver": { bucket: "Holdco", currency: "USD", isLiability: false },
    "usd gold": { bucket: "Holdco", currency: "USD", isLiability: false },
    "numismatic coins": { bucket: "Holdco", currency: "CAD", isLiability: false },
    /* Jon */
    "rbc cad cheq_jon": { bucket: "Jon", currency: "CAD", isLiability: false },
    "rbc usd cheq_jon": { bucket: "Jon", currency: "USD", isLiability: false },
    "cad rrsp": { bucket: "Jon", currency: "CAD", isLiability: false },
    "safe money": { bucket: "Jon", currency: "CAD", isLiability: false },
    "cad visa_jon": { bucket: "Jon", currency: "CAD", isLiability: true },
    "usd visa_jon": { bucket: "Jon", currency: "USD", isLiability: true },
    "rbc direct investing usd": { bucket: "Jon", currency: "USD", isLiability: false },
    "rbc direct investing cad": { bucket: "Jon", currency: "CAD", isLiability: false },
    "td bank usd": { bucket: "Jon", currency: "USD", isLiability: false },
    /* Jacqueline */
    "td cad cheq": { bucket: "Jacqueline", currency: "CAD", isLiability: false },
    "cad cheq_jacq": { bucket: "Jacqueline", currency: "CAD", isLiability: false },
    "td cad tfsa": { bucket: "Jacqueline", currency: "CAD", isLiability: false },
    "cad tfsa": { bucket: "Jacqueline", currency: "CAD", isLiability: false },
    "rbc gic cad": { bucket: "Jacqueline", currency: "CAD", isLiability: false },
    "gic cad": { bucket: "Jacqueline", currency: "CAD", isLiability: false },
    "rbc cad sav": { bucket: "Jacqueline", currency: "CAD", isLiability: false },
    "cad sav": { bucket: "Jacqueline", currency: "CAD", isLiability: false },
    "rbc usd sav": { bucket: "Jacqueline", currency: "USD", isLiability: false },
    "usd sav": { bucket: "Jacqueline", currency: "USD", isLiability: false },
    "rbc cad visa_jacq": { bucket: "Jacqueline", currency: "CAD", isLiability: true },
    "hsbc uk": { bucket: "Jacqueline", currency: "GBP", isLiability: false },
    "fidelity clearpath 2045": { bucket: "Jacqueline", currency: "CAD", isLiability: false },
    /* Shared */
    "house (50%)": { currency: "CAD", isLiability: false },
    "mortgage (50%)": { currency: "CAD", isLiability: true },
    "mortgage remaining": { currency: "CAD", isLiability: true },
    "total house value": { currency: "CAD", isLiability: false },
  };

  const matchAccount = (name) => {
    const lower = name.toLowerCase().trim();
    if (KNOWN_ACCOUNTS[lower]) return KNOWN_ACCOUNTS[lower];
    /* fuzzy match — find best partial match */
    for (const [key, val] of Object.entries(KNOWN_ACCOUNTS)) {
      if (lower.includes(key) || key.includes(lower)) return val;
    }
    return null;
  };

  const importFromParsedData = (rows, monthKey) => {
    const items = [];
    rows.forEach(r => {
      const name = r.name || r.account || r.description || Object.values(r)[0] || "";
      const valStr = r.value || r.amount || r.balance || r.total || Object.values(r)[1] || "0";
      const value = parseFloat(String(valStr).replace(/[$,]/g, "")) || 0;
      if (!name || value === 0) return;
      const match = matchAccount(name);
      items.push({
        id: uid(), name: name.trim(),
        bucket: match?.bucket || r.bucket || "Opco",
        currency: match?.currency || (r.currency || "CAD").toUpperCase(),
        isLiability: match?.isLiability || false,
        value: Math.abs(value),
      });
    });
    if (items.length === 0) return;
    const updated = snaps.map(sn => sn.month === monthKey ? { ...sn, items } : sn);
    setData({ ...data, snapshots: updated });
  };

  const importFromExcelBinary = async (buffer, monthKey) => {
    /* Use SheetJS to parse xlsx */
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
      const items = [];

      wb.SheetNames.forEach(sheetName => {
        const ws = wb.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        /* Walk through rows looking for account name + value pairs */
        let currentSection = null;
        jsonData.forEach(row => {
          if (!row || row.length === 0) return;

          /* Detect section headers */
          const firstCell = String(row[0] || "").trim().toLowerCase();
          if (firstCell.includes("corporate") || firstCell.includes("rbc ecomm")) currentSection = "Opco";
          else if (firstCell.includes("hold co") || firstCell.includes("holdco")) currentSection = "Holdco";
          else if (firstCell.includes("crypto") || firstCell.includes("gold") || firstCell.includes("silver")) currentSection = "Holdco";
          else if (firstCell === "jon" || firstCell.includes("jon") && firstCell.includes("personal")) currentSection = "Jon";
          else if (firstCell.includes("jacqueline") && firstCell.includes("td")) currentSection = "Jacqueline";
          else if (firstCell.includes("jacqueline") && firstCell.includes("rbc")) currentSection = "Jacqueline";
          else if (firstCell.includes("jacqueline") && firstCell.includes("other")) currentSection = "Jacqueline";
          else if (firstCell.includes("real estate")) currentSection = "RealEstate";

          /* Look for name + value in the row */
          const name = String(row[0] || "").trim();
          if (!name || name.toLowerCase() === "total" || name.toLowerCase().includes("total")) return;

          /* Find a numeric value in the row */
          let value = null;
          for (let i = 1; i < row.length; i++) {
            const v = parseFloat(String(row[i] || "").replace(/[$,]/g, ""));
            if (!isNaN(v) && v !== 0) { value = v; break; }
          }
          if (value === null) return;

          const match = matchAccount(name);
          const bucket = match?.bucket || currentSection || "Opco";
          if (bucket === "RealEstate") {
            /* Split real estate 50/50 between Jon and Jacqueline */
            if (name.toLowerCase().includes("mortgage")) {
              items.push({ id: uid(), name: "Mortgage (50%)", bucket: "Jon", currency: "CAD", isLiability: true, value: Math.abs(value) / 2 });
              items.push({ id: uid(), name: "Mortgage (50%)", bucket: "Jacqueline", currency: "CAD", isLiability: true, value: Math.abs(value) / 2 });
            } else if (name.toLowerCase().includes("house")) {
              items.push({ id: uid(), name: "House (50%)", bucket: "Jon", currency: "CAD", isLiability: false, value: Math.abs(value) / 2 });
              items.push({ id: uid(), name: "House (50%)", bucket: "Jacqueline", currency: "CAD", isLiability: false, value: Math.abs(value) / 2 });
            }
            return;
          }

          items.push({
            id: uid(), name,
            bucket: bucket === "RealEstate" ? "Jon" : bucket,
            currency: match?.currency || "CAD",
            isLiability: match?.isLiability || false,
            value: Math.abs(value),
          });
        });
      });

      if (items.length > 0) {
        const updated = snaps.map(sn => sn.month === monthKey ? { ...sn, items } : sn);
        setData({ ...data, snapshots: updated });
      }
    } catch (err) {
      console.error("Excel parse error:", err);
      /* Fallback: try reading as CSV */
      try {
        const text = new TextDecoder().decode(new Uint8Array(buffer));
        const rows = parseCSV(text);
        importFromParsedData(rows, monthKey);
      } catch (e2) { console.error("Fallback CSV parse also failed:", e2); }
    }
  };

  const saveJournal = (text) => {
    const updated = snaps.map(sn => sn.month === activeMonth ? { ...sn, journal: text } : sn);
    setData({ ...data, snapshots: updated });
    setEditingJournal(null);
  };

  const saveNotes = (text) => {
    const updated = snaps.map(sn => sn.month === activeMonth ? { ...sn, notes: text } : sn);
    setData({ ...data, snapshots: updated });
  };

  /* render account rows as a table */
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingUsdId, setEditingUsdId] = useState(null);
  const renderItems = (items, isLiability, hasUSD) => {
    const color = isLiability ? C.red : C.text;
    return items.map(item => {
      const isEditing = editingItemId === item.id;
      const isEditingUsd = editingUsdId === item.id;
      const usdValue = item.currency === "USD" ? Math.round(fromCAD(Number(item.value || 0), "USD", rates)) : null;
      return (
        <tr key={item.id}>
          <td style={{ padding: "3px 0", fontSize: 12, color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{isLiability ? "− " : ""}{item.name}</td>
          <td style={{ padding: "3px 0", textAlign: "right", cursor: hide ? "default" : "text" }}
            onClick={() => { if (!hide) { setEditingItemId(item.id); setEditingUsdId(null); } }}>
            {isEditing && !hide ? (
              <input type="number" autoFocus style={{
                ...s.mono, background: C.card2, border: `1px solid ${isLiability ? C.red : C.accent}`, borderRadius: 4,
                padding: "2px 4px", color, width: "100%", boxSizing: "border-box", textAlign: "right", outline: "none", fontSize: 12,
              }}
                value={item.value} onChange={e => updateItemValue(item.id, e.target.value)}
                onBlur={() => setEditingItemId(null)}
                onKeyDown={e => { if (e.key === "Enter") setEditingItemId(null); }} />
            ) : (
              <span style={{ ...s.mono, fontSize: 12, color, padding: "2px 0", display: "inline-block" }}
                onMouseEnter={e => { if (!hide) e.target.style.borderBottom = `1px dashed ${C.muted}44`; }}
                onMouseLeave={e => { e.target.style.borderBottom = "none"; }}>
                {hide ? "•••••" : Number(item.value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </td>
          {hasUSD && (
            <td style={{ padding: "3px 0", textAlign: "right", cursor: item.currency === "USD" && !hide ? "text" : "default" }}
              onClick={() => { if (item.currency === "USD" && !hide) { setEditingUsdId(item.id); setEditingItemId(null); } }}>
              {item.currency === "USD" ? (
                isEditingUsd && !hide ? (
                  <input type="number" autoFocus style={{
                    ...s.mono, background: C.card2, border: `1px solid ${C.accent}`, borderRadius: 4,
                    padding: "2px 4px", color: C.muted, width: "100%", boxSizing: "border-box", textAlign: "right", outline: "none", fontSize: 11,
                  }}
                    value={usdValue}
                    onChange={e => {
                      const usdTyped = Number(e.target.value || 0);
                      const cadEquiv = usdTyped * (rates.USDCAD || 1.37);
                      updateItemValue(item.id, cadEquiv.toFixed(2));
                    }}
                    onBlur={() => setEditingUsdId(null)}
                    onKeyDown={e => { if (e.key === "Enter") setEditingUsdId(null); }} />
                ) : (
                  <span style={{ ...s.mono, fontSize: 11, color: C.muted, padding: "2px 0", display: "inline-block" }}
                    onMouseEnter={e => { if (!hide) e.target.style.borderBottom = `1px dashed ${C.muted}44`; }}
                    onMouseLeave={e => { e.target.style.borderBottom = "none"; }}>
                    {hide ? "•••••" : "$" + usdValue.toLocaleString()}
                  </span>
                )
              ) : ""}
            </td>
          )}
        </tr>
      );
    });
  };

  /* render bucket section — side-by-side grid */
  const renderBucket = (bucketName) => {
    if (!activeSnap) return null;
    const items = activeSnap.items.filter(i => i.bucket === bucketName);
    const assets = items.filter(i => !i.isLiability);
    const liabilities = items.filter(i => i.isLiability);
    const assetTotal = assets.reduce((s, i) => s + Number(i.value || 0), 0);
    const liabTotal = liabilities.reduce((s, i) => s + Number(i.value || 0), 0);
    const netTotal = assetTotal - liabTotal;
    const hasUSD = items.some(i => i.currency === "USD");
    const colCount = hasUSD ? 3 : 2;

    return (
      <div key={bucketName} style={{ ...s.card, padding: "12px 16px", borderLeft: `3px solid ${BUCKET_COLORS[bucketName]}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: BUCKET_COLORS[bucketName] }}>{settings.bucketNames[bucketName] || bucketName}</span>
          <span style={{ ...s.mono, fontWeight: 700, fontSize: 14, color: netTotal >= 0 ? C.green : C.red }}>{hide ? "•••••" : fmtFull(netTotal)}</span>
        </div>
        <div className="mc-table-wrap"><table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col />
            <col style={{ width: 110 }} />
            {hasUSD && <col style={{ width: 85 }} />}
          </colgroup>
          <thead>
            <tr>
              <th style={{ fontSize: 10, color: C.muted, fontWeight: 500, textAlign: "left", padding: "2px 0", borderBottom: `1px solid ${C.border}33` }}></th>
              <th style={{ fontSize: 10, color: C.muted, fontWeight: 500, textAlign: "right", padding: "2px 0", borderBottom: `1px solid ${C.border}33` }}>CAD</th>
              {hasUSD && <th style={{ fontSize: 10, color: C.muted, fontWeight: 500, textAlign: "right", padding: "2px 0", borderBottom: `1px solid ${C.border}33` }}>USD</th>}
            </tr>
          </thead>
          <tbody>
            {renderItems(assets, false, hasUSD)}
            {liabilities.length > 0 && (
              <tr><td colSpan={colCount} style={{ padding: "6px 0 2px", borderTop: `1px dashed ${C.red}33` }}>
                <span style={{ fontSize: 10, color: C.red, textTransform: "uppercase", letterSpacing: 0.5 }}>Liabilities</span>
              </td></tr>
            )}
            {renderItems(liabilities, true, hasUSD)}
          </tbody>
        </table></div>
      </div>
    );
  };

  /* month-over-month comparison */
  const renderComparison = () => {
    if (!activeSnap || !prevSnap) return null;
    const allNames = [...new Set([...activeSnap.items.map(i => i.bucket + "|" + i.name), ...prevSnap.items.map(i => i.bucket + "|" + i.name)])];
    const rows = allNames.map(key => {
      const [bucket, name] = key.split("|");
      const curr = activeSnap.items.find(i => i.bucket === bucket && i.name === name);
      const pre = prevSnap.items.find(i => i.bucket === bucket && i.name === name);
      const currVal = curr ? Number(curr.value || 0) * (curr.isLiability ? -1 : 1) : 0;
      const preVal = pre ? Number(pre.value || 0) * (pre.isLiability ? -1 : 1) : 0;
      const diff = currVal - preVal;
      return { bucket, name, currVal, preVal, diff, pctChange: preVal !== 0 ? diff / Math.abs(preVal) : (diff !== 0 ? 1 : 0) };
    }).filter(r => r.diff !== 0).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    if (rows.length === 0) return null;

    return (
      <div style={s.card}>
        <h3 style={s.h3}>Month-over-Month Changes: {monthLabel(activeMonth)} vs {monthLabel(prevMonth)}</h3>
        <div className="mc-table-wrap" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={s.th}>Bucket</th><th style={s.th}>Item</th>
                <th style={{ ...s.th, textAlign: "right" }}>{monthLabel(prevMonth)}</th>
                <th style={{ ...s.th, textAlign: "right" }}>{monthLabel(activeMonth)}</th>
                <th style={{ ...s.th, textAlign: "right" }}>Change</th>
                <th style={{ ...s.th, textAlign: "right" }}>%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={s.td}><span style={s.badge(BUCKET_COLORS[r.bucket])}>{r.bucket}</span></td>
                  <td style={s.td}>{r.name}</td>
                  <td style={{ ...s.td, ...s.mono, textAlign: "right" }}>{fmtFull(r.preVal)}</td>
                  <td style={{ ...s.td, ...s.mono, textAlign: "right" }}>{fmtFull(r.currVal)}</td>
                  <td style={{ ...s.td, ...s.mono, textAlign: "right", color: r.diff >= 0 ? C.green : C.red }}>{r.diff >= 0 ? "+" : ""}{fmtFull(r.diff)}</td>
                  <td style={{ ...s.td, ...s.mono, textAlign: "right", color: r.diff >= 0 ? C.green : C.red }}>{r.diff >= 0 ? "+" : ""}{(r.pctChange * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Status bar: unsaved indicator + upload + save */}
      {isCurrentMonth && !isSaved && activeSnap && !unsavedBannerDismissed && (
        <div style={{ background: C.accent + "18", border: `1px solid ${C.accent}44`, borderRadius: 8, padding: "6px 10px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ color: C.text, flex: 1 }}>Unsaved — update values below then save.</span>
          <label style={{ ...s.btnSm, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", fontSize: 11 }}>
            Upload
            <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={e => {
              const f = e.target.files[0]; if (!f) return;
              const r = new FileReader();
              r.onload = (ev) => {
                try {
                  if (f.name.endsWith(".csv")) { importFromParsedData(parseCSV(ev.target.result), activeMonth); }
                  else { importFromExcelBinary(ev.target.result, activeMonth); }
                } catch (err) { console.error("Import error:", err); }
              };
              if (f.name.endsWith(".csv")) r.readAsText(f); else r.readAsArrayBuffer(f);
            }} />
          </label>
          <button style={{ ...s.btn, padding: "4px 14px", fontSize: 12 }} onClick={saveMonth}>Save</button>
          <button onClick={() => setUnsavedBannerDismissed(true)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* Upload option for already-saved months */}
      {activeSnap && isSaved && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
          <label style={{ ...s.btnSm, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
            Upload Excel to update
            <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={e => {
              const f = e.target.files[0]; if (!f) return;
              const r = new FileReader();
              r.onload = (ev) => {
                try {
                  if (f.name.endsWith(".csv")) { importFromParsedData(parseCSV(ev.target.result), activeMonth); }
                  else { importFromExcelBinary(ev.target.result, activeMonth); }
                } catch (err) { console.error("Import error:", err); }
              };
              if (f.name.endsWith(".csv")) r.readAsText(f); else r.readAsArrayBuffer(f);
            }} />
          </label>
          <span style={{ fontSize: 12, color: C.green }}>Saved</span>
        </div>
      )}

      {/* Month selector + actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {(() => {
            const allMonths = [...new Set([currentMonthKey, ...sortedMonths])].sort().reverse();
            const idx = allMonths.indexOf(activeMonth);
            return (<>
              <button onClick={() => { if (idx < allMonths.length - 1) setSelectedMonth(allMonths[idx + 1]); }}
                disabled={idx >= allMonths.length - 1}
                style={{ background: "transparent", border: `1px solid ${C.border}`, color: idx < allMonths.length - 1 ? C.muted : C.card2, borderRadius: 6, padding: "6px 10px", cursor: idx < allMonths.length - 1 ? "pointer" : "default", fontSize: 16 }}>←</button>
              <span style={{ fontSize: 18, fontWeight: 700, color: C.text, minWidth: 120, textAlign: "center" }}>
                {monthLabel(activeMonth)}
                {!activeSnap && <span style={{ fontSize: 11, color: C.orange, display: "block", fontWeight: 400 }}>not entered yet</span>}
              </span>
              <button onClick={() => { if (idx > 0) setSelectedMonth(allMonths[idx - 1]); }}
                disabled={idx <= 0}
                style={{ background: "transparent", border: `1px solid ${C.border}`, color: idx > 0 ? C.muted : C.card2, borderRadius: 6, padding: "6px 10px", cursor: idx > 0 ? "pointer" : "default", fontSize: 16 }}>→</button>
            </>);
          })()}
        </div>
        {/* Add a past month if needed */}
        <button style={s.btnSm} onClick={() => {
          const mk = prompt("Enter month (YYYY-MM):", activeMonth);
          if (mk && /^\d{4}-\d{2}$/.test(mk)) addNewMonth(mk);
        }}>+ Add past month</button>
      </div>

      {/* Summary cards */}
      <div className="mc-stat-row" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Gross Net Worth" value={mask(fmt(current.grossTotal), hide)} sub={mask(fmtFull(current.grossTotal), hide)} C={C} />
        <StatCard label="Total Tax & Owed" value={mask(fmt(current.totalDeductions), hide)} sub={mask(fmtFull(current.totalDeductions), hide)} color={C.orange} C={C} />
        <StatCard label="Adjusted Net Worth" value={mask(fmt(current.total) + " – " + fmt(current.totalHigh), hide)} sub={mask(fmtFull(current.total) + " – " + fmtFull(current.totalHigh), hide)} color={current.total >= 0 ? C.green : C.red} C={C} />
        <StatCard label="Monthly Change" value={mask((nwChange >= 0 ? "+" : "") + fmt(nwChange), hide)} sub={mask((nwChangePct >= 0 ? "+" : "") + (nwChangePct * 100).toFixed(1) + "% from " + monthLabel(prevMonth), hide)} color={nwChange >= 0 ? C.green : C.red} C={C} />
      </div>

      {/* Bucket breakdowns — 2-column grid */}
      <div className="mc-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {BUCKETS.map(b => renderBucket(b))}
      </div>

      {/* Summary panel */}
      <div style={{ ...s.card, background: C.bg2, border: `2px solid ${C.accent}33` }}>
        <h3 style={s.h3}>Net Worth Summary</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 24px", fontSize: 14 }}>
          <span style={{ color: C.muted }}>Total Corp Assets (Opco + Holdco)</span>
          <span style={{ ...s.mono, textAlign: "right" }}>{mask(fmtFull(current.corpTotal), hide)}</span>
          <span style={{ color: C.muted }}>Total Personal (Jon + Jacqueline)</span>
          <span style={{ ...s.mono, textAlign: "right" }}>{mask(fmtFull(current.personalTotal), hide)}</span>
          <span style={{ fontWeight: 600, color: C.text }}>Gross Net Worth</span>
          <span style={{ ...s.mono, textAlign: "right", fontWeight: 600 }}>{mask(fmtFull(current.grossTotal), hide)}</span>
          <div style={{ borderBottom: `1px solid ${C.border}`, gridColumn: "1 / -1", margin: "4px 0" }} />
          <span style={{ fontSize: 11, color: C.orange, textTransform: "uppercase", letterSpacing: 0.5, gridColumn: "1 / -1" }}>Step 1: Deductions from Corp</span>
          {(activeSnap?.deductions || []).map(d => (
            <React.Fragment key={d.id}>
              <span style={{ color: C.orange, display: "flex", alignItems: "center", gap: 6 }}>
                − {d.label}
                <button onClick={() => removeDeduction(d.id)} style={{ background: "transparent", border: "none", color: C.red, cursor: "pointer", fontSize: 10, padding: 0 }}>✕</button>
              </span>
              <span style={{ ...s.mono, textAlign: "right", color: C.orange, cursor: "text" }}
                onClick={() => {
                  const v = prompt(`${d.label} — amount:`, d.value);
                  if (v !== null) updateDeduction(d.id, v);
                }}>
                {hide ? "•••••" : "-" + fmtFull(d.value)}
              </span>
            </React.Fragment>
          ))}
          <span style={{ color: C.muted, cursor: "pointer", fontSize: 12 }} onClick={addDeduction}>+ Add deduction</span>
          <span />
          <span style={{ color: C.orange, fontWeight: 600 }}>Corp After Deductions</span>
          <span style={{ ...s.mono, textAlign: "right", color: C.orange, fontWeight: 600 }}>{mask(fmtFull(current.corpAfterDeductions), hide)}</span>
          <div style={{ borderBottom: `1px dashed ${C.border}`, gridColumn: "1 / -1", margin: "4px 0" }} />
          <span style={{ fontSize: 11, color: C.red, textTransform: "uppercase", letterSpacing: 0.5, gridColumn: "1 / -1" }}>Step 2: Tax Haircut (Low vs High)</span>

          {/* --- Two-column Low / High comparison --- */}
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "4px 0" }}>
            {/* LOW */}
            <div style={{ background: `${C.red}11`, borderRadius: 8, padding: 12, border: `1px solid ${C.red}33` }}>
              <div style={{ fontSize: 11, color: C.red, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, fontWeight: 600 }}>Low (Conservative)</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>Tax: {settings.taxRateIneligible}% on {mask(fmt(current.corpForHaircut), hide)}</div>
              <div style={{ ...s.mono, fontSize: 13, color: C.red }}>−{mask(fmtFull(current.taxHaircut), hide)}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Corp after tax</div>
              <div style={{ ...s.mono, fontSize: 13, fontWeight: 600 }}>{mask(fmtFull(current.afterTaxCorp), hide)}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>+ Personal</div>
              <div style={{ ...s.mono, fontSize: 13 }}>{mask(fmtFull(current.personalTotal), hide)}</div>
              <div style={{ borderTop: `1px solid ${C.red}44`, marginTop: 8, paddingTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Adjusted NW</div>
                <div style={{ ...s.mono, fontSize: 18, fontWeight: 700, color: current.total >= 0 ? C.green : C.red }}>{mask(fmtFull(current.total), hide)}</div>
              </div>
            </div>
            {/* HIGH */}
            <div style={{ background: `${C.green}11`, borderRadius: 8, padding: 12, border: `1px solid ${C.green}33` }}>
              <div style={{ fontSize: 11, color: C.green, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, fontWeight: 600 }}>High (Optimistic)</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>Tax: {settings.highTaxRate || 20}% on {mask(fmt(current.corpForHaircut), hide)}</div>
              <div style={{ ...s.mono, fontSize: 13, color: C.green }}>−{mask(fmtFull(current.taxHaircutHigh), hide)}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Corp after tax</div>
              <div style={{ ...s.mono, fontSize: 13, fontWeight: 600 }}>{mask(fmtFull(current.afterTaxCorpHigh), hide)}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>+ Personal</div>
              <div style={{ ...s.mono, fontSize: 13 }}>{mask(fmtFull(current.personalTotal), hide)}</div>
              <div style={{ borderTop: `1px solid ${C.green}44`, marginTop: 8, paddingTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Adjusted NW</div>
                <div style={{ ...s.mono, fontSize: 18, fontWeight: 700, color: C.green }}>{mask(fmtFull(current.totalHigh), hide)}</div>
              </div>
            </div>
          </div>

          <div style={{ borderBottom: `2px solid ${C.accent}`, gridColumn: "1 / -1", margin: "4px 0" }} />
          <span style={{ fontWeight: 700, fontSize: 16, color: C.text }}>Adjusted Net Worth Range</span>
          <span style={{ ...s.mono, textAlign: "right", fontWeight: 700, fontSize: 16, color: current.total >= 0 ? C.green : C.red }}>{mask(fmtFull(current.total) + " – " + fmtFull(current.totalHigh), hide)}</span>
        </div>
        {activeSnap?.notes && <div style={{ marginTop: 12, fontSize: 13, color: C.muted, fontStyle: "italic" }}>{activeSnap.notes}</div>}
        <div style={{ marginTop: 8 }}>
          <input style={{ ...s.input, fontSize: 12 }} placeholder="Notes (e.g. house valued at 2.7M assumption...)"
            value={activeSnap?.notes || ""} onChange={e => saveNotes(e.target.value)} />
        </div>
      </div>

      {/* Trend chart */}
      {trendData.length > 1 && (
        <div style={s.card}>
          <h3 style={s.h3}>Net Worth Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.green} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.card2} />
              <XAxis dataKey="month" stroke={C.muted} fontSize={12} />
              <YAxis stroke={C.muted} fontSize={12} tickFormatter={v => fmt(v)} />
              <Tooltip content={<ChartTooltip C={C} />} />
              <Area type="monotone" dataKey="netWorthHigh" stroke={C.cyan} fill={`${C.cyan}15`} strokeWidth={1} strokeDasharray="4 3" name="High (Optimistic)" />
              <Area type="monotone" dataKey="netWorth" stroke={C.green} fill="url(#nwGrad)" strokeWidth={2} name="Low (Conservative)" />
              <Line type="monotone" dataKey="gross" stroke={C.accent} strokeWidth={1.5} dot={false} name="Gross NW" />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Month comparison */}
      {renderComparison()}

      {/* Add item form */}
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ ...s.h3, margin: 0 }}>Add Item to {monthLabel(activeMonth)}</h3>
        </div>
        <CSVUpload onImport={(rows) => {
          if (!activeSnap) return;
          const mapped = rows.map(r => ({
            id: uid(), bucket: r.bucket || "Opco", name: r.name || "Imported",
            currency: (r.currency || "CAD").toUpperCase(), value: parseFloat(r.value || r.amount || 0),
            isLiability: (r.type || r.is_liability || "").toLowerCase().includes("liab"),
          })).filter(r => !isNaN(r.value));
          const updated = snaps.map(sn => sn.month === activeMonth ? { ...sn, items: [...sn.items, ...mapped] } : sn);
          setData({ ...data, snapshots: updated });
        }} templateCols={["bucket", "name", "currency", "value", "type(asset/liability)"]} label="Net Worth Items" s={s} C={C} />
        <div style={{ ...s.row, gap: 8 }}>
          <select style={s.select} value={newItem.bucket} onChange={e => setNewItem({ ...newItem, bucket: e.target.value })}>
            {BUCKETS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <input style={{ ...s.input, width: 180 }} placeholder="Name" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
          <select style={s.select} value={newItem.currency} onChange={e => setNewItem({ ...newItem, currency: e.target.value })}>
            <option value="CAD">CAD</option><option value="USD">USD</option><option value="GBP">GBP</option>
          </select>
          <input style={{ ...s.input, width: 130 }} placeholder="Value" type="number" value={newItem.value} onChange={e => setNewItem({ ...newItem, value: e.target.value })} />
          <label style={{ fontSize: 13, color: C.muted, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={newItem.isLiability} onChange={e => setNewItem({ ...newItem, isLiability: e.target.checked })} /> Liability
          </label>
          <button style={s.btn} onClick={addItem}>Add</button>
        </div>
      </div>

      {/* Monthly journal */}
      <div style={s.card}>
        <h3 style={s.h3}>Monthly Journal — {monthLabel(activeMonth)}</h3>
        <textarea style={{ ...s.input, minHeight: 80, resize: "vertical", fontFamily: "inherit" }}
          value={activeSnap?.journal || ""} onChange={e => saveJournal(e.target.value)}
          placeholder="Write notes about this month's finances..." />
      </div>

      {/* Goals */}
      {data.goals?.length > 0 && (
        <div style={s.card}>
          <h3 style={s.h3}>Milestones</h3>
          {data.goals.map(g => {
            const pctDone = Math.min(1, current.total / g.target);
            return (
              <div key={g.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: C.text }}>{g.name}</span>
                  <span style={{ color: C.muted }}>{fmtFull(current.total)} / {fmtFull(g.target)}</span>
                </div>
                <div style={{ background: C.card2, borderRadius: 8, height: 12, overflow: "hidden" }}>
                  <div style={{ background: pctDone >= 1 ? C.green : C.accent, height: "100%", width: pct(pctDone), borderRadius: 8, transition: "width 0.5s" }} />
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{(pctDone * 100).toFixed(1)}% complete</div>
              </div>
            );
          })}
        </div>
      )}

      {/* FX rates display */}
      <div style={{ ...s.card, display: "flex", gap: 24 }}>
        <div style={{ fontSize: 13, color: C.muted }}>USD/CAD: <strong style={{ color: C.text }}>{rates.USDCAD?.toFixed(4) || "1.3700"}</strong></div>
        <div style={{ fontSize: 13, color: C.muted }}>GBP/CAD: <strong style={{ color: C.text }}>{rates.GBPCAD?.toFixed(4) || "1.7200"}</strong></div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB 2 — PORTFOLIO
   ═══════════════════════════════════════════════════════════ */
function PortfolioTab({ data, setData, settings, rates, theme, hide }) {
  const C = themes[theme]; const s = S(theme);
  const [filterBucket, setFilterBucket] = useState("All");
  const [filterTag, setFilterTag] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [expandedClass, setExpandedClass] = useState(null);
  const [newHolding, setNewHolding] = useState({ name: "", ticker: "", bucket: "Holdco", account: "IB", type: "Stocks", currency: "USD", costPerUnit: "", qty: "", currentPrice: "", totalValue: "", entryMode: "lots", tags: "", targetType: "", targetValue: "", alertAbove: "", alertBelow: "", alertPctUp: "", alertPctDown: "" });
  const { sortKey, sortDir, onSort, sortFn } = useSortable("value", "desc");
  const [expandedAccounts, setExpandedAccounts] = useState({});
  const [expandedTickers, setExpandedTickers] = useState({});
  const toggleExpand = (key, setter) => setter(prev => ({ ...prev, [key]: !prev[key] }));

  const holdings = data.holdings || [];
  const allTags = [...new Set(holdings.flatMap(h => h.tags || []))].sort();
  const allAccounts = [...new Set(holdings.map(h => h.account || "Uncategorized"))].sort();

  /* ── Strategy & Psychology state ── */
  const ASSET_CLASSES = ["Stock", "ETF", "Bond", "Fund", "Crypto", "Precious Metal", "Cash", "Other"];
  const defaultModerate = { Stock: 18, ETF: 22, Bond: 22, Fund: 10, Crypto: 3, "Precious Metal": 10, Cash: 10, Other: 5 };
  const defaultAggressive = { Stock: 25, ETF: 28, Bond: 12, Fund: 7, Crypto: 5, "Precious Metal": 10, Cash: 8, Other: 5 };
  const strategy = data.strategy || { targetModerate: defaultModerate, targetAggressive: defaultAggressive, dcaMonthly: 15000, dcaMonths: 12, dcaStartDate: new Date().toISOString().slice(0, 10), dipTriggers: [{ pctDrop: 5, extraAmount: 5000 }, { pctDrop: 10, extraAmount: 10000 }, { pctDrop: 15, extraAmount: 20000 }], holdRules: ["I will not sell during a downturn unless I need the cash within 12 months.", "A 10% drop is normal — it happens almost every year. I will buy more, not sell.", "I trust my allocation. I don't need to check prices every day.", "Time in the market beats timing the market. I am investing for 20+ years."], deploymentLog: [] };
  const updateStrategy = (updates) => setData({ ...data, strategy: { ...strategy, ...updates } });
  const [newRule, setNewRule] = useState("");
  const [showStrategyEdit, setShowStrategyEdit] = useState(false);
  const [priceRefreshing, setPriceRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const refreshPrices = async () => {
    setPriceRefreshing(true);
    const tickers = holdings.filter(h => h.ticker && h.ticker !== "CASH").map(h => h.ticker);
    if (tickers.length === 0) { setPriceRefreshing(false); return; }
    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers.join(",")}&fields=regularMarketPrice,shortName`;
      const resp = await fetch(url);
      const json = await resp.json();
      const quotes = json?.quoteResponse?.result || [];
      const priceMap = {};
      quotes.forEach(q => { priceMap[q.symbol] = q.regularMarketPrice; });
      const updatedHoldings = holdings.map(h => {
        if (h.ticker && priceMap[h.ticker] !== undefined) {
          return { ...h, lots: h.lots.map(l => ({ ...l, currentPrice: priceMap[h.ticker] })) };
        }
        return h;
      });
      setData({ ...data, holdings: updatedHoldings });
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Price refresh failed:", err);
      alert("Auto-refresh failed — click any price to update manually.");
    }
    setPriceRefreshing(false);
  };

  const updateHoldingPrice = (holdingId, newPrice) => {
    const updatedHoldings = holdings.map(h =>
      h.id === holdingId ? { ...h, lots: h.lots.map(l => ({ ...l, currentPrice: parseFloat(newPrice) || 0 })) } : h
    );
    setData({ ...data, holdings: updatedHoldings });
  };

  const [editingPriceId, setEditingPriceId] = useState(null);

  /* Normalize legacy plural type names to current singular ASSET_CLASSES */
  const TYPE_ALIAS = { Stocks: "Stock", ETFs: "ETF", Bonds: "Bond", Funds: "Fund", "Precious Metals": "Precious Metal", Retirement: "Fund" };
  const normType = (t) => TYPE_ALIAS[t] || t;

  const enriched = useMemo(() => {
    return holdings.map(h => {
      const type = normType(h.type);
      const lots = h.lots || [];
      const totalQty = lots.reduce((s, l) => s + l.qty, 0);
      const totalCost = lots.reduce((s, l) => s + l.qty * l.costPerUnit, 0);
      const currentPrice = lots[0]?.currentPrice || 0;
      const currentValue = totalQty * currentPrice;
      const gain = currentValue - totalCost;
      const gainPct = totalCost > 0 ? gain / totalCost : 0;
      const valueCAD = toBase(currentValue, h.currency, rates);
      return { ...h, type, totalQty, totalCost, currentPrice, currentValue, gain, gainPct, valueCAD };
    });
  }, [holdings, rates]);

  const filtered = enriched.filter(h => (filterBucket === "All" || h.bucket === filterBucket) && (filterTag === "All" || (h.tags || []).includes(filterTag)));
  const sorted = sortFn(filtered.map(h => ({ ...h, value: h.valueCAD })));
  const totalValueCAD = filtered.reduce((s, h) => s + h.valueCAD, 0);
  const totalCostCAD = filtered.reduce((s, h) => s + toBase(h.totalCost, h.currency, rates), 0);
  const totalGain = totalValueCAD - totalCostCAD;

  /* allocation by type — use enriched (all holdings) so pie + bars always match */
  const byType = useMemo(() => {
    const map = {};
    enriched.forEach(h => { map[h.type] = (map[h.type] || 0) + h.valueCAD; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [enriched]);

  /* target vs actual */
  const targetData = useMemo(() => {
    return filtered.filter(h => h.targetType && h.targetValue).map(h => {
      let targetCAD = 0, actualCAD = h.valueCAD, diff = 0;
      if (h.targetType === "dollars") { targetCAD = toBase(h.targetValue, h.currency, rates); diff = targetCAD - actualCAD; }
      else if (h.targetType === "percentage") { targetCAD = totalValueCAD * (h.targetValue / 100); diff = targetCAD - actualCAD; }
      else if (h.targetType === "shares") { targetCAD = h.targetValue * h.currentPrice; diff = targetCAD - actualCAD; }
      return { name: h.name, actual: actualCAD, target: targetCAD, diff, action: diff > 0 ? "Buy" : "Sell" };
    }).filter(t => Math.abs(t.diff) > 1);
  }, [filtered, totalValueCAD, rates]);

  /* price alerts */
  const alerts = useMemo(() => {
    return enriched.filter(h => {
      if (h.alertAbove && h.currentPrice >= h.alertAbove) return true;
      if (h.alertBelow && h.currentPrice <= h.alertBelow) return true;
      if (h.alertPctUp && h.gainPct >= h.alertPctUp / 100) return true;
      if (h.alertPctDown && h.gainPct <= -(h.alertPctDown / 100)) return true;
      return false;
    }).map(h => {
      let reason = "";
      if (h.alertAbove && h.currentPrice >= h.alertAbove) reason = `Price above ${fmtFull(h.alertAbove, h.currency)} → Sell signal`;
      else if (h.alertBelow && h.currentPrice <= h.alertBelow) reason = `Price below ${fmtFull(h.alertBelow, h.currency)} → Buy signal`;
      else if (h.alertPctUp && h.gainPct >= h.alertPctUp / 100) reason = `Up ${(h.gainPct*100).toFixed(1)}% → Sell signal`;
      else if (h.alertPctDown && h.gainPct <= -(h.alertPctDown / 100)) reason = `Down ${(h.gainPct*100).toFixed(1)}% → Buy signal`;
      return { ...h, reason };
    });
  }, [enriched]);

  const addHolding = () => {
    const h = newHolding;
    if (!h.name) return;
    const holding = {
      id: uid(), name: h.name, ticker: h.ticker, bucket: h.bucket, account: h.account || "Uncategorized", type: h.type, currency: h.currency,
      lots: h.entryMode === "lots" ? [{ id: uid(), date: new Date().toISOString().slice(0, 10), qty: parseFloat(h.qty) || 1, costPerUnit: parseFloat(h.costPerUnit) || 0, currentPrice: parseFloat(h.currentPrice) || 0 }] : [{ id: uid(), date: new Date().toISOString().slice(0, 10), qty: 1, costPerUnit: parseFloat(h.totalValue) || 0, currentPrice: parseFloat(h.totalValue) || 0 }],
      tags: h.tags ? h.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      targetType: h.targetType || null, targetValue: h.targetValue ? parseFloat(h.targetValue) : null,
      alertAbove: h.alertAbove ? parseFloat(h.alertAbove) : null, alertBelow: h.alertBelow ? parseFloat(h.alertBelow) : null,
      alertPctUp: h.alertPctUp ? parseFloat(h.alertPctUp) : null, alertPctDown: h.alertPctDown ? parseFloat(h.alertPctDown) : null,
    };
    setData({ ...data, holdings: [...holdings, holding] });
    setNewHolding({ name: "", ticker: "", bucket: "Holdco", account: "IB", type: "Stocks", currency: "USD", costPerUnit: "", qty: "", currentPrice: "", totalValue: "", entryMode: "lots", tags: "", targetType: "", targetValue: "", alertAbove: "", alertBelow: "", alertPctUp: "", alertPctDown: "" });
  };

  const removeHolding = (id) => setData({ ...data, holdings: holdings.filter(h => h.id !== id) });

  /* ── Allocation data for inline display (dual targets) ── */
  const modAlloc = strategy.targetModerate || defaultModerate;
  const aggAlloc = strategy.targetAggressive || defaultAggressive;
  const totalVal = enriched.reduce((s2, h) => s2 + h.valueCAD, 0);
  const actualByType = {};
  enriched.forEach(h => { actualByType[h.type] = (actualByType[h.type] || 0) + h.valueCAD; });
  const allocRows = ASSET_CLASSES.filter(ac => (modAlloc[ac] || 0) > 0 || (aggAlloc[ac] || 0) > 0 || (actualByType[ac] || 0) > 0).map(ac => {
    const modPct = modAlloc[ac] || 0;
    const aggPct = aggAlloc[ac] || 0;
    const actualVal = actualByType[ac] || 0;
    const actualPct = totalVal > 0 ? (actualVal / totalVal) * 100 : 0;
    const midTarget = (modPct + aggPct) / 2;
    const drift = actualPct - midTarget;
    const targetVal = totalVal * (midTarget / 100);
    const diff = actualVal - targetVal;
    return { name: ac, modPct, aggPct, actualPct, actualVal, targetVal, drift, diff };
  });
  const actionItems = allocRows.filter(r => {
    const inRange = r.actualPct >= Math.min(r.modPct, r.aggPct) && r.actualPct <= Math.max(r.modPct, r.aggPct);
    return !inRange && Math.abs(r.diff) > 500;
  }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  /* ── Account grouping ── */
  const accountGroups = {};
  sorted.forEach(h => { const acct = h.account || "Uncategorized"; if (!accountGroups[acct]) accountGroups[acct] = []; accountGroups[acct].push(h); });
  const sortedAccounts = Object.entries(accountGroups).sort((a, b) => b[1].reduce((s2, h) => s2 + h.valueCAD, 0) - a[1].reduce((s2, h) => s2 + h.valueCAD, 0));

  return (
    <div>
      {/* ═══ ROW 1: Stats + Actions ═══ */}
      <div className="mc-stat-row" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Portfolio Value" value={mask(fmt(totalValueCAD), hide)} sub={mask(fmtFull(totalValueCAD), hide)} color={C.accent} C={C} />
        <StatCard label="Total Gain/Loss" value={mask((totalGain >= 0 ? "+" : "") + fmt(totalGain), hide)} sub={mask(totalCostCAD > 0 ? (totalGain >= 0 ? "+" : "") + (totalGain / totalCostCAD * 100).toFixed(1) + "%" : "", hide)} color={totalGain >= 0 ? C.green : C.red} C={C} />
        <StatCard label="Holdings" value={enriched.length} sub={allAccounts.length + " accounts"} C={C} />
      </div>

      {/* ═══ ROW 2: Allocation ═══ */}
      <div style={{ ...s.card, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ ...s.h3, margin: 0 }}>Allocation</h3>
          <button style={s.btnSm} onClick={() => setShowStrategyEdit(!showStrategyEdit)}>{showStrategyEdit ? "Done" : "Edit Targets"}</button>
        </div>
        {showStrategyEdit && (
          <div style={{ marginBottom: 16, padding: 12, background: C.card2, borderRadius: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "110px repeat(2, 1fr)", gap: 4, marginBottom: 8 }}>
              <span />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, textAlign: "center" }}>Moderate %</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.orange, textAlign: "center" }}>Aggressive %</span>
            </div>
            {ASSET_CLASSES.map(ac => (
              <div key={ac} style={{ display: "grid", gridTemplateColumns: "110px repeat(2, 1fr)", gap: 4, marginBottom: 4, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: C.text }}>{ac}</span>
                <input type="number" style={{ ...s.input, textAlign: "center", padding: "4px 6px", fontSize: 13 }} value={modAlloc[ac] || 0}
                  onChange={e => updateStrategy({ targetModerate: { ...modAlloc, [ac]: parseFloat(e.target.value) || 0 } })} />
                <input type="number" style={{ ...s.input, textAlign: "center", padding: "4px 6px", fontSize: 13 }} value={aggAlloc[ac] || 0}
                  onChange={e => updateStrategy({ targetAggressive: { ...aggAlloc, [ac]: parseFloat(e.target.value) || 0 } })} />
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "110px repeat(2, 1fr)", gap: 4, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>Total</span>
              <span style={{ fontSize: 13, fontWeight: 700, textAlign: "center", color: Object.values(modAlloc).reduce((s2, v) => s2 + v, 0) === 100 ? C.green : C.red }}>
                {Object.values(modAlloc).reduce((s2, v) => s2 + v, 0)}%
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, textAlign: "center", color: Object.values(aggAlloc).reduce((s2, v) => s2 + v, 0) === 100 ? C.green : C.red }}>
                {Object.values(aggAlloc).reduce((s2, v) => s2 + v, 0)}%
              </span>
            </div>
          </div>
        )}
        {/* Pie chart with label lines */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <ResponsiveContainer width="100%" height={360}>
            <PieChart margin={{ top: 30, right: 80, bottom: 30, left: 80 }}>
              <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={42} paddingAngle={2} strokeWidth={0}
                label={({ cx: pcx, cy: pcy, midAngle, outerRadius: or, name, percent }) => {
                  const RADIAN = Math.PI / 180;
                  const r = or + 40;
                  const x = pcx + r * Math.cos(-midAngle * RADIAN);
                  const y = pcy + r * Math.sin(-midAngle * RADIAN);
                  return (
                    <text x={x} y={y} textAnchor={x > pcx ? "start" : "end"} fill={C.text} fontSize={12} dominantBaseline="central">
                      {name} {(percent * 100).toFixed(percent < 0.01 ? 1 : 0)}%
                    </text>
                  );
                }}
                labelLine={{ stroke: C.muted, strokeWidth: 1 }}
              >
                {byType.map((entry, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => mask(fmtFull(v), hide)} contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Clean 5-column table */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
              <th style={{ ...s.th, textAlign: "left", padding: "8px 0" }}>Class</th>
              <th style={{ ...s.th, textAlign: "right", padding: "8px 0" }}>Actual %</th>
              <th style={{ ...s.th, textAlign: "right", padding: "8px 0" }}>Actual $</th>
              <th style={{ ...s.th, textAlign: "right", padding: "8px 0" }}>Target %</th>
              <th style={{ ...s.th, textAlign: "right", padding: "8px 0" }}>Target $</th>
            </tr>
          </thead>
          <tbody>
            {allocRows.map((r, i) => {
              const inRange = r.actualPct >= Math.min(r.modPct, r.aggPct) && r.actualPct <= Math.max(r.modPct, r.aggPct);
              const under = r.actualPct < Math.min(r.modPct, r.aggPct);
              const midTarget = (r.modPct + r.aggPct) / 2;
              const targetDollar = totalVal * (midTarget / 100);
              const isOpen = expandedClass === r.name;
              const classHoldings = enriched.filter(h => h.type === r.name).sort((a, b) => b.valueCAD - a.valueCAD);
              return (
                <React.Fragment key={r.name}>
                  <tr style={{ borderBottom: isOpen ? "none" : `1px solid ${C.border}22`, cursor: "pointer" }} onClick={() => setExpandedClass(isOpen ? null : r.name)}>
                    <td style={{ padding: "11px 0", fontSize: 14, fontWeight: 600, color: C.text }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>{isOpen ? "▼" : "▶"}</span>
                        {r.name}
                        <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>({classHoldings.length})</span>
                      </div>
                    </td>
                    <td style={{ padding: "11px 0", ...s.mono, fontSize: 14, textAlign: "right", fontWeight: 600, color: !inRange ? (under ? C.orange : C.red) : C.green }}>{r.actualPct.toFixed(1)}%</td>
                    <td style={{ padding: "11px 0", ...s.mono, fontSize: 14, textAlign: "right", color: C.text }}>{mask(fmt(r.actualVal), hide)}</td>
                    <td style={{ padding: "11px 0", ...s.mono, fontSize: 14, textAlign: "right", color: C.muted }}>{r.modPct === r.aggPct ? `${r.modPct}%` : `${r.modPct}–${r.aggPct}%`}</td>
                    <td style={{ padding: "11px 0", ...s.mono, fontSize: 14, textAlign: "right", color: C.muted }}>{mask(fmt(targetDollar), hide)}</td>
                  </tr>
                  {isOpen && classHoldings.map((h, j) => (
                    <tr key={h.id} style={{ background: j % 2 ? C.card2 + "22" : "transparent", borderBottom: j === classHoldings.length - 1 ? `1px solid ${C.border}44` : "none" }}>
                      <td style={{ padding: "6px 0 6px 36px", fontSize: 13, color: C.text }}>
                        <span style={{ fontWeight: 600 }}>{h.ticker && h.ticker !== "CASH" ? h.ticker : h.name}</span>
                        {h.ticker && h.ticker !== "CASH" && <span style={{ color: C.muted, fontSize: 11, marginLeft: 4 }}>{h.name}</span>}
                        <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 3, background: C.accent2 + "22", color: C.accent2 }}>{h.account}</span>
                      </td>
                      <td style={{ padding: "6px 0", ...s.mono, fontSize: 12, textAlign: "right", color: C.muted }}>{totalVal > 0 ? (h.valueCAD / totalVal * 100).toFixed(1) + "%" : "0%"}</td>
                      <td style={{ padding: "6px 0", ...s.mono, fontSize: 12, textAlign: "right", color: C.text }}>{mask(fmt(h.valueCAD), hide)}</td>
                      <td style={{ padding: "6px 0", ...s.mono, fontSize: 12, textAlign: "right", color: h.gainPct >= 0 ? C.green : C.red }}>{hide ? "•••" : (h.gainPct >= 0 ? "+" : "") + (h.gainPct * 100).toFixed(1) + "%"}</td>
                      <td style={{ padding: "6px 0", ...s.mono, fontSize: 11, textAlign: "right", color: C.muted }}>{h.currency !== "CAD" ? `${h.currency} ${fmtFull(h.currentValue)}` : ""}</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${C.border}` }}>
              <td style={{ padding: "11px 0", fontSize: 14, fontWeight: 700, color: C.text }}>Total</td>
              <td style={{ padding: "11px 0", ...s.mono, fontSize: 14, textAlign: "right", fontWeight: 700, color: C.text }}>100%</td>
              <td style={{ padding: "11px 0", ...s.mono, fontSize: 14, textAlign: "right", fontWeight: 700, color: C.accent }}>{mask(fmt(totalVal), hide)}</td>
              <td style={{ padding: "11px 0", ...s.mono, fontSize: 14, textAlign: "right", color: C.muted }}>100%</td>
              <td style={{ padding: "11px 0", ...s.mono, fontSize: 14, textAlign: "right", color: C.muted }}>{mask(fmt(totalVal), hide)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ═══ ROW 3: Top actions if any ═══ */}
      {actionItems.length > 0 && (
        <div className="mc-stat-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {actionItems.slice(0, 4).map(r => (
            <div key={r.name} style={{ flex: 1, minWidth: 160, padding: "10px 14px", borderRadius: 8, background: (r.diff > 0 ? C.red : C.green) + "15", border: `1px solid ${(r.diff > 0 ? C.red : C.green)}33` }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>{r.name}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: r.diff > 0 ? C.red : C.green }}>{r.diff > 0 ? "Sell" : "Buy"} {mask(fmt(Math.abs(r.diff)), hide)}</div>
              <div style={{ fontSize: 10, color: C.muted }}>{r.actualPct.toFixed(1)}% → {r.modPct}–{r.aggPct}%</div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ ROW 4: Holdings by Manager ═══ */}
      {(() => {
        const RBC_WM_ACCOUNTS = ["RBC Dominion"];
        const CASH_ACCOUNTS = ["Opco", "Holdco", "Jon Personal", "Jacqueline Personal"];
        const managerGroups = [
          { key: "self", label: "Self-Managed", emoji: "🎯", desc: "Your own picks", items: sorted.filter(h => !RBC_WM_ACCOUNTS.includes(h.account) && !CASH_ACCOUNTS.includes(h.account) && h.type !== "Other") },
          { key: "rbc", label: "RBC Wealth Management", emoji: "🏦", desc: "Advisor-managed", items: sorted.filter(h => RBC_WM_ACCOUNTS.includes(h.account)) },
          { key: "cash", label: "Cash & Savings", emoji: "💰", desc: "Bank accounts & reserves", items: sorted.filter(h => CASH_ACCOUNTS.includes(h.account) || (h.type === "Other")) },
        ].filter(g => g.items.length > 0);

        const renderHolding = (h, i) => (
          <div key={h.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 70px 24px", alignItems: "center", padding: "7px 14px", background: i % 2 ? C.card2 + "22" : "transparent", fontSize: 12, gap: 8 }}>
            <div>
              <span style={{ fontWeight: 600, color: C.text }}>{h.ticker && h.ticker !== "CASH" && h.ticker !== "CAR" && h.ticker !== "COINS" ? h.ticker : h.name}</span>
              {h.ticker && h.ticker !== "CASH" && h.ticker !== "CAR" && h.ticker !== "COINS" && <span style={{ color: C.muted, fontSize: 10, marginLeft: 4 }}>{h.name}</span>}
              <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 3, background: C.accent2 + "22", color: C.accent2 }}>{h.account}</span>
            </div>
            <div style={{ ...s.mono, textAlign: "right", cursor: "text", fontSize: 11 }} onClick={(e) => { e.stopPropagation(); setEditingPriceId(h.id); }}>
              {editingPriceId === h.id ? (
                <input type="number" autoFocus style={{ ...s.mono, background: C.card2, border: `1px solid ${C.accent}`, borderRadius: 3, padding: "1px 3px", color: C.text, width: 70, textAlign: "right", outline: "none", fontSize: 11 }}
                  value={h.currentPrice} onChange={e => updateHoldingPrice(h.id, e.target.value)}
                  onBlur={() => setEditingPriceId(null)} onKeyDown={e => { if (e.key === "Enter") setEditingPriceId(null); }} />
              ) : mask(fmt(h.currentPrice, h.currency), hide)}
            </div>
            <div style={{ ...s.mono, textAlign: "right", fontWeight: 600, fontSize: 11 }}>{mask(fmt(h.valueCAD), hide)}</div>
            <div style={{ ...s.mono, textAlign: "right", fontSize: 11, color: h.gainPct >= 0 ? C.green : C.red }}>{hide ? "•••" : (h.gainPct >= 0 ? "+" : "") + (h.gainPct * 100).toFixed(1) + "%"}</div>
            <button style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 10, padding: 0 }} onClick={() => removeHolding(h.id)}>✕</button>
          </div>
        );

        return managerGroups.map(group => {
          const groupVal = group.items.reduce((s2, h) => s2 + h.valueCAD, 0);
          /* Sub-group by account within each manager group */
          const subAccounts = {};
          group.items.forEach(h => { const a = h.account || "Other"; if (!subAccounts[a]) subAccounts[a] = []; subAccounts[a].push(h); });
          const sortedSubs = Object.entries(subAccounts).sort((a, b) => b[1].reduce((s2, h) => s2 + h.valueCAD, 0) - a[1].reduce((s2, h) => s2 + h.valueCAD, 0));

          return (
            <div key={group.key} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h3 style={{ ...s.h3, margin: 0, fontSize: 15 }}>{group.emoji} {group.label} <span style={{ fontSize: 12, fontWeight: 400, color: C.muted }}>— {group.desc}</span></h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ ...s.mono, fontSize: 14, fontWeight: 700, color: C.accent }}>{mask(fmt(groupVal), hide)}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{totalValueCAD > 0 ? (groupVal / totalValueCAD * 100).toFixed(0) + "%" : ""}</span>
                  {group.key === "self" && <button style={{ ...s.btnSm, fontSize: 11, padding: "4px 10px" }} onClick={refreshPrices} disabled={priceRefreshing}>{priceRefreshing ? "..." : "Refresh Prices"}</button>}
                </div>
              </div>
              {lastRefresh && group.key === "self" && <div style={{ fontSize: 10, color: C.green, marginBottom: 6 }}>Prices updated {lastRefresh}</div>}
              {sortedSubs.map(([acct, items]) => {
                const acctVal = items.reduce((s2, h) => s2 + h.valueCAD, 0);
                const isOpen = expandedAccounts[acct] !== false;
                return (
                  <div key={acct} style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 6, overflow: "hidden" }}>
                    <div onClick={() => toggleExpand(acct, setExpandedAccounts)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{isOpen ? "▼" : "▶"}</span>
                        <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{acct}</span>
                        <span style={{ fontSize: 10, color: C.muted }}>{items.length}</span>
                      </div>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ ...s.mono, fontSize: 13, fontWeight: 600 }}>{mask(fmt(acctVal), hide)}</span>
                        <span style={{ fontSize: 10, color: C.muted, minWidth: 40, textAlign: "right" }}>{totalValueCAD > 0 ? (acctVal / totalValueCAD * 100).toFixed(1) + "%" : ""}</span>
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ borderTop: `1px solid ${C.border}` }}>
                        {items.map((h, i) => renderHolding(h, i))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        });
      })()}

      {/* ══════════════════════════════════════════════════
         DEPLOYMENT PLAN (DCA + DIP TRIGGERS)
         ══════════════════════════════════════════════════ */}
      <div style={s.card}>
        <h3 style={s.h3}>Deployment Plan</h3>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Get your cash into the market with discipline — monthly DCA plus extra buys on dips.</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ ...s.muted, display: "block", marginBottom: 4 }}>Monthly Amount (CAD)</label>
            <input style={s.input} type="number" value={strategy.dcaMonthly || 15000}
              onChange={e => updateStrategy({ dcaMonthly: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label style={{ ...s.muted, display: "block", marginBottom: 4 }}>Duration (months)</label>
            <input style={s.input} type="number" value={strategy.dcaMonths || 12}
              onChange={e => updateStrategy({ dcaMonths: parseInt(e.target.value) || 12 })} />
          </div>
          <div>
            <label style={{ ...s.muted, display: "block", marginBottom: 4 }}>Total to Deploy</label>
            <div style={{ ...s.mono, fontSize: 18, fontWeight: 700, color: C.accent, paddingTop: 8 }}>
              {mask(fmtFull((strategy.dcaMonthly || 15000) * (strategy.dcaMonths || 12)), hide)}
            </div>
          </div>
        </div>

        {/* DCA timeline */}
        {(() => {
          const months = strategy.dcaMonths || 12;
          const monthly = strategy.dcaMonthly || 15000;
          const deployed = (strategy.deploymentLog || []).reduce((s, d) => s + d.amount, 0);
          const remaining = (monthly * months) - deployed;
          const pctDone = deployed / (monthly * months);
          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: C.green }}>Deployed: {mask(fmtFull(deployed), hide)}</span>
                <span style={{ color: C.muted }}>Remaining: {mask(fmtFull(remaining), hide)}</span>
              </div>
              <div style={{ background: C.card2, borderRadius: 8, height: 16, overflow: "hidden" }}>
                <div style={{ background: `linear-gradient(90deg, ${C.green}, ${C.accent})`, height: "100%", width: `${Math.min(100, pctDone * 100)}%`, borderRadius: 8, transition: "width 0.5s" }} />
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{(pctDone * 100).toFixed(0)}% deployed — {mask(fmtFull(monthly), hide)}/month for {months} months</div>
              <button style={{ ...s.btnSm, marginTop: 8 }} onClick={() => {
                const amt = prompt("Amount deployed this month (CAD):", monthly);
                if (amt) updateStrategy({ deploymentLog: [...(strategy.deploymentLog || []), { date: new Date().toISOString().slice(0, 10), amount: parseFloat(amt) }] });
              }}>Log Deployment</button>
            </div>
          );
        })()}

        {/* Dip triggers */}
        <h4 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8, marginTop: 16 }}>Buy-the-Dip Triggers</h4>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>When markets drop from their high, deploy extra cash on top of your monthly DCA.</div>
        {(strategy.dipTriggers || []).map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "8px 12px", background: C.card2 + "44", borderRadius: 8 }}>
            <span style={{ fontSize: 24 }}>{t.pctDrop >= 15 ? "🔥" : t.pctDrop >= 10 ? "📉" : "📊"}</span>
            <span style={{ fontSize: 13, color: C.text, flex: 1 }}>
              If market drops <strong style={{ color: C.red }}>{t.pctDrop}%</strong> from high → deploy extra <strong style={{ color: C.green }}>{mask(fmtFull(t.extraAmount), hide)}</strong>
            </span>
            <button style={{ ...s.btnSm, padding: "2px 8px", fontSize: 10 }} onClick={() => {
              const triggers = [...(strategy.dipTriggers || [])];
              triggers.splice(i, 1);
              updateStrategy({ dipTriggers: triggers });
            }}>✕</button>
          </div>
        ))}
        <button style={{ ...s.btnSm, marginTop: 8 }} onClick={() => {
          const pct = prompt("Drop % trigger (e.g., 5, 10, 15):");
          const amt = prompt("Extra amount to deploy (CAD):");
          if (pct && amt) updateStrategy({ dipTriggers: [...(strategy.dipTriggers || []), { pctDrop: parseFloat(pct), extraAmount: parseFloat(amt) }] });
        }}>+ Add Trigger</button>
      </div>

      {/* ══════════════════════════════════════════════════
         HOLD ZONE — PSYCHOLOGY & DISCIPLINE
         ══════════════════════════════════════════════════ */}
      <div style={{ ...s.card, background: `linear-gradient(135deg, ${C.card}, ${C.accent}08)`, border: `2px solid ${C.accent}33` }}>
        <h3 style={{ ...s.h3, fontSize: 16 }}>🧠 Hold Zone — Your Calm-Mind Rules</h3>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
          You wrote these when you were thinking clearly. Read them when you feel the urge to sell.
        </div>
        {(strategy.holdRules || []).map((rule, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10, padding: "12px 16px", background: C.card2 + "66", borderRadius: 10, borderLeft: `3px solid ${C.accent}` }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{i === 0 ? "🛡" : i === 1 ? "📊" : i === 2 ? "🧘" : "⏰"}</span>
            <span style={{ fontSize: 14, color: C.text, lineHeight: 1.5, flex: 1 }}>{rule}</span>
            <button style={{ background: "transparent", border: "none", color: C.red + "88", cursor: "pointer", fontSize: 10, padding: "2px 6px", flexShrink: 0 }}
              onClick={() => updateStrategy({ holdRules: strategy.holdRules.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input style={{ ...s.input, flex: 1 }} placeholder="Write a new rule for yourself..." value={newRule} onChange={e => setNewRule(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && newRule.trim()) { updateStrategy({ holdRules: [...(strategy.holdRules || []), newRule.trim()] }); setNewRule(""); } }} />
          <button style={s.btn} onClick={() => { if (newRule.trim()) { updateStrategy({ holdRules: [...(strategy.holdRules || []), newRule.trim()] }); setNewRule(""); } }}>Add Rule</button>
        </div>
      </div>

      {/* Historical context */}
      <div style={s.card}>
        <h3 style={s.h3}>📈 Historical Perspective — Why Holding Works</h3>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Every major crash has been followed by recovery. Here's proof.</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={s.th}>Event</th>
              <th style={{ ...s.th, textAlign: "right" }}>Drop</th>
              <th style={{ ...s.th, textAlign: "right" }}>Recovery Time</th>
              <th style={{ ...s.th, textAlign: "right" }}>5yr After Bottom</th>
            </tr>
          </thead>
          <tbody>
            {[
              { event: "2008 Financial Crisis", drop: "-56.8%", recovery: "~4 years", after5: "+128%" },
              { event: "2020 COVID Crash", drop: "-33.9%", recovery: "~5 months", after5: "+107%" },
              { event: "2022 Bear Market", drop: "-25.4%", recovery: "~2 years", after5: "ongoing" },
              { event: "2000 Dot-com Bust", drop: "-49.1%", recovery: "~7 years", after5: "+48%" },
              { event: "1987 Black Monday", drop: "-33.5%", recovery: "~2 years", after5: "+98%" },
            ].map((r, i) => (
              <tr key={i} style={{ background: i % 2 ? C.card2 + "33" : "transparent" }}>
                <td style={{ ...s.td, fontWeight: 600 }}>{r.event}</td>
                <td style={{ ...s.td, ...s.mono, textAlign: "right", color: C.red }}>{r.drop}</td>
                <td style={{ ...s.td, ...s.mono, textAlign: "right" }}>{r.recovery}</td>
                <td style={{ ...s.td, ...s.mono, textAlign: "right", color: C.green }}>{r.after5}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 16, padding: "12px 16px", background: C.green + "12", borderRadius: 8, border: `1px solid ${C.green}33` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.green, marginBottom: 4 }}>Key Stat</div>
          <div style={{ fontSize: 13, color: C.text }}>
            If you invested $10,000 in the S&P 500 in 2000 (the worst possible timing — right before the dot-com crash) and held through <em>two</em> major crashes, by 2025 it would be worth roughly <strong style={{ color: C.green }}>$64,000</strong>. Selling during either crash would have locked in losses.
          </div>
        </div>
        <div style={{ marginTop: 12, padding: "12px 16px", background: C.accent + "12", borderRadius: 8, border: `1px solid ${C.accent}33` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, marginBottom: 4 }}>The Cost of Missing the Best Days</div>
          <div style={{ fontSize: 13, color: C.text }}>
            Missing just the <strong>10 best days</strong> in the market over 20 years cuts your returns by more than half. Those best days almost always happen right after the worst days — so if you sell during a crash, you miss the recovery.
          </div>
        </div>
      </div>

      {/* Add holding */}
      <div style={s.card}>
        <button style={s.btn} onClick={() => setShowAdd(!showAdd)}>{showAdd ? "Close" : "+ Add Holding"}</button>
        {showAdd && (
          <div style={{ marginTop: 12 }}>
            <div style={{ ...s.row, gap: 8, marginBottom: 8 }}>
              <input style={{ ...s.input, width: 160 }} placeholder="Name" value={newHolding.name} onChange={e => setNewHolding({ ...newHolding, name: e.target.value })} />
              <input style={{ ...s.input, width: 80 }} placeholder="Ticker" value={newHolding.ticker} onChange={e => setNewHolding({ ...newHolding, ticker: e.target.value })} />
              <select style={s.select} value={newHolding.bucket} onChange={e => setNewHolding({ ...newHolding, bucket: e.target.value })}>
                {BUCKETS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <input style={{ ...s.input, width: 120 }} placeholder="Account (e.g. IB)" value={newHolding.account} onChange={e => setNewHolding({ ...newHolding, account: e.target.value })} list="account-list" />
              <datalist id="account-list">{allAccounts.map(a => <option key={a} value={a} />)}</datalist>
              <select style={s.select} value={newHolding.type} onChange={e => setNewHolding({ ...newHolding, type: e.target.value })}>
                {ASSET_CLASSES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select style={s.select} value={newHolding.currency} onChange={e => setNewHolding({ ...newHolding, currency: e.target.value })}>
                <option value="CAD">CAD</option><option value="USD">USD</option><option value="GBP">GBP</option>
              </select>
            </div>
            <div style={{ ...s.row, gap: 8, marginBottom: 8 }}>
              <label style={{ fontSize: 13, color: C.muted }}>Entry:</label>
              <select style={s.select} value={newHolding.entryMode} onChange={e => setNewHolding({ ...newHolding, entryMode: e.target.value })}>
                <option value="lots">Qty × Price</option><option value="total">Total Value</option>
              </select>
              {newHolding.entryMode === "lots" ? (<>
                <input style={{ ...s.input, width: 90 }} placeholder="Qty" type="number" value={newHolding.qty} onChange={e => setNewHolding({ ...newHolding, qty: e.target.value })} />
                <input style={{ ...s.input, width: 110 }} placeholder="Cost/unit" type="number" value={newHolding.costPerUnit} onChange={e => setNewHolding({ ...newHolding, costPerUnit: e.target.value })} />
                <input style={{ ...s.input, width: 110 }} placeholder="Current price" type="number" value={newHolding.currentPrice} onChange={e => setNewHolding({ ...newHolding, currentPrice: e.target.value })} />
              </>) : (
                <input style={{ ...s.input, width: 140 }} placeholder="Total value" type="number" value={newHolding.totalValue} onChange={e => setNewHolding({ ...newHolding, totalValue: e.target.value })} />
              )}
            </div>
            <div style={{ ...s.row, gap: 8, marginBottom: 8 }}>
              <input style={{ ...s.input, width: 200 }} placeholder="Tags (comma-separated)" value={newHolding.tags} onChange={e => setNewHolding({ ...newHolding, tags: e.target.value })} />
              <select style={s.select} value={newHolding.targetType} onChange={e => setNewHolding({ ...newHolding, targetType: e.target.value })}>
                <option value="">No Target</option><option value="dollars">Target $</option><option value="shares">Target Shares</option><option value="percentage">Target %</option>
              </select>
              {newHolding.targetType && <input style={{ ...s.input, width: 100 }} placeholder="Target" type="number" value={newHolding.targetValue} onChange={e => setNewHolding({ ...newHolding, targetValue: e.target.value })} />}
            </div>
            <div style={{ ...s.row, gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.muted }}>Alerts:</span>
              <input style={{ ...s.input, width: 100 }} placeholder="Price above" type="number" value={newHolding.alertAbove} onChange={e => setNewHolding({ ...newHolding, alertAbove: e.target.value })} />
              <input style={{ ...s.input, width: 100 }} placeholder="Price below" type="number" value={newHolding.alertBelow} onChange={e => setNewHolding({ ...newHolding, alertBelow: e.target.value })} />
              <input style={{ ...s.input, width: 80 }} placeholder="% up" type="number" value={newHolding.alertPctUp} onChange={e => setNewHolding({ ...newHolding, alertPctUp: e.target.value })} />
              <input style={{ ...s.input, width: 80 }} placeholder="% down" type="number" value={newHolding.alertPctDown} onChange={e => setNewHolding({ ...newHolding, alertPctDown: e.target.value })} />
            </div>
            <button style={s.btn} onClick={addHolding}>Add Holding</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB 3 — INCOME & EXPENSES
   ═══════════════════════════════════════════════════════════ */
function CashFlowTab({ data, setData, nwData, settings, rates, theme, hide }) {
  const C = themes[theme]; const s = S(theme);
  const [filterBucket, setFilterBucket] = useState("All");
  const [filterType, setFilterType] = useState("all");
  const [period, setPeriod] = useState("monthly");
  const [viewMonth, setViewMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; });
  const [showAddTx, setShowAddTx] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadBucket, setUploadBucket] = useState("Opco");
  const [uploadAccount, setUploadAccount] = useState("");

  /* Pull all bank accounts from net worth data */
  const allAccounts = useMemo(() => {
    const snaps = nwData?.snapshots || [];
    const latest = snaps[0];
    if (!latest) return [];
    return latest.items.map(i => ({ bucket: i.bucket, name: i.name, currency: i.currency, isLiability: i.isLiability }));
  }, [nwData]);

  const accountsByBucket = useMemo(() => {
    const map = {};
    BUCKETS.forEach(b => { map[b] = allAccounts.filter(a => a.bucket === b); });
    return map;
  }, [allAccounts]);

  /* Track which accounts have been uploaded this month */
  const [uploadedAccounts, setUploadedAccounts] = useState({});
  const missingAccounts = useMemo(() => {
    const key = viewMonth;
    const uploaded = uploadedAccounts[key] || [];
    return allAccounts.filter(a => !uploaded.find(u => u.bucket === a.bucket && u.name === a.name));
  }, [allAccounts, uploadedAccounts, viewMonth]);
  const [newTx, setNewTx] = useState({ date: new Date().toISOString().slice(0, 10), bucket: "Jacqueline", type: "expense", category: "Food & Groceries", description: "", amount: "", currency: "CAD" });
  const { sortKey, sortDir, onSort, sortFn } = useSortable("date", "desc");

  const txns = data.transactions || [];
  const budgets = data.budgets || [];
  const catRules = data.catRules || {};

  /* missing statement detection */
  const currentMonth = viewMonth;
  const uploadedBuckets = [...new Set(txns.filter(t => toMonthKey(t.date) === currentMonth).map(t => t.bucket))];
  const missingBuckets = BUCKETS.filter(b => !uploadedBuckets.includes(b));

  /* auto-categorize a transaction description */
  const autoCategory = (desc, bucket) => {
    const key = desc.toLowerCase().trim();
    for (const [pattern, rules] of Object.entries(catRules)) {
      if (key.includes(pattern) && rules[bucket]) return rules[bucket];
    }
    return null;
  };

  /* detect inter-entity transfers */
  const detectTransfers = (transactions) => {
    return transactions.map(tx => {
      if (tx.isTransfer) return tx;
      const matches = transactions.filter(other =>
        other.id !== tx.id && other.bucket !== tx.bucket &&
        Math.abs(other.amount - tx.amount) < 0.01 &&
        other.date === tx.date && other.type !== tx.type
      );
      if (matches.length > 0) return { ...tx, isTransfer: true, transferMatch: matches[0].bucket };
      return tx;
    });
  };

  const allTxns = useMemo(() => detectTransfers(txns), [txns]);

  /* filter */
  const filtered = allTxns.filter(t => {
    if (filterBucket !== "All" && t.bucket !== filterBucket) return false;
    if (filterType === "income" && t.type !== "income") return false;
    if (filterType === "expense" && t.type !== "expense") return false;
    if (filterType === "transfers" && !t.isTransfer) return false;
    const mk = toMonthKey(t.date);
    if (period === "monthly" && mk !== viewMonth) return false;
    if (period === "quarterly") {
      const [vy, vm] = viewMonth.split("-").map(Number);
      const q = Math.floor((vm - 1) / 3);
      const [ty, tm] = mk.split("-").map(Number);
      const tq = Math.floor((tm - 1) / 3);
      if (ty !== vy || tq !== q) return false;
    }
    if (period === "annual") {
      const vy = viewMonth.split("-")[0];
      if (!mk.startsWith(vy)) return false;
    }
    return true;
  });

  const nonTransfer = filtered.filter(t => !t.isTransfer);
  const totalIncome = nonTransfer.filter(t => t.type === "income").reduce((s, t) => s + toBase(t.amount, t.currency || "CAD", rates), 0);
  const totalExpenses = nonTransfer.filter(t => t.type === "expense").reduce((s, t) => s + toBase(t.amount, t.currency || "CAD", rates), 0);
  const netFlow = totalIncome - totalExpenses;

  const sorted = sortFn(filtered.map(t => ({ ...t, amountSigned: t.type === "income" ? t.amount : -t.amount })));

  /* per-bucket breakdown */
  const bucketBreakdown = useMemo(() => {
    return BUCKETS.map(b => {
      const bTxns = nonTransfer.filter(t => t.bucket === b);
      const inc = bTxns.filter(t => t.type === "income").reduce((s, t) => s + toBase(t.amount, t.currency || "CAD", rates), 0);
      const exp = bTxns.filter(t => t.type === "expense").reduce((s, t) => s + toBase(t.amount, t.currency || "CAD", rates), 0);
      return { bucket: b, income: inc, expenses: exp, net: inc - exp };
    }).filter(b => b.income > 0 || b.expenses > 0);
  }, [nonTransfer, rates]);

  /* expense by category */
  const expByCat = useMemo(() => {
    const map = {};
    nonTransfer.filter(t => t.type === "expense").forEach(t => {
      const cat = t.category || "Other";
      map[cat] = (map[cat] || 0) + toBase(t.amount, t.currency || "CAD", rates);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [nonTransfer, rates]);

  /* budget tracking */
  const budgetStatus = useMemo(() => {
    return budgets.map(b => {
      const spent = nonTransfer.filter(t => t.type === "expense" && t.bucket === b.bucket && t.category === b.category && toMonthKey(t.date) === currentMonth)
        .reduce((s, t) => s + toBase(t.amount, t.currency || "CAD", rates), 0);
      const pctUsed = b.monthlyLimit > 0 ? spent / b.monthlyLimit : 0;
      return { ...b, spent, remaining: b.monthlyLimit - spent, pctUsed };
    });
  }, [budgets, nonTransfer, currentMonth, rates]);

  /* CSV import with auto-categorization */
  const handleCSVImport = (rows, bucket) => {
    const mapped = rows.map(r => {
      const amt = parseFloat(r.amount || r.debit || r.credit || r.value || 0);
      const desc = r.description || r.memo || r.name || r.payee || "";
      const isIncome = amt < 0 || (r.type || "").toLowerCase().includes("income") || (r.type || "").toLowerCase().includes("credit");
      const cat = autoCategory(desc, bucket) || (isIncome ? "Other Income" : "Other");
      return {
        id: uid(), date: r.date || r.transaction_date || new Date().toISOString().slice(0, 10),
        bucket, type: isIncome ? "income" : "expense",
        category: r.category || cat, description: desc,
        amount: Math.abs(amt), currency: (r.currency || "CAD").toUpperCase(),
      };
    }).filter(r => !isNaN(r.amount) && r.amount > 0);
    setData({ ...data, transactions: [...txns, ...mapped] });
  };

  const addTx = () => {
    if (!newTx.amount) return;
    setData({ ...data, transactions: [...txns, { ...newTx, id: uid(), amount: parseFloat(newTx.amount) }] });
    setNewTx({ ...newTx, description: "", amount: "" });
  };

  const removeTx = (id) => setData({ ...data, transactions: txns.filter(t => t.id !== id) });

  const recategorize = (txId, newCat) => {
    const tx = txns.find(t => t.id === txId);
    if (!tx) return;
    const updated = txns.map(t => t.id === txId ? { ...t, category: newCat } : t);
    /* learn the rule */
    const key = tx.description.toLowerCase().trim();
    if (key) {
      const newRules = { ...catRules, [key]: { ...(catRules[key] || {}), [tx.bucket]: newCat } };
      setData({ ...data, transactions: updated, catRules: newRules });
    } else {
      setData({ ...data, transactions: updated });
    }
  };

  return (
    <div>
      {/* Note: missing statement alerts are now per-account in the upload section below */}

      {/* Stats */}
      <div className="mc-stat-row" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Income" value={mask(fmtFull(totalIncome), hide)} sub="Excl. inter-entity transfers" color={C.green} C={C} />
        <StatCard label="Expenses" value={mask(fmtFull(totalExpenses), hide)} sub="Excl. inter-entity transfers" color={C.red} C={C} />
        <StatCard label="Net Cash Flow" value={mask((netFlow >= 0 ? "+" : "") + fmtFull(netFlow), hide)} color={netFlow >= 0 ? C.green : C.red} C={C} />
      </div>

      {/* Controls */}
      <div style={{ ...s.row, marginBottom: 16, gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ ...s.row, gap: 8 }}>
          <select style={s.select} value={filterBucket} onChange={e => setFilterBucket(e.target.value)}>
            <option value="All">All Buckets</option>
            {BUCKETS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {["all", "income", "expense", "transfers"].map(f => (
            <button key={f} onClick={() => setFilterType(f)}
              style={{ ...s.btnSm, background: filterType === f ? C.accent : C.card2, color: filterType === f ? (theme === "dark" ? "#0b1121" : "#fff") : C.text, fontWeight: filterType === f ? 700 : 400 }}>
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ ...s.row, gap: 8 }}>
          {["monthly", "quarterly", "annual"].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ ...s.btnSm, background: period === p ? C.accent2 : C.card2, color: period === p ? "#fff" : C.text }}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          <input type="month" style={{ ...s.input, width: 160 }} value={viewMonth} onChange={e => setViewMonth(e.target.value)} />
        </div>
      </div>

      {/* Per-bucket income vs expenses */}
      {bucketBreakdown.length > 0 && (
        <div className="mc-flex-row" style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ ...s.card, flex: 2, minWidth: 350 }}>
            <h3 style={s.h3}>Income vs Expenses by Bucket</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bucketBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.card2} />
                <XAxis dataKey="bucket" stroke={C.muted} fontSize={12} />
                <YAxis stroke={C.muted} fontSize={12} tickFormatter={v => fmt(v)} />
                <Tooltip content={<ChartTooltip C={C} />} />
                <Legend />
                <Bar dataKey="income" name="Income" fill={C.green} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill={C.red} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {expByCat.length > 0 && (
            <div style={{ ...s.card, flex: 1, minWidth: 280 }}>
              <h3 style={s.h3}>Expenses by Category</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={expByCat.slice(0, 8)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={3} strokeWidth={0}>
                    {expByCat.slice(0, 8).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmtFull(v)} contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }} />
                  <Legend formatter={v => <span style={{ color: C.text, fontSize: 11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Budget tracking */}
      {budgetStatus.length > 0 && (
        <div style={s.card}>
          <h3 style={s.h3}>Budget Tracking — {monthLabel(currentMonth)}</h3>
          {budgetStatus.map(b => (
            <div key={b.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                <span style={{ color: C.text }}><span style={S(theme).badge(BUCKET_COLORS[b.bucket])}>{b.bucket}</span> {b.category}</span>
                <span style={{ color: b.pctUsed > 1 ? C.red : b.pctUsed > 0.8 ? C.orange : C.muted }}>
                  {fmtFull(b.spent)} / {fmtFull(b.monthlyLimit)} {b.pctUsed > 1 && "⚠ OVER"}
                </span>
              </div>
              <div style={{ background: C.card2, borderRadius: 6, height: 8, overflow: "hidden" }}>
                <div style={{ background: b.pctUsed > 1 ? C.red : b.pctUsed > 0.8 ? C.orange : C.green, height: "100%", width: `${Math.min(100, b.pctUsed * 100)}%`, borderRadius: 6, transition: "width 0.3s" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Missing accounts alert */}
      {missingAccounts.length > 0 && (
        <div style={{ ...s.card, background: C.orange + "12", borderColor: C.orange }}>
          <strong style={{ color: C.orange }}>Statements still needed for {monthLabel(viewMonth)}:</strong>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {missingAccounts.map((a, i) => (
              <span key={i} style={{ ...S(theme).badge(BUCKET_COLORS[a.bucket]), fontSize: 11 }}>{a.bucket} — {a.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Upload CSV — account-aware */}
      <div style={s.card}>
        <h3 style={s.h3}>Upload Bank Statement</h3>
        <div style={{ marginBottom: 12, fontSize: 13, color: C.muted }}>
          Select the specific account this statement belongs to. Your accounts are pulled from the Net Worth tab.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8, marginBottom: 12 }}>
          {BUCKETS.map(bucket => {
            const accts = accountsByBucket[bucket] || [];
            if (accts.length === 0) return null;
            return (
              <div key={bucket} style={{ background: C.card2, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: BUCKET_COLORS[bucket], marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{bucket}</div>
                {accts.map((acct, i) => {
                  const isUploaded = (uploadedAccounts[viewMonth] || []).find(u => u.bucket === acct.bucket && u.name === acct.name);
                  const isSelected = uploadBucket === bucket && uploadAccount === acct.name;
                  return (
                    <div key={i} onClick={() => { setUploadBucket(bucket); setUploadAccount(acct.name); setShowUpload(true); }}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderRadius: 6, marginBottom: 4,
                        cursor: "pointer", background: isSelected ? C.accent + "22" : "transparent", border: isSelected ? `1px solid ${C.accent}` : "1px solid transparent",
                      }}>
                      <span style={{ fontSize: 13, color: C.text }}>{acct.name} <span style={{ color: C.muted, fontSize: 11 }}>({acct.currency})</span></span>
                      {isUploaded ? <span style={{ fontSize: 11, color: C.green }}>✓ Uploaded</span> : <span style={{ fontSize: 11, color: C.muted }}>Click to upload</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        {showUpload && (
          <div style={{ padding: 12, background: C.accent + "11", borderRadius: 8, border: `1px solid ${C.accent}33` }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              Uploading: <span style={{ color: BUCKET_COLORS[uploadBucket] }}>{uploadBucket}</span> — {uploadAccount}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Auto-detects columns. Common formats: date, description, amount (or debit/credit)</div>
            <input type="file" accept=".csv" style={{ color: C.text, fontSize: 13 }}
              onChange={e => {
                const f = e.target.files[0]; if (!f) return;
                const r = new FileReader();
                r.onload = (ev) => {
                  handleCSVImport(parseCSV(ev.target.result), uploadBucket);
                  setUploadedAccounts(prev => ({ ...prev, [viewMonth]: [...(prev[viewMonth] || []), { bucket: uploadBucket, name: uploadAccount }] }));
                  setShowUpload(false);
                };
                r.readAsText(f);
              }} />
            <button style={{ ...s.btnSm, marginTop: 8 }} onClick={() => setShowUpload(false)}>Cancel</button>
          </div>
        )}
      </div>

      {/* Add transaction */}
      <div style={s.card}>
        <button style={s.btnSm} onClick={() => setShowAddTx(!showAddTx)}>{showAddTx ? "Close" : "+ Add Transaction Manually"}</button>
        {showAddTx && (
          <div style={{ marginTop: 10 }}>
            <div style={{ ...s.row, gap: 8 }}>
              <input type="date" style={{ ...s.input, width: 140 }} value={newTx.date} onChange={e => setNewTx({ ...newTx, date: e.target.value })} />
              <select style={s.select} value={newTx.bucket} onChange={e => setNewTx({ ...newTx, bucket: e.target.value, category: DEFAULT_TAX_CATS[e.target.value]?.[0] || "Other" })}>
                {BUCKETS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select style={s.select} value={newTx.type} onChange={e => setNewTx({ ...newTx, type: e.target.value, category: e.target.value === "income" ? INCOME_CATS[newTx.bucket]?.[0] || "Other Income" : DEFAULT_TAX_CATS[newTx.bucket]?.[0] || "Other" })}>
                <option value="expense">Expense</option><option value="income">Income</option>
              </select>
              <select style={s.select} value={newTx.category} onChange={e => setNewTx({ ...newTx, category: e.target.value })}>
                {(newTx.type === "income" ? INCOME_CATS[newTx.bucket] || [] : DEFAULT_TAX_CATS[newTx.bucket] || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input style={{ ...s.input, width: 160 }} placeholder="Description" value={newTx.description} onChange={e => setNewTx({ ...newTx, description: e.target.value })} />
              <input style={{ ...s.input, width: 100 }} placeholder="Amount" type="number" value={newTx.amount} onChange={e => setNewTx({ ...newTx, amount: e.target.value })} />
              <select style={s.select} value={newTx.currency} onChange={e => setNewTx({ ...newTx, currency: e.target.value })}>
                <option value="CAD">CAD</option><option value="USD">USD</option><option value="GBP">GBP</option>
              </select>
              <button style={s.btn} onClick={addTx}>Add</button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction table */}
      {sorted.length > 0 && (
        <div className="mc-table-wrap" style={{ ...s.card, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[{k:"date",l:"Date"},{k:"bucket",l:"Bucket"},{k:"type",l:"Type"},{k:"category",l:"Category"},{k:"description",l:"Description"},{k:"amount",l:"Amount",a:"right"}].map(col => (
                  <th key={col.k} style={{ ...s.th, textAlign: col.a || "left" }} onClick={() => onSort(col.k)}>{col.l}{sortKey === col.k ? (sortDir === "asc" ? " ↑" : " ↓") : ""}</th>
                ))}
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => (
                <tr key={t.id} style={{ background: t.isTransfer ? C.accent2 + "11" : (i % 2 ? C.card2 + "33" : "transparent") }}>
                  <td style={s.td}>{t.date}</td>
                  <td style={s.td}><span style={S(theme).badge(BUCKET_COLORS[t.bucket])}>{t.bucket}</span></td>
                  <td style={s.td}>
                    {t.isTransfer ? <span style={S(theme).badge(C.accent2)}>Transfer</span> :
                      <span style={S(theme).badge(t.type === "income" ? C.green : C.red)}>{t.type === "income" ? "Income" : "Expense"}</span>}
                  </td>
                  <td style={s.td}>
                    <select style={{ ...s.select, padding: "2px 6px", fontSize: 12, background: "transparent", border: "none", color: C.text }}
                      value={t.category} onChange={e => recategorize(t.id, e.target.value)}>
                      {[...(t.type === "income" ? INCOME_CATS[t.bucket] || [] : DEFAULT_TAX_CATS[t.bucket] || []), t.category].filter((v,i,a) => a.indexOf(v) === i).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td style={s.td}>{t.description} {t.isTransfer && <span style={{ color: C.accent2, fontSize: 11 }}>→ {t.transferMatch}</span>}</td>
                  <td style={{ ...s.td, ...s.mono, textAlign: "right", color: t.type === "income" ? C.green : C.red, fontWeight: 600 }}>
                    {t.type === "income" ? "+" : "-"}{fmtFull(t.amount, t.currency || "CAD")}
                  </td>
                  <td style={s.td}><button style={s.btnDanger} onClick={() => removeTx(t.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SETTINGS TAB
   ═══════════════════════════════════════════════════════════ */
/* ── Plaid Connection UI Component ── */
const PLAID_SERVER = "http://localhost:8484";

function PlaidConnectionsCard({ theme }) {
  const C = themes[theme]; const s = S(theme);
  const [connections, setConnections] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | connecting | syncing | error
  const [error, setError] = useState(null);
  const [serverOnline, setServerOnline] = useState(null);
  const [syncResults, setSyncResults] = useState(null);

  /* Check if the Plaid server is running */
  const checkServer = useCallback(async () => {
    try {
      const res = await fetch(`${PLAID_SERVER}/api/plaid/health`);
      const data = await res.json();
      setServerOnline(data.status === "ok");
      if (data.status === "ok") {
        const connRes = await fetch(`${PLAID_SERVER}/api/plaid/connections`);
        setConnections(await connRes.json());
      }
    } catch {
      setServerOnline(false);
    }
  }, []);

  useEffect(() => { checkServer(); }, [checkServer]);

  /* Launch Plaid Link */
  const connectAccount = async () => {
    setError(null);
    setStatus("connecting");
    try {
      /* Step 1: Get a link token from our server */
      const tokenRes = await fetch(`${PLAID_SERVER}/api/plaid/create-link-token`, { method: "POST" });
      const { link_token, error: tokenErr } = await tokenRes.json();
      if (tokenErr) throw new Error(tokenErr);

      /* Step 2: Open Plaid Link */
      if (!window.Plaid) {
        /* Load Plaid Link script if not already loaded */
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("Failed to load Plaid Link"));
          document.head.appendChild(script);
        });
      }

      const handler = window.Plaid.create({
        token: link_token,
        onSuccess: async (publicToken, metadata) => {
          /* Step 3: Exchange public token for access token via our server */
          try {
            const exchRes = await fetch(`${PLAID_SERVER}/api/plaid/exchange-token`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                public_token: publicToken,
                institution: metadata.institution?.name || "Unknown",
              }),
            });
            const conn = await exchRes.json();
            if (conn.error) throw new Error(conn.error);
            setConnections(prev => [...prev, conn]);
            setStatus("idle");
          } catch (err) {
            setError(err.message);
            setStatus("error");
          }
        },
        onExit: (err) => {
          if (err) setError(err.display_message || err.error_message || "Connection cancelled");
          setStatus(err ? "error" : "idle");
        },
      });
      handler.open();
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  /* Sync all connected accounts */
  const syncAll = async () => {
    setStatus("syncing");
    setError(null);
    try {
      const res = await fetch(`${PLAID_SERVER}/api/plaid/sync-all`);
      const data = await res.json();
      setSyncResults(data);
      setStatus("idle");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  /* Disconnect an account */
  const disconnect = async (connId) => {
    try {
      await fetch(`${PLAID_SERVER}/api/plaid/connections/${connId}`, { method: "DELETE" });
      setConnections(prev => prev.filter(c => c.id !== connId));
      setSyncResults(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={s.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ ...s.h3, margin: 0 }}>Bank Connections (Plaid)</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: serverOnline ? C.green : serverOnline === false ? C.red : C.muted }} />
          <span style={{ fontSize: 11, color: C.muted }}>{serverOnline ? "Server online" : serverOnline === false ? "Server offline" : "Checking..."}</span>
        </div>
      </div>

      {serverOnline === false && (
        <div style={{ padding: 12, background: C.orange + "15", border: `1px solid ${C.orange}33`, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: C.orange, fontWeight: 600, marginBottom: 4 }}>Plaid server not running</div>
          <div style={{ fontSize: 12, color: C.muted }}>
            Start it with these commands:
            <pre style={{ background: C.card2, padding: 8, borderRadius: 6, marginTop: 6, fontSize: 11, color: C.text, overflowX: "auto" }}>
{`cd plaid-server
cp .env.example .env    # then add your API keys
npm install
npm start`}
            </pre>
          </div>
        </div>
      )}

      {serverOnline && (
        <div>
          {/* Connected accounts list */}
          {connections.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {connections.map(conn => (
                <div key={conn.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}33` }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{conn.institution}</span>
                    <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>Connected {new Date(conn.connectedAt).toLocaleDateString()}</span>
                  </div>
                  <button style={{ ...s.btnSm, color: C.red, borderColor: C.red + "44", fontSize: 11, padding: "3px 10px" }} onClick={() => disconnect(conn.id)}>Disconnect</button>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={s.btn} disabled={status === "connecting"} onClick={connectAccount}>
              {status === "connecting" ? "Connecting..." : "+ Connect Account"}
            </button>
            {connections.length > 0 && (
              <button style={s.btnSm} disabled={status === "syncing"} onClick={syncAll}>
                {status === "syncing" ? "Syncing..." : "Sync All"}
              </button>
            )}
            <button style={{ ...s.btnSm, fontSize: 11 }} onClick={checkServer}>Refresh</button>
          </div>

          {/* Sync results */}
          {syncResults && (
            <div style={{ marginTop: 12, padding: 12, background: C.card2, borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>Last Sync Results</div>
              {syncResults.map(r => (
                <div key={r.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: r.error ? C.red : C.green }}>{r.institution} {r.error ? `— Error: ${r.error}` : `— ${r.accounts.length} accounts, ${r.holdings.length} holdings`}</div>
                  {r.accounts.map(a => (
                    <div key={a.id} style={{ fontSize: 11, color: C.muted, paddingLeft: 12 }}>
                      {a.name} ({a.subtype}) — {a.currency} ${a.balance?.toLocaleString()}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 8, fontSize: 12, color: C.red }}>{error}</div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsTab({ settings, setSettings, rates, setRates, theme, s: ss, tabPasswords, saveTabPasswords, handleRemovePassword, unlockedTabs }) {
  const C = themes[theme]; const s = S(theme);
  return (
    <div style={{ maxWidth: 600 }}>
      <div style={s.card}>
        <h3 style={s.h3}>Tax Rates</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ ...s.muted, display: "block", marginBottom: 4 }}>Ineligible Corp Assets Tax %</label>
            <input style={s.input} type="number" value={settings.taxRateIneligible} onChange={e => setSettings({ ...settings, taxRateIneligible: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label style={{ ...s.muted, display: "block", marginBottom: 4 }}>Eligible Corp Assets Tax %</label>
            <input style={s.input} type="number" value={settings.taxRateEligible} onChange={e => setSettings({ ...settings, taxRateEligible: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
        <div style={{ marginTop: 16, padding: 12, background: `${C.green}11`, borderRadius: 8, border: `1px solid ${C.green}33` }}>
          <h4 style={{ margin: "0 0 8px", fontSize: 13, color: C.green }}>High Range (Optimistic) Overrides</h4>
          <div>
            <label style={{ ...s.muted, display: "block", marginBottom: 4 }}>Optimistic Tax Rate %</label>
            <input style={s.input} type="number" value={settings.highTaxRate || 20} onChange={e => setSettings({ ...settings, highTaxRate: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
      </div>
      <div style={s.card}>
        <h3 style={s.h3}>Currency & Exchange Rates</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ ...s.muted, display: "block", marginBottom: 4 }}>Base Currency</label>
            <select style={s.select} value={settings.baseCurrency} onChange={e => setSettings({ ...settings, baseCurrency: e.target.value })}>
              <option value="CAD">CAD</option><option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label style={{ ...s.muted, display: "block", marginBottom: 4 }}>USD/CAD Rate</label>
            <input style={s.input} type="number" step="0.0001" value={rates.USDCAD || 1.37} onChange={e => setRates({ ...rates, USDCAD: parseFloat(e.target.value) })} />
          </div>
          <div>
            <label style={{ ...s.muted, display: "block", marginBottom: 4 }}>GBP/CAD Rate</label>
            <input style={s.input} type="number" step="0.0001" value={rates.GBPCAD || 1.72} onChange={e => setRates({ ...rates, GBPCAD: parseFloat(e.target.value) })} />
          </div>
        </div>
      </div>
      <div style={s.card}>
        <h3 style={s.h3}>Date & Fiscal Year</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ ...s.muted, display: "block", marginBottom: 4 }}>Date Format</label>
            <select style={s.select} value={settings.dateFormat} onChange={e => setSettings({ ...settings, dateFormat: e.target.value })}>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            </select>
          </div>
          <div>
            <label style={{ ...s.muted, display: "block", marginBottom: 4 }}>Fiscal Year Starts</label>
            <select style={s.select} value={settings.fiscalYearStart} onChange={e => setSettings({ ...settings, fiscalYearStart: parseInt(e.target.value) })}>
              {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div style={s.card}>
        <h3 style={s.h3}>Bucket Names</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {BUCKETS.map(b => (
            <div key={b}>
              <label style={{ ...s.muted, display: "block", marginBottom: 4 }}>{b}</label>
              <input style={s.input} value={settings.bucketNames[b] || b}
                onChange={e => setSettings({ ...settings, bucketNames: { ...settings.bucketNames, [b]: e.target.value } })} />
            </div>
          ))}
        </div>
      </div>
      <div style={s.card}>
        <h3 style={s.h3}>Province</h3>
        <select style={s.select} value={settings.province} onChange={e => setSettings({ ...settings, province: e.target.value })}>
          {["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {/* ── Plaid Connections ── */}
      <PlaidConnectionsCard theme={theme} />

      <div style={s.card}>
        <h3 style={s.h3}>Auto-Hide Numbers</h3>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Numbers will be hidden after this many minutes of inactivity.</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="number" min={0.5} max={60} step={0.5} style={{ ...s.input, width: 80 }}
            value={settings.autoHideMinutes} onChange={e => setSettings({ ...settings, autoHideMinutes: Math.max(0.5, parseFloat(e.target.value) || 1) })} />
          <span style={{ fontSize: 13, color: C.muted }}>minutes</span>
        </div>
      </div>

      {tabPasswords && (
        <div style={s.card}>
          <h3 style={s.h3}>Tab Passwords</h3>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Set or remove passwords for protected tabs.</div>
          {["networth", "portfolio"].map(t => {
            const label = t === "networth" ? "Net Worth" : "Portfolio";
            const hasPassword = !!tabPasswords[t];
            return (
              <div key={t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}33` }}>
                <div>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: 11, color: hasPassword ? C.green : C.muted, marginLeft: 8 }}>{hasPassword ? "Protected" : "No password"}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {hasPassword && (
                    <button style={{ ...s.btnSm, color: C.red, borderColor: C.red + "44" }}
                      onClick={() => handleRemovePassword(t)}>Remove</button>
                  )}
                  <button style={s.btnSm} onClick={() => {
                    const pw = prompt(hasPassword ? `New password for ${label}:` : `Set password for ${label}:`);
                    if (pw && pw.length > 0) saveTabPasswords({ ...tabPasswords, [t]: pw });
                  }}>{hasPassword ? "Change" : "Set Password"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB — WATCHLIST (Market Watch + Signals)
   ═══════════════════════════════════════════════════════════ */
function WatchlistTab({ data, setData, portData, settings, rates, theme }) {
  const C = themes[theme]; const s = S(theme);
  const watchTickers = data.tickers || [];

  // Derive holdings from portfolio — only tradeable assets (Stock, ETF, Precious Metal)
  const WATCHLIST_TYPES = new Set(["Stock", "ETF", "Precious Metal"]);
  const holdingsMap = useMemo(() => {
    const map = {};
    (portData.holdings || []).forEach(h => {
      if (!h.ticker || h.ticker === "CASH" || !WATCHLIST_TYPES.has(h.type)) return;
      const lots = h.lots || [];
      const totalQty = lots.reduce((s2, l) => s2 + (l.qty || 0), 0);
      const totalCost = lots.reduce((s2, l) => s2 + (l.qty || 0) * (l.costPerUnit || 0), 0);
      const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
      if (map[h.ticker]) {
        map[h.ticker].totalQty += totalQty;
        map[h.ticker].totalCost += totalCost;
        map[h.ticker].avgCost = map[h.ticker].totalQty > 0 ? (map[h.ticker].totalCost) / map[h.ticker].totalQty : 0;
      } else {
        map[h.ticker] = { symbol: h.ticker, name: h.name, totalQty, totalCost, avgCost, type: h.type, currency: h.currency };
      }
    });
    return map;
  }, [portData]);

  // Only show portfolio holdings that are ON the watchlist
  const watchlistSyms = useMemo(() => new Set(watchTickers.map(t => t.symbol)), [watchTickers]);
  const heldSymbols = useMemo(() => Object.keys(holdingsMap).filter(sym => watchlistSyms.has(sym)), [holdingsMap, watchlistSyms]);

  // Group held symbols by asset type
  const heldByType = useMemo(() => {
    const groups = {};
    heldSymbols.forEach(sym => {
      const type = holdingsMap[sym].type || "Other";
      if (!groups[type]) groups[type] = [];
      groups[type].push(sym);
    });
    return groups;
  }, [heldSymbols, holdingsMap]);
  const CRYPTO_SYMS = new Set(["BTC-USD", "ETH-USD"]);
  const METAL_SYMS = new Set(["GC=F", "SI=F"]);
  const DISPLAY_NAMES = { "GC=F": "XAU", "SI=F": "XAG", "BTC-USD": "BTC", "ETH-USD": "ETH" };
  const DISPLAY_SUBS = { "GC=F": "Gold USD", "SI=F": "Silver USD", "BTC-USD": "Bitcoin USD", "ETH-USD": "Ethereum USD" };
  const displaySym = (sym) => DISPLAY_NAMES[sym] || sym;
  const INDEX_ETFS = new Set(["DIA", "QQQ", "VOO"]);
  const pctColor = (sym, pctDown) => {
    if (INDEX_ETFS.has(sym)) return pctDown >= 10 ? C.red : pctDown >= 2 ? C.orange : C.muted;
    return pctDown >= 20 ? C.red : pctDown >= 8 ? C.orange : C.muted;
  };
  const allWatchOnly = useMemo(() => watchTickers.filter(t => !holdingsMap[t.symbol]), [watchTickers, holdingsMap]);
  const cryptoTickers = useMemo(() => allWatchOnly.filter(t => CRYPTO_SYMS.has(t.symbol)), [allWatchOnly]);
  const metalTickers = useMemo(() => allWatchOnly.filter(t => METAL_SYMS.has(t.symbol)), [allWatchOnly]);
  const watchOnly = useMemo(() => allWatchOnly.filter(t => !CRYPTO_SYMS.has(t.symbol) && !METAL_SYMS.has(t.symbol)), [allWatchOnly]);

  // Live state
  const [quotes, setQuotes] = useState({});
  const [technicals, setTechnicals] = useState({});
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [expandedTicker, setExpandedTicker] = useState(null);
  const [holdSort, setHoldSort] = useState({ key: "symbol", dir: 1 });
  const [watchSort, setWatchSort] = useState({ key: "symbol", dir: 1 });
  const [collapsed, setCollapsed] = useState({});

  // All symbols to fetch
  const allSymbols = useMemo(() => {
    const set = new Set([...heldSymbols, ...watchTickers.map(t => t.symbol)]);
    return [...set];
  }, [heldSymbols, watchTickers]);

  const refreshAll = useCallback(async () => {
    if (allSymbols.length === 0) return;
    setLoading(true);
    try {
      const qRes = await fetch(`${PLAID_SERVER}/api/market/quote?symbols=${allSymbols.join(",")}`);
      const qData = await qRes.json();
      const qMap = {};
      (qData.quotes || []).forEach(q => { qMap[q.symbol] = q; });
      setQuotes(qMap);

      const techResults = await Promise.allSettled(
        allSymbols.map(sym => fetch(`${PLAID_SERVER}/api/market/history?symbol=${sym}`).then(r => r.json()))
      );
      const tMap = {};
      techResults.forEach(r => {
        if (r.status === "fulfilled" && r.value?.symbol) tMap[r.value.symbol] = r.value;
      });
      setTechnicals(tMap);
    } catch (err) {
      console.error("Watchlist refresh failed:", err);
    }
    setLoading(false);
  }, [allSymbols]);

  const fetchNews = useCallback(async () => {
    if (allSymbols.length === 0) return;
    setNewsLoading(true);
    try {
      const nRes = await fetch(`${PLAID_SERVER}/api/market/news?symbols=${allSymbols.join(",")}`);
      const nData = await nRes.json();
      setNews(nData.news || []);
    } catch {}
    setNewsLoading(false);
  }, [allSymbols]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  // Buy targets stored per symbol (works for both held + watching)
  const buyTargets = data.buyTargets || {};
  const setBuyTarget = (sym, field, val) => {
    const cur = buyTargets[sym] || {};
    setData({ ...data, buyTargets: { ...buyTargets, [sym]: { ...cur, [field]: val } } });
  };

  const addTicker = () => {
    const sym = addInput.trim().toUpperCase();
    if (!sym || watchTickers.some(t => t.symbol === sym)) { setAddInput(""); return; }
    setData({ ...data, tickers: [...watchTickers, { symbol: sym, notes: "" }] });
    setAddInput("");
  };

  const removeTicker = (sym) => {
    setData({ ...data, tickers: watchTickers.filter(t => t.symbol !== sym) });
  };

  // Action feed — generate callouts for tickers that hit triggers or have good setups
  const actionFeed = useMemo(() => {
    const actions = [];
    const allSyms = [...heldSymbols, ...allWatchOnly.map(t => t.symbol)];
    allSyms.forEach(sym => {
      const q = quotes[sym] || {};
      const tech = technicals[sym];
      const target = buyTargets[sym] || {};
      if (!q.price) return;

      const triggerPct = target.triggerPct || 5;
      const buyAmount = target.buyAmount;
      const shares = buyAmount && q.price ? Math.floor(buyAmount / q.price) : null;
      const h = holdingsMap[sym];
      const name = q.shortName || sym;
      const belowAvg = h && h.avgCost && q.price < h.avgCost;
      const below200 = tech?.signals?.some(sg => sg.includes("Below 200"));
      const below50 = tech?.signals?.some(sg => sg.includes("Below 50"));
      const deathCross = tech?.ema50 && tech?.ema200 && tech.ema50 < tech.ema200;
      const ema8below21 = tech?.signals?.some(sg => sg === "8 EMA < 21 EMA");
      const oversold = tech?.rsi14 < 30;

      // RED warnings — danger signals
      if (deathCross) {
        actions.push({ sym, type: "danger", msg: `${name} — death cross (50 EMA below 200 EMA). Trend is bearish, be cautious.`, score: 10,
          signalTags: [`-${q.pctDown.toFixed(1)}%`, "Death Cross"], isHeld: !!h });
      }
      if (below200) {
        actions.push({ sym, type: "danger", msg: `${name} is below its 200 EMA — long-term trend broken. ${h ? "Watch your position." : "Wait for recovery before entry."}`, score: 8,
          signalTags: [`-${q.pctDown.toFixed(1)}%`, "↓200"], isHeld: !!h });
      }

      // GREEN — avg down opportunity (you hold it + it's below your cost)
      if (belowAvg) {
        const discount = ((h.avgCost - q.price) / h.avgCost * 100).toFixed(1);
        const amtStr = buyAmount ? ` Add $${buyAmount.toLocaleString()} (~${shares} shares).` : "";
        actions.push({ sym, type: "avgdown", msg: `Avg down on ${name} — ${discount}% below your cost of $${h.avgCost.toFixed(2)}.${amtStr}`, score: 7,
          signalTags: [`-${discount}%`], isHeld: true });
      }

      // GREEN — buy the dip (discount from ATH hits trigger)
      if (q.pctDown >= triggerPct && !belowAvg) {
        const amtStr = buyAmount ? ` Add $${buyAmount.toLocaleString()} (~${shares} shares).` : "";
        actions.push({ sym, type: "buy", msg: `Buy the ${name} dip — down ${q.pctDown.toFixed(1)}% from ATH.${amtStr}`, score: 5 + (q.pctDown > 10 ? 2 : 0),
          signalTags: [`-${q.pctDown.toFixed(1)}%`], isHeld: !!h });
      }

      // ORANGE — oversold
      if (oversold && !belowAvg && q.pctDown < triggerPct) {
        actions.push({ sym, type: "buy", msg: `${name} RSI ${tech.rsi14} — oversold at $${q.price.toFixed(2)}. Could be a buying opportunity.`, score: 6,
          signalTags: [`-${q.pctDown.toFixed(1)}%`, "RSI " + tech.rsi14], isHeld: !!h });
      }
    });

    // Dedupe by sym — keep highest score per sym
    const best = {};
    actions.forEach(a => { if (!best[a.sym] || a.score > best[a.sym].score) best[a.sym] = a; });
    // But always include danger warnings even if there's also a buy signal
    const dangers = actions.filter(a => a.type === "danger");
    const others = Object.values(best).filter(a => a.type !== "danger");
    const combined = [...dangers, ...others];
    const seen = new Set();
    const deduped = combined.filter(a => { const key = a.sym + a.type; if (seen.has(key)) return false; seen.add(key); return true; });
    return deduped.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [quotes, technicals, buyTargets, heldSymbols, allWatchOnly, holdingsMap]);

  // AI advice
  const getAdvice = (symbol, avgCost) => {
    const q = quotes[symbol];
    const tech = technicals[symbol];
    if (!q) return "No data yet — refresh to load.";
    const parts = [];
    parts.push(`${q.shortName || symbol} at $${q.price.toFixed(2)}, ${q.pctDown.toFixed(1)}% below 52-week high of $${q.ath.toFixed(2)}.`);
    if (avgCost && q.price < avgCost) {
      parts.push(`Trading ${((avgCost - q.price) / avgCost * 100).toFixed(1)}% below your avg cost of $${avgCost.toFixed(2)}.`);
    } else if (avgCost) {
      parts.push(`Trading ${((q.price - avgCost) / avgCost * 100).toFixed(1)}% above your avg cost of $${avgCost.toFixed(2)}.`);
    }
    if (tech) {
      const bearish = tech.signals.filter(sg => sg.includes("Below") || sg.includes("Oversold") || sg.includes("<"));
      const bullish = tech.signals.filter(sg => sg.includes("Above") || sg.includes("Overbought") || sg.includes(">"));
      if (bearish.length > bullish.length) parts.push(`Bearish: ${bearish.join(", ")}. Weakness — potential buy if thesis intact.`);
      else if (bullish.length > bearish.length) parts.push(`Bullish: ${bullish.join(", ")}. Momentum positive.`);
      else parts.push(`Mixed signals: ${tech.signals.join(", ")}.`);
      if (tech.rsi14) {
        if (tech.rsi14 < 30) parts.push(`Weekly RSI ${tech.rsi14} — oversold.`);
        else if (tech.rsi14 > 70) parts.push(`Weekly RSI ${tech.rsi14} — overbought.`);
      }
    }
    return parts.join(" ");
  };

  // Sorting helpers
  const doSort = (items, sortState, getValue) => {
    return [...items].sort((a, b) => {
      const va = getValue(a, sortState.key);
      const vb = getValue(b, sortState.key);
      if (typeof va === "string") return va.localeCompare(vb) * sortState.dir;
      return ((va || 0) - (vb || 0)) * sortState.dir;
    });
  };

  const toggleSort = (setter, key) => {
    setter(prev => prev.key === key ? { key, dir: -prev.dir } : { key, dir: 1 });
  };

  const SortTh = ({ sort, setSort, k, label, align }) => (
    <th style={{ ...s.th, textAlign: align || "left", cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort(setSort, k)}>
      {label} {sort.key === k ? (sort.dir > 0 ? "▲" : "▼") : ""}
    </th>
  );

  const sortedHeld = useMemo(() => doSort(heldSymbols, holdSort, (sym, key) => {
    const q = quotes[sym] || {};
    const h = holdingsMap[sym] || {};
    const gainPct = h.avgCost && q.price ? ((q.price - h.avgCost) / h.avgCost * 100) : -999;
    switch (key) {
      case "symbol": return sym;
      case "price": return q.price || 0;
      case "pctDown": return q.pctDown || 0;
      case "pctUp": return q.pctUp || 0;
      case "changePct": return q.changePct || 0;
      case "avgCost": return h.avgCost || 0;
      case "gainLoss": return gainPct;
      default: return sym;
    }
  }), [heldSymbols, holdSort, quotes, holdingsMap]);

  const sortedWatch = useMemo(() => doSort(watchOnly, watchSort, (t, key) => {
    const q = quotes[t.symbol] || {};
    switch (key) {
      case "symbol": return t.symbol;
      case "price": return q.price || 0;
      case "pctDown": return q.pctDown || 0;
      case "pctUp": return q.pctUp || 0;
      case "changePct": return q.changePct || 0;
      default: return t.symbol;
    }
  }), [watchOnly, watchSort, quotes]);

  // Signal badge helper
  const SignalBadges = ({ symbol }) => {
    const tech = technicals[symbol];
    if (!tech) return <span style={{ fontSize: 11, color: C.muted }}>—</span>;
    return (
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {tech.signals.slice(0, 3).map(sig => {
          const short = sig === "8 EMA > 21 EMA" ? "8>21" : sig === "8 EMA < 21 EMA" ? "8<21" : sig.replace("Above ", "↑").replace("Below ", "↓").replace(" EMA", "").replace("Weekly ", "");
          const isBear = sig.includes("Below") || sig.includes("Oversold") || sig.includes("<");
          const isBull = sig.includes("Above") || sig.includes("Overbought") || sig.includes(">");
          const color = isBear ? C.red : isBull ? C.green : C.muted;
          return <span key={sig} style={{ background: color + "18", color, padding: "1px 6px", borderRadius: 10, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>{short}</span>;
        })}
      </div>
    );
  };

  // Expanded row helper
  const ExpandedRow = ({ symbol, avgCost, colSpan }) => {
    const q = quotes[symbol] || {};
    const tech = technicals[symbol];
    return (
      <tr>
        <td colSpan={colSpan} style={{ padding: "12px 16px", background: C.bg2, borderBottom: `1px solid ${C.border}` }}>
          <div className="mc-flex-row" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Technical Indicators</div>
              {tech ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", fontSize: 13 }}>
                  {[["8 EMA", tech.ema8], ["21 EMA", tech.ema21], ["50 EMA", tech.ema50], ["200 EMA", tech.ema200]].map(([label, val]) => (
                    <React.Fragment key={label}>
                      <span style={{ color: C.muted }}>{label}</span>
                      <span style={{ color: val && q.price > val ? C.green : C.red, fontFamily: "'SF Mono', monospace" }}>
                        {val ? "$" + val.toFixed(2) : "—"}
                      </span>
                    </React.Fragment>
                  ))}
                  <span style={{ color: C.muted }}>Weekly RSI</span>
                  <span style={{ color: tech.rsi14 < 30 ? C.green : tech.rsi14 > 70 ? C.red : C.text, fontWeight: 600 }}>{tech.rsi14 || "—"}</span>
                </div>
              ) : <span style={{ fontSize: 12, color: C.muted }}>Loading...</span>}
              <div style={{ marginTop: 8 }}>
                {tech && tech.signals.map(sig => {
                  const isBear = sig.includes("Below") || sig.includes("Oversold") || sig.includes("<");
                  const isBull = sig.includes("Above") || sig.includes("Overbought") || sig.includes(">");
                  const color = isBear ? C.red : isBull ? C.green : C.muted;
                  return <span key={sig} style={{ ...s.badge(color), marginRight: 4, marginBottom: 4 }}>{sig}</span>;
                })}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>AI Analysis</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
                {getAdvice(symbol, avgCost)}
              </div>
              {/* Buy targets */}
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}33` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Buy Target</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ fontSize: 12, color: C.muted }}>Amount $</label>
                  <input type="number" step="100" value={(buyTargets[symbol]?.buyAmount) || ""} placeholder="e.g. 5000"
                    onChange={e => setBuyTarget(symbol, "buyAmount", parseFloat(e.target.value) || null)}
                    style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, width: 90, padding: "3px 6px", fontSize: 13, fontFamily: "'SF Mono', monospace", outline: "none" }} />
                  <label style={{ fontSize: 12, color: C.muted }}>Trigger %</label>
                  <input type="number" step="1" min="1" max="50" value={(buyTargets[symbol]?.triggerPct) || ""} placeholder="5"
                    onChange={e => setBuyTarget(symbol, "triggerPct", parseFloat(e.target.value) || null)}
                    style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, width: 60, padding: "3px 6px", fontSize: 13, fontFamily: "'SF Mono', monospace", outline: "none" }} />
                  {buyTargets[symbol]?.buyAmount && q.price ? (
                    <span style={{ fontSize: 12, color: C.green }}>= {Math.floor(buyTargets[symbol].buyAmount / q.price)} shares</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  // Stats
  const allTech = [...heldSymbols, ...watchOnly.map(t => t.symbol)];
  const buySignals = allTech.filter(sym => {
    const tech = technicals[sym];
    return tech && tech.signals.some(sg => sg.includes("Oversold") || sg.includes("Below 200"));
  }).length;
  const oversold = allTech.filter(sym => technicals[sym]?.rsi14 < 30).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h2 style={s.h2}>Watchlist</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input value={addInput} onChange={e => setAddInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && addTicker()}
            placeholder="Watch a ticker..." style={{ ...s.input, width: 160 }} />
          <button onClick={addTicker} style={s.btn}>Add</button>
          <button onClick={refreshAll} disabled={loading} style={s.btnSm}>{loading ? "Loading..." : "Refresh"}</button>
          <button onClick={fetchNews} disabled={newsLoading} style={s.btnSm}>{newsLoading ? "Loading..." : "News"}</button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mc-stat-row" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Holdings" value={heldSymbols.length} sub="from portfolio" C={C} />
        <StatCard label="Watching" value={watchOnly.length} sub="no position" C={C} />
        <StatCard label="Buy Signals" value={buySignals} sub="oversold or below 200 EMA" color={buySignals > 0 ? C.green : C.muted} C={C} />
        <StatCard label="RSI Oversold" value={oversold} sub="weekly RSI < 30" color={oversold > 0 ? C.orange : C.muted} C={C} />
      </div>

      {/* ═══ ACTION FEED ═══ */}
      {actionFeed.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ ...s.h3, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
            onClick={() => setCollapsed(prev => ({ ...prev, opportunities: !prev.opportunities }))}>
            <span style={{ fontSize: 12, transition: "transform 0.2s", transform: collapsed.opportunities ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
            <span style={{ fontSize: 14 }}>💡</span> Opportunities
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{actionFeed.length} actions</span>
          </h3>
          {!collapsed.opportunities && <div style={{ ...s.card, padding: "10px 14px" }}>
            {actionFeed.map((a, i) => {
              const pctTag = a.signalTags.find(t => t.startsWith("-"));
              const otherTags = a.signalTags.filter(t => !t.startsWith("-"));
              const pctVal = pctTag ? parseFloat(pctTag) : 0;
              const pctClr = pctColor(a.sym, Math.abs(pctVal));
              return (
                <div key={a.sym + a.type} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: i < actionFeed.length - 1 ? `1px solid ${C.border}15` : "none", fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: C.accent, minWidth: 50 }}>{displaySym(a.sym)}</span>
                  {pctTag && <span style={{ color: pctClr, fontWeight: 600, fontSize: 11, minWidth: 45 }}>{pctTag}</span>}
                  {otherTags.map(tag => (
                    <span key={tag} style={{ background: C.card2, color: C.muted, padding: "0 5px", borderRadius: 8, fontSize: 9, fontWeight: 600, whiteSpace: "nowrap" }}>{tag}</span>
                  ))}
                  <span style={{ color: C.text, flex: 1 }}>{a.msg}</span>
                </div>
              );
            })}
          </div>}
        </div>
      )}

      {/* ═══ SECTION 1: MY HOLDINGS — grouped by type ═══ */}
      {["ETF", "Stock", "Precious Metal"].filter(type => heldByType[type]?.length > 0).map(type => {
        const typeIcons = { ETF: "📈", Stock: "🏢", "Precious Metal": "🥇" };
        const symsForType = doSort(heldByType[type], holdSort, (sym, key) => {
          const q2 = quotes[sym] || {};
          const h2 = holdingsMap[sym] || {};
          const gp = h2.avgCost && q2.price ? ((q2.price - h2.avgCost) / h2.avgCost * 100) : -999;
          switch (key) {
            case "symbol": return sym;
            case "price": return q2.price || 0;
            case "pctDown": return q2.pctDown || 0;
            case "pctUp": return q2.pctUp || 0;
            case "changePct": return q2.changePct || 0;
            case "avgCost": return h2.avgCost || 0;
            case "gainLoss": return gp;
            default: return sym;
          }
        });
        return (
          <div key={type} style={{ marginBottom: 20 }}>
            <h3 style={{ ...s.h3, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
              onClick={() => setCollapsed(prev => ({ ...prev, [type]: !prev[type] }))}>
              <span style={{ fontSize: 12, transition: "transform 0.2s", transform: collapsed[type] ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
              <span style={{ fontSize: 14 }}>{typeIcons[type] || "💼"}</span> {type}s
              <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{symsForType.length} holdings</span>
            </h3>
            {!collapsed[type] && <div className="mc-table-wrap" style={{ ...s.card, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <SortTh sort={holdSort} setSort={setHoldSort} k="symbol" label="Ticker" />
                    <SortTh sort={holdSort} setSort={setHoldSort} k="pctDown" label="% Down" align="right" />
                    <SortTh sort={holdSort} setSort={setHoldSort} k="pctUp" label="% Up to ATH" align="right" />
                    <SortTh sort={holdSort} setSort={setHoldSort} k="price" label="Price" align="right" />
                    <th style={{ ...s.th, textAlign: "right" }}>ATH</th>
                    <SortTh sort={holdSort} setSort={setHoldSort} k="changePct" label="% Change" align="right" />
                    <SortTh sort={holdSort} setSort={setHoldSort} k="avgCost" label="Avg Cost" align="right" />
                    <SortTh sort={holdSort} setSort={setHoldSort} k="gainLoss" label="Gain/Loss" align="right" />
                    <th style={s.th}>Signals</th>
                  </tr>
                </thead>
                <tbody>
                  {symsForType.map(sym => {
                    const h = holdingsMap[sym];
                    const q = quotes[sym] || {};
                    const gainPct = h.avgCost && q.price ? ((q.price - h.avgCost) / h.avgCost * 100) : null;
                    const isExpanded = expandedTicker === sym;
                    return (
                      <React.Fragment key={sym}>
                        <tr style={{ cursor: "pointer" }} onClick={() => setExpandedTicker(isExpanded ? null : sym)}>
                          <td style={s.td}>
                            <span style={{ fontWeight: 700, color: C.accent }}>{displaySym(sym)}</span>
                            <div style={{ fontSize: 10, color: C.muted }}>{DISPLAY_SUBS[sym] || h.name}</div>
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontWeight: 600, color: pctColor(sym, q.pctDown) }}>
                            {q.pctDown != null ? "-" + q.pctDown.toFixed(2) + "%" : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontWeight: 600, color: C.green }}>
                            {q.pctUp != null ? q.pctUp.toFixed(2) + "%" : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontFamily: "'SF Mono', monospace" }}>
                            {q.price ? "$" + q.price.toFixed(2) : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontFamily: "'SF Mono', monospace", color: C.muted }}>
                            {q.ath ? "$" + q.ath.toFixed(2) : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontWeight: 600, color: (q.changePct || 0) >= 0 ? C.green : C.red }}>
                            {q.changePct != null ? (q.changePct >= 0 ? "+" : "") + q.changePct.toFixed(2) + "%" : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontFamily: "'SF Mono', monospace", color: C.muted }}>
                            {h.avgCost ? "$" + h.avgCost.toFixed(2) : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontWeight: 700, color: gainPct != null ? (gainPct >= 0 ? C.green : C.red) : C.muted }}>
                            {gainPct != null ? (gainPct >= 0 ? "+" : "") + gainPct.toFixed(2) + "%" : "—"}
                          </td>
                          <td style={{ ...s.td, maxWidth: 160 }}>
                            <SignalBadges symbol={sym} />
                          </td>
                        </tr>
                        {isExpanded && <ExpandedRow symbol={sym} avgCost={h.avgCost} colSpan={9} />}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>}
          </div>
        );
      })}

      {/* ═══ WATCH SECTIONS: Crypto, Metals, Watching ═══ */}
      {[
        { key: "crypto", icon: "₿", label: "Crypto", items: cryptoTickers },
        { key: "metals", icon: "🥇", label: "Metals", items: metalTickers },
        { key: "watching", icon: "🔭", label: "Watching", items: watchOnly },
      ].filter(sec => sec.items.length > 0).map(sec => {
        const sorted = doSort(sec.items, watchSort, (t, key) => {
          const q2 = quotes[t.symbol] || {};
          switch (key) {
            case "symbol": return t.symbol;
            case "price": return q2.price || 0;
            case "pctDown": return q2.pctDown || 0;
            case "pctUp": return q2.pctUp || 0;
            case "changePct": return q2.changePct || 0;
            default: return t.symbol;
          }
        });
        return (
          <div key={sec.key} style={{ marginBottom: 24 }}>
            <h3 style={{ ...s.h3, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
              onClick={() => setCollapsed(prev => ({ ...prev, [sec.key]: !prev[sec.key] }))}>
              <span style={{ fontSize: 12, transition: "transform 0.2s", transform: collapsed[sec.key] ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
              <span style={{ fontSize: 14 }}>{sec.icon}</span> {sec.label}
              <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{sec.items.length} tickers</span>
            </h3>
            {!collapsed[sec.key] && <div className="mc-table-wrap" style={{ ...s.card, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <SortTh sort={watchSort} setSort={setWatchSort} k="symbol" label="Ticker" />
                    <SortTh sort={watchSort} setSort={setWatchSort} k="pctDown" label="% Down" align="right" />
                    <SortTh sort={watchSort} setSort={setWatchSort} k="pctUp" label="% Up to ATH" align="right" />
                    <SortTh sort={watchSort} setSort={setWatchSort} k="price" label="Price" align="right" />
                    <th style={{ ...s.th, textAlign: "right" }}>ATH</th>
                    <SortTh sort={watchSort} setSort={setWatchSort} k="changePct" label="% Change" align="right" />
                    <th style={s.th}>Signals</th>
                    <th style={{ ...s.th, width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(t => {
                    const q = quotes[t.symbol] || {};
                    const isExpanded = expandedTicker === t.symbol;
                    return (
                      <React.Fragment key={t.symbol}>
                        <tr style={{ cursor: "pointer" }} onClick={() => setExpandedTicker(isExpanded ? null : t.symbol)}>
                          <td style={s.td}>
                            <span style={{ fontWeight: 700, color: C.accent }}>{displaySym(t.symbol)}</span>
                            <div style={{ fontSize: 10, color: C.muted }}>{DISPLAY_SUBS[t.symbol] || q.shortName || ""}</div>
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontWeight: 600, color: pctColor(t.symbol, q.pctDown) }}>
                            {q.pctDown != null ? "-" + q.pctDown.toFixed(2) + "%" : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontWeight: 600, color: C.green }}>
                            {q.pctUp != null ? q.pctUp.toFixed(2) + "%" : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontFamily: "'SF Mono', monospace" }}>
                            {q.price ? "$" + q.price.toFixed(2) : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontFamily: "'SF Mono', monospace", color: C.muted }}>
                            {q.ath ? "$" + q.ath.toFixed(2) : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontWeight: 600, color: (q.changePct || 0) >= 0 ? C.green : C.red }}>
                            {q.changePct != null ? (q.changePct >= 0 ? "+" : "") + q.changePct.toFixed(2) + "%" : "—"}
                          </td>
                          <td style={{ ...s.td, maxWidth: 160 }}>
                            <SignalBadges symbol={t.symbol} />
                          </td>
                          <td style={{ ...s.td, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => removeTicker(t.symbol)} style={s.btnDanger} title="Remove">✕</button>
                          </td>
                        </tr>
                        {isExpanded && <ExpandedRow symbol={t.symbol} colSpan={8} />}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>}
          </div>
        );
      })}

      {heldSymbols.length === 0 && watchOnly.length === 0 && (
        <div style={{ ...s.card, textAlign: "center", padding: 48, color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔭</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>No tickers yet</div>
          <div style={{ fontSize: 13 }}>Add tickers above to watch, and holdings from your Portfolio tab will appear automatically.</div>
        </div>
      )}

      {/* News */}
      {news.length > 0 && (
        <div style={{ ...s.card, marginTop: 16 }}>
          <h3 style={s.h3}>Recent News</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {news.map((n, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: i < news.length - 1 ? `1px solid ${C.border}33` : "none", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <a href={n.url} target="_blank" rel="noopener noreferrer"
                    style={{ color: C.accent, fontSize: 13, fontWeight: 500, textDecoration: "none" }}>{n.title}</a>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {n.publisher} {n.date ? "· " + new Date(n.date).toLocaleDateString() : ""} · {n.relatedTicker}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB 4 — FINANCE CHAT (AI Advisor)
   ═══════════════════════════════════════════════════════════ */
function FinanceChatTab({ nwData, portData, cfData, settings, rates, theme }) {
  const C = themes[theme]; const s = S(theme);
  const [messages, setMessages] = useState([
    { id: uid(), role: "ai", text: "Hey Jacqueline! I'm your MoneyClaw finance advisor. I can see all your data — ask me anything about your net worth, portfolio, spending, budgets, or goals. Try questions like:\n\n• \"What's my net worth after tax?\"\n• \"How's my portfolio allocated?\"\n• \"Am I over budget this month?\"\n• \"What should I buy or sell to hit my targets?\"\n• \"Is my portfolio too risky?\"\n• \"Where am I spending the most?\"" }
  ]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  /* ── Build financial context from all app data ── */
  const getContext = () => {
    const snaps = nwData?.snapshots || [];
    const latestSnap = snaps[0];
    const prevSnap = snaps[1];
    const holdings = portData?.holdings || [];
    const txns = cfData?.transactions || [];
    const budgets = cfData?.budgets || [];

    /* Net worth */
    const computeNW = (snap) => {
      if (!snap) return { total: 0, corp: 0, personal: 0, afterTax: 0, afterTaxHigh: 0, buckets: {} };
      const buckets = {};
      snap.items.forEach(i => {
        const val = Number(i.value || 0) * (i.isLiability ? -1 : 1);
        buckets[i.bucket] = (buckets[i.bucket] || 0) + val;
      });
      const corp = (buckets.Opco || 0) + (buckets.Holdco || 0);
      const personal = (buckets.Jon || 0) + (buckets.Jacqueline || 0);
      const deductions = (snap.deductions || []).reduce((s, d) => s + Number(d.value || 0), 0);
      const corpAfterDed = corp - deductions;
      const taxHit = Math.max(0, corpAfterDed) * (settings.taxRateIneligible / 100);
      const afterTax = corpAfterDed - taxHit + personal;
      const highTaxRate = settings.highTaxRate || 20;
      const taxHitHigh = Math.max(0, corpAfterDed) * (highTaxRate / 100);
      const afterTaxHigh = corpAfterDed - taxHitHigh + personal;
      return { total: corp + personal, corp, personal, afterTax, afterTaxHigh, taxHit, taxHitHigh, deductions, corpAfterDed, buckets };
    };
    const nw = computeNW(latestSnap);
    const prevNw = computeNW(prevSnap);
    const nwChange = nw.afterTax - prevNw.afterTax;

    /* Portfolio */
    const enrichedHoldings = holdings.map(h => {
      const lots = h.lots || [];
      const totalQty = lots.reduce((s, l) => s + l.qty, 0);
      const totalCost = lots.reduce((s, l) => s + l.qty * l.costPerUnit, 0);
      const currentPrice = lots[0]?.currentPrice || 0;
      const currentValue = totalQty * currentPrice;
      const valueCAD = toBase(currentValue, h.currency, rates);
      const costCAD = toBase(totalCost, h.currency, rates);
      const gain = valueCAD - costCAD;
      const gainPct = costCAD > 0 ? gain / costCAD : 0;
      return { ...h, totalQty, totalCost, currentValue, valueCAD, costCAD, gain, gainPct, currentPrice };
    });
    const totalPortValue = enrichedHoldings.reduce((s, h) => s + h.valueCAD, 0);
    const totalPortCost = enrichedHoldings.reduce((s, h) => s + h.costCAD, 0);
    const totalPortGain = totalPortValue - totalPortCost;

    const byType = {};
    enrichedHoldings.forEach(h => { byType[h.type] = (byType[h.type] || 0) + h.valueCAD; });
    const allocation = Object.entries(byType).map(([type, val]) => ({ type, value: val, pct: totalPortValue > 0 ? val / totalPortValue * 100 : 0 })).sort((a, b) => b.value - a.value);

    /* Targets */
    const targetActions = enrichedHoldings.filter(h => h.targetType && h.targetValue).map(h => {
      let targetCAD = 0;
      if (h.targetType === "dollars") targetCAD = toBase(h.targetValue, h.currency, rates);
      else if (h.targetType === "percentage") targetCAD = totalPortValue * (h.targetValue / 100);
      else if (h.targetType === "shares") targetCAD = h.targetValue * h.currentPrice;
      const diff = targetCAD - h.valueCAD;
      return { name: h.name, diff, action: diff > 0 ? "Buy" : "Sell", amount: Math.abs(diff) };
    }).filter(t => Math.abs(t.diff) > 100);

    /* Cash flow */
    const currentMonth = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; })();
    const monthTxns = txns.filter(t => toMonthKey(t.date) === currentMonth && !t.isTransfer);
    const monthIncome = monthTxns.filter(t => t.type === "income").reduce((s, t) => s + toBase(t.amount, t.currency || "CAD", rates), 0);
    const monthExpenses = monthTxns.filter(t => t.type === "expense").reduce((s, t) => s + toBase(t.amount, t.currency || "CAD", rates), 0);

    /* Spending by category */
    const spendByCat = {};
    monthTxns.filter(t => t.type === "expense").forEach(t => {
      spendByCat[t.category] = (spendByCat[t.category] || 0) + toBase(t.amount, t.currency || "CAD", rates);
    });
    const topSpending = Object.entries(spendByCat).sort((a, b) => b[1] - a[1]).slice(0, 5);

    /* Budget status */
    const budgetStatus = budgets.map(b => {
      const spent = monthTxns.filter(t => t.type === "expense" && t.bucket === b.bucket && t.category === b.category)
        .reduce((s, t) => s + toBase(t.amount, t.currency || "CAD", rates), 0);
      return { ...b, spent, over: spent > b.monthlyLimit };
    });
    const overBudget = budgetStatus.filter(b => b.over);

    return { nw, prevNw, nwChange, enrichedHoldings, totalPortValue, totalPortCost, totalPortGain, allocation, targetActions, monthIncome, monthExpenses, topSpending, budgetStatus, overBudget, currentMonth, latestSnap };
  };

  /* ── AI response engine ── */
  const generateResponse = (question) => {
    const q = question.toLowerCase();
    const ctx = getContext();

    /* Net worth questions */
    if (q.includes("net worth") || q.includes("worth") || q.includes("total") && (q.includes("asset") || q.includes("how much"))) {
      const chg = ctx.nwChange;
      return `Your adjusted net worth range is **${fmtFull(ctx.nw.afterTax)} – ${fmtFull(ctx.nw.afterTaxHigh)} CAD**.\n\n**Low (Conservative):** ${settings.taxRateIneligible}% tax\n**High (Optimistic):** ${settings.highTaxRate || 20}% tax\n\nBreakdown:\n• Corporate (Opco + Holdco): ${fmtFull(ctx.nw.corp)}\n• Deductions: -${fmtFull(ctx.nw.deductions)}\n• Corp after deductions: ${fmtFull(ctx.nw.corpAfterDed)}\n• Tax haircut: -${fmtFull(ctx.nw.taxHit)} (low) / -${fmtFull(ctx.nw.taxHitHigh)} (high)\n• Personal: ${fmtFull(ctx.nw.personal)}\n\nGross: ${fmtFull(ctx.nw.total)}\n\n${ctx.prevNw.afterTax > 0 ? `That's ${chg >= 0 ? "up" : "down"} ${fmtFull(Math.abs(chg))} from last month (${chg >= 0 ? "+" : ""}${(chg / Math.abs(ctx.prevNw.afterTax) * 100).toFixed(1)}%).` : ""}`;
    }

    /* Portfolio allocation / risk */
    if (q.includes("allocat") || q.includes("risk") || q.includes("conservative") || q.includes("diversif") || q.includes("portfolio")) {
      const alloc = ctx.allocation;
      let allocStr = alloc.map(a => `• ${a.type}: ${fmtFull(a.value)} (${a.pct.toFixed(1)}%)`).join("\n");

      let riskAssessment = "";
      const stocksPct = alloc.filter(a => ["Stocks", "ETFs"].includes(a.type)).reduce((s, a) => s + a.pct, 0);
      const bondsPct = alloc.filter(a => a.type === "Bonds").reduce((s, a) => s + a.pct, 0);
      const metalsPct = alloc.filter(a => a.type === "Precious Metals").reduce((s, a) => s + a.pct, 0);
      const cryptoPct = alloc.filter(a => a.type === "Crypto").reduce((s, a) => s + a.pct, 0);

      if (stocksPct + cryptoPct > 70) riskAssessment = "Your portfolio leans **aggressive** — over 70% in equities and crypto. Good for growth but volatile.";
      else if (bondsPct > 40) riskAssessment = "Your portfolio is on the **conservative** side with a heavy bond allocation. Stable but may underperform in bull markets.";
      else if (stocksPct > 30 && bondsPct > 20 && metalsPct > 5) riskAssessment = "Your portfolio looks **well-balanced** — a solid mix of equities, bonds, and hard assets. This is a defensive-growth posture.";
      else riskAssessment = "Your portfolio is **moderately positioned**. Consider whether your allocation matches your time horizon and risk tolerance.";

      let insights = [];
      if (metalsPct > 15) insights.push(`Precious metals are ${metalsPct.toFixed(0)}% of your portfolio — that's a strong inflation/crisis hedge, which is smart but quite heavy.`);
      if (cryptoPct > 10) insights.push(`Crypto at ${cryptoPct.toFixed(0)}% adds significant volatility. Consider if you're comfortable with 50%+ swings in that portion.`);
      if (bondsPct > 30) insights.push(`Your bond allocation at ${bondsPct.toFixed(0)}% provides stability. With rates potentially shifting, consider duration exposure.`);
      if (stocksPct < 20) insights.push(`Equities are only ${stocksPct.toFixed(0)}% — you might be leaving long-term growth on the table.`);

      return `**Portfolio: ${fmtFull(ctx.totalPortValue)} CAD**\n\n${allocStr}\n\n**Risk Assessment:** ${riskAssessment}\n\n${insights.length > 0 ? "**Observations:**\n" + insights.map(i => "• " + i).join("\n") : ""}\n\nTotal gain/loss: ${ctx.totalPortGain >= 0 ? "+" : ""}${fmtFull(ctx.totalPortGain)} (${ctx.totalPortCost > 0 ? (ctx.totalPortGain >= 0 ? "+" : "") + (ctx.totalPortGain / ctx.totalPortCost * 100).toFixed(1) + "%" : "N/A"})`;
    }

    /* Buy/sell targets */
    if (q.includes("target") || q.includes("rebalanc") || q.includes("buy") || q.includes("sell") || q.includes("should i")) {
      if (ctx.targetActions.length === 0) return "All your holdings are within their target allocations right now. Nothing to rebalance.";
      const buys = ctx.targetActions.filter(t => t.action === "Buy");
      const sells = ctx.targetActions.filter(t => t.action === "Sell");
      let resp = "**Rebalancing Actions to Hit Your Targets:**\n\n";
      if (buys.length) resp += "**Buy:**\n" + buys.map(t => `• ${t.name}: add ${fmtFull(t.amount)}`).join("\n") + "\n\n";
      if (sells.length) resp += "**Sell:**\n" + sells.map(t => `• ${t.name}: trim ${fmtFull(t.amount)}`).join("\n");
      return resp;
    }

    /* Budget */
    if (q.includes("budget") || q.includes("over budget") || q.includes("spending limit")) {
      if (ctx.budgetStatus.length === 0) return "You don't have any budgets set up yet. Head to the Income & Expenses tab to create some.";
      const over = ctx.overBudget;
      let resp = `**Budget Status for ${monthLabel(ctx.currentMonth)}:**\n\n`;
      resp += ctx.budgetStatus.map(b => {
        const pct = b.monthlyLimit > 0 ? (b.spent / b.monthlyLimit * 100).toFixed(0) : 0;
        const status = b.over ? "⚠ OVER" : Number(pct) > 80 ? "⚡ Close" : "✅ OK";
        return `• ${b.bucket} / ${b.category}: ${fmtFull(b.spent)} of ${fmtFull(b.monthlyLimit)} (${pct}%) ${status}`;
      }).join("\n");
      if (over.length) resp += `\n\n⚠ You're over budget on ${over.length} categor${over.length > 1 ? "ies" : "y"}. Keep an eye on: ${over.map(o => o.category).join(", ")}.`;
      return resp;
    }

    /* Spending */
    if (q.includes("spend") || q.includes("expense") || q.includes("where") && q.includes("money")) {
      if (ctx.topSpending.length === 0) return "No expenses recorded for this month yet.";
      return `**Top Spending This Month (${monthLabel(ctx.currentMonth)}):**\n\n${ctx.topSpending.map(([cat, val]) => `• ${cat}: ${fmtFull(val)}`).join("\n")}\n\nTotal expenses: ${fmtFull(ctx.monthExpenses)}\nTotal income: ${fmtFull(ctx.monthIncome)}\nNet cash flow: ${ctx.monthIncome - ctx.monthExpenses >= 0 ? "+" : ""}${fmtFull(ctx.monthIncome - ctx.monthExpenses)}`;
    }

    /* Income */
    if (q.includes("income") || q.includes("earn") || q.includes("revenue") || q.includes("cash flow")) {
      return `**Cash Flow for ${monthLabel(ctx.currentMonth)}:**\n\nIncome: ${fmtFull(ctx.monthIncome)}\nExpenses: ${fmtFull(ctx.monthExpenses)}\nNet: ${ctx.monthIncome - ctx.monthExpenses >= 0 ? "+" : ""}${fmtFull(ctx.monthIncome - ctx.monthExpenses)}\n\n${ctx.monthIncome > ctx.monthExpenses ? "You're cash-flow positive this month." : "Expenses are exceeding income this month — worth reviewing the expense breakdown."}`;
    }

    /* Tax */
    if (q.includes("tax") || q.includes("reserve") || q.includes("set aside") || q.includes("owe")) {
      return `**Tax Reserve Summary:**\n\nCorporate assets: ${fmtFull(ctx.nw.corp)}\nDeductions removed first: -${fmtFull(ctx.nw.deductions)}\nCorp after deductions: ${fmtFull(ctx.nw.corpAfterDed)}\n\n**Low (${settings.taxRateIneligible}% tax):** haircut -${fmtFull(ctx.nw.taxHit)} → NW ${fmtFull(ctx.nw.afterTax)}\n**High (${settings.highTaxRate || 20}% tax):** haircut -${fmtFull(ctx.nw.taxHitHigh)} → NW ${fmtFull(ctx.nw.afterTaxHigh)}\n\nDeductions come off corp first, then the tax haircut applies to what's left.`;
    }

    /* Holdings detail */
    if (q.includes("holding") || q.includes("position") || q.includes("stock") || q.includes("investment")) {
      if (ctx.enrichedHoldings.length === 0) return "No portfolio holdings recorded yet.";
      return `**All Holdings (${ctx.enrichedHoldings.length}):**\n\n${ctx.enrichedHoldings.sort((a, b) => b.valueCAD - a.valueCAD).map(h => `• **${h.name}** (${h.bucket}): ${fmtFull(h.valueCAD)} — ${h.gain >= 0 ? "+" : ""}${fmtFull(h.gain)} (${h.gain >= 0 ? "+" : ""}${(h.gainPct * 100).toFixed(1)}%)`).join("\n")}\n\nTotal: ${fmtFull(ctx.totalPortValue)}`;
    }

    /* Goals */
    if (q.includes("goal") || q.includes("milestone") || q.includes("track") || q.includes("progress")) {
      const goals = nwData?.goals || [];
      if (goals.length === 0) return "No financial goals set yet. You can add milestones in the Net Worth tab.";
      return `**Financial Goals:**\n\n${goals.map(g => {
        const pctDoneLow = ctx.nw.afterTax / g.target * 100;
        const pctDoneHigh = ctx.nw.afterTaxHigh / g.target * 100;
        return `• ${g.name}: ${fmtFull(ctx.nw.afterTax)} – ${fmtFull(ctx.nw.afterTaxHigh)} / ${fmtFull(g.target)} (${pctDoneLow.toFixed(1)}% – ${pctDoneHigh.toFixed(1)}%)\n  ${pctDoneHigh >= 100 ? "🎉 Goal reached (high estimate)!" : `${fmtFull(g.target - ctx.nw.afterTaxHigh)} – ${fmtFull(g.target - ctx.nw.afterTax)} to go`}`;
      }).join("\n")}`;
    }

    /* Savings / cut expenses */
    if (q.includes("save") || q.includes("cut") || q.includes("reduce") || q.includes("saving") || q.includes("trim")) {
      const topCats = ctx.topSpending;
      if (topCats.length === 0) return "No expense data this month to analyze. Upload some bank statements first.";
      const totalExp = ctx.monthExpenses;
      const savingsRate = ctx.monthIncome > 0 ? ((ctx.monthIncome - totalExp) / ctx.monthIncome * 100).toFixed(1) : 0;

      let advice = `**Savings Analysis for ${monthLabel(ctx.currentMonth)}:**\n\nIncome: ${fmtFull(ctx.monthIncome)}\nExpenses: ${fmtFull(totalExp)}\nSavings rate: **${savingsRate}%**\n\n`;

      if (Number(savingsRate) >= 30) advice += "Your savings rate is excellent (30%+). You're in a strong position.\n\n";
      else if (Number(savingsRate) >= 15) advice += "Your savings rate is decent but there may be room to improve. Target 25-30%.\n\n";
      else if (Number(savingsRate) > 0) advice += "⚠ Your savings rate is low. Here are areas to look at:\n\n";
      else advice += "⚠ You're spending more than you earn this month. Here's where to cut:\n\n";

      advice += "**Biggest spending categories:**\n";
      topCats.forEach(([cat, val]) => {
        const pctOfTotal = (val / totalExp * 100).toFixed(0);
        advice += `• ${cat}: ${fmtFull(val)} (${pctOfTotal}% of expenses)`;
        if (cat.includes("Dining") || cat.includes("Entertainment")) advice += " ← discretionary, easiest to trim";
        if (cat.includes("Subscription")) advice += " ← audit for unused services";
        if (cat.includes("One-Time")) advice += " ← one-off, may not repeat";
        advice += "\n";
      });

      const overBudgets = ctx.overBudget;
      if (overBudgets.length > 0) {
        advice += `\n**Over-budget categories:** ${overBudgets.map(b => b.category).join(", ")} — tightening these would make the biggest immediate impact.`;
      }

      return advice;
    }

    /* Income health */
    if (q.includes("income") && (q.includes("good") || q.includes("enough") || q.includes("health") || q.includes("low") || q.includes("high"))) {
      const inc = ctx.monthIncome;
      const exp = ctx.monthExpenses;
      const ratio = inc > 0 ? exp / inc : 999;

      let assessment = `**Income Health Check — ${monthLabel(ctx.currentMonth)}:**\n\nMonthly income: ${fmtFull(inc)}\nMonthly expenses: ${fmtFull(exp)}\nExpense-to-income ratio: ${(ratio * 100).toFixed(0)}%\n\n`;

      if (ratio < 0.5) assessment += "**Excellent.** You're spending less than half your income. Strong surplus for investing and saving.";
      else if (ratio < 0.7) assessment += "**Healthy.** Good margin between income and expenses. You have room to invest and build the tax reserve.";
      else if (ratio < 0.9) assessment += "**Tight.** Expenses are eating into most of your income. There may not be enough surplus to grow your portfolio or cover unexpected costs.";
      else if (ratio < 1) assessment += "**⚠ Very tight.** You're barely positive. Any unexpected expense could push you negative. Consider reducing discretionary spending.";
      else assessment += "**⚠ Negative cash flow.** Expenses exceed income. This is unsustainable — review the expense breakdown urgently.";

      assessment += `\n\nAnnualized income (projected): ${fmtFull(inc * 12)}\nAnnualized expenses (projected): ${fmtFull(exp * 12)}\nProjected annual surplus: ${fmtFull((inc - exp) * 12)}`;

      return assessment;
    }

    /* Catch-all */
    return `I can help with questions about:\n\n• **Net worth** — "What's my net worth?" "How did it change?"\n• **Portfolio** — "How's my portfolio allocated?" "Is it too risky?" "What should I buy/sell?"\n• **Spending** — "Where am I spending the most?" "Am I over budget?"\n• **Savings** — "Where can I save money?" "How can I cut expenses?"\n• **Income** — "Is my income healthy?" "What's my cash flow?"\n• **Tax** — "How much should I set aside for tax?"\n• **Goals** — "Am I on track for my goals?"\n• **Holdings** — "Show me all my positions"\n\nTry asking one of these!`;
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMsg = { id: uid(), role: "user", text: input.trim() };
    const aiReply = { id: uid(), role: "ai", text: generateResponse(input.trim()) };
    setMessages(prev => [...prev, userMsg, aiReply]);
    setInput("");
  };

  /* Simple markdown-ish rendering */
  const renderText = (text) => {
    return text.split("\n").map((line, i) => {
      let rendered = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.+?)`/g, '<code>$1</code>');
      return <div key={i} style={{ minHeight: line === "" ? 8 : "auto" }} dangerouslySetInnerHTML={{ __html: rendered }} />;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 160px)", maxHeight: 700 }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 12, padding: "0 4px" }}>
            <div style={{
              maxWidth: "80%", padding: "12px 16px", borderRadius: 16,
              background: msg.role === "user" ? C.accent : C.card,
              color: msg.role === "user" ? (theme === "dark" ? "#0b1121" : "#fff") : C.text,
              border: msg.role === "ai" ? `1px solid ${C.border}` : "none",
              fontSize: 14, lineHeight: 1.6,
              borderBottomRightRadius: msg.role === "user" ? 4 : 16,
              borderBottomLeftRadius: msg.role === "ai" ? 4 : 16,
            }}>
              {msg.role === "ai" && <div style={{ fontSize: 11, color: C.accent, fontWeight: 600, marginBottom: 4 }}>🦀 MoneyClaw Advisor</div>}
              {renderText(msg.text)}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8, padding: "12px 0", borderTop: `1px solid ${C.border}` }}>
        <input style={{ ...s.input, flex: 1, borderRadius: 24, padding: "12px 20px" }}
          placeholder="Ask about your finances..."
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") sendMessage(); }} />
        <button style={{ ...s.btn, borderRadius: 24, padding: "12px 24px" }} onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════ */
const TABS = [
  { key: "networth", label: "Net Worth", icon: "📊" },
  { key: "portfolio", label: "Portfolio", icon: "💼" },
  { key: "cashflow", label: "Income & Expenses", icon: "💰" },
  { key: "watchlist", label: "Watchlist", icon: "🔭" },
  { key: "chat", label: "Finance Chat", icon: "💬" },
  { key: "settings", label: "Settings", icon: "⚙" },
];

export default function MoneyClaw() {
  const [theme, setTheme] = useState("dark");
  const [tab, setTab] = useState("networth");
  const C = themes[theme]; const s = S(theme);

  /* ── Persistence via window.name + localStorage + server file backup ── */
  const loadSaved = () => {
    try {
      if (window.name && window.name.startsWith("{\"_mc\":")) {
        return JSON.parse(window.name);
      }
    } catch {}
    try {
      const ls = localStorage.getItem("moneyclaw");
      if (ls) return JSON.parse(ls);
    } catch {}
    return null;
  };
  const saved = useMemo(() => loadSaved(), []);

  // Load from server file on mount (async — patches in if browser had nothing)
  const [serverLoaded, setServerLoaded] = useState(false);
  useEffect(() => {
    if (saved) { setServerLoaded(true); return; } // browser already had data
    fetch("http://localhost:8484/api/load").then(r => r.json()).then(data => {
      if (data && data._mc) {
        // Restore from server backup
        if (data.nw) setNwData(data.nw);
        if (data.portfolio) setPortData(data.portfolio);
        if (data.cashflow) setCfData(data.cashflow);
        if (data.settings) setSettings(data.settings);
        if (data.rates) setRates(data.rates);
        if (data.watchlist?.tickers?.length > 0) setWatchlistData(data.watchlist);
        console.log("✅ Restored from server backup");
      }
      setServerLoaded(true);
    }).catch(() => setServerLoaded(true));
  }, []);
  const demo = useMemo(() => makeDemoData(), []);
  /* ── Merge missing default holdings into persisted data ── */
  const mergedPortfolio = useMemo(() => {
    if (!saved?.portfolio) return demo.portfolio;
    const existing = saved.portfolio;
    const existingNames = new Set((existing.holdings || []).map(h => h.name + "|" + h.account));
    const missing = (demo.portfolio.holdings || []).filter(h => !existingNames.has(h.name + "|" + h.account));
    if (missing.length > 0) {
      return { ...existing, holdings: [...(existing.holdings || []), ...missing] };
    }
    return existing;
  }, [saved, demo]);
  const [nwData, setNwData, nwUndo, nwRedo, canNwUndo, canNwRedo] = useUndoRedo(saved?.nw || demo.nw);
  const [portData, setPortData, portUndo, portRedo, canPortUndo, canPortRedo] = useUndoRedo(mergedPortfolio);
  const [cfData, setCfData, cfUndo, cfRedo, canCfUndo, canCfRedo] = useUndoRedo(saved?.cashflow || demo.cashflow);
  const [settings, setSettings] = useState(saved?.settings || DEFAULT_SETTINGS);
  const [rates, setRates] = useState(saved?.rates || { USDCAD: 1.37, GBPCAD: 1.72 });
  const DEFAULT_WATCHLIST = { tickers: [
    { symbol: "VIX", notes: "" },
    { symbol: "DIA", notes: "" },
    { symbol: "VOO", notes: "" },
    { symbol: "QQQ", notes: "" },
    { symbol: "FNGU", notes: "" },
    { symbol: "JEPQ", notes: "" },
    { symbol: "AAPL", notes: "" },
    { symbol: "MSFT", notes: "" },
    { symbol: "NVDA", notes: "" },
    { symbol: "AMZN", notes: "" },
    { symbol: "GOOG", notes: "" },
    { symbol: "META", notes: "" },
    { symbol: "IBIT", notes: "" },
    { symbol: "WMT", notes: "" },
    { symbol: "V", notes: "" },
    { symbol: "JPM", notes: "" },
    { symbol: "AVGO", notes: "" },
    { symbol: "PLTR", notes: "" },
    { symbol: "COST", notes: "" },
    { symbol: "AMD", notes: "" },
    { symbol: "ORCL", notes: "" },
    { symbol: "BTC-USD", notes: "" },
    { symbol: "ETH-USD", notes: "" },
    { symbol: "GC=F", notes: "Gold (XAUUSD)" },
    { symbol: "SI=F", notes: "Silver (XAGUSD)" },
  ] };
  const [watchlistData, setWatchlistData] = useState(() => {
    const sw = saved?.watchlist;
    if (sw?.tickers?.length > 0) return { tickers: sw.tickers, buyTargets: sw.buyTargets || {} };
    return { ...DEFAULT_WATCHLIST, buyTargets: {} };
  });
  const [lastAutoSave, setLastAutoSave] = useState(null);

  /* Auto-save to window.name + localStorage + server file every 1.5 seconds */
  const lastServerSave = useRef(0);
  const saveData = useCallback(() => {
    try {
      const obj = { _mc: true, nw: nwData, portfolio: portData, cashflow: cfData, settings, rates, watchlist: watchlistData };
      const data = JSON.stringify(obj);
      window.name = data;
      try { localStorage.setItem("moneyclaw", data); } catch {}
      // Save to server file every 10 seconds (not every 1.5s to avoid hammering)
      const now = Date.now();
      if (now - lastServerSave.current > 10000) {
        lastServerSave.current = now;
        fetch("http://localhost:8484/api/save", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: data
        }).catch(() => {});
      }
      setLastAutoSave(new Date().toLocaleTimeString());
    } catch {}
  }, [nwData, portData, cfData, settings, rates, watchlistData]);

  useEffect(() => {
    const timer = setTimeout(saveData, 1500);
    return () => clearTimeout(timer);
  }, [saveData]);

  /* Also save immediately on unload so nothing is lost on refresh */
  useEffect(() => {
    const handleUnload = () => {
      saveData();
      // Force server save on unload regardless of throttle
      try {
        const obj = { _mc: true, nw: nwData, portfolio: portData, cashflow: cfData, settings, rates, watchlist: watchlistData };
        navigator.sendBeacon("http://localhost:8484/api/save", new Blob([JSON.stringify(obj)], { type: "application/json" }));
      } catch {}
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [saveData, nwData, portData, cfData, settings, rates, watchlistData]);

  /* ── Tab password protection ── */
  const PROTECTED_TABS = ["networth", "portfolio"];
  const [tabPasswords, setTabPasswords] = useState({});
  const [unlockedTabs, setUnlockedTabs] = useState({});
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwMode, setPwMode] = useState(null); // null | "unlock" | "set" | "change"

  const saveTabPasswords = (updated) => {
    setTabPasswords(updated);
  };

  const isProtected = (t) => PROTECTED_TABS.includes(t) && tabPasswords[t];
  const isUnlocked = (t) => !isProtected(t) || unlockedTabs[t];

  const handleTabClick = (t) => {
    setTab(t);
    setPwInput(""); setPwError(""); setPwMode(null);
    if (isProtected(t) && !unlockedTabs[t]) setPwMode("unlock");
  };

  const handleUnlock = (t) => {
    if (pwInput === tabPasswords[t]) {
      setUnlockedTabs(prev => ({ ...prev, [t]: true }));
      setPwMode(null); setPwInput(""); setPwError("");
    } else {
      setPwError("Wrong password"); setPwInput("");
    }
  };

  const handleSetPassword = (t) => {
    if (pwInput.length < 1) { setPwError("Enter a password"); return; }
    saveTabPasswords({ ...tabPasswords, [t]: pwInput });
    setUnlockedTabs(prev => ({ ...prev, [t]: true }));
    setPwMode(null); setPwInput(""); setPwError("");
  };

  const handleRemovePassword = (t) => {
    const updated = { ...tabPasswords }; delete updated[t];
    saveTabPasswords(updated);
    setUnlockedTabs(prev => ({ ...prev, [t]: true }));
    setPwMode(null); setPwInput(""); setPwError("");
  };

  /* ── Auto-lock on idle (5 min) & auto-hide numbers ── */
  const IDLE_TIMEOUT = 5 * 60 * 1000;
  const idleTimer = useRef(null);
  const hideTimer = useRef(null);
  const lastActivity = useRef(Date.now());
  const [numbersHidden, setNumbersHidden] = useState(true);
  const autoHideMs = (settings.autoHideMinutes || 1) * 60 * 1000;
  const resetIdleTimer = useCallback(() => {
    lastActivity.current = Date.now();
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setUnlockedTabs({});
    }, IDLE_TIMEOUT);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setNumbersHidden(true);
    }, autoHideMs);
  }, [autoHideMs]);
  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));
    resetIdleTimer();
    /* Hide immediately when returning from sleep/lid close if enough time passed */
    const onVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() - lastActivity.current >= autoHideMs) {
        setNumbersHidden(true);
        setUnlockedTabs({});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      document.removeEventListener("visibilitychange", onVisibility);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [resetIdleTimer, autoHideMs]);

  const undo = () => { if (tab === "networth") nwUndo(); else if (tab === "portfolio") portUndo(); else if (tab === "cashflow") cfUndo(); };
  const redo = () => { if (tab === "networth") nwRedo(); else if (tab === "portfolio") portRedo(); else if (tab === "cashflow") cfRedo(); };
  const canUndo = tab === "networth" ? canNwUndo : tab === "portfolio" ? canPortUndo : canCfUndo;
  const canRedo = tab === "networth" ? canNwRedo : tab === "portfolio" ? canPortRedo : canCfRedo;

  /* JSON save/load */
  const saveToFile = () => {
    const blob = new Blob([JSON.stringify({ nw: nwData, portfolio: portData, cashflow: cfData, settings, rates }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "moneyclaw-backup.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const loadFromFile = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json";
    input.onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = (ev) => {
        try {
          const d = JSON.parse(ev.target.result);
          if (d.nw) setNwData(d.nw);
          if (d.portfolio) setPortData(d.portfolio);
          if (d.cashflow) setCfData(d.cashflow);
          if (d.settings) setSettings(d.settings);
          if (d.rates) setRates(d.rates);
        } catch (err) { console.error("Invalid file"); }
      };
      r.readAsText(f);
    };
    input.click();
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif" }}>
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        @media (max-width: 600px) {
          .mc-navbar-top { flex-direction: column; gap: 8px !important; align-items: flex-start !important; padding: 8px 12px !important; }
          .mc-navbar-top > div:last-child { flex-wrap: wrap; }
          .mc-tab-bar { overflow-x: auto !important; justify-content: flex-start !important; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 0 8px !important; }
          .mc-tab-bar::-webkit-scrollbar { display: none; }
          .mc-content { padding: 16px 10px !important; }
          .mc-stat-row { flex-direction: column !important; }
          .mc-stat-row > div { min-width: 0 !important; width: 100% !important; }
          .mc-card { padding: 14px !important; }
          .mc-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .mc-table-wrap table { min-width: 500px; }
          .mc-flex-row { flex-direction: column !important; }
          .mc-flex-row > * { width: 100% !important; min-width: 0 !important; }
          .mc-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 900px) and (min-width: 601px) {
          .mc-stat-row > div { min-width: 120px !important; }
          .mc-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
      {/* ── Navbar ── */}
      <div style={{
        background: C.card,
        borderBottom: `1px solid ${C.border}`,
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: theme === "dark" ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.06)",
      }}>
        {/* Top row: logo + date left, actions right */}
        <div className="mc-navbar-top" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>🦀</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: C.white }}>MoneyClaw</span>
            <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button onClick={undo} disabled={!canUndo} title="Undo" style={{ background: "transparent", border: "none", color: canUndo ? C.muted : C.card2, cursor: canUndo ? "pointer" : "default", fontSize: 14, padding: "4px 6px" }}>↩</button>
            <button onClick={redo} disabled={!canRedo} title="Redo" style={{ background: "transparent", border: "none", color: canRedo ? C.muted : C.card2, cursor: canRedo ? "pointer" : "default", fontSize: 14, padding: "4px 6px" }}>↪</button>
            {lastAutoSave && <span style={{ fontSize: 9, color: C.green, opacity: 0.7 }}>saved</span>}
            <button onClick={saveToFile} title="Export to file" style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>💾</button>
            <button onClick={loadFromFile} title="Import from file" style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>📂</button>
            <button onClick={() => setNumbersHidden(h => !h)} title={numbersHidden ? "Show numbers" : "Hide numbers"} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>{numbersHidden ? "🔐" : "👓"}</button>
            <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="Theme" style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>{theme === "dark" ? "☀️" : "🌙"}</button>
          </div>
        </div>
        {/* Tab row */}
        <div className="mc-tab-bar" style={{ display: "flex", justifyContent: "center", gap: 0, padding: "0 16px", overflow: "hidden" }}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => handleTabClick(t.key)}
                style={{
                  background: "transparent", color: active ? C.accent : C.muted,
                  border: "none", borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent",
                  padding: "10px 12px 8px", cursor: "pointer", fontWeight: active ? 700 : 500, fontSize: 12,
                  whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4,
                }}>
                <span style={{ fontSize: 12 }}>{t.icon}</span>{t.label}
                {isProtected(t.key) && !unlockedTabs[t.key] && <span style={{ fontSize: 10 }}>🔒</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="mc-content" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>
        {PROTECTED_TABS.includes(tab) && !isUnlocked(tab) ? (
          /* ── Lock screen ── */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 350, gap: 16 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🔒</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>This tab is locked</div>
            <div style={{ fontSize: 13, color: C.muted, textAlign: "center", maxWidth: 320 }}>
              Enter your password to access this tab.
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
              <input
                type="password" autoFocus placeholder="Password"
                value={pwInput} onChange={e => { setPwInput(e.target.value); setPwError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleUnlock(tab); }}
                style={{
                  background: C.card, border: `1px solid ${pwError ? C.red : C.border}`, borderRadius: 8,
                  padding: "10px 14px", color: C.text, fontSize: 14, outline: "none", width: 220,
                }}
              />
              <button onClick={() => handleUnlock(tab)}
                style={{ ...S(theme).btn, padding: "10px 20px" }}>
                Unlock
              </button>
            </div>
            {pwError && <div style={{ color: C.red, fontSize: 12 }}>{pwError}</div>}
          </div>
        ) : (
          <>
            {tab === "networth" && <NetWorthTab data={nwData} setData={setNwData} settings={settings} rates={rates} theme={theme} hide={numbersHidden} />}
            {tab === "portfolio" && <PortfolioTab data={portData} setData={setPortData} settings={settings} rates={rates} theme={theme} hide={numbersHidden} />}
            {tab === "cashflow" && <CashFlowTab data={cfData} setData={setCfData} nwData={nwData} settings={settings} rates={rates} theme={theme} hide={numbersHidden} />}
            {tab === "watchlist" && <WatchlistTab data={watchlistData} setData={setWatchlistData} portData={portData} settings={settings} rates={rates} theme={theme} />}
            {tab === "chat" && <FinanceChatTab nwData={nwData} portData={portData} cfData={cfData} settings={settings} rates={rates} theme={theme} />}
            {tab === "settings" && <SettingsTab settings={settings} setSettings={setSettings} rates={rates} setRates={setRates} theme={theme} tabPasswords={tabPasswords} saveTabPasswords={saveTabPasswords} handleRemovePassword={handleRemovePassword} unlockedTabs={unlockedTabs} />}
          </>
        )}
      </div>

      <div style={{ textAlign: "center", padding: "24px 0 40px", color: C.muted, fontSize: 11 }}>
        MoneyClaw — Built for Jacqueline & Jon
      </div>
    </div>
  );
}