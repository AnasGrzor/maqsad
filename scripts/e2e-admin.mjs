// End-to-end checks for milestone 6: audit log, account suspension, admin user pages, security headers,
// and regression tests for the access problems fixed in 20261019000004_admin_audit.sql.
// Uses its own m6-* accounts and resets their data first. Run with the app on APP_URL (production build for HSTS).
import { anonClient, APP, check, ensureUser, finish, get, KEY, session, sql, URL } from "./e2e-lib.mjs";

await ensureUser("m6-student@iraada.test", "student", "Mehwish Student");
await ensureUser("m6-agent@iraada.test", "agent", "Kamran Agent");
await ensureUser("m6-admin@iraada.test", "student", "Ayesha Admin");
await ensureUser("m6-admin2@iraada.test", "student", "Bilal Admin");
const emails = ["m6-student", "m6-agent", "m6-admin", "m6-admin2"].map((e) => `'${e}@iraada.test'`).join(",");
const ids = `(select id from auth.users where email in (${emails}))`;
sql(`update public.profiles set status='active' where id in ${ids} and status <> 'active'`);
sql(`update public.profiles set role='admin' where id in (select id from auth.users where email in ('m6-admin@iraada.test','m6-admin2@iraada.test')) and role <> 'admin'`);
sql(`delete from public.connections where student_id in ${ids} or agent_id in ${ids}`);
sql(`delete from public.credentials where agent_id in ${ids}`);
sql(`delete from public.student_profiles where user_id in ${ids}`);
sql(`delete from public.agent_profiles where user_id in ${ids}`);

const student = await session("m6-student@iraada.test");
let agent = await session("m6-agent@iraada.test");
const admin = await session("m6-admin@iraada.test");
const admin2 = await session("m6-admin2@iraada.test");
const errorOf = async (p) => (await p).error?.message;
const rows = async (p) => (await p).data?.length ?? 0;
const lastAudit = (action, target) =>
  sql(`select coalesce(actor_id::text,'null') || '|' || details::text from public.audit_log where action='${action}' and target_id='${target}' order by id desc limit 1`);

// Data the suspension checks need: profiles, a pending connection, a credential with a file.
await student.sb.from("student_profiles").upsert({ user_id: student.id, education_level: "masters", field: "computing", destinations: ["GB"], goal: "study", visible: true });
await agent.sb.from("agent_profiles").upsert({ user_id: agent.id, agency_name: "M6 Horizon Consultants", kind: "education", destinations: ["GB"] });
const { data: pending } = await agent.sb.rpc("request_connection", { target: student.id, note: "Hello" });
const file = `${agent.id}/m6-${Date.now()}.pdf`;
await agent.sb.storage.from("credentials").upload(file, new Blob(["%PDF-1.4 m6"], { type: "application/pdf" }));
const { data: cred } = await agent.sb.from("credentials").insert({ agent_id: agent.id, kind: "oep_licence", issuer: "BEOE", reference: "M6-OEP-77", document_path: file }).select().single();
check("setup: agent has a pending request and a credential with a file", !!pending && !!cred);

// 1. Audit log: only active admins read it; nobody writes it through the API.
check("students can't read the audit log", (await rows(student.sb.from("audit_log").select("id"))) === 0);
check("agents can't read the audit log", (await rows(agent.sb.from("audit_log").select("id"))) === 0);
check("signed-out users can't read the audit log", (await rows(anonClient().from("audit_log").select("id"))) === 0);
check("admins read the audit log", (await rows(admin.sb.from("audit_log").select("id").limit(5))) > 0);
const forged = { action: "account.suspend", target_type: "profile", target_id: student.id };
check("students can't insert audit rows", !!(await errorOf(student.sb.from("audit_log").insert(forged))));
check("admins can't insert audit rows either", !!(await errorOf(admin.sb.from("audit_log").insert(forged))));
const before = sql("select count(*) from public.audit_log");
await admin.sb.from("audit_log").delete().gte("id", 0);
await admin.sb.from("audit_log").update({ action: "x.y" }).gte("id", 0);
check("admins can't delete or edit audit rows", sql("select count(*) from public.audit_log") === before && sql("select count(*) from public.audit_log where action='x.y'") === "0");
for (const who of [["student", student], ["admin", admin]]) {
  const e = await errorOf(who[1].sb.rpc("write_audit", { action: "account.suspend", target_type: "profile", target_id: student.id }));
  check(`${who[0]} can't call write_audit() through the API`, !!e, e);
}
let sqlBlocked = false;
try { sql("update public.audit_log set action='x.y' where id=(select max(id) from public.audit_log)"); } catch { sqlBlocked = true; }
check("the audit log is append-only even in SQL", sqlBlocked);
sql(`update public.profiles set role='student' where id='${admin2.id}'`);
sql(`update public.profiles set role='admin' where id='${admin2.id}'`);
const roleLog = lastAudit("account.role_change", admin2.id);
check("role changes made in SQL are logged with no actor", roleLog.startsWith("null|") && roleLog.includes('"to": "admin"'), roleLog);

