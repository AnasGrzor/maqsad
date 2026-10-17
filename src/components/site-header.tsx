import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Wordmark } from "./brand";
import { LanguageSwitch } from "./language-switch";
import { ModeSwitch } from "./mode-switch";
import { focusRing } from "./styles";

export const LINKS = [
  ["howItWorks", "/how-it-works"],
  ["students", "/students"],
  ["agents", "/agents"],
  ["trust", "/trust"],
  ["pricing", "/pricing"],
  ["check", "/check"],
] as const;

const pill = `inline-flex whitespace-nowrap min-h-9 items-center justify-center rounded-[10px] px-3.5 text-sm font-semibold transition-[background-color,box-shadow] ${focusRing}`;
const pillPrimary = `${pill} bg-primary text-on-primary hover:shadow-[0_6px_18px_-8px_var(--primary)]`;
const pillGhost = `${pill} text-ink ring-1 ring-line ring-inset hover:ring-ink`;

export function SiteHeader() {
  const t = useTranslations("nav");
  const linkClass = `rounded-[9px] px-2 whitespace-nowrap py-2 text-[14.5px] font-medium text-soft transition-colors hover:bg-tint hover:text-ink ${focusRing}`;
  const links = LINKS.map(([key, href]) => (
    <Link key={key} href={href} className={linkClass}>
      {t(key)}
    </Link>
  ));

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-6xl items-center gap-3 px-4 lg:gap-4 lg:px-8">
        <Wordmark label={t("home")} />

        <nav aria-label={t("main")} className="ms-auto hidden items-center gap-1 xl:flex">
          {links}
        </nav>

        <div className="ms-auto flex items-center gap-2 xl:ms-0">
          <LanguageSwitch className={linkClass} />
          <ModeSwitch />
          <Suspense fallback={<span className="inline-block h-9 w-24" />}>
            <AccountLinks />
          </Suspense>
          <details className="relative xl:hidden">
            <summary
              className={`flex min-h-9 cursor-pointer list-none items-center rounded-[10px] border border-line px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden ${focusRing}`}
            >
              {t("menu")}
            </summary>
            <nav
              aria-label={t("main")}
              className="absolute end-0 z-20 mt-2 flex w-60 flex-col rounded-2xl border border-line bg-card p-2 shadow-float"
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
  if (user?.active) {
    return (
      <Link href={`/${user.role}`} className={pillPrimary}>
        {t("dashboard")}
      </Link>
    );
  }
  return (
    <>
      <Link href="/login" className={pillGhost}>
        {t("login")}
      </Link>
      <Link href="/register" className={`${pillPrimary} max-sm:hidden`}>
        {t("register")}
      </Link>
    </>
  );
}
