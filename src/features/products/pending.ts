import "server-only";
import {randomUUID} from "node:crypto";
import type {Prisma} from "../../generated/prisma/client.ts";
import {ServiceError,type ProductDataTransaction,type ServiceResult} from "./product-service.ts";
import {integer,object,InputError} from "./validation.ts";
import {money} from "../money/money.ts";
import {prepareImage} from "./image-upload.ts";
import {pendingAvailable,cleanupAsset} from "./asset-cleanup.ts";
import {dto,editorInputFields,load,persist} from "./management.ts";
import type {PendingItem,PendingPage} from "./pending-types.ts";
type Run=<T>(work:(tx:ProductDataTransaction,actorId:number)=>Promise<T>)=>Promise<ServiceResult<T>>;
const include={source:{select:{id:true,name:true,slug:true}},product:{include:{images:{orderBy:[{isPrimary:"desc" as const},{sortOrder:"asc" as const},{id:"asc" as const}],take:1},variants:{where:{isActive:true},orderBy:{id:"asc" as const},include:{prices:{where:{currency:"VND" as const}}}}}}} satisfies Prisma.PendingProductInclude;
type Row=Prisma.PendingProductGetPayload<{include:typeof include}>;
function item(row:Row):PendingItem {
  const p=row.product;
  return {id:row.id,version:String(row.revision),sourceProductId:row.sourceProductId,sourceName:row.source?.name??null,sourceSlug:row.source?.slug??null,
    name:p?.name??row.name,price:p?(p.variants[0]?.prices[0]?.amount.toString()??null):(row.proposedPrice?.toString()??null),imageUrl:p?(p.images[0]?.storageKey??null):(row.imageAssetId?`/images/uploads/${row.imageAssetId}.webp`:null),state:row.state as PendingItem["state"],productId:row.productId,productSlug:p?.slug??null,published:p?.isActive??false};
}
async function required(tx:ProductDataTransaction){if(!await pendingAvailable(tx))throw new ServiceError("FEATURE_UNAVAILABLE");}
async function read(tx:ProductDataTransaction,id:unknown){const row=await tx.pendingProduct.findUnique({where:{id:integer(id,"pendingId")},include});if(!row)throw new ServiceError("NOT_FOUND");return row;}
function check(row:Row,version:unknown){if(typeof version!=="string"||String(row.revision)!==version)throw new ServiceError("CONFLICT");}
export function createPendingOperations(run:Run){return {
  pendingList(input:unknown={}){return run(async tx=>{
    const v=object(input,["sourceId","page"]),page=integer(v.page??1,"page",1,100000);
    if(!await pendingAvailable(tx))return {rows:[],page,hasMore:false,available:false} satisfies PendingPage;
    const where=v.sourceId===undefined?{state:"pending"}:{sourceProductId:integer(v.sourceId,"sourceId")};
    const rows=await tx.pendingProduct.findMany({where,include,orderBy:{id:"asc"},skip:(page-1)*20,take:21});
    return {rows:rows.slice(0,20).map(item),page,hasMore:rows.length>20,available:true};
  });},
  pendingGet(id:unknown){return run(async tx=>{await required(tx);return item(await read(tx,id));});},
  async pendingCreate(sourceId:unknown,requestKey:unknown){
    for(let attempt=0;;attempt++){
      const result=await run(async(tx,actorId)=>{
        await required(tx);const parent=await tx.product.findUnique({where:{id:integer(sourceId,"sourceId")},select:{id:true}});if(!parent)throw new ServiceError("NOT_FOUND");
        if(typeof requestKey!=="string"||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(requestKey))throw new InputError("requestKey");
        await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtext(${"look:"+requestKey}))`;
        const old=await tx.pendingProduct.findUnique({where:{requestKey},include});
        if(old){if(old.createdById!==actorId||old.sourceProductId!==parent.id)throw new ServiceError("FORBIDDEN");return item(old);}
        return item(await tx.pendingProduct.create({data:{requestKey,createdById:actorId,sourceProductId:parent.id},include}));
      });
      if(result.ok||result.error.code!=="CONFLICT"||attempt>=3)return result;
    }
  },
  pendingSave(id:unknown,version:unknown,input:unknown,readImage?:()=>Promise<Uint8Array>){return run(async tx=>{
    await required(tx);const row=await read(tx,id);check(row,version);if(row.state!=="pending")throw new ServiceError("CONFLICT");
    const v=object(input,["name","price"]);if(typeof v.name!=="string"||!v.name.trim()||v.name.trim().length>200||/[\u0000-\u001f]/.test(v.name))throw new InputError("name");
    const price=money(v.price,"VND");let imageAssetId=row.imageAssetId;
    if(readImage){const image=await prepareImage(await readImage());imageAssetId=(await tx.imageAsset.create({data:{id:randomUUID(),...image},select:{id:true}})).id;}
    if(!imageAssetId)throw new InputError("imageFile");
    const saved=await tx.pendingProduct.update({where:{id:row.id},data:{name:v.name.trim(),proposedPrice:price,imageAssetId,revision:{increment:1}},include});
    if(row.imageAssetId&&row.imageAssetId!==imageAssetId)await cleanupAsset(tx,row.imageAssetId);
    return item(saved);
  });},
  pendingPatch(id:unknown,version:unknown,input:unknown,readImage?:()=>Promise<Uint8Array>){return run(async tx=>{
    await required(tx);const row=await read(tx,id);check(row,version);if(row.state!=="pending")throw new ServiceError("CONFLICT");
    const v=object(input,["name","price","removeImage"]),data:Prisma.PendingProductUncheckedUpdateInput={revision:{increment:1}};
    if(!Object.keys(v).length&&!readImage)throw new InputError("input");
    if("name" in v){if(v.name!==null&&(typeof v.name!=="string"||v.name.trim().length>200||/[\u0000-\u001f]/.test(v.name)))throw new InputError("name");data.name=typeof v.name==="string"?v.name.trim()||null:null;}
    if("price" in v)data.proposedPrice=v.price===null||v.price===""?null:money(v.price,"VND");
    if("removeImage" in v&&v.removeImage!==true)throw new InputError("removeImage");
    if(v.removeImage&&readImage)throw new InputError("imageFile");
    let imageAssetId=row.imageAssetId;
    if(v.removeImage)imageAssetId=null;
    if(readImage){const image=await prepareImage(await readImage());imageAssetId=(await tx.imageAsset.create({data:{id:randomUUID(),...image},select:{id:true}})).id;}
    if(v.removeImage||readImage)data.imageAssetId=imageAssetId;
    const saved=await tx.pendingProduct.update({where:{id:row.id},data,include});
    if(row.imageAssetId&&row.imageAssetId!==imageAssetId)await cleanupAsset(tx,row.imageAssetId);
    return item(saved);
  });},
  pendingDetach(id:unknown,version:unknown){return run(async tx=>{await required(tx);const row=await read(tx,id);check(row,version);return item(await tx.pendingProduct.update({where:{id:row.id},data:{sourceProductId:null,revision:{increment:1}},include}));});},
  async pendingConvert(id:unknown,version:unknown,input:unknown){
    for(let attempt=0;;attempt++){
      const result=await run(async tx=>{
        await required(tx);const pendingId=integer(id,"pendingId");await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(${pendingId},230023)`;
        const row=await read(tx,pendingId);
        if(row.state==="converted"){if(!row.productId)throw new ServiceError("NOT_FOUND");return dto(await load(tx,row.productId));}
        check(row,version);if(!row.name||row.proposedPrice===null||!row.imageAssetId)throw new InputError("pendingId");
        const v=object(input,editorInputFields);
        if(!Array.isArray(v.variants)||!v.variants.length)throw new InputError("variants");
        const product=await persist(tx,{...v,isActive:false,images:[{storageKey:`/images/uploads/${row.imageAssetId}.webp`,altText:typeof v.name==="string"?v.name:row.name,isPrimary:true,sortOrder:0,variantSku:"",imageType:"front",websitePermission:"granted",rightsReference:"Quản trị chọn ảnh trong Complete the Look",sourceReference:"Complete the Look intake",embeddingPermission:"unknown",trainingPermission:"unknown"}]},undefined,true);
        await tx.pendingProduct.update({where:{id:row.id},data:{state:"converted",productId:product.id,imageAssetId:null,revision:{increment:1}}});
        return product;
      });
      if(result.ok||result.error.code!=="CONFLICT"||attempt>=3)return result;
    }
  },
};}
