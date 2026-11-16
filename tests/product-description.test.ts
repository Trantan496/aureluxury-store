import test from "node:test";
import assert from "node:assert/strict";
import { descriptionPrefix as prefix, descriptionBlocks, descriptionInline, descriptionLink, descriptionText } from "../src/features/products/description.ts";
import { validateData } from "../src/features/products/validation.ts";
import { extractFeatures } from "../src/features/products/feature-export.ts";
test("legacy descriptions remain literal, including Markdown and HTML-looking text", () => {
  const value = "Linen **tự nhiên**\n<script>alert(1)</script>";
  assert.deepEqual(descriptionBlocks(value), [{ kind: "paragraph", text: value }]);
  assert.equal(descriptionText(value), value);
});
test("marked descriptions preserve supported formatting, lists/tables and plain ML text", () => {
  const value = prefix + "## Chất liệu\n**Linen** và *lụa*\n- Thoáng\n- Mềm\n1. Giặt tay\n> Bảo quản\n| Cột 1 | Cột 2 |\n| --- | --- |\n| A | B |";
  const blocks = descriptionBlocks(value);
  assert.ok(blocks.some(b => b.kind === "heading2")); assert.ok(blocks.some(b => b.kind === "list" && b.items.length === 2)); assert.ok(blocks.some(b => b.kind === "ordered"));
  assert.ok(blocks.some(b => b.kind === "table" && b.rows[1][1] === "B"));
  assert.deepEqual(descriptionInline("__mềm__ ~~cũ~~").filter(i => i.kind !== "text").map(i => i.kind), ["underline", "strike"]);
  const text = descriptionText(value); assert.ok(text.includes("Linen và lụa")); assert.ok(!text.includes(prefix) && !text.includes("**"));
  assert.equal(extractFeatures({ id: 1, category: { slug: "ao" }, description: value, isActive: false, profile: null, variants: [], images: [] }).features.description, text);
});
test("description links/images cannot bypass URL and existing image-rights filtering", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,x", "//evil.invalid", "/\\evil", "https://x.invalid/\nattack"]) assert.equal(descriptionLink(url), null);
  assert.equal(descriptionLink("/products/ao"), "/products/ao"); assert.equal(descriptionLink("https://example.com"), "https://example.com");
  assert.ok(descriptionInline("[x](javascript:alert(1))").every(i => i.kind !== "link"));
  const image = prefix + "![Linen](/images/linen.jpg)";
  assert.ok(descriptionBlocks(image).every(b => b.kind !== "image"));
  assert.equal(descriptionBlocks(image, ["/images/linen.jpg"])[0].kind, "image");
  assert.ok(descriptionBlocks(prefix + "![x](https://evil.invalid/a.jpg)", ["https://evil.invalid/a.jpg"]).every(b => b.kind !== "image"));
});
test("only description accepts paragraphs; controls and other multiline fields remain rejected", () => {
  const base = { name: "Áo", slug: "ao", categoryId: 1 };
  const description = prefix + "**Linen**\n\nMô tả\n- Thoáng";
  assert.equal(validateData("product", { ...base, description }).description, description);
  assert.throws(() => validateData("product", { ...base, description: "x\0y" }));
  assert.throws(() => validateData("product", { ...base, name: "Áo\nLinen" }));
  assert.throws(() => validateData("product", { ...base, brand: "AUREL\nOther" }));
  assert.throws(() => validateData("product", { ...base, description: "x".repeat(10001) }));
});
