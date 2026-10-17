import type { Metadata } from "next";
import { useFormatter, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PageHeading, StatusBadge } from "@/components/feature-list";
import { FEATURES } from "@/lib/features";
import { PLANS, type Plan } from "@/lib/plans";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("pricing"))("title") };
}

export default function Pricing() {
  const t = useTranslations("pricing");
  return (
    <div className="space-y-12">
      <PageHeading title={t("title")} intro={t("intro")} />
      {(["student", "agent"] as const).map((audience) => (
        <section key={audience}>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">{t(audience === "student" ? "students" : "agents")}</h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {PLANS.filter((p) => p.audience === audience).map((p) => (
              <PlanCard key={p.id} plan={p} />
            ))}
          </ul>
        </section>
      ))}
      <div className="max-w-3xl space-y-2 text-sm text-slate">
        <p>{t("limitsNote")}</p>
        <p>{t("betaNote")}</p>
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const t = useTranslations("pricing");
  const f = useTranslations("features");
  const format = useFormatter();
  const price =
    plan.priceMonthlyPkr === 0
      ? t("free")
      : plan.priceMonthlyPkr === null
        ? t("tbd")
        : t("perMonth", { price: format.number(plan.priceMonthlyPkr) });

  return (
    <li className={`flex flex-col rounded-2xl p-6 ring-1 ${plan.offered ? "bg-card ring-fog" : "bg-lavender-50 ring-lavender-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-semibold">{t(`plans.${plan.id}`)}</h3>
        {!plan.offered && <span className="rounded-full bg-fog px-2.5 py-0.5 text-xs font-medium text-slate">{t("notOffered")}</span>}
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{price}</p>
      {plan.verificationReportsPerMonth !== null && (
        <p className="mt-1 text-sm text-slate">{t("reports", { count: plan.verificationReportsPerMonth })}</p>
      )}
      {plan.features.length > 0 ? (
        <ul className="mt-5 space-y-2.5 text-sm">
          {plan.features.map((feature) => (
            <li key={feature} className="flex flex-wrap items-center justify-between gap-2">
              <span>{f(`${feature}.title`)}</span>
              <StatusBadge available={FEATURES[feature]} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-slate">{t("teamSoon")}</p>
      )}
    </li>
  );
}
