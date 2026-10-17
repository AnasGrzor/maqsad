import type { Feature } from "./features";

// Prices are in PKR per month. null means the price is not set yet and the page says so.
// Limits are enforced on the server from milestone 5; until then they are shown, not applied.
export type Plan = {
  id: "student_free" | "student_plus" | "agent_basic" | "agent_professional" | "agency";
  audience: "student" | "agent";
  offered: boolean;
  priceMonthlyPkr: number | null;
  verificationReportsPerMonth: number | null;
  features: Feature[];
};

export const PLANS: Plan[] = [
  {
    id: "student_free",
    audience: "student",
    offered: true,
    priceMonthlyPkr: 0,
    verificationReportsPerMonth: 3,
    features: ["accounts", "documentCheck", "studentProfile", "profileVisibility", "agentDirectory", "connections", "caseTracking"],
  },
  {
    id: "student_plus",
    audience: "student",
    offered: false,
    priceMonthlyPkr: null,
    verificationReportsPerMonth: 20,
    features: ["savedReports", "feeRecords"],
  },
  {
    id: "agent_basic",
    audience: "agent",
    offered: true,
    priceMonthlyPkr: null,
    verificationReportsPerMonth: null,
    features: ["accounts", "agentProfile", "credentialSubmission", "studentDiscovery", "matching", "connections"],
  },
  {
    id: "agent_professional",
    audience: "agent",
    offered: true,
    priceMonthlyPkr: null,
    verificationReportsPerMonth: 30,
    features: ["messaging", "caseTracking", "feeRecords", "documentCheck"],
  },
  {
    id: "agency",
    audience: "agent",
    offered: false,
    priceMonthlyPkr: null,
    verificationReportsPerMonth: null,
    features: [],
  },
];
