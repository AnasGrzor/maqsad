// End-to-end checks for plans, upgrade requests, monthly limits and the document checker gate.
// Uses the m5-* test accounts and resets their plan data first. Set E2E_MOCK=1 against `next dev` with
// MOCK_AI=1 to also run real (mock) checks through /api/analyze until the limit.
import { anonClient, APP, check, ensureUser, finish, get, serviceClient, session, sql } from "./e2e-lib.mjs";

await ensureUser("m5-student@maqsad.test", "student", "M5 Student");
await ensureUser("m5-agent@maqsad.test", "agent", "M5 Agent");
await ensureUser("m5-admin@maqsad.test", "student", "M5 Admin");
sql("update public.profiles set role='admin' where id=(select id from auth.users where email='m5-admin@maqsad.test')");
const student = await session("m5-student@maqsad.test");
const agent = await session("m5-agent@maqsad.test");
const admin = await session("m5-admin@maqsad.test");
const ids = [student.id, agent.id, admin.id].map((id) => `'${id}'`).join(",");
const resetData = () => {
  sql(`delete from public.usage_events where user_id in (${ids})`);
  sql(`delete from public.subscription_requests where user_id in (${ids})`);
  sql(`delete from public.subscriptions where user_id in (${ids})`);
};
// Seed values from the migrations (Agent Basic's 3 checks come from 20261019000005_integration.sql, prices from
// 20261019000008_plan_prices.sql),
// so a failed earlier run doesn't leak into this one.
// (One line: on Windows the shell would cut the command at a newline.)
const resetPlans = () =>
  sql(
    "update public.plans p set offered=v.o, price_monthly_pkr=v.price, verification_reports_per_month=v.r " +
      "from (values ('student_free',true,0,3),('student_plus',false,5000,20),('agent_basic',true,10000,3)," +
      "('agent_professional',true,25000,30),('agency',false,50000,null)) v(id,o,price,r) where p.id=v.id",
  );
resetData();
resetPlans();

const errorOf = async (p) => (await p).error?.message;
const rpc = (who, fn, args) => errorOf(who.sb.rpc(fn, args));

// 1. Plans: everyone reads, only admins change.
const anonPlans = await anonClient().from("plans").select("*").order("sort_order");
check("signed-out visitors read plans", anonPlans.data?.length === 5 && anonPlans.data[0].id === "student_free", anonPlans.error?.message);
check("signed-in users read plans", ((await student.sb.from("plans").select("id")).data ?? []).length === 5);
check("users can't update plans directly", !!(await errorOf(student.sb.from("plans").update({ price_monthly_pkr: 1 }).eq("id", "student_plus"))));
check("visitors can't update plans directly", !!(await errorOf(anonClient().from("plans").update({ price_monthly_pkr: 1 }).eq("id", "student_plus"))));
check("users can't insert plans", !!(await errorOf(student.sb.from("plans").insert({ id: "free_for_me", audience: "student", offered: true }))));
check("update_plan refuses non-admins", (await rpc(student, "update_plan", { plan: "student_plus", price: 1, reports: 999, is_offered: true })) === "forbidden");
check("update_plan refuses visitors", !!(await errorOf(anonClient().rpc("update_plan", { plan: "student_plus", price: 1, reports: 999, is_offered: true }))));
const planAudits = async () => (await admin.sb.from("audit_log").select("id", { count: "exact", head: true }).eq("action", "plan.update").eq("target_id", "student_plus")).count;
const auditsBefore = await planAudits();
check("admin edits a plan", !(await rpc(admin, "update_plan", { plan: "student_plus", price: null, reports: 20, is_offered: true })));
check("saving the same values again", !(await rpc(admin, "update_plan", { plan: "student_plus", price: null, reports: 20, is_offered: true })));
const auditsAfter = await planAudits();
check("only the real change is audited", auditsAfter - auditsBefore === 1, `added=${auditsAfter - auditsBefore}`);

