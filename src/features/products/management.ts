import { audienceGroup, audienceSlug } from "./audience.ts";
import { imageAssetId } from "./image-storage.ts";
import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.ts";
import { ServiceError, type ProductDataTransaction, type ServiceResult } from "./product-service.ts";
import { integer, object, InputError, validateData, type ProductInput, type VariantInput, type ImageInput } from "./validation.ts";
import { profile, productCode, collectionCode, option, imageMetadata, taxonomyVersionFor } from "./foundation.ts";
import { dynamicAttributes } from "./dynamic-attributes.ts";
import { currencies, money, minorDigits } from "../money/money.ts";
import { publicProductImageUrl } from "./images.ts";
import { dryRunImport, importColumns, importHeaderMatches, parseCsv, type ImportBundle, type ImportTable } from "./import-dry-run.ts";
import { readTaxonomy, customOption } from "./taxonomy-registry.ts";
import { codeStem, codeCandidate, normalizedWords } from "./product-code.ts";
import { optionLabel } from "./taxonomy-labels.ts";
import {clothingCategories,matchingCategory} from "./category-options.ts";
import type { TaxonomyRegistry } from "./foundation.ts";
import {readVariantColours} from "./variant-colours.ts";
import type {VariantColours} from "./variant-matrix.ts";
import {allocateVariantSku} from "./variant-matrix.ts";
import { formatAurelProductName } from "./product-name.ts";
import { defaultProductTagStore, formatSemicolonTags, parseSemicolonTags } from "./product-tags.ts";

export type AuditEvent = { action: "delete_intent" | "delete_committed" | "delete_failed"; actorId: number; productId: number; productCode: string; operationId: string };
export type AuditWriter = (event: AuditEvent) => Promise<void>;
type Run = <T>(work: (tx: ProductDataTransaction, actorId: number) => Promise<T>) => Promise<ServiceResult<T>>;
// `dynamicAttributes` is deployed independently.  Keep the admin editor usable
// against the approved main schema while that additive migration is pending.
const profileSelect = { productId: true, collar: true, fabric: true, gender: true, ageGroup: true, fit: true, garmentType: true,
  styleTags: true, seasonTags: true, occasionTags: true, layerRole: true, pattern: true, silhouette: true, taxonomyVersion: true, updatedAt: true } satisfies Prisma.ProductProfileSelect;
const include = { profile: { select: profileSelect }, category: true, variants: { orderBy: { id: "asc" as const }, include: { prices: { orderBy: { currency: "asc" as const } } } }, images: { orderBy: { id: "asc" as const } } } satisfies Prisma.ProductInclude;
export type ManagedProduct = Prisma.ProductGetPayload<{ include: typeof include }>;
type LoadedProfile = NonNullable<ManagedProduct["profile"]> & { dynamicAttributes?: Prisma.JsonValue };
type LoadedProduct = Omit<ManagedProduct, "profile"> & { profile: LoadedProfile | null; searchTags?: string[] };
function digest(input: unknown) { return createHash("sha256").update(JSON.stringify(input)).digest("hex"); }
export function versionOf(row: LoadedProduct) { return digest(row); }
export function dto(row: LoadedProduct) {
  return { ...row, name: formatAurelProductName(row.name), searchTags: formatSemicolonTags(row.searchTags), version: versionOf(row), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt?.toISOString() ?? null,
    profile: row.profile ? { ...row.profile, dynamicAttributes: row.profile.dynamicAttributes ?? {}, updatedAt: row.profile.updatedAt.toISOString() } : null,
    variants: row.variants.map(v => ({ ...v, price: null, prices: v.prices.map(p => ({ currency: p.currency, amount: p.amount.toFixed(minorDigits[p.currency]) })) })),
    images: row.images.map(i => ({ ...i, storageKey: publicProductImageUrl(i.storageKey) ?? "", unsupportedReference: !publicProductImageUrl(i.storageKey) })), unitsSold: null };
}
export type ManagementDTO = ReturnType<typeof dto> & {variantColors?:VariantColours};
export type EditorInput = { productCode: string; name: string; slug: string; categoryId: number; collection: string | null; description: string | null; brand: string | null; isActive: boolean; ageGroup?: string | null; searchTags?: string; options: unknown; dynamicAttributes?: unknown; variants: unknown[]; images: unknown[]; removedImageIds?: number[] };
function list(value: unknown, max: number, field: string): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new InputError(field); return value;
}
export const editorInputFields = [
  "productCode",
  "name",
  "slug",
  "categoryId",
  "collection",
  "description",
  "brand",
  "isActive",
  "options",
  "dynamicAttributes",
  "variants",
  "images",
  "ageGroup",
  "removedImageIds",
  "searchTags",
] as const;

