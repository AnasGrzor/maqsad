import { PDFDocument } from "pdf-lib";
import { getDomain, getDomainWithoutSuffix } from "tldts";
import type { Extraction, Finding, FindingCode, Judgement } from "./schema";

// Rule-based checks. The final risk level comes from scoring.ts, never from an LLM's
// opinion, so text injected into a document cannot talk its way to "low risk".
export { mergeFindings, riskLevel } from "./scoring.ts";

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

type Params = NonNullable<Finding["params"]>;

// Evidence must be text read from the document: empty values are dropped and nothing is rewritten.
function withEvidence(f: Finding, evidence: string[]): Finding {
  const quotes = [...new Set(evidence.filter((q) => q.trim()))];
  return quotes.length ? { ...f, evidence: quotes } : f;
}

function rule(
  title: string,
  detail: string,
  severity: Finding["severity"],
  topic: Finding["topic"],
  code: FindingCode,
  params: Params = {},
  evidence: string[] = [],
): Finding {
  return withEvidence({ title, detail, severity, status: "red_flag", topic, sources: [], origin: "rules", code, params }, evidence);
}

export function domainOf(emailOrUrl: string) {
  const host = emailOrUrl.includes("@") ? emailOrUrl.split("@").pop()! : emailOrUrl;
  return getDomain(host.trim().toLowerCase()) ?? "";
}

// The domain exactly as the document wrote it (case kept), or "" if it can't be found in the text.
function quoteDomain(raw: string, domain: string) {
  const at = raw.toLowerCase().lastIndexOf(domain);
  return domain && at >= 0 ? raw.slice(at, at + domain.length) : "";
}

export function ruleChecks(x: Extraction): Finding[] {
  const out: Finding[] = [];
  const paymentFields = [x.payment.method, x.payment.account_details, x.payment.payee_name];

  if (PERSONAL_CHANNELS.test(paymentFields.join(" "))) {
    out.push(rule(
      "Payment through a personal or untraceable channel",
      `Payment is requested via "${x.payment.method || x.payment.account_details}". Universities and licensed employers take fees into an account in their own name, not JazzCash, Easypaisa, money transfer services or crypto.`,
      "high",
      "payment_channel",
      "payment_channel",
      {},
      paymentFields.filter((v) => PERSONAL_CHANNELS.test(v)),
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
        "payee_mismatch",
        { issuer: x.issuer_name },
        [payee],
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
      "free_email",
      {},
      freeEmails,
    ));
  }

  const site = domainOf(x.issuer_website);
  const otherEmails = x.issuer_emails.filter((e) => {
    const d = domainOf(e);
    return d && d !== site && !FREE_EMAIL.has(d);
  });
  const otherDomains = [...new Set(otherEmails.map(domainOf))];
  if (site && otherDomains.length) {
    out.push(rule(
      "Email domain differs from the website",
      `The website is ${site} but emails come from ${otherDomains.join(", ")}. Lookalike domains are a common trick.`,
      "medium",
      "sender_email",
      "email_domain_mismatch",
      { site, domains: otherDomains.join(", ") },
      otherEmails.map((e) => quoteDomain(e, domainOf(e))),
    ));
  }

  for (const ref of x.reference_numbers) {
    const fmt = REF_FORMATS[ref.kind];
    const value = ref.value.replace(/[\s-]/g, "").toUpperCase();
    if (fmt && !fmt[0].test(value)) {
      out.push(rule(
        `${ref.kind.toUpperCase()} number has the wrong format`,
        `"${ref.value}". ${fmt[1]}.`,
        "medium",
        "reference_number",
        "ref_format",
        { kind: ref.kind },
        [ref.value],
      ));
    }
  }

  if (x.pressure_tactics.length) {
    out.push(rule(
      "Pressure to act fast",
      x.pressure_tactics.map((q) => `"${q}"`).join(" "),
      "medium",
      "pressure",
      "pressure",
      {},
      x.pressure_tactics,
    ));
  }

  if (x.embedded_instructions.length) {
    out.push(rule(
      "Hidden instructions aimed at checking tools",
      `The document contains text that tries to instruct an AI or reviewer: ${x.embedded_instructions.map((q) => `"${q}"`).join(" ")}`,
      "high",
      "embedded_instructions",
      "embedded_instructions",
      {},
      x.embedded_instructions,
    ));
  }

  // The model describes contradictions in its own words, so they are not quoted as evidence.
  if (x.inconsistencies.length) {
    out.push(rule("The document contradicts itself", x.inconsistencies.join(" "), "medium", "inconsistency", "inconsistency"));
  }

  if (x.doc_type === "job_offer" && (x.payment.method || x.amounts.length)) {
    out.push(rule(
      "Job offer asks for money",
      "Fees for visas, tickets or 'processing' before you start are the most common overseas job scam. Licensed promoters may only charge the fee set by the Bureau of Emigration, against a receipt.",
      "medium",
      "upfront_fee",
      "job_fee",
    ));
  }

  // Payment instructions only: amounts alone may be a stipend.
  if (x.doc_type === "internship" && (x.payment.method || x.payment.account_details)) {
    out.push(rule(
      "Internship asks for money",
      "Real internships do not charge registration, training or security fees. Asking interns to pay up front is a common scam, including fake ads in the name of government bodies.",
      "high",
      "upfront_fee",
      "internship_fee",
    ));
  }

  return out;
}

