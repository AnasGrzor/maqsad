// End-to-end checks for the pieces wired together after the parallel milestones were merged:
// plan gating on cases and messages, admin handling of disputes, audit entries, and suspended accounts.
import { check, ensureUser, finish, get, serviceClient, session, sql } from "./e2e-lib.mjs";

await ensureUser("int-student@iraada.test", "student", "Integration Student");
await ensureUser("int-agent@iraada.test", "agent", "Integration Agency");
await ensureUser("int-agent2@iraada.test", "agent", "Basic Agency");
await ensureUser("int-admin@iraada.test", "student", "Integration Admin");
sql("update public.profiles set role='admin' where id=(select id from auth.users where email='int-admin@iraada.test')");

const student = await session("int-student@iraada.test");
const agent = await session("int-agent@iraada.test");
const agent2 = await session("int-agent2@iraada.test");
const admin = await session("int-admin@iraada.test");

// Start from Agent Basic and a clean slate for these accounts.
const ids = [student.id, agent.id, agent2.id].map((id) => `'${id}'`).join(",");
sql(`update public.profiles set status = 'active' where id in (${ids})`);
sql(`delete from public.subscriptions where user_id in (${ids})`);
sql(`delete from public.subscription_requests where user_id in (${ids})`);
sql(`delete from public.connections where student_id in (${ids}) or agent_id in (${ids})`);
sql(`delete from public.student_profiles where user_id in (${ids})`);
sql(`delete from public.agent_profiles where user_id in (${ids})`);

const errorOf = async (p) => (await p).error?.message;
await student.sb.from("student_profiles").upsert({ user_id: student.id, education_level: "masters", field: "business", destinations: ["GB"], goal: "study", visible: true });
await agent.sb.from("agent_profiles").upsert({ user_id: agent.id, agency_name: "Integration Agency", kind: "education", destinations: ["GB"] });
const { data: conn } = await agent.sb.rpc("request_connection", { target: student.id });
await student.sb.rpc("respond_connection", { connection: conn, accept: true });

// 1. Plan gating: a feature is on when either party's plan includes it.
const { data: caseId, error: caseErr } = await student.sb.rpc("open_case", { connection: conn, title: "MSc in London", kind: "study", country: "GB" });
check("free student + Agent Basic can open a case (Student Free has case tracking)", !caseErr && !!caseId, caseErr?.message);
check("Agent Basic can add case items on that connection", !(await errorOf(agent.sb.rpc("add_case_item", { target_case: caseId, kind: "requirement", title: "IELTS certificate" }))));
check("messaging needs a plan that includes it", (await errorOf(student.sb.rpc("send_message", { connection: conn, body: "Hello" }))) === "plan_required");
check("the agent can't message either", (await errorOf(agent.sb.rpc("send_message", { connection: conn, body: "Hello" }))) === "plan_required");
check("fee records need a plan that includes them", (await errorOf(agent.sb.rpc("add_case_record", { target_case: caseId, kind: "fee_disclosed", summary: "Integration service fee", amount: 50000, currency: "PKR" }))) === "plan_required");
const thread = await get(`/en/student/messages/${conn}`, student.cookie);
check("the thread page still renders for the student", thread.status === 200 && !thread.redirect);

const { data: reqId, error: reqErr } = await agent.sb.rpc("request_plan", { plan: "agent_professional", note: "Please upgrade" });
check("agent requests Agent Professional", !reqErr && !!reqId, reqErr?.message);
check("admin approves the upgrade", !(await errorOf(admin.sb.rpc("decide_plan_request", { request: reqId, approve: true, note: "Approved" }))));
check("after the upgrade, the student can message", !(await errorOf(student.sb.rpc("send_message", { connection: conn, body: "Hello" }))));
check("after the upgrade, fee records work", !(await errorOf(agent.sb.rpc("add_case_record", { target_case: caseId, kind: "fee_disclosed", summary: "Integration service fee", amount: 50000, currency: "PKR" }))));

// Student Plus brings messaging to a connection with an Agent Basic agent.
await agent2.sb.from("agent_profiles").upsert({ user_id: agent2.id, agency_name: "Basic Agency", kind: "education", destinations: ["GB"] });
const { data: basicConn } = await agent2.sb.rpc("request_connection", { target: student.id });
await student.sb.rpc("respond_connection", { connection: basicConn, accept: true });
check("Agent Basic alone can't message", (await errorOf(agent2.sb.rpc("send_message", { connection: basicConn, body: "Hello" }))) === "plan_required");
sql(`insert into public.subscriptions (user_id, plan_id) values ('${student.id}', 'student_plus')`);
check("a Student Plus student can message an Agent Basic agent", !(await errorOf(student.sb.rpc("send_message", { connection: basicConn, body: "Hello" }))));
sql(`delete from public.subscriptions where user_id = '${student.id}'`);

// 2. Agent Basic gets a few checks a month.
const { data: basicAllowance } = await agent2.sb.rpc("allowance", { kind: "verification_report" });
check("Agent Basic includes 3 checks a month", basicAllowance?.plan === "agent_basic" && basicAllowance?.limit === 3, JSON.stringify(basicAllowance));

