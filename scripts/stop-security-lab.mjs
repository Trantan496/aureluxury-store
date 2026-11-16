import {readFileSync,realpathSync} from "node:fs";
import {resolve,sep} from "node:path";
import {spawnSync} from "node:child_process";
import {parse} from "dotenv";
import pg from "pg";
import assert from "node:assert/strict";
assert.equal(process.argv[2],"--confirm-isolated-cluster=5544");
const root=resolve(".local/security-postgres/phase252"),data=realpathSync(resolve(root,"data"));
assert.ok(data.startsWith(realpathSync(root)+sep));
const config=parse(readFileSync(resolve(root,"lab.env")));
const url=new URL(config.SECURITY_DBA_URL);
assert.equal(url.hostname,"127.0.0.1");assert.equal(url.port,"5544");assert.equal(url.username,"aurel_security_dba");
const client=new pg.Client({connectionString:url.toString()});await client.connect();
try{
  const identity=(await client.query("SELECT system_identifier::text AS id FROM pg_control_system()")).rows[0];assert.equal(identity.id,config.SECURITY_CLUSTER_ID);
  assert.equal(realpathSync((await client.query("SHOW data_directory")).rows[0].data_directory),data);
  assert.equal((await client.query("SELECT count(*)::int AS n FROM pg_roles WHERE rolname LIKE 'aurel_app_security_%' OR rolname LIKE 'aurel_owner_security_%'")).rows[0].n,0,"Temporary lab roles were not cleaned up");
}finally{await client.end();}
const result=spawnSync(resolve(".local/postgres/pgsql/bin/pg_ctl.exe"),["-D",data,"-m","fast","-w","-t","15","stop"],{windowsHide:true,stdio:"ignore",timeout:20000});
assert.equal(result.status,0,"Isolated server stop failed");
console.log("Isolated port5544 cluster stopped after verifying its system ID/data path and role cleanup. Main cluster untouched.");
