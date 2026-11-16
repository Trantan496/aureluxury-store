import { publicProductImageUrl } from "./images.ts";
// Explicit marker: existing plain descriptions, including literal Markdown, stay unchanged.
export const descriptionPrefix = "aurel-description-v1\n";
export function descriptionSource(value: string) { return value.startsWith(descriptionPrefix) ? { formatted: true, text: value.slice(descriptionPrefix.length) } : { formatted: false, text: value }; }
export function descriptionLink(value: string) {
  if (/[\u0000-\u0020\u007f]/.test(value) || value.includes("\\")) return null;
  if (/^\/(?!\/)/.test(value)) return value;
  try { const url = new URL(value); return ["https:", "http:", "mailto:"].includes(url.protocol) ? value : null; } catch { return null; }
}
export type DescriptionInline = { kind: "text" | "strong" | "em" | "underline" | "strike" | "link"; text: string; href?: string };
export function descriptionInline(text: string): DescriptionInline[] {
  const result: DescriptionInline[] = [], expression = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|__([^_\n]+)__|~~([^~\n]+)~~|\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  let offset = 0;
  for (const match of text.matchAll(expression)) {
    const position = match.index!; if (position > offset) result.push({ kind: "text", text: text.slice(offset, position) });
    if (match[1]) result.push({ kind: "strong", text: match[1] });
    else if (match[2]) result.push({ kind: "em", text: match[2] });
    else if (match[3]) result.push({ kind: "underline", text: match[3] });
    else if (match[4]) result.push({ kind: "strike", text: match[4] });
    else { const href = descriptionLink(match[6]); result.push(href ? { kind: "link", text: match[5], href } : { kind: "text", text: match[0] }); }
    offset = position + match[0].length;
  }
  if (offset < text.length) result.push({ kind: "text", text: text.slice(offset) });
  return result;
}
export type DescriptionBlock = { kind: "paragraph" | "heading2" | "heading3" | "quote" | "indent"; text: string } | { kind: "list" | "ordered"; items: string[] } | { kind: "image"; src: string; alt: string } | { kind: "table"; rows: string[][] };
export function descriptionBlocks(value: string, allowedImages: readonly string[] = []): DescriptionBlock[] {
  const source = descriptionSource(value.slice(0, 10000));
  if (!source.formatted) return [{ kind: "paragraph", text: source.text }];
  const lines = source.text.replaceAll("\r\n", "\n").split("\n"), blocks: DescriptionBlock[] = [];
  const cells = (line: string) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map(s => s.trim()).slice(0, 12);
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]; if (!line.trim()) continue;
    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line);
    if (image) { const src = publicProductImageUrl(image[2]); if (src && allowedImages.includes(src)) blocks.push({ kind: "image", src, alt: image[1] }); else blocks.push({ kind: "paragraph", text: image[1] ? `[Ảnh: ${image[1]}]` : "[Ảnh chưa khả dụng]" }); continue; }
    if (line.startsWith("|") && /^\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(lines[n + 1] ?? "")) {
      const rows = [cells(line)]; n++;
      while (n + 1 < lines.length && lines[n + 1].startsWith("|") && rows.length < 51) rows.push(cells(lines[++n]));
      blocks.push({ kind: "table", rows }); continue;
    }
    const list = /^(- |\d+\. )(.*)$/.exec(line);
    if (list) { const ordered = list[1] !== "- ", items = [list[2]], regex = ordered ? /^\d+\. (.*)$/ : /^- (.*)$/; while (n + 1 < lines.length && regex.test(lines[n + 1])) items.push(regex.exec(lines[++n])![1]); blocks.push({ kind: ordered ? "ordered" : "list", items }); continue; }
    const heading = /^(#{2,3}) (.*)$/.exec(line);
    if (heading) blocks.push({ kind: heading[1].length === 2 ? "heading2" : "heading3", text: heading[2] });
    else if (line.startsWith("> ")) blocks.push({ kind: "quote", text: line.slice(2) });
    else if (line.startsWith("    ")) blocks.push({ kind: "indent", text: line.slice(4) });
    else blocks.push({ kind: "paragraph", text: line });
  }
  return blocks;
}
export function descriptionText(value: string) {
  if (!descriptionSource(value).formatted) return value;
  return descriptionBlocks(value).map(block => block.kind === "image" ? block.alt : "rows" in block ? block.rows.map(row => row.join(" · ")).join("\n") : "items" in block ? block.items.map(item => descriptionInline(item).map(i => i.text).join("")).join("\n") : descriptionInline(block.text).map(i => i.text).join("")).join("\n");
}
