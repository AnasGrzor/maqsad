import { useTranslations } from "next-intl";
import { SiteHeader } from "@/components/site-header";

export default function SiteLayout({ children }: LayoutProps<"/[locale]">) {
  const t = useTranslations("footer");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-16 sm:pt-12 lg:px-8">{children}</main>
      <footer className="border-t border-fog">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-sm text-slate lg:px-8">
          <p className="max-w-[80ch]">{t("disclaimer")}</p>
          <p>{t("notPayments")}</p>
        </div>
      </footer>
    </>
  );
}
