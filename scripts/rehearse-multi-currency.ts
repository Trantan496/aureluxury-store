import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import pg from "pg";
import assert from "node:assert/strict";
import { reviewedMigrations, testTarget } from "./test-database-safety.ts";
import { prepareLegacyRehearsal, verifyLegacyRehearsal } from "./multi-currency-rehearsal.ts";
const name = process.argv[2];
assert.match(name ?? "", /^aurel_ai_restore_test_\d{14}_[a-f0-9]{6}$/);
if (process.argv[3] !== "--confirm-restore-test="+name) throw new Error("Explicit restore-test target confirmation required");
reviewedMigrations();
const url = testTarget(parse(readFileSync(".env.test")).TEST_DATABASE_URL, "aurel_ai_test"); url.pathname = "/"+name;
const client = new pg.Client({connectionString:url.toString()});
try {
 await client.connect();
 assert.equal((await client.query(`SELECT to_regclass('public."ProductPrice"') AS name`)).rows[0].name,null,"Restore rehearsal target has already been expanded; use a fresh verified restore.");
 const ready = await prepareLegacyRehearsal(client,name); assert.equal(ready,true);
 await client.query(readFileSync("prisma/migrations/20261020160500_multi_currency/migration.sql","utf8"));
 await verifyLegacyRehearsal(client,name);
 console.log("PASS reviewed migration on restored backup with legacy fixture data; main database never connected.");
} finally { await client.end(); }
