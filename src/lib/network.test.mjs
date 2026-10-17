// Run with: pnpm test (Node strips the TypeScript types from network.ts)
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { identifiers, linkCase, MAX_KEYS, normalisePhone, store } from "./network.ts";

const doc = (over = {}) => ({
  doc_type: "university_offer",
  issuer_name: "Westbridge Global University",
  issuer_country: "United Kingdom",
  issuer_website: "",
  recipient_name: "Ayesha Khan",
  issue_date: "",
  programme_or_position: "",
  amounts: [],
  payment: { method: "", payee_name: "", account_details: "" },
  issuer_emails: [],
  phones: [],
  urls: [],
  reference_numbers: [],
  signatory: { name: "", title: "" },
  agent_or_intermediary: "",
  pressure_tactics: [],
  embedded_instructions: [],
  inconsistencies: [],
  ...over,
});

beforeEach(() => store.clear());

test("Pakistani phone formats normalise to one form and link", () => {
  const forms = ["+92 301 4567890", "0092-301-4567890", "0301 4567890", "+92 (0)301 4567890"];
  assert.deepEqual(new Set(forms.map(normalisePhone)), new Set(["923014567890"]));

  assert.deepEqual(linkCase(doc({ phones: [forms[0]] }), "high"), []);
  const links = linkCase(doc({ phones: [forms[2]] }), "medium");
  assert.equal(links.length, 1);
  assert.equal(links[0].kind, "phone");
  assert.equal(links[0].value, "0301 4567890");
  assert.equal(links[0].cases[0].risk, "high");
  assert.equal(links[0].cases[0].issuer_name, "Westbridge Global University");
});

test("short phone numbers are skipped", () => {
  assert.deepEqual(identifiers(doc({ phones: ["1234"] })), []);
});

test("two different Gmail senders don't link, the same Gmail address does", () => {
  linkCase(doc({ issuer_emails: ["admissions.westbridge@gmail.com"] }), "high");
  assert.deepEqual(linkCase(doc({ issuer_emails: ["someone.else@gmail.com"] }), "low"), []);
  const links = linkCase(doc({ issuer_emails: ["Admissions.Westbridge@gmail.com"] }), "high");
  assert.deepEqual(
    links.map((c) => [c.kind, c.value, c.cases.length]),
    [["email", "admissions.westbridge@gmail.com", 1]],
  );
});

test("a non-free email domain links to the same website domain", () => {
  linkCase(doc({ issuer_website: "https://www.westbridge-uni.co.uk/apply" }), "high");
  const links = linkCase(doc({ issuer_emails: ["fees@westbridge-uni.co.uk"] }), "high");
  assert.deepEqual(links.map((c) => [c.kind, c.value]), [["domain", "westbridge-uni.co.uk"]]);
});

test("payment processors and the recipient's own name are not identifiers", () => {
  assert.deepEqual(identifiers(doc({ payment: { method: "", payee_name: "Flywire", account_details: "" } })), []);
  assert.deepEqual(identifiers(doc({ payment: { method: "", payee_name: "ayesha  khan", account_details: "" } })), []);
});

test("accounts link by digits, short numbers and prose are skipped", () => {
  const pay = (account_details) => ({ payment: { method: "Bank transfer", payee_name: "", account_details } });
  assert.deepEqual(identifiers(doc(pay("Pay through the university's Flywire portal"))), []);
  linkCase(doc(pay("IBAN PK36 SCBL 0000 0011 2345 6702")), "high");
  const links = linkCase(doc(pay("Account 0000-0011-2345-6702, Standard Chartered")), "high");
  assert.equal(links.length, 1);
  assert.equal(links[0].kind, "account");
});

test("current case is excluded, earlier cases come most recent first", () => {
  const x = doc({ phones: ["+92 333 1234567"] });
  linkCase(x, "low", new Date("2026-01-01"), "doc-a");
  linkCase(x, "high", new Date("2026-02-01"), "doc-b");
  // Re-checking doc-b must not list doc-b itself.
  const links = linkCase(x, "high", new Date("2026-03-01"), "doc-b");
  assert.deepEqual(links[0].cases.map((c) => c.checked_at), ["2026-01-01T00:00:00.000Z"]);
  const fresh = linkCase(x, "medium", new Date("2026-04-01"), "doc-c");
  assert.deepEqual(
    fresh[0].cases.map((c) => c.checked_at),
    ["2026-03-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"],
  );
});

test("store keys are hashes, not raw identifiers", () => {
  linkCase(doc({ issuer_emails: ["admissions.westbridge@gmail.com"], phones: ["+92 301 4567890"] }), "high");
  assert.equal(store.size, 2);
  for (const [key, cases] of store) {
    assert.match(key, /^[0-9a-f]{64}$/);
    assert.doesNotMatch(JSON.stringify(cases), /gmail|4567890/);
  }
});

test("store is capped and evicts the oldest identifier", () => {
  for (let i = 0; i <= MAX_KEYS; i++) linkCase(doc({ phones: [`+92 300 ${String(i).padStart(7, "0")}`] }), "low");
  assert.equal(store.size, MAX_KEYS);
  assert.deepEqual(linkCase(doc({ phones: ["+92 300 0000000"] }), "low"), []); // evicted
  assert.equal(linkCase(doc({ phones: [`+92 300 ${String(MAX_KEYS).padStart(7, "0")}`] }), "low").length, 1);
});
