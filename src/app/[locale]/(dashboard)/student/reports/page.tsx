import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/feature-list";
import { card, Chip } from "@/components/listings";
import { cta, focusRing } from "@/components/styles";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { listReports } from "@/lib/reports";

const RISK_CHIP = {
  high: "bg-danger text-white",
  medium: "bg-lemon text-navy-900",
  low: "bg-mint text-navy-900",
  incomplete: "bg-fog text-navy-900",
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
          <p className="text-slate">{t("empty")}</p>
          <Link href="/check" className={`${cta} bg-navy-900 text-ice hover:bg-navy-800`}>
            {t("checkCta")}
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-fog overflow-hidden rounded-2xl bg-card ring-1 ring-fog">
          {reports.map(({ id, created_at, report }) => (
            <li key={id}>
              <Link
                href={`/student/reports/${id}`}
                className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-lavender-50 ${focusRing}`}
              >
                <span className="min-w-0">
                  <span className="block font-medium [overflow-wrap:anywhere]">
                    {c(`docType.${report.extraction.doc_type}`)}
                    {report.extraction.issuer_name && ` · ${report.extraction.issuer_name}`}
                  </span>
                  <time dateTime={created_at} className="text-sm text-slate">
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
