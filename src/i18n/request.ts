import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { routing } from "./routing";

// messages/<lang>.json plus one file per milestone in messages/<lang>/, so parallel work doesn't touch the
// same file. Top-level namespaces must not repeat across files; the parity test in auth-schema.test.mjs checks.
export const MESSAGE_PARTS = ["m3", "m4", "m5", "m6"] as const;

// The locale comes from the [locale] root segment, not a header, so pages stay static under Cache Components.
export default getRequestConfig(async ({ locale: override }) => {
  const requested = override ?? (await rootLocale());
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const parts = await Promise.all(MESSAGE_PARTS.map(async (p) => (await import(`../../messages/${locale}/${p}.json`)).default));
  return {
    locale,
    timeZone: "Asia/Karachi",
    messages: Object.assign({}, (await import(`../../messages/${locale}.json`)).default, ...parts),
  };
});
