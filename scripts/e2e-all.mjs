// Runs every end-to-end script in order and stops at the first failure. pnpm test:e2e calls this.
// Order matters: e2e-auth creates the shared test accounts the others sign in with.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const SCRIPTS = ["auth", "connections", "cases", "reports", "plans", "admin", "integration"];

for (const name of SCRIPTS) {
  const file = new URL(`./e2e-${name}.mjs`, import.meta.url);
  if (!existsSync(file)) continue;
  console.log(`\n== e2e-${name}`);
  const { status } = spawnSync(process.execPath, [file.pathname.replace(/^\/([A-Za-z]:)/, "$1")], { stdio: "inherit" });
  if (status !== 0) process.exit(status ?? 1);
}
