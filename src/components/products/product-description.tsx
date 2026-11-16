import Image from "next/image";
import { descriptionBlocks, descriptionInline, descriptionSource } from "@/features/products/description";
import styles from "./product-description.module.css";
function Inline({ text }: { text: string }) { return descriptionInline(text).map((item, n) => item.kind === "strong" ? <strong key={n}>{item.text}</strong> : item.kind === "em" ? <em key={n}>{item.text}</em> : item.kind === "underline" ? <u key={n}>{item.text}</u> : item.kind === "strike" ? <s key={n}>{item.text}</s> : item.kind === "link" ? <a key={n} href={item.href} rel="nofollow noreferrer">{item.text}</a> : item.text); }
export function ProductDescription({ value, allowedImages = [] }: { value: string; allowedImages?: readonly string[] }) {
  if (!descriptionSource(value).formatted) return <p className={styles.plain}>{value}</p>;
  return <div className={styles.description}>{descriptionBlocks(value, allowedImages).map((block, n) => {
    if (block.kind === "image") return <Image key={n} src={block.src} alt={block.alt} width={800} height={800} unoptimized className={styles.image}/>;
    if (block.kind === "table") return <div key={n} className={styles.table}><table><thead><tr>{block.rows[0].map((cell, c) => <th key={c}><Inline text={cell}/></th>)}</tr></thead><tbody>{block.rows.slice(1).map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}><Inline text={cell}/></td>)}</tr>)}</tbody></table></div>;
    if (block.kind === "list" || block.kind === "ordered") { const Tag = block.kind === "ordered" ? "ol" : "ul"; return <Tag key={n}>{block.items.map((item, i) => <li key={i}><Inline text={item}/></li>)}</Tag>; }
    if ("text" in block) { const Tag = block.kind === "heading2" ? "h3" : block.kind === "heading3" ? "h4" : block.kind === "quote" ? "blockquote" : "p"; return <Tag key={n} className={block.kind === "indent" ? styles.indent : undefined}><Inline text={block.text}/></Tag>; }
  })}</div>;
}
