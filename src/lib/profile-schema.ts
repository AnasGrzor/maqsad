import { z } from "zod";
import { AGENT_KINDS, COUNTRIES, CREDENTIAL_KINDS, FIELDS, GOALS, LEVELS } from "./taxonomy.ts";

const text = (max: number) => z.string().trim().max(max).default("");

export const StudentProfile = z.object({
  education_level: z.enum(LEVELS),
  field: z.enum(FIELDS),
  qualifications: text(1000),
  skills: text(500),
  experience: text(1000),
  destinations: z.array(z.enum(COUNTRIES)).max(10),
  goal: z.enum(GOALS),
  goals_note: text(1000),
  visible: z.boolean(),
});

export const AgentProfile = z.object({
  agency_name: z.string().trim().min(1).max(120),
  kind: z.enum(AGENT_KINDS),
  city: text(80),
  website: z.union([z.literal(""), z.url({ protocol: /^https?$/ }).max(200)]).default(""),
  destinations: z.array(z.enum(COUNTRIES)).max(20),
  specialisations: z.array(z.enum(FIELDS)).max(20),
  levels: z.array(z.enum(LEVELS)).max(LEVELS.length),
  fees: text(2000),
  about: text(1000),
});

export const Credential = z.object({
  kind: z.enum(CREDENTIAL_KINDS),
  issuer: z.string().trim().min(1).max(120),
  reference: text(80),
});

export const CREDENTIAL_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const CREDENTIAL_MAX_BYTES = 4 * 1024 * 1024;

export const ConnectionNote = z.string().trim().max(500).default("");

// FormData sends multi-selects as repeated keys and checkboxes as "on" or nothing.
const ARRAYS = new Set(["destinations", "specialisations", "levels"]);
export function formObject(form: FormData) {
  const out: Record<string, unknown> = {};
  for (const key of new Set(form.keys())) {
    if (key.startsWith("$")) continue;
    out[key] = ARRAYS.has(key) ? form.getAll(key) : form.get(key);
  }
  for (const key of ARRAYS) out[key] ??= [];
  out.visible = form.get("visible") === "on";
  return out;
}

// The field a validation error points at, used as a message key under "forms.fields".
export function errorField(error: z.ZodError) {
  return String(error.issues[0]?.path[0] ?? "unknown");
}
