// End-to-end checks for saved verification reports (milestone 4): who can save, read, change and delete
// them, that nothing personal is stored, and that the report pages render.
//
// The checks that call /api/analyze need the dev server in test mode (MOCK_AI=1, `next dev`), so they only
// run with E2E_MOCK=1. Without it the script never calls the checker, because a production server would
// spend real Gemini and Groq quota; it inserts a report the way the API does (as the signed-in student).
import { anonClient, APP, check, ensureUser, finish, get, session, sql } from "./e2e-lib.mjs";

const MOCK = process.env.E2E_MOCK === "1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

await ensureUser("m4-student@maqsad.test", "student", "M4 Student");
await ensureUser("m4-student2@maqsad.test", "student", "M4 Other Student");
await ensureUser("m4-agent@maqsad.test", "agent", "M4 Agent");
await ensureUser("m4-admin@maqsad.test", "student", "M4 Admin");
sql("update public.profiles set role='admin' where id=(select id from auth.users where email='m4-admin@maqsad.test')");

const student = await session("m4-student@maqsad.test");
const other = await session("m4-student2@maqsad.test");
const agent = await session("m4-agent@maqsad.test");
const admin = await session("m4-admin@maqsad.test");
const mine = [student, other, agent, admin].map((u) => `'${u.id}'`).join(",");
sql(`delete from public.verification_reports where owner_id in (${mine})`);

const countOf = (where = "true") => Number(sql(`select count(*) from public.verification_reports where ${where}`));
const ownedBy = (u) => countOf(`owner_id='${u.id}'`);
const rowJson = (id) => sql(`select row_to_json(r)::text from public.verification_reports r where id='${id}'`);
const errorOf = async (p) => (await p).error?.message;

