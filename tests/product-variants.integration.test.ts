import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID,randomBytes} from "node:crypto";
import sharp from "sharp";
import pg from "pg";
import {PrismaClient} from "../src/generated/prisma/client.ts";
import {PrismaPg} from "@prisma/adapter-pg";
import {createProductService,type ProductDataTransaction,type ServiceResult} from "../src/features/products/product-service.ts";
import {editorDraft,editorPayload,newVariant} from "../src/features/products/editor-state.ts";
import type {ManagementDTO} from "../src/features/products/management.ts";
import {testTarget,assertTestDatabase} from "../scripts/test-database-safety.ts";
function ok<T>(r:ServiceResult<T>):T{if(!r.ok)throw Error(`${r.error.code}:${r.error.field}`);return r.data;}
function fail(r:ServiceResult<unknown>,code:string){assert.equal(r.ok,false);if(!r.ok)assert.equal(r.error.code,code);}
test("dynamic variants: matrix, guarded writes, HEX, SKU collision, rollback and ordered variant retention",{timeout:120000},async()=>{
 const target=testTarget(process.env.TEST_DATABASE_URL,process.env.TEST_DATABASE_CONFIRM);assert.equal(process.env.DATABASE_URL,target.toString());
 const gate=new pg.Client({connectionString:target.toString()});await gate.connect();await assertTestDatabase(sql=>gate.query(sql));
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:target.toString(),max:5})}),prefix="matrix-"+randomBytes(4).toString("hex");
 let actor:number|null=null,productId=0,categoryId=0;
 const rollback=new Error("Intentional variant fixture rollback");
 try{
  await assert.rejects(db.$transaction(async tx=>{
   async function transaction<T>(work:(dbtx:ProductDataTransaction)=>Promise<T>):Promise<T>{
    await tx.$executeRawUnsafe("SAVEPOINT variant_operation");
    try{const result=await work(tx);await tx.$executeRawUnsafe("RELEASE SAVEPOINT variant_operation");return result;}
    catch(error){await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT variant_operation");await tx.$executeRawUnsafe("RELEASE SAVEPOINT variant_operation");throw error;}
   }
   const deps={resolveSession:async()=>actor?{userId:actor,expiresAt:Date.now()+120000}:null,transaction},s=createProductService(deps);
  const admin=await tx.user.create({data:{email:prefix+"@test.invalid",fullName:"Matrix admin",role:"ADMIN"}}),customer=await tx.user.create({data:{email:prefix+"-c@test.invalid",fullName:"Matrix customer"}});actor=admin.id;
  actor=null;fail(await s.managementSelectCategory({slug:"ao-thun"}),"UNAUTHENTICATED");
  actor=customer.id;fail(await s.managementSelectCategory({slug:"ao-thun"}),"FORBIDDEN");actor=admin.id;
  fail(await s.managementSelectCategory({slug:"not-a-preset"}),"INVALID_INPUT");
  const firstCategory=ok(await s.managementSelectCategory({slug:"ao-thun"}));
  assert.equal(ok(await s.managementSelectCategory({slug:"ao-thun"})).id,firstCategory.id);
  assert.equal(await tx.category.count({where:{slug:"ao-thun"}}),1);
  assert.equal(await tx.product.count(),0);
  categoryId=(await tx.category.create({data:{name:prefix,slug:prefix}})).id;
  const draft=editorDraft(null);draft.name=prefix;draft.categoryId=String(categoryId);draft.variants=[{...newVariant("base"),stock:"3",prices:{VND:"100000",USD:"",EUR:""}}];
  let row:ManagementDTO=ok(await s.managementPrepare(editorPayload(draft,true),undefined,undefined,randomUUID()));productId=row.id;const original=row.variants[0];
  const input={colors:[{name:prefix+" olive",hex:"#778855"},{name:prefix+" wine",hex:"#884455"}],sizes:["S","L"]};
  actor=null;fail(await s.managementExpandVariants(row.id,row.version,input),"UNAUTHENTICATED");actor=customer.id;fail(await s.managementExpandVariants(row.id,row.version,input),"FORBIDDEN");actor=admin.id;
  const expanded=ok(await s.managementExpandVariants(row.id,row.version,input));assert.equal(expanded.created,8);row=expanded;assert.equal(row.variants.length,9);assert.deepEqual(row.variants.find(v=>v.id===original.id),original);assert.equal(await tx.product.count({where:{categoryId}}),1);
  for(const v of row.variants.filter(v=>v.id!==original.id)){assert.equal(v.stock,0);assert.equal(v.isActive,false);assert.equal(v.prices.length,0);}
  assert.equal(new Set(row.variants.map(v=>`${v.color}/${v.size}`)).size,9);assert.equal(new Set(row.variants.map(v=>v.sku)).size,9);
  await assert.rejects(()=>transaction(inner=>inner.productVariant.create({data:{productId,sku:original.sku,color:"white",size:"M",stock:0,isActive:false}})));
  await assert.rejects(()=>transaction(inner=>inner.productVariant.create({data:{productId,sku:row.productCode+"-DUPLICATE-CHECK",color:original.color,size:original.size,stock:0,isActive:false}})));
  await assert.rejects(()=>transaction(inner=>inner.taxonomyOption.create({data:{key:"size",token:prefix.toUpperCase()+"-BAD",label:"Bad HEX",hex:"#AABBCC"}})));
  assert.equal(row.variantColors?.[prefix+"-olive"]?.hex,"#778855");
  const again=ok(await s.managementExpandVariants(row.id,row.version,input));assert.equal(again.created,0);row=again;
  fail(await s.managementExpandVariants(row.id,"stale",input),"CONFLICT");
  fail(await s.managementExpandVariants(row.id,row.version,{colors:[{name:prefix+" olive",hex:"#000000"}],sizes:[]}),"INVALID_INPUT");
  const before=await tx.taxonomyOption.count();
  const broken=createProductService({...deps,transaction:<T>(work:(dbtx:ProductDataTransaction)=>Promise<T>)=>transaction(inner=>work(new Proxy(inner,{get(target,key,receiver){if(key==="productVariant")return new Proxy(target.productVariant,{get(delegate,method){if(method==="create")return async()=>{throw Error("Injected variant failure");};return Reflect.get(delegate,method);}});return Reflect.get(target,key,receiver);}})))});
  fail(await broken.managementExpandVariants(row.id,row.version,{colors:[{name:prefix+" rollback",hex:"#123456"}],sizes:[]}),"DATABASE_ERROR");assert.equal(await tx.taxonomyOption.count(),before);assert.equal((await tx.productVariant.count({where:{productId}})),9);
  const size=prefix.toUpperCase()+"-M";
  row=ok(await s.managementExpandVariants(row.id,row.version,{colors:[{name:prefix+" shade "+prefix,hex:"#334455"},{name:prefix+" shade",hex:"#445566"}],sizes:[size]}));assert.equal(row.variants.length,20);assert.equal(new Set(row.variants.map(v=>v.sku)).size,20);assert.ok(row.variants.some(v=>/-V1$/.test(v.sku)));
  const editing=editorDraft(row),custom=editing.variants.find(v=>v.color===prefix+"-olive"&&v.size==="M")!;custom.isActive=true;custom.prices.VND="123400";custom.stock="2";
  row=ok(await s.managementSave(editorPayload(editing,true),row.id,row.version));
  const png=await sharp({create:{width:60,height:80,channels:3,background:"#ddd5c5"}}).png().toBuffer();row=ok(await s.managementGallery(row.id,row.version,{operation:"upload",role:"cover"},async()=>png));
  row=ok(await s.managementFinalize(row.id,row.version,{draft:false,publish:true,confirmed:true}));
  const {showroomProduct}=await import("../src/features/products/showroom-model.ts"),{readVariantColours}=await import("../src/features/products/variant-colours.ts");
  const detail=showroomProduct({...row,variantColors:await readVariantColours(tx,row.variants.map(v=>v.color))});assert.equal(detail.variants.length,2);assert.equal(detail.variantColors?.[prefix+"-olive"]?.hex,"#778855");
  fail(await s.managementExpandVariants(row.id,row.version,input),"INVALID_INPUT");assert.equal((await tx.product.findUniqueOrThrow({where:{id:row.id}})).isActive,true);
  const order=await tx.order.create({data:{orderNumber:prefix,userId:customer.id,totalAmount:"100000",shippingName:"Unit",shippingPhone:"0000000000",shippingAddress:"Isolated test",items:{create:{variantId:original.id,productName:prefix,sku:original.sku,color:original.color,size:original.size,quantity:1,unitPrice:"100000"}}}});const orderId=order.id;
  await tx.$executeRawUnsafe("SAVEPOINT delete_ordered_variant");await assert.rejects(()=>tx.productVariant.delete({where:{id:original.id}}));await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT delete_ordered_variant");await tx.$executeRawUnsafe("RELEASE SAVEPOINT delete_ordered_variant");
  const disabled=editorDraft(row);disabled.variants.find(v=>v.id===original.id)!.isActive=false;row=ok(await s.managementSave(editorPayload(disabled,true),row.id,row.version));assert.equal(row.variants.find(v=>v.id===original.id)?.isActive,false);assert.equal(await tx.orderItem.count({where:{orderId}}),1);
  throw rollback;
  },{isolationLevel:"Serializable",timeout:60000}),error=>error===rollback);
  assert.equal(await db.taxonomyOption.count({where:{token:{contains:prefix}}}),0);
  assert.equal(await db.user.count({where:{email:{startsWith:prefix}}}),0);
 }finally{await db.$disconnect();await gate.end();}
});
