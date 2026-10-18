import { useTranslations } from "next-intl";
import { TileBand, Wordmark } from "@/components/brand";
import { SiteHeader } from "@/components/site-header";
import { focusRing } from "@/components/styles";
import { Link } from "@/i18n/navigation";

const COLUMNS = [
  ["studentsCol", [["check", "/check"], ["students", "/students"], ["howItWorks", "/how-it-works"]]],
  ["agentsCol", [["agents", "/agents"], ["pricing", "/pricing"]]],
  ["maqsadCol", [["trust", "/trust"], ["login", "/login"], ["register", "/register"]]],
] as const;

export default function SiteLayout({ children }: LayoutProps<"/[locale]">) {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-20 sm:pt-12 lg:px-8">{children}</main>
      <footer className="bg-band">
        <TileBand />
        <div className="mx-auto grid max-w-6xl gap-9 px-4 pt-12 pb-10 lg:px-8">
          <div className="grid grid-cols-2 gap-7 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
            <div className="col-span-2 space-y-3.5 md:col-span-1">
              <Wordmark label={nav("home")} />
              <p className="max-w-[70ch] text-sm text-soft">{t("disclaimer")}</p>
            </div>
            {COLUMNS.map(([col, links]) => (
              <div key={col}>
                <h2 className="mb-2.5 font-sans text-sm font-semibold tracking-normal">{t(col)}</h2>
                {links.map(([key, href]) => (
                  <Link key={key} href={href} className={`block w-fit rounded py-1 text-[14.5px] text-soft hover:text-ink ${focusRing}`}>
                    {nav(key)}
                  </Link>
                ))}
              </div>
            ))}
          </div>
          <p className="border-t border-band-line pt-5 text-sm text-soft">{t("notPayments")}</p>
        </div>
      </footer>
    </>
  );
}
