import { currencyEnabled, currency, storefrontCurrency } from "../../../features/money/money";
import "server-only";
import { prisma } from "../client";
import type { CatalogQuery, Product } from "../../../features/catalog/catalog";
import { currencyCatalogProductSelect, catalogWhere, mapCatalogProduct, imageRightsSelect } from "../../../features/catalog/prisma-catalog";
import { pagination, pageInfo } from "../../../features/catalog/pagination";
import { productDetailSelect, mapProductDetailRecord } from "../../../features/catalog/prisma-catalog";
import type { DetailWhere } from "../../../features/catalog/product-detail";
import type { Currency } from "../../../features/money/money";
import { Prisma } from "../../../generated/prisma/client";
import { normalizeSearchInput } from "../../../features/catalog/catalog";
import { extractSearchIntent, expandQuerySynonyms, rankCatalogProducts } from "../../../features/catalog/search-ranking";
import { rankComplementaryProducts } from "../../../features/catalog/outfit-mapping";
import { defaultProductTagStore } from "../../../features/products/product-tags";

// Phase 2.9.2 deployed the foundation schema. Public image rights are now mandatory,
// independently of optional AI metadata tooling and the currency presentation flag.
const foundationEnabled = () => true;

import { getApprovedProductRatingSummary } from "@/features/reviews/service";

export async function findProductDetail(where: DetailWhere, requested?: Currency) {
  const enabled = currencyEnabled();
  const selected = storefrontCurrency(requested, enabled);
  const select = imageRightsSelect(productDetailSelect(selected, true), foundationEnabled());
  const record = await prisma.product.findFirst({ where, select: { ...select, profile: { select: { fabric: true, fit: true, gender: true } }, images: { ...select.images, select: { ...select.images.select, imageType: true, isPrimary: true, variantId: true } } } });
  if (!record) return null;
  const rating = await getApprovedProductRatingSummary(record.id);
  const product = mapProductDetailRecord(record, selected);
  return { ...product, rating, profile: record.profile, images: product.images?.map(image => {
    const source = record.images.find(i => String(i.id) === image.id)!;
    return { ...image, imageType: source.imageType, isPrimary: source.isPrimary, variantId: source.variantId ? String(source.variantId) : null };
  }) };
}

export async function findCatalogProducts(query: CatalogQuery) {
  if (query.invalid) throw new Error("Invalid catalog query");
  if (query.currency !== undefined) { currency(query.currency); if (!currencyEnabled()) throw new Error("Currency unavailable"); }
  const selected = storefrontCurrency(query.currency);
  const { skip, take } = pagination(query);
  const records = await prisma.product.findMany({
    where: catalogWhere(query), select: imageRightsSelect(currencyCatalogProductSelect, foundationEnabled()),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip, take,
  });
  return records.map(record => mapCatalogProduct(record, selected));
}

export async function findCatalogPage(query: CatalogQuery) {
  if (query.invalid) throw new Error("Invalid catalog query");
  if (query.currency !== undefined) { currency(query.currency); if (!currencyEnabled()) throw new Error("Currency unavailable"); }
  const selected = storefrontCurrency(query.currency);
  const { skip, take, page, pageSize } = pagination(query);
  const where = catalogWhere(query);
  return prisma.$transaction(async tx => {
    const records = await tx.product.findMany({ where, select: imageRightsSelect(currencyCatalogProductSelect, foundationEnabled()), orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take });
    const total = await tx.product.count({ where });
    const tagsMap = await defaultProductTagStore.getTagsMapForProducts(records.map(r => r.id));
    return {
      products: records.map(record => ({ ...mapCatalogProduct(record, selected), tags: tagsMap[String(record.id)] ?? [] })),
      pagination: pageInfo(page, pageSize, total),
    };
  }, { isolationLevel: "RepeatableRead" });
}

const vietnameseSource = "áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ";
const vietnameseTarget = "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd";

