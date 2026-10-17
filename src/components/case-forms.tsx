"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";
import {
  addCaseItem,
  addCaseRecord,
  markNotificationsRead,
  openCase,
  raiseDispute,
  sendMessage,
  setCaseStatus,
  setItemStatus,
} from "@/app/actions/cases";
import type { ActionState } from "@/app/actions/profiles";
import { Input } from "@/components/ui/input";
import { CASE_KINDS, CASE_STATUSES, CURRENCIES, DISPUTE_KINDS, DISPUTE_REASONS, ITEM_KINDS, RECORD_KINDS } from "@/lib/cases";
import { COUNTRIES, countryName } from "@/lib/taxonomy";
import { control, Field, small, submit } from "./profile-forms";

type Option = { value: string; label: string };
const input = "h-11 bg-card px-3";
const quiet = `${small} bg-lavender-100 ring-1 ring-lavender-200 hover:bg-lavender-200`;

function Result({ state, done }: { state: ActionState; done?: string }) {
  const f = useTranslations("forms");
  const t = useTranslations("cases.fields");
  if (state?.error) {
    const key = state.field as "title";
    const field = state.field && t.has(key) ? t(key) : f("fields.unknown");
    return (
      <p role="alert" className="rounded-xl bg-danger-bg p-3 text-sm text-danger ring-1 ring-danger/15">
        {f(`errors.${state.error}`, { field })}
      </p>
    );
  }
  if (state?.done && done) {
    return (
      <p role="status" className="rounded-xl bg-mint-soft p-3 text-sm ring-1 ring-mint">
        {done}
      </p>
    );
  }
  return null;
}

function Select({ id, name, label, options, value, required = true }: { id: string; name: string; label: string; options: Option[]; value?: string; required?: boolean }) {
  return (
    <Field id={id} label={label}>
      <select id={id} name={name} defaultValue={value} required={required} className={`${control} h-11`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Submit({ pending, label }: { pending: boolean; label: string }) {
  const f = useTranslations("forms");
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={submit}>
      {pending ? f("working") : label}
    </button>
  );
}

export function OpenCaseForm({ connections }: { connections: Option[] }) {
  const t = useTranslations("cases");
  const locale = useLocale();
  const [state, action, pending] = useActionState(openCase, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select id="case-connection" name="connection" label={t("fields.connection")} options={connections} />
        <Field id="case-title" label={t("fields.title")}>
          <Input dir="auto" id="case-title" name="title" required maxLength={120} placeholder={t("titlePlaceholder")} className={input} />
        </Field>
        <Select id="case-kind" name="kind" label={t("fields.kind")} options={CASE_KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))} />
        <Select id="case-country" name="country" label={t("fields.country")} options={COUNTRIES.map((c) => ({ value: c, label: countryName(c, locale) }))} />
      </div>
      <Result state={state} done={t("opened")} />
      <Submit pending={pending} label={t("open")} />
    </form>
  );
}

export function CaseStatusForm({ caseId, status }: { caseId: string; status: string }) {
  const t = useTranslations("cases");
  const [state, action, pending] = useActionState(setCaseStatus, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="target_case" value={caseId} />
      <div className="flex flex-wrap gap-2">
        {CASE_STATUSES.filter((s) => s !== status).map((s) => (
          <button key={s} type="submit" name="new_status" value={s} disabled={pending} className={quiet}>
            {t(`markAs.${s}`)}
          </button>
        ))}
      </div>
      <Result state={state} />
    </form>
  );
}

