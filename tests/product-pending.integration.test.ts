import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID,randomBytes} from "node:crypto";
import sharp from "sharp";
import pg from "pg";
import {PrismaClient} from "../src/generated/prisma/client.ts";
import {PrismaPg} from "@prisma/adapter-pg";
import {createProductService,type ProductDataTransaction,type ServiceResult} from "../src/features/products/product-service.ts";
import {editorDraft,editorPayload,newVariant} from "../src/features/products/editor-state.ts";
import {testTarget,assertTestDatabase} from "../scripts/test-database-safety.ts";
import {readPublishedImage} from "../src/features/products/image-storage.ts";
function ok<T>(r:ServiceResult<T>):T{if(!r.ok)throw Error(`${r.error.code}:${r.error.field}`);return r.data;}
function fail(r:ServiceResult<unknown>,code:string){assert.equal(r.ok,false);if(!r.ok)assert.equal(r.error.code,code);}

test("manual look intake: private queue, atomic save/convert, pagination, reference cleanup and public publication gates",{timeout:120000},async()=>{
 const target=testTarget(process.env.TEST_DATABASE_URL,process.env.TEST_DATABASE_CONFIRM);assert.equal(process.env.DATABASE_URL,target.toString());
 const gate=new pg.Client({connectionString:target.toString()});await gate.connect();await assertTestDatabase(sql=>gate.query(sql));
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:target.toString(),max:6})});
 const prefix="pending-"+randomBytes(5).toString("hex");let actor:number|null=null,categoryId=0;const users:number[]=[],assets=new Set<string>(),pendingIds:number[]=[];
 const deps={resolveSession:async()=>actor?{userId:actor,expiresAt:Date.now()+120000}:null,transaction:<T>(work:(tx:ProductDataTransaction)=>Promise<T>)=>db.$transaction(work,{isolationLevel:"Serializable",timeout:20000})};const s=createProductService(deps);
 const {publicLook,productRelated}=await import("../src/lib/product-related.ts"),{prisma:publicDb}=await import("../src/lib/db/client.ts");
 try{
  const admin=await db.user.create({data:{email:prefix+"@test.invalid",fullName:"Isolated intake",role:"ADMIN"}});users.push(admin.id);
  const customer=await db.user.create({data:{email:prefix+"-c@test.invalid",fullName:"Isolated customer"}});users.push(customer.id);actor=admin.id;
  categoryId=(await db.category.create({data:{name:prefix,slug:prefix}})).id;
  const draft=editorDraft(null);draft.name=prefix;draft.categoryId=String(categoryId);draft.variants=[newVariant("unit")];draft.variants[0].prices.VND="999000";
  const input=editorPayload(draft,true);const parent=ok(await s.managementPrepare(input,undefined,undefined,randomUUID()));await db.product.update({where:{id:parent.id},data:{isActive:true}});
  const before=ok(await s.managementGet(parent.id));const unchanged=JSON.stringify(before);
  actor=null;fail(await s.pendingCreate(parent.id,randomUUID()),"UNAUTHENTICATED");actor=customer.id;fail(await s.pendingList(),"FORBIDDEN");actor=admin.id;
  const key=randomUUID(),twice=(await Promise.all([s.pendingCreate(parent.id,key),s.pendingCreate(parent.id,key)])).map(ok);assert.equal(twice[0].id,twice[1].id);let row=twice[0];pendingIds.push(row.id);
  assert.equal(ok(await s.pendingCreate(parent.id,key)).id,row.id);assert.equal(row.state,"pending");assert.equal(row.name,null);
  for(let n=0;n<21;n++)pendingIds.push(ok(await s.pendingCreate(parent.id,randomUUID())).id);
  const first=ok(await s.pendingList({sourceId:parent.id})),second=ok(await s.pendingList({sourceId:parent.id,page:2}));assert.equal(first.rows.length,20);assert.equal(first.hasMore,true);assert.equal(second.rows.length,2);assert.deepEqual([...first.rows,...second.rows].map(r=>r.id),pendingIds);
  const png=await sharp({create:{width:80,height:100,channels:3,background:"#c5b5a0"}}).png().toBuffer();
  // Autosave may persist any single field before an item is complete.
  let partial=ok(await s.pendingGet(pendingIds[2]));let patchRead=false;
  actor=customer.id;fail(await s.pendingPatch(partial.id,partial.version,{},async()=>{patchRead=true;return png;}),"FORBIDDEN");assert.equal(patchRead,false);actor=admin.id;
  partial=ok(await s.pendingPatch(partial.id,partial.version,{},async()=>png));const partialAsset=partial.imageUrl!.split("/").at(-1)!.replace(".webp","");assets.add(partialAsset);
  assert.equal(partial.name,null);assert.equal(partial.price,null);assert.equal(await readPublishedImage(db,partial.imageUrl!),null);
  partial=ok(await s.pendingPatch(partial.id,partial.version,{name:"Inline name"}));
  partial=ok(await s.pendingPatch(partial.id,partial.version,{price:"299999"}));
  fail(await s.pendingPatch(partial.id,partial.version,{price:"-1"}),"INVALID_INPUT");fail(await s.pendingPatch(partial.id,partial.version,{}),"INVALID_INPUT");
  patchRead=false;fail(await s.pendingPatch(partial.id,"stale",{},async()=>{patchRead=true;return png;}),"CONFLICT");assert.equal(patchRead,false);
  partial=ok(await s.pendingPatch(partial.id,partial.version,{removeImage:true}));assert.equal(partial.imageUrl,null);assert.equal(partial.name,"Inline name");assert.equal(partial.price,"299999");assert.equal(await db.imageAsset.findUnique({where:{id:partialAsset}}),null);
  fail(await s.pendingConvert(partial.id,partial.version,input),"INVALID_INPUT");
  partial=ok(await s.pendingPatch(partial.id,partial.version,{name:null,price:null}));assert.equal(partial.name,null);assert.equal(partial.price,null);
  let read=false;actor=customer.id;fail(await s.pendingSave(row.id,row.version,{name:"Unit",price:"100000"},async()=>{read=true;return png;}),"FORBIDDEN");assert.equal(read,false);actor=admin.id;
  fail(await s.pendingSave(row.id,row.version,{name:"Unit",price:"1.5"},async()=>png),"INVALID_INPUT");
  row=ok(await s.pendingSave(row.id,row.version,{name:prefix+" piece",price:"100000"},async()=>png));assets.add(row.imageUrl!.split("/").at(-1)!.replace(".webp",""));
  assert.equal(await readPublishedImage(db,row.imageUrl!),null);
  read=false;fail(await s.pendingSave(row.id,"stale",{name:"Stale",price:"100000"},async()=>{read=true;return png;}),"CONFLICT");assert.equal(read,false);
  const original=await db.imageAsset.count();fail(await s.pendingSave(row.id,row.version,{name:"Bad",price:"100000"},async()=>new Uint8Array([1,2,3])),"INVALID_INPUT");assert.equal(await db.imageAsset.count(),original);assert.equal(ok(await s.pendingGet(row.id)).imageUrl,row.imageUrl);
  const broken=createProductService({...deps,transaction:<T>(work:(tx:ProductDataTransaction)=>Promise<T>)=>db.$transaction(tx=>work(new Proxy(tx,{get(target,key,receiver){if(key==="pendingProduct")return new Proxy(target.pendingProduct,{get(delegate,method){if(method==="update")return async()=>{throw Error("Injected after asset insertion");};return Reflect.get(delegate,method);}});return Reflect.get(target,key,receiver);}})),{isolationLevel:"Serializable"})});
  fail(await broken.pendingPatch(row.id,row.version,{},async()=>png),"DATABASE_ERROR");assert.equal(await db.imageAsset.count(),original);assert.equal(ok(await s.pendingGet(row.id)).imageUrl,row.imageUrl);
  await db.pendingProduct.update({where:{id:partial.id},data:{imageAssetId:row.imageUrl!.split("/").at(-1)!.replace(".webp","")}});
  partial=ok(await s.pendingGet(partial.id));ok(await s.pendingPatch(partial.id,partial.version,{removeImage:true}));assert.ok(await db.imageAsset.findUnique({where:{id:row.imageUrl!.split("/").at(-1)!.replace(".webp","")}}));
  fail(await broken.pendingSave(row.id,row.version,{name:"Rollback",price:"100000"},async()=>png),"DATABASE_ERROR");assert.equal(await db.imageAsset.count(),original);
  const reconnect=new PrismaClient({adapter:new PrismaPg({connectionString:target.toString()})});try{const reloaded=await reconnect.pendingProduct.findUniqueOrThrow({where:{id:row.id}});assert.equal(reloaded.name,row.name);assert.equal(reloaded.proposedPrice?.toString(),"100000");assert.equal(reloaded.imageAssetId,row.imageUrl!.split("/").at(-1)!.replace(".webp",""));}finally{await reconnect.$disconnect();}
  // Gallery cleanup must preserve assets still referenced by a pending card.
  let source=ok(await s.managementFinalize(parent.id,before.version,{draft:true,publish:false}));source=ok(await s.managementGallery(source.id,source.version,{operation:"upload",role:"cover"},async()=>png));const shared=source.images[0].storageKey.split("/").at(-1)!.replace(".webp","");assets.add(shared);
  await db.pendingProduct.update({where:{id:pendingIds[1]},data:{imageAssetId:shared}});
  source=ok(await s.managementGallery(source.id,source.version,{operation:"upload",role:"cover"},async()=>png));assets.add(source.images[0].storageKey.split("/").at(-1)!.replace(".webp",""));assert.ok(await db.imageAsset.findUnique({where:{id:shared}}));
  const other=ok(await s.pendingGet(pendingIds[1]));const replaced=ok(await s.pendingSave(other.id,other.version,{name:prefix+" other",price:"200000"},async()=>png));assets.add(replaced.imageUrl!.split("/").at(-1)!.replace(".webp",""));assert.equal(await db.imageAsset.findUnique({where:{id:shared}}),null);
  // Restore fixture parent to the baseline image-free state before proving look-only operations.
  await db.productImage.deleteMany({where:{productId:parent.id}});await db.product.update({where:{id:parent.id},data:{isActive:true}});
  const baseline=ok(await s.managementGet(parent.id));
  fail(await s.pendingConvert(row.id,row.version,{...input,categoryId:0}),"INVALID_INPUT");assert.equal((await db.pendingProduct.findUniqueOrThrow({where:{id:row.id}})).state,"pending");
  const childInput={...input,name:row.name,variants:input.variants.map(v=>({...v,prices:{VND:row.price!,USD:"",EUR:""}}))};
  fail(await broken.pendingConvert(row.id,row.version,childInput),"DATABASE_ERROR");assert.equal(await db.product.count({where:{categoryId}}),1);assert.equal((await db.pendingProduct.findUniqueOrThrow({where:{id:row.id}})).state,"pending");
  const converted=(await Promise.all([s.pendingConvert(row.id,row.version,childInput),s.pendingConvert(row.id,row.version,childInput)])).map(ok);assert.equal(converted[0].id,converted[1].id);let child=converted[0];assert.equal(child.isActive,false);assert.equal(await db.product.count({where:{categoryId}}),2);assert.equal(child.images[0].storageKey,row.imageUrl);assert.equal((await db.pendingProduct.findUniqueOrThrow({where:{id:row.id}})).imageAssetId,null);
  assert.equal((await publicLook(parent.slug)).rows.length,0);
  child=ok(await s.managementFinalize(child.id,child.version,{draft:false,publish:true,confirmed:true}));assert.equal((await publicLook(parent.slug)).rows[0]?.slug,child.slug);assert.ok(await readPublishedImage(db,row.imageUrl!));
  const related=await productRelated({slug:parent.slug,name:parent.name,brand:null,description:null,category:null,currency:"VND",variants:[],images:[]});assert.deepEqual(related.similar,[]);assert.equal(related.look[0]?.slug,child.slug);
  child=ok(await s.managementFinalize(child.id,child.version,{draft:true,publish:false}));assert.equal((await publicLook(parent.slug)).rows.length,0);
  const linked=ok(await s.pendingGet(row.id));ok(await s.pendingDetach(row.id,linked.version));assert.ok(await db.product.findUnique({where:{id:child.id}}));assert.ok(await db.pendingProduct.findUnique({where:{id:row.id}}));
  assert.equal(JSON.stringify(ok(await s.managementGet(parent.id))),JSON.stringify(baseline));assert.ok(unchanged.includes('"isActive":true'));
  assert.equal(ok(await s.pendingList()).rows.some(r=>r.id===row.id),false);
 }finally{
  await assertTestDatabase(sql=>gate.query(sql));
  if(pendingIds.length)await db.pendingProduct.deleteMany({where:{id:{in:pendingIds}}});
  if(categoryId){const scope={product:{categoryId}};await db.productImage.deleteMany({where:scope});await db.productPrice.deleteMany({where:{variant:scope}});await db.productProfile.deleteMany({where:scope});await db.productVariant.deleteMany({where:scope});await db.product.deleteMany({where:{categoryId}});await db.category.delete({where:{id:categoryId}});}
  if(assets.size)await db.imageAsset.deleteMany({where:{id:{in:[...assets]}}});
  if(users.length)await db.user.deleteMany({where:{id:{in:users}}});
  await publicDb.$disconnect();await db.$disconnect();await gate.end();
 }
});
