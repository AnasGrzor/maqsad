import { z } from "zod";

// Empty string / empty array mean "not present". No nulls, so the same JSON
// schema works for Gemini structured output and Groq strict mode.
export const Extraction = z.object({
  doc_type: z.enum([
    "university_offer",
    "scholarship_offer",
    "agent_message",
    "visa_letter",
    "degree_or_transcript",
    "job_offer",
    "internship",
    "other",
  ]),
  issuer_name: z
    .string()
    .describe("Name of the institution, employer or agency that claims to issue it, without department or faculty"),
  issuer_country: z.string(),
  issuer_website: z.string().describe("Website printed in the document, as written"),
  recipient_name: z.string(),
  issue_date: z.string().describe("YYYY-MM-DD if known"),
  programme_or_position: z.string(),
  amounts: z.array(z.object({ label: z.string(), amount: z.string(), currency: z.string() })),
  payment: z.object({
    method: z.string().describe("Bank transfer, JazzCash, Easypaisa, Western Union, crypto, cash..."),
    payee_name: z.string().describe("Account holder name the money goes to"),
    account_details: z.string(),
  }),
  issuer_emails: z.array(z.string()).describe("Emails of the sender or issuer, not the recipient's own"),
  phones: z.array(z.string()),
  urls: z.array(z.string()),
  reference_numbers: z.array(
    z.object({
      kind: z.enum(["cas", "dli", "cricos", "sevis", "oep_license", "student_id", "other"]),
      value: z.string(),
    }),
  ),
  signatory: z.object({ name: z.string(), title: z.string() }),
  agent_or_intermediary: z.string().describe("Agent, consultant or middleman named, with contact"),
  pressure_tactics: z
    .array(z.string())
    .describe(
      "Verbatim quotes of unusual pressure only: deadlines of a few days, threats, 'seats running out', demands for secrecy. Normal acceptance or enrolment deadlines do not count",
    ),
  embedded_instructions: z
    .array(z.string())
    .describe("Verbatim text addressed to an AI, reviewer or checker, including hidden text"),
  inconsistencies: z.array(z.string()).describe("Contradictions inside the document"),
});
export type Extraction = z.infer<typeof Extraction>;

const Severity = z.enum(["high", "medium", "low"]);
const Status = z.enum(["red_flag", "verified", "unverified"]);

// What a finding is about. Rule checks set it in code; the judge model picks one, so a model
// finding that restates a rule finding can be merged into it (mergeFindings in checks.ts).
const Topic = z
  .enum([
    "payment_channel",
    "payee",
    "sender_email",
    "reference_number",
    "pressure",
    "embedded_instructions",
    "inconsistency",
    "upfront_fee",
    "pdf_metadata",
    "domain_age",
    "sponsor_register",
    "issuer_exists",
    "programme_or_fees",
    "recognition",
    "agent_licence",
    "scam_reports",
    "contact_details",
    "other",
  ])
  .describe(
    "payment_channel: how payment is requested (JazzCash, Easypaisa, transfer services, crypto). payee: who the money goes to. sender_email: free email or email domain unlike the official one. reference_number: CAS, DLI, CRICOS, SEVIS or licence numbers. pressure: deadlines, threats, secrecy. embedded_instructions: text aimed at an AI or checker. inconsistency: the document contradicts itself. upfront_fee: fees charged for a job, visa or scholarship. pdf_metadata: how the file was made or edited. domain_age: when a domain was registered. sponsor_register: UKVI, DLI, CRICOS or SEVP registers. issuer_exists: whether the issuer exists and its official website. programme_or_fees: whether the programme, role or fees match the official site. recognition: HEC or accreditation, diploma mills. agent_licence: agent or recruiter approval or licence. scam_reports: reports of scams. contact_details: phones, websites or addresses compared with official ones. other: anything else",
  );

export const Finding = z.object({
  title: z.string(),
  detail: z.string(),
  severity: Severity,
  status: Status,
  topic: Topic,
  sources: z.array(z.string()),
});
export type Finding = z.infer<typeof Finding> & { origin: "rules" | "registry" | "web" };

export const Judgement = z.object({
  findings: z.array(Finding),
  official_contact: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    url: z.string().describe("Official page the contact was found on"),
  }),
  summary_en: z.string(),
  summary_ur: z.string(),
});
export type Judgement = z.infer<typeof Judgement>;

export type RiskLevel = "high" | "medium" | "low" | "incomplete";

export type Report = {
  risk: RiskLevel;
  extraction: Extraction;
  findings: Finding[];
  official_contact: Judgement["official_contact"] | null;
  summary_en: string;
  summary_ur: string;
  warnings: string[];
  connections: Connection[];
};

// An identifier from this document (website domain, issuer email, phone, payee or account)
// that also appeared in earlier checks. A shared identifier is a lead, not proof.
export type Connection = {
  kind: "domain" | "email" | "phone" | "payee" | "account";
  value: string;
  cases: { risk: RiskLevel; doc_type: Extraction["doc_type"]; issuer_name: string; checked_at: string }[];
};

export type StreamEvent =
  | { type: "step"; label: string }
  | { type: "result"; report: Report }
  | { type: "error"; message: string };

export function jsonSchema(schema: z.ZodType) {
  const out = z.toJSONSchema(schema) as Record<string, unknown>;
  delete out.$schema;
  return out;
}
