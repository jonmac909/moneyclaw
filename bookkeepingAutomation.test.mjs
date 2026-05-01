import test from "node:test";
import assert from "node:assert/strict";
import {
  REVIEW_WINDOW,
  REVIEW_COMPANIES,
  REQUIRED_BOOKKEEPING_FIELDS,
  CONTROL_MATRIX,
  buildBookkeepingReview,
  getAutomationCandidates,
  validateBookkeepingRecord,
} from "./bookkeepingAutomation.mjs";

test("defines exact review window and both target companies", () => {
  assert.equal(REVIEW_WINDOW.start, "2025-05-01");
  assert.equal(REVIEW_WINDOW.end, "2026-04-30");
  assert.deepEqual(REVIEW_COMPANIES.map(c => c.name), ["Ecomm House Inc", "1119432 BC LTD"]);
});

test("keeps the required bookkeeping dataset fields stable", () => {
  assert.deepEqual(REQUIRED_BOOKKEEPING_FIELDS, [
    "company", "source", "transaction_id", "qbo_entity_type", "qbo_entity_id",
    "actor_email", "action_type", "action_timestamp", "amount", "account",
    "counterparty", "memo", "attachment_refs", "email_thread_refs",
    "ai_confidence", "recommended_action", "approval_status",
  ]);
});

test("summarizes GD activity by company and action type inside the review window", () => {
  const review = buildBookkeepingReview([
    { company: "Ecomm House Inc", source: "qbo_audit_log", actor_email: "gdbookkeepingservices@gmail.com", action_type: "bank_feed_categorization", action_timestamp: "2025-06-02", amount: 120, account: "Software", approval_status: "owner_review" },
    { company: "Ecomm House Inc", source: "qbo_audit_log", actor_email: "someone@example.com", action_type: "journal_entry", action_timestamp: "2025-07-02", amount: 50, account: "Other", approval_status: "owner_review" },
    { company: "1119432 BC LTD", source: "email", actor_email: "gdbookkeepingservices@gmail.com", action_type: "missing_doc_followup", action_timestamp: "2026-02-02", amount: 0, account: "", approval_status: "owner_review" },
    { company: "Ecomm House Inc", source: "qbo_audit_log", actor_email: "gdbookkeepingservices@gmail.com", action_type: "bank_feed_categorization", action_timestamp: "2024-12-02", amount: 90, account: "Old", approval_status: "owner_review" },
  ]);

  assert.equal(review.totalGdRecords, 2);
  assert.equal(review.companies["Ecomm House Inc"].gdRecords, 1);
  assert.equal(review.companies["1119432 BC LTD"].gdRecords, 1);
  assert.equal(review.actionTypes.bank_feed_categorization, 1);
  assert.equal(review.actionTypes.missing_doc_followup, 1);
});

test("classifies automation candidates with correct approval gates", () => {
  const candidates = getAutomationCandidates([
    { company: "Ecomm House Inc", source: "qbo_audit_log", actor_email: "gdbookkeepingservices@gmail.com", action_type: "bank_feed_categorization", action_timestamp: "2025-06-02", ai_confidence: 0.94, approval_status: "owner_review" },
    { company: "Ecomm House Inc", source: "qbo_audit_log", actor_email: "gdbookkeepingservices@gmail.com", action_type: "sales_tax_adjustment", action_timestamp: "2025-06-03", ai_confidence: 0.92, approval_status: "accountant_review" },
    { company: "1119432 BC LTD", source: "qbo_audit_log", actor_email: "gdbookkeepingservices@gmail.com", action_type: "reconciliation", action_timestamp: "2025-06-04", ai_confidence: 0.91, approval_status: "accountant_review" },
  ]);

  assert.equal(candidates[0].action_type, "bank_feed_categorization");
  assert.equal(candidates[0].control, "auto_approved");
  assert.equal(candidates[1].control, "accountant_approved");
  assert.equal(candidates[2].control, "owner_approved");
  assert.ok(CONTROL_MATRIX.never_automated.includes("tax filing"));
});

test("validates missing required fields without blocking optional empty references", () => {
  const errors = validateBookkeepingRecord({
    company: "Ecomm House Inc",
    source: "qbo_audit_log",
    actor_email: "gdbookkeepingservices@gmail.com",
    action_type: "bank_feed_categorization",
    action_timestamp: "2025-06-02",
    approval_status: "owner_review",
  });
  assert.deepEqual(errors, []);

  const bad = validateBookkeepingRecord({ company: "Other", action_type: "bank_feed_categorization" });
  assert.ok(bad.includes("company must be one of: Ecomm House Inc, 1119432 BC LTD"));
  assert.ok(bad.includes("source is required"));
  assert.ok(bad.includes("action_timestamp is required"));
});
