import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { createProductService, type ProductDataTransaction, type ServiceResult } from "../src/features/products/product-service.ts";
import { editorDraft, editorPayload, newVariant } from "../src/features/products/editor-state.ts";
import { galleryAssignments } from "../src/features/products/gallery.ts";
import { showroomProduct } from "../src/features/products/showroom-model.ts";
import { imageAssetId, readPublishedImage } from "../src/features/products/image-storage.ts";
import { testTarget, assertTestDatabase } from "../scripts/test-database-safety.ts";
function ok<T>(r: ServiceResult<T>) { if (!r.ok) throw new Error(`${r.error.code}:${r.error.field}`); return r.data; }
function fail(r:ServiceResult<unknown>,code:string) { assert.equal(r.ok,false); if (!r.ok) assert.equal(r.error.code,code); }
test("two-step showroom: idempotent draft, atomic immediate media, refresh, ordering, publishing and permissions", { timeout:120000 }, async () => {
  const target = testTarget(process.env.TEST_DATABASE_URL,process.env.TEST_DATABASE_CONFIRM);
  assert.equal(process.env.DATABASE_URL,target.toString()); assert.equal(process.env.NODE_ENV,"test");
  const gate = new pg.Client({ connectionString:target.toString() }); await gate.connect(); await assertTestDatabase(sql=>gate.query(sql));
  const db = new PrismaClient({ adapter:new PrismaPg({connectionString:target.toString(),max:6}) });
  const prefix = "showroom-"+randomBytes(6).toString("hex"), userIds:number[]=[], assets=new Set<string>(); let categoryId=0, actor:number|null=null;
  const deps = { resolveSession:async()=>actor ? { userId:actor,expiresAt:Date.now()+120000 } : null, transaction:<T>(work:(tx:ProductDataTransaction)=>Promise<T>)=>db.$transaction(work,{isolationLevel:"Serializable",timeout:20000}) };
  const service = createProductService(deps);
  try {
    const admin = await db.user.create({data:{email:prefix+"@test.invalid",fullName:"Isolated showroom",role:"ADMIN"}});userIds.push(admin.id);
    const customer = await db.user.create({data:{email:prefix+"-c@test.invalid",fullName:"Isolated showroom",role:"CUSTOMER"}});userIds.push(customer.id);
    const secondAdmin = await db.user.create({data:{email:prefix+"-a@test.invalid",fullName:"Isolated showroom",role:"ADMIN"}});userIds.push(secondAdmin.id);
    categoryId=(await db.category.create({data:{name:prefix,slug:prefix}})).id;
    const draft=editorDraft(null);draft.name=prefix;draft.categoryId=String(categoryId);draft.variants=[newVariant("a")];draft.variants[0].prices.VND="120000";
    const input=editorPayload(draft,true), key=randomUUID();
    fail(await service.managementPrepare(input,undefined,undefined,key),"UNAUTHENTICATED");
    actor=customer.id;fail(await service.managementPrepare(input,undefined,undefined,key),"FORBIDDEN");actor=admin.id;
    const concurrent=(await Promise.all([service.managementPrepare(input,undefined,undefined,key),service.managementPrepare(input,undefined,undefined,key)])).map(ok);
    assert.equal(concurrent[0].id,concurrent[1].id);assert.equal(await db.product.count({where:{categoryId}}),1);
    let row=ok(await service.managementGet(concurrent[0].id));assert.equal(row.isActive,false);
    assert.equal(ok(await service.managementPrepare({...input,name:"Retry must reuse existing record"},undefined,undefined,key)).id,row.id);
    actor=secondAdmin.id;fail(await service.managementPrepare(input,undefined,undefined,key),"FORBIDDEN");actor=admin.id;
    fail(await service.managementFinalize(row.id,row.version,{draft:false,publish:false}),"INVALID_INPUT");
    const png=await sharp({create:{width:96,height:120,channels:3,background:"#a89988"}}).png().toBuffer();
    let bodyRead=false;const read=async()=>{bodyRead=true;return png;};
    actor=customer.id;fail(await service.managementGallery(row.id,row.version,{operation:"upload",role:"cover"},read),"FORBIDDEN");assert.equal(bodyRead,false);
    fail(await service.managementGet(row.id),"FORBIDDEN");actor=null;fail(await service.managementGallery(row.id,row.version,{operation:"upload",role:"cover"},read),"UNAUTHENTICATED");actor=admin.id;
    // Fabric uploaded before cover stays in its clicked role, never silently becomes cover.
    row=ok(await service.managementGallery(row.id,row.version,{operation:"upload",role:"fabric"},read));
    assert.equal(row.images[0].imageType,"other");assert.equal(row.images[0].isPrimary,false);
    assert.equal(galleryAssignments(showroomProduct(row).images,true).cover,undefined);
    for (const i of row.images) assets.add(imageAssetId(i.storageKey)!);
    const stale=row.version;
    row=ok(await service.managementGallery(row.id,row.version,{operation:"upload",role:"cover"},read));
    const originalCover=row.images.find(i=>i.isPrimary)!;assets.add(imageAssetId(originalCover.storageKey)!);
    bodyRead=false;fail(await service.managementGallery(row.id,stale,{operation:"upload",role:"detail"},read),"CONFLICT");assert.equal(bodyRead,false);
    assert.equal(await readPublishedImage(db,originalCover.storageKey),null);
    const beforeAssetCount=await db.imageAsset.count();
    fail(await service.managementGallery(row.id,row.version,{operation:"upload",role:"cover",imageId:originalCover.id},async()=>new Uint8Array([1,2])),"INVALID_INPUT");
    assert.equal(await db.imageAsset.count(),beforeAssetCount);assert.equal(ok(await service.managementGet(row.id)).images.find(i=>i.isPrimary)?.storageKey,originalCover.storageKey);
    const broken=createProductService({...deps,transaction:<T>(work:(tx:ProductDataTransaction)=>Promise<T>)=>db.$transaction(tx=>work(new Proxy(tx,{get(target,key,receiver){if(key==="productImage") return new Proxy(target.productImage,{get(delegate,method){if(method==="create")return async()=>{throw new Error("Injected after asset insertion");};return Reflect.get(delegate,method);}});return Reflect.get(target,key,receiver);}})),{isolationLevel:"Serializable"})});
    fail(await broken.managementGallery(row.id,row.version,{operation:"upload",role:"detail"},read),"DATABASE_ERROR");assert.equal(await db.imageAsset.count(),beforeAssetCount);
    // Shared media is retained when the first product replaces its cover.
    const second=ok(await service.managementPrepare({...input,name:prefix+" second"},undefined,undefined,randomUUID()));
    let other=ok(await service.managementGallery(second.id,second.version,{operation:"assign",role:"cover",storageKey:originalCover.storageKey}));
    fail(await service.managementGallery(row.id,row.version,{operation:"remove",imageId:other.images[0].id}),"INVALID_INPUT");
    await db.productImage.update({where:{id:originalCover.id},data:{variantId:row.variants[0].id}});row=ok(await service.managementGet(row.id));
    row=ok(await service.managementGallery(row.id,row.version,{operation:"upload",role:"cover",imageId:originalCover.id},read));
    const replaced=row.images.find(i=>i.isPrimary)!;assets.add(imageAssetId(replaced.storageKey)!);
    assert.equal(replaced.variantId,row.variants[0].id);assert.notEqual(replaced.storageKey,originalCover.storageKey);assert.ok(await db.imageAsset.findUnique({where:{id:imageAssetId(originalCover.storageKey)!}}));
    other=ok(await service.managementGallery(other.id,other.version,{operation:"remove",imageId:other.images[0].id}));assert.equal(other.images.length,0);assert.equal(await db.imageAsset.findUnique({where:{id:imageAssetId(originalCover.storageKey)!}}),null);
    row=ok(await service.managementGallery(row.id,row.version,{operation:"upload",role:"detail"},read));
    row=ok(await service.managementGallery(row.id,row.version,{operation:"upload",role:"silhouette"},read));for(const i of row.images)assets.add(imageAssetId(i.storageKey)!);
    const reverse=row.images.map(i=>i.id).reverse();row=ok(await service.managementGallery(row.id,row.version,{operation:"reorder",ids:reverse}));
    const slots=galleryAssignments(showroomProduct(row).images,true);assert.ok(slots.cover&&slots.detail&&slots.fabric&&slots.silhouette);
    const reconnect=new PrismaClient({adapter:new PrismaPg({connectionString:target.toString()})});
    try {const fresh=createProductService({...deps,transaction:<T>(work:(tx:ProductDataTransaction)=>Promise<T>)=>reconnect.$transaction(work)});const refreshed=ok(await fresh.managementGet(row.id));assert.deepEqual([...refreshed.images].sort((a,b)=>a.sortOrder-b.sortOrder).map(i=>i.id),reverse);assert.deepEqual(refreshed.images.map(i=>i.storageKey),row.images.map(i=>i.storageKey));} finally {await reconnect.$disconnect();}
    const stock=await db.productVariant.findMany({where:{productId:row.id},select:{id:true,stock:true}}),orders=await db.order.count(),carts=await db.cartItem.count();
    const edited=editorPayload(editorDraft(row),true);edited.brand="Edited in Step1";
    row=ok(await service.managementPrepare(edited,row.id,row.version));assert.equal(row.brand,"Edited in Step1");assert.equal(row.images.length,4);assert.equal(await db.product.count({where:{categoryId}}),2);
    row=ok(await service.managementFinalize(row.id,row.version,{draft:true,publish:false}));assert.equal(row.isActive,false);assert.equal(await db.product.findFirst({where:{id:row.id,isActive:true}}),null);
    fail(await service.managementFinalize(row.id,row.version,{draft:false,publish:true,confirmed:false}),"INVALID_INPUT");
    row=ok(await service.managementFinalize(row.id,row.version,{draft:false,publish:false}));assert.equal(row.isActive,false);
    row=ok(await service.managementFinalize(row.id,row.version,{draft:false,publish:true,confirmed:true}));assert.equal(row.isActive,true);assert.ok(await db.product.findFirst({where:{id:row.id,isActive:true}}));assert.ok(await readPublishedImage(db,replaced.storageKey));
    bodyRead=false;fail(await service.managementGallery(row.id,row.version,{operation:"upload",role:"cover"},read),"CONFLICT");assert.equal(bodyRead,false);
    assert.deepEqual(await db.productVariant.findMany({where:{productId:row.id},select:{id:true,stock:true}}),stock);assert.equal(await db.order.count(),orders);assert.equal(await db.cartItem.count(),carts);
    row=ok(await service.managementFinalize(row.id,row.version,{draft:true,publish:false}));assert.equal(await readPublishedImage(db,replaced.storageKey),null);
  } finally {
    await assertTestDatabase(sql=>gate.query(sql));
    if(categoryId){const scope={product:{categoryId}};await db.productImage.deleteMany({where:scope});await db.productPrice.deleteMany({where:{variant:scope}});await db.productProfile.deleteMany({where:scope});await db.productVariant.deleteMany({where:scope});await db.product.deleteMany({where:{categoryId}});await db.category.delete({where:{id:categoryId,slug:prefix}});}
    if(assets.size)await db.imageAsset.deleteMany({where:{id:{in:[...assets]}}});
    if(userIds.length)await db.user.deleteMany({where:{id:{in:userIds},email:{endsWith:"@test.invalid"}}});
    await db.$disconnect();await gate.end();
  }
});
