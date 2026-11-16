import sharp from "sharp";
import { InputError } from "./validation.ts";
export const maxImageBytes = 8 * 1024 * 1024;
export async function readImageBody(request: Request): Promise<Uint8Array> {
  const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type)) throw new InputError("imageFile");
  const reader = request.body?.getReader(); if (!reader) throw new InputError("imageFile");
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      total += value.length;
      if (total > maxImageBytes) { await reader.cancel(); throw new InputError("imageSize"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!total) throw new InputError("imageFile");
  const bytes = new Uint8Array(total); let offset = 0;
  for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
  return bytes;
}
export async function prepareImage(input: Uint8Array) {
  if (!input.length || input.length > maxImageBytes) throw new InputError("imageSize");
  try {
    const source = sharp(input, { limitInputPixels: 24_000_000, animated: false, failOn: "warning" });
    const meta = await source.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || (meta.pages ?? 1) > 1) throw new Error();
    const { data, info } = await source.rotate().resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    if (data.length > maxImageBytes) throw new Error();
    return { data: new Uint8Array(data), width: info.width, height: info.height, byteSize: data.length, mimeType: "image/webp" };
  } catch { throw new InputError("imageFile"); }
}
