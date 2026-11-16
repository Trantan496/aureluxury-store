import assert from "node:assert/strict";
import test from "node:test";
import { attributesFor, dynamicAttributes, productTypeAttributes, visibleAttributes } from "../src/features/products/dynamic-attributes.ts";

test("configuration covers the eleven supported clothing types", () => {
  assert.deepEqual(Object.keys(productTypeAttributes), ["t-shirt", "shirt", "polo", "trousers", "jeans", "shorts", "skirt", "dress", "jacket", "coat", "knitwear"]);
  for (const type of Object.keys(productTypeAttributes)) assert.ok(attributesFor(type).length >= 6);
});
test("jeans only exposes its controlled jeans attributes", () => assert.deepEqual(attributesFor("jeans").map(attribute => attribute.key), ["pant_leg_style", "waist_rise", "denim_wash", "surface_treatment", "stretch", "hem_style"]));
test("print placement is shown only for a printed t-shirt", () => {
  assert.equal(visibleAttributes("t-shirt", { print_type: "Không in" }).some(attribute => attribute.key === "print_placement"), false);
  assert.equal(visibleAttributes("t-shirt", { print_type: "Graphic" }).some(attribute => attribute.key === "print_placement"), true);
});
test("valid dynamic values are retained in a deterministic structure", () => assert.deepEqual(dynamicAttributes({ pant_leg_style: "Wide", waist_rise: "High-rise", denim_wash: "Light Wash" }, "jeans"), { pant_leg_style: "Wide", waist_rise: "High-rise", denim_wash: "Light Wash" }));
test("invalid values and attributes outside the selected type are rejected", () => {
  assert.throws(() => dynamicAttributes({ neckline: "Cổ Cuba" }, "jeans"));
  assert.throws(() => dynamicAttributes({ pant_leg_style: "Cổ Cuba" }, "jeans"));
});
