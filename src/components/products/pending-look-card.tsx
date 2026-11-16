"use client";
import Image from "next/image";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import type {PendingItem} from "@/features/products/pending-types";
import {PendingAutosave,type PendingChange} from "@/features/products/pending-autosave";
import {formatDetailPrice} from "@/features/catalog/product-detail";
import {lookRequest,reloadPending} from "@/components/admin/look-client";
import styles from "./complete-look.module.css";

export function PendingLookCard({row,onSaved,onDetached,autoFocus=false}:{row:PendingItem;onSaved:(row:PendingItem)=>void;onDetached?:(id:number)=>void;autoFocus?:boolean}){
  const [name,setName]=useState(row.name??""),[price,setPrice]=useState(row.price??""),[saved,setSaved]=useState(row);
  const [editing,setEditing]=useState<"name"|"price"|null>(null),[preview,setPreview]=useState<{url:string|null;token:string}>(),[validation,setValidation]=useState(""),[detaching,setDetaching]=useState(false),[over,setOver]=useState(false);
  const [,render]=useState(0),fileInput=useRef<HTMLInputElement>(null),article=useRef<HTMLElement>(null),cancel=useRef(false),start=useRef("");
  const desired=useRef({name:row.name??"",price:row.price??""});
  const [autosave]=useState(()=>new PendingAutosave(row,(current,change)=>lookRequest<PendingItem>({operation:"patch",id:current.id,version:current.version,input:change.input},change.file),(next,change)=>{
    setSaved(next);onSaved(next);if(change.imageToken)setPreview(current=>current?.token===change.imageToken?undefined:current);
  },()=>render(n=>n+1)));
  useEffect(()=>()=>{if(preview?.url)URL.revokeObjectURL(preview.url);},[preview]);
  useEffect(()=>{if(autoFocus){article.current?.focus();article.current?.scrollIntoView({block:"nearest",inline:"nearest"});}},[autoFocus]);
  function enqueue(change:PendingChange){setValidation("");void autosave.enqueue(change);}
  function choose(file?:File){
    if(!file)return;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>8*1024*1024){setValidation("Chọn JPG, PNG, WebP tối đa 8 MB.");return;}
    const token=crypto.randomUUID();setPreview({url:URL.createObjectURL(file),token});enqueue({input:{},file,imageToken:token});
  }
  function commit(field:"name"|"price"){
    setEditing(null);if(cancel.current){cancel.current=false;return;}
    const value=(field==="name"?name:price).trim();
    if(field==="name"&&(value.length>200||/[\u0000-\u001f]/.test(value))||field==="price"&&value!==""&&!/^(?:0|[1-9][0-9]{0,17})$/.test(value)){setValidation(field==="name"?"Tên tối đa 200 ký tự, không xuống dòng.":"Giá VND là số nguyên, tối đa 18 chữ số, không thêm số 0 ở đầu.");return;}
    if(field==="name")setName(value);else setPrice(value);
    setValidation("");
    if(value!==desired.current[field]){desired.current[field]=value;enqueue({input:{[field]:value||null}});}
  }
  function edit(field:"name"|"price"){start.current=field==="name"?name:price;cancel.current=false;setEditing(field);}
  const url=preview?preview.url:saved.imageUrl,error=validation||autosave.error;
  const ready=!autosave.pending&&!error&&!editing&&saved.name&&saved.price!==null&&saved.imageUrl&&name.trim()===saved.name&&price.trim()===saved.price;
  return <article ref={article} tabIndex={-1} className={styles.lookCard} data-pending-id={row.id} aria-label={name||"Món chờ hoàn thiện"}>
    {saved.state==="pending"?<>
      <div className={styles.cardPhoto} data-drag-over={over} onDragOver={e=>{if(e.dataTransfer.types.includes("Files")){e.preventDefault();setOver(true);}}} onDragLeave={()=>setOver(false)} onDrop={e=>{e.preventDefault();setOver(false);if(e.dataTransfer.files.length!==1){setValidation("Thả một ảnh mỗi lần.");return;}choose(e.dataTransfer.files[0]);}}>
        <button type="button" className={styles.photoEdit} aria-label={url?"Thay ảnh món phối đồ":"Thêm ảnh món phối đồ"} onClick={()=>fileInput.current?.click()}>{url?<Image src={url} alt={name||"Ảnh món phối đồ"} fill unoptimized sizes="210px"/>:<span>+ Thêm ảnh</span>}</button>
        {url&&<button type="button" className={styles.removePhoto} aria-label="Bỏ ảnh món phối đồ" onClick={()=>{const token=crypto.randomUUID();setPreview({url:null,token});enqueue({input:{removeImage:true},imageToken:token});}}>×</button>}
        <input ref={fileInput} type="file" hidden accept="image/jpeg,image/png,image/webp" aria-label="Chọn ảnh món phối đồ" onChange={e=>{choose(e.target.files?.[0]);e.target.value="";}}/>
      </div>
      <div className={styles.inlineDetails}>
        {editing==="name"?<textarea autoFocus rows={2} maxLength={200} aria-label="Tên món phối đồ" value={name} onChange={e=>setName(e.target.value)} onBlur={()=>commit("name")} onKeyDown={e=>{if(e.key==="Escape"){cancel.current=true;setName(start.current);e.currentTarget.blur();}if(e.key==="Enter"){e.preventDefault();e.currentTarget.blur();}}}/>:<button type="button" className={styles.inlineText} data-placeholder={!name} onClick={()=>edit("name")}>{name||"Thêm tên"}</button>}
        {editing==="price"?<input autoFocus aria-label="Giá VND" inputMode="numeric" maxLength={18} value={price} onChange={e=>setPrice(e.target.value)} onBlur={()=>commit("price")} onKeyDown={e=>{if(e.key==="Escape"){cancel.current=true;setPrice(start.current);e.currentTarget.blur();}if(e.key==="Enter")e.currentTarget.blur();}}/>:<button type="button" className={styles.inlineText} data-placeholder={!price} onClick={()=>edit("price")}>{price&&/^(?:0|[1-9][0-9]{0,17})$/.test(price)?formatDetailPrice({amount:price,currency:"VND"}):price||"Thêm giá"}</button>}
        {ready&&<Link className={styles.completeCard} href={`/admin/products/pending/${row.id}`} aria-label="Hoàn thiện sản phẩm">+</Link>}
      </div>
    </>:<><div className={styles.cardPhoto}>{url&&<Image src={url} alt={name} fill unoptimized sizes="210px"/>}</div><h3>{saved.name||"Sản phẩm đã chuyển đổi"}</h3>{saved.price!==null&&<p>{formatDetailPrice({amount:saved.price,currency:"VND"})}</p>}<p>{saved.published?"Đã xuất bản":"Sản phẩm nháp"}</p>{saved.productId&&<Link href={`/admin/products/${saved.productId}`}>Chỉnh sửa sản phẩm →</Link>}</>}
    <p role="status" className={styles.cardStatus} data-active={!!error||autosave.pending}>{error?`Lưu lỗi · ${error}`:autosave.pending?"Đang lưu…":saved.version!==row.version||saved.version!=="0"?"Đã lưu":""}</p>
    {autosave.error&&<button type="button" className={styles.cardUtility} onClick={()=>void autosave.retry(()=>reloadPending(row.id))}>Tải bản mới &amp; thử lại</button>}
    {row.sourceProductId&&onDetached&&<details className={styles.cardTools} onKeyDown={e=>{if(e.key==="Escape"){e.currentTarget.open=false;e.currentTarget.querySelector<HTMLElement>("summary")?.focus();}}}><summary aria-label="Tùy chọn món phối đồ">⋯</summary><button type="button" className={styles.cardUtility} disabled={autosave.pending||detaching} onClick={async()=>{setDetaching(true);try{await lookRequest({operation:"detach",id:row.id,version:autosave.current.version});onDetached(row.id);}catch{setValidation("Không thể gỡ món; tải lại trang để kiểm tra phiên bản.");}finally{setDetaching(false);}}}>Bỏ khỏi outfit</button></details>}
  </article>;
}
