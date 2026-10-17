import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/feature-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("trust"))("title") };
}

const item = "rhombus flex gap-3 border-t border-line py-3 text-[15.5px] before:mt-2 first:border-t-0 first:pt-0";
const heading = "text-[clamp(26px,3.4vw,38px)] leading-[1.1] font-bold rtl:leading-[1.7]";

export default function Trust() {
  const t = useTranslations("trust");
  return (
    <div className="grid gap-18">
      <PageHeading title={t("title")} intro={t("intro")} />

      <div className="grid gap-8 md:grid-cols-2">
        <section className="grid content-start gap-3.5">
          <h2 className={heading}>{t("nowTitle")}</h2>
          <ul>
            {(["now1", "now2", "now3", "now4", "now5", "now6", "now7"] as const).map((k) => (
              <li key={k} className={item}>
                {t(k)}
              </li>
            ))}
          </ul>
        </section>

        <section className="grid content-start gap-3.5">
          <h2 className={heading}>{t("findingTitle")}</h2>
          <ol>
            {(["finding1", "finding2", "finding3", "finding4", "finding5"] as const).map((k) => (
              <li key={k} className={item}>
                {t(k)}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {(["fail", "score"] as const).map((k) => (
          <section key={k} className="grid content-start gap-3.5 rounded-[18px] border border-line bg-card p-5.5">
            <h2 className="text-xl font-bold">{t(`${k}Title`)}</h2>
            <p className="text-pretty text-soft">{t(`${k}Body`)}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
