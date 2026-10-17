"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { Extraction, Finding, Report, StreamEvent } from "@/lib/schema";
import { ActionPlan } from "./action-plan";
import { Alternatives } from "./alternatives";
import { Connections } from "./connections";

type Mode = "file" | "text";
type Severity = Finding["severity"];

const RISK = {
  high: { tone: "bg-danger-bg text-danger ring-1 ring-danger/15", mark: "!", markTone: "bg-danger text-white" },
  medium: { tone: "bg-lemon text-navy-900", mark: "!", markTone: "bg-navy-900 text-lemon" },
  low: { tone: "bg-mint text-navy-900", mark: "✓", markTone: "bg-navy-900 text-mint" },
  incomplete: { tone: "bg-fog text-navy-900", mark: "?", markTone: "bg-slate text-white" },
} as const;

const SEVERITY_CHIP: Record<Severity, string> = {
  high: "bg-danger text-white",
  medium: "bg-lemon text-navy-900",
  low: "bg-fog text-navy-900",
};
const SEVERITY_ORDER: Severity[] = ["high", "medium", "low"];

const MAX_BYTES = 4 * 1024 * 1024;

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-800";

export function Checker() {
  const t = useTranslations("checker");
  const [mode, setMode] = useState<Mode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [subject, setSubject] = useState("");

  const ready = mode === "file" ? !!file : text.trim().length > 0;

  function pick(f: File | null) {
    const tooBig = !!f && f.size > MAX_BYTES;
    setError(tooBig ? t("tooBig") : "");
    setFile(tooBig ? null : f);
  }

  function reset() {
    setReport(null);
    setSteps([]);
    setError("");
    setFile(null);
    setText("");
    window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError("");
    setReport(null);
    setSteps([]);
    setSubject(mode === "file" && file ? file.name : t("pasted"));

    const body = new FormData();
    if (mode === "file" && file) body.append("file", file);
    if (mode === "text") body.append("text", text);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? t("genericError"));
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const line of lines.filter(Boolean)) {
          const ev = JSON.parse(line) as StreamEvent;
          if (ev.type === "step") setSteps((s) => [...s, ev.label]);
          if (ev.type === "result") setReport(ev.report);
          if (ev.type === "error") setError(ev.message);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
        {report ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-lavender-100 py-3 ps-5 pe-3 ring-1 ring-lavender-200">
              <h1 className="min-w-0 text-sm text-slate">
                {t.rich("reportFor", {
                  subject,
                  b: (chunks) => <span className="font-medium break-all text-navy-900">{chunks}</span>,
                })}
              </h1>
              <button
                type="button"
                onClick={reset}
                className={`min-h-10 rounded-full bg-navy-900 px-4 text-sm font-medium text-ice transition-[background-color,transform] duration-100 hover:bg-navy-800 active:scale-[0.97] ${focusRing}`}
              >
                {t("another")}
              </button>
            </div>
            <ReportView report={report} />
          </>
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
            <div className="min-w-0">
              <h1 className="max-w-[22ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {t("title")}
              </h1>
              <p className="mt-4 max-w-[62ch] text-pretty text-slate sm:text-lg">
                {t("intro")}
              </p>

              <form onSubmit={submit} className="mt-8 rounded-2xl bg-lavender-100 p-4 ring-1 ring-lavender-200 sm:p-6">
                <div
                  role="group"
                  aria-label={t("inputType")}
                  className="relative grid w-full grid-cols-2 rounded-full bg-lavender-200 p-1 sm:w-80"
                >
                  <span
                    aria-hidden
                    className={`absolute inset-y-1 start-1 w-[calc(50%-0.25rem)] rounded-full bg-navy-900 shadow-[0_1px_3px_rgb(22_46_72/0.25)] transition-transform duration-250 ease-out-quart motion-reduce:transition-none ${
                      mode === "text" ? "translate-x-full rtl:-translate-x-full" : ""
                    }`}
                  />
                  {(["file", "text"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={mode === m}
                      onClick={() => setMode(m)}
                      className={`relative min-h-10 rounded-full px-4 text-sm font-medium transition-colors duration-200 ${focusRing} ${
                        mode === m ? "text-ice" : "text-navy-800 hover:text-navy-900"
                      }`}
                    >
                      {m === "file" ? t("modeFile") : t("modeText")}
                    </button>
                  ))}
                </div>

                {mode === "file" ? (
                  file ? (
                    <div className="mt-5 flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-lavender-200">
                      <span
                        aria-hidden
                        className="grid size-11 shrink-0 place-items-center rounded-lg bg-lavender-100 text-[11px] font-semibold tracking-wide text-navy-800"
                      >
                        {file.type === "application/pdf" ? "PDF" : "IMG"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{file.name}</p>
                        <p className="text-sm text-slate">
                          {file.size < 1024 * 1024
                            ? t("kb", { n: Math.max(1, Math.round(file.size / 1024)) })
                            : t("mb", { n: (file.size / 1024 / 1024).toFixed(1) })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => pick(null)}
                        disabled={running}
                        className={`min-h-10 rounded-full px-3 text-sm font-medium text-slate transition-colors hover:bg-lavender-100 hover:text-navy-900 disabled:opacity-50 ${focusRing}`}
                      >
                        {t("remove")}
                      </button>
                    </div>
                  ) : (
                    <label
                      onDragEnter={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        pick(e.dataTransfer.files[0] ?? null);
                      }}
                      className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-12 text-center transition-colors duration-200 has-[:focus-visible]:border-navy-800 ${
                        dragging
                          ? "border-navy-800 bg-mint-soft"
                          : "border-mist bg-card hover:border-slate hover:bg-lavender-50"
                      }`}
                    >
                      <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(e) => pick(e.target.files?.[0] ?? null)}
                      />
                      <span className="font-medium">
                        {dragging ? t("drop") : t("choose")}
                      </span>
                      <span className="mt-1 text-sm text-slate">{t("fileHint")}</span>
                    </label>
                  )
                ) : (
                  <label className="mt-5 block">
                    <span className="sr-only">{t("messageLabel")}</span>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={8}
                      maxLength={20000}
                      placeholder={t("messagePlaceholder")}
                      className="block w-full resize-y rounded-xl border border-mist bg-card p-4 leading-relaxed placeholder:text-slate focus:border-navy-800 focus:ring-1 focus:ring-navy-800 focus:outline-none"
                    />
                  </label>
                )}

                <div className="mt-5 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate sm:max-w-[40ch]">
                    {t("privacy")}
                  </p>
                  <button
                    type="submit"
                    disabled={!ready || running}
                    aria-busy={running}
                    className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-navy-900 px-6 font-medium text-ice transition-[background-color,transform] duration-100 hover:bg-navy-800 active:scale-[0.97] disabled:active:scale-100 ${
                      running ? "cursor-progress" : "disabled:cursor-not-allowed disabled:opacity-45"
                    } ${focusRing}`}
                  >
                    {running && <Spinner />}
                    {running ? t("checking") : t("submit")}
                  </button>
                </div>
              </form>

              {error && (
                <p
                  role="alert"
                  className="mt-6 rounded-xl bg-danger-bg p-4 text-danger ring-1 ring-danger/15 motion-safe:animate-rise"
                >
                  {error}
                </p>
              )}
            </div>

            <aside className="lg:sticky lg:top-6">
              {running ? (
                <section
                  aria-label={t("progress")}
                  className="rounded-2xl bg-card p-5 ring-1 ring-fog motion-safe:animate-rise sm:p-6"
                >
                  <h2 className="font-semibold">{t("progressTitle")}</h2>
                  <p className="mt-1 text-sm text-slate">{t("progressHint")}</p>
                  <ol aria-live="polite" className="mt-4 space-y-3">
                    {(steps.length ? steps : [t("starting")]).map((s, i, all) => {
                      const current = i === all.length - 1;
                      return (
                        <li key={s} className="flex items-center gap-3 text-sm">
                          {current ? (
                            <Spinner className="text-slate" />
                          ) : (
                            <span
                              aria-hidden
                              className="grid size-4 place-items-center rounded-full bg-mint text-[10px] text-navy-800"
                            >
                              ✓
                            </span>
                          )}
                          <span dir="auto" className={current ? "font-medium" : "text-slate"}>{s}</span>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ) : (
                <WhatWeCheck />
              )}
            </aside>
          </div>
        )}
    </div>
  );
}

function ReportView({ report }: { report: Report }) {
  const t = useTranslations("checker");
  const locale = useLocale();
  const heading = useRef<HTMLHeadingElement>(null);
  // Move focus to the verdict so keyboard and screen-reader users land on it.
  useEffect(() => heading.current?.focus(), []);

  const risk = RISK[report.risk];
  const flags = report.findings.filter((f) => f.status === "red_flag");
  const bySeverity = SEVERITY_ORDER.map((s) => [s, flags.filter((f) => f.severity === s)] as const);
  const confirmed = report.findings.filter((f) => f.status === "verified");
  const unchecked = report.findings.filter((f) => f.status === "unverified");
  const reasons = bySeverity.flatMap(([, items]) => items).slice(0, 3);

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
            <ul aria-label={t("totals")} className="mt-5 flex flex-wrap gap-2 text-sm text-navy-900">
              {bySeverity.map(([s, items]) =>
                items.length ? (
                  <li key={s} className="inline-flex items-center gap-2 rounded-full bg-white/70 py-1 ps-1 pe-3">
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
                <li className="inline-flex items-center gap-2 rounded-full bg-white/70 py-1 ps-1 pe-3">
                  <span className="min-w-6 rounded-full bg-mint px-1.5 text-center text-xs font-semibold tabular-nums">
                    {confirmed.length}
                  </span>
                  {t("confirmedShort")}
                </li>
              )}
            </ul>
          )}

          {reasons.length > 0 && (
            <div className="mt-5 border-t border-current/15 pt-4">
              <h3 className="text-sm font-semibold">{t("mainReasons")}</h3>
              <ul lang="en" dir="ltr" className="mt-2 space-y-1.5">
                {reasons.map((f, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-current" />
                    {f.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {(report.summary_en || report.summary_ur) && (
          <div className="grid gap-5 rounded-2xl bg-card p-5 ring-1 ring-fog sm:p-6">
            {report.summary_en && <p lang="en" dir="ltr" className="max-w-[68ch] leading-relaxed text-pretty">{report.summary_en}</p>}
            {locale !== "en" && <p className="text-sm text-slate">{t("summaryNote")}</p>}
            {report.summary_ur && (
              <p lang="ur" dir="rtl" className="border-t border-fog pt-5 font-urdu text-lg leading-[2.4]">
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
              <ul className="divide-y divide-fog overflow-hidden rounded-2xl bg-card ring-1 ring-fog">
                {items.map((f, i) => (
                  <FindingRow key={i} f={f} />
                ))}
              </ul>
            </Group>
          ) : null,
        )}

        {confirmed.length > 0 && (
          <Group title={t("confirmedGroup")} count={confirmed.length} chip="bg-mint text-navy-900">
            <ul className="divide-y divide-mint overflow-hidden rounded-2xl bg-mint-soft ring-1 ring-mint">
              {confirmed.map((f, i) => (
                <FindingRow key={i} f={f} />
              ))}
            </ul>
          </Group>
        )}

        {unchecked.length > 0 && (
          <Group title={t("uncheckedGroup")} count={unchecked.length} chip="bg-fog text-navy-900" collapsed>
            <ul className="divide-y divide-fog overflow-hidden rounded-2xl bg-card ring-1 ring-fog">
              {unchecked.map((f, i) => (
                <FindingRow key={i} f={f} />
              ))}
            </ul>
          </Group>
        )}

        <Connections connections={report.connections} />
      </section>

      {/* p-1/-m-1 keep the cards' rings from being clipped by the sidebar's own scroll box. */}
      <aside className="-m-1 space-y-6 p-1 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-x-hidden lg:overflow-y-auto">
        <div className="hidden lg:block">
          <ContactCard contact={report.official_contact} />
        </div>

        <Alternatives report={report} />

        {report.warnings.length > 0 && (
          <div className="rounded-2xl bg-lemon-soft p-5 ring-1 ring-lemon">
            <h3 className="text-sm font-semibold">{t("notes")}</h3>
            <ul lang="en" dir="ltr" className="mt-2 list-disc space-y-1 ps-5 text-sm text-navy-800">
              {report.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <details className="group rounded-2xl bg-card ring-1 ring-fog">
          <summary
            className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 font-medium sm:px-6 [&::-webkit-details-marker]:hidden ${focusRing}`}
          >
            {t("extracted")}
            <Chevron />
          </summary>
          <ExtractionList x={report.extraction} />
        </details>
      </aside>
    </div>
  );
}

function ContactCard({ contact }: { contact: Report["official_contact"] }) {
  const t = useTranslations("checker.contact");
  const hasContact = contact && (contact.email || contact.phone || contact.url);
  return (
    <div className="rounded-2xl bg-lavender-100 p-5 ring-1 ring-lavender-200 sm:p-6">
      <h3 className="text-lg font-semibold tracking-tight">{t("title")}</h3>
      {hasContact ? (
        <>
          <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
            {contact.name && <Row k={t("office")} v={contact.name} />}
            {contact.email && <Row k={t("email")} v={<Contact scheme="mailto" value={contact.email} />} />}
            {contact.phone && <Row k={t("phone")} v={<Contact scheme="tel" value={contact.phone} />} />}
            {contact.url && <Row k={t("foundOn")} v={<Link href={contact.url} />} />}
          </dl>
          <p className="mt-4 text-sm text-slate">{t("source")}</p>
        </>
      ) : (
        <p className="mt-2 max-w-[68ch] text-slate">
          {t("none")}
        </p>
      )}
    </div>
  );
}

const CHECKS = [
  ["inDocument", ["doc1", "doc2", "doc3", "doc4", "doc5", "doc6"]],
  ["againstSources", ["src1", "src2", "src3", "src4"]],
] as const;

function WhatWeCheck() {
  const t = useTranslations("checker.checks");
  return (
    <section aria-labelledby="checks-heading" className="rounded-2xl bg-card p-5 ring-1 ring-fog sm:p-6">
      <h2 id="checks-heading" className="text-lg font-semibold tracking-tight">
        {t("title")}
      </h2>
      {CHECKS.map(([group, items]) => (
        <div key={group} className="mt-5">
          <h3 className="text-sm font-semibold text-slate">{t(group)}</h3>
          <ul className="mt-2 space-y-2.5 text-sm">
            {items.map((item) => (
              <li key={item} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-mint text-[10px] text-navy-800"
                >
                  ✓
                </span>
                {t(item)}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="mt-5 border-t border-fog pt-4 text-sm text-slate">
        {t("never")}
      </p>
    </section>
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
        <span className="flex items-center gap-1.5 text-sm text-slate">
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
  return (
    <li lang="en" dir="ltr" className="px-4 py-4 sm:px-6">
      <h4 className="font-medium text-pretty">{f.title}</h4>
      <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-pretty text-slate">{f.detail}</p>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate">
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
    <dl className="space-y-3 border-t border-fog px-5 py-4 text-sm sm:px-6">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-slate">{k}</dt>
          <dd dir="auto" className="[overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="whitespace-nowrap text-slate">{k}</dt>
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
      className={`font-medium text-navy-900 underline decoration-mist underline-offset-4 hover:decoration-current ${focusRing}`}
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
      className={`break-all text-navy-800 underline decoration-mist underline-offset-4 hover:decoration-current ${focusRing}`}
    >
      {url.hostname}
    </a>
  );
}

function Chevron() {
  return (
    <span aria-hidden className="text-slate transition-transform duration-200 group-open:rotate-180">
      ▾
    </span>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`size-4 shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin motion-reduce:opacity-60 ${className}`}
    />
  );
}