// Checks that can fail (a register is down, a quota is used up). A failure is reported as
// "could not be verified", never as a red flag. Blocking failures also make the report "incomplete"
// (the route passes allChecksRan = false); non-blocking ones, like PKCERT, don't.
export const CHECK_NAMES = {
  rules: "Rule checks",
  pdf: "PDF metadata check",
  domain_age: "Domain age check",
  ukvi: "UK sponsor register check",
  dli: "Canadian DLI list check",
  cricos: "Australian CRICOS register check",
  pkcert: "PKCERT fake notification check",
  web_research: "Web research",
  summary: "The written report",
} as const;
export type CheckName = keyof typeof CHECK_NAMES;

export function checkFailed(check: CheckName, blocking = true): Finding {
  return {
    title: `${CHECK_NAMES[check]} could not run`,
    detail: blocking
      ? "This part of the report could not be verified, so the result can't be \"no red flags found\". Try again later."
      : "This source could not be reached, so this could not be verified. It does not change the risk level.",
    severity: "low",
    status: "unverified",
    topic: "other",
    sources: [],
    origin: "rules",
    code: blocking ? "check_failed" : "source_unavailable",
    params: { check },
  };
}

// Levenshtein distance, for spotting one- or two-letter typos in domains.
function editDistance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// How a domain resembles an official one without being it, or null when it is the same domain or
// unrelated. Both are registrable domains (domainOf). Short names need an exact match, so "ucl"
// never matches "uclan" and unrelated short names don't collide.
export function lookalikeKind(domain: string, official: string): "typo" | "embedded" | "tld" | null {
  if (!domain || !official || domain === official) return null;
  const name = getDomainWithoutSuffix(domain) ?? "";
  const officialName = getDomainWithoutSuffix(official) ?? "";
  if (!name || !officialName) return null;
  if (name === officialName) return "tld";
  if (officialName.length >= 4 && name.replace(/[^a-z0-9]/g, "").includes(officialName.replace(/[^a-z0-9]/g, ""))) return "embedded";
  const typos = officialName.length >= 8 ? 2 : officialName.length >= 5 ? 1 : 0;
  if (typos && (editDistance(name, officialName) <= typos || editDistance(domain, official) <= typos)) return "typo";
  return null;
}

// Document domains (website, emails, links) that resemble a known official domain but differ.
// `officials` are official websites or emails (a register entry, or the contact found by research).
export function lookalikeFindings(
  x: Extraction,
  officials: string[],
  sources: string[],
): Finding[] {
  const known = [...new Set(officials.map(domainOf))].filter((d) => d && !FREE_EMAIL.has(d));
  if (!known.length) return [];
  const raw = [x.issuer_website, ...x.issuer_emails, ...x.urls];
  const out: Finding[] = [];
  for (const domain of new Set(raw.map(domainOf))) {
    if (!domain || FREE_EMAIL.has(domain) || known.includes(domain)) continue;
    for (const official of known) {
      const kind = lookalikeKind(domain, official);
      if (!kind) continue;
      out.push(withEvidence({
        title: "Domain looks like the official one but is different",
        detail: `The document uses ${domain}, which resembles the official domain ${official} but is not it. Scammers register look-alike domains to seem official.`,
        severity: kind === "tld" ? "medium" : "high",
        status: "red_flag",
        topic: "contact_details",
        sources,
        origin: "rules",
        code: "lookalike_domain",
        params: { domain, official, kind },
      }, raw.map((r) => (domainOf(r) === domain ? quoteDomain(r, domain) : ""))));
      break;
    }
  }
  return out;
}

