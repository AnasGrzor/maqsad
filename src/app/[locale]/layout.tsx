import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Geist, Noto_Nastaliq_Urdu } from "next/font/google";
import { notFound } from "next/navigation";
import { locale } from "next/root-params";
import { routing, RTL_LOCALES } from "@/i18n/routing";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const nastaliq = Noto_Nastaliq_Urdu({
  variable: "--font-nastaliq",
  subsets: ["arabic"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: t("title"), template: `%s · ${t("brand")}` },
    description: t("description"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  const lang = await locale();
  if (!hasLocale(routing.locales, lang)) notFound();
  return (
    // Browser extensions inject attributes on <html> before hydration.
    <html
      lang={lang}
      dir={RTL_LOCALES.includes(lang) ? "rtl" : "ltr"}
      className={`${geistSans.variable} ${nastaliq.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
