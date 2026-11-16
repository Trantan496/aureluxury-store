import { audienceGroup } from "./audience.ts";
import { descriptionText } from "./description.ts";
import { publicProductImageUrl } from "./images.ts";
import { option, profile, taxonomyVersionFor, imageMetadata, type Profile, type TaxonomyRegistry } from "./foundation.ts";

export type FeatureSource = {
  id: number; category: { slug: string }; description: string | null; isActive: boolean;
  profile: (Profile & { ageGroup?: string | null }) | null;
  variants: { color: string; size: string; stock: number; isActive: boolean }[];
  images: { id: number; storageKey: string; sourceReference: string | null; rightsReference: string | null;
    websitePermission: string; embeddingPermission: string; trainingPermission: string }[];
};
export function extractFeatures(source: FeatureSource, purpose: "embedding" | "training" = "embedding", registry: TaxonomyRegistry = {}) {
  if (!["embedding", "training"].includes(purpose)) throw new Error("Invalid export purpose");
  if (!Number.isSafeInteger(source.id) || source.id < 1 || typeof source.isActive !== "boolean" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.category.slug) ||
      (source.description !== null && (typeof source.description !== "string" || source.description.length > 10000))) throw new Error("Invalid feature source");
  const { ageGroup, ...legacy } = source.profile ?? {};
  const descriptive = profile(legacy, registry);
  const hasAudience = Boolean(source.profile && Object.hasOwn(source.profile, "ageGroup"));
  const group = audienceGroup(ageGroup);
  const variants = source.variants.filter(variant => {
    if (!Number.isInteger(variant.stock) || variant.stock < 0 || typeof variant.isActive !== "boolean") throw new Error("Invalid variant");
    return variant.isActive;
  });
  const colors = [...new Set(variants.map(variant => option("color", variant.color, registry)))].sort();
  const sizes = [...new Set(variants.map(variant => option("size", variant.size, registry)))].sort();
  const imageReferences = source.images.flatMap(image => {
    if (!Number.isSafeInteger(image.id) || image.id < 1 || typeof image.storageKey !== "string") throw new Error("Invalid image reference");
    imageMetadata({ sourceReference: image.sourceReference, rightsReference: image.rightsReference,
      websitePermission: image.websitePermission, embeddingPermission: image.embeddingPermission, trainingPermission: image.trainingPermission });
    const url = publicProductImageUrl(image.storageKey);
    const allowed = purpose === "training" ? image.trainingPermission : image.embeddingPermission;
    return url && image.websitePermission === "granted" && allowed === "granted" && image.rightsReference?.trim() && image.sourceReference?.trim()
      ? [{ image_id: String(image.id), url }] : [];
  });
  const features = {
    category: source.category.slug, ...(hasAudience ? { age_group: group } : {}), garment_type: descriptive.garmentType, collar: descriptive.collar,
    fabric: descriptive.fabric, gender: descriptive.gender, fit: descriptive.fit, color: colors, size: sizes,
    style_tags: descriptive.styleTags, season_tags: descriptive.seasonTags, occasion_tags: descriptive.occasionTags,
    layer_role: descriptive.layerRole, pattern: descriptive.pattern, silhouette: descriptive.silhouette,
    description: source.description ? descriptionText(source.description).trim() || null : null, image_references: imageReferences,
  };
  const taxonomyVersion = taxonomyVersionFor(registry);
  return { schema_version: hasAudience ? "aurel-product-features-v3" : taxonomyVersion === "aurel-fashion-v1" ? "aurel-product-features-v1" : "aurel-product-features-v2", taxonomy_version: taxonomyVersion,
    product_id: String(source.id), purpose, features,
    eligibility: { active: source.isActive, in_stock: source.isActive && variants.some(variant => variant.stock > 0) },
    missing: Object.entries(features).filter(([, value]) => value === null || (Array.isArray(value) && value.length === 0)).map(([key]) => key) };
}
export function exportFeatureDataset(sources: FeatureSource[], purpose: "embedding" | "training" = "embedding", registry: TaxonomyRegistry = {}) {
  const rows: ReturnType<typeof extractFeatures>[] = [];
  const errors: { row: number; code: string }[] = [];
  const seen = new Set<number>();
  sources.forEach((source, index) => {
    try {
      if (seen.has(source.id)) throw new Error("Duplicate product");
      seen.add(source.id);
      rows.push(extractFeatures(source, purpose, registry));
    } catch { errors.push({ row: index + 1, code: "INVALID_FEATURE_SOURCE" }); }
  });
  return { jsonl: rows.map(row => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""),
    report: { input: sources.length, exported: rows.length, errors, missing: rows.map(row => ({ product_id: row.product_id, fields: row.missing })), ...(Object.keys(registry).length ? { taxonomyRegistry: registry } : {}) } };
}
