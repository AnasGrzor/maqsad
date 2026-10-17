import { z } from "zod";

// Admin is never self-assignable; the signup trigger in supabase/migrations enforces the same rule.
export const SIGNUP_ROLES = ["student", "agent"] as const;

const displayName = z.string().trim().min(1).max(80);

export const SignUp = z.object({
  email: z.email().max(254),
  // bcrypt, which Supabase Auth uses, ignores bytes past 72.
  password: z.string().min(8).max(72),
  displayName,
  role: z.enum(SIGNUP_ROLES),
});

export const SignIn = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(72),
});

export const Profile = z.object({ displayName });

// Error codes double as message keys under "auth.errors" in messages/<lang>.json.
export type AuthError =
  | "invalid_email"
  | "invalid_password"
  | "invalid_displayName"
  | "invalid_role"
  | "invalid_credentials"
  | "email_taken"
  | "rate_limited"
  | "suspended"
  | "unknown";

export function firstError(error: z.ZodError): AuthError {
  const field = error.issues[0]?.path[0];
  return field === "email" || field === "password" || field === "displayName" || field === "role"
    ? `invalid_${field}`
    : "unknown";
}
