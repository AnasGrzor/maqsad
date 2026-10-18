import { getTranslations } from "next-intl/server";
import { Notice } from "@/components/dashboard-pages";
import { card, Chip, countries, studentLabel } from "@/components/listings";
import { ConnectionActions, ConnectionRequestForm } from "@/components/profile-forms";
import { requireRole } from "@/lib/auth";
import { getAgentProfile, getStudentForAgent, namesOf, openConnectionWith, UUID } from "@/lib/data";

export default async function StudentPage({ params }: PageProps<"/[locale]/agent/students/[id]">) {
  const user = await requireRole("agent");
  const { id } = await params;
  const [t, tax, c, sp, ap] = await Promise.all([
    getTranslations("discovery"),
    getTranslations("taxonomy"),
    getTranslations("connections"),
    getTranslations("studentProfile"),
    getTranslations("agentProfile"),
  ]);
  // RLS returns the profile only if the student is visible, connected, or asked to connect.
  const [student, connection, names, own] = UUID.test(id)
    ? await Promise.all([getStudentForAgent(id), openConnectionWith(id), namesOf([id]), getAgentProfile(user.id)])
    : [null, null, new Map<string, string>(), null];
  if (!student) return <p className="text-soft">{t("notFound")}</p>;

  const rows: [string, string][] = (
    [
      [sp("educationLevel"), tax(`levels.${student.education_level}`)],
      [sp("field"), tax(`fields.${student.field}` as "fields.other")],
      [sp("goal"), tax(`goals.${student.goal}`)],
      [sp("destinations"), await countries(student.destinations)],
      [sp("qualifications"), student.qualifications],
      [sp("skills"), student.skills],
      [sp("experience"), student.experience],
      [sp("goalsNote"), student.goals_note],
    ] as [string, string][]
  ).filter(([, v]) => v);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{await studentLabel(student, names.get(id))}</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <dl className={`${card} space-y-4 text-sm`}>
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-soft">{k}</dt>
              <dd dir="auto" className="mt-0.5 whitespace-pre-line">{v}</dd>
            </div>
          ))}
        </dl>
        <aside className="h-fit rounded-2xl bg-tint p-5 ring-1 ring-tint-strong">
          {connection ? (
            <div className="space-y-3">
              <Chip>{c(connection.status === "accepted" ? "statusAccepted" : "statusPending")}</Chip>
              {connection.status === "pending" && connection.requested_by === user.id && <ConnectionActions id={connection.id} actions={["withdraw"]} />}
              {connection.status === "pending" && connection.requested_by !== user.id && <ConnectionActions id={connection.id} actions={["accept", "decline"]} />}
            </div>
          ) : !own ? (
            <Notice href="/agent/settings" action={ap("title")}>
              {ap("missing")}
            </Notice>
          ) : student.visible ? (
            <ConnectionRequestForm target={student.user_id} />
          ) : (
            <p className="text-sm text-soft">{t("notFound")}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
