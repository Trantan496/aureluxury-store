"use client";
import Link from "next/link";
import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import { formatDetailPrice, selectDetailVariant, type ProductDetail,type DetailVariant } from "@/features/catalog/product-detail";
import {VariantOptionDialog} from "./variant-option-dialog";
import {defaultColourHex,variantColour,variantOption,missingVariantPairs,allocateVariantSku,sortSizeOptions,type VariantColour} from "@/features/products/variant-matrix";
import {normalizedWords} from "@/features/products/product-code";
import { optionLabel } from "@/features/products/taxonomy-labels";
import { descriptionText } from "@/features/products/description";
import { EditorialGallery, type GalleryEditor } from "./editorial-gallery";
import { ProductDescription } from "./product-description";
import { ProductRating } from "./product-rating";
import { ProductServiceBenefits } from "./product-service-benefits";
import { ProductPurchase } from "./product-purchase";
import { VirtualTryOnTrigger } from "./virtual-tryon-modal";
import type { DetailRelated } from "@/lib/product-related";
import styles from "./product-detail.module.css";
export function ProductDetailView({ product, mode, editor, related, currencyControl, initialVariantId, reviewsSlot }: { product: ProductDetail; mode: "preview" | "production"; editor?: GalleryEditor; related: DetailRelated; currencyControl?: ReactNode; initialVariantId?: string; reviewsSlot?: ReactNode }) {
  const [selectedId,setSelectedId] = useState<string | undefined>(initialVariantId), guide = useRef<HTMLDialogElement>(null);
  const [localColors,setLocalColors]=useState<VariantColour[]>([]),[localSizes,setLocalSizes]=useState<string[]>([]),[localVariants,setLocalVariants]=useState<DetailVariant[]>([]),[addingAxis,setAddingAxis]=useState<"color"|"size"|null>(null);
  const variants=mode==="preview"?[...product.variants,...localVariants.filter(v=>!product.variants.some(real=>real.color===v.color&&real.size===v.size))]:product.variants;
  const selected = selectDetailVariant(variants,selectedId);
  const colorOptions = [...new Set([...product.variants.map(v => v.color),...(mode==="preview"?localColors.map(c=>c.id):[])])], sizes = sortSizeOptions([...product.variants.map(v => v.size),...(mode==="preview"?localSizes:[])]);
  const colorName=(id:string)=>localColors.find(c=>c.id===id)?.name??product.variantColors?.[id]?.name??optionLabel(id);
  const colorHex=(id:string)=>localColors.find(c=>c.id===id)?.hex??product.variantColors?.[id]?.hex??defaultColourHex[id];
  const choose = (change: { color?: string; size?: string }) => setSelectedId(selectDetailVariant(variants,selectedId,change)?.id);
  function addDemoOption(name:string|string[],hex:string){
    if(mode!=="preview"||!addingAxis)return;
    let nextColors=colorOptions,nextSizes=sizes;
    const color=addingAxis==="color"?variantColour(name,hex):null,sizeOptions=addingAxis==="size"?(Array.isArray(name)?name:[name]).map(value=>variantOption(value,"size")):[];
    if(color){if(colorOptions.some(id=>id===color.id||normalizedWords(colorName(id))===normalizedWords(color.name)))throw Error("duplicate");nextColors=[...colorOptions,color.id];}
    if(sizeOptions.length){const ids=sizeOptions.map(size=>size.id);if(new Set(ids).size!==ids.length||ids.some(id=>sizes.includes(id)))throw Error("duplicate");nextSizes=sortSizeOptions([...sizes,...ids]);}
    const pairs=missingVariantPairs(variants,nextColors,nextSizes),used=new Set(variants.map(v=>v.sku));
    const added:DetailVariant[]=pairs.map(pair=>({...pair,id:`demo:${pair.color}:${pair.size}`,sku:allocateVariantSku("DEMO",pair.color,pair.size,used),stock:0,price:null,isActive:false}));
    if(color)setLocalColors(old=>[...old,color]);if(sizeOptions.length)setLocalSizes(old=>sortSizeOptions([...old,...sizeOptions.map(size=>size.id)]));setLocalVariants(old=>[...old,...added]);
    const firstSize=sizeOptions[0]?.id,match=added.find(v=>color?v.color===color.id&&v.size===selected?.size:v.size===firstSize&&v.color===selected?.color)??added.find(v=>color?v.color===color.id:v.size===firstSize);
    setSelectedId(match?.id??selectedId);
  }
  const preferredImage=product.images.find(i=>selected&&i.variantId===selected.id)??product.images.find(i=>product.variants.some(v=>v.id===i.variantId&&v.color===selected?.color));
  function relatedCards(rows: ProductDetail[]) {
    return <div className={styles.relatedCards}>{rows.map(p => { const primary = p.images.find(i => i.isPrimary) ?? p.images[0], price = p.variants.find(v => v.price)?.price; return <Link key={p.slug} href={`/products/${p.slug}`}><div>{primary && <Image src={primary.url} alt={primary.alt} fill sizes="(max-width:800px) 45vw, 18vw" unoptimized={primary.url.startsWith("/images/uploads/")} className={styles.editorialPhoto}/>}</div><h3>{p.name}</h3>{price && <p>{formatDetailPrice(price)}</p>}</Link>; })}</div>;
  }
  return <div className={styles.page} data-mode={mode}>
    <nav className={styles.breadcrumbs} aria-label="Đường dẫn"><Link href="/">Home</Link><span>›</span><Link href="/products">Shop</Link>{product.category && <><span>›</span><Link href={`/products?category=${product.category.slug}`}>{product.category.name}</Link></>}<span>›</span><span>{product.name}</span></nav>
    <div className={styles.layout}>
      <div className={styles.galleryColumn}>
        <div className={styles.gallerySticky}>
          <EditorialGallery images={product.images} name={product.name} variantId={selected?.id} preferredImageId={preferredImage?.id} editor={mode === "preview" ? editor : undefined}/>
          <div className={styles.galleryTryOn}>
            <VirtualTryOnTrigger
              productName={product.name}
              productImages={product.images}
              categorySlug={product.category?.slug}
              categoryName={product.category?.name}
            />
          </div>
        </div>
      </div>
      <section className={styles.information} aria-labelledby="product-title">
        <div className={styles.informationBody} role="region" aria-label="Thông tin sản phẩm" tabIndex={0}>
        <p className={styles.eyebrow}>{[product.brand,product.category?.name].filter(Boolean).join(" / ")}</p>
        <h1 id="product-title" className={styles.title}>{product.name}</h1>
        <ProductRating rating={product.rating} preview={mode === "preview"} productSlug={product.slug}/>
        <div className={styles.priceRow} aria-live="polite" aria-atomic="true">
          <p className={styles.price}>{selected?.price ? formatDetailPrice(selected.price) : "Giá chưa khả dụng"}</p>
          {selected && <p className={styles.availability}>{selected.stock > 0 ? `Còn hàng · ${selected.stock}` : "Hết hàng"}</p>}
        </div>
        {product.description && <p className={styles.summary}>{descriptionText(product.description).slice(0,240)}</p>}
        {currencyControl}
        <div className={styles.selection}>
          {selected||mode==="preview" ? <><fieldset><legend><span>COLOUR {selected?`— ${colorName(selected.color).toUpperCase()}`:""}</span>{mode==="preview"&&<button type="button" className={styles.addVariantOption} aria-label="Thêm màu Demo" onClick={()=>setAddingAxis("color")}>+</button>}</legend><div className={styles.choices}>{colorOptions.map(color=><button type="button" key={color} className={styles.colorChoice} style={{backgroundColor:colorHex(color)??"#e9e3da"}} aria-label={colorName(color)} title={colorName(color)} aria-pressed={selected?.color===color} onClick={()=>choose({color})}>{!colorHex(color)&&<span>?</span>}</button>)}</div></fieldset>
          <fieldset><legend><span>SIZE</span>{mode==="preview"&&<button type="button" className={styles.addVariantOption} aria-label="Thêm size Demo" onClick={()=>setAddingAxis("size")}>+</button>}</legend><div className={styles.sizeRow}><div className={styles.choices}>{sizes.map(size=><button type="button" key={size} className={styles.choice} aria-pressed={selected?.size===size} disabled={!variants.some(v=>v.color===selected?.color&&v.size===size)} onClick={()=>choose({size})}>{size}</button>)}</div><button type="button" className={styles.sizeGuide} onClick={()=>guide.current?.showModal()}>Size Guide</button></div></fieldset></> : <p role="status" className={styles.note}>Chưa có biến thể đang hoạt động.</p>}
          {mode==="preview"&&<div className={styles.demoVariantNote}><span>Demo màu/size chỉ lưu cục bộ; không ghi khi xuất bản.</span>{(localColors.length>0||localSizes.length>0)&&<button type="button" onClick={()=>{setLocalColors([]);setLocalSizes([]);setLocalVariants([]);setSelectedId(undefined);}}>Đặt lại Demo</button>}</div>}
          {mode==="preview"&&selected?.isActive===false&&<p className={styles.note} role="status">{selected.id.startsWith("demo:")?"Biến thể Demo chưa kích hoạt · Chưa giá · Tồn kho 0":"Biến thể chưa kích hoạt"}</p>}
          {mode === "production" ? <ProductPurchase key={product.slug} slug={product.slug} selected={selected}/> : <div className={styles.purchaseStack}><button type="button" disabled className={styles.addToBag}>ADD TO BAG</button><button type="button" disabled className={styles.buyNow}>BUY NOW</button></div>}
          <ProductServiceBenefits preview={mode === "preview"}/>
        </div>
        <div className={styles.accordions}><details><summary>Product Details</summary><ProductDescription value={product.description || "Chưa có mô tả sản phẩm."} allowedImages={product.images.map(i => i.url)}/>{selected && <p className={styles.productMeta}>SKU: {selected.sku}</p>}</details><details><summary>Size & Fit</summary><p>{product.profile?.fit ? optionLabel(product.profile.fit) : "Thông tin phom dáng chưa được cung cấp."}</p></details><details><summary>Material & Care</summary><p>{product.profile?.fabric ? optionLabel(product.profile.fabric) : "Thông tin chất liệu chưa được cung cấp."}</p></details><details><summary>Shipping & Returns</summary><p>Chính sách vận chuyển và đổi trả chưa được công bố.</p></details></div>
        </div>
        {related.similar.length > 0 && <section className={styles.related}><h2>You May Also Like</h2>{relatedCards(related.similar)}</section>}
        {mode==="preview"&&!related.similar.length&&<section className={styles.related}><h2>You May Also Like</h2><p className={styles.note}>Chờ AI Recommendations</p></section>}
        {mode === "production" && !related.similar.length && <section className={styles.related}><h2>You May Also Like</h2><p className={styles.note}><Link href={product.category ? `/products?category=${product.category.slug}` : "/products"}>Khám phá thêm {product.category ? product.category.name : "sản phẩm"} ↗</Link></p></section>}
        {reviewsSlot}
      </section>
    </div>
    {mode==="preview"&&addingAxis&&<VariantOptionDialog key={addingAxis} kind={addingAxis} existingSizes={sizes} onAdd={addDemoOption} onClose={()=>setAddingAxis(null)}/>}
    <dialog ref={guide} className={styles.mediaDialog} aria-label="Hướng dẫn kích cỡ" onClick={event => { if (event.target === event.currentTarget) guide.current?.close(); }}><div className={styles.mediaHeading}><h2>Size Guide</h2><button type="button" autoFocus onClick={() => guide.current?.close()} aria-label="Đóng hướng dẫn kích cỡ">×</button></div>{sizes.length > 0 && <p>Kích cỡ {mode === "preview" ? "đang hiển thị" : "đang được đăng bán"}: {sizes.join(" · ")}</p>}{product.profile?.fit && <p>Phom dáng: {optionLabel(product.profile.fit)}</p>}<p>Bảng số đo chi tiết của sản phẩm chưa được cung cấp.</p></dialog>
  </div>;
}