// 3. Disputes: only admins review them, and the person who raised it sees the outcome.
const { data: disputeId } = await student.sb.rpc("raise_dispute", { connection: conn, kind: "dispute", reason: "undisclosed_fees", details: "Asked for an extra fee", target_case: caseId });
check("student raises a dispute", !!disputeId);
check("the agent can't see the dispute", ((await agent.sb.from("disputes").select("id").eq("id", disputeId)).data ?? []).length === 0);
check("non-admins can't review disputes", (await errorOf(student.sb.rpc("review_dispute", { dispute: disputeId, new_status: "resolved" }))) === "forbidden");
check("disputes can't be reopened through review", (await errorOf(admin.sb.rpc("review_dispute", { dispute: disputeId, new_status: "open" }))) === "invalid_status");
check("admin resolves it with a note", !(await errorOf(admin.sb.rpc("review_dispute", { dispute: disputeId, new_status: "resolved", note: "The agent refunded the fee." }))));
const mine = (await student.sb.from("disputes").select("status, resolution_note").eq("id", disputeId).single()).data;
check("the student sees the status and note", mine?.status === "resolved" && mine?.resolution_note === "The agent refunded the fee.");
check("disputes can't be edited directly", !!(await errorOf(student.sb.from("disputes").update({ status: "open" }).eq("id", disputeId))));
const adminPage = await get("/en/admin/complaints", admin.cookie);
check("admin complaints page lists it", adminPage.body.includes("Asked for an extra fee") && adminPage.body.includes("Integration Student"));
const studentPage = await get("/en/student/disputes", student.cookie);
check("student disputes page shows Iraada's note", studentPage.body.includes("The agent refunded the fee."));
check("non-admins are kept out of the complaints page", (await get("/en/admin/complaints", student.cookie)).redirect.endsWith("/en/student"));

// 4. Audit entries for admin actions on plans and disputes.
const actions = ((await admin.sb.from("audit_log").select("action, target_id").in("target_id", [String(disputeId), String(reqId), agent.id])).data ?? []).map((a) => a.action);
check("dispute review is audited", actions.includes("dispute.review"));
check("plan request decision is audited", actions.includes("plan_request.decide"));
check("granting the plan is audited", actions.includes("subscription.grant"));
check("users can't read the audit log", ((await student.sb.from("audit_log").select("id")).data ?? []).length === 0);

// 5. Saved reports linked to applications stay private to their owner.
// Saved the way the server does it (secret key); users can't insert reports themselves.
check("students can't insert reports directly", !!(await errorOf(student.sb.from("verification_reports").insert({ owner_id: student.id, doc_type: "other", risk: "low" }))));
const { data: report, error: saveErr } = await serviceClient()
  .from("verification_reports")
  .insert({ owner_id: student.id, doc_type: "university_offer", issuer_name: "Integration University", risk: "medium", findings: [], warnings: [] })
  .select("id")
  .single();
check("student saves a report", !saveErr && !!report, saveErr?.message);
check("student links the report to their application", !(await errorOf(student.sb.rpc("link_report", { report: report.id, target_case: caseId }))));
check("users can't set case_id directly", !!(await errorOf(student.sb.from("verification_reports").update({ case_id: null }).eq("id", report.id))));
check("the agent can't link someone else's report", (await errorOf(agent.sb.rpc("link_report", { report: report.id, target_case: caseId }))) === "not_available");
check("the agent can't see the linked report", ((await agent.sb.from("verification_reports").select("id").eq("case_id", caseId)).data ?? []).length === 0);
const { data: otherCase } = await agent2.sb.from("cases").select("id").limit(1).maybeSingle();
const foreignCase = otherCase?.id ?? sql(`select id from public.cases where student_id <> '${student.id}' limit 1`);
if (foreignCase) check("a report can't be linked to someone else's application", (await errorOf(student.sb.rpc("link_report", { report: report.id, target_case: foreignCase }))) === "not_available");
const casePage = await get(`/en/student/applications/${caseId}`, student.cookie);
check("the case page shows the owner's linked report", casePage.body.includes("Integration University") && casePage.body.includes("Your linked verification reports"));
const agentCasePage = await get(`/en/agent/applications/${caseId}`, agent.cookie);
check("the agent's case page doesn't show it", agentCasePage.status === 200 && !agentCasePage.body.includes("Integration University"));
const adminReports = await get("/en/admin/reports?risk=medium", admin.cookie);
check("admin reports page lists saved reports", adminReports.body.includes("Integration University") && adminReports.body.includes("Integration Student"));
check("admin can open the report", (await get(`/en/admin/reports/${report.id}`, admin.cookie)).body.includes("Integration University"));
check("non-admins are kept out of admin reports", (await get("/en/admin/reports", student.cookie)).redirect.endsWith("/en/student"));

// 6. Suspended accounts lose access to cases, messages and notifications.
check("admin suspends the student", !(await errorOf(admin.sb.rpc("set_account_status", { target: student.id, new_status: "suspended", reason: "e2e check" }))));
for (const table of ["cases", "case_items", "messages", "notifications", "disputes", "usage_events", "subscriptions", "verification_reports"]) {
  const rows = (await student.sb.from(table).select("*").limit(5)).data ?? [];
  check(`a suspended user reads no ${table}`, rows.length === 0, `rows=${rows.length}`);
}
check("a suspended user can't message", (await errorOf(student.sb.rpc("send_message", { connection: conn, body: "still here?" }))) === "not_available");
check("admin reactivates the student", !(await errorOf(admin.sb.rpc("set_account_status", { target: student.id, new_status: "active", reason: "e2e done" }))));

finish();
