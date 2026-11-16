import type { CatalogResult } from "../catalog/catalog";
import { productDetailHref } from "../catalog/product-detail.ts";
import { formatAurelProductName } from "../products/product-name.ts";

export type CollectionPiece = {
  id: string;
  name: string;
  category: "clothing" | "accessories" | null;
  demoPrice: string | null;
  image: string | null;
  colors?: readonly string[];
  description?: string;
  price?: string | null;
  imageAlt?: string | null;
  href?: string | null;
};

// Design fixtures only: never returned by the production catalog reader.
export const demoPieces: readonly CollectionPiece[] = [
  { id: "preview-coat", name: "AUREL - TAILORED COAT", category: "clothing", demoPrice: "€280", image: "/images/aurel/collection-demo/coat.png", colors: ["camel", "neutral"], description: "Minimalist everyday wool coat with a tailored silhouette." },
  { id: "preview-knit", name: "AUREL - SOFT KNIT", category: "clothing", demoPrice: "€120", image: "/images/aurel/collection-demo/knit.png", colors: ["oatmeal", "neutral"], description: "Oversized crewneck sweater for minimalist everyday layering." },
  { id: "preview-trousers", name: "AUREL - RELAXED TROUSER", category: "clothing", demoPrice: "€160", image: "/images/aurel/collection-demo/trousers.png", colors: ["taupe", "neutral"], description: "Minimalist everyday wide-leg trousers with a relaxed silhouette." },
  { id: "preview-bag", name: "AUREL - EVERYDAY TOTE", category: "accessories", demoPrice: "€220", image: "/images/aurel/collection-demo/bag.png", colors: ["espresso", "brown"], description: "Leather tote bag with two handles for everyday use." },
];

export function getCollectionPreview(result: CatalogResult) {
  if (result.status === "error") return { status: "error" as const, demo: false, pieces: [] };
  if (!result.products.length) return { status: "success" as const, demo: false, pieces: [] };
  return {
    status: "success" as const, demo: false,
    pieces: result.products.slice(0, 8).map(product => ({
      id: product.id, name: formatAurelProductName(product.name),
      ...(productDetailHref(product.slug) ? { href: productDetailHref(product.slug) } : {}),
      category: product.category?.slug === "accessories" ? "accessories" as const :
        ["tops", "bottoms", "outerwear", "clothing"].includes(product.category?.slug ?? "") ? "clothing" as const : null,
      demoPrice: null, price: product.price ?? null,
      image: product.images?.find(image => image.url)?.url ?? null,
      imageAlt: product.images?.find(image => image.url)?.alt ?? null,
      colors: product.colors, description: product.description ?? undefined,
    } satisfies CollectionPiece)),
  };
}
