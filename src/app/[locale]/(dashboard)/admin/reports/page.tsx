import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/feature-list";
import { Chip, FilterBar, pick } from "@/components/listings";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { namesOf } from "@/lib/data";
import { listReportsForAdmin } from "@/lib/reports";

const RISKS = ["high", "medium", "low", "incomplete"] as const;
const TONE = { high: "bg-risk-high-bg text-risk-high", medium: "bg-risk-med-bg text-risk-med", low: "bg-risk-low-bg text-risk-low", incomplete: "bg-risk-inc-bg text-risk-inc" };

// Saved verification reports, for spotting documents and agents that keep coming up in high-risk results.
export default async function AdminReports({ searchParams }: PageProps<"/[locale]/admin/reports">) {
  await requireRole("admin");
  const [t, c, format, params] = await Promise.all([getTranslations("adminReports"), getTranslations("checker"), getFormatter(), searchParams]);
  const risk = pick(params.risk, RISKS);
  const reports = await listReportsForAdmin(risk);
  const names = await namesOf([...new Set(reports.map((r) => r.owner_id))]);

  return (
    <div className="space-y-6">
      <PageHeading title={t("title")} intro={t("intro")} />
      <FilterBar filters={[{ name: "risk", label: t("risk"), value: risk, options: RISKS.map((x) => ({ value: x, label: c(`risk.${x}.title`) })) }]} />
      {reports.length === 0 ? (
        <p className="text-soft">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-line">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-line text-soft">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t("document")}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t("risk")}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t("owner")}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t("checked")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 [overflow-wrap:anywhere]">
                    <Link href={`/admin/reports/${r.id}`} dir="auto" className="font-medium underline decoration-line-strong underline-offset-4 hover:decoration-current">
                      {c(`docType.${r.report.extraction.doc_type}`)}
                      {r.report.extraction.issuer_name && ` · ${r.report.extraction.issuer_name}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Chip tone={TONE[r.report.risk]}>{c(`risk.${r.report.risk}.title`)}</Chip>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${r.owner_id}`} className="underline decoration-line-strong underline-offset-4 hover:decoration-current">
                      {names.get(r.owner_id) ?? r.owner_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <time dateTime={r.created_at}>{format.dateTime(new Date(r.created_at), { dateStyle: "medium" })}</time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
