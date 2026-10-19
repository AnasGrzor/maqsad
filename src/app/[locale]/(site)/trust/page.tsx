import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/feature-list";
import { cta } from "@/components/styles";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("trust"))("title") };
}

const PILLARS = ["verified", "fees", "control", "record", "checks", "people"] as const;

export default function Trust() {
  const t = useTranslations("trust");
  return (
    <div className="grid gap-14">
      <PageHeading title={t("title")} intro={t("intro")} />

      <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {PILLARS.map((k) => (
          <li key={k} className="grid content-start gap-2.5 rounded-2xl border border-line bg-card p-6">
            <span aria-hidden className="glyph" />
            <h2 className="font-sans text-lg font-semibold tracking-normal">{t(`${k}Title`)}</h2>
            <p className="text-[15px] text-pretty text-soft">{t(`${k}Body`)}</p>
          </li>
        ))}
      </ul>

      <Link href="/policies" className={`${cta} w-fit text-ink ring-1 ring-line ring-inset hover:ring-ink`}>
        {t("policiesLink")}
      </Link>
    </div>
  );
}
