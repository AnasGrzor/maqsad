import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AgentListing, ConnectionRow, StudentProfileRow } from "@/lib/data";
import type { Reason } from "@/lib/matching";
import { countryName } from "@/lib/taxonomy";
import type { Database } from "@/lib/supabase/database.types";
import { ConnectionActions } from "./profile-forms";
import { focusRing } from "./styles";

type CredentialStatus = Database["public"]["Enums"]["credential_status"];

export const card = "rounded-2xl bg-card p-5 ring-1 ring-line";
const link = `font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-current ${focusRing}`;

export async function countries(codes: string[]) {
  const locale = await getLocale();
  return codes.map((c) => countryName(c, locale)).join(", ");
}

export function Chip({ children, tone = "bg-line text-ink" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{children}</span>;
}

export async function CredentialBadge({ status }: { status: CredentialStatus }) {
  const t = await getTranslations("taxonomy.credentialStatus");
  const tone = { submitted: "bg-line text-soft", under_review: "bg-warm-soft text-ink", verified: "bg-turq-soft text-ink", rejected: "bg-danger-bg text-danger" }[status];
  return <Chip tone={tone}>{t(status)}</Chip>;
}

export async function MatchReasons({ reasons }: { reasons: Reason[] }) {
  const [t, tax] = await Promise.all([getTranslations("matching.reasons"), getTranslations("taxonomy")]);
  const text = async (r: Reason) => {
    switch (r.key) {
      case "destinations":
        return t("destinations", { countries: await countries(r.countries) });
      case "field":
        return t("field", { field: tax(`fields.${r.field}` as "fields.other") });
      case "level":
        return t("level", { level: tax(`levels.${r.level}`) });
      case "goal":
        return t("goal", { goal: tax(`goals.${r.goal}`) });
      case "verified":
        return t("verified");
    }
  };
  const lines = await Promise.all(reasons.map(text));
  return (
    <ul className="space-y-1 text-sm">
      {lines.map((line) => (
        <li key={line} className="flex gap-2">
          <span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-turq-soft text-[10px] text-ink">
            ✓
          </span>
          {line}
        </li>
      ))}
    </ul>
  );
}

export async function AgentCard({ agent, reasons }: { agent: AgentListing; reasons?: Reason[] }) {
  const [t, tax] = await Promise.all([getTranslations("directory"), getTranslations("taxonomy")]);
  return (
    <li className={`${card} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{agent.agency_name}</h3>
          <p className="text-sm text-soft">
            {tax(`agentKinds.${agent.kind}`)}
            {agent.city && ` · ${agent.city}`}
          </p>
        </div>
        {agent.verified ? <Chip tone="bg-turq-soft text-ink">{t("verified")}</Chip> : <Chip tone="bg-line text-soft">{t("notVerified")}</Chip>}
      </div>
      {agent.destinations.length > 0 && <p className="text-sm">{await countries(agent.destinations)}</p>}
      <p className="line-clamp-2 text-sm text-soft">{agent.fees || t("noFees")}</p>
      {reasons && reasons.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-soft">{t("suggested")}</p>
          <MatchReasons reasons={reasons} />
        </div>
      )}
      <Link href={`/student/agents/${agent.user_id}`} className={`${link} mt-auto self-start text-sm`}>
        {t("view")}
      </Link>
    </li>
  );
}

export async function studentLabel(s: StudentProfileRow, name?: string) {
  const [t, tax] = await Promise.all([getTranslations("discovery"), getTranslations("taxonomy")]);
  return name ?? t("anonymous", { field: tax(`fields.${s.field}` as "fields.other") });
}

export async function StudentCard({ student, name, reasons }: { student: StudentProfileRow; name?: string; reasons?: Reason[] }) {
  const [t, tax] = await Promise.all([getTranslations("discovery"), getTranslations("taxonomy")]);
  return (
    <li className={`${card} flex flex-col gap-3`}>
      <div>
        <h3 className="font-semibold">{await studentLabel(student, name)}</h3>
        <p className="text-sm text-soft">
          {tax(`levels.${student.education_level}`)} · {tax(`goals.${student.goal}`)}
        </p>
      </div>
      {student.destinations.length > 0 && <p className="text-sm">{await countries(student.destinations)}</p>}
      {reasons && reasons.length > 0 && <MatchReasons reasons={reasons} />}
      <Link href={`/agent/students/${student.user_id}`} className={`${link} mt-auto self-start text-sm`}>
        {t("view")}
      </Link>
    </li>
  );
}

type Filter = { name: string; label: string; value?: string; options: { value: string; label: string }[] };

// Plain GET form, so filters work without JavaScript and land in the URL.
export async function FilterBar({
  filters,
  toggle,
  search,
}: {
  filters: Filter[];
  toggle?: { name: string; label: string; on: boolean };
  search?: { name: string; label: string; placeholder: string; value?: string };
}) {
  const t = await getTranslations("forms");
  const select = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm";
  return (
    <form className="flex flex-wrap items-end gap-3 rounded-2xl bg-tint p-4 ring-1 ring-tint-strong">
      {search && (
        <label className="min-w-48 flex-[2] space-y-1 text-sm">
          <span className="font-medium">{search.label}</span>
          <input type="search" name={search.name} defaultValue={search.value} placeholder={search.placeholder} maxLength={80} dir="auto" className={select} />
        </label>
      )}
      {filters.map((f) => (
        <label key={f.name} className="min-w-40 flex-1 space-y-1 text-sm">
          <span className="font-medium">{f.label}</span>
          <select name={f.name} defaultValue={f.value ?? ""} className={select}>
            <option value="">{t("any")}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {toggle && (
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" name={toggle.name} value="1" defaultChecked={toggle.on} className="size-4 accent-ink" />
          {toggle.label}
        </label>
      )}
      <button type="submit" className={`inline-flex min-h-10 items-center rounded-[10px] bg-primary px-5 text-sm font-medium text-on-primary hover:bg-primary-hover ${focusRing}`}>
        {t("apply")}
      </button>
    </form>
  );
}

// A search param, kept only if it is one of the allowed codes.
export function pick<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

const STATUS_KEY = { pending: "statusPending", accepted: "statusAccepted", declined: "statusDeclined", withdrawn: "statusWithdrawn" } as const;

// Groups the caller's connections. `names` holds only names RLS let the caller read.
export async function ConnectionList({ connections, me, names, labels }: { connections: ConnectionRow[]; me: string; names: Map<string, string>; labels: Map<string, string> }) {
  const [t, format] = await Promise.all([getTranslations("connections"), getFormatter()]);
  if (!connections.length) return <p className="text-soft">{t("empty")}</p>;

  const groups = [
    ["incoming", connections.filter((c) => c.status === "pending" && c.requested_by !== me)],
    ["outgoing", connections.filter((c) => c.status === "pending" && c.requested_by === me)],
    ["active", connections.filter((c) => c.status === "accepted")],
    ["past", connections.filter((c) => c.status === "declined" || c.status === "withdrawn")],
  ] as const;

  return (
    <div className="space-y-8">
      {groups.map(([key, items]) =>
        items.length ? (
          <section key={key}>
            <h2 className="mb-3 text-lg font-semibold tracking-tight">{t(key)}</h2>
            <ul className="space-y-3">
              {items.map((c) => {
                const other = c.student_id === me ? c.agent_id : c.student_id;
                const otherIsAgent = other === c.agent_id;
                return (
                  <li key={c.id} className={`${card} space-y-2`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={otherIsAgent ? `/student/agents/${other}` : `/agent/students/${other}`} className={link}>
                        {names.get(other) ?? labels.get(other) ?? "—"}
                      </Link>
                      <span className="flex items-center gap-2 text-xs text-soft">
                        <Chip>{t(STATUS_KEY[c.status])}</Chip>
                        <time dateTime={c.created_at}>{format.dateTime(new Date(c.created_at), { dateStyle: "medium" })}</time>
                      </span>
                    </div>
                    {c.message && (
                      <p dir="auto" className="text-sm whitespace-pre-line text-ink">
                        {c.message}
                      </p>
                    )}
                    {key === "incoming" && (
                      <>
                        {!otherIsAgent ? null : <p className="text-xs text-soft">{t("acceptNote")}</p>}
                        <ConnectionActions id={c.id} actions={["accept", "decline"]} />
                      </>
                    )}
                    {key === "outgoing" && <ConnectionActions id={c.id} actions={["withdraw"]} />}
                    {key === "active" && <ConnectedLinks base={otherIsAgent ? "/student" : "/agent"} id={c.id} />}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}

// Where an accepted connection continues: its message thread and the applications page.
async function ConnectedLinks({ base, id }: { base: string; id: string }) {
  const t = await getTranslations("messaging");
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <Link href={`${base}/messages/${id}`} className={link}>
        {t("openThread")}
      </Link>
      <Link href={`${base}/applications`} className={link}>
        {t("openApplications")}
      </Link>
    </p>
  );
}
