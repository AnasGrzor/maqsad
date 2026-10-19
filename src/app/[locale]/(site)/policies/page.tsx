import type { Metadata } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/feature-list";
import { PrintButton } from "@/components/print-button";
import { cta } from "@/components/styles";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("policies"))("title") };
}

export type PolicySection = { id: string; title: string; items: string[] };

const item = "rhombus flex gap-3 border-t border-line py-3 text-[15.5px] text-pretty before:mt-2 first:border-t-0 first:pt-0";

export default function Policies() {
  const t = useTranslations("policies");
  const en = useLocale() === "en";
  const sections = t.raw("sections") as PolicySection[];
  return (
    <div className="grid gap-12">
      <div className="grid gap-5">
        <PageHeading title={t("title")} intro={t("intro")} />
        <p className="text-sm text-soft">{t("updated")}</p>
        <div className="flex flex-wrap gap-3 print:hidden">
          {/* A plain link to a file, so it downloads without any script. The PDF is English only: its fonts can't shape Urdu. */}
          <a href="/api/policies" download className={`${cta} bg-primary text-on-primary hover:shadow-[0_6px_18px_-8px_var(--primary)]`}>
            {en ? t("download") : t("downloadEn")}
          </a>
          <PrintButton className={`${cta} text-ink ring-1 ring-line ring-inset hover:ring-ink`}>{t("print")}</PrintButton>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-labelledby="contents" className="print:hidden lg:sticky lg:top-24 lg:self-start">
          <h2 id="contents" className="eyebrow mb-3">
            {t("contents")}
          </h2>
          <ol className="grid gap-1 text-[14.5px]">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded py-1 text-soft hover:text-ink">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="grid gap-6">
          {sections.map((s) => (
            <section
              key={s.id}
              id={s.id}
              aria-labelledby={`${s.id}-title`}
              className="grid scroll-mt-24 gap-3.5 rounded-[18px] border border-line bg-card p-5.5 break-inside-avoid sm:p-7"
            >
              <h2 id={`${s.id}-title`} className="text-[clamp(22px,2.6vw,28px)] leading-[1.15] font-bold rtl:leading-[1.7]">
                {s.title}
              </h2>
              <ul>
                {s.items.map((text) => (
                  <li key={text} className={item}>
                    {text}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
