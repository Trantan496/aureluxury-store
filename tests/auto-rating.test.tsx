import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createAutoRatingStore, resolveProductRatingWithAuto } from "../src/features/reviews/auto-rating.ts";

registerHooks({
  load(url, context, next) {
    if (url.endsWith(".module.css")) {
      return {
        format: "module",
        source: "export default new Proxy({}, { get: (_, key) => String(key) });",
        shortCircuit: true,
      };
    }
    return next(url, context);
  },
});

const { SellerReviews } = await import("../src/components/admin/seller-reviews.tsx");
const { ProductRating } = await import("../src/components/products/product-rating.tsx");

test("A1: createAutoRatingStore defaults to disabled and persists enable/disable state", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "aurel-auto-rating-"));
  try {
    const store = createAutoRatingStore(path.join(dir, "auto-rating.json"));
    const initial = await store.get();
    assert.equal(initial.enabled, false);
    assert.equal(initial.updatedAt, null);

    const enabledState = await store.set(true, 99, new Date("2026-11-13T15:40:00.000Z"));
    assert.equal(enabledState.enabled, true);
    assert.equal(enabledState.updatedById, 99);
    assert.equal((await store.get()).enabled, true);

    const disabledState = await store.set(false, 99, new Date("2026-11-13T15:41:00.000Z"));
    assert.equal(disabledState.enabled, false);
    assert.equal((await store.get()).enabled, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A2: resolveProductRatingWithAuto returns 5 stars when enabled with no real reviews, and preserves real reviews", () => {
  assert.equal(resolveProductRatingWithAuto(null, { enabled: false }), null);
  assert.deepEqual(resolveProductRatingWithAuto(null, { enabled: true }), { average: 5, count: 1 });
  assert.deepEqual(resolveProductRatingWithAuto({ average: 4, count: 2 }, { enabled: true }), {
    average: 4,
    count: 2,
  });
});

test("A3: SellerReviews renders auto 5-star action bar for admin", () => {
  const html = renderToStaticMarkup(<SellerReviews />);
  assert.match(html, /Auto đánh giá 5 sao toàn bộ sản phẩm/);
  assert.match(html, /Auto đánh giá 5 sao tất cả sản phẩm/);
});

test("A4: ProductRating renders 5 stars without DEMO label when auto rating is active", () => {
  const rating = resolveProductRatingWithAuto(null, { enabled: true });
  const html = renderToStaticMarkup(<ProductRating rating={rating} />);
  assert.match(html, /5 trên 5 sao/);
  assert.match(html, /\(1 review\)/);
  assert.doesNotMatch(html, /DEMO/);
});
