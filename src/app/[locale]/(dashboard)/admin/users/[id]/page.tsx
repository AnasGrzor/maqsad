import { getFormatter, getTranslations } from "next-intl/server";
import { AccountStatusForm } from "@/components/admin-forms";
import { card, countries, CredentialBadge } from "@/components/listings";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { getAgentProfile, getStudentProfile, listOwnCredentials, UUID } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

const link = "font-medium underline decoration-line-strong underline-offset-4 hover:decoration-current";
const CONNECTION_LABEL = { pending: "statusPending", accepted: "statusAccepted", declined: "statusDeclined", withdrawn: "statusWithdrawn" } as const;

export default async function AdminUser({ params }: PageProps<"/[locale]/admin/users/[id]">) {
  const me = await requireRole("admin");
  const { id } = await params;
  const [t, roles, tax, conn, sp, ap, format, supabase] = await Promise.all([
    getTranslations("adminUsers"),
    getTranslations("dashboard.roles"),
    getTranslations("taxonomy"),
    getTranslations("connections"),
    getTranslations("studentProfile"),
    getTranslations("agentProfile"),
    getFormatter(),
    createClient(),
  ]);
  if (!UUID.test(id)) return <p className="text-soft">{t("notFound")}</p>;

  // Every read runs as the admin: RLS (is_admin()) allows it, and admin_user_email() checks is_admin() itself.
  const [userRead, emailRead, student, agent, credentials, connectionsRead] = await Promise.all([
    supabase.from("profiles").select("id, display_name, role, status, created_at").eq("id", id).maybeSingle(),
    supabase.rpc("admin_user_email", { target: id }),
    getStudentProfile(id),
    getAgentProfile(id),
    listOwnCredentials(id),
    // id is a checked UUID, so it is safe inside this PostgREST filter string.
    supabase.from("connections").select("status").or(`student_id.eq.${id},agent_id.eq.${id}`),
  ]);
  for (const read of [userRead, emailRead, connectionsRead]) if (read.error) throw read.error;
  const { data: user } = userRead;
  const { data: email } = emailRead;
  if (!user) return <p className="text-soft">{t("notFound")}</p>;

  const counts = (["pending", "accepted", "declined", "withdrawn"] as const).map(
    (s) => [s, (connectionsRead.data ?? []).filter((c) => c.status === s).length] as const,
  );
  const suspended = user.status === "suspended";
  const studentRows: [string, string][] = student
    ? [
        [sp("educationLevel"), tax(`levels.${student.education_level}`)],
        [sp("field"), tax(`fields.${student.field}` as "fields.other")],
        [sp("goal"), tax(`goals.${student.goal}`)],
        [sp("destinations"), await countries(student.destinations)],
      ]
    : [];
  const agentRows: [string, string][] = agent
    ? [
        [ap("agencyName"), agent.agency_name],
        [ap("kind"), tax(`agentKinds.${agent.kind}`)],
        [ap("city"), agent.city],
        [ap("website"), agent.website],
        [ap("destinations"), await countries(agent.destinations)],
      ]
    : [];

  return (
    <div className="space-y-6">
      <Link href="/admin" className={`${link} text-sm`}>
        {t("back")}
      </Link>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">{user.display_name}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${suspended ? "bg-danger-bg text-danger" : "bg-turq-soft text-ink"}`}>
          {t(user.status)}
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className={card}>
            <h2 className="font-semibold">{t("account")}</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
              <dt className="text-soft">{t("role")}</dt>
              <dd>{roles(user.role)}</dd>
              <dt className="text-soft">{t("email")}</dt>
              <dd dir="ltr" className="text-start [overflow-wrap:anywhere]">
                {email}
              </dd>
              <dt className="text-soft">{t("joined")}</dt>
              <dd>
                <time dateTime={user.created_at}>{format.dateTime(new Date(user.created_at), { dateStyle: "medium" })}</time>
              </dd>
            </dl>
            <p className="mt-3 text-xs text-soft">{t("emailNote")}</p>
          </section>

          {user.role !== "admin" && (
            <section className={card}>
              <h2 className="font-semibold">{t(user.role === "agent" ? "agentProfile" : "studentProfile")}</h2>
              {student || agent ? (
                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
                  {[...studentRows, ...agentRows]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-soft">{k}</dt>
                        <dd dir="auto" className="[overflow-wrap:anywhere]">{v}</dd>
                      </div>
                    ))}
                  {student && (
                    <>
                      <dt className="text-soft">{sp("visible")}</dt>
                      <dd>{t(student.visible ? "visible" : "hidden")}</dd>
                    </>
                  )}
                </dl>
              ) : (
                <p className="mt-2 text-sm text-soft">{t("noProfile")}</p>
              )}
            </section>
          )}

          {user.role === "agent" && (
            <section className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{t("credentials")}</h2>
                <Link href="/admin/credentials" className={`${link} text-sm`}>
                  {t("reviewLink")}
                </Link>
              </div>
              {credentials.length ? (
                <ul className="mt-3 divide-y divide-line text-sm">
                  {credentials.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <span>
                        <span className="font-medium">{tax(`credentialKinds.${c.kind}`)}</span>
                        <span className="text-soft">
                          {" · "}
                          {c.issuer}
                          {c.reference && ` · ${c.reference}`}
                          {" · "}
                          <time dateTime={c.created_at}>{format.dateTime(new Date(c.created_at), { dateStyle: "medium" })}</time>
                        </span>
                      </span>
                      <CredentialBadge status={c.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-soft">{t("noCredentials")}</p>
              )}
            </section>
          )}

          {user.role !== "admin" && (
            <section className={card}>
              <h2 className="font-semibold">{t("connections")}</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                {counts.map(([status, n]) => (
                  <div key={status} className="rounded-xl bg-tint-soft p-3">
                    <dt className="text-soft">{conn(CONNECTION_LABEL[status])}</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums">{n}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        <aside className="h-fit space-y-4 rounded-2xl bg-tint p-5 ring-1 ring-tint-strong">
          {user.id === me.id ? (
            <p className="text-sm">{t("selfNote")}</p>
          ) : user.role === "admin" && !suspended ? (
            <p className="text-sm">{t("adminNote")}</p>
          ) : (
            <AccountStatusForm id={user.id} suspended={suspended} />
          )}
          <Link href="/admin/audit" className={`${link} block text-sm`}>
            {t("history")}
          </Link>
        </aside>
      </div>
    </div>
  );
}
