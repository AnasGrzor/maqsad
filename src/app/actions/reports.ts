"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { UUID } from "@/lib/data";
import { localeOf } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";

export type DeleteState = { error?: "not_available" } | undefined;

// RLS only lets owners delete; the role check here gives a clear error instead of a silent no-op.
export async function deleteReport(_: DeleteState, form: FormData): Promise<DeleteState> {
  const user = await getCurrentUser();
  const id = String(form.get("id") ?? "");
  if (!user?.active || user.role !== "student" || !UUID.test(id)) return { error: "not_available" };
  const supabase = await createClient();
  const { data } = await supabase.from("verification_reports").delete().eq("id", id).eq("owner_id", user.id).select("id");
  if (!data?.length) return { error: "not_available" };
  const locale = localeOf(form);
  revalidatePath(`/${locale}/student/reports`);
  redirect(`/${locale}/student/reports`);
}

export type LinkState = { error?: "not_available"; done?: boolean } | undefined;

// link_report() checks ownership and case membership again in the database.
export async function linkReport(_: LinkState, form: FormData): Promise<LinkState> {
  const user = await getCurrentUser();
  const id = String(form.get("id") ?? "");
  const target = String(form.get("case") ?? "");
  if (!user?.active || user.role !== "student" || !UUID.test(id) || (target && !UUID.test(target))) return { error: "not_available" };
  const supabase = await createClient();
  // The generated type marks target_case as string, but null (detach) is valid for the function.
  const { error } = await supabase.rpc("link_report", { report: id, target_case: (target || null) as string });
  if (error) return { error: "not_available" };
  revalidatePath("/[locale]/student", "layout");
  return { done: true };
}
