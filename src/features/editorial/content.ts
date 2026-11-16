export type EditorialProduct = { id: string; name: string; image: string | null; href: string };
export type AurelLook = {
  id: string;
  number: number;
  title: string;
  description: string;
  image: string | null;
  imageAlt: string;
  products: readonly EditorialProduct[];
  href: string;
  demo: boolean;
};

// Editorial styling concepts, never inventory. Replace null images with local
// campaign paths when approved assets arrive; no layout changes are needed.
const knit: EditorialProduct = { id: "knit", name: "Soft knit", image: "/images/aurel/collection-demo/knit.png", href: "/products?q=Knitwear" };
const trousers: EditorialProduct = { id: "trousers", name: "Relaxed trousers", image: "/images/aurel/collection-demo/trousers.png", href: "/products?q=Wide-Leg%20Trousers" };
const coat: EditorialProduct = { id: "coat", name: "Tailored coat", image: "/images/aurel/collection-demo/coat.png", href: "/products?q=Tailored%20Coats" };
const bag: EditorialProduct = { id: "bag", name: "Everyday tote", image: "/images/aurel/collection-demo/bag.png", href: "/products?q=Tote" };

export const aurelLooks: readonly AurelLook[] = [
  { id: "modern-minimalist", number: 1, title: "MODERN MINIMALIST", description: "Clean lines. Elevated neutrals. Effortless everyday refinement.", image: "/images/aurel/aurel-edit-modern-minimalist.png", imageAlt: "Modern Minimalist editorial campaign — seated woman in ivory knitwear and taupe trousers", products: [knit, trousers], href: "/products", demo: true },
  { id: "modern-gentleman", number: 2, title: "MODERN GENTLEMAN", description: "Timeless layers. Refined neutrals. Effortless confidence for everyday dressing.", image: "/images/aurel/aurel-edit-modern-gentleman.png", imageAlt: "Modern Gentleman editorial campaign — seated man in brown knitwear and light trousers", products: [coat, trousers], href: "/products", demo: true },
  { id: "jet-set-refined", number: 3, title: "JET SET REFINED", description: "Elevated travel. Timeless tailoring. Effortless confidence beyond the ordinary.", image: "/images/aurel/aurel-edit-jet-set-refined.png", imageAlt: "Jet Set Refined editorial campaign — man in brown tailored coat in front of a private jet", products: [knit, coat], href: "/products", demo: true },
  { id: "city-escape", number: 4, title: "CITY ESCAPE", description: "Effortless city polish. Soft tailoring. A confident point of view.", image: "/images/aurel/aurel-edit-city-escape.png", imageAlt: "City Escape editorial campaign — woman in ivory tailoring in front of the Petronas Towers", products: [trousers, bag], href: "/products", demo: true },
  { id: "workday-ritual", number: 5, title: "WORKDAY RITUAL", description: "Considered essentials. Quiet focus. An effortless expression of purpose.", image: "/images/aurel/aurel-edit-workday-ritual.png", imageAlt: "Workday Ritual editorial campaign — woman in a cream shirt working at a desk", products: [knit, bag], href: "/products", demo: true },
  { id: "aurel", number: 6, title: "AUREL", description: "Considered pieces. Enduring personal expression. For every version of you.", image: "/images/aurel/aurel-brand-closing.png", imageAlt: "AUREL brand closing campaign — man and woman in refined neutral tailoring", products: [coat, bag], href: "/products", demo: true },
];

export const wardrobeCategories = [
  { id: "tops", title: "TOPS", description: "Refined essentials for everyday expression.", image: knit.image, alt: "Soft oatmeal knit — design preview" },
  { id: "bottoms", title: "BOTTOMS", description: "Modern silhouettes built for movement.", image: trousers.image, alt: "Relaxed neutral trousers — design preview" },
  { id: "outerwear", title: "OUTERWEAR", description: "Iconic layers for a changing world.", image: coat.image, alt: "Tailored camel coat — design preview" },
] as const;

