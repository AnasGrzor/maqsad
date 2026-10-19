"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import type { Role } from "@/lib/auth";
import { FEATURES, type Feature } from "@/lib/features";
import type messages from "../../messages/en.json";
import { focusRing } from "./styles";

type NavKey = keyof typeof messages.dashboard.nav;

// Items whose feature isn't built yet render as plain text with a "Soon" tag, never as a link to an empty page.
export const NAV: Record<Role, { key: NavKey; href: string; feature: Feature }[]> = {
  student: [
    { key: "overview", href: "/student", feature: "accounts" },
    { key: "findAgents", href: "/student/agents", feature: "agentDirectory" },
    { key: "studentMatching", href: "/student/matches", feature: "matching" },
    { key: "applications", href: "/student/applications", feature: "caseTracking" },
    { key: "reports", href: "/student/reports", feature: "savedReports" },
    { key: "messages", href: "/student/messages", feature: "messaging" },
    { key: "settings", href: "/student/settings", feature: "accounts" },
  ],
  agent: [
    { key: "overview", href: "/agent", feature: "accounts" },
    { key: "studentDiscovery", href: "/agent/students", feature: "studentDiscovery" },
    { key: "matching", href: "/agent/matches", feature: "matching" },
    { key: "connections", href: "/agent/connections", feature: "connections" },
    { key: "activeApplications", href: "/agent/applications", feature: "caseTracking" },
    { key: "messages", href: "/agent/messages", feature: "messaging" },
    { key: "credentials", href: "/agent/credentials", feature: "credentialSubmission" },
    { key: "subscription", href: "/agent/settings", feature: "accounts" },
  ],
  admin: [
    { key: "users", href: "/admin", feature: "accounts" },
    { key: "credentialReview", href: "/admin/credentials", feature: "credentialSubmission" },
    { key: "flagged", href: "/admin/reports", feature: "adminReview" },
    { key: "complaints", href: "/admin/complaints", feature: "complaints" },
    { key: "plans", href: "/admin/plans", feature: "planLimits" },
    { key: "audit", href: "/admin/audit", feature: "auditLog" },
  ],
};

// The pathname is request data on dynamic routes, so it is read behind Suspense with a no-highlight fallback.
export function DashboardNav({ role }: { role: Role }) {
  return (
    <Suspense fallback={<NavItems role={role} pathname="" />}>
      <ActiveNav role={role} />
    </Suspense>
  );
}

function ActiveNav({ role }: { role: Role }) {
  return <NavItems role={role} pathname={usePathname()} />;
}

function NavItems({ role, pathname }: { role: Role; pathname: string }) {
  const t = useTranslations("dashboard");
  return (
    <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {NAV[role].map(({ key, href, feature }) => (
        <li key={key} className="shrink-0">
          {FEATURES[feature] ? (
            <Link
              href={href}
              // Overview (/role) matches only itself; other items also cover their nested pages.
              aria-current={pathname === href || (href !== `/${role}` && pathname.startsWith(`${href}/`)) ? "page" : undefined}
              className={`flex min-h-10 items-center rounded-[10px] px-3 text-[14.5px] font-medium text-soft transition-colors hover:text-ink aria-[current=page]:bg-card aria-[current=page]:font-semibold aria-[current=page]:text-ink aria-[current=page]:ring-1 aria-[current=page]:ring-line aria-[current=page]:ring-inset ${focusRing}`}
            >
              {t(`nav.${key}`)}
            </Link>
          ) : (
            <span aria-disabled className="flex min-h-10 items-center justify-between gap-2 px-3 text-sm text-soft">
              {t(`nav.${key}`)}
              <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-medium">{t("soon")}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
