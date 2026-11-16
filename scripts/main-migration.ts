// Explicit Phase 2.9.2 operator command. Never used by the web runtime.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { parse } from "dotenv";
import pg from "pg";
import { fingerprint, reviewedMigrations } from "./test-database-safety.ts";

const restore = process.argv[2];
assert.match(restore ?? "", /^aurel_ai_restore_test_\d{14}_[a-f0-9]{6}$/);
assert.equal(process.argv[3], "--confirm-main=aurel_ai");
reviewedMigrations();
const hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const envHash = hash(readFileSync(".env"));
const mainURL = new URL(parse(readFileSync(".env")).DATABASE_URL);
assert.equal(mainURL.pathname, "/aurel_ai");
assert.ok(["localhost", "127.0.0.1"].includes(mainURL.hostname));
const testURL = new URL(parse(readFileSync(".env.test")).TEST_DATABASE_URL);
assert.equal(testURL.username, "aurel_ai_test_runner");
const restoreURL = new URL(testURL); restoreURL.pathname = "/" + restore;
const maintenanceURL = new URL(mainURL); maintenanceURL.pathname = "/postgres";
const main = new pg.Client({ connectionString: mainURL.toString(), options: "-c timezone=UTC -c lock_timeout=3s -c statement_timeout=30s" });
const restored = new pg.Client({ connectionString: restoreURL.toString(), options: "-c timezone=UTC" });
const maintenance = new pg.Client({ connectionString: maintenanceURL.toString() });
const manifest = JSON.parse(readFileSync("tests/support/reviewed-migrations.json", "utf8")) as Record<string, string>;
const names = Object.keys(manifest).sort();
const sql = (name: string) => readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8");
function cli(url: URL, args: string[]) {
  const bounded = new URL(url); bounded.searchParams.set("options", "-c lock_timeout=3s -c statement_timeout=30s");
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], {
    env: { ...process.env, DATABASE_URL: bounded.toString() }, windowsHide: true, encoding: "utf8", timeout: 180000,
  });
  assert.equal(result.status, 0, `Prisma ${args.join(" ")} failed; stop and inspect safely`);
}
async function history(db: pg.Client) {
  const rows = (await db.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name')).rows;
  for (const row of rows) {
    assert.ok(row.finished_at && !row.rolled_back_at, "Unresolved migration history");
    assert.equal(row.checksum, hash(sql(row.migration_name)), "Migration checksum conflict");
  }
  return rows.map(r => r.migration_name) as string[];
}
const structural = (v: Awaited<ReturnType<typeof fingerprint>>) => ({ schema: v.schema.filter(r => r.table_name !== "_prisma_migrations"), constraints: v.constraints.filter(r => r.table_name !== '"_prisma_migrations"' && r.table_name !== "_prisma_migrations"), indexes: v.indexes.filter(r => r.tablename !== "_prisma_migrations"), triggers: v.triggers, functions: v.functions, enums: v.enums });
// Compare original columns only: additive migrations must preserve every existing value.
async function oldRows(db: pg.Client, baseline: Awaited<ReturnType<typeof fingerprint>>) {
  const result: Record<string, unknown> = {};
  for (const table of Object.keys(baseline.data).filter(t => t !== "_prisma_migrations")) {
    const cols = baseline.schema.filter(c => c.table_name === table).map(c => '"' + c.column_name + '"').join(",");
    result[table] = (await db.query(`SELECT count(*)::int AS count, md5(COALESCE(string_agg(x::text,'|' ORDER BY x::text),'')) AS digest FROM (SELECT to_jsonb(q) x FROM (SELECT ${cols} FROM "${table}") q) t`)).rows[0];
  }
  return result;
}
try {
  await main.connect(); await restored.connect(); await maintenance.connect();
  assert.equal((await main.query("SELECT current_database() name")).rows[0].name, "aurel_ai");
  assert.equal((await restored.query("SELECT current_database() name")).rows[0].name, restore);
  assert.equal((await main.query("SELECT pg_try_advisory_lock(292021) locked")).rows[0].locked, true);
  const before = await fingerprint(main);
  const verified = JSON.parse(readFileSync(`.local/backups/${restore}.dump.verified.json`, "utf8"));
  assert.equal(verified.schemaAndDataMatch, true);
  assert.equal(verified.archiveSHA256, hash(readFileSync(`.local/backups/${restore}.dump`)));
  assert.equal(verified.sourceFingerprintSHA256, hash(JSON.stringify(before)));
  assert.deepEqual(await fingerprint(restored), before);
  const applied = await history(main);
  assert.deepEqual(applied, names.slice(0, 2), "Expected exactly the two existing main migrations");
  const expectedName = "aurel_ai_drift_" + randomBytes(6).toString("hex");
  assert.match(expectedName, /^aurel_ai_drift_[a-f0-9]{12}$/);
  await maintenance.query(`CREATE DATABASE "${expectedName}" OWNER "aurel_ai_test_runner"`);
  const expectedURL = new URL(testURL); expectedURL.pathname = "/" + expectedName;
  const expected = new pg.Client({ connectionString: expectedURL.toString() });
  await expected.connect();
  try {
    for (const name of applied) await expected.query(sql(name));
    assert.deepEqual(structural(before), structural(await fingerprint(expected)), "Schema drift: stop before main migration");
    const originalRows = await oldRows(main, before);
    cli(restoreURL, ["migrate", "deploy"]);
    assert.deepEqual(await history(restored), names);
    assert.deepEqual(await oldRows(restored, before), originalRows);
    for (const name of names.slice(applied.length)) await expected.query(sql(name));
    const expectedStructure = structural(await fingerprint(expected));
    assert.deepEqual(structural(await fingerprint(restored)), expectedStructure);
    cli(restoreURL, ["migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code"]);
    assert.deepEqual(await fingerprint(main), before, "Source changed during rehearsal");
    console.log("Preflight passed: checksums, no drift, verified backup, rehearsal, original data preserved.");
    cli(mainURL, ["migrate", "deploy"]);
    assert.deepEqual(await history(main), names);
    const after = await fingerprint(main);
    assert.deepEqual(structural(after), expectedStructure);
    assert.deepEqual(await oldRows(main, before), originalRows);
    for (const [name, state] of Object.entries(before.sequences)) assert.deepEqual(after.sequences[name], state);
    cli(mainURL, ["migrate", "status"]);
    cli(mainURL, ["migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code"]);
    const admins = (await main.query('SELECT count(*)::int n FROM "User" WHERE role=\'ADMIN\'')).rows[0].n;
    const report = { at: new Date().toISOString(), database: "aurel_ai", backup: restore, backupSHA256: verified.archiveSHA256, preflightDriftFree: true, rehearsalPassed: true, originalDataPreserved: true, originalSequencesPreserved: true, applied: names.slice(2), history: names, adminCount: admins, countsBefore: Object.fromEntries(Object.entries(before.data).map(([t, r]) => [t, r.count])), countsAfter: Object.fromEntries(Object.entries(after.data).map(([t, r]) => [t, r.count])), envUnchanged: hash(readFileSync(".env")) === envHash };
    writeFileSync(`.local/backups/${restore}.main-migration.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await expected.end(); }
} finally {
  await main.end(); await restored.end(); await maintenance.end();
  assert.equal(hash(readFileSync(".env")), envHash);
}
