// What works today. Public pages, pricing and dashboard navigation read this, so a feature is only
// advertised as available once the milestone that builds it sets it to true.
export const FEATURES = {
  documentCheck: true,
  accounts: true,
  studentProfile: true,
  profileVisibility: true,
  agentDirectory: true,
  agentProfile: true,
  credentialSubmission: true,
  studentDiscovery: true,
  matching: true,
  connections: true,
  messaging: true,
  caseTracking: true,
  feeRecords: true,
  savedReports: true,
  complaints: true,
  planLimits: true,
  adminReview: true,
  auditLog: true,
} as const;

export type Feature = keyof typeof FEATURES;
