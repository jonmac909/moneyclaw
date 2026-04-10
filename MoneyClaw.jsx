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
    bg: "#09090b", bg2: "#0f0f12", card: "#151518", card2: "#1c1c21", border: "#27272a",
    accent: "#e05a47", accent2: "#71717a", green: "#2dd4bf", red: "#f87171",
    orange: "#fbbf24", pink: "#f472b6", yellow: "#fbbf24", cyan: "#67e8f9",
    text: "#e4e4e7", muted: "#71717a", white: "#fafafa",
    gold: "#d4a843",
  },
  light: {
    bg: "#f4f4f5", bg2: "#ffffff", card: "#ffffff", card2: "#e4e4e7", border: "#d4d4d8",
    accent: "#c9493a", accent2: "#3f3f46", green: "#0d9488", red: "#dc2626",
    orange: "#ea580c", pink: "#db2777", yellow: "#ca8a04", cyan: "#0891b2",
    text: "#09090b", muted: "#52525b", white: "#09090b",
    gold: "#b8941f",
  },
};
const PIE_COLORS = ["#a1a1aa","#2dd4bf","#f87171","#fbbf24","#67e8f9","#f472b6","#a78bfa","#e05a47","#fb923c","#71717a"];

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
   ICON SYSTEM — SF Symbols–inspired monoline SVGs
   ═══════════════════════════════════════════════════════════ */
const Icon = ({ name, size = 14, color = "currentColor", style = {} }) => {
  const sw = 1.4;
  const p = { strokeWidth: sw, stroke: color, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    home: <><path d="M2.5 7L8 2L13.5 7V13.5A1 1 0 0112.5 14.5H3.5A1 1 0 012.5 13.5V7Z" {...p}/><path d="M6 14.5V9H10V14.5" {...p}/></>,
    chart: <><rect x="2" y="9" width="2.5" height="5" rx=".5" {...p}/><rect x="6.75" y="5" width="2.5" height="9" rx=".5" {...p}/><rect x="11.5" y="2" width="2.5" height="12" rx=".5" {...p}/></>,
    briefcase: <><rect x="2" y="5.5" width="12" height="8.5" rx="1.5" {...p}/><path d="M5.5 5.5V4A1.5 1.5 0 017 2.5H9A1.5 1.5 0 0110.5 4V5.5" {...p}/><path d="M2 9H14" {...p}/></>,
    wallet: <><rect x="2" y="3.5" width="12" height="10" rx="1.5" {...p}/><path d="M2 7H14" {...p}/><circle cx="11.5" cy="10" r=".8" fill={color} stroke="none"/></>,
    telescope: <><circle cx="5" cy="3.5" r="2" {...p}/><path d="M5 5.5V9" {...p}/><path d="M2.5 12L5 9L7.5 12" {...p}/><path d="M6.7 2.3L13 7" {...p}/></>,
    gear: <><circle cx="8" cy="8" r="2.5" {...p}/><path d="M8 1.5V3M8 13V14.5M14.5 8H13M3 8H1.5M12.6 3.4L11.5 4.5M4.5 11.5L3.4 12.6M12.6 12.6L11.5 11.5M4.5 4.5L3.4 3.4" {...p}/></>,
    lock: <><rect x="4" y="7.5" width="8" height="6" rx="1.5" {...p}/><path d="M5.5 7.5V5.5A2.5 2.5 0 0110.5 5.5V7.5" {...p}/><circle cx="8" cy="10.5" r=".6" fill={color} stroke="none"/></>,
    bank: <><path d="M2 6.5L8 3L14 6.5" {...p}/><path d="M3.5 7V12" {...p}/><path d="M6.5 7V12" {...p}/><path d="M9.5 7V12" {...p}/><path d="M12.5 7V12" {...p}/><path d="M2 12.5H14" {...p}/><path d="M1.5 14H14.5" {...p}/></>,
    coins: <><ellipse cx="6.5" cy="10" rx="4" ry="2.5" {...p}/><ellipse cx="6.5" cy="8" rx="4" ry="2.5" {...p}/><path d="M10.5 8V6C10.5 4.62 8.71 3.5 6.5 3.5" {...p}/></>,
    brain: <><path d="M8 14V9" {...p}/><path d="M5.5 4.5C4 4.5 3 5.5 3 7C3 7.8 3.3 8.2 3.3 8.2C2.5 8.7 2 9.5 2 10.5C2 12 3.5 13 5 13C6.2 13 7 12.5 8 12.5" {...p}/><path d="M10.5 4.5C12 4.5 13 5.5 13 7C13 7.8 12.7 8.2 12.7 8.2C13.5 8.7 14 9.5 14 10.5C14 12 12.5 13 11 13C9.8 13 9 12.5 8 12.5" {...p}/><path d="M5.5 4.5C5.5 3 6.5 2 8 2C9.5 2 10.5 3 10.5 4.5" {...p}/></>,
    trendingUp: <><path d="M2 12L6 7L9 10L14 4" {...p}/><path d="M10.5 4H14V7.5" {...p}/></>,
    building: <><rect x="4" y="2" width="8" height="12" rx="1" {...p}/><path d="M6.5 5H7.5M8.5 5H9.5M6.5 7.5H7.5M8.5 7.5H9.5M6.5 10H9.5" {...p}/></>,
    medal: <><circle cx="8" cy="5.5" r="3" {...p}/><path d="M6 8L4.5 14L8 12L11.5 14L10 8" {...p}/></>,
    lightbulb: <><path d="M6 11V12A2 2 0 008 14V14A2 2 0 0010 12V11" {...p}/><path d="M6 11C4.8 9.8 4 8.6 4 7A4 4 0 0112 7C12 8.6 11.2 9.8 10 11" {...p}/><path d="M6.5 11H9.5" {...p}/></>,
    save: <><path d="M12 14H4A1 1 0 013 13V3A1 1 0 014 2H10L13 5V13A1 1 0 0112 14Z" {...p}/><path d="M8 7V12" {...p}/><path d="M5.5 9.5L8 7L10.5 9.5" {...p}/></>,
    folder: <><path d="M2 5C2 4.45 2.45 4 3 4H6L7.5 5.5H13C13.55 5.5 14 5.95 14 6.5V12.5C14 13.05 13.55 13.5 13 13.5H3C2.45 13.5 2 13.05 2 12.5V5Z" {...p}/></>,
    shield: <><path d="M8 2L3 4.5V8C3 11 5.2 13.3 8 14.5C10.8 13.3 13 11 13 8V4.5L8 2Z" {...p}/></>,
    eye: <><path d="M2 8C2 8 4.5 4 8 4C11.5 4 14 8 14 8C14 8 11.5 12 8 12C4.5 12 2 8 2 8Z" {...p}/><circle cx="8" cy="8" r="2" {...p}/></>,
    eyeOff: <><path d="M2 8C2 8 4.5 4 8 4C11.5 4 14 8 14 8" {...p}/><path d="M2 14L14 2" {...p}/></>,
    trash: <><path d="M3.5 5H12.5L11.5 14H4.5L3.5 5Z" {...p}/><path d="M2.5 5H13.5" {...p}/><path d="M6 5V3.5A1 1 0 017 2.5H9A1 1 0 0110 3.5V5" {...p}/></>,
    trendingDown: <><path d="M2 4L6 9L9 6L14 12" {...p}/><path d="M10.5 12H14V8.5" {...p}/></>,
    bitcoin: <><path d="M5.5 3V13" {...p}/><path d="M9.5 3V13" {...p}/><path d="M4 5H10.5C11.88 5 13 5.67 13 7C13 8.33 11.88 9 10.5 9H4" {...p}/><path d="M4 9H11C12.38 9 13.5 9.67 13.5 11C13.5 12.33 12.38 13 11 13H4" {...p}/></>,
    expand: <><path d="M4 10L4 12.5L6.5 12.5" {...p}/><path d="M12 6L12 3.5L9.5 3.5" {...p}/><path d="M4 12.5L7 9.5" {...p}/><path d="M12 3.5L9 6.5" {...p}/></>,
    collapse: <><path d="M6.5 9.5L4 12" {...p}/><path d="M9.5 6.5L12 4" {...p}/><path d="M5 9.5H7V11.5" {...p}/><path d="M11 6.5H9V4.5" {...p}/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}>{icons[name] || null}</svg>;
};

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

/* Expense categories — grouped by parent for hierarchy display */
const EXPENSE_CATS = {
  Opco: {
    "Ecomm House Variable Expenses": ["Business Subscription/SaaS", "Amazon Business Purchases", "Courses", "Business Purchases", "Business Travel", "Bank Fees", "Business Misc", "Ads"],
    "Ecomm House Shared Expenses": ["Car (Gas/Parking) Business"],
  },
  Holdco: {
    "Holdco Expenses": ["Bank Fees"],
  },
  Jon: {
    "Personal": ["Entertainment", "Personal Care", "Shopping", "Personal Misc"],
    "House": ["House Fortis"],
    "Food": ["Coffee Shops", "Groceries", "Food Delivery"],
    "Car": ["Car Maintenance", "Gas/Transportation"],
    "Travel": ["Hotel/Accommodation"],
  },
  Jacqueline: {
    "Personal": ["Entertainment", "Personal Care", "Shopping", "Personal Misc"],
    "House": ["House Fortis"],
    "Food": ["Coffee Shops", "Groceries", "Food Delivery"],
    "Car": ["Car Maintenance", "Gas/Transportation"],
    "Travel": ["Hotel/Accommodation"],
  },
};
/* Flat list per bucket for dropdowns */
const DEFAULT_TAX_CATS = Object.fromEntries(
  Object.entries(EXPENSE_CATS).map(([bucket, groups]) => [bucket, [...Object.values(groups).flat(), "Uncategorized"]])
);
/* Transfer categories — excluded from totals */
const TRANSFER_CATS = {
  Opco: ["Moving Money CC Payments", "Moving Money Business"],
  Holdco: ["Hold Co Dividends", "Dividends from Opco"],
  Jon: ["Moving Money CC Payments", "Moving Money Personal", "Dividends from Holdco"],
  Jacqueline: ["Moving Money CC Payments", "Moving Money Personal", "Dividends from Holdco"],
};

const INCOME_GROUPS = {
  Opco: { "Ecomm House Income": ["Sponsor Income", "Contracts", "Affiliate", "Course Income", "Commissions", "Skool", "Other Income"] },
  Holdco: { "Holdco Income": ["Interest Income", "Investment Income", "GIC Income", "Other Income"] },
  Jon: { "Jon Income": ["Interest", "Other Income"] },
  Jacqueline: { "Jacqueline Income": ["Interest", "Other Income"] },
};
const INCOME_CATS = Object.fromEntries(
  Object.entries(INCOME_GROUPS).map(([bucket, groups]) => [bucket, Object.values(groups).flat()])
);

