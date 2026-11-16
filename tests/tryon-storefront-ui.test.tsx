import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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

const { VirtualTryOnTrigger } = await import("../src/components/products/virtual-tryon-modal.tsx");
const { TryOnStudio } = await import("../src/components/tryon/tryon-studio.tsx");
const { inferTryOnClothType, normalizeTryOnClothType } = await import("../src/features/tryon/cloth-type.ts");

test("VirtualTryOnTrigger renders the reference layout and keeps fifth-image fitting controls", () => {
  const html = renderToStaticMarkup(
    createElement(VirtualTryOnTrigger, {
      productName: "AUREL - ESSENTIAL SHIRT",
      productImages: Array.from({ length: 5 }, (_, i) => ({ url: `/images/aurel/garment-${i + 1}.jpg` })),
    })
  );
  assert.match(html, /VIRTUAL TRY-ON/);
  assert.match(html, /src="\/images\/aurel\/garment-5.jpg"/);
  assert.doesNotMatch(html, /garment-[1-4]\.jpg/);
  assert.match(html, /aria-label="AUREL Virtual Try-On"/);
  assert.match(html, /Đóng cửa sổ thử đồ/);
  assert.match(html, /Tải ảnh toàn thân/);
  assert.match(html, /Thử phong cách mới/);
  assert.match(html, /THỬ ĐỒ AI/);
  assert.match(html, /Kết quả thử đồ/);
  assert.match(html, /tryon-editorial-model-cutout\.webp/);
  assert.doesNotMatch(html, /Phòng thử đồ của bạn|AUREL ATELIER|Mở phòng thử đồ AI|Nhận ảnh thử đồ/);
});

test("TryOnStudio renders catalog garment options alongside empty fallback state", () => {
  const withCatalog = renderToStaticMarkup(
    createElement(TryOnStudio, {
      catalogGarments: [
        {
          id: "prod-1",
          name: "AUREL - ESSENTIAL SHIRT",
          imageUrl: "/images/aurel/essential-shirt.jpg",
          slug: "aurel-essential-shirt",
        },
      ],
      catalogStatus: "success",
      initialGarmentUrl: "/images/aurel/essential-shirt.jpg",
      initialGarmentName: "AUREL - ESSENTIAL SHIRT",
    })
  );
  assert.match(withCatalog, /AUREL - ESSENTIAL SHIRT/);
  assert.match(withCatalog, /href="\/products\/aurel-essential-shirt"/);

});

test("TryOnStudio renders clearly labelled demo garments for an empty catalog", () => {
  const emptyCatalog = renderToStaticMarkup(
    createElement(TryOnStudio, {
      catalogGarments: [],
      catalogStatus: "empty",
    })
  );
  assert.match(emptyCatalog, /Cửa hàng chưa có sản phẩm kích hoạt/);
  assert.match(emptyCatalog, /AUREL Cashmere Knit/);
});

test("TryOnStudio renders usable fallback banner when catalog database is offline", () => {
  const html = renderToStaticMarkup(
    createElement(TryOnStudio, {
      catalogGarments: [],
      catalogStatus: "error",
    })
  );
  assert.match(html, /Không thể tải danh mục sản phẩm từ cơ sở dữ liệu lúc này/);
  assert.match(html, /AUREL Tailored Coat/);
});


test("TryOnStudio initial workspace has accessible uploads and no fabricated result", () => {
  const html = renderToStaticMarkup(createElement(TryOnStudio, { catalogGarments: [], catalogStatus: "empty" }));
  assert.match(html, /Phòng thử đồ của bạn/);
  assert.match(html, /Đang kiểm tra dịch vụ AI/);
  assert.doesNotMatch(html, /AI Offline|RTX 5060|data:image/);
  assert.match(html, /aria-label="Trang phục có thể thử"/);
  assert.match(html, /aria-busy="false"/);
  assert.match(html, /disabled=""[^>]*>Bắt đầu thử đồ/);
  assert.equal((html.match(/type="file"/g) ?? []).length, 2);
});

test("TryOnStudio selects the safe PDP garment", () => {
  const html = renderToStaticMarkup(createElement(TryOnStudio, { catalogGarments: [], catalogStatus: "empty", initialGarmentUrl: "/images/aurel/custom.webp", initialGarmentName: "Selected jacket" }));
  assert.match(html, /aria-pressed="true"[^>]*>[\s\S]*?Selected jacket/);
});

test("TryOnStudio rejects external garment deep links", () => {
  const html = renderToStaticMarkup(createElement(TryOnStudio, { catalogGarments: [], catalogStatus: "empty", initialGarmentUrl: "https://example.com/private.webp", initialGarmentName: "Unsafe garment" }));
  assert.doesNotMatch(html, /example.com|Unsafe garment/);
});


test("VirtualTryOnTrigger refuses a four-image catalog instead of using the primary image", () => {
  const html = renderToStaticMarkup(createElement(VirtualTryOnTrigger, { productName: "Four images", productImages: Array.from({ length: 4 }, (_, i) => ({ url: `/images/item-${i}.jpg` })) }));
  assert.match(html, /Chưa có ảnh nền trắng số 5 để thử đồ/);
  assert.match(html, /disabled=""[^>]*aria-label="Thử đồ ảo với Four images"/);
  assert.doesNotMatch(html, /src="\/images\/item-/);
});

test("VirtualTryOnTrigger has a clear disabled state with no product images", () => {
  const html = renderToStaticMarkup(createElement(VirtualTryOnTrigger, { productName: "No images", productImages: [] }));
  assert.match(html, /Chưa có ảnh nền trắng số 5 để thử đồ/);
  assert.match(html, /disabled=""[^>]*aria-label="Thử đồ ảo với No images"/);
});

test("inferTryOnClothType maps bottoms, overall, bag/accessories, and tops categories", () => {
  assert.equal(inferTryOnClothType({ categorySlug: "bottoms", categoryName: "Quần", productName: "AUREL - TROUSERS" }), "lower");
  assert.equal(inferTryOnClothType({ categorySlug: "quan-dai", productName: "AUREL - LINEN" }), "lower");
  assert.equal(inferTryOnClothType({ productName: "AUREL - QUẦN TÂY NAM" }), "lower");
  assert.equal(inferTryOnClothType({ productName: "AUREL - QUẦN TÚI HỘP" }), "lower");
  assert.equal(inferTryOnClothType({ categoryName: "Đầm", productName: "AUREL - SILK" }), "overall");
  assert.equal(inferTryOnClothType({ categorySlug: "accessories", categoryName: "Phụ kiện", productName: "NOIRÉ – EXECUTIVE CLUTCH" }), "bag");
  assert.equal(inferTryOnClothType({ productSlug: "elara-elegant-hobo-2026-nu-gen-x", productName: "ELARA – ELEGANT HOBO" }), "bag");
  assert.equal(inferTryOnClothType({ productName: "ATHLEX – ACTIVE GEAR" }), "bag");
  assert.equal(inferTryOnClothType({ categorySlug: "tops", categoryName: "Áo", productName: "AUREL - ESSENTIAL SHIRT" }), "upper");
  assert.equal(normalizeTryOnClothType("lower"), "lower");
  assert.equal(normalizeTryOnClothType("bag"), "bag");
  assert.equal(normalizeTryOnClothType("invalid"), "upper");
});
