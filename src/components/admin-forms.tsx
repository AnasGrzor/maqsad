"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { reviewDispute, setAccountStatus } from "@/app/actions/admin";
import { cta } from "./styles";

// Suspends an active account or reactivates a suspended one, with a reason for the activity history.
export function AccountStatusForm({ id, suspended }: { id: string; suspended: boolean }) {
  const t = useTranslations("adminUsers");
  const [state, action, pending] = useActionState(setAccountStatus, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={suspended ? "active" : "suspended"} />
      <div>
        <h2 className="font-semibold">{t(suspended ? "reactivateTitle" : "suspendTitle")}</h2>
        <p className="mt-1 text-sm text-slate">{t(suspended ? "reactivateHelp" : "suspendHelp")}</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="reason" className="text-sm font-medium">
          {t("reason")}
        </label>
        <textarea
          dir="auto"
          id="reason"
          name="reason"
          required
          minLength={3}
          maxLength={500}
          rows={3}
          aria-describedby="reason-help"
          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        />
        <p id="reason-help" className="text-xs text-slate">
          {t("reasonHelp")}
        </p>
      </div>
      {state?.error && (
        <p role="alert" className="rounded-xl bg-danger-bg p-3 text-sm text-danger ring-1 ring-danger/15">
          {t(`errors.${state.error}`)}
        </p>
      )}
      {state?.done && (
        <p role="status" className="rounded-xl bg-mint-soft p-3 text-sm ring-1 ring-mint">
          {t("done")}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={`${cta} disabled:opacity-60 ${suspended ? "bg-navy-900 text-ice hover:bg-navy-800" : "bg-danger text-ice hover:bg-danger/90"}`}
      >
        {t(suspended ? "reactivate" : "suspend")}
      </button>
    </form>
  );
}

// Sets a report or dispute's status, with a note the person who raised it can read.
export function DisputeReviewForm({ id, note }: { id: string; note: string }) {
  const t = useTranslations("adminDisputes");
  const [state, action, pending] = useActionState(reviewDispute, undefined);
  const small = "inline-flex min-h-9 items-center rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-60";
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`note-${id}`} className="text-sm font-medium">
        {t("note")}
      </label>
      <textarea
        dir="auto"
        id={`note-${id}`}
        name="note"
        defaultValue={note}
        maxLength={1000}
        rows={2}
        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="status" value="under_review" disabled={pending} className={`${small} bg-lavender-100 ring-1 ring-lavender-200`}>
          {t("setUnderReview")}
        </button>
        <button type="submit" name="status" value="resolved" disabled={pending} className={`${small} bg-navy-900 text-ice hover:bg-navy-800`}>
          {t("resolve")}
        </button>
        <button type="submit" name="status" value="dismissed" disabled={pending} className={`${small} bg-fog text-navy-900`}>
          {t("dismiss")}
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="rounded-xl bg-danger-bg p-3 text-sm text-danger ring-1 ring-danger/15">
          {t(`errors.${state.error}`)}
        </p>
      )}
      {state?.done && (
        <p role="status" className="rounded-xl bg-mint-soft p-3 text-sm ring-1 ring-mint">
          {t("saved")}
        </p>
      )}
    </form>
  );
}
