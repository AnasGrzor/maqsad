import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/feature-list";
import { cta } from "@/components/styles";
import { Link } from "@/i18n/navigation";

const GUIDES = [
  { id: "students", anchor: "students", prefix: "s", join: "/register" },
  { id: "agents", anchor: "consultants", prefix: "a", join: "/register?as=consultant" },
] as const;

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
  const home = useTranslations("home");
  const risk = useTranslations("checker.risk");
  return (
    <div className="grid gap-16">
      <PageHeading title={t("title")} intro={t("intro")} />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {GUIDES.map(({ id, anchor, prefix, join }) => (
          <section key={id} id={anchor} aria-labelledby={`${id}-title`} className="grid scroll-mt-24 gap-6 rounded-[22px] border border-line bg-card p-6 sm:p-8">
            <h2 id={`${id}-title`} className="text-[clamp(24px,3vw,32px)] leading-[1.1] font-bold rtl:leading-[1.7]">
              {t(`${id}Title`)}
            </h2>
            <ol className="grid">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <li
                  key={n}
                  className="relative grid grid-cols-[44px_minmax(0,1fr)] gap-4 pb-6 after:absolute after:start-[21px] after:top-[40px] after:bottom-1 after:w-0.5 after:bg-[repeating-linear-gradient(var(--line)_0_6px,transparent_6px_11px)] last:pb-0 last:after:hidden"
                >
                  <span
                    aria-hidden
                    className="grid h-10 w-11 place-items-center rounded-b-lg bg-primary font-heading text-base font-extrabold text-on-primary tabular-nums [clip-path:polygon(50%_0,100%_30%,100%_100%,0_100%,0_30%)]"
                  >
                    {n}
                  </span>
                  <div className="grid gap-1 pt-1">
                    <h3 className="font-sans text-base font-semibold tracking-normal">{t(`${prefix}${n}Title`)}</h3>
                    <p className="text-[15px] text-pretty text-soft">{t(`${prefix}${n}Body`)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href={join} className={`${cta} min-h-10 justify-self-start bg-primary text-sm text-on-primary hover:bg-primary-hover`}>
              {home(id === "students" ? "studentsCta" : "agentsCta")}
            </Link>
          </section>
        ))}
      </div>

      <section className="grid gap-4 rounded-[18px] border border-line bg-tint p-6 sm:p-8">
        <p className="eyebrow">{t("checkEyebrow")}</p>
        <h2 className="text-[clamp(24px,3vw,32px)] leading-[1.1] font-bold rtl:leading-[1.7]">{t("checkTitle")}</h2>
        <p className="max-w-[60ch] text-pretty text-soft">{t("checkBody")}</p>
        <dl className="grid gap-2.5 text-[14.5px] text-soft md:grid-cols-2">
          {RISKS.map(([k, tone]) => (
            <div key={k} className="grid items-center gap-1 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-3.5">
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
      </section>
    </div>
  );
}
