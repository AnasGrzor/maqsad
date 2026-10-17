// Pure helpers for the admin pages (no server imports, so `pnpm test` can load them).

// Actions written by the M6 triggers. Other milestones add theirs here and under "adminAudit.actions".
export const AUDIT_ACTIONS = [
  "account.suspend",
  "account.reactivate",
  "account.role_change",
  "credential.review",
  "dispute.review",
  "plan.update",
  "subscription.grant",
  "plan_request.decide",
] as const;

// Message key for an action: next-intl treats dots as nesting.
export const actionKey = (action: string) => action.replace(".", "_");

// Makes user input literal inside an ILIKE pattern.
// shortcut: PostgREST also treats "*" as a wildcard and has no escape for it, so "*" matches everything.
export function likePattern(input: string) {
  return `%${input.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// A search box value: trimmed, bounded, or undefined when empty.
export function searchTerm(value: string | string[] | undefined, max = 80) {
  const term = typeof value === "string" ? value.trim().slice(0, max) : "";
  return term || undefined;
}
