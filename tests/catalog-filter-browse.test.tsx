import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import { parseCatalogQuery } from "../src/features/catalog/catalog.ts";
import { catalogWhere } from "../src/features/catalog/prisma-catalog.ts";

const imageModule = new URL("../node_modules/next/image.js", import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,", shortCircuit: true };
    }
    if (specifier === "next/image") {
      return { url: `${imageModule}?node-interop`, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith("?node-interop")) {
      return {
        format: "module",
        source: `import image from ${JSON.stringify(imageModule)}; export default image.default ?? image;`,
        shortCircuit: true,
      };
    }
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

const { CatalogBrowser } = await import("../src/components/products/catalog-browser.tsx");

test("Case 1: parseCatalogQuery and catalogWhere accept gender=women filter cleanly", () => {
  const query = parseCatalogQuery({ gender: "women" });
  assert.equal(query.invalid, false);
  assert.equal(query.gender, "women");
  assert.equal(query.q, "");
  const where = catalogWhere(query);
  assert.deepEqual(where.profile, { is: { gender: { in: ["women", "unisex"] } } });
});

test("Case 2: CatalogBrowser renders product catalog + compact unified search/filter bar for /products?gender=women", async () => {
  const html = renderToStaticMarkup(await CatalogBrowser({ params: { gender: "women" } }));
  assert.doesNotMatch(html, /WHAT ARE YOU/);
  assert.match(html, /Tìm kiếm và bộ lọc sản phẩm/);
  assert.match(html, /Bộ lọc \(1\)/);
  assert.match(html, /Danh mục/);
  assert.match(html, /Màu/);
  assert.match(html, /Giá/);
  assert.match(html, /Size/);
});

test("Case 3: CatalogBrowser keeps Explore Search Hero for bare /products and provides direct browse links", async () => {
  const html = renderToStaticMarkup(await CatalogBrowser({ params: {} }));
  assert.match(html, /WHAT ARE YOU/);
  assert.match(html, /href="\/products\?page=1"/);
  assert.match(html, /href="\/products\?gender=women"/);
  assert.match(html, /href="\/products\?gender=men"/);
});

test("Case 4: CatalogBrowser preserves active filters inside SearchForm hidden inputs", async () => {
  const html = renderToStaticMarkup(
    await CatalogBrowser({ params: { gender: "women", category: "tops" } }),
  );
  assert.match(html, /<input type="hidden" name="gender" value="women"/);
  assert.match(html, /<input type="hidden" name="category" value="tops"/);
});
