"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { deleteReport } from "@/app/actions/reports";
import { focusRing } from "@/components/styles";

const button = `inline-flex min-h-10 items-center rounded-[10px] px-4 text-sm font-medium transition-colors disabled:opacity-60 ${focusRing}`;

// Deleting can't be undone, so it takes a second, explicit click.
export function DeleteReport({ id }: { id: string }) {
  const t = useTranslations("reports");
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteReport, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={useLocale()} />
      {confirming ? (
        <>
          <span className="text-sm">{t("deleteConfirm")}</span>
          <button type="submit" disabled={pending} className={`${button} bg-danger text-on-primary hover:bg-danger/90`}>
            {t("deleteYes")}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={`${button} ring-1 ring-line ring-inset hover:ring-ink`}>
            {t("deleteNo")}
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={`${button} bg-danger-bg text-danger ring-1 ring-danger/15`}>
          {t("delete")}
        </button>
      )}
      {state?.error && (
        <p role="alert" className="w-full text-sm text-danger">
          {t("deleteFailed")}
        </p>
      )}
    </form>
  );
}
