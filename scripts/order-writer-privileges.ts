import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { parse } from "dotenv";
import pg from "pg";
import assert from "node:assert/strict";
import { integrationTarget, assertIntegrationDatabase } from "./integration-target.ts";
import { testRole, fingerprint } from "./test-database-safety.ts";

const target=integrationTarget();
if(process.env.NODE_ENV!=="test"||process.env.DATABASE_URL!==target.toString()) throw new Error("Use the guarded integration runner");
const maintenanceURL=new URL(parse(readFileSync(".env")).DATABASE_URL); maintenanceURL.pathname="/postgres"; maintenanceURL.search="";
const admin=new pg.Client({connectionString:maintenanceURL.toString()});
const client=new pg.Client({connectionString:target.toString()});
const role="aurel_order_writer_test_"+randomBytes(6).toString("hex");
assert.match(role,/^aurel_order_writer_test_[a-f0-9]{12}$/);
let created=false, granted=false, baseline: Awaited<ReturnType<typeof fingerprint>> | undefined;
const results:string[]=[];
async function denied(sql:string){await client.query("SAVEPOINT privilege_probe");let code:unknown;try{await client.query(sql);}catch(error){code=(error as {code:string}).code;}await client.query("ROLLBACK TO SAVEPOINT privilege_probe; RELEASE SAVEPOINT privilege_probe");assert.equal(code,"42501");}
try{
  await admin.connect(); assert.equal((await admin.query("SELECT current_database() AS name")).rows[0].name,"postgres");
  await client.connect(); await assertIntegrationDatabase(sql=>client.query(sql)); baseline=await fingerprint(client);
  // Temporary NOLOGIN role, no ownership or grants on the main database.
  await admin.query(`CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`); created=true;
  await admin.query(`GRANT "${role}" TO "${testRole}"`);
  granted=true;
  await client.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
  await client.query(`GRANT SELECT,UPDATE ON public."Order" TO "${role}"`);
  await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON public."OrderItem" TO "${role}"`);
  await client.query(`GRANT USAGE ON SEQUENCE public."OrderItem_id_seq" TO "${role}"`); granted=true;
  await assertIntegrationDatabase(sql=>client.query(sql)); await client.query("BEGIN");
  const user=(await client.query(`INSERT INTO public."User" (email,"fullName","updatedAt") VALUES ($1,'Test',NOW()) RETURNING id`,[role+"@test.invalid"])).rows[0].id;
  const category=(await client.query(`INSERT INTO public."Category" (name,slug) VALUES ($1,$1) RETURNING id`,[role])).rows[0].id;
  const product=(await client.query(`INSERT INTO public."Product" (name,slug,"categoryId") VALUES ($1,$1,$2) RETURNING id`,[role,category])).rows[0].id;
  const variant=(await client.query(`INSERT INTO public."ProductVariant" ("productId",sku,color,size,stock) VALUES ($1,$2,'Test','M',1) RETURNING id`,[product,role])).rows[0].id;
  const order=(await client.query(`INSERT INTO public."Order" ("orderNumber","userId",currency,"totalAmount","shippingName","shippingPhone","shippingAddress") VALUES ($1,$2,'USD',0,'Test','0','Test') RETURNING id`,[role,user])).rows[0].id;
  const insert=`INSERT INTO public."OrderItem" ("orderId","variantId","productName",sku,color,size,quantity,currency,"unitPrice","lineTotal") VALUES (${order},${variant},'Test','Test','Test','M',1,'USD',0,0)`;
  await client.query(insert);
  await client.query(`SET LOCAL ROLE "${role}"`);
  await client.query(`UPDATE public."OrderItem" SET quantity=2 WHERE "orderId"=${order}`);
  await client.query(insert);
  await client.query("SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED");
  results.push("Nonowner INSERT/UPDATE fire revision and deferred checks without function EXECUTE grants");
  await denied(`SELECT public.check_order_currency_snapshot(${order})`);
  await denied(`ALTER TABLE public."OrderItem" DISABLE TRIGGER ALL`);
  await denied(`TRUNCATE public."OrderItem"`);
  await denied(`SET LOCAL session_replication_role='replica'`);
  await denied(`CREATE FUNCTION public.writer_privilege_probe() RETURNS int LANGUAGE sql AS 'SELECT 1'`);
  results.push("Direct helper EXECUTE, disabling triggers, TRUNCATE and public schema CREATE denied");
  await client.query("SAVEPOINT invariant_probe"); let code:unknown;
  try{await client.query(`DELETE FROM public."OrderItem" WHERE "orderId"=${order}`);await client.query("SET CONSTRAINTS ALL IMMEDIATE");}catch(error){code=(error as {code:string}).code;}
  await client.query("ROLLBACK TO SAVEPOINT invariant_probe"); assert.equal(code,"23514");
  results.push("Nonowner DELETE cannot commit an empty priced order");
  await client.query("ROLLBACK");
  assert.deepEqual((await fingerprint(client)).data,baseline.data);
  console.log("PASS limited writer privileges: "+JSON.stringify(results));
}finally{
  try{
    await client.query("ROLLBACK").catch(()=>{});
    if(granted){await assertIntegrationDatabase(sql=>client.query(sql));await client.query(`REVOKE ALL ON public."Order",public."OrderItem" FROM "${role}"`);await client.query(`REVOKE ALL ON SEQUENCE public."OrderItem_id_seq" FROM "${role}"`);await client.query(`REVOKE ALL ON SCHEMA public FROM "${role}"`);}
    if(created){await admin.query(`REVOKE "${role}" FROM "${testRole}"`);await admin.query(`DROP ROLE "${role}"`);}
  }finally{await client.end();await admin.end();}
}
