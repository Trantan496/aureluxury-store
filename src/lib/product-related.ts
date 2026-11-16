import "server-only";
import { getProductDetail } from "./catalog";
import { pendingAvailable } from "../features/products/asset-cleanup";
import { storefrontCurrency, type Currency } from "../features/money/money";
import { validProductSlug, type ProductDetail } from "../features/catalog/product-detail";
import { rankComplementaryProducts } from "../features/catalog/outfit-mapping";
import { defaultProductTagStore } from "../features/products/product-tags";

export type DetailRelated = { look: ProductDetail[]; similar: ProductDetail[]; lookHasMore?: boolean };

export async function publicLook(slug: string, page = 1, requested?: Currency) {
  if (!validProductSlug(slug) || !Number.isSafeInteger(page) || page < 1 || page > 100000) {
    return { rows: [], hasMore: false };
  }
  try {
    const { prisma } = await import("./db/client");
    if (!(await pendingAvailable(prisma))) return { rows: [], hasMore: false };
    const unit = storefrontCurrency(requested);
    const links = await prisma.pendingProduct.findMany({
      where: {
        state: "converted",
        source: { is: { slug, isActive: true } },
        product: {
          is: {
            isActive: true,
            images: { some: { websitePermission: "granted", rightsReference: { not: null } } },
            variants: { some: { isActive: true, prices: { some: { currency: unit } } } },
          },
        },
      },
      orderBy: { id: "asc" },
      skip: (page - 1) * 20,
      take: 21,
      select: { product: { select: { slug: true } } },
    });
    const loaded = await Promise.all(
      links.slice(0, 20).map(link => getProductDetail(link.product!.slug, unit)),
    );
    return {
      rows: loaded.flatMap(result =>
        result.status === "success" &&
        result.product.images.length &&
        result.product.variants.some(v => v.price)
          ? [result.product]
          : [],
      ),
      hasMore: links.length > 20,
    };
  } catch {
    return { rows: [], hasMore: false };
  }
}

export async function complementaryProducts(
  product: ProductDetail,
  limit = 4,
): Promise<ProductDetail[]> {
  if (!validProductSlug(product.slug)) return [];
  try {
    const { prisma } = await import("./db/client");
    const unit = storefrontCurrency(product.currency ?? undefined);
    const candidates = await prisma.product.findMany({
      where: {
        isActive: true,
        slug: { not: product.slug },
        images: { some: { websitePermission: "granted" } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 24,
      select: {
        id: true,
        slug: true,
        name: true,
        category: { select: { slug: true, name: true } },
        profile: { select: { gender: true, garmentType: true } },
      },
    });
    if (!candidates.length) return [];

    const tagsMap = await defaultProductTagStore.getTagsMapForProducts(candidates.map(c => c.id));
    const sourceRecord = candidates.find(c => c.slug === product.slug);
    const mappableSource = {
      id: sourceRecord ? String(sourceRecord.id) : product.slug,
      name: product.name,
      slug: product.slug,
      category: product.category,
      profile: product.profile
        ? { gender: product.profile.gender, garmentType: null }
        : null,
    };

    const ranked = rankComplementaryProducts(
      [mappableSource],
      candidates.map(c => ({
        id: String(c.id),
        name: c.name,
        slug: c.slug,
        category: c.category,
        profile: c.profile,
        tags: tagsMap[String(c.id)] ?? [],
      })),
      { limit: Math.min(limit * 2, 12), excludeIds: [product.slug] },
    );

    const loaded = await Promise.all(
      ranked.slice(0, limit).map(item => getProductDetail(item.slug, unit)),
    );
    return loaded.flatMap(result =>
      result.status === "success" && result.product.images.length
        ? [result.product]
        : [],
    );
  } catch {
    return [];
  }
}

export async function productRelated(product: ProductDetail): Promise<DetailRelated> {
  const look = await publicLook(product.slug, 1, product.currency ?? undefined);
  const similar = await complementaryProducts(product, 4);
  return { look: look.rows, lookHasMore: look.hasMore, similar };
}
