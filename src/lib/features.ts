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
  messaging: false,
  caseTracking: false,
  feeRecords: false,
  savedReports: false,
  complaints: false,
  planLimits: false,
  adminReview: false,
  auditLog: false,
  deepfakeDetection: false,
} as const;

export type Feature = keyof typeof FEATURES;
