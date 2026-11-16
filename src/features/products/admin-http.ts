import { InputError } from "./validation.ts";

export function assertAdminOrigin(origin: string | null, configuredOrigin: string | undefined, fetchSite: string | null) {
  if (!origin || !configuredOrigin || fetchSite === "cross-site") throw new InputError("origin");
  try { if (new URL(origin).origin !== new URL(configuredOrigin).origin) throw new Error(); }
  catch { throw new InputError("origin"); }
}
export async function readAdminJson(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new InputError("contentType");
  const reader = request.body?.getReader(); if (!reader) throw new InputError("body");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 2_500_000) { await reader.cancel(); throw new InputError("fileSize"); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch { throw new InputError("body"); }
  finally { reader.releaseLock(); }
}
