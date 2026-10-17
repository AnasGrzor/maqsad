import { getFormatter, getTranslations } from "next-intl/server";
import { ReportView } from "@/components/report/report-view";
import { focusRing } from "@/components/styles";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { namesOf } from "@/lib/data";
import { getReport } from "@/lib/reports";

export default async function AdminReport({ params }: PageProps<"/[locale]/admin/reports/[id]">) {
  await requireRole("admin");
  const { id } = await params;
  const [t, c, format, saved] = await Promise.all([getTranslations("adminReports"), getTranslations("checker"), getFormatter(), getReport(id)]);
  const back = (
    <Link href="/admin/reports" className={`text-sm text-soft underline underline-offset-4 hover:text-ink ${focusRing}`}>
      {t("back")}
    </Link>
  );
  if (!saved) {
    return (
      <div className="space-y-4">
        {back}
        <p className="text-soft">{t("notFound")}</p>
      </div>
    );
  }
  const owner = (await namesOf([saved.owner_id])).get(saved.owner_id);

  return (
    <div>
      {back}
      <div className="mt-3 rounded-2xl bg-tint py-3 ps-5 pe-3 ring-1 ring-tint-strong">
        <h1 dir="auto" className="font-medium [overflow-wrap:anywhere]">
          {c(`docType.${saved.report.extraction.doc_type}`)}
          {saved.report.extraction.issuer_name && ` · ${saved.report.extraction.issuer_name}`}
        </h1>
        <p className="text-sm text-soft">
          {t("savedBy")}{" "}
          <Link href={`/admin/users/${saved.owner_id}`} className="underline underline-offset-4">
            {owner ?? saved.owner_id}
          </Link>
          {" · "}
          <time dateTime={saved.created_at}>{format.dateTime(new Date(saved.created_at), { dateStyle: "medium", timeStyle: "short" })}</time>
        </p>
      </div>
      <ReportView report={saved.report} stored />
    </div>
  );
}
