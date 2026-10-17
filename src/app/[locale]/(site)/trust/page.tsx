import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { FeatureList, PageHeading } from "@/components/feature-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("trust"))("title") };
}

export default function Trust() {
  const t = useTranslations("trust");
  return (
    <div className="space-y-12">
      <PageHeading title={t("title")} intro={t("intro")} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-card p-6 ring-1 ring-fog">
          <h2 className="text-xl font-semibold tracking-tight">{t("nowTitle")}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {(["now1", "now2", "now3", "now4", "now5", "now6", "now7"] as const).map((k) => (
              <li key={k} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-mint text-[10px] text-navy-800"
                >
                  ✓
                </span>
                {t(k)}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-card p-6 ring-1 ring-fog">
          <h2 className="text-xl font-semibold tracking-tight">{t("findingTitle")}</h2>
          <ol className="mt-4 list-decimal space-y-2.5 ps-5 text-sm">
            {(["finding1", "finding2", "finding3", "finding4", "finding5"] as const).map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ol>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-xl font-semibold tracking-tight">{t("failTitle")}</h2>
          <p className="mt-2 text-pretty text-slate">{t("failBody")}</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold tracking-tight">{t("scoreTitle")}</h2>
          <p className="mt-2 text-pretty text-slate">{t("scoreBody")}</p>
        </section>
      </div>

      <section>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">{t("plannedTitle")}</h2>
        <FeatureList items={["credentialSubmission", "adminReview", "deepfakeDetection", "auditLog"]} />
      </section>
    </div>
  );
}
