import type { Finding, RiskLevel } from "./schema";

// The risk level and its explanation are computed here in plain code. A model can add red flags
// (through its findings) but never sets, lowers or explains away the risk.

// "low" needs every check to have run and at least one fact confirmed by an official
// source; otherwise a document that was barely checked would look safe.
export function riskLevel(findings: Finding[], allChecksRan: boolean): RiskLevel {
  const flags = findings.filter((f) => f.status === "red_flag");
  if (flags.some((f) => f.severity === "high")) return "high";
  if (flags.some((f) => f.severity === "medium")) return "medium";
  if (!allChecksRan || !findings.some((f) => f.status === "verified")) return "incomplete";
  return "low";
}

const SEVERITY_RANK = { low: 0, medium: 1, high: 2 } as const;

// The judge model often restates rule findings despite being told not to. A web finding on
// the same topic and status as an earlier finding is folded into it: the earlier wording stays,
// its sources are added, and the higher severity wins so merging can never lower the risk.
export function mergeFindings(findings: Finding[]): Finding[] {
  const out: Finding[] = [];
  for (const f of findings) {
    const same =
      f.origin === "web" && f.topic !== "other"
        ? out.find((o) => o.topic === f.topic && o.status === f.status)
        : undefined;
    if (!same) {
      out.push({ ...f });
      continue;
    }
    same.sources = [...new Set([...same.sources, ...f.sources])];
    if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[same.severity]) same.severity = f.severity;
  }
  return out;
}

export type RiskExplanation = {
  // Message key under "reportScoring" in messages/<lang>/m4.json.
  reason: "high_flags" | "medium_flags" | "checks_failed" | "nothing_confirmed" | "no_flags";
  count: number;
  // The findings the reason rests on, shown under it (at most 3 flags).
  cited: Finding[];
};

// Why the report got its risk level. It reads only the risk and the findings, the same inputs
// riskLevel() used, so it can't disagree with the result. Works for saved reports too.
export function explainRisk(risk: RiskLevel, findings: Finding[]): RiskExplanation {
  if (risk === "high" || risk === "medium") {
    const flags = findings.filter((f) => f.status === "red_flag" && f.severity === risk);
    return { reason: risk === "high" ? "high_flags" : "medium_flags", count: flags.length, cited: flags.slice(0, 3) };
  }
  if (risk === "incomplete") {
    const failed = findings.filter((f) => f.code === "check_failed");
    return failed.length
      ? { reason: "checks_failed", count: failed.length, cited: failed }
      : { reason: "nothing_confirmed", count: 0, cited: [] };
  }
  return { reason: "no_flags", count: findings.filter((f) => f.status === "verified").length, cited: [] };
}
