"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { PLANS_TAG } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

// Codes are message keys under "subscription.errors".
export type PlanActionState =
  | { error?: "invalid" | "not_available" | "already_pending" | "already_on_plan" | "unknown"; done?: boolean }
  | undefined;

const DB_ERRORS = ["not_available", "already_pending", "already_on_plan"] as const;
const dbError = (message: string) => DB_ERRORS.find((code) => code === message) ?? "unknown";

function refresh() {
  for (const role of ["student", "agent", "admin"]) revalidatePath(`/[locale]/${role}`, "layout");
}

const Request = z.object({ plan: z.string().regex(/^[a-z_]{1,40}$/), note: z.string().trim().max(500).default("") });

// request_plan() checks the role, audience, offered switch and the one-pending rule in the database.
export async function requestPlan(_: PlanActionState, form: FormData): Promise<PlanActionState> {
  const user = await getCurrentUser();
  if (!user?.active || user.role === "admin") return { error: "not_available" };
  const parsed = Request.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_plan", { plan: parsed.data.plan, note: parsed.data.note });
  if (error) return { error: dbError(error.message) };
  refresh();
  return { done: true };
}

async function admin() {
  const user = await getCurrentUser();
  return user?.active && user.role === "admin";
}

const Decide = z.object({ id: z.uuid(), decision: z.enum(["approve", "decline"]), note: z.string().trim().max(500).default("") });

export async function decidePlanRequest(_: PlanActionState, form: FormData): Promise<PlanActionState> {
  // decide_plan_request() checks is_admin() again in the database.
  if (!(await admin())) return { error: "not_available" };
  const parsed = Decide.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_plan_request", {
    request: parsed.data.id,
    approve: parsed.data.decision === "approve",
    note: parsed.data.note,
  });
  if (error) return { error: dbError(error.message) };
  refresh();
  return { done: true };
}

// Empty means "not set" (price) or "not included" (reports).
const optionalCount = (max: number) =>
  z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).max(max).nullable());

const PlanEdit = z.object({
  plan: z.string().regex(/^[a-z_]{1,40}$/),
  price: optionalCount(10_000_000),
  reports: optionalCount(100_000),
  offered: z.literal("on").optional(),
});

export async function updatePlan(_: PlanActionState, form: FormData): Promise<PlanActionState> {
  if (!(await admin())) return { error: "not_available" };
  const parsed = PlanEdit.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "invalid" };
  const supabase = await createClient();
  const { plan, price, reports, offered } = parsed.data;
  // The generated types mark these arguments non-null, but the function accepts null for "not set".
  const { error } = await supabase.rpc("update_plan", {
    plan,
    price: price as number,
    reports: reports as number,
    is_offered: offered === "on",
  });
  if (error) return { error: dbError(error.message) };
  updateTag(PLANS_TAG);
  refresh();
  return { done: true };
}
