// End-to-end auth, role routing and RLS checks. Needs `supabase start` and `pnpm dev` on :3000.
// Run with: pnpm test:e2e. Creates the local test accounts listed in supabase/seed.sql.
import { execSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const APP = "http://localhost:3000";
const PASS = "maqsad-local-pass";
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`);
  if (!ok) failures++;
};
const sql = (q) => execSync(`docker exec supabase_db_bluegill psql -U postgres -tAc "${q}"`).toString().trim();

// Signs in through @supabase/ssr so we get exactly the cookies the app reads.
async function session(email, password = PASS) {
  const jar = new Map();
  const sb = createServerClient(URL, KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach((c) => jar.set(c.name, c.value)) },
  });
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { sb, cookie: [...jar].map(([n, v]) => `${n}=${v}`).join("; ") };
}
const get = async (path, cookie) => {
  const r = await fetch(APP + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  return { status: r.status, location: r.headers.get("location") ?? "", body: r.status === 200 ? await r.text() : "" };
};

const anon = createClient(URL, KEY, { auth: { persistSession: false } });

// 1. Admin can't be self-assigned at signup, even calling Supabase directly.
const evil = await anon.auth.signUp({ email: `evil${Date.now()}@maqsad.test`, password: PASS, options: { data: { role: "admin" } } });
check("signup with role=admin is rejected by the trigger", !!evil.error, evil.error?.message);
const noRole = await anon.auth.signUp({ email: `norole${Date.now()}@maqsad.test`, password: PASS });
check("signup without a role is rejected", !!noRole.error);

// 2. Create agent and admin the same way the signUp action does.
for (const [email, role, name] of [["agent@maqsad.test", "agent", "Test Agent"], ["admin@maqsad.test", "student", "Test Admin"]]) {
  if (!sql(`select 1 from auth.users where email='${email}'`)) {
    const { error } = await anon.auth.signUp({ email, password: PASS, options: { data: { role, display_name: name } } });
    check(`create ${email}`, !error, error?.message);
  }
}
sql("update public.profiles set role='admin' where id=(select id from auth.users where email='admin@maqsad.test')");

const student = await session("student@maqsad.test");
const agent = await session("agent@maqsad.test");
const admin = await session("admin@maqsad.test");

// 3. Server-side role routing in the app.
const cases = [
  [student, "/en/student", 200], [student, "/en/agent", "/en/student"], [student, "/en/admin", "/en/student"],
  [agent, "/en/agent", 200], [agent, "/en/student", "/en/agent"], [agent, "/en/admin", "/en/agent"], [agent, "/ur/agent/settings", 200],
  [admin, "/en/admin", 200], [admin, "/en/student", "/en/admin"],
  [null, "/en/admin", "/en/login"], [null, "/ur/agent", "/ur/login"],
];
for (const [who, path, want] of cases) {
  const label = who === student ? "student" : who === agent ? "agent" : who === admin ? "admin" : "anonymous";
  let r = await get(path, who?.cookie);
  // Role redirects happen while streaming, so a 200 can carry a client-side redirect instead of a 307.
  const redirected = r.location || (r.body.match(/NEXT_REDIRECT;(?:replace|push);([^;]+);/)?.[1] ?? "");
  const ok = want === 200 ? r.status === 200 && !redirected : redirected.endsWith(want);
  check(`${label} GET ${path} -> ${want}`, ok, `status=${r.status} redirect=${redirected}`);
}
const adminPage = await get("/en/admin", admin.cookie);
check("admin page lists all users", ["Sara Khan", "Test Agent", "Test Admin"].every((n) => adminPage.body.includes(n)));

// 4. RLS: what each signed-in user can read and change directly in the database.
const seen = async (sb) => (await sb.from("profiles").select("display_name")).data?.length ?? -1;
check("student sees only their own profile row", (await seen(student.sb)) === 1);
check("agent sees only their own profile row", (await seen(agent.sb)) === 1);
const total = Number(sql("select count(*) from public.profiles"));
check("admin sees every profile row", (await seen(admin.sb)) === total, `total=${total}`);

const sid = sql("select id from auth.users where email='student@maqsad.test'");
const aid = sql("select id from auth.users where email='agent@maqsad.test'");
const esc = await student.sb.from("profiles").update({ role: "admin" }).eq("id", sid);
check("student cannot change their own role", !!esc.error && sql(`select role from public.profiles where id='${sid}'`) === "student", esc.error?.message);
const sus = await student.sb.from("profiles").update({ status: "active" }).eq("id", sid);
check("student cannot write their status column", !!sus.error);
await student.sb.from("profiles").update({ display_name: "Hacked" }).eq("id", aid);
check("student cannot rename another user", sql(`select display_name from public.profiles where id='${aid}'`) === "Test Agent");
const ins = await student.sb.from("profiles").insert({ id: crypto.randomUUID(), role: "admin", display_name: "x" });
check("student cannot insert profiles", !!ins.error);
const del = await admin.sb.from("profiles").delete().eq("id", aid);
check("even admin cannot delete profiles through the API", !!del.error || sql(`select count(*) from public.profiles where id='${aid}'`) === "1");
// signUp() signs the anon client in, so use a fresh client with no session.
const anonRead = await createClient(URL, KEY, { auth: { persistSession: false } }).from("profiles").select("id");
check("anonymous users read no profiles", (anonRead.data?.length ?? 0) === 0, anonRead.error?.message);

// 5. Suspended accounts lose dashboard access.
sql(`update public.profiles set status='suspended' where id='${aid}'`);
const sr = await get("/en/agent", agent.cookie);
const srTo = sr.location || (sr.body.match(/NEXT_REDIRECT;(?:replace|push);([^;]+);/)?.[1] ?? "");
check("suspended agent is sent to login", srTo.endsWith("/en/login"), `status=${sr.status} redirect=${srTo}`);
sql(`update public.profiles set status='active' where id='${aid}'`);

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
