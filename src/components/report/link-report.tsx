"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { linkReport } from "@/app/actions/reports";
import { focusRing } from "@/components/styles";

// Attaches a saved report to one of the student's applications, or detaches it. Only the student sees the link.
export function LinkReport({ id, current, cases }: { id: string; current: string | null; cases: { id: string; title: string }[] }) {
  const t = useTranslations("reports");
  const [state, action, pending] = useActionState(linkReport, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-2xl bg-card p-4 ring-1 ring-line">
      <input type="hidden" name="id" value={id} />
      <label className="min-w-56 flex-1 space-y-1 text-sm">
        <span className="font-medium">{t("linkLabel")}</span>
        <select name="case" defaultValue={current ?? ""} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm">
          <option value="">{t("linkNone")}</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex min-h-10 items-center rounded-[10px] bg-primary px-5 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-60 ${focusRing}`}
      >
        {t("linkSave")}
      </button>
      <p className="w-full text-xs text-soft">{t("linkHelp")}</p>
      {state?.done && (
        <p role="status" className="w-full text-sm">
          {t("linkSaved")}
        </p>
      )}
      {state?.error && (
        <p role="alert" className="w-full text-sm text-danger">
          {t("linkFailed")}
        </p>
      )}
    </form>
  );
}
