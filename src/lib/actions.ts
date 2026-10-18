import type { Report } from "./schema";

export type Exposure = "bank_transfer" | "wallet" | "card" | "password" | "cnic" | "passport" | "transcripts";

export const EXPOSURES: { id: Exposure; label: string }[] = [
  { id: "bank_transfer", label: "I paid by bank transfer" },
  { id: "wallet", label: "I paid by JazzCash or Easypaisa" },
  { id: "card", label: "I shared bank account or card details" },
  { id: "password", label: "I shared a password or OTP code" },
  { id: "cnic", label: "I shared my CNIC" },
  { id: "passport", label: "I shared my passport" },
  { id: "transcripts", label: "I shared my transcripts or degree" },
];

export type Step = { title: string; detail: string; urls: string[] };

export type ActionPlan = {
  steps: Step[];
  complaint: string;
  verifyEmail: { to: string; subject: string; body: string } | null;
};

// Helplines and URLs checked in October 2026. NCCIA's site sits behind a bot challenge, so only its 1799 line is given.
const STEPS: { when: (s: Set<Exposure>, r: Report) => boolean; step: Step }[] = [
  {
    when: (s) => s.size > 0,
    step: {
      title: "Stop: don't send any more money or documents",
      detail:
        "Scammers often ask for a second \"release\", \"visa\" or \"refund\" fee. Stop replying, and don't pay anyone who offers to get your money back.",
      urls: [],
    },
  },
  {
    when: (s) => s.has("card") || s.has("bank_transfer"),
    step: {
      title: "Call your bank now",
      detail:
        "Use the number on the back of your card or on your bank's own website, not one from the document. Ask them to block the card or online banking, try to recall any transfer, and log a fraud complaint. Write down the complaint number.",
      urls: [],
    },
  },
  {
    when: (s) => s.has("wallet"),
    step: {
      title: "Call JazzCash or Easypaisa now",
      detail:
        "JazzCash: 4444 from a Jazz SIM, or 051-111-124-444. Easypaisa: 3737, or 042-111-003737. Report the transaction as fraud, give the receiving number and transaction ID, and ask them to hold the account that received it. Write down the complaint number.",
      urls: ["https://www.jazzcash.com.pk/", "https://easypaisa.com.pk/"],
    },
  },
  {
    when: (s) => s.has("password"),
    step: {
      title: "Change your passwords",
      detail:
        "From a device you trust, change the password you shared and any account that uses the same one, sign out other devices and turn on two-step verification. If you shared an OTP, call the bank or wallet that sent it: someone may be logging in or approving a payment.",
      urls: [],
    },
  },
  {
    when: (s) => s.has("cnic"),
    step: {
      title: "Check SIMs registered on your CNIC",
      detail:
        "Send your CNIC number without dashes to 668, or check cnic.sims.pk. Ask the mobile operator to remove any SIM you don't recognise, and watch for loans or accounts opened in your name.",
      urls: ["https://cnic.sims.pk/"],
    },
  },
  {
    when: (s) => s.has("passport"),
    step: {
      title: "Protect your passport",
      detail:
        "If you handed over the passport itself and can't get it back, get a police report and follow DGI&P's lost passport process (helpline 051-111-344-777). If you only sent a copy, keep your cybercrime complaint number in case it is misused.",
      urls: ["https://www.dgip.gov.pk/passport/ordinary-passport.php#lostpassport"],
    },
  },
  {
    when: (s) => s.has("transcripts"),
    step: {
      title: "Tell your university",
      detail:
        "Let your university's registrar or examinations office know a copy of your degree or transcript went to a suspicious party, so they can watch for verification requests in your name.",
      urls: [],
    },
  },
  {
    when: (s) => s.size > 0,
    step: {
      title: "Report it to the National Cyber Crime Investigation Agency",
      detail:
        "Call the NCCIA helpline 1799 or visit your nearest NCCIA circle office. Bring the complaint below, screenshots of the messages and any payment receipts. Keep the reference number: your bank will ask for it.",
      urls: [],
    },
  },
  {
    when: (s) => s.has("bank_transfer") || s.has("wallet") || s.has("card"),
    step: {
      title: "Escalate if your bank or wallet doesn't help",
      detail:
        "If they don't resolve your complaint, file it on the State Bank of Pakistan's Sunwai portal, and after that with the Banking Mohtasib.",
      urls: ["https://sunwai.sbp.org.pk/", "https://www.bankingmohtasib.gov.pk/"],
    },
  },
  {
    when: (s, r) => s.size > 0 && r.extraction.phones.length > 0,
    step: {
      title: "Report the scammer's number to PTA",
      detail: "Use PTA's complaint system or call 0800-55055 so the number can be checked and blocked.",
      urls: ["https://complaint.pta.gov.pk/userlogin.aspx"],
    },
  },
];

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export function actionPlan(report: Report, shared: Exposure[]): ActionPlan {
  const s = new Set(shared);
  const x = report.extraction;
  const issuer = x.issuer_name || "an unknown sender";
  const docType = x.doc_type.replace(/_/g, " ");
  const flags = report.findings.filter((f) => f.status === "red_flag").map((f) => `- ${f.title}`);
  const refs = x.reference_numbers.map((r) => `${r.kind.toUpperCase()} ${r.value}`).join(", ");
  const field = (k: string, v: string) => (v ? `${k}: ${v}` : null);
  // Missing fields drop out; collapse the blank lines they leave behind.
  const text = (lines: (string | null)[]) => lines.filter((l) => l !== null).join("\n").replace(/\n{3,}/g, "\n\n");

  const complaint = text([
    `Subject: Complaint about suspected fraud using the name of ${issuer}`,
    "",
    `I received a ${docType} in the name of ${issuer}${x.issue_date ? `, dated ${x.issue_date}` : ""}. I believe it is fraudulent.`,
    shared.length ? `What happened: ${EXPOSURES.filter((e) => s.has(e.id)).map((e) => e.label).join("; ")}.` : null,
    "",
    "Details from the document:",
    field("Amounts requested", x.amounts.map((a) => `${a.label}: ${a.amount} ${a.currency}`.trim()).join("; ")),
    field("Payment method", x.payment.method),
    field("Payee (account holder)", x.payment.payee_name),
    field("Account details", x.payment.account_details),
    field("Emails used", x.issuer_emails.join(", ")),
    field("Phone numbers used", x.phones.join(", ")),
    field("Website", x.issuer_website),
    field("Links", x.urls.join(", ")),
    field("Reference numbers", refs),
    field("Agent or intermediary", x.agent_or_intermediary),
    ...(flags.length ? ["", "Warning signs found:", ...flags] : []),
    "",
    "Attached: the document, screenshots of the messages and any payment receipts.",
    "",
    "Name: [your name]",
    "CNIC: [your CNIC]",
    "Phone: [your phone number]",
  ]);

  // Only the contact found on the official website; contacts printed in the document may belong to the scammer.
  const to = report.official_contact?.email.trim() ?? "";
  const verifyEmail = isEmail(to)
    ? {
        to,
        subject: `Please confirm: is this ${docType} from ${x.issuer_name || "you"} genuine?`,
        body: text([
          "Hello,",
          "",
          `I received a ${docType} that says it is from ${x.issuer_name || "your institution"}. Before I take any further step, could you please confirm whether it is genuine?`,
          "",
          field("Name on the document", x.recipient_name),
          field("Programme or position", x.programme_or_position),
          field("Issue date", x.issue_date),
          field("Reference numbers", refs),
          field("Sent from", [...x.issuer_emails, ...x.phones].join(", ")),
          field("Payment requested to", [x.payment.payee_name, x.payment.account_details].filter(Boolean).join(", ")),
          "",
          "I can send you a copy of the document if that helps.",
          "",
          "Thank you,",
          "[your name]",
        ]),
      }
    : null;

  return { steps: STEPS.filter((e) => e.when(s, report)).map((e) => e.step), complaint, verifyEmail };
}
