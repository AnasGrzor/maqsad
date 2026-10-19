import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { RegisterForm, RegisterFromLink } from "@/components/auth-forms";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("registerTitle") };
}

export default function Register() {
  const t = useTranslations("auth");
  return (
    <div className="mx-auto max-w-lg rounded-2xl bg-tint p-6 ring-1 ring-tint-strong sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t("registerTitle")}</h1>
      <Suspense fallback={<RegisterForm />}>
        <RegisterFromLink />
      </Suspense>
      <p className="mt-6 text-sm text-soft">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          {t("login")}
        </Link>
      </p>
    </div>
  );
}
