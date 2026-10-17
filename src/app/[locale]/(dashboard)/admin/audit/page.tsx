import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/feature-list";
import { FilterBar, pick } from "@/components/listings";
import { Link } from "@/i18n/navigation";
import { actionKey, AUDIT_ACTIONS } from "@/lib/admin";
import { requireRole } from "@/lib/auth";
import { namesOf } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

const LIMIT = 200;
const link = "underline decoration-line-strong underline-offset-4 hover:decoration-current";

export default async function AuditLog({ searchParams }: PageProps<"/[locale]/admin/audit">) {
  await requireRole("admin");
  const [t, roles, users, credStatus, format, params, supabase] = await Promise.all([
    getTranslations("adminAudit"),
    getTranslations("dashboard.roles"),
    getTranslations("adminUsers"),
    getTranslations("taxonomy.credentialStatus"),
    getFormatter(),
    searchParams,
    createClient(),
  ]);
  const action = pick(params.action, AUDIT_ACTIONS);

  // RLS: only active admins read audit_log.
  let query = supabase.from("audit_log").select("*").order("id", { ascending: false }).limit(LIMIT);
  if (action) query = query.eq("action", action);
  const { data: entries, error } = await query;
  if (error) throw error;

  const profileTargets = entries.filter((e) => e.target_type === "profile" && e.target_id).map((e) => e.target_id!);
  const names = await namesOf([...new Set([...entries.flatMap((e) => (e.actor_id ? [e.actor_id] : [])), ...profileTargets])]);

  const actionLabel = (a: string) => (t.has(`actions.${actionKey(a)}` as "actions.account_suspend") ? t(`actions.${actionKey(a)}` as "actions.account_suspend") : a);
  // Codes in details are translated when we know them; anything else (other milestones) shows as recorded.
  const value = (a: string, v: unknown) => {
    const s = String(v);
    if (a === "account.role_change" && roles.has(s as "admin")) return roles(s as "admin");
    if (a.startsWith("account.") && (s === "active" || s === "suspended")) return users(s);
    if (a === "credential.review" && credStatus.has(s as "verified")) return credStatus(s as "verified");
    return s;
  };

  return (
    <div className="space-y-6">
      <PageHeading title={t("title")} intro={t("intro")} />
      <FilterBar filters={[{ name: "action", label: t("action"), value: action, options: AUDIT_ACTIONS.map((a) => ({ value: a, label: actionLabel(a) })) }]} />
      {entries.length === 0 ? (
        <p className="text-soft">{t("empty")}</p>
      ) : (
        <>
          {entries.length === LIMIT && <p className="text-sm text-soft">{t("limitNote")}</p>}
          <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-line">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-line text-soft">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t("when")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t("action")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t("target")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t("actor")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t("details")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line align-top">
                {entries.map((e) => {
                  const d = (e.details ?? {}) as Record<string, unknown>;
                  return (
                    <tr key={e.id}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <time dateTime={e.created_at}>{format.dateTime(new Date(e.created_at), { dateStyle: "medium", timeStyle: "short" })}</time>
                      </td>
                      <td className="px-4 py-3 font-medium">{actionLabel(e.action)}</td>
                      <td className="px-4 py-3 [overflow-wrap:anywhere]">
                        {e.target_type === "profile" && e.target_id ? (
                          <Link href={`/admin/users/${e.target_id}`} className={link}>
                            {names.get(e.target_id) ?? e.target_id}
                          </Link>
                        ) : e.target_type === "credential" ? (
                          <Link href="/admin/credentials" className={link}>
                            {t("credential")}
                          </Link>
                        ) : (
                          `${e.target_type} ${e.target_id ?? ""}`
                        )}
                      </td>
                      <td className="min-w-32 px-4 py-3 [overflow-wrap:break-word]">
                        {e.actor_id ? (
                          <Link href={`/admin/users/${e.actor_id}`} className={link}>
                            {names.get(e.actor_id) ?? e.actor_id}
                          </Link>
                        ) : (
                          <span className="text-soft">{t("system")}</span>
                        )}
                      </td>
                      <td className="max-w-[28ch] space-y-1 px-4 py-3">
                        {"from" in d && "to" in d && <p>{t("change", { from: value(e.action, d.from), to: value(e.action, d.to) })}</p>}
                        {typeof d.reason === "string" && (
                          <p dir="auto" className="text-soft [overflow-wrap:anywhere]">
                            {t("reason", { reason: d.reason })}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
