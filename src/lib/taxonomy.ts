// Fixed lists shared by profiles, filters and matching. Labels: countries come from Intl.DisplayNames,
// everything else from "taxonomy" in messages/<lang>.json.

export const COUNTRIES = [
  "GB", "CA", "AU", "US", "IE", "NZ", "DE", "FR", "IT", "NL", "SE", "HU", "TR",
  "MY", "CN", "JP", "KR", "AE", "SA", "QA",
] as const;

export const FIELDS = [
  "business", "computing", "engineering", "health", "nursing", "sciences", "social_sciences", "arts",
  "law", "education", "hospitality", "construction", "trades", "logistics", "other",
] as const;

export const LEVELS = ["secondary", "diploma", "bachelors", "masters", "phd", "other"] as const;
export const GOALS = ["study", "work", "both"] as const;
export const AGENT_KINDS = ["education", "recruitment", "both"] as const;
export const CREDENTIAL_KINDS = ["business_registration", "oep_licence", "partnership", "membership", "other"] as const;
export const CREDENTIAL_STATUSES = ["submitted", "under_review", "verified", "rejected"] as const;

export type Country = (typeof COUNTRIES)[number];
export type Field = (typeof FIELDS)[number];
export type Level = (typeof LEVELS)[number];
export type Goal = (typeof GOALS)[number];
export type AgentKind = (typeof AGENT_KINDS)[number];

export function countryName(code: string, locale: string) {
  return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
}
