import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole, type Role } from "@/lib/auth";
import type { Feature } from "@/lib/features";
import { ProfileForm } from "./auth-forms";
import { FeatureList } from "./feature-list";
import { cta } from "./styles";

const OVERVIEW: Record<"student" | "agent", Feature[]> = {
  student: ["documentCheck", "studentProfile", "profileVisibility", "agentDirectory", "connections", "caseTracking"],
  agent: ["agentProfile", "credentialSubmission", "studentDiscovery", "matching", "connections", "caseTracking"],
};

export async function Overview({ role }: { role: "student" | "agent" }) {
  const [user, t] = await Promise.all([requireRole(role), getTranslations("dashboard")]);
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("welcome", { name: user.displayName })}</h1>
        <p className="mt-2 max-w-[68ch] text-slate">{t("overviewIntro")}</p>
      </header>
      <Link href="/check" className={`${cta} bg-navy-900 text-ice hover:bg-navy-800`}>
        {t("checkCta")}
      </Link>
      <FeatureList items={OVERVIEW[role]} />
    </div>
  );
}

export async function Settings({ role }: { role: Role }) {
  const [user, t] = await Promise.all([requireRole(role), getTranslations("dashboard")]);
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("settings.title")}</h1>
      <section className="rounded-2xl bg-card p-6 ring-1 ring-fog">
        <h2 className="font-semibold">{t("settings.account")}</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
          <dt className="text-slate">{t("settings.email")}</dt>
          <dd className="[overflow-wrap:anywhere]">{user.email}</dd>
          <dt className="text-slate">{t("settings.role")}</dt>
          <dd>{t(`roles.${user.role}`)}</dd>
        </dl>
      </section>
      <ProfileForm displayName={user.displayName} />
    </div>
  );
}
