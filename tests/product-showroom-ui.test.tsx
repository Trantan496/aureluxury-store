import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProductDetail } from "../src/features/catalog/product-detail.ts";
// Node-only rendering: CSS is compiled by Next build separately; no browser or screenshots.
const imageModule=new URL("../node_modules/next/image.js",import.meta.url).href;
registerHooks({resolve(specifier,context,next){if(specifier==="next/image")return {url:imageModule+"?node-interop",shortCircuit:true};return next(specifier,context);},load(url,context,next){if(url.endsWith("?node-interop"))return {format:"module",source:`import image from ${JSON.stringify(imageModule)}; export default image.default ?? image;`,shortCircuit:true};if(url.endsWith(".module.css"))return {format:"module",source:'export default new Proxy({}, { get: (_, key) => String(key) });',shortCircuit:true};return next(url,context);}});
const {ProductDetailView}=await import("../src/components/products/product-detail-view.tsx");
const {ProductEditor}=await import("../src/components/admin/product-editor.tsx");
const {CategoryPicker}=await import("../src/components/admin/category-picker.tsx");
const {ProductSidebar}=await import("../src/components/admin/product-sidebar.tsx");
const {PathnameContext}=await import("next/dist/shared/lib/hooks-client-context.shared-runtime.js");
const {ProductRating}=await import("../src/components/products/product-rating.tsx");
const {ProductServiceBenefits}=await import("../src/components/products/product-service-benefits.tsx");
const {CompleteLook,PendingLookCard}=await import("../src/components/products/complete-look.tsx");
const {AppRouterContext}=await import("next/dist/shared/lib/app-router-context.shared-runtime.js");
const empty:ProductDetail={slug:"unit-showroom",name:"Unit fixture only",brand:null,description:null,category:null,currency:null,variants:[],images:[]};
test("gender category palette retains legacy selection and supports an empty database",()=>{
 const props={gender:"women",value:"8",categories:[{id:8,name:"Legacy category",slug:"legacy"}],busy:false,onChoose:async()=>true,onExisting:()=>{},onAdd:()=>{}};
 const html=renderToStaticMarkup(createElement(CategoryPicker,props));
 assert.match(html,/Danh mục Nữ/);assert.match(html,/Đầm/);assert.doesNotMatch(html,/Áo Polo/);
 assert.match(html,/Legacy category/);assert.match(html,/aria-hidden="true"/);assert.match(html,/Thêm danh mục/);
 const emptyHtml=renderToStaticMarkup(createElement(CategoryPicker,{...props,categories:[],value:""}));
 assert.match(emptyHtml,/Chọn một loại trang phục để tạo danh mục đầu tiên/);assert.match(emptyHtml,/required/);
});
test("Admin sidebar renders brand, core navigation and removes deprecated sections",()=>{
 const html=renderToStaticMarkup(createElement(PathnameContext.Provider,{value:"/admin/products"},createElement(ProductSidebar,{categories:[{id:1,name:"Shirts"}],collections:["summer-edit","workwear"],rows:[{id:7,name:"Real linked product",categoryId:1,collection:"summer-edit"}],limited:false})));
 assert.match(html,/AUREL/);
 assert.match(html,/Tổng quan/);
 assert.match(html,/Đơn hàng/);
 assert.match(html,/Sản phẩm/);
 assert.match(html,/aria-current="page"/);
 assert.match(html,/Quản trị bán hàng/);
 assert.doesNotMatch(html,/Bộ sưu tập/);
 assert.doesNotMatch(html,/Tra cứu danh mục/);
 assert.doesNotMatch(html,/Nhập \/ xuất CSV/);
});
const related={look:[],similar:[]};
test("both modes display the saved VND amount and no fabricated review count",()=>{
 const product:ProductDetail={...empty,name:"AUREL Collection Limited Edition Long Product Name Preserved In Full",currency:"VND",variants:[{id:"1",sku:"U-1",color:"beige",size:"M",stock:0,price:{amount:"999000",currency:"VND"}}]};
 for(const mode of ["preview","production"] as const){const html=renderToStaticMarkup(createElement(ProductDetailView,{product,mode,related}));assert.match(html,/999\.000/);assert.doesNotMatch(html,/Giá chưa khả dụng|GIÁ DEMO|99 reviews/);if(mode==="production")assert.doesNotMatch(html,/1 review|DEMO|Chưa cấu hình/);else assert.match(html,/DEMO · Chưa có đánh giá thực/);assert.ok(html.includes(product.name));assert.match(html,/Hết hàng/);assert.match(html,/<details><summary>Product Details<\/summary>[\s\S]*?SKU: U-1<\/p><\/details>/);assert.doesNotMatch(html,/>XS<|>S<|>L</);}
});
test("preview renders direct cover and three editorial upload slots, production contains no upload controls",()=>{
 const preview=renderToStaticMarkup(createElement(ProductDetailView,{product:empty,mode:"preview",related,editor:{busy:false,upload:async()=>true,action:async()=>true}}));
 assert.match(preview,/Thêm ảnh chính/);assert.match(preview,/Thêm ảnh chất liệu/);assert.match(preview,/Thêm ảnh chi tiết/);assert.match(preview,/Thêm ảnh phom dáng/);assert.match(preview,/type="file"/);
 const populated={...empty,images:[{id:"1",url:"/images/unit.jpg",alt:"Unit cover",isPrimary:true}]};
 const editable=renderToStaticMarkup(createElement(ProductDetailView,{product:populated,mode:"preview",related,editor:{busy:false,upload:async()=>true,action:async()=>true}}));
 assert.match(editable,/Tùy chọn ảnh 1/);assert.match(editable,/aria-haspopup="dialog"/);assert.match(editable,/draggable="true"/);assert.doesNotMatch(editable,/class="galleryOrder"|Đưa ảnh lên trước|Đưa ảnh về sau/);
 const publicImages=renderToStaticMarkup(createElement(ProductDetailView,{product:populated,mode:"production",related}));assert.doesNotMatch(publicImages,/thumbMenuButton|Tùy chọn ảnh|draggable="true"/);
 const production=renderToStaticMarkup(createElement(ProductDetailView,{product:empty,mode:"production",related}));
 assert.doesNotMatch(production,/type="file"|Thêm ảnh chính|Thay hình ảnh|mediaActions/);
 assert.match(production,/<button[^>]*disabled=""[^>]*class="addToBag"[^>]*><svg[\s\S]*?<\/svg>ADD TO BAG<\/button>/);assert.match(production,/<button[^>]*disabled=""[^>]*>BUY NOW<\/button>/);
 assert.doesNotMatch(production,/Complete.*Look|You May Also Like|99 reviews|649\.000/);
 assert.doesNotMatch(preview,/GIÁ DEMO|649\.000/);assert.match(preview,/1 review/);assert.match(preview,/DEMO · Chưa có đánh giá thực/);assert.equal((preview.match(/Chưa cấu hình · PREVIEW/g)||[]).length,3);assert.doesNotMatch(production,/★★★★★|5\/5|Chưa có đánh giá|1 review|99 reviews|Chưa cấu hình/);
});

