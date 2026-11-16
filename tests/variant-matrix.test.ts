import test from "node:test";
import assert from "node:assert/strict";
import {variantColour,variantOption,missingVariantPairs,allocateVariantSku,sortSizeOptions} from "../src/features/products/variant-matrix.ts";
import {editorDraft,newVariant,completeDraftVariants} from "../src/features/products/editor-state.ts";
test("3 colors by 3 sizes creates nine unique pairs and never recreates existing inactive pairs",()=>{
  const pairs=missingVariantPairs([], ["black","white","beige","black"],["XS","S","M","M"]);assert.equal(pairs.length,9);
  assert.equal(missingVariantPairs(pairs,["black","white","beige"],["XS","S","M"]).length,0);
  assert.throws(()=>missingVariantPairs([],Array.from({length:15},(_,i)=>String(i)),Array.from({length:15},(_,i)=>String(i))));
  assert.deepEqual(missingVariantPairs([], ["black"],[]),[]);
});
test("option IDs normalize Unicode and case; HEX never accepts CSS content",()=>{
  assert.deepEqual(variantColour(" Xanh Rêu ","#aabbcc"),{id:"xanh-reu",name:"Xanh Rêu",hex:"#AABBCC"});
  assert.equal(variantOption(" xs ","size").id,"XS");assert.equal(variantOption("X","size").id,"X");
  for(const hex of ["red","#fff","#12345678","url(x)"])assert.throws(()=>variantColour("Olive",hex));
  for(const name of ["","<b>","abc\n"])assert.throws(()=>variantOption(name,"size"));
});
test("SKU allocation distinguishes ambiguous hyphenated pairs and reserves every result",()=>{
  const used=new Set<string>();const a=allocateVariantSku("AUR-UNIT-001","dark-red","S",used),b=allocateVariantSku("AUR-UNIT-001","dark","RED-S",used);assert.notEqual(a,b);assert.match(b,/-V1$/);assert.equal(used.size,2);
});
test("size options sort apparel and numeric sizes from small to large",()=>{
  assert.deepEqual(sortSizeOptions(["XL","M","XS","S","L","XXL","XXS"]),["XXS","XS","S","M","L","XL","XXL"]);
  assert.deepEqual(sortSizeOptions(["40","36","38","M","S"]),["36","38","40","S","M"]);
});
test("editor matrix keeps real IDs/prices and creates only missing zero-stock inactive rows",()=>{
  const draft=editorDraft(null);const first={...newVariant("first"),id:1,sku:"AUR-UNIT-001-BLACK-M",stock:"9",prices:{VND:"999000",USD:"",EUR:""}};
  draft.variants=[first,{...newVariant("second"),color:"white",size:"S"}];
  const expanded=completeDraftVariants(draft,"AUR-UNIT-001");assert.equal(expanded.variants.length,4);assert.deepEqual(expanded.variants[0],first);
  for(const v of expanded.variants.slice(2)){assert.equal(v.stock,"0");assert.equal(v.isActive,false);assert.equal(v.prices.VND,"");}
  assert.equal(completeDraftVariants(expanded,"AUR-UNIT-001").variants.length,4);
});
