import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { locale } from "next/root-params";
import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Database } from "./supabase/database.types";

export type Role = Database["public"]["Enums"]["user_role"];

export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  displayName: string;
  active: boolean;
};

// The role comes from the profiles table (RLS: own row only), never from user_metadata, which users can edit.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Supabase compares token expiry with Date.now(), which Cache Components only allows at request time.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, status")
    .eq("id", user.id)
    .single();
  if (!profile) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    role: profile.role,
    displayName: profile.display_name,
    active: profile.status === "active",
  };
});

// For Server Components only (root params are unavailable in Server Actions; use getCurrentUser there).
export async function requireRole(role: Role): Promise<CurrentUser> {
  const lang = await locale();
  const user = await getCurrentUser();
  if (!user || !user.active) redirect(`/${lang}/login`);
  if (user.role !== role) redirect(`/${lang}/${user.role}`);
  return user;
}
