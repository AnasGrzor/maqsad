import { useTranslations } from "next-intl";
import { FEATURES, type Feature } from "@/lib/features";

export function StatusBadge({ available }: { available: boolean }) {
  const t = useTranslations("status");
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        available ? "bg-mint text-navy-900" : "bg-fog text-slate"
      }`}
    >
      {available ? t("available") : t("soon")}
    </span>
  );
}

export function FeatureList({ items }: { items: Feature[] }) {
  const t = useTranslations("features");
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((f) => (
        <li key={f} className="rounded-2xl bg-card p-5 ring-1 ring-fog">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-semibold">{t(`${f}.title`)}</h3>
            <StatusBadge available={FEATURES[f]} />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-pretty text-slate">{t(`${f}.body`)}</p>
        </li>
      ))}
    </ul>
  );
}

export function PageHeading({ title, intro }: { title: string; intro?: string }) {
  return (
    <header className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
      {intro && <p className="mt-4 text-pretty text-slate sm:text-lg">{intro}</p>}
    </header>
  );
}
