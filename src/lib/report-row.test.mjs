// Run with: pnpm test. A saved report keeps findings and summaries, never personal details from the document.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ruleChecks } from "./checks.ts";
import { fromRow, toRow } from "./report-row.ts";
import { riskLevel } from "./scoring.ts";

const x = {
  doc_type: "university_offer", issuer_name: "Westbridge Global University", issuer_country: "United Kingdom",
  issuer_website: "www.westbridgeglobal.ac.uk", recipient_name: "Ayesha Khan", issue_date: "2026-09-03",
  programme_or_position: "MSc Data Science", amounts: [],
  payment: { method: "JazzCash", payee_name: "Imran Shah", account_details: "0301 4567890" },
  issuer_emails: ["admissions@westbridge-uni.co.uk", "admissions.westbridge@gmail.com"],
  phones: ["+92 333 1234567"], urls: [], reference_numbers: [],
  signatory: { name: "Prof. Richard Hale", title: "Registrar" }, agent_or_intermediary: "",
  pressure_tactics: ["Dear Ayesha, pay within 48 hours to 0333-1234567 or lose your seat."],
  embedded_instructions: [], inconsistencies: [],
};
const web = {
  title: "Admissions email is a Gmail address", detail: "admissions.westbridge@gmail.com is not official. Call 0333 1234567? No.",
  severity: "high", status: "red_flag", topic: "sender_email", sources: ["https://www.gov.uk/student-visa"], origin: "web",
};
const findings = [...ruleChecks(x), web];
const report = {
  risk: riskLevel(findings, true), extraction: x, findings,
  official_contact: { name: "Admissions", email: "", phone: "", url: "https://www.example.ac.uk/contact" },
  summary_en: "Ayesha Khan was asked to send PKR 650,000 by JazzCash (0301-4567890) to Imran Shah.",
  summary_ur: "عائشہ سے رقم مانگی گئی۔",
  warnings: ["Test mode"],
  connections: [{ kind: "phone", value: "+92 333 1234567", cases: [] }],
};

test("no personal field from the document survives in the stored row", () => {
  const stored = JSON.stringify(toRow(report));
  for (const secret of ["Ayesha", "Khan", "Imran Shah", "4567890", "1234567", "@gmail.com", "admissions@westbridge-uni.co.uk", "recipient_name", "extraction", "connections"]) {
    assert.ok(!stored.includes(secret), `stored row contains ${secret}`);
  }
});

test("the stored row keeps what the report needs", () => {
  const row = toRow(report);
  assert.equal(row.risk, "high");
  assert.equal(row.issuer_name, "Westbridge Global University");
  assert.deepEqual(row.findings.map((f) => f.code), [...ruleChecks(x).map((f) => f.code), undefined]);
  assert.deepEqual(row.findings.at(-1).sources, ["https://www.gov.uk/student-visa"]);
  assert.deepEqual(row.findings.find((f) => f.code === "payment_channel").evidence, ["JazzCash"]);
  // A quote that was only personal data is dropped; the rest of a quote keeps its non-personal words.
  assert.equal(row.findings.find((f) => f.code === "free_email").evidence.length, 0);
  assert.match(row.findings.find((f) => f.code === "pressure").evidence[0], /^Dear \[removed\], pay within 48 hours to \[removed\]/);
  assert.match(row.summary_en, /PKR 650,000 by JazzCash/);
  assert.deepEqual(row.official_contact, report.official_contact);
});

test("a stored row renders as a report with an empty extraction", () => {
  const back = fromRow(toRow(report));
  assert.equal(back.extraction.doc_type, "university_offer");
  assert.equal(back.extraction.recipient_name, "");
  assert.deepEqual(back.connections, []);
  assert.equal(back.findings.length, findings.length);
});
