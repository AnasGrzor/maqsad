import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PageHeading, StatusBadge } from "@/components/feature-list";
import { PlanPrice } from "@/components/plan-section";
import { FEATURES, type Feature } from "@/lib/features";
import { getPlans, type PlanRow } from "@/lib/plans";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("pricing"))("title") };
}

// Plans come from the database (cached, tag "plans"; admin edits refresh it).
export default async function Pricing() {
  const [t, n, plans] = await Promise.all([getTranslations("pricing"), getTranslations("pricingPlans"), getPlans()]);
  return (
    <div className="space-y-12">
      <PageHeading title={t("title")} intro={t("intro")} />
      {(["student", "agent"] as const).map((audience) => (
        <section key={audience}>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">{t(audience === "student" ? "students" : "agents")}</h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {plans
              .filter((p) => p.audience === audience)
              .map((p) => (
                <PlanCard key={p.id} plan={p} />
              ))}
          </ul>
        </section>
      ))}
      <div className="max-w-3xl space-y-2 text-sm text-soft">
        <p className="font-medium text-ink">{n("notVerified")}</p>
        <p>{n("limitsNote")}</p>
        <p>{n("betaNote")}</p>
      </div>
    </div>
  );
}

const isFeature = (key: string): key is Feature => key in FEATURES;

function PlanCard({ plan }: { plan: PlanRow }) {
  const t = useTranslations("pricing");
  const f = useTranslations("features");
  const features = plan.features.filter(isFeature);

  return (
    <li className={`flex flex-col rounded-2xl p-6 ring-1 ${plan.offered ? "bg-card ring-line" : "bg-tint-soft ring-tint-strong"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-semibold">{t.has(`plans.${plan.id}` as "plans.agency") ? t(`plans.${plan.id}` as "plans.agency") : plan.id}</h3>
        {!plan.offered && <span className="rounded-full bg-line px-2.5 py-0.5 text-xs font-medium text-soft">{t("notOffered")}</span>}
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight">
        <PlanPrice price={plan.price_monthly_pkr} />
      </p>
      {plan.verification_reports_per_month !== null && (
        <p className="mt-1 text-sm text-soft">{t("reports", { count: plan.verification_reports_per_month })}</p>
      )}
      {features.length > 0 ? (
        <ul className="mt-5 space-y-2.5 text-sm">
          {features.map((feature) => (
            <li key={feature} className="flex flex-wrap items-center justify-between gap-2">
              <span>{f(`${feature}.title`)}</span>
              <StatusBadge available={FEATURES[feature]} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-soft">{t("teamSoon")}</p>
      )}
    </li>
  );
}
