import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PageHeading, StatusBadge } from "@/components/feature-list";
import { Link } from "@/i18n/navigation";
import { FEATURES, type Feature } from "@/lib/features";
import { cta } from "@/components/styles";

const STEPS: [string, Feature][] = [
  ["step1", "studentProfile"],
  ["step2", "profileVisibility"],
  ["step3", "studentDiscovery"],
  ["step4", "connections"],
  ["step5", "connections"],
  ["step6", "messaging"],
  ["step7", "caseTracking"],
];

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("howItWorks"))("title") };
}

export default function HowItWorks() {
  const t = useTranslations("howItWorks");
  const nav = useTranslations("nav");
  return (
    <div className="space-y-12">
      <PageHeading title={t("title")} intro={t("intro")} />

      <ol className="max-w-3xl space-y-3">
        {STEPS.map(([key, feature], i) => (
          <li key={key} className="flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-fog">
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-semibold text-ice tabular-nums"
            >
              {i + 1}
            </span>
            <p className="min-w-0 flex-1">{t(key as "step1")}</p>
            <StatusBadge available={FEATURES[feature]} />
          </li>
        ))}
      </ol>

      <section className="max-w-3xl rounded-2xl bg-mint-soft p-6 ring-1 ring-mint">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{t("checkTitle")}</h2>
          <StatusBadge available={FEATURES.documentCheck} />
        </div>
        <p className="mt-2 text-pretty text-slate">{t("checkBody")}</p>
        <Link href="/check" className={`${cta} mt-5 bg-navy-900 text-ice hover:bg-navy-800`}>
          {nav("check")}
        </Link>
      </section>
    </div>
  );
}
