import { useLocale, useTranslations } from "next-intl";
import { Mark, TileBand } from "@/components/brand";
import { DocumentCheckFeature } from "@/components/highlights";
import { cta } from "@/components/styles";
import { Link } from "@/i18n/navigation";

const primary = `${cta} bg-primary text-on-primary hover:shadow-[0_6px_18px_-8px_var(--primary)]`;
const ghost = `${cta} text-ink ring-1 ring-line ring-inset hover:ring-ink`;
const ghostSmall = `${ghost} min-h-9 rounded-[10px] px-3.5 text-sm`;
const heading = "text-[clamp(26px,3.4vw,38px)] leading-[1.1] font-bold rtl:leading-[1.7]";

const AUDIENCES = [
  { who: "students", items: [1, 2, 3, 4], join: "/register", guide: "/how-it-works#students", tone: "bg-card" },
  { who: "agents", items: [1, 2, 3, 4], join: "/register?as=consultant", guide: "/how-it-works#consultants", tone: "bg-tint" },
] as const;

export default function Home() {
  const t = useTranslations("home");
  const en = useLocale() === "en";
  return (
    <div className="grid gap-24">
      <section className="grid items-center gap-10 pt-2 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:gap-14">
        <div className="grid gap-5.5">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="text-[clamp(38px,6.2vw,68px)] leading-[1.02] font-extrabold rtl:leading-[1.7]">{t.rich("title", { mark: (c) => <mark>{c}</mark> })}</h1>
          <p className="max-w-[58ch] text-lg text-pretty text-soft">{t("intro")}</p>
          {en && (
            <p lang="ur" dir="rtl" className="w-fit text-xl text-soft">
              {t("urduLine")}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className={primary}>
              {t("ctaStart")}
            </Link>
            <Link href="/check" className={ghost}>
              {t("ctaCheck")}
            </Link>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[320px] md:me-0 md:max-w-[420px]">
          <svg viewBox="0 0 400 400" aria-hidden className="roundel-scroll aspect-square w-full">
            <circle cx="200" cy="200" r="196" fill="none" stroke="var(--primary)" strokeWidth="1.5" />
            <circle cx="200" cy="200" r="174" fill="url(#tile)" />
            <circle cx="200" cy="200" r="174" fill="none" stroke="var(--marble)" strokeWidth="4" />
            <circle cx="200" cy="200" r="104" fill="var(--marble)" stroke="var(--lapis)" strokeWidth="2" />
            <g className="roundel-drop">
              <use href="#mark" x="130" y="130" width="140" height="140" color="var(--lapis)" />
            </g>
          </svg>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {AUDIENCES.map(({ who, items, join, guide, tone }) => (
          <section key={who} aria-labelledby={who} className={`grid content-start gap-7 rounded-[26px] border border-line p-[clamp(24px,4vw,40px)] ${tone}`}>
            <div className="grid gap-2.5">
              <p className="eyebrow">{t(`${who}Eyebrow`)}</p>
              <h2 id={who} className={heading}>
                {t(`${who}Title`)}
              </h2>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2">
              {items.map((n) => {
                const key = `${who === "students" ? "student" : "agent"}${n}` as "student1";
                return (
                  <li key={n} className="grid content-start gap-2">
                    <span aria-hidden className="glyph" />
                    <h3 className="font-sans text-base font-semibold tracking-normal">{t(`${key}Title`)}</h3>
                    <p className="text-[14.5px] text-pretty text-soft">{t(`${key}Body`)}</p>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-3">
              <Link href={join} className={`${primary} min-h-10 text-sm`}>
                {t(`${who}Cta`)}
              </Link>
              <Link href={guide} className={ghostSmall}>
                {t("guideLink")}
              </Link>
            </div>
          </section>
        ))}
      </div>

      <DocumentCheckFeature />

      <section aria-labelledby="steps" className="grid gap-6.5">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="grid max-w-[640px] gap-2.5">
            <p className="eyebrow">{t("stepsEyebrow")}</p>
            <h2 id="steps" className={heading}>
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

      <section aria-labelledby="closing" className="overflow-hidden rounded-[26px] bg-band">
        <TileBand />
        <div className="grid justify-items-center gap-5 p-[clamp(32px,6vw,72px)] text-center">
          <Mark className="logo-scroll size-12" />
          <h2 id="closing" className={`${heading} max-w-[22ch]`}>
            {t("closingTitle")}
          </h2>
          <p className="max-w-[52ch] text-soft">{t("closingBody")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/register" className={primary}>
              {t("studentsCta")}
            </Link>
            <Link href="/register?as=consultant" className={ghost}>
              {t("agentsCta")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
