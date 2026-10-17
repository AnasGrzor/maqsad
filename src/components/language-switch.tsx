"use client";

import { useLocale, useTranslations } from "next-intl";
import { Suspense } from "react";
import { Link, usePathname } from "@/i18n/navigation";

// The pathname is request data on dynamic routes; until it streams in, the link goes to the other locale's home.
export function LanguageSwitch({ className = "" }: { className?: string }) {
  return (
    <Suspense fallback={<SwitchLink href="/" className={className} />}>
      <CurrentPageSwitch className={className} />
    </Suspense>
  );
}

function CurrentPageSwitch({ className }: { className: string }) {
  return <SwitchLink href={usePathname()} className={className} />;
}

function SwitchLink({ href, className }: { href: string; className: string }) {
  const t = useTranslations("nav");
  const other = useLocale() === "en" ? "ur" : "en";
  return (
    <Link href={href} locale={other} lang={other} className={className} aria-label={t("language")}>
      {t("switchTo")}
    </Link>
  );
}