// The official contact comes from web research. Skips domains a register check already flagged.
export function contactLookalikes(x: Extraction, contact: { url: string; email: string } | null | undefined, already: Finding[]) {
  if (!contact) return [];
  const flagged = new Set(already.filter((f) => f.code === "lookalike_domain").map((f) => f.params?.domain));
  return lookalikeFindings(x, [contact.url, contact.email], contact.url ? [contact.url] : []).filter(
    (f) => !flagged.has(f.params?.domain),
  );
}

// The judge model should copy the official contact from the research notes, but it can invent one,
// and the verify email is sent to it. Keep it only when its page is in the notes and its email,
// if any, is on that page's domain.
export function officialContact(contact: Judgement["official_contact"] | null | undefined, notes: string) {
  const site = contact?.url ? domainOf(contact.url) : "";
  if (!contact || !site || !notes.includes(contact.url)) return null;
  if (contact.email.trim() && domainOf(contact.email) !== site) return null;
  return contact;
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
      "pdf_editor",
      { tool },
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
      "pdf_modified",
      { created: created.toISOString().slice(0, 10), modified: modified.toISOString().slice(0, 10) },
    ));
  }
  return out;
}

// RDAP is the open replacement for WHOIS. Some country domains (.ac.uk, .pk) give no registration
// date; those, and RDAP outages, are reported as "could not be verified" without changing the risk.
export function domainAgeUnavailable(domain: string): Finding {
  return {
    title: "Domain age could not be verified",
    detail: `RDAP returned no registration date for ${domain}, so its age could not be checked.`,
    severity: "low", status: "unverified", topic: "domain_age", sources: [], origin: "rules",
    code: "domain_age_unavailable", params: { domain },
  };
}