/* Plaid category → MoneyClaw category fallback map (tier 2 of auto-categorization) */
const PLAID_CATEGORY_MAP = {
  "FOOD_AND_DRINK": { Jon: "Groceries", Jacqueline: "Groceries", Opco: "Business Misc" },
  "FOOD_AND_DRINK_COFFEE": { Jon: "Coffee Shops", Jacqueline: "Coffee Shops" },
  "FOOD_AND_DRINK_GROCERIES": { Jon: "Groceries", Jacqueline: "Groceries" },
  "FOOD_AND_DRINK_RESTAURANT": { Jon: "Food Delivery", Jacqueline: "Food Delivery" },
  "TRANSPORTATION": { Jon: "Gas/Transportation", Jacqueline: "Gas/Transportation", Opco: "Car (Gas/Parking) Business" },
  "ENTERTAINMENT": { Jon: "Entertainment", Jacqueline: "Entertainment" },
  "GENERAL_MERCHANDISE": { Jon: "Shopping", Jacqueline: "Shopping", Opco: "Business Purchases" },
  "GENERAL_SERVICES": { Opco: "Business Misc", Jon: "Personal Misc", Jacqueline: "Personal Misc" },
  "PERSONAL_CARE": { Jon: "Personal Care", Jacqueline: "Personal Care" },
  "RENT_AND_UTILITIES": { Jon: "House Fortis", Jacqueline: "House Fortis" },
  "TRAVEL": { Jon: "Hotel/Accommodation", Jacqueline: "Hotel/Accommodation", Opco: "Business Travel" },
  "LOAN_PAYMENTS": { Jon: "Moving Money CC Payments", Jacqueline: "Moving Money CC Payments" },
  "TRANSFER_IN": { Opco: "Other Income", Jon: "Other Income", Jacqueline: "Other Income" },
  "TRANSFER_OUT": { Jon: "Moving Money Personal", Jacqueline: "Moving Money Personal", Opco: "Moving Money Business" },
  "INCOME": { Opco: "Other Income", Holdco: "Other Income", Jon: "Other Income", Jacqueline: "Other Income" },
  "BANK_FEES": { Opco: "Bank Fees", Holdco: "Bank Fees", Jon: "Personal Misc", Jacqueline: "Personal Misc" },
  "HOME_IMPROVEMENT": { Jon: "House Fortis", Jacqueline: "House Fortis" },
  "MEDICAL": { Jon: "Personal Misc", Jacqueline: "Personal Misc" },
  "GOVERNMENT_AND_NON_PROFIT": { Jon: "Personal Misc", Jacqueline: "Personal Misc" },
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
          { id: uid(), bucket: "Opco", name: "CAD Cheq", currency: "CAD", value: 824.69, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Opco", name: "USD Cheq", currency: "USD", value: 126543.17, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Opco", name: "PayPal", currency: "CAD", value: 1679.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Opco", name: "CAD VISA", currency: "CAD", value: 3660.12, isLiability: true, type: "Liability" },
          { id: uid(), bucket: "Opco", name: "USD VISA", currency: "USD", value: 12651.37, isLiability: true, type: "Liability" },
          { id: uid(), bucket: "Holdco", name: "RBC CAD Cheq + GIC", currency: "CAD", value: 748.88, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Holdco", name: "GLE350 Car", currency: "CAD", value: 55000.00, isLiability: false, type: "Other" },
          { id: uid(), bucket: "Holdco", name: "TD Stocks", currency: "USD", value: 87159.40, isLiability: false, type: "Stock" },
          { id: uid(), bucket: "Holdco", name: "Interactive Brokers Stocks", currency: "USD", value: 132890.00, isLiability: false, type: "Stock" },
          { id: uid(), bucket: "Holdco", name: "RBC Dominion Bonds", currency: "USD", value: 463059.51, isLiability: false, type: "Bond" },
          { id: uid(), bucket: "Holdco", name: "RBC Dominion Hi Int Cash", currency: "CAD", value: 237786.41, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Holdco", name: "RBC Dominion 60/40", currency: "USD", value: 298775.62, isLiability: false, type: "Fund" },
          { id: uid(), bucket: "Holdco", name: "RBC USD Cheq", currency: "USD", value: 2705.45, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Holdco", name: "RBC CAD House Fund", currency: "CAD", value: 2256.82, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Holdco", name: "CAD Crypto", currency: "CAD", value: 8756.00, isLiability: false, type: "Crypto" },
          { id: uid(), bucket: "Holdco", name: "USD Silver", currency: "USD", value: 111819.40, isLiability: false, type: "Precious Metal" },
          { id: uid(), bucket: "Holdco", name: "USD Gold", currency: "USD", value: 6462.29, isLiability: false, type: "Precious Metal" },
          { id: uid(), bucket: "Holdco", name: "Numismatic Coins", currency: "CAD", value: 1000.00, isLiability: false, type: "Precious Metal" },
          { id: uid(), bucket: "Jon", name: "RBC CAD Cheq", currency: "CAD", value: 271.60, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jon", name: "RBC USD Cheq", currency: "USD", value: 8.14, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jon", name: "CAD RRSP", currency: "CAD", value: 52731.56, isLiability: false, type: "Fund" },
          { id: uid(), bucket: "Jon", name: "Safe Money", currency: "CAD", value: 21440.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jon", name: "CAD VISA", currency: "CAD", value: 2225.99, isLiability: true, type: "Liability" },
          { id: uid(), bucket: "Jon", name: "USD VISA", currency: "USD", value: 7049.01, isLiability: true, type: "Liability" },
          { id: uid(), bucket: "Jon", name: "RBC Direct Investing USD", currency: "USD", value: 89050.00, isLiability: false, type: "Stock" },
          { id: uid(), bucket: "Jon", name: "RBC Direct Investing CAD", currency: "CAD", value: 1136.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jon", name: "TD Bank USD", currency: "USD", value: 3075.65, isLiability: false, type: "Stock" },
          { id: uid(), bucket: "Jon", name: "House (50%)", currency: "CAD", value: 1350000.00, isLiability: false, type: "Real Estate" },
          { id: uid(), bucket: "Jon", name: "Mortgage (50%)", currency: "CAD", value: 321152.07, isLiability: true, type: "Liability" },
          { id: uid(), bucket: "Jacqueline", name: "TD CAD Cheq", currency: "CAD", value: 10532.49, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jacqueline", name: "TD CAD TFSA", currency: "CAD", value: 2892.99, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jacqueline", name: "RBC GIC CAD", currency: "CAD", value: 0, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jacqueline", name: "RBC CAD Sav", currency: "CAD", value: 110024.59, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jacqueline", name: "RBC USD Sav", currency: "USD", value: 17709.95, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jacqueline", name: "RBC CAD VISA", currency: "CAD", value: 78.00, isLiability: true, type: "Liability" },
          { id: uid(), bucket: "Jacqueline", name: "HSBC UK", currency: "GBP", value: 5000.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jacqueline", name: "Fidelity Clearpath 2045", currency: "CAD", value: 27455.00, isLiability: false, type: "Fund" },
          { id: uid(), bucket: "Jacqueline", name: "House (50%)", currency: "CAD", value: 1350000.00, isLiability: false, type: "Real Estate" },
          { id: uid(), bucket: "Jacqueline", name: "Mortgage (50%)", currency: "CAD", value: 321152.07, isLiability: true, type: "Liability" },
        ],
      },
      {
        id: uid(), month: "2026-02", notes: "February snapshot",
        journal: "Quieter month. Markets were flat.",
        deductions: DEFAULT_DEDUCTIONS.map(d => ({ ...d })),
        items: [
          { id: uid(), bucket: "Opco", name: "CAD Cheq", currency: "CAD", value: 1200.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Opco", name: "USD Cheq", currency: "USD", value: 118000.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Opco", name: "PayPal", currency: "CAD", value: 2100.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Opco", name: "CAD VISA", currency: "CAD", value: 4200.00, isLiability: true, type: "Liability" },
          { id: uid(), bucket: "Opco", name: "USD VISA", currency: "USD", value: 11000.00, isLiability: true, type: "Liability" },
          { id: uid(), bucket: "Holdco", name: "RBC CAD Cheq + GIC", currency: "CAD", value: 1200.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Holdco", name: "GLE350 Car", currency: "CAD", value: 55000.00, isLiability: false, type: "Other" },
          { id: uid(), bucket: "Holdco", name: "TD Stocks", currency: "USD", value: 84000.00, isLiability: false, type: "Stock" },
          { id: uid(), bucket: "Holdco", name: "Interactive Brokers Stocks", currency: "USD", value: 128000.00, isLiability: false, type: "Stock" },
          { id: uid(), bucket: "Holdco", name: "RBC Dominion Bonds", currency: "USD", value: 460000.00, isLiability: false, type: "Bond" },
          { id: uid(), bucket: "Holdco", name: "RBC Dominion Hi Int Cash", currency: "CAD", value: 235000.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Holdco", name: "RBC Dominion 60/40", currency: "USD", value: 290000.00, isLiability: false, type: "Fund" },
          { id: uid(), bucket: "Holdco", name: "RBC USD Cheq", currency: "USD", value: 3100.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Holdco", name: "RBC CAD House Fund", currency: "CAD", value: 2256.82, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Holdco", name: "CAD Crypto", currency: "CAD", value: 7800.00, isLiability: false, type: "Crypto" },
          { id: uid(), bucket: "Holdco", name: "USD Silver", currency: "USD", value: 105000.00, isLiability: false, type: "Precious Metal" },
          { id: uid(), bucket: "Holdco", name: "USD Gold", currency: "USD", value: 6200.00, isLiability: false, type: "Precious Metal" },
          { id: uid(), bucket: "Holdco", name: "Numismatic Coins", currency: "CAD", value: 1000.00, isLiability: false, type: "Precious Metal" },
          { id: uid(), bucket: "Jon", name: "RBC CAD Cheq", currency: "CAD", value: 500.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jon", name: "CAD RRSP", currency: "CAD", value: 52000.00, isLiability: false, type: "Fund" },
          { id: uid(), bucket: "Jon", name: "Safe Money", currency: "CAD", value: 21440.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jon", name: "CAD VISA", currency: "CAD", value: 1800.00, isLiability: true, type: "Liability" },
          { id: uid(), bucket: "Jon", name: "USD VISA", currency: "USD", value: 5500.00, isLiability: true, type: "Liability" },
          { id: uid(), bucket: "Jon", name: "RBC Direct Investing USD", currency: "USD", value: 86000.00, isLiability: false, type: "Stock" },
          { id: uid(), bucket: "Jon", name: "RBC Direct Investing CAD", currency: "CAD", value: 1100.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jon", name: "TD Bank USD", currency: "USD", value: 3075.65, isLiability: false, type: "Stock" },
          { id: uid(), bucket: "Jon", name: "House (50%)", currency: "CAD", value: 1350000.00, isLiability: false, type: "Real Estate" },
          { id: uid(), bucket: "Jon", name: "Mortgage (50%)", currency: "CAD", value: 323000.00, isLiability: true, type: "Liability" },
          { id: uid(), bucket: "Jacqueline", name: "TD CAD Cheq", currency: "CAD", value: 8900.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jacqueline", name: "TD CAD TFSA", currency: "CAD", value: 2800.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jacqueline", name: "RBC CAD Sav", currency: "CAD", value: 108000.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jacqueline", name: "RBC USD Sav", currency: "USD", value: 17500.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jacqueline", name: "RBC CAD VISA", currency: "CAD", value: 150.00, isLiability: true, type: "Liability" },
          { id: uid(), bucket: "Jacqueline", name: "HSBC UK", currency: "GBP", value: 5000.00, isLiability: false, type: "Cash" },
          { id: uid(), bucket: "Jacqueline", name: "Fidelity Clearpath 2045", currency: "CAD", value: 27000.00, isLiability: false, type: "Fund" },
          { id: uid(), bucket: "Jacqueline", name: "House (50%)", currency: "CAD", value: 1350000.00, isLiability: false, type: "Real Estate" },
          { id: uid(), bucket: "Jacqueline", name: "Mortgage (50%)", currency: "CAD", value: 323000.00, isLiability: true, type: "Liability" },
        ],
      },
    ],
    goals: [{ id: uid(), name: "Net Worth $5M", target: 5000000, current: 3405479 }],
  };
  const portfolio = {
    holdings: [
      /* ── IB (Interactive Brokers) — Holdco ── */
      { id: uid(), name: "iShares Bitcoin Trust", ticker: "IBIT", bucket: "Holdco", account: "IB", type: "Crypto", currency: "USD", lots: [{ id: uid(), date: "2024-06-01", qty: 1220, costPerUnit: 44.32, currentPrice: 40.57 }], tags: ["Crypto"], targetType: "percentage", targetValue: 5, alertAbove: null, alertBelow: null, alertPctUp: null, alertPctDown: null },  /* Note: IBIT correlates 92% with Nasdaq — behaves like leveraged tech */
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
    card: { background: C.card, borderRadius: 6, padding: 20, border: `1px solid ${C.border}`, marginBottom: 16 },
    btn: { background: C.accent, color: theme === "dark" ? "#0b1121" : "#fff", border: "none", borderRadius: 5, padding: "8px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" },
    btnSm: { background: C.card2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "6px 14px", cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" },
    btnDanger: { background: "transparent", color: C.red, border: `1px solid ${C.red}33`, borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 11 },
    btnGhost: { background: "transparent", color: C.muted, border: "none", cursor: "pointer", fontSize: 13, padding: "4px 8px" },
    input: { background: C.card2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "8px 12px", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" },
    select: { background: C.card2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "8px 12px", fontSize: 13, outline: "none" },
    th: { textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.muted, fontWeight: 600, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer", userSelect: "none" },
    td: { padding: "10px 12px", borderBottom: `1px solid ${C.card2}`, color: C.text, fontSize: 13 },
    badge: (color) => ({ background: color + "18", color, padding: "2px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600, display: "inline-block" }),
    section: { marginBottom: 24 },
    h2: { margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: C.text },
    h3: { margin: "0 0 12px", fontSize: 16, fontWeight: 600, color: C.text },
    mono: { fontSize: 11, fontVariantNumeric: "tabular-nums" },
    muted: { color: C.muted, fontSize: 13 },
    row: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 },
  };
}

function StatCard({ label, value, sub, color, C }) {
  return (
    <div style={{ background: C.card, borderRadius: 5, padding: "10px 12px", border: `1px solid ${C.border}`, textAlign: "center", flex: 1, minWidth: 0, overflow: "hidden" }}>
      <div style={{ color: C.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || C.white, whiteSpace: "nowrap", textAlign: "center" }}>{value}</div>
      {sub && <div style={{ color: C.muted, fontSize: 9, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
    </div>
  );
}

function CollapsibleStats({ label, children, C, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: open ? 20 : 8 }}>
      <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none", marginBottom: open ? 8 : 0 }}>
        <span style={{ fontSize: 9, color: C.muted, transition: "transform 0.2s", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>▼</span>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
      </div>
      {open && children}
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
        <div style={{ marginTop: 8, padding: 12, background: C.card2, borderRadius: 5, fontSize: 13 }}>
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
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 5, padding: "10px 14px", fontSize: 13 }}>
      <div style={{ color: C.muted, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.text }}>{p.name}: <strong>{fmtFull(p.value)}</strong></div>
      ))}
    </div>
  );
}

/* ── Infer asset type from NW item name (for saved data without type field) ── */
function inferNwItemType(item) {
  if (item.type) return item.type;
  if (item.isLiability) return "Liability";
  const n = (item.name || "").toLowerCase();
  if (/stock|broker|direct investing|td bank usd/i.test(n)) return "Stock";
  if (/bond/i.test(n)) return "Bond";
  if (/60.40|rrsp|fidelity|clearpath|safe money/i.test(n)) return "Fund";
  if (/crypto/i.test(n)) return "Crypto";
  if (/silver|gold|numismatic|coin/i.test(n)) return "Precious Metal";
  if (/house/i.test(n)) return "Real Estate";
  if (/car|gle/i.test(n)) return "Other";
  if (/mortgage/i.test(n)) return "Liability";
  if (/visa/i.test(n)) return "Liability";
  return "Cash";
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
   TAB 0 — OVERVIEW
   ═══════════════════════════════════════════════════════════ */
function OverviewTab({ portData, watchlistData, todos, setTodos, rules, settings, theme }) {
  const C = themes[theme]; const s = S(theme);

  /* ── Market data (fetch on mount) ── */
  const watchTickers = watchlistData?.tickers || [];
  const allSymbols = watchTickers.map(t => t.symbol);
  const [quotes, setQuotes] = useState({});
  const [technicals, setTechnicals] = useState({});
  const [news, setNews] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newTodo, setNewTodo] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [clockTick, setClockTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setClockTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const PLAID_SERVER = "http://localhost:8484";

  const holdingsMap = useMemo(() => {
    const map = {};
    (portData?.holdings || []).forEach(h => {
      if (!h.ticker) return;
      const lots = h.lots || [];
      const totalQty = lots.reduce((s, l) => s + (l.qty || 0), 0);
      const totalCost = lots.reduce((s, l) => s + (l.qty || 0) * (l.costPerUnit || 0), 0);
      const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
      if (map[h.ticker]) {
        map[h.ticker].totalQty += totalQty;
        map[h.ticker].totalCost += totalCost;
        map[h.ticker].avgCost = map[h.ticker].totalQty > 0 ? map[h.ticker].totalCost / map[h.ticker].totalQty : 0;
      } else {
        map[h.ticker] = { name: h.name, totalQty, totalCost, avgCost, type: h.type };
      }
    });
    return map;
  }, [portData]);

  const heldSymbols = useMemo(() => allSymbols.filter(sym => holdingsMap[sym]), [allSymbols, holdingsMap]);

  const INDEX_ETFS = new Set(["DIA", "QQQ", "VOO"]);
  const pctColor = (sym, pctDown) => {
    if (INDEX_ETFS.has(sym)) return pctDown >= 10 ? C.red : pctDown >= 2 ? C.orange : C.muted;
    return pctDown >= 20 ? C.red : pctDown >= 8 ? C.orange : C.muted;
  };

  const [lastRefresh, setLastRefresh] = useState(null);
  const symbolsRef = useRef(allSymbols);
  symbolsRef.current = allSymbols;

  useEffect(() => {
    if (allSymbols.length === 0) return;

    const doFetch = () => {
      const syms = symbolsRef.current;
      if (syms.length === 0) return;
      setLoading(true);
      Promise.all([
        fetch(`${PLAID_SERVER}/api/market/quote?symbols=${[...syms, "^VIX", "DIA", "QQQ", "BTC-USD", "GC=F", "SI=F"].join(",")}`).then(r => r.json()),
        fetch(`${PLAID_SERVER}/api/market/news?symbols=SPY,QQQ,DIA,VIX,^TNX`).then(r => r.json()),
        fetch(`${PLAID_SERVER}/api/calendar`).then(r => r.json()).catch(() => ({ events: [] })),
        ...syms.map(sym => fetch(`${PLAID_SERVER}/api/market/history?symbol=${sym}`).then(r => r.json()).catch(() => null))
      ]).then(([qData, nData, calData, ...techResults]) => {
        const qMap = {};
        (qData.quotes || []).forEach(q => { qMap[q.symbol] = q; });
        setQuotes(qMap);
        setNews(nData.news || []);
        setCalendarEvents(calData.events || []);
        const tMap = {};
        techResults.forEach(r => { if (r?.symbol) tMap[r.symbol] = r; });
        setTechnicals(tMap);
        setLoading(false);
        setLastRefresh(new Date());
      }).catch(() => setLoading(false));
    };

    doFetch(); // initial

    // Auto-refresh: 5 min during market hours, skip otherwise
    const id = setInterval(() => {
      const now = new Date();
      const etH = parseInt(now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }));
      const etM = parseInt(now.toLocaleString("en-US", { timeZone: "America/New_York", minute: "numeric" }));
      const mins = etH * 60 + etM;
      const dayName = now.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short" });
      const isWeekend = dayName === "Sat" || dayName === "Sun";
      const isMarketHours = !isWeekend && mins >= 9 * 60 + 30 && mins < 16 * 60;
      if (isMarketHours) doFetch();
    }, 5 * 60 * 1000); // every 5 min

    return () => clearInterval(id);
  }, [allSymbols.length > 0]); // only re-run when symbols go from empty → populated

  /* ── Action feed ── */
  const actionFeed = useMemo(() => {
    const actions = [];
    allSymbols.forEach(sym => {
      const q = quotes[sym] || {};
      const tech = technicals[sym];
      if (!q.price) return;
      const h = holdingsMap[sym];
      const name = q.shortName || sym;
      const belowAvg = h && h.avgCost && q.price < h.avgCost;
      const below200 = tech?.signals?.some(sg => sg.includes("Below 200"));
      const deathCross = tech?.ema50 && tech?.ema200 && tech.ema50 < tech.ema200;
      const oversold = tech?.rsi14 < 30;

      if (deathCross) {
        actions.push({ sym, type: "danger", msg: `${name} — death cross. Trend is bearish.`, score: 10,
          signalTags: [`-${q.pctDown?.toFixed(1)}%`, "Death Cross"] });
      }
      if (below200 && !deathCross) {
        actions.push({ sym, type: "danger", msg: `${name} below 200 EMA. ${h ? "Watch your position." : "Wait for recovery."}`, score: 8,
          signalTags: [`-${q.pctDown?.toFixed(1)}%`, "↓200"] });
      }
      if (belowAvg) {
        const discount = ((h.avgCost - q.price) / h.avgCost * 100).toFixed(1);
        actions.push({ sym, type: "avgdown", msg: `Avg down on ${name} — ${discount}% below your cost of $${h.avgCost.toFixed(2)}.`, score: 7,
          signalTags: [`-${discount}%`] });
      }
      if (q.pctDown >= 5 && !belowAvg) {
        actions.push({ sym, type: "buy", msg: `Buy the ${name} dip — down ${q.pctDown.toFixed(1)}% from ATH.`, score: 5 + (q.pctDown > 10 ? 2 : 0),
          signalTags: [`-${q.pctDown.toFixed(1)}%`] });
      }
      if (oversold && !belowAvg && q.pctDown < 5) {
        actions.push({ sym, type: "buy", msg: `${name} RSI ${tech.rsi14} — oversold. Could be a buying opportunity.`, score: 6,
          signalTags: [`-${q.pctDown?.toFixed(1)}%`, "RSI " + tech.rsi14] });
      }
    });
    const best = {};
    actions.forEach(a => { if (!best[a.sym] || a.score > best[a.sym].score) best[a.sym] = a; });
    const dangers = actions.filter(a => a.type === "danger");
    const others = Object.values(best).filter(a => a.type !== "danger");
    const combined = [...dangers, ...others];
    const seen = new Set();
    return combined.filter(a => { const key = a.sym + a.type; if (seen.has(key)) return false; seen.add(key); return true; })
      .sort((a, b) => b.score - a.score).slice(0, 8);
  }, [quotes, technicals, holdingsMap, allSymbols]);

  const DISPLAY_NAMES = { "GC=F": "XAU", "SI=F": "XAG", "BTC-USD": "BTC", "ETH-USD": "ETH" };
  const displaySym = (sym) => DISPLAY_NAMES[sym] || sym;

  /* ── To-do helpers ── */
  const addTodo = (text) => {
    if (!text.trim()) return;
    setTodos([...todos, { id: uid(), text: text.trim(), done: false, created: new Date().toISOString() }]);
    setNewTodo("");
  };
  const toggleTodo = (id) => setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const removeTodo = (id) => setTodos(todos.filter(t => t.id !== id));

  /* ── VIX sentiment ── */
  const vix = quotes["^VIX"] || {};
  const vixLevel = vix.price || 0;
  const vixSentiment = vixLevel >= 30 ? "Extreme Fear" : vixLevel >= 25 ? "Fear" : vixLevel >= 20 ? "Elevated" : vixLevel >= 15 ? "Neutral" : vixLevel > 0 ? "Greed" : null;
  const vixColor = vixLevel >= 30 ? C.red : vixLevel >= 25 ? C.orange : vixLevel >= 20 ? "#f59e0b" : vixLevel >= 15 ? C.muted : C.green;

  // Dynamic market advice based on VIX + index performance
  const vixAdvice = (() => {
    if (!vixLevel) return null;
    const spy = quotes["QQQ"] || quotes["DIA"] || {};
    const mktChg = spy.changePct || 0;
    const vixChg = vix.changePct || 0;

    if (vixLevel >= 30) {
      return mktChg < -2
        ? `Market panic — indices down ${Math.abs(mktChg).toFixed(1)}% with VIX spiking. Historically a great time to start DCA into quality positions. Fear = opportunity.`
        : `VIX is elevated at ${vixLevel.toFixed(0)} but markets are holding (${mktChg >= 0 ? "+" : ""}${mktChg.toFixed(1)}%). Panic is fading — stay ready to deploy cash on any further dips.`;
    }
    if (vixLevel >= 25) {
      return mktChg < -1
        ? `Fear is rising — markets down ${Math.abs(mktChg).toFixed(1)}% today. Consider starting to DCA into ETFs. Don't go all in, scale in gradually.`
        : `VIX shows fear but markets are resilient (${mktChg >= 0 ? "+" : ""}${mktChg.toFixed(1)}%). Buyers are stepping in — a good sign. Watch for follow-through.`;
    }
    if (vixLevel >= 20) {
      return mktChg > 0.5
        ? `Market is shaking off nerves — up ${mktChg.toFixed(1)}% despite elevated VIX. Holding up well. Keep watchlist ready.`
        : mktChg < -0.5
        ? `Market is nervous and drifting lower (${mktChg.toFixed(1)}%). Keep watchlist ready, could see better entry points soon.`
        : `Market is choppy with mild unease. No urgency — stick to plan and watch for clearer direction.`;
    }
    if (vixLevel >= 15) {
      return mktChg > 1
        ? `Markets rallying ${mktChg.toFixed(1)}% in a calm environment. Good conditions — stick to your plan, momentum is positive.`
        : mktChg < -1
        ? `Markets pulling back ${Math.abs(mktChg).toFixed(1)}% but VIX is calm — orderly dip, not panic. Could be a buying opportunity.`
        : mktChg >= 0
        ? `Markets steady (${mktChg >= 0 ? "+" : ""}${mktChg.toFixed(1)}%) with low volatility. Business as usual — stick to your plan.`
        : `Slight red day (${mktChg.toFixed(1)}%) but nothing concerning. Normal market noise.`;
    }
    return mktChg > 0
      ? `Low volatility, market grinding higher (+${mktChg.toFixed(1)}%). Be cautious of complacency — don't chase highs.`
      : `Low VIX but markets flat/slightly red. Calm waters can precede surprises — stay disciplined.`;
  })();

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* ── Market Status ── */}
      {(() => {
        void clockTick;
        const now = new Date();
        const etStr = now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
        const etH = parseInt(now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }));
        const etM = parseInt(now.toLocaleString("en-US", { timeZone: "America/New_York", minute: "numeric" }));
        const mins = etH * 60 + etM;
        const dayName = now.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short" });
        const isWeekend = dayName === "Sat" || dayName === "Sun";

        let session, sessionColor, sessionIcon;
        if (isWeekend) {
          session = "Weekend — Closed"; sessionColor = C.muted; sessionIcon = "●";
        } else if (mins < 4 * 60) {
          session = "Overnight"; sessionColor = C.muted; sessionIcon = "●";
        } else if (mins < 9 * 60 + 30) {
          session = "Pre-Market"; sessionColor = "#f59e0b"; sessionIcon = "◐";
        } else if (mins < 10 * 60) {
          session = "Opening Bell"; sessionColor = C.green; sessionIcon = "◉";
        } else if (mins < 15 * 60) {
          session = "Market Open"; sessionColor = C.green; sessionIcon = "●";
        } else if (mins < 16 * 60) {
          session = "Power Hour"; sessionColor = C.orange; sessionIcon = "◉";
        } else if (mins < 20 * 60) {
          session = "After Hours"; sessionColor = "#f59e0b"; sessionIcon = "◐";
        } else {
          session = "Closed"; sessionColor = C.muted; sessionIcon = "●";
        }

        let countdown = "";
        if (!isWeekend) {
          if (mins < 9 * 60 + 30) {
            const left = 9 * 60 + 30 - mins;
            countdown = `${Math.floor(left / 60)}h ${left % 60}m to open`;
          } else if (mins >= 9 * 60 + 30 && mins < 15 * 60) {
            const left = 15 * 60 - mins;
            countdown = `${Math.floor(left / 60)}h ${left % 60}m to power hour`;
          } else if (mins >= 15 * 60 && mins < 16 * 60) {
            const left = 16 * 60 - mins;
            countdown = `${left}m to close`;
          }
        }

        return (
          <div style={{ ...s.card, marginBottom: 20, padding: 0, overflow: "hidden" }}>
            {/* Top bar: session stripe */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: sessionColor + "12", borderBottom: `1px solid ${sessionColor}25` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13 }}>{sessionIcon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: sessionColor, textTransform: "uppercase", letterSpacing: 0.5 }}>{session}</span>
                {countdown && <span style={{ fontSize: 11, color: C.muted }}>· {countdown}</span>}
              </div>
              <span style={{ fontSize: 13, fontFamily: "'SF Mono', monospace", color: C.text, fontWeight: 600 }}>{etStr} ET</span>
            </div>
            {/* Body */}
            <div style={{ padding: "12px 16px" }}>
              {vixSentiment && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: vixColor }}>{vixLevel.toFixed(2)}</span>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: vixColor, background: vixColor + "18", padding: "2px 8px", borderRadius: 4 }}>{vixSentiment}</span>
                    {vix.changePct != null && (
                      <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>VIX <span style={{ color: vix.changePct >= 0 ? C.red : C.green, fontWeight: 600 }}>{vix.changePct >= 0 ? "+" : ""}{vix.changePct.toFixed(2)}%</span> today</span>
                    )}
                  </div>
                </div>
              )}
              {vixAdvice && <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{vixAdvice}</div>}
              {lastRefresh && <div style={{ fontSize: 9, color: C.muted, marginTop: 6, opacity: 0.6 }}>Updated {lastRefresh.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })} · auto-refreshes every 5m during market hours</div>}
            </div>
          </div>
        );
      })()}

      {/* ── Ticker Tape (scrolling) ── */}
      {(() => {
        const TAPE = [
          { sym: "DIA", label: "US30" },
          { sym: "QQQ", label: "NAS" },
          { sym: "BTC-USD", label: "BTC" },
          { sym: "GC=F", label: "XAU" },
          { sym: "SI=F", label: "XAG" },
        ];
        const hasAny = TAPE.some(t => quotes[t.sym]);
        if (!hasAny) return null;
        const items = TAPE.filter(t => quotes[t.sym]);
        const renderItem = ({ sym, label }) => {
          const q = quotes[sym];
          const up = (q.changePct || 0) >= 0;
          const pctDown = q.pctDown || 0;
          return (
            <span key={sym} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0 16px", whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: C.muted }}>{label}</span>
              <span style={{ fontSize: 11, fontFamily: "'SF Mono', monospace", color: C.text }}>{q.price >= 1000 ? q.price.toFixed(0) : q.price.toFixed(2)}</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: up ? C.green : C.red }}>{up ? "▲" : "▼"}{Math.abs(q.changePct || 0).toFixed(2)}%</span>
              {pctDown > 0.5 && <span style={{ fontSize: 9, color: pctColor(sym, pctDown), fontWeight: 600 }}>-{pctDown.toFixed(1)}%</span>}
              <span style={{ color: C.border, margin: "0 4px", fontSize: 9 }}>•</span>
            </span>
          );
        };
        return (
          <div style={{ marginBottom: 16, borderRadius: 6, overflow: "hidden", background: C.card, border: `1px solid ${C.border}22`, position: "relative", height: 28 }}>
            <style>{`
              @keyframes mc-ticker-scroll {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
            `}</style>
            <div style={{
              display: "flex", alignItems: "center", height: 28, whiteSpace: "nowrap",
              animation: "mc-ticker-scroll 20s linear infinite",
              width: "max-content",
            }}>
              {/* Duplicate items for seamless loop */}
              {items.map(renderItem)}
              {items.map(t => renderItem({ ...t, sym: t.sym, label: t.label, key: t.sym + "_dup" }))}
            </div>
          </div>
        );
      })()}

      {loading && !vixSentiment && <div style={{ ...s.card, textAlign: "center", color: C.muted, marginBottom: 20 }}>Loading market data...</div>}

      {/* ── Economic Calendar (today only, red + orange news) ── */}
      {calendarEvents.length > 0 && (() => {
        const now = new Date();
        const todayStr = now.toDateString();
        const todayEvents = calendarEvents.filter(e => new Date(e.date).toDateString() === todayStr).map(e => ({ ...e, dt: new Date(e.date) }));
        if (todayEvents.length === 0) return null;

        // Generate a one-line summary from today's key events
        const buildSummary = () => {
          const titles = todayEvents.map(e => e.title.toLowerCase());
          const hasCPI = titles.some(t => t.includes("cpi"));
          const hasPPI = titles.some(t => t.includes("ppi"));
          const hasFOMC = titles.some(t => t.includes("fomc"));
          const hasJobs = titles.some(t => t.includes("employment") || t.includes("payroll") || t.includes("jobs") || t.includes("unemployment"));
          const hasGDP = titles.some(t => t.includes("gdp"));
          const hasBOC = titles.some(t => t.includes("boc") || t.includes("overnight rate"));
          const hasPCE = titles.some(t => t.includes("pce"));
          const hasSentiment = titles.some(t => t.includes("consumer sentiment") || t.includes("confidence"));
          const items = []; // { icon, label, what, impact }

          if (hasCPI) {
            const cpiEvent = todayEvents.find(e => e.title.toLowerCase().includes("cpi y/y") && e.country === "USD");
            const actual = cpiEvent?.actual?.trim();
            if (actual && cpiEvent?.forecast) {
              const act = parseFloat(actual);
              const fct = parseFloat(cpiEvent.forecast);
              const prev = parseFloat(cpiEvent.previous);
              if (act > fct) {
                items.push({ icon: "▲", label: "CPI (Inflation)", what: `Came in HOT: ${actual} (expected ${cpiEvent.forecast}, prev ${cpiEvent.previous})`, impact: "Hotter than expected → Fed stays hawkish → pressure on stocks, especially tech." });
              } else if (act < fct) {
                items.push({ icon: "▼", label: "CPI (Inflation)", what: `Came in COOL: ${actual} (expected ${cpiEvent.forecast}, prev ${cpiEvent.previous})`, impact: "Cooler than expected → rate cuts more likely → bullish signal for markets." });
              } else {
                items.push({ icon: "—", label: "CPI (Inflation)", what: `Came in at ${actual} (as expected)`, impact: "In line with expectations — no surprise, markets should stay steady." });
              }
            } else if (cpiEvent?.forecast && cpiEvent?.previous) {
              const fcst = parseFloat(cpiEvent.forecast);
              const prev = parseFloat(cpiEvent.previous);
              if (fcst > prev) {
                items.push({ icon: "▲", label: "CPI (Inflation)", what: `Expected hotter: ${cpiEvent.forecast} vs prev ${cpiEvent.previous}`, impact: "Higher inflation → Fed holds rates → bad for stocks, especially tech. Selloff = DCA opportunity." });
              } else if (fcst < prev) {
                items.push({ icon: "▼", label: "CPI (Inflation)", what: `Expected cooler: ${cpiEvent.forecast} vs prev ${cpiEvent.previous}`, impact: "Lower inflation → rate cuts closer → bullish for stocks." });
              } else {
                items.push({ icon: "—", label: "CPI (Inflation)", what: `Expected flat at ${cpiEvent.forecast}`, impact: "Steady inflation, no big moves expected." });
              }
            } else {
              items.push({ icon: "●", label: "CPI (Inflation)", what: "Inflation data releasing", impact: "Higher CPI → rates stay high → bad for stocks. Lower CPI → rate cuts → bullish." });
            }
          }
          if (hasPPI && !hasCPI) items.push({ icon: "●", label: "PPI (Producer Prices)", what: "Leading signal for consumer inflation", impact: "Higher PPI → rising business costs → squeezed margins → eventual consumer price hikes." });
          if (hasFOMC) items.push({ icon: "●", label: "FOMC Minutes", what: "Fed rate decision clues", impact: "Hawkish tone → selloff risk. Dovish hints → rally fuel." });
          if (hasJobs) {
            const empEvent = todayEvents.find(e => e.title.toLowerCase().includes("employment") && e.country === "CAD");
            const empActual = empEvent?.actual?.trim();
            if (empActual && empEvent?.forecast) {
              const act = parseFloat(empActual.replace(/K/g, ""));
              const fct = parseFloat(empEvent.forecast.replace(/K/g, ""));
              items.push({ icon: act > fct ? "▲" : "▼", label: "Canada Jobs", what: `Actual: ${empActual} (expected ${empEvent.forecast}, prev ${empEvent.previous})`, impact: act > fct ? "Stronger than expected → BOC may hold rates. CAD strength." : "Weaker than expected → rate cuts more likely. CAD weakness." });
            } else if (empEvent?.forecast && empEvent?.previous) {
              items.push({ icon: "●", label: "Canada Jobs", what: `Expecting ${empEvent.forecast} vs last ${empEvent.previous}`, impact: "Strong jobs → BOC holds rates. Weak jobs → rate cuts more likely." });
            } else {
              items.push({ icon: "●", label: "Employment Data", what: "Jobs report releasing", impact: "Strong jobs → less rate cuts. Weak jobs → more cuts." });
            }
          }
          if (hasGDP) items.push({ icon: "●", label: "GDP", what: "Economic growth reading", impact: "Strong GDP → economy OK but Fed may not cut. Weak GDP → recession fears but rate cuts likely." });
          if (hasBOC) {
            const bocEvent = todayEvents.find(e => e.title.toLowerCase().includes("overnight rate"));
            if (bocEvent?.forecast && bocEvent?.previous) {
              const fcst = parseFloat(bocEvent.forecast);
              const prev = parseFloat(bocEvent.previous);
              items.push({ icon: "●", label: "Bank of Canada", what: fcst < prev ? `Expected CUT to ${bocEvent.forecast} (from ${bocEvent.previous})` : `Expected hold at ${bocEvent.forecast}`, impact: fcst < prev ? "Bullish for Canadian markets and real estate." : "Surprise cut → boost markets. Hold → keeps pressure on." });
            } else {
              items.push({ icon: "●", label: "Bank of Canada", what: "Rate decision today", impact: "Watching for hold or cut signals." });
            }
          }
          if (hasPCE) items.push({ icon: "●", label: "Core PCE", what: "Fed's preferred inflation gauge", impact: "Hot PCE → no rate cuts. Cool PCE → cuts on the table." });
          if (hasSentiment) {
            const sentEvent = todayEvents.find(e => e.title.toLowerCase().includes("consumer sentiment"));
            const sentActual = sentEvent?.actual?.trim();
            if (sentActual) {
              const act = parseFloat(sentActual);
              const prev = parseFloat(sentEvent.previous);
              items.push({ icon: act < prev ? "▼" : "▲", label: "Consumer Sentiment", what: `Actual: ${sentActual} (prev ${sentEvent.previous})`, impact: act < prev ? "Confidence falling → consumers nervous → economic slowdown signal." : "Confidence improving → more spending → growth signal." });
            } else if (sentEvent?.forecast && sentEvent?.previous) {
              const fcst = parseFloat(sentEvent.forecast);
              const prev = parseFloat(sentEvent.previous);
              items.push({ icon: fcst < prev ? "▼" : "▲", label: "Consumer Sentiment", what: `Expected ${sentEvent.forecast} (was ${sentEvent.previous})`, impact: fcst < prev ? "Falling confidence → people nervous about spending → slows economy." : "Improving confidence → more spending → economic growth." });
            }
          }
          return items;
        };
        const insights = buildSummary();

        return (
          <div style={{ ...s.card, marginBottom: 20, padding: "14px 16px" }}>
            <div onClick={() => setCollapsed(p => ({ ...p, calendar: !p.calendar }))} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none", marginBottom: collapsed.calendar ? 0 : 10 }}>
              <span style={{ fontSize: 9, color: C.muted, transition: "transform 0.2s", transform: collapsed.calendar ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
              <span style={{ fontSize: 11, color: C.accent }}>◆</span>
              <h3 style={{ ...s.h3, margin: 0 }}>Today's Economic Events</h3>
              <span style={{ fontSize: 11, color: C.muted }}>High & medium impact · {todayEvents.length}</span>
            </div>
            {!collapsed.calendar && <>
              {insights.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                {insights.map((item, i) => (
                  <div key={i} style={{ padding: "8px 10px", background: C.bg2, borderRadius: 6, borderLeft: `2px solid ${C.accent}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 13 }}>{item.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{item.label}</span>
                      <span style={{ fontSize: 11, color: C.muted }}>— {item.what}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.accent, paddingLeft: 22 }}>{item.impact}</div>
                  </div>
                ))}
              </div>}
              {todayEvents.map((e, i) => {
                const time = e.dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
                const isHigh = e.impact === "High";
                const isPast = e.dt < now;
                const hasActual = e.actual && e.actual.trim();
                // Determine beat/miss if we have actual + forecast
                let beatMiss = null;
                if (hasActual && e.forecast) {
                  const act = parseFloat(e.actual.replace(/[%K]/g, ""));
                  const fct = parseFloat(e.forecast.replace(/[%K]/g, ""));
                  if (!isNaN(act) && !isNaN(fct)) {
                    beatMiss = act > fct ? "beat" : act < fct ? "miss" : "inline";
                  }
                }
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13, borderBottom: i < todayEvents.length - 1 ? `1px solid ${C.border}10` : "none" }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: isHigh ? C.red : C.orange, flexShrink: 0 }} />
                    <span style={{ color: C.muted, minWidth: 62, fontSize: 11 }}>{time}</span>
                    <span style={{ color: C.muted, minWidth: 28, fontSize: 9, fontWeight: 600 }}>{e.country}</span>
                    <span style={{ color: C.text, flex: 1, fontWeight: isHigh ? 600 : 400, opacity: isPast && !hasActual ? 0.5 : 1 }}>{e.title}</span>
                    {hasActual ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: beatMiss === "beat" ? C.green : beatMiss === "miss" ? C.red : C.text }}>{e.actual}</span>
                        {beatMiss === "beat" && <span style={{ fontSize: 9, color: C.green, background: C.green + "18", padding: "0 4px", borderRadius: 4, fontWeight: 600 }}>BEAT</span>}
                        {beatMiss === "miss" && <span style={{ fontSize: 9, color: C.red, background: C.red + "18", padding: "0 4px", borderRadius: 4, fontWeight: 600 }}>MISS</span>}
                        {e.forecast && <span style={{ fontSize: 9, color: C.muted }}>fcst {e.forecast}</span>}
                      </span>
                    ) : isPast ? (
                      <span style={{ fontSize: 9, color: C.muted, fontStyle: "italic" }}>released</span>
                    ) : (
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {e.forecast && <span style={{ fontSize: 11, color: C.muted }}>Fcst: {e.forecast}</span>}
                        {e.previous && <span style={{ fontSize: 11, color: C.muted }}>Prev: {e.previous}</span>}
                        <span style={{ fontSize: 9, color: C.accent, background: C.accent + "18", padding: "0 4px", borderRadius: 4, fontWeight: 600 }}>UPCOMING</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </>}
          </div>
        );
      })()}

      {/* ── To-Do List ── */}
      <div style={{ ...s.card, marginBottom: 20 }}>
        <h3 style={{ ...s.h3, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
          onClick={() => setCollapsed(p => ({ ...p, todo: !p.todo }))}>
          <span style={{ fontSize: 9, transition: "transform 0.2s", transform: collapsed.todo ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
          To Do
          {(todos || []).filter(t => !t.done).length > 0 && <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{(todos || []).filter(t => !t.done).length} tasks</span>}
        </h3>
        {collapsed.todo ? null : <>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            style={{ ...s.input, flex: 1 }}
            placeholder="Add a task... (e.g. DCA into ETFs this week)"
            value={newTodo}
            onChange={e => setNewTodo(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTodo(newTodo)}
          />
          <button style={s.btnSm} onClick={() => addTodo(newTodo)}>Add</button>
        </div>

        {/* Auto-suggestions from rules + market data */}
        {(() => {
          const suggestions = [];
          const vixP = vix.price || 0;
          const existingTexts = new Set(todos.map(t => t.text));

          // VIX-based suggestions
          if (vixP >= 25) suggestions.push("DCA extra into ETFs — VIX is elevated (fear = opportunity)");
          if (vixP >= 30) suggestions.push("Deploy extra cash tranche — market panic, historically great entry");

          // Rule-based suggestions
          (rules || []).forEach(r => {
            const rt = r.text.toLowerCase();
            if (rt.includes("dca") && !existingTexts.has("Execute DCA schedule")) {
              suggestions.push("Execute DCA schedule");
            }
            if (rt.includes("rebalance") || rt.includes("rebalancing")) {
              suggestions.push("Review portfolio allocation and rebalance if needed");
            }
            if ((rt.includes("emergency") || rt.includes("cash reserve")) && !existingTexts.has("Check emergency fund level")) {
              suggestions.push("Check emergency fund level");
            }
          });

          // Opportunity-based suggestions
          const bigDips = actionFeed.filter(a => a.type === "avgdown" || (a.type === "buy" && a.score >= 6));
          bigDips.slice(0, 2).forEach(a => {
            const txt = `Consider adding to ${displaySym(a.sym)} — on sale`;
            if (!existingTexts.has(txt)) suggestions.push(txt);
          });

          // Dedupe against existing todos
          const filtered = suggestions.filter(s2 => !existingTexts.has(s2));
          if (filtered.length === 0) return null;

          return (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Suggested by Coach</div>
              {filtered.map((s2, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: `1px solid ${C.border}10` }}>
                  <span style={{ fontSize: 9, color: C.accent }}>◆</span>
                  <span style={{ flex: 1, fontSize: 13, color: C.muted }}>{s2}</span>
                  <button onClick={() => addTodo(s2)} style={{ background: C.accent + "22", color: C.accent, border: "none", borderRadius: 4, padding: "2px 8px", fontSize: 9, cursor: "pointer", whiteSpace: "nowrap" }}>+ Add</button>
                </div>
              ))}
            </div>
          );
        })()}

        {todos.filter(t => !t.done).map(t => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid ${C.border}15` }}>
            <input type="checkbox" checked={false} onChange={() => toggleTodo(t.id)} style={{ cursor: "pointer", accentColor: C.accent }} />
            <span style={{ flex: 1, fontSize: 13, color: C.text }}>{t.text}</span>
            {t.source === "coach" && <span style={{ fontSize: 9, color: C.accent, background: C.accent + "18", padding: "1px 5px", borderRadius: 5 }}>coach</span>}
            <button onClick={() => removeTodo(t.id)} style={{ ...s.btnDanger, padding: "2px 6px", fontSize: 9 }}>✕</button>
          </div>
        ))}
        {todos.filter(t => t.done).length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Completed</div>
            {todos.filter(t => t.done).map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", opacity: 0.5 }}>
                <input type="checkbox" checked={true} onChange={() => toggleTodo(t.id)} style={{ cursor: "pointer", accentColor: C.accent }} />
                <span style={{ flex: 1, fontSize: 13, color: C.muted, textDecoration: "line-through" }}>{t.text}</span>
                <button onClick={() => removeTodo(t.id)} style={{ ...s.btnDanger, padding: "2px 6px", fontSize: 9 }}>✕</button>
              </div>
            ))}
          </div>
        )}
        {todos.length === 0 && !rules?.length && <div style={{ fontSize: 13, color: C.muted, padding: "8px 0" }}>No tasks yet. Add one above, or chat with Coach to build rules that auto-suggest tasks.</div>}
        </>}
      </div>

      {/* ── Opportunities ── */}
      {actionFeed.length > 0 && (
        <div style={{ ...s.card, marginBottom: 20 }}>
          <h3 style={{ ...s.h3, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
            onClick={() => setCollapsed(p => ({ ...p, opps: !p.opps }))}>
            <span style={{ fontSize: 9, transition: "transform 0.2s", transform: collapsed.opps ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
            Opportunities
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{actionFeed.length} actions</span>
          </h3>
          {!collapsed.opps && actionFeed.map((a, i) => {
            const pctTag = a.signalTags.find(t => t.startsWith("-"));
            const otherTags = a.signalTags.filter(t => !t.startsWith("-"));
            const pctVal = pctTag ? parseFloat(pctTag) : 0;
            const pctClr = pctColor(a.sym, Math.abs(pctVal));
            return (
              <div key={a.sym + a.type} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < actionFeed.length - 1 ? `1px solid ${C.border}15` : "none", fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: C.accent, minWidth: 50 }}>{displaySym(a.sym)}</span>
                {pctTag && <span style={{ color: pctClr, fontWeight: 600, fontSize: 11, minWidth: 45 }}>{pctTag}</span>}
                {otherTags.map(tag => (
                  <span key={tag} style={{ background: C.card2, color: C.muted, padding: "0 5px", borderRadius: 5, fontSize: 9, fontWeight: 600, whiteSpace: "nowrap" }}>{tag}</span>
                ))}
                <span style={{ color: C.text, flex: 1 }}>{a.msg}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Holdings Report ── */}

      {heldSymbols.length > 0 && Object.keys(quotes).length > 0 && (() => {
        const reports = heldSymbols.map(sym => {
          const q = quotes[sym] || {};
          const tech = technicals[sym] || {};
          const h = holdingsMap[sym];
          const name = q.shortName || sym;
          const daily = q.changePct || 0;
          const gainLoss = h?.avgCost && q.price ? ((q.price - h.avgCost) / h.avgCost * 100) : null;
          const tags = [];

          // Notable tags
          if (Math.abs(daily) >= 3) tags.push(daily > 0 ? "Big Day" : "Selloff");
          else if (Math.abs(daily) >= 1.5) tags.push(daily > 0 ? "Up" : "Dip");
          if (q.pctDown != null && q.pctDown < 2) tags.push("Near ATH");
          if (q.pctDown >= 25) tags.push("Deep Discount");
          if (tech.rsi14 < 30) tags.push("Oversold");
          if (tech.rsi14 > 70) tags.push("Overbought");
          if (tech.signals?.includes("Above 200 EMA") && tech.signals?.includes("8 EMA > 21 EMA") && q.pctDown >= 10) tags.push("Recovering");
          if (gainLoss != null && gainLoss < -10) tags.push("Underwater");
          if (gainLoss != null && gainLoss > 20) tags.push("Winner");

          // Summary message
          const parts = [];
          if (q.price) parts.push(`$${q.price.toFixed(2)}`);
          if (q.pctDown != null) parts.push(`${q.pctDown.toFixed(1)}% off ATH`);
          if (gainLoss != null) parts.push(`${gainLoss >= 0 ? "+" : ""}${gainLoss.toFixed(1)}% vs cost`);

          return { sym, name, daily, pctDown: q.pctDown, gainLoss, tags, msg: parts.join(" · "), score: Math.abs(daily) * 2 + tags.length * 3 };
        }).sort((a, b) => b.score - a.score);
        return (
          <div style={{ ...s.card, marginBottom: 20 }}>
            <h3 style={{ ...s.h3, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
              onClick={() => setCollapsed(p => ({ ...p, holdings: !p.holdings }))}>
              <span style={{ fontSize: 9, transition: "transform 0.2s", transform: collapsed.holdings ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
              Holdings Report
              <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{reports.length} positions</span>
            </h3>
            {!collapsed.holdings && reports.slice(0, 8).map((r, i) => (
              <div key={r.sym} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < Math.min(reports.length, 8) - 1 ? `1px solid ${C.border}15` : "none", fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: C.accent, minWidth: 50 }}>{displaySym(r.sym)}</span>
                <span style={{ color: r.daily >= 0 ? C.green : C.red, fontWeight: 600, fontSize: 11, minWidth: 50 }}>
                  {r.daily >= 0 ? "+" : ""}{r.daily.toFixed(1)}%
                </span>
                {r.tags.map(tag => (
                  <span key={tag} style={{
                    background: ["Big Day","Winner","Near ATH","Recovering","Up"].includes(tag) ? C.green + "18" :
                      ["Selloff","Deep Discount","Underwater","Dip"].includes(tag) ? C.red + "18" :
                      ["Oversold","Overbought"].includes(tag) ? C.orange + "18" : C.card2,
                    color: ["Big Day","Winner","Near ATH","Recovering","Up"].includes(tag) ? C.green :
                      ["Selloff","Deep Discount","Underwater","Dip"].includes(tag) ? C.red :
                      ["Oversold","Overbought"].includes(tag) ? C.orange : C.muted,
                    padding: "0 5px", borderRadius: 5, fontSize: 9, fontWeight: 600, whiteSpace: "nowrap",
                  }}>{tag}</span>
                ))}
                <span style={{ color: C.muted, flex: 1, fontSize: 11 }}>{r.msg}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Market News (macro/economy focused) ── */}

      {news.length > 0 && (() => {
        const MACRO_KW = /fed|fomc|rate|inflation|cpi|ppi|gdp|jobs|employment|tariff|treasury|yield|recession|economy|economic|powell|market|s&p|nasdaq|dow|selloff|rally|correction|bear|bull|crisis/i;
        const macroNews = news.filter(n => MACRO_KW.test(n.title));
        const shown = macroNews.length > 0 ? macroNews.slice(0, 10) : news.slice(0, 6);
        return (
          <div style={s.card}>
            <h3 style={{ ...s.h3, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
              onClick={() => setCollapsed(p => ({ ...p, news: !p.news }))}>
              <span style={{ fontSize: 9, transition: "transform 0.2s", transform: collapsed.news ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
              Market & Economy
              <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{shown.length} articles</span>
            </h3>
            {!collapsed.news && <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {shown.map((n, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: i < shown.length - 1 ? `1px solid ${C.border}33` : "none", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <a href={n.url} target="_blank" rel="noopener noreferrer"
                      style={{ color: C.accent, fontSize: 13, fontWeight: 500, textDecoration: "none" }}>{n.title}</a>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {n.publisher} {n.date ? "· " + new Date(n.date).toLocaleDateString() : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>}
          </div>
        );
      })()}
    </div>
  );
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
          <td style={{ padding: "3px 0", fontSize: 13, color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{isLiability ? "− " : ""}{item.name}</td>
          <td style={{ padding: "3px 0", textAlign: "right", cursor: hide ? "default" : "text" }}
            onClick={() => { if (!hide) { setEditingItemId(item.id); setEditingUsdId(null); } }}>
            {isEditing && !hide ? (
              <input type="number" autoFocus style={{
                ...s.mono, background: C.card2, border: `1px solid ${isLiability ? C.red : C.accent}`, borderRadius: 4,
                padding: "2px 4px", color, width: "100%", boxSizing: "border-box", textAlign: "right", outline: "none", fontSize: 13,
              }}
                value={item.value} onChange={e => updateItemValue(item.id, e.target.value)}
                onBlur={() => setEditingItemId(null)}
                onKeyDown={e => { if (e.key === "Enter") setEditingItemId(null); }} />
            ) : (
              <span style={{ ...s.mono, fontSize: 13, color, padding: "2px 0", display: "inline-block" }}
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
          <span style={{ fontWeight: 700, fontSize: 13, color: BUCKET_COLORS[bucketName] }}>{settings.bucketNames[bucketName] || bucketName}</span>
          <span style={{ ...s.mono, fontWeight: 700, fontSize: 13, color: netTotal >= 0 ? C.green : C.red }}>{hide ? "•••••" : fmtFull(netTotal)}</span>
        </div>
        <div className="mc-table-wrap"><table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col />
            <col style={{ width: 110 }} />
            {hasUSD && <col style={{ width: 85 }} />}
          </colgroup>
          <thead>
            <tr>
              <th style={{ fontSize: 9, color: C.muted, fontWeight: 500, textAlign: "left", padding: "2px 0", borderBottom: `1px solid ${C.border}33` }}></th>
              <th style={{ fontSize: 9, color: C.muted, fontWeight: 500, textAlign: "right", padding: "2px 0", borderBottom: `1px solid ${C.border}33` }}>CAD</th>
              {hasUSD && <th style={{ fontSize: 9, color: C.muted, fontWeight: 500, textAlign: "right", padding: "2px 0", borderBottom: `1px solid ${C.border}33` }}>USD</th>}
            </tr>
          </thead>
          <tbody>
            {renderItems(assets, false, hasUSD)}
            {liabilities.length > 0 && (
              <tr><td colSpan={colCount} style={{ padding: "6px 0 2px", borderTop: `1px dashed ${C.red}33` }}>
                <span style={{ fontSize: 9, color: C.red, textTransform: "uppercase", letterSpacing: 0.5 }}>Liabilities</span>
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
        <div style={{ background: C.accent + "18", border: `1px solid ${C.accent}44`, borderRadius: 5, padding: "6px 10px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
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
          <button style={{ ...s.btn, padding: "4px 14px", fontSize: 13 }} onClick={saveMonth}>Save</button>
          <button onClick={() => setUnsavedBannerDismissed(true)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: "0 2px", lineHeight: 1 }}>✕</button>
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
          <span style={{ fontSize: 13, color: C.green }}>Saved</span>
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
              <span style={{ fontSize: 16, fontWeight: 700, color: C.text, minWidth: 120, textAlign: "center" }}>
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
      <CollapsibleStats label="Summary" C={C}>
        <div className="mc-stat-row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <StatCard label="Gross Net Worth" value={mask(fmt(current.grossTotal), hide)} sub={mask(fmtFull(current.grossTotal), hide)} C={C} />
          <StatCard label="Total Tax & Owed" value={mask(fmt(current.totalDeductions), hide)} sub={mask(fmtFull(current.totalDeductions), hide)} color={C.orange} C={C} />
          <StatCard label="Adjusted Net Worth" value={mask(fmt(current.total) + " – " + fmt(current.totalHigh), hide)} sub={mask(fmtFull(current.total) + " – " + fmtFull(current.totalHigh), hide)} color={current.total >= 0 ? C.green : C.red} C={C} />
          <StatCard label="Monthly Change" value={mask((nwChange >= 0 ? "+" : "") + fmt(nwChange), hide)} sub={mask((nwChangePct >= 0 ? "+" : "") + (nwChangePct * 100).toFixed(1) + "% from " + monthLabel(prevMonth), hide)} color={nwChange >= 0 ? C.green : C.red} C={C} />
        </div>
      </CollapsibleStats>

      {/* Bucket breakdowns — 2-column grid */}
      <div className="mc-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {BUCKETS.map(b => renderBucket(b))}
      </div>

      {/* Summary panel */}
      <div style={{ ...s.card, background: C.bg2, border: `2px solid ${C.accent}33` }}>
        <h3 style={s.h3}>Net Worth Summary</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 24px", fontSize: 13 }}>
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
                <button onClick={() => removeDeduction(d.id)} style={{ background: "transparent", border: "none", color: C.red, cursor: "pointer", fontSize: 9, padding: 0 }}>✕</button>
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
          <span style={{ color: C.muted, cursor: "pointer", fontSize: 13 }} onClick={addDeduction}>+ Add deduction</span>
          <span />
          <span style={{ color: C.orange, fontWeight: 600 }}>Corp After Deductions</span>
          <span style={{ ...s.mono, textAlign: "right", color: C.orange, fontWeight: 600 }}>{mask(fmtFull(current.corpAfterDeductions), hide)}</span>
          <div style={{ borderBottom: `1px dashed ${C.border}`, gridColumn: "1 / -1", margin: "4px 0" }} />
          <span style={{ fontSize: 11, color: C.red, textTransform: "uppercase", letterSpacing: 0.5, gridColumn: "1 / -1" }}>Step 2: Tax Haircut (Low vs High)</span>

          {/* --- Two-column Low / High comparison --- */}
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "4px 0" }}>
            {/* LOW */}
            <div style={{ background: `${C.red}11`, borderRadius: 5, padding: 12, border: `1px solid ${C.red}33` }}>
              <div style={{ fontSize: 11, color: C.red, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, fontWeight: 600 }}>Low (Conservative)</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 2 }}>Tax: {settings.taxRateIneligible}% on {mask(fmt(current.corpForHaircut), hide)}</div>
              <div style={{ ...s.mono, fontSize: 13, color: C.red }}>−{mask(fmtFull(current.taxHaircut), hide)}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Corp after tax</div>
              <div style={{ ...s.mono, fontSize: 13, fontWeight: 600 }}>{mask(fmtFull(current.afterTaxCorp), hide)}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>+ Personal</div>
              <div style={{ ...s.mono, fontSize: 13 }}>{mask(fmtFull(current.personalTotal), hide)}</div>
              <div style={{ borderTop: `1px solid ${C.red}44`, marginTop: 8, paddingTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Adjusted NW</div>
                <div style={{ ...s.mono, fontSize: 16, fontWeight: 700, color: current.total >= 0 ? C.green : C.red }}>{mask(fmtFull(current.total), hide)}</div>
              </div>
            </div>
            {/* HIGH */}
            <div style={{ background: `${C.green}11`, borderRadius: 5, padding: 12, border: `1px solid ${C.green}33` }}>
              <div style={{ fontSize: 11, color: C.green, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, fontWeight: 600 }}>High (Optimistic)</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 2 }}>Tax: {settings.highTaxRate || 20}% on {mask(fmt(current.corpForHaircut), hide)}</div>
              <div style={{ ...s.mono, fontSize: 13, color: C.green }}>−{mask(fmtFull(current.taxHaircutHigh), hide)}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Corp after tax</div>
              <div style={{ ...s.mono, fontSize: 13, fontWeight: 600 }}>{mask(fmtFull(current.afterTaxCorpHigh), hide)}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>+ Personal</div>
              <div style={{ ...s.mono, fontSize: 13 }}>{mask(fmtFull(current.personalTotal), hide)}</div>
              <div style={{ borderTop: `1px solid ${C.green}44`, marginTop: 8, paddingTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Adjusted NW</div>
                <div style={{ ...s.mono, fontSize: 16, fontWeight: 700, color: C.green }}>{mask(fmtFull(current.totalHigh), hide)}</div>
              </div>
            </div>
          </div>

          <div style={{ borderBottom: `2px solid ${C.accent}`, gridColumn: "1 / -1", margin: "4px 0" }} />
          <span style={{ fontWeight: 700, fontSize: 16, color: C.text }}>Adjusted Net Worth Range</span>
          <span style={{ ...s.mono, textAlign: "right", fontWeight: 700, fontSize: 16, color: current.total >= 0 ? C.green : C.red }}>{mask(fmtFull(current.total) + " – " + fmtFull(current.totalHigh), hide)}</span>
        </div>
        {activeSnap?.notes && <div style={{ marginTop: 12, fontSize: 13, color: C.muted, fontStyle: "italic" }}>{activeSnap.notes}</div>}
        <div style={{ marginTop: 8 }}>
          <input style={{ ...s.input, fontSize: 13 }} placeholder="Notes (e.g. house valued at 2.7M assumption...)"
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
function PortfolioTab({ data, setData, nwData, settings, rates, theme, hide }) {
  const C = themes[theme]; const s = S(theme);
  const [filterBucket, setFilterBucket] = useState("All");
  const [filterTag, setFilterTag] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [expandedClasses, setExpandedClasses] = useState(new Set());
  const [allocSort, setAllocSort] = useState({ col: "actual$", asc: false });
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

  /* allocation by type — derive from NW snapshot (excludes liabilities & real estate for investable allocation) */
  const nwAllocItems = useMemo(() => {
    const snap = nwData?.snapshots?.[0];
    if (!snap || !snap.items?.length) return null;
    const withType = snap.items.map(it => ({ ...it, type: inferNwItemType(it) }));
    return withType.filter(it => it.type !== "Liability" && it.type !== "Real Estate" && it.type !== "Other");
  }, [nwData]);
  /* Short-term liabilities (credit cards, not mortgage) reduce investible cash */
  const nwLiabilityTotal = useMemo(() => {
    const snap = nwData?.snapshots?.[0];
    if (!snap || !snap.items?.length) return 0;
    return snap.items.filter(it => (it.isLiability || inferNwItemType(it) === "Liability") && !/mortgage/i.test(it.name || ""))
      .reduce((sum, it) => sum + Number(it.value || 0), 0);
  }, [nwData, rates]);

  /* Hybrid allocation: NW for non-IB items, portData for IB positions (has Stock/ETF/Crypto detail) */
  const isIBItem = (name) => /interactive brokers/i.test(name);
  const byType = useMemo(() => {
    const map = {};
    if (nwAllocItems) {
      nwAllocItems.forEach(it => {
        if (isIBItem(it.name)) return; /* skip IB aggregate — portData has the breakdown */
        const valCAD = Number(it.value || 0);
        map[it.type] = (map[it.type] || 0) + valCAD;
      });
    }
    /* All portData (IB) positions with their actual types */
    enriched.forEach(h => {
      if (nwAllocItems) {
        map[h.type] = (map[h.type] || 0) + h.valueCAD;
      } else {
        map[h.type] = (map[h.type] || 0) + h.valueCAD;
      }
    });
    if (map["Cash"] && nwLiabilityTotal > 0) map["Cash"] = Math.max(0, map["Cash"] - nwLiabilityTotal);
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [nwAllocItems, enriched, rates, nwLiabilityTotal]);

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
  /* Hybrid actual-by-type: NW for non-IB items, portData for IB positions */
  const hybridActual = useMemo(() => {
    const map = {};
    if (nwAllocItems) {
      nwAllocItems.forEach(it => {
        if (isIBItem(it.name)) return;
        const v = Number(it.value || 0);
        map[it.type] = (map[it.type] || 0) + v;
      });
    }
    enriched.forEach(h => {
      map[h.type] = (map[h.type] || 0) + h.valueCAD;
    });
    if (map["Cash"] && nwLiabilityTotal > 0) map["Cash"] = Math.max(0, map["Cash"] - nwLiabilityTotal);
    return map;
  }, [nwAllocItems, enriched, rates, nwLiabilityTotal]);
  const totalVal = Object.values(hybridActual).reduce((s2, v) => s2 + v, 0);
  const actualByType = hybridActual;
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
  const sortedAllocRows = useMemo(() => {
    if (!allocSort.col) return allocRows;
    const key = { "actual%": "actualPct", "actual$": "actualVal", "target%": "modPct", "target$": "targetVal" }[allocSort.col];
    if (!key) return allocRows;
    return [...allocRows].sort((a, b) => allocSort.asc ? a[key] - b[key] : b[key] - a[key]);
  }, [allocRows, allocSort]);
  const toggleAllocSort = (col) => setAllocSort(prev => prev.col === col ? { col, asc: !prev.asc } : { col, asc: false });
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
      <CollapsibleStats label="Summary" C={C}>
        <div className="mc-stat-row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <StatCard label="Investible Assets" value={mask(fmt(totalVal), hide)} sub="From net worth" color={C.accent} C={C} />
          <StatCard label="IB Gain/Loss" value={mask((totalGain >= 0 ? "+" : "") + fmt(totalGain), hide)} sub={mask(totalCostCAD > 0 ? (totalGain >= 0 ? "+" : "") + (totalGain / totalCostCAD * 100).toFixed(1) + "%" : "", hide)} color={totalGain >= 0 ? C.green : C.red} C={C} />
          <StatCard label="IB Holdings" value={enriched.filter(h => h.ticker !== "CASH").length} sub={mask(fmt(totalValueCAD), hide)} C={C} />
        </div>
      </CollapsibleStats>

      {/* ═══ ROW 2: Allocation ═══ */}
      <div style={{ ...s.card, padding: "12px 20px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ ...s.h3, margin: 0 }}>Allocation</h3>
          <button style={s.btnSm} onClick={() => setShowStrategyEdit(!showStrategyEdit)}>{showStrategyEdit ? "Done" : "Edit Targets"}</button>
        </div>
        {showStrategyEdit && (
          <div style={{ marginBottom: 16, padding: 12, background: C.card2, borderRadius: 5 }}>
            <div style={{ display: "grid", gridTemplateColumns: "110px repeat(2, 1fr)", gap: 4, marginBottom: 8 }}>
              <span />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.accent, textAlign: "center" }}>Moderate %</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.orange, textAlign: "center" }}>Aggressive %</span>
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
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart margin={{ top: 6, right: 60, bottom: 12, left: 60 }}>
              <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={36} paddingAngle={2} strokeWidth={0}
                label={({ cx: pcx, cy: pcy, midAngle, outerRadius: or, name, percent }) => {
                  const RADIAN = Math.PI / 180;
                  const r = or + 30;
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
              <Tooltip formatter={(v) => mask(fmtFull(v), hide)} contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Clean 5-column table */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={{ ...s.th, textAlign: "left", padding: "6px 0" }}>Class</th>
              {["actual%", "actual$", "target%", "target$"].map(col => (
                <th key={col} style={{ ...s.th, textAlign: "right", padding: "6px 0", cursor: "pointer", userSelect: "none" }} onClick={() => toggleAllocSort(col)}>
                  {col === "actual%" ? "Actual %" : col === "actual$" ? "Actual $" : col === "target%" ? "Target %" : "Target $"}
                  {allocSort.col === col ? (allocSort.asc ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedAllocRows.map((r, i) => {
              const inRange = r.actualPct >= Math.min(r.modPct, r.aggPct) && r.actualPct <= Math.max(r.modPct, r.aggPct);
              const under = r.actualPct < Math.min(r.modPct, r.aggPct);
              const midTarget = (r.modPct + r.aggPct) / 2;
              const targetDollar = totalVal * (midTarget / 100);
              const isOpen = expandedClasses.has(r.name);
              /* Show portData holdings + NW line items (excluding IB aggregate) for each type */
              const classHoldings = enriched.filter(h => h.type === r.name).sort((a, b) => b.valueCAD - a.valueCAD);
              const nwClassItems = nwAllocItems ? nwAllocItems.filter(it => it.type === r.name && !isIBItem(it.name)).map(it => ({ ...it, valueCAD: Number(it.value || 0) })).sort((a, b) => b.valueCAD - a.valueCAD) : [];
              const itemCount = classHoldings.length + nwClassItems.length;
              return (
                <React.Fragment key={r.name}>
                  <tr style={{ borderBottom: isOpen ? "none" : `1px solid ${C.border}15`, cursor: "pointer" }} onClick={() => setExpandedClasses(prev => { const next = new Set(prev); if (next.has(r.name)) next.delete(r.name); else next.add(r.name); return next; })}>
                    <td style={{ padding: "8px 0", fontSize: 13, fontWeight: 600, color: C.text }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 9, color: C.muted }}>{isOpen ? "▼" : "▶"}</span>
                        {r.name}
                        <span style={{ fontSize: 9, color: C.muted, fontWeight: 400 }}>({itemCount})</span>
                      </div>
                    </td>
                    <td style={{ padding: "8px 0", fontSize: 13, textAlign: "right", fontWeight: 600, color: !inRange ? (under ? C.orange : C.red) : C.green }}>{r.actualPct.toFixed(1)}%</td>
                    <td style={{ padding: "8px 0", fontSize: 13, textAlign: "right", color: C.text }}>{mask(fmt(r.actualVal), hide)}</td>
                    <td style={{ padding: "8px 0", fontSize: 13, textAlign: "right", color: C.muted }}>{r.modPct === r.aggPct ? `${r.modPct}%` : `${r.modPct}–${r.aggPct}%`}</td>
                    <td style={{ padding: "8px 0", fontSize: 13, textAlign: "right", color: C.muted }}>{mask(fmt(targetDollar), hide)}</td>
                  </tr>
                  {isOpen && classHoldings.map((h, j) => (
                    <tr key={h.id} style={{ background: j % 2 ? C.card2 + "22" : "transparent", borderBottom: j === classHoldings.length - 1 && nwClassItems.length === 0 ? `1px solid ${C.border}44` : "none" }}>
                      <td style={{ padding: "5px 0 5px 30px", fontSize: 13, color: C.text }}>
                        <span style={{ fontWeight: 600 }}>{h.ticker && h.ticker !== "CASH" ? h.ticker : h.name}</span>
                        {h.ticker && h.ticker !== "CASH" && <span style={{ color: C.muted, fontSize: 9, marginLeft: 4 }}>{h.name}</span>}
                        <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 3, background: C.accent2 + "22", color: C.accent2 }}>{h.account}</span>
                      </td>
                      <td style={{ padding: "5px 0", fontSize: 11, textAlign: "right", color: C.muted }}>{totalVal > 0 ? (h.valueCAD / totalVal * 100).toFixed(1) + "%" : "0%"}</td>
                      <td style={{ padding: "5px 0", fontSize: 11, textAlign: "right", color: C.text }}>{mask(fmt(h.valueCAD), hide)}</td>
                      <td style={{ padding: "5px 0", fontSize: 11, textAlign: "right", color: h.gainPct >= 0 ? C.green : C.red }}>{hide ? "•••" : (h.gainPct >= 0 ? "+" : "") + (h.gainPct * 100).toFixed(1) + "%"}</td>
                      <td style={{ padding: "5px 0", fontSize: 9, textAlign: "right", color: C.muted }}>{h.currency !== "CAD" ? `${h.currency} ${fmtFull(h.currentValue)}` : ""}</td>
                    </tr>
                  ))}
                  {isOpen && nwClassItems.map((it, j) => (
                    <tr key={it.id} style={{ background: (classHoldings.length + j) % 2 ? C.card2 + "22" : "transparent", borderBottom: j === nwClassItems.length - 1 ? `1px solid ${C.border}44` : "none" }}>
                      <td style={{ padding: "5px 0 5px 30px", fontSize: 13, color: C.text }}>
                        <span style={{ fontWeight: 600 }}>{it.name}</span>
                        <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 3, background: C.accent2 + "22", color: C.accent2 }}>{it.bucket}</span>
                      </td>
                      <td style={{ padding: "5px 0", fontSize: 11, textAlign: "right", color: C.muted }}>{totalVal > 0 ? (it.valueCAD / totalVal * 100).toFixed(1) + "%" : "0%"}</td>
                      <td style={{ padding: "5px 0", fontSize: 11, textAlign: "right", color: C.text }}>{mask(fmt(it.valueCAD), hide)}</td>
                      <td style={{ padding: "5px 0", fontSize: 11, textAlign: "right", color: C.muted }}>{it.currency}</td>
                      <td style={{ padding: "5px 0", fontSize: 9, textAlign: "right", color: C.muted }}>{it.currency !== "CAD" ? `${it.currency} ${fmtFull(it.value)}` : ""}</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `1px solid ${C.border}` }}>
              <td style={{ padding: "8px 0", fontSize: 13, fontWeight: 700, color: C.text }}>Total</td>
              <td style={{ padding: "8px 0", fontSize: 13, textAlign: "right", fontWeight: 700, color: C.text }}>100%</td>
              <td style={{ padding: "8px 0", fontSize: 13, textAlign: "right", fontWeight: 700, color: C.accent }}>{mask(fmt(totalVal), hide)}</td>
              <td style={{ padding: "8px 0", fontSize: 13, textAlign: "right", color: C.muted }}>100%</td>
              <td style={{ padding: "8px 0", fontSize: 13, textAlign: "right", color: C.muted }}>{mask(fmt(totalVal), hide)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ═══ ROW 3: Rebalance signals ═══ */}
      {actionItems.length > 0 && (
        <div className="mc-stat-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {actionItems.slice(0, 4).map(r => {
            const over = r.diff > 0;
            const midTarget = (r.modPct + r.aggPct) / 2;
            const goalVal = totalVal * (midTarget / 100);
            return (
              <div key={r.name} style={{ flex: 1, minWidth: 160, padding: "10px 14px", borderRadius: 5, background: C.card2 + "66", border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{r.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: over ? C.orange : C.accent, background: (over ? C.orange : C.accent) + "18", padding: "1px 6px", borderRadius: 3 }}>{over ? "Over" : "Under"}</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Now {mask(fmt(r.actualVal), hide)} ({r.actualPct.toFixed(1)}%)</div>
                <div style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>Goal {mask(fmt(goalVal), hide)} ({r.modPct}–{r.aggPct}%)</div>
                <div style={{ fontSize: 9, color: over ? C.orange : C.accent, marginTop: 4 }}>{over ? "↓" : "↑"} {mask(fmt(Math.abs(r.diff)), hide)} to rebalance</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ ROW 4: Holdings by Manager ═══ */}
      {(() => {
        const managerGroups = [
          { key: "ib", label: "Interactive Brokers", iconName: "briefcase", desc: "Self-managed positions", items: sorted },
        ].filter(g => g.items.length > 0);

        const renderHolding = (h, i) => (
          <div key={h.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 70px 24px", alignItems: "center", padding: "7px 14px", background: i % 2 ? C.card2 + "22" : "transparent", fontSize: 13, gap: 8 }}>
            <div>
              <span style={{ fontWeight: 600, color: C.text }}>{h.ticker && h.ticker !== "CASH" && h.ticker !== "CAR" && h.ticker !== "COINS" ? h.ticker : h.name}</span>
              {h.ticker && h.ticker !== "CASH" && h.ticker !== "CAR" && h.ticker !== "COINS" && <span style={{ color: C.muted, fontSize: 9, marginLeft: 4 }}>{h.name}</span>}
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
            <button style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 9, padding: 0 }} onClick={() => removeHolding(h.id)}>✕</button>
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
                <h3 style={{ ...s.h3, margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 6 }}><Icon name={group.iconName} size={15} color={C.accent} /> {group.label} <span style={{ fontSize: 13, fontWeight: 400, color: C.muted }}>— {group.desc}</span></h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ ...s.mono, fontSize: 13, fontWeight: 700, color: C.accent }}>{mask(fmt(groupVal), hide)}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{totalValueCAD > 0 ? (groupVal / totalValueCAD * 100).toFixed(0) + "%" : ""}</span>
                  {group.key === "ib" && <button style={{ ...s.btnSm, fontSize: 11, padding: "4px 10px" }} onClick={refreshPrices} disabled={priceRefreshing}>{priceRefreshing ? "..." : "Refresh Prices"}</button>}
                </div>
              </div>
              {lastRefresh && group.key === "ib" && <div style={{ fontSize: 9, color: C.green, marginBottom: 6 }}>Prices updated {lastRefresh}</div>}
              {sortedSubs.map(([acct, items]) => {
                const acctVal = items.reduce((s2, h) => s2 + h.valueCAD, 0);
                const isOpen = expandedAccounts[acct] !== false;
                return (
                  <div key={acct} style={{ background: C.card, borderRadius: 5, border: `1px solid ${C.border}`, marginBottom: 6, overflow: "hidden" }}>
                    <div onClick={() => toggleExpand(acct, setExpandedAccounts)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 9, color: C.muted }}>{isOpen ? "▼" : "▶"}</span>
                        <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{acct}</span>
                        <span style={{ fontSize: 9, color: C.muted }}>{items.length}</span>
                      </div>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ ...s.mono, fontSize: 13, fontWeight: 600 }}>{mask(fmt(acctVal), hide)}</span>
                        <span style={{ fontSize: 9, color: C.muted, minWidth: 40, textAlign: "right" }}>{totalValueCAD > 0 ? (acctVal / totalValueCAD * 100).toFixed(1) + "%" : ""}</span>
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
            <div style={{ ...s.mono, fontSize: 16, fontWeight: 700, color: C.accent, paddingTop: 8 }}>
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
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: C.green }}>Deployed: {mask(fmtFull(deployed), hide)}</span>
                <span style={{ color: C.muted }}>Remaining: {mask(fmtFull(remaining), hide)}</span>
              </div>
              <div style={{ background: C.card2, borderRadius: 5, height: 16, overflow: "hidden" }}>
                <div style={{ background: `linear-gradient(90deg, ${C.green}, ${C.accent})`, height: "100%", width: `${Math.min(100, pctDone * 100)}%`, borderRadius: 5, transition: "width 0.5s" }} />
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
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>When markets drop from their high, deploy extra cash on top of your monthly DCA.</div>
        {(strategy.dipTriggers || []).map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "8px 12px", background: C.card2 + "44", borderRadius: 5 }}>
            <span style={{ fontSize: 16, color: t.pctDrop >= 15 ? C.red : t.pctDrop >= 10 ? C.orange : C.muted, fontWeight: 700 }}>{t.pctDrop >= 15 ? "▼▼" : t.pctDrop >= 10 ? "▼" : "—"}</span>
            <span style={{ fontSize: 13, color: C.text, flex: 1 }}>
              If market drops <strong style={{ color: C.red }}>{t.pctDrop}%</strong> from high → deploy extra <strong style={{ color: C.green }}>{mask(fmtFull(t.extraAmount), hide)}</strong>
            </span>
            <button style={{ ...s.btnSm, padding: "2px 8px", fontSize: 9 }} onClick={() => {
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
        <h3 style={{ ...s.h3, fontSize: 16, display: "flex", alignItems: "center", gap: 6 }}><Icon name="brain" size={16} color={C.accent} /> Hold Zone — Your Calm-Mind Rules</h3>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
          You wrote these when you were thinking clearly. Read them when you feel the urge to sell.
        </div>
        {(strategy.holdRules || []).map((rule, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10, padding: "12px 16px", background: C.card2 + "66", borderRadius: 5, borderLeft: `3px solid ${C.accent}` }}>
            <span style={{ fontSize: 13, color: C.accent, fontWeight: 700, flexShrink: 0, width: 18, textAlign: "center" }}>{i + 1}</span>
            <span style={{ fontSize: 13, color: C.text, lineHeight: 1.5, flex: 1 }}>{rule}</span>
            <button style={{ background: "transparent", border: "none", color: C.red + "88", cursor: "pointer", fontSize: 9, padding: "2px 6px", flexShrink: 0 }}
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
        <h3 style={{ ...s.h3, display: "flex", alignItems: "center", gap: 6 }}><Icon name="trendingUp" size={15} color={C.accent} /> Historical Perspective — Why Holding Works</h3>
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
        <div style={{ marginTop: 16, padding: "12px 16px", background: C.green + "12", borderRadius: 5, border: `1px solid ${C.green}33` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 4 }}>Key Stat</div>
          <div style={{ fontSize: 13, color: C.text }}>
            If you invested $10,000 in the S&P 500 in 2000 (the worst possible timing — right before the dot-com crash) and held through <em>two</em> major crashes, by 2025 it would be worth roughly <strong style={{ color: C.green }}>$64,000</strong>. Selling during either crash would have locked in losses.
          </div>
        </div>
        <div style={{ marginTop: 12, padding: "12px 16px", background: C.accent + "12", borderRadius: 5, border: `1px solid ${C.accent}33` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 4 }}>The Cost of Missing the Best Days</div>
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
              <span style={{ fontSize: 13, color: C.muted }}>Alerts:</span>
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
  const [mainView] = useState("All");
  const [filterType, setFilterType] = useState("all");
  const [period, setPeriod] = useState("monthly");
  const [viewMonth, setViewMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; });
  const [showAddTx, setShowAddTx] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadBucket, setUploadBucket] = useState("Opco");
  const [uploadAccount, setUploadAccount] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [collapsedSections, setCollapsedSections] = useState({});
  const [showCharts, setShowCharts] = useState(false);
  const [cfSubTab, setCfSubTab] = useState("transactions");
  const [filterAccountId, setFilterAccountId] = useState(null);
  const [rulesSearch, setRulesSearch] = useState("");
  const [rulesPage, setRulesPage] = useState(0);
  const [editingRule, setEditingRule] = useState(null);
  const [editingBudget, setEditingBudget] = useState(null);
  const [newRule, setNewRule] = useState({ pattern: "", Opco: "", Holdco: "", Jon: "", Jacqueline: "" });
  const [txSearch, setTxSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const viewBuckets = mainView === "Opco" ? ["Opco", "Holdco"] : mainView === "Personal" ? ["Jon", "Jacqueline"] : BUCKETS;
  const bucketAbbrev = { Opco: "Op", Holdco: "Hld", Jon: "Jn", Jacqueline: "Jq" };

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

  const [uploadedAccounts, setUploadedAccounts] = useState({});
  const [newTx, setNewTx] = useState({ date: new Date().toISOString().slice(0, 10), bucket: "Opco", type: "expense", category: DEFAULT_TAX_CATS["Opco"]?.[0] || "Uncategorized", description: "", amount: "", currency: "CAD" });
  const { sortKey, sortDir, onSort, sortFn } = useSortable("date", "desc");

  const txns = data.transactions || [];
  const budgets = data.budgets || [];
  const catRules = data.catRules || {};
  const currentMonth = viewMonth;

  const bankAccounts = data.bankAccounts || {};
  const budgetTargets = data.budgetTargets || {};

  const autoCategory = (desc, bucket, plaidCat = null) => {
    /* Tier 1: user-learned pattern rules */
    const key = desc.toLowerCase().trim();
    for (const [pattern, rules] of Object.entries(catRules)) {
      if (key.includes(pattern) && rules[bucket]) return rules[bucket];
    }
    /* Tier 2: Plaid category fallback */
    if (plaidCat) {
      const mapped = PLAID_CATEGORY_MAP[plaidCat];
      if (mapped && mapped[bucket]) return mapped[bucket];
    }
    return null;
  };

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

  /* filter by view + type + period */
  const filtered = allTxns.filter(t => {
    if (!viewBuckets.includes(t.bucket)) return false;
    if (filterAccountId && t.plaidAccountId !== filterAccountId) return false;
    if (filterType === "income" && t.type !== "income") return false;
    if (filterType === "expense" && t.type !== "expense") return false;
    if (filterType === "transfers" && !t.isTransfer) return false;
    if (txSearch && !(t.description || "").toLowerCase().includes(txSearch.toLowerCase()) && !(t.category || "").toLowerCase().includes(txSearch.toLowerCase())) return false;
    const mk = toMonthKey(t.date);
    if (period === "monthly" && mk !== viewMonth) return false;
    if (period === "quarterly") {
      const [vy, vm] = viewMonth.split("-").map(Number);
      const q = Math.floor((vm - 1) / 3);
      const [ty, tm] = mk.split("-").map(Number);
      if (ty !== vy || Math.floor((tm - 1) / 3) !== q) return false;
    }
    if (period === "annual" && !mk.startsWith(viewMonth.split("-")[0])) return false;
    return true;
  });

  const nonTransfer = filtered.filter(t => !t.isTransfer);
  const totalIncome = nonTransfer.filter(t => t.type === "income").reduce((s2, t) => s2 + toBase(t.amount, t.currency || "CAD", rates), 0);
  const totalExpenses = nonTransfer.filter(t => t.type === "expense").reduce((s2, t) => s2 + toBase(t.amount, t.currency || "CAD", rates), 0);
  const netFlow = totalIncome - totalExpenses;
  const sorted = sortFn(filtered.map(t => ({ ...t, amountSigned: t.type === "income" ? t.amount : -t.amount })));
  const unreviewedCount = sorted.filter(t => !t.reviewed).length;
  const uncategorizedCount = sorted.filter(t => t.category === "Uncategorized").length;
  const overBudgetCats = Object.entries(budgetTargets).filter(([cat, b]) => {
    const actual = nonTransfer.filter(t => t.type === "expense" && t.category === cat).reduce((s2, t) => s2 + toBase(t.amount, t.currency || "CAD", rates), 0);
    return actual > b.monthly;
  }).map(([cat]) => cat);

  /* hierarchical category totals for the summary panel */
  const hierTotals = useMemo(() => {
    const result = {};
    viewBuckets.forEach(bucket => {
      const groups = EXPENSE_CATS[bucket] || {};
      const bucketResult = {};
      Object.entries(groups).forEach(([groupName, subcats]) => {
        const subcatTotals = {};
        let groupTotal = 0;
        subcats.forEach(cat => {
          const total = nonTransfer.filter(t => t.type === "expense" && t.bucket === bucket && t.category === cat)
            .reduce((s2, t) => s2 + toBase(t.amount, t.currency || "CAD", rates), 0);
          subcatTotals[cat] = total;
          groupTotal += total;
        });
        bucketResult[groupName] = { total: groupTotal, subcategories: subcatTotals };
      });
      result[bucket] = bucketResult;
    });
    return result;
  }, [nonTransfer, viewBuckets, rates]);

  /* income totals — hierarchical (mirrors hierTotals for expenses) */
  const hierIncomeTotals = useMemo(() => {
    const result = {};
    viewBuckets.forEach(bucket => {
      const groups = INCOME_GROUPS[bucket] || {};
      const bucketResult = {};
      Object.entries(groups).forEach(([groupName, subcats]) => {
        const subcatTotals = {};
        let groupTotal = 0;
        subcats.forEach(cat => {
          const total = nonTransfer.filter(t => t.type === "income" && t.bucket === bucket && t.category === cat)
            .reduce((s2, t) => s2 + toBase(t.amount, t.currency || "CAD", rates), 0);
          subcatTotals[cat] = total;
          groupTotal += total;
        });
        bucketResult[groupName] = { total: groupTotal, subcategories: subcatTotals };
      });
      result[bucket] = bucketResult;
    });
    return result;
  }, [nonTransfer, viewBuckets, rates]);

  /* transfer totals */
  const transferTotals = useMemo(() => {
    const result = {};
    viewBuckets.forEach(bucket => {
      result[bucket] = {};
      (TRANSFER_CATS[bucket] || []).forEach(cat => {
        result[bucket][cat] = filtered.filter(t => t.isTransfer && t.bucket === bucket && t.category === cat)
          .reduce((s2, t) => s2 + toBase(t.amount, t.currency || "CAD", rates), 0);
      });
    });
    return result;
  }, [filtered, viewBuckets, rates]);

  /* uncategorized expenses */
  const uncategorizedTotal = useMemo(() => {
    const allKnownCats = new Set();
    viewBuckets.forEach(b => {
      Object.values(EXPENSE_CATS[b] || {}).forEach(subs => subs.forEach(c => allKnownCats.add(c)));
    });
    return nonTransfer.filter(t => t.type === "expense" && !allKnownCats.has(t.category))
      .reduce((s2, t) => s2 + toBase(t.amount, t.currency || "CAD", rates), 0);
  }, [nonTransfer, viewBuckets, rates]);

  const handleCSVImport = (rows, bucket) => {
    const mapped = rows.map(r => {
      const amt = parseFloat(r.amount || r.debit || r.credit || r.value || 0);
      const desc = r.description || r.memo || r.name || r.payee || "";
      const isIncome = amt < 0 || (r.type || "").toLowerCase().includes("income") || (r.type || "").toLowerCase().includes("credit");
      const cat = autoCategory(desc, bucket) || (isIncome ? "Other Income" : "Uncategorized");
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
  const toggleReviewed = (txId) => setData({ ...data, transactions: txns.map(t => t.id === txId ? { ...t, reviewed: !t.reviewed } : t) });
  const recategorize = (txId, newCat) => {
    const tx = txns.find(t => t.id === txId);
    if (!tx) return;
    const updated = txns.map(t => t.id === txId ? { ...t, category: newCat } : t);
    const key = tx.description.toLowerCase().trim();
    if (key) {
      const newRules = { ...catRules, [key]: { ...(catRules[key] || {}), [tx.bucket]: newCat } };
      setData({ ...data, transactions: updated, catRules: newRules });
    } else {
      setData({ ...data, transactions: updated });
    }
  };

  const toggleGroup = (name) => setCollapsedGroups(prev => ({ ...prev, [name]: !prev[name] }));

  /* ── Plaid transaction import ── */
  const importPlaidTransactions = async (connId) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = now.toISOString().slice(0, 10);
    const res = await fetch(`${PLAID_SERVER}/api/plaid/transactions/${connId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: start, endDate: end }),
    });
    const { transactions: plaidTxns } = await res.json();
    const existing = new Set(txns.filter(t => t.plaidId).map(t => t.plaidId));
    const mapped = (plaidTxns || []).filter(t => !t.pending && !existing.has(t.id)).map(t => {
      const acct = bankAccounts[t.accountId];
      if (!acct || !acct.enabled || !acct.bucket) return null;
      const bucket = acct.bucket;
      const isIncome = t.amount < 0;
      const cat = autoCategory(t.name, bucket, t.category) || (isIncome ? "Other Income" : "Uncategorized");
      return {
        id: uid(), plaidId: t.id, plaidAccountId: t.accountId, plaidCategory: t.category,
        source: "plaid", date: t.date, bucket,
        type: isIncome ? "income" : "expense",
        category: cat, description: t.name,
        amount: Math.abs(t.amount), currency: t.currency || "CAD",
      };
    }).filter(Boolean);
    setData({ ...data, transactions: [...txns, ...mapped] });
    return mapped.length;
  };

  /* ── Rule CRUD helpers ── */
  const addCatRule = (pattern, bucketCats) => {
    const key = pattern.toLowerCase().trim();
    if (!key) return;
    setData({ ...data, catRules: { ...catRules, [key]: { ...(catRules[key] || {}), ...bucketCats } } });
  };
  const updateCatRule = (oldPattern, newPattern, bucketCats) => {
    const newRules = { ...catRules };
    if (oldPattern !== newPattern) delete newRules[oldPattern];
    newRules[newPattern.toLowerCase().trim()] = bucketCats;
    setData({ ...data, catRules: newRules });
  };
  const deleteCatRule = (pattern) => {
    const newRules = { ...catRules };
    delete newRules[pattern];
    setData({ ...data, catRules: newRules });
  };
  const importRulesCSV = (csvText) => {
    const rows = parseCSV(csvText);
    const newRules = { ...catRules };
    rows.forEach(row => {
      const p = (row.pattern || row.name || row.merchant || row.payee || "").toLowerCase().trim();
      if (!p) return;
      const m = {};
      if (row.opco || row.Opco) m.Opco = row.opco || row.Opco;
      if (row.holdco || row.Holdco) m.Holdco = row.holdco || row.Holdco;
      if (row.jon || row.Jon) m.Jon = row.jon || row.Jon;
      if (row.jacqueline || row.Jacqueline) m.Jacqueline = row.jacqueline || row.Jacqueline;
      if (row.category) { BUCKETS.forEach(b => { if (!m[b]) m[b] = row.category; }); }
      newRules[p] = { ...(newRules[p] || {}), ...m };
    });
    setData({ ...data, catRules: newRules });
  };

  /* ── Budget helpers ── */
  const setBudget = (catName, monthly) => {
    const val = parseFloat(monthly);
    if (isNaN(val) || val <= 0) {
      const nb = { ...budgetTargets }; delete nb[catName];
      setData({ ...data, budgetTargets: nb });
    } else {
      setData({ ...data, budgetTargets: { ...budgetTargets, [catName]: { monthly: val } } });
    }
    setEditingBudget(null);
  };

  return (
    <div>
      {/* Controls bar — single line */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 14, borderBottom: `1px solid ${C.border}` }}>
        {["transactions", "accounts", "rules"].map(tab => (
          <button key={tab} onClick={() => setCfSubTab(tab)}
            style={{ background: "transparent", border: "none", color: cfSubTab === tab ? C.text : C.muted, fontWeight: cfSubTab === tab ? 700 : 400, fontSize: 13, padding: "10px 16px", cursor: "pointer", borderBottom: cfSubTab === tab ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1 }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        {filterAccountId && (
          <span onClick={() => setFilterAccountId(null)}
            style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: C.accent + "22", color: C.accent, cursor: "pointer", fontWeight: 600, marginLeft: 8 }}>
            {bankAccounts[filterAccountId]?.name || "Account"} &times;
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, paddingBottom: 6 }}>
          {cfSubTab === "transactions" && <>
            <input style={{ ...s.input, width: 160, fontSize: 12, padding: "5px 10px" }} placeholder="Search..." value={txSearch} onChange={e => setTxSearch(e.target.value)} />
            <input type="month" style={{ ...s.input, width: 130, fontSize: 12, padding: "5px 8px" }} value={viewMonth} onChange={e => setViewMonth(e.target.value)} />
            <button onClick={() => setShowFilters(p => !p)}
              style={{ background: "transparent", border: `1px solid ${showFilters || filterType !== "all" || period !== "monthly" ? C.accent : C.border}`, borderRadius: 5, color: showFilters || filterType !== "all" || period !== "monthly" ? C.accent : C.muted, fontSize: 11, padding: "5px 10px", cursor: "pointer" }}>
              Filters{filterType !== "all" || period !== "monthly" ? " ●" : ""}
            </button>
          </>}
        </div>
      </div>
      {cfSubTab === "transactions" && showFilters && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, padding: "8px 12px", background: C.card2, borderRadius: 6 }}>
          <span style={{ fontSize: 11, color: C.muted, marginRight: 4 }}>Type:</span>
          {["all", "income", "expense", "transfers"].map(f => (
            <button key={f} onClick={() => setFilterType(f)}
              style={{ ...s.btnSm, background: filterType === f ? C.accent2 : "transparent", color: filterType === f ? "#fff" : C.muted, fontWeight: filterType === f ? 700 : 400, fontSize: 11, padding: "3px 8px" }}>
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <span style={{ width: 1, height: 18, background: C.border, margin: "0 4px" }} />
          <span style={{ fontSize: 11, color: C.muted, marginRight: 4 }}>Period:</span>
          {["monthly", "quarterly", "annual"].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ ...s.btnSm, background: period === p ? C.card2 : "transparent", color: period === p ? C.text : C.muted, fontSize: 11, padding: "3px 8px", border: period === p ? `1px solid ${C.border}` : "1px solid transparent" }}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Two-panel layout — Transactions view */}
      {cfSubTab === "transactions" && <div className="mc-flex-row" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* LEFT: Transaction list */}
        <div style={{ flex: 3, minWidth: 0 }}>
          {/* Actions needed card */}
          {(uncategorizedCount > 0 || unreviewedCount > 0 || overBudgetCats.length > 0) && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>
              {uncategorizedCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: C.accent, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>{uncategorizedCount} uncategorized</span>
                  <span style={{ fontSize: 12, color: C.muted }}>— assign categories to improve auto-rules</span>
                </div>
              )}
              {unreviewedCount > 0 && unreviewedCount !== uncategorizedCount && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: C.orange, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.orange }}>{unreviewedCount} to review</span>
                  <span style={{ fontSize: 12, color: C.muted }}>— check these transactions are categorized correctly</span>
                </div>
              )}
              {overBudgetCats.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: C.red, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.red }}>{overBudgetCats.length} over budget</span>
                  <span style={{ fontSize: 12, color: C.muted }}>— {overBudgetCats.slice(0, 3).join(", ")}{overBudgetCats.length > 3 ? ` +${overBudgetCats.length - 3} more` : ""}</span>
                </div>
              )}
            </div>
          )}

          {/* Transaction table */}
          <div className="mc-table-wrap" style={{ ...s.card, overflowX: "auto", padding: sorted.length === 0 ? 20 : 0 }}>
            {sorted.length === 0 ? (
              <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 20 }}>
                No transactions for {monthLabel(viewMonth)}. Upload a bank statement or add manually below.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, width: 28, padding: "6px 8px" }}></th>
                    <th style={{ ...s.th, padding: "6px 8px", cursor: "pointer" }} onClick={() => onSort("date")}>DATE{sortKey === "date" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}</th>
                    <th style={{ ...s.th, padding: "6px 8px", cursor: "pointer" }} onClick={() => onSort("category")}>CATEGORY{sortKey === "category" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}</th>
                    <th style={{ ...s.th, padding: "6px 8px", width: 36 }}></th>
                    <th style={{ ...s.th, padding: "6px 8px", textAlign: "right", cursor: "pointer" }} onClick={() => onSort("amount")}>AMOUNT{sortKey === "amount" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}</th>
                    <th style={{ ...s.th, padding: "6px 8px" }}>NOTES</th>
                    <th style={{ ...s.th, width: 28, padding: "6px 8px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((t, i) => (
                    <tr key={t.id} style={{ background: t.isTransfer ? C.accent2 + "08" : t.reviewed ? "transparent" : (i % 2 ? C.card2 + "22" : "transparent"), borderBottom: `1px solid ${C.border}15` }}>
                      <td style={{ padding: "6px 8px" }}>
                        <input type="checkbox" checked={!!t.reviewed} onChange={() => toggleReviewed(t.id)} style={{ cursor: "pointer", accentColor: C.green }} />
                      </td>
                      <td style={{ padding: "6px 8px", fontSize: 13, color: C.muted, whiteSpace: "nowrap" }}>
                        {new Date(t.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </td>
                      <td style={{ padding: "6px 8px", fontSize: 13, color: C.text }}>
                        <select style={{ ...s.select, padding: "2px 4px", fontSize: 12, background: "transparent", border: "none", color: t.isTransfer ? C.accent2 : C.text }}
                          value={t.category} onChange={e => recategorize(t.id, e.target.value)}>
                          {[...(t.type === "income" ? INCOME_CATS[t.bucket] || [] : [...(DEFAULT_TAX_CATS[t.bucket] || []), ...(TRANSFER_CATS[t.bucket] || [])]), t.category]
                            .filter((v, idx, a) => a.indexOf(v) === idx).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "6px 8px", fontSize: 10, color: C.muted }}>
                        <span style={{ ...S(theme).badge(BUCKET_COLORS[t.bucket]), fontSize: 9, padding: "1px 4px" }}>{bucketAbbrev[t.bucket]}</span>
                      </td>
                      <td style={{ padding: "6px 8px", fontSize: 13, fontWeight: 600, textAlign: "right", fontFamily: "monospace",
                        color: t.isTransfer ? C.accent2 : t.type === "income" ? C.green : C.red }}>
                        {t.type === "income" ? "" : "-"}{t.currency !== "CAD" ? t.currency : ""}${fmtFull(t.amount).replace("$", "")}
                      </td>
                      <td style={{ padding: "6px 8px", fontSize: 12, color: C.muted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.description}
                      </td>
                      <td style={{ padding: "6px 8px" }}><button style={{ ...s.btnDanger, fontSize: 10, padding: "2px 6px" }} onClick={() => removeTx(t.id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Add transaction + Upload — compact row */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button style={{ ...s.btnSm, fontSize: 12 }} onClick={() => setShowAddTx(!showAddTx)}>+ Add</button>
            <button style={{ ...s.btnSm, fontSize: 12 }} onClick={() => setShowUpload(!showUpload)}>Upload CSV</button>
            <button style={{ ...s.btnSm, fontSize: 12, background: showCharts ? C.accent2 : C.card2, color: showCharts ? "#fff" : C.text }} onClick={() => setShowCharts(!showCharts)}>Charts</button>
          </div>

          {showAddTx && (
            <div style={{ ...s.card, marginTop: 8 }}>
              <div style={{ ...s.row, gap: 8, flexWrap: "wrap" }}>
                <input type="date" style={{ ...s.input, width: 130, fontSize: 12 }} value={newTx.date} onChange={e => setNewTx({ ...newTx, date: e.target.value })} />
                <select style={{ ...s.select, fontSize: 12 }} value={newTx.bucket} onChange={e => setNewTx({ ...newTx, bucket: e.target.value, category: DEFAULT_TAX_CATS[e.target.value]?.[0] || "Uncategorized" })}>
                  {viewBuckets.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <select style={{ ...s.select, fontSize: 12 }} value={newTx.type} onChange={e => setNewTx({ ...newTx, type: e.target.value, category: e.target.value === "income" ? INCOME_CATS[newTx.bucket]?.[0] || "Other Income" : DEFAULT_TAX_CATS[newTx.bucket]?.[0] || "Uncategorized" })}>
                  <option value="expense">Expense</option><option value="income">Income</option>
                </select>
                <select style={{ ...s.select, fontSize: 12 }} value={newTx.category} onChange={e => setNewTx({ ...newTx, category: e.target.value })}>
                  {(newTx.type === "income" ? INCOME_CATS[newTx.bucket] || [] : DEFAULT_TAX_CATS[newTx.bucket] || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input style={{ ...s.input, width: 140, fontSize: 12 }} placeholder="Description" value={newTx.description} onChange={e => setNewTx({ ...newTx, description: e.target.value })} />
                <input style={{ ...s.input, width: 90, fontSize: 12 }} placeholder="Amount" type="number" value={newTx.amount} onChange={e => setNewTx({ ...newTx, amount: e.target.value })} />
                <select style={{ ...s.select, fontSize: 12, width: 70 }} value={newTx.currency} onChange={e => setNewTx({ ...newTx, currency: e.target.value })}>
                  <option value="CAD">CAD</option><option value="USD">USD</option><option value="GBP">GBP</option>
                </select>
                <button style={{ ...s.btn, fontSize: 12 }} onClick={addTx}>Add</button>
              </div>
            </div>
          )}

          {showUpload && (
            <div style={{ ...s.card, marginTop: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, marginBottom: 8 }}>
                {viewBuckets.map(bucket => {
                  const accts = accountsByBucket[bucket] || [];
                  if (accts.length === 0) return null;
                  return (
                    <div key={bucket} style={{ background: C.card2, borderRadius: 5, padding: 10, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: BUCKET_COLORS[bucket], marginBottom: 6, textTransform: "uppercase" }}>{bucket}</div>
                      {accts.map((acct, i) => (
                        <div key={i} onClick={() => { setUploadBucket(bucket); setUploadAccount(acct.name); }}
                          style={{ display: "flex", justifyContent: "space-between", padding: "4px 6px", borderRadius: 4, cursor: "pointer", fontSize: 12,
                            background: uploadBucket === bucket && uploadAccount === acct.name ? C.accent + "22" : "transparent" }}>
                          <span style={{ color: C.text }}>{acct.name}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              {uploadAccount && (
                <div style={{ padding: 10, background: C.accent + "11", borderRadius: 5 }}>
                  <div style={{ fontSize: 12, color: C.text, marginBottom: 6 }}>Upload for: <strong>{uploadBucket} — {uploadAccount}</strong></div>
                  <input type="file" accept=".csv" style={{ color: C.text, fontSize: 12 }}
                    onChange={e => {
                      const f = e.target.files[0]; if (!f) return;
                      const r = new FileReader();
                      r.onload = (ev) => {
                        handleCSVImport(parseCSV(ev.target.result), uploadBucket);
                        setShowUpload(false);
                      };
                      r.readAsText(f);
                    }} />
                </div>
              )}
            </div>
          )}

          {showCharts && (
            <div className="mc-flex-row" style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
              <div style={{ ...s.card, flex: 1, minWidth: 280 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={(() => { const map = {}; nonTransfer.filter(t => t.type === "expense").forEach(t => { const cat = t.category || "Other"; map[cat] = (map[cat] || 0) + toBase(t.amount, t.currency || "CAD", rates); }); return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8); })()}
                      dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={3} strokeWidth={0}>
                      {Array.from({ length: 8 }).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => fmtFull(v)} contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12 }} />
                    <Legend formatter={v => <span style={{ color: C.text, fontSize: 10 }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Monthly summary panel */}
        <div style={{ flex: 1.5, minWidth: 280 }}>
          <div style={{ ...s.card, position: "sticky", top: 80 }}>
            <h3 style={{ ...s.h3, fontSize: 14, marginBottom: 16, textAlign: "center" }}>{monthLabel(viewMonth)} Summary</h3>

            {/* Income — collapsible section */}
            <div style={{ marginBottom: 16 }}>
              <div onClick={() => setCollapsedSections(p => ({ ...p, income: !p.income }))}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 9, color: C.muted, transition: "transform 0.2s", transform: collapsedSections.income ? "rotate(-90deg)" : "rotate(0deg)", display: "inline-block" }}>▼</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.5 }}>Income</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.green, fontFamily: "monospace" }}>{mask(fmtFull(totalIncome), hide)}</span>
              </div>
              {!collapsedSections.income && (<>
                {viewBuckets.map(bucket => {
                  const groups = hierIncomeTotals[bucket] || {};
                  return Object.entries(groups).map(([groupName, group]) => {
                    const isOpen = !collapsedGroups[groupName];
                    const barMax = totalIncome || 1;
                    return (
                      <div key={`${bucket}-${groupName}`} style={{ marginBottom: 4 }}>
                        <div onClick={() => toggleGroup(groupName)}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", cursor: "pointer", borderBottom: `1px solid ${C.border}15` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 9, color: C.muted, transition: "transform 0.2s", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", display: "inline-block" }}>▼</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.green }}>{groupName}</span>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.green, fontFamily: "monospace" }}>{group.total > 0 ? mask(fmtFull(group.total), hide) : ""}</span>
                        </div>
                        {group.total > 0 && (
                          <div style={{ height: 4, borderRadius: 2, background: C.border, marginTop: 2, marginBottom: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 2, background: C.gold, width: `${Math.min(100, (group.total / barMax) * 100)}%` }} />
                          </div>
                        )}
                        {isOpen && Object.entries(group.subcategories).map(([cat, val]) => (
                          <div key={cat} style={{ padding: "3px 0 3px 20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span style={{ color: val > 0 ? C.green : C.muted }}>└─ {cat}</span>
                              <span style={{ color: val > 0 ? C.green : C.muted, fontFamily: "monospace" }}>{val > 0 ? mask(fmtFull(val), hide) : ""}</span>
                            </div>
                            {val > 0 && (
                              <div style={{ height: 3, borderRadius: 2, background: C.border, marginTop: 2, overflow: "hidden", marginLeft: 20 }}>
                                <div style={{ height: "100%", borderRadius: 2, background: C.gold, width: `${Math.min(100, (val / barMax) * 100)}%` }} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  });
                })}
              </>)}
            </div>

            {/* Expenses — collapsible section with budget + % */}
            <div style={{ marginBottom: 16 }}>
              <div onClick={() => setCollapsedSections(p => ({ ...p, expenses: !p.expenses }))}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: 8, borderTop: `1px dashed ${C.border}`, paddingTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 9, color: C.muted, transition: "transform 0.2s", transform: collapsedSections.expenses ? "rotate(-90deg)" : "rotate(0deg)", display: "inline-block" }}>▼</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.5 }}>Expenses</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.red, fontFamily: "monospace" }}>{mask(fmtFull(totalExpenses), hide)}</span>
              </div>
              {!collapsedSections.expenses && (<>
                {viewBuckets.map(bucket => {
                  const groups = hierTotals[bucket] || {};
                  return Object.entries(groups).map(([groupName, group]) => {
                    const isOpen = !collapsedGroups[groupName];
                    const expBarMax = totalExpenses || 1;
                    const groupBudget = budgetTargets[groupName]?.monthly;
                    const groupBarMax = groupBudget || expBarMax;
                    const groupPct = totalExpenses > 0 ? ((group.total / totalExpenses) * 100) : 0;
                    const groupBudgetRatio = groupBudget ? group.total / groupBudget : 0;
                    const groupBarColor = groupBudget ? (groupBudgetRatio >= 1 ? C.red : groupBudgetRatio >= 0.8 ? C.orange : C.green) : C.accent;
                    return (
                      <div key={`${bucket}-${groupName}`} style={{ marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${C.border}15` }}>
                          <div onClick={() => toggleGroup(groupName)} style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, cursor: "pointer" }}>
                            <span style={{ fontSize: 9, color: C.muted, transition: "transform 0.2s", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", display: "inline-block" }}>▼</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{groupName}</span>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "monospace", minWidth: 80, textAlign: "right" }}>{group.total > 0 ? mask(fmtFull(group.total), hide) : ""}</span>
                          <span style={{ fontSize: 10, color: C.muted, minWidth: 36, textAlign: "right" }}>{groupPct > 0 ? (groupPct < 1 ? "<1%" : Math.round(groupPct) + "%") : ""}</span>
                          {editingBudget === groupName ? (
                            <input autoFocus style={{ ...s.input, width: 70, fontSize: 10, marginLeft: 6 }} placeholder="$/mo" type="number"
                              onBlur={e => setBudget(groupName, e.target.value)} onKeyDown={e => { if (e.key === "Enter") setBudget(groupName, e.target.value); if (e.key === "Escape") setEditingBudget(null); }} />
                          ) : (
                            <span onClick={() => setEditingBudget(groupName)} style={{ fontSize: 10, color: groupBudget ? C.muted : C.accent2, cursor: "pointer", minWidth: 50, textAlign: "right", marginLeft: 6 }}>
                              {groupBudget ? mask(fmtFull(groupBudget), hide) : "Set"}
                            </span>
                          )}
                        </div>
                        {(group.total > 0 || groupBudget) && (
                          <div style={{ height: 4, borderRadius: 2, background: C.border, marginTop: 2, marginBottom: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 2, background: groupBarColor, width: `${Math.min(100, (group.total / groupBarMax) * 100)}%` }} />
                          </div>
                        )}
                        {isOpen && Object.entries(group.subcategories).map(([cat, val]) => {
                          const catBudget = budgetTargets[cat]?.monthly;
                          const catPct = totalExpenses > 0 ? ((val / totalExpenses) * 100) : 0;
                          const catBudgetRatio = catBudget ? val / catBudget : 0;
                          const catBarColor = catBudget ? (catBudgetRatio >= 1 ? C.red : catBudgetRatio >= 0.8 ? C.orange : C.green) : C.accent;
                          const catBarMax = catBudget || expBarMax;
                          return (
                            <div key={cat} style={{ padding: "3px 0 3px 20px" }}>
                              <div style={{ display: "flex", alignItems: "center", fontSize: 12 }}>
                                <span style={{ flex: 1, color: val > 0 ? C.muted : C.muted }}>└─ {cat}</span>
                                <span style={{ color: C.muted, fontFamily: "monospace", minWidth: 80, textAlign: "right" }}>{val > 0 ? mask(fmtFull(val), hide) : ""}</span>
                                <span style={{ fontSize: 10, color: C.muted, minWidth: 36, textAlign: "right" }}>{catPct > 0 ? (catPct < 1 ? "<1%" : Math.round(catPct) + "%") : ""}</span>
                                {editingBudget === cat ? (
                                  <input autoFocus style={{ ...s.input, width: 70, fontSize: 10, marginLeft: 6 }} placeholder="$/mo" type="number"
                                    onBlur={e => setBudget(cat, e.target.value)} onKeyDown={e => { if (e.key === "Enter") setBudget(cat, e.target.value); if (e.key === "Escape") setEditingBudget(null); }} />
                                ) : (
                                  <span onClick={() => setEditingBudget(cat)} style={{ fontSize: 10, color: catBudget ? C.muted : C.accent2, cursor: "pointer", minWidth: 50, textAlign: "right", marginLeft: 6 }}>
                                    {catBudget ? mask(fmtFull(catBudget), hide) : "Set"}
                                  </span>
                                )}
                              </div>
                              {(val > 0 || catBudget) && (
                                <div style={{ height: 3, borderRadius: 2, background: C.border, marginTop: 2, overflow: "hidden", marginLeft: 20 }}>
                                  <div style={{ height: "100%", borderRadius: 2, background: catBarColor, width: `${Math.min(100, (val / catBarMax) * 100)}%` }} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })}
                {uncategorizedTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: C.orange }}>
                    <span>Uncategorised</span>
                    <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{mask(fmtFull(uncategorizedTotal), hide)}</span>
                  </div>
                )}
              </>)}
            </div>

            {/* Transfers — muted */}
            {viewBuckets.some(b => Object.values(transferTotals[b] || {}).some(v => v > 0)) && (
              <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 10, marginTop: 10, opacity: 0.5 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Transfers</div>
                {viewBuckets.map(bucket =>
                  Object.entries(transferTotals[bucket] || {}).filter(([, v]) => v > 0).map(([cat, val]) => (
                    <div key={`${bucket}-${cat}`} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 12 }}>
                      <span style={{ color: C.muted }}>{cat}</span>
                      <span style={{ color: C.muted, fontFamily: "monospace" }}>{mask(fmtFull(val), hide)}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Net */}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
                <span style={{ color: C.text }}>Net</span>
                <span style={{ color: netFlow >= 0 ? C.green : C.red, fontFamily: "monospace" }}>{mask((netFlow >= 0 ? "+" : "") + fmtFull(netFlow), hide)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>}

      {/* ── Accounts panel ── */}
      {cfSubTab === "accounts" && (() => {
        const acctEntries = Object.entries(bankAccounts);
        const grouped = {};
        BUCKETS.forEach(b => { grouped[b] = acctEntries.filter(([, a]) => a.bucket === b); });
        const unassigned = acctEntries.filter(([, a]) => !a.bucket);
        return (
          <div>
            {/* Connect + Sync bar */}
            <div style={{ ...s.card, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
              <button style={{ ...s.btn, fontSize: 12 }} onClick={async () => {
                try {
                  const res = await fetch(`${PLAID_SERVER}/api/plaid/connections`);
                  const conns = await res.json();
                  for (const conn of conns) {
                    const ar = await fetch(`${PLAID_SERVER}/api/plaid/accounts/${conn.id}`);
                    const { accounts } = await ar.json();
                    const updated = { ...bankAccounts };
                    accounts.forEach(a => {
                      if (!updated[a.id]) updated[a.id] = { name: a.name, institution: conn.institution, type: a.type, subtype: a.subtype, currency: a.currency, mask: a.mask, bucket: null, enabled: true, lastBalance: a.balance, lastSynced: new Date().toISOString() };
                      else { updated[a.id].lastBalance = a.balance; updated[a.id].lastSynced = new Date().toISOString(); }
                    });
                    setData({ ...data, bankAccounts: updated });
                  }
                } catch (e) { console.error("Sync accounts failed:", e); }
              }}>Sync Accounts from Plaid</button>
              <button style={{ ...s.btn, fontSize: 12 }} onClick={async () => {
                try {
                  const res = await fetch(`${PLAID_SERVER}/api/plaid/connections`);
                  const conns = await res.json();
                  let total = 0;
                  for (const conn of conns) { total += await importPlaidTransactions(conn.id); }
                  alert(`Imported ${total} new transactions`);
                } catch (e) { console.error("Import failed:", e); }
              }}>Import All Transactions</button>
              <span style={{ fontSize: 11, color: C.muted }}>{acctEntries.length} accounts connected</span>
            </div>

            {/* Unassigned accounts */}
            {unassigned.length > 0 && (
              <div style={{ ...s.card, borderLeft: `3px solid ${C.orange}`, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, marginBottom: 10, textTransform: "uppercase" }}>Assign to Bucket</div>
                {unassigned.map(([id, acct]) => (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}15` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{acct.name} {acct.mask ? `*${acct.mask}` : ""}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{acct.institution} · {acct.type}/{acct.subtype} · {acct.currency}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "monospace" }}>{acct.lastBalance != null ? fmtFull(acct.lastBalance) : "—"}</div>
                    <select style={{ ...s.select, fontSize: 12, width: 130 }} value="" onChange={e => {
                      const updated = { ...bankAccounts, [id]: { ...acct, bucket: e.target.value } };
                      setData({ ...data, bankAccounts: updated });
                    }}>
                      <option value="">Select bucket…</option>
                      {BUCKETS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {/* Accounts grouped by bucket */}
            {BUCKETS.map(b => {
              const items = grouped[b];
              if (!items || items.length === 0) return null;
              return (
                <div key={b} style={{ ...s.card, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: BUCKET_COLORS[b], textTransform: "uppercase", marginBottom: 10 }}>{b}</div>
                  {items.map(([id, acct]) => (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}10` }}>
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: acct.enabled ? C.green : C.muted }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{acct.name} {acct.mask ? `*${acct.mask}` : ""}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{acct.institution} · {acct.type}/{acct.subtype} · Last sync: {acct.lastSynced ? new Date(acct.lastSynced).toLocaleDateString() : "never"}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "monospace" }}>{acct.lastBalance != null ? fmtFull(acct.lastBalance) : "—"}</div>
                      <button style={{ ...s.btnSm, fontSize: 11 }} onClick={() => { setFilterAccountId(id); setCfSubTab("transactions"); }}>View Txns</button>
                      <select style={{ ...s.select, fontSize: 11, width: 100 }} value={acct.bucket || ""} onChange={e => {
                        const updated = { ...bankAccounts, [id]: { ...acct, bucket: e.target.value || null } };
                        setData({ ...data, bankAccounts: updated });
                      }}>
                        <option value="">Unassign</option>
                        {BUCKETS.map(bk => <option key={bk} value={bk}>{bk}</option>)}
                      </select>
                      <button style={{ ...s.btnSm, fontSize: 11, color: acct.enabled ? C.green : C.muted }} onClick={() => {
                        const updated = { ...bankAccounts, [id]: { ...acct, enabled: !acct.enabled } };
                        setData({ ...data, bankAccounts: updated });
                      }}>{acct.enabled ? "Enabled" : "Disabled"}</button>
                    </div>
                  ))}
                </div>
              );
            })}

            {acctEntries.length === 0 && (
              <div style={{ ...s.card, textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 14, color: C.muted, marginBottom: 8 }}>No accounts connected yet.</div>
                <div style={{ fontSize: 12, color: C.muted }}>Connect your bank via Plaid in Settings, then sync accounts here.</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Rules manager ── */}
      {cfSubTab === "rules" && (() => {
        const rulesArray = Object.entries(catRules).map(([pattern, bm]) => ({ pattern, ...bm }));
        const q = rulesSearch.toLowerCase();
        const filteredRules = q ? rulesArray.filter(r => r.pattern.includes(q) || BUCKETS.some(b => (r[b] || "").toLowerCase().includes(q))) : rulesArray;
        const RULES_PER_PAGE = 50;
        const totalPages = Math.ceil(filteredRules.length / RULES_PER_PAGE);
        const pagedRules = filteredRules.slice(rulesPage * RULES_PER_PAGE, (rulesPage + 1) * RULES_PER_PAGE);

        return (
          <div>
            {/* Stats + search */}
            <div style={{ ...s.card, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{rulesArray.length} rules</span>
              <input style={{ ...s.input, flex: 1, minWidth: 200, fontSize: 12 }} placeholder="Search rules by pattern or category..."
                value={rulesSearch} onChange={e => { setRulesSearch(e.target.value); setRulesPage(0); }} />
              <label style={{ ...s.btnSm, fontSize: 11, cursor: "pointer" }}>
                Import CSV
                <input type="file" accept=".csv" style={{ display: "none" }} onChange={e => {
                  const f = e.target.files[0]; if (!f) return;
                  const r = new FileReader();
                  r.onload = (ev) => { importRulesCSV(ev.target.result); };
                  r.readAsText(f);
                }} />
              </label>
              <button style={{ ...s.btnSm, fontSize: 11 }} onClick={() => {
                const csv = "pattern," + BUCKETS.join(",") + "\n" + rulesArray.map(r => [r.pattern, ...BUCKETS.map(b => r[b] || "")].join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = "moneyclaw-rules.csv"; a.click();
              }}>Export CSV</button>
            </div>

            {/* Add rule form */}
            <div style={{ ...s.card, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 8 }}>Add Rule</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input style={{ ...s.input, flex: 2, minWidth: 150, fontSize: 12 }} placeholder="Pattern (e.g. netflix)"
                  value={newRule.pattern} onChange={e => setNewRule({ ...newRule, pattern: e.target.value })} />
                {BUCKETS.map(b => (
                  <select key={b} style={{ ...s.select, fontSize: 11, width: 130 }} value={newRule[b] || ""}
                    onChange={e => setNewRule({ ...newRule, [b]: e.target.value })}>
                    <option value="">{b}: —</option>
                    {[...(DEFAULT_TAX_CATS[b] || []), ...(INCOME_CATS[b] || []), ...(TRANSFER_CATS[b] || [])].filter((v, i, a) => a.indexOf(v) === i).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ))}
                <button style={{ ...s.btn, fontSize: 12 }} onClick={() => {
                  const cats = {};
                  BUCKETS.forEach(b => { if (newRule[b]) cats[b] = newRule[b]; });
                  if (newRule.pattern && Object.keys(cats).length > 0) {
                    addCatRule(newRule.pattern, cats);
                    setNewRule({ pattern: "", Opco: "", Holdco: "", Jon: "", Jacqueline: "" });
                  }
                }}>Add</button>
              </div>
            </div>

            {/* Rules table */}
            <div style={s.card}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, textAlign: "left", fontSize: 11 }}>Pattern</th>
                    {BUCKETS.map(b => <th key={b} style={{ ...s.th, fontSize: 11, color: BUCKET_COLORS[b] }}>{b}</th>)}
                    <th style={{ ...s.th, fontSize: 11, width: 70 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRules.map(r => {
                    const isEditing = editingRule === r.pattern;
                    return (
                      <tr key={r.pattern} style={{ borderBottom: `1px solid ${C.border}10` }}>
                        <td style={{ ...s.td, fontSize: 12, fontFamily: "monospace" }}>
                          {isEditing ? <input style={{ ...s.input, fontSize: 12, width: "100%" }} defaultValue={r.pattern} id={`edit-pattern-${r.pattern}`} /> : r.pattern}
                        </td>
                        {BUCKETS.map(b => (
                          <td key={b} style={{ ...s.td, fontSize: 11 }}>
                            {isEditing ? (
                              <select style={{ ...s.select, fontSize: 10, width: "100%" }} defaultValue={r[b] || ""} id={`edit-${b}-${r.pattern}`}>
                                <option value="">—</option>
                                {[...(DEFAULT_TAX_CATS[b] || []), ...(INCOME_CATS[b] || []), ...(TRANSFER_CATS[b] || [])].filter((v, i, a) => a.indexOf(v) === i).map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            ) : <span style={{ color: r[b] ? C.text : C.muted }}>{r[b] || "—"}</span>}
                          </td>
                        ))}
                        <td style={{ ...s.td, whiteSpace: "nowrap" }}>
                          {isEditing ? (<>
                            <button style={{ ...s.btnSm, fontSize: 10, marginRight: 4 }} onClick={() => {
                              const np = document.getElementById(`edit-pattern-${r.pattern}`)?.value || r.pattern;
                              const cats = {};
                              BUCKETS.forEach(b => { const v = document.getElementById(`edit-${b}-${r.pattern}`)?.value; if (v) cats[b] = v; });
                              updateCatRule(r.pattern, np, cats);
                              setEditingRule(null);
                            }}>Save</button>
                            <button style={{ ...s.btnSm, fontSize: 10 }} onClick={() => setEditingRule(null)}>Cancel</button>
                          </>) : (<>
                            <button style={{ ...s.btnSm, fontSize: 10, marginRight: 4 }} onClick={() => setEditingRule(r.pattern)}>Edit</button>
                            <button style={{ ...s.btnSm, fontSize: 10, color: C.red }} onClick={() => deleteCatRule(r.pattern)}>Del</button>
                          </>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                  <button style={{ ...s.btnSm, fontSize: 11 }} disabled={rulesPage === 0} onClick={() => setRulesPage(p => p - 1)}>← Prev</button>
                  <span style={{ fontSize: 12, color: C.muted, lineHeight: "28px" }}>Page {rulesPage + 1} of {totalPages}</span>
                  <button style={{ ...s.btnSm, fontSize: 11 }} disabled={rulesPage >= totalPages - 1} onClick={() => setRulesPage(p => p + 1)}>Next →</button>
                </div>
              )}
              {filteredRules.length === 0 && (
                <div style={{ textAlign: "center", padding: 20, color: C.muted, fontSize: 13 }}>
                  {rulesSearch ? "No rules match your search." : "No categorization rules yet. Add one above or import from CSV."}
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
        <div style={{ padding: 12, background: C.orange + "15", border: `1px solid ${C.orange}33`, borderRadius: 5, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: C.orange, fontWeight: 600, marginBottom: 4 }}>Plaid server not running</div>
          <div style={{ fontSize: 13, color: C.muted }}>
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
            <div style={{ marginTop: 12, padding: 12, background: C.card2, borderRadius: 5 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>Last Sync Results</div>
              {syncResults.map(r => (
                <div key={r.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: r.error ? C.red : C.green }}>{r.institution} {r.error ? `— Error: ${r.error}` : `— ${r.accounts.length} accounts, ${r.holdings.length} holdings`}</div>
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
            <div style={{ marginTop: 8, fontSize: 13, color: C.red }}>{error}</div>
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
        <div style={{ marginTop: 16, padding: 12, background: `${C.green}11`, borderRadius: 5, border: `1px solid ${C.green}33` }}>
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
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Numbers will be hidden after this many minutes of inactivity.</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="number" min={0.5} max={60} step={0.5} style={{ ...s.input, width: 80 }}
            value={settings.autoHideMinutes} onChange={e => setSettings({ ...settings, autoHideMinutes: Math.max(0.5, parseFloat(e.target.value) || 1) })} />
          <span style={{ fontSize: 13, color: C.muted }}>minutes</span>
        </div>
      </div>

      {tabPasswords && (
        <div style={s.card}>
          <h3 style={s.h3}>Tab Passwords</h3>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Set or remove passwords for protected tabs.</div>
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

  // All portfolio holdings auto-appear in "My Holdings"
  const heldSymbols = useMemo(() => Object.keys(holdingsMap), [holdingsMap]);

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
          return <span key={sig} style={{ background: color + "18", color, padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600, whiteSpace: "nowrap" }}>{short}</span>;
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
                      <span style={{ color: val && q.price > val ? C.green : C.red }}>
                        {val ? "$" + val.toFixed(2) : "—"}
                      </span>
                    </React.Fragment>
                  ))}
                  <span style={{ color: C.muted }}>Weekly RSI</span>
                  <span style={{ color: tech.rsi14 < 30 ? C.green : tech.rsi14 > 70 ? C.red : C.text, fontWeight: 600 }}>{tech.rsi14 || "—"}</span>
                </div>
              ) : <span style={{ fontSize: 13, color: C.muted }}>Loading...</span>}
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
                <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Buy Target</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ fontSize: 13, color: C.muted }}>Amount $</label>
                  <input type="number" step="100" value={(buyTargets[symbol]?.buyAmount) || ""} placeholder="e.g. 5000"
                    onChange={e => setBuyTarget(symbol, "buyAmount", parseFloat(e.target.value) || null)}
                    style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, width: 90, padding: "3px 6px", fontSize: 13, outline: "none" }} />
                  <label style={{ fontSize: 13, color: C.muted }}>Trigger %</label>
                  <input type="number" step="1" min="1" max="50" value={(buyTargets[symbol]?.triggerPct) || ""} placeholder="5"
                    onChange={e => setBuyTarget(symbol, "triggerPct", parseFloat(e.target.value) || null)}
                    style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, width: 60, padding: "3px 6px", fontSize: 13, outline: "none" }} />
                  {buyTargets[symbol]?.buyAmount && q.price ? (
                    <span style={{ fontSize: 13, color: C.green }}>= {Math.floor(buyTargets[symbol].buyAmount / q.price)} shares</span>
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
      <CollapsibleStats label="Summary" C={C}>
        <div className="mc-stat-row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <StatCard label="Holdings" value={heldSymbols.length} sub="from portfolio" C={C} />
          <StatCard label="Watching" value={watchOnly.length} sub="no position" C={C} />
          <StatCard label="Buy Signals" value={buySignals} sub="oversold or below 200 EMA" color={buySignals > 0 ? C.green : C.muted} C={C} />
          <StatCard label="RSI Oversold" value={oversold} sub="weekly RSI < 30" color={oversold > 0 ? C.orange : C.muted} C={C} />
        </div>
      </CollapsibleStats>

      {/* ═══ ACTION FEED ═══ */}
      {actionFeed.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ ...s.h3, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
            onClick={() => setCollapsed(prev => ({ ...prev, opportunities: !prev.opportunities }))}>
            <span style={{ fontSize: 13, transition: "transform 0.2s", transform: collapsed.opportunities ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
            <Icon name="lightbulb" size={14} color={C.accent} /> Opportunities
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{actionFeed.length} actions</span>
          </h3>
          {!collapsed.opportunities && <div style={{ ...s.card, padding: "10px 14px" }}>
            {actionFeed.map((a, i) => {
              const pctTag = a.signalTags.find(t => t.startsWith("-"));
              const otherTags = a.signalTags.filter(t => !t.startsWith("-"));
              const pctVal = pctTag ? parseFloat(pctTag) : 0;
              const pctClr = pctColor(a.sym, Math.abs(pctVal));
              return (
                <div key={a.sym + a.type} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: i < actionFeed.length - 1 ? `1px solid ${C.border}15` : "none", fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: C.accent, minWidth: 50 }}>{displaySym(a.sym)}</span>
                  {pctTag && <span style={{ color: pctClr, fontWeight: 600, fontSize: 11, minWidth: 45 }}>{pctTag}</span>}
                  {otherTags.map(tag => (
                    <span key={tag} style={{ background: C.card2, color: C.muted, padding: "0 5px", borderRadius: 5, fontSize: 9, fontWeight: 600, whiteSpace: "nowrap" }}>{tag}</span>
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
        const typeIconNames = { ETF: "trendingUp", Stock: "building", "Precious Metal": "medal" };
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
              <span style={{ fontSize: 13, transition: "transform 0.2s", transform: collapsed[type] ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
              <Icon name={typeIconNames[type] || "briefcase"} size={14} color={C.accent} /> {type}s
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
                            <div style={{ fontSize: 9, color: C.muted }}>{DISPLAY_SUBS[sym] || h.name}</div>
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontWeight: 600, color: pctColor(sym, q.pctDown) }}>
                            {q.pctDown != null ? "-" + q.pctDown.toFixed(2) + "%" : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontWeight: 600, color: C.green }}>
                            {q.pctUp != null ? q.pctUp.toFixed(2) + "%" : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right" }}>
                            {q.price ? "$" + q.price.toFixed(2) : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right", color: C.muted }}>
                            {q.ath ? "$" + q.ath.toFixed(2) : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontWeight: 600, color: (q.changePct || 0) >= 0 ? C.green : C.red }}>
                            {q.changePct != null ? (q.changePct >= 0 ? "+" : "") + q.changePct.toFixed(2) + "%" : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right", color: C.muted }}>
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
        { key: "crypto", iconName: "bitcoin", label: "Crypto", items: cryptoTickers },
        { key: "metals", iconName: "medal", label: "Metals", items: metalTickers },
        { key: "watching", iconName: "telescope", label: "Watching", items: watchOnly },
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
              <span style={{ fontSize: 13, transition: "transform 0.2s", transform: collapsed[sec.key] ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
              {sec.iconName ? <Icon name={sec.iconName} size={14} color={C.accent} /> : <span style={{ fontSize: 13 }}>{sec.icon}</span>} {sec.label}
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
                            <div style={{ fontSize: 9, color: C.muted }}>{DISPLAY_SUBS[t.symbol] || q.shortName || ""}</div>
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontWeight: 600, color: pctColor(t.symbol, q.pctDown) }}>
                            {q.pctDown != null ? "-" + q.pctDown.toFixed(2) + "%" : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right", fontWeight: 600, color: C.green }}>
                            {q.pctUp != null ? q.pctUp.toFixed(2) + "%" : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right" }}>
                            {q.price ? "$" + q.price.toFixed(2) : "—"}
                          </td>
                          <td style={{ ...s.td, textAlign: "right", color: C.muted }}>
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
          <div style={{ marginBottom: 12 }}><Icon name="telescope" size={40} color={C.muted} /></div>
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
function FinanceChatTab({ nwData, portData, cfData, settings, rates, theme, rules, setRules, todos, setTodos }) {
  const C = themes[theme]; const s = S(theme);
  const [input, setInput] = useState("");
  const [showRules, setShowRules] = useState(false);
  const [newRule, setNewRule] = useState("");
  const chatEndRef = useRef(null);
  const [marketQuotes, setMarketQuotes] = useState({});

  /* ── Fetch live quotes for portfolio tickers + key ETFs ── */
  useEffect(() => {
    const tickers = new Set(["^VIX", "QQQ", "VOO", "DIA", "SPY"]);
    (portData?.holdings || []).forEach(h => { if (h.ticker && h.ticker !== "CASH") tickers.add(h.ticker); });
    fetch(`${PLAID_SERVER}/api/market/quote?symbols=${[...tickers].join(",")}`).then(r => r.json()).then(d => {
      const m = {};
      (d.quotes || []).forEach(q => { m[q.symbol] = q; });
      setMarketQuotes(m);
    }).catch(() => {});
  }, [portData]);

  /* ── Build smart greeting ── */
  const buildGreeting = () => "Hey! I'm your MoneyClaw coach. What do you need help with?";

  const [messages, setMessages] = useState([]);
  useEffect(() => {
    if (Object.keys(marketQuotes).length > 0 && messages.length === 0) {
      setMessages([{ id: uid(), role: "ai", text: buildGreeting() }]);
    }
  }, [marketQuotes]);
  // Fallback greeting if quotes don't load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (messages.length === 0) setMessages([{ id: uid(), role: "ai", text: buildGreeting() }]);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => { if (messages.length > 1) chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const pending = (todos || []).filter(t => !t.done);
  const todoTopics = pending.map(t => ({ label: t.text, prompt: `I have a task: "${t.text}". Help me think through this and take action.`, isTodo: true }));
  const TOPICS = [
    ...todoTopics,
    { label: "How to DCA properly", prompt: "How should I DCA into the market? Give me a practical strategy for dollar cost averaging." },
    { label: "Too much cash", prompt: "I'm holding too much cash and I know I need to get it into the market. Help me make a plan to deploy it gradually." },
    { label: "Handling fear", prompt: "The market is scary right now. How do I handle the fear of investing during a downturn? Coach me through the psychology." },
    { label: "When to buy dips", prompt: "How do I know when a dip is worth buying? What signals should I look for before adding to positions?" },
    { label: "Rebalancing", prompt: "When and how should I rebalance my portfolio? Give me rules to follow." },
    { label: "Building rules", prompt: "Help me create a set of personal investing rules I can stick to. Ask me questions to understand my situation." },
    { label: "Death cross — what now?", prompt: "A lot of my holdings have death crosses. Should I be worried? What should I do?" },
    { label: "Market crash playbook", prompt: "If the market crashes 30-40%, what's my playbook? Help me prepare mentally and financially." },
  ];

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
    if (q.includes("net worth") || q.includes("my worth") || (q.includes("total") && q.includes("asset")) || q.includes("how much am i worth")) {
      const chg = ctx.nwChange;
      return `Your adjusted net worth range is **${fmtFull(ctx.nw.afterTax)} – ${fmtFull(ctx.nw.afterTaxHigh)} CAD**.\n\n**Low (Conservative):** ${settings.taxRateIneligible}% tax\n**High (Optimistic):** ${settings.highTaxRate || 20}% tax\n\nBreakdown:\n• Corporate (Opco + Holdco): ${fmtFull(ctx.nw.corp)}\n• Deductions: -${fmtFull(ctx.nw.deductions)}\n• Corp after deductions: ${fmtFull(ctx.nw.corpAfterDed)}\n• Tax haircut: -${fmtFull(ctx.nw.taxHit)} (low) / -${fmtFull(ctx.nw.taxHitHigh)} (high)\n• Personal: ${fmtFull(ctx.nw.personal)}\n\nGross: ${fmtFull(ctx.nw.total)}\n\n${ctx.prevNw.afterTax > 0 ? `That's ${chg >= 0 ? "up" : "down"} ${fmtFull(Math.abs(chg))} from last month (${chg >= 0 ? "+" : ""}${(chg / Math.abs(ctx.prevNw.afterTax) * 100).toFixed(1)}%).` : ""}`;
    }

    /* Portfolio allocation / risk */
    if (q.includes("my allocation") || q.includes("my risk") || q.includes("am i diversif") || q.includes("my portfolio") || q.includes("show portfolio") || q.includes("portfolio breakdown")) {
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
    if (q.includes("rebalanc") || q.includes("my targets") || q.includes("what should i buy") || q.includes("what should i sell") || q.includes("what to buy") || q.includes("what to sell")) {
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
        const status = b.over ? "**OVER**" : Number(pct) > 80 ? "Close" : "OK";
        return `• ${b.bucket} / ${b.category}: ${fmtFull(b.spent)} of ${fmtFull(b.monthlyLimit)} (${pct}%) ${status}`;
      }).join("\n");
      if (over.length) resp += `\n\n**Heads up:** You're over budget on ${over.length} categor${over.length > 1 ? "ies" : "y"}. Keep an eye on: ${over.map(o => o.category).join(", ")}.`;
      return resp;
    }

    /* Spending */
    if (q.includes("my spending") || q.includes("my expenses") || q.includes("where am i spending") || q.includes("show expenses") || q.includes("top spending")) {
      if (ctx.topSpending.length === 0) return "No expenses recorded for this month yet.";
      return `**Top Spending This Month (${monthLabel(ctx.currentMonth)}):**\n\n${ctx.topSpending.map(([cat, val]) => `• ${cat}: ${fmtFull(val)}`).join("\n")}\n\nTotal expenses: ${fmtFull(ctx.monthExpenses)}\nTotal income: ${fmtFull(ctx.monthIncome)}\nNet cash flow: ${ctx.monthIncome - ctx.monthExpenses >= 0 ? "+" : ""}${fmtFull(ctx.monthIncome - ctx.monthExpenses)}`;
    }

    /* Income */
    if (q.includes("my income") || q.includes("my cash flow") || q.includes("how much did i earn") || q.includes("show income") || q.includes("revenue this month")) {
      return `**Cash Flow for ${monthLabel(ctx.currentMonth)}:**\n\nIncome: ${fmtFull(ctx.monthIncome)}\nExpenses: ${fmtFull(ctx.monthExpenses)}\nNet: ${ctx.monthIncome - ctx.monthExpenses >= 0 ? "+" : ""}${fmtFull(ctx.monthIncome - ctx.monthExpenses)}\n\n${ctx.monthIncome > ctx.monthExpenses ? "You're cash-flow positive this month." : "Expenses are exceeding income this month — worth reviewing the expense breakdown."}`;
    }

    /* Tax */
    if (q.includes("my tax") || q.includes("tax reserve") || q.includes("how much tax") || q.includes("what do i owe") || q.includes("set aside for tax")) {
      return `**Tax Reserve Summary:**\n\nCorporate assets: ${fmtFull(ctx.nw.corp)}\nDeductions removed first: -${fmtFull(ctx.nw.deductions)}\nCorp after deductions: ${fmtFull(ctx.nw.corpAfterDed)}\n\n**Low (${settings.taxRateIneligible}% tax):** haircut -${fmtFull(ctx.nw.taxHit)} → NW ${fmtFull(ctx.nw.afterTax)}\n**High (${settings.highTaxRate || 20}% tax):** haircut -${fmtFull(ctx.nw.taxHitHigh)} → NW ${fmtFull(ctx.nw.afterTaxHigh)}\n\nDeductions come off corp first, then the tax haircut applies to what's left.`;
    }

    /* Holdings detail — only on explicit requests */
    if (q.includes("my holdings") || q.includes("my positions") || q.includes("show holdings") || q.includes("list holdings") || q.includes("all holdings") || q.includes("show my portfolio") || q.includes("what do i hold") || q.includes("what do i own")) {
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
        return `• ${g.name}: ${fmtFull(ctx.nw.afterTax)} – ${fmtFull(ctx.nw.afterTaxHigh)} / ${fmtFull(g.target)} (${pctDoneLow.toFixed(1)}% – ${pctDoneHigh.toFixed(1)}%)\n  ${pctDoneHigh >= 100 ? "**Goal reached** (high estimate)!" : `${fmtFull(g.target - ctx.nw.afterTaxHigh)} – ${fmtFull(g.target - ctx.nw.afterTax)} to go`}`;
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
      else if (Number(savingsRate) > 0) advice += "**Warning:** Your savings rate is low. Here are areas to look at:\n\n";
      else advice += "**Warning:** You're spending more than you earn this month. Here's where to cut:\n\n";

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
      else if (ratio < 1) assessment += "**Very tight.** You're barely positive. Any unexpected expense could push you negative. Consider reducing discretionary spending.";
      else assessment += "**Negative cash flow.** Expenses exceed income. This is unsustainable — review the expense breakdown urgently.";

      assessment += `\n\nAnnualized income (projected): ${fmtFull(inc * 12)}\nAnnualized expenses (projected): ${fmtFull(exp * 12)}\nProjected annual surplus: ${fmtFull((inc - exp) * 12)}`;

      return assessment;
    }

    /* ── COACHING TOPICS ── */

    /* DCA */
    if (q.includes("dca") || q.includes("dollar cost") || q.includes("averaging")) {
      return `**Dollar Cost Averaging — Your Playbook:**\n\n**The Rule:** Invest a fixed amount on a fixed schedule, regardless of price. Remove emotion from the equation.\n\n**Practical Strategy:**\n1. **Pick your amount** — what can you invest weekly or biweekly without affecting your lifestyle?\n2. **Pick your day** — set a recurring calendar reminder (e.g. every Monday)\n3. **Pick your targets** — split across your core ETFs (e.g. 40% VOO, 30% QQQ, 20% DIA, 10% opportunistic)\n4. **Don't check prices before buying** — the whole point is to buy regardless\n5. **Increase during fear** — if VIX > 25, add 25-50% extra to your normal DCA\n\n**Why it works:** You buy more shares when prices are low, fewer when high. Over time this beats trying to time the market 90% of the time.\n\n**The hard part:** Sticking to it when everything is red. That's where the discipline rules come in.\n\nWant me to help you set up a specific DCA schedule based on your holdings?`;
    }

    /* Too much cash */
    if (q.includes("too much cash") || q.includes("holding cash") || q.includes("deploy") || q.includes("get it into the market") || q.includes("sitting in cash")) {
      const cashAdvice = `**Getting Cash Into the Market:**\n\n**The Problem:** Cash feels safe but inflation eats it. Every day cash sits idle, you're losing purchasing power.\n\n**The Plan — 3-6 Month Deployment:**\n1. **Keep 6 months of expenses as emergency fund** — this stays in cash, always\n2. **Split the rest into 6-12 equal tranches**\n3. **Deploy one tranche every 2 weeks** into your core positions\n4. **Accelerate when VIX > 25** — deploy 2 tranches instead of 1\n5. **Pause (don't sell) when VIX > 40** — let the dust settle for a week, then resume\n\n**The Psychology:**\n• You WILL feel scared deploying into a red market. That's normal.\n• Remind yourself: you're buying quality assets at a discount\n• The money you don't invest is guaranteed to lose value to inflation\n• You don't need to be right about timing — you need to be consistent\n\n**Your Rules:**\n• "I will not let more than $X sit in cash beyond my emergency fund"\n• "I will deploy cash on schedule, not based on how I feel"\n• "Red days are buying days, not hiding days"\n\nWant to add any of these to your rules?`;
      return cashAdvice;
    }

    /* Fear / psychology */
    if (q.includes("fear") || q.includes("scar") || q.includes("panic") || q.includes("psych") || q.includes("emotion") || q.includes("anxious") || q.includes("worried") || q.includes("nervous")) {
      return `**Handling Fear — Your Coach Talking:**\n\n**First: Fear is normal.** Every successful investor has felt exactly what you're feeling. Warren Buffett's famous line exists because fear is universal: "Be greedy when others are fearful."\n\n**Reframe the fear:**\n• You're not "losing money" — you own the same number of shares. The price tag changed.\n• A stock dropping 30% after you buy is not a loss. It's only a loss if you sell.\n• The S&P 500 has recovered from EVERY crash in history. Every. Single. One.\n\n**Practical techniques:**\n1. **Zoom out** — look at the 5-year or 10-year chart, not today's candle\n2. **Size your bets** — if a position dropping 50% would ruin your sleep, it's too big\n3. **Have a plan before the drop** — decide NOW what you'll do at -10%, -20%, -30%\n4. **Use the VIX** — high VIX = high fear = historically great entry points\n5. **Journal your emotions** — write down how you feel today. Read it in 6 months.\n\n**Your Fear Rules:**\n• "I do not sell during a panic. I either hold or buy more."\n• "If I feel terrified, that's my signal to check my DCA schedule, not to sell."\n• "I will not look at my portfolio more than once a day during drawdowns."\n• "I will trust my process, not my emotions."\n\n**Remember:** The market rewards patience and punishes panic. Your future self will thank you for staying disciplined today.\n\nWant to add any of these rules to your personal rulebook?`;
    }

    /* Death cross */
    if (q.includes("death cross") || q.includes("bearish") || q.includes("50 ema") || q.includes("200 ema")) {
      return `**Death Cross — What It Means & What To Do:**\n\n**What it is:** The 50-day EMA crosses below the 200-day EMA. It signals that short-term momentum is weaker than the long-term trend.\n\n**What it does NOT mean:**\n• It does NOT mean "sell everything now"\n• It does NOT mean the stock is going to zero\n• It's a **lagging** indicator — by the time you see it, the move already happened\n\n**Historically:**\n• About 30% of death crosses lead to further significant declines\n• About 70% are false alarms or followed by quick recoveries\n• The S&P 500 has had dozens of death crosses and always recovered\n\n**Your Playbook:**\n1. **Don't sell into a death cross** — you'd be selling after the drop, which is the worst time\n2. **Don't add aggressively** — wait for signs of stabilization (price reclaiming 50 EMA)\n3. **Use it as a watchlist trigger** — put the stock on close watch, set alerts\n4. **If you have cash to deploy** — start small positions, scale in over weeks\n5. **Check the fundamentals** — is the business still solid? Then the death cross is just noise\n\n**The bottom line:** Death crosses are scary-sounding but they're just one signal. Focus on the business, not the chart pattern.`;
    }

    /* When to buy dips */
    if (q.includes("dip") || q.includes("when to buy") || q.includes("signal") || q.includes("entry point")) {
      return `**When To Buy Dips — A Framework:**\n\n**Not every dip is a buying opportunity.** Here's how to tell the difference:\n\n**BUY the dip when:**\n• The business fundamentals haven't changed (earnings still growing)\n• It's a broad market selloff, not company-specific bad news\n• RSI is below 30 (oversold)\n• VIX is spiking above 25-30 (everyone else is panicking)\n• You'd be happy to hold this for 5+ years at this price\n• You're following your DCA schedule anyway\n\n**DON'T buy the dip when:**\n• There's actual fundamental deterioration (earnings miss, guidance cut)\n• You're already overexposed to this position\n• You'd need to use emergency fund money\n• You're buying to "make back" losses (revenge trading)\n• The stock is down because of fraud/scandal\n\n**The 10-20-30 Rule:**\n• Down 10% from ATH → start small position or add 25% of planned amount\n• Down 20% from ATH → add another 25-50%\n• Down 30% from ATH → this is historically where fortunes are made. Deploy more aggressively.\n\n**Key:** Pre-decide your levels. Write them down. Execute without emotion.`;
    }

    /* Crash playbook */
    if (q.includes("crash") || q.includes("recession") || q.includes("30%") || q.includes("40%") || q.includes("playbook") || q.includes("prepare")) {
      return `**Market Crash Playbook:**\n\n**Before the crash (NOW):**\n1. Know your emergency fund is solid (6 months expenses in cash)\n2. Have a written plan for -20%, -30%, -40% scenarios\n3. Know which assets you want to buy more of at a discount\n4. Reduce or eliminate margin/leverage\n5. Accept that paper losses are temporary\n\n**During the crash (-20% to -40%):**\n1. **DO NOT SELL.** This is the #1 rule. Selling during a crash locks in losses.\n2. **Continue your DCA** — increase it if you can\n3. **Buy quality** — index ETFs, blue chips with strong balance sheets\n4. **Turn off the news** — financial media profits from fear. Limit exposure.\n5. **Talk to your MoneyClaw coach (me!)** instead of doom-scrolling\n\n**The math that matters:**\n• If you invest at -30% and it recovers, you make 43% on that money\n• If you invest at -40% and it recovers, you make 67% on that money\n• If you panic-sell at -30% and buy back at recovery, you lost 30%\n\n**After the crash:**\n• Don't sell your discounted positions as soon as they're green\n• Review what you did right and wrong — update your rules\n• Increase your DCA back to normal levels\n\n**The truth:** Crashes are where long-term wealth is built. The discomfort you feel is the price of admission.`;
    }

    /* Building rules */
    if (q.includes("rule") || q.includes("discipline") || q.includes("system")) {
      const currentRules = rules.length > 0
        ? `\n\n**Your Current Rules:**\n${rules.map((r, i) => `${i + 1}. ${r.text}`).join("\n")}\n\nWant to add, edit, or remove any?`
        : "\n\nYou don't have any rules saved yet. Let's build some together.";
      return `**Building Your Personal Investing Rules:**\n\nThe best investors have a written system. Here are categories to think about:\n\n**Entry Rules:**\n• When do I buy? (e.g. "I buy on my DCA day regardless of price")\n• How much do I add? (e.g. "No more than 10% of portfolio in one position")\n\n**Exit Rules:**\n• When do I sell? (e.g. "Only when fundamentals change, never on fear")\n• What's my stop loss? (e.g. "No stop losses on index ETFs")\n\n**Fear Rules:**\n• What do I do when scared? (e.g. "I re-read my rules, not the news")\n• What's my panic protocol? (e.g. "Close the app for 24 hours")\n\n**Position Sizing:**\n• Max position size? (e.g. "No single stock > 15% of portfolio")\n• How do I scale in? (e.g. "25% at -10%, 25% at -20%, 50% at -30%")${currentRules}\n\nTell me about your investing style and I'll help you draft rules.`;
    }

    /* ── Ticker-aware responses ── */
    // Only match known tickers from portfolio/watchlist — NOT random uppercase English words
    const knownTickers = Object.keys(marketQuotes).filter(t => t !== "^VIX");
    const upperQ = question.toUpperCase();
    const mentionedTickers = knownTickers.filter(sym => {
      const re = new RegExp(`\\b${sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
      return re.test(question);
    });
    if (mentionedTickers.length > 0) {
      const parts = [];
      mentionedTickers.forEach(sym => {
        const mq = marketQuotes[sym];
        const h = ctx.enrichedHoldings.find(h2 => h2.ticker === sym);
        if (!mq) return;
        const name = mq.shortName || sym;
        parts.push(`**${name} (${sym})** — $${mq.price.toFixed(2)}`);
        if (mq.pctDown >= 5) {
          parts.push(`Down **${mq.pctDown.toFixed(1)}%** from its all-time high of $${mq.ath.toFixed(2)}.`);
          parts.push(`This is a solid discount. If you believe in ${sym} long term, today is a good day to add.`);
        } else if (mq.pctDown >= 2) {
          parts.push(`Down ${mq.pctDown.toFixed(1)}% from ATH — a small dip. Not screaming buy, but not a bad entry.`);
        } else {
          parts.push(`Near all-time highs (${mq.pctDown.toFixed(1)}% off). Not on sale — maybe wait for a dip or DCA on schedule.`);
        }
        if (mq.changePct != null) {
          const todayDir = mq.changePct >= 0 ? "up" : "down";
          parts.push(`Today: ${todayDir} ${Math.abs(mq.changePct).toFixed(2)}%.`);
          if (mq.changePct <= -1.5) parts.push(`**Red day = buying opportunity.** If you've been wanting to add ${sym}, this dip makes it cheaper.`);
        }
        if (h) {
          const gainPct = h.costCAD > 0 ? ((h.valueCAD - h.costCAD) / h.costCAD * 100) : 0;
          parts.push(`\nYou hold ${h.totalQty.toFixed(2)} shares, avg cost $${(h.totalCost / h.totalQty).toFixed(2)}. Currently ${gainPct >= 0 ? "up" : "down"} ${Math.abs(gainPct).toFixed(1)}%.`);
          if (gainPct < -5) parts.push(`You're underwater on this — adding here would lower your average cost.`);
        }
        parts.push("");
      });

      // Add todo reminder if relevant
      const pending = (todos || []).filter(t => !t.done);
      const relatedTodos = pending.filter(t => mentionedTickers.some(sym => t.text.toUpperCase().includes(sym)));
      if (relatedTodos.length > 0) {
        parts.push(`**Reminder — you have related tasks:**`);
        relatedTodos.forEach(t => parts.push(`• ${t.text}`));
        parts.push("");
      }

      // Encouragement based on conditions
      if (mentionedTickers.some(sym => ["QQQ", "VOO", "DIA", "SPY"].includes(sym))) {
        const vixQ = marketQuotes["^VIX"];
        const anyDown = mentionedTickers.some(sym => (marketQuotes[sym]?.changePct || 0) < -0.5);
        if (anyDown && vixQ?.price < 25) {
          parts.push(`**Coach's take:** Markets are dipping but VIX is still manageable (${vixQ.price.toFixed(1)}). This is exactly the kind of day to stick to your DCA plan and add a bit.`);
        } else if (anyDown && vixQ?.price >= 25) {
          parts.push(`**Coach's take:** Markets are down AND fear is elevated (VIX ${vixQ.price.toFixed(1)}). Historically, these are the best entry points. Be brave, buy in tranches.`);
        } else {
          parts.push(`**Coach's take:** Steady day. No urgency — stick to your schedule.`);
        }
      }

      return parts.join("\n");
    }

    /* ── Todo-aware responses ── */
    if (q.includes("todo") || q.includes("to-do") || q.includes("task") || q.includes("remind") || q.includes("what should i do") || q.includes("what do i need to")) {
      const pending = (todos || []).filter(t => !t.done);
      if (pending.length === 0) return "Your to-do list is clear! Nothing pending. Want me to suggest some tasks based on market conditions?";
      let resp = `**Your open tasks (${pending.length}):**\n\n`;
      pending.forEach(t => {
        resp += `• **${t.text}**`;
        // Add context if we can match a ticker or amount
        const amtMatch = t.text.match(/\$(\d+[KkMm]?)/);
        const tickerMatch = t.text.match(/\b(IB|TD|QQQ|VOO|DIA|AAPL|MSFT|AMZN)\b/i);
        if (amtMatch) resp += ` — that's a meaningful amount, make sure you have a plan for deploying it`;
        if (tickerMatch) {
          const sym = tickerMatch[1].toUpperCase();
          const mq = marketQuotes[sym];
          if (mq?.pctDown >= 5) resp += ` (${sym} is ${mq.pctDown.toFixed(1)}% off ATH — good timing!)`;
        }
        resp += "\n";
      });
      resp += "\nWant me to help you think through any of these?";
      return resp;
    }

    /* Catch-all — now with market context */
    const vixQ = marketQuotes["^VIX"];
    const pendingTodos = (todos || []).filter(t => !t.done);
    let catchAll = `I'm your MoneyClaw coach. `;
    if (vixQ?.price >= 25) catchAll += `**Alert:** VIX is at ${vixQ.price.toFixed(1)} — fear is elevated. `;
    if (pendingTodos.length > 0) catchAll += `You have **${pendingTodos.length} open tasks** on your list. `;
    catchAll += `\n\nI can help with:\n\n• **Portfolio analysis** — allocation, risk, rebalancing\n• **Investing psychology** — fear, discipline, staying the course\n• **DCA strategy** — building a systematic investing plan\n• **Cash deployment** — getting idle cash into the market\n• **Crash playbook** — what to do when markets tank\n• **Building your rules** — a personal investing framework\n• **Net worth, spending, budgets, tax** — your financial data\n• **Any ticker** — just mention it (e.g. "QQQ" or "tell me about VOO")\n\nTap a topic above or just ask me anything!`;
    return catchAll;
  };

  /* ── Coach can add todos ── */
  const coachAddTodo = (text) => {
    if (!text.trim()) return;
    // Don't add duplicates
    if (todos.some(t => t.text === text.trim())) return;
    setTodos(prev => [...prev, { id: uid(), text: text.trim(), done: false, created: new Date().toISOString(), source: "coach" }]);
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMsg = { id: uid(), role: "user", text: input.trim() };
    const response = generateResponse(input.trim());
    const aiReply = { id: uid(), role: "ai", text: response };
    // Check if user asked coach to add a todo
    const q = input.trim().toLowerCase();
    if (q.includes("add to") && (q.includes("todo") || q.includes("to-do") || q.includes("task"))) {
      // Extract the task from the message (after "add to todo:" or similar)
      const match = input.trim().match(/(?:add (?:to )?(?:my )?(?:todo|to-do|task)s?[:\s]+)(.+)/i);
      if (match) coachAddTodo(match[1]);
    }
    setMessages(prev => [...prev, userMsg, aiReply]);
    setInput("");
  };

  /* Simple markdown-ish rendering — with actionable todo buttons */
  const renderText = (text) => {
    return text.split("\n").map((line, i) => {
      // Detect actionable rule-like lines (quoted rules)
      const ruleMatch = line.match(/^[•\-]\s*"(.+?)"$/);
      const rendered = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.+?)`/g, '<code>$1</code>');
      return (
        <div key={i} style={{ minHeight: line === "" ? 8 : "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: rendered }} />
          {ruleMatch && (
            <button onClick={() => coachAddTodo(ruleMatch[1])} title="Add to To-Do"
              style={{ background: C.accent + "22", color: C.accent, border: "none", borderRadius: 4, padding: "1px 6px", fontSize: 9, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
              + To-Do
            </button>
          )}
        </div>
      );
    });
  };

  /* ── Rules helpers ── */
  const addRule = (text) => {
    if (!text.trim()) return;
    setRules([...rules, { id: uid(), text: text.trim(), created: new Date().toISOString() }]);
    setNewRule("");
  };
  const removeRule = (id) => setRules(rules.filter(r => r.id !== id));

  /* ── Custom topic ── */
  const [addingTopic, setAddingTopic] = useState(false);
  const [customTopicLabel, setCustomTopicLabel] = useState("");
  const [customTopics, setCustomTopics] = useState([]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 160px)", maxHeight: 800 }}>

      {/* Topic pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 0", borderBottom: `1px solid ${C.border}33` }}>
        {[...TOPICS, ...customTopics].map((t, i) => (
          <button key={i} onClick={() => {
            const userMsg = { id: uid(), role: "user", text: t.prompt || t.label };
            const aiReply = { id: uid(), role: "ai", text: generateResponse(t.prompt || t.label) };
            setMessages(prev => [...prev, userMsg, aiReply]);
          }} style={{
            background: t.isTodo ? C.orange + "15" : C.card2,
            color: t.isTodo ? C.orange : C.accent,
            border: `1px solid ${t.isTodo ? C.orange + "40" : C.border}`,
            borderRadius: 5,
            padding: "5px 12px", fontSize: 11, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
          }}>{t.label}</button>
        ))}
        {!addingTopic ? (
          <button onClick={() => setAddingTopic(true)} style={{
            background: "transparent", color: C.muted, border: `1px dashed ${C.border}`, borderRadius: 5,
            padding: "5px 12px", fontSize: 11, cursor: "pointer",
          }}>+ Add topic</button>
        ) : (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input style={{ ...s.input, fontSize: 11, padding: "4px 10px", borderRadius: 5, width: 160 }}
              placeholder="Topic name..."
              value={customTopicLabel} onChange={e => setCustomTopicLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && customTopicLabel.trim()) {
                  setCustomTopics(prev => [...prev, { label: customTopicLabel.trim() }]);
                  setCustomTopicLabel(""); setAddingTopic(false);
                }
                if (e.key === "Escape") setAddingTopic(false);
              }}
              autoFocus />
            <button onClick={() => {
              if (customTopicLabel.trim()) {
                setCustomTopics(prev => [...prev, { label: customTopicLabel.trim() }]);
                setCustomTopicLabel(""); setAddingTopic(false);
              }
            }} style={{ ...s.btnSm, padding: "3px 8px", fontSize: 9 }}>Add</button>
          </div>
        )}
        <button onClick={() => setShowRules(!showRules)} style={{
          background: showRules ? C.accent + "20" : "transparent", color: showRules ? C.accent : C.muted,
          border: `1px solid ${showRules ? C.accent : C.border}`, borderRadius: 5,
          padding: "5px 12px", fontSize: 11, fontWeight: 500, cursor: "pointer", marginLeft: "auto",
        }}>My Rules {rules.length > 0 ? `(${rules.length})` : ""}</button>
      </div>

      {/* Rules panel */}
      {showRules && (
        <div style={{ ...s.card, margin: "8px 0", padding: "10px 14px", maxHeight: 200, overflowY: "auto" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, marginBottom: 6 }}>My Investing Rules</div>
          {rules.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: `1px solid ${C.border}15`, fontSize: 13 }}>
              <span style={{ color: C.muted, minWidth: 18 }}>{i + 1}.</span>
              <span style={{ flex: 1, color: C.text }}>{r.text}</span>
              <button onClick={() => removeRule(r.id)} style={{ ...s.btnDanger, padding: "1px 5px", fontSize: 9 }}>✕</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input style={{ ...s.input, flex: 1, fontSize: 11, padding: "4px 8px" }}
              placeholder="Add a new rule..." value={newRule} onChange={e => setNewRule(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addRule(newRule)} />
            <button onClick={() => addRule(newRule)} style={{ ...s.btnSm, padding: "3px 8px", fontSize: 9 }}>Add</button>
          </div>
          {rules.length === 0 && <div style={{ fontSize: 11, color: C.muted, padding: "4px 0" }}>No rules yet. Chat with me about building your investing rules.</div>}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 12, padding: "0 4px" }}>
            <div style={{
              maxWidth: "80%", padding: "12px 16px", borderRadius: 6,
              background: msg.role === "user" ? C.accent : C.card,
              color: msg.role === "user" ? (theme === "dark" ? "#0b1121" : "#fff") : C.text,
              border: msg.role === "ai" ? `1px solid ${C.border}` : "none",
              fontSize: 13, lineHeight: 1.6,
              borderBottomRightRadius: msg.role === "user" ? 4 : 16,
              borderBottomLeftRadius: msg.role === "ai" ? 4 : 16,
            }}>
              {msg.role === "ai" && <div style={{ fontSize: 11, color: C.accent, fontWeight: 600, marginBottom: 4 }}>🦀 MoneyClaw</div>}
              {renderText(msg.text)}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8, padding: "12px 0", borderTop: `1px solid ${C.border}` }}>
        <input style={{ ...s.input, flex: 1, borderRadius: 5, padding: "12px 20px" }}
          placeholder="Ask me anything — finances, strategy, psychology..."
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") sendMessage(); }} />
        <button style={{ ...s.btn, borderRadius: 5, padding: "12px 24px" }} onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════ */
const TABS = [
  { key: "overview", label: "Overview", iconName: "home" },
  { key: "networth", label: "Net Worth", iconName: "chart" },
  { key: "portfolio", label: "Portfolio", iconName: "briefcase" },
  { key: "cashflow", label: "Income & Expenses", iconName: "wallet" },
  { key: "watchlist", label: "Watchlist", iconName: "telescope" },
  { key: "settings", label: "Settings", iconName: "gear" },
];

export default function MoneyClaw() {
  const [theme, setTheme] = useState("dark");
  const [tab, setTab] = useState("overview");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatFullscreen, setChatFullscreen] = useState(false);
  const [chatKey, setChatKey] = useState(0);
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
        if (data.todos?.length > 0) setTodos(data.todos);
        if (data.rules?.length > 0) setRules(data.rules);
        console.log("[MoneyClaw] Restored from server backup");
      }
      setServerLoaded(true);
    }).catch(() => setServerLoaded(true));
  }, []);
  const demo = useMemo(() => makeDemoData(), []);
  /* ── Merge missing default holdings into persisted data (IB only) ── */
  const mergedPortfolio = useMemo(() => {
    if (!saved?.portfolio) return demo.portfolio;
    /* Only keep IB holdings — allocation comes from NW sheet */
    const ibHoldings = (saved.portfolio.holdings || []).filter(h => h.account === "IB" && h.ticker !== "BTC" && h.ticker !== "CASH")
      .map(h => h.ticker === "IBIT" ? { ...h, type: "Crypto" } : h);
    const existingNames = new Set(ibHoldings.map(h => h.name + "|" + h.account));
    const missing = (demo.portfolio.holdings || []).filter(h => !existingNames.has(h.name + "|" + h.account));
    const merged = [...ibHoldings, ...missing];
    return { ...saved.portfolio, holdings: merged };
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
  const [todos, setTodos] = useState(saved?.todos || []);
  const [rules, setRules] = useState(saved?.rules || []);
  const [lastAutoSave, setLastAutoSave] = useState(null);


  /* Auto-save to window.name + localStorage + server file every 1.5 seconds */
  const lastServerSave = useRef(0);
  const saveData = useCallback(() => {
    try {
      const obj = { _mc: true, nw: nwData, portfolio: portData, cashflow: cfData, settings, rates, watchlist: watchlistData, todos, rules };
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
  }, [nwData, portData, cfData, settings, rates, watchlistData, todos, rules]);

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
        const obj = { _mc: true, nw: nwData, portfolio: portData, cashflow: cfData, settings, rates, watchlist: watchlistData, todos, rules };
        navigator.sendBeacon("http://localhost:8484/api/save", new Blob([JSON.stringify(obj)], { type: "application/json" }));
      } catch {}
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [saveData, nwData, portData, cfData, settings, rates, watchlistData, todos]);

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
            <span style={{ fontSize: 13, color: C.muted, marginLeft: 4 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button onClick={undo} disabled={!canUndo} title="Undo" style={{ background: "transparent", border: "none", color: canUndo ? C.muted : C.card2, cursor: canUndo ? "pointer" : "default", fontSize: 13, padding: "4px 6px" }}>↩</button>
            <button onClick={redo} disabled={!canRedo} title="Redo" style={{ background: "transparent", border: "none", color: canRedo ? C.muted : C.card2, cursor: canRedo ? "pointer" : "default", fontSize: 13, padding: "4px 6px" }}>↪</button>
            {lastAutoSave && <span style={{ fontSize: 9, color: C.green, opacity: 0.7 }}>saved</span>}
            <button onClick={saveToFile} title="Export to file" style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center" }}><Icon name="save" size={12} color={C.muted} /></button>
            <button onClick={loadFromFile} title="Import from file" style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center" }}><Icon name="folder" size={12} color={C.muted} /></button>
            <button onClick={() => setNumbersHidden(h => !h)} title={numbersHidden ? "Show numbers" : "Hide numbers"} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center" }}>{numbersHidden ? <Icon name="eyeOff" size={12} color={C.muted} /> : <Icon name="eye" size={12} color={C.muted} />}</button>
            <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="Theme" style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 13 }}>{theme === "dark" ? "◑" : "◐"}</button>
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
                  padding: "10px 12px 8px", cursor: "pointer", fontWeight: active ? 700 : 500, fontSize: 13,
                  whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4,
                }}>
                <Icon name={t.iconName} size={12} color={active ? C.accent : C.muted} />{t.label}
                {isProtected(t.key) && !unlockedTabs[t.key] && <Icon name="lock" size={10} color={C.muted} />}
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
            <div style={{ marginBottom: 8 }}><Icon name="lock" size={48} color={C.muted} /></div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>This tab is locked</div>
            <div style={{ fontSize: 13, color: C.muted, textAlign: "center", maxWidth: 320 }}>
              Enter your password to access this tab.
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
              <input
                type="password" autoFocus placeholder="Password"
                value={pwInput} onChange={e => { setPwInput(e.target.value); setPwError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleUnlock(tab); }}
                style={{
                  background: C.card, border: `1px solid ${pwError ? C.red : C.border}`, borderRadius: 5,
                  padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", width: 220,
                }}
              />
              <button onClick={() => handleUnlock(tab)}
                style={{ ...S(theme).btn, padding: "10px 20px" }}>
                Unlock
              </button>
            </div>
            {pwError && <div style={{ color: C.red, fontSize: 13 }}>{pwError}</div>}
          </div>
        ) : (
          <>
            {tab === "overview" && <OverviewTab portData={portData} watchlistData={watchlistData} todos={todos} setTodos={setTodos} rules={rules} settings={settings} theme={theme} />}
            {tab === "networth" && <NetWorthTab data={nwData} setData={setNwData} settings={settings} rates={rates} theme={theme} hide={numbersHidden} />}
            {tab === "portfolio" && <PortfolioTab data={portData} setData={setPortData} nwData={nwData} settings={settings} rates={rates} theme={theme} hide={numbersHidden} />}
            {tab === "cashflow" && <CashFlowTab data={cfData} setData={setCfData} nwData={nwData} settings={settings} rates={rates} theme={theme} hide={numbersHidden} />}
            {tab === "watchlist" && <WatchlistTab data={watchlistData} setData={setWatchlistData} portData={portData} settings={settings} rates={rates} theme={theme} />}
            {tab === "settings" && <SettingsTab settings={settings} setSettings={setSettings} rates={rates} setRates={setRates} theme={theme} tabPasswords={tabPasswords} saveTabPasswords={saveTabPasswords} handleRemovePassword={handleRemovePassword} unlockedTabs={unlockedTabs} />}
          </>
        )}
      </div>

      <div style={{ textAlign: "center", padding: "24px 0 56px", color: C.muted, fontSize: 11 }}>
        MoneyClaw — Built for Jacqueline & Jon
      </div>

      {/* ── Chat Tab (docked to bottom, expandable to fullscreen) ── */}
      <div style={{
        position: "fixed", bottom: 0, right: 0, left: 0, zIndex: 999,
        transition: "height 0.3s ease",
        height: chatFullscreen ? "100vh" : chatOpen ? "min(500px, 60vh)" : 36,
        display: "flex", flexDirection: "column",
        background: C.bg, borderTop: chatFullscreen ? "none" : `1px solid ${C.border}`,
        boxShadow: chatOpen ? "0 -4px 20px rgba(0,0,0,0.3)" : "none",
      }}>
        <div onClick={() => { if (chatFullscreen) return; setChatOpen(!chatOpen); }} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "6px 16px",
          cursor: chatFullscreen ? "default" : "pointer", userSelect: "none", borderBottom: chatOpen ? `1px solid ${C.border}` : "none",
          background: C.card, minHeight: 36,
        }}>
          <span style={{ fontSize: 13 }}>🦀</span>
          <span style={{ fontWeight: 600, fontSize: 13, color: C.white }}>MoneyClaw Coach</span>
          {!chatFullscreen && <span style={{ fontSize: 9, color: C.muted }}>Ask me anything</span>}
          {chatOpen && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={e => { e.stopPropagation(); setChatKey(k => k + 1); }} title="Clear chat"
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px 6px", color: C.muted, borderRadius: 4, display: "flex", alignItems: "center" }}>
                <Icon name="trash" size={12} color={C.muted} />
              </button>
              <button onClick={e => { e.stopPropagation(); setChatFullscreen(!chatFullscreen); }} title={chatFullscreen ? "Exit fullscreen" : "Fullscreen"}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px 6px", color: C.muted, borderRadius: 4, display: "flex", alignItems: "center" }}>
                <Icon name={chatFullscreen ? "collapse" : "expand"} size={13} color={C.muted} />
              </button>
            </div>
          )}
          {chatOpen && chatFullscreen && (
            <button onClick={e => { e.stopPropagation(); setChatFullscreen(false); setChatOpen(false); }} title="Close"
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px 6px", fontSize: 13, color: C.muted, borderRadius: 4 }}>
              ✕
            </button>
          )}
          {!chatFullscreen && <span style={{ marginLeft: chatOpen ? 0 : "auto", fontSize: 9, color: C.muted, transition: "transform 0.2s", transform: chatOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▲</span>}
        </div>
        <div style={{ flex: 1, overflow: "hidden", display: chatOpen ? "flex" : "none", flexDirection: "column" }}>
          <FinanceChatTab key={chatKey} nwData={nwData} portData={portData} cfData={cfData} settings={settings} rates={rates} theme={theme} rules={rules} setRules={setRules} todos={todos} setTodos={setTodos} />
        </div>
      </div>
    </div>
  );
}