import "server-only";
import { getCurrentUser } from "./auth";
import { UUID } from "./data";
import { fromRow, toRow, type ReportRow } from "./report-row";
import type { Report } from "./schema";
import type { Json } from "./supabase/database.types";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";

// Saved verification reports. Reads and deletes run as the signed-in user, so RLS decides: owners and
// admins read, owners delete, nobody updates. Inserts happen only here, with the server key, so a report
// in the table is always one this server produced.

export type SavedReport = { id: string; created_at: string; owner_id: string; case_id: string | null; report: Report };

// Returns the new id, or null when the user can't save (signed out, not a student) or the insert failed.
// Never throws: a failed save must not turn a finished check into an error.
export async function saveReport(report: Report): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    if (!user?.active || user.role !== "student") return null;
    const row = toRow(report);
    // The owner is the user checked above, never a value from the request.
    const { data, error } = await createAdminClient()
      .from("verification_reports")
      .insert({
        ...row,
        owner_id: user.id,
        findings: row.findings as unknown as Json,
        official_contact: row.official_contact as unknown as Json,
      })
      .select("id")
      .single();
    // The error code only: the row holds report content.
    if (error) console.error("Saving a verification report failed:", error.code);
    return data?.id ?? null;
  } catch (e) {
    console.error("Saving a verification report failed:", e instanceof Error ? e.name : "unknown");
    return null;
  }
}

type Row = { id: string; created_at: string; owner_id: string; case_id: string | null } & Record<keyof ReportRow, unknown>;
const toSaved = (r: Row): SavedReport => ({
  id: r.id,
  created_at: r.created_at,
  owner_id: r.owner_id,
  case_id: r.case_id,
  report: fromRow(r as unknown as ReportRow),
});

export async function listReports(ownerId: string): Promise<SavedReport[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("verification_reports")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data.map(toSaved);
}

export async function getReport(id: string): Promise<SavedReport | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("verification_reports").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toSaved(data) : null;
}

// Reports linked to a case. RLS returns only the caller's own (and all of them to admins).
export async function reportsForCase(caseId: string): Promise<SavedReport[]> {
  if (!UUID.test(caseId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("verification_reports").select("*").eq("case_id", caseId).order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(toSaved);
}

// Admin list, newest first, optionally one risk level. RLS lets only admins read other people's reports.
export async function listReportsForAdmin(risk?: Report["risk"]): Promise<SavedReport[]> {
  const supabase = await createClient();
  let query = supabase.from("verification_reports").select("*").order("created_at", { ascending: false }).limit(200);
  if (risk) query = query.eq("risk", risk);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(toSaved);
}
