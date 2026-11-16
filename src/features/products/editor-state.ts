import { audienceSlug } from "./audience.ts";
import type { ManagementDTO } from "./management.ts";
import { profileFields, type OptionKey, type Profile } from "./foundation.ts";
import type { DynamicAttributeValues } from "./dynamic-attributes.ts";
import { codeCandidate, codeStem, productSlug, variantSku } from "./product-code.ts";
import {missingVariantPairs,allocateVariantSku} from "./variant-matrix.ts";

export type TaxonomyFeed = { extended: boolean; values: Record<OptionKey, { token: string; label: string }[]> };
export type DraftVariant = { key: string; id?: number; sku: string; color: string; size: string; stock: string; isActive: boolean; prices: { VND: string; USD: string; EUR: string } };
export type DraftImage = { key: string; id?: number; storageKey: string; altText: string; variantKey: string; sortOrder: string; imageType: string; isPrimary: boolean; sourceReference: string; rightsReference: string; websitePermission: string; embeddingPermission: string; trainingPermission: string; unsupportedReference?: boolean };
export type EditorDraft = { removedImageIds: number[]; name: string; slug: string; persistedId?: number; ageGroup: string; productCode: string; categoryId: string; collection: string; description: string; brand: string; searchTags: string; isActive: boolean; options: Profile; dynamicAttributes: DynamicAttributeValues; variants: DraftVariant[]; images: DraftImage[] };
export function editorDraft(row: ManagementDTO | null): EditorDraft {
  return { removedImageIds: [], name: row?.name ?? "", slug: row?.slug ?? "", persistedId: row?.id, ageGroup: row?.profile?.ageGroup ?? "", productCode: row?.productCode ?? "", categoryId: row ? String(row.categoryId) : "", collection: row?.collection ?? "", description: row?.description ?? "", brand: row ? row.brand ?? "" : "AUREL", searchTags: row?.searchTags ?? "", isActive: row?.isActive ?? false,
    options: Object.fromEntries(profileFields.map(k => [k, row?.profile?.[k] ?? (k.endsWith("Tags") ? [] : null)])) as Profile,
    dynamicAttributes: row?.profile?.dynamicAttributes && typeof row.profile.dynamicAttributes === "object" && !Array.isArray(row.profile.dynamicAttributes) ? row.profile.dynamicAttributes as DynamicAttributeValues : {},
    variants: row?.variants.map(v => ({ key: `variant-${v.id}`, id: v.id, sku: v.sku, color: v.color, size: v.size, stock: String(v.stock), isActive: v.isActive, prices: { VND: v.prices.find(p => p.currency === "VND")?.amount ?? "", USD: v.prices.find(p => p.currency === "USD")?.amount ?? "", EUR: v.prices.find(p => p.currency === "EUR")?.amount ?? "" } })) ?? [],
    images: row?.images.map(i => ({ key: `image-${i.id}`, id: i.id, storageKey: i.storageKey, altText: i.altText ?? "", variantKey: i.variantId ? `variant-${i.variantId}` : "", sortOrder: String(i.sortOrder), imageType: i.imageType ?? "", isPrimary: i.isPrimary, sourceReference: i.sourceReference ?? "", rightsReference: i.rightsReference ?? "", websitePermission: i.websitePermission, embeddingPermission: i.embeddingPermission, trainingPermission: i.trainingPermission, unsupportedReference: i.unsupportedReference })) ?? [] };
}
export function previewCode(draft: EditorDraft, extended: boolean) { return draft.productCode || codeCandidate(codeStem(draft.name, extended), 1, extended); }
export function draftSku(v: DraftVariant, code: string) { return v.id || v.sku ? v.sku : variantSku(code, v.color, v.size); }
export function completeDraftVariants(draft:EditorDraft,code:string):EditorDraft{
  const used=new Set(draft.variants.map(v=>draftSku(v,code)));
  const extra=missingVariantPairs(draft.variants,draft.variants.map(v=>v.color),draft.variants.map(v=>v.size));
  return {...draft,variants:[...draft.variants,...extra.map(pair=>({...newVariant(`matrix-${pair.color}-${pair.size}`),...pair,sku:allocateVariantSku(code,pair.color,pair.size,used),stock:"0",isActive:false}))]};
}
export function newVariant(key: string, source?: DraftVariant): DraftVariant {
  return { key, sku: "", color: source?.color ?? "black", size: source?.size ?? "M", stock: source?.stock ?? "0", isActive: source?.isActive ?? true, prices: { VND: source?.prices.VND ?? "", USD: source?.prices.USD ?? "", EUR: source?.prices.EUR ?? "" } };
}
export function removeDraftVariant(draft: EditorDraft, key: string): EditorDraft {
  if (draft.variants.find(v => v.key === key)?.id) return draft;
  return { ...draft, variants: draft.variants.filter(v => v.key !== key), images: draft.images.map(i => i.variantKey === key ? { ...i, variantKey: "" } : i) };
}
export function editorPayload(d: EditorDraft, extended: boolean) {
  const code = previewCode(d, extended), nullable = (s: string) => s.trim() || null;
  return { removedImageIds: d.removedImageIds, name: d.name, slug: draftSlug(d), ageGroup: d.ageGroup || null, productCode: code, categoryId: Number(d.categoryId), collection: nullable(d.collection), description: nullable(d.description), brand: nullable(d.brand), searchTags: d.searchTags.trim(), isActive: d.isActive, options: d.options, dynamicAttributes: d.dynamicAttributes,
    variants: d.variants.map(v => ({ ...(v.id ? { id: v.id } : {}), sku: draftSku(v, code), color: v.color, size: v.size, stock: Number(v.stock), isActive: v.isActive, prices: v.prices })),
    images: d.images.map(i => ({ ...(i.id ? { id: i.id } : {}), storageKey: i.storageKey, altText: nullable(i.altText), variantSku: d.variants.find(v => v.key === i.variantKey) ? draftSku(d.variants.find(v => v.key === i.variantKey)!, code) : "", sortOrder: Number(i.sortOrder), imageType: nullable(i.imageType), isPrimary: i.isPrimary, sourceReference: nullable(i.sourceReference), rightsReference: nullable(i.rightsReference), websitePermission: i.storageKey.startsWith("/images/uploads/") && i.websitePermission === "unknown" ? "granted" : i.websitePermission, embeddingPermission: i.embeddingPermission, trainingPermission: i.trainingPermission, ...(i.storageKey.startsWith("/images/uploads/") && i.websitePermission === "unknown" ? { rightsReference: nullable(i.rightsReference) || "Ảnh được quản trị chọn để hiển thị trên website" } : {}) })) };
}
export { productSlug };
export { fieldLabels, optionLabel } from "./taxonomy-labels.ts";

export function draftSlug(d: EditorDraft) { return d.persistedId ? d.slug : audienceSlug(d.name, d.options.gender, d.ageGroup); }
