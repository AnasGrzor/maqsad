// Shared helpers for the end-to-end scripts. Local Supabase and a running app only.
import { execSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const APP = process.env.APP_URL ?? "http://localhost:3000";
export const PASS = "iraada-local-pass";

let failures = 0;
export function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`);
  if (!ok) failures++;
}
export function finish() {
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
}

export const sql = (q) => execSync(`docker exec supabase_db_bluegill psql -U postgres -tAc "${q}"`).toString().trim();

// The server key bypasses RLS, like the app's src/lib/supabase/admin.ts. Use it only to set up test data the app
// itself writes with that key (saved reports).
export const serviceClient = () => createClient(URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// A client with no session. signUp() signs a client in, so make a fresh one per use.
export const anonClient = () => createClient(URL, KEY, { auth: { persistSession: false } });

// Creates a test account the same way the signUp action does, if it doesn't exist yet.
export async function ensureUser(email, role, displayName) {
  if (sql(`select 1 from auth.users where email='${email}'`)) return;
  const { error } = await anonClient().auth.signUp({ email, password: PASS, options: { data: { role, display_name: displayName } } });
  if (error) throw new Error(`${email}: ${error.message}`);
}

export const userId = (email) => sql(`select id from auth.users where email='${email}'`);

// Signs in through @supabase/ssr so we get exactly the cookies the app reads.
export async function session(email) {
  const jar = new Map();
  const sb = createServerClient(URL, KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach((c) => jar.set(c.name, c.value)) },
  });
  const { error } = await sb.auth.signInWithPassword({ email, password: PASS });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { sb, id: userId(email), cookie: [...jar].map(([n, v]) => `${n}=${v}`).join("; ") };
}

export async function get(path, cookie) {
  const r = await fetch(APP + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  const body = r.status === 200 ? await r.text() : "";
  // Role redirects happen while streaming, so a 200 can carry a client-side redirect instead of a 307.
  const redirect = r.headers.get("location") || (body.match(/NEXT_REDIRECT;(?:replace|push);([^;]+);/)?.[1] ?? "");
  return { status: r.status, redirect, body };
}
