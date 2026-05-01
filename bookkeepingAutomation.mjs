export const GD_BOOKKEEPING_EMAIL = "gdbookkeepingservices@gmail.com";

export const REVIEW_WINDOW = {
  start: "2025-05-01",
  end: "2026-04-30",
  label: "May 1, 2025 - April 30, 2026",
};

export const REVIEW_COMPANIES = [
  { id: "ecomm", name: "Ecomm House Inc", qboRole: "operating company" },
  { id: "holdco", name: "1119432 BC LTD", qboRole: "holding company" },
];

export const REQUIRED_BOOKKEEPING_FIELDS = [
  "company",
  "source",
  "transaction_id",
  "qbo_entity_type",
  "qbo_entity_id",
  "actor_email",
  "action_type",
  "action_timestamp",
  "amount",
  "account",
  "counterparty",
  "memo",
  "attachment_refs",
  "email_thread_refs",
  "ai_confidence",
  "recommended_action",
  "approval_status",
];

export const CONTROL_MATRIX = {
  auto_approved: [
    "receipt matching",
    "low-risk bank feed categorization",
    "duplicate receipt detection",
    "missing receipt reminders",
    "weekly digest drafting",
  ],
  owner_approved: [
    "new vendor setup",
    "unusual category changes",
    "journal entry drafts",
    "intercompany transfers",
    "owner draws or contributions",
    "month-end close packet",
  ],
  accountant_approved: [
    "sales tax adjustment",
    "payroll or tax payment classification",
    "year-end cleanup",
    "reconciliation signoff",
    "financial statement changes",
  ],
  never_automated: [
    "tax filing",
    "bank transfer",
    "payment release",
    "credential or MFA handling",
    "final legal or tax representation",
  ],
};

export const AUTOMATION_WORKFLOWS = [
  {
    id: "intake",
    title: "Receipt and invoice intake",
    owner: "Codex email agent",
    replaces: "Forwarding, sorting, and manually attaching documents",
    gate: "auto_approved",
    readiness: 78,
  },
  {
    id: "categorization",
    title: "Bank feed categorization",
    owner: "Codex classification agent",
    replaces: "Routine account/category/tax-code decisions",
    gate: "auto_approved",
    readiness: 72,
  },
  {
    id: "close",
    title: "Monthly close prep",
    owner: "Codex close agent",
    replaces: "Checklist building, missing-doc chasing, close packets",
    gate: "owner_approved",
    readiness: 64,
  },
  {
    id: "controls",
    title: "Risk and exception review",
    owner: "Codex controls agent",
    replaces: "Manual scanning for duplicates, odd vendors, and transfers",
    gate: "owner_approved",
    readiness: 69,
  },
  {
    id: "tax",
    title: "Tax-sensitive review",
    owner: "Accountant-supervised agent",
    replaces: "Draft prep only; final tax decisions stay human-approved",
    gate: "accountant_approved",
    readiness: 48,
  },
];

export const REVIEW_ROADMAP = [
  { phase: "Phase 1", title: "Read-only extraction", status: "active", output: "QBO + email evidence lake, no write-back" },
  { phase: "Phase 2", title: "AI classification", status: "next", output: "Candidate categories, receipts, exception queue" },
  { phase: "Phase 3", title: "Draft QBO changes", status: "blocked", output: "Owner-reviewed changes only" },
  { phase: "Phase 4", title: "Controlled write-back", status: "blocked", output: "Low-risk automation with explicit approval class" },
  { phase: "Phase 5", title: "Monthly close automation", status: "blocked", output: "Close packets, signoff, audit trail" },
];

const COMPANY_NAMES = new Set(REVIEW_COMPANIES.map(c => c.name));
const OPTIONAL_FIELDS = new Set([
  "transaction_id",
  "qbo_entity_type",
  "qbo_entity_id",
  "amount",
  "account",
  "counterparty",
  "memo",
  "attachment_refs",
  "email_thread_refs",
  "ai_confidence",
  "recommended_action",
]);

export function isInsideReviewWindow(dateValue) {
  const date = String(dateValue || "").slice(0, 10);
  return date >= REVIEW_WINDOW.start && date <= REVIEW_WINDOW.end;
}

export function isGdRecord(record) {
  return String(record?.actor_email || "").trim().toLowerCase() === GD_BOOKKEEPING_EMAIL;
}

export function validateBookkeepingRecord(record) {
  const errors = [];
  for (const field of REQUIRED_BOOKKEEPING_FIELDS) {
    if (OPTIONAL_FIELDS.has(field)) continue;
    if (record?.[field] == null || record[field] === "") errors.push(`${field} is required`);
  }
  if (record?.company && !COMPANY_NAMES.has(record.company)) {
    errors.push(`company must be one of: ${[...COMPANY_NAMES].join(", ")}`);
  }
  return errors;
}

function emptyCompanySummary(company) {
  return {
    company,
    totalRecords: 0,
    gdRecords: 0,
    qboRecords: 0,
    emailRecords: 0,
    amountReviewed: 0,
    automationReady: 0,
    ownerReview: 0,
    accountantReview: 0,
  };
}

export function classifyControl(record) {
  const action = String(record?.action_type || "").toLowerCase();
  const approval = String(record?.approval_status || "").toLowerCase();
  const confidence = Number(record?.ai_confidence || 0);
  if (action.includes("reconciliation") || action.includes("journal") || action.includes("transfer")) return "owner_approved";
  if (action.includes("tax") || approval.includes("accountant")) return "accountant_approved";
  if (confidence >= 0.9 && (action.includes("bank_feed") || action.includes("receipt") || action.includes("duplicate"))) return "auto_approved";
  return "owner_approved";
}

