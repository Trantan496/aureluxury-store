import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {parse} from "dotenv";
import pg from "pg";
import assert from "node:assert/strict";
import {fingerprint} from "./test-database-safety.ts";
if(process.argv[2]!=="--confirm-read-only=aurel_ai")throw new Error("Read-only target confirmation required");
const config=parse(readFileSync(".env"));const url=new URL(config.DATABASE_URL);assert.equal(url.pathname,"/aurel_ai");
const client=new pg.Client({connectionString:url.toString(),options:"-c default_transaction_read_only=on -c timezone=UTC"});
const hash=(value:string|Buffer)=>createHash("sha256").update(value).digest("hex");
const envHash=hash(readFileSync(".env"));
await client.connect();
try{
  const identity=(await client.query("SELECT current_database() AS name,current_setting('default_transaction_read_only') AS read_only")).rows[0];
  assert.deepEqual(identity,{name:"aurel_ai",read_only:"on"});
  const before=await fingerprint(client);
  const role=(await client.query("SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows[0];
  const tables=[];
  for(const table of ["User","Account","Session","Product","Order","ProductPrice"]){
    const relation='public."'+table+'"';const exists=!!(await client.query("SELECT to_regclass($1) AS relation",[relation])).rows[0].relation;
    const effective=exists?(await client.query("SELECT has_table_privilege(current_user,$1,'SELECT') AS select,has_table_privilege(current_user,$1,'INSERT') AS insert,has_table_privilege(current_user,$1,'UPDATE') AS update,has_table_privilege(current_user,$1,'DELETE') AS delete,has_table_privilege(current_user,$1,'TRUNCATE') AS truncate",[relation])).rows[0]:null;
    tables.push({table,exists,effective});
  }
  const backup=(await client.query("SELECT current_setting('archive_mode') AS archive_mode,current_setting('wal_level') AS wal_level,(current_setting('archive_command') NOT IN ('','(disabled)')) AS archive_command_configured,current_setting('ssl') AS ssl_server_enabled")).rows[0];
  const migrations=(await client.query(`SELECT migration_name FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name`)).rows;
  const mainSecurityRoles=(await client.query("SELECT rolname FROM pg_roles WHERE rolname IN ('aurel_app','aurel_migration_owner') OR rolname LIKE 'aurel_app_security_%' OR rolname LIKE 'aurel_owner_security_%'")).rows;
  assert.deepEqual(await fingerprint(client),before);assert.equal(hash(readFileSync(".env")),envHash);
  const report={at:new Date().toISOString(),identity,role,tables,backup,migrations,mainSecurityRoles,mainUnchanged:true,productionApproved:false};
  writeFileSync(".local/phase252-main-security.json",JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await client.end();}
