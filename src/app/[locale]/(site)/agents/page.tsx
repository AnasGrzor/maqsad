import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { FeatureList, PageHeading } from "@/components/feature-list";
import { Link } from "@/i18n/navigation";
import { cta } from "@/components/styles";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("agents"))("title") };
}

export default function Agents() {
  const t = useTranslations("agents");
  const nav = useTranslations("nav");
  return (
    <div className="space-y-10">
      <PageHeading title={t("title")} intro={t("intro")} />
      <p className="max-w-3xl rounded-2xl bg-warm-soft p-5 font-medium ring-1 ring-warm">{t("paidNotVerified")}</p>
      <FeatureList
        items={[
          "accounts",
          "agentProfile",
          "credentialSubmission",
          "studentDiscovery",
          "matching",
          "connections",
          "messaging",
          "caseTracking",
          "feeRecords",
          "documentCheck",
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <Link href="/register" className={`${cta} bg-primary text-on-primary hover:bg-primary-hover`}>
          {nav("register")}
        </Link>
        <Link href="/pricing" className={`${cta} text-ink ring-1 ring-line ring-inset hover:ring-ink`}>
          {nav("pricing")}
        </Link>
      </div>
    </div>
  );
}
