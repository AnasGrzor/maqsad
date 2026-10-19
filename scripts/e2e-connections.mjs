// End-to-end checks for profiles, discovery privacy, connections, credentials and credential files.
// Run after e2e-auth.mjs (pnpm test:e2e runs both). Resets the M2 data of the test accounts first.
import { check, ensureUser, finish, get, session, sql } from "./e2e-lib.mjs";

await ensureUser("student2@iraada.test", "student", "Hidden Student");
const student = await session("student@iraada.test");
const student2 = await session("student2@iraada.test");
const agent = await session("agent@iraada.test");
const admin = await session("admin@iraada.test");
const ids = [student.id, student2.id, agent.id].map((id) => `'${id}'`).join(",");
sql(`delete from public.connections where student_id in (${ids}) or agent_id in (${ids})`);
sql(`delete from public.credentials where agent_id in (${ids})`);
sql(`delete from public.student_profiles where user_id in (${ids})`);
sql(`delete from public.agent_profiles where user_id in (${ids})`);

const errorOf = async (p) => (await p).error?.message;
const studentProfile = { education_level: "bachelors", field: "computing", destinations: ["CA", "GB"], goal: "study", visible: false };

// 1. Profiles and role checks.
check("student saves a hidden profile", !(await errorOf(student.sb.from("student_profiles").upsert({ user_id: student.id, ...studentProfile }))));
check("agent cannot create a student profile", !!(await errorOf(agent.sb.from("student_profiles").upsert({ user_id: agent.id, ...studentProfile }))));
check("student cannot create an agent profile", !!(await errorOf(student.sb.from("agent_profiles").upsert({ user_id: student.id, agency_name: "x", kind: "education" }))));
check("profile codes are bounded in the database", !!(await errorOf(student.sb.from("student_profiles").upsert({ user_id: student.id, ...studentProfile, destinations: ["<script>"] }))));
check("agent without a profile can't send requests", (await errorOf(agent.sb.rpc("request_connection", { target: student.id }))) === "profile_required");

const agentProfile = { agency_name: "Northstar Education", kind: "education", destinations: ["CA"], specialisations: ["computing"], levels: ["bachelors"], fees: "PKR 50,000 after the offer letter" };
check("agent saves a profile", !(await errorOf(agent.sb.from("agent_profiles").upsert({ user_id: agent.id, ...agentProfile }))));
check("agent website must be http(s)", !!(await errorOf(agent.sb.from("agent_profiles").update({ website: "javascript:alert(1)" }).eq("user_id", agent.id))));

// 2. Discovery privacy.
const visibleTo = async (sb, id) => ((await sb.from("student_profiles").select("user_id").eq("user_id", id)).data ?? []).length;
check("agent can't see a hidden student", (await visibleTo(agent.sb, student.id)) === 0);
check("agent can't request a hidden student", (await errorOf(agent.sb.rpc("request_connection", { target: student.id }))) === "not_available");
await student.sb.from("student_profiles").update({ visible: true }).eq("user_id", student.id);
check("agent sees the student once visible", (await visibleTo(agent.sb, student.id)) === 1);
check("other students can't read a visible student", (await visibleTo(student2.sb, student.id)) === 0);
const nameFor = async (sb, id) => (await sb.from("profiles").select("display_name").eq("id", id).maybeSingle()).data?.display_name;
check("a visible student's name stays hidden from agents", (await nameFor(agent.sb, student.id)) === undefined);
check("students can read agent names", (await nameFor(student.sb, agent.id)) === "Test Agent");

const discovery = await get("/en/agent/students", agent.cookie);
check("discovery page lists the student anonymously", discovery.body.includes("Student · Computing and IT") && !discovery.body.includes("Sara Khan"));
const matches = await get("/en/agent/matches", agent.cookie);
check("matching page explains the suggestion", matches.body.includes("Both list Canada") && matches.body.includes("Field match: Computing and IT"));
const directory = await get("/en/student/agents", student.cookie);
check("student directory lists the agent with fees", directory.body.includes("Northstar Education") && directory.body.includes("PKR 50,000"));

