import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { randomBytes } from "node:crypto";

test("real app login supports auth/catalog/services without owner privileges",async()=>{
  if(process.env.NODE_ENV!=="test") throw new Error("Test only");
  const appURL=new URL(process.env.DATABASE_URL!);
  const ownerURL=new URL(process.env.SECURITY_OWNER_URL!);
  assert.match(appURL.username,/^aurel_app_security_[a-f0-9]{12}$/);
  assert.match(ownerURL.username,/^aurel_owner_security_[a-f0-9]{12}$/);
  assert.equal(appURL.pathname,ownerURL.pathname);
  assert.equal(appURL.pathname,"/"+process.env.SECURITY_RESTORE_CONFIRM);
  assert.match(appURL.pathname,/^\/aurel_ai_restore_test_\d{14}_[a-f0-9]{6}$/);
  const app=new pg.Client({connectionString:appURL.toString()});
  const owner=new pg.Client({connectionString:ownerURL.toString()});
  await app.connect(); await owner.connect();
  const guard=async(client:pg.Client,role:string)=>assert.deepEqual((await client.query("SELECT current_database() AS name,current_user AS role")).rows[0],{name:appURL.pathname.slice(1),role});
  await guard(app,appURL.username); await guard(owner,ownerURL.username);
  const {prisma}=await import("../src/lib/db/client.ts");
  const {getAuth}=await import("../src/lib/auth.ts");
  const {resolveAuthSession}=await import("../src/features/auth/session.ts");
  const {createProductDataService}=await import("../src/lib/products.ts");
  const {getCatalogPage}=await import("../src/lib/catalog.ts");
  const auth=await getAuth();
  const prefix="p252-"+randomBytes(8).toString("hex");
  const email=prefix+"@test.invalid",password=randomBytes(32).toString("base64url")+"!a9";
  let user=0;
  const origin=process.env.BETTER_AUTH_URL!;
  let cookie="";
  const service=createProductDataService(()=>resolveAuthSession(auth,new Headers({cookie})));
  async function request(path:string,body:object){await guard(app,appURL.username);return auth.handler(new Request(origin+"/api/auth/"+path,{method:"POST",headers:{origin,cookie,"content-type":"application/json"},body:JSON.stringify(body)}));}
  function data<T>(value:{ok:true;data:T}|{ok:false;error:{code:string}}):T{if(!value.ok)throw new Error(value.error.code);return value.data;}
  async function denied(sql:string,values:unknown[]=[]){await guard(app,appURL.username);await assert.rejects(app.query(sql,values),(error:unknown)=>(error as {code:string}).code==="42501");}
  try{
    const signup=await request("sign-up/email",{email,password,name:"Security test",role:"ADMIN"}); assert.equal(signup.status,200);
    user=(await owner.query(`SELECT id FROM public."User" WHERE email=$1`,[email])).rows[0].id;
    assert.equal((await owner.query(`SELECT role FROM public."User" WHERE id=$1`,[user])).rows[0].role,"CUSTOMER");
    const signin=await request("sign-in/email",{email,password});assert.equal(signin.status,200);
    cookie=signin.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");
    assert.equal((await resolveAuthSession(auth,new Headers({cookie})))?.userId,user);
    const forbidden=await service.create("category",{name:prefix,slug:prefix});assert.equal(forbidden.ok,false);if(!forbidden.ok)assert.equal(forbidden.error.code,"FORBIDDEN");
    await denied(`UPDATE public."User" SET role='ADMIN' WHERE id=$1`,[user]);
    await denied(`INSERT INTO public."User" (email,"fullName",role,"updatedAt") VALUES ($1,'Denied','ADMIN',NOW())`,[prefix+"-admin@test.invalid"]);
    await denied(`DELETE FROM public."User" WHERE id=$1`,[user]);
    await guard(owner,ownerURL.username);await owner.query(`UPDATE public."User" SET role='ADMIN' WHERE id=$1`,[user]);
    const category=Number(data(await service.create("category",{name:prefix,slug:prefix})).id);
    const product=Number(data(await service.create("product",{name:prefix,slug:prefix,categoryId:category})).id);
    const variant=Number(data(await service.create("variant",{productId:product,sku:prefix,color:"Blue",size:"M",stock:3})).id);
    const image=Number(data(await service.create("image",{productId:product,storageKey:"/images/test-only.png"})).id);
    data(await service.setPrice({productId:product,variantId:variant,currency:"VND",amount:"299000"}));
    data(await service.setPrice({productId:product,variantId:variant,currency:"USD",amount:"12.10"}));
    assert.equal(data(await service.getPrice(product,variant,"USD")).amount,"12.10");
    data(await service.adjustStock({productId:product,variantId:variant,expectedStock:3,delta:-1}));
    const catalog=await getCatalogPage({q:prefix,category:"",invalid:false,currency:"USD"});
    assert.equal(catalog.status,"success");if(catalog.status==="success")assert.equal(catalog.products[0].price,"12.10");
    data(await service.remove("image",image,product));data(await service.remove("variant",variant,product));data(await service.remove("product",product));
    await app.query(`SELECT count(*) FROM public."Order"`);await app.query(`SELECT count(*) FROM public."OrderItem"`);
    await denied(`INSERT INTO public."Order" ("orderNumber") VALUES ('Denied')`);
    await denied(`UPDATE public."Order" SET "totalAmount"=0`);
    await denied(`SELECT * FROM public."_prisma_migrations"`);
    await denied(`ALTER TABLE public."Product" ADD COLUMN denied_column int`);
    await denied(`CREATE TABLE public.denied_table (id int)`);
    await denied(`TRUNCATE public."Session"`);
    await denied(`SET ROLE "${ownerURL.username}"`);
    await denied(`SET session_replication_role='replica'`);
    await denied(`CREATE ROLE denied_runtime_role NOLOGIN`);
    await guard(owner,ownerURL.username);
    await owner.query(`CREATE TABLE public.future_security_table (id int); CREATE FUNCTION public.future_security_function() RETURNS int LANGUAGE sql AS 'SELECT 1'`);
    await denied(`SELECT * FROM public.future_security_table`);
    await denied(`SELECT public.future_security_function()`);
    await owner.query(`DROP FUNCTION public.future_security_function(); DROP TABLE public.future_security_table`);
    await owner.query(`UPDATE public."User" SET role='CUSTOMER' WHERE id=$1`,[user]);
    const revoked=await service.get("product",product);assert.equal(revoked.ok,false);if(!revoked.ok)assert.equal(revoked.error.code,"FORBIDDEN");
    assert.equal((await request("sign-out",{})).status,200);
    assert.equal(await resolveAuthSession(auth,new Headers({cookie})),null);
    console.log("PASS app-login signup/signin/session/logout, role guard/revocation, Product Service/price/stock/catalog, ACL denials and future-object default deny");
  }finally{
    try{
      await guard(owner,ownerURL.username);await owner.query("BEGIN");
      const products=(await owner.query(`SELECT id FROM public."Product" WHERE slug LIKE $1`,[prefix+"%"])) .rows.map(row=>row.id);
      await owner.query(`DELETE FROM public."ProductPrice" WHERE "variantId" IN (SELECT id FROM public."ProductVariant" WHERE "productId"=ANY($1::int[]))`,[products]);
      await owner.query(`DELETE FROM public."ProductImage" WHERE "productId"=ANY($1::int[])`,[products]);
      await owner.query(`DELETE FROM public."ProductVariant" WHERE "productId"=ANY($1::int[])`,[products]);
      await owner.query(`DELETE FROM public."Product" WHERE id=ANY($1::int[])`,[products]);
      await owner.query(`DELETE FROM public."Category" WHERE slug LIKE $1`,[prefix+"%"]);
      if(user)await owner.query(`DELETE FROM public."User" WHERE id=$1`,[user]);
      await owner.query("COMMIT");
    }finally{await prisma.$disconnect();await app.end();await owner.end();}
  }
});
