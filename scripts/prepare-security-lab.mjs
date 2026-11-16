import { readFileSync,writeFileSync,existsSync,mkdirSync,unlinkSync } from "node:fs";
import { resolve,sep } from "node:path";
import { randomBytes,createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import net from "node:net";
import pg from "pg";
import assert from "node:assert/strict";

const name=process.argv[2];assert.match(name??"",/^aurel_ai_restore_test_\d{14}_[a-f0-9]{6}$/);
assert.equal(process.argv[3],"--confirm-isolated-cluster=5544");
const root=resolve(".local/security-postgres/phase252"),data=resolve(root,"data");
assert.ok(data.startsWith(resolve(".local")+sep));
if(existsSync(data))throw new Error("Refusing an existing cluster directory; inspect it manually");
const archive=resolve(`.local/backups/${name}.dump`),verified=JSON.parse(readFileSync(archive+".verified.json","utf8"));
assert.equal(verified.archiveSHA256,createHash("sha256").update(readFileSync(archive)).digest("hex"));
assert.equal(verified.database,name);
const occupied=await new Promise(resolveCheck=>{const socket=net.createConnection({host:"127.0.0.1",port:5544});socket.once("connect",()=>{socket.destroy();resolveCheck(true);});socket.once("error",()=>resolveCheck(false));socket.setTimeout(1000,()=>{socket.destroy();resolveCheck(true);});});
assert.equal(occupied,false,"Port5544 is already occupied; refusing to touch it");
mkdirSync(root,{recursive:true});const pwfile=resolve(root,"init-password.private");
const adminPassword=randomBytes(36).toString("base64url"),testPassword=randomBytes(36).toString("base64url");
writeFileSync(pwfile,adminPassword,{mode:0o600});
const binaries=resolve(".local/postgres/pgsql/bin");
function command(file,args,env=process.env){const result=spawnSync(resolve(binaries,file),args,{windowsHide:true,env,encoding:"utf8",timeout:60000});if(result.status!==0)throw new Error("Isolated PostgreSQL command failed: "+file);}
try{command("initdb.exe",["-D",data,"-U","aurel_security_dba","--auth-host=scram-sha-256","--auth-local=scram-sha-256","--pwfile",pwfile,"--encoding=UTF8","--locale=C"]);}finally{unlinkSync(pwfile);}
command("pg_ctl.exe",["-D",data,"-l",resolve(root,"postgres.log"),"-w","-o","-p 5544 -h 127.0.0.1","start"]);
const adminURL=new URL("postgresql://aurel_security_dba@127.0.0.1:5544/postgres");adminURL.password=adminPassword;
const admin=new pg.Client({connectionString:adminURL.toString()});
await admin.connect();
try{
  assert.equal((await admin.query("SELECT inet_server_port() AS port")).rows[0].port,5544);
  await admin.query(`CREATE ROLE aurel_ai_test_runner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${testPassword}'`);
  await admin.query(`CREATE DATABASE "${name}" OWNER aurel_ai_test_runner`);
  const system=(await admin.query("SELECT system_identifier::text AS id FROM pg_control_system()")).rows[0].id;
  const testURL=new URL(adminURL);testURL.username="aurel_ai_test_runner";testURL.password=testPassword;testURL.pathname="/"+name;testURL.search="?schema=public";
  writeFileSync(resolve(root,"lab.env"),`SECURITY_DBA_URL="${adminURL}"\nSECURITY_TEST_URL="${testURL}"\nSECURITY_CLUSTER_ID="${system}"\n`,{mode:0o600});
  const env={...process.env,PGHOST:"127.0.0.1",PGPORT:"5544",PGDATABASE:name,PGUSER:"aurel_ai_test_runner",PGPASSWORD:testPassword,PGOPTIONS:"-c timezone=UTC"};
  for(const key of ["PGHOSTADDR","PGSERVICE","PGSERVICEFILE"])delete env[key];
  command("pg_restore.exe",["--exit-on-error","--single-transaction","--no-owner","--no-privileges","--dbname",name,archive],env);
  console.log("Isolated cluster initialized and archive restored on port5544. Credentials private in .local/security-postgres/phase252/lab.env; main cluster never connected.");
}finally{await admin.end();}
