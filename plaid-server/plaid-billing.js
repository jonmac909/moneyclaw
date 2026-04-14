/**
 * Plaid billing safeguards.
 *
 * Wraps Plaid SDK calls with seven defense layers:
 *   1. Hard daily + monthly $ budget cap
 *   2. Per-(connId,endpoint) cooldown
 *   3. Per-connId circuit breaker
 *   4. In-flight deduplication
 *   5. UI-side guards (handled by client)
 *   6. Cost telemetry endpoint
 *   7. Emergency kill switch (env var PLAID_DISABLED=1)
 *
 * Every call goes through `guardedCall(endpoint, connId, fn)`.
 */

const fs = require("fs");
const path = require("path");

const LEDGER_FILE = path.join(__dirname, "plaid-usage.jsonl");
const STATE_FILE = path.join(__dirname, "plaid-billing-state.json");
const LIMITS_FILE = path.join(__dirname, "plaid-limits.json");

/* ── USD cost per API call (from Plaid Contract — edit plaid-limits.json to tune) ── */
const DEFAULT_COST_USD = {
  accountsBalanceGet: 0.10,
  transactionsGet: 0.12,
  transactionsRefresh: 0.12,
  transactionsSync: 0.12,
  investmentsHoldingsGet: 0.18,
  investmentsTransactionsGet: 0.35,
  liabilitiesGet: 0.20,
  authGet: 1.50,
  identityGet: 1.50,
  /* Free endpoints */
  linkTokenCreate: 0,
  itemPublicTokenExchange: 0,
  itemGet: 0,
  itemRemove: 0,
};

const DEFAULT_LIMITS = {
  daily_usd: 5.0,
  monthly_usd: 50.0,
  cooldown_ms_default: 4 * 60 * 60 * 1000,
  cooldown_ms_overrides: {},
  breaker_threshold: 3,
  breaker_cooldown_ms: 60 * 60 * 1000,
  cost_usd: DEFAULT_COST_USD,
};

function loadJsonSafe(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (_) { return fallback; }
}
function saveJsonAtomic(file, obj) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

/* ── State: cooldowns + breakers, persisted to disk ── */
let state = loadJsonSafe(STATE_FILE, { cooldowns: {}, breakers: {} });
const saveState = () => saveJsonAtomic(STATE_FILE, state);

/* ── Limits config: load at boot, hot-reload if file changes ── */
function getLimits() {
  const user = loadJsonSafe(LIMITS_FILE, {});
  return { ...DEFAULT_LIMITS, ...user, cost_usd: { ...DEFAULT_COST_USD, ...(user.cost_usd || {}) } };
}

/* ── Ledger: append-only JSONL of every Plaid call ── */
function appendLedger(entry) {
  fs.appendFileSync(LEDGER_FILE, JSON.stringify(entry) + "\n");
}
function readLedger() {
  try {
    return fs.readFileSync(LEDGER_FILE, "utf8")
      .split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch (_) { return null; } })
      .filter(Boolean);
  } catch (_) { return []; }
}
function usageSince(sinceTs) {
  return readLedger().filter(e => e.ts >= sinceTs).reduce((s, e) => s + (e.costUsd || 0), 0);
}
function startOfDay() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
function startOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }

/* ── In-flight dedup: same (endpoint, connId) request in flight returns same promise ── */
const inflight = new Map();
const inflightKey = (endpoint, connId) => `${endpoint}::${connId || "global"}`;

/* ── Circuit breaker helpers ── */
function breakerOpen(connId) {
  const b = state.breakers[connId];
  return b && b.openUntil && b.openUntil > Date.now();
}
function breakerBump(connId, success) {
  if (!connId) return;
  const b = state.breakers[connId] || { failures: 0, openUntil: 0 };
  const L = getLimits();
  if (success) { b.failures = 0; b.openUntil = 0; }
  else {
    b.failures = (b.failures || 0) + 1;
    if (b.failures >= L.breaker_threshold) {
      b.openUntil = Date.now() + L.breaker_cooldown_ms;
    }
  }
  state.breakers[connId] = b;
  saveState();
}

/* ── Cooldown helpers ── */
function cooldownRemainingMs(connId, endpoint) {
  if (!connId) return 0;
  const last = state.cooldowns[connId]?.[endpoint];
  if (!last) return 0;
  const L = getLimits();
  const cdMs = L.cooldown_ms_overrides[endpoint] ?? L.cooldown_ms_default;
  const passed = Date.now() - last;
  return Math.max(0, cdMs - passed);
}
function cooldownMark(connId, endpoint) {
  if (!connId) return;
  state.cooldowns[connId] = state.cooldowns[connId] || {};
  state.cooldowns[connId][endpoint] = Date.now();
  saveState();
}

/* ── Public API ── */

class PlaidBudgetError extends Error {
  constructor(code, detail) { super(detail); this.code = code; this.status = 429; }
}

