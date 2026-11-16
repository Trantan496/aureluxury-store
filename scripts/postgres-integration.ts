import { prepareLegacyRehearsal, verifyLegacyRehearsal } from "./multi-currency-rehearsal.ts";
import { parse } from "dotenv";
import pg from "pg";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { assertTestDatabase, fingerprint, reviewedMigrations, testDatabase, testRole, testTarget } from "./test-database-safety.ts";

const action = process.argv[2];
const confirmation = process.argv.find(value => value.startsWith("--confirm-test-database="))?.split("=")[1];
const local = parse(readFileSync(".env"));
const mainURL = new URL(local.DATABASE_URL);
const envHash = createHash("sha256").update(readFileSync(".env")).digest("hex");
let admin: pg.Client | undefined;
let source: pg.Client | undefined;

function command(file: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(file, args, { env, windowsHide: true, stdio: "inherit", timeout: 180000 });
  if (result.status !== 0 || result.error) throw new Error("Integration command failed; subsequent steps were stopped.");
}
async function maintenance() {
  const url = new URL(mainURL); url.pathname = "/postgres"; url.search = "";
  const client = new pg.Client({ connectionString: url.toString() }); await client.connect();
  assert.equal((await client.query("SELECT current_database() AS name")).rows[0].name, "postgres");
  return client;
}
async function sourceClient() {
  assert.equal(decodeURIComponent(mainURL.pathname.slice(1)), "aurel_ai");
  const client = new pg.Client({ connectionString: mainURL.toString(), options: "-c default_transaction_read_only=on -c timezone=UTC" });
  await client.connect(); return client;
}
function pgEnvironment(url: URL): NodeJS.ProcessEnv {
  const inherited = { ...process.env };
  for (const key of ["PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE", "PGOPTIONS"]) delete inherited[key];
  return { ...inherited, PGHOST: url.hostname.replace(/^\[|\]$/g, ""), PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGOPTIONS: "-c timezone=UTC" };
}