test("rating accepts real summaries and never fabricates public reviews",()=>{
 const actual=renderToStaticMarkup(createElement(ProductRating,{rating:{average:4.8,count:12}}));assert.match(actual,/4\.8/);assert.match(actual,/12 reviews/);assert.doesNotMatch(actual,/DEMO/);
 for(const rating of [undefined,{average:5,count:0},{average:NaN,count:1},{average:6,count:1}])assert.equal(renderToStaticMarkup(createElement(ProductRating,{rating})),"");
 const demo=renderToStaticMarkup(createElement(ProductRating,{preview:true}));assert.match(demo,/1 review/);assert.match(demo,/DEMO/);
});

test("service policies hide absent public claims, show Admin placeholders and link configured policies",()=>{
 assert.equal(renderToStaticMarkup(createElement(ProductServiceBenefits,{})),"");
 const preview=renderToStaticMarkup(createElement(ProductServiceBenefits,{preview:true}));assert.equal((preview.match(/Chưa cấu hình · PREVIEW/g)||[]).length,3);assert.doesNotMatch(preview,/499|30 days|SSL/);
 const actual=renderToStaticMarkup(createElement(ProductServiceBenefits,{policies:{shipping:{text:"Unit policy text",href:"/unit-policy"},returns:null,payment:null}}));assert.match(actual,/href="\/unit-policy"/);assert.match(actual,/Unit policy text/);assert.doesNotMatch(actual,/Chưa cấu hình/);
});

