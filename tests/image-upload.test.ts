import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createRequire } from "node:module";
import nextConfig from "../next.config.ts";
import { prepareImage, readImageBody, maxImageBytes } from "../src/features/products/image-upload.ts";
import { imageAssetId, imageAssetKey } from "../src/features/products/image-storage.ts";
test("uploaded raster is decoded, resized, stripped and stored as WebP", async () => {
  const original = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#aa5555" } }).jpeg().withMetadata({ orientation: 1 }).toBuffer();
  const result = await prepareImage(original), meta = await sharp(result.data).metadata();
  assert.equal(result.width, 1920); assert.equal(result.height, 960); assert.equal(result.mimeType, "image/webp");
  assert.equal(meta.format, "webp"); assert.equal(meta.exif, undefined); assert.equal(result.byteSize, result.data.length);
  assert.equal(imageAssetId(imageAssetKey("6b5f2fe8-1ad7-4f11-af93-32bb4c83c650")), "6b5f2fe8-1ad7-4f11-af93-32bb4c83c650");
  assert.equal(imageAssetId("/images/uploads/../other.webp"), null);
});
test("upload rejects forged types, corrupt images, SVG and excessive bytes", async () => {
  await assert.rejects(prepareImage(new Uint8Array()));
  await assert.rejects(prepareImage(new Uint8Array(maxImageBytes + 1)));
  await assert.rejects(prepareImage(new TextEncoder().encode('<svg width="100" height="100"></svg>')));
  await assert.rejects(prepareImage(new Uint8Array([1, 2, 3])));
  await assert.rejects(readImageBody(new Request("http://localhost", { method: "POST", body: "bad", headers: { "Content-Type": "image/svg+xml" } })));
  await assert.rejects(readImageBody(new Request("http://localhost", { method: "POST", body: new Uint8Array(maxImageBytes + 1), headers: { "Content-Type": "image/png" } })));
});
test("Next optimizer cannot cache permission-gated database uploads", () => {
  const { hasLocalMatch } = createRequire(import.meta.url)("next/dist/shared/lib/match-local-pattern.js");
  const patterns = nextConfig.images?.localPatterns;
  assert.equal(hasLocalMatch(patterns, "/images/uploads/6b5f2fe8-1ad7-4f11-af93-32bb4c83c650.webp"), false);
  assert.equal(hasLocalMatch(patterns, "/images/aurel/collection-demo/coat.png"), true);
  assert.equal(hasLocalMatch(patterns, "/images/example.jpg"), true);
});
