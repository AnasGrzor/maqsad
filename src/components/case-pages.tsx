import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser, requireRole } from "@/lib/auth";
import {
  acceptedConnections,
  caseTitles,
  getCase,
  getThread,
  listCases,
  listNotifications,
  listOwnDisputes,
  listThreads,
  openItemsOf,
  unreadCount,
  type CaseEventRow,
  type DisputeRow,
  type NotificationRow,
} from "@/lib/case-data";
import { isOverdue, today } from "@/lib/cases";
import { namesOf } from "@/lib/data";
import { reportsForCase } from "@/lib/reports";
import type { Database } from "@/lib/supabase/database.types";
import { countryName } from "@/lib/taxonomy";
import { AutoRefresh, CaseStatusForm, DisputeForm, ItemForm, ItemToggle, MarkReadButton, MessageForm, OpenCaseForm, RecordForm } from "./case-forms";
import { Notice } from "./dashboard-pages";
import { PageHeading } from "./feature-list";
import { card, Chip } from "./listings";
import { focusRing } from "./styles";

type Party = "student" | "agent";
type CaseStatus = Database["public"]["Enums"]["case_status"];

const link = `font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-current ${focusRing}`;
const h2 = "text-xl font-semibold tracking-tight";
const disclosure = `${card} [&_summary]:cursor-pointer [&_summary]:font-medium`;
const danger = "bg-danger-bg text-danger";

const other = (c: { student_id: string; agent_id: string }, me: string) => (c.student_id === me ? c.agent_id : c.student_id);

// Postgres `date` values are calendar days, so they are formatted in UTC to avoid shifting a day.
function dayFormat(format: Awaited<ReturnType<typeof getFormatter>>) {
  return (day: string) => format.dateTime(new Date(`${day}T00:00:00Z`), { dateStyle: "medium", timeZone: "UTC" });
}

async function StatusChip({ status }: { status: CaseStatus }) {
  const t = await getTranslations("cases.status");
  const tone = { active: "bg-warm-soft text-ink", completed: "bg-turq-soft text-ink", closed: "bg-line text-soft" }[status];
  return <Chip tone={tone}>{t(status)}</Chip>;
}

// ---------------------------------------------------------------- Applications (cases)

