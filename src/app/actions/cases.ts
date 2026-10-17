"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/app/actions/profiles";
import { getCurrentUser } from "@/lib/auth";
import { CaseItem, CaseRecord, CaseStatus, Dispute, ItemStatus, Message, OpenCase } from "@/lib/cases";
import { errorField } from "@/lib/profile-schema";
import { createClient } from "@/lib/supabase/server";

// Every write goes through a database function that checks the accepted connection again
// (require_connection in the migration), so these actions only validate input and pass it on.

async function party() {
  const user = await getCurrentUser();
  return user?.active && (user.role === "student" || user.role === "agent") ? user : null;
}

function refresh() {
  for (const role of ["student", "agent"]) revalidatePath(`/[locale]/${role}`, "layout");
}

// Validates the form, then calls one RPC with the parsed fields as its arguments.
async function run<S extends z.ZodType>(schema: S, form: FormData, call: (args: z.output<S>) => PromiseLike<{ error: { message: string } | null }>): Promise<ActionState> {
  if (!(await party())) return { error: "not_available" };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "invalid", field: errorField(parsed.error) };
  const { error } = await call(parsed.data);
  if (error) return { error: error.message === "not_available" || error.message === "plan_required" ? error.message : "unknown" };
  refresh();
  return { done: true };
}

export async function openCase(_: ActionState, form: FormData) {
  return run(OpenCase, form, async (a) => (await createClient()).rpc("open_case", a));
}

export async function setCaseStatus(_: ActionState, form: FormData) {
  return run(CaseStatus, form, async (a) => (await createClient()).rpc("set_case_status", a));
}

export async function addCaseItem(_: ActionState, form: FormData) {
  return run(CaseItem, form, async ({ due_on, ...a }) => (await createClient()).rpc("add_case_item", { ...a, due_on: due_on ?? undefined }));
}

export async function setItemStatus(_: ActionState, form: FormData) {
  return run(ItemStatus, form, async (a) => (await createClient()).rpc("set_item_status", a));
}

export async function addCaseRecord(_: ActionState, form: FormData) {
  return run(CaseRecord, form, async (r) =>
    (await createClient()).rpc("add_case_record", {
      target_case: r.target_case,
      kind: r.kind,
      summary: r.summary,
      amount: r.amount ?? undefined,
      currency: r.currency ?? undefined,
      on_date: r.on_date ?? undefined,
      correction_of: r.correction_of ?? undefined,
    }),
  );
}

export async function sendMessage(_: ActionState, form: FormData) {
  return run(Message, form, async ({ target_case, ...a }) => (await createClient()).rpc("send_message", { ...a, target_case: target_case ?? undefined }));
}

export async function raiseDispute(_: ActionState, form: FormData) {
  return run(Dispute, form, async ({ target_case, target_record, ...a }) =>
    (await createClient()).rpc("raise_dispute", { ...a, target_case: target_case ?? undefined, target_record: target_record ?? undefined }),
  );
}

const MarkRead = z.object({ id: z.union([z.uuid(), z.literal("all")]) });

// RLS limits the update to the caller's own rows; the column grant limits it to read_at.
export async function markNotificationsRead(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await party();
  const parsed = MarkRead.safeParse(Object.fromEntries(form));
  if (!user || !parsed.success) return { error: "not_available" };
  const supabase = await createClient();
  let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (parsed.data.id !== "all") query = query.eq("id", parsed.data.id);
  const { error } = await query;
  if (error) return { error: "unknown" };
  refresh();
  return { done: true };
}
