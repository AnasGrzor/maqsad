import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cta } from "./styles";

// The four star features for one audience, written once in messages.home and shown on the home and audience pages.
export function Highlights({ who }: { who: "student" | "agent" }) {
  const t = useTranslations("home");
  return (
    <ul className="grid gap-3.5 sm:grid-cols-2">
      {([1, 2, 3, 4] as const).map((n) => (
        <li key={n} className="grid content-start gap-2.5 rounded-2xl border border-line bg-card p-6">
          <span aria-hidden className="glyph" />
          <h2 className="font-sans text-lg font-semibold tracking-normal">{t(`${who}${n}Title`)}</h2>
          <p className="text-[15px] text-pretty text-soft">{t(`${who}${n}Body`)}</p>
        </li>
      ))}
    </ul>
  );
}

// The document check as its own feature: anyone can use it, with no agent or application involved.
export function DocumentCheckFeature() {
  const t = useTranslations("home");
  return (
    <section aria-labelledby="document-check" className="grid items-center gap-8 overflow-hidden rounded-[26px] border border-line bg-card p-[clamp(24px,4vw,44px)] md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="grid content-start gap-4">
        <p className="eyebrow">{t("checkEyebrow")}</p>
        <h2 id="document-check" className="text-[clamp(26px,3.4vw,38px)] leading-[1.1] font-bold rtl:leading-[1.7]">
          {t("checkTitle")}
        </h2>
        <p className="max-w-[56ch] text-pretty text-soft">{t("checkBody")}</p>
        <Link href="/check" className={`${cta} w-fit bg-primary text-on-primary hover:shadow-[0_6px_18px_-8px_var(--primary)]`}>
          {t("checkCta")}
        </Link>
      </div>
      <ul className="grid gap-3">
        {([1, 2, 3] as const).map((n) => (
          <li key={n} className="flex items-center gap-3.5 rounded-2xl bg-tint px-4 py-3.5 font-medium">
            <span aria-hidden className="glyph shrink-0" />
            {t(`checkPoint${n}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}
