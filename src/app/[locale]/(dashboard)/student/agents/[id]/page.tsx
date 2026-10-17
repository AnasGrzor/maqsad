import { getTranslations } from "next-intl/server";
import { card, Chip, countries, CredentialBadge } from "@/components/listings";
import { ConnectionActions, ConnectionRequestForm } from "@/components/profile-forms";
import { requireRole } from "@/lib/auth";
import { getAgent, openConnectionWith, UUID } from "@/lib/data";

export default async function AgentPage({ params }: PageProps<"/[locale]/student/agents/[id]">) {
  const user = await requireRole("student");
  const { id } = await params;
  const [t, tax, c, dir] = await Promise.all([
    getTranslations("agentDetail"),
    getTranslations("taxonomy"),
    getTranslations("connections"),
    getTranslations("directory"),
  ]);
  const [agent, connection] = UUID.test(id) ? await Promise.all([getAgent(id), openConnectionWith(id)]) : [null, null];
  if (!agent) return <p className="text-soft">{t("notFound")}</p>;

  const details: [string, string][] = (
    [
      [t("city"), agent.city],
      [t("destinations"), await countries(agent.destinations)],
      [t("specialisations"), agent.specialisations.map((f) => tax(`fields.${f}` as "fields.other")).join(", ")],
      [t("levels"), agent.levels.map((l) => tax(`levels.${l}`)).join(", ")],
    ] as [string, string][]
  ).filter(([, v]) => v);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{agent.agency_name}</h1>
          <p className="mt-1 text-soft">{tax(`agentKinds.${agent.kind}`)}</p>
        </div>
        {agent.verified ? <Chip tone="bg-turq-soft text-ink">{dir("verified")}</Chip> : <Chip tone="bg-line text-soft">{dir("notVerified")}</Chip>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section className={card}>
            <h2 className="font-semibold">{t("fees")}</h2>
            <p dir="auto" className="mt-2 text-sm whitespace-pre-line">{agent.fees || dir("noFees")}</p>
          </section>
          {agent.about && (
            <section className={card}>
              <h2 className="font-semibold">{t("about")}</h2>
              <p dir="auto" className="mt-2 text-sm whitespace-pre-line">{agent.about}</p>
            </section>
          )}
          <section className={card}>
            <h2 className="font-semibold">{t("credentials")}</h2>
            {agent.credentials.length ? (
              <ul className="mt-3 divide-y divide-line text-sm">
                {agent.credentials.map((cr) => (
                  <li key={cr.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span>
                      <span className="font-medium">{tax(`credentialKinds.${cr.kind}`)}</span>
                      <span className="text-soft">
                        {" · "}
                        {cr.issuer}
                        {cr.reference && ` · ${cr.reference}`}
                      </span>
                    </span>
                    <CredentialBadge status={cr.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-soft">{t("credentialsNone")}</p>
            )}
            <p className="mt-3 text-xs text-soft">{t("credentialsNote")}</p>
          </section>
        </div>

        <aside className="space-y-6">
          <section className={card}>
            <h2 className="font-semibold">{t("details")}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {details.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-soft">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              {agent.website && (
                <div>
                  <dt className="text-soft">{t("website")}</dt>
                  <dd>
                    <a href={agent.website} target="_blank" rel="noopener noreferrer nofollow" dir="ltr" className="break-all underline underline-offset-4">
                      {agent.website}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </section>
          <section className="rounded-2xl bg-tint p-5 ring-1 ring-tint-strong">
            {connection ? (
              <div className="space-y-3">
                <Chip>{c(connection.status === "accepted" ? "statusAccepted" : "statusPending")}</Chip>
                {connection.status === "pending" && connection.requested_by === user.id && (
                  <ConnectionActions id={connection.id} actions={["withdraw"]} />
                )}
                {connection.status === "pending" && connection.requested_by !== user.id && (
                  <>
                    <p className="text-xs text-soft">{c("acceptNote")}</p>
                    <ConnectionActions id={connection.id} actions={["accept", "decline"]} />
                  </>
                )}
              </div>
            ) : (
              <ConnectionRequestForm target={agent.user_id} />
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
