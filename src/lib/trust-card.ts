import "server-only";
import { UUID } from "./data";
import { createAdminClient } from "./supabase/admin";

// The public trust card an agent shares outside Iraada. Viewers may be signed out, so RLS can't answer;
// the secret key reads one agent's public fields here, and only for an active agent account.
// Nothing private leaves this function: no email, credential documents, references or review notes.
export async function getTrustCard(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = createAdminClient();
  const [account, agent, verified] = await Promise.all([
    supabase.from("profiles").select("role, status, created_at").eq("id", id).maybeSingle(),
    supabase
      .from("agent_profiles")
      .select("agency_name, kind, city, destinations, levels, fees, website")
      .eq("user_id", id)
      .maybeSingle(),
    supabase.from("credentials").select("id", { count: "exact", head: true }).eq("agent_id", id).eq("status", "verified"),
  ]);
  if (account.error) throw account.error;
  if (agent.error) throw agent.error;
  if (verified.error) throw verified.error;
  if (!account.data || account.data.role !== "agent" || account.data.status !== "active" || !agent.data) return null;
  return { ...agent.data, since: account.data.created_at, verified: (verified.count ?? 0) > 0 };
}
