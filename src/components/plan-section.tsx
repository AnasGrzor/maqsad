import { useFormatter, useTranslations } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import { getMyPlan, type PlanRow } from "@/lib/plans";
import { RequestPlanForm } from "./plan-forms";

export function PlanPrice({ price }: { price: PlanRow["price_monthly_pkr"] }) {
  const t = useTranslations("pricing");
  const format = useFormatter();
  return <>{price === 0 ? t("free") : price === null ? t("tbd") : t("perMonth", { price: format.number(price) })}</>;
}

// Current plan, this month's usage and upgrade requests, for the student and agent settings pages.
export async function PlanSection({ userId, role }: { userId: string; role: "student" | "agent" }) {
  const [t, p, format, mine] = await Promise.all([
    getTranslations("subscription"),
    getTranslations("pricing.plans"),
    getFormatter(),
    getMyPlan(userId),
  ]);
  if (!mine) return null;
  const { plan, plans, allowance, subscription, request } = mine;
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });
  const name = (id: string) => (p.has(id as "agency") ? p(id as "agency") : id);
  const options = plans.filter((x) => x.audience === role && x.offered && x.id !== plan.id);
  const pending = request?.status === "pending";

  return (
    <section className="space-y-5 rounded-2xl bg-card p-6 ring-1 ring-fog">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
        <p className="mt-1 max-w-[68ch] text-sm text-slate">{t("intro")}</p>
      </header>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
        <dt className="text-slate">{t("current")}</dt>
        <dd>
          <span className="font-medium">{name(plan.id)}</span> · <PlanPrice price={plan.price_monthly_pkr} />
          <span className="block text-slate">
            {subscription?.plan_id === plan.id ? t("grantedOn", { date: date(subscription.granted_at) }) : t("defaultPlan")}
          </span>
        </dd>
        <dt className="text-slate">{t("usageTitle")}</dt>
        <dd>
          {allowance.limit === null
            ? t("notIncluded")
            : t("used", { used: allowance.used, limit: allowance.limit, date: date(allowance.resets_at) })}
        </dd>
        {request && (
          <>
            <dt className="text-slate">{t("lastRequest")}</dt>
            <dd>
              <span className="font-medium">{t(`status.${request.status}`)}</span>
              {" · "}
              {t("requestLine", { plan: name(request.plan_id), date: date(request.created_at) })}
              {request.decided_at && <span className="block text-slate">{t("decidedOn", { date: date(request.decided_at) })}</span>}
              {request.decision_note && (
                <span dir="auto" className="block text-slate">
                  {request.decision_note}
                </span>
              )}
            </dd>
          </>
        )}
      </dl>
      {!pending && (
        <div className="space-y-3 border-t border-fog pt-5">
          <h3 className="font-semibold">{t("requestTitle")}</h3>
          <p className="max-w-[68ch] rounded-xl bg-lemon-soft p-3 text-sm ring-1 ring-lemon">{t("requestIntro")}</p>
          {options.length ? (
            <RequestPlanForm options={options.map((o) => ({ id: o.id, label: name(o.id) }))} />
          ) : (
            <p className="text-sm text-slate">{t("noOther")}</p>
          )}
        </div>
      )}
    </section>
  );
}
