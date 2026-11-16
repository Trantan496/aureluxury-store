"use client";
import Image from "next/image";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import type {PendingItem,PendingPage} from "@/features/products/pending-types";
import {formatDetailPrice,type ProductDetail} from "@/features/catalog/product-detail";
import {lookRequest} from "@/components/admin/look-client";
import styles from "./complete-look.module.css";
import {PendingLookCard} from "./pending-look-card";
export {PendingLookCard} from "./pending-look-card";

export function CompleteLook({product,initial,hasMore=false,preview=false,sourceId}:{product:ProductDetail;initial:ProductDetail[];hasMore?:boolean;preview?:boolean;sourceId?:number}){
  const [rows,setRows]=useState<PendingItem[]>([]),[products,setProducts]=useState(initial),[page,setPage]=useState(1),[more,setMore]=useState(hasMore),[available,setAvailable]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [focusId,setFocusId]=useState<number>();
  const [error,setError]=useState(false);
  const rail=useRef<HTMLDivElement>(null),lock=useRef(false),requestKey=useRef<string|undefined>(undefined);
  const [scrollEdges,setScrollEdges]=useState({previous:false,next:false});
  useEffect(()=>{
    const node=rail.current;if(!node)return;
    const update=()=>{const end=node.scrollWidth-node.clientWidth,next={previous:node.scrollLeft>2,next:end-node.scrollLeft>2};setScrollEdges(old=>old.previous===next.previous&&old.next===next.next?old:next);};
    const observer=new ResizeObserver(update);observer.observe(node);for(const child of node.children)observer.observe(child);
    node.addEventListener("scroll",update,{passive:true});update();
    return()=>{observer.disconnect();node.removeEventListener("scroll",update);};
  },[rows.length,products.length,preview]);
  async function load(next:number,signal?:AbortSignal){
    const response=await fetch(preview?`/api/admin/look?sourceId=${sourceId}&page=${next}`:`/api/products/${product.slug}/look?page=${next}${product.currency?`&currency=${product.currency}`:""}`,{cache:"no-store",signal});
    const result=await response.json();if(!response.ok||preview&&!result.ok)throw new Error("Không thể tải danh sách phối đồ.");
    if(preview){const data=result.data as PendingPage;setAvailable(data.available);setRows(old=>[...new Map([...old,...data.rows].map(row=>[row.id,row])).values()].sort((a,b)=>a.id-b.id));setMore(data.hasMore);}else {const data=result as {rows:ProductDetail[];hasMore:boolean};setProducts(old=>[...new Map([...old,...data.rows].map(row=>[row.slug,row])).values()]);setMore(data.hasMore);}
    setPage(next);
  }
  useEffect(()=>{if(!preview||!sourceId)return;const controller=new AbortController();const timer=setTimeout(()=>{void load(1,controller.signal).catch(error=>{if(!controller.signal.aborted){setError(true);setMessage(error.message);}});},0);return()=>{clearTimeout(timer);controller.abort();};},[preview,sourceId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function run(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError(false);setMessage("");try{await work();}catch(error){setError(true);setMessage(error instanceof Error?error.message:"Không thể cập nhật.");}finally{lock.current=false;setBusy(false);}}
  return <section className={styles.lookPanel} data-empty={preview?rows.length===0:products.length===0} aria-label="Complete the Look"><div className={styles.lookHeading}><h2>Complete<br/>the Look</h2><p>Curated pieces that go<br/>perfectly together.</p>{preview || products.length > 0 ? <button type="button" className={styles.shopLook} onClick={()=>{rail.current?.focus();rail.current?.scrollTo({left:0,behavior:"auto"});}}>SHOP THE LOOK <span aria-hidden="true">→</span></button> : <Link href="/products" className={styles.shopLook}>EXPLORE THE SHOP <span aria-hidden="true">→</span></Link>}</div>
    <div className={styles.railFrame}>
      {(scrollEdges.previous||scrollEdges.next)&&<div className={styles.railNavigation}><button type="button" hidden={!scrollEdges.previous} aria-label="Món trước" onClick={()=>rail.current?.scrollBy({left:-rail.current.clientWidth*.8,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}>‹</button><button type="button" hidden={!scrollEdges.next} aria-label="Món sau" onClick={()=>rail.current?.scrollBy({left:rail.current.clientWidth*.8,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}>›</button></div>}
    <div ref={rail} className={styles.lookRail} tabIndex={0} role="region" aria-label="Các món phối cùng">
      {preview?rows.map(row=><PendingLookCard key={row.id} row={row} autoFocus={focusId===row.id} onSaved={saved=>setRows(old=>old.map(item=>item.id===saved.id?saved:item))} onDetached={id=>setRows(old=>old.filter(item=>item.id!==id))}/>):products.map(p=>{const image=p.images.find(i=>i.isPrimary)??p.images[0],price=p.variants.find(v=>v.price)?.price;return <Link className={styles.lookCard} key={p.slug} href={`/products/${p.slug}`}><div className={styles.cardPhoto}>{image&&<Image src={image.url} alt={image.alt} fill unoptimized={image.url.startsWith("/images/uploads/")} sizes="210px"/>}</div><div className={styles.cardDetails}><h3>{p.name}</h3>{price&&<p>{formatDetailPrice(price)}</p>}<span className={styles.cardOpen} aria-hidden="true">+</span></div></Link>;})}
      {!preview && !products.length && <div className={styles.lookEmpty}><p>Các món phối cùng đang được chuẩn bị.</p><Link href="/products">Khám phá sản phẩm đang đăng bán ↗</Link></div>}
      {preview&&<button type="button" className={styles.addLook} disabled={busy||!sourceId||!available} onClick={()=>void run(async()=>{const key=requestKey.current??crypto.randomUUID();requestKey.current=key;const row=await lookRequest<PendingItem>({operation:"create",sourceId,requestKey:key});requestKey.current=undefined;setFocusId(row.id);setRows(old=>[...new Map([...old,row].map(item=>[item.id,item])).values()].sort((a,b)=>a.id-b.id));setMessage("Đã tạo ô chờ xử lý.");rail.current?.scrollTo({left:rail.current.scrollWidth,behavior:"smooth"});})}><span aria-hidden="true">+</span><span>Thêm món</span></button>}
    </div>
    </div>
    {more&&<button type="button" className={styles.loadMore} disabled={busy} onClick={()=>void run(()=>load(page+1))}>Tải thêm món</button>}
    {!available&&<p role="status">Complete the Look chưa được bật trên database này.</p>}<p role={error?"alert":"status"} className={styles.railStatus} data-error={error}>{message}</p>
  </section>;
}
