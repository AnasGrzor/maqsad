import { getLocale, getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/feature-list";
import { AgentCard, FilterBar, pick } from "@/components/listings";
import { requireRole } from "@/lib/auth";
import { getStudentProfile, listAgents } from "@/lib/data";
import { match } from "@/lib/matching";
import { COUNTRIES, countryName, GOALS } from "@/lib/taxonomy";

const SERVES = { study: ["education", "both"], work: ["recruitment", "both"], both: ["education", "recruitment", "both"] };

export default async function FindAgents({ searchParams }: PageProps<"/[locale]/student/agents">) {
  const user = await requireRole("student");
  const [t, tax, locale, params, agents, profile] = await Promise.all([
    getTranslations("directory"),
    getTranslations("taxonomy"),
    getLocale(),
    searchParams,
    listAgents(),
    getStudentProfile(user.id),
  ]);
  const destination = pick(params.destination, COUNTRIES);
  const service = pick(params.service, GOALS);
  const verifiedOnly = params.verified === "1";

  const shown = agents
    .filter((a) => !destination || a.destinations.includes(destination))
    .filter((a) => !service || SERVES[service].includes(a.kind))
    .filter((a) => !verifiedOnly || a.verified)
    .map((a) => ({ agent: a, ...(profile ? match(profile, a) : { score: 0, reasons: [] }) }))
    .sort((x, y) => y.score - x.score);

  return (
    <div className="space-y-6">
      <PageHeading title={t("title")} intro={t("intro")} />
      <FilterBar
        filters={[
          { name: "destination", label: t("destination"), value: destination, options: COUNTRIES.map((c) => ({ value: c, label: countryName(c, locale) })) },
          { name: "service", label: t("service"), value: service, options: GOALS.map((g) => ({ value: g, label: tax(`goals.${g}`) })) },
        ]}
        toggle={{ name: "verified", label: t("verifiedOnly"), on: verifiedOnly }}
      />
      {!profile && <p className="text-sm text-soft">{t("profileHint")}</p>}
      <p className="text-sm font-medium">{t("results", { count: shown.length })}</p>
      <ul className="grid gap-4 md:grid-cols-2">
        {shown.map(({ agent, reasons }) => (
          <AgentCard key={agent.user_id} agent={agent} reasons={reasons} />
        ))}
      </ul>
    </div>
  );
}
