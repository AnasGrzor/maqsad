import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/feature-list";
import { Highlights } from "@/components/highlights";
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
      <Highlights who="agent" />
      <div className="flex flex-wrap gap-3">
        <Link href="/register?as=consultant" className={`${cta} bg-primary text-on-primary hover:bg-primary-hover`}>
          {nav("register")}
        </Link>
        <Link href="/pricing" className={`${cta} text-ink ring-1 ring-line ring-inset hover:ring-ink`}>
          {nav("pricing")}
        </Link>
        <Link href="/how-it-works#consultants" className={`${cta} text-ink ring-1 ring-line ring-inset hover:ring-ink`}>
          {nav("agentGuide")}
        </Link>
      </div>
    </div>
  );
}
