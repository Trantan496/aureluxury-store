// Explicitly guarded test-only deployment and regression checks. Never deploys main.
import { parse } from "dotenv";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import pg from "pg";
import { testTarget, assertTestDatabase, fingerprint, reviewedMigrations } from "./test-database-safety.ts";
const confirmation = process.argv.find(a => a.startsWith("--confirm-test-database="))?.split("=")[1];
const config = parse(readFileSync(".env.test")), target = testTarget(config.TEST_DATABASE_URL, confirmation);
reviewedMigrations();
const envBytes = readFileSync(".env"), envHash = createHash("sha256").update(envBytes).digest("hex");
const mainURL = new URL(parse(envBytes).DATABASE_URL); assert.equal(mainURL.pathname, "/aurel_ai");
const main = new pg.Client({ connectionString: mainURL.toString(), options: "-c default_transaction_read_only=on" });
const gate = new pg.Client({ connectionString: target.toString() });
let before: Awaited<ReturnType<typeof fingerprint>> | undefined;
try {
  await main.connect(); await gate.connect(); await assertTestDatabase(sql => gate.query(sql));
  assert.equal((await gate.query("SELECT pg_try_advisory_lock(242024) locked")).rows[0].locked, true);
  before = await fingerprint(main);
  const reviewed = Object.keys(JSON.parse(readFileSync("tests/support/reviewed-migrations.json", "utf8")) as Record<string, string>);
  const applied = (await gate.query('SELECT migration_name,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name')).rows;
  assert.ok(applied.every(m => reviewed.includes(m.migration_name) && m.finished_at && !m.rolled_back_at));
  const pending = reviewed.filter(n => !applied.some(m => m.migration_name === n));
  const staged = ["20261023150000_variant_colour_hex", "20261023090000_complete_look_pending", "20261021120000_product_draft_requests", "20261021110000_image_storage", "20261021100000_product_audience", "20261022160000_product_editor_registry", "20261022161000_product_editor_taxonomy_version"];
  assert.ok(pending.every(name => staged.includes(name)), "Unreviewed pending migration");
  const checksums = (await gate.query('SELECT migration_name,checksum FROM "_prisma_migrations"')).rows;
  // Review manifest hashes LF; Prisma hashes actual bytes (existing Windows SQL may be CRLF).
  assert.ok(checksums.every(m => {
    const lf = readFileSync(`prisma/migrations/${m.migration_name}/migration.sql`, "utf8").replaceAll("\r\n", "\n");
    return [lf, lf.replaceAll("\n", "\r\n")].some(sql => createHash("sha256").update(sql).digest("hex") === m.checksum);
  }), "Applied test migration checksum differs from reviewed SQL");
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", DATABASE_URL: target.toString(), TEST_DATABASE_URL: target.toString(), TEST_DATABASE_CONFIRM: confirmation, BETTER_AUTH_SECRET: config.TEST_AUTH_SECRET, BETTER_AUTH_URL: "http://localhost:3054", RESEND_API_KEY: "", EMAIL_FROM: "" };
  const deployed = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { windowsHide: true, stdio: "inherit", timeout: 90000, env });
  assert.equal(deployed.status, 0, "Test-only migration deployment failed");
  await assertTestDatabase(sql => gate.query(sql));
  const baseline = await fingerprint(gate);
  const result = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "--test", "--test-concurrency=1", "tests/admin-products.integration.test.ts", "tests/product-editor.integration.test.ts", "tests/image-storage.integration.test.ts", "tests/product-showroom.integration.test.ts", "tests/product-pending.integration.test.ts", "tests/product-variants.integration.test.ts"], { windowsHide: true, stdio: "inherit", timeout: 180000, env });
  const after = await fingerprint(gate);
  for (const k of ["data", "schema", "constraints", "indexes", "triggers", "functions", "enums"] as const) assert.deepEqual(after[k], baseline[k], `Test cleanup mismatch: ${k}`);
  assert.equal(result.status, 0, "Product editor regression failed");
  console.log("Twelve reviewed migrations on test only; fixtures cleaned/rolled back; sequences not reset.");
} finally {
  if (before) assert.deepEqual(await fingerprint(main), before, "Main changed during test-only checks");
  await main.end(); await gate.end();
  assert.equal(createHash("sha256").update(readFileSync(".env")).digest("hex"), envHash);
  console.log("Main read-only fingerprint and .env unchanged; no mail sent.");
}