export async function findSearchPage(query: CatalogQuery) {
  if (query.invalid || !query.q) throw new Error("Invalid search query");
  if (query.currency !== undefined) { currency(query.currency); if (!currencyEnabled()) throw new Error("Currency unavailable"); }
  const selected = storefrontCurrency(query.currency);
  const { skip, take, page, pageSize } = pagination(query);
  const term = normalizeSearchInput(query.q);
  const { intentTokens, intentPhrase } = extractSearchIntent(query.q);
  const coreTerm = intentPhrase || term;
  const tagMatchedIds = await defaultProductTagStore.findProductIdsMatchingQuery(query.q);

  const normalized = (value: Prisma.Sql) => Prisma.sql`translate(lower(coalesce(${value}, '')), ${vietnameseSource}, ${vietnameseTarget})`;
  const name = normalized(Prisma.sql`p.name`);
  const description = normalized(Prisma.sql`p.description`);
  const brand = normalized(Prisma.sql`p.brand`);
  const category = normalized(Prisma.sql`c.name`);
  // row_to_json keeps search compatible with both the deployed profile schema and
  // the staged dynamicAttributes column; it only exposes values already on this row.
  const profile = normalized(Prisma.sql`row_to_json(pp)::text`);

  const matchKeyword = (kw: string) => {
    const pattern = `%${kw}%`;
    const vMatch = Prisma.sql`EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p.id AND v."isActive" = true AND (${normalized(Prisma.sql`v.color`)} LIKE ${pattern} OR ${normalized(Prisma.sql`v.size`)} LIKE ${pattern} OR ${normalized(Prisma.sql`v.sku`)} LIKE ${pattern}))`;
    return Prisma.sql`(${name} LIKE ${pattern} OR ${description} LIKE ${pattern} OR ${brand} LIKE ${pattern} OR ${category} LIKE ${pattern} OR ${profile} LIKE ${pattern} OR ${vMatch})`;
  };

  const matchTokenWithSynonyms = (t: string) => {
    const syns = expandQuerySynonyms([t], t).slice(0, 4);
    const options = [t, ...syns];
    return Prisma.sql`(${Prisma.join(options.map(opt => matchKeyword(opt)), " OR ")})`;
  };

  const baseMatches = intentTokens.length > 1
    ? Prisma.sql`(${matchKeyword(coreTerm)}) OR (${Prisma.join(intentTokens.map(t => matchTokenWithSynonyms(t)), " AND ")})`
    : matchKeyword(coreTerm);

  const matches = tagMatchedIds.length > 0
    ? Prisma.sql`(${baseMatches}) OR p.id = ANY(${tagMatchedIds}::int[])`
    : baseMatches;

  const filterClauses: Prisma.Sql[] = [Prisma.sql`p."isActive" = true`, Prisma.sql`(${matches})`];
  if (query.gender) {
    filterClauses.push(Prisma.sql`pp.gender IN (${query.gender}, 'unisex')`);
  }
  if (query.category) {
    filterClauses.push(Prisma.sql`c.slug = ${query.category}`);
  }
  if (query.brand) {
    filterClauses.push(Prisma.sql`lower(coalesce(p.brand, '')) = lower(${query.brand})`);
  }
  if (query.size || query.color || query.minPrice !== undefined || query.maxPrice !== undefined) {
    const variantChecks: Prisma.Sql[] = [Prisma.sql`vf."productId" = p.id`, Prisma.sql`vf."isActive" = true`];
    if (query.size) variantChecks.push(Prisma.sql`lower(vf.size) = lower(${query.size})`);
    if (query.color) variantChecks.push(Prisma.sql`lower(vf.color) = lower(${query.color})`);
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const priceCurrency = selected ?? "VND";
      const priceChecks: Prisma.Sql[] = [Prisma.sql`vpr."variantId" = vf.id`, Prisma.sql`vpr.currency = ${priceCurrency}::"Currency"`];
      if (query.minPrice !== undefined) priceChecks.push(Prisma.sql`vpr.amount >= ${query.minPrice}`);
      if (query.maxPrice !== undefined) priceChecks.push(Prisma.sql`vpr.amount <= ${query.maxPrice}`);
      variantChecks.push(Prisma.sql`EXISTS (SELECT 1 FROM "ProductPrice" vpr WHERE ${Prisma.join(priceChecks, " AND ")})`);
    }
    filterClauses.push(Prisma.sql`EXISTS (SELECT 1 FROM "ProductVariant" vf WHERE ${Prisma.join(variantChecks, " AND ")})`);
  }
  const whereClause = Prisma.join(filterClauses, " AND ");

  const ranking = Prisma.sql`CASE
    WHEN ${name} = ${coreTerm} OR ${name} = ${`aurel ${coreTerm}`} OR ${name} = ${`aurel - ${coreTerm}`} THEN 0
    WHEN ${name} LIKE ${`${coreTerm}%`} OR ${name} LIKE ${`aurel ${coreTerm}%`} OR ${name} LIKE ${`aurel - ${coreTerm}%`} THEN 1
    ${tagMatchedIds.length > 0 ? Prisma.sql`WHEN p.id = ANY(${tagMatchedIds}::int[]) THEN 1` : Prisma.empty}
    WHEN ${name} LIKE ${`%${coreTerm}%`} THEN 2
    WHEN EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p.id AND v."isActive" = true AND ${normalized(Prisma.sql`v.sku`)} = ${coreTerm}) THEN 0
    WHEN ${category} = ${coreTerm} OR ${brand} = ${coreTerm} THEN 3
    WHEN ${profile} LIKE ${`%${coreTerm}%`} THEN 4
    ELSE 5
  END`;

  return prisma.$transaction(async tx => {
    const [{ total }] = await tx.$queryRaw<{ total: number }[]>(Prisma.sql`SELECT count(*)::int AS total FROM "Product" p JOIN "Category" c ON c.id = p."categoryId" LEFT JOIN "ProductProfile" pp ON pp."productId" = p.id WHERE ${whereClause}`);
    const ids = await tx.$queryRaw<{ id: number }[]>(Prisma.sql`SELECT p.id FROM "Product" p JOIN "Category" c ON c.id = p."categoryId" LEFT JOIN "ProductProfile" pp ON pp."productId" = p.id WHERE ${whereClause} ORDER BY ${ranking}, p."createdAt" DESC, p.id DESC OFFSET ${skip} LIMIT ${take}`);
    if (!ids.length) return { products: [], pagination: pageInfo(page, pageSize, total) };
    const records = await tx.product.findMany({ where: { id: { in: ids.map(row => row.id) } }, select: imageRightsSelect(currencyCatalogProductSelect, foundationEnabled()) });
    const order = new Map(ids.map((row, index) => [row.id, index]));
    records.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const tagsMap = await defaultProductTagStore.getTagsMapForProducts(records.map(r => r.id));
    const mapped = records.map(record => ({ ...mapCatalogProduct(record, selected), tags: tagsMap[String(record.id)] ?? [] }));
    const ranked = rankCatalogProducts(mapped, query.q);
    return { products: ranked, pagination: pageInfo(page, pageSize, total) };
  }, { isolationLevel: "RepeatableRead" });
}