export function validateEditor(input: unknown, registry: TaxonomyRegistry = {}) {
  const data = object(input, editorInputFields);
  const base = validateData("product", { name: formatAurelProductName(data.name), slug: data.slug, categoryId: data.categoryId, description: data.description, brand: data.brand, isActive: data.isActive }) as ProductInput;
  let searchTags: string[] | undefined;
  if (data.searchTags !== undefined && data.searchTags !== null) {
    if (typeof data.searchTags !== "string" || data.searchTags.length > 500 || /[\u0000-\u001f\u007f]/.test(data.searchTags)) {
      throw new InputError("searchTags");
    }
    searchTags = parseSemicolonTags(data.searchTags);
  }
  const variants = list(data.variants, 200, "variants").map(raw => {
    const v = object(raw, ["id", "sku", "color", "size", "stock", "isActive", "prices"]);
    const parsed = validateData("variant", { productId: 1, sku: v.sku, color: option("color", v.color, registry), size: option("size", v.size, registry), stock: v.stock, isActive: v.isActive }) as VariantInput;
    parsed.sku = parsed.sku.trim().toUpperCase();
    if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(parsed.sku)) throw new InputError("sku");
    const prices = object(v.prices, currencies);
    return { ...parsed, id: v.id === undefined ? undefined : integer(v.id, "variantId"), prices: currencies.filter(c => prices[c] !== undefined && prices[c] !== "").map(c => ({ currency: c, amount: money(prices[c], c) })) };
  });
  if (base.isActive && !variants.some(v => v.isActive)) throw new InputError("activeVariants");
  for (const key of ["sku", "id"] as const) {
    const values = variants.map(v => v[key]).filter(v => v !== undefined); if (new Set(values).size !== values.length) throw new InputError(key);
  }
  if (new Set(variants.map(v => JSON.stringify([v.color, v.size]))).size !== variants.length) throw new InputError("combination");
  const images = list(data.images, 100, "images").map(raw => {
    const i = object(raw, ["id", "storageKey", "altText", "sortOrder", "variantSku", "imageType", "isPrimary", "sourceReference", "rightsReference", "websitePermission", "embeddingPermission", "trainingPermission"]);
    const base = validateData("image", { productId: 1, storageKey: i.storageKey, altText: i.altText, sortOrder: i.sortOrder }) as ImageInput;
    if (!publicProductImageUrl(base.storageKey)) throw new InputError("storageKey");
    const meta = imageMetadata(Object.fromEntries(["imageType", "isPrimary", "sourceReference", "rightsReference", "websitePermission", "embeddingPermission", "trainingPermission"].map(k => [k, i[k]])));
    if ([meta.websitePermission, meta.embeddingPermission, meta.trainingPermission].includes("granted") && !meta.rightsReference) throw new InputError("rightsReference");
    const sku = typeof i.variantSku === "string" ? i.variantSku.trim().toUpperCase() : "";
    if (sku && !variants.some(v => v.sku === sku)) throw new InputError("variantSku");
    return { ...base, ...meta, isPrimary: meta.isPrimary === true, id: i.id === undefined ? undefined : integer(i.id, "imageId"), variantSku: sku };
  });
  if (images.filter(i => i.isPrimary).length > 1) throw new InputError("isPrimary");
  const imageIds = images.flatMap(i => i.id === undefined ? [] : [i.id]); if (new Set(imageIds).size !== imageIds.length) throw new InputError("imageId");
  const removedImageIds = list(data.removedImageIds ?? [], 100, "removedImageIds").map(id => integer(id, "imageId"));
  if (new Set(removedImageIds).size !== removedImageIds.length || removedImageIds.some(id => imageIds.includes(id))) throw new InputError("imageId");
  const options = profile(data.options, registry);
  return { base, productCode: productCode(data.productCode), collection: collectionCode(data.collection), options, dynamicAttributes: dynamicAttributes(data.dynamicAttributes, options.garmentType), ageGroup: audienceGroup(data.ageGroup), ...(searchTags !== undefined ? { searchTags } : {}), variants, images, removedImageIds };
}
async function hasDynamicAttributes(tx: ProductDataTransaction) {
  const result = await tx.$queryRaw<{ available: boolean }[]>`SELECT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = to_regclass('public."ProductProfile"')
      AND attname = 'dynamicAttributes' AND NOT attisdropped
  ) AS available`;
  return result[0]?.available === true;
}
export async function load(tx: ProductDataTransaction, id: unknown): Promise<LoadedProduct> {
  const row = await tx.product.findUnique({ where: { id: integer(id, "productId") }, include });
  if (!row) throw new ServiceError("NOT_FOUND");
  const tags = await defaultProductTagStore.getTagsForProduct(row.id);
  const withTags: LoadedProduct = tags.length > 0 ? { ...row, searchTags: tags } : row;
  if (!row.profile || !await hasDynamicAttributes(tx)) return withTags;
  const dynamic = await tx.$queryRaw<{ dynamicAttributes: Prisma.JsonValue }[]>`SELECT "dynamicAttributes" FROM public."ProductProfile" WHERE "productId" = ${row.id}`;
  return { ...withTags, profile: { ...row.profile, dynamicAttributes: dynamic[0]?.dynamicAttributes ?? {} } };
}
export async function checked(tx: ProductDataTransaction, id: unknown, version: unknown): Promise<LoadedProduct> {
  const row = await load(tx, id);
  if (typeof version !== "string" || version !== versionOf(row)) throw new ServiceError("CONFLICT");
  return row;
}
async function allocatedCode(tx: ProductDataTransaction, name: string, extended: boolean) {
  const stem = codeStem(name, extended);
  await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext(${stem}))`;
  const existing = await tx.product.findMany({ where: { productCode: { startsWith: stem } }, select: { productCode: true }, orderBy: { productCode: "desc" }, take: 10000 });
  const taken = new Set(existing.map(p => p.productCode));
  for (let n = 1; n <= 9999; n++) { const candidate = codeCandidate(stem, n, extended); if (!taken.has(candidate)) return candidate; }
  throw new ServiceError("CONFLICT");
}
async function allocatedSlug(tx: ProductDataTransaction, base: string) {
  await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext(${'slug:' + base}))`;
  for (let n = 1; n <= 9999; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!await tx.product.findUnique({ where: { slug: candidate }, select: { id: true } })) return candidate;
  }
  throw new ServiceError("CONFLICT");
}
export async function persist(tx: ProductDataTransaction, input: unknown, old?: LoadedProduct, automatic = false) {
  const feed = await readTaxonomy(tx);
  let prepared = input;
  if (automatic) {
    const incoming = object(input, editorInputFields);
    const name = typeof incoming.name === "string" ? incoming.name : "";
    if (!name.trim() || name.length > 200) throw new InputError("name");
    const code = old?.productCode ?? await allocatedCode(tx, name, feed.extended);
    const group = audienceGroup(incoming.ageGroup === undefined ? old?.profile?.ageGroup : incoming.ageGroup);
    const slug = old?.slug ?? await allocatedSlug(tx, audienceSlug(name, profile(incoming.options, feed.registry).gender, group));
    const aliases = new Map<string, string>();
    const usedSkus=new Set(old?.variants.map(v=>v.sku)??[]);
    const variants = list(incoming.variants, 200, "variants").map(raw => {
      const v = object(raw, ["id", "sku", "color", "size", "stock", "isActive", "prices"]);
      const existing = v.id === undefined ? undefined : old?.variants.find(row => row.id === v.id);
      if (v.id !== undefined && !existing) throw new InputError("childOwnership");
      const sku = existing?.sku ?? allocateVariantSku(code, option("color", v.color, feed.registry), option("size", v.size, feed.registry),usedSkus);
      if (typeof v.sku === "string" && v.sku) { if (aliases.has(v.sku) && aliases.get(v.sku) !== sku) throw new InputError("sku"); aliases.set(v.sku, sku); }
      return { ...v, sku };
    });
    const images = list(incoming.images, 100, "images").map(raw => { const i = object(raw, ["id", "storageKey", "altText", "sortOrder", "variantSku", "imageType", "isPrimary", "sourceReference", "rightsReference", "websitePermission", "embeddingPermission", "trainingPermission"]); return { ...i, variantSku: aliases.get(String(i.variantSku)) ?? i.variantSku }; });
    prepared = { ...incoming, slug, ageGroup: group, productCode: code, brand: incoming.brand === undefined ? "AUREL" : incoming.brand, variants, images };
  }
  const data = validateEditor(prepared, feed.registry);
  for (const image of data.images) {
    if (image.storageKey.startsWith("/images/uploads/")) {
      const id = imageAssetId(image.storageKey);
      if (!id || !await tx.imageAsset.findUnique({ where: { id }, select: { id: true } })) throw new InputError("storageKey");
    }
  }
  if (!feed.extended && !/^AUR-[0-9]{4,12}$/.test(data.productCode)) throw new InputError("productCode");
  const sameSlug = await tx.product.findUnique({ where: { slug: data.base.slug }, select: { id: true } });
  if (sameSlug && sameSlug.id !== old?.id) throw new InputError("slug");
  // Omission never silently removes persisted children; archive variants explicitly.
  if (old && (old.variants.some(v => !data.variants.some(n => n.id === v.id)) || old.images.some(i => !data.images.some(n => n.id === i.id) && !data.removedImageIds.includes(i.id)))) throw new InputError("missingChildren");
  if (data.variants.some(v => v.id !== undefined && !old?.variants.some(o => o.id === v.id)) || data.images.some(i => i.id !== undefined && !old?.images.some(o => o.id === i.id))) throw new InputError("childOwnership");
  if (data.removedImageIds.some(id => !old?.images.some(i => i.id === id))) throw new InputError("childOwnership");
  if (data.removedImageIds.length) await tx.productImage.deleteMany({ where: { productId: old!.id, id: { in: data.removedImageIds } } });
  const parent = { ...data.base, productCode: data.productCode, collection: data.collection };
  const row = old ? await tx.product.update({ where: { id: old.id }, data: parent }) : await tx.product.create({ data: parent });
  const taxonomyVersion = taxonomyVersionFor(feed.registry);
  const profileData = { ...data.options, ageGroup: data.ageGroup, taxonomyVersion };
  if (await hasDynamicAttributes(tx)) {
    const dynamicData = { dynamicAttributes: data.dynamicAttributes };
    await tx.productProfile.upsert({ where: { productId: row.id }, create: { productId: row.id, ...profileData, ...dynamicData }, update: { ...profileData, ...dynamicData }, select: profileSelect });
  } else {
    // Prisma materializes schema defaults on INSERT even when omitted from data
    // and select. Explicit columns keep the pre-migration schema writable.
    await tx.$queryRaw`INSERT INTO public."ProductProfile"
      ("productId", "collar", "fabric", "gender", "ageGroup", "fit", "garmentType",
       "styleTags", "seasonTags", "occasionTags", "layerRole", "pattern", "silhouette", "taxonomyVersion", "updatedAt")
      VALUES (${row.id}, ${profileData.collar}, ${profileData.fabric}, ${profileData.gender},
        ${profileData.ageGroup}, ${profileData.fit}, ${profileData.garmentType},
        ${profileData.styleTags}::text[], ${profileData.seasonTags}::text[], ${profileData.occasionTags}::text[],
        ${profileData.layerRole}, ${profileData.pattern}, ${profileData.silhouette}, ${taxonomyVersion}, CURRENT_TIMESTAMP)
      ON CONFLICT ("productId") DO UPDATE SET
        "collar" = EXCLUDED."collar", "fabric" = EXCLUDED."fabric", "gender" = EXCLUDED."gender",
        "ageGroup" = EXCLUDED."ageGroup", "fit" = EXCLUDED."fit", "garmentType" = EXCLUDED."garmentType",
        "styleTags" = EXCLUDED."styleTags", "seasonTags" = EXCLUDED."seasonTags", "occasionTags" = EXCLUDED."occasionTags",
        "layerRole" = EXCLUDED."layerRole", "pattern" = EXCLUDED."pattern", "silhouette" = EXCLUDED."silhouette",
        "taxonomyVersion" = EXCLUDED."taxonomyVersion", "updatedAt" = EXCLUDED."updatedAt"
      RETURNING "productId"`;
  }
  const ids = new Map<string, number>();
  for (const v of data.variants) {
    const { id, prices, ...values } = v;
    const valuesWithParent = { ...values, productId: row.id };
    const variant = id ? await tx.productVariant.update({ where: { id, productId: row.id }, data: valuesWithParent }) : await tx.productVariant.create({ data: valuesWithParent });
    ids.set(variant.sku, variant.id);
    await tx.productPrice.deleteMany({ where: { variantId: variant.id, currency: { notIn: prices.map(p => p.currency) } } });
    for (const p of prices) await tx.productPrice.upsert({ where: { variantId_currency: { variantId: variant.id, currency: p.currency } }, create: { variantId: variant.id, ...p }, update: { amount: p.amount } });
  }
  await tx.productImage.updateMany({ where: { productId: row.id, isPrimary: true }, data: { isPrimary: false } });
  for (const i of data.images) {
    const { id, variantSku, ...values } = i;
    const valuesWithParent = { ...values, productId: row.id, variantId: ids.get(variantSku) ?? null } as Prisma.ProductImageUncheckedCreateInput;
    if (id) await tx.productImage.update({ where: { id, productId: row.id }, data: valuesWithParent });
    else await tx.productImage.create({ data: valuesWithParent });
  }
  if (data.searchTags !== undefined) {
    await defaultProductTagStore.setTagsForProduct(row.id, data.searchTags);
  }
  return dto(await load(tx, row.id));
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function csvText(table: ImportTable, rows: Record<string, unknown>[]) {
  return "\uFEFF" + importColumns[table].join(",") + "\r\n" + rows.map(r => importColumns[table].map(k => csvCell(r[k])).join(",")).join("\r\n");
}
export function parseBundle(input: unknown): ImportBundle {
  const files = object(input, Object.keys(importColumns));
  let bytes = 0, rows = 0;
  const bundle = {} as ImportBundle;
  for (const table of Object.keys(importColumns) as ImportTable[]) {
    const text = files[table] ?? importColumns[table].join(",");
    if (typeof text !== "string" || text.includes("\uFFFD") || text.includes("\0")) throw new InputError("encoding");
    bytes += Buffer.byteLength(text); if (bytes > 2_000_000) throw new InputError("fileSize");
    // Also validate headers in empty files (parseCsv only returns data rows).
    if (!importHeaderMatches(table, text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/)[0])) throw new InputError("headers");
    try { bundle[table] = parseCsv(text, 2000).map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, key === "sku" ? value.trim().toUpperCase() : ["product_code", "slug", "category_slug"].includes(key) ? value.trim() : value]))); } catch { throw new InputError("csv"); }
    rows += bundle[table].length; if (rows > 2000 || bundle.products?.length > 100) throw new InputError("rowLimit");
  }
  if (!bundle.products.length) throw new InputError("products");
  return bundle;
}
async function baseline(tx: ProductDataTransaction, bundle: ImportBundle) {
  const products = await tx.product.findMany({ where: { OR: [{ productCode: { in: bundle.products.map(p => p.product_code) } }, { slug: { in: bundle.products.map(p => p.slug) } }] }, select: { productCode: true, slug: true } });
  const keys = bundle.product_variants.map(v => v.sku.trim().toUpperCase());
  const skus = keys.length ? await tx.$queryRaw<{ sku: string }[]>(Prisma.sql`SELECT sku FROM "ProductVariant" WHERE upper(trim(sku)) IN (${Prisma.join(keys)})`) : [];
  const categories = await tx.category.findMany({ where: { slug: { in: bundle.products.map(p => p.category_slug) } }, orderBy: { id: "asc" }, select: { id: true, slug: true } });
  return { categories, snapshot: { productCodes: products.flatMap(p => p.productCode ? [p.productCode] : []), slugs: products.map(p => p.slug), skus: skus.map(v => v.sku), categorySlugs: categories.map(c => c.slug) } };
}
function bundleEditor(bundle: ImportBundle, row: ImportBundle["products"][number], categoryId: number) {
  const opts = bundle.product_options.find(o => o.product_code === row.product_code);
  const ai = bundle.product_ai_attributes.find(o => o.product_code === row.product_code);
  return { productCode: row.product_code, name: row.name, slug: row.slug, categoryId, collection: row.collection || null, description: row.description || null, brand: null, isActive: row.is_active === "true",
    ageGroup: ai?.age_group || null, options: { collar: opts?.collar || null, fabric: opts?.fabric || null, gender: opts?.gender || null, fit: opts?.fit || null, garmentType: ai?.garment_type || null, layerRole: ai?.layer_role || null, pattern: ai?.pattern || null, silhouette: ai?.silhouette || null, styleTags: ai?.style_tags ? ai.style_tags.split("|") : [], seasonTags: ai?.season_tags ? ai.season_tags.split("|") : [], occasionTags: ai?.occasion_tags ? ai.occasion_tags.split("|") : [] },
    variants: bundle.product_variants.filter(v => v.product_code === row.product_code).map(v => ({ sku: v.sku, color: v.color, size: v.size, stock: Number(v.stock), isActive: v.is_active === "true", prices: Object.fromEntries(bundle.product_prices.filter(p => p.sku.trim().toUpperCase() === v.sku.trim().toUpperCase()).map(p => [p.currency, p.amount])) })),
    images: bundle.product_images.filter(i => i.product_code === row.product_code).map(i => ({ storageKey: i.storage_key, variantSku: i.sku, altText: i.alt_text || null, sortOrder: Number(i.sort_order), imageType: i.image_type || null, isPrimary: i.is_primary === "true", sourceReference: i.source_reference || null, rightsReference: i.rights_reference || null, websitePermission: i.website_permission, embeddingPermission: i.embedding_permission, trainingPermission: i.training_permission })) };
}
export function createManagementOperations(run: Run, audit?: AuditWriter) {
  return {
    async managementPrepare(input: unknown, id?: unknown, version?: unknown, requestKey?: unknown) {
      for (let attempt = 0; ; attempt++) {
        const result = await run(async (tx, actorId) => {
          const incoming = object(input, editorInputFields);
          if (id !== undefined) return persist(tx, { ...incoming, isActive: false }, await checked(tx, id, version), true);
          if (typeof requestKey !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(requestKey)) throw new InputError("requestKey");
          const capability = await tx.$queryRaw<{ available: boolean }[]>`SELECT to_regclass('public."ProductDraftRequest"') IS NOT NULL AS available`;
          if (!capability[0]?.available) throw new ServiceError("FEATURE_UNAVAILABLE");
          await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext(${"draft:" + requestKey}))`;
          const ticket = await tx.productDraftRequest.findUnique({ where: { key: requestKey } });
          if (ticket) { if (ticket.actorId !== actorId) throw new ServiceError("FORBIDDEN"); return dto(await load(tx, ticket.productId)); }
          const product = await persist(tx, { ...incoming, isActive: false }, undefined, true);
          await tx.productDraftRequest.create({ data: { key: requestKey, actorId, productId: product.id } });
          return product;
        });
        if (id !== undefined || result.ok || result.error.code !== "CONFLICT" || attempt >= 3) return result;
      }
    },
    managementTaxonomy() { return run(async tx => { const feed = await readTaxonomy(tx); return { extended: feed.extended, values: feed.values }; }); },
    managementAddOption(input: unknown) { return run(async tx => {
      const data = object(input, ["key", "label"]), parsed = customOption(data.key, data.label), feed = await readTaxonomy(tx);
      if (!feed.extended) throw new ServiceError("FEATURE_UNAVAILABLE");
      if (feed.values[parsed.key].some(v => v.token.toLowerCase() === parsed.token.toLowerCase() || normalizedWords(optionLabel(v.token, v.label)) === normalizedWords(parsed.label))) throw new InputError("duplicateOption");
      if ((await tx.taxonomyOption.count()) >= 2000) throw new InputError("taxonomyLimit");
      return tx.taxonomyOption.create({ data: parsed, select: { key: true, token: true, label: true } });
    }); },
    managementList(input: unknown = {}) { return run(async tx => {
      const v = object(input, ["q", "page", "status", "category", "collection"]);
      const page = integer(v.page ?? 1, "page", 1, 100000);
      if (v.q !== undefined && (typeof v.q !== "string" || v.q.length > 200)) throw new InputError("q");
      if (v.status !== undefined && !["all", "active", "archived"].includes(String(v.status))) throw new InputError("status");
      if (v.collection !== undefined && (typeof v.collection !== "string" || v.collection.length > 100)) throw new InputError("collection");
      const where: Prisma.ProductWhereInput = { ...(v.q ? { OR: [{ name: { contains: String(v.q), mode: "insensitive" } }, { productCode: { contains: String(v.q), mode: "insensitive" } }] } : {}), ...(v.status === "active" ? { isActive: true } : v.status === "archived" ? { isActive: false } : {}), ...(v.category ? { categoryId: integer(v.category, "categoryId") } : {}), ...(v.collection ? { collection: String(v.collection) } : {}) };
      const rows = await tx.product.findMany({ where, take: 25, skip: (page - 1) * 25, orderBy: { id: "desc" }, select: { id: true, name: true, productCode: true, categoryId: true, collection: true, isActive: true } });
      const total = await tx.product.count({ where });
      const categories = await tx.category.findMany({ take: 201, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });
      const collections = await tx.product.findMany({ where: { collection: { not: null } }, distinct: ["collection"], take: 201, orderBy: { collection: "asc" }, select: { collection: true } });
      return { rows: rows.map(r => ({ ...r, name: formatAurelProductName(r.name) })), total, page, categories: categories.slice(0, 200), collections: collections.slice(0, 200).flatMap(c => c.collection ? [c.collection] : []), navigationLimited: categories.length > 200 || collections.length > 200 };
    }); },
    managementGet(id: unknown) { return run<ManagementDTO>(async tx => {const row=await load(tx,id);return {...dto(row),variantColors:await readVariantColours(tx,row.variants.map(v=>v.color))};}); },
    managementCategories(input: unknown = {}) { return run(async tx => {
      const v = object(input, ["q", "page"]), page = integer(v.page ?? 1, "page", 1, 100000);
      if (typeof v.q !== "string" || v.q.length > 200) throw new InputError("q");
      const where: Prisma.CategoryWhereInput = { OR: [{ name: { contains: v.q, mode: "insensitive" } }, { slug: { contains: v.q, mode: "insensitive" } }] };
      return { rows: await tx.category.findMany({ where, skip: (page - 1) * 50, take: 50, orderBy: { id: "asc" }, select: { id: true, name: true, slug: true } }), total: await tx.category.count({ where }), page };
    }); },
    managementRemoveImage(id: unknown, imageId: unknown, version: unknown) { return run(async tx => {
      const row = await checked(tx, id, version), child = integer(imageId, "imageId");
      if (!row.images.some(i => i.id === child)) throw new ServiceError("NOT_FOUND");
      await tx.productImage.delete({ where: { id: child, productId: row.id } });
      await tx.product.update({ where: { id: row.id }, data: { isActive: row.isActive } });
      return dto(await load(tx, row.id));
    }); },
    async managementSave(input: unknown, id?: unknown, version?: unknown) {
      // Each retry opens a new authorized Serializable transaction/snapshot. Never retry edits.
      for (let attempt = 0; ; attempt++) {
        const result = await run(async tx => persist(tx, input, id === undefined ? undefined : await checked(tx, id, version), true));
        if (id !== undefined || result.ok || result.error.code !== "CONFLICT" || attempt >= 3) return result;
      }
    },
    managementStatus(id: unknown, version: unknown, active: unknown) { return run(async tx => {
      if (typeof active !== "boolean") throw new InputError("isActive");
      const row = await checked(tx, id, version);
      if (active) {
        productCode(row.productCode);
        if (!row.variants.some(v => v.isActive && v.stock >= 0)) throw new InputError("variants");
      }
      await tx.product.update({ where: { id: row.id }, data: { isActive: active } }); return dto(await load(tx, row.id));
    }); },
    async managementDelete(id: unknown, version: unknown, confirmation: unknown) {
      let event: AuditEvent | undefined;
      const result = await run(async (tx, actorId) => {
      const row = await checked(tx, id, version);
      if (row.isActive || !row.productCode || confirmation !== row.productCode) throw new InputError("confirmation");
      const related = await tx.product.findUnique({ where: { id: row.id }, select: { _count: { select: { favorites: true, recommendations: true } }, variants: { select: { _count: { select: { orderItems: true, cartItems: true, tryOnSessions: true } } } } } });
      if (!related || related._count.favorites || related._count.recommendations || related.variants.some(v => Object.values(v._count).some(n => n > 0))) throw new ServiceError("CONFLICT");
      if (!audit) throw new ServiceError("FEATURE_UNAVAILABLE");
      event = { action: "delete_intent", actorId, productId: row.id, productCode: row.productCode, operationId: digest([row.id, version, Date.now()]) };
      await audit(event);
      await tx.productImage.deleteMany({ where: { productId: row.id } });
      await tx.productPrice.deleteMany({ where: { variant: { productId: row.id } } });
      await tx.productProfile.deleteMany({ where: { productId: row.id } });
      await tx.productVariant.deleteMany({ where: { productId: row.id } });
      await tx.product.delete({ where: { id: row.id } });
      await defaultProductTagStore.deleteTagsForProduct(row.id);
      // DB commit and local audit are separate resources: intent is recorded even on rollback.
      return { deleted: true, id: row.id, slug: row.slug, auditCompletionRecorded: false };
      });
      if (event && audit) {
        try {
          await audit({ ...event, action: result.ok ? "delete_committed" : "delete_failed" });
          if (result.ok) result.data.auditCompletionRecorded = true;
        } catch { /* Durable intent remains; never misreport a committed delete as rolled back. */ }
      }
      return result;
    },
    managementCategory(input: unknown) { return run(async tx => tx.category.create({ data: validateData("category", input) as { name: string; slug: string }, select: { id: true, name: true, slug: true } })); },
    managementSelectCategory(input:unknown){return run(async tx=>{
      const value=object(input,["slug"]),preset=clothingCategories.find(c=>c.slug===value.slug);
      if(!preset)throw new InputError("categoryId");
      // One category can serve both genders; gender remains ProductProfile data.
      const matches=await tx.category.findMany({where:{OR:[{slug:preset.slug},{name:{equals:preset.name,mode:"insensitive"}}]},select:{id:true,name:true,slug:true},orderBy:{id:"asc"},take:50});
      const existing=matchingCategory(matches,preset);
      if(existing)return existing;
      return tx.category.upsert({where:{slug:preset.slug},create:{slug:preset.slug,name:preset.name},update:{},select:{id:true,name:true,slug:true}});
    });},
    managementImport(files: unknown, confirmation?: unknown) { return run(async tx => {
      const bundle = parseBundle(files), live = await baseline(tx, bundle);
      const feed = await readTaxonomy(tx);
      const report = dryRunImport(bundle, live.snapshot, feed.registry);
      // Reuse the same aggregate validator for preview and write, including public image policy.
      for (let index = 0; index < bundle.products.length; index++) {
        try { const data = validateEditor(bundleEditor(bundle, bundle.products[index], live.categories.find(c => c.slug === bundle.products[index].category_slug)?.id ?? 1), feed.registry); if (!feed.extended && !/^AUR-[0-9]{4,12}$/.test(data.productCode)) throw new InputError("productCode"); }
        catch (e) { report.errors.push({ table: "products", row: index + 2, field: e instanceof InputError ? e.field : "value" }); report.valid = false; }
      }
      const token = digest({ bundle, snapshot: live.snapshot, categories: live.categories, registry: feed.registry });
      const tables = Object.fromEntries((Object.keys(importColumns) as ImportTable[]).map(k => [k, bundle[k].slice(0, 20)]));
      const counts = Object.fromEntries((Object.keys(importColumns) as ImportTable[]).map(k => [k, bundle[k].length]));
      if (confirmation === undefined) return { report, token, imported: 0, preview: bundle.products.slice(0, 20), tables, counts };
      if (typeof confirmation !== "string" || confirmation !== token) throw new ServiceError("CONFLICT");
      if (!report.valid) throw new InputError("csv");
      for (const row of bundle.products) await persist(tx, bundleEditor(bundle, row, live.categories.find(c => c.slug === row.category_slug)!.id));
      return { report, token, imported: bundle.products.length, preview: [], tables, counts };
    }); },
    managementExport(input: unknown) { return run(async tx => {
      const v = object(input, ["page"]), page = integer(v.page ?? 1, "page", 1, 100000);
      const rows = await tx.product.findMany({ take: 100, skip: (page - 1) * 100, orderBy: { id: "asc" }, include });
      const bundle = Object.fromEntries(Object.keys(importColumns).map(k => [k, []])) as unknown as Record<ImportTable, Record<string, unknown>[]>;
      let skippedLegacy = 0;
      for (const p of rows) {
        if (!p.productCode) { skippedLegacy++; continue; }
        const key = { product_code: p.productCode };
        bundle.products.push({ ...key, name: p.name, slug: p.slug, category_slug: p.category.slug, collection: p.collection, description: p.description, is_active: p.isActive });
        if (p.profile) {
          const a = p.profile;
          bundle.product_options.push({ ...key, collar: a.collar, fabric: a.fabric, gender: a.gender, fit: a.fit });
          bundle.product_ai_attributes.push({ ...key, garment_type: a.garmentType, style_tags: a.styleTags.join("|"), season_tags: a.seasonTags.join("|"), occasion_tags: a.occasionTags.join("|"), layer_role: a.layerRole, pattern: a.pattern, silhouette: a.silhouette, age_group: a.ageGroup });
        }
        for (const variant of p.variants) {
          bundle.product_variants.push({ ...key, sku: variant.sku, color: variant.color, size: variant.size, stock: variant.stock, is_active: variant.isActive });
          for (const price of variant.prices) bundle.product_prices.push({ sku: variant.sku, currency: price.currency, amount: price.amount.toFixed(minorDigits[price.currency]) });
        }
        for (const i of p.images) bundle.product_images.push({ ...key, sku: p.variants.find(v => v.id === i.variantId)?.sku ?? "", storage_key: publicProductImageUrl(i.storageKey) ?? "", alt_text: i.altText, image_type: i.imageType, sort_order: i.sortOrder, is_primary: i.isPrimary, source_reference: i.sourceReference, rights_reference: i.rightsReference, website_permission: i.websitePermission, embedding_permission: i.embeddingPermission, training_permission: i.trainingPermission });
      }
      return { files: Object.fromEntries((Object.keys(importColumns) as ImportTable[]).map(k => [k, csvText(k, bundle[k])])), page, hasMore: await tx.product.count() > page * 100, skippedLegacy };
    }); },
  };
}
