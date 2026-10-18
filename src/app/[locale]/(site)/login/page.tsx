import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth-forms";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("loginTitle") };
}

export default function Login() {
  const t = useTranslations("auth");
  return (
    <div className="mx-auto max-w-md rounded-2xl bg-tint p-6 ring-1 ring-tint-strong sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t("loginTitle")}</h1>
      <LoginForm />
      <p className="mt-6 text-sm text-soft">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-medium text-ink underline underline-offset-4">
          {t("register")}
        </Link>
      </p>
    </div>
  );
}
