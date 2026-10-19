// End-to-end auth, role routing and RLS checks for accounts. Needs `supabase start` and the app running
// (APP_URL, default http://localhost:3000). Run with: pnpm test:e2e. Creates the accounts in supabase/seed.sql.
import { anonClient, check, ensureUser, finish, get, PASS, session, sql } from "./e2e-lib.mjs";

// 1. Admin can't be self-assigned at signup, even calling Supabase directly.
const evil = await anonClient().auth.signUp({ email: `evil${Date.now()}@iraada.test`, password: PASS, options: { data: { role: "admin" } } });
check("signup with role=admin is rejected by the trigger", !!evil.error, evil.error?.message);
const noRole = await anonClient().auth.signUp({ email: `norole${Date.now()}@iraada.test`, password: PASS });
check("signup without a role is rejected", !!noRole.error);

// 2. Test accounts. The admin registers as a student and is promoted by hand, as in production.
await ensureUser("student@iraada.test", "student", "Sara Khan");
await ensureUser("agent@iraada.test", "agent", "Test Agent");
await ensureUser("admin@iraada.test", "student", "Test Admin");
sql("update public.profiles set role='admin' where id=(select id from auth.users where email='admin@iraada.test')");

const student = await session("student@iraada.test");
const agent = await session("agent@iraada.test");
const admin = await session("admin@iraada.test");

// 3. Server-side role routing in the app.
const cases = [
  [student, "/en/student", 200], [student, "/en/agent", "/en/student"], [student, "/en/admin", "/en/student"],
  [agent, "/en/agent", 200], [agent, "/en/student", "/en/agent"], [agent, "/en/admin", "/en/agent"], [agent, "/ur/agent/settings", 200],
  [admin, "/en/admin", 200], [admin, "/en/student", "/en/admin"],
  [null, "/en/admin", "/en/login"], [null, "/ur/agent", "/ur/login"],
];
for (const [who, path, want] of cases) {
  const label = who === student ? "student" : who === agent ? "agent" : who === admin ? "admin" : "anonymous";
  const r = await get(path, who?.cookie);
  const ok = want === 200 ? r.status === 200 && !r.redirect : r.redirect.endsWith(want);
  check(`${label} GET ${path} -> ${want}`, ok, `status=${r.status} redirect=${r.redirect}`);
}
const adminPage = await get("/en/admin", admin.cookie);
check("admin page lists all users", ["Sara Khan", "Test Agent", "Test Admin"].every((n) => adminPage.body.includes(n)));

// 4. RLS: what each signed-in user can read and change directly in the database.
const seen = async (sb) => (await sb.from("profiles").select("display_name").neq("role", "agent")).data?.length ?? -1;
check("student sees only their own non-agent profile row", (await seen(student.sb)) === 1);
const total = Number(sql("select count(*) from public.profiles where role <> 'agent'"));
check("admin sees every profile row", (await seen(admin.sb)) === total, `total=${total}`);

const esc = await student.sb.from("profiles").update({ role: "admin" }).eq("id", student.id);
check("student cannot change their own role", !!esc.error && sql(`select role from public.profiles where id='${student.id}'`) === "student", esc.error?.message);
const sus = await student.sb.from("profiles").update({ status: "active" }).eq("id", student.id);
check("student cannot write their status column", !!sus.error);
await student.sb.from("profiles").update({ display_name: "Hacked" }).eq("id", agent.id);
check("student cannot rename another user", sql(`select display_name from public.profiles where id='${agent.id}'`) === "Test Agent");
const ins = await student.sb.from("profiles").insert({ id: crypto.randomUUID(), role: "admin", display_name: "x" });
check("student cannot insert profiles", !!ins.error);
const del = await admin.sb.from("profiles").delete().eq("id", agent.id);
check("even admin cannot delete profiles through the API", !!del.error || sql(`select count(*) from public.profiles where id='${agent.id}'`) === "1");
const anonRead = await anonClient().from("profiles").select("id");
check("anonymous users read no profiles", (anonRead.data?.length ?? 0) === 0, anonRead.error?.message);

// 5. Suspended accounts lose dashboard access.
sql(`update public.profiles set status='suspended' where id='${agent.id}'`);
const sr = await get("/en/agent", agent.cookie);
check("suspended agent is sent to login", sr.redirect.endsWith("/en/login"), `status=${sr.status} redirect=${sr.redirect}`);
sql(`update public.profiles set status='active' where id='${agent.id}'`);

finish();
