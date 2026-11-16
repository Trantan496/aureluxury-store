// Server-only database client. Never import this into a Client Component.
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  // Prisma may execute relation query-plan nodes concurrently on one checked-out
  // transaction client. pg's explicit pipeline mode is required for that usage;
  // independent Prisma calls can still use separate clients from this pool.
  const adapter = new PrismaPg({ connectionString, connectionTimeoutMillis: 5000, query_timeout: 10000, max: 5, pipeline: true });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