// 2. Subscriptions and usage can't be written by users.
check("users can't grant themselves a plan", !!(await errorOf(student.sb.from("subscriptions").insert({ user_id: student.id, plan_id: "student_plus" }))));
check("users can't write usage directly", !!(await errorOf(student.sb.from("usage_events").insert({ user_id: student.id, kind: "verification_report" }))));
check("users can't insert approved requests", !!(await errorOf(student.sb.from("subscription_requests").insert({ user_id: student.id, plan_id: "student_plus", status: "approved" }))));
check("current plan defaults by role", (await student.sb.rpc("current_plan")).data === "student_free" && (await agent.sb.rpc("current_plan")).data === "agent_basic");
check("admins have no plan", (await admin.sb.rpc("current_plan")).data === null);
check("plan_allows follows the plan", (await student.sb.rpc("plan_allows", { feature: "documentCheck" })).data === true && (await student.sb.rpc("plan_allows", { feature: "savedReports" })).data === false);
check("visitors can't call plan functions", !!(await errorOf(anonClient().rpc("current_plan"))) && !!(await errorOf(anonClient().rpc("use_allowance", { kind: "verification_report" }))));
check("plan_of isn't callable by users", !!(await rpc(student, "plan_of", { who: agent.id })));

// 3. Upgrade requests.
check("a student can't request an agent plan", (await rpc(student, "request_plan", { plan: "agent_professional" })) === "not_available");
check("a plan that isn't offered can't be requested", (await rpc(student, "request_plan", { plan: "agency" })) === "not_available");
check("requesting the current plan is refused", (await rpc(student, "request_plan", { plan: "student_free" })) === "already_on_plan");
const { data: requestId, error: reqErr } = await student.sb.rpc("request_plan", { plan: "student_plus", note: "Need more checks" });
check("a student requests an offered student plan", !reqErr && !!requestId, reqErr?.message);
check("only one pending request", (await rpc(student, "request_plan", { plan: "student_plus" })) === "already_pending");
check("users can't change their request", !!(await errorOf(student.sb.from("subscription_requests").update({ status: "approved" }).eq("id", requestId))));
check("users can't approve their own request", (await rpc(student, "decide_plan_request", { request: requestId, approve: true })) === "forbidden");
check("others can't see the request", ((await agent.sb.from("subscription_requests").select("id")).data ?? []).length === 0);
check("an agent can't request a student plan", (await rpc(agent, "request_plan", { plan: "student_plus" })) === "not_available");

let page = await get("/en/student/settings", student.cookie);
check("settings shows the plan, usage and pending request", page.body.includes("Your plan") && page.body.includes("Student Free") && page.body.includes("0 of 3 verification reports used") && page.body.includes("Waiting for Maqsad"));
page = await get("/en/admin/plans", student.cookie);
check("students can't open the admin plans page", page.redirect === "/en/student", page.redirect);
page = await get("/en/admin/plans", admin.cookie);
check("admin page lists the pending request", page.body.includes("M5 Student (Student) asked for Student Plus") && page.body.includes("Need more checks"));

check("admin approves", !(await rpc(admin, "decide_plan_request", { request: requestId, approve: true, note: "Approved for testing" })));
check("approval changes the plan", (await student.sb.rpc("current_plan")).data === "student_plus" && (await student.sb.rpc("plan_allows", { feature: "savedReports" })).data === true);
const sub = (await student.sb.from("subscriptions").select("*").maybeSingle()).data;
check("the subscription records who granted it", sub?.plan_id === "student_plus" && sub?.granted_by === admin.id);
check("a decided request can't be decided again", (await rpc(admin, "decide_plan_request", { request: requestId, approve: false })) === "not_available");
page = await get("/en/student/settings", student.cookie);
check("settings shows the approved plan", page.body.includes("Student Plus") && page.body.includes("Approved for testing") && page.body.includes("Set by Maqsad on"));
const { data: declineId } = await agent.sb.rpc("request_plan", { plan: "agent_professional" });
check("admin declines a request", !!declineId && !(await rpc(admin, "decide_plan_request", { request: declineId, approve: false, note: "Not yet" })));
check("a declined request leaves the plan", (await agent.sb.rpc("current_plan")).data === "agent_basic");

