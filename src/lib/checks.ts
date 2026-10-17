import { PDFDocument } from "pdf-lib";
import { getDomain } from "tldts";
import type { Extraction, Finding, RiskLevel } from "./schema";

// Rule-based checks. The final risk level comes from here, never from an LLM's
// opinion, so text injected into a document cannot talk its way to "low risk".

const PERSONAL_CHANNELS =
  /jazz\s*cash|easy\s*paisa|sada\s*pay|naya\s*pay|western\s*union|money\s*gram|\bria\b|crypto|bitcoin|usdt|binance|hawala|hundi|personal account/i;

// Licensed payment processors universities really use; payee name won't match the institution.
const PAYMENT_PROCESSORS = /flywire|convera|paymytuition|transfermate|cibc|easytransfer|peertransfer/i;

const FREE_EMAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com", "outlook.com",
  "live.com", "msn.com", "icloud.com", "aol.com", "proton.me", "protonmail.com",
  "yandex.com", "mail.ru", "gmx.com", "zoho.com",
]);

const ONLINE_EDITORS = /ilovepdf|smallpdf|sejda|pdfescape|pdf24|canva|photoshop|gimp|pdffiller|dochub|sodapdf|pdfelement/i;

const REF_FORMATS: Partial<Record<Extraction["reference_numbers"][number]["kind"], [RegExp, string]>> = {
  cas: [/^[A-Z0-9]{14}$/, "A UK CAS number has 14 letters and digits"],
  dli: [/^O\d{11,13}$/, "A Canadian DLI number is the letter O followed by 11 to 13 digits"],
  cricos: [/^\d{5}[A-Z]$/, "A CRICOS provider code is 5 digits and a letter"],
  sevis: [/^N\d{10}$/, "A US SEVIS ID is N followed by 10 digits"],
};

const FILLER = new Set(["the", "of", "and", "for", "ltd", "limited", "inc", "llc", "pvt", "plc"]);
const GENERIC = new Set([
  "university", "college", "institute", "school", "private", "group", "international",
  "education", "academy", "campus",
]);

// Words that make up an organisation's name, e.g. "The University of Oxford" -> university, oxford.
function nameWords(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !FILLER.has(t));
}

// Only the words that tell organisations apart, e.g. "oxford".
function distinctiveWords(name: string) {
  return nameWords(name).filter((t) => !GENERIC.has(t));
}

function rule(title: string, detail: string, severity: Finding["severity"], topic: Finding["topic"]): Finding {
  return { title, detail, severity, status: "red_flag", topic, sources: [], origin: "rules" };
}

export function domainOf(emailOrUrl: string) {
  const host = emailOrUrl.includes("@") ? emailOrUrl.split("@").pop()! : emailOrUrl;
  return getDomain(host.trim().toLowerCase()) ?? "";
}

