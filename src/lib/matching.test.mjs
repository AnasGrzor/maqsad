// Run with: pnpm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { match, MIN_SCORE, rank } from "./matching.ts";
import { AgentProfile, formObject, StudentProfile } from "./profile-schema.ts";

const student = { destinations: ["CA", "GB"], field: "computing", education_level: "bachelors", goal: "study" };
const agent = { destinations: ["CA"], specialisations: ["computing"], levels: ["bachelors"], kind: "education", verified: false };

test("a full match lists every reason and scores 95 without verification", () => {
  const m = match(student, agent);
  assert.equal(m.score, 95);
  assert.deepEqual(m.reasons.map((r) => r.key), ["destinations", "field", "level", "goal"]);
  assert.deepEqual(m.reasons[0].countries, ["CA"]);
});

test("verification adds a reason; nothing else about the agent does", () => {
  assert.equal(match(student, { ...agent, verified: true }).score, 100);
});

test("goal must fit the agent type", () => {
  assert.equal(match({ ...student, goal: "work" }, agent).reasons.some((r) => r.key === "goal"), false);
  assert.equal(match({ ...student, goal: "work" }, { ...agent, kind: "both" }).reasons.some((r) => r.key === "goal"), true);
});

test("rank drops weak matches and sorts by score", () => {
  const agents = [
    { ...agent, destinations: ["US"] }, // no shared destination: field + level + goal = 55
    { ...agent, destinations: ["US"], specialisations: [], levels: [] }, // goal only = 15, dropped
    agent, // 95
  ];
  const ranked = rank(agents, (a) => match(student, a), 10);
  assert.deepEqual(ranked.map((r) => r.score), [95, 55]);
  assert.ok(ranked.every((r) => r.score >= MIN_SCORE));
});

test("profile forms parse repeated keys and the visibility checkbox", () => {
  const f = new FormData();
  f.append("education_level", "masters");
  f.append("field", "health");
  f.append("goal", "both");
  f.append("destinations", "GB");
  f.append("destinations", "IE");
  f.append("$ACTION_ID_abc", "");
  const p = StudentProfile.parse(formObject(f));
  assert.deepEqual(p.destinations, ["GB", "IE"]);
  assert.equal(p.visible, false);
  f.append("visible", "on");
  assert.equal(StudentProfile.parse(formObject(f)).visible, true);
});

test("profile validation rejects unknown codes and unsafe websites", () => {
  const base = { agency_name: "A", kind: "education", destinations: [], specialisations: [], levels: [] };
  assert.equal(AgentProfile.safeParse({ ...base, destinations: ["XX"] }).success, false);
  assert.equal(AgentProfile.safeParse({ ...base, website: "javascript:alert(1)" }).success, false);
  assert.equal(AgentProfile.safeParse({ ...base, website: "https://agency.pk" }).success, true);
  assert.equal(AgentProfile.safeParse({ ...base, website: "" }).success, true);
});