export async function findSearchRecommendations(
  limit = 8,
  context?: { query?: string; sources?: readonly Product[] },
) {
  const selected = storefrontCurrency();
  const boundedLimit = Math.min(Math.max(limit, 1), 8);
  const candidateTake = context ? 24 : boundedLimit;
  const records = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      ...imageRightsSelect(currencyCatalogProductSelect, foundationEnabled()),
      profile: { select: { gender: true, garmentType: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: candidateTake,
  });
  const tagsMap = await defaultProductTagStore.getTagsMapForProducts(records.map(r => r.id));
  const mapped: Product[] = records.map(record => ({
    ...mapCatalogProduct(record, selected),
    tags: tagsMap[String(record.id)] ?? [],
    profile: record.profile
      ? { fabric: null, fit: null, gender: record.profile.gender }
      : null,
  }));

  if (context?.sources?.length || context?.query) {
    return rankComplementaryProducts(context.sources ?? [], mapped, {
      limit: boundedLimit,
      fallbackQuery: context.query,
    });
  }

  return mapped.slice(0, boundedLimit);
}

export type ProductFilters = {
  categorySlug?: string;
  color?: string;
  size?: string;
  maxPrice?: number;
  page?: number;
};

export async function findProducts(filters: ProductFilters) {
  const { categorySlug, color, size, maxPrice } = filters;
  const page = Math.max(1, Math.floor(filters.page ?? 1));

  return prisma.product.findMany({
    where: {
      isActive: true,
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
      variants: {
        some: {
          isActive: true,
          stock: { gt: 0 },
          ...(color ? { color: { equals: color, mode: "insensitive" } } : {}),
          ...(size ? { size } : {}),
          ...(maxPrice !== undefined ? { price: { lte: maxPrice } } : {}),
        },
      },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      brand: true,
      variants: {
        where: { isActive: true, stock: { gt: 0 } },
        select: { sku: true, size: true, color: true, price: true },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * 20,
    take: 20,
  });
}
