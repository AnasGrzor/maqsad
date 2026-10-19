import { getTranslations } from "next-intl/server";
import { Notice } from "@/components/dashboard-pages";
import { PageHeading } from "@/components/feature-list";
import { AgentCard } from "@/components/listings";
import { cta } from "@/components/styles";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { getStudentProfile, listAgents } from "@/lib/data";
import { match, rank } from "@/lib/matching";

export default async function Matches() {
  const user = await requireRole("student");
  const [t, nav, profile, agents] = await Promise.all([
    getTranslations("matching"),
    getTranslations("dashboard.nav"),
    getStudentProfile(user.id),
    listAgents(),
  ]);

  const ranked = profile ? rank(agents, (a) => match(profile, a), 20) : [];

  return (
    <div className="space-y-6">
      <PageHeading title={t("studentTitle")} intro={t("studentIntro")} />
      {!profile ? (
        <Notice href="/student/settings" action={nav("settings")}>
          {t("studentProfileFirst")}
        </Notice>
      ) : ranked.length === 0 ? (
        <p className="text-soft">{t("studentEmpty")}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {ranked.map(({ item, reasons }) => (
            <AgentCard key={item.user_id} agent={item} reasons={reasons} />
          ))}
        </ul>
      )}
      <Link href="/student/agents" className={`${cta} min-h-10 text-sm text-ink ring-1 ring-line ring-inset hover:ring-ink`}>
        {t("browseAll")}
      </Link>
    </div>
  );
}
