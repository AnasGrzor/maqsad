import "server-only";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { cacheTag } from "next/cache";
import { getCurrentUser } from "./auth";
import { createClient } from "./supabase/server";
import type { Database } from "./supabase/database.types";

// Plans live in public.plans (seeded and changed in supabase/migrations/20261019000003_plans_limits.sql).
// Prices are PKR a month; null means the price is not set yet. A null report limit means not included.

export type PlanRow = Database["public"]["Tables"]["plans"]["Row"];
export type PlanRequestRow = Database["public"]["Tables"]["subscription_requests"]["Row"];
export type Allowance = { plan: string; used: number; limit: number | null; resets_at: string };

export const PLANS_TAG = "plans";

// Everyone may read plans, so the cached read uses no session (cookies aren't allowed inside "use cache").
// Admin edits call updateTag(PLANS_TAG).
export async function getPlans(): Promise<PlanRow[]> {
  "use cache";
  cacheTag(PLANS_TAG);
  const supabase = createAnonClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase.from("plans").select("*").order("sort_order");
  if (error) throw error;
  return data;
}

// The caller's verification report allowance this month, or null for signed-out, suspended and admin accounts.
export async function getAllowance(): Promise<Allowance | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("allowance", { kind: "verification_report" });
  return error ? null : (data as Allowance);
}

// Plan, usage and the latest upgrade request of the signed-in user (RLS: own rows only).
export async function getMyPlan(userId: string) {
  const supabase = await createClient();
  const [allowance, plans, { data: subscription }, { data: request }] = await Promise.all([
    getAllowance(),
    getPlans(),
    supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("subscription_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!allowance) return null;
  const plan = plans.find((p) => p.id === allowance.plan)!;
  return { plan, plans, allowance, subscription, request };
}

// /api/analyze: sign-in required, then one verification report is recorded before any model call.
// Returns the response to send when the check may not run, or null. The client translates `code` (usage.errors).
export async function consumeCheck(): Promise<Response | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to check a document.", code: "sign_in_required" }, { status: 401 });
  // Admins have no plan; they check documents while reviewing credentials and disputes, unmetered.
  const me = await getCurrentUser();
  if (me?.active && me.role === "admin") return null;
  const { error } = await supabase.rpc("use_allowance", { kind: "verification_report" });
  if (!error) return null;
  if (error.message === "limit_reached" || error.message === "not_included") {
    const allowance = await getAllowance();
    const reached = error.message === "limit_reached";
    return Response.json(
      {
        error: reached ? "You have used this month's verification reports." : "Your plan doesn't include verification reports.",
        code: error.message,
        limit: allowance?.limit ?? null,
        resetsAt: allowance?.resets_at ?? null,
      },
      { status: reached ? 429 : 403 },
    );
  }
  if (error.message === "not_available") {
    return Response.json({ error: "This account can't run checks.", code: "not_available" }, { status: 403 });
  }
  console.error("use_allowance failed", error.code);
  return Response.json({ error: "Something went wrong. Please try again.", code: "unknown" }, { status: 500 });
}

export async function listPendingPlanRequests() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscription_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return data;
}
