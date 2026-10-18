import { useLocale, useTranslations } from "next-intl";
import { TileBand } from "@/components/brand";
import { FeatureList } from "@/components/feature-list";
import { cta } from "@/components/styles";
import { Link } from "@/i18n/navigation";
import type { Feature } from "@/lib/features";

const FEATURES: Feature[] = [
  "documentCheck",
  "accounts",
  "agentDirectory",
  "credentialSubmission",
  "matching",
  "caseTracking",
  "feeRecords",
  "complaints",
];

const primary = `${cta} bg-primary text-on-primary hover:shadow-[0_6px_18px_-8px_var(--primary)]`;
const ghost = `${cta} text-ink ring-1 ring-line ring-inset hover:ring-ink`;
const ghostSmall = `${ghost} min-h-9 rounded-[10px] px-3.5 text-sm`;

export default function Home() {
  const t = useTranslations("home");
  const nav = useTranslations("nav");
  const en = useLocale() === "en";
  return (
    <div className="grid gap-18">
      <section className="grid items-center gap-8 pt-2 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:gap-14">
        <div className="grid gap-5.5">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="text-[clamp(34px,5.6vw,60px)] leading-[1.02] font-extrabold rtl:leading-[1.7]">{t.rich("title", { mark: (c) => <mark>{c}</mark> })}</h1>
          <p className="max-w-[60ch] text-lg text-pretty text-soft">{t("intro")}</p>
          {en && (
            <p lang="ur" dir="rtl" className="max-w-[34ch] text-xl text-soft">
              {t("urduLine")}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href="/check" className={primary}>
              {t("ctaCheck")}
            </Link>
            <Link href="/register" className={ghost}>
              {t("ctaRegister")}
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[340px] md:me-0 md:max-w-[420px]">
          <svg viewBox="0 0 400 400" aria-hidden className="aspect-square w-full">
            <circle cx="200" cy="200" r="196" fill="none" stroke="var(--primary)" strokeWidth="1.5" />
            <circle cx="200" cy="200" r="174" fill="url(#tile)" />
            <circle cx="200" cy="200" r="174" fill="none" stroke="var(--marble)" strokeWidth="4" />
            <circle cx="200" cy="200" r="104" fill="var(--marble)" stroke="var(--lapis)" strokeWidth="2" />
            <g className="roundel-drop">
              <use href="#mark" x="130" y="130" width="140" height="140" color="var(--lapis)" />
            </g>
          </svg>
          <div className="relative -mt-22 grid gap-2.5 rounded-[18px] border border-line bg-card p-4.5 shadow-float md:absolute md:-start-16 md:-bottom-10 md:mt-0 md:w-[min(330px,92%)]">
            <div className="flex items-center justify-between gap-2.5">
              <span className="font-mono text-[11.5px] font-medium tracking-[0.06em] text-warm-ink uppercase">{t("exampleLabel")}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-risk-high-bg px-2.5 py-0.5 text-[12.5px] font-semibold text-risk-high before:size-1.5 before:rounded-full before:bg-current">
                {t("exampleRisk")}
              </span>
            </div>
            <h2 className="font-sans text-base font-semibold tracking-normal">{t("exampleTitle")}</h2>
            <p className="text-sm text-soft">{t.rich("exampleBody", { b: (c) => <b className="text-ink">{c}</b> })}</p>
          </div>
        </div>
      </section>

      <section aria-label={t("sourcesLabel")} className="flex flex-wrap items-center gap-x-6.5 gap-y-2.5 border-y border-line py-4.5">
        <span className="eyebrow me-1.5">{t("sourcesLabel")}</span>
        {(["source1", "source2", "source3", "source4", "source5"] as const).map((k) => (
          <span key={k} className="rhombus inline-flex items-center gap-2 text-[14.5px] font-semibold">
            {t(k)}
          </span>
        ))}
      </section>

      <section aria-labelledby="building" className="grid gap-6.5">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="grid max-w-[640px] gap-2.5">
            <p className="eyebrow">{t("buildingTitle")}</p>
            <h2 id="building" className="text-[clamp(26px,3.4vw,38px)] leading-[1.1] font-bold rtl:leading-[1.7]">
              {t("buildingIntro")}
            </h2>
          </div>
          <Link href="/trust" className={ghostSmall}>
            {t("howChecks")}
          </Link>
        </div>
        <FeatureList items={FEATURES} />
      </section>

      <section aria-labelledby="steps" className="grid gap-6.5">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="grid max-w-[640px] gap-2.5">
            <p className="eyebrow">{nav("howItWorks")}</p>
            <h2 id="steps" className="text-[clamp(26px,3.4vw,38px)] leading-[1.1] font-bold rtl:leading-[1.7]">
              {t("stepsTitle")}
            </h2>
          </div>
          <Link href="/how-it-works" className={ghostSmall}>
            {t("allSteps")}
          </Link>
        </div>
        <ol className="grid divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-card md:grid-cols-3 md:divide-x md:divide-y-0 rtl:md:divide-x-reverse">
          {([1, 2, 3] as const).map((n) => (
            <li key={n} className="grid content-start gap-2 p-6">
              <span aria-hidden className="font-heading text-[34px] leading-none font-extrabold text-decor tabular-nums">
                {n}
              </span>
              <h3 className="text-xl font-bold">{t(`step${n}Title`)}</h3>
              <p className="text-[15px] text-soft">{t(`step${n}Body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="never" className="overflow-hidden rounded-[26px] bg-band">
        <TileBand />
        <div className="grid gap-10 p-[clamp(28px,5vw,56px)] md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid content-start gap-3.5">
            <p className="eyebrow">{t("neverEyebrow")}</p>
            <h2 id="never" className="text-[clamp(26px,3.4vw,38px)] leading-[1.1] font-bold rtl:leading-[1.7]">
              {t("neverTitle")}
            </h2>
            <p className="text-soft">{t("neverBody")}</p>
          </div>
          <ul className="grid">
            {(["never1", "never2", "never3", "never4"] as const).map((k) => (
              <li key={k} className="no-mark flex gap-3 border-t border-band-line py-4 text-[16.5px] first:border-t-0 first:pt-0">
                {t(k)}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
