import { getTranslations } from "next-intl/server";
import { Notice } from "@/components/dashboard-pages";
import { PageHeading } from "@/components/feature-list";
import { StudentCard } from "@/components/listings";
import { requireRole } from "@/lib/auth";
import { getAgent, listStudentsForAgent, namesOf } from "@/lib/data";
import { match, rank } from "@/lib/matching";

export default async function Matches() {
  const user = await requireRole("agent");
  const [t, ap, agent, students] = await Promise.all([
    getTranslations("matching"),
    getTranslations("agentProfile"),
    getAgent(user.id),
    listStudentsForAgent(),
  ]);

  const ranked = agent ? rank(students.filter((s) => s.visible), (s) => match(s, agent), 20) : [];
  const names = await namesOf(ranked.map((r) => r.item.user_id));

  return (
    <div className="space-y-6">
      <PageHeading title={t("title")} intro={t("intro")} />
      {!agent ? (
        <Notice href="/agent/settings" action={ap("title")}>
          {t("profileFirst")}
        </Notice>
      ) : ranked.length === 0 ? (
        <p className="text-soft">{t("empty")}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {ranked.map(({ item, reasons }) => (
            <StudentCard key={item.user_id} student={item} name={names.get(item.user_id)} reasons={reasons.filter((r) => r.key !== "verified")} />
          ))}
        </ul>
      )}
    </div>
  );
}
