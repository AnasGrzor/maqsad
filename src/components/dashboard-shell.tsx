import { useLocale, useTranslations } from "next-intl";
import { Suspense, type ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import { Link } from "@/i18n/navigation";
import { requireRole, type Role } from "@/lib/auth";
import { NotificationLink } from "./case-pages";
import { DashboardNav } from "./dashboard-nav";
import { LanguageSwitch } from "./language-switch";
import { focusRing } from "./styles";

export function DashboardShell({ role, children }: { role: Role; children: ReactNode }) {
  const t = useTranslations("dashboard");
  const nav = useTranslations("nav");
  const brand = useTranslations("meta");
  const link = `rounded-md px-2 py-1.5 text-sm text-mist transition-colors hover:text-ice ${focusRing}`;
  return (
    <>
      <header className="bg-navy-900 text-ice">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <p className="flex items-center gap-3">
            <Link href="/" className={`rounded-md text-lg font-semibold tracking-tight ${focusRing}`}>
              {brand("brand")}
            </Link>
            <span className="rounded-full bg-navy-800 px-2.5 py-0.5 text-xs text-mist">{t(`roles.${role}`)}</span>
          </p>
          <div className="flex items-center gap-2">
            {role !== "admin" && (
              <Suspense fallback={null}>
                <NotificationLink role={role} />
              </Suspense>
            )}
            <LanguageSwitch className={link} />
            <form action={signOut}>
              <input type="hidden" name="locale" value={useLocale()} />
              <button type="submit" className={`${link} cursor-pointer`}>
                {nav("signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 pt-6 pb-16 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 lg:px-8 lg:pt-10">
        <nav aria-label={nav("dashboard")}>
          <DashboardNav role={role} />
        </nav>
        <main className="min-w-0">
          <Suspense fallback={<DashboardLoading />}>
            <RoleGate role={role}>{children}</RoleGate>
          </Suspense>
        </main>
      </div>
    </>
  );
}

// Also each dashboard segment's loading.tsx, so navigating between pages under one layout has its own boundary.
export function DashboardLoading() {
  const t = useTranslations("dashboard");
  return <p className="text-slate">{t("loading")}</p>;
}

// Server-side check before any dashboard content renders. Pages call requireRole again before reading data.
async function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  await requireRole(role);
  return children;
}
