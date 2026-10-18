import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PageHeading, StatusBadge } from "@/components/feature-list";
import { Link } from "@/i18n/navigation";
import { FEATURES, type Feature } from "@/lib/features";
import { cta } from "@/components/styles";

type Who = "whoStudent" | "whoAgent" | "whoBoth";

const STEPS: [string, Feature, Who][] = [
  ["step1", "studentProfile", "whoStudent"],
  ["step2", "profileVisibility", "whoStudent"],
  ["step3", "studentDiscovery", "whoAgent"],
  ["step4", "connections", "whoAgent"],
  ["step5", "connections", "whoStudent"],
  ["step6", "messaging", "whoBoth"],
  ["step7", "caseTracking", "whoBoth"],
];

const RISKS = [
  ["high", "bg-risk-high-bg text-risk-high"],
  ["medium", "bg-risk-med-bg text-risk-med"],
  ["incomplete", "bg-risk-inc-bg text-risk-inc"],
  ["low", "bg-risk-low-bg text-risk-low"],
] as const;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("howItWorks"))("title") };
}

export default function HowItWorks() {
  const t = useTranslations("howItWorks");
  const nav = useTranslations("nav");
  const risk = useTranslations("checker.risk");
  return (
    <div className="grid gap-18">
      <PageHeading title={t("title")} intro={t("intro")} />

      <div className="grid items-start gap-8 md:grid-cols-2">
        <ol className="grid">
          {STEPS.map(([key, feature, who], i) => (
            <li
              key={key}
              className="relative grid grid-cols-[56px_minmax(0,1fr)] gap-4.5 pb-6.5 after:absolute after:start-[27px] after:top-[46px] after:bottom-1 after:w-0.5 after:bg-[repeating-linear-gradient(var(--line)_0_6px,transparent_6px_11px)] last:after:hidden"
            >
              <span
                aria-hidden
                className="grid h-[46px] w-14 place-items-center rounded-b-lg bg-primary font-heading text-lg font-extrabold text-on-primary tabular-nums [clip-path:polygon(50%_0,100%_30%,100%_100%,0_100%,0_30%)]"
              >
                {i + 1}
              </span>
              <div>
                <span className="eyebrow text-accent-ink">{t(who)}</span>
                <p className="flex flex-wrap items-start justify-between gap-2 pt-0.5 text-[17px]">
                  {t(key as "step1")}
                  <StatusBadge available={FEATURES[feature]} />
                </p>
              </div>
            </li>
          ))}
        </ol>

        <aside className="grid gap-4 rounded-[18px] border border-line bg-card p-5.5">
          <p className="eyebrow">{t("checkEyebrow")}</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[clamp(26px,3.4vw,38px)] leading-[1.1] font-bold rtl:leading-[1.7]">{t("checkTitle")}</h2>
            <StatusBadge available={FEATURES.documentCheck} />
          </div>
          <p className="text-pretty text-soft">{t("checkBody")}</p>
          <dl className="grid gap-2.5 text-[14.5px] text-soft">
            {RISKS.map(([k, tone]) => (
              <div key={k} className="grid items-center gap-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-3.5">
                <dt>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold whitespace-nowrap before:size-1.5 before:rounded-full before:bg-current ${tone}`}>
                    {risk(`${k}.title`)}
                  </span>
                </dt>
                <dd>{risk(`${k}.advice`)}</dd>
              </div>
            ))}
          </dl>
          <Link href="/check" className={`${cta} justify-self-start bg-primary text-on-primary hover:bg-primary-hover`}>
            {nav("check")}
          </Link>
        </aside>
      </div>
    </div>
  );
}
