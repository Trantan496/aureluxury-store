"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ageGroups } from "@/features/products/audience";
import {CategoryPicker} from "./category-picker";
import {clothingCategories,matchingCategory} from "@/features/products/category-options";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ManagementDTO } from "@/features/products/management";
import { type OptionKey } from "@/features/products/foundation";
import { editorDraft, editorPayload, completeDraftVariants, newVariant, removeDraftVariant, previewCode, draftSku, productSlug, fieldLabels, optionLabel, type EditorDraft, type DraftVariant, type TaxonomyFeed } from "@/features/products/editor-state";
import { currencies } from "@/features/money/money";
import { adminRequest, AdminRequestError, adminFieldLabels } from "./admin-client";
import { AdminIcon } from "./admin-icon";
import { DescriptionEditor } from "./description-editor";
import styles from "./products.module.css";
import type {PendingItem} from "@/features/products/pending-types";
import {lookRequest} from "./look-client";
import { visibleAttributes, type DynamicAttribute, type DynamicAttributeValues } from "@/features/products/dynamic-attributes";
import { parseSemicolonTags } from "@/features/products/tag-parser";
type Category = { id: number; name: string; slug: string };
const scalarKeys = ["fabric", "fit", "pattern", "silhouette", "layerRole"] as const;
const tagKeys = ["styleTags", "seasonTags", "occasionTags"] as const;
const ValidationField = createContext("");
export function ProductEditor({ product, pending, categories: initialCategories, taxonomy: initialTaxonomy, collections = [] }: { product: ManagementDTO | null; pending?:PendingItem; categories: Category[]; taxonomy: TaxonomyFeed; collections?: string[] }) {
  const router = useRouter();
  const initialDraft=()=>{const value=editorDraft(product);if(pending&&!product)value.name=pending.name??"";return value;};
  const [current, setCurrent] = useState(product), [draft, setDraft] = useState(initialDraft);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initialDraft()));
  const [categories, setCategories] = useState(initialCategories), [feed, setFeed] = useState(initialTaxonomy);
  const [requestFailed, setRequestFailed] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [errorField, setErrorField] = useState("");
  const [modal, setModal] = useState<OptionKey | "category" | null>(null), [modalName, setModalName] = useState("");
  const [categoryQuery, setCategoryQuery] = useState(""), [optionVariant, setOptionVariant] = useState("");
  const locked = useRef(false), status = useRef<HTMLParagraphElement>(null), dialog = useRef<HTMLDialogElement>(null), serial = useRef(0);
  const dirty = JSON.stringify(draft) !== baseline, code = previewCode(draft, feed.extended);
  const nextKey = () => `draft-${++serial.current}`;
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    const navigate = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest?.("a[href]");
      if (anchor && !anchor.getAttribute("href")?.startsWith("#") && !window.confirm("Bạn có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?")) { e.preventDefault(); e.stopPropagation(); }
    };
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const traverse = (e: Event) => { if ((e as Event & { navigationType?: string }).navigationType === "traverse" && e.cancelable && !window.confirm("Có thay đổi chưa lưu. Rời trang và bỏ thay đổi?")) e.preventDefault(); };
    navigation?.addEventListener("navigate", traverse);
    window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
    return () => { navigation?.removeEventListener("navigate", traverse); window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty]);
  useEffect(() => { if (modal) dialog.current?.showModal(); else dialog.current?.close(); }, [modal]);
  function patch(values: Partial<EditorDraft>) { setDraft(d => ({ ...d, ...values })); }
  function variant(key: string, values: Partial<DraftVariant>) { setDraft(d => ({ ...d, variants: d.variants.map(v => v.key === key ? { ...v, ...values } : v) })); }
  function accepted(row: ManagementDTO) { const value = editorDraft(row); setCurrent(row); setDraft(value); setBaseline(JSON.stringify(value)); }
  async function task(work: () => Promise<void>) {
    if (locked.current) return; locked.current = true; setBusy(true); setRequestFailed(false); setMessage(""); setErrorField("");
    try { await work(); } catch (e) { setRequestFailed(true); setMessage(e instanceof Error ? e.message : "Không thể hoàn tất. Hãy thử lại."); if (e instanceof AdminRequestError) setErrorField(e.field ?? ""); }
    finally { locked.current = false; setBusy(false); setTimeout(() => status.current?.focus(), 0); }
  }
  async function nextStep() {
    if (current?.isActive && !window.confirm("Chuyển sản phẩm về chưa xuất bản để chỉnh sửa showroom?")) return;
    await task(async () => {
      if(pending&&!current){const saved=await lookRequest<ManagementDTO>({operation:"convert",id:pending.id,version:pending.version,input:editorPayload(draft,feed.extended)});accepted(saved);router.replace(`/admin/products/${saved.id}/preview`);return;}
      let requestKey = sessionStorage.getItem("aurel-new-product-request");
      if (!requestKey) { requestKey = crypto.randomUUID(); sessionStorage.setItem("aurel-new-product-request", requestKey); }
      const saved = await adminRequest<ManagementDTO>({ operation: "prepare", input: { ...editorPayload(draft, feed.extended), isActive: false }, requestKey, ...(current ? { id: current.id, version: current.version } : {}) });
      accepted(saved); sessionStorage.removeItem("aurel-new-product-request");
      router.replace(`/admin/products/${saved.id}/preview`);
    });
  }
  function addOption(k: OptionKey | "category", variantKey = "") { setModalName(""); setOptionVariant(variantKey); setModal(k); }
  async function createOption() { await task(async () => {
    if (modal === "category") {
      const category = await adminRequest<Category>({ operation: "category", input: { name: modalName, slug: productSlug(modalName) } });
      setCategories(rows => [...rows, category]); patch({ categoryId: String(category.id) });
    } else if (modal) {
      const created = await adminRequest<{ key: OptionKey; token: string; label: string }>({ operation: "taxonomy-add", input: { key: modal, label: modalName } });
      setFeed(f => ({ ...f, values: { ...f.values, [created.key]: [...f.values[created.key], { token: created.token, label: created.label }] } }));
      if ((created.key === "color" || created.key === "size") && optionVariant) variant(optionVariant, { [created.key]: created.token });
      if ((scalarKeys as readonly string[]).includes(created.key)) setDraft(d => ({ ...d, options: { ...d.options, [created.key]: created.token } }));
      if ((tagKeys as readonly string[]).includes(created.key)) setDraft(d => ({ ...d, options: { ...d.options, [created.key]: [...d.options[created.key as typeof tagKeys[number]].filter(v => v !== "not-applicable"), created.token] } }));
    }
    setModal(null); setMessage("Đã thêm lựa chọn dùng chung.");
  }); }
  return <ValidationField value={errorField}><div className={styles.panel}>
    <div className={styles.titleCard}>
    <nav className={styles.breadcrumb} aria-label="Đường dẫn"><Link href="/admin/products">Quản lý sản phẩm</Link><span aria-hidden="true">›</span><span>{current ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"}</span></nav>
    <header className={styles.editorHeading}><div><h1>{current ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"}</h1>{(dirty || current) && <p role="status" aria-live="polite" className={`${styles.saveState} ${dirty || requestFailed ? styles.savePending : styles.saveComplete}`}>{requestFailed ? "Thao tác chưa hoàn tất" : dirty ? "Có thay đổi chưa lưu" : "Đã lưu"}</p>}</div><div className={styles.headingActions}><button type="submit" form="product-editor" disabled={busy} className={styles.nextStep}>{busy ? "Đang chuẩn bị…" : "Tiếp theo"}<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg></button></div></header>
    </div>
    <p ref={status} tabIndex={-1} role="status" aria-live="polite" className={message || busy ? styles.status : undefined}>{busy ? "Đang xử lý…" : message}</p>
    {errorField && <p role="alert" className={styles.error}>Kiểm tra trường: {adminFieldLabels[errorField] ?? "Thông tin nhập"}. Dữ liệu đang nhập được giữ lại.</p>}
    <form id="product-editor" onInvalid={e => { const control = e.target as HTMLInputElement; const label = control.getAttribute("aria-label") || control.closest("label")?.textContent || ""; setErrorField(label.includes("Danh mục") ? "categoryId" : label.includes("Tên sản phẩm") ? "name" : label.includes("Màu sắc") ? "color" : label.includes("Kích cỡ") ? "size" : label.includes("Tồn kho") ? "stock" : "input"); setMessage("Kiểm tra thông tin bắt buộc trước khi tiếp tục."); if (control.closest("[popover]")) e.preventDefault(); let detail = control.closest("details"); while (detail) { detail.open = true; detail = detail.parentElement?.closest("details") ?? null; } }} onSubmit={e => { e.preventDefault(); void nextStep(); }} className={`${styles.editorGrid} ${styles.stepOneGrid}`} aria-busy={busy}>
      <div className={styles.editorMain}>
        <fieldset disabled={busy} className={`${styles.card} ${styles.infoCard}`}><legend className={styles.srOnly}>Thông tin sản phẩm</legend><SectionHeading number={1} title="Thông tin sản phẩm"/><div className={styles.infoFields}>
          <Field label={`Mã sản phẩm${draft.productCode ? "" : " · dự kiến"}`}><InputAdornment name="barcode"><input readOnly value={draft.name || draft.productCode ? code : "Tự tạo sau khi nhập tên"}/></InputAdornment></Field>
          <Field label="Tên sản phẩm *" field="name"><InputAdornment name="text"><input placeholder="Nhập tên sản phẩm" required maxLength={200} value={draft.name} onChange={e => patch({ name: e.target.value })} aria-invalid={errorField === "name"}/></InputAdornment></Field>
          <div className={styles.field}><span>Giới tính – Độ tuổi</span><div className={styles.audienceControls}><select aria-label="Giới tính sản phẩm" value={draft.options.gender ?? ""} onChange={e => setDraft(d => ({ ...d, options: { ...d.options, gender: e.target.value || null } }))}><option value="">Giới tính</option>{feed.values.gender.map(o => <option key={o.token} value={o.token}>{optionLabel(o.token, o.label)}</option>)}</select><select aria-label="Nhóm tuổi sản phẩm" value={draft.ageGroup} onChange={e => patch({ ageGroup: e.target.value })}><option value="">Nhóm tuổi</option>{ageGroups.map(o => <option key={o.token} value={o.token}>{o.label}</option>)}</select></div>{errorField === "ageGroup" && <small role="alert">Nhóm tuổi chưa hợp lệ.</small>}</div>
          <div><CategoryPicker gender={draft.options.gender} value={draft.categoryId} categories={categories} busy={busy} onExisting={value=>patch({categoryId:value})} onAdd={()=>addOption("category")} onChoose={async slug=>{let success=false;await task(async()=>{const preset=clothingCategories.find(c=>c.slug===slug)!;const category=matchingCategory(categories,preset)??await adminRequest<Category>({operation:"category-select",input:{slug}});setCategories(rows=>[...new Map([...rows,category].map(c=>[c.id,c])).values()]);patch({categoryId:String(category.id)});success=true;});return success;}}/><details className={styles.categorySearch}><summary>Tìm thêm danh mục trên hệ thống</summary><input type="search" aria-label="Tìm danh mục trên hệ thống" value={categoryQuery} onChange={e => setCategoryQuery(e.target.value)}/><button type="button" className={styles.subtle} onClick={() => task(async () => { const result = await adminRequest<{ rows: Category[]; total: number }>({ operation: "category-search", input: { q: categoryQuery, page: 1 } }); setCategories(rows => [...new Map([...rows, ...result.rows].map(c => [c.id, c])).values()]); setMessage(`Tìm thấy ${result.total} danh mục; hiển thị tối đa 50 kết quả tìm kiếm.`); })}>Tìm danh mục</button></details></div>
          <Field label="Bộ sưu tập" field="collection"><InputAdornment name="layers"><input list="product-collections" placeholder="Chọn hoặc nhập slug bộ sưu tập" maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={draft.collection} onChange={e => patch({ collection: e.target.value })}/></InputAdornment><datalist id="product-collections">{collections.map(value => <option key={value} value={value}/>)}</datalist></Field>
          <Field label="Thương hiệu" field="brand"><InputAdornment name="tag"><input list="product-brands" maxLength={200} value={draft.brand} onChange={e => patch({ brand: e.target.value })}/>{draft.brand && <button type="button" className={styles.clearInput} aria-label="Xóa thương hiệu" onClick={() => patch({ brand: "" })}>×</button>}</InputAdornment><datalist id="product-brands"><option value="AUREL"/></datalist></Field>
        </div><div className={styles.field}><span>Thẻ Tag tìm kiếm (cách nhau bằng dấu ;)</span><InputAdornment name="tag"><input placeholder="Ví dụ: áo polo; polo; áo thun có cổ" aria-label="Thẻ Tag tìm kiếm" maxLength={500} value={draft.searchTags} onChange={e => patch({ searchTags: e.target.value })} aria-invalid={errorField === "searchTags"}/>{draft.searchTags && <button type="button" className={styles.clearInput} aria-label="Xóa thẻ tag" onClick={() => patch({ searchTags: "" })}>×</button>}</InputAdornment><small>Danh mục chọn nhóm chung (ví dụ Áo), còn loại áo cụ thể nhập vào đây và phân cách bằng dấu chấm phẩy (;).</small>{parseSemicolonTags(draft.searchTags).length > 0 && <div className={styles.chips} aria-label="Danh sách thẻ tag đã nhận diện" style={{ marginTop: 6 }}>{parseSemicolonTags(draft.searchTags).map(tag => <span key={tag} className={styles.chip} style={{ cursor: "default" }}>#{tag}</span>)}</div>}</div><div className={styles.field}><span>Mô tả</span><DescriptionEditor value={draft.description} onChange={description => patch({ description })} images={[] }/>{errorField === "description" && <small role="alert">Kiểm tra mô tả sản phẩm.</small>}</div></fieldset>
        <fieldset disabled={busy} className={`${styles.card} ${styles.metadataCard}`}><legend className={styles.srOnly}>Thuộc tính & dữ liệu AI</legend><SectionHeading number={2} title="Thuộc tính & dữ liệu AI"/>
          <div className={styles.attributeBlock}><h3>Loại trang phục</h3><OptionPicker label="Loại trang phục *" value={draft.options.garmentType ?? ""} values={feed.values.garmentType} required onChange={garmentType => {
            if (garmentType !== draft.options.garmentType && Object.keys(draft.dynamicAttributes).length && current && !window.confirm("Đổi loại trang phục sẽ bỏ các thông số riêng không còn phù hợp. Ba nhóm Phong cách, Mùa phù hợp và Dịp sử dụng vẫn được giữ. Tiếp tục?")) return;
            setDraft(d => ({ ...d, options: { ...d.options, garmentType: garmentType || null }, dynamicAttributes: garmentType === d.options.garmentType ? d.dynamicAttributes : {} }));
          }} onAdd={() => addOption("garmentType")}/></div>
          <div className={styles.attributeBlock}><h3>Thông số chung</h3><div className={styles.fields}>{scalarKeys.map(k => <OptionPicker key={k} label={fieldLabels[k]} value={draft.options[k] ?? ""} values={feed.values[k]} onChange={v => setDraft(d => ({ ...d, options: { ...d.options, [k]: v || null } }))} onAdd={() => addOption(k)}/>)}</div></div>
          <div className={styles.attributeBlock}><h3>{draft.options.garmentType ? `Thông số riêng — ${optionLabel(draft.options.garmentType, feed.values.garmentType.find(value => value.token === draft.options.garmentType)?.label)}` : "Thông số riêng"}</h3>{draft.options.garmentType ? <div className={styles.fields}>{visibleAttributes(draft.options.garmentType, draft.dynamicAttributes).map(attribute => <DynamicAttributePicker key={attribute.key} attribute={attribute} values={draft.dynamicAttributes} onChange={(key, value) => setDraft(d => ({ ...d, dynamicAttributes: { ...d.dynamicAttributes, [key]: value } }))}/>)}</div> : <p className={styles.attributeHint}>Chọn loại trang phục để hiển thị các thông số phù hợp. Phong cách, mùa và dịp sử dụng vẫn có thể chọn bên dưới.</p>}</div>
          <div className={styles.tagRows}><h3>Phong cách & ngữ cảnh</h3>{tagKeys.map(k => <div className={styles.tagGroup} key={k}><span>{fieldLabels[k]}</span><div className={styles.chips}>{feed.values[k].map(v => <label key={v.token} className={styles.chip}><input type="checkbox" checked={draft.options[k].includes(v.token)} onChange={e => setDraft(d => ({ ...d, options: { ...d.options, [k]: e.target.checked ? (v.token === "not-applicable" ? [v.token] : [...d.options[k].filter(t => t !== "not-applicable"), v.token]) : d.options[k].filter(t => t !== v.token) } }))}/><span>{optionLabel(v.token, v.label)}</span>{draft.options[k].includes(v.token) && <span aria-hidden="true">×</span>}</label>)}<button type="button" className={styles.subtle} onClick={() => addOption(k)}>+ Thêm</button></div>{!draft.options[k].length && <small className={styles.srOnly}>Chưa khai báo</small>}</div>)}</div></fieldset>
        <fieldset disabled={busy} className={`${styles.card} ${styles.variantsCard}`}><legend className={styles.srOnly}>Biến thể · Giá & Tồn kho</legend><div className={styles.sectionToolbar}><SectionHeading number={3} title="Biến thể · Giá & Tồn kho"/><button type="button" className={styles.secondary} disabled={draft.variants.length >= 200} onClick={() => { const added=newVariant(nextKey()); if(pending&&!draft.variants.length)added.prices.VND=pending.price??""; patch({ variants:[...draft.variants,added] }); }}><AdminIcon name="plus"/>Thêm biến thể</button></div>
          {draft.variants.length>0&&<button type="button" className={styles.subtle} onClick={()=>{try{setDraft(completeDraftVariants(draft,code));}catch{setMessage("Tối đa 200 biến thể; giảm số màu/size trước khi tạo tổ hợp.");}}}>Bổ sung tổ hợp màu × size</button>}
          {!draft.variants.length && <p className={styles.empty}>Chưa có biến thể. Thêm màu và kích cỡ đang bán.</p>}
          {!!draft.variants.length && <div className={`${styles.tableWrap} ${styles.variantScroll}`} tabIndex={0} role="region" aria-label="Bảng biến thể cuộn ngang"><table className={`${styles.table} ${styles.variantTable}`}><thead><tr>{["Màu sắc", "Kích cỡ", "SKU · tự tạo", "Giá VND", "Giá USD", "Giá EUR", "Tồn kho", "Trạng thái", "Thao tác"].map(t => <th key={t} scope="col">{t}</th>)}</tr></thead><tbody>{draft.variants.map((v, n) => <tr key={v.key}>
            {(["color", "size"] as const).map(k => <td key={k}><OptionPicker label={`${fieldLabels[k]} ${n + 1}`} value={v[k]} values={feed.values[k]} onChange={value => variant(v.key, { [k]: value })} onAdd={() => addOption(k, v.key)} required hideLabel color={k === "color"}/></td>)}
            <td><input aria-label={`SKU biến thể ${n + 1}`} value={draftSku(v, code)} readOnly/></td>
            {currencies.map(c => <td key={c}><input aria-label={`Giá ${c} biến thể ${n + 1}`} inputMode="decimal" maxLength={21} value={v.prices[c]} onChange={e => variant(v.key, { prices: { ...v.prices, [c]: e.target.value } })}/></td>)}
            <td><input aria-label={`Tồn kho biến thể ${n + 1}`} type="number" min={0} max={2147483647} step={1} required value={v.stock} onChange={e => variant(v.key, { stock: e.target.value })}/></td>
            <td><select aria-label={`Trạng thái biến thể ${n + 1}`} value={String(v.isActive)} onChange={e => variant(v.key, { isActive: e.target.value === "true" })}><option value="true">Hoạt động</option><option value="false">Vô hiệu hóa</option></select></td>
            <td><div className={styles.variantActions}><button type="button" className={styles.subtle} disabled={draft.variants.length >= 200} onClick={() => patch({ variants: [...draft.variants, newVariant(nextKey(), v)] })}><AdminIcon name="copy"/>Sao chép</button>{!v.id && <button type="button" className={styles.subtle} onClick={() => setDraft(d => removeDraftVariant(d, v.key))}><AdminIcon name="trash"/>Bỏ</button>}</div></td>
          </tr>)}</tbody></table></div>}
          
        </fieldset>

      </div>

    </form>
    <dialog ref={dialog} className={styles.modal} onCancel={e => { if (busy) e.preventDefault(); else setModal(null); }} aria-labelledby="option-title"><h2 id="option-title">Thêm {modal === "category" ? "danh mục" : modal ? fieldLabels[modal].toLocaleLowerCase("vi") : "lựa chọn"}</h2>{modal !== "category" && !feed.extended ? <p>Thêm lựa chọn dùng chung cần migration taxonomy đã chuẩn bị. Chưa áp dụng lên database chính; chưa thể lưu lựa chọn mới tại đây.</p> : <form onSubmit={e => { e.preventDefault(); void createOption(); }}><Field label="Tên hiển thị *"><input autoFocus required minLength={2} maxLength={modal === "category" ? 200 : 80} value={modalName} onChange={e => setModalName(e.target.value)}/></Field><button disabled={busy}>{busy ? "Đang thêm…" : "Thêm lựa chọn"}</button></form>}<p role="status">{message}</p><button type="button" className={styles.subtle} disabled={busy} onClick={() => setModal(null)}>Đóng</button></dialog>
  </div></ValidationField>;
}
function Field({ label, field, children }: { label: string; field?: string; children: React.ReactNode }) { const error = useContext(ValidationField); return <label className={`${styles.field} ${field && error === field ? styles.invalid : ""}`}><span><FieldLabel label={label}/></span>{children}{field && error === field && <small role="alert">Kiểm tra {label.toLowerCase().replace(" *", "")}.</small>}</label>; }
const colorSamples: Record<string, string> = { black: "#171717", white: "#ffffff", beige: "#d8c3a5", brown: "#79533b", navy: "#22334d", blue: "#377fc2", red: "#bc3636", green: "#3c7950", grey: "#929292", pink: "#e9a6bd", yellow: "#e8c744", purple: "#88599c", orange: "#dc863d" };
function ColorSample({ token }: { token: string }) {
  return <span aria-hidden="true" className={styles.colorSample} style={{ backgroundColor: colorSamples[token] ?? "#f2eee8" }}>{colorSamples[token] ? null : "?"}</span>;
}
function OptionPicker({ label, value, values, onChange, onAdd, required, hideLabel, icon, color }: { label: string; value: string; values: { token: string; label: string }[]; onChange: (v: string) => void; onAdd?: () => void; required?: boolean; hideLabel?: boolean; icon?: "grid"; color?: boolean }) {
  const [query, setQuery] = useState("");
  const error = useContext(ValidationField), invalid = fieldLabels[error as OptionKey] === label.replace(/ \d+$/, "") || (error === "categoryId" && label.startsWith("Danh mục"));
  const filtered = values.filter(v => v.token === value || !query || productSlug(optionLabel(v.token, v.label)).includes(productSlug(query)));
  const picker = useRef<HTMLDetailsElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = () => { menu.current?.hidePopover(); if (picker.current) picker.current.open = false; };
  useEffect(() => {
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && menu.current?.contains(event.target)) return;
      menu.current?.hidePopover();
      if (picker.current) picker.current.open = false;
    };
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => { window.removeEventListener("scroll", dismiss, true); window.removeEventListener("resize", dismiss); };
  }, []);
  const choose = (token: string) => { onChange(token); close(); picker.current?.querySelector("summary")?.focus(); };
  return <div className={styles.field}>{!hideLabel && <span><FieldLabel label={label}/></span>}<div className={styles.optionRow}><details ref={picker} name="product-editor-choice" className={styles.picker} onToggle={e => {
    const panel = menu.current;
    if (!panel) return;
    if (!e.currentTarget.open) { panel.hidePopover(); return; }
    const rect = e.currentTarget.querySelector("summary")!.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const upwards = below < 240 && above > below;
    const height = Math.min(320, Math.max(80, upwards ? above : below));
    panel.style.width = `${Math.min(Math.max(rect.width, 190), window.innerWidth - 24)}px`;
    panel.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - Math.min(Math.max(rect.width, 190), window.innerWidth - 24) - 12))}px`;
    panel.style.top = upwards ? "auto" : `${rect.bottom + 5}px`;
    panel.style.bottom = upwards ? `${window.innerHeight - rect.top + 5}px` : "auto";
    panel.style.maxHeight = `${height}px`;
    panel.showPopover();
    panel.querySelector("input")?.focus({ preventScroll: true });
  }}><summary data-empty={!value} aria-label={`${label}: ${value ? optionLabel(value, values.find(v => v.token === value)?.label) : "Chưa khai báo"}`} aria-invalid={invalid}>{icon && <span className={styles.inputIcon}><AdminIcon name={icon}/></span>}<span className={styles.pickerValue}>{color && value && <ColorSample token={value}/>}<span>{value ? optionLabel(value, values.find(v => v.token === value)?.label) : "Chưa khai báo"}</span></span><span className={styles.pickerChevron}><AdminIcon name="chevron-down"/></span></summary><div ref={menu} popover="auto" className={`${styles.pickerMenu} ${styles.floatingPicker}`} onToggle={e => { if (e.newState === "closed" && picker.current) picker.current.open = false; }}><input type="search" aria-label={`Tìm ${label.toLowerCase()}`} placeholder="Tìm lựa chọn…" value={query} onChange={e => setQuery(e.target.value)}/><select className={color ? styles.colorValidation : undefined} tabIndex={color ? -1 : undefined} size={Math.min(7, Math.max(2, filtered.length + 1))} aria-label={label} aria-invalid={invalid} value={value} required={required} onChange={e => choose(e.target.value)}><option value="">{required ? "Chọn lựa chọn" : "Chưa khai báo"}</option>{value && !values.some(v => v.token === value) && <option value={value}>Ngoài danh sách: {value} — cần chọn lại</option>}{filtered.map(v => <option key={v.token} value={v.token}>{optionLabel(v.token, v.label)}</option>)}</select>{color && <div className={styles.colorChoices} role="group" aria-label={label}>{filtered.map(v => <button key={v.token} type="button" aria-pressed={value === v.token} onClick={() => choose(v.token)}><ColorSample token={v.token}/>{optionLabel(v.token, v.label)}</button>)}{!filtered.length && <p className={styles.muted}>Không tìm thấy màu phù hợp.</p>}</div>}</div></details>{onAdd && <button type="button" aria-label={`Thêm ${label.toLowerCase()}`} onClick={onAdd}>+</button>}</div>{invalid && <small role="alert">Lựa chọn chưa hợp lệ.</small>}</div>;
}
function DynamicAttributePicker({ attribute, values, onChange }: { attribute: DynamicAttribute; values: DynamicAttributeValues; onChange: (key: string, value: string | string[]) => void }) {
  const value = values[attribute.key];
  if (attribute.multiple) return <div className={styles.dynamicField}><span>{attribute.label}</span><div className={styles.chips}>{attribute.options.map(option => <label key={option} className={styles.chip}><input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={event => { const selected = Array.isArray(value) ? value : []; onChange(attribute.key, event.target.checked ? [...selected, option] : selected.filter(item => item !== option)); }}/><span>{option}</span>{Array.isArray(value) && value.includes(option) && <span aria-hidden="true">×</span>}</label>)}</div></div>;
  return <OptionPicker label={attribute.label} value={typeof value === "string" ? value : ""} values={attribute.options.map(option => ({ token: option, label: option }))} onChange={next => onChange(attribute.key, next)} />;
}
function SectionHeading({ number, title }: { number: number; title: string }) { return <div className={styles.sectionHeading}><span className={styles.step}>{number}</span><div><h2>{title}</h2></div></div>; }

function FieldLabel({ label }: { label: string }) { return <>{label.endsWith(" *") ? <>{label.slice(0, -2)} <span className={styles.required}>*</span></> : label}</>; }
function InputAdornment({ name, children }: { name: "barcode" | "text" | "link" | "layers" | "tag"; children: React.ReactNode }) { return <div className={styles.inputAdornment}><span className={styles.inputIcon}><AdminIcon name={name}/></span>{children}</div>; }
