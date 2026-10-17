import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/feature-list";
import { card, CredentialBadge } from "@/components/listings";
import { ReviewForm } from "@/components/profile-forms";
import { requireRole } from "@/lib/auth";
import { credentialFileUrls, listCredentialsForReview, namesOf } from "@/lib/data";

export default async function CredentialReview() {
  await requireRole("admin");
  const [t, tax, cred, format, credentials] = await Promise.all([
    getTranslations("review"),
    getTranslations("taxonomy"),
    getTranslations("credentials"),
    getFormatter(),
    listCredentialsForReview(),
  ]);
  const [names, urls] = await Promise.all([
    namesOf([...new Set(credentials.map((c) => c.agent_id))]),
    credentialFileUrls(credentials.flatMap((c) => c.document_path ?? [])),
  ]);
  const files = credentials.map((c) => (c.document_path && urls.get(c.document_path)) || null);

  return (
    <div className="space-y-6">
      <PageHeading title={t("title")} intro={t("intro")} />
      {credentials.length === 0 ? (
        <p className="text-slate">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {credentials.map((c, i) => (
            <li key={c.id} className={`${card} grid gap-4 text-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`}>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{tax(`credentialKinds.${c.kind}`)}</span>
                  <CredentialBadge status={c.status} />
                </div>
                <p>
                  <span className="text-slate">{t("agent")}: </span>
                  {names.get(c.agent_id) ?? c.agent_id}
                </p>
                <p className="text-slate">
                  {c.issuer}
                  {c.reference && ` · ${c.reference}`}
                  {" · "}
                  <time dateTime={c.created_at}>{format.dateTime(new Date(c.created_at), { dateStyle: "medium" })}</time>
                </p>
                {files[i] ? (
                  <a href={files[i]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    {cred("file")}
                  </a>
                ) : (
                  <p className="text-slate">{t("noFile")}</p>
                )}
                {c.review_note && <p dir="auto" className="text-slate">{c.review_note}</p>}
              </div>
              <ReviewForm id={c.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
