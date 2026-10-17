import { getFormatter, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminUsers() {
  await requireRole("admin");
  const [t, format, supabase] = await Promise.all([
    getTranslations("dashboard"),
    getFormatter(),
    createClient(),
  ]);
  // RLS returns every row only to an active admin (is_admin() in the profiles migration).
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, display_name, role, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("admin.usersTitle")}</h1>
        <p className="mt-2 max-w-[68ch] text-slate">{t("admin.usersIntro")}</p>
      </header>
      {users.length === 0 ? (
        <p className="text-slate">{t("admin.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-fog">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-fog text-slate">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t("admin.name")}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t("admin.role")}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t("admin.status")}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t("admin.joined")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fog">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 [overflow-wrap:anywhere]">{u.display_name}</td>
                  <td className="px-4 py-3">{t(`roles.${u.role}`)}</td>
                  <td className="px-4 py-3">{t(`admin.${u.status}`)}</td>
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
