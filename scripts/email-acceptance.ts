// Manual, single-recipient acceptance runner. No tokens/passwords are persisted
// or printed. Only Better Auth GET callbacks are exposed on a loopback listener.
import { parse } from "dotenv";
import pg from "pg";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { testTarget, assertTestDatabase } from "./test-database-safety.ts";
import { authOptions } from "../src/features/auth/config.ts";
import { createResendDelivery } from "../src/features/auth/resend.ts";

process.on("uncaughtException", () => { console.error("Acceptance runner stopped; sensitive details suppressed. Inspect fixture report before retry."); process.exit(1); });
process.on("unhandledRejection", () => { console.error("Acceptance runner stopped; sensitive details suppressed. Inspect fixture report before retry."); process.exit(1); });

const recipient = "khai234991@gmail.com";
const origin = "http://127.0.0.1:3316";
if (!process.stdin.isTTY) throw new Error("Run acceptance in an interactive terminal to preserve command input");
const env = parse(readFileSync(".env.test"));
if (process.argv[2] !== "--confirm-test-database=aurel_ai_test" ||
    !env.RESEND_API_KEY || env.EMAIL_FROM !== "AUREL <no-reply@fourdteam.win>" || (env.TEST_AUTH_SECRET?.length ?? 0) < 32) {
  throw new Error("Acceptance configuration/confirmation incomplete");
}
const target = testTarget(env.TEST_DATABASE_URL, "aurel_ai_test");
const resumeRun = process.argv.find(value => value.startsWith("--resume-run="))?.slice("--resume-run=".length);
if (resumeRun && !/^p262-[a-f0-9]{16}$/.test(resumeRun)) throw new Error("Invalid acceptance run");
const run = resumeRun ?? "p262-" + randomBytes(8).toString("hex");
const reportPath = `.local/email-acceptance/${run}.json`;
// No DATABASE_URL or production auth secret is used by this runner.
const mainEnvHash = createHash("sha256").update(readFileSync(".env")).digest("hex");
const gate = new pg.Client({ connectionString: target.toString(), connectionTimeoutMillis: 5000 });
await gate.connect();
const guard = () => assertTestDatabase(sql => gate.query(sql));
await guard();
console.log("ISOLATION PASS: aurel_ai_test / aurel_ai_test_runner");
if (!resumeRun && (await gate.query('SELECT 1 FROM public."User" WHERE email=$1', [recipient])).rowCount) {
  await gate.end();
  throw new Error("Recipient already exists in test database; refusing to change or delete it");
}
const { PrismaClient } = await import("../src/generated/prisma/client.ts");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.toString(), max: 2 }) });
const freshState = { run, database: "aurel_ai_test", userId: 0, verificationAccepted: false, verificationMessageId: "", verified: false,
  resetAccepted: false, resetMessageId: "", resetComplete: false, oldPasswordRejected: false, newPasswordValid: false,
  oldSessionRevoked: false, baselinePreparedWithBetterAuth: false, cleanup: false };
