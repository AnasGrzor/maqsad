import "server-only";
import { UUID } from "./data";
import { createClient } from "./supabase/server";
import type { Database } from "./supabase/database.types";

// Cases, messages, notifications and disputes, read as the signed-in user so RLS decides what comes back.
// Callers check the role first with requireRole().

type Tables = Database["public"]["Tables"];
export type CaseRow = Tables["cases"]["Row"];
export type CaseItemRow = Tables["case_items"]["Row"];
export type CaseRecordRow = Tables["case_records"]["Row"];
export type CaseEventRow = Tables["case_events"]["Row"];
export type MessageRow = Tables["messages"]["Row"];
export type NotificationRow = Tables["notifications"]["Row"];
export type DisputeRow = Tables["disputes"]["Row"];

// shortcut: lists stop at these sizes with no paging; add paging when real users reach them.
const LIST_LIMIT = 200;

export async function listCases() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cases").select("*").order("updated_at", { ascending: false }).limit(LIST_LIMIT);
  if (error) throw error;
  return data;
}

// Open items of many cases, for counts on the case list.
export async function openItemsOf(caseIds: string[]) {
  if (!caseIds.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("case_items").select("case_id, due_on, status").eq("status", "open").in("case_id", caseIds);
  if (error) throw error;
  return data;
}

export async function getCase(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data: kase, error } = await supabase.from("cases").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!kase) return null;
  const [items, records, events, disputes] = await Promise.all([
    supabase.from("case_items").select("*").eq("case_id", id).order("created_at"),
    supabase.from("case_records").select("*").eq("case_id", id).order("created_at", { ascending: false }),
    supabase.from("case_events").select("*").eq("case_id", id).order("id", { ascending: false }).limit(LIST_LIMIT),
    supabase.from("disputes").select("*").eq("case_id", id).order("created_at", { ascending: false }),
  ]);
  if (items.error) throw items.error;
  if (records.error) throw records.error;
  if (events.error) throw events.error;
  if (disputes.error) throw disputes.error;
  return {
    ...kase,
    items: items.data,
    records: records.data,
    events: events.data,
    // RLS: only disputes the caller raised.
    disputes: disputes.data,
  };
}

export async function acceptedConnections() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("connections").select("*").eq("status", "accepted").order("responded_at", { ascending: false }).limit(LIST_LIMIT);
  if (error) throw error;
  return data;
}

// Accepted connections with their latest message, most recent conversation first.
export async function listThreads() {
  const connections = await acceptedConnections();
  if (!connections.length) return [];
  const supabase = await createClient();
  // shortcut: latest message per thread from the newest 500 messages; use a SQL view when threads grow.
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .in("connection_id", connections.map((c) => c.id))
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  const latest = new Map<string, MessageRow>();
  for (const m of data) if (!latest.has(m.connection_id)) latest.set(m.connection_id, m);
  return connections
    .map((c) => ({ connection: c, last: latest.get(c.id) ?? null }))
    .sort((a, b) => (b.last?.created_at ?? "").localeCompare(a.last?.created_at ?? ""));
}

export async function getThread(connectionId: string) {
  if (!UUID.test(connectionId)) return null;
  const supabase = await createClient();
  const { data: connection, error } = await supabase.from("connections").select("*").eq("id", connectionId).eq("status", "accepted").maybeSingle();
  if (error) throw error;
  if (!connection) return null;
  const [messages, cases] = await Promise.all([
    supabase.from("messages").select("*").eq("connection_id", connectionId).order("created_at", { ascending: false }).limit(LIST_LIMIT),
    supabase.from("cases").select("id, title").eq("connection_id", connectionId).order("created_at", { ascending: false }),
  ]);
  if (messages.error) throw messages.error;
  if (cases.error) throw cases.error;
  return { connection, messages: messages.data.reverse(), cases: cases.data };
}

export async function listNotifications() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(LIST_LIMIT);
  if (error) throw error;
  return data;
}

export async function unreadCount() {
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return count ?? 0;
}

export async function listOwnDisputes() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("disputes").select("*").order("created_at", { ascending: false }).limit(LIST_LIMIT);
  if (error) throw error;
  return data;
}

export async function caseTitles(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const supabase = await createClient();
  const { data, error } = await supabase.from("cases").select("id, title").in("id", ids);
  if (error) throw error;
  return new Map(data.map((c) => [c.id, c.title]));
}
