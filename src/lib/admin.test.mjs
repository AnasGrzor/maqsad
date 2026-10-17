// Run with: pnpm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { actionKey, AUDIT_ACTIONS, likePattern, searchTerm } from "./admin.ts";

test("likePattern escapes LIKE wildcards and backslashes", () => {
  assert.equal(likePattern("Sara"), "%Sara%");
  assert.equal(likePattern("100%_x\\"), "%100\\%\\_x\\\\%");
});

test("searchTerm trims, bounds and drops empty or repeated values", () => {
  assert.equal(searchTerm("  Ali "), "Ali");
  assert.equal(searchTerm("   "), undefined);
  assert.equal(searchTerm(["a", "b"]), undefined);
  assert.equal(searchTerm("x".repeat(200)).length, 80);
});

test("every audit action has a label in both languages", () => {
  for (const lang of ["en", "ur"]) {
    const labels = JSON.parse(readFileSync(new URL(`../../messages/${lang}/m6.json`, import.meta.url))).adminAudit.actions;
    for (const a of AUDIT_ACTIONS) assert.ok(labels[actionKey(a)], `${lang}: ${a}`);
  }
});
