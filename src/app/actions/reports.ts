"use server";

import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { UUID } from "@/lib/data";
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
  const value = form.get("locale");
  const locale = typeof value === "string" && hasLocale(routing.locales, value) ? value : routing.defaultLocale;
  revalidatePath(`/${locale}/student/reports`);
  redirect(`/${locale}/student/reports`);
}
