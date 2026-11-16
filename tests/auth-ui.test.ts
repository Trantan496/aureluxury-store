import test from "node:test";
import assert from "node:assert/strict";
import { authErrorMessage, logout, safeReturnTo, submitAuth, validateAuthFields, type AuthUIApi } from "../src/features/auth/ui.ts";

function fixture() {
  const calls: { action: string; input?: unknown }[] = [];
  let reply: { error: { status?: number; code?: string } | null } = { error: null };
  const record = async (action: string, input?: unknown) => { calls.push({ action, input }); return reply; };
  const api: AuthUIApi = {
    signIn: { email: input => record("login", input) }, signUp: { email: input => record("register", input) },
    requestPasswordReset: input => record("forgot", input), resetPassword: input => record("reset", input),
    sendVerificationEmail: input => record("verify", input), signOut: () => record("logout"),
  };
  return { api, calls, fail: (status: number, code = "") => { reply = { error: { status, code } }; } };
}
const origin = "http://localhost:3000";
const fields = { email: "ui-only@example.test", password: "UI-only-password-123!", confirm: "UI-only-password-123!", name: "UI test" };

test("login UI passes credentials/rememberMe and handles rejected signin safely", async () => {
  const f = fixture();
  assert.equal((await submitAuth("login", { ...fields, remember: false }, f.api, origin)).ok, true);
  assert.deepEqual(f.calls[0].input, { email: fields.email, password: fields.password, rememberMe: false });
  f.fail(401, "INVALID_EMAIL_OR_PASSWORD");
  const rejected = await submitAuth("login", fields, f.api, origin);
  assert.equal(rejected.ok, false); assert.match(rejected.message, /email và mật khẩu/);
  assert.ok(!rejected.message.includes(fields.email));
});

test("registration validates confirmation and policy before calling signup; allowlisted payload only", async () => {
  const f = fixture();
  for (const invalid of [{ ...fields, confirm: "mismatch" }, { ...fields, password: "short", confirm: "short" }, { ...fields, name: " " }, { ...fields, email: "invalid" }]) {
    assert.equal((await submitAuth("register", invalid, f.api, origin)).ok, false);
  }
  assert.equal(f.calls.length, 0);
  assert.equal((await submitAuth("register", { ...fields, role: "ADMIN", userId: 9 } as typeof fields, f.api, origin)).ok, true);
  assert.deepEqual(f.calls[0].input, { name: fields.name, email: fields.email, password: fields.password, callbackURL: `${origin}/verify-email?result=processed` });
  assert.equal(validateAuthFields("reset", { ...fields, password: "x".repeat(129), confirm: "x".repeat(129) }) !== null, true);
});

test("forgot password UI uses neutral response, unavailable and rate-limit states", async () => {
  const f = fixture();
  const result = await submitAuth("forgot", fields, f.api, origin);
  assert.equal(result.ok, true); assert.match(result.message, /Nếu địa chỉ phù hợp/);
  assert.deepEqual(f.calls[0].input, { email: fields.email, redirectTo: `${origin}/reset-password` });
  f.fail(503, "EMAIL_DELIVERY_UNAVAILABLE");
  assert.match((await submitAuth("forgot", fields, f.api, origin)).message, /chưa sẵn sàng/);
  f.fail(429); assert.match((await submitAuth("verify", fields, f.api, origin)).message, /chờ một phút/);
});

test("reset UI rejects missing token and confirmation, handles consumed token and native success", async () => {
  const f = fixture();
  assert.equal((await submitAuth("reset", fields, f.api, origin)).ok, false);
  assert.equal((await submitAuth("reset", { ...fields, confirm: "different" }, f.api, origin, "test-only-token")).ok, false);
  assert.equal(f.calls.length, 0);
  assert.equal((await submitAuth("reset", fields, f.api, origin, "test-only-token")).ok, true);
  assert.deepEqual(f.calls[0].input, { token: "test-only-token", newPassword: fields.password });
  f.fail(400, "INVALID_TOKEN");
  assert.match((await submitAuth("reset", fields, f.api, origin, "test-only-token")).message, /đã được sử dụng/);
});

test("logout UI reports success only after Better Auth succeeds; handles provider/network failure", async () => {
  const f = fixture();
  assert.equal((await logout(f.api)).ok, true); assert.equal(f.calls[0].action, "logout");
  f.fail(503); assert.equal((await logout(f.api)).ok, false);
  assert.equal((await logout({ signOut: async () => { throw new Error("private detail"); } })).ok, false);
  const network = await submitAuth("login", fields, { ...f.api, signIn: { email: async () => { throw new Error("private detail"); } } }, origin);
  assert.match(network.message, /kiểm tra mạng/); assert.ok(!network.message.includes("private detail"));
});

test("internal redirect rejects external/protocol/encoded paths and unauthorized messages remain generic", () => {
  for (const value of ["https://other.test", "//other.test", "/\\other.test", "/%2f%2fother.test", "/login", "/api/auth/sign-out", "/products?token=private", "/\nother.test"]) assert.equal(safeReturnTo(value), "/");
  assert.equal(safeReturnTo("/products?category=essentials#collection"), "/products?category=essentials#collection");
  assert.equal(safeReturnTo("/verify-email"), "/verify-email");
  assert.ok(!authErrorMessage("login", { status: 403, code: "PRIVATE_DETAIL" }).includes("PRIVATE_DETAIL"));
});

test("origin and server failures explain the problem without blaming credentials", () => {
  for (const code of ["INVALID_ORIGIN", "INVALID_REDIRECT_URL", "INVALID_CALLBACK_URL"]) {
    assert.match(authErrorMessage("forgot", { status: 403, code }), /Địa chỉ truy cập/);
  }
  assert.match(authErrorMessage("login", { status: 500 }), /Hệ thống tài khoản/);
});
