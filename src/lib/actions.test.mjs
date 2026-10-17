// Run with: pnpm test (Node strips the TypeScript types from actions.ts)
import assert from "node:assert/strict";
import { test } from "node:test";
import { actionPlan } from "./actions.ts";

const report = (overrides = {}) => ({
  risk: "high",
  extraction: {
    doc_type: "university_offer",
    issuer_name: "University of Manchester",
    issuer_country: "United Kingdom",
    issuer_website: "www.manchester-admissions.com",
    recipient_name: "Ali Khan",
    issue_date: "2026-09-01",
    programme_or_position: "MSc Data Science",
    amounts: [{ label: "Deposit", amount: "250000", currency: "PKR" }],
    payment: { method: "JazzCash", payee_name: "Imran Ahmed", account_details: "03001234567" },
    issuer_emails: ["admissions.manchester@gmail.com"],
    phones: ["+92 300 1234567"],
    urls: [],
    reference_numbers: [{ kind: "cas", value: "E4G8XXXXXXXXX" }],
    signatory: { name: "", title: "" },
    agent_or_intermediary: "",
    pressure_tactics: [],
    embedded_instructions: [],
    inconsistencies: [],
  },
  findings: [
    { title: "Payment through JazzCash", detail: "", severity: "high", status: "red_flag", topic: "payment_channel", sources: [], origin: "rules" },
    { title: "Issuer exists", detail: "", severity: "low", status: "verified", topic: "issuer_exists", sources: [], origin: "web" },
  ],
  official_contact: { name: "Admissions", email: "pgt-admissions@manchester.ac.uk", phone: "", url: "https://www.manchester.ac.uk" },
  summary_en: "",
  summary_ur: "",
  warnings: [],
  connections: [],
  ...overrides,
});

test("stop paying comes first, then the bank or wallet, and the report comes later", () => {
  const titles = actionPlan(report(), ["cnic", "wallet", "card"]).steps.map((s) => s.title);
  assert.match(titles[0], /Stop/);
  assert.match(titles[1], /bank/);
  assert.match(titles[2], /JazzCash/);
  assert.ok(titles.findIndex((t) => /Cyber Crime/.test(t)) > titles.findIndex((t) => /CNIC/.test(t)));
});

test("nothing ticked gives no steps", () => {
  assert.deepEqual(actionPlan(report(), []).steps, []);
});

test("verification email goes only to the official contact", () => {
  const { verifyEmail } = actionPlan(report(), []);
  assert.equal(verifyEmail.to, "pgt-admissions@manchester.ac.uk");
  assert.ok(!verifyEmail.to.includes("gmail"));
});

test("no official email means no verification email, even when the document has one", () => {
  assert.equal(actionPlan(report({ official_contact: null }), []).verifyEmail, null);
  const blank = { name: "", email: "", phone: "", url: "" };
  assert.equal(actionPlan(report({ official_contact: blank }), []).verifyEmail, null);
});

test("complaint lists red-flag titles and the scammer's details, not confirmed findings", () => {
  const { complaint } = actionPlan(report(), ["wallet"]);
  assert.match(complaint, /- Payment through JazzCash/);
  assert.doesNotMatch(complaint, /Issuer exists/);
  for (const v of ["Imran Ahmed", "03001234567", "admissions.manchester@gmail.com", "+92 300 1234567", "250000 PKR", "CAS E4G8XXXXXXXXX"]) {
    assert.ok(complaint.includes(v), v);
  }
  assert.match(complaint, /I paid by JazzCash or Easypaisa/);
});
