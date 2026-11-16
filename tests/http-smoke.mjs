import assert from "node:assert/strict";

const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const routes = [
  ["/", 200, "The New Collection"],
  ["/products", 200, "Khám phá phong cách"],
  ["/products?category=workwear", 200, "Công sở"],
  ["/products?category=tops", 200, "Tops"],
  ["/products?category=bottoms", 200, "Bottoms"],
  ["/products?category=outerwear", 200, "Outerwear"],
  ["/products?category=invalid", 200, "Bộ lọc không hợp lệ"],
  ["/search", 200, "Bắt đầu bằng một từ khóa"],
  ["/search?q=linen", 200, "Chưa tìm thấy sản phẩm"],
  ["/search?q=a&q=b", 200, "Vui lòng nhập một từ khóa"],
  ["/cart", 200, "Giỏ hàng của bạn đang trống"],
  ["/page-that-does-not-exist", 404, "Không tìm thấy trang"],
];
const links = new Set();
for (const [path, status, expected] of routes) {
  const response = await fetch(base + path);
  assert.equal(response.status, status, path);
  const html = await response.text();
  assert.ok(html.includes(expected), `${path}: missing expected state`);
  assert.ok(html.includes('lang="vi"'), `${path}: missing document language`);
  assert.ok(html.includes('id="main-content"'), `${path}: missing main landmark`);
  if (path.includes("category=workwear")) {
    const activeLink = html.match(/<a\b[^>]*aria-current="page"[^>]*>Công sở<\/a>/)?.[0];
    assert.ok(activeLink?.includes("category=workwear"), "Category navigation must reflect the URL");
  }
  if (/category=(tops|bottoms|outerwear)$/.test(path)) {
    assert.ok(!html.includes("Bộ lọc không hợp lệ"));
    assert.match(html, /<a[^>]*aria-current="page"[^>]*>/);
  }
  for (const [, href] of html.matchAll(/href="(\/[^"?#]*)(?:[?#][^"]*)?"/g)) {
    if (!href.startsWith("/_next")) links.add(href);
  }
  if (path === "/") {
    assert.equal((html.match(/id="intelligence"/g) ?? []).length, 1, "One intelligence showcase");
    assert.ok(html.indexOf('id="aurel-title"') < html.indexOf('id="intelligence"'), "Showcase follows hero");
    assert.ok(html.indexOf('id="intelligence"') < html.indexOf('id="collection-title"'), "Showcase precedes collection");
    for (const marker of ["Find what feels like you.", "discovery-query", "AUREL / COLLECTION 001", "Describe your style, outfit, or occasion...", "Oversized neutral pieces"]) {
      assert.ok(!html.includes(marker), `Removed discovery UI still present: ${marker}`);
    }
    assert.match(html, /<a[^>]*href="\/search"[^>]*>Discover your style/);
    // The root footer can arrive before suspended main content in streamed HTML.
    assert.ok(html.includes('<footer'), "Homepage footer is rendered");
    const sections = ['id="collection"', 'id="explore"', 'id="wardrobe"', 'id="aurel-edit"', 'id="journal"'];
    let previous = -1;
    for (const marker of sections) {
      const position = html.indexOf(marker);
      assert.ok(position > previous, `Missing or misordered section ${marker}`);
      previous = position;
    }
    assert.equal((html.match(/data-look="/g) ?? []).length, 10, "All ten look compositions are server rendered");
    assert.equal((html.match(/Styling concept · not available to purchase\./g) ?? []).length, 10, "Demo looks cannot misrepresent a purchase");
    assert.match(html, /name="q"/);
    assert.ok(html.includes('aria-label="Previous look"') && html.includes('aria-label="Next look"'));
    assert.ok(html.includes("IMAGE FORTHCOMING"));
    for (const [, href] of html.matchAll(/href="([^" ]+)"/g)) {
      const decoded = href.replaceAll("&amp;", "&");
      if (decoded.startsWith("/#") || decoded.startsWith("#")) {
        assert.ok(html.includes(`id="${decoded.split("#")[1]}"`), `Missing anchor ${decoded}`);
      } else if (decoded.startsWith("/search?") || decoded.startsWith("/products?")) links.add(decoded);
    }
    for (const marker of ['id="collection"', 'id="aurel-title"', "BEYOND GENDER", 'id="collection-title"', "The New Collection", "EXPLORE ALL PIECES"]) {
      assert.ok(html.includes(marker), `Homepage missing ${marker}`);
    }
  }
  console.log(`PASS ${status} ${path}`);
}
for (const href of links) {
  const response = await fetch(base + href);
  assert.equal(response.status, 200, `Broken internal navigation: ${href}`);
}
console.log(`PASS ${links.size} internal navigation destinations`);
