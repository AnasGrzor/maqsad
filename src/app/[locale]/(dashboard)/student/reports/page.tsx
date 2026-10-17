import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/feature-list";
import { card, Chip } from "@/components/listings";
import { cta, focusRing } from "@/components/styles";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { listReports } from "@/lib/reports";

const RISK_CHIP = {
  high: "bg-risk-high-bg text-risk-high",
  medium: "bg-risk-med-bg text-risk-med",
  low: "bg-risk-low-bg text-risk-low",
  incomplete: "bg-risk-inc-bg text-risk-inc",
} as const;

export default async function Reports() {
  const user = await requireRole("student");
  const [t, c, format, reports] = await Promise.all([
    getTranslations("reports"),
    getTranslations("checker"),
    getFormatter(),
    listReports(user.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeading title={t("title")} intro={t("intro")} />
      {reports.length === 0 ? (
        <div className={`${card} space-y-4`}>
          <p className="text-soft">{t("empty")}</p>
          <Link href="/check" className={`${cta} bg-primary text-on-primary hover:bg-primary-hover`}>
            {t("checkCta")}
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-card ring-1 ring-line">
          {reports.map(({ id, created_at, report }) => (
            <li key={id}>
              <Link
                href={`/student/reports/${id}`}
                className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-tint-soft ${focusRing}`}
              >
                <span className="min-w-0">
                  <span className="block font-medium [overflow-wrap:anywhere]">
                    {c(`docType.${report.extraction.doc_type}`)}
                    {report.extraction.issuer_name && ` · ${report.extraction.issuer_name}`}
                  </span>
                  <time dateTime={created_at} className="text-sm text-soft">
                    {t("checkedOn", { date: format.dateTime(new Date(created_at), { dateStyle: "medium", timeStyle: "short" }) })}
                  </time>
                </span>
                <Chip tone={RISK_CHIP[report.risk]}>{c(`risk.${report.risk}.title`)}</Chip>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
