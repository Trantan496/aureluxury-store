import test from "node:test";
import assert from "node:assert/strict";
import { galleryAssignments } from "../src/features/products/gallery.ts";
import { showroomProduct } from "../src/features/products/showroom-model.ts";
import type { ManagementDTO } from "../src/features/products/management.ts";
test("gallery roles preserve explicit empty cover and real optional editorial slots", () => {
  const fabric = { id:"1",url:"/images/unit.webp",alt:"Unit only",imageType:"other",isPrimary:false };
  assert.equal(galleryAssignments([fabric],true).cover,undefined);
  assert.equal(galleryAssignments([fabric],true).fabric?.id,"1");
  assert.equal(galleryAssignments([fabric]).cover?.id,"1");
  const cover = {...fabric,id:"2",imageType:"front",isPrimary:true};
  assert.equal(galleryAssignments([fabric,cover],true).cover?.id,"2");
  assert.equal(galleryAssignments([fabric,cover],true).fabric?.id,"1");
});
test("showroom normalized model hides unassigned legacy amounts and preserves role/order/variant association", () => {
  const row = {slug:"unit-only",name:"Unit only",brand:null,description:null,category:{name:"Unit",slug:"unit"},profile:null,variants:[{id:1,sku:"U-1",color:"black",size:"M",stock:2,isActive:true,prices:[{currency:"VND",amount:"120000"}]}],images:[{id:1,storageKey:"/images/unit.jpg",altText:null,sortOrder:2,imageType:"other",isPrimary:false,variantId:1}]} as ManagementDTO;
  const disabled=showroomProduct(row,"VND",false);assert.equal(disabled.variants[0].price?.amount,"120000");
  assert.equal(showroomProduct(row).currency,"VND");
  assert.equal(showroomProduct(row,"USD",false).variants[0].price?.currency,"VND");
  assert.equal(showroomProduct(row,"USD",true).variants[0].price,null);
  assert.equal(showroomProduct({...row,variants:[{...row.variants[0],prices:[]}]},undefined,false).variants[0].price,null);
  const enabled=showroomProduct(row,"VND",true);assert.equal(enabled.variants[0].price?.amount,"120000");
  assert.equal(enabled.images[0].variantId,"1");assert.equal(enabled.images[0].imageType,"other");assert.equal(enabled.images[0].sortOrder,2);
});
