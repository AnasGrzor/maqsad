import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { RegisterForm } from "@/components/auth-forms";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("registerTitle") };
}

export default function Register() {
  const t = useTranslations("auth");
  return (
    <div className="mx-auto max-w-lg rounded-2xl bg-lavender-100 p-6 ring-1 ring-lavender-200 sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t("registerTitle")}</h1>
      <RegisterForm />
      <p className="mt-6 text-sm text-slate">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-navy-900 underline underline-offset-4">
          {t("login")}
        </Link>
      </p>
    </div>
  );
}
