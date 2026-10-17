// Run with: pnpm test. The risk explanation is plain code over the findings, like the risk itself.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createTranslator } from "next-intl";
import * as checks from "./checks.ts";
import { checkFailed } from "./checks.ts";
import { explainRisk, mergeFindings, riskLevel } from "./scoring.ts";

const f = (status, severity, title = `${status} ${severity}`) => ({ title, detail: "", severity, status, topic: "other", sources: [], origin: "rules" });
const high1 = f("red_flag", "high", "Payment through JazzCash");
const high2 = f("red_flag", "high", "Hidden instructions");
const medium = f("red_flag", "medium", "Pressure to act fast");
const minor = f("red_flag", "low", "PDF changed later");
const verified = f("verified", "low", "Listed on the register");

test("checks.ts still exports the scoring functions", () => {
  assert.equal(checks.riskLevel, riskLevel);
  assert.equal(checks.mergeFindings, mergeFindings);
});

test("high risk cites the serious red flags and counts them", () => {
  const findings = [medium, high1, verified, high2];
  const why = explainRisk(riskLevel(findings, true), findings);
  assert.equal(why.reason, "high_flags");
  assert.equal(why.count, 2);
  assert.deepEqual(why.cited, [high1, high2]);
});

test("at most three flags are cited, but all are counted", () => {
  const many = [high1, high2, high1, high2, high1];
  const why = explainRisk("high", many);
  assert.equal(why.count, 5);
  assert.equal(why.cited.length, 3);
});

test("medium risk cites warning signs only", () => {
  const findings = [minor, medium, verified];
  const why = explainRisk(riskLevel(findings, true), findings);
  assert.deepEqual([why.reason, why.count, why.cited], ["medium_flags", 1, [medium]]);
});

test("incomplete names the checks that didn't run, not the non-blocking ones", () => {
  const web = checkFailed("web_research");
  const pkcert = checkFailed("pkcert", false);
  const findings = [verified, web, pkcert];
  const why = explainRisk(riskLevel(findings, false), findings);
  assert.equal(why.reason, "checks_failed");
  assert.deepEqual(why.cited, [web]);
  assert.equal(web.status, "unverified", "a failed check is 'could not be verified', never a red flag");
  assert.equal(pkcert.code, "source_unavailable");
});

test("incomplete with every check run means nothing was confirmed", () => {
  const findings = [minor];
  const why = explainRisk(riskLevel(findings, true), findings);
  assert.deepEqual([why.reason, why.count, why.cited], ["nothing_confirmed", 0, []]);
});

test("low risk counts the confirmed facts", () => {
  const findings = [verified, verified, minor];
  assert.equal(riskLevel(findings, true), "low");
  assert.deepEqual(explainRisk("low", findings), { reason: "no_flags", count: 2, cited: [] });
});

test("a failed check never removes a red flag or changes high to incomplete", () => {
  const findings = [high1, checkFailed("web_research")];
  assert.equal(riskLevel(findings, false), "high");
  assert.equal(explainRisk("high", findings).reason, "high_flags");
});

test("every explanation renders in English and Urdu", () => {
  for (const locale of ["en", "ur"]) {
    const messages = JSON.parse(readFileSync(new URL(`../../messages/${locale}/m4.json`, import.meta.url)));
    const t = createTranslator({ locale, messages, namespace: "reportScoring", onError: (e) => { throw e; } });
    for (const reason of ["high_flags", "medium_flags", "checks_failed", "nothing_confirmed", "no_flags"]) {
      for (const count of [1, 3]) {
        const text = t(reason, { count });
        assert.ok(text.length > 20 && !text.includes("{"), `${locale} ${reason}`);
      }
    }
    if (locale === "en") assert.match(t("high_flags", { count: 2 }), /^High risk because 2 serious red flags/);
  }
});

test("a model's verified finding without a source can't make a report low", () => {
  const web = { ...verified, origin: "web" };
  assert.equal(riskLevel([web], true), "incomplete");
  assert.equal(riskLevel([{ ...web, sources: ["https://www.gov.uk/student-visa"] }], true), "low");
});
