import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LanguageSwitch } from "./language-switch";
import { focusRing } from "./styles";

const LINKS = [
  ["howItWorks", "/how-it-works"],
  ["students", "/students"],
  ["agents", "/agents"],
  ["trust", "/trust"],
  ["pricing", "/pricing"],
  ["check", "/check"],
] as const;

export function SiteHeader() {
  const t = useTranslations("nav");
  const brand = useTranslations("meta");
  const linkClass = `rounded-md px-2 py-1.5 text-sm text-mist transition-colors hover:text-ice ${focusRing}`;
  const links = LINKS.map(([key, href]) => (
    <Link key={key} href={href} className={linkClass}>
      {t(key)}
    </Link>
  ));

  return (
    <header className="bg-navy-900 text-ice">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
        <Link href="/" className={`rounded-md text-lg font-semibold tracking-tight ${focusRing}`}>
          {brand("brand")}
        </Link>

        <nav aria-label={t("main")} className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {links}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitch className={linkClass} />
          <Suspense fallback={<span className="inline-block h-9 w-24" />}>
            <AccountLinks />
          </Suspense>
          <details className="relative lg:hidden">
            <summary
              className={`flex min-h-9 cursor-pointer list-none items-center rounded-full px-3 text-sm ring-1 ring-slate [&::-webkit-details-marker]:hidden ${focusRing}`}
            >
              {t("menu")}
            </summary>
            <nav
              aria-label={t("main")}
              className="absolute end-0 z-20 mt-2 flex w-56 flex-col rounded-2xl bg-navy-800 p-2 shadow-lg"
            >
              {links}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

async function AccountLinks() {
  const [t, user] = await Promise.all([getTranslations("nav"), getCurrentUser()]);
  const pill = `inline-flex min-h-9 items-center rounded-full px-4 text-sm font-medium transition-colors ${focusRing}`;
  if (user?.active) {
    return (
      <Link href={`/${user.role}`} className={`${pill} bg-lemon text-navy-900 hover:bg-lemon-soft`}>
        {t("dashboard")}
      </Link>
    );
  }
  return (
    <>
      <Link href="/login" className={`${pill} text-ice hover:bg-navy-800`}>
        {t("login")}
      </Link>
      <Link href="/register" className={`${pill} hidden bg-lemon text-navy-900 hover:bg-lemon-soft sm:inline-flex`}>
        {t("register")}
      </Link>
    </>
  );
}