async function analyze(text, { cookie, save }) {
  const body = new FormData();
  body.append("text", text);
  if (save) body.append("save", "1");
  const res = await fetch(`${APP}/api/analyze`, { method: "POST", body, headers: cookie ? { cookie } : {} });
  if (!res.ok) return { status: res.status };
  const events = (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return { status: res.status, result: events.find((e) => e.type === "result") };
}

let id;
if (MOCK) {
  // 1. A signed-in student who opts in gets the report saved, without the pasted text or personal fields.
  const pasted = "high SECRET-PASTE-7731 my CNIC is 35202-1234567-1 and my name is Zara Siddiqui";
  const saved = await analyze(pasted, { cookie: student.cookie, save: true });
  id = saved.result?.saved;
  check("an opted-in student gets a saved report id", UUID.test(id ?? ""), JSON.stringify(saved.result?.saved));
  check("the saved row belongs to the student", ownedBy(student) === 1);
  const stored = id ? rowJson(id) : "";
  check("the stored row keeps the risk, codes, evidence and sources", /"risk": ?"high"/.test(stored) && /"code": ?"payment_channel"/.test(stored) && /"evidence": ?\["JazzCash"\]/.test(stored) && stored.includes("https://"));
  // The pasted text and the mock document's personal fields: recipient, payee, account, phone, emails.
  const secrets = ["SECRET-PASTE-7731", "35202", "Zara", "Siddiqui", "Ayesha", "Imran Shah", "4567890", "@gmail.com", "admissions@westbridge-uni.co.uk"];
  const leaked = secrets.filter((s) => stored.includes(s));
  check("nothing in the stored row is pasted text or a personal field", stored && leaked.length === 0, leaked.join(", "));
  check("the row has no extraction, text or connections column", stored && !/"(extraction|text|connections|recipient_name)":/.test(stored));

  // 2. No opt-in, anonymous users and agents: nothing is stored.
  const before = countOf();
  const unticked = await analyze("high", { cookie: student.cookie, save: false });
  check("a student who doesn't opt in gets a report but nothing is stored", unticked.result?.report?.risk === "high" && unticked.result.saved === undefined && ownedBy(student) === 1);
  const anon = await analyze("high", { save: true });
  check("an anonymous check with save=1 stores nothing", typeof anon.result?.saved !== "string" && countOf() === before, `status ${anon.status}`);
  const byAgent = await analyze("medium", { cookie: agent.cookie, save: true });
  check("an agent can't save (students only)", (byAgent.result === undefined || byAgent.result.saved === false) && ownedBy(agent) === 0);
  check("still exactly one report in total from these checks", countOf() === before);
} else {
  console.log("SKIP API checks (set E2E_MOCK=1 against `next dev` with MOCK_AI=1 to run them)");
  const { data, error } = await student.sb
    .from("verification_reports")
    .insert({
      owner_id: student.id,
      doc_type: "university_offer",
      issuer_name: "Westbridge Global University",
      risk: "high",
      findings: [{
        title: "Payment through a personal or untraceable channel", detail: "English fallback", severity: "high",
        status: "red_flag", topic: "payment_channel", sources: [], origin: "rules", code: "payment_channel", params: {}, evidence: ["JazzCash"],
      }],
      summary_en: "Do not pay anything.",
      summary_ur: "کوئی رقم نہ بھیجیں۔",
      official_contact: null,
      warnings: [],
    })
    .select("id")
    .single();
  check("a student can save their own report", !error && UUID.test(data?.id ?? ""), error?.message);
  id = data?.id;
}

// 3. Database rules: owners and admins read; nobody else reads; nobody edits; only the owner deletes.
const readable = async (u) => ((await u.sb.from("verification_reports").select("id").eq("id", id)).data ?? []).length;
check("the owner can read it", (await readable(student)) === 1);
check("another student can't read it", (await readable(other)) === 0);
check("an agent can't read it", (await readable(agent)) === 0);
check("an admin can read it", (await readable(admin)) === 1);
check("anonymous users can't read it", ((await anonClient().from("verification_reports").select("id").eq("id", id)).data ?? []).length === 0);
check("the owner can't edit it", !!(await errorOf(student.sb.from("verification_reports").update({ risk: "low" }).eq("id", id))));
await other.sb.from("verification_reports").update({ risk: "low" }).eq("id", id);
await admin.sb.from("verification_reports").update({ risk: "low" }).eq("id", id);
check("nobody else can edit it either", sql(`select risk from public.verification_reports where id='${id}'`) === "high");
for (const [who, u] of [["another student", other], ["an agent", agent], ["an admin", admin]]) {
  await u.sb.from("verification_reports").delete().eq("id", id);
  check(`${who} can't delete it`, countOf(`id='${id}'`) === 1);
}
const row = { doc_type: "other", risk: "low", findings: [], warnings: [] };
check("a student can't save a report into someone else's account", !!(await errorOf(student.sb.from("verification_reports").insert({ ...row, owner_id: other.id }))));
check("users can't set case_id themselves", !!(await errorOf(student.sb.from("verification_reports").insert({ ...row, owner_id: student.id, case_id: other.id }))));
check("agents can't save reports", !!(await errorOf(agent.sb.from("verification_reports").insert({ ...row, owner_id: agent.id }))));
check("risk must be a known level", !!(await errorOf(student.sb.from("verification_reports").insert({ ...row, owner_id: student.id, risk: "genuine" }))));

// 4. Pages over HTTP. Every message is also sent to the browser as JSON, so rendered text is matched
// with the ">" of its tag, and other users' pages are checked for the report's data instead.
const list = await get("/en/student/reports", student.cookie);
check("reports list shows the saved report", list.status === 200 && list.body.includes("Westbridge Global University") && list.body.includes(`/en/student/reports/${id}`) && list.body.includes(">High risk<"));
const detail = await get(`/en/student/reports/${id}`, student.cookie);
check("report page renders the report with its explanation", detail.status === 200 && detail.body.includes(">Why this result<") && /High risk because \d+ serious red flags? (was|were) found:/.test(detail.body) && detail.body.includes(`name="id" value="${id}"`));
check("report page shows the evidence quote and the stored-copy note", detail.body.includes("<q>JazzCash</q>") && detail.body.includes(">This is a saved copy of the report."));
check("report page labels deepfake detection as planned", detail.body.includes(">Deepfake and image manipulation detection is planned."));
const urdu = await get(`/ur/student/reports/${id}`, student.cookie);
check("report page renders in Urdu with translated findings", urdu.status === 200 && urdu.body.includes(">یہ نتیجہ کیوں<") && urdu.body.includes(">ذاتی یا ناقابلِ سراغ ذریعے سے ادائیگی<"));
const theirs = await get(`/en/student/reports/${id}`, other.cookie);
check("another student gets 'not found', not the report", theirs.body.includes(">This report doesn’t exist, or it isn’t yours.<") && !theirs.body.includes("Westbridge Global University"));
check("signed-out users are sent to log in", (await get(`/en/student/reports/${id}`)).redirect.includes("/en/login"));
check("agents can't open the student reports page", (await get("/en/student/reports", agent.cookie)).redirect.includes("/en/agent"));
const otherList = await get("/en/student/reports", other.cookie);
check("another student's list is empty", otherList.body.includes(">You haven’t saved any reports yet.") && !otherList.body.includes(id));
const label = 'name="save"';
check("the save checkbox is shown to signed-in students", (await get("/en/check", student.cookie)).body.includes(label));
check("the save checkbox is not shown to anonymous users", !(await get("/en/check")).body.includes(label));
check("the save checkbox is not shown to agents", !(await get("/en/check", agent.cookie)).body.includes(label));

// 5. The owner deletes it.
check("the owner can delete it", ((await student.sb.from("verification_reports").delete().eq("id", id).select("id")).data ?? []).length === 1 && countOf(`id='${id}'`) === 0);

sql(`delete from public.verification_reports where owner_id in (${mine})`);
finish();