check("admin verifies the credential", !(await errorOf(admin.sb.rpc("review_credential", { credential: cred.id, verdict: "verified", note: "private note" }))));
const credLog = lastAudit("credential.review", cred.id);
check("credential decisions are logged with the admin as actor, without the note", credLog.startsWith(`${admin.id}|`) && credLog.includes('"to": "verified"') && !credLog.includes("private note"), credLog);

// 2. Account management rules.
const suspend = (sb, target, reason, status = "suspended") => errorOf(sb.rpc("set_account_status", { target, new_status: status, reason }));
check("students can't suspend anyone", (await suspend(student.sb, agent.id, "spam reports")) === "forbidden");
check("agents can't suspend anyone", (await suspend(agent.sb, student.id, "spam reports")) === "forbidden");
check("a reason is required", (await suspend(admin.sb, agent.id, "  ")) === "reason_required");
check("admins can't suspend themselves", (await suspend(admin.sb, admin.id, "testing")) === "cannot_change_self");
check("admins can't suspend another admin", (await suspend(admin.sb, admin2.id, "testing")) === "cannot_suspend_admin");
check("unknown accounts are refused", (await suspend(admin.sb, crypto.randomUUID(), "testing")) === "not_available");
check("students can't read emails", (await errorOf(student.sb.rpc("admin_user_email", { target: agent.id }))) === "forbidden");
check("admins read a user's email", (await admin.sb.rpc("admin_user_email", { target: agent.id })).data === "m6-agent@iraada.test");
check("emails aren't readable from auth.users through the API", !!(await errorOf(admin.sb.schema("auth").from("users").select("email"))));

const mark = sql("select coalesce(max(id), 0) from public.audit_log");
check("admin suspends the agent with a reason", !(await suspend(admin.sb, agent.id, "Several fee complaints")));
check("suspending twice is refused", (await suspend(admin.sb, agent.id, "again")) === "no_change");
const suspendLog = lastAudit("account.suspend", agent.id);
check("suspension is logged once, with actor and reason", suspendLog.startsWith(`${admin.id}|`) && suspendLog.includes("Several fee complaints") &&
  sql(`select count(*) from public.audit_log where id > ${mark} and target_id='${agent.id}'`) === "1", suspendLog);

// The suspended agent's access token is still valid, but the database refuses it.
const own = await agent.sb.from("profiles").select("status").eq("id", agent.id).maybeSingle();
check("a suspended user still reads their own status (the app shows 'suspended')", own.data?.status === "suspended");
check("a suspended user can't read their agent profile", (await rows(agent.sb.from("agent_profiles").select("user_id"))) === 0);
check("a suspended user can't read credentials", (await rows(agent.sb.from("credentials").select("id"))) === 0);
check("a suspended user can't read their connections", (await rows(agent.sb.from("connections").select("id"))) === 0);
check("a suspended user can't read student profiles", (await rows(agent.sb.from("student_profiles").select("user_id"))) === 0);
check("a suspended user can't read other users' names", (await rows(agent.sb.from("profiles").select("id").neq("id", agent.id))) === 0);
check("a suspended user can't download their credential files", !!(await errorOf(agent.sb.storage.from("credentials").download(file))));
check("a suspended user can't withdraw requests", (await errorOf(agent.sb.rpc("withdraw_connection", { connection: pending }))) === "not_available");
check("a suspended user can't send requests", (await errorOf(agent.sb.rpc("request_connection", { target: student.id }))) === "not_available");
await agent.sb.from("profiles").update({ display_name: "Renamed" }).eq("id", agent.id);
check("a suspended user can't rename themselves", sql(`select display_name from public.profiles where id='${agent.id}'`) === "Kamran Agent");
check("suspension ends the refresh token", !!(await agent.sb.auth.refreshSession()).error);
const suspendedPage = await get("/en/agent", agent.cookie);
check("a suspended user's old session is sent to login", suspendedPage.redirect.endsWith("/en/login"), `status=${suspendedPage.status} redirect=${suspendedPage.redirect}`);

check("students no longer see the suspended agent's profile", (await rows(student.sb.from("agent_profiles").select("user_id").eq("user_id", agent.id))) === 0);
check("students no longer see the suspended agent's credentials", (await rows(student.sb.from("credentials").select("id").eq("agent_id", agent.id))) === 0);
check("the directory page drops the suspended agent", !(await get("/en/student/agents", student.cookie)).body.includes("M6 Horizon Consultants"));
check("admins still see a suspended agent's profile", (await rows(admin.sb.from("agent_profiles").select("user_id").eq("user_id", agent.id))) === 1);