// 3. Connection workflow.
const { data: requestId, error: reqErr } = await agent.sb.rpc("request_connection", { target: student.id, note: "We place computing students in Canada." });
check("agent requests a visible student", !reqErr && !!requestId, reqErr?.message);
check("duplicate requests are refused", (await errorOf(agent.sb.rpc("request_connection", { target: student.id }))) === "already_connected");
check("the requester can't accept their own request", (await errorOf(agent.sb.rpc("respond_connection", { connection: requestId, accept: true }))) === "not_available");
check("only the requester can withdraw", (await errorOf(student.sb.rpc("withdraw_connection", { connection: requestId }))) === "not_available");
check("outsiders can't see the request", ((await student2.sb.from("connections").select("id")).data ?? []).length === 0);
check("connections can't be written directly", !!(await errorOf(student.sb.from("connections").update({ status: "accepted" }).eq("id", requestId))));
check("student accepts", !(await errorOf(student.sb.rpc("respond_connection", { connection: requestId, accept: true }))));
check("after accepting, the agent sees the student's name", (await nameFor(agent.sb, student.id)) === "Sara Khan");
await student.sb.from("student_profiles").update({ visible: false }).eq("user_id", student.id);
check("a connected agent keeps access after the student hides", (await visibleTo(agent.sb, student.id)) === 1);

// A hidden student who asks first shares their profile and name with that agent only.
await student2.sb.from("student_profiles").upsert({ user_id: student2.id, ...studentProfile, visible: false });
const { data: req2 } = await student2.sb.rpc("request_connection", { target: agent.id, note: "Hello" });
check("a hidden student can request an agent", !!req2);
check("the agent sees a student who asked first", (await visibleTo(agent.sb, student2.id)) === 1 && (await nameFor(agent.sb, student2.id)) === "Hidden Student");
check("agent declines", !(await errorOf(agent.sb.rpc("respond_connection", { connection: req2, accept: false }))));
check("after declining, the hidden student is private again", (await visibleTo(agent.sb, student2.id)) === 0);
const connPage = await get("/en/agent/connections", agent.cookie);
check("agent connections page shows the accepted student by name", connPage.body.includes("Sara Khan"));

// 4. Credentials: agents submit, only admins decide.
check("agent can't submit a pre-verified credential", !!(await errorOf(agent.sb.from("credentials").insert({ agent_id: agent.id, kind: "oep_licence", issuer: "BEOE", status: "verified" }))));
const { data: cred, error: credErr } = await agent.sb.from("credentials").insert({ agent_id: agent.id, kind: "oep_licence", issuer: "BEOE", reference: "OEP-1234" }).select().single();
check("agent submits a credential as 'submitted'", !credErr && cred?.status === "submitted", credErr?.message);
check("agent can't change a credential's status", !!(await errorOf(agent.sb.from("credentials").update({ status: "verified" }).eq("id", cred.id))));
check("agent can't review their own credential", (await errorOf(agent.sb.rpc("review_credential", { credential: cred.id, verdict: "verified" }))) === "forbidden");
check("students can't submit credentials", !!(await errorOf(student.sb.from("credentials").insert({ agent_id: student.id, kind: "other", issuer: "x" }))));
let card = await get(`/en/student/agents/${agent.id}`, student.cookie);
check("agent page shows 'waiting for review', not verified", card.body.includes("Submitted, waiting for review") && card.body.includes("No verified credentials yet"));
check("admin verifies the credential", !(await errorOf(admin.sb.rpc("review_credential", { credential: cred.id, verdict: "verified", note: "Checked on the BEOE list" }))));
card = await get(`/en/student/agents/${agent.id}`, student.cookie);
check("agent page now shows the verified credential", card.body.includes("Verified by Iraada"));
check("admin review page loads", (await get("/en/admin/credentials", admin.cookie)).body.includes("OEP-1234"));

// 5. Credential files are private to the agent and admins.
const pdf = new Blob(["%PDF-1.4 test"], { type: "application/pdf" });
const own = `${agent.id}/e2e-${Date.now()}.pdf`;
check("agent uploads into their own folder", !(await errorOf(agent.sb.storage.from("credentials").upload(own, pdf))));
check("agent can't upload into someone else's folder", !!(await errorOf(agent.sb.storage.from("credentials").upload(`${student.id}/x.pdf`, pdf))));
check("students can't upload credential files", !!(await errorOf(student.sb.storage.from("credentials").upload(`${student.id}/x.pdf`, pdf))));
check("the bucket refuses other file types", !!(await errorOf(agent.sb.storage.from("credentials").upload(`${agent.id}/x.html`, new Blob(["<h1>"], { type: "text/html" })))));
check("students can't open credential files", !!(await errorOf(student.sb.storage.from("credentials").download(own))));
check("admins can open credential files", !(await errorOf(admin.sb.storage.from("credentials").download(own))));

finish();
