"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export function LanguageSwitch({ className = "" }: { className?: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const other = useLocale() === "en" ? "ur" : "en";
  return (
    <Link href={pathname} locale={other} lang={other} className={className} aria-label={t("language")}>
      {t("switchTo")}
    </Link>
  );
}
