"use client";
import { useRef, useState } from "react";
import { descriptionPrefix, descriptionSource, descriptionLink } from "@/features/products/description";
import { publicProductImageUrl } from "@/features/products/images";
import { ProductDescription } from "@/components/products/product-description";
import styles from "./products.module.css";
type Action = "bold" | "italic" | "underline" | "strike" | "bullet" | "ordered" | "indent" | "quote" | "link" | "image" | "table";
const actions: { action: Action; label: string; glyph: string }[] = [{ action: "bold", label: "In đậm", glyph: "B" }, { action: "italic", label: "In nghiêng", glyph: "I" }, { action: "underline", label: "Gạch chân", glyph: "U" }, { action: "strike", label: "Gạch ngang", glyph: "S" }, { action: "bullet", label: "Danh sách gạch đầu dòng", glyph: "☷" }, { action: "ordered", label: "Danh sách đánh số", glyph: "≣" }, { action: "indent", label: "Thụt lề", glyph: "⇥" }, { action: "quote", label: "Trích dẫn", glyph: "❝" }, { action: "link", label: "Chèn liên kết", glyph: "↗" }, { action: "image", label: "Chèn ảnh đã cấp quyền", glyph: "▧" }, { action: "table", label: "Chèn bảng", glyph: "▦" }];
export function DescriptionEditor({ value, onChange, images }: { value: string; onChange: (value: string) => void; images: { url: string; alt: string }[] }) {
  const textarea = useRef<HTMLTextAreaElement>(null), wrapper = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<{ past: string[]; future: string[] }>({ past: [], future: [] });
  const [preview, setPreview] = useState(false), [notice, setNotice] = useState(""), [expanded, setExpanded] = useState(false);
  const source = descriptionSource(value);
  function write(text: string, formatted: boolean, cursor?: number) {
    const next = (formatted && text.trim() ? descriptionPrefix : "") + text;
    if (next.length > 10000) { setNotice("Mô tả tối đa 10.000 ký tự, bao gồm ký hiệu định dạng."); return; }
    setHistory(h => ({ past: [...h.past, value].slice(-80), future: [] })); onChange(next); setNotice("");
    if (cursor !== undefined) requestAnimationFrame(() => { textarea.current?.focus(); textarea.current?.setSelectionRange(cursor, cursor); });
  }
  function lineFormat(prefix: string | ((n: number) => string)) {
    const node = textarea.current; if (!node) return;
    const start = (node.selectionStart === 0 ? 0 : source.text.lastIndexOf("\n", node.selectionStart - 1) + 1);
    const lineEnd = source.text.indexOf("\n", node.selectionEnd), end = lineEnd < 0 ? source.text.length : lineEnd;
    const selected = source.text.slice(start, end).split("\n").map((line, n) => (typeof prefix === "string" ? prefix : prefix(n)) + (prefix === "" ? line.replace(/^(?:#{2,3} |> |- |\d+\. | {4})/, "") : line)).join("\n");
    write(source.text.slice(0, start) + selected + source.text.slice(end), true, start + selected.length);
  }
  function format(action: Action) {
    const node = textarea.current; if (!node) return; setPreview(false);
    if (action === "bullet") return lineFormat("- ");
    if (action === "ordered") return lineFormat(n => `${n + 1}. `);
    if (action === "indent") return lineFormat("    ");
    if (action === "quote") return lineFormat("> ");
    const start = node.selectionStart, end = node.selectionEnd, selected = source.text.slice(start, end);
    let insert = "", cursor = 0;
    const markers = { bold: "**", italic: "*", underline: "__", strike: "~~" };
    if (action in markers) { const marker = markers[action as keyof typeof markers]; insert = marker + (selected || "Nội dung") + marker; cursor = start + insert.length; }
    else if (action === "link") { const input = window.prompt("Nhập liên kết (https://… hoặc /đường-dẫn):"); if (input === null) return; const href = descriptionLink(input.trim()); if (!href) { setNotice("Liên kết không hợp lệ. Dùng http, https, mailto hoặc đường dẫn nội bộ."); return; } insert = `[${selected || "Liên kết"}](${href})`; }
    else if (action === "image") { if (!images.length) return; const input = window.prompt(`Chọn số thứ tự ảnh đã cấp quyền website:\n${images.map((i, n) => `${n + 1}. ${i.alt || i.url}`).join("\n")}`); if (input === null) return; const image = images[Number(input) - 1]; if (!image || !publicProductImageUrl(image.url)) { setNotice("Hãy chọn số thứ tự ảnh hợp lệ."); return; } insert = `\n\n![${image.alt.replace(/[\[\]\n]/g, " ")}](${image.url})\n\n`; }
    else if (action === "table") insert = "\n\n| Cột 1 | Cột 2 |\n| --- | --- |\n|  |  |\n\n";
    write(source.text.slice(0, start) + insert + source.text.slice(end), true, cursor || start + insert.length);
  }
  function undo() { const previous = history.past.at(-1); if (previous === undefined) return; setHistory(h => ({ past: h.past.slice(0, -1), future: [value, ...h.future] })); onChange(previous); }
  function redo() { const next = history.future[0]; if (next === undefined) return; setHistory(h => ({ past: [...h.past, value], future: h.future.slice(1) })); onChange(next); }
  return <div ref={wrapper} className={`${styles.descriptionEditor} ${expanded ? styles.editorExpanded : ""}`} onKeyDown={e => { if (e.key === "Escape") setExpanded(false); if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); } }}>
    <div className={styles.descriptionToolbar} role="group" aria-label="Định dạng mô tả"><select aria-label="Kiểu đoạn văn" disabled={preview} value="" onChange={e => { if (e.target.value === "paragraph") lineFormat(""); else lineFormat(e.target.value + " "); }}><option value="" disabled>Đoạn văn</option><option value="paragraph">Đoạn văn</option><option value="##">Tiêu đề 2</option><option value="###">Tiêu đề 3</option></select>{actions.map(a => <button key={a.action} type="button" className={`${styles.formatAction} ${["bold", "italic", "underline", "strike"].includes(a.action) ? styles[a.action] : ""}`} title={a.action === "image" && !images.length ? "Thêm ảnh và cấp quyền website trong mục Hình ảnh trước" : a.label} aria-label={a.label} disabled={preview || (a.action === "image" && !images.length)} onMouseDown={e => e.preventDefault()} onClick={() => format(a.action)}>{a.glyph}</button>)}<span className={styles.toolbarSpace}/><button type="button" aria-label="Hoàn tác mô tả" title="Hoàn tác" disabled={!history.past.length} onClick={undo}>↶</button><button type="button" aria-label="Làm lại mô tả" title="Làm lại" disabled={!history.future.length} onClick={redo}>↷</button><button type="button" aria-label={expanded ? "Thu nhỏ vùng mô tả" : "Mở rộng vùng mô tả"} aria-pressed={expanded} title="Mở rộng / thu nhỏ" onClick={() => setExpanded(v => !v)}>⛶</button></div>
    {preview ? <div className={styles.descriptionPreview}><ProductDescription value={value || "Chưa có mô tả"} allowedImages={images.map(i => i.url)}/></div> : <textarea ref={textarea} aria-label="Mô tả sản phẩm" placeholder="Nhập mô tả sản phẩm…" value={source.text} maxLength={10000 - (source.formatted ? descriptionPrefix.length : 0)} onChange={e => write(e.target.value, source.formatted)}/>}
    <div className={styles.editorFootnote}><span>{source.formatted ? "Định dạng Markdown · chọn Xem trước để xem nội dung hiển thị" : "Văn bản thuần · chọn nút trên để thêm định dạng"}</span><button type="button" aria-pressed={preview} onClick={() => setPreview(v => !v)}>{preview ? "Soạn thảo" : "Xem trước"}</button><small>{value.length}/10000</small></div>{notice && <p role="status" className={styles.editorNotice}>{notice}</p>}
  </div>;
}
