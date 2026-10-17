import { createHash } from "node:crypto";
import {
  CHECK_NAMES,
  checkFailed,
  contactLookalikes,
  cricosCheck,
  dliCheck,
  domainAgeChecks,
  domainOf,
  mergeFindings,
  pdfMetadataCheck,
  pkcertCheck,
  riskLevel,
  ruleChecks,
  ukviCheck,
} from "@/lib/checks";
import { extract } from "@/lib/gemini";
import { judge, research } from "@/lib/groq";
import { mockCheck, pickScenario } from "@/lib/mock";
import { linkCase } from "@/lib/network";
import { consumeCheck } from "@/lib/plans";
import { saveReport } from "@/lib/reports";
import type { Finding, Judgement, Report, StreamEvent } from "@/lib/schema";

export const maxDuration = 120;

// Vercel rejects function request bodies over 4.5 MB.
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_TEXT = 20_000;
const FILE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

// The free Groq quota covers only a few dozen checks a day, so re-checking the same
// document reuses the report. shortcut: per server instance, lost on restart; use a shared store if traffic grows.
const reports = new Map<string, Report>();
const MAX_CACHED = 100;

// Never in production: a canned "no red flags" report must not reach a real user.
const MOCK = process.env.MOCK_AI === "1" && process.env.NODE_ENV !== "production";

export async function POST(req: Request) {
  const missing = ["GEMINI_API_KEY", "GROQ_API_KEY"].filter((k) => !process.env[k]);
  if (missing.length && !MOCK) {
    // Name the missing keys in the server log only; the client gets a generic message.
    console.error("analyze: missing", missing.join(", "));
    return Response.json({ error: "The checker is not available right now." }, { status: 500 });
  }

  // Refuse oversized bodies before reading them (a file up to MAX_BYTES plus form overhead).
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 256 * 1024) {
    return Response.json({ error: "File is larger than 4 MB." }, { status: 413 });
  }

  const form = await req.formData().catch(() => null);
  const entry = form?.get("file");
  const file = entry instanceof File && entry.size > 0 ? entry : null;
  const text = String(form?.get("text") ?? "").trim();

  if (file) {
    if (!FILE_TYPES.has(file.type)) return Response.json({ error: "Upload a PDF, PNG, JPG or WebP file." }, { status: 400 });
    if (file.size > MAX_BYTES) return Response.json({ error: "File is larger than 4 MB." }, { status: 400 });
  } else if (!text) {
    return Response.json({ error: "Upload a file or paste the message." }, { status: 400 });
  } else if (text.length > MAX_TEXT) {
    return Response.json({ error: "Text is longer than 20,000 characters." }, { status: 400 });
  }

  // M5 plan limits: sign-in required (401) and one verification report used per check, before any model call.
  const refused = await consumeCheck();
  if (refused) return refused;
  // End M5.

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: StreamEvent) => controller.enqueue(new TextEncoder().encode(JSON.stringify(e) + "\n"));
      const warnings: string[] = [];
      // ---- M4 save step: a signed-in student who ticked "Save this report" gets it stored (src/lib/reports.ts).
      // Anonymous and unticked checks are never stored. "saved" is the new id, or false if saving failed.
      const sendResult = async (report: Report) =>
        send({ type: "result", report, ...(form?.get("save") === "1" ? { saved: (await saveReport(report)) ?? false } : {}) });
      // ---- end M4 save step
      try {
        if (MOCK) {
          const report = await mockCheck(pickScenario(text, file?.name ?? ""), (label) => send({ type: "step", label }));
          await sendResult(report);
          return;
        }
        const bytes = file ? new Uint8Array(await file.arrayBuffer()) : null;
        const key = createHash("sha256").update(bytes ?? "").update(text).digest("hex");
        const cached = reports.get(key);
        if (cached) {
          // Refresh connections: later checks may share identifiers with this one.
          await sendResult({ ...cached, connections: linkCase(cached.extraction, cached.risk, new Date(), key) });
          return;
        }

        send({ type: "step", label: "Reading the document" });
        const x = await extract({
          file: file && bytes ? { data: Buffer.from(bytes).toString("base64"), mimeType: file.type } : undefined,
          text: text || undefined,
        });

        send({ type: "step", label: "Checking payment details, domains and official registers" });
        const domains = [...x.issuer_emails, x.issuer_website].map(domainOf);
        const settled = await Promise.allSettled([
          Promise.resolve(ruleChecks(x)),
          bytes && file?.type === "application/pdf" ? pdfMetadataCheck(bytes) : [],
          domainAgeChecks(domains),
          ukviCheck(x),
          dliCheck(x),
          cricosCheck(x),
          // PKCERT lists almost no student notices, so its outage shouldn't make every report "incomplete".
          pkcertCheck(x).catch(() => [checkFailed("pkcert", false)]),
        ]);
        const checks = ["rules", "pdf", "domain_age", "ukvi", "dli", "cricos", "pkcert"] as const;
        const findings: Finding[] = settled.flatMap((s, i) => {
          if (s.status === "fulfilled") return s.value;
          warnings.push(`${CHECK_NAMES[checks[i]]} could not run.`);
          return [checkFailed(checks[i])];
        });

        send({ type: "step", label: "Searching official sources online" });
        const notes = await research(x).catch(() => {
          warnings.push("Web research was unavailable (rate limit or network), so online checks were skipped.");
          findings.push(checkFailed("web_research"));
          return "";
        });

        send({ type: "step", label: "Writing your report" });
        let judgement: Judgement | null = null;
        try {
          judgement = await judge(x, findings, notes);
        } catch {
          warnings.push("The written summary could not be generated. The checks below are still valid.");
          findings.push(checkFailed("summary"));
        }
        const merged = mergeFindings([
          ...findings,
          ...(judgement?.findings ?? []).map((f) => ({ ...f, origin: "web" as const })),
          ...contactLookalikes(x, judgement?.official_contact, findings),
        ]);

        const report: Report = {
          risk: riskLevel(merged, warnings.length === 0),
          extraction: x,
          findings: merged,
          official_contact: judgement?.official_contact ?? null,
          summary_en: judgement?.summary_en ?? "",
          summary_ur: judgement?.summary_ur ?? "",
          warnings,
          connections: [],
        };
        // After riskLevel(): connections are leads only and must never change the risk.
        report.connections = linkCase(x, report.risk, new Date(), key);
        // Don't cache partial reports: a retry after the quota resets should run the missing checks.
        if (!warnings.length) {
          if (reports.size >= MAX_CACHED) reports.delete(reports.keys().next().value!);
          reports.set(key, report);
        }
        await sendResult(report);
      } catch (e) {
        // Provider errors can echo request content, so only the error type is logged.
        console.error("analyze: check failed", e instanceof Error ? e.name : typeof e);
        send({ type: "error", message: "We could not read this document. Try a clearer photo or a PDF, or try again in a minute." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
}
