"use client";

import { useState } from "react";
import { actionPlan, EXPOSURES, type Exposure } from "@/lib/actions";
import type { Report } from "@/lib/schema";

// Same as page.tsx.
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-800";
const button = `inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium transition-[background-color,transform] duration-100 active:scale-[0.97] ${focusRing}`;

export function ActionPlan({ report }: { report: Report }) {
  const [shared, setShared] = useState<Exposure[]>([]);
  const plan = actionPlan(report, shared);

  function toggle(id: Exposure, on: boolean) {
    setShared((s) => (on ? [...s, id] : s.filter((e) => e !== id)));
  }

  return (
    <details className="group rounded-2xl bg-card ring-1 ring-fog">
      <summary
        className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 sm:px-6 [&::-webkit-details-marker]:hidden ${focusRing}`}
      >
        <h3 className="text-lg font-semibold tracking-tight">Already paid or shared something?</h3>
        <span aria-hidden className="text-slate transition-transform duration-200 group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div className="space-y-6 border-t border-fog px-5 py-5 sm:px-6">
        <fieldset>
          <legend className="font-medium">Tick everything that applies</legend>
          <div className="mt-3 grid gap-1 sm:grid-cols-2">
            {EXPOSURES.map((e) => (
              <label
                key={e.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-lavender-50"
              >
                <input
                  type="checkbox"
                  checked={shared.includes(e.id)}
                  onChange={(ev) => toggle(e.id, ev.target.checked)}
                  className={`size-4 shrink-0 accent-navy-900 ${focusRing}`}
                />
                <span className="text-sm">{e.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {plan.steps.length === 0 ? (
          <p className="text-sm text-slate">Tick what you paid or shared to see what to do first.</p>
        ) : (
          <div>
            <h4 className="font-semibold">Do these in order</h4>
            <ol className="mt-3 space-y-4">
              {plan.steps.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span
                    aria-hidden
                    className="grid size-6 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-semibold text-ice tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-pretty">{s.title}</p>
                    <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-pretty text-slate">{s.detail}</p>
                    {s.urls.length > 0 && (
                      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                        {s.urls.map((u) => (
                          <a
                            key={u}
                            href={u}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`break-all text-navy-800 underline decoration-mist underline-offset-4 hover:decoration-current ${focusRing}`}
                          >
                            {new URL(u).hostname}
                          </a>
                        ))}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        <Draft
          title="Complaint for the cybercrime agency or your bank"
          note="Fill in your details at the end before you send it."
          text={plan.complaint}
        />

        {plan.verifyEmail ? (
          <Draft
            title="Ask the issuer to confirm"
            note={`To ${plan.verifyEmail.to}, the contact found on their official website. Nothing is sent until you send it.`}
            text={`Subject: ${plan.verifyEmail.subject}\n\n${plan.verifyEmail.body}`}
            mailto={`mailto:${plan.verifyEmail.to}?subject=${encodeURIComponent(plan.verifyEmail.subject)}&body=${encodeURIComponent(plan.verifyEmail.body)}`}
          />
        ) : (
          <p className="text-sm text-slate">
            We have no official email for the issuer, so there is no verification email. Find one on their official
            website, never in the document.
          </p>
        )}
      </div>
    </details>
  );
}

function Draft({ title, note, text, mailto }: { title: string; note: string; text: string; mailto?: string }) {
  const [status, setStatus] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied");
    } catch {
      setStatus("Couldn't copy. Select the text and copy it yourself.");
    }
  }

  return (
    <div>
      <h4 className="font-semibold">{title}</h4>
      <p className="mt-1 text-sm [overflow-wrap:anywhere] text-slate">{note}</p>
      <pre className="mt-3 max-h-72 overflow-y-auto rounded-xl bg-lavender-50 p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] ring-1 ring-lavender-200">
        {text}
      </pre>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={copy} className={`${button} bg-navy-900 text-ice hover:bg-navy-800`}>
          Copy
          <span className="sr-only"> {title.toLowerCase()}</span>
        </button>
        {mailto && (
          <a href={mailto} className={`${button} bg-lavender-100 text-navy-900 ring-1 ring-lavender-200 hover:bg-lavender-200`}>
            Open in email app
          </a>
        )}
        <p aria-live="polite" className="text-sm text-slate">
          {status}
        </p>
      </div>
    </div>
  );
}
