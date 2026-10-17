import { useTranslations } from "next-intl";
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

export default function Home() {
  const t = useTranslations("home");
  return (
    <div className="space-y-16">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">{t("title")}</h1>
        <p className="mt-5 text-pretty text-slate sm:text-lg">{t("intro")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register" className={`${cta} bg-navy-900 text-ice hover:bg-navy-800`}>
            {t("ctaRegister")}
          </Link>
          <Link href="/check" className={`${cta} bg-lavender-100 text-navy-900 ring-1 ring-lavender-200 hover:bg-lavender-200`}>
            {t("ctaCheck")}
          </Link>
        </div>
      </section>

      <section aria-labelledby="building">
        <h2 id="building" className="text-2xl font-semibold tracking-tight">
          {t("buildingTitle")}
        </h2>
        <p className="mt-2 mb-6 max-w-[68ch] text-slate">{t("buildingIntro")}</p>
        <FeatureList items={FEATURES} />
      </section>

      <section aria-labelledby="never" className="rounded-2xl bg-lavender-100 p-6 ring-1 ring-lavender-200 sm:p-8">
        <h2 id="never" className="text-2xl font-semibold tracking-tight">
          {t("neverTitle")}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {(["never1", "never2", "never3", "never4"] as const).map((k) => (
            <li key={k} className="flex gap-3">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-navy-900" />
              {t(k)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
