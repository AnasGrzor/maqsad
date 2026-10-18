import { useTranslations } from "next-intl";
import { useId } from "react";
import { alternativesFor } from "@/lib/alternatives";
import type { Report } from "@/lib/schema";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export function Alternatives({ report }: { report: Report }) {
  // The page may render this twice (phone and sidebar layouts), so the heading id must be unique.
  const headingId = useId();
  const t = useTranslations("checker.alternatives");
  const { tip, links } = alternativesFor(report.extraction.doc_type);
  if (report.risk === "low" || links.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="rounded-2xl bg-card p-5 ring-1 ring-line sm:p-6">
      <h3 id={headingId} className="text-lg font-semibold tracking-tight text-balance">
        {t("title")}
      </h3>
      <p className="mt-2 text-sm text-soft">
        {t("note")}
      </p>
      <ul lang="en" dir="ltr" className="mt-4 space-y-3">
        {links.map((l) => (
          <li key={l.url} className="min-w-0">
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-current ${focusRing}`}
            >
              {l.name}
              <span className="sr-only"> {t("newTab")}</span>
            </a>
            <p className="text-sm text-soft">{l.note}</p>
            {/* Showing the real domain teaches what the official address looks like. */}
            <p className="text-xs [overflow-wrap:anywhere] text-soft">{new URL(l.url).hostname}</p>
          </li>
        ))}
      </ul>
      {tip && <p lang="en" dir="ltr" className="mt-4 border-t border-line pt-4 text-sm text-ink">{tip}</p>}
    </section>
  );
}
