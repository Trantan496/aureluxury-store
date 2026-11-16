import "server-only";
import type { AuthEmailDelivery } from "./email.ts";

export class EmailDeliveryError extends Error {
  readonly code: "UNAVAILABLE" | "TIMEOUT" | "RATE_LIMITED" | "REJECTED";
  constructor(code: EmailDeliveryError["code"]) {
    super("Email delivery failed");
    this.name = "EmailDeliveryError";
    this.code = code;
  }
}

export function createResendDelivery(
  env: { RESEND_API_KEY?: string; EMAIL_FROM?: string },
  options: { fetch?: typeof fetch; timeoutMs?: number; now?: () => number } = {},
): AuthEmailDelivery | undefined {
  const key = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  // Missing/partial configuration keeps the existing unavailable auth path.
  if (!key || !from || /[\r\n]/.test(key + from) || !/^(?:[^<>]+ <)?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(from)) return undefined;
  const send = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  let blockedUntil = 0;
  return {
    async send(message) {
      if (now() < blockedUntil) throw new EmailDeliveryError("RATE_LIMITED");
      const signal = AbortSignal.timeout(options.timeoutMs ?? 10_000);
      try {
        const response = await send("https://api.resend.com/emails", {
          method: "POST", redirect: "error", signal,
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
        });
        if (response.status === 429) {
          const retry = response.headers.get("retry-after");
          const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : retry ? (Date.parse(retry) - now()) / 1000 : NaN;
          blockedUntil = now() + Math.max(1, Math.min(3600, Number.isFinite(seconds) ? seconds : 60)) * 1000;
          await response.body?.cancel();
          throw new EmailDeliveryError("RATE_LIMITED");
        }
        if (!response.ok) {
          await response.body?.cancel();
          throw new EmailDeliveryError(response.status >= 500 ? "UNAVAILABLE" : "REJECTED");
        }
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("id" in result) || typeof result.id !== "string" || !result.id) {
          throw new EmailDeliveryError("UNAVAILABLE");
        }
      } catch (error) {
        if (error instanceof EmailDeliveryError) throw error;
        // Never expose provider response bodies, fetch errors, secrets or URLs.
        throw new EmailDeliveryError(signal.aborted ? "TIMEOUT" : "UNAVAILABLE");
      }
    },
  };
}
