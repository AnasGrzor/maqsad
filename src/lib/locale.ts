import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

// Root params aren't available in Server Actions, so forms send the locale in a hidden field.
export function localeOf(form: FormData) {
  const value = form.get("locale");
  return typeof value === "string" && hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}