export function ItemForm({ caseId }: { caseId: string }) {
  const t = useTranslations("cases");
  const [state, action, pending] = useActionState(addCaseItem, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="target_case" value={caseId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Select id="item-kind" name="kind" label={t("fields.kind")} options={ITEM_KINDS.map((k) => ({ value: k, label: t(`itemKinds.${k}`) }))} />
        <Field id="item-title" label={t("fields.title")}>
          <Input dir="auto" id="item-title" name="title" required maxLength={200} className={input} />
        </Field>
        <Field id="item-due" label={t("fields.due_on")}>
          <Input id="item-due" name="due_on" type="date" className={input} />
        </Field>
      </div>
      <Field id="item-details" label={t("fields.details")}>
        <textarea dir="auto" id="item-details" name="details" maxLength={2000} rows={3} className={`${control} py-2`} />
      </Field>
      <Result state={state} done={t("itemAdded")} />
      <Submit pending={pending} label={t("addItem")} />
    </form>
  );
}

export function ItemToggle({ itemId, done }: { itemId: string; done: boolean }) {
  const t = useTranslations("cases");
  const [state, action, pending] = useActionState(setItemStatus, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="item" value={itemId} />
      <button type="submit" name="done" value={done ? "0" : "1"} disabled={pending} className={done ? quiet : `${small} bg-navy-900 text-ice hover:bg-navy-800`}>
        {t(done ? "reopen" : "markDone")}
      </button>
      <Result state={state} />
    </form>
  );
}

export function RecordForm({ caseId, records }: { caseId: string; records: Option[] }) {
  const t = useTranslations("cases");
  const [state, action, pending] = useActionState(addCaseRecord, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="target_case" value={caseId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select id="record-kind" name="kind" label={t("fields.kind")} options={RECORD_KINDS.map((k) => ({ value: k, label: t(`recordKinds.${k}`) }))} />
        <Field id="record-date" label={t("fields.on_date")} help={t("onDateHelp")}>
          <Input id="record-date" name="on_date" type="date" className={input} />
        </Field>
        <Field id="record-amount" label={t("fields.amount")} help={t("amountHelp")}>
          <Input id="record-amount" name="amount" inputMode="decimal" dir="ltr" maxLength={20} className={input} />
        </Field>
        <Select id="record-currency" name="currency" label={t("fields.currency")} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
      </div>
      <Field id="record-summary" label={t("fields.summary")} help={t("summaryHelp")}>
        <textarea dir="auto" id="record-summary" name="summary" required maxLength={1000} rows={3} className={`${control} py-2`} />
      </Field>
      {records.length > 0 && (
        <Select
          id="record-corrects"
          name="correction_of"
          label={t("fields.correction_of")}
          required={false}
          options={[{ value: "", label: t("notACorrection") }, ...records]}
        />
      )}
      <Result state={state} done={t("recordAdded")} />
      <Submit pending={pending} label={t("addRecord")} />
    </form>
  );
}

export function MessageForm({ connectionId, cases }: { connectionId: string; cases: Option[] }) {
  const t = useTranslations("messaging");
  const c = useTranslations("cases");
  const [state, action, pending] = useActionState(sendMessage, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="connection" value={connectionId} />
      <label htmlFor="message-body" className="sr-only">
        {c("fields.body")}
      </label>
      <textarea dir="auto" id="message-body" name="body" required maxLength={4000} rows={3} placeholder={t("placeholder")} className={`${control} py-2`} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        {cases.length > 0 && (
          <div className="min-w-48">
            <Select id="message-case" name="target_case" label={c("fields.target_case")} required={false} options={[{ value: "", label: t("noCase") }, ...cases]} />
          </div>
        )}
        <Submit pending={pending} label={t("send")} />
      </div>
      <Result state={state} />
    </form>
  );
}

export function DisputeForm({ connectionId, caseId, records = [] }: { connectionId: string; caseId?: string; records?: Option[] }) {
  const t = useTranslations("disputes");
  const c = useTranslations("cases");
  const [state, action, pending] = useActionState(raiseDispute, undefined);
  if (state?.done) return <Result state={state} done={t("sent")} />;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="connection" value={connectionId} />
      {caseId && <input type="hidden" name="target_case" value={caseId} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Select id="dispute-kind" name="kind" label={c("fields.kind")} options={DISPUTE_KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))} />
        <Select id="dispute-reason" name="reason" label={c("fields.reason")} options={DISPUTE_REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) }))} />
      </div>
      {records.length > 0 && (
        <Select id="dispute-record" name="target_record" label={c("fields.target_record")} required={false} options={[{ value: "", label: t("noRecord") }, ...records]} />
      )}
      <Field id="dispute-details" label={c("fields.details")} help={t("detailsHelp")}>
        <textarea dir="auto" id="dispute-details" name="details" required maxLength={2000} rows={4} className={`${control} py-2`} />
      </Field>
      <Result state={state} />
      <Submit pending={pending} label={t("submit")} />
    </form>
  );
}

export function MarkReadButton({ id }: { id: string }) {
  const t = useTranslations("notifications");
  const [state, action, pending] = useActionState(markNotificationsRead, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={quiet}>
        {t(id === "all" ? "markAllRead" : "markRead")}
      </button>
      <Result state={state} />
    </form>
  );
}

// The owner chose refreshing over real-time: re-render the thread every 10 seconds while the tab is visible.
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds]);
  return null;
}
