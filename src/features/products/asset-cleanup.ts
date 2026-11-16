import type { ProductDataTransaction } from "./product-service.ts";
export async function pendingAvailable(tx:Pick<ProductDataTransaction,"$queryRaw">) {
  return (await tx.$queryRaw<{available:boolean}[]>`SELECT to_regclass('public."PendingProduct"') IS NOT NULL AS available`)[0]?.available === true;
}
export async function cleanupAsset(tx:ProductDataTransaction,id:string) {
  if(await tx.productImage.count({where:{storageKey:`/images/uploads/${id}.webp`}}))return;
  if(await pendingAvailable(tx) && await tx.pendingProduct.count({where:{imageAssetId:id}}))return;
  await tx.imageAsset.deleteMany({where:{id}});
}