export function buildBookkeepingReview(records = []) {
  const companies = Object.fromEntries(REVIEW_COMPANIES.map(c => [c.name, emptyCompanySummary(c.name)]));
  const actionTypes = {};
  let totalGdRecords = 0;
  let invalidRecords = 0;

  records.filter(r => COMPANY_NAMES.has(r.company) && isInsideReviewWindow(r.action_timestamp)).forEach(record => {
    const company = companies[record.company];
    company.totalRecords += 1;
    if (isGdRecord(record)) {
      company.gdRecords += 1;
      totalGdRecords += 1;
      actionTypes[record.action_type] = (actionTypes[record.action_type] || 0) + 1;
    }
    if (String(record.source || "").startsWith("qbo")) company.qboRecords += 1;
    if (String(record.source || "").includes("email")) company.emailRecords += 1;
    company.amountReviewed += Math.abs(Number(record.amount || 0));

    const control = classifyControl(record);
    if (control === "auto_approved") company.automationReady += 1;
    if (control === "owner_approved") company.ownerReview += 1;
    if (control === "accountant_approved") company.accountantReview += 1;
    if (validateBookkeepingRecord(record).length) invalidRecords += 1;
  });

  return {
    window: REVIEW_WINDOW,
    companies,
    actionTypes,
    totalGdRecords,
    invalidRecords,
    evidenceSources: {
      qbo: records.filter(r => String(r.source || "").startsWith("qbo")).length,
      email: records.filter(r => String(r.source || "").includes("email")).length,
    },
  };
}

export function getAutomationCandidates(records = []) {
  return records
    .filter(record => COMPANY_NAMES.has(record.company) && isInsideReviewWindow(record.action_timestamp) && isGdRecord(record))
    .map(record => ({
      ...record,
      control: classifyControl(record),
      confidencePct: Math.round(Number(record.ai_confidence || 0) * 100),
    }))
    .sort((a, b) => {
      const rank = { auto_approved: 0, accountant_approved: 1, owner_approved: 2 };
      return (rank[a.control] ?? 9) - (rank[b.control] ?? 9) || b.confidencePct - a.confidencePct;
    });
}

export const SEED_BOOKKEEPING_RECORDS = [
  {
    company: "Ecomm House Inc",
    source: "qbo_audit_log",
    transaction_id: "pending-qbo-export",
    qbo_entity_type: "Expense",
    qbo_entity_id: "pending",
    actor_email: GD_BOOKKEEPING_EMAIL,
    action_type: "bank_feed_categorization",
    action_timestamp: "2025-06-17",
    amount: 0,
    account: "Business Subscription/SaaS",
    counterparty: "Software vendors",
    memo: "Seed row representing routine categorization after QBO export is imported.",
    attachment_refs: [],
    email_thread_refs: [],
    ai_confidence: 0.94,
    recommended_action: "Auto-categorize after owner approves the learned rule set.",
    approval_status: "owner_review",
  },
  {
    company: "1119432 BC LTD",
    source: "qbo_audit_log",
    transaction_id: "pending-qbo-export",
    qbo_entity_type: "JournalEntry",
    qbo_entity_id: "pending",
    actor_email: GD_BOOKKEEPING_EMAIL,
    action_type: "reconciliation",
    action_timestamp: "2025-11-30",
    amount: 0,
    account: "Bank and investment accounts",
    counterparty: "Month-end close",
    memo: "Seed row representing close/reconciliation work requiring owner signoff.",
    attachment_refs: [],
    email_thread_refs: [],
    ai_confidence: 0.88,
    recommended_action: "Draft reconciliation packet; owner/accountant approves final close.",
    approval_status: "accountant_review",
  },
  {
    company: "Ecomm House Inc",
    source: "email",
    transaction_id: "pending-email-import",
    qbo_entity_type: "Attachment",
    qbo_entity_id: "pending",
    actor_email: GD_BOOKKEEPING_EMAIL,
    action_type: "missing_doc_followup",
    action_timestamp: "2026-02-04",
    amount: 0,
    account: "Uncategorized",
    counterparty: "Receipt request",
    memo: "Seed row representing recurring email followups and missing-document chasing.",
    attachment_refs: [],
    email_thread_refs: ["pending-email-export"],
    ai_confidence: 0.91,
    recommended_action: "Generate owner question and attach response to the exception queue.",
    approval_status: "owner_review",
  },
  {
    company: "1119432 BC LTD",
    source: "qbo_audit_log",
    transaction_id: "pending-qbo-export",
    qbo_entity_type: "TaxAdjustment",
    qbo_entity_id: "pending",
    actor_email: GD_BOOKKEEPING_EMAIL,
    action_type: "sales_tax_adjustment",
    action_timestamp: "2026-03-31",
    amount: 0,
    account: "Sales tax payable",
    counterparty: "Tax-sensitive workflow",
    memo: "Seed row representing tax-sensitive work that AI can draft but not finalize.",
    attachment_refs: [],
    email_thread_refs: [],
    ai_confidence: 0.76,
    recommended_action: "Keep accountant approval before any final tax treatment.",
    approval_status: "accountant_review",
  },
];
