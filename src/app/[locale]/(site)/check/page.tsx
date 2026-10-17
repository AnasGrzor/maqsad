import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { cta } from "@/components/styles";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAllowance } from "@/lib/plans";
import { Checker } from "./checker";
import { SaveOption } from "./save-option";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("checker"))("metaTitle") };
}

export default async function CheckPage() {
  const t = await getTranslations("usage");
  return (
    <Suspense fallback={<Checker blocked notice={<p className="text-sm text-slate">{t("loading")}</p>} />}>
      <Gate />
    </Suspense>
  );
}

const notice = "rounded-2xl bg-lavender-100 p-4 ring-1 ring-lavender-200 sm:p-6";

// Checks use the plan's monthly verification reports, so signing in comes first. /api/analyze enforces the same.
async function Gate() {
  const [t, nav, format, user] = await Promise.all([getTranslations("usage"), getTranslations("nav"), getFormatter(), getCurrentUser()]);
  if (!user?.active) {
    return (
      <Checker
        blocked
        notice={
          <div className={notice}>
            <h2 className="font-semibold">{t("signedOutTitle")}</h2>
            <p className="mt-1 max-w-[62ch] text-sm text-slate">{t("signedOutBody")}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/login" className={`${cta} bg-navy-900 text-ice hover:bg-navy-800`}>
                {nav("login")}
              </Link>
              <Link href="/register" className={`${cta} bg-card ring-1 ring-lavender-200 hover:bg-lavender-50`}>
                {nav("register")}
              </Link>
            </div>
          </div>
        }
      />
    );
  }

  // Admins have no plan and aren't metered (consumeCheck in src/lib/plans.ts).
  if (user.role === "admin") return <Checker />;

  const saveOption = (
    <Suspense fallback={null}>
      <SaveOption />
    </Suspense>
  );
  const allowance = await getAllowance();
  const planLink = (
    <Link href={`/${user.role}/settings`} className="font-medium underline underline-offset-4">
      {t("seePlan")}
    </Link>
  );
  if (!allowance || allowance.limit === null || allowance.used >= allowance.limit) {
    const message = !allowance
      ? t("unavailable")
      : allowance.limit === null
        ? t("notIncluded")
        : t("noneLeft", { limit: allowance.limit, date: format.dateTime(new Date(allowance.resets_at), { dateStyle: "medium" }) });
    return (
      <Checker
        blocked
        notice={
          <p className={`${notice} text-sm`}>
            {message} {planLink}
          </p>
        }
      />
    );
  }
  return (
    <Checker
      saveOption={saveOption}
      notice={
        <p className="text-sm text-slate">
          {t("left", {
            left: allowance.limit - allowance.used,
            limit: allowance.limit,
            date: format.dateTime(new Date(allowance.resets_at), { dateStyle: "medium" }),
          })}{" "}
          {planLink}
        </p>
      }
    />
  );
}
