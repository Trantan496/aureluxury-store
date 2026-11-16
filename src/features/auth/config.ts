import "server-only";
import type { BetterAuthOptions } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { authEmail, type AuthEmailDelivery } from "./email.ts";

export function authOptions(input: {
  database: BetterAuthOptions["database"];
  secret: string;
  baseURL: string;
  production: boolean;
  emailDelivery?: AuthEmailDelivery;
}) {
  if (input.secret.length < 32) throw new Error("Authentication configuration is incomplete");
  const url = new URL(input.baseURL);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (input.production && url.protocol !== 'https:' && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error("Invalid authentication origin");
  return {
    appName: "AUREL AI", database: input.database, secret: input.secret,
    baseURL: url.origin, trustedOrigins: [url.origin],
    user: {
      fields: { name: "fullName" },
      additionalFields: { role: { type: ["CUSTOMER", "ADMIN"], required: false, defaultValue: "CUSTOMER", input: false, returned: false } },
    },
    advanced: { database: { generateId: "serial" }, useSecureCookies: url.protocol === 'https:', disableOriginCheck: false, disableCSRFCheck: false },
    hooks: { before: createAuthMiddleware(async context => {
      if (!input.emailDelivery && ["/request-password-reset", "/send-verification-email"].includes(context.path)) {
        throw new APIError("SERVICE_UNAVAILABLE", { message: "Email delivery is unavailable", code: "EMAIL_DELIVERY_UNAVAILABLE" });
      }
    }) },
    emailVerification: {
      sendOnSignUp: Boolean(input.emailDelivery), expiresIn: 3600, autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => {
        if (!input.emailDelivery) throw new APIError("SERVICE_UNAVAILABLE", { message: "Email delivery is unavailable" });
        try { await input.emailDelivery.send(authEmail("verification", user.email, url)); }
        catch { throw new APIError("SERVICE_UNAVAILABLE", { message: "Email delivery is unavailable" }); }
      },
    },
    emailAndPassword: {
      enabled: true, minPasswordLength: 12, maxPasswordLength: 128, autoSignIn: false,
      requireEmailVerification: false, resetPasswordTokenExpiresIn: 1800, revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        // Once a provider is configured, keep the native neutral response even
        // on transport failure: its status acknowledges the request, not delivery.
        // Returning a user-dependent transport error would disclose membership.
        try { await input.emailDelivery!.send(authEmail("reset", user.email, url)); }
        catch { console.error("[auth-email] Password reset delivery failed."); }
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, window: 60, max: 100, storage: "memory", customRules: {
      "/sign-in/email": { window: 60, max: 5 }, "/sign-up/email": { window: 60, max: 5 },
      "/send-verification-email": { window: 60, max: 3 }, "/request-password-reset": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
    } },
    logger: { level: "error", log: () => { console.error("[auth] Authentication operation failed."); } },
  } satisfies BetterAuthOptions;
}
