// Explicit operator command for the owner-authorized Complete the Look migration only.
// The two unrelated taxonomy-registry migrations remain pending on main.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { parse } from "dotenv";
import pg from "pg";
import { reviewedMigrations, fingerprint } from "./test-database-safety.ts";
const migration = "20261023090000_complete_look_pending";
const restoreName = process.argv[2];
assert.match(restoreName ?? "", /^aurel_ai_restore_test_\d{14}_[a-f0-9]{6}$/);
const rehearsalOnly = process.argv[3] === "--rehearsal-only";
assert.ok(rehearsalOnly || process.argv[3] === "--confirm-main=aurel_ai"); reviewedMigrations();
const hash = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const envHash = hash(readFileSync(".env")), mainURL = new URL(parse(readFileSync(".env")).DATABASE_URL);
assert.equal(mainURL.pathname, "/aurel_ai"); assert.ok(["localhost", "127.0.0.1"].includes(mainURL.hostname));
const testURL = new URL(parse(readFileSync(".env.test")).TEST_DATABASE_URL); assert.equal(testURL.username, "aurel_ai_test_runner");
const restoreURL = new URL(testURL); restoreURL.pathname = "/" + restoreName;
const maintenanceURL = new URL(mainURL); maintenanceURL.pathname = "/postgres";
const main = new pg.Client({ connectionString: mainURL.toString(), options: "-c timezone=UTC" });
const restored = new pg.Client({ connectionString: restoreURL.toString(), options: "-c timezone=UTC" });
const maintenance = new pg.Client({ connectionString: maintenanceURL.toString() });
const manifest = JSON.parse(readFileSync("tests/support/reviewed-migrations.json", "utf8")) as Record<string, string>;
const selected = Object.keys(manifest).sort().filter(n => !["20261022160000_product_editor_registry", "20261022161000_product_editor_taxonomy_version"].includes(n));
assert.equal(selected.length, 9); assert.equal(selected.at(-1), migration);
const folder = "look-" + randomBytes(5).toString("hex");
const config = `.local/${folder}.config.ts`;
mkdirSync(`.local/${folder}/migrations`, { recursive: true });
for (const name of selected) { mkdirSync(`.local/${folder}/migrations/${name}`); copyFileSync(`prisma/migrations/${name}/migration.sql`, `.local/${folder}/migrations/${name}/migration.sql`); }
copyFileSync("prisma/migrations/migration_lock.toml", `.local/${folder}/migrations/migration_lock.toml`);
writeFileSync(config, `import {defineConfig,env} from 'prisma/config';\nexport default defineConfig({schema:'../prisma/schema.prisma',migrations:{path:'./${folder}/migrations'},datasource:{url:env('DATABASE_URL')}});\n`);
const structure = (v: Awaited<ReturnType<typeof fingerprint>>) => ({ schema: v.schema.filter(r => r.table_name !== "_prisma_migrations"), constraints: v.constraints.filter(r => !String(r.table_name).includes("_prisma_migrations")), indexes: v.indexes.filter(r => r.tablename !== "_prisma_migrations"), triggers: v.triggers, functions: v.functions, enums: v.enums });
async function history(db: pg.Client) {
  const rows = (await db.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name')).rows;
  for (const row of rows) { assert.ok(row.finished_at && !row.rolled_back_at); assert.equal(row.checksum, hash(readFileSync(`prisma/migrations/${row.migration_name}/migration.sql`))); }
  return rows.map(r => r.migration_name);
}
async function oldRows(db: pg.Client, baseline: Awaited<ReturnType<typeof fingerprint>>) {
  const rows: Record<string, unknown> = {};
  for (const table of Object.keys(baseline.data).filter(t => t !== "_prisma_migrations")) {
    const cols = baseline.schema.filter(c => c.table_name === table).map(c => '"' + c.column_name + '"').join(",");
    rows[table] = (await db.query(`SELECT count(*)::int n,md5(COALESCE(string_agg(x::text,'|' ORDER BY x::text),'')) digest FROM (SELECT to_jsonb(q) x FROM (SELECT ${cols} FROM "${table}") q) t`)).rows[0];
  }
  return rows;
}
function deploy(url: URL) {
  const bounded = new URL(url); bounded.searchParams.set("options", "-c lock_timeout=3s -c statement_timeout=30s");
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", config], { windowsHide: true, encoding: "utf8", timeout: 120000, env: { ...process.env, DATABASE_URL: bounded.toString() } });
  assert.equal(result.status, 0, "Scoped Prisma deployment failed; stop and inspect private logs");
}
try {
  await main.connect(); await restored.connect(); await maintenance.connect();
  assert.equal((await main.query("SELECT current_database() n")).rows[0].n, "aurel_ai");
  assert.equal((await restored.query("SELECT current_database() n,current_user r")).rows[0].n, restoreName);
  assert.equal((await main.query("SELECT pg_try_advisory_lock(292023) locked")).rows[0].locked, true);
  const before = await fingerprint(main), verified = JSON.parse(readFileSync(`.local/backups/${restoreName}.dump.verified.json`, "utf8"));
  assert.equal(verified.schemaAndDataMatch, true); assert.equal(verified.archiveSHA256, hash(readFileSync(`.local/backups/${restoreName}.dump`)));
  assert.equal(verified.sourceFingerprintSHA256, hash(JSON.stringify(before))); assert.deepEqual(await fingerprint(restored), before);
  assert.deepEqual(await history(main), selected.slice(0, -1), "Main must have exactly eight reviewed main migrations");
  const expectedName = "aurel_ai_drift_" + randomBytes(6).toString("hex");
  await maintenance.query(`CREATE DATABASE "${expectedName}" OWNER "aurel_ai_test_runner"`);
  const expectedURL = new URL(testURL); expectedURL.pathname = "/" + expectedName;
  const expected = new pg.Client({ connectionString: expectedURL.toString(), options: "-c timezone=UTC" }); await expected.connect();
  try {
    for (const name of selected.slice(0, -1)) await expected.query(readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"));
    assert.deepEqual(structure(await fingerprint(expected)), structure(before), "Existing main schema drift");
    const original = await oldRows(main, before);
    deploy(restoreURL); assert.deepEqual(await history(restored), selected); assert.deepEqual(await oldRows(restored, before), original);
    await expected.query(readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"));
    const target = structure(await fingerprint(expected)); assert.deepEqual(structure(await fingerprint(restored)), target);
    assert.deepEqual(await fingerprint(main), before, "Main changed during rehearsal");
    if (rehearsalOnly) {
      const report = { database:"aurel_ai", migration, backup:restoreName, backupSHA256:verified.archiveSHA256, noDrift:true, rehearsalPassed:true, mainUnchanged:JSON.stringify(await fingerprint(main)) === JSON.stringify(before), pendingApproval:true };
      writeFileSync(`.local/backups/${restoreName}.look-rehearsal.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
    } else {
      console.log("Verified backup, independent no-drift check and rehearsal passed; deploying approved Complete the Look intake table only.");
      deploy(mainURL); assert.deepEqual(await history(main), selected);
      const after = await fingerprint(main); assert.deepEqual(structure(after), target); assert.deepEqual(await oldRows(main, before), original); assert.deepEqual(Object.fromEntries(Object.entries(after.sequences).filter(([name]) => name !== "PendingProduct_id_seq")), before.sequences);
      assert.deepEqual(after.sequences.PendingProduct_id_seq, { last_value: "1", is_called: false });
      assert.equal((await main.query('SELECT count(*)::int n FROM "PendingProduct"')).rows[0].n, 0, "No workflow fixture/backfill on main");
      const report = { database:"aurel_ai",migration,backup:restoreName,backupSHA256:verified.archiveSHA256,noDrift:true,rehearsalPassed:true,originalRowsPreserved:true,originalSequencesPreserved:true,pendingProductTableCreated:true,appliedCount:selected.length,unrelatedPending:Object.keys(manifest).filter(n=>!selected.includes(n)),envUnchanged:hash(readFileSync(".env")) === envHash };
      writeFileSync(`.local/backups/${restoreName}.look-migration.json`,JSON.stringify(report,null,2)); console.log(JSON.stringify(report,null,2));
    }

  } finally { await expected.end(); }
} finally { await main.end(); await restored.end(); await maintenance.end(); assert.equal(hash(readFileSync(".env")), envHash); }
