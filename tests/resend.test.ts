import test from "node:test";
import assert from "node:assert/strict";
import { createResendDelivery, EmailDeliveryError } from "../src/features/auth/resend.ts";
import { authEmail } from "../src/features/auth/email.ts";

const env = { RESEND_API_KEY: "test-key-only", EMAIL_FROM: "AUREL <auth@example.test>" };
const message = authEmail("verification", "allowed@example.test", "https://example.test/verify?token=private");

test("Resend configuration is unavailable when absent, partial or malformed", () => {
  for (const config of [{}, { RESEND_API_KEY: env.RESEND_API_KEY }, { ...env, EMAIL_FROM: "invalid" }, { ...env, EMAIL_FROM: "bad\r\n@example.test" }]) {
    assert.equal(createResendDelivery(config), undefined);
  }
});

test("Resend submits existing verification/reset templates and requires provider acceptance", async () => {
  let calls = 0;
  const delivery = createResendDelivery(env, { fetch: async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${env.RESEND_API_KEY}`);
    const expected = calls++ ? authEmail("reset", message.to, "https://example.test/reset?token=private") : message;
    assert.deepEqual(JSON.parse(String(init?.body)), { from: env.EMAIL_FROM, to: [expected.to], subject: expected.subject, text: expected.text, html: expected.html });
    return Response.json({ id: "accepted-test-message" });
  } });
  await delivery!.send(message);
  await delivery!.send(authEmail("reset", message.to, "https://example.test/reset?token=private"));
  assert.equal(calls, 2);
});

test("Resend errors and timeouts are sanitized, without retries", async () => {
  for (const status of [401, 500, 200]) {
    let calls = 0;
    const delivery = createResendDelivery(env, { fetch: async () => { calls++; return Response.json({ message: "private response token/API key/email" }, { status }); } });
    await assert.rejects(delivery!.send(message), error => error instanceof EmailDeliveryError && error.message === "Email delivery failed" && error.code === (status === 401 ? "REJECTED" : "UNAVAILABLE"));
    assert.equal(calls, 1);
  }
  const timeout = createResendDelivery(env, { timeoutMs: 5, fetch: async (_url, init) => {
    await new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error("mock failed to abort")), 500);
      init!.signal!.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("private network error")); }, { once: true });
    });
    return Response.json({ id: "unreachable" });
  } });
  await assert.rejects(timeout!.send(message), error => error instanceof EmailDeliveryError && error.code === "TIMEOUT");
  const network = createResendDelivery(env, { fetch: async () => { throw new Error("private network credentials"); } });
  await assert.rejects(network!.send(message), error => error instanceof EmailDeliveryError && error.code === "UNAVAILABLE" && !error.cause);
});

test("Resend 429 respects Retry-After cooldown and does not retry automatically", async () => {
  let time = 100_000;
  let calls = 0;
  const delivery = createResendDelivery(env, { now: () => time, fetch: async () => {
    calls++;
    return calls === 1 ? new Response(null, { status: 429, headers: { "retry-after": "2" } }) : Response.json({ id: "accepted-after-cooldown" });
  } });
  const limited = (error: unknown) => error instanceof EmailDeliveryError && error.code === "RATE_LIMITED";
  await assert.rejects(delivery!.send(message), limited);
  await assert.rejects(delivery!.send(message), limited);
  assert.equal(calls, 1);
  time += 2000;
  await delivery!.send(message);
  assert.equal(calls, 2);
});