try {
  if (!["setup", "run", "backup"].includes(action) || confirmation !== testDatabase) throw new Error("Use setup|run|backup --confirm-test-database=aurel_ai_test.");
  reviewedMigrations();
  if (action === "setup") {
    // Credentials are independent of DATABASE_URL. Never rotate a pre-existing role implicitly.
    const existing = existsSync(".env.test") ? parse(readFileSync(".env.test")) : null;
    const url = new URL(mainURL); url.username = testRole; url.password = randomBytes(36).toString("base64url"); url.pathname = "/" + testDatabase; url.search = "?schema=public";
    const target = testTarget(existing?.TEST_DATABASE_URL ?? url.toString(), confirmation);
    admin = await maintenance();
    const role = (await admin.query("SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolreplication FROM pg_roles WHERE rolname=$1", [testRole])).rows[0];
    if (!role) {
      if (existing) throw new Error("Test role is missing; inspect the existing test configuration manually.");
      // Fixed identifiers; random base64url password contains no SQL metacharacters.
      await admin.query(`CREATE ROLE "${testRole}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${decodeURIComponent(target.password)}'`);
    } else {
      if (!existing || role.rolsuper || role.rolcreatedb || role.rolcreaterole || role.rolreplication) throw new Error("Refusing an unowned or privileged existing test role.");
    }
    const database = (await admin.query("SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1", [testDatabase])).rows[0];
    if (!database) await admin.query(`CREATE DATABASE "${testDatabase}" OWNER "${testRole}"`);
    else if (database.owner !== testRole) throw new Error("Test database ownership mismatch.");
    if (!existing) writeFileSync(".env.test", `TEST_DATABASE_URL="${target}"\nTEST_AUTH_SECRET="${randomBytes(48).toString("base64url")}"\n`, { mode: 0o600 });
    console.log("Test database and independent login configured. No application tables were written.");
  } else {
    const config = parse(readFileSync(".env.test"));
    if ((config.TEST_AUTH_SECRET?.length ?? 0) < 32) throw new Error("Test auth secret is missing.");
    const target = testTarget(config.TEST_DATABASE_URL, confirmation);
    source = await sourceClient();
    const before = await fingerprint(source);
    const testClient = new pg.Client({ connectionString: target.toString() }); await testClient.connect();
    try {
      await assertTestDatabase(sql => testClient.query(sql));
      const access = (await source.query("SELECT bool_or(has_table_privilege($1,quote_ident(schemaname)||'.'||quote_ident(tablename),'INSERT,UPDATE,DELETE,TRUNCATE')) AS writable FROM pg_tables WHERE schemaname='public'", [testRole])).rows[0];
      assert.equal(access.writable, false, "Test role must not write to aurel_ai.User");
      if (action === "run") {
        // Advisory lock prevents overlapping migration/test/cleanup on this target.
        assert.equal((await testClient.query("SELECT pg_try_advisory_lock(242024) AS locked")).rows[0].locked, true);
        const childEnv: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", MULTI_CURRENCY_ENABLED: "true", DATABASE_URL: target.toString(), TEST_DATABASE_URL: target.toString(),
          TEST_DATABASE_CONFIRM: confirmation, BETTER_AUTH_SECRET: config.TEST_AUTH_SECRET, BETTER_AUTH_URL: "http://localhost:3054" };
        await assertTestDatabase(sql => testClient.query(sql));
        const legacyRehearsal = await prepareLegacyRehearsal(testClient);
        command(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], childEnv);
        if (legacyRehearsal) await verifyLegacyRehearsal(testClient);
        const baseline = await fingerprint(testClient);
        if (Object.entries(baseline.data).some(([name, value]) => name !== "_prisma_migrations" && value.count !== 0)) throw new Error("Test database contains unknown data; refusing to run or erase it.");
        await assertTestDatabase(sql => testClient.query(sql));
        command(process.execPath, ["--conditions=react-server", "--import", "tsx", "--test", "tests/postgres.integration.test.ts"], childEnv);
        await assertTestDatabase(sql => testClient.query(sql));
        command(process.execPath, ["--experimental-strip-types", "--test", "tests/order-concurrency.integration.test.ts"], childEnv);
        await assertTestDatabase(sql => testClient.query(sql));
        command(process.execPath, ["--experimental-strip-types", "scripts/order-writer-privileges.ts"], childEnv);
        await assertTestDatabase(sql => testClient.query(sql));
        command(process.execPath, ["--conditions=react-server", "--import", "tsx", "--test", "tests/catalog-db.test.ts"], childEnv);
        const after = await fingerprint(testClient);
        assert.deepEqual(after.data, baseline.data, "Fixture cleanup must restore all table rows to the test baseline.");
        assert.deepEqual(after.triggers, baseline.triggers); assert.deepEqual(after.functions, baseline.functions); assert.deepEqual(after.enums, baseline.enums);
        assert.deepEqual(after.schema, baseline.schema); assert.deepEqual(after.constraints, baseline.constraints); assert.deepEqual(after.indexes, baseline.indexes);
        console.log("All test tables returned to their baseline; serial sequences are intentionally not reset.");
      } else {
        admin = await maintenance();
        const restoreName = "aurel_ai_restore_test_" + new Date().toISOString().replace(/\D/g, "").slice(0, 14) + "_" + randomBytes(3).toString("hex");
        assert.match(restoreName, /^aurel_ai_restore_test_\d{14}_[a-f0-9]{6}$/);
        mkdirSync(".local/backups", { recursive: true });
        const archive = resolve(`.local/backups/${restoreName}.dump`);
        const binaries = process.env.PG_BIN_DIR ?? resolve(".local/postgres/pgsql/bin");
        command(resolve(binaries, "pg_dump.exe"), ["--format=custom", "--file", archive], { ...pgEnvironment(mainURL), PGOPTIONS: "-c default_transaction_read_only=on -c timezone=UTC" });
        await admin.query(`CREATE DATABASE "${restoreName}" OWNER "${testRole}"`);
        const restoreURL = new URL(target); restoreURL.pathname = "/" + restoreName;
        const restored = new pg.Client({ connectionString: restoreURL.toString(), options: "-c timezone=UTC" }); await restored.connect();
        try {
          const restoreIdentity = (await restored.query("SELECT current_database() AS name,current_user AS role")).rows[0];
          assert.equal(restoreIdentity.name, restoreName); assert.equal(restoreIdentity.role, testRole);
          assert.equal((await restored.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'")).rows[0].n, 0);
          command(resolve(binaries, "pg_restore.exe"), ["--exit-on-error", "--single-transaction", "--no-owner", "--no-privileges", "--dbname", restoreName, archive], pgEnvironment(restoreURL));
          assert.deepEqual(await fingerprint(restored), before, "Restored schema and data fingerprints must match backup source.");
          writeFileSync(archive + ".verified.json", JSON.stringify({ database: restoreName, source: "aurel_ai", verifiedAt: new Date().toISOString(), schemaAndDataMatch: true,
            archiveSHA256: createHash("sha256").update(readFileSync(archive)).digest("hex"), sourceFingerprintSHA256: createHash("sha256").update(JSON.stringify(before)).digest("hex") }, null, 2));
          console.log("Backup restored and fingerprint verified in isolated database " + restoreName);
        } finally { await restored.end(); }
      }
    } finally {
      await testClient.end();
      assert.deepEqual(await fingerprint(source), before, "aurel_ai changed during test execution.");
      console.log("aurel_ai schema/data fingerprint unchanged (read-only comparison).");
    }
  }
} catch {
  console.error("PostgreSQL test operation failed safely. Review the preceding test result; no subsequent command was run.");
  process.exitCode = 1;
} finally {
  await admin?.end(); await source?.end();
  if (createHash("sha256").update(readFileSync(".env")).digest("hex") !== envHash) { console.error("Application .env was modified."); process.exitCode = 1; }
}
