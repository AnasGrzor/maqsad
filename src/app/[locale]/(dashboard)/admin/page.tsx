import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/feature-list";
import { FilterBar, pick } from "@/components/listings";
import { Link } from "@/i18n/navigation";
import { likePattern, searchTerm } from "@/lib/admin";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const ROLES = ["student", "agent", "admin"] as const;
const STATUSES = ["active", "suspended"] as const;
const LIMIT = 200;

export default async function AdminUsers({ searchParams }: PageProps<"/[locale]/admin">) {
  await requireRole("admin");
  const [t, roles, format, params, supabase] = await Promise.all([
    getTranslations("adminUsers"),
    getTranslations("dashboard.roles"),
    getFormatter(),
    searchParams,
    createClient(),
  ]);
  const q = searchTerm(params.q);
  const role = pick(params.role, ROLES);
  const status = pick(params.status, STATUSES);

  // RLS returns every row only to an active admin (is_admin() in the profiles migration).
  let query = supabase
    .from("profiles")
    .select("id, display_name, role, status, created_at")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (q) query = query.ilike("display_name", likePattern(q));
  if (role) query = query.eq("role", role);
  if (status) query = query.eq("status", status);
  const { data: users, error } = await query;
  if (error) throw error;

  return (
    <div className="space-y-6">
      <PageHeading title={t("title")} intro={t("intro")} />
      <FilterBar
        search={{ name: "q", label: t("search"), placeholder: t("searchPlaceholder"), value: q }}
        filters={[
          { name: "role", label: t("role"), value: role, options: ROLES.map((r) => ({ value: r, label: roles(r) })) },
          { name: "status", label: t("status"), value: status, options: STATUSES.map((s) => ({ value: s, label: t(s) })) },
        ]}
      />
      <p className="text-sm font-medium">
        {t("results", { count: users.length })}
        {users.length === LIMIT && <span className="ms-2 font-normal text-slate">{t("limitNote")}</span>}
      </p>
      {users.length > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-fog">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-fog text-slate">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t("name")}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t("role")}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t("status")}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t("joined")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fog">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 [overflow-wrap:anywhere]">
                    <Link href={`/admin/users/${u.id}`} className="font-medium underline decoration-mist underline-offset-4 hover:decoration-current">
                      {u.display_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{roles(u.role)}</td>
                  <td className={`px-4 py-3 ${u.status === "suspended" ? "font-medium text-danger" : ""}`}>{t(u.status)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <time dateTime={u.created_at}>{format.dateTime(new Date(u.created_at), { dateStyle: "medium" })}</time>
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
