import type { Extraction, Finding, Report, RiskLevel } from "./schema";

// What a saved verification report keeps: the result, findings with their sources, summaries, the
// official contact and warnings. Never the document, the pasted text, the extraction or connections.
export type ReportRow = {
  doc_type: Extraction["doc_type"];
  issuer_name: string;
  risk: RiskLevel;
  findings: Finding[];
  summary_en: string;
  summary_ur: string;
  official_contact: Report["official_contact"];
  warnings: string[];
};

const REMOVED = "[removed]";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A phone or account number written another way (0301-4567890, +92 301 4567890): any run of digits,
// spaces and dashes that ends with the same last 7 digits.
const digitsPattern = (s: string) => {
  const digits = s.replace(/\D/g, "");
  return digits.length >= 6 ? `(?:\\+?\\d[\\d\\s-]*)?${digits.slice(-7).split("").join("[\\s-]*")}(?!\\d)` : "";
};

// Personal details read from the document: the recipient's name, the payee, account numbers, phones
// and emails. Exact values and any email address are replaced before a report is stored.
function personalPatterns(x: Extraction): RegExp {
  const values = [x.recipient_name, x.payment.payee_name, x.payment.account_details, ...x.phones, ...x.issuer_emails]
    .map((v) => v.trim())
    .filter((v) => v.length >= 3);
  // Each part of the recipient's name on its own too ("Dear Ayesha"), as a whole word only.
  const nameWords = x.recipient_name.split(/\s+/).filter((w) => /^\p{L}{3,}$/u.test(w));
  const parts = [
    "[^\\s@\"'<>()]+@[^\\s@\"'<>()]+\\.[a-z]{2,}",
    ...values.sort((a, b) => b.length - a.length).map(escape),
    ...nameWords.map((w) => `(?<!\\p{L})${escape(w)}(?!\\p{L})`),
    ...[x.payment.account_details, ...x.phones].map(digitsPattern).filter(Boolean),
  ];
  return new RegExp(parts.join("|"), "giu");
}

function scrub(text: string, pattern: RegExp) {
  return text.replace(pattern, REMOVED);
}

export function toRow(report: Report): ReportRow {
  const p = personalPatterns(report.extraction);
  const s = (t: string) => scrub(t, p);
  return {
    doc_type: report.extraction.doc_type,
    issuer_name: report.extraction.issuer_name.slice(0, 200),
    risk: report.risk,
    findings: report.findings.map((f) => ({
      title: s(f.title),
      detail: s(f.detail),
      severity: f.severity,
      status: f.status,
      topic: f.topic,
      sources: f.sources,
      origin: f.origin,
      ...(f.code ? { code: f.code } : {}),
      ...(f.params
        ? { params: Object.fromEntries(Object.entries(f.params).map(([k, v]) => [k, typeof v === "string" ? s(v) : v])) }
        : {}),
      // A quote that was entirely personal (an email, a phone) is dropped rather than kept as "[removed]".
      ...(f.evidence ? { evidence: f.evidence.map(s).filter((q) => q.replaceAll(REMOVED, "").trim()) } : {}),
    })),
    summary_en: s(report.summary_en).slice(0, 4000),
    summary_ur: s(report.summary_ur).slice(0, 4000),
    // Found on the issuer's official website by research, not copied from the document.
    official_contact: report.official_contact,
    warnings: report.warnings,
  };
}

const EMPTY: Omit<Extraction, "doc_type" | "issuer_name"> = {
  issuer_country: "",
  issuer_website: "",
  recipient_name: "",
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
};

// A saved row back into the shape ReportView renders. The extraction is empty because it was never stored.
export function fromRow(row: ReportRow): Report {
  return {
    risk: row.risk,
    extraction: { ...EMPTY, doc_type: row.doc_type, issuer_name: row.issuer_name },
    findings: row.findings,
    official_contact: row.official_contact,
    summary_en: row.summary_en,
    summary_ur: row.summary_ur,
    warnings: row.warnings,
    connections: [],
  };
}