test("size range uses only configured variants and disables absent color-size combinations",()=>{
 const variants=[{id:"1",sku:"U-1",color:"black",size:"M",stock:1,price:null},{id:"2",sku:"U-2",color:"beige",size:"L",stock:0,price:null}];
 const html=renderToStaticMarkup(createElement(ProductDetailView,{product:{...empty,variants},mode:"production",related}));assert.match(html,/>M<\/button>/);assert.match(html,/<button[^>]*disabled=""[^>]*>L<\/button>/);assert.doesNotMatch(html,/>XS<|>S</);
});
test("both modes render the same actual photos and information hierarchy",()=>{
 const product={...empty,images:[{id:"1",url:"/images/unit.jpg",alt:"Actual unit",isPrimary:true,imageType:"front"},{id:"2",url:"/images/fabric.jpg",alt:"Fabric unit",isPrimary:false,imageType:"other"}]};
 for(const mode of ["preview","production"] as const){const html=renderToStaticMarkup(createElement(ProductDetailView,{product,mode,related,...(mode==="preview"?{editor:{busy:false,upload:async()=>true,action:async()=>true}}:{})}));assert.match(html,/Actual unit/);assert.match(html,/Fabric unit/);assert.match(html,/Premium Fabric/);assert.match(html,/Unit fixture only/);assert.match(html,/Product Details/);}
});

test("both modes place full information in a labelled focusable region and recommendations outside it",()=>{
 const product:ProductDetail={...empty,name:"AUREL Long Product Name Kept In Full For A Scrollable Information Panel",description:"Actual description kept in native Product Details.",variants:[{id:"1",sku:"U-1",color:"black",size:"M",stock:1,price:null},{id:"2",sku:"U-2",color:"black",size:"L",stock:0,price:null}]};
 const suggestion:ProductDetail={...empty,slug:"unit-related",name:"Unit related catalog record",images:[{id:"9",url:"/images/unit.jpg",alt:"Related unit"}]};
 for(const mode of ["preview","production"] as const){
  const html=renderToStaticMarkup(createElement(ProductDetailView,{product,mode,related:{look:[suggestion],similar:[suggestion]}}));
  const opening=/<div class="informationBody" role="region" aria-label="Thông tin sản phẩm" tabindex="0">/.exec(html);assert.ok(opening);
  const start=opening.index+opening[0].length;let depth=1,end=-1;
  for(const match of html.slice(start).matchAll(/<div\b[^>]*>|<\/div>/g)){depth+=match[0].startsWith("</")?-1:1;if(!depth){end=start+match.index!;break;}}
  assert.ok(end>start);const body=html.slice(start,end);
  assert.ok(body.includes(product.name));assert.match(body,/Actual description/);assert.match(body,/>M<\/button>/);assert.match(body,/>L<\/button>/);assert.equal((body.match(/<details>/g)||[]).length,4);
  assert.match(body,/<button[^>]*disabled=""[^>]*class="addToBag"/);assert.match(body,/<button[^>]*disabled=""[^>]*class="buyNow"/);
  assert.doesNotMatch(body,/You May Also Like|Complete.*Look|Unit related catalog record/);
  assert.match(html.slice(end),/You May Also Like/);assert.match(html.slice(0,opening.index),/Complete<br\/>the Look/);
 }
});
test("Step1 has Next only, preserves structured fields and contains no product image/summary sidebar",()=>{
 const keys=["collar","fabric","gender","fit","garmentType","styleTags","seasonTags","occasionTags","layerRole","pattern","silhouette","color","size"];
 const taxonomy={extended:false,values:Object.fromEntries(keys.map(k=>[k,[]]))};
 const router={bfcacheId:"unit-only",back(){},forward(){},refresh(){},push(){},replace(){},prefetch(){}};
 const html=renderToStaticMarkup(createElement(AppRouterContext.Provider,{value:router},createElement(ProductEditor,{product:null,categories:[{id:1,name:"Unit category",slug:"unit"}],taxonomy} as unknown as Parameters<typeof ProductEditor>[0])));
 assert.match(html,/Tiếp theo/);assert.doesNotMatch(html,/Lưu nháp|Lưu sản phẩm|Hình ảnh sản phẩm|Xem trước sản phẩm|Kho ảnh|type="file"/);
 assert.match(html,/Thuộc tính &amp; dữ liệu AI/);assert.match(html,/Tên sản phẩm/);assert.match(html,/Biến thể/);
});