export function ruleChecks(x: Extraction): Finding[] {
  const out: Finding[] = [];
  const paymentText = `${x.payment.method} ${x.payment.account_details} ${x.payment.payee_name}`;

  if (PERSONAL_CHANNELS.test(paymentText)) {
    out.push(rule(
      "Payment through a personal or untraceable channel",
      `Payment is requested via "${x.payment.method || x.payment.account_details}". Universities and licensed employers take fees into an account in their own name, not JazzCash, Easypaisa, money transfer services or crypto.`,
      "high",
      "payment_channel",
    ));
  }

  const issuerTokens = distinctiveWords(x.issuer_name);
  const payee = x.payment.payee_name;
  if (payee && issuerTokens.length && !PAYMENT_PROCESSORS.test(payee)) {
    const payeeTokens = new Set(distinctiveWords(payee));
    if (!issuerTokens.some((t) => payeeTokens.has(t))) {
      out.push(rule(
        "Money goes to someone other than the issuer",
        `The document is from "${x.issuer_name}" but asks you to pay "${payee}".`,
        "high",
        "payee",
      ));
    }
  }

  const freeEmails = x.issuer_emails.filter((e) => FREE_EMAIL.has(domainOf(e)));
  if (freeEmails.length) {
    out.push(rule(
      "Uses a free email address",
      `${freeEmails.join(", ")}. Real universities, embassies and employers write from their own domain.`,
      x.doc_type === "agent_message" ? "medium" : "high",
      "sender_email",
    ));
  }

  const site = domainOf(x.issuer_website);
  const otherDomains = [...new Set(x.issuer_emails.map(domainOf))].filter(
    (d) => d && d !== site && !FREE_EMAIL.has(d),
  );
  if (site && otherDomains.length) {
    out.push(rule(
      "Email domain differs from the website",
      `The website is ${site} but emails come from ${otherDomains.join(", ")}. Lookalike domains are a common trick.`,
      "medium",
      "sender_email",
    ));
  }

  for (const ref of x.reference_numbers) {
    const fmt = REF_FORMATS[ref.kind];
    const value = ref.value.replace(/[\s-]/g, "").toUpperCase();
    if (fmt && !fmt[0].test(value)) {
      out.push(rule(`${ref.kind.toUpperCase()} number has the wrong format`, `"${ref.value}". ${fmt[1]}.`, "medium", "reference_number"));
    }
  }

  if (x.pressure_tactics.length) {
    out.push(rule("Pressure to act fast", x.pressure_tactics.map((q) => `"${q}"`).join(" "), "medium", "pressure"));
  }

  if (x.embedded_instructions.length) {
    out.push(rule(
      "Hidden instructions aimed at checking tools",
      `The document contains text that tries to instruct an AI or reviewer: ${x.embedded_instructions.map((q) => `"${q}"`).join(" ")}`,
      "high",
      "embedded_instructions",
    ));
  }

  if (x.inconsistencies.length) {
    out.push(rule("The document contradicts itself", x.inconsistencies.join(" "), "medium", "inconsistency"));
  }

  if (x.doc_type === "job_offer" && (x.payment.method || x.amounts.length)) {
    out.push(rule(
      "Job offer asks for money",
      "Fees for visas, tickets or 'processing' before you start are the most common overseas job scam. Licensed promoters may only charge the fee set by the Bureau of Emigration, against a receipt.",
      "medium",
      "upfront_fee",
    ));
  }

  // Payment instructions only: amounts alone may be a stipend.
  if (x.doc_type === "internship" && (x.payment.method || x.payment.account_details)) {
    out.push(rule(
      "Internship asks for money",
      "Real internships do not charge registration, training or security fees. Asking interns to pay up front is a common scam, including fake ads in the name of government bodies.",
      "high",
      "upfront_fee",
    ));
  }

  return out;
}

// "low" needs every check to have run and at least one fact confirmed by an official
// source; otherwise a document that was barely checked would look safe.
export function riskLevel(findings: Finding[], allChecksRan: boolean): RiskLevel {
  const flags = findings.filter((f) => f.status === "red_flag");
  if (flags.some((f) => f.severity === "high")) return "high";
  if (flags.some((f) => f.severity === "medium")) return "medium";
  if (!allChecksRan || !findings.some((f) => f.status === "verified")) return "incomplete";
  return "low";
}

const SEVERITY_RANK = { low: 0, medium: 1, high: 2 } as const;

// The judge model often restates rule findings despite being told not to. A web finding on
// the same topic and status as an earlier finding is folded into it: the earlier wording stays,
// its sources are added, and the higher severity wins so merging can never lower the risk.
export function mergeFindings(findings: Finding[]): Finding[] {
  const out: Finding[] = [];
  for (const f of findings) {
    const same =
      f.origin === "web" && f.topic !== "other"
        ? out.find((o) => o.topic === f.topic && o.status === f.status)
        : undefined;
    if (!same) {
      out.push({ ...f });
      continue;
    }
    same.sources = [...new Set([...same.sources, ...f.sources])];
    if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[same.severity]) same.severity = f.severity;
  }
  return out;
}