// 4. Monthly limit: atomic, per user, not bypassable in parallel.
resetData(); // back on student_free (3 a month)
sql(`insert into public.usage_events (user_id, kind) select '${student.id}', 'verification_report' from generate_series(1, 2)`);
// Used one second before this month started (Karachi time): must not count.
sql(`insert into public.usage_events (user_id, kind, created_at) values ('${student.id}', 'verification_report', public.usage_month_start(now()) - interval '1 second')`);
const results = await Promise.all(Array.from({ length: 8 }, () => student.sb.rpc("use_allowance", { kind: "verification_report" })));
const ok = results.filter((r) => !r.error).length;
check("8 parallel calls at limit-1: exactly one succeeds", ok === 1, `succeeded=${ok}`);
check("the others are refused with limit_reached", results.filter((r) => r.error?.message === "limit_reached").length === 7);
check("usage stays at the limit, last month's use not counted", sql(`select count(*) from public.usage_events where user_id='${student.id}' and created_at >= public.usage_month_start(now())`) === "3");
check("at the limit, the next call is refused", (await rpc(student, "use_allowance", { kind: "verification_report" })) === "limit_reached");
const { data: allowance } = await student.sb.rpc("allowance", { kind: "verification_report" });
const nextMonth = sql("select to_char(date_trunc('month', now() at time zone 'Asia/Karachi') + interval '1 month', 'YYYY-MM-DD')");
check("allowance reports usage and the Karachi reset", allowance?.used === 3 && allowance?.limit === 3 && new Date(allowance.resets_at).toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }) === nextMonth && new Date(allowance.resets_at).toLocaleTimeString("en-GB", { timeZone: "Asia/Karachi" }) === "00:00:00", JSON.stringify(allowance));
// A plan without reports: Agent Basic is switched to "not included" until the /api/analyze check below, so that
// request is refused before any model call instead of running a real check.
sql("update public.plans set verification_reports_per_month = null where id = 'agent_basic'");
check("a null limit means not included", (await rpc(agent, "use_allowance", { kind: "verification_report" })) === "not_included");
check("admins can't use allowances", (await rpc(admin, "use_allowance", { kind: "verification_report" })) === "not_available");
check("users read only their own usage", ((await student.sb.from("usage_events").select("id")).data ?? []).length === 4 && ((await agent.sb.from("usage_events").select("id").eq("user_id", student.id)).data ?? []).length === 0);
check("months start at midnight in Asia/Karachi", (() => {
  const start = (ts) => sql(`set timezone='UTC'; select public.usage_month_start('${ts}')`).split("\n").pop();
  return start("2026-10-31 19:00:00+00") === "2026-10-31 19:00:00+00" && start("2026-10-31 18:59:59+00") === "2026-09-30 19:00:00+00" && start("2026-01-01 00:00:00+00") === "2025-12-31 19:00:00+00";
})());

// 4b. Rate limits on checks that reach the models: server key only, atomic, per user and app-wide.
const clearAiChecks = () => sql(`delete from public.ai_checks where user_id in (${ids})`);
clearAiChecks();
const service = serviceClient();
const take = (uid, limits) =>
  service.rpc("take_ai_check", { uid, per_minute: 99, per_hour: 99, app_per_minute: 9999, app_per_day: 99999, ...limits });
check("users can't call take_ai_check", !!(await rpc(student, "take_ai_check", { uid: student.id, per_minute: 99, per_hour: 99, app_per_minute: 9999, app_per_day: 99999 })));
const burst = await Promise.all(Array.from({ length: 6 }, () => take(student.id, { per_minute: 2 })));
check("6 parallel takes at 2 a minute: exactly two succeed", burst.filter((r) => !r.error).length === 2, JSON.stringify(burst.map((r) => r.error?.message ?? "ok")));
check("the others are refused with rate_limited", burst.filter((r) => r.error?.message === "rate_limited").length === 4);
check("another user has their own minute", !(await take(agent.id, { per_minute: 2 })).error);
sql(`update public.ai_checks set created_at = now() - interval '2 minutes' where user_id = '${student.id}'`);
check("the hourly cap counts older checks", (await take(student.id, { per_minute: 2, per_hour: 2 })).error?.message === "hourly_limit");
check("the app-wide minute cap", (await take(admin.id, { app_per_minute: 0 })).error?.message === "busy");
check("the app-wide daily cap", (await take(admin.id, { app_per_day: 0 })).error?.message === "daily_limit");
sql(`update public.ai_checks set created_at = now() - interval '25 hours' where user_id = '${student.id}'`);
await take(admin.id, {});
check("checks older than a day are deleted", sql(`select count(*) from public.ai_checks where user_id = '${student.id}'`) === "0");
clearAiChecks();

// 4c. Rate limits on every server action (src/lib/rate-limit.ts): server key only, atomic, per key.
const rlKey = `e2e:${Date.now()}`;
check("users can't call take_rate_limit", !!(await rpc(student, "take_rate_limit", { key: rlKey, max_hits: 99, window_seconds: 60 })));
const hits = await Promise.all(Array.from({ length: 6 }, () => service.rpc("take_rate_limit", { key: rlKey, max_hits: 2, window_seconds: 3600 })));
check("6 parallel hits at 2 a window: exactly two pass", hits.filter((r) => r.data === true).length === 2 && hits.every((r) => !r.error), JSON.stringify(hits.map((r) => r.error?.message ?? r.data)));
check("another key has its own window", (await service.rpc("take_rate_limit", { key: `${rlKey}:other`, max_hits: 2, window_seconds: 3600 })).data === true);
sql(`delete from public.rate_limits where key like '${rlKey}%'`);

