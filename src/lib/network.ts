import { createHash } from "node:crypto";
import { getDomain } from "tldts";
import type { Connection, Extraction, RiskLevel } from "./schema";

// Links identifiers that repeat across separately submitted checks. Informational only: anyone
// can submit a fake letter quoting a real university's phone, so a match must never add a red
// flag or change the risk level.

type Kind = Connection["kind"];
type Case = { id: string; meta: Connection["cases"][number] };

// Domains unrelated senders share: free email (same list as FREE_EMAIL in checks.ts) plus social and link hosts.
const SHARED_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com", "outlook.com",
  "live.com", "msn.com", "icloud.com", "aol.com", "proton.me", "protonmail.com",
  "yandex.com", "mail.ru", "gmx.com", "zoho.com",
  "google.com", "facebook.com", "instagram.com", "linkedin.com", "whatsapp.com", "wa.me", "bit.ly", "linktr.ee",
]);

// Processors and wallets that many unrelated payees are paid through.
const SHARED_PAYEES =
  /flywire|convera|paymytuition|transfermate|cibc|easytransfer|peertransfer|jazz\s*cash|easy\s*paisa|western\s*union|money\s*gram/i;

// shortcut: per server instance, lost on restart; use a shared store (e.g. Postgres/Redis from the Vercel Marketplace) if traffic grows.
// Keyed by SHA-256 of "kind:value" so other people's emails, phones and accounts are never kept, only case metadata.
export const store = new Map<string, Case[]>();
export const MAX_KEYS = 5000;
const MAX_CASES = 5;

const hash = (kind: Kind, value: string) => createHash("sha256").update(`${kind}:${value}`).digest("hex");
const cleanName = (s: string) => s.toLowerCase().replace(/[\s.,'"()-]+/g, " ").trim();

// +92 301 4567890, 0092 301 4567890, 0301 4567890 and +92 (0)301 4567890 all become 923014567890.
export function normalisePhone(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "92" + d.slice(1); // national format: assume Pakistan
  if (d.startsWith("920")) d = "92" + d.slice(3);
  return d;
}

// [kind, normalised key, value as written in this document]
export function identifiers(x: Extraction): [Kind, string, string][] {
  const out = new Map<string, [Kind, string, string]>();
  const add = (kind: Kind, key: string, value: string) => {
    if (key && !out.has(`${kind}:${key}`)) out.set(`${kind}:${key}`, [kind, key, value]);
  };

  for (const s of [x.issuer_website, ...x.urls, ...x.issuer_emails]) {
    const host = s.includes("@") ? s.split("@").pop()! : s;
    // allowPrivateDomains keeps someone.blogspot.com apart from every other blogspot site.
    const d = getDomain(host.trim().toLowerCase(), { allowPrivateDomains: true }) ?? "";
    if (!SHARED_DOMAINS.has(d)) add("domain", d, d);
  }
  for (const e of x.issuer_emails) {
    const a = e.trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) add("email", a, a);
  }
  for (const p of x.phones) {
    const d = normalisePhone(p);
    if (d.length >= 7) add("phone", d, p.trim());
  }
  const payee = cleanName(x.payment.payee_name);
  if (payee.length >= 3 && payee !== cleanName(x.recipient_name) && !SHARED_PAYEES.test(payee)) {
    add("payee", payee, x.payment.payee_name.trim());
  }
  // Each run of 8+ digits (spaces and dashes allowed) is an account; an IBAN yields its account number.
  for (const run of x.payment.account_details.match(/\d[\d\s-]{6,}\d/g) ?? []) {
    const d = run.replace(/\D/g, "");
    if (d.length >= 8) add("account", d, run.trim());
  }
  return [...out.values()];
}

// Returns earlier cases sharing an identifier with this document (most recent first), then records
// this one. caseId (e.g. the document hash) stops a re-check of the same document matching itself.
export function linkCase(x: Extraction, risk: RiskLevel, now = new Date(), caseId = ""): Connection[] {
  const current: Case = {
    id: caseId,
    meta: { risk, doc_type: x.doc_type, issuer_name: x.issuer_name, checked_at: now.toISOString() },
  };
  const out: Connection[] = [];
  for (const [kind, key, value] of identifiers(x)) {
    const h = hash(kind, key);
    const earlier = (store.get(h) ?? []).filter((c) => !caseId || c.id !== caseId);
    if (earlier.length) out.push({ kind, value, cases: earlier.map((c) => c.meta) });
    store.delete(h); // re-insert so eviction drops the least recently seen identifier
    if (store.size >= MAX_KEYS) store.delete(store.keys().next().value!);
    store.set(h, [current, ...earlier].slice(0, MAX_CASES));
  }
  return out;
}