export async function domainAgeChecks(domains: string[]): Promise<Finding[]> {
  const unique = [...new Set(domains.filter((d) => d && !FREE_EMAIL.has(d)))].slice(0, 3);
  const results = await Promise.all(
    unique.map(async (d): Promise<Finding | null> => {
      const res = await fetch(`https://rdap.org/domain/${d}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
      if (!res?.ok) return domainAgeUnavailable(d);
      const data = (await res.json()) as { events?: { eventAction: string; eventDate: string }[] };
      const reg = data.events?.find((e) => e.eventAction === "registration")?.eventDate;
      if (!reg) return domainAgeUnavailable(d);
      const days = (Date.now() - new Date(reg).getTime()) / 86_400_000;
      if (days >= 365) return null;
      return {
        ...rule(
          "Website or email domain is very new",
          `${d} was registered on ${reg.slice(0, 10)}, ${Math.round(days)} days ago. Established institutions have had their domain for years.`,
          "high",
          "domain_age",
          "domain_new",
          { domain: d, date: reg.slice(0, 10), days: Math.round(days) },
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

// A register that is down often answers with an HTML error page. Parsing and caching that would
// make every issuer "not found" for a day, so a bad status or an empty list throws instead.
async function fetchOk(url: string, ms: number) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res;
}

function nonEmpty<T>(list: T[], what: string) {
  if (!list.length) throw new Error(`${what} is empty`);
  return list;
}

async function ukviSponsors() {
  if (ukviCache && Date.now() - ukviCache.at < 86_400_000) return ukviCache;
  const meta = (await (await fetchOk(UKVI_API, 8000)).json()) as {
    details: { attachments: { content_type: string; url: string }[] };
  };
  const url = meta.details.attachments.find((a) => a.content_type === "text/csv")!.url;
  const csv = await (await fetchOk(url, 15000)).text();
  // Only the first column (sponsor name) is needed; it may be quoted and contain commas.
  const names = csv.split("\n").slice(1).map((line) => {
    const m = line.match(/^"([^"]*)"|^([^,]*)/);
    return (m?.[1] ?? m?.[2] ?? "").trim();
  }).filter(Boolean);
  ukviCache = { at: Date.now(), names: nonEmpty([...new Set(names)], "UKVI register"), url };
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
      code: "ukvi_listed", params: { listed: match },
    }];
  }
  return [{
    title: "Not found on the UK student sponsor register under this name",
    detail: `No sponsor named "${x.issuer_name}" is on today's UKVI register. Only listed sponsors can issue a CAS for a UK student visa. Search the register yourself in case the letter uses a short or different name.`,
    severity: "medium", status: "red_flag", topic: "sponsor_register", sources: [url], origin: "registry",
    code: "ukvi_not_found", params: { issuer: x.issuer_name },
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
    code: FindingCode,
    params: Params,
    evidence: string[] = [],
  ): Finding => withEvidence(
    { title, detail, severity, status, topic, sources: [reg.url], origin: "registry", code, params: { register: reg.codeKind, ...params } },
    evidence,
  );

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
        "register_code_missing", { code: ref.value }, [ref.value],
      ));
    } else if (!sameOrg(e)) {
      out.push(finding(
        `${reg.codeName} ${ref.value} belongs to a different institution`,
        `${reg.label} lists ${ref.value} as "${e.name}", not "${x.issuer_name}". Scammers copy real numbers from other institutions.`,
        "high", "red_flag", "reference_number",
        "register_code_other", { code: ref.value, listed: e.name, issuer: x.issuer_name }, [ref.value],
      ));
    } else {
      found = e;
      out.push(finding(
        `${reg.codeName} ${ref.value} matches ${e.name}`,
        `${reg.label} lists this number for "${e.name}". This confirms the institution exists, not that this letter is real.`,
        "low", "verified", "sponsor_register",
        "register_code_match", { code: ref.value, listed: e.name }, [ref.value],
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
        "register_listed", { listed: found.name },
      )
      : finding(
        `Not found on ${reg.label} under this name`,
        `No institution named "${x.issuer_name}" is on it. Search it yourself in case the letter uses a short or different name.`,
        "medium", "red_flag", "sponsor_register",
        "register_not_found", { issuer: x.issuer_name },
      ));
  }

  const official = found?.website ? domainOf(found.website) : "";
  if (found && official) {
    // A domain that resembles the registered one gets its own, stronger finding instead.
    const lookalikes = lookalikeFindings(x, [found.website], [reg.url]);
    const flagged = new Set(lookalikes.map((f) => f.params?.domain));
    const used = [...new Set([x.issuer_website, ...x.issuer_emails].map(domainOf))].filter(
      (d) => d && d !== official && !FREE_EMAIL.has(d) && !flagged.has(d),
    );
    if (used.length) {
      out.push(finding(
        "Website or email differs from the registered website",
        `${reg.label} gives ${official} as the website of "${found.name}", but the document uses ${used.join(", ")}.`,
        "medium", "red_flag", "contact_details",
        "register_website_differs", { official, listed: found.name, domains: used.join(", ") },
      ));
    }
    out.push(...lookalikes.map((f) => ({ ...f, origin: "registry" as const })));
  }
  return out;
}

// IRCC's DLI list page loads this JSON. It covers post-secondary institutions; all primary and
// secondary schools are DLIs but are not listed.
const DLI_PAGE = "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/prepare/designated-learning-institutions-list.html";
const DLI_JSON = "https://www.canada.ca/content/dam/ircc/documents/json/dli/dli-full-list.json";
const dliList = daily(async (): Promise<Listed[]> => {
  const { data } = (await (await fetchOk(DLI_JSON, 15000)).json()) as { data: Record<string, string>[] };
  return nonEmpty(data, "DLI list").map((r) => ({
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
  const csv = await (await fetchOk(CRICOS_CSV, 15000)).text();
  // Columns: provider code, trading name, institution name, type, capacity, website, ...
  const rows = csv.replace(/^﻿/, "").split(/\r?\n/).slice(1).filter(Boolean);
  return nonEmpty(rows, "CRICOS register").map(csvRow).map((c) => ({
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
  nonEmpty(parsePkcert(await (await fetchOk(PKCERT_PAGE, 15000)).text()), "PKCERT list"),
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
      code: "pkcert_match",
      params: { notice: n.title, date: n.date || "none", match: shared.length ? "shared" : "subject", shared: [...new Set(shared)].join(", ") },
    }];
  });
}

export async function pkcertCheck(x: Extraction): Promise<Finding[]> {
  return pkcertFindings(x, await pkcertList());
}
