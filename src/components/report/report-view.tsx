"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import type { Extraction, Finding, Report } from "@/lib/schema";
import { explainRisk } from "@/lib/scoring";
import { ActionPlan } from "./action-plan";
import { Alternatives } from "./alternatives";
import { Connections } from "./connections";

// The report UI, shared by the checker (/check) and saved reports (/student/reports/[id]).

type Severity = Finding["severity"];

const RISK = {
  high: { tone: "bg-risk-high-bg text-risk-high ring-1 ring-risk-high/15", mark: "!", markTone: "bg-risk-high text-on-primary" },
  medium: { tone: "bg-risk-med-bg text-risk-med ring-1 ring-risk-med/15", mark: "!", markTone: "bg-risk-med text-on-primary" },
  low: { tone: "bg-risk-low-bg text-risk-low ring-1 ring-risk-low/15", mark: "✓", markTone: "bg-risk-low text-on-primary" },
  incomplete: { tone: "bg-risk-inc-bg text-risk-inc ring-1 ring-risk-inc/15", mark: "?", markTone: "bg-risk-inc text-on-primary" },
} as const;

const SEVERITY_CHIP: Record<Severity, string> = {
  high: "bg-risk-high-bg text-risk-high",
  medium: "bg-risk-med-bg text-risk-med",
  low: "bg-risk-inc-bg text-risk-inc",
};
const SEVERITY_ORDER: Severity[] = ["high", "medium", "low"];

export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

