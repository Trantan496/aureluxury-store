import { normalizedWords } from "./product-code.ts";

export type ClothingIcon =
  | "shirt"
  | "polo"
  | "jacket"
  | "vest"
  | "tank"
  | "knit"
  | "hoodie"
  | "trousers"
  | "shorts"
  | "skirt"
  | "dress"
  | "underwear"
  | "accessories";

export const clothingCategories: readonly {
  slug: string;
  name: string;
  icon: ClothingIcon;
  genders: readonly string[];
}[] = [
  { slug: "tops", name: "Áo", icon: "shirt", genders: ["men", "women"] },
  { slug: "outerwear", name: "Áo Khoác", icon: "jacket", genders: ["men", "women"] },
  { slug: "bottoms", name: "Quần", icon: "trousers", genders: ["men", "women"] },
  { slug: "dam", name: "Đầm", icon: "dress", genders: ["women"] },
  { slug: "chan-vay", name: "Chân Váy", icon: "skirt", genders: ["women"] },
  { slug: "accessories", name: "Phụ Kiện", icon: "accessories", genders: ["men", "women"] },
];

export function categoriesForGender(gender: string | null) {
  return clothingCategories.filter(
    c => (gender !== "men" && gender !== "women") || c.genders.includes(gender),
  );
}

export function matchingCategory<T extends { slug: string; name: string }>(
  rows: readonly T[],
  preset: { slug: string; name: string },
) {
  return (
    rows.find(c => c.slug === preset.slug) ??
    rows.find(c => normalizedWords(c.name) === normalizedWords(preset.name))
  );
}

export function collectionLabel(slug: string) {
  return slug.replace(/-/g, " ");
}
