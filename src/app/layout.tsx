import type { Metadata } from "next";
import { Geist, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const nastaliq = Noto_Nastaliq_Urdu({
  variable: "--font-nastaliq",
  subsets: ["arabic"],
});

export const metadata: Metadata = {
  title: "Tasdeeq: check before you pay",
  description: "Check offer letters, scholarship and job offers, agent messages and degrees for signs of fraud.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser extensions inject attributes on <html> before hydration.
    <html lang="en" className={`${geistSans.variable} ${nastaliq.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
