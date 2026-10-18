import { useLocale, useTranslations } from "next-intl";
import { Suspense, type ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import { requireRole, type Role } from "@/lib/auth";
import { Wordmark } from "./brand";
import { NotificationLink } from "./case-pages";
import { DashboardNav } from "./dashboard-nav";
import { LanguageSwitch } from "./language-switch";
import { ModeSwitch } from "./mode-switch";
import { focusRing } from "./styles";

export function DashboardShell({ role, children }: { role: Role; children: ReactNode }) {
  const t = useTranslations("dashboard");
  const nav = useTranslations("nav");
  const link = `rounded-[9px] px-2.5 py-2 text-[14.5px] font-medium text-soft transition-colors hover:bg-tint hover:text-ink ${focusRing}`;
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-[68px] max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 lg:px-8">
          <p className="flex items-center gap-3">
            <Wordmark label={nav("home")} />
            <span className="rounded-full bg-tint px-2.5 py-0.5 text-xs font-semibold text-ink">{t(`roles.${role}`)}</span>
          </p>
          <div className="flex items-center gap-2">
            {role !== "admin" && (
              <Suspense fallback={null}>
                <NotificationLink role={role} />
              </Suspense>
            )}
            <LanguageSwitch className={link} />
            <ModeSwitch />
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
        <main className="min-w-0 [&_h1]:text-[clamp(28px,4vw,40px)]">
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
  return <p className="text-soft">{t("loading")}</p>;
}

// Server-side check before any dashboard content renders. Pages call requireRole again before reading data.
async function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  await requireRole(role);
  return children;
}
