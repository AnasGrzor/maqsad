"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { firstError, Profile, SignIn, SignUp, type AuthError } from "@/lib/auth-schema";
import { localeOf } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: AuthError; done?: "confirm_email" | "saved" } | undefined;

function authError(code: string | undefined): AuthError {
  if (code === "user_already_exists" || code === "email_exists") return "email_taken";
  if (code === "invalid_credentials") return "invalid_credentials";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit") return "rate_limited";
  if (code === "weak_password") return "invalid_password";
  return "unknown";
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = SignUp.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { email, password, displayName, role } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role, display_name: displayName } },
  });
  if (error) return { error: authError(error.code) };
  // With email confirmation on, Supabase returns no session (and no error for an existing email, to avoid leaking it).
  if (!data.session) return { done: "confirm_email" };
  redirect(`/${localeOf(form)}/${role}`);
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const parsed = SignIn.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authError(error.code) };

  const user = await getCurrentUser();
  if (!user) return { error: "unknown" };
  if (!user.active) {
    await supabase.auth.signOut();
    return { error: "suspended" };
  }
  redirect(`/${localeOf(form)}/${user.role}`);
}

export async function signOut(form: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${localeOf(form)}`);
}

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || !user.active) return { error: "unknown" };
  const parsed = Profile.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", user.id);
  if (error) return { error: "unknown" };
  revalidatePath(`/${localeOf(form)}/${user.role}`, "layout");
  return { done: "saved" };
}
