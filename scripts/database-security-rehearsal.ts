import { readFileSync,writeFileSync } from "node:fs";
import { randomBytes,createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { parse } from "dotenv";
import pg from "pg";
import assert from "node:assert/strict";
import { integrationTarget,assertIntegrationDatabase } from "./integration-target.ts";
import { fingerprint,reviewedMigrations,testRole } from "./test-database-safety.ts";
import { securityPolicy } from "./security-policy.ts";

const name=process.argv[2];assert.match(name??"",/^aurel_ai_restore_test_\d{14}_[a-f0-9]{6}$/);assert.equal(process.argv[3],"--confirm-restore-test="+name);
reviewedMigrations();
const config=parse(readFileSync(".env.test"));const lab=parse(readFileSync(".local/security-postgres/phase252/lab.env"));const base=new URL(lab.SECURITY_TEST_URL);base.pathname="/"+name;
assert.equal(base.hostname,"127.0.0.1");assert.equal(base.port,"5544");
process.env.TEST_DATABASE_URL=base.toString();process.env.TEST_DATABASE_CONFIRM="aurel_ai_test";process.env.TEST_RESTORE_DATABASE_CONFIRM=name;
const target=integrationTarget();const local=parse(readFileSync(".env"));const envHash=createHash("sha256").update(readFileSync(".env")).digest("hex");
const sourceURL=new URL(local.DATABASE_URL);assert.equal(sourceURL.pathname,"/aurel_ai");
const adminURL=new URL(lab.SECURITY_DBA_URL);assert.equal(adminURL.hostname,"127.0.0.1");assert.equal(adminURL.port,"5544");assert.equal(adminURL.username,"aurel_security_dba");assert.equal(adminURL.pathname,"/postgres");
const source=new pg.Client({connectionString:sourceURL.toString(),options:"-c default_transaction_read_only=on -c timezone=UTC"});
const admin=new pg.Client({connectionString:adminURL.toString()});const control=new pg.Client({connectionString:target.toString(),options:"-c timezone=UTC"});
const suffix=randomBytes(6).toString("hex"),app="aurel_app_security_"+suffix,owner="aurel_owner_security_"+suffix;
const passwords={app:randomBytes(36).toString("base64url"),owner:randomBytes(36).toString("base64url")};
const appURL=new URL(target);appURL.username=app;appURL.password=passwords.app;
const ownerURL=new URL(target);ownerURL.username=owner;ownerURL.password=passwords.owner;
const cliURL=new URL(ownerURL);cliURL.searchParams.set("options","-c lock_timeout=3s -c statement_timeout=30s");
let before: Awaited<ReturnType<typeof fingerprint>>|undefined;
const created:string[]=[];let ownerCreated=false;
const hash=(value:Buffer|string)=>createHash("sha256").update(value).digest("hex");
const quote=(value:string)=>'"'+value.replaceAll('"','""')+'"';
async function ownership(role:string){
  await assertIntegrationDatabase(sql=>control.query(sql));
  for(const row of (await control.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).rows)await control.query(`ALTER TABLE public.${quote(row.tablename)} OWNER TO ${quote(role)}`);
  for(const row of (await control.query(`SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename`)).rows)await control.query(`ALTER SEQUENCE public.${quote(row.sequencename)} OWNER TO ${quote(role)}`);
  for(const row of (await control.query(`SELECT p.oid::regprocedure::text AS signature FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'`)).rows)await control.query(`ALTER FUNCTION ${row.signature} OWNER TO ${quote(role)}`);
  for(const row of (await control.query(`SELECT typname FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype='e'`)).rows)await control.query(`ALTER TYPE public.${quote(row.typname)} OWNER TO ${quote(role)}`);
}
try{
  await source.connect();await admin.connect();await control.connect();
  assert.equal((await admin.query("SELECT current_database() AS name")).rows[0].name,"postgres");
  const isolatedSystem=(await admin.query("SELECT system_identifier::text AS id FROM pg_control_system()")).rows[0].id;
  assert.equal(isolatedSystem,lab.SECURITY_CLUSTER_ID);
  assert.notEqual(isolatedSystem,(await source.query("SELECT system_identifier::text AS id FROM pg_control_system()")).rows[0].id,"Security roles must never be created in the main cluster");
  await assertIntegrationDatabase(sql=>control.query(sql));before=await fingerprint(source);
  const verified=JSON.parse(readFileSync(`.local/backups/${name}.dump.verified.json`,"utf8"));
  assert.equal(verified.database,name);assert.equal(verified.archiveSHA256,hash(readFileSync(`.local/backups/${name}.dump`)));
  assert.equal(verified.sourceFingerprintSHA256,hash(JSON.stringify(before)));assert.deepEqual(await fingerprint(control),before);
  for(const role of [owner,app]){
    const password=role===owner?passwords.owner:passwords.app;
    await admin.query(`CREATE ROLE ${quote(role)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);created.push(role);
  }
  ownerCreated=true;
  await admin.query(`GRANT ${quote(owner)} TO ${quote(testRole)}`);
  await control.query(`GRANT USAGE,CREATE ON SCHEMA public TO ${quote(owner)}`);
  await ownership(owner);
  await control.query(`ALTER SCHEMA public OWNER TO ${quote(owner)}`);
  await control.query(`REVOKE ALL ON DATABASE ${quote(name)} FROM PUBLIC; GRANT CONNECT ON DATABASE ${quote(name)} TO ${quote(app)},${quote(owner)}`);
  const cliEnv={...process.env,DATABASE_URL:cliURL.toString()};
  function cli(args:string[],input?:string){const result=spawnSync(process.execPath,["node_modules/prisma/build/index.js",...args],{env:cliEnv,windowsHide:true,input,stdio:input===undefined?"inherit":["pipe","inherit","inherit"],timeout:180000});assert.equal(result.status,0,"Owner CLI operation failed");}
  cli(["db","execute","--stdin"],`DO $$ BEGIN IF current_setting('lock_timeout')<>'3s' OR current_setting('statement_timeout')<>'30s' THEN RAISE EXCEPTION 'Unverified owner timeout'; END IF; END $$;`);
  cli(["migrate","deploy"]);
  const ownerClient=new pg.Client({connectionString:ownerURL.toString()});await ownerClient.connect();
  try{assert.equal((await ownerClient.query("SELECT current_user AS role")).rows[0].role,owner);await ownerClient.query(securityPolicy(app,owner));}finally{await ownerClient.end();}
  const baseline=await fingerprint(control);
  const childEnv:NodeJS.ProcessEnv={...process.env,NODE_ENV:"test",DATABASE_URL:appURL.toString(),SECURITY_OWNER_URL:ownerURL.toString(),SECURITY_RESTORE_CONFIRM:name,BETTER_AUTH_SECRET:config.TEST_AUTH_SECRET,BETTER_AUTH_URL:"http://localhost:3054",MULTI_CURRENCY_ENABLED:"true"};
  const worker=spawnSync(process.execPath,["--conditions=react-server","--import","tsx","--test","tests/database-security.integration.test.ts"],{env:childEnv,windowsHide:true,stdio:"inherit",timeout:120000});assert.equal(worker.status,0,"App login verification failed");
  const after=await fingerprint(control);for(const key of ["data","schema","constraints","indexes","functions","triggers","enums"] as const)assert.deepEqual(after[key],baseline[key]);
  const matrix=[];
  for(const table of ["User","Account","Session","Product","ProductVariant","Order","OrderItem","ProductPrice","_prisma_migrations"]){const privileges=(await control.query(`SELECT has_table_privilege($1,$2,'SELECT') AS select,has_table_privilege($1,$2,'INSERT') AS insert,has_table_privilege($1,$2,'UPDATE') AS update,has_table_privilege($1,$2,'DELETE') AS delete,has_table_privilege($1,$2,'TRUNCATE') AS truncate`,[app,'public.'+quote(table)])).rows[0];matrix.push({table,...privileges});}
  const roles=(await admin.query("SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=ANY($1::text[])",[[app,owner]])).rows;
  assert.ok(roles.every(row=>!row.rolsuper&&!row.rolcreatedb&&!row.rolcreaterole&&!row.rolreplication&&!row.rolbypassrls));
  assert.equal((await source.query("SELECT count(*)::int AS n FROM pg_roles WHERE rolname=ANY($1::text[])",[[app,owner]])).rows[0].n,0,"Lab roles must not exist in the main cluster");
  cli(["migrate","status"]);cli(["migrate","diff","--from-config-datasource","--to-schema","prisma/schema.prisma","--exit-code"]);
  const migrations=(await control.query(`SELECT migration_name,checksum FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`)).rows;
  assert.equal(migrations.length,4);for(const row of migrations)assert.equal(row.checksum,hash(readFileSync(`prisma/migrations/${row.migration_name}/migration.sql`)));
  assert.deepEqual(await fingerprint(source),before);
  writeFileSync(`.local/backups/${name}.security.json`,JSON.stringify({source:"aurel_ai",restore:name,archiveSHA256:verified.archiveSHA256,roles,matrix,migrations,ownerDeployPassed:true,appFlowsPassed:true,mainUnchanged:true,productionApproved:false},null,2));
  console.log("PASS independent app login, schema-owner migrations, privilege matrix, default deny and unchanged main");
}finally{
  try{
    if(ownerCreated){
      await assertIntegrationDatabase(sql=>control.query(sql));
      await ownership(testRole);await control.query(`ALTER SCHEMA public OWNER TO pg_database_owner`);
      await control.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${quote(owner)} GRANT EXECUTE ON FUNCTIONS TO PUBLIC`);
      for(const role of created){
        await control.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${quote(role)}`);
        await control.query(`REVOKE UPDATE ("fullName",email,"emailVerified",image,"updatedAt") ON public."User" FROM ${quote(role)}`);
        await control.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${quote(role)}`);
        await control.query(`REVOKE ALL ON SCHEMA public FROM ${quote(role)}`);
        await control.query(`REVOKE ALL ON DATABASE ${quote(name)} FROM ${quote(role)}`);
      }
      await admin.query(`REVOKE ${quote(owner)} FROM ${quote(testRole)}`);
    }
    for(const role of [...created].reverse())await admin.query(`DROP ROLE ${quote(role)}`);
    if(before)assert.deepEqual(await fingerprint(source),before);
    assert.equal(hash(readFileSync(".env")),envHash);
  }finally{await control.end();await admin.end();await source.end();}
}
