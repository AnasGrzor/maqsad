// Run with: pnpm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { CaseItem, CaseRecord, Dispute, isOverdue, Message, today } from "./cases.ts";

const id = "6f1c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f";

test("overdue means past due and still open", () => {
  assert.equal(isOverdue({ due_on: "2026-10-16", status: "open" }, "2026-10-17"), true);
  assert.equal(isOverdue({ due_on: "2026-10-17", status: "open" }, "2026-10-17"), false, "due today is not overdue");
  assert.equal(isOverdue({ due_on: "2026-10-16", status: "done" }, "2026-10-17"), false, "done items are never overdue");
  assert.equal(isOverdue({ due_on: null, status: "open" }, "2026-10-17"), false, "no due date, never overdue");
  assert.equal(isOverdue({ due_on: "2025-12-31", status: "open" }, "2026-01-01"), true, "across a year boundary");
});

test("today() uses Pakistan time, not UTC", () => {
  // 20:30 UTC on 16 Oct is 01:30 on 17 Oct in Karachi (UTC+5).
  const late = new Date("2026-10-16T20:30:00Z");
  assert.equal(today(late), "2026-10-17");
  assert.equal(today(late, "UTC"), "2026-10-16");
});

test("record amounts accept commas and keep a currency only with an amount", () => {
  const base = { target_case: id, kind: "payment_reported", summary: "Student reports paying the first instalment" };
  const paid = CaseRecord.parse({ ...base, amount: "50,000", currency: "PKR", on_date: "2026-11-03" });
  assert.equal(paid.amount, 50000);
  assert.equal(paid.currency, "PKR");
  assert.equal(paid.on_date, "2026-11-03");
  const none = CaseRecord.parse({ ...base, amount: "", currency: "USD" });
  assert.equal(none.amount, null);
  assert.equal(none.currency, null);
  assert.equal(none.correction_of, null);
  assert.equal(CaseRecord.safeParse({ ...base, amount: "-5" }).success, false);
  assert.equal(CaseRecord.safeParse({ ...base, amount: "1e9" }).success, false);
  assert.equal(CaseRecord.safeParse({ ...base, kind: "refund_guaranteed" }).success, false);
});

test("items, messages and disputes are bounded", () => {
  assert.equal(CaseItem.parse({ target_case: id, kind: "deadline", title: " Visa fee ", due_on: "" }).due_on, null);
  assert.equal(CaseItem.parse({ target_case: id, kind: "deadline", title: " Visa fee " }).title, "Visa fee");
  assert.equal(CaseItem.safeParse({ target_case: id, kind: "deadline", title: "x", due_on: "31/12/2026" }).success, false);
  assert.equal(Message.safeParse({ connection: id, body: "   " }).success, false);
  assert.equal(Message.safeParse({ connection: id, body: "x".repeat(4001) }).success, false);
  assert.equal(Message.parse({ connection: id, body: "Salam" }).target_case, null);
  assert.equal(Dispute.safeParse({ connection: id, kind: "report", reason: "other", details: "" }).success, false);
  assert.equal(Dispute.safeParse({ connection: "1 or 1=1", kind: "report", reason: "other", details: "x" }).success, false);
});
