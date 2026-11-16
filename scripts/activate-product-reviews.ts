import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { parse } from "dotenv";
import pg from "pg";
import { fingerprint } from "./test-database-safety.ts";

// Scoped activation only: never deploy unrelated pending migrations.
assert(process.argv.includes("--confirm-database=aurel_ai"));
const url = new URL(parse(readFileSync(".env")).DATABASE_URL);
assert(["localhost", "127.0.0.1"].includes(url.hostname));
assert.equal(url.pathname, "/aurel_ai");
const commentsOnly = process.argv.includes("--comments");
const discussion = process.argv.includes("--discussion");
const openRatings = process.argv.includes("--open-ratings");
assert([commentsOnly, discussion, openRatings].filter(Boolean).length <= 1, "Choose one scoped migration");
const migration = openRatings ? "20261114020000_open_account_ratings" : discussion ? "20261114010000_product_discussion" : commentsOnly ? "20261113123000_public_product_comments" : "20261113211500_product_reviews";
const sql = readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8");
const checksum = createHash("sha256").update(sql).digest("hex");
const restoreName = `aurel_ai_reviews_restore_${Date.now()}_${randomBytes(3).toString("hex")}`;
mkdirSync(".local/backups", { recursive: true });
const archive = resolve(`.local/backups/${restoreName}.dump`);
function command(name: string, args: string[], target: URL) {
  const env = { ...process.env };
  for (const key of ["PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE", "PGOPTIONS"]) delete env[key];
  Object.assign(env, { PGHOST: target.hostname, PGPORT: target.port || "5432", PGUSER: decodeURIComponent(target.username), PGPASSWORD: decodeURIComponent(target.password), PGDATABASE: target.pathname.slice(1), PGOPTIONS: "-c timezone=UTC" });
  const result = spawnSync(resolve(`.local/postgres/pgsql/bin/${name}.exe`), args, { env, windowsHide: true, encoding: "utf8", timeout: 180000 });
  // Do not print server errors, which may contain customer data.
  assert(!result.error && result.status === 0, `${name} failed; activation stopped`);
}
const source = new pg.Client({ connectionString: url.toString(), options: "-c timezone=UTC" });
let restored: pg.Client | undefined;
try {
  await source.connect();
  assert.equal((await source.query("SELECT current_database() AS name")).rows[0].name, "aurel_ai");
  const targetTable = discussion ? 'public."ProductDiscussion"' : commentsOnly ? 'public."ProductComment"' : 'public."ProductReview"';
  if (openRatings) {
    assert.equal((await source.query(`SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='ProductReview' AND column_name='orderItemId'`)).rows[0]?.is_nullable, "NO", "Open ratings already applied or schema missing");
  } else assert.equal((await source.query("SELECT to_regclass($1) AS name", [targetTable])).rows[0].name, null, "Target already exists; refusing repeat activation");
  const before = await fingerprint(source);
  command("pg_dump", ["--format=custom", "--file", archive], url);
  await source.query(`CREATE DATABASE "${restoreName}"`);
  const restoreUrl = new URL(url); restoreUrl.pathname = `/${restoreName}`;
  command("pg_restore", ["--exit-on-error", "--single-transaction", "--no-owner", "--no-privileges", "--dbname", restoreName, archive], restoreUrl);
  restored = new pg.Client({ connectionString: restoreUrl.toString(), options: "-c timezone=UTC" });
  await restored.connect();
  assert.deepEqual(await fingerprint(restored), before, "Backup restore mismatch");
  await restored.query(sql);
  const rehearsal = await fingerprint(restored);
  for (const [table, value] of Object.entries(before.data)) assert.deepEqual(rehearsal.data[table], value);
  assert.deepEqual(await fingerprint(source), before, "Source changed; take a fresh backup");
  // Include metadata in the same transaction as the reviewed DDL.
  await source.query("BEGIN");
  try {
    await source.query(sql.replace(/^BEGIN;\s*/, "").replace(/COMMIT;\s*$/, ""));
    await source.query(`INSERT INTO "_prisma_migrations" (id,checksum,finished_at,migration_name,applied_steps_count) VALUES ($1,$2,now(),$3,1)`, [crypto.randomUUID(), checksum, migration]);
    await source.query("COMMIT");
  } catch (error) { await source.query("ROLLBACK"); throw error; }
  const after = await fingerprint(source);
  // Compare all legacy rows/sequences; migration metadata is intentionally new.
  for (const [table, value] of Object.entries(before.data)) if (table !== "_prisma_migrations") assert.deepEqual(after.data[table], value);
  for (const [sequence, value] of Object.entries(before.sequences)) assert.deepEqual(after.sequences[sequence], value);
  assert.deepEqual(after.schema, rehearsal.schema);
  assert.deepEqual(after.constraints, rehearsal.constraints);
  assert.deepEqual(after.indexes, rehearsal.indexes);
  assert.deepEqual(after.triggers, rehearsal.triggers);
  assert.deepEqual(after.functions, rehearsal.functions);
  writeFileSync(`${archive}.verified.json`, JSON.stringify({ migration, checksum, restoreName, verifiedAt: new Date().toISOString(), backupRestored: true, rehearsalPassed: true, legacyRowsAndSequencesUnchanged: true, activated: true }, null, 2));
  console.log("Reviews activated; backup restore/rehearsal verified; legacy data unchanged.");
} finally { await restored?.end(); await source.end(); }