const state: typeof freshState = resumeRun ? JSON.parse(readFileSync(reportPath, "utf8")) : freshState;
if (state.run !== run || state.database !== "aurel_ai_test" || state.cleanup || state.resetAccepted) throw new Error("Run cannot be resumed");
mkdirSync(".local/email-acceptance", { recursive: true });
const save = () => writeFileSync(reportPath, JSON.stringify(state, null, 2) + "\n");
let sending: "verification" | "reset" = "verification";
let verificationAttempts = 0, resetAttempts = 0;
let resetToken = "", oldCookie = "";
const oldPassword = randomBytes(30).toString("base64url") + "!9a";
const newPassword = randomBytes(30).toString("base64url") + "!9a";
const provider = createResendDelivery(env, { fetch: async (url, init) => {
  const response = await fetch(url, init);
  if (response.ok) {
    const result: unknown = await response.clone().json();
    if (result && typeof result === "object" && "id" in result && typeof result.id === "string" && /^[a-zA-Z0-9-]+$/.test(result.id)) {
      if (sending === "verification") { state.verificationAccepted = true; state.verificationMessageId = result.id; }
      else { state.resetAccepted = true; state.resetMessageId = result.id; }
      save(); console.log(`${sending.toUpperCase()} API ACCEPTED messageId=${result.id}; inbox UNCONFIRMED`);
    }
  }
  return response;
} })!;
const options = authOptions({
  database: prismaAdapter(prisma, { provider: "postgresql", transaction: true }),
  secret: env.TEST_AUTH_SECRET, baseURL: origin, production: false,
  emailDelivery: { async send(message) {
    await guard();
    if (message.to !== recipient) throw new Error("Recipient denied");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: recipient } });
    if (user.fullName !== run) throw new Error("Fixture ownership mismatch");
    state.userId = user.id;
    if (sending === "verification") {
      if (verificationAttempts++ || user.emailVerified) throw new Error("Verification send denied");
      console.log("SIGNUP: emailVerified=false confirmed in PostgreSQL");
    } else if (resetAttempts++ || !user.emailVerified) throw new Error("Reset send denied");
    save();
    await provider.send(message);
    if (sending === "reset") {
      const link = new URL(message.text.split("\n")[1]);
      if (link.origin !== origin) throw new Error("Unexpected reset origin");
      resetToken = link.pathname.split("/").at(-1)!;
    }
  } },
});
// Acceptance requires observing the committed unverified row before sending.
// Only this runner disables automatic signup delivery; app config is unchanged.
options.emailVerification.sendOnSignUp = false;
const auth = betterAuth(options);
async function request(path: string, body?: object, cookie = "") {
  await guard();
  return auth.handler(new Request(`${origin}/api/auth/${path}`, {
    method: body ? "POST" : "GET", headers: { origin, cookie, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }));
}
const cookies = (response: Response) => response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
const server = createServer(async (incoming, outgoing) => {
  // Never log incoming request URLs: they can contain verification/reset tokens.
  try {
    const url = new URL(incoming.url ?? "/", origin);
    if (incoming.method !== "GET" || incoming.headers.host !== "127.0.0.1:3316" ||
        !["/api/auth/verify-email"].includes(url.pathname)) { outgoing.writeHead(404); outgoing.end("Test callbacks only."); return; }
    await guard();
    const result = await auth.handler(new Request(url, { headers: { host: "127.0.0.1:3316" } }));
    const user = await prisma.user.findUniqueOrThrow({ where: { id: state.userId } });
    state.verified = user.emailVerified; save();
    // Do not forward token-bearing redirects to another route or log their URL.
    outgoing.writeHead(state.verified ? 200 : result.status, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" });
    outgoing.end(state.verified ? "Email verified on aurel_ai_test. Return to the acceptance conversation." : "Verification did not complete.");
    console.log(`VERIFICATION DB emailVerified=${state.verified}`);
  } catch { outgoing.writeHead(503); outgoing.end("Test verification unavailable."); console.log("Callback failed; details suppressed."); }
});
await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(3316, "127.0.0.1", resolve); });
console.log("Test callback listener ready: http://127.0.0.1:3316 (loopback only)");
if (resumeRun) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: state.userId } });
  if (user.email !== recipient || user.fullName !== run || !user.emailVerified || !state.verificationAccepted) throw new Error("Resume fixture mismatch");
  // The prior non-interactive runner lost its command input. Preserve its
  // verified user and prepare a known, RAM-only fixture baseline using Better
  // Auth's own hasher/adapter. Never alter unrelated users or send verification.
  await guard();
  const context = await auth.$context;
  await context.internalAdapter.updatePassword(String(user.id), await context.password.hash(oldPassword));
  state.verified = true; state.baselinePreparedWithBetterAuth = true;
  console.log("RESUMED same verified fixture; Better Auth credential baseline prepared; no verification resend.");
} else {
  const signup = await request("sign-up/email", { email: recipient, password: oldPassword, name: run });
  if (signup.status !== 200) throw new Error("Signup failed; inspect fixture before retry");
  const created = await prisma.user.findUniqueOrThrow({ where: { email: recipient } });
  if (created.fullName !== run || created.emailVerified) throw new Error("Unexpected signup fixture");
  state.userId = created.id; save();
  const verification = await request("send-verification-email", { email: recipient });
  console.log(`VERIFICATION REQUEST HTTP ${verification.status}; no resend will be attempted automatically.`);
}
save();
console.log("PAUSED: owner must confirm verification inbox and open its link. Commands: status, reset, complete, cleanup.");
let busy = false;
createInterface({ input: process.stdin }).on("line", async command => {
  if (busy) { console.log("Command already running."); return; }
  busy = true;
  try {
    await guard();
    if (command.trim() === "status") {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: state.userId } });
      state.verified = user.emailVerified; save(); console.log(JSON.stringify(state));
    } else if (command.trim() === "reset") {
      if (resetAttempts || !state.verified) throw new Error("Wrong stage");
      const signIn = await request("sign-in/email", { email: recipient, password: oldPassword });
      if (signIn.status !== 200) throw new Error("Initial signin failed");
      oldCookie = cookies(signIn); sending = "reset";
      const response = await request("request-password-reset", { email: recipient, redirectTo: origin });
      console.log(`RESET REQUEST HTTP ${response.status}; accepted=${state.resetAccepted}; inbox UNCONFIRMED`);
      console.log("PAUSED: owner must confirm reset email received. Do not paste token or URL. Then run complete.");
    } else if (command.trim() === "complete") {
      if (!resetToken || state.resetComplete) throw new Error("Wrong stage");
      const response = await request("reset-password", { token: resetToken, newPassword });
      if (response.status !== 200) throw new Error("Reset failed");
      state.resetComplete = true; resetToken = "";
      state.oldPasswordRejected = (await request("sign-in/email", { email: recipient, password: oldPassword })).status === 401;
      const signedIn = await request("sign-in/email", { email: recipient, password: newPassword });
      state.newPasswordValid = signedIn.status === 200;
      state.oldSessionRevoked = await (await request("get-session", undefined, oldCookie)).json() === null;
      save(); console.log(JSON.stringify(state));
    } else if (command.trim() === "cleanup") {
      if (!state.userId) throw new Error("Fixture ownership unknown");
      await guard();
      await prisma.$transaction(async tx => {
        const user = await tx.user.findUniqueOrThrow({ where: { id: state.userId } });
        if (user.fullName !== run || user.email !== recipient) throw new Error("Fixture ownership mismatch");
        // Reset token is normally consumed. If cancelled, delete only tokens
        // created by this run, never other users' or pre-existing values.
        if (resetToken) await tx.verification.deleteMany({ where: { identifier: `reset-password:${resetToken}`, value: String(state.userId) } });
        await tx.user.delete({ where: { id: state.userId } });
      });
      state.cleanup = await prisma.user.count({ where: { id: state.userId } }) === 0 &&
        await prisma.account.count({ where: { userId: state.userId } }) === 0 && await prisma.session.count({ where: { userId: state.userId } }) === 0;
      if (createHash("sha256").update(readFileSync(".env")).digest("hex") !== mainEnvHash) throw new Error("Main env changed");
      save(); console.log(JSON.stringify({ cleanup: state.cleanup, mainEnvUnchanged: true, noMainDatabaseConnection: true }));
      oldCookie = ""; resetToken = "";
      server.close(); await prisma.$disconnect(); await gate.end(); process.exit(0);
    } else console.log("Unknown command.");
  } catch { console.log("Acceptance step failed; no retry. Sensitive details suppressed."); }
  finally { busy = false; }
});
