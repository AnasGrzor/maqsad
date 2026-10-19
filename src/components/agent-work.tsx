import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listCases, openItemsOf, unreadCount } from "@/lib/case-data";
import { isOverdue, today } from "@/lib/cases";
import { getAgent, listConnections, listStudentsForAgent } from "@/lib/data";
import { match, rank } from "@/lib/matching";
import { focusRing } from "./styles";
import { TrustCardShare } from "./trust-card-share";

// The agent overview's live counts, each linking to the page where the work is done.
// Everything is read as the agent, so RLS limits it to their own connections, cases and notifications.
export async function AgentWork({ agentId }: { agentId: string }) {
  const [t, agent, connections, cases, unread, students] = await Promise.all([
    getTranslations("agentWork"),
    getAgent(agentId),
    listConnections(),
    listCases(),
    unreadCount(),
    listStudentsForAgent(),
  ]);
  const active = cases.filter((c) => c.status === "active");
  const items = await openItemsOf(active.map((c) => c.id));
  const now = today();
  const pending = connections.filter((c) => c.status === "pending");

  const tiles = [
    { key: "incoming", count: pending.filter((c) => c.requested_by !== agentId).length, href: "/agent/connections", urgent: true },
    { key: "overdue", count: items.filter((i) => isOverdue(i, now)).length, href: "/agent/applications", urgent: true },
    { key: "active", count: active.length, href: "/agent/applications", urgent: false },
    { key: "matches", count: agent ? rank(students.filter((s) => s.visible), (s) => match(s, agent), 99).length : 0, href: "/agent/matches", urgent: false },
    { key: "sent", count: pending.filter((c) => c.requested_by === agentId).length, href: "/agent/connections", urgent: false },
    { key: "unread", count: unread, href: "/agent/notifications", urgent: false },
  ] as const;

  return (
    <div className="space-y-8">
      <section aria-labelledby="work">
        <h2 id="work" className="mb-4 text-xl font-semibold tracking-tight">
          {t("title")}
        </h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {tiles.map(({ key, count, href, urgent }) => (
            <li key={key}>
              <Link
                href={href}
                className={`grid h-full content-start gap-1 rounded-2xl border bg-card p-4 transition-colors hover:border-ink ${
                  urgent && count > 0 ? "border-risk-high" : "border-line"
                } ${focusRing}`}
              >
                <span className={`font-heading text-3xl leading-none font-extrabold tabular-nums ${urgent && count > 0 ? "text-risk-high" : ""}`}>{count}</span>
                <span className="text-sm text-soft">{t(key)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="trust-card" className="space-y-3 rounded-2xl bg-tint p-5 ring-1 ring-tint-strong">
        <h2 id="trust-card" className="text-xl font-semibold tracking-tight">
          {t("cardTitle")}
        </h2>
        <p className="max-w-[68ch] text-sm text-soft">{agent ? t("cardBody") : t("cardProfileFirst")}</p>
        {agent && (
          <TrustCardShare
            path={`/consultants/${agentId}`}
            labels={{ open: t("cardOpen"), share: t("cardShare"), shareText: t("cardShareText"), copy: t("cardCopy"), copied: t("cardCopied") }}
          />
        )}
      </section>
    </div>
  );
}
