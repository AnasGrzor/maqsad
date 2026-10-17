// End-to-end checks for cases, case items, history, fee and commitment records, messages, notifications
// and disputes (milestone 3). Uses its own m3-*@maqsad.test accounts and resets their data first.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { APP, check, ensureUser, finish, get, session, sql } from "./e2e-lib.mjs";

await ensureUser("m3-student@maqsad.test", "student", "Ayesha Malik");
await ensureUser("m3-student2@maqsad.test", "student", "Outside Student");
await ensureUser("m3-agent@maqsad.test", "agent", "Crescent Advisers");
await ensureUser("m3-agent2@maqsad.test", "agent", "Declined Agent");
await ensureUser("m3-admin@maqsad.test", "student", "M3 Admin");
sql("update public.profiles set role='admin' where id=(select id from auth.users where email='m3-admin@maqsad.test')");

const student = await session("m3-student@maqsad.test");
const outsider = await session("m3-student2@maqsad.test");
const agent = await session("m3-agent@maqsad.test");
const agent2 = await session("m3-agent2@maqsad.test");
const admin = await session("m3-admin@maqsad.test");
const ids = [student.id, outsider.id, agent.id, agent2.id].map((id) => `'${id}'`).join(",");
// Deleting connections cascades to cases, items, records, history, messages, notifications and disputes.
sql(`delete from public.connections where student_id in (${ids}) or agent_id in (${ids})`);
sql(`delete from public.notifications where user_id in (${ids})`);
sql(`delete from public.student_profiles where user_id in (${ids})`);
sql(`delete from public.agent_profiles where user_id in (${ids})`);

const errorOf = async (p) => (await p).error?.message;
const rows = async (p) => (await p).data ?? [];
const NA = "not_available";
// True when Postgres refuses the statement even as the postgres superuser (the append-only trigger).
const ownerBlocked = (q) => {
  try {
    execSync(`docker exec supabase_db_bluegill psql -U postgres -v ON_ERROR_STOP=1 -tAc "${q}"`, { stdio: "pipe" });
    return false;
  } catch (e) {
    return String(e.stderr).includes("append_only");
  }
};

await student.sb.from("student_profiles").upsert({ user_id: student.id, education_level: "bachelors", field: "computing", destinations: ["GB"], goal: "study", visible: true });
for (const a of [agent, agent2]) await a.sb.from("agent_profiles").upsert({ user_id: a.id, agency_name: `Agency ${a.id.slice(0, 4)}`, kind: "education" });

// 1. Connections: notifications, and no case before acceptance.
const { data: conn } = await agent.sb.rpc("request_connection", { target: student.id });
const studentNotes = await rows(student.sb.from("notifications").select("kind, actor_id"));
check("a connection request notifies the student", studentNotes.length === 1 && studentNotes[0].kind === "connection_request" && studentNotes[0].actor_id === agent.id);
check("the requester gets no notification for their own request", (await rows(agent.sb.from("notifications").select("id"))).length === 0);
check("a pending connection can't open a case", (await errorOf(agent.sb.rpc("open_case", { connection: conn, title: "Too early", kind: "study", country: "GB" }))) === NA);
check("a pending connection can't send messages", (await errorOf(agent.sb.rpc("send_message", { connection: conn, body: "hi" }))) === NA);
await student.sb.rpc("respond_connection", { connection: conn, accept: true });
const accepted = await rows(agent.sb.from("notifications").select("kind").eq("kind", "connection_accepted"));
check("accepting notifies the requester", accepted.length === 1);

const { data: conn2 } = await agent2.sb.rpc("request_connection", { target: student.id });
await student.sb.rpc("respond_connection", { connection: conn2, accept: false });
check("a declined connection can't open a case", (await errorOf(agent2.sb.rpc("open_case", { connection: conn2, title: "x", kind: "study", country: "GB" }))) === NA);
check("a declined connection can't send messages", (await errorOf(agent2.sb.rpc("send_message", { connection: conn2, body: "hi" }))) === NA);

