"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { focusRing, ReportView } from "@/components/report/report-view";
import { Link } from "@/i18n/navigation";
import type { Report, StreamEvent } from "@/lib/schema";

type Mode = "file" | "text";

const MAX_BYTES = 4 * 1024 * 1024;

// `notice` is the plan line from page.tsx; `blocked` replaces the form with it (signed out or no checks left).
// `saveOption` is the "Save this report" checkbox, rendered on the server only for signed-in students.
export function Checker({ notice, blocked = false, saveOption }: { notice?: ReactNode; blocked?: boolean; saveOption?: ReactNode }) {
  const t = useTranslations("checker");
  const u = useTranslations("usage");
  const v = useTranslations("reportView");
  const format = useFormatter();
  const router = useRouter();
  const [saved, setSaved] = useState<string | false | undefined>();
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
    setSaved(undefined);
    setSteps([]);
    setError("");
    setFile(null);
    setText("");
    window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const save = new FormData(e.currentTarget).get("save") === "1";
    setRunning(true);
    setError("");
    setReport(null);
    setSaved(undefined);
    setSteps([]);
    setSubject(mode === "file" && file ? file.name : t("pasted"));

    const body = new FormData();
    if (mode === "file" && file) body.append("file", file);
    if (mode === "text") body.append("text", text);
    if (save) body.append("save", "1");

    try {
      const res = await fetch("/api/analyze", { method: "POST", body });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        // Plan limit refusals carry a code (usage.errors) with the limit and reset date.
        const code = `errors.${data.code}` as "errors.unknown";
        const date = data.resetsAt ? format.dateTime(new Date(data.resetsAt), { dateStyle: "medium" }) : "";
        throw new Error(u.has(code) ? u(code, { limit: data.limit ?? 0, date }) : (data.error ?? t("genericError")));
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      // The stream can end without a result, e.g. when the function hits its time limit.
      let finished = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const line of lines.filter(Boolean)) {
          const ev = JSON.parse(line) as StreamEvent;
          if (ev.type === "step") setSteps((s) => [...s, ev.label]);
          if (ev.type === "result") {
            finished = true;
            setReport(ev.report);
            setSaved(ev.saved);
          }
          if (ev.type === "error") {
            finished = true;
            setError(ev.message);
          }
        }
      }
      if (!finished) setError(t("genericError"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setRunning(false);
      router.refresh(); // updates the checks-left line

    }
  }

  return (
    <div>
        {report ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-tint py-3 ps-5 pe-3 ring-1 ring-tint-strong">
              <h1 className="min-w-0 text-sm text-soft">
                {t.rich("reportFor", {
                  subject,
                  b: (chunks) => <span className="font-medium break-all text-ink">{chunks}</span>,
                })}
              </h1>
              <button
                type="button"
                onClick={reset}
                className={`min-h-10 rounded-[10px] bg-primary px-4 text-sm font-medium text-on-primary transition-[background-color,transform] duration-100 hover:bg-primary-hover active:scale-[0.97] ${focusRing}`}
              >
                {t("another")}
              </button>
            </div>
            {saved !== undefined && (
              <p
                role="status"
                className={`mt-4 rounded-xl p-4 text-sm ring-1 ${saved ? "bg-turq-faint ring-turq-soft" : "bg-danger-bg text-danger ring-danger/15"}`}
              >
                {saved ? (
                  <>
                    {v("saved")}{" "}
                    <Link href={`/student/reports/${saved}`} className={`font-medium underline underline-offset-4 ${focusRing}`}>
                      {v("savedLink")}
                    </Link>
                  </>
                ) : (
                  v("saveFailed")
                )}
              </p>
            )}
            <ReportView report={report} />
          </>
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
            <div className="min-w-0">
              <h1 className="max-w-[22ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {t("title")}
              </h1>
              <p className="mt-4 max-w-[62ch] text-pretty text-soft sm:text-lg">
                {t("intro")}
              </p>

              {notice && <div className="mt-6">{notice}</div>}
              {!blocked && (
              <form onSubmit={submit} className="mt-8 rounded-2xl bg-tint p-4 ring-1 ring-tint-strong sm:p-6">
                <div
                  role="group"
                  aria-label={t("inputType")}
                  className="relative grid w-full grid-cols-2 rounded-full bg-tint-strong p-1 sm:w-80"
                >
                  <span
                    aria-hidden
                    className={`absolute inset-y-1 start-1 w-[calc(50%-0.25rem)] rounded-full bg-primary shadow-[0_1px_3px_rgb(22_46_72/0.25)] transition-transform duration-250 ease-out-quart motion-reduce:transition-none ${
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
                        mode === m ? "text-on-primary" : "text-ink hover:text-ink"
                      }`}
                    >
                      {m === "file" ? t("modeFile") : t("modeText")}
                    </button>
                  ))}
                </div>

                {mode === "file" ? (
                  file ? (
                    <div className="mt-5 flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-tint-strong">
                      <span
                        aria-hidden
                        className="grid size-11 shrink-0 place-items-center rounded-lg bg-tint text-[11px] font-semibold tracking-wide text-ink"
                      >
                        {file.type === "application/pdf" ? "PDF" : "IMG"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{file.name}</p>
                        <p className="text-sm text-soft">
                          {file.size < 1024 * 1024
                            ? t("kb", { n: Math.max(1, Math.round(file.size / 1024)) })
                            : t("mb", { n: (file.size / 1024 / 1024).toFixed(1) })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => pick(null)}
                        disabled={running}
                        className={`min-h-10 rounded-full px-3 text-sm font-medium text-soft transition-colors hover:bg-tint hover:text-ink disabled:opacity-50 ${focusRing}`}
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
                      className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-12 text-center transition-colors duration-200 has-[:focus-visible]:border-ink ${
                        dragging
                          ? "border-ink bg-turq-faint"
                          : "border-line-strong bg-card hover:border-soft hover:bg-tint-soft"
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
                      <span className="mt-1 text-sm text-soft">{t("fileHint")}</span>
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
                      className="block w-full resize-y rounded-xl border border-line-strong bg-card p-4 leading-relaxed placeholder:text-soft focus:border-ink focus:ring-1 focus:ring-ink focus:outline-none"
                    />
                  </label>
                )}

                {saveOption}

                <div className="mt-5 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-soft sm:max-w-[40ch]">
                    {t.rich("privacy", {
                      link: (c) => (
                        <Link href="/policies#reports" className={`underline underline-offset-4 hover:text-ink ${focusRing}`}>
                          {c}
                        </Link>
                      ),
                    })}
                  </p>
                  <button
                    type="submit"
                    disabled={!ready || running}
                    aria-busy={running}
                    className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-6 font-medium text-on-primary transition-[background-color,transform] duration-100 hover:bg-primary-hover active:scale-[0.97] disabled:active:scale-100 ${
                      running ? "cursor-progress" : "disabled:cursor-not-allowed disabled:opacity-45"
                    } ${focusRing}`}
                  >
                    {running && <Spinner />}
                    {running ? t("checking") : t("submit")}
                  </button>
                </div>
              </form>
              )}

              {error && (
                <p
                  role="alert"
                  className="mt-6 rounded-xl bg-danger-bg p-4 text-danger ring-1 ring-danger/15 motion-safe:animate-rise"
                >
                  {error}
                </p>
              )}
            </div>

            <aside className="lg:sticky lg:top-24">
              {running ? (
                <section
                  aria-label={t("progress")}
                  className="rounded-2xl bg-card p-5 ring-1 ring-line motion-safe:animate-rise sm:p-6"
                >
                  <h2 className="font-semibold">{t("progressTitle")}</h2>
                  <p className="mt-1 text-sm text-soft">{t("progressHint")}</p>
                  <ol aria-live="polite" className="mt-4 space-y-3">
                    {(steps.length ? steps : [t("starting")]).map((s, i, all) => {
                      const current = i === all.length - 1;
                      return (
                        <li key={s} className="flex items-center gap-3 text-sm">
                          {current ? (
                            <Spinner className="text-soft" />
                          ) : (
                            <span
                              aria-hidden
                              className="grid size-4 place-items-center rounded-full bg-turq-soft text-[10px] text-ink"
                            >
                              ✓
                            </span>
                          )}
                          <span dir="auto" className={current ? "font-medium" : "text-soft"}>{s}</span>
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

const CHECKS = [
  ["inDocument", ["doc1", "doc2", "doc3", "doc4"]],
  ["againstSources", ["src1", "src2"]],
] as const;

function WhatWeCheck() {
  const t = useTranslations("checker.checks");
  return (
    <section aria-labelledby="checks-heading" className="rounded-2xl bg-card p-5 ring-1 ring-line sm:p-6">
      <h2 id="checks-heading" className="text-lg font-semibold tracking-tight">
        {t("title")}
      </h2>
      {CHECKS.map(([group, items]) => (
        <div key={group} className="mt-5">
          <h3 className="text-sm font-semibold text-soft">{t(group)}</h3>
          <ul className="mt-2 space-y-2.5 text-sm">
            {items.map((item) => (
              <li key={item} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-turq-soft text-[10px] text-ink"
                >
                  ✓
                </span>
                {t(item)}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="mt-5 border-t border-line pt-4 text-sm text-soft">
        {t("evidence")}
      </p>
    </section>
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
