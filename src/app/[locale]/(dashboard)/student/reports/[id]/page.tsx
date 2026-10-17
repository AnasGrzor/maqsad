import { getFormatter, getTranslations } from "next-intl/server";
import { DeleteReport } from "@/components/report/delete-report";
import { ReportView } from "@/components/report/report-view";
import { focusRing } from "@/components/styles";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { getReport } from "@/lib/reports";

// RLS returns only the student's own reports, so another user's id reads as "not found".
export default async function SavedReportPage({ params }: PageProps<"/[locale]/student/reports/[id]">) {
  await requireRole("student");
  const { id } = await params;
  const [t, c, format, saved] = await Promise.all([
    getTranslations("reports"),
    getTranslations("checker"),
    getFormatter(),
    getReport(id),
  ]);
  const back = (
    <Link href="/student/reports" className={`text-sm text-slate underline underline-offset-4 hover:text-navy-900 ${focusRing}`}>
      {t("back")}
    </Link>
  );
  if (!saved) {
    return (
      <div className="space-y-4">
        {back}
        <p className="text-slate">{t("notFound")}</p>
      </div>
    );
  }
  const { report, created_at } = saved;

  return (
    <div>
      {back}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-lavender-100 py-3 ps-5 pe-3 ring-1 ring-lavender-200">
        <div className="min-w-0">
          <h1 className="font-medium [overflow-wrap:anywhere]">
            {c(`docType.${report.extraction.doc_type}`)}
            {report.extraction.issuer_name && ` · ${report.extraction.issuer_name}`}
          </h1>
          <time dateTime={created_at} className="text-sm text-slate">
            {t("checkedOn", { date: format.dateTime(new Date(created_at), { dateStyle: "medium", timeStyle: "short" }) })}
          </time>
        </div>
        <DeleteReport id={saved.id} />
      </div>
      <ReportView report={report} stored />
    </div>
  );
}