// stored: a saved report, which keeps no extraction, so the "what we read" panel is replaced by a note.
export function ReportView({ report, stored = false }: { report: Report; stored?: boolean }) {
  const t = useTranslations("checker");
  const v = useTranslations("reportView");
  const scoring = useTranslations("reportScoring");
  const locale = useLocale();
  const heading = useRef<HTMLHeadingElement>(null);
  // Move focus to the verdict so keyboard and screen-reader users land on it.
  useEffect(() => heading.current?.focus(), []);

  const risk = RISK[report.risk];
  const flags = report.findings.filter((f) => f.status === "red_flag");
  const bySeverity = SEVERITY_ORDER.map((s) => [s, flags.filter((f) => f.severity === s)] as const);
  const confirmed = report.findings.filter((f) => f.status === "verified");
  const unchecked = report.findings.filter((f) => f.status === "unverified");
  const why = explainRisk(report.risk, report.findings);

  return (
    <div className="mt-6 grid items-start gap-8 motion-safe:animate-rise lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
      <section aria-label={t("report")} className="min-w-0 space-y-8">
        <div className={`rounded-2xl p-5 sm:p-6 ${risk.tone}`}>
          <div className="flex gap-4">
            <span
              aria-hidden
              className={`grid size-10 shrink-0 place-items-center rounded-full text-lg font-bold ${risk.markTone}`}
            >
              {risk.mark}
            </span>
            <div className="min-w-0">
              <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight focus:outline-none">
                {t(`risk.${report.risk}.title`)}
              </h2>
              <p className="mt-0.5 text-lg font-medium">{t(`risk.${report.risk}.advice`)}</p>
              {report.extraction.issuer_name && (
                <p className="mt-1 text-sm opacity-85">{t("issuedBy", { issuer: report.extraction.issuer_name })}</p>
              )}
            </div>
          </div>

          {(flags.length > 0 || confirmed.length > 0) && (
            <ul aria-label={t("totals")} className="mt-5 flex flex-wrap gap-2 text-sm text-ink">
              {bySeverity.map(([s, items]) =>
                items.length ? (
                  <li key={s} className="inline-flex items-center gap-2 rounded-full bg-card/70 py-1 ps-1 pe-3">
                    <span
                      className={`min-w-6 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums ${SEVERITY_CHIP[s]}`}
                    >
                      {items.length}
                    </span>
                    {t(`severity.${s}.short`)}
                  </li>
                ) : null,
              )}
              {confirmed.length > 0 && (
                <li className="inline-flex items-center gap-2 rounded-full bg-card/70 py-1 ps-1 pe-3">
                  <span className="min-w-6 rounded-full bg-turq-soft px-1.5 text-center text-xs font-semibold tabular-nums">
                    {confirmed.length}
                  </span>
                  {t("confirmedShort")}
                </li>
              )}
            </ul>
          )}

          {/* Computed in code from the findings (src/lib/scoring.ts), never written by a model. */}
          <div className="mt-5 border-t border-current/15 pt-4">
            <h3 className="text-sm font-semibold">{v("whyTitle")}</h3>
            <p className="mt-1 max-w-[68ch] text-pretty">{scoring(why.reason, { count: why.count })}</p>
            {why.cited.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {why.cited.map((f, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-current" />
                    <FindingTitle f={f} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {(report.summary_en || report.summary_ur) && (
          <div className="grid gap-5 rounded-2xl bg-card p-5 ring-1 ring-line sm:p-6">
            {report.summary_en && <p lang="en" dir="ltr" className="max-w-[68ch] leading-relaxed text-pretty">{report.summary_en}</p>}
            {locale !== "en" && <p className="text-sm text-soft">{t("summaryNote")}</p>}
            {report.summary_ur && (
              <p lang="ur" dir="rtl" className="border-t border-line pt-5 font-urdu text-lg leading-[2.4]">
                {report.summary_ur}
              </p>
            )}
          </div>
        )}

        <ActionPlan report={report} />

        {/* On small screens the contact sits above the findings; on wide screens it lives in the sidebar. */}
        <div className="lg:hidden">
          <ContactCard contact={report.official_contact} />
        </div>

        {bySeverity.map(([s, items]) =>
          items.length ? (
            <Group
              key={s}
              title={t(`severity.${s}.label`)}
              count={items.length}
              chip={SEVERITY_CHIP[s]}
              collapsed={s === "low"}
            >
              <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-card ring-1 ring-line">
                {items.map((f, i) => (
                  <FindingRow key={i} f={f} />
                ))}
              </ul>
            </Group>
          ) : null,
        )}

        {confirmed.length > 0 && (
          <Group title={t("confirmedGroup")} count={confirmed.length} chip="bg-turq-soft text-ink">
            <ul className="divide-y divide-turq-soft overflow-hidden rounded-2xl bg-turq-faint ring-1 ring-turq-soft">
              {confirmed.map((f, i) => (
                <FindingRow key={i} f={f} />
              ))}
            </ul>
          </Group>
        )}

        {unchecked.length > 0 && (
          <Group title={v("unverifiedGroup")} count={unchecked.length} chip="bg-line text-ink" collapsed>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-card ring-1 ring-line">
              {unchecked.map((f, i) => (
                <FindingRow key={i} f={f} />
              ))}
            </ul>
          </Group>
        )}

        <Connections connections={report.connections} />
      </section>

      {/* p-1/-m-1 keep the cards' rings from being clipped by the sidebar's own scroll box. */}
      <aside className="-m-1 space-y-6 p-1 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7.5rem)] lg:overflow-x-hidden lg:overflow-y-auto">
        <div className="hidden lg:block">
          <ContactCard contact={report.official_contact} />
        </div>

        <Alternatives report={report} />

        {report.warnings.length > 0 && (
          <div className="rounded-2xl bg-warm-soft p-5 ring-1 ring-warm">
            <h3 className="text-sm font-semibold">{t("notes")}</h3>
            <ul lang="en" dir="ltr" className="mt-2 list-disc space-y-1 ps-5 text-sm text-ink">
              {report.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {stored ? (
          <p className="rounded-2xl bg-card p-5 text-sm text-soft ring-1 ring-line">{v("storedNote")}</p>
        ) : (
          <details className="group rounded-2xl bg-card ring-1 ring-line">
            <summary
              className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 font-medium sm:px-6 [&::-webkit-details-marker]:hidden ${focusRing}`}
            >
              {t("extracted")}
              <Chevron />
            </summary>
            <ExtractionList x={report.extraction} />
          </details>
        )}
      </aside>
    </div>
  );
}

type Loose = ((key: string, values?: Record<string, string | number>) => string) & {
  has: (key: string) => boolean;
  raw: (key: string) => unknown;
};

// Code-made findings are shown from "reportFindings.<code>" in the reader's language. Model-written
// findings, and any message whose parameters are missing (an older saved report), fall back to the
// stored English text. Returns null for the parts that fall back.
function useFindingText(f: Finding) {
  const t = useTranslations("reportFindings") as unknown as Loose;
  const part = (name: "title" | "detail") => {
    const key = `${f.code}.${name}`;
    if (!f.code || !t.has(key)) return null;
    const needed = [...String(t.raw(key)).matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]);
    if (needed.some((p) => f.params?.[p] === undefined)) return null;
    return t(key, f.params);
  };
  return { title: part("title"), detail: part("detail") };
}

const english = { lang: "en", dir: "ltr" } as const;

function FindingTitle({ f }: { f: Finding }) {
  const { title } = useFindingText(f);
  return title === null ? <span {...english}>{f.title}</span> : <span>{title}</span>;
}

function ContactCard({ contact }: { contact: Report["official_contact"] }) {
  const t = useTranslations("checker.contact");
  const hasContact = contact && (contact.email || contact.phone || contact.url);
  return (
    <div className="rounded-2xl bg-tint p-5 ring-1 ring-tint-strong sm:p-6">
      <h3 className="text-lg font-semibold tracking-tight">{t("title")}</h3>
      {hasContact ? (
        <>
          <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
            {contact.name && <Row k={t("office")} v={contact.name} />}
            {contact.email && <Row k={t("email")} v={<Contact scheme="mailto" value={contact.email} />} />}
            {contact.phone && <Row k={t("phone")} v={<Contact scheme="tel" value={contact.phone} />} />}
            {contact.url && <Row k={t("foundOn")} v={<Link href={contact.url} />} />}
          </dl>
          <p className="mt-4 text-sm text-soft">{t("source")}</p>
        </>
      ) : (
        <p className="mt-2 max-w-[68ch] text-soft">
          {t("none")}
        </p>
      )}
    </div>
  );
}

function Group({
  title,
  count,
  chip,
  collapsed = false,
  children,
}: {
  title: string;
  count: number;
  chip: string;
  collapsed?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("checker");
  const label = (
    <span className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
      {title}
      <span className={`min-w-6 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums ${chip}`}>
        {count}
      </span>
    </span>
  );
  if (!collapsed) {
    return (
      <div>
        <h3 className="mb-3">{label}</h3>
        {children}
      </div>
    );
  }
  return (
    <details className="group">
      <summary
        className={`mb-3 flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-lg [&::-webkit-details-marker]:hidden ${focusRing}`}
      >
        <h3>{label}</h3>
        <span className="flex items-center gap-1.5 text-sm text-soft">
          <span className="group-open:hidden">{t("show")}</span>
          <span className="hidden group-open:inline">{t("hide")}</span>
          <Chevron />
        </span>
      </summary>
      {children}
    </details>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const t = useTranslations("checker.origin");
  const v = useTranslations("reportView");
  const { title, detail } = useFindingText(f);
  return (
    <li className="px-4 py-4 sm:px-6">
      <h4 {...(title === null ? english : {})} className="font-medium text-pretty">{title ?? f.title}</h4>
      <p {...(detail === null ? english : {})} className="mt-1 max-w-[68ch] text-sm leading-relaxed text-pretty text-soft">
        {detail ?? f.detail}
      </p>
      {/* Exact text read from the document, so it is shown as written and never translated. */}
      {f.evidence && f.evidence.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-soft">{v("evidence")}</p>
          <ul className="mt-1 space-y-1">
            {f.evidence.map((q) => (
              <li key={q} dir="auto" className="border-s-2 border-line-strong ps-3 text-sm [overflow-wrap:anywhere]">
                <q>{q}</q>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-soft">
        <span className="font-medium">{t(f.origin)}</span>
        {f.sources.map((s) => (
          <Link key={s} href={s} />
        ))}
      </p>
    </li>
  );
}

function ExtractionList({ x }: { x: Extraction }) {
  const t = useTranslations("checker");
  const rows: [string, string][] = (
    [
      [t("fields.docType"), t(`docType.${x.doc_type}`)],
      [t("fields.issuer"), [x.issuer_name, x.issuer_country].filter(Boolean).join(", ")],
      [t("fields.website"), x.issuer_website],
      [t("fields.recipient"), x.recipient_name],
      [t("fields.issueDate"), x.issue_date],
      [t("fields.programme"), x.programme_or_position],
      [t("fields.amounts"), x.amounts.map((a) => `${a.label}: ${a.amount} ${a.currency}`.trim()).join("; ")],
      [t("fields.paymentMethod"), x.payment.method],
      [t("fields.payTo"), x.payment.payee_name],
      [t("fields.account"), x.payment.account_details],
      [t("fields.emails"), x.issuer_emails.join(", ")],
      [t("fields.phones"), x.phones.join(", ")],
      [t("fields.references"), x.reference_numbers.map((r) => `${r.kind.toUpperCase()} ${r.value}`).join(", ")],
      [t("fields.signedBy"), [x.signatory.name, x.signatory.title].filter(Boolean).join(", ")],
      [t("fields.agent"), x.agent_or_intermediary],
      [t("fields.pressure"), x.pressure_tactics.map((q) => `"${q}"`).join(" ")],
      [t("fields.contradictions"), x.inconsistencies.join("; ")],
      [t("fields.aiText"), x.embedded_instructions.map((q) => `"${q}"`).join(" ")],
    ] as [string, string][]
  ).filter(([, v]) => v);

  return (
    <dl className="space-y-3 border-t border-line px-5 py-4 text-sm sm:px-6">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-soft">{k}</dt>
          <dd dir="auto" className="[overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="whitespace-nowrap text-soft">{k}</dt>
      <dd className="mb-2 min-w-0 [overflow-wrap:anywhere] sm:mb-0">{v}</dd>
    </>
  );
}

function Contact({ scheme, value }: { scheme: "mailto" | "tel"; value: string }) {
  // Model output: only link values that look like an email or a phone number.
  const target = scheme === "tel" ? value.replace(/[^\d+]/g, "") : value.trim();
  const valid = scheme === "tel" ? target.replace(/\D/g, "").length >= 6 : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target);
  if (!valid) return <>{value}</>;
  return (
    <a
      href={`${scheme}:${target}`}
      className={`font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-current ${focusRing}`}
    >
      {/* Prefer wrapping a long email after the @ rather than mid-word. */}
      {scheme === "mailto" ? (
        <>
          {target.split("@")[0]}@<wbr />
          {target.split("@")[1]}
        </>
      ) : (
        value
      )}
    </a>
  );
}

function Link({ href }: { href: string }) {
  // Sources come from LLM output; only render real http(s) links.
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return (
    <a
      href={url.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`break-all text-ink underline decoration-line-strong underline-offset-4 hover:decoration-current ${focusRing}`}
    >
      {url.hostname}
    </a>
  );
}

export function Chevron() {
  return (
    <span aria-hidden className="text-soft transition-transform duration-200 group-open:rotate-180">
      ▾
    </span>
  );
}
