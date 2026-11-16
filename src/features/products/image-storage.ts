import "server-only";
import { Prisma } from "../../generated/prisma/client.ts";
import { randomUUID } from "node:crypto";
import { prepareImage } from "./image-upload.ts";
import { integer, InputError } from "./validation.ts";
import { ServiceError, type ProductDataTransaction, type ServiceResult } from "./product-service.ts";
type Run = <T>(work: (tx: ProductDataTransaction, actorId: number) => Promise<T>) => Promise<ServiceResult<T>>;
const summary = { id: true, width: true, height: true, byteSize: true, createdAt: true } as const;
export function imageAssetKey(id: string) { return `/images/uploads/${id}.webp`; }
export function imageAssetId(key: string) { return /^\/images\/uploads\/([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})\.webp$/.exec(key)?.[1] ?? null; }
export async function readPublishedImage(tx: Pick<ProductDataTransaction, "productImage" | "imageAsset">, key: string) {
  const id = imageAssetId(key); if (!id) return null;
  const published = await tx.productImage.findFirst({ where: { storageKey: key, websitePermission: "granted", rightsReference: { not: null }, product: { isActive: true } }, select: { rightsReference: true } });
  if (!published?.rightsReference?.trim()) return null;
  return (await tx.imageAsset.findUnique({ where: { id }, select: { data: true } }))?.data ?? null;
}
export function createImageStorageOperations(run: Run) {
  return {
    // Read/decode only inside the verified ADMIN operation, never before authorization.
    imageUpload(read: () => Promise<Uint8Array>) {
      return run(async tx => {
        const image = await prepareImage(await read());
        const row = await tx.imageAsset.create({ data: { id: randomUUID(), ...image }, select: summary });
        return { ...row, storageKey: imageAssetKey(row.id) };
      });
    },
    imageLibrary(input: unknown = 1, search: unknown = "") {
      return run(async tx => {
        const page = integer(input, "page");
        if (typeof search !== "string" || search.length > 200 || /[\u0000-\u001f\u007f]/.test(search)) throw new InputError("q");
        const q = search.trim();
        if (q) {
          const filter = Prisma.sql`EXISTS (SELECT 1 FROM "ProductImage" i JOIN "Product" p ON p.id = i."productId" WHERE i."storageKey" = '/images/uploads/' || a.id || '.webp' AND strpos(lower(p.name), lower(${q})) > 0)`;
          const [{ total }] = await tx.$queryRaw<{ total: number }[]>(Prisma.sql`SELECT count(*)::int AS total FROM "ImageAsset" a WHERE ${filter}`);
          const rows = await tx.$queryRaw<{ id: string; width: number; height: number; byteSize: number; createdAt: Date }[]>(Prisma.sql`SELECT a.id,a.width,a.height,a."byteSize",a."createdAt" FROM "ImageAsset" a WHERE ${filter} ORDER BY a."createdAt" DESC,a.id DESC OFFSET ${(page - 1) * 12} LIMIT 12`);
          return { page, total, rows: rows.map(row => ({ ...row, storageKey: imageAssetKey(row.id) })) };
        }
        // `run` supplies an interactive transaction backed by one pg client.
        // Sequence these snapshot reads instead of queueing both on that client.
        const total = await tx.imageAsset.count();
        const rows = await tx.imageAsset.findMany({ select: summary, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 12, take: 12 });
        return { page, total, rows: rows.map(row => ({ ...row, storageKey: imageAssetKey(row.id) })) };
      });
    },
    imageStored(id: string) {
      return run(async tx => {
        if (!imageAssetId(imageAssetKey(id))) throw new InputError("imageFile");
        const row = await tx.imageAsset.findUnique({ where: { id }, select: { data: true } });
        if (!row) throw new ServiceError("NOT_FOUND");
        return row.data;
      });
    },
  };
}
