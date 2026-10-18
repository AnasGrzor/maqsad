"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { signIn, signUp, updateProfile, type FormState } from "@/app/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cta } from "./styles";

const input = "h-11 bg-card px-3";
const submit = `${cta} w-full bg-primary text-on-primary hover:bg-primary-hover disabled:cursor-progress disabled:opacity-60`;

function Message({ state }: { state: FormState }) {
  const t = useTranslations("auth");
  const d = useTranslations("dashboard.settings");
  if (state?.error) {
    return (
      <p role="alert" className="rounded-xl bg-danger-bg p-3 text-sm text-danger ring-1 ring-danger/15">
        {t(`errors.${state.error}`)}
      </p>
    );
  }
  if (state?.done) {
    return (
      <p role="status" className="rounded-xl bg-turq-faint p-3 text-sm ring-1 ring-turq-soft">
        {state.done === "saved" ? d("saved") : t("confirmEmail")}
      </p>
    );
  }
  return null;
}

export function LoginForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={useLocale()} />
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className={input} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required className={input} />
      </div>
      <Message state={state} />
      <button type="submit" disabled={pending} aria-busy={pending} className={submit}>
        {pending ? t("working") : t("login")}
      </button>
    </form>
  );
}

export function RegisterForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(signUp, undefined);
  const locale = useLocale();
  if (state?.done) return <Message state={state} />;
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">{t("role")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["student", "agent"] as const).map((role, i) => (
            <label
              key={role}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-line-strong has-checked:ring-2 has-checked:ring-ink"
            >
              <input type="radio" name="role" value={role} defaultChecked={i === 0} className="size-4 accent-ink" />
              {t(role === "student" ? "roleStudent" : "roleAgent")}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="displayName">{t("displayName")}</Label>
        <Input dir="auto" id="displayName" name="displayName" autoComplete="name" required maxLength={80} className={input} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className={input} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          aria-describedby="password-hint"
          className={input}
        />
        <p id="password-hint" className="text-xs text-soft">
          {t("passwordHint")}
        </p>
      </div>
      <p className="text-xs text-soft">{t("consent")}</p>
      <Message state={state} />
      <button type="submit" disabled={pending} aria-busy={pending} className={submit}>
        {pending ? t("working") : t("register")}
      </button>
    </form>
  );
}

export function ProfileForm({ displayName }: { displayName: string }) {
  const t = useTranslations("auth");
  const d = useTranslations("dashboard.settings");
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="max-w-md space-y-4">
      <input type="hidden" name="locale" value={useLocale()} />
      <div className="space-y-2">
        <Label htmlFor="displayName">{t("displayName")}</Label>
        <Input dir="auto" id="displayName" name="displayName" defaultValue={displayName} required maxLength={80} className={input} />
      </div>
      <Message state={state} />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={`${cta} bg-primary text-on-primary hover:bg-primary-hover disabled:cursor-progress disabled:opacity-60`}
      >
        {pending ? t("working") : d("save")}
      </button>
    </form>
  );
}
