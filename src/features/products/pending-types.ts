export type PendingItem = {
  id:number; version:string; sourceProductId:number|null; sourceName:string|null; sourceSlug:string|null;
  name:string|null; price:string|null; imageUrl:string|null; state:"pending"|"converted";
  productId:number|null; productSlug:string|null; published:boolean;
};
export type PendingPage = { rows:PendingItem[]; page:number; hasMore:boolean; available:boolean };