// 2. Cases.
check("an outsider can't open a case on someone else's connection", (await errorOf(outsider.sb.rpc("open_case", { connection: conn, title: "x", kind: "study", country: "GB" }))) === NA);
check("cases can't be inserted directly", !!(await errorOf(student.sb.from("cases").insert({ connection_id: conn, student_id: student.id, agent_id: agent.id, opened_by: student.id, title: "x", kind: "study", country: "GB" }))));
const { data: caseId, error: openErr } = await agent.sb.rpc("open_case", { connection: conn, title: "MSc Data Science, Manchester", kind: "study", country: "GB" });
check("a party of an accepted connection opens a case", !openErr && !!caseId, openErr?.message);
check("country codes are bounded in the database", !!(await errorOf(agent.sb.rpc("open_case", { connection: conn, title: "x", kind: "study", country: "<b>" }))));
check("both parties read the case", (await rows(student.sb.from("cases").select("id").eq("id", caseId))).length === 1 && (await rows(agent.sb.from("cases").select("id").eq("id", caseId))).length === 1);
check("outsiders and unconnected agents can't read the case", (await rows(outsider.sb.from("cases").select("id"))).length === 0 && (await rows(agent2.sb.from("cases").select("id"))).length === 0);
check("admins can read the case", (await rows(admin.sb.from("cases").select("id").eq("id", caseId))).length === 1);
check("cases can't be updated directly", !!(await errorOf(student.sb.from("cases").update({ status: "closed" }).eq("id", caseId))));

// 3. Items.
const yesterday = new Date(Date.now() - 2 * 86400e3).toISOString().slice(0, 10);
check("an outsider can't add items", (await errorOf(outsider.sb.rpc("add_case_item", { target_case: caseId, kind: "deadline", title: "x" }))) === NA);
const { data: itemId } = await student.sb.rpc("add_case_item", { target_case: caseId, kind: "document_request", title: "Upload IELTS certificate", details: "Band 6.5 or above", due_on: yesterday });
const { data: lateId } = await agent.sb.rpc("add_case_item", { target_case: caseId, kind: "deadline", title: "Pay CAS deposit", due_on: yesterday });
check("parties add items", !!itemId && !!lateId);
check("an outsider can't complete items", (await errorOf(outsider.sb.rpc("set_item_status", { item: itemId, done: true }))) === NA);
check("the other party completes an item", !(await errorOf(agent.sb.rpc("set_item_status", { item: itemId, done: true }))));
const item = (await rows(student.sb.from("case_items").select("*").eq("id", itemId)))[0];
check("the item records who created and who completed it, and when", item?.created_by === student.id && item?.completed_by === agent.id && !!item?.completed_at && item?.status === "done");
check("items can't be edited directly", !!(await errorOf(student.sb.from("case_items").update({ title: "changed" }).eq("id", itemId))));
check("outsiders can't read items", (await rows(outsider.sb.from("case_items").select("id"))).length === 0);

// 4. Fee and commitment records: append-only, corrections reference the original.
const { data: recordId } = await student.sb.rpc("add_case_record", { target_case: caseId, kind: "payment_reported", summary: "Student reports paying the first instalment", amount: 50000, currency: "PKR", on_date: "2026-11-03" });
check("a party records a reported payment", !!recordId);
check("an outsider can't add records", (await errorOf(outsider.sb.rpc("add_case_record", { target_case: caseId, kind: "promise", summary: "x" }))) === NA);
const { data: correctionId } = await agent.sb.rpc("add_case_record", { target_case: caseId, kind: "payment_reported", summary: "Received PKR 45,000, not 50,000", amount: 45000, currency: "PKR", correction_of: recordId });
check("a correction is a new record pointing at the old one", !!correctionId && (await rows(student.sb.from("case_records").select("corrects").eq("id", correctionId)))[0]?.corrects === recordId);
const { data: otherCase } = await student.sb.rpc("open_case", { connection: conn, title: "Work visa backup", kind: "work", country: "AE" });
check("a correction can't point at another case's record", (await errorOf(student.sb.rpc("add_case_record", { target_case: otherCase, kind: "promise", summary: "x", correction_of: recordId }))) === NA);
check("parties can't edit records", !!(await errorOf(student.sb.from("case_records").update({ amount: 1 }).eq("id", recordId))));
check("parties can't delete records", !!(await errorOf(agent.sb.from("case_records").delete().eq("id", recordId))));
check("outsiders can't read records", (await rows(outsider.sb.from("case_records").select("id"))).length === 0);
check("records stay unchanged even for the database owner", ownerBlocked(`update public.case_records set amount = 1 where id = '${recordId}'`) && sql(`select amount from public.case_records where id = '${recordId}'`) === "50000.00");

