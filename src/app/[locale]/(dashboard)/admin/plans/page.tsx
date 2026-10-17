import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/feature-list";
import { card } from "@/components/listings";
import { DecidePlanForm, PlanEditForm } from "@/components/plan-forms";
import { PlanPrice } from "@/components/plan-section";
import { requireRole } from "@/lib/auth";
import { getPlans, listPendingPlanRequests } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPlans() {
  await requireRole("admin");
  const [t, p, roles, format, plans, requests, supabase] = await Promise.all([
    getTranslations("adminPlans"),
    getTranslations("pricing.plans"),
    getTranslations("dashboard.roles"),
    getFormatter(),
    getPlans(),
    listPendingPlanRequests(),
    createClient(),
  ]);
  const ids = [...new Set(requests.map((r) => r.user_id))];
  // Admin-only rows under RLS (is_admin()); decide_plan_request() checks the role again.
  const [{ data: people, error }, { data: subs, error: subsError }] = ids.length
    ? await Promise.all([
        supabase.from("profiles").select("id, display_name, role").in("id", ids),
        supabase.from("subscriptions").select("user_id, plan_id").in("user_id", ids),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (error) throw error;
  if (subsError) throw subsError;
  const person = new Map((people ?? []).map((x) => [x.id, x]));
  const current = new Map((subs ?? []).map((s) => [s.user_id, s.plan_id]));
  const name = (id: string) => (p.has(id as "agency") ? p(id as "agency") : id);
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  return (
    <div className="space-y-10">
      <PageHeading title={t("title")} intro={t("intro")} />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">{t("requestsTitle")}</h2>
        {requests.length === 0 ? (
          <p className="text-slate">{t("requestsEmpty")}</p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => {
              const who = person.get(r.user_id);
              const role = who?.role === "agent" ? "agent" : "student";
              return (
                <li key={r.id} className={`${card} grid gap-4 text-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`}>
                  <div className="space-y-1.5">
                    <p className="font-medium [overflow-wrap:anywhere]">
                      {t("requestLine", { name: who?.display_name ?? r.user_id, role: roles(role), plan: name(r.plan_id) })}
                    </p>
                    <p className="text-slate">
                      {t("currentPlan", { plan: name(current.get(r.user_id) ?? (role === "agent" ? "agent_basic" : "student_free")) })}
                      {" · "}
                      {t("sentOn", { date: date(r.created_at) })}
                    </p>
                    {r.message && (
                      <p dir="auto" className="[overflow-wrap:anywhere]">
                        {r.message}
                      </p>
                    )}
                  </div>
                  <DecidePlanForm id={r.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">{t("plansTitle")}</h2>
        <ul className="grid gap-4 lg:grid-cols-2">
          {plans.map((plan) => (
            <li key={plan.id} className={`${card} space-y-4`}>
              <div>
                <h3 className="font-semibold">
                  {name(plan.id)} <span className="text-sm font-normal text-slate">· {roles(plan.audience === "agent" ? "agent" : "student")}</span>
                </h3>
                <p className="text-sm text-slate">
                  <PlanPrice price={plan.price_monthly_pkr} />
                  {" · "}
                  {t("updated", { date: date(plan.updated_at) })}
                </p>
              </div>
              <PlanEditForm plan={plan} name={name(plan.id)} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
