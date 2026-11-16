import test from "node:test";
import assert from "node:assert/strict";
import { betterAuth } from "better-auth/minimal";
import { memoryAdapter } from "better-auth/adapters/memory";
import { authOptions } from "../src/features/auth/config.ts";
import { resolveAuthSession } from "../src/features/auth/session.ts";
import { createProductService, type ProductDataTransaction } from "../src/features/products/product-service.ts";

// Real Better Auth hashing, cookies and endpoint handlers; only its storage adapter is in memory.
// No account, ADMIN or auth fixture is inserted into PostgreSQL.
test("Better Auth signup/signin/session/authorization/logout lifecycle with serial IDs", async () => {
  const data: Record<string, Record<string, unknown>[]> = { user: [], session: [], account: [], verification: [] };
  const auth = betterAuth(authOptions({ database: memoryAdapter(data), secret: "test-only-secret-never-used-outside-memory-123456789", baseURL: "http://localhost:3000", production: false }));
  const credentials = { email: "memory-only@example.test", password: "Memory-only-Password-123!" };
  async function request(path: string, body: object, cookie = "", origin = "http://localhost:3000") {
    return auth.handler(new Request(`http://localhost:3000/api/auth/${path}`, {
      method: "POST", headers: { "content-type": "application/json", origin, cookie }, body: JSON.stringify(body),
    }));
  }
  function cookies(response: Response) { return response.headers.getSetCookie().map(value => value.split(";")[0]).join("; "); }
  const signup = await request("sign-up/email", { ...credentials, name: "Memory test only", role: "ADMIN", userId: 999, emailVerified: true });
  assert.equal(signup.status, 200);
  assert.equal(data.user.length, 1);
  assert.equal(data.user[0].fullName, "Memory test only");
  assert.equal(data.user[0].role, "CUSTOMER");
  assert.equal(data.user[0].emailVerified, false);
  assert.notEqual(data.account[0].password, credentials.password);
  assert.ok(String(data.account[0].password).length > 50);
  assert.equal(data.session.length, 0, "autoSignIn is disabled");

  const invalid = await request("sign-in/email", { ...credentials, password: "Wrong-Password-123!" });
  assert.equal(invalid.status, 401);
  assert.equal(data.session.length, 0);
  const signedIn = await request("sign-in/email", credentials);
  assert.equal(signedIn.status, 200);
  const cookie = cookies(signedIn);
  assert.ok(cookie.includes("session_token="));
  const headers = new Headers({ cookie });
  const verified = await resolveAuthSession(auth, headers);
  assert.ok(verified);
  assert.equal(verified.userId, Number(data.user[0].id));
  assert.ok(verified.expiresAt > Date.now());
  const roleEscalation = await request("update-user", { role: "ADMIN" }, cookie);
  assert.equal(roleEscalation.status, 400);
  assert.equal(data.user[0].role, "CUSTOMER", "role cannot be changed through auth profile updates");

  let mutations = 0;
  const tx = {
    user: { findUnique: async () => ({ role: data.user[0].role }) },
    product: { create: async () => { mutations++; throw new Error("Denied operation reached storage"); }, findMany: async () => [], count: async () => 0 },
  } as unknown as ProductDataTransaction;
  const service = createProductService({ resolveSession: () => resolveAuthSession(auth, headers), transaction: work => work(tx) });
  const customer = await service.create("product", { name: "Never stored", slug: "never-stored", categoryId: 1, role: "ADMIN" });
  assert.equal(customer.ok, false); if (!customer.ok) assert.equal(customer.error.code, "FORBIDDEN");
  // Role changes exist only in the test adapter, never in the application's User table.
  data.user[0].role = "ADMIN";
  assert.equal((await service.list("product")).ok, true);
  data.user[0].role = "CUSTOMER";
  const revoked = await service.create("product", { name: "Never stored", slug: "never-stored", categoryId: 1 });
  assert.equal(revoked.ok, false); if (!revoked.ok) assert.equal(revoked.error.code, "FORBIDDEN");
  assert.equal(mutations, 0);

  const tokenPart = cookie.split("; ").find(value => value.includes("session_token="));
  assert.ok(tokenPart);
  assert.equal(await resolveAuthSession(auth, new Headers({ cookie: tokenPart + "tampered" })), null);
  const csrf = await request("sign-out", {}, cookie, "https://untrusted.example");
  assert.equal(csrf.status, 403);
  assert.ok(await resolveAuthSession(auth, headers));

  const signedOut = await request("sign-out", {}, cookie);
  assert.equal(signedOut.status, 200);
  assert.equal(await resolveAuthSession(auth, headers), null, "replaying the old signed cookie is denied");
  const noSession = await service.create("product", { name: "Never stored", slug: "never-stored", categoryId: 1 });
  assert.equal(noSession.ok, false); if (!noSession.ok) assert.equal(noSession.error.code, "UNAUTHENTICATED");

  const second = await request("sign-in/email", credentials);
  assert.equal(second.status, 200);
  const secondHeaders = new Headers({ cookie: cookies(second) });
  const third = await request("sign-in/email", credentials);
  assert.equal(third.status, 200);
  const thirdHeaders = new Headers({ cookie: cookies(third) });
  const thirdSession = await auth.api.getSession({ headers: thirdHeaders });
  assert.ok(thirdSession);
  await auth.api.revokeSession({ headers: secondHeaders, body: { token: thirdSession.session.token } });
  assert.equal(await resolveAuthSession(auth, thirdHeaders), null, "explicit session revocation is checked in storage");
  data.session[0].expiresAt = new Date(Date.now() - 1000);
  assert.equal(await resolveAuthSession(auth, secondHeaders), null);
});

test("auth config rejects missing secrets and non-HTTPS production origins", () => {
  assert.throws(() => authOptions({ database: undefined, secret: "", baseURL: "http://localhost:3000", production: false }));
  assert.throws(() => authOptions({ database: undefined, secret: "x".repeat(48), baseURL: "http://store.example", production: true }));
});

test("session adapter never trusts request identity headers and propagates provider failures closed", async () => {
  const auth = { api: { getSession: async (input: { query: { disableCookieCache: true; disableRefresh: true } }) => {
    assert.equal(input.query.disableCookieCache, true);
    assert.equal(input.query.disableRefresh, true);
    return null;
  } } };
  assert.equal(await resolveAuthSession(auth, new Headers({ "x-user-id": "1", "x-role": "ADMIN" })), null);
  await assert.rejects(resolveAuthSession({ api: { getSession: async () => { throw new Error("provider unavailable"); } } }, new Headers()));
});
