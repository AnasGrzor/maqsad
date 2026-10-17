import { z } from "zod";
import { COUNTRIES } from "./taxonomy.ts";

// Fixed lists for cases, records, messages and disputes. They mirror the enums in
// supabase/migrations/20261019000001_cases_messaging.sql. Labels live in messages/<lang>/m3.json.
export const CASE_KINDS = ["study", "work"] as const;
export const CASE_STATUSES = ["active", "completed", "closed"] as const;
export const ITEM_KINDS = ["requirement", "document_request", "milestone", "deadline"] as const;
export const RECORD_KINDS = ["fee_disclosed", "responsibility", "promise", "expected_date", "terms_change", "payment_reported"] as const;
export const CURRENCIES = ["PKR", "USD", "GBP", "EUR", "CAD", "AUD", "AED", "SAR"] as const;
export const DISPUTE_KINDS = ["report", "dispute"] as const;
export const DISPUTE_REASONS = [
  "misleading_information", "undisclosed_fees", "fee_dispute", "missed_commitment", "document_concern",
  "pressure_tactics", "harassment", "impersonation", "other",
] as const;

// Today's date in the app's time zone as YYYY-MM-DD, so due dates (Postgres `date`) compare as strings.
export function today(now = new Date(), timeZone = "Asia/Karachi") {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// Past its due date and still open. Due today is not overdue yet.
export function isOverdue(item: { due_on: string | null; status: string }, todayIso: string) {
  return item.status === "open" && !!item.due_on && item.due_on < todayIso;
}

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalDate = z.union([z.literal(""), z.iso.date()]).default("").transform((v) => v || null);
const optionalId = z.union([z.literal(""), z.uuid()]).default("").transform((v) => v || null);
// "50,000" and "50000.5" are fine; blank means no amount.
const amount = z
  .string()
  .trim()
  .default("")
  .transform((v) => v.replace(/,/g, ""))
  .pipe(z.union([z.literal(""), z.string().regex(/^\d{1,12}(\.\d{1,2})?$/)]))
  .transform((v) => (v === "" ? null : Number(v)));

export const OpenCase = z.object({
  connection: z.uuid(),
  title: text(1, 120),
  kind: z.enum(CASE_KINDS),
  country: z.enum(COUNTRIES),
});

export const CaseStatus = z.object({ target_case: z.uuid(), new_status: z.enum(CASE_STATUSES) });

export const CaseItem = z.object({
  target_case: z.uuid(),
  kind: z.enum(ITEM_KINDS),
  title: text(1, 200),
  details: text(0, 2000).default(""),
  due_on: optionalDate,
});

export const ItemStatus = z.object({ item: z.uuid(), done: z.enum(["1", "0"]).transform((v) => v === "1") });

// A currency is kept only with an amount, matching the table's check.
export const CaseRecord = z
  .object({
    target_case: z.uuid(),
    kind: z.enum(RECORD_KINDS),
    summary: text(1, 1000),
    amount,
    currency: z.enum(CURRENCIES).default("PKR"),
    on_date: optionalDate,
    correction_of: optionalId,
  })
  .transform((r) => ({ ...r, currency: r.amount === null ? null : r.currency }));

export const Message = z.object({ connection: z.uuid(), body: text(1, 4000), target_case: optionalId });

export const Dispute = z.object({
  connection: z.uuid(),
  kind: z.enum(DISPUTE_KINDS),
  reason: z.enum(DISPUTE_REASONS),
  details: text(1, 2000),
  target_case: optionalId,
  target_record: optionalId,
});
