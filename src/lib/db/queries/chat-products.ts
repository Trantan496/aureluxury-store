import "server-only";
import { prisma } from "../client";
import { Prisma } from "../../../generated/prisma/client";
import { currencyCatalogProductSelect, imageRightsSelect, mapCatalogProduct } from "../../../features/catalog/prisma-catalog";
import { storefrontCurrency } from "../../../features/money/money";
import type { ChatRetrievalPlan } from "../../../features/chat/retrieval-plan";

/** Chat uses hard metadata filters; storefront search/tag OR matches cannot widen them. */
export async function findChatProducts(plan: ChatRetrievalPlan) {
  if (!plan.retrieve) return [];
  const clauses = [Prisma.sql`p."isActive" = true`];
  if (plan.category) clauses.push(Prisma.sql`c.slug = ${plan.category}`);
  if (plan.gender) clauses.push(Prisma.sql`pp.gender IN (${plan.gender}, 'unisex')`);
  if (plan.productIds?.length) {
    const ids = plan.productIds.filter(id => /^[1-9]\d*$/.test(id)).map(Number).filter(Number.isSafeInteger);
    if (!ids.length) return [];
    clauses.push(Prisma.sql`p.id = ANY(${ids}::int[])`);
  }
  const normalizedName = Prisma.sql`translate(lower(p.name), 'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')`;
  for (const keyword of plan.keywords) {
    const pattern = `%${keyword.replace(/[\\%_]/g, "\\$&")}%`;
    const color = keyword === "black" ? "đen" : keyword;
    clauses.push(Prisma.sql`(${normalizedName} LIKE ${pattern} OR lower(coalesce(pp."garmentType", '')) LIKE ${pattern} OR EXISTS(SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p.id AND v."isActive" = true AND lower(v.color) IN (${keyword}, ${color})))`);
  }
  return prisma.$transaction(async tx => {
    const ids = await tx.$queryRaw<{ id: number }[]>(Prisma.sql`SELECT p.id FROM "Product" p JOIN "Category" c ON c.id = p."categoryId" LEFT JOIN "ProductProfile" pp ON pp."productId" = p.id WHERE ${Prisma.join(clauses, " AND ")} ORDER BY p.id DESC LIMIT 3`);
    if (!ids.length) return [];
    const records = await tx.product.findMany({ where: { id: { in: ids.map(row => row.id) }, isActive: true }, select: {
      ...imageRightsSelect(currencyCatalogProductSelect, true),
      profile: { select: { gender: true, fabric: true, fit: true } },
    } });
    const order = new Map(ids.map((item, index) => [item.id, index]));
    return records.sort((a, b) => order.get(a.id)! - order.get(b.id)!).map(record => ({
      ...mapCatalogProduct(record, storefrontCurrency()), profile: record.profile,
    }));
  }, { isolationLevel: "RepeatableRead" });
}
