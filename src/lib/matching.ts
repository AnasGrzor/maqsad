import type { AgentKind, Goal, Level } from "./taxonomy.ts";

// Deterministic student-agent matching. No model is involved, and the score only ranks suggestions:
// the UI always says a match is not a guarantee of suitability, legitimacy, admission or a job.

export type StudentForMatch = { destinations: string[]; field: string; education_level: Level; goal: Goal };
export type AgentForMatch = {
  destinations: string[];
  specialisations: string[];
  levels: Level[];
  kind: AgentKind;
  verified: boolean;
};

export type Reason =
  | { key: "destinations"; countries: string[] }
  | { key: "field"; field: string }
  | { key: "level"; level: Level }
  | { key: "goal"; goal: Goal }
  | { key: "verified" };

export const WEIGHTS = { destinations: 40, field: 25, level: 15, goal: 15, verified: 5 } as const;

// Below this a suggestion shares nothing that matters, so it isn't recommended.
export const MIN_SCORE = WEIGHTS.destinations;

const GOAL_FITS: Record<Goal, AgentKind[]> = {
  study: ["education", "both"],
  work: ["recruitment", "both"],
  both: ["education", "recruitment", "both"],
};

export function match(s: StudentForMatch, a: AgentForMatch): { score: number; reasons: Reason[] } {
  const reasons: Reason[] = [];
  const shared = s.destinations.filter((c) => a.destinations.includes(c));
  if (shared.length) reasons.push({ key: "destinations", countries: shared });
  if (a.specialisations.includes(s.field)) reasons.push({ key: "field", field: s.field });
  if (a.levels.includes(s.education_level)) reasons.push({ key: "level", level: s.education_level });
  if (GOAL_FITS[s.goal].includes(a.kind)) reasons.push({ key: "goal", goal: s.goal });
  if (a.verified) reasons.push({ key: "verified" });
  return { score: reasons.reduce((sum, r) => sum + WEIGHTS[r.key], 0), reasons };
}

export function rank<T>(items: T[], scoreOf: (item: T) => { score: number; reasons: Reason[] }, limit: number) {
  return items
    .map((item) => ({ item, ...scoreOf(item) }))
    .filter((m) => m.score >= MIN_SCORE)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}
