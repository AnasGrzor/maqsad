// Run with: pnpm test (Node strips the TypeScript types from auth-schema.ts)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { firstError, Profile, SignIn, SignUp } from "./auth-schema.ts";

const valid = { email: "a@example.com", password: "longenough", displayName: " Sara ", role: "student" };

test("sign-up accepts student and agent and trims the name", () => {
  assert.equal(SignUp.parse(valid).displayName, "Sara");
  assert.equal(SignUp.parse({ ...valid, role: "agent" }).role, "agent");
});

test("sign-up never accepts admin or an unknown role", () => {
  for (const role of ["admin", "Admin", "", undefined]) {
    const r = SignUp.safeParse({ ...valid, role });
    assert.equal(r.success, false);
    assert.equal(firstError(r.error), "invalid_role");
  }
});

test("sign-up reports the first bad field as a message key", () => {
  assert.equal(firstError(SignUp.safeParse({ ...valid, email: "nope" }).error), "invalid_email");
  assert.equal(firstError(SignUp.safeParse({ ...valid, password: "short" }).error), "invalid_password");
  assert.equal(firstError(SignUp.safeParse({ ...valid, password: "x".repeat(73) }).error), "invalid_password");
  assert.equal(firstError(SignUp.safeParse({ ...valid, displayName: "   " }).error), "invalid_displayName");
});

test("sign-in and profile validation", () => {
  assert.equal(SignIn.safeParse({ email: "a@example.com", password: "" }).success, false);
  assert.equal(Profile.safeParse({ displayName: "x".repeat(81) }).success, false);
  assert.equal(Profile.parse({ displayName: "Ali" }).displayName, "Ali");
});

test("every auth error code has an English and Urdu message", () => {
  const codes = ["invalid_email", "invalid_password", "invalid_displayName", "invalid_role", "invalid_credentials", "email_taken", "rate_limited", "suspended", "unknown"];
  for (const lang of ["en", "ur"]) {
    const errors = JSON.parse(readFileSync(new URL(`../../messages/${lang}.json`, import.meta.url))).auth.errors;
    for (const c of codes) assert.ok(errors[c], `${lang} is missing auth.errors.${c}`);
  }
});

test("en.json and ur.json have the same keys", () => {
  const keys = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
  const load = (lang) => keys(JSON.parse(readFileSync(new URL(`../../messages/${lang}.json`, import.meta.url)))).sort();
  assert.deepEqual(load("ur"), load("en"));
});