// 5. The document checker: sign-in first, refused at the limit before any model call.
const analyze = async (cookie, text) => {
  const body = new FormData();
  if (text !== undefined) body.append("text", text);
  const r = await fetch(APP + "/api/analyze", { method: "POST", body, headers: cookie ? { cookie } : {} });
  return { status: r.status, body: await r.text() };
};
let res = await analyze(null, "Pay the visa fee to this JazzCash account.");
check("signed-out /api/analyze gets 401", res.status === 401 && JSON.parse(res.body).code === "sign_in_required", `${res.status}`);
res = await analyze(student.cookie, "Pay the visa fee to this JazzCash account.");
const limitBody = res.status === 429 ? JSON.parse(res.body) : {};
check("at the limit /api/analyze refuses with the limit and reset date", limitBody.code === "limit_reached" && limitBody.limit === 3 && !!limitBody.resetsAt, `${res.status}`);
res = await analyze(agent.cookie, "Pay the visa fee to this JazzCash account.");
check("a plan without reports is refused", res.status === 403 && JSON.parse(res.body).code === "not_included", `${res.status}`);
// Mock checks skip the rate limits, so this holds with and without E2E_MOCK.
check("checks the plan refuses don't count toward the rate limits", sql(`select count(*) from public.ai_checks where user_id in (${ids})`) === "0");
resetPlans();
sql(`delete from public.usage_events where user_id='${student.id}'`);
res = await analyze(student.cookie, "");
check("requests rejected by validation don't use a report", res.status === 400 && sql(`select count(*) from public.usage_events where user_id='${student.id}'`) === "0");
page = await get("/en/check");
check("signed-out /check explains and offers log in and register", page.body.includes("Log in to check a document") && page.body.includes('href="/en/register"'));
page = await get("/en/check", student.cookie);
check("signed-in /check shows checks left", page.body.includes("3 of 3 checks left this month"));

if (process.env.E2E_MOCK === "1") {
  for (let i = 1; i <= 3; i++) {
    res = await analyze(student.cookie, "low");
    check(`mock check ${i} of 3 runs`, res.status === 200 && res.body.includes('"type":"result"'), `${res.status}`);
  }
  res = await analyze(student.cookie, "low");
  check("mock check 4 is refused at the limit", res.status === 429 && JSON.parse(res.body).code === "limit_reached", `${res.status}`);
  page = await get("/en/check", student.cookie);
  check("/check says no checks are left", page.body.includes("You have used all 3 checks for this month"));
}

// 6. Pricing reads the database and updates after an admin edit (through the admin page's server action).
const submitPlanForm = async (planName, fields) => {
  const html = (await get("/en/admin/plans", admin.cookie)).body;
  const form = html.match(new RegExp(`<form[^>]*aria-label="${planName}"[^>]*>([\\s\\S]*?)</form>`))?.[1] ?? "";
  const body = new FormData();
  for (const [, name, value] of form.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?/g)) {
    body.append(name, (value ?? "").replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
  }
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  const r = await fetch(APP + "/en/admin/plans", { method: "POST", body, headers: { cookie: admin.cookie, origin: APP }, redirect: "manual" });
  return r.status;
};
page = await get("/en/pricing");
check("pricing shows plans from the database", page.body.includes("Student Plus") && page.body.includes("20 verification reports a month") && !page.body.includes("PKR 1,234"));
check("pricing says paying never verifies", page.body.includes("never makes an account verified"));
const status = await submitPlanForm("Student Plus", { price: "1234", reports: "25", offered: "on" });
check("admin saves a plan through the page", sql("select price_monthly_pkr || '/' || verification_reports_per_month from public.plans where id='student_plus'") === "1234/25", `status=${status}`);
page = await get("/en/pricing");
check("pricing updates after the admin edit", page.body.includes("PKR 1,234 a month") && page.body.includes("25 verification reports a month"));
await submitPlanForm("Student Plus", { price: "", reports: "20" });
page = await get("/en/pricing");
check("clearing the price shows 'Price not set yet' again", !page.body.includes("PKR 1,234") && page.body.includes("20 verification reports a month") && sql("select offered from public.plans where id='student_plus'") === "f");

resetData();
resetPlans();
finish();