// 5. Status and history.
check("an outsider can't change the status", (await errorOf(outsider.sb.rpc("set_case_status", { target_case: caseId, new_status: "closed" }))) === NA);
check("either party changes the status", !(await errorOf(student.sb.rpc("set_case_status", { target_case: caseId, new_status: "completed" }))));
await agent.sb.rpc("set_case_status", { target_case: caseId, new_status: "active" });
const events = await rows(student.sb.from("case_events").select("kind, actor_id, detail").eq("case_id", caseId).order("id"));
const story = events.map((e) => `${e.kind}:${e.actor_id === student.id ? "student" : e.actor_id === agent.id ? "agent" : "?"}`).join(" ");
check(
  "history records who did what, in order",
  story === "case_opened:agent item_added:student item_added:agent item_done:agent record_added:student record_added:agent status_changed:student status_changed:agent",
  story,
);
check("history keeps the status change", events.find((e) => e.kind === "status_changed")?.detail?.to === "completed");
check("parties can't edit history", !!(await errorOf(student.sb.from("case_events").update({ kind: "case_opened" }).eq("case_id", caseId))));
check("parties can't delete history", !!(await errorOf(agent.sb.from("case_events").delete().eq("case_id", caseId))));
check("parties can't write history directly", !!(await errorOf(agent.sb.from("case_events").insert({ case_id: caseId, actor_id: student.id, kind: "case_opened" }))));
check("outsiders can't read history", (await rows(outsider.sb.from("case_events").select("id"))).length === 0);
check("history can't be deleted even by the database owner", ownerBlocked(`delete from public.case_events where case_id = '${caseId}'`));
// 6. Messages.
const xss = "<script>alert(1)</script> Salam, please send the CAS letter";
const { data: msgId } = await student.sb.rpc("send_message", { connection: conn, body: xss, target_case: caseId });
check("a party sends a message tagged to a case", !!msgId);
await agent.sb.rpc("send_message", { connection: conn, body: "Walaikum salam, sending today." });
check("the other party reads it", (await rows(agent.sb.from("messages").select("body").eq("id", msgId)))[0]?.body === xss);
check("outsiders can't read messages", (await rows(outsider.sb.from("messages").select("id"))).length === 0 && (await rows(agent2.sb.from("messages").select("id"))).length === 0);
check("outsiders can't send into the conversation", (await errorOf(outsider.sb.rpc("send_message", { connection: conn, body: "hi" }))) === NA);
check("a message can't be tagged to another connection's case", (await errorOf(agent2.sb.rpc("send_message", { connection: conn2, body: "x", target_case: caseId }))) === NA);
check("messages can't be inserted directly", !!(await errorOf(student.sb.from("messages").insert({ connection_id: conn, sender_id: student.id, body: "x" }))));
check("parties can't edit messages", !!(await errorOf(student.sb.from("messages").update({ body: "edited" }).eq("id", msgId))));
check("parties can't delete messages", !!(await errorOf(student.sb.from("messages").delete().eq("id", msgId))));
check("messages can't be edited even by the database owner", ownerBlocked(`update public.messages set body = 'x' where id = '${msgId}'`));

