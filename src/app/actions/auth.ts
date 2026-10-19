"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { firstError, Profile, SignIn, SignUp, type AuthError } from "@/lib/auth-schema";
import { localeOf } from "@/lib/locale";
import { rateLimited } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: AuthError; done?: "confirm_email" | "saved" } | undefined;

function authError(action: string, error: { code?: string; status?: number; message: string }): AuthError {
  const { code } = error;
  if (code === "user_already_exists" || code === "email_exists") return "email_taken";
  if (code === "invalid_credentials") return "invalid_credentials";
  if (code === "email_not_confirmed") return "email_not_confirmed";
  if (code === "over_email_send_rate_limit") return "email_send_limit";
  if (code === "over_request_rate_limit") return "rate_limited";
  if (code === "weak_password") return "invalid_password";
  if (code === "email_address_invalid") return "invalid_email";
  // Supabase returns a 500 without a specific code when its mailer fails.
  if (/sending .*email/i.test(error.message)) return "email_send_failed";
  // The code and status only, never the email, so the Vercel logs show what to map next.
  console.error(`${action} failed`, code ?? "no code", error.status ?? "no status");
  return "unknown";
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  if (await rateLimited()) return { error: "rate_limited" };
  const parsed = SignUp.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { email, password, displayName, role } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role, display_name: displayName } },
  });
  if (error) return { error: authError("signUp", error) };
  // With email confirmation on, Supabase returns no session (and no error for an existing email, to avoid leaking it).
  if (!data.session) return { done: "confirm_email" };
  redirect(`/${localeOf(form)}/${role}`);
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  if (await rateLimited()) return { error: "rate_limited" };
  const parsed = SignIn.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authError("signIn", error) };

  // The same client holds the new session, so the role is read without waiting for cookies to round-trip.
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role, status").eq("id", data.user.id).single();
  if (profileError) {
    console.error("signIn profile read failed", profileError.code);
    return { error: "unknown" };
  }
  if (profile.status !== "active") {
    await supabase.auth.signOut();
    return { error: "suspended" };
  }
  redirect(`/${localeOf(form)}/${profile.role}`);
}

export async function signOut(form: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${localeOf(form)}`);
}

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || !user.active) return { error: "unknown" };
  if (await rateLimited(user.id)) return { error: "rate_limited" };
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