export async function pdfMetadataCheck(bytes: Uint8Array): Promise<Finding[]> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const tool = `${pdf.getProducer() ?? ""} ${pdf.getCreator() ?? ""}`.trim();
  const out: Finding[] = [];
  if (ONLINE_EDITORS.test(tool)) {
    out.push(rule(
      "PDF was made or edited with a consumer editing tool",
      `The file says it was produced by "${tool}". Official letters are usually generated by the institution's own system.`,
      "medium",
      "pdf_metadata",
    ));
  }
  const created = pdf.getCreationDate();
  const modified = pdf.getModificationDate();
  if (created && modified && modified.getTime() - created.getTime() > 86_400_000) {
    out.push(rule(
      "PDF was changed after it was created",
      `Created ${created.toISOString().slice(0, 10)}, modified ${modified.toISOString().slice(0, 10)}. Not proof of fraud, but worth confirming with the issuer.`,
      "low",
      "pdf_metadata",
    ));
  }
  return out;
}

// RDAP is the open replacement for WHOIS. Some country domains don't answer; those are skipped.
export async function domainAgeChecks(domains: string[]): Promise<Finding[]> {
  const unique = [...new Set(domains.filter((d) => d && !FREE_EMAIL.has(d)))].slice(0, 3);
  const results = await Promise.all(
    unique.map(async (d): Promise<Finding | null> => {
      const res = await fetch(`https://rdap.org/domain/${d}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
      if (!res?.ok) return null;
      const data = (await res.json()) as { events?: { eventAction: string; eventDate: string }[] };
      const reg = data.events?.find((e) => e.eventAction === "registration")?.eventDate;
      if (!reg) return null;
      const days = (Date.now() - new Date(reg).getTime()) / 86_400_000;
      if (days >= 365) return null;
      return {
        ...rule(
          "Website or email domain is very new",
          `${d} was registered on ${reg.slice(0, 10)}, ${Math.round(days)} days ago. Established institutions have had their domain for years.`,
          "high",
          "domain_age",
        ),
        sources: [`https://rdap.org/domain/${d}`],
      };
    }),
  );
  return results.filter((f): f is Finding => f !== null);
}

// UKVI publishes the student sponsor register as a CSV that changes path daily.
const UKVI_API = "https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-students";
let ukviCache: { at: number; names: string[]; url: string } | null = null;

async function ukviSponsors() {
  if (ukviCache && Date.now() - ukviCache.at < 86_400_000) return ukviCache;
  const meta = (await (await fetch(UKVI_API, { signal: AbortSignal.timeout(8000) })).json()) as {
    details: { attachments: { content_type: string; url: string }[] };
  };
  const url = meta.details.attachments.find((a) => a.content_type === "text/csv")!.url;
  const csv = await (await fetch(url, { signal: AbortSignal.timeout(15000) })).text();
  // Only the first column (sponsor name) is needed; it may be quoted and contain commas.
  const names = csv.split("\n").slice(1).map((line) => {
    const m = line.match(/^"([^"]*)"|^([^,]*)/);
    return (m?.[1] ?? m?.[2] ?? "").trim();
  }).filter(Boolean);
  ukviCache = { at: Date.now(), names: [...new Set(names)], url };
  return ukviCache;
}

// Same set of name words in any order: "Oxford University" matches "University of Oxford",
// but "Oxford College" does not match "Oxford International School".
export function matchSponsor(issuer: string, names: string[]) {
  const want = new Set(nameWords(issuer));
  if (!want.size) return undefined;
  return names.find((n) => {
    const have = new Set(nameWords(n));
    return have.size === want.size && [...want].every((t) => have.has(t));
  });
}

