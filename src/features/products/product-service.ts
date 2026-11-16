import "server-only";
import { createImageStorageOperations } from "./image-storage.ts";
import { createShowroomOperations } from "./showroom.ts";
import { createPendingOperations } from "./pending.ts";
import {createVariantOperations} from "./variant-management.ts";
import { createManagementOperations, type AuditWriter } from "./management.ts";
import { createDashboardOperations } from "./dashboard.ts";
import { readTaxonomy } from "./taxonomy-registry.ts";
import { profile, productCode, collectionCode, imageMetadata, taxonomyVersion, option } from "./foundation.ts";
import { exportFeatureDataset } from "./feature-export.ts";
import { currency, money, MoneyError, minorDigits } from "../money/money.ts";
import type { Prisma } from "../../generated/prisma/client";
import { pagination, pageInfo } from "../catalog/pagination.ts";
import { publicProductImageUrl } from "./images.ts";
import { entity, integer, object, InputError, validateData, type Entity, type ProductInput, type CategoryInput, type VariantInput, type ImageInput } from "./validation.ts";

export type ProductDataTransaction = Pick<Prisma.TransactionClient, "user" | "product" | "category" | "productVariant" | "productImage" | "productPrice" | "productProfile" | "taxonomyOption" | "imageAsset" | "productDraftRequest" | "pendingProduct" | "$queryRaw">;
// Produced only after the provider has verified signature/session state and identity mapping.
// expiresAt is an absolute Unix timestamp in milliseconds, never a client-supplied TTL.
export type VerifiedProductSession = Readonly<{ userId: number; expiresAt: number }>;
export type SessionResolver = () => Promise<VerifiedProductSession | null>;
export type ProductDataDependencies = {
  resolveSession: SessionResolver;
  transaction: <T>(work: (tx: ProductDataTransaction) => Promise<T>) => Promise<T>;
  now?: () => number;
  multiCurrency?: boolean;
  productFoundation?: boolean;
  audit?: AuditWriter;
};
type ErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "DATABASE_ERROR" | "FEATURE_UNAVAILABLE";
export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string; field?: string } };
export class ServiceError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode) { super(code); this.code = code; }
}
const messages: Record<ErrorCode, string> = {
  FEATURE_UNAVAILABLE: "Requested product data feature is not enabled.",
  UNAUTHENTICATED: "Authentication required.", FORBIDDEN: "Administrator access required.",
  INVALID_INPUT: "Invalid product data.", NOT_FOUND: "Record not found.",
  CONFLICT: "Record conflicts with existing data or a concurrent change.", DATABASE_ERROR: "Product data is temporarily unavailable.",
};

const productSelect = { id: true, name: true, slug: true, description: true, brand: true, categoryId: true, isActive: true } as const;
const categorySelect = { id: true, name: true, slug: true } as const;
const variantSelect = { id: true, productId: true, sku: true, color: true, size: true, price: true, stock: true, isActive: true } as const;
const imageSelect = { id: true, productId: true, storageKey: true, altText: true, sortOrder: true } as const;
type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;
type CategoryRow = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;
type VariantRow = Prisma.ProductVariantGetPayload<{ select: typeof variantSelect }>;
type ImageRow = Prisma.ProductImageGetPayload<{ select: typeof imageSelect }>;
function productDto(row: ProductRow) { return { ...row, id: String(row.id), categoryId: String(row.categoryId) }; }
function categoryDto(row: CategoryRow) { return { ...row, id: String(row.id) }; }
function variantDto(row: VariantRow) { return { ...row, id: String(row.id), productId: String(row.productId), price: row.price?.toFixed(2) ?? null }; }
function imageDto(row: ImageRow) {
  return { id: String(row.id), productId: String(row.productId), url: publicProductImageUrl(row.storageKey), altText: row.altText, sortOrder: row.sortOrder };
}
type ManagedRecord = ReturnType<typeof productDto> | ReturnType<typeof categoryDto> | ReturnType<typeof variantDto> | ReturnType<typeof imageDto>;
function found<T>(row: T | null): T { if (!row) throw new ServiceError("NOT_FOUND"); return row; }
function scope(kind: Entity, id: unknown, parent?: unknown) {
  return { id: integer(id, "id"), ...(["variant", "image"].includes(kind) ? { productId: integer(parent, "productId") } : {}) };
}

function requireSession(session: VerifiedProductSession | null, now: number): asserts session is VerifiedProductSession {
  if (!session || !Number.isInteger(session.userId) || session.userId < 1 || session.userId > 2147483647 ||
      !Number.isSafeInteger(session.expiresAt) || session.expiresAt <= now) throw new ServiceError("UNAUTHENTICATED");
}

