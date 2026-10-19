import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole, type Role } from "@/lib/auth";
import { getAgentProfile, getStudentProfile, listConnections, namesOf } from "@/lib/data";
import type { Feature } from "@/lib/features";
import { AgentWork } from "./agent-work";
import { ProfileForm } from "./auth-forms";
import { FeatureList } from "./feature-list";
import { ConnectionList } from "./listings";
import { PlanSection } from "./plan-section";
import { AgentProfileForm, StudentProfileForm } from "./profile-forms";
import { cta } from "./styles";

const OVERVIEW: Record<"student" | "agent", Feature[]> = {
  student: ["documentCheck", "studentProfile", "profileVisibility", "agentDirectory", "connections", "caseTracking"],
  agent: ["agentProfile", "credentialSubmission", "studentDiscovery", "matching", "connections", "caseTracking"],
};

export function Notice({ children, href, action }: { children: React.ReactNode; href?: string; action?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warm-soft p-4 ring-1 ring-warm">
      <p className="max-w-[60ch] text-sm">{children}</p>
      {href && action && (
        <Link href={href} className={`${cta} min-h-9 bg-primary px-4 text-sm text-on-primary hover:bg-primary-hover`}>
          {action}
        </Link>
      )}
    </div>
  );
}

export async function Overview({ role }: { role: "student" | "agent" }) {
  const user = await requireRole(role);
  const [t, nav, profile] = await Promise.all([
    getTranslations(),
    getTranslations("dashboard.nav"),
    role === "student" ? getStudentProfile(user.id) : getAgentProfile(user.id),
  ]);
  const connections = role === "student" ? await listConnections() : [];
  const names = await namesOf(connections.map((c) => c.agent_id));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("dashboard.welcome", { name: user.displayName })}</h1>
        <p className="mt-2 max-w-[68ch] text-soft">{t("dashboard.overviewIntro")}</p>
      </header>
      {!profile && (
        <Notice href={`/${role}/settings`} action={nav(role === "student" ? "settings" : "subscription")}>
          {t(role === "student" ? "studentProfile.missing" : "agentProfile.missing")}
        </Notice>
      )}
      {role === "student" && (
        <section>
          <h2 className="mb-4 text-xl font-semibold tracking-tight">{t("connections.studentTitle")}</h2>
          <ConnectionList connections={connections} me={user.id} names={names} labels={new Map()} />
        </section>
      )}
      {role === "agent" && <AgentWork agentId={user.id} />}
      <Link href="/check" className={`${cta} bg-primary text-on-primary hover:bg-primary-hover`}>
        {t("dashboard.checkCta")}
      </Link>
      <FeatureList items={OVERVIEW[role]} />
    </div>
  );
}

export async function Settings({ role }: { role: Role }) {
  const user = await requireRole(role);
  const [t, studentProfile, agentProfile] = await Promise.all([
    getTranslations(),
    role === "student" ? getStudentProfile(user.id) : null,
    role === "agent" ? getAgentProfile(user.id) : null,
  ]);
  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("dashboard.settings.title")}</h1>
      {role !== "admin" && (
        <section className="space-y-4">
          <header>
            <h2 className="text-xl font-semibold tracking-tight">{t(role === "student" ? "studentProfile.title" : "agentProfile.title")}</h2>
            <p className="mt-1 max-w-[68ch] text-sm text-soft">{t(role === "student" ? "studentProfile.intro" : "agentProfile.intro")}</p>
          </header>
          {role === "student" ? <StudentProfileForm profile={studentProfile} /> : <AgentProfileForm profile={agentProfile} />}
        </section>
      )}
      {role !== "admin" && <PlanSection userId={user.id} role={role} />}
      <section className="rounded-2xl bg-card p-6 ring-1 ring-line">
        <h2 className="font-semibold">{t("dashboard.settings.account")}</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
          <dt className="text-soft">{t("dashboard.settings.email")}</dt>
          <dd className="[overflow-wrap:anywhere]">{user.email}</dd>
          <dt className="text-soft">{t("dashboard.settings.role")}</dt>
          <dd>{t(`dashboard.roles.${user.role}`)}</dd>
        </dl>
        <div className="mt-6">
          <ProfileForm displayName={user.displayName} />
        </div>
      </section>
    </div>
  );
}