function claimsUK(x: Extraction) {
  return /\b(uk|united kingdom|england|scotland|wales|northern ireland|britain)\b/i.test(x.issuer_country) ||
    x.reference_numbers.some((r) => r.kind === "cas");
}

// Only universities and colleges sponsor students; employers, scholarship funders and UKVI itself are not on this list.
export async function ukviCheck(x: Extraction): Promise<Finding[]> {
  if (!x.issuer_name || x.doc_type !== "university_offer" || !claimsUK(x)) return [];
  const { names, url } = await ukviSponsors();
  const match = matchSponsor(x.issuer_name, names);
  if (match) {
    return [{
      title: "Listed on the UK student sponsor register",
      detail: `UKVI lists "${match}". This confirms the institution exists and can sponsor students. It does not confirm this letter is real.`,
      severity: "low", status: "verified", topic: "sponsor_register", sources: [url], origin: "registry",
    }];
  }
  return [{
    title: "Not found on the UK student sponsor register under this name",
    detail: `No sponsor named "${x.issuer_name}" is on today's UKVI register. Only listed sponsors can issue a CAS for a UK student visa. Search the register yourself in case the letter uses a short or different name.`,
    severity: "medium", status: "red_flag", topic: "sponsor_register", sources: [url], origin: "registry",
  }];
}

// Registers change rarely, so each server instance downloads them at most once a day.
// The promise is cached, so concurrent checks share one download; a failed one is retried next time.
function daily<T>(load: () => Promise<T>) {
  let cache: { at: number; value: Promise<T> } | null = null;
  return () => {
    if (!cache || Date.now() - cache.at > 86_400_000) {
      const value = load();
      cache = { at: Date.now(), value };
      value.catch(() => {
        if (cache?.value === value) cache = null;
      });
    }
    return cache.value;
  };
}

// One CSV line. Fields may be quoted and contain commas or doubled quotes.
export function csvRow(line: string) {
  return [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g)].map((m) =>
    m[1] !== undefined ? m[1].replace(/""/g, '"') : m[2],
  );
}

export type Listed = { code: string; name: string; aliases: string[]; website: string };

// Registers add abbreviations or a second language to names: "University of British Columbia (UBC)",
// "Université d'Ottawa/University of Ottawa". Match each part as well as the whole.
const nameVariants = (n: string) =>
  [n, ...n.replace(/\s*\([^)]*\)/g, "").split("/")].map((s) => s.trim()).filter(Boolean);

type Register = {
  label: string;
  codeKind: "dli" | "cricos";
  codeName: string;
  url: string;
  entries: Listed[];
};

