import { getFormatter, getTranslations } from "next-intl/server";
import { DisputeReviewForm } from "@/components/admin-forms";
import { PageHeading } from "@/components/feature-list";
import { card, Chip, FilterBar, pick } from "@/components/listings";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { namesOf } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

const STATUSES = ["open", "under_review", "resolved", "dismissed"] as const;
const TONE = { open: "bg-lemon-soft text-navy-900", under_review: "bg-lavender-100 text-navy-900", resolved: "bg-mint text-navy-900", dismissed: "bg-fog text-slate" };

export default async function AdminDisputes({ searchParams }: PageProps<"/[locale]/admin/complaints">) {
  await requireRole("admin");
  const [t, d, format, params, supabase] = await Promise.all([
    getTranslations("adminDisputes"),
    getTranslations("disputes"),
    getFormatter(),
    searchParams,
    createClient(),
  ]);
  const status = pick(params.status, STATUSES);

  // RLS: admins read every dispute and case; the parties never see each other's reports.
  let query = supabase.from("disputes").select("*").order("created_at", { ascending: false }).limit(200);
  if (status) query = query.eq("status", status);
  const { data: disputes, error } = await query;
  if (error) throw error;

  const caseIds = [...new Set(disputes.map((x) => x.case_id).filter((id): id is string => !!id))];
  const recordIds = [...new Set(disputes.map((x) => x.record_id).filter((id): id is string => !!id))];
  const [names, { data: cases }, { data: records }] = await Promise.all([
    namesOf([...new Set(disputes.flatMap((x) => [x.raised_by, x.against]))]),
    caseIds.length ? supabase.from("cases").select("id, title").in("id", caseIds) : Promise.resolve({ data: [] }),
    recordIds.length ? supabase.from("case_records").select("id, summary").in("id", recordIds) : Promise.resolve({ data: [] }),
  ]);
  const caseTitle = new Map((cases ?? []).map((c) => [c.id, c.title]));
  const recordSummary = new Map((records ?? []).map((r) => [r.id, r.summary]));
  const person = (id: string) => (
    <Link href={`/admin/users/${id}`} className="underline decoration-mist underline-offset-4 hover:decoration-current">
      {names.get(id) ?? id}
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeading title={t("title")} intro={t("intro")} />
      <FilterBar filters={[{ name: "status", label: t("status"), value: status, options: STATUSES.map((s) => ({ value: s, label: d(`status.${s}`) })) }]} />
      {disputes.length === 0 ? (
        <p className="text-slate">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {disputes.map((x) => (
            <li key={x.id} className={`${card} grid gap-4 text-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`}>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip>{d(`kinds.${x.kind}`)}</Chip>
                  <span className="font-medium">{d(`reasons.${x.reason}`)}</span>
                  <Chip tone={TONE[x.status]}>{d(`status.${x.status}`)}</Chip>
                </div>
                <p>
                  <span className="text-slate">{t("raisedBy")}: </span>
                  {person(x.raised_by)}
                  <span className="text-slate"> · {t("against")}: </span>
                  {person(x.against)}
                </p>
                {x.case_id && (
                  <p dir="auto">
                    <span className="text-slate">{t("case")}: </span>
                    {caseTitle.get(x.case_id) ?? x.case_id}
                  </p>
                )}
                {x.record_id && (
                  <p dir="auto">
                    <span className="text-slate">{t("linkedRecord")}: </span>
                    {recordSummary.get(x.record_id) ?? x.record_id}
                  </p>
                )}
                <p dir="auto" className="whitespace-pre-line">
                  {x.details}
                </p>
                <p className="text-xs text-slate">
                  <time dateTime={x.created_at}>{format.dateTime(new Date(x.created_at), { dateStyle: "medium", timeStyle: "short" })}</time>
                </p>
              </div>
              <DisputeReviewForm id={x.id} note={x.resolution_note} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
