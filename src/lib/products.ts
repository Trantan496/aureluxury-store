import "server-only";
import { currencyEnabled } from "../features/money/money";
import { createProductService, type SessionResolver } from "../features/products/product-service";
import { resolveProductSession } from "./auth-session";
import { writeProductAudit } from "./product-audit";

// Production defaults to the Better Auth request session. Inject only in trusted server composition/tests.
export function createProductDataService(resolveSession: SessionResolver = resolveProductSession) {
  return createProductService({
    resolveSession,
    audit: writeProductAudit,
    multiCurrency: currencyEnabled(),
    productFoundation: process.env.PRODUCT_FOUNDATION_ENABLED === "true",
    transaction: async work => {
      const { prisma } = await import("./db/client");
      return prisma.$transaction(tx => work(tx), { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 });
    },
  });
}
