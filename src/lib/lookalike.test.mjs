// Run with: pnpm test. Look-alike domains: deterministic, and silent when domains match or are unrelated.
import assert from "node:assert/strict";
import { test } from "node:test";
import { contactLookalikes, domainOf, lookalikeFindings, lookalikeKind, registerFindings } from "./checks.ts";

test("one or two letter typos are look-alikes", () => {
  assert.equal(lookalikeKind("manchestr.ac.uk", "manchester.ac.uk"), "typo");
  assert.equal(lookalikeKind("rnanchester.ac.uk", "manchester.ac.uk"), "typo");
  assert.equal(lookalikeKind("monasb.edu", "monash.edu"), "typo");
});

test("the official name inside another domain is a look-alike", () => {
  assert.equal(lookalikeKind("manchester-admissions.com", "manchester.ac.uk"), "embedded");
  assert.equal(lookalikeKind("flinders-uni.com", "flinders.edu.au"), "embedded");
  assert.equal(lookalikeKind("unimelb-offers.org", "unimelb.edu.au"), "embedded");
});

test("the same name under a different ending is a look-alike", () => {
  assert.equal(lookalikeKind("manchester.com", "manchester.ac.uk"), "tld");
  assert.equal(lookalikeKind("ucl.com", "ucl.ac.uk"), "tld");
});

test("never fires when the domains match", () => {
  assert.equal(lookalikeKind("manchester.ac.uk", "manchester.ac.uk"), null);
  assert.equal(lookalikeKind(domainOf("admissions@pgr.manchester.ac.uk"), domainOf("https://www.manchester.ac.uk/study/")), null);
});

test("never fires for unrelated domains, including similar short names", () => {
  for (const [d, o] of [
    ["flywire.com", "manchester.ac.uk"],
    ["gov.uk", "manchester.ac.uk"],
    ["oxford.ac.uk", "manchester.ac.uk"],
    ["uclan.ac.uk", "ucl.ac.uk"],
    ["sussex.ac.uk", "essex.ac.uk"],
    ["leeds.ac.uk", "keele.ac.uk"],
    ["mq.edu.au", "uq.edu.au"],
    ["", "manchester.ac.uk"],
  ]) {
    assert.equal(lookalikeKind(d, o), null, `${d} vs ${o}`);
  }
});

const doc = (over = {}) => ({
  doc_type: "university_offer", issuer_name: "Flinders University", issuer_country: "Australia", issuer_website: "",
  recipient_name: "", issue_date: "", programme_or_position: "", amounts: [],
  payment: { method: "", payee_name: "", account_details: "" }, issuer_emails: [], phones: [], urls: [],
  reference_numbers: [], signatory: { name: "", title: "" }, agent_or_intermediary: "",
  pressure_tactics: [], embedded_instructions: [], inconsistencies: [], ...over,
});

test("a look-alike in the document is a red flag quoting both domains", () => {
  const x = doc({ issuer_website: "WWW.Flinders-Uni.com", issuer_emails: ["intl@flinders.edu.au", "offers@gmail.com"] });
  const f = lookalikeFindings(x, ["http://www.flinders.edu.au/"], ["https://data.gov.au/data/dataset/cricos"]);
  assert.equal(f.length, 1);
  assert.equal(f[0].status, "red_flag");
  assert.equal(f[0].severity, "high");
  assert.equal(f[0].code, "lookalike_domain");
  assert.deepEqual(f[0].params, { domain: "flinders-uni.com", official: "flinders.edu.au", kind: "embedded" });
  // Evidence is the domain exactly as the document wrote it.
  assert.deepEqual(f[0].evidence, ["Flinders-Uni.com"]);
  assert.deepEqual(f[0].sources, ["https://data.gov.au/data/dataset/cricos"]);
});

test("only a different ending is a medium flag", () => {
  const [f] = lookalikeFindings(doc({ issuer_emails: ["intl@flinders.com"] }), ["flinders.edu.au"], []);
  assert.equal(f.severity, "medium");
  assert.equal(f.params.kind, "tld");
});

test("matching, free and unrelated domains give nothing", () => {
  const x = doc({ issuer_website: "www.flinders.edu.au", issuer_emails: ["a@flinders.edu.au", "b@gmail.com"], urls: ["https://www.gov.uk/student-visa"] });
  assert.deepEqual(lookalikeFindings(x, ["https://www.flinders.edu.au/"], []), []);
  assert.deepEqual(lookalikeFindings(x, [], []), []);
  assert.deepEqual(lookalikeFindings(doc({ issuer_website: "flinders-uni.com" }), ["someone@gmail.com"], []), []);
});

test("the research contact is used, and a domain the register already flagged is not repeated", () => {
  const x = doc({ issuer_website: "flinders-uni.com", urls: ["https://flinderz.edu.au/pay"] });
  const contact = { name: "", email: "international@flinders.edu.au", phone: "", url: "https://www.flinders.edu.au/international/contact" };
  assert.deepEqual(contactLookalikes(x, null, []), []);
  const fromContact = contactLookalikes(x, contact, []);
  assert.deepEqual(fromContact.map((f) => f.params.domain), ["flinders-uni.com", "flinderz.edu.au"]);
  assert.deepEqual(fromContact[0].sources, [contact.url]);
  assert.deepEqual(contactLookalikes(x, contact, [fromContact[0]]).map((f) => f.params.domain), ["flinderz.edu.au"]);
});

test("register check: a look-alike replaces the generic 'differs' finding for that domain", () => {
  const reg = { label: "Australia's CRICOS register", codeKind: "cricos", codeName: "CRICOS code", url: "https://data.gov.au/data/dataset/cricos",
    entries: [{ code: "00114A", name: "Flinders University", aliases: [], website: "http://www.flinders.edu.au/" }] };
  const f = registerFindings(doc({ issuer_website: "flinders-admissions.com", issuer_emails: ["x@other-college.com"] }), reg, true);
  assert.deepEqual(f.map((x) => x.code), ["register_listed", "register_website_differs", "lookalike_domain"]);
  assert.equal(f[1].params.domains, "other-college.com");
  assert.equal(f[2].params.domain, "flinders-admissions.com");
});
