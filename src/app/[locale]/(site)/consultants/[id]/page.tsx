import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Mark } from "@/components/brand";
import { card, countries } from "@/components/listings";
import { cta } from "@/components/styles";
import { Link } from "@/i18n/navigation";
import { getTrustCard } from "@/lib/trust-card";

// Shared by link only, so search engines are asked not to index it.
export async function generateMetadata({ params }: PageProps<"/[locale]/consultants/[id]">): Promise<Metadata> {
  const [t, agent] = await Promise.all([getTranslations("trustCard"), getTrustCard((await params).id)]);
  return { title: agent ? `${agent.agency_name} · ${t("eyebrow")}` : t("eyebrow"), robots: { index: false, follow: false } };
}

export default async function TrustCard({ params }: PageProps<"/[locale]/consultants/[id]">) {
  const { id } = await params;
  const [t, tax, format, agent] = await Promise.all([
    getTranslations("trustCard"),
    getTranslations("taxonomy"),
    getFormatter(),
    getTrustCard(id),
  ]);
  if (!agent) return <p className="text-soft">{t("notFound")}</p>;

  const details: [string, string][] = (
    [
      [t("city"), agent.city],
      [t("services"), tax(`agentKinds.${agent.kind}`)],
      [t("destinations"), await countries(agent.destinations)],
      [t("levels"), agent.levels.map((l) => tax(`levels.${l}`)).join(", ")],
    ] as [string, string][]
  ).filter(([, v]) => v);

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <article className="overflow-hidden rounded-[22px] border border-line bg-card shadow-float">
        <div className={`grid gap-3 p-6 sm:p-8 ${agent.verified ? "bg-turq-soft" : "bg-tint"}`}>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 dir="auto" className="text-[clamp(28px,4.4vw,40px)] leading-[1.1] font-extrabold rtl:leading-[1.7]">
            {agent.agency_name}
          </h1>
          <p className="flex items-center gap-2 text-lg font-semibold">
            {agent.verified ? <Mark className="size-6" /> : <span aria-hidden className="size-3 rounded-full bg-line-strong" />}
            {agent.verified ? t("verified") : t("notVerified")}
          </p>
          <p className="max-w-[60ch] text-sm text-soft">{agent.verified ? t("verifiedNote") : t("notVerifiedNote")}</p>
          <p className="text-sm text-soft">{t("since", { date: format.dateTime(new Date(agent.since), { year: "numeric", month: "long" }) })}</p>
        </div>

        <div className="grid gap-6 p-6 sm:p-8">
          <dl className="grid gap-4 sm:grid-cols-2">
            {details.map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm text-soft">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
            {agent.website && (
              <div>
                <dt className="text-sm text-soft">{t("website")}</dt>
                <dd>
                  <a href={agent.website} target="_blank" rel="noopener noreferrer nofollow" dir="ltr" className="font-medium break-all underline underline-offset-4">
                    {agent.website}
                  </a>
                </dd>
              </div>
            )}
          </dl>
          <section className={card}>
            <h2 className="font-semibold">{t("fees")}</h2>
            <p dir="auto" className="mt-2 text-sm whitespace-pre-line">
              {agent.fees || t("noFees")}
            </p>
          </section>
        </div>
      </article>

      <div className="flex flex-wrap gap-3">
        <Link href="/check" className={`${cta} bg-primary text-on-primary hover:shadow-[0_6px_18px_-8px_var(--primary)]`}>
          {t("check")}
        </Link>
        <Link href="/register" className={`${cta} text-ink ring-1 ring-line ring-inset hover:ring-ink`}>
          {t("connect")}
        </Link>
      </div>
    </div>
  );
}
