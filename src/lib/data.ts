import "server-only";
import { createClient } from "./supabase/server";
import type { Database } from "./supabase/database.types";

// Every query runs as the signed-in user, so Row Level Security decides what comes back.
// Callers check the role first with requireRole() or getCurrentUser().

type Tables = Database["public"]["Tables"];
export type StudentProfileRow = Tables["student_profiles"]["Row"];
export type AgentProfileRow = Tables["agent_profiles"]["Row"];
export type CredentialRow = Tables["credentials"]["Row"];
export type ConnectionRow = Tables["connections"]["Row"];

export type AgentListing = AgentProfileRow & { verified: boolean };

// shortcut: filters and matching run over at most 500 rows in memory; move them into SQL when listings grow.
const LIST_LIMIT = 500;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getStudentProfile(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("student_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAgentProfile(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("agent_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function verifiedAgents(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const supabase = await createClient();
  const { data, error } = await supabase.from("credentials").select("agent_id").eq("status", "verified").in("agent_id", ids);
  if (error) throw error;
  return new Set(data.map((c) => c.agent_id));
}

export async function listAgents(): Promise<AgentListing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_profiles")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw error;
  const verified = await verifiedAgents(data.map((a) => a.user_id));
  return data.map((a) => ({ ...a, verified: verified.has(a.user_id) }));
}

export async function getAgent(id: string): Promise<(AgentListing & { credentials: CredentialRow[] }) | null> {
  const supabase = await createClient();
  const [{ data: agent, error }, { data: credentials, error: credentialsError }] = await Promise.all([
    supabase.from("agent_profiles").select("*").eq("user_id", id).maybeSingle(),
    supabase.from("credentials").select("*").eq("agent_id", id).order("created_at", { ascending: false }),
  ]);
  if (error) throw error;
  if (credentialsError) throw credentialsError;
  if (!agent) return null;
  return { ...agent, credentials, verified: credentials.some((c) => c.status === "verified") };
}

// RLS returns visible students plus those connected to (or asking) this agent.
export async function listStudentsForAgent() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_profiles")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw error;
  return data;
}

export async function getStudentForAgent(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("student_profiles").select("*").eq("user_id", id).maybeSingle();
  if (error) throw error;
  return data;
}

// Names the caller is allowed to see (RLS). A student missing from the map stays anonymous.
export async function namesOf(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  if (error) throw error;
  return new Map(data.map((p) => [p.id, p.display_name]));
}

export async function listConnections() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("connections").select("*").order("created_at", { ascending: false }).limit(LIST_LIMIT);
  if (error) throw error;
  return data;
}

// The open (pending or accepted) connection between the caller and one other user, if any.
export async function openConnectionWith(otherId: string) {
  // The id goes into a PostgREST filter string, so only a UUID may reach it.
  if (!UUID.test(otherId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("connections")
    .select("*")
    .or(`student_id.eq.${otherId},agent_id.eq.${otherId}`)
    .in("status", ["pending", "accepted"])
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listOwnCredentials(agentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("credentials")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listCredentialsForReview() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("credentials")
    .select("*")
    .order("status", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return data;
}

// Short-lived links for an admin or the owning agent, signed in one request and keyed by file path.
// Storage RLS refuses everyone else; a refused or failed path is left out, so its link is hidden.
export async function credentialFileUrls(paths: string[]) {
  const urls = new Map<string, string>();
  if (!paths.length) return urls;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("credentials").createSignedUrls(paths, 300);
  for (const f of data ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  return urls;
}