test("manual look renders more than four genuine products and no public intake controls",()=>{
 const products=Array.from({length:6},(_,i)=>({...empty,slug:`look-unit-${i}`,name:`Linked unit ${i}`,images:[{id:String(i),url:"/images/unit.jpg",alt:`Unit ${i}`}]}));
 const html=renderToStaticMarkup(createElement(CompleteLook,{product:empty,initial:products,hasMore:true}));
 assert.doesNotMatch(html,/aria-label="Món trước"|aria-label="Món sau"/);
 assert.match(html,/class="railStatus" data-error="false"/);
 for(const p of products)assert.ok(html.includes(p.name));assert.match(html,/Tải thêm món/);assert.doesNotMatch(html,/Thêm món|Giá VND|Lưu món|Hoàn thiện/);
 const preview=renderToStaticMarkup(createElement(ProductDetailView,{product:empty,mode:"preview",related}));assert.doesNotMatch(preview,/Complete the Look|Thêm món|EXPLORE THE SHOP/);assert.match(preview,/Chờ AI Recommendations/);
 const production=renderToStaticMarkup(createElement(ProductDetailView,{product:empty,mode:"production",related}));assert.doesNotMatch(production,/Chờ AI|Thêm món|You May Also Like/);
});

test("pending cards expose inline image/name/price editing and no long form",()=>{
 const row={id:1,version:"1",sourceProductId:2,sourceName:"Unit parent",sourceSlug:"unit-parent",name:"Pending unit",price:"100000",imageUrl:"/images/unit.jpg",state:"pending" as const,productId:null,productSlug:null,published:false};
 const html=renderToStaticMarkup(createElement(PendingLookCard,{row,onSaved(){}}));assert.match(html,/type="file" hidden=""/);assert.match(html,/Pending unit/);assert.match(html,/100\.000/);assert.match(html,/Bỏ ảnh món phối đồ/);assert.doesNotMatch(html,/<form|Lưu món/);assert.match(html,/\/admin\/products\/pending\/1/);
 const controls=renderToStaticMarkup(createElement(PendingLookCard,{row,onSaved(){},onDetached(){}}));assert.match(controls,/<details class="cardTools"/);assert.match(controls,/Tùy chọn món phối đồ/);assert.match(controls,/data-active="false"/);
 const empty=renderToStaticMarkup(createElement(PendingLookCard,{row:{...row,name:null,price:null,imageUrl:null},onSaved(){}}));assert.match(empty,/Thêm tên/);assert.match(empty,/Thêm giá/);assert.match(empty,/data-placeholder="true"/);assert.doesNotMatch(empty,/\/admin\/products\/pending\/1/);
 const converted=renderToStaticMarkup(createElement(PendingLookCard,{row:{...row,state:"converted",productId:3,productSlug:"converted-unit"},onSaved(){}}));assert.match(converted,/\/admin\/products\/3/);assert.doesNotMatch(converted,/type="file"|Lưu món/);
});

test("dynamic option controls are Preview-only and preserve real HEX and selected variant image",()=>{
 const product:ProductDetail={...empty,variantColors:{olive:{name:"Olive custom",hex:"#123456"}},variants:[{id:"1",sku:"UNIT-BLACK-M",color:"black",size:"M",stock:0,price:null},{id:"2",sku:"UNIT-OLIVE-M",color:"olive",size:"M",stock:3,price:{amount:"123400",currency:"VND"}}],images:[{id:"cover",url:"/images/uploads/cover.webp",alt:"Cover",isPrimary:true},{id:"variant",url:"/images/uploads/variant.webp",alt:"Variant photo",variantId:"2"}]};
 const preview=renderToStaticMarkup(createElement(ProductDetailView,{product,mode:"preview",related}));assert.match(preview,/aria-label="Thêm màu Demo"/);assert.match(preview,/aria-label="Thêm size Demo"/);assert.match(preview,/không ghi khi xuất bản/);
 const production=renderToStaticMarkup(createElement(ProductDetailView,{product,mode:"production",related}));assert.doesNotMatch(production,/Thêm màu Demo|Thêm size Demo|chỉ lưu cục bộ|variantDialog/);assert.match(production,/background-color:#123456/);assert.match(production,/Olive custom/);assert.match(production,/123\.400 VND/);assert.match(production,/data-variant-id="2"/);
 const main=production.slice(production.indexOf('class="photoSlot editorialMain"'));assert.match(main.slice(0,main.indexOf('class="galleryBrowse"')),/src="\/images\/uploads\/variant.webp"/);
 assert.match(production,/<button[^>]*disabled=""[^>]*class="addToBag"/);
 const blank=renderToStaticMarkup(createElement(ProductDetailView,{product:empty,mode:"preview",related}));assert.match(blank,/Thêm màu Demo/);assert.match(blank,/Thêm size Demo/);
});
