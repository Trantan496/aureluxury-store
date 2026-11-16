// Owner-authorized live payment setup; scoped to this additive migration only.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { parse } from "dotenv";
import pg from "pg";
import { fingerprint } from "./test-database-safety.ts";

assert.ok(process.argv.includes("--confirm-local=aurel_ai"), "Explicit target confirmation required");
const migration = "20261102150000_payos_payments";
const envBytes = readFileSync(".env"), envHash = createHash("sha256").update(envBytes).digest("hex");
const url = new URL(parse(envBytes).DATABASE_URL);
assert.equal(url.pathname, "/aurel_ai"); assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
const sql = readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8");
const checksum = createHash("sha256").update(sql).digest("hex");
assert.ok(sql.startsWith("BEGIN;")); assert.ok(sql.trimEnd().endsWith("COMMIT;"));
const body = sql.replace(/^BEGIN;\s*/, "").replace(/COMMIT;\s*$/, "");
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
const db = new pg.Client({ connectionString: url.toString() });
const adminURL = new URL(url); adminURL.pathname = "/postgres";
const maintenance = new pg.Client({ connectionString: adminURL.toString() });
type Fingerprint = Awaited<ReturnType<typeof fingerprint>>;
function oldState(current: Fingerprint, baseline: Fingerprint) {
  const tables = new Set(Object.keys(baseline.data));
  return { data: Object.fromEntries(Object.entries(current.data).filter(([name]) => tables.has(name) && name !== "_prisma_migrations")),
    schema: current.schema.filter(row => tables.has(row.table_name)), constraints: current.constraints.filter(row => tables.has(row.table_name)),
    indexes: current.indexes.filter(row => tables.has(row.tablename)), sequences: Object.fromEntries(Object.entries(current.sequences).filter(([name]) => name in baseline.sequences)),
    triggers: current.triggers, functions: current.functions, enums: current.enums };
}
async function apply(client: pg.Client) {
  const before = await fingerprint(client);
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s'");
    await client.query(`LOCK TABLE ${Object.keys(before.data).map(quote).join(",")} IN SHARE ROW EXCLUSIVE MODE`);
    const lockedBefore = await fingerprint(client);
    await client.query(body);
    await client.query('INSERT INTO "_prisma_migrations" (id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES ($1,$2,NOW(),$3,NOW(),1)', [randomUUID(), checksum, migration]);
    const appRole = await client.query("SELECT rolname FROM pg_roles WHERE rolname='aurel_app' AND NOT rolsuper");
    if (appRole.rowCount) await client.query('GRANT SELECT,INSERT,UPDATE ON public."OnlinePayment",public."PaymentAttempt" TO aurel_app; GRANT SELECT,INSERT ON public."PaymentReceipt" TO aurel_app; GRANT USAGE,SELECT ON SEQUENCE public."PaymentAttempt_orderCode_seq" TO aurel_app');
    const after = await fingerprint(client);
    assert.deepEqual(oldState(after, lockedBefore), oldState(lockedBefore, lockedBefore), "Original data/schema changed; rollback");
    for (const table of ["OnlinePayment", "PaymentAttempt", "PaymentReceipt"]) assert.equal(after.data[table].count, 0);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
}
function binary(name: string, args: string[]) {
  const result = spawnSync(resolve(`.local/postgres/pgsql/bin/${name}.exe`), args, { windowsHide: true, stdio: "pipe", env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) }, timeout: 120000 });
  assert.equal(result.status, 0, `${name} failed; main migration not applied`);
}
try {
  await db.connect(); assert.equal((await db.query("SELECT current_database() name")).rows[0].name, "aurel_ai");
  assert.equal((await db.query("SELECT pg_try_advisory_lock(2026110215) ok")).rows[0].ok, true);
  const prior = await db.query('SELECT checksum,finished_at,rolled_back_at FROM "_prisma_migrations" WHERE migration_name=$1', [migration]);
  if (prior.rowCount) { assert.equal(prior.rows[0].checksum, checksum); assert.ok(prior.rows[0].finished_at && !prior.rows[0].rolled_back_at); console.log("payOS migration already applied; no change."); }
  else {
    for (const table of ["OnlinePayment", "PaymentAttempt", "PaymentReceipt"]) assert.equal((await db.query("SELECT to_regclass($1) object", ['public.' + quote(table)])).rows[0].object, null);
    const baseline = await fingerprint(db);
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14), suffix = randomBytes(3).toString("hex");
    mkdirSync(".local/backups", { recursive: true });
    const archive = resolve(`.local/backups/aurel_ai-before-payos-${stamp}-${suffix}.dump`);
    console.log("Backing up main database before payOS migration...");
    binary("pg_dump", ["-h", url.hostname, "-p", url.port || "5432", "-U", decodeURIComponent(url.username), "-d", "aurel_ai", "-Fc", "-f", archive]);
    assert.ok(statSync(archive).size > 1000);
    await maintenance.connect();
    const restoreName = `aurel_ai_restore_test_payos_${stamp}_${suffix}`;
    await maintenance.query(`CREATE DATABASE ${quote(restoreName)}`);
    console.log("Verifying restore and rehearsing only the payOS migration...");
    binary("pg_restore", ["-h", url.hostname, "-p", url.port || "5432", "-U", decodeURIComponent(url.username), "--no-owner", "--no-privileges", "--exit-on-error", "-d", restoreName, archive]);
    const restoreURL = new URL(url); restoreURL.pathname = "/" + restoreName;
    const restored = new pg.Client({ connectionString: restoreURL.toString() }); await restored.connect();
    try { assert.deepEqual(await fingerprint(restored), baseline, "Restore preservation check failed"); await apply(restored); }
    finally { await restored.end(); }
    assert.deepEqual(await fingerprint(db), baseline, "Main changed after backup; require a fresh backup");
    console.log("Restore verified. Applying scoped additive payOS migration to main...");
    await apply(db);
    const report = { migration, checksum, archive, verifiedRestore: restoreName, oldRowsAndSchemaPreserved: true, onlyPayosMigrationApplied: true, at: new Date().toISOString() };
    writeFileSync(".local/backups/payos-migration-main.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  }
} finally {
  await db.end(); await maintenance.end();
  assert.equal(createHash("sha256").update(readFileSync(".env")).digest("hex"), envHash, "Environment changed during migration");
}
