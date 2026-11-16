"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { galleryAssignments, galleryRoles, galleryTitles, type GalleryImage, type GalleryRole } from "@/features/products/gallery";
import { ImageStorage, type StoredImage } from "@/components/admin/image-storage";
import styles from "./product-detail.module.css";
export type GalleryEditor = { busy: boolean; uploadingRole?: GalleryRole; upload: (role: GalleryRole, file: File, imageId?: string) => Promise<boolean>; action: (input: Record<string, unknown>) => Promise<boolean> };
export function EditorialGallery({ images, name, editor,variantId,preferredImageId }: { images: readonly GalleryImage[]; name: string; editor?: GalleryEditor;variantId?:string;preferredImageId?:string }) {
  const assigned = galleryAssignments(images, !!editor);
  const [failed,setFailed] = useState<string[]>([]);
  const [selection,setSelection]=useState<{id?:string;variantId?:string}>({}), [editing, setEditing] = useState<{ role: GalleryRole; image?: GalleryImage } | null>(null), [library, setLibrary] = useState(false);
  const setSelectedId=(id?:string)=>setSelection({id,variantId});
  const [thumbnailMenu,setThumbnailMenu]=useState<{image:GalleryImage;top:number;left:number}|null>(null),[dropError,setDropError]=useState("");
  const thumbTools=useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null), target = useRef<{ role: GalleryRole; image?: GalleryImage }>({ role: "cover" });
  const tools = useRef<HTMLDialogElement>(null), zoom = useRef<HTMLDialogElement>(null), drag = useRef<string>(null), swipe = useRef(0);
  const selected = (selection.variantId===variantId?images.find(i => i.id === selection.id):undefined)??images.find(i=>i.id===preferredImageId)??assigned.cover;
  function pick(role: GalleryRole, image?: GalleryImage) { target.current = { role, image }; file.current?.click(); }
  function open(role: GalleryRole, image?: GalleryImage) {
    if (editor) {
      if (editor.busy) return;
      if (!image) { pick(role); return; }
      setEditing({ role, image }); setLibrary(false); tools.current?.showModal();
    } else if (image) { setSelectedId(image.id); zoom.current?.showModal(); }
  }
  async function act(input: Record<string, unknown>) { if (await editor?.action(input)) tools.current?.close(); }
  async function remove(image:GalleryImage){
    const index=images.findIndex(i=>i.id===image.id),next=images[index+1]??images[index-1];
    if(await editor?.action({operation:"remove",imageId:Number(image.id)})){if(selected?.id===image.id)setSelectedId(next?.id);tools.current?.close();thumbTools.current?.close();}
  }
  function reorder(id: string, at: number) {
    const ids = images.map(i => i.id), from = ids.indexOf(id);
    if (from < 0 || at < 0 || at >= ids.length || from === at) return;
    ids.splice(from,1); ids.splice(at,0,id);
    void editor?.action({ operation: "reorder", ids: ids.map(Number) }).then(ok=>{if(ok)thumbTools.current?.close();});
  }
  function move(delta: number) {
    if (!images.length) return;
    const index = images.findIndex(i => i.id === selected?.id);
    setSelectedId(images[(index + delta + images.length) % images.length].id);
  }
  function slot(role: GalleryRole, image?: GalleryImage, main = false) {
    return <div className={`${styles.photoSlot} ${main ? styles.editorialMain : styles.editorialPanel}`} data-empty={!image} onDragOver={e=>{if(editor&&e.dataTransfer.types.includes("Files")){e.preventDefault();e.currentTarget.dataset.dragOver="true";}}} onDragLeave={e=>{delete e.currentTarget.dataset.dragOver;}} onDrop={e=>{if(!editor||!e.dataTransfer.types.includes("Files"))return;e.preventDefault();e.stopPropagation();delete e.currentTarget.dataset.dragOver;drag.current=null;if(editor.busy)return;if(e.dataTransfer.files.length!==1){setDropError("Thả một ảnh mỗi lần.");return;}setDropError("");void editor.upload(role,e.dataTransfer.files[0],image?.id);}}>
      <button type="button" className={styles.photoButton} disabled={editor?.busy || (!editor && !image)} aria-label={editor ? `${image ? "Chỉnh sửa" : "Thêm"} ${galleryTitles[role]}` : `Phóng to ${image?.alt || name}`} onClick={() => open(role, image)}>
        {image && !failed.includes(image.url) ? <Image key={image.url} src={image.url} alt={image.alt || name} fill unoptimized={image.url.startsWith("/images/uploads/")} sizes={main ? "(max-width: 800px) 100vw, 38vw" : "(max-width: 800px) 33vw, 26vw"} onError={() => setFailed(old => [...old,image.url])} className={styles.editorialPhoto}/> : <span className={styles.slotEmpty}>{editor && <span className={styles.slotPlus}>+</span>}<strong>{image ? "Ảnh không tải được" : editor ? main ? "Thêm ảnh chính" : `Thêm ảnh ${role === "detail" ? "chi tiết" : role === "fabric" ? "chất liệu" : "phom dáng"}` : "Chưa có ảnh"}</strong>{editor && <small>Nhấn để tải ảnh lên</small>}</span>}
        {image && !main && <span className={styles.panelCaption}>{galleryTitles[role]}</span>}
        {image && editor && <span className={styles.editAffordance} aria-hidden="true">+</span>}
      </button>
      {editor?.uploadingRole === role && <span role="status" className={styles.slotBusy}>Đang tải ảnh…</span>}
      {main && image && <div className={styles.galleryBrowse}><span>{String(images.findIndex(i => i.id === image.id)+1).padStart(2,"0")} / {String(images.length).padStart(2,"0")}</span><div><button type="button" onClick={() => move(-1)} aria-label="Ảnh trước">←</button><button type="button" onClick={() => move(1)} aria-label="Ảnh sau">→</button></div></div>}
    </div>;
  }
  const panels = (["detail", "fabric", "silhouette"] as const).filter(role => editor || assigned[role]);
  return <div className={styles.gallery} onDragOver={e=>{if(editor&&e.dataTransfer.types.includes("Files"))e.preventDefault();}} onDrop={e=>{if(editor&&e.dataTransfer.types.includes("Files")){e.preventDefault();setDropError("Thả ảnh vào khung ảnh cần thêm hoặc thay.");}}}>
    <div className={styles.editorialGallery} data-panels={panels.length > 0}>
      <div className={styles.thumbnailRail} aria-label="Ảnh sản phẩm">{images.map((image,n) => <div key={image.id} className={styles.thumbItem}><button type="button" className={styles.editorialThumb} aria-label={`Xem ảnh ${n+1}`} aria-pressed={image.id === selected?.id} draggable={!!editor && !editor.busy} onDragStart={e => { drag.current = image.id;e.dataTransfer.setData("application/x-aurel-gallery",image.id); }} onDragEnd={()=>{drag.current=null;}} onDragOver={e => { if (editor&&!editor.busy) e.preventDefault(); }} onDrop={e => { e.preventDefault();if(!e.dataTransfer.types.includes("Files")&&drag.current&&!editor?.busy)reorder(drag.current,n);drag.current=null; }} onClick={() => setSelectedId(image.id)}><Image src={image.url} alt="" draggable={false} fill unoptimized={image.url.startsWith("/images/uploads/")} sizes="80px" className={styles.editorialPhoto}/></button>{editor&&<button type="button" className={styles.thumbMenuButton} disabled={editor.busy} aria-label={`Tùy chọn ảnh ${n+1}`} aria-haspopup="dialog" onClick={e=>{const rect=e.currentTarget.getBoundingClientRect();setThumbnailMenu({image,top:Math.max(8,Math.min(rect.bottom,window.innerHeight-160)),left:Math.max(8,Math.min(rect.right,window.innerWidth-200))});thumbTools.current?.showModal();}}>⋯</button>}</div>)}{editor && <button type="button" disabled={editor.busy || images.length >= 100} className={styles.editorialThumb} aria-label="Thêm ảnh vào thư viện sản phẩm" onClick={() => pick("gallery")}><span className={styles.slotPlus}>+</span></button>}</div>
      <div className={styles.mainSwipe} onTouchStart={e => { swipe.current = e.changedTouches[0].clientX; }} onTouchEnd={e => { const distance = e.changedTouches[0].clientX - swipe.current; if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1); }}>{slot("cover",selected,true)}</div>
      {!!panels.length && <div className={styles.editorialPanels}>{panels.map(role => <div key={role}>{slot(role,assigned[role])}</div>)}</div>}
    </div>
    {editor&&dropError&&<p role="status" className={styles.note}>{dropError}</p>}
    {editor&&<dialog ref={thumbTools} className={styles.thumbMenu} aria-label="Tùy chọn ảnh" style={thumbnailMenu?{top:thumbnailMenu.top,left:thumbnailMenu.left}:undefined} onClick={e=>{if(e.target===e.currentTarget)thumbTools.current?.close();}}>{thumbnailMenu&&<div><button type="button" autoFocus disabled={editor.busy} onClick={()=>void remove(thumbnailMenu.image)}>Xóa ảnh</button><button type="button" disabled={editor.busy||images.findIndex(i=>i.id===thumbnailMenu.image.id)<=0} onClick={()=>reorder(thumbnailMenu.image.id,images.findIndex(i=>i.id===thumbnailMenu.image.id)-1)}>Đưa lên trước</button><button type="button" disabled={editor.busy||images.findIndex(i=>i.id===thumbnailMenu.image.id)>=images.length-1} onClick={()=>reorder(thumbnailMenu.image.id,images.findIndex(i=>i.id===thumbnailMenu.image.id)+1)}>Đưa về sau</button><button type="button" onClick={()=>thumbTools.current?.close()}>Đóng</button></div>}</dialog>}
    {editor && <input ref={file} className={styles.hiddenInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Tải ảnh vào vị trí đã chọn" onChange={e => { const uploaded = e.target.files?.[0], position = target.current; e.target.value = ""; if (uploaded) void editor.upload(position.role,uploaded,position.image?.id).then(ok => { if (ok) tools.current?.close(); }); }}/ >}
    {editor && <dialog ref={tools} className={styles.mediaDialog} aria-label="Chỉnh sửa ảnh"><div className={styles.mediaHeading}><h2>{editing ? galleryTitles[editing.role] : "Hình ảnh"}</h2><button type="button" autoFocus onClick={() => tools.current?.close()} aria-label="Đóng chỉnh sửa ảnh">×</button></div>
      {editing && <div className={styles.mediaActions}><button type="button" disabled={editor.busy} onClick={() => pick(editing.role,editing.image)}>Thay hình ảnh</button><button type="button" disabled={editor.busy || !editing.image} onClick={() => editing.image&&void remove(editing.image)}>Xóa hình ảnh</button><button type="button" disabled={editor.busy || !editing.image} onClick={() => void act({ operation: "primary", imageId: Number(editing.image?.id) })}>Đặt làm ảnh chính</button><button type="button" disabled={editor.busy} onClick={() => setLibrary(v => !v)}>Chọn từ kho ảnh</button><label>Vị trí ảnh<select value={editing.role} disabled={editor.busy || !editing.image} onChange={e => void act({ operation: "role", imageId: Number(editing.image?.id), role: e.target.value })}>{galleryRoles.map(role => <option key={role} value={role}>{galleryTitles[role]}</option>)}</select></label></div>}
      {library && editing && <ImageStorage libraryOnly disabled={editor.busy} onUpload={() => {}} onSelect={(stored: StoredImage) => void act({ operation: "assign", storageKey: stored.storageKey, role: editing.role, ...(editing.image ? { imageId: Number(editing.image.id) } : {}) })}/>}
    </dialog>}
    <dialog ref={zoom} className={styles.zoomDialog} aria-label="Xem ảnh sản phẩm" onClick={e => { if (e.target === e.currentTarget) zoom.current?.close(); }}><button type="button" autoFocus onClick={() => zoom.current?.close()} aria-label="Đóng ảnh phóng to">×</button>{selected && <div>{<Image src={selected.url} alt={selected.alt} fill unoptimized={selected.url.startsWith("/images/uploads/")} sizes="90vw" className={styles.zoomPhoto}/>}</div>}</dialog>
  </div>;
}
