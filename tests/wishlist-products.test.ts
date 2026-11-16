import test from "node:test";
import assert from "node:assert/strict";
import { formatCatalogPrice, toWishlistProduct, pickRecommendations } from "../src/features/wishlist/products.ts";
import type { Product } from "../src/features/catalog/catalog.ts";

test("formatCatalogPrice formats VND and non-VND prices without decimals", () => {
  assert.equal(formatCatalogPrice("890000", "VND"), "890.000 ₫");
  assert.equal(formatCatalogPrice("1990000", "VND"), "1.990.000 ₫");
  assert.equal(formatCatalogPrice("50", "USD"), "50 USD");
});

test("formatCatalogPrice returns null on missing amount or currency", () => {
  assert.equal(formatCatalogPrice(null, "VND"), null);
  assert.equal(formatCatalogPrice("500000", null), null);
  assert.equal(formatCatalogPrice(undefined, undefined), null);
});

test("toWishlistProduct maps valid active product and resolves primary image", () => {
  const product: Product = {
    id: "101",
    slug: "ao-so-mi-lua-dang-suong",
    name: "Áo sơ mi lụa dáng suông",
    price: "890000",
    currency: "VND",
    stock: 12,
    images: [
      { id: "img-1", url: "/images/aurel/shirt.png", alt: "Áo sơ mi", sortOrder: 0, isPrimary: true },
    ],
  };
  const mapped = toWishlistProduct(product);
  assert.ok(mapped);
  assert.equal(mapped.id, "101");
  assert.equal(mapped.slug, "ao-so-mi-lua-dang-suong");
  assert.equal(mapped.name, "Áo sơ mi lụa dáng suông");
  assert.equal(mapped.href, "/products/ao-so-mi-lua-dang-suong");
  assert.equal(mapped.price, "890.000 ₫");
  assert.equal(mapped.imageUrl, "/images/aurel/shirt.png");
  assert.equal(mapped.inStock, true);
});

test("toWishlistProduct rejects product with invalid slug", () => {
  const invalid: Product = {
    id: "102",
    slug: "invalid slug with spaces",
    name: "Invalid",
    price: "100000",
    currency: "VND",
    stock: 5,
  };
  assert.equal(toWishlistProduct(invalid), null);
});

test("pickRecommendations filters out saved, out-of-stock, unpriced items and respects limit", () => {
  const items: Product[] = [
    { id: "1", slug: "item-1", name: "Item 1", price: "100000", currency: "VND", stock: 5 },
    { id: "2", slug: "item-2", name: "Item 2", price: "200000", currency: "VND", stock: 0 }, // out of stock
    { id: "3", slug: "item-3", name: "Item 3", price: null, currency: "VND", stock: 3 }, // unpriced
    { id: "4", slug: "item-4", name: "Item 4", price: "400000", currency: "VND", stock: 2 },
    { id: "5", slug: "item-5", name: "Item 5", price: "500000", currency: "VND", stock: 1 },
    { id: "6", slug: "item-6", name: "Item 6", price: "600000", currency: "VND", stock: 4 },
  ];
  const savedIds = new Set(["1"]); // item 1 is saved
  const picked = pickRecommendations(items, savedIds, 2);
  assert.equal(picked.length, 2);
  assert.equal(picked[0].id, "4");
  assert.equal(picked[1].id, "5");
});

