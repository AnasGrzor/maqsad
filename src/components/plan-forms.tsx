"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { decidePlanRequest, requestPlan, updatePlan, type PlanActionState } from "@/app/actions/plans";
import { Label } from "@/components/ui/label";
import type { PlanRow } from "@/lib/plans";
import { cta, focusRing } from "./styles";

const control = "w-full rounded-lg border border-input bg-card px-3 text-base md:text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";
const submit = `${cta} bg-primary text-on-primary hover:bg-primary-hover disabled:cursor-progress disabled:opacity-60`;
const small = `inline-flex min-h-9 items-center rounded-[10px] px-4 text-sm font-medium transition-colors disabled:opacity-60 ${focusRing}`;

function Message({ state, done }: { state: PlanActionState; done: string }) {
  const t = useTranslations("subscription.errors");
  if (state?.error) {
    return (
      <p role="alert" className="rounded-xl bg-danger-bg p-3 text-sm text-danger ring-1 ring-danger/15">
        {t(state.error)}
      </p>
    );
  }
  if (state?.done) {
    return (
      <p role="status" className="rounded-xl bg-turq-faint p-3 text-sm ring-1 ring-turq-soft">
        {done}
      </p>
    );
  }
  return null;
}

export function RequestPlanForm({ options }: { options: { id: string; label: string }[] }) {
  const t = useTranslations("subscription");
  const [state, action, pending] = useActionState(requestPlan, undefined);
  if (state?.done) return <Message state={state} done={t("sent")} />;
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="plan">{t("plan")}</Label>
        <select id="plan" name="plan" required className={`${control} h-11`}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="plan-note">{t("message")}</Label>
        <textarea dir="auto" id="plan-note" name="note" maxLength={500} rows={3} placeholder={t("messagePlaceholder")} className={`${control} py-2`} />
      </div>
      <Message state={state} done={t("sent")} />
      <button type="submit" disabled={pending} aria-busy={pending} className={submit}>
        {t("submit")}
      </button>
    </form>
  );
}

export function PlanEditForm({ plan, name }: { plan: PlanRow; name: string }) {
  const t = useTranslations("adminPlans");
  const f = useTranslations("forms");
  const [state, action, pending] = useActionState(updatePlan, undefined);
  const id = (field: string) => `${plan.id}-${field}`;
  return (
    <form action={action} className="space-y-4" aria-label={name}>
      <input type="hidden" name="plan" value={plan.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={id("price")}>{t("price")}</Label>
          <input id={id("price")} name="price" type="number" min={0} step={1} dir="ltr" defaultValue={plan.price_monthly_pkr ?? ""} className={`${control} h-11`} />
          <p className="text-xs text-soft">{t("priceHelp")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("reports")}>{t("reports")}</Label>
          <input id={id("reports")} name="reports" type="number" min={0} step={1} dir="ltr" defaultValue={plan.verification_reports_per_month ?? ""} className={`${control} h-11`} />
          <p className="text-xs text-soft">{t("reportsHelp")}</p>
        </div>
      </div>
      <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" name="offered" defaultChecked={plan.offered} className="size-4 shrink-0 accent-ink" />
        {t("offered")}
      </label>
      <Message state={state} done={f("saved")} />
      <button type="submit" disabled={pending} aria-busy={pending} className={`${small} bg-primary text-on-primary hover:bg-primary-hover`}>
        {t("save")}
      </button>
    </form>
  );
}

export function DecidePlanForm({ id }: { id: string }) {
  const t = useTranslations("adminPlans");
  const f = useTranslations("forms");
  const [state, action, pending] = useActionState(decidePlanRequest, undefined);
  if (state?.done) return <Message state={state} done={f("saved")} />;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`decision-${id}`} className="sr-only">
        {t("note")}
      </label>
      <input dir="auto" id={`decision-${id}`} name="note" maxLength={500} placeholder={t("note")} className={`${control} h-10`} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="approve" disabled={pending} className={`${small} bg-primary text-on-primary hover:bg-primary-hover`}>
          {t("approve")}
        </button>
        <button type="submit" name="decision" value="decline" disabled={pending} className={`${small} bg-danger-bg text-danger ring-1 ring-danger/15`}>
          {t("decline")}
        </button>
      </div>
      <p className="text-xs text-soft">{t("approveHelp")}</p>
      <Message state={state} done={f("saved")} />
    </form>
  );
}