// Checks the register numbers a document quotes (they must exist and belong to the issuer), falls back
// to the issuer's name when asked, and compares the document's domains with the registered website.
export function registerFindings(x: Extraction, reg: Register, lookupByName: boolean): Finding[] {
  const out: Finding[] = [];
  const finding = (
    title: string,
    detail: string,
    severity: Finding["severity"],
    status: Finding["status"],
    topic: Finding["topic"],
  ): Finding => ({ title, detail, severity, status, topic, sources: [reg.url], origin: "registry" });

  const byCode = new Map<string, Listed>();
  for (const e of reg.entries) if (!byCode.has(e.code)) byCode.set(e.code, e);
  const issuerWords = distinctiveWords(x.issuer_name);
  const sameOrg = (e: Listed) =>
    !issuerWords.length || [e.name, ...e.aliases].some((n) => distinctiveWords(n).some((w) => issuerWords.includes(w)));

  let found: Listed | undefined;
  for (const ref of x.reference_numbers.filter((r) => r.kind === reg.codeKind)) {
    const code = ref.value.replace(/[\s-]/g, "").toUpperCase();
    // A badly formatted number is already flagged by ruleChecks.
    if (!REF_FORMATS[reg.codeKind]![0].test(code)) continue;
    const e = byCode.get(code);
    if (!e) {
      out.push(finding(
        `${reg.codeName} ${ref.value} is not on the register`,
        `${reg.label} has no institution with this number. Scammers often invent or alter these numbers.`,
        "medium", "red_flag", "reference_number",
      ));
    } else if (!sameOrg(e)) {
      out.push(finding(
        `${reg.codeName} ${ref.value} belongs to a different institution`,
        `${reg.label} lists ${ref.value} as "${e.name}", not "${x.issuer_name}". Scammers copy real numbers from other institutions.`,
        "high", "red_flag", "reference_number",
      ));
    } else {
      found = e;
      out.push(finding(
        `${reg.codeName} ${ref.value} matches ${e.name}`,
        `${reg.label} lists this number for "${e.name}". This confirms the institution exists, not that this letter is real.`,
        "low", "verified", "sponsor_register",
      ));
    }
  }

  if (!out.length && lookupByName) {
    found = reg.entries.find((e) => matchSponsor(x.issuer_name, [e.name, ...e.aliases].flatMap(nameVariants)));
    out.push(found
      ? finding(
        `Listed on ${reg.label}`,
        `It lists "${found.name}". This confirms the institution exists and can enrol international students. It does not confirm this letter is real.`,
        "low", "verified", "sponsor_register",
      )
      : finding(
        `Not found on ${reg.label} under this name`,
        `No institution named "${x.issuer_name}" is on it. Search it yourself in case the letter uses a short or different name.`,
        "medium", "red_flag", "sponsor_register",
      ));
  }

  const official = found?.website ? domainOf(found.website) : "";
  if (found && official) {
    const used = [...new Set([x.issuer_website, ...x.issuer_emails].map(domainOf))].filter(
      (d) => d && d !== official && !FREE_EMAIL.has(d),
    );
    if (used.length) {
      out.push(finding(
        "Website or email differs from the registered website",
        `${reg.label} gives ${official} as the website of "${found.name}", but the document uses ${used.join(", ")}.`,
        "medium", "red_flag", "contact_details",
      ));
    }
  }
  return out;
}

// IRCC's DLI list page loads this JSON. It covers post-secondary institutions; all primary and
// secondary schools are DLIs but are not listed.
const DLI_PAGE = "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/prepare/designated-learning-institutions-list.html";
const DLI_JSON = "https://www.canada.ca/content/dam/ircc/documents/json/dli/dli-full-list.json";
const dliList = daily(async (): Promise<Listed[]> => {
  const res = await fetch(DLI_JSON, { signal: AbortSignal.timeout(15000) });
  const { data } = (await res.json()) as { data: Record<string, string>[] };
  return data.map((r) => ({
    code: String(r["DLI #"] ?? "").trim().toUpperCase(),
    name: String(r.Institution ?? "").trim(),
    aliases: [],
    website: "",
  }));
});

// The Department of Education publishes CRICOS daily on data.gov.au, including each provider's website.
const CRICOS_PAGE = "https://data.gov.au/data/dataset/cricos";
const CRICOS_CSV = "https://data.gov.au/data/dataset/e5ae7059-bfa8-4fa4-a5c0-c13cf3520193/resource/7f6941f3-5327-4db7-b556-5f16d77f63c1/download/cricos-institutions.csv";
const cricosList = daily(async (): Promise<Listed[]> => {
  const csv = await (await fetch(CRICOS_CSV, { signal: AbortSignal.timeout(15000) })).text();
  // Columns: provider code, trading name, institution name, type, capacity, website, ...
  return csv.replace(/^﻿/, "").split(/\r?\n/).slice(1).filter(Boolean).map(csvRow).map((c) => ({
    code: c[0].trim().toUpperCase(),
    name: c[2]?.trim() ?? "",
    aliases: c[1]?.trim() ? [c[1].trim()] : [],
    website: c[5]?.trim() ?? "",
  }));
});

const claimsCanada = (x: Extraction) => /\bcanada\b/i.test(x.issuer_country);
const claimsAustralia = (x: Extraction) => /\baustralia\b/i.test(x.issuer_country);

