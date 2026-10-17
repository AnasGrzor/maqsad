import { useId } from "react";
import { alternativesFor } from "@/lib/alternatives";
import type { Report } from "@/lib/schema";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-800";

export function Alternatives({ report }: { report: Report }) {
  // The page may render this twice (phone and sidebar layouts), so the heading id must be unique.
  const headingId = useId();
  const { tip, links } = alternativesFor(report.extraction.doc_type);
  if (report.risk === "low" || links.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="rounded-2xl bg-card p-5 ring-1 ring-fog sm:p-6">
      <h3 id={headingId} className="text-lg font-semibold tracking-tight text-balance">
        Look for this opportunity through official channels
      </h3>
      <p className="mt-2 text-sm text-slate">
        Official starting points, not an endorsement. They don&apos;t mean you&apos;re eligible.
      </p>
      <ul className="mt-4 space-y-3">
        {links.map((l) => (
          <li key={l.url} className="min-w-0">
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`font-medium text-navy-900 underline decoration-mist underline-offset-4 hover:decoration-current ${focusRing}`}
            >
              {l.name}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <p className="text-sm text-slate">{l.note}</p>
            {/* Showing the real domain teaches what the official address looks like. */}
            <p className="text-xs [overflow-wrap:anywhere] text-slate">{new URL(l.url).hostname}</p>
          </li>
        ))}
      </ul>
      {tip && <p className="mt-4 border-t border-fog pt-4 text-sm text-navy-800">{tip}</p>}
    </section>
  );
}