async function guardedCall(endpoint, connId, fn, { force = false, noCost = false } = {}) {
  /* Layer 7: kill switch */
  if (process.env.PLAID_DISABLED === "1") {
    throw new PlaidBudgetError("PLAID_DISABLED", "Plaid is disabled via PLAID_DISABLED=1");
  }

  const L = getLimits();
  const cost = noCost ? 0 : (L.cost_usd[endpoint] ?? 0);

  /* Layer 1: hard budget cap */
  if (cost > 0 && !force) {
    const day = usageSince(startOfDay());
    if (day + cost > L.daily_usd) {
      throw new PlaidBudgetError("DAILY_LIMIT", `Daily cap $${L.daily_usd.toFixed(2)} would be exceeded (today $${day.toFixed(2)}, +$${cost.toFixed(2)}). Edit plaid-limits.json or pass force=1.`);
    }
    const month = usageSince(startOfMonth());
    if (month + cost > L.monthly_usd) {
      throw new PlaidBudgetError("MONTHLY_LIMIT", `Monthly cap $${L.monthly_usd.toFixed(2)} would be exceeded (month $${month.toFixed(2)}, +$${cost.toFixed(2)}).`);
    }
  }

  /* Layer 3: circuit breaker */
  if (connId && breakerOpen(connId) && !force) {
    const until = new Date(state.breakers[connId].openUntil).toISOString();
    throw new PlaidBudgetError("BREAKER_OPEN", `Circuit open for connection ${connId} until ${until}. Use POST /api/plaid/reset-breaker/${connId} to clear.`);
  }

  /* Layer 2: cooldown */
  if (connId && cost > 0 && !force) {
    const remaining = cooldownRemainingMs(connId, endpoint);
    if (remaining > 0) {
      const mins = Math.ceil(remaining / 60000);
      throw new PlaidBudgetError("COOLDOWN", `Cooldown: ${endpoint} on ${connId} next allowed in ${mins} min.`);
    }
  }

  /* Layer 4: in-flight dedup */
  const key = inflightKey(endpoint, connId);
  if (inflight.has(key)) return inflight.get(key);

  const started = Date.now();
  const promise = (async () => {
    let success = false, errMsg = null, errCode = null;
    try {
      const result = await fn();
      success = true;
      return result;
    } catch (err) {
      errCode = err.response?.data?.error_code || err.code || null;
      errMsg = err.response?.data?.error_message || err.message || "error";
      throw err;
    } finally {
      appendLedger({
        ts: started, endpoint, connId: connId || null,
        costUsd: success ? cost : 0, // only charge on success (Plaid doesn't bill failed calls)
        success, errCode, errMsg,
        durationMs: Date.now() - started,
      });
      if (connId) {
        if (success) cooldownMark(connId, endpoint);
        breakerBump(connId, success);
      }
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/* ── Telemetry: Layer 6 ── */
function usageSummary() {
  const all = readLedger();
  const day = startOfDay();
  const month = startOfMonth();
  const today = all.filter(e => e.ts >= day);
  const thisMonth = all.filter(e => e.ts >= month);
  const sumCost = arr => arr.reduce((s, e) => s + (e.costUsd || 0), 0);
  const byEndpoint = (arr) => {
    const m = {};
    arr.forEach(e => { m[e.endpoint] = m[e.endpoint] || { calls: 0, cost: 0, fails: 0 };
      m[e.endpoint].calls++;
      m[e.endpoint].cost += e.costUsd || 0;
      if (!e.success) m[e.endpoint].fails++;
    });
    return m;
  };
  const L = getLimits();
  return {
    disabled: process.env.PLAID_DISABLED === "1",
    limits: { daily_usd: L.daily_usd, monthly_usd: L.monthly_usd },
    today: { totalUsd: sumCost(today), calls: today.length, remainingUsd: Math.max(0, L.daily_usd - sumCost(today)), byEndpoint: byEndpoint(today) },
    month: { totalUsd: sumCost(thisMonth), calls: thisMonth.length, remainingUsd: Math.max(0, L.monthly_usd - sumCost(thisMonth)), byEndpoint: byEndpoint(thisMonth) },
    breakers: Object.entries(state.breakers).map(([connId, b]) => ({ connId, failures: b.failures, openUntil: b.openUntil, open: breakerOpen(connId) })),
    cooldowns: Object.entries(state.cooldowns).map(([connId, eps]) => ({ connId, endpoints: Object.fromEntries(Object.entries(eps).map(([ep, ts]) => [ep, { lastAt: ts, remainingMs: cooldownRemainingMs(connId, ep) }])) })),
  };
}

function resetBreaker(connId) { delete state.breakers[connId]; saveState(); }
function resetCooldown(connId, endpoint) {
  if (endpoint) { if (state.cooldowns[connId]) delete state.cooldowns[connId][endpoint]; }
  else delete state.cooldowns[connId];
  saveState();
}

module.exports = {
  guardedCall,
  usageSummary,
  resetBreaker,
  resetCooldown,
  PlaidBudgetError,
};
