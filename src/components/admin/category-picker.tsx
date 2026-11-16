"use client";
import {useRef} from "react";
import {categoriesForGender,matchingCategory} from "@/features/products/category-options";
import {ClothingIcon} from "./clothing-icon";
import {AdminIcon} from "./admin-icon";
import styles from "./products.module.css";
export type EditorCategory={id:number;name:string;slug:string};
export function CategoryPicker({gender,value,categories,busy,onChoose,onExisting,onAdd}:{gender:string|null;value:string;categories:EditorCategory[];busy:boolean;onChoose:(slug:string)=>Promise<boolean>;onExisting:(id:string)=>void;onAdd:()=>void}){
  const panel=useRef<HTMLDetailsElement>(null),selected=categories.find(c=>String(c.id)===value);
  return <div className={styles.field}><span>Danh mục <span className={styles.required}>*</span></span><div className={styles.optionRow}><details ref={panel} className={`${styles.picker} ${styles.categoryPicker}`}><summary><span className={styles.inputIcon}><AdminIcon name="grid"/></span><span className={styles.pickerValue}>{selected?.name??"Chọn danh mục"}</span><AdminIcon name="chevron-down"/></summary><div className={styles.categoryPalette}><p>{gender==="men"?"Danh mục Nam":gender==="women"?"Danh mục Nữ":"Danh mục trang phục"}</p><div className={styles.categoryTiles}>{categoriesForGender(gender).map(c=><button type="button" key={c.slug} disabled={busy} aria-pressed={String(matchingCategory(categories,c)?.id)===value} onClick={async()=>{if(await onChoose(c.slug)&&panel.current)panel.current.open=false;}}><ClothingIcon kind={c.icon}/><span>{c.name}</span></button>)}</div><label className={styles.existingCategory}>Danh mục đã lưu<select aria-label="Danh mục sản phẩm" required value={value} onChange={e=>{onExisting(e.target.value);if(panel.current)panel.current.open=false;}}><option value="">Chọn danh mục</option>{categories.map(c=><option key={c.id} value={String(c.id)}>{c.name}</option>)}</select></label>{!categories.length&&<small>Chọn một loại trang phục để tạo danh mục đầu tiên.</small>}</div></details><button type="button" aria-label="Thêm danh mục" onClick={onAdd}>+</button></div><small>Chọn giới tính để xem nhóm phù hợp. Danh mục đã chọn được giữ khi đổi giới tính.</small></div>;
}
