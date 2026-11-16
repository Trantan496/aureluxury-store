import test from "node:test";
import assert from "node:assert/strict";
import { betterAuth } from "better-auth/minimal";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createEmailVerificationToken } from "better-auth/api";
import { authOptions } from "../src/features/auth/config.ts";
import type { AuthEmail } from "../src/features/auth/email.ts";

const secret = "email-test-only-secret-never-used-in-production-123456789";
let fixtureId = 0;
async function fixture(delivery = true) {
  let fails = false;
  const ip = `192.0.2.${++fixtureId}`;
  const data: Record<string, Record<string, unknown>[]> = { user: [], session: [], account: [], verification: [] };
  const messages: AuthEmail[] = [];
  const auth = betterAuth(authOptions({ database: memoryAdapter(data), secret,
    baseURL: "http://localhost:3000", production: false,
    emailDelivery: delivery ? { async send(message) { if (fails) throw new Error("private provider detail"); messages.push(message); } } : undefined,
  }));
  const credentials = { email: "email-only@example.test", password: "Original-password-123!" };
  const request = (path: string, body?: object, cookie = "") => auth.handler(new Request(`http://localhost:3000/api/auth/${path}`, {
    method: body ? "POST" : "GET", headers: { origin: "http://localhost:3000", "content-type": "application/json", "x-forwarded-for": ip, cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }));
  assert.equal((await request("sign-up/email", { ...credentials, name: "Email test" })).status, 200);
  const link = () => new URL(messages.at(-1)!.text.split("\n")[1]);
  const resetToken = () => link().pathname.split("/").at(-1)!;
  const requestReset = () => request("request-password-reset", { email: credentials.email });
  return { data, messages, auth, credentials, request, link, resetToken, requestReset, failDelivery: () => { fails = true; } };
}

test("verification signup delivery, verified flag, idempotent replay and resend limit", async () => {
  const f = await fixture();
  assert.equal(f.data.user[0].emailVerified, false);
  assert.equal(f.messages.length, 1);
  for (let i = 0; i < 3; i++) assert.equal((await f.request("send-verification-email", { email: f.credentials.email })).status, 200);
  assert.equal((await f.request("send-verification-email", { email: f.credentials.email })).status, 429);
  const token = f.link().searchParams.get("token");
  assert.equal((await f.request(`verify-email?token=${token}`)).status, 200);
  assert.equal(f.data.user[0].emailVerified, true);
  assert.equal((await f.request(`verify-email?token=${token}`)).status, 200);
  assert.equal(f.data.session.length, 0);
});

test("invalid and expired verification links never verify an account", async () => {
  const f = await fixture();
  assert.equal((await f.request("verify-email?token=invalid")).status, 401);
  const expired = await createEmailVerificationToken(secret, f.credentials.email, undefined, -60);
  assert.equal((await f.request(`verify-email?token=${expired}`)).status, 401);
  assert.equal(f.data.user[0].emailVerified, false);
});

test("reset changes credential hash through Better Auth, rejects old password and expired token", async () => {
  const f = await fixture();
  await f.requestReset();
  const token = f.resetToken();
  const previous = f.data.account[0].password;
  const newPassword = "Replacement-password-456!";
  assert.equal((await f.request("reset-password", { token, newPassword })).status, 200);
  assert.notEqual(f.data.account[0].password, previous);
  assert.notEqual(f.data.account[0].password, newPassword);
  assert.equal((await f.request("sign-in/email", f.credentials)).status, 401);
  assert.equal((await f.request("sign-in/email", { ...f.credentials, password: newPassword })).status, 200);
  await f.requestReset();
  f.data.verification[0].expiresAt = new Date(Date.now() - 1000);
  assert.equal((await f.request("reset-password", { token: f.resetToken(), newPassword })).status, 400);
});

test("reset token is single-use", async () => {
  const f = await fixture();
  await f.requestReset();
  const body = { token: f.resetToken(), newPassword: "Replacement-password-456!" };
  assert.equal((await f.request("reset-password", body)).status, 200);
  assert.equal((await f.request("reset-password", body)).status, 400);
});

test("reset revokes all previous sessions and their cookies", async () => {
  const f = await fixture();
  const response = await f.request("sign-in/email", f.credentials);
  const cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  assert.equal(f.data.session.length, 1);
  await f.requestReset();
  assert.equal((await f.request("reset-password", { token: f.resetToken(), newPassword: "Replacement-password-456!" })).status, 200);
  assert.equal(f.data.session.length, 0);
  assert.equal(await (await f.request("get-session", undefined, cookie)).json(), null);
});

test("reset response is neutral; unavailable delivery fails uniformly without pretending to send", async () => {
  const f = await fixture();
  const known = await f.requestReset();
  const unknown = await f.request("request-password-reset", { email: "missing@example.test" });
  assert.equal(known.status, unknown.status);
  assert.deepEqual(await known.json(), await unknown.json());
  f.failDelivery();
  const failedDelivery = await f.requestReset();
  assert.equal(failedDelivery.status, 200);
  assert.deepEqual(await failedDelivery.json(), { status: true, message: "If this email exists in our system, check your email for the reset link" });
  const absent = await fixture(false);
  for (const path of ["request-password-reset", "send-verification-email"]) {
    const a = await absent.request(path, { email: absent.credentials.email });
    const b = await absent.request(path, { email: "missing@example.test" });
    assert.equal(a.status, 503); assert.equal(b.status, 503);
    assert.deepEqual(await a.json(), await b.json());
  }
  assert.equal(absent.messages.length, 0);
  assert.equal(absent.data.user[0].emailVerified, false);
});