// A quoted register number is checked whatever the document type; a name lookup only makes sense for offers.
export async function dliCheck(x: Extraction): Promise<Finding[]> {
  const byName = !!x.issuer_name && x.doc_type === "university_offer" && claimsCanada(x);
  if (!byName && !x.reference_numbers.some((r) => r.kind === "dli")) return [];
  const entries = await dliList();
  return registerFindings(x, {
    label: "Canada's designated learning institutions list", codeKind: "dli", codeName: "DLI number", url: DLI_PAGE, entries,
  }, byName);
}

export async function cricosCheck(x: Extraction): Promise<Finding[]> {
  const byName = !!x.issuer_name && x.doc_type === "university_offer" && claimsAustralia(x);
  if (!byName && !x.reference_numbers.some((r) => r.kind === "cricos")) return [];
  const entries = await cricosList();
  return registerFindings(x, {
    label: "Australia's CRICOS register", codeKind: "cricos", codeName: "CRICOS code", url: CRICOS_PAGE, entries,
  }, byName);
}

// National CERT lists notices it has declared fake. Each card is an image link, a date and a short
// subject ("PTA Notification", "Closure of ATM's"); the notice itself is only in the image.
const PKCERT_PAGE = "https://pkcert.gov.pk/fake-notifications.asp";
export type FakeNotice = { url: string; date: string; title: string };

export function parsePkcert(html: string): FakeNotice[] {
  return [...html.matchAll(/class="\s*card-2\s*">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, url, inner]) => ({
    url,
    date: inner.match(/\(([^)]+)\)/)?.[1] ?? "",
    title: (inner.split(/<br\s*\/?>/i)[1] ?? "").replace(/<[^>]+>|\|\s*click here.*$/gi, "").replace(/&amp;/g, "&").trim(),
  }));
}

const pkcertList = daily(async () =>
  parsePkcert(await (await fetch(PKCERT_PAGE, { signal: AbortSignal.timeout(15000) })).text()),
);

const phoneDigits = (p: string) => p.replace(/\D/g, "").slice(-10);

// Only a shared identifier or the same subject counts. PKCERT notices name the real body they
// impersonate, so a name-only match would flag genuine HEC or ministry letters; it gives nothing.
export function pkcertFindings(x: Extraction, notices: FakeNotice[]): Finding[] {
  const domains = new Set([x.issuer_website, ...x.issuer_emails, ...x.urls].map(domainOf).filter((d) => d && !FREE_EMAIL.has(d)));
  const phones = new Set(x.phones.map(phoneDigits).filter((p) => p.length === 10));
  const subject = new Set(nameWords(x.programme_or_position));
  return notices.flatMap((n): Finding[] => {
    const shared = [
      ...(n.title.match(/[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []).map(domainOf).filter((d) => domains.has(d)),
      ...(n.title.match(/\+?[\d][\d\s-]{8,}\d/g) ?? []).map(phoneDigits).filter((p) => phones.has(p)),
    ];
    const words = nameWords(n.title);
    // Two words at least, so a one-word subject can't match by chance.
    const sameSubject = words.length >= 2 && words.length === subject.size && words.every((w) => subject.has(w));
    if (!shared.length && !sameSubject) return [];
    return [{
      title: "Matches a notice National CERT (PKCERT) has declared fake",
      detail: `PKCERT recorded a fake notice "${n.title}"${n.date ? ` on ${n.date}` : ""}. ${shared.length ? `It shares ${[...new Set(shared)].join(", ")} with this document.` : "This document has the same subject."} Compare the two before acting on it.`,
      severity: "high", status: "red_flag", topic: "scam_reports", sources: [n.url], origin: "registry",
    }];
  });
}

export async function pkcertCheck(x: Extraction): Promise<Finding[]> {
  return pkcertFindings(x, await pkcertList());
}
