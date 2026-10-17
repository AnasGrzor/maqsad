"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, type ReactNode } from "react";
import {
  requestConnection,
  reviewCredential,
  saveAgentProfile,
  saveStudentProfile,
  submitCredential,
  updateConnection,
  type ActionState,
} from "@/app/actions/profiles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AgentProfileRow, StudentProfileRow } from "@/lib/data";
import { AGENT_KINDS, COUNTRIES, countryName, CREDENTIAL_KINDS, FIELDS, GOALS, LEVELS } from "@/lib/taxonomy";
import { cta, focusRing } from "./styles";

const control = "w-full rounded-lg border border-input bg-card px-3 text-base md:text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";
const submit = `${cta} bg-navy-900 text-ice hover:bg-navy-800 disabled:cursor-progress disabled:opacity-60`;
const small = `inline-flex min-h-9 items-center rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-60 ${focusRing}`;

export function FormMessage({ state, done }: { state: ActionState; done?: string }) {
  const t = useTranslations("forms");
  if (state?.error) {
    return (
      <p role="alert" className="rounded-xl bg-danger-bg p-3 text-sm text-danger ring-1 ring-danger/15">
        {t(`errors.${state.error}`, {
          field: t(t.has(`fields.${state.field}` as "fields.unknown") ? (`fields.${state.field}` as "fields.unknown") : "fields.unknown"),
        })}
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

function Field({ id, label, help, children }: { id: string; label: string; help?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help && <p className="text-xs text-slate">{help}</p>}
    </div>
  );
}

function Select({ name, options, value, label }: { name: string; options: { value: string; label: string }[]; value?: string; label: string }) {
  return (
    <Field id={name} label={label}>
      <select id={name} name={name} defaultValue={value} required className={`${control} h-11`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Choices({ name, legend, options, selected = [] }: { name: string; legend: string; options: { value: string; label: string }[]; selected?: string[] }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm hover:bg-lavender-50">
            <input type="checkbox" name={name} value={o.value} defaultChecked={selected.includes(o.value)} className="size-4 shrink-0 accent-navy-900" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TextArea({ name, label, value, max, help, rows = 3 }: { name: string; label: string; value?: string; max: number; help?: string; rows?: number }) {
  return (
    <Field id={name} label={label} help={help}>
      <textarea dir="auto" id={name} name={name} defaultValue={value} maxLength={max} rows={rows} className={`${control} py-2 leading-relaxed`} />
    </Field>
  );
}

function useOptions() {
  const t = useTranslations("taxonomy");
  const locale = useLocale();
  return {
    countries: COUNTRIES.map((c) => ({ value: c, label: countryName(c, locale) })),
    fields: FIELDS.map((f) => ({ value: f, label: t(`fields.${f}`) })),
    levels: LEVELS.map((l) => ({ value: l, label: t(`levels.${l}`) })),
    goals: GOALS.map((g) => ({ value: g, label: t(`goals.${g}`) })),
    kinds: AGENT_KINDS.map((k) => ({ value: k, label: t(`agentKinds.${k}`) })),
    credentialKinds: CREDENTIAL_KINDS.map((k) => ({ value: k, label: t(`credentialKinds.${k}`) })),
  };
}

export function StudentProfileForm({ profile }: { profile: StudentProfileRow | null }) {
  const t = useTranslations("studentProfile");
  const f = useTranslations("forms");
  const o = useOptions();
  const [state, action, pending] = useActionState(saveStudentProfile, undefined);
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <Select name="education_level" label={t("educationLevel")} options={o.levels} value={profile?.education_level} />
        <Select name="field" label={t("field")} options={o.fields} value={profile?.field} />
        <Select name="goal" label={t("goal")} options={o.goals} value={profile?.goal} />
      </div>
      <Choices name="destinations" legend={t("destinations")} options={o.countries} selected={profile?.destinations} />
      <TextArea name="qualifications" label={t("qualifications")} help={t("qualificationsHelp")} value={profile?.qualifications} max={1000} />
      <TextArea name="skills" label={t("skills")} value={profile?.skills} max={500} rows={2} />
      <TextArea name="experience" label={t("experience")} value={profile?.experience} max={1000} />
      <TextArea name="goals_note" label={t("goalsNote")} value={profile?.goals_note} max={1000} />
      <label className="flex cursor-pointer gap-3 rounded-xl bg-lemon-soft p-4 ring-1 ring-lemon">
        <input type="checkbox" name="visible" defaultChecked={profile?.visible} className="mt-1 size-4 shrink-0 accent-navy-900" />
        <span>
          <span className="font-medium">{t("visible")}</span>
          <span className="mt-1 block text-sm text-navy-800">{t("visibleHelp")}</span>
        </span>
      </label>
      <FormMessage state={state} done={f("saved")} />
      <button type="submit" disabled={pending} aria-busy={pending} className={submit}>
        {pending ? f("working") : f("save")}
      </button>
    </form>
  );
}

export function AgentProfileForm({ profile }: { profile: AgentProfileRow | null }) {
  const t = useTranslations("agentProfile");
  const f = useTranslations("forms");
  const o = useOptions();
  const [state, action, pending] = useActionState(saveAgentProfile, undefined);
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="agency_name" label={t("agencyName")}>
          <Input dir="auto" id="agency_name" name="agency_name" defaultValue={profile?.agency_name} required maxLength={120} className="h-11 bg-card px-3" />
        </Field>
        <Select name="kind" label={t("kind")} options={o.kinds} value={profile?.kind} />
        <Field id="city" label={t("city")}>
          <Input dir="auto" id="city" name="city" defaultValue={profile?.city} maxLength={80} className="h-11 bg-card px-3" />
        </Field>
        <Field id="website" label={t("website")}>
          <Input id="website" name="website" type="url" dir="ltr" placeholder="https://" defaultValue={profile?.website} maxLength={200} className="h-11 bg-card px-3" />
        </Field>
      </div>
      <Choices name="destinations" legend={t("destinations")} options={o.countries} selected={profile?.destinations} />
      <Choices name="specialisations" legend={t("specialisations")} options={o.fields} selected={profile?.specialisations} />
      <Choices name="levels" legend={t("levels")} options={o.levels} selected={profile?.levels} />
      <TextArea name="fees" label={t("fees")} help={t("feesHelp")} value={profile?.fees} max={2000} rows={4} />
      <TextArea name="about" label={t("about")} value={profile?.about} max={1000} />
      <FormMessage state={state} done={f("saved")} />
      <button type="submit" disabled={pending} aria-busy={pending} className={submit}>
        {pending ? f("working") : f("save")}
      </button>
    </form>
  );
}

export function CredentialForm() {
  const t = useTranslations("credentials");
  const f = useTranslations("forms");
  const o = useOptions();
  const [state, action, pending] = useActionState(submitCredential, undefined);
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <Select name="kind" label={t("kind")} options={o.credentialKinds} />
        <Field id="issuer" label={t("issuer")}>
          <Input dir="auto" id="issuer" name="issuer" required maxLength={120} className="h-11 bg-card px-3" />
        </Field>
        <Field id="reference" label={t("reference")}>
          <Input dir="auto" id="reference" name="reference" maxLength={80} className="h-11 bg-card px-3" />
        </Field>
      </div>
      <Field id="document" label={t("document")} help={t("documentHelp")}>
        <input id="document" name="document" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="block text-sm file:me-3 file:rounded-full file:border-0 file:bg-lavender-200 file:px-4 file:py-2 file:text-sm file:font-medium" />
      </Field>
      <FormMessage state={state} done={t("submitted")} />
      <button type="submit" disabled={pending} aria-busy={pending} className={submit}>
        {pending ? f("working") : t("submit")}
      </button>
    </form>
  );
}

export function ConnectionRequestForm({ target }: { target: string }) {
  const t = useTranslations("connections");
  const f = useTranslations("forms");
  const [state, action, pending] = useActionState(requestConnection, undefined);
  if (state?.done) return <FormMessage state={state} done={t("sent")} />;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="target" value={target} />
      <label htmlFor="note" className="sr-only">
        {t("note")}
      </label>
      <textarea dir="auto" id="note" name="note" maxLength={500} rows={3} placeholder={t("notePlaceholder")} className={`${control} py-2`} />
      <FormMessage state={state} />
      <button type="submit" disabled={pending} aria-busy={pending} className={submit}>
        {pending ? f("working") : t("request")}
      </button>
    </form>
  );
}

export function ConnectionActions({ id, actions }: { id: string; actions: ("accept" | "decline" | "withdraw")[] }) {
  const t = useTranslations("connections");
  const [state, action, pending] = useActionState(updateConnection, undefined);
  const tone = { accept: "bg-navy-900 text-ice hover:bg-navy-800", decline: "bg-lavender-100 ring-1 ring-lavender-200 hover:bg-lavender-200", withdraw: "bg-lavender-100 ring-1 ring-lavender-200 hover:bg-lavender-200" };
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button key={a} type="submit" name="decision" value={a} disabled={pending} className={`${small} ${tone[a]}`}>
            {t(a)}
          </button>
        ))}
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function ReviewForm({ id }: { id: string }) {
  const t = useTranslations("review");
  const [state, action, pending] = useActionState(reviewCredential, undefined);
  const f = useTranslations("forms");
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`note-${id}`} className="sr-only">
        {t("note")}
      </label>
      <input dir="auto" id={`note-${id}`} name="note" maxLength={500} placeholder={t("note")} className={`${control} h-10`} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="verdict" value="verified" disabled={pending} className={`${small} bg-navy-900 text-ice hover:bg-navy-800`}>
          {t("verify")}
        </button>
        <button type="submit" name="verdict" value="under_review" disabled={pending} className={`${small} bg-lavender-100 ring-1 ring-lavender-200`}>
          {t("underReview")}
        </button>
        <button type="submit" name="verdict" value="rejected" disabled={pending} className={`${small} bg-danger-bg text-danger ring-1 ring-danger/15`}>
          {t("reject")}
        </button>
      </div>
      <FormMessage state={state} done={f("saved")} />
    </form>
  );
}