// 7. Notifications.
const agentKinds = (await rows(agent.sb.from("notifications").select("kind"))).map((n) => n.kind).sort().join(",");
check("the agent is notified of the student's actions only", agentKinds === "case_opened,connection_accepted,item_added,message,record_added,status_changed", agentKinds);
const studentKinds = (await rows(student.sb.from("notifications").select("kind"))).map((n) => n.kind).sort().join(",");
check("the student is notified of the agent's actions only", studentKinds === "case_opened,connection_request,connection_request,item_added,item_done,message,record_added,status_changed", studentKinds);
check("outsiders get no notifications", (await rows(outsider.sb.from("notifications").select("id"))).length === 0);
const agentNote = (await rows(agent.sb.from("notifications").select("id").eq("kind", "message")))[0].id;
await student.sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", agentNote);
check("a user can't mark someone else's notification read", sql(`select read_at is null from public.notifications where id = '${agentNote}'`) === "t");
check("users can only change read_at", !!(await errorOf(agent.sb.from("notifications").update({ kind: "message", user_id: student.id }).eq("id", agentNote))));
check("users can't create notifications", !!(await errorOf(agent.sb.from("notifications").insert({ user_id: student.id, actor_id: agent.id, kind: "message" }))));
check("the owner marks it read", !(await errorOf(agent.sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", agentNote))) && sql(`select read_at is not null from public.notifications where id = '${agentNote}'`) === "t");

// 8. Reports and disputes.
const agentNotesBefore = (await rows(agent.sb.from("notifications").select("id"))).length;
const { data: disputeId, error: dErr } = await student.sb.rpc("raise_dispute", { connection: conn, kind: "dispute", reason: "fee_dispute", details: "Agent says only PKR 45,000 arrived", target_case: caseId, target_record: recordId });
check("a party raises a dispute linked to a record", !dErr && !!disputeId, dErr?.message);
const mine = await rows(student.sb.from("disputes").select("status"));
check("the raiser sees it with status open", mine.length === 1 && mine[0].status === "open");
check("the other party can't see it", (await rows(agent.sb.from("disputes").select("id"))).length === 0);
check("the other party gets no notification about it", (await rows(agent.sb.from("notifications").select("id"))).length === agentNotesBefore);
check("an admin can read it", (await rows(admin.sb.from("disputes").select("id").eq("id", disputeId))).length === 1);
check("the raiser can't change its status", !!(await errorOf(student.sb.from("disputes").update({ status: "resolved" }).eq("id", disputeId))));
check("disputes can't be inserted directly", !!(await errorOf(student.sb.from("disputes").insert({ raised_by: student.id, against: agent.id, connection_id: conn, kind: "report", reason: "other", details: "x" }))));
check("an outsider can't raise a dispute on someone else's connection", (await errorOf(outsider.sb.rpc("raise_dispute", { connection: conn, kind: "report", reason: "other", details: "x" }))) === NA);
check("a dispute can't link a record from another connection", (await errorOf(agent2.sb.rpc("raise_dispute", { connection: conn2, kind: "report", reason: "other", details: "x", target_record: recordId }))) === NA);
check("a declined agent's student can still report them", !(await errorOf(student.sb.rpc("raise_dispute", { connection: conn2, kind: "report", reason: "pressure_tactics", details: "Kept messaging after I declined" }))));

// 9. Pages over HTTP, for both parties.
let page = await get(`/en/student/applications`, student.cookie);
check("student applications page lists the case", page.status === 200 && page.body.includes("MSc Data Science, Manchester") && page.body.includes("1 overdue"));
page = await get(`/en/student/applications/${caseId}`, student.cookie);
check("student case page shows items, overdue state, records and history", ["Pay CAS deposit", "Overdue", "Upload IELTS certificate", "not proof that money moved", "Corrected by a later record", "You changed the status from Active to Completed", "Crescent Advisers changed the status from Completed to Active"].every((s) => page.body.includes(s)));
check("student case page shows who recorded the payment", page.body.includes("Recorded by You") && page.body.includes("Recorded by Crescent Advisers"));
page = await get(`/en/agent/applications/${caseId}`, agent.cookie);
check("agent case page renders", page.status === 200 && page.body.includes("MSc Data Science, Manchester") && page.body.includes("With Ayesha Malik"));
check("agent case page doesn't show the student's dispute", !page.body.includes("Agent says only PKR 45,000 arrived"));
check("agent applications page renders", (await get(`/en/agent/applications`, agent.cookie)).body.includes("MSc Data Science, Manchester"));
check("Urdu applications page renders", (await get(`/ur/student/applications`, student.cookie)).body.includes("میری درخواستیں"));
page = await get(`/en/agent/messages`, agent.cookie);
check("agent conversation list shows the student", page.body.includes("Ayesha Malik") && page.body.includes("Walaikum salam"));
page = await get(`/en/agent/messages/${conn}`, agent.cookie);
check("agent thread shows messages as escaped plain text", page.body.includes("&lt;script&gt;alert(1)&lt;/script&gt; Salam") && !page.body.includes("<script>alert(1)</script>") && page.body.includes('dir="auto"'));
check("student thread renders", (await get(`/en/student/messages/${conn}`, student.cookie)).body.includes("Walaikum salam"));
check("an unconnected agent can't open the thread page", !(await get(`/en/agent/messages/${conn2}`, agent2.cookie)).body.includes("Salam"));
check("an outsider can't open the case page", !(await get(`/en/student/applications/${caseId}`, outsider.cookie)).body.includes("MSc Data Science"));
page = await get(`/en/student/notifications`, student.cookie);
check("student notifications page lists updates with an unread count", page.body.includes("Crescent Advisers sent you a message") && /\d+ unread/.test(page.body));
check("agent notifications page renders", (await get(`/en/agent/notifications`, agent.cookie)).body.includes("Ayesha Malik"));
page = await get(`/en/student/disputes`, student.cookie);
check("student disputes page shows status", page.body.includes("Disagreement about fees") && page.body.includes("Open"));
check("agent disputes page is empty", (await get(`/en/agent/disputes`, agent.cookie)).body.includes("sent any reports or disputes"));
check("connections page links to messages", (await get(`/en/agent/connections`, agent.cookie)).body.includes(`/en/agent/messages/${conn}`));

// 10. The forms' server actions, posted the way React posts a useActionState form. Action ids come from the
// production build's manifest, so this part runs only against `next start`.
const manifestFile = ".next/server/server-reference-manifest.json";
if (existsSync(manifestFile)) {
  const actions = JSON.parse(readFileSync(manifestFile, "utf8")).node;
  const act = async (who, path, name, fields) => {
    const body = new FormData();
    // Same encoding as React's encodeReply([prevState, formData]); the root part "0" goes last.
    for (const [k, v] of Object.entries(fields)) body.set(`_1_${k}`, v);
    body.set("0", JSON.stringify(["$undefined", "$K1"]));
    const id = Object.entries(actions).find(([, v]) => v.exportedName === name)?.[0];
    const r = await fetch(APP + path, { method: "POST", headers: { cookie: who.cookie, "Next-Action": id, Accept: "text/x-component" }, body });
    // Row 0 points at the action's return value ("a":"$@N"); return only that row, not the re-rendered page.
    const text = await r.text();
    const row = text.match(/^0:\{"a":"\$@(\w+)"/m)?.[1];
    return (row && text.match(new RegExp(`^${row}:(.*)$`, "m"))?.[1]) ?? "";
  };
  const thread = `/en/student/messages/${conn}`;
  check("the send form's action stores a message", (await act(student, thread, "sendMessage", { connection: conn, body: "Sent from the form", target_case: "" })).includes('"done":true') && sql(`select count(*) from public.messages where body = 'Sent from the form'`) === "1");
  check("the send form's action rejects an empty message", (await act(student, thread, "sendMessage", { connection: conn, body: "  " })).includes('"error":"invalid"'));
  check("the send form's action refuses an outsider", (await act(outsider, thread, "sendMessage", { connection: conn, body: "intruding" })).includes('"error":"not_available"'));
  const casePath = `/en/student/applications/${caseId}`;
  check("the item form's action adds an item", (await act(student, casePath, "addCaseItem", { target_case: caseId, kind: "milestone", title: "Offer letter received", details: "", due_on: "" })).includes('"done":true'));
  check("the record form's action adds a record", (await act(agent, `/en/agent/applications/${caseId}`, "addCaseRecord", { target_case: caseId, kind: "fee_disclosed", summary: "Service fee", amount: "75,000", currency: "PKR", on_date: "", correction_of: "" })).includes('"done":true') && sql(`select amount || currency from public.case_records where summary = 'Service fee'`) === "75000.00PKR");
  check("the status form's action changes the status", (await act(student, casePath, "setCaseStatus", { target_case: caseId, new_status: "closed" })).includes('"done":true') && sql(`select status from public.cases where id = '${caseId}'`) === "closed");
  check("the open-case form's action opens a case", (await act(agent, "/en/agent/applications", "openCase", { connection: conn, title: "Foundation year", kind: "study", country: "IE" })).includes('"done":true'));
  check("the open-case form's action refuses a declined connection", (await act(agent2, "/en/agent/applications", "openCase", { connection: conn2, title: "x", kind: "study", country: "IE" })).includes('"error":"not_available"'));
  check("the dispute form's action raises a dispute", (await act(agent, `/en/agent/applications/${caseId}`, "raiseDispute", { connection: conn, kind: "report", reason: "other", details: "Form check", target_case: caseId, target_record: "" })).includes('"done":true'));
  check("the mark-all-read action clears only the caller's unread notifications", (await act(student, "/en/student/notifications", "markNotificationsRead", { id: "all" })).includes('"done":true') && sql(`select count(*) from public.notifications where user_id = '${student.id}' and read_at is null`) === "0" && sql(`select count(*) from public.notifications where user_id = '${agent.id}' and read_at is null`) !== "0");
} else {
  console.log(`SKIP server action checks: no ${manifestFile} (run against a production build)`);
}

finish();
