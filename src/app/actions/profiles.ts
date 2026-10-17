"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser, type Role } from "@/lib/auth";
import { UUID } from "@/lib/data";
import {
  AgentProfile,
  ConnectionNote,
  Credential,
  CREDENTIAL_MAX_BYTES,
  CREDENTIAL_MIME,
  errorField,
  formObject,
  StudentProfile,
} from "@/lib/profile-schema";
import { createClient } from "@/lib/supabase/server";

// Codes double as message keys under "forms.errors"; field names under "forms.fields".
export type ActionState =
  | {
      error?:
        | "invalid"
        | "file_too_big"
        | "file_type"
        | "not_available"
        | "already_connected"
        | "too_many_pending"
        | "profile_required"
        | "unknown";
      field?: string;
      done?: boolean;
    }
  | undefined;

const DB_ERRORS = ["not_available", "already_connected", "too_many_pending", "profile_required"] as const;

function dbError(message: string | undefined): NonNullable<ActionState>["error"] {
  return DB_ERRORS.find((code) => message === code) ?? "unknown";
}

async function userWithRole(role: Role) {
  const user = await getCurrentUser();
  return user?.active && user.role === role ? user : null;
}

function refresh() {
  for (const role of ["student", "agent", "admin"]) revalidatePath(`/[locale]/${role}`, "layout");
}

export async function saveStudentProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await userWithRole("student");
  if (!user) return { error: "not_available" };
  const parsed = StudentProfile.safeParse(formObject(form));
  if (!parsed.success) return { error: "invalid", field: errorField(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("student_profiles")
    .upsert({ user_id: user.id, ...parsed.data, updated_at: new Date().toISOString() });
  if (error) return { error: "unknown" };
  refresh();
  return { done: true };
}

export async function saveAgentProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await userWithRole("agent");
  if (!user) return { error: "not_available" };
  const parsed = AgentProfile.safeParse(formObject(form));
  if (!parsed.success) return { error: "invalid", field: errorField(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("agent_profiles")
    .upsert({ user_id: user.id, ...parsed.data, updated_at: new Date().toISOString() });
  if (error) return { error: "unknown" };
  refresh();
  return { done: true };
}

const EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function submitCredential(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await userWithRole("agent");
  if (!user) return { error: "not_available" };
  const parsed = Credential.safeParse(formObject(form));
  if (!parsed.success) return { error: "invalid", field: errorField(parsed.error) };

  const file = form.get("document");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile && file.size > CREDENTIAL_MAX_BYTES) return { error: "file_too_big" };
  if (hasFile && !CREDENTIAL_MIME.includes(file.type)) return { error: "file_type" };

  const supabase = await createClient();
  let documentPath: string | null = null;
  if (hasFile) {
    // The browser-reported type is untrusted; the storage bucket enforces the same type and size list.
    documentPath = `${user.id}/${crypto.randomUUID()}.${EXTENSION[file.type]}`;
    const { error } = await supabase.storage
      .from("credentials")
      .upload(documentPath, file, { contentType: file.type, upsert: false });
    if (error) return { error: "unknown" };
  }

  const { error } = await supabase
    .from("credentials")
    .insert({ agent_id: user.id, ...parsed.data, document_path: documentPath });
  if (error) {
    if (documentPath) await supabase.storage.from("credentials").remove([documentPath]);
    return { error: "unknown" };
  }
  refresh();
  return { done: true };
}

export async function requestConnection(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const target = String(form.get("target") ?? "");
  const note = ConnectionNote.safeParse(form.get("note") ?? "");
  if (!user?.active || !UUID.test(target)) return { error: "not_available" };
  if (!note.success) return { error: "invalid", field: "note" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_connection", { target, note: note.data });
  if (error) return { error: dbError(error.message) };
  refresh();
  return { done: true };
}

const Respond = z.object({ id: z.uuid(), decision: z.enum(["accept", "decline", "withdraw"]) });

export async function updateConnection(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const parsed = Respond.safeParse(Object.fromEntries(form));
  if (!user?.active || !parsed.success) return { error: "not_available" };
  const { id, decision } = parsed.data;

  const supabase = await createClient();
  const { error } =
    decision === "withdraw"
      ? await supabase.rpc("withdraw_connection", { connection: id })
      : await supabase.rpc("respond_connection", { connection: id, accept: decision === "accept" });
  if (error) return { error: dbError(error.message) };
  refresh();
  return { done: true };
}

const Review = z.object({
  id: z.uuid(),
  verdict: z.enum(["under_review", "verified", "rejected"]),
  note: z.string().trim().max(500).default(""),
});

export async function reviewCredential(_: ActionState, form: FormData): Promise<ActionState> {
  // review_credential() checks is_admin() again in the database.
  const user = await userWithRole("admin");
  const parsed = Review.safeParse(Object.fromEntries(form));
  if (!user) return { error: "not_available" };
  if (!parsed.success) return { error: "invalid", field: errorField(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_credential", {
    credential: parsed.data.id,
    verdict: parsed.data.verdict,
    note: parsed.data.note,
  });
  if (error) return { error: dbError(error.message) };
  refresh();
  return { done: true };
}
