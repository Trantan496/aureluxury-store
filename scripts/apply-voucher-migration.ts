// Scoped deployment for T02 only. Does not run business tests or pending migrations.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { parse } from "dotenv";
import pg from "pg";
import { reviewedMigrations, fingerprint, testTarget } from "./test-database-safety.ts";

const migration = "20261101170000_checkout_vouchers";
const target = process.argv.includes("--confirm-local=aurel_ai") ? "aurel_ai" : process.argv.includes("--confirm-test=aurel_ai_test") ? "aurel_ai_test" : null;
assert.ok(target, "Pass --confirm-test=aurel_ai_test or --confirm-local=aurel_ai");
reviewedMigrations();
const mainEnv = readFileSync(".env"), envHash = createHash("sha256").update(mainEnv).digest("hex");
const mainURL = new URL(parse(mainEnv).DATABASE_URL);
assert.equal(mainURL.pathname, "/aurel_ai"); assert.ok(["localhost", "127.0.0.1"].includes(mainURL.hostname));
const url = target === "aurel_ai" ? mainURL : testTarget(parse(readFileSync(".env.test")).TEST_DATABASE_URL, "aurel_ai_test");
const sql = readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8").replaceAll("\r\n", "\n");
const checksum = createHash("sha256").update(sql).digest("hex");
const body = sql.replace(/^BEGIN;\s*/, "").replace(/COMMIT;\s*$/, "");
const db = new pg.Client({ connectionString: url.toString(), options: "-c timezone=UTC" });
const maintenanceURL = new URL(mainURL); maintenanceURL.pathname = "/postgres";
const maintenance = new pg.Client({ connectionString: maintenanceURL.toString() });
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
async function originalData(client: pg.Client, baseline: Awaited<ReturnType<typeof fingerprint>>) {
  const data: Record<string, unknown> = {};
  for (const table of Object.keys(baseline.data).filter(name => name !== "_prisma_migrations")) {
    const columns = baseline.schema.filter(col => col.table_name === table).map(col => quote(col.column_name)).join(",");
    data[table] = (await client.query(`SELECT count(*)::int count,md5(COALESCE(string_agg(x::text,'|' ORDER BY x::text),'')) digest FROM (SELECT to_jsonb(q) x FROM (SELECT ${columns} FROM ${quote(table)}) q) t`)).rows[0];
  }
  return data;
}
async function apply(client: pg.Client) {
  const baseline = await fingerprint(client);
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout = '3s'; SET LOCAL statement_timeout = '30s'");
    // Block concurrent edits only during the short DDL transaction and preservation check.
    const tables = Object.keys(baseline.data).filter(name => name !== "_prisma_migrations").map(quote).join(",");
    await client.query(`LOCK TABLE ${tables} IN SHARE ROW EXCLUSIVE MODE`);
    const before = await originalData(client, baseline);
    await client.query(body);
    await client.query('INSERT INTO "_prisma_migrations" (id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES ($1,$2,NOW(),$3,NOW(),1)', [randomUUID(), checksum, migration]);
    assert.deepEqual(await originalData(client, baseline), before, "Original columns/rows changed; rolling back");
    const result = await client.query('SELECT count(*)::int n FROM "Voucher"'); assert.equal(result.rows[0].n, 0);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
}
function dump(url: URL, file: string) {
  const result = spawnSync(resolve(".local/postgres/pgsql/bin/pg_dump.exe"), ["-h", url.hostname, "-p", url.port || "5432", "-U", decodeURIComponent(url.username), "-d", target!, "-Fc", "-f", file], { windowsHide: true, stdio: "pipe", env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) }, timeout: 120000 });
  assert.equal(result.status, 0, "Backup failed; no schema changes applied"); assert.ok(statSync(file).size > 1000);
}
try {
  await db.connect(); assert.equal((await db.query("SELECT current_database() n")).rows[0].n, target);
  assert.equal((await db.query("SELECT pg_try_advisory_lock(20261102) ok")).rows[0].ok, true);
  const prior = await db.query('SELECT checksum,finished_at,rolled_back_at FROM "_prisma_migrations" WHERE migration_name=$1', [migration]);
  if (prior.rowCount) {
    assert.equal(prior.rows[0].checksum, checksum); assert.ok(prior.rows[0].finished_at && !prior.rows[0].rolled_back_at);
    console.log(`Voucher migration already applied on ${target}; nothing changed.`);
  } else {
    for (const name of ["20261020160500_multi_currency", "20261020170000_order_revision"]) assert.equal((await db.query('SELECT count(*)::int n FROM "_prisma_migrations" WHERE migration_name=$1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL', [name])).rows[0].n, 1);
    mkdirSync(".local/backups", { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14), suffix = randomBytes(3).toString("hex");
    const archive = resolve(`.local/backups/${target}-before-vouchers-${stamp}-${suffix}.dump`);
    const baseline = await fingerprint(db); dump(url, archive);
    let restoreName: string | null = null;
    if (target === "aurel_ai") {
      await maintenance.connect();
      restoreName = `aurel_ai_restore_test_${stamp}_${suffix}`;
      await maintenance.query(`CREATE DATABASE ${quote(restoreName)}`);
      const restoreURL = new URL(mainURL); restoreURL.pathname = "/" + restoreName;
      const restore = spawnSync(resolve(".local/postgres/pgsql/bin/pg_restore.exe"), ["-h", mainURL.hostname, "-p", mainURL.port || "5432", "-U", decodeURIComponent(mainURL.username), "--no-owner", "--no-privileges", "--exit-on-error", "-d", restoreName, archive], { windowsHide: true, stdio: "pipe", env: { ...process.env, PGPASSWORD: decodeURIComponent(mainURL.password) }, timeout: 120000 });
      assert.equal(restore.status, 0, "Restore failed; main untouched");
      const restored = new pg.Client({ connectionString: restoreURL.toString(), options: "-c timezone=UTC" });
      await restored.connect();
      try { assert.deepEqual(await fingerprint(restored), baseline, "Backup differs from source"); await apply(restored); }
      finally { await restored.end(); }
    }
    assert.deepEqual(await fingerprint(db), baseline, "Database changed since backup; rerun with a fresh backup");
    await apply(db);
    const report = { target, migration, checksum, archive, verifiedRestore: restoreName, originalRowsPreserved: true, onlyThisMigrationApplied: true, businessTestsRun: 0, at: new Date().toISOString() };
    writeFileSync(`.local/backups/voucher-migration-${target}.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  }
} finally {
  await db.end(); await maintenance.end();
  assert.equal(createHash("sha256").update(readFileSync(".env")).digest("hex"), envHash);
}
