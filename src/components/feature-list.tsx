import { useTranslations } from "next-intl";
import { FEATURES, type Feature } from "@/lib/features";

// Only unbuilt features get a badge; working ones need no label.
export function StatusBadge({ available }: { available: boolean }) {
  const t = useTranslations("status");
  if (available) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-soft ring-1 ring-line ring-inset">
      {t("soon")}
    </span>
  );
}

export function FeatureList({ items }: { items: Feature[] }) {
  const t = useTranslations("features");
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
      {items.map((f) => (
        <li key={f} className="grid content-start gap-2.5 rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center justify-between gap-2.5">
            <span aria-hidden className="glyph" />
            <StatusBadge available={FEATURES[f]} />
          </div>
          <h3 className="font-sans text-base font-semibold tracking-normal">{t(`${f}.title`)}</h3>
          <p className="text-[14.5px] text-pretty text-soft">{t(`${f}.body`)}</p>
        </li>
      ))}
    </ul>
  );
}

export function PageHeading({ title, intro }: { title: string; intro?: string }) {
  return (
    <header className="grid max-w-[760px] gap-3.5">
      <h1 className="text-[clamp(34px,5.6vw,60px)] leading-[1.02] font-extrabold rtl:leading-[1.7]">{title}</h1>
      {intro && <p className="max-w-[60ch] text-lg text-pretty text-soft">{intro}</p>}
    </header>
  );
}
