import "server-only";
import type { VerifiedProductSession } from "../products/product-service";

type SessionProvider = {
  api: { getSession: (input: { headers: Headers; query: { disableCookieCache: true; disableRefresh: true } }) => Promise<{
    user: { id: string | number }; session: { expiresAt: Date };
  } | null> };
};

// The provider verifies the signed cookie and looks up the database session.
// This adapter only converts trusted IDs/expiry; it never reads role/userId from request JSON.
export async function resolveAuthSession(auth: SessionProvider, headers: Headers): Promise<VerifiedProductSession | null> {
  const result = await auth.api.getSession({ headers, query: { disableCookieCache: true, disableRefresh: true } });
  if (!result) return null;
  const rawId = String(result.user.id);
  if (!/^[1-9]\d*$/.test(rawId)) return null;
  const userId = Number(rawId), expiresAt = result.session.expiresAt.getTime();
  if (!Number.isSafeInteger(userId) || userId > 2147483647 || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return null;
  return { userId, expiresAt };
}
