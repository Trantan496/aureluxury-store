import { parse } from "dotenv";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import pg from "pg";
import { testTarget, assertTestDatabase, fingerprint } from "./test-database-safety.ts";
const confirmation = process.argv.find(a => a.startsWith("--confirm-test-database="))?.split("=")[1];
const config = parse(readFileSync(".env.test"));
const target = testTarget(config.TEST_DATABASE_URL, confirmation);
const mainConfig = parse(readFileSync(".env")), envHash = createHash("sha256").update(readFileSync(".env")).digest("hex");
const mainURL = new URL(mainConfig.DATABASE_URL); assert.equal(mainURL.pathname, "/aurel_ai");
const main = new pg.Client({ connectionString: mainURL.toString(), options: "-c default_transaction_read_only=on" });
const gate = new pg.Client({ connectionString: target.toString() });
try {
  await main.connect(); await gate.connect(); await assertTestDatabase(sql => gate.query(sql));
  assert.equal((await gate.query("SELECT pg_try_advisory_lock(242024) locked")).rows[0].locked, true);
  const before = await fingerprint(main), baseline = await fingerprint(gate);
  const result = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "--test", "tests/admin-products.integration.test.ts"], { windowsHide: true, stdio: "inherit", timeout: 150000, env: { ...process.env, NODE_ENV: "test", DATABASE_URL: target.toString(), TEST_DATABASE_URL: target.toString(), TEST_DATABASE_CONFIRM: confirmation, BETTER_AUTH_SECRET: config.TEST_AUTH_SECRET, BETTER_AUTH_URL: "http://localhost:3054", RESEND_API_KEY: "", EMAIL_FROM: "" } });
  assert.deepEqual(await fingerprint(main), before, "Main changed during admin integration tests");
  const after = await fingerprint(gate);
  for (const key of ["data", "schema", "constraints", "indexes", "triggers", "functions", "enums"] as const) assert.deepEqual(after[key], baseline[key], "Test fixtures or schema changed outside scope");
  assert.equal(result.status, 0, "Admin integration tests failed");
  console.log("Main fingerprint unchanged; test fixture rows cleaned; sequences intentionally not reset.");
} finally {
  await main.end(); await gate.end();
  assert.equal(createHash("sha256").update(readFileSync(".env")).digest("hex"), envHash);
}
