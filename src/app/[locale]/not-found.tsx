import { useTranslations } from "next-intl";
import { SiteHeader } from "@/components/site-header";
import { cta } from "@/components/styles";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-12 pb-16 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-3 text-slate">{t("body")}</p>
        <Link href="/" className={`${cta} mt-6 bg-navy-900 text-ice hover:bg-navy-800`}>
          {t("home")}
        </Link>
      </main>
    </>
  );
}
