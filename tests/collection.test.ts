import assert from "node:assert/strict";
import test from "node:test";
import { demoPieces, getCollectionPreview } from "../src/features/collection/preview.ts";
import { matchesCollectionQuery } from "../src/features/collection/search.ts";

test("empty catalog stays empty without design fixtures", () => {
  const result = getCollectionPreview({ status: "success", products: [] });
  assert.equal(result.demo, false);
  assert.deepEqual(result.pieces, []);
});

test("reader errors are never concealed with demo inventory", () => {
  assert.deepEqual(getCollectionPreview({ status: "error" }), { status: "error", demo: false, pieces: [] });
});

test("real records take precedence and never receive fabricated prices or images", () => {
  const result = getCollectionPreview({ status: "success", products: [{ id: "real-1", name: "Actual product" }] });
  assert.equal(result.demo, false);
  assert.deepEqual(result.pieces, [{ id: "real-1", name: "Actual product", category: null, demoPrice: null, price: null, image: null, imageAlt: null, colors: undefined, description: undefined }]);
});

test("demo discovery searches names, categories, colors and descriptions", () => {
  const find = (query: string) => demoPieces.filter(piece => matchesCollectionQuery(piece, query)).map(piece => piece.id);
  assert.deepEqual(find("coat"), ["preview-coat"]);
  assert.deepEqual(find("ACCESSORIES"), ["preview-bag"]);
  assert.deepEqual(find("taupe"), ["preview-trousers"]);
  assert.deepEqual(find("oversized neutral pieces"), ["preview-knit"]);
  assert.deepEqual(find("What goes with wide-leg trousers?"), ["preview-trousers"]);
  assert.equal(find("Minimalist everyday outfits").length, 3);
});

test("empty demo query preserves grid, unknown and punctuation-only queries do not fabricate matches", () => {
  assert.equal(demoPieces.filter(piece => matchesCollectionQuery(piece, "  ")).length, 4);
  for (const query of ["purple boots", "?!", "what goes with"]) {
    assert.equal(demoPieces.filter(piece => matchesCollectionQuery(piece, query)).length, 0);
  }
  assert.equal(matchesCollectionQuery({ id: "real", name: "Actual name", category: null, demoPrice: null, image: null }, "name"), true);
});

test("demo discovery combines with category without changing fixtures", () => {
  const result = demoPieces.filter(piece => piece.category === "accessories" && matchesCollectionQuery(piece, "coat"));
  assert.equal(result.length, 0);
  assert.equal(demoPieces.length, 4);
});