// 3. Admin pages over HTTP.
const users = await get("/en/admin?q=Kamran", admin.cookie);
check("users search finds by name", users.status === 200 && users.body.includes("Kamran Agent") && !users.body.includes("Mehwish Student"));
const suspendedList = await get("/en/admin?status=suspended&role=agent", admin.cookie);
check("users filter by role and status", suspendedList.body.includes("Kamran Agent") && !suspendedList.body.includes("Ayesha Admin"));
const wild = await get("/en/admin?q=%25", admin.cookie);
check("search treats % literally", wild.status === 200 && !wild.body.includes("Kamran Agent"));
const detail = await get(`/en/admin/users/${agent.id}`, admin.cookie);
check("user page shows email, credentials, connections and the reactivate form",
  detail.status === 200 && ["m6-agent@iraada.test", "M6 Horizon Consultants", "M6-OEP-77", "Request pending", "Reactivate"].every((s) => detail.body.includes(s)));
check("user page in Urdu loads", (await get(`/ur/admin/users/${student.id}`, admin.cookie)).status === 200);
check("an invalid user id shows not found", (await get("/en/admin/users/not-a-uuid", admin.cookie)).body.includes("No account with this id"));
const studentTries = await get(`/en/admin/users/${agent.id}`, student.cookie);
check("students are sent away from admin user pages", studentTries.redirect.endsWith("/en/student") && !studentTries.body.includes("m6-agent@iraada.test"));
const audit = await get("/en/admin/audit", admin.cookie);
check("activity history lists the suspension with actor name and reason", audit.status === 200 && audit.body.includes("Account suspended") && audit.body.includes("Ayesha Admin") && audit.body.includes("Several fee complaints"));
const filtered = await get("/en/admin/audit?action=credential.review", admin.cookie);
check("activity history filters by action", filtered.body.includes("Credential reviewed") && !filtered.body.includes("Several fee complaints"));
check("activity history in Urdu loads", (await get("/ur/admin/audit", admin.cookie)).status === 200);
check("agents are sent away from activity history", (await get("/en/admin/audit", agent.cookie)).redirect !== "");

// Reactivation.
check("admin reactivates the agent", !(await suspend(admin.sb, agent.id, "Complaints resolved", "active")));
check("reactivation is logged with the reason", lastAudit("account.reactivate", agent.id).includes("Complaints resolved"));
agent = await session("m6-agent@iraada.test");
check("a reactivated agent signs in and reads data again", (await rows(agent.sb.from("agent_profiles").select("user_id").eq("user_id", agent.id))) === 1);

// 4. Security headers.
for (const path of ["/en", "/en/admin", "/api/analyze"]) {
  const h = (await fetch(APP + path, { redirect: "manual" })).headers;
  const csp = h.get("content-security-policy") ?? "";
  check(`security headers on ${path}`,
    h.get("x-content-type-options") === "nosniff" && h.get("referrer-policy") === "strict-origin-when-cross-origin" &&
    h.get("x-frame-options") === "DENY" && csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'") &&
    (h.get("permissions-policy") ?? "").includes("camera=()") && !h.get("x-powered-by"), csp);
}
const hsts = (await fetch(APP + "/en")).headers.get("strict-transport-security");
check("HSTS is sent by the production server", !!hsts?.includes("max-age="), String(hsts));

// 5. Regression tests for the access problems fixed in M1/M2.
check("agents can't point a credential at another user's file",
  !!(await errorOf(agent.sb.from("credentials").insert({ agent_id: agent.id, kind: "other", issuer: "x", document_path: `${student.id}/x.pdf` }))));
check("credential paths can't climb out of the agent's folder",
  !!(await errorOf(agent.sb.from("credentials").insert({ agent_id: agent.id, kind: "other", issuer: "x", document_path: `${agent.id}/../${student.id}/x.pdf` }))));
const anonProfiles = await fetch(`${URL}/rest/v1/profiles?select=id`, { headers: { apikey: KEY } });
check("signed-out users have no access to profiles at all", anonProfiles.status === 401 || anonProfiles.status === 403, `status=${anonProfiles.status}`);
check("TRUNCATE privilege on profiles is gone", sql("select has_table_privilege('authenticated','public.profiles','TRUNCATE') or has_table_privilege('anon','public.profiles','TRUNCATE')") === "f");
check("is_active_user() is not callable when signed out", !!(await errorOf(anonClient().rpc("is_active_user", { uid: agent.id }))));

sql(`update public.profiles set status='suspended' where id='${student.id}'`);
check("agents no longer see a suspended student in discovery", (await rows(agent.sb.from("student_profiles").select("user_id").eq("user_id", student.id))) === 0);
sql(`update public.profiles set status='active' where id='${student.id}'`);
check("agents see the student again after reactivation", (await rows(agent.sb.from("student_profiles").select("user_id").eq("user_id", student.id))) === 1);

finish();
