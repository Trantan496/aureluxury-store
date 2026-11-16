import "server-only";
import { randomUUID } from "node:crypto";
import { checked, dto, load } from "./management.ts";
import { imageAssetId, imageAssetKey } from "./image-storage.ts";
import { prepareImage } from "./image-upload.ts";
import { publicProductImageUrl } from "./images.ts";
import { galleryRoles, galleryTypes, type GalleryRole } from "./gallery.ts";
import { productCode } from "./foundation.ts";
import { integer, object, InputError } from "./validation.ts";
import { ServiceError, type ProductDataTransaction, type ServiceResult } from "./product-service.ts";
import { cleanupAsset } from "./asset-cleanup.ts";
type Run = <T>(work: (tx: ProductDataTransaction, actorId: number) => Promise<T>) => Promise<ServiceResult<T>>;
async function cleanup(tx: ProductDataTransaction, key: string) {
  const assetId = imageAssetId(key);
  if (assetId) await cleanupAsset(tx,assetId);
}
export function createShowroomOperations(run: Run) {
  return {
    managementGallery(id: unknown, version: unknown, input: unknown, read?: () => Promise<Uint8Array>) {
      return run(async tx => {
        const value = object(input, ["operation", "role", "imageId", "storageKey", "ids"]);
        const row = await checked(tx, id, version);
        if (row.isActive) throw new ServiceError("CONFLICT"); // Explicitly return to draft before changing published media.
        const child = value.imageId === undefined ? undefined : row.images.find(i => i.id === integer(value.imageId, "imageId"));
        if (value.imageId !== undefined && !child) throw new InputError("childOwnership");
        if (value.operation === "remove") {
          if (!child) throw new InputError("imageId");
          await tx.productImage.delete({ where: { id: child.id, productId: row.id } });
          if (child.isPrimary) {
            const next = row.images.filter(i => i.id !== child.id).sort((a,b) => a.sortOrder - b.sortOrder || a.id - b.id)[0];
            if (next) await tx.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
          }
          await cleanup(tx, child.storageKey);
        } else if (value.operation === "primary") {
          if (!child) throw new InputError("imageId");
          await tx.productImage.updateMany({ where: { productId: row.id }, data: { isPrimary: false } });
          await tx.productImage.update({ where: { id: child.id }, data: { isPrimary: true } });
        } else if (value.operation === "reorder") {
          if (!Array.isArray(value.ids) || value.ids.length !== row.images.length || value.ids.length > 100) throw new InputError("images");
          const ids = value.ids.map(n => integer(n, "imageId"));
          if (new Set(ids).size !== ids.length || ids.some(n => !row.images.some(i => i.id === n))) throw new InputError("childOwnership");
          for (const [sortOrder, imageId] of ids.entries()) await tx.productImage.update({ where: { id: imageId, productId: row.id }, data: { sortOrder } });
        } else if (["upload", "assign", "role"].includes(String(value.operation))) {
          if (!galleryRoles.includes(value.role as GalleryRole)) throw new InputError("imageType");
          const role = value.role as GalleryRole;
          if (value.operation === "role") {
            if (!child) throw new InputError("imageId");
            if (role !== "gallery" && role !== "cover") await tx.productImage.updateMany({ where: { productId: row.id, imageType: galleryTypes[role], id: { not: child.id } }, data: { imageType: null } });
            if (role === "cover") await tx.productImage.updateMany({ where: { productId: row.id }, data: { isPrimary: false } });
            await tx.productImage.update({ where: { id: child.id }, data: { imageType: galleryTypes[role], ...(role === "cover" ? { isPrimary: true } : {}) } });
          } else {
            const occupant = child ?? (role === "cover" ? row.images.find(i => i.isPrimary) : role === "gallery" ? undefined : row.images.find(i => i.imageType === galleryTypes[role]));
            if (!occupant && row.images.length >= 100) throw new InputError("images");
            let key: string;
            if (value.operation === "upload") {
              if (!read) throw new InputError("imageFile");
              const asset = await tx.imageAsset.create({ data: { id: randomUUID(), ...await prepareImage(await read()) }, select: { id: true } });
              key = imageAssetKey(asset.id);
            } else {
              if (typeof value.storageKey !== "string") throw new InputError("storageKey");
              const assetId = imageAssetId(value.storageKey);
              if (!assetId || !await tx.imageAsset.findUnique({ where: { id: assetId }, select: { id: true } })) throw new InputError("storageKey");
              key = value.storageKey;
            }
            if (row.images.some(i => i.storageKey === key && i.id !== occupant?.id)) throw new InputError("images");
            const primary = role === "cover" || occupant?.isPrimary === true;
            if (primary) await tx.productImage.updateMany({ where: { productId: row.id }, data: { isPrimary: false } });
            if (role !== "cover" && role !== "gallery") await tx.productImage.updateMany({ where: { productId: row.id, imageType: galleryTypes[role], ...(occupant ? { id: { not: occupant.id } } : {}) }, data: { imageType: null } });
            const data = { storageKey: key, altText: occupant?.altText || row.name, imageType: galleryTypes[role], isPrimary: primary, sourceReference: "Quản trị chọn ảnh trong showroom", rightsReference: "Quản trị chọn ảnh để hiển thị sản phẩm trên website", websitePermission: "granted", embeddingPermission: "unknown", trainingPermission: "unknown" };
            if (occupant) {
              await tx.productImage.update({ where: { id: occupant.id, productId: row.id }, data });
              if (occupant.storageKey !== key) await cleanup(tx, occupant.storageKey);
            } else await tx.productImage.create({ data: { ...data, productId: row.id, sortOrder: row.images.reduce((n,i) => Math.max(n,i.sortOrder+1),0) } });
          }
        } else throw new InputError("operation");
        await tx.product.update({ where: { id: row.id }, data: { isActive: false } });
        return dto(await load(tx, row.id));
      });
    },
    managementFinalize(id: unknown, version: unknown, input: unknown) {
      return run(async tx => {
        const row = await checked(tx, id, version), value = object(input, ["draft", "publish", "confirmed"]);
        if (typeof value.draft !== "boolean" || typeof value.publish !== "boolean" || (value.confirmed !== undefined && typeof value.confirmed !== "boolean")) throw new InputError("isActive");
        if (value.draft && value.publish) throw new InputError("isActive");
        if (!value.draft) {
          productCode(row.productCode);
          const active = row.variants.filter(v => v.isActive);
          if (!active.length) throw new InputError("variants");
          if (active.some(v => v.prices.length === 0)) throw new InputError("prices");
          const primary = row.images.find(i => i.isPrimary && i.websitePermission === "granted" && i.rightsReference && publicProductImageUrl(i.storageKey));
          if (!primary) throw new InputError("images");
          if (primary.storageKey.startsWith("/images/uploads/")) {
            const assetId = imageAssetId(primary.storageKey);
            if (!assetId || !await tx.imageAsset.findUnique({ where:{id:assetId},select:{id:true} })) throw new InputError("images");
          }
        }
        if (value.publish && value.confirmed !== true) throw new InputError("confirmation");
        await tx.product.update({ where: { id: row.id }, data: { isActive: value.publish && !value.draft } });
        return dto(await load(tx, row.id));
      });
    },
  };
}
