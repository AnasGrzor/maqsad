import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { FeatureList, PageHeading } from "@/components/feature-list";
import { Link } from "@/i18n/navigation";
import { cta } from "@/components/styles";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("students"))("title") };
}

export default function Students() {
  const t = useTranslations("students");
  const nav = useTranslations("nav");
  return (
    <div className="space-y-10">
      <PageHeading title={t("title")} intro={t("intro")} />
      <FeatureList
        items={[
          "documentCheck",
          "accounts",
          "studentProfile",
          "profileVisibility",
          "agentDirectory",
          "connections",
          "messaging",
          "caseTracking",
          "feeRecords",
          "complaints",
        ]}
      />
      <p className="max-w-[68ch] text-slate">{t("free")}</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/register" className={`${cta} bg-navy-900 text-ice hover:bg-navy-800`}>
          {nav("register")}
        </Link>
        <Link href="/pricing" className={`${cta} bg-lavender-100 text-navy-900 ring-1 ring-lavender-200 hover:bg-lavender-200`}>
          {nav("pricing")}
        </Link>
      </div>
    </div>
  );
}
