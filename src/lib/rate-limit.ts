import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "./supabase/admin";

// Hits a minute per signed-in user, or per IP before sign-in (take_rate_limit() in 20261020000002_rate_limits.sql).
// Per IP is higher because a campus or office shares one address.
const PER_USER = 30;
const PER_IP = 20;

// Server actions call this first and return { error: "rate_limited" } when it's true.
// Vercel overwrites x-forwarded-for with the client's address, so it can't be spoofed there.
export async function rateLimited(userId?: string): Promise<boolean> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const { data, error } = await createAdminClient().rpc("take_rate_limit", {
    key: userId ? `user:${userId}` : `ip:${ip}`,
    max_hits: userId ? PER_USER : PER_IP,
    window_seconds: 60,
  });
  // Fails open: a database error shouldn't lock everyone out. /api/analyze, which spends model calls, fails closed.
  if (error) {
    console.error("take_rate_limit failed", error.code);
    return false;
  }
  return !data;
}
