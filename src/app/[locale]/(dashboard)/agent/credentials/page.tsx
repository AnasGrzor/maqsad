import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/feature-list";
import { card, CredentialBadge } from "@/components/listings";
import { CredentialForm } from "@/components/profile-forms";
import { requireRole } from "@/lib/auth";
import { credentialFileUrls, listOwnCredentials } from "@/lib/data";

export default async function Credentials() {
  const user = await requireRole("agent");
  const [t, tax, format, credentials] = await Promise.all([
    getTranslations("credentials"),
    getTranslations("taxonomy"),
    getFormatter(),
    listOwnCredentials(user.id),
  ]);
  const urls = await credentialFileUrls(credentials.flatMap((c) => c.document_path ?? []));
  const files = credentials.map((c) => (c.document_path && urls.get(c.document_path)) || null);

  return (
    <div className="space-y-8">
      <PageHeading title={t("title")} intro={t("intro")} />
      <section className={card}>
        <CredentialForm />
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold tracking-tight">{t("yours")}</h2>
        {credentials.length === 0 ? (
          <p className="text-soft">{t("empty")}</p>
        ) : (
          <ul className="space-y-3">
            {credentials.map((c, i) => (
              <li key={c.id} className={`${card} space-y-2 text-sm`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{tax(`credentialKinds.${c.kind}`)}</span>
                  <CredentialBadge status={c.status} />
                </div>
                <p className="text-soft">
                  {c.issuer}
                  {c.reference && ` · ${c.reference}`}
                  {" · "}
                  <time dateTime={c.created_at}>{format.dateTime(new Date(c.created_at), { dateStyle: "medium" })}</time>
                </p>
                {files[i] && (
                  <a href={files[i]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    {t("file")}
                  </a>
                )}
                {c.review_note && (
                  <p dir="auto">
                    <span className="text-soft">{t("reviewNote")}: </span>
                    {c.review_note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
