"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Codes double as message keys under "adminUsers.errors"; the database raises the same codes.
const ERRORS = ["forbidden", "reason_required", "cannot_change_self", "cannot_suspend_admin", "not_available", "no_change"] as const;
export type AdminState = { error?: (typeof ERRORS)[number] | "unknown"; done?: boolean } | undefined;

const StatusChange = z.object({
  id: z.uuid(),
  status: z.enum(["active", "suspended"]),
  reason: z.string().trim().min(3).max(500),
});

export async function setAccountStatus(_: AdminState, form: FormData): Promise<AdminState> {
  // set_account_status() checks is_admin() and the self/admin rules again in the database.
  const user = await getCurrentUser();
  if (!user?.active || user.role !== "admin") return { error: "forbidden" };
  const parsed = StatusChange.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.path[0] === "reason" ? "reason_required" : "not_available" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_account_status", {
    target: parsed.data.id,
    new_status: parsed.data.status,
    reason: parsed.data.reason,
  });
  if (error) return { error: ERRORS.find((code) => code === error.message) ?? "unknown" };
  revalidatePath("/[locale]/admin", "layout");
  return { done: true };
}

const DisputeReview = z.object({
  id: z.uuid(),
  status: z.enum(["under_review", "resolved", "dismissed"]),
  note: z.string().trim().max(1000).default(""),
});
export type DisputeState = { error?: "forbidden" | "not_available" | "unknown"; done?: boolean } | undefined;

export async function reviewDispute(_: DisputeState, form: FormData): Promise<DisputeState> {
  // review_dispute() checks is_admin() again and writes the activity history.
  const user = await getCurrentUser();
  if (!user?.active || user.role !== "admin") return { error: "forbidden" };
  const parsed = DisputeReview.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "not_available" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_dispute", {
    dispute: parsed.data.id,
    new_status: parsed.data.status,
    note: parsed.data.note,
  });
  if (error) return { error: error.message === "forbidden" || error.message === "not_available" ? error.message : "unknown" };
  for (const role of ["admin", "student", "agent"]) revalidatePath(`/[locale]/${role}`, "layout");
  return { done: true };
}