/** Server composition only: resolveSession must verify a real session, never request JSON. */
export function createProductService(deps: ProductDataDependencies) {
  const now = deps.now ?? Date.now;
  async function run<T>(work: (tx: ProductDataTransaction, actorId: number) => Promise<T>): Promise<ServiceResult<T>> {
    try {
      let session;
      try { session = await deps.resolveSession(); } catch { throw new ServiceError("UNAUTHENTICATED"); }
      requireSession(session, now());
      const identity = { userId: session.userId, expiresAt: session.expiresAt };
      const data = await deps.transaction(async tx => {
        // A session can expire while waiting for a connection or the authorization query.
        requireSession(identity, now());
        // Role is read from PostgreSQL on every operation, not accepted from the caller.
        const actor = await tx.user.findUnique({ where: { id: identity.userId }, select: { role: true } });
        requireSession(identity, now());
        if (actor?.role !== "ADMIN") throw new ServiceError("FORBIDDEN");
        return work(tx, identity.userId);
      });
      return { ok: true, data };
    } catch (error) {
      const prismaCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
      const code: ErrorCode = error instanceof InputError || error instanceof MoneyError ? "INVALID_INPUT" : error instanceof ServiceError ? error.code :
        prismaCode === "P2025" ? "NOT_FOUND" : ["P2002", "P2003", "P2034"].includes(String(prismaCode)) ? "CONFLICT" : "DATABASE_ERROR";
      if (code === "DATABASE_ERROR") {
        // Never log SQL, parameters, credentials, or the raw Prisma message.
        console.error("[admin-products] transaction failed", {
          code: typeof prismaCode === "string" && /^P\d{4}$/.test(prismaCode) ? prismaCode : "UNKNOWN",
        });
      }
      return { ok: false, error: { code, message: messages[code], ...(error instanceof InputError || error instanceof MoneyError ? { field: error.field } : {}) } };
    }
  }

  return {
    ...createImageStorageOperations(run),
    ...createShowroomOperations(run),
    ...createPendingOperations(run),
      ...createVariantOperations(run),
    ...createManagementOperations(run, deps.audit),
    ...createDashboardOperations(run),
    exportFeatures(input: unknown = {}) {
      return run(async tx => {
        if (!deps.productFoundation) throw new ServiceError("FEATURE_UNAVAILABLE");
        const value = object(input, ["page", "pageSize", "purpose"]);
        const purpose = value.purpose ?? "embedding";
        if (purpose !== "embedding" && purpose !== "training") throw new InputError("purpose");
        let paging;
        try { paging = pagination(value); } catch { throw new InputError("pagination"); }
        const { skip, take } = paging;
        const rows = await tx.product.findMany({ skip, take, orderBy: { id: "asc" }, select: {
          id: true, description: true, isActive: true, category: { select: { slug: true } },
          profile: { select: { collar: true, fabric: true, gender: true, ageGroup: true, fit: true, garmentType: true,
            styleTags: true, seasonTags: true, occasionTags: true, layerRole: true, pattern: true, silhouette: true } },
          variants: { select: { color: true, size: true, stock: true, isActive: true } },
          images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, storageKey: true, sourceReference: true,
            rightsReference: true, websitePermission: true, embeddingPermission: true, trainingPermission: true } },
        } });
        return exportFeatureDataset(rows, purpose, (await readTaxonomy(tx)).registry);
      });
    },
    setFoundation(productId: unknown, input: unknown) {
      return run(async tx => {
        if (!deps.productFoundation) throw new ServiceError("FEATURE_UNAVAILABLE");
        const id = integer(productId, "productId");
        const data = object(input, ["productCode", "collection", "options"]);
        const code = productCode(data.productCode);
        const collection = collectionCode(data.collection ?? null);
        const options = profile(data.options);
        found(await tx.product.update({ where: { id }, data: { productCode: code, collection }, select: { id: true } }));
        await tx.productProfile.upsert({ where: { productId: id }, create: { productId: id, ...options, taxonomyVersion }, update: { ...options, taxonomyVersion } });
        return { productId: String(id), productCode: code, collection, options };
      });
    },
    setImageMetadata(productId: unknown, imageId: unknown, input: unknown, variantId?: unknown) {
      return run(async tx => {
        if (!deps.productFoundation) throw new ServiceError("FEATURE_UNAVAILABLE");
        const parent = integer(productId, "productId"), id = integer(imageId, "imageId");
        const variant = variantId === undefined || variantId === null ? variantId : integer(variantId, "variantId");
        if (typeof variant === "number") found(await tx.productVariant.findFirst({ where: { id: variant, productId: parent }, select: { id: true } }));
        const data = imageMetadata(input);
        const old = found(await tx.productImage.findFirst({ where: { id, productId: parent }, select: {
          rightsReference: true, websitePermission: true, embeddingPermission: true, trainingPermission: true,
        } }));
        const merged = { ...old, ...data };
        if ([merged.websitePermission, merged.embeddingPermission, merged.trainingPermission].includes("granted") && !merged.rightsReference?.trim()) throw new InputError("rightsReference");
        if (data.isPrimary === true) await tx.productImage.updateMany({ where: { productId: parent, isPrimary: true }, data: { isPrimary: false } });
        await tx.productImage.update({ where: { id, productId: parent }, data: { ...data, ...(variant === undefined ? {} : { variantId: variant }) }, select: { id: true } });
        return { id: String(id), updated: true };
      });
    },
    getPrice(productId: unknown, variantId: unknown, unit: unknown) {
      return run(async tx => {
        if (!deps.multiCurrency) throw new ServiceError("FEATURE_UNAVAILABLE");
        const where = { id: integer(variantId, "variantId"), productId: integer(productId, "productId") };
        const selected = currency(unit);
        found(await tx.productVariant.findFirst({ where, select: { id: true } }));
        const row = await tx.productPrice.findUnique({ where: { variantId_currency: { variantId: where.id, currency: selected } } });
        return { variantId: String(where.id), currency: selected, amount: row?.amount.toFixed(minorDigits[selected]) ?? null,
          status: row ? "available" as const : "missing" as const };
      });
    },
    setPrice(input: unknown) {
      return run(async tx => {
        if (!deps.multiCurrency) throw new ServiceError("FEATURE_UNAVAILABLE");
        const value = object(input, ["productId", "variantId", "currency", "amount"]);
        const productId = integer(value.productId, "productId"), variantId = integer(value.variantId, "variantId");
        const unit = currency(value.currency), amount = money(value.amount, unit);
        found(await tx.productVariant.findFirst({ where: { id: variantId, productId }, select: { id: true } }));
        const row = await tx.productPrice.upsert({ where: { variantId_currency: { variantId, currency: unit } },
          create: { variantId, currency: unit, amount }, update: { amount } });
        return { variantId: String(variantId), currency: unit, amount: row.amount.toFixed(minorDigits[unit]) };
      });
    },
    listPrices(productId: unknown, variantId: unknown) {
      return run(async tx => {
        if (!deps.multiCurrency) throw new ServiceError("FEATURE_UNAVAILABLE");
        const where = { id: integer(variantId, "variantId"), productId: integer(productId, "productId") };
        found(await tx.productVariant.findFirst({ where, select: { id: true } }));
        const rows = await tx.productPrice.findMany({ where: { variantId: where.id }, orderBy: { currency: "asc" } });
        return rows.map(row => ({ currency: row.currency, amount: row.amount.toFixed(minorDigits[row.currency]) }));
      });
    },
    removePrice(productId: unknown, variantId: unknown, unit: unknown) {
      return run(async tx => {
        if (!deps.multiCurrency) throw new ServiceError("FEATURE_UNAVAILABLE");
        const where = { id: integer(variantId, "variantId"), productId: integer(productId, "productId") };
        const selected = currency(unit);
        found(await tx.productVariant.findFirst({ where, select: { id: true } }));
        await tx.productPrice.delete({ where: { variantId_currency: { variantId: where.id, currency: selected } } });
        return { deleted: true };
      });
    },
    create(kind: Entity, input: unknown): Promise<ServiceResult<ManagedRecord>> {
      return run(async tx => {
        const k = entity(kind);
        const data = validateData(k, input);
        if (k === "variant" && deps.productFoundation) {
          const variant = data as VariantInput;
          variant.color = option("color", variant.color);
          variant.size = option("size", variant.size);
          variant.sku = variant.sku.toUpperCase();
          if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(variant.sku)) throw new InputError("sku");
        }
        if (k === "variant" && !deps.multiCurrency && !(data as VariantInput).price) throw new InputError("price");
        switch (k) {
          case "category": return categoryDto(await tx.category.create({ data: data as CategoryInput, select: categorySelect }));
          case "product": return productDto(await tx.product.create({ data: data as ProductInput, select: productSelect }));
          case "variant": return variantDto(await tx.productVariant.create({ data: data as VariantInput, select: variantSelect }));
          case "image": return imageDto(await tx.productImage.create({ data: data as ImageInput, select: imageSelect }));
        }
      });
    },

    get(kind: Entity, id: unknown, productId?: unknown): Promise<ServiceResult<ManagedRecord>> {
      return run(async tx => {
        const k = entity(kind), where = scope(k, id, productId);
        switch (k) {
          case "category": return categoryDto(found(await tx.category.findUnique({ where, select: categorySelect })));
          case "product": return productDto(found(await tx.product.findUnique({ where, select: productSelect })));
          case "variant": return variantDto(found(await tx.productVariant.findUnique({ where, select: variantSelect })));
          case "image": return imageDto(found(await tx.productImage.findUnique({ where, select: imageSelect })));
        }
      });
    },

    list(kind: Entity, input: unknown = {}) {
      return run(async tx => {
        const k = entity(kind);
        const value = object(input, ["page", "pageSize", ...(["variant", "image"].includes(k) ? ["productId"] : [])]);
        let paging;
        try { paging = pagination(value); } catch { throw new InputError("pagination"); }
        const { skip, take, page, pageSize } = paging;
        const parent = ["variant", "image"].includes(k) ? { productId: integer(value.productId, "productId") } : {};
        let items: ManagedRecord[], total: number;
        switch (k) {
          case "category":
            items = (await tx.category.findMany({ skip, take, orderBy: { id: "desc" }, select: categorySelect })).map(categoryDto);
            total = await tx.category.count(); break;
          case "product":
            items = (await tx.product.findMany({ skip, take, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: productSelect })).map(productDto);
            total = await tx.product.count(); break;
          case "variant":
            items = (await tx.productVariant.findMany({ where: parent, skip, take, orderBy: { id: "asc" }, select: variantSelect })).map(variantDto);
            total = await tx.productVariant.count({ where: parent }); break;
          case "image":
            items = (await tx.productImage.findMany({ where: parent, skip, take, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: imageSelect })).map(imageDto);
            total = await tx.productImage.count({ where: parent }); break;
        }
        return { items, pagination: pageInfo(page, pageSize, total) };
      });
    },

    update(kind: Entity, id: unknown, input: unknown, productId?: unknown): Promise<ServiceResult<ManagedRecord>> {
      return run(async tx => {
        const k = entity(kind), where = scope(k, id, productId);
        const data = validateData(k, input, true);
        if (k === "variant" && deps.productFoundation) {
          if ("color" in data) data.color = option("color", data.color);
          if ("size" in data) data.size = option("size", data.size);
          if ("sku" in data) {
            data.sku = String(data.sku).toUpperCase();
            if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(data.sku)) throw new InputError("sku");
          }
        }
        // Stock updates must use compare-and-set, including replenishment and corrections.
        if (k === "variant" && "stock" in data) throw new InputError("stock");
        switch (k) {
          case "category": return categoryDto(await tx.category.update({ where, data: data as Partial<CategoryInput>, select: categorySelect }));
          case "product": return productDto(await tx.product.update({ where, data: data as Partial<ProductInput>, select: productSelect }));
          case "variant": return variantDto(await tx.productVariant.update({ where, data: data as Partial<VariantInput>, select: variantSelect }));
          case "image": return imageDto(await tx.productImage.update({ where, data: data as Partial<ImageInput>, select: imageSelect }));
        }
      });
    },

    remove(kind: Entity, id: unknown, productId?: unknown) {
      return run(async tx => {
        const k = entity(kind), where = scope(k, id, productId);
        switch (k) {
          // Preserve historical order/cart references. No cascading deletes.
          case "product": await tx.product.update({ where, data: { isActive: false }, select: { id: true } }); break;
          case "variant": await tx.productVariant.update({ where, data: { isActive: false }, select: { id: true } }); break;
          case "category": await tx.category.delete({ where, select: { id: true } }); break;
          // Only metadata; removing storage objects is a separate future operation.
          case "image": await tx.productImage.delete({ where, select: { id: true } }); break;
        }
        return { id: String(where.id), removed: true, mode: k === "product" || k === "variant" ? "deactivated" as const : "deleted" as const };
      });
    },

    adjustStock(input: unknown) {
      return run(async tx => {
        const value = object(input, ["productId", "variantId", "expectedStock", "delta"]);
        const productId = integer(value.productId, "productId"), id = integer(value.variantId, "variantId");
        const expectedStock = integer(value.expectedStock, "expectedStock", 0);
        const delta = integer(value.delta, "delta", -2147483647);
        if (!delta) throw new InputError("delta");
        const next = integer(expectedStock + delta, "stock", 0);
        const changed = await tx.productVariant.updateMany({ where: { id, productId, isActive: true, stock: expectedStock }, data: { stock: next } });
        if (!changed.count) {
          found(await tx.productVariant.findUnique({ where: { id, productId }, select: { id: true } }));
          throw new ServiceError("CONFLICT");
        }
        return variantDto(found(await tx.productVariant.findUnique({ where: { id, productId }, select: variantSelect })));
      });
    },
  };
}
