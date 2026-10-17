import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";

// Opt-in, unticked by default, and only for signed-in students (only they have a reports page).
// The API checks the session again before saving, so hiding this is not the security check.
export async function SaveOption() {
  const user = await getCurrentUser();
  if (!user?.active || user.role !== "student") return null;
  const t = await getTranslations("reportView");
  return (
    <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-card p-4 ring-1 ring-lavender-200">
      <input type="checkbox" name="save" value="1" className="mt-0.5 size-4 shrink-0 accent-navy-900" />
      <span>
        <span className="font-medium">{t("saveLabel")}</span>
        <span className="mt-0.5 block text-sm text-slate">{t("saveHint")}</span>
      </span>
    </label>
  );
}
