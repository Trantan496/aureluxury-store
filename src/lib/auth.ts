import "server-only";
import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { authOptions } from "../features/auth/config";
import { createResendDelivery } from "../features/auth/resend";

function buildAuth(database: ReturnType<typeof prismaAdapter>) {
  return betterAuth(authOptions({
    database, secret: process.env.BETTER_AUTH_SECRET ?? "",
    baseURL: process.env.BETTER_AUTH_URL ?? "", production: process.env.NODE_ENV === "production",
    emailDelivery: createResendDelivery({ RESEND_API_KEY: process.env.RESEND_API_KEY, EMAIL_FROM: process.env.EMAIL_FROM }),
  }));
}
let instance: ReturnType<typeof buildAuth> | undefined;
export async function getAuth() {
  if (!instance) {
    const { prisma } = await import("./db/client");
    instance ??= buildAuth(prismaAdapter(prisma, { provider: "postgresql", transaction: true }));
  }
  return instance;
}
