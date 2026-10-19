import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Bypasses Row Level Security. Use it only for writes the server must vouch for (saved verification reports),
// after checking the signed-in user yourself, and for the public agent trust card (src/lib/trust-card.ts).
// The key must never reach the browser: no NEXT_PUBLIC_ prefix.
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}
