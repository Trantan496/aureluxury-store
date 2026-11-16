import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { parse } from "dotenv";
import pg from "pg";
import assert from "node:assert/strict";
import { integrationTarget, assertIntegrationDatabase } from "./integration-target.ts";
import { fingerprint, reviewedMigrations } from "./test-database-safety.ts";
import { prepareLegacyRehearsal, verifyLegacyRehearsal } from "./multi-currency-rehearsal.ts";

const name=process.argv[2];
assert.match(name??"",/^aurel_ai_restore_test_\d{14}_[a-f0-9]{6}$/);
assert.equal(process.argv[3],"--confirm-restore-test="+name);
reviewedMigrations();
const config=parse(readFileSync(".env.test"));
const url=new URL(config.TEST_DATABASE_URL); url.pathname="/"+name;
process.env.TEST_DATABASE_URL=url.toString(); process.env.TEST_DATABASE_CONFIRM="aurel_ai_test";
process.env.TEST_RESTORE_DATABASE_CONFIRM=name;
const target=integrationTarget();
const childEnv: NodeJS.ProcessEnv={...process.env,DATABASE_URL:target.toString(),NODE_ENV:"test",MULTI_CURRENCY_ENABLED:"true",BETTER_AUTH_SECRET:config.TEST_AUTH_SECRET,BETTER_AUTH_URL:"http://localhost:3054"};
// Only the trusted CLI child gets fixed startup options. Application test URLs
// continue to use the strict target allowlist without arbitrary options.
const cliURL=new URL(target); cliURL.searchParams.set("options","-c lock_timeout=3s -c statement_timeout=30s");
const cliEnv={...childEnv,DATABASE_URL:cliURL.toString()};
const hash=(data:string|Buffer)=>createHash("sha256").update(data).digest("hex");
const sourceURL=new URL(parse(readFileSync(".env")).DATABASE_URL); assert.equal(sourceURL.pathname,"/aurel_ai");
const source=new pg.Client({connectionString:sourceURL.toString(),options:"-c default_transaction_read_only=on -c timezone=UTC"});
const restored=new pg.Client({connectionString:target.toString(),options:"-c timezone=UTC"});
const envHash=hash(readFileSync(".env"));
let before: Awaited<ReturnType<typeof fingerprint>> | undefined;
function command(args:string[],cli=false,input?:string){const result=spawnSync(process.execPath,args,{env:cli?cliEnv:childEnv,windowsHide:true,stdio:input===undefined?"inherit":["pipe","inherit","inherit"],input,timeout:180000});assert.equal(result.status,0,"Rehearsal child failed; no subsequent step is authorized automatically");}
try {
  await source.connect(); await restored.connect();
  await assertIntegrationDatabase(sql=>restored.query(sql));
  before=await fingerprint(source);
  const verified=JSON.parse(readFileSync(`.local/backups/${name}.dump.verified.json`,"utf8"));
  assert.equal(verified.database,name); assert.equal(verified.source,"aurel_ai"); assert.equal(verified.schemaAndDataMatch,true);
  assert.equal(hash(readFileSync(`.local/backups/${name}.dump`)),verified.archiveSHA256);
  assert.equal(hash(JSON.stringify(before)),verified.sourceFingerprintSHA256);
  assert.deepEqual(await fingerprint(restored),before,"Only a fresh verified restore is accepted");
  command(["node_modules/prisma/build/index.js","db","execute","--stdin"],true,`DO $$ BEGIN IF current_setting('lock_timeout') <> '3s' OR current_setting('statement_timeout') <> '30s' THEN RAISE EXCEPTION 'CLI startup timeouts not applied'; END IF; END $$;`);
  await assertIntegrationDatabase(sql=>restored.query(sql));
  await restored.query('BEGIN; LOCK TABLE public."Order" IN ACCESS SHARE MODE');
  try {
    const lockProbe=spawnSync(process.execPath,["node_modules/prisma/build/index.js","db","execute","--stdin"],{env:cliEnv,windowsHide:true,encoding:"utf8",timeout:15000,input:'BEGIN; LOCK TABLE public."Order" IN ACCESS EXCLUSIVE MODE; ROLLBACK;'});
    assert.notEqual(lockProbe.status,0); assert.match(lockProbe.stderr,/lock timeout|55P03/i);
  }finally{await restored.query("ROLLBACK");}
  assert.deepEqual(await fingerprint(restored),before,"CLI lock probe must not change restored rows/schema");
  await assertIntegrationDatabase(sql=>restored.query(sql));
  assert.equal(await prepareLegacyRehearsal(restored,name),true);
  const started=performance.now();
  command(["node_modules/prisma/build/index.js","migrate","deploy"],true);
  const deployMilliseconds=Math.round(performance.now()-started);
  assert.equal((await restored.query(`SELECT revision::text AS revision FROM public."Order" WHERE "orderNumber"='p25-legacy-migration-rehearsal'`)).rows[0].revision,"0");
  await verifyLegacyRehearsal(restored,name);
  const manifest=JSON.parse(readFileSync("tests/support/reviewed-migrations.json","utf8")) as Record<string,string>;
  const metadata=(await restored.query(`SELECT migration_name,checksum,extract(epoch FROM (finished_at-started_at))*1000 AS milliseconds FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`)).rows;
  assert.deepEqual(metadata.map(row=>row.migration_name),Object.keys(manifest).sort());
  for(const row of metadata) assert.equal(row.checksum,hash(readFileSync(`prisma/migrations/${row.migration_name}/migration.sql`)),"Prisma metadata checksum mismatch");
  const baseline=await fingerprint(restored);
  assert.ok(Object.entries(baseline.data).every(([table,row])=>table==="_prisma_migrations"||row.count===0));
  command(["--conditions=react-server","--import","tsx","--test","tests/postgres.integration.test.ts"]);
  command(["--experimental-strip-types","--test","tests/order-concurrency.integration.test.ts"]);
  command(["--experimental-strip-types","scripts/order-writer-privileges.ts"]);
  command(["--conditions=react-server","--import","tsx","--test","tests/catalog-db.test.ts"]);
  const after=await fingerprint(restored);
  for(const key of ["data","schema","constraints","indexes","triggers","functions","enums"] as const) assert.deepEqual(after[key],baseline[key]);
  const privileges=(await restored.query(`SELECT current_user AS role,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
  assert.equal(privileges.rolsuper,false); assert.equal(privileges.rolcreatedb,false); assert.equal(privileges.rolcreaterole,false); assert.equal(privileges.rolreplication,false);
  await assertIntegrationDatabase(sql=>restored.query(sql));
  command(["node_modules/prisma/build/index.js","migrate","status"],true);
  command(["node_modules/prisma/build/index.js","migrate","diff","--from-config-datasource","--to-schema","prisma/schema.prisma","--exit-code"],true);
  assert.deepEqual(await fingerprint(source),before);
  assert.equal(hash(readFileSync(".env")),envHash);
  const report={at:new Date().toISOString(),source:"aurel_ai",restore:name,archiveSHA256:verified.archiveSHA256,metadata,deployMilliseconds,privileges,cliTimeoutsVerified:true,cliLockTimeoutProbe:true,prismaSchemaMatches:true,legacyPreserved:true,fixtureRowsClean:true,sourceUnchanged:true,productionApproved:false};
  writeFileSync(`.local/backups/${name}.order-revision.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {
  try {if(before) assert.deepEqual(await fingerprint(source),before,"Main fingerprint changed");assert.equal(hash(readFileSync(".env")),envHash);}
  finally {await restored.end();await source.end();}
}
