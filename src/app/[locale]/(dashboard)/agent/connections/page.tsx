import { getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/feature-list";
import { ConnectionList, studentLabel } from "@/components/listings";
import { requireRole } from "@/lib/auth";
import { listConnections, listStudentsForAgent, namesOf } from "@/lib/data";

export default async function AgentConnections() {
  const user = await requireRole("agent");
  const [t, connections, students] = await Promise.all([getTranslations("connections"), listConnections(), listStudentsForAgent()]);
  const names = await namesOf(connections.map((c) => c.student_id));
  // Students whose name the agent can't see yet get the same anonymous label as in discovery.
  const labels = new Map(await Promise.all(students.map(async (s) => [s.user_id, await studentLabel(s)] as const)));

  return (
    <div className="space-y-6">
      <PageHeading title={t("title")} />
      <ConnectionList connections={connections} me={user.id} names={names} labels={labels} />
    </div>
  );
}
