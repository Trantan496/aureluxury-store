import "server-only";
import {checked,load,dto} from "./management.ts";
import {ServiceError,type ProductDataTransaction,type ServiceResult} from "./product-service.ts";
import {object,InputError} from "./validation.ts";
import {readTaxonomy} from "./taxonomy-registry.ts";
import {optionLabel} from "./taxonomy-labels.ts";
import {normalizedWords} from "./product-code.ts";
import {variantColour,variantOption,missingVariantPairs,allocateVariantSku} from "./variant-matrix.ts";
import {variantColourCapability,readVariantColours} from "./variant-colours.ts";
type Run=<T>(work:(tx:ProductDataTransaction,actorId:number)=>Promise<T>)=>Promise<ServiceResult<T>>;
export function createVariantOperations(run:Run){return {
  managementExpandVariants(id:unknown,version:unknown,input:unknown){return run(async tx=>{
    const row=await checked(tx,id,version);
    if(row.isActive)throw new InputError("draftRequired");
    const v=object(input,["colors","sizes"]);
    if(!Array.isArray(v.colors)||!Array.isArray(v.sizes)||v.colors.length>40||v.sizes.length>40||!v.colors.length&&!v.sizes.length)throw new InputError("variants");
    const feed=await readTaxonomy(tx);
    if(!feed.extended||!await variantColourCapability(tx))throw new ServiceError("FEATURE_UNAVAILABLE");
    if(!row.productCode)throw new InputError("productCode");
    const colors=v.colors.map(raw=>{const value=object(raw,["name","hex"]),parsed=variantColour(value.name,value.hex);const found=feed.values.color.find(c=>c.token===parsed.id||normalizedWords(optionLabel(c.token,c.label))===normalizedWords(parsed.name));return {...parsed,id:found?.token??parsed.id,name:found?optionLabel(found.token,found.label):parsed.name};});
    const sizes=v.sizes.map(raw=>{const parsed=variantOption(raw,"size"),found=feed.values.size.find(s=>s.token===parsed.id||normalizedWords(optionLabel(s.token,s.label))===normalizedWords(parsed.name));return {...parsed,id:found?.token??parsed.id};});
    if(new Set(colors.map(c=>c.id)).size!==colors.length||new Set(sizes.map(s=>s.id)).size!==sizes.length)throw new InputError("duplicateOption");
    const pairs=missingVariantPairs(row.variants,[...row.variants.map(r=>r.color),...colors.map(c=>c.id)],[...row.variants.map(r=>r.size),...sizes.map(s=>s.id)]);
    if(!row.variants.length&&(!colors.length||!sizes.length))throw new InputError("variants");
    for(const color of colors){
      const old=await tx.taxonomyOption.findUnique({where:{key_token:{key:"color",token:color.id}},select:{hex:true}});
      if(old){if(old.hex!==color.hex)throw new InputError("hex");continue;}
      if(!old&&await tx.taxonomyOption.count()>=2000)throw new InputError("taxonomyLimit");
      await tx.taxonomyOption.create({data:{key:"color",token:color.id,label:color.name,hex:color.hex}});
    }
    for(const size of sizes){
      if(feed.values.size.some(v=>v.token===size.id))continue;
      if(await tx.taxonomyOption.count()>=2000)throw new InputError("taxonomyLimit");
      await tx.taxonomyOption.create({data:{key:"size",token:size.id,label:size.name}});
    }
    const existing=await tx.productVariant.findMany({where:{sku:{startsWith:row.productCode+"-"}},select:{sku:true},take:2001});
    if(existing.length>2000)throw new InputError("sku");
    const used=new Set(existing.map(v=>v.sku));
    for(const pair of pairs)await tx.productVariant.create({data:{productId:row.id,...pair,sku:allocateVariantSku(row.productCode,pair.color,pair.size,used),stock:0,isActive:false}});
    const saved=await load(tx,row.id);
    return {...dto(saved),variantColors:await readVariantColours(tx,saved.variants.map(v=>v.color)),created:pairs.length};
  });},
};}
