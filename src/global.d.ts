import type base from "../messages/en.json";
import type m3 from "../messages/en/m3.json";
import type m4 from "../messages/en/m4.json";
import type m5 from "../messages/en/m5.json";
import type m6 from "../messages/en/m6.json";
import type { routing } from "./i18n/routing";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof base & typeof m3 & typeof m4 & typeof m5 & typeof m6;
  }
}