export async function ApplicationsPage({ role }: { role: Party }) {
  const user = await requireRole(role);
  const [t, cases, connections, locale] = await Promise.all([getTranslations("cases"), listCases(), acceptedConnections(), getLocale()]);
  const [names, open] = await Promise.all([
    namesOf([...new Set([...cases, ...connections].map((c) => other(c, user.id)))]),
    openItemsOf(cases.map((c) => c.id)),
  ]);
  const now = today();
  const nameOf = (id: string) => names.get(id) ?? t("someone");

  return (
    <div className="space-y-8">
      <PageHeading title={t(`title.${role}`)} intro={t("intro")} />
      <p>
        <Link href={`/${role}/disputes`} className={`${link} text-sm`}>
          {t("disputesLink")}
        </Link>
      </p>
      {connections.length ? (
        <details className={disclosure}>
          <summary>{t("open")}</summary>
          <div className="mt-4">
            <OpenCaseForm connections={connections.map((c) => ({ value: c.id, label: nameOf(other(c, user.id)) }))} />
          </div>
        </details>
      ) : (
        <Notice href={role === "student" ? "/student/agents" : "/agent/students"} action={t("findConnections")}>
          {t("needConnection")}
        </Notice>
      )}
      {cases.length ? (
        <ul className="space-y-3">
          {cases.map((c) => {
            const items = open.filter((i) => i.case_id === c.id);
            const overdue = items.filter((i) => isOverdue(i, now)).length;
            return (
              <li key={c.id} className={`${card} space-y-2`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/${role}/applications/${c.id}`} dir="auto" className={link}>
                      {c.title}
                    </Link>
                    <p className="mt-1 text-sm text-soft">
                      {t("with", { name: nameOf(other(c, user.id)) })} · {t(`kinds.${c.kind}`)} · {countryName(c.country, locale)}
                    </p>
                  </div>
                  <StatusChip status={c.status} />
                </div>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  {t("openItems", { count: items.length })}
                  {overdue > 0 && <Chip tone={danger}>{t("overdueCount", { count: overdue })}</Chip>}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-soft">{t("empty")}</p>
      )}
    </div>
  );
}

function eventText(t: Awaited<ReturnType<typeof getTranslations<"cases">>>, e: CaseEventRow, name: string) {
  const d = (e.detail ?? {}) as Record<string, string>;
  switch (e.kind) {
    case "status_changed":
      return t("events.status_changed", { name, from: t(`status.${d.from as CaseStatus}`), to: t(`status.${d.to as CaseStatus}`) });
    case "record_added":
      return t("events.record_added", { name, kind: t(`recordKinds.${d.kind as "promise"}`) });
    case "item_added":
    case "item_done":
    case "item_reopened":
      return t(`events.${e.kind}`, { name, title: d.title ?? "" });
    default:
      return t("events.case_opened", { name });
  }
}

export async function CasePage({ role, id }: { role: Party; id: string }) {
  const user = await requireRole(role);
  const [t, format, locale, kase, linked, r, c] = await Promise.all([
    getTranslations("cases"),
    getFormatter(),
    getLocale(),
    getCase(id),
    reportsForCase(id),
    getTranslations("reports"),
    getTranslations("checker"),
  ]);
  if (!kase) return <p className="text-soft">{t("notFound")}</p>;

  const names = await namesOf([kase.student_id, kase.agent_id]);
  const nameOf = (uid: string | null) => (uid === user.id ? t("you") : (uid && names.get(uid)) || t("someone"));
  const when = (ts: string) => format.dateTime(new Date(ts), { dateStyle: "medium", timeStyle: "short" });
  const day = dayFormat(format);
  const now = today();
  // Open items first, soonest due first; undated items after dated ones.
  const items = [...kase.items].sort(
    (a, b) => Number(a.status === "done") - Number(b.status === "done") || (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999"),
  );
  const overdue = items.filter((i) => isOverdue(i, now)).length;
  const recordById = new Map(kase.records.map((r) => [r.id, r]));
  const corrected = new Set(kase.records.map((r) => r.corrects).filter(Boolean));
  const recordOptions = kase.records.map((r) => ({ value: r.id, label: `${t(`recordKinds.${r.kind}`)} · ${r.summary.slice(0, 60)} (${day(r.created_at.slice(0, 10))})` }));

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p>
          <Link href={`/${role}/applications`} className={`${link} text-sm`}>
            {t(`back.${role}`)}
          </Link>
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 dir="auto" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {kase.title}
          </h1>
          <StatusChip status={kase.status} />
        </div>
        <p className="text-soft">
          {t("with", { name: nameOf(other(kase, user.id)) })} · {t(`kinds.${kase.kind}`)} · {countryName(kase.country, locale)}
        </p>
        <p className="text-sm text-soft">{t("openedBy", { name: nameOf(kase.opened_by), date: when(kase.created_at) })}</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href={`/${role}/messages/${kase.connection_id}`} className={link}>
            {t("messagesLink")}
          </Link>
          <CaseStatusForm caseId={kase.id} status={kase.status} />
        </div>
      </header>

      <section className="space-y-4" aria-labelledby="items">
        <h2 id="items" className={h2}>
          {t("itemsTitle")}
        </h2>
        {overdue > 0 && (
          <p role="status" className={`rounded-xl p-3 text-sm font-medium ring-1 ring-danger/15 ${danger}`}>
            {t("overdueBanner", { count: overdue })}
          </p>
        )}
        {items.length ? (
          <ul className="space-y-3">
            {items.map((i) => {
              const late = isOverdue(i, now);
              const done = i.status === "done";
              return (
                <li key={i.id} className={`${card} space-y-2 ${late ? "ring-2 ring-danger/40" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="flex flex-wrap gap-2">
                        <Chip>{t(`itemKinds.${i.kind}`)}</Chip>
                        {late && <Chip tone={danger}>{t("overdue")}</Chip>}
                        {done && <Chip tone="bg-turq-soft text-ink">{t("done")}</Chip>}
                      </p>
                      <h3 dir="auto" className={`font-semibold ${done ? "text-soft line-through" : ""}`}>
                        {i.title}
                      </h3>
                    </div>
                    <ItemToggle itemId={i.id} done={done} />
                  </div>
                  {i.details && (
                    <p dir="auto" className="text-sm whitespace-pre-line">
                      {i.details}
                    </p>
                  )}
                  <p className="text-xs text-soft">
                    {i.due_on && <span className={late ? "font-semibold text-danger" : ""}>{t("due", { date: day(i.due_on) })} · </span>}
                    {t("addedBy", { name: nameOf(i.created_by), date: when(i.created_at) })}
                    {done && i.completed_at && <> · {t("doneBy", { name: nameOf(i.completed_by), date: when(i.completed_at) })}</>}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-soft">{t("noItems")}</p>
        )}
        <details className={disclosure}>
          <summary>{t("addItem")}</summary>
          <div className="mt-4">
            <ItemForm caseId={kase.id} />
          </div>
        </details>
      </section>

      <section className="space-y-4" aria-labelledby="records">
        <header>
          <h2 id="records" className={h2}>
            {t("recordsTitle")}
          </h2>
          <p className="mt-1 max-w-[68ch] text-sm text-soft">{t("recordsIntro")}</p>
        </header>
        {kase.records.length ? (
          <ul className="space-y-3">
            {kase.records.map((r) => (
              <li key={r.id} className={`${card} space-y-2`}>
                <p className="flex flex-wrap gap-2">
                  <Chip>{t(`recordKinds.${r.kind}`)}</Chip>
                  {corrected.has(r.id) && <Chip tone="bg-warm-soft text-ink">{t("corrected")}</Chip>}
                </p>
                <p dir="auto" className="whitespace-pre-line">
                  {r.summary}
                </p>
                {r.amount !== null && r.currency && (
                  <p className="font-semibold">{format.number(Number(r.amount), { style: "currency", currency: r.currency })}</p>
                )}
                {r.on_date && <p className="text-sm">{t("onDate", { date: day(r.on_date) })}</p>}
                {r.corrects && recordById.has(r.corrects) && (
                  <p className="text-sm text-soft">
                    {t("correctsRecord", { name: nameOf(recordById.get(r.corrects)!.recorded_by), date: when(recordById.get(r.corrects)!.created_at) })}
                  </p>
                )}
                {r.kind === "payment_reported" && (
                  <p className="rounded-lg bg-warm-soft p-2 text-sm ring-1 ring-warm">{t("paymentNote", { name: nameOf(r.recorded_by) })}</p>
                )}
                <p className="text-xs text-soft">{t("recordedBy", { name: nameOf(r.recorded_by), date: when(r.created_at) })}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-soft">{t("noRecords")}</p>
        )}
        <details className={disclosure}>
          <summary>{t("addRecord")}</summary>
          <div className="mt-4">
            <RecordForm caseId={kase.id} records={recordOptions} />
          </div>
        </details>
      </section>

      <section className="space-y-4" aria-labelledby="history">
        <h2 id="history" className={h2}>
          {t("historyTitle")}
        </h2>
        <ol className="space-y-2 border-s-2 border-line ps-4 text-sm">
          {kase.events.map((e) => (
            <li key={e.id}>
              <time dateTime={e.created_at} className="text-soft">
                {when(e.created_at)}
              </time>{" "}
              <span dir="auto">{eventText(t, e, nameOf(e.actor_id))}</span>
            </li>
          ))}
        </ol>
      </section>

      {linked.length > 0 && (
        <section className="space-y-3" aria-labelledby="linked-reports">
          <h2 id="linked-reports" className={h2}>
            {r("linkedTitle")}
          </h2>
          <p className="text-sm text-soft">{r("linkedPrivate")}</p>
          <ul className="space-y-2 text-sm">
            {linked.map((x) => (
              <li key={x.id} className={`${card} flex flex-wrap items-center justify-between gap-2`}>
                <Link href={`/student/reports/${x.id}`} dir="auto" className={link}>
                  {c(`docType.${x.report.extraction.doc_type}`)}
                  {x.report.extraction.issuer_name && ` · ${x.report.extraction.issuer_name}`}
                </Link>
                <span className="flex items-center gap-2 text-xs text-soft">
                  <Chip>{c(`risk.${x.report.risk}.title`)}</Chip>
                  {when(x.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ReportSection connectionId={kase.connection_id} caseId={kase.id} records={recordOptions} disputes={kase.disputes} />
    </div>
  );
}

// ---------------------------------------------------------------- Reports and disputes (user side)

async function ReportSection({ connectionId, caseId, records, disputes }: { connectionId: string; caseId?: string; records?: { value: string; label: string }[]; disputes: DisputeRow[] }) {
  const t = await getTranslations("disputes");
  return (
    <section className="space-y-4" aria-labelledby="report">
      <header>
        <h2 id="report" className={h2}>
          {t("title")}
        </h2>
        <p className="mt-1 max-w-[68ch] text-sm text-soft">{t("privacy")}</p>
      </header>
      {disputes.length > 0 && <DisputeList disputes={disputes} />}
      <details className={disclosure}>
        <summary>{t("open")}</summary>
        <div className="mt-4">
          <DisputeForm connectionId={connectionId} caseId={caseId} records={records} />
        </div>
      </details>
    </section>
  );
}

async function DisputeList({ disputes, titles, role }: { disputes: DisputeRow[]; titles?: Map<string, string>; role?: Party }) {
  const [t, format] = await Promise.all([getTranslations("disputes"), getFormatter()]);
  const tone = { open: "bg-warm-soft text-ink", under_review: "bg-tint text-ink", resolved: "bg-turq-soft text-ink", dismissed: "bg-line text-soft" };
  return (
    <ul className="space-y-3">
      {disputes.map((d) => (
        <li key={d.id} className={`${card} space-y-2`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex flex-wrap gap-2">
              <Chip>{t(`kinds.${d.kind}`)}</Chip>
              <span className="font-medium">{t(`reasons.${d.reason}`)}</span>
            </p>
            <Chip tone={tone[d.status]}>{t(`status.${d.status}`)}</Chip>
          </div>
          <p dir="auto" className="text-sm whitespace-pre-line">
            {d.details}
          </p>
          {d.resolution_note && (
            <p dir="auto" className="rounded-xl bg-turq-faint p-3 text-sm whitespace-pre-line ring-1 ring-turq-soft">
              <span className="font-medium">{t("resolution")}: </span>
              {d.resolution_note}
            </p>
          )}
          <p className="text-xs text-soft">
            {t("sentOn", { date: format.dateTime(new Date(d.created_at), { dateStyle: "medium", timeStyle: "short" }) })}
            {role && d.case_id && titles?.has(d.case_id) && (
              <>
                {" · "}
                <Link href={`/${role}/applications/${d.case_id}`} dir="auto" className={link}>
                  {titles.get(d.case_id)}
                </Link>
              </>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}

export async function DisputesPage({ role }: { role: Party }) {
  await requireRole(role);
  const [t, disputes] = await Promise.all([getTranslations("disputes"), listOwnDisputes()]);
  const titles = await caseTitles([...new Set(disputes.map((d) => d.case_id).filter((id): id is string => !!id))]);
  return (
    <div className="space-y-6">
      <PageHeading title={t("listTitle")} intro={t("privacy")} />
      {disputes.length ? <DisputeList disputes={disputes} titles={titles} role={role} /> : <p className="text-soft">{t("empty")}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Messages

export async function MessagesPage({ role }: { role: Party }) {
  const user = await requireRole(role);
  const [t, format, threads] = await Promise.all([getTranslations("messaging"), getFormatter(), listThreads()]);
  const names = await namesOf(threads.map(({ connection }) => other(connection, user.id)));
  return (
    <div className="space-y-6">
      <PageHeading title={t("title")} intro={t("intro")} />
      {threads.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-card ring-1 ring-line">
          {threads.map(({ connection, last }) => (
            <li key={connection.id}>
              <Link href={`/${role}/messages/${connection.id}`} className={`block space-y-1 p-4 hover:bg-tint-soft ${focusRing}`}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{names.get(other(connection, user.id)) ?? t("someone")}</span>
                  {last && (
                    <time dateTime={last.created_at} className="text-xs text-soft">
                      {format.dateTime(new Date(last.created_at), { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                  )}
                </span>
                <span dir="auto" className="line-clamp-1 block text-sm text-soft">
                  {last ? `${last.sender_id === user.id ? t("youPrefix") : ""}${last.body}` : t("noMessages")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Notice href={role === "student" ? "/student/agents" : "/agent/students"} action={t("findConnections")}>
          {t("needConnection")}
        </Notice>
      )}
    </div>
  );
}

export async function ThreadPage({ role, id }: { role: Party; id: string }) {
  const user = await requireRole(role);
  const [t, format, thread] = await Promise.all([getTranslations("messaging"), getFormatter(), getThread(id)]);
  if (!thread) return <p className="text-soft">{t("notFound")}</p>;
  const { connection, messages, cases } = thread;
  const otherId = other(connection, user.id);
  const names = await namesOf([otherId]);
  const titles = new Map(cases.map((c) => [c.id, c.title]));
  const disputes = (await listOwnDisputes()).filter((d) => d.connection_id === connection.id && !d.case_id);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p>
          <Link href={`/${role}/messages`} className={`${link} text-sm`}>
            {t("back")}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{names.get(otherId) ?? t("someone")}</h1>
        <p className="text-sm text-soft">{t("refreshNote")}</p>
      </header>
      {/* column-reverse keeps the scroll pinned to the newest message while the DOM stays oldest-first */}
      <div className="flex max-h-[60vh] flex-col-reverse overflow-y-auto rounded-2xl bg-card p-4 ring-1 ring-line">
        {messages.length ? (
          <ol role="log" aria-live="polite" aria-label={t("historyLabel")} className="space-y-3">
            {messages.map((m) => {
              const mine = m.sender_id === user.id;
              return (
                <li key={m.id} className={`w-fit max-w-[85%] rounded-2xl px-4 py-2.5 ${mine ? "ms-auto bg-primary text-on-primary" : "me-auto bg-tint"}`}>
                  <p className="text-xs opacity-80">
                    <span className="font-medium">{mine ? t("you") : (names.get(m.sender_id) ?? t("someone"))}</span>
                    {" · "}
                    <time dateTime={m.created_at}>{format.dateTime(new Date(m.created_at), { dateStyle: "medium", timeStyle: "short" })}</time>
                    {m.case_id && titles.has(m.case_id) && (
                      <>
                        {" · "}
                        <Link href={`/${role}/applications/${m.case_id}`} dir="auto" className={`underline underline-offset-2 ${focusRing}`}>
                          {titles.get(m.case_id)}
                        </Link>
                      </>
                    )}
                  </p>
                  <p dir="auto" className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {m.body}
                  </p>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-soft">{t("empty")}</p>
        )}
      </div>
      <MessageForm connectionId={connection.id} cases={cases.map((c) => ({ value: c.id, label: c.title }))} />
      <AutoRefresh />
      <ReportSection connectionId={connection.id} disputes={disputes} />
    </div>
  );
}

// ---------------------------------------------------------------- Notifications

function notificationHref(role: Party, n: NotificationRow) {
  if (n.case_id && n.kind !== "message") return `/${role}/applications/${n.case_id}`;
  if (n.kind === "connection_request") return role === "agent" ? "/agent/connections" : "/student";
  return `/${role}/messages/${n.connection_id}`;
}

export async function NotificationsPage({ role }: { role: Party }) {
  await requireRole(role);
  const [t, format, list] = await Promise.all([getTranslations("notifications"), getFormatter(), listNotifications()]);
  const [names, titles] = await Promise.all([
    namesOf([...new Set(list.map((n) => n.actor_id))]),
    caseTitles([...new Set(list.map((n) => n.case_id).filter((id): id is string => !!id))]),
  ]);
  const unread = list.some((n) => !n.read_at);
  return (
    <div className="space-y-6">
      <PageHeading title={t("title")} intro={t("intro")} />
      {unread && <MarkReadButton id="all" />}
      {list.length ? (
        <ul className="space-y-2">
          {list.map((n) => (
            <li key={n.id} className={`${card} flex flex-wrap items-start justify-between gap-3 ${n.read_at ? "" : "bg-tint-soft ring-tint-strong"}`}>
              <div className="space-y-1">
                <Link href={notificationHref(role, n)} className={link}>
                  {t(`kinds.${n.kind as "message"}`, { name: names.get(n.actor_id) ?? t("someone"), title: (n.case_id && titles.get(n.case_id)) || "" })}
                </Link>
                <p className="flex flex-wrap items-center gap-2 text-xs text-soft">
                  {!n.read_at && <Chip tone="bg-primary text-on-primary">{t("unreadTag")}</Chip>}
                  <time dateTime={n.created_at}>{format.dateTime(new Date(n.created_at), { dateStyle: "medium", timeStyle: "short" })}</time>
                </p>
              </div>
              {!n.read_at && <MarkReadButton id={n.id} />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-soft">{t("empty")}</p>
      )}
    </div>
  );
}

// Unread count in the dashboard header. Rendered behind Suspense because it reads the session.
export async function NotificationLink({ role }: { role: Party }) {
  const user = await getCurrentUser();
  if (!user?.active || user.role !== role) return null;
  const [t, count] = await Promise.all([getTranslations("notifications"), unreadCount()]);
  return (
    <Link href={`/${role}/notifications`} className={`flex items-center gap-1.5 rounded-[9px] px-2.5 py-2 text-[14.5px] font-medium text-soft transition-colors hover:bg-tint hover:text-ink ${focusRing}`}>
      {t("link")}
      {count > 0 && (
        <span className="rounded-full bg-warm px-1.5 text-xs font-semibold text-ink">
          <span aria-hidden>{count}</span>
          <span className="sr-only">{t("unread", { count })}</span>
        </span>
      )}
    </Link>
  );
}
