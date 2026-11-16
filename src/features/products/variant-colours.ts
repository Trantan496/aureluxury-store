import "server-only";
import type {ProductDataTransaction} from "./product-service.ts";
import type {VariantColours} from "./variant-matrix.ts";
export async function variantColourCapability(tx:Pick<ProductDataTransaction,"$queryRaw">){
  const rows=await tx.$queryRaw<{ready:boolean}[]>`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='TaxonomyOption' AND column_name='hex') AS ready`;
  return rows[0]?.ready===true;
}
export async function readVariantColours(tx:Pick<ProductDataTransaction,"$queryRaw"|"taxonomyOption">,tokens:readonly string[]):Promise<VariantColours>{
  if(!tokens.length||!await variantColourCapability(tx))return {};
  const rows=await tx.taxonomyOption.findMany({where:{key:"color",token:{in:[...new Set(tokens)]}},select:{token:true,label:true,hex:true}});
  return Object.fromEntries(rows.flatMap(row=>row.hex?[[row.token,{name:row.label,hex:row.hex}]]:[]));
}
