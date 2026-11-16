export type ProductServicePolicy = { text: string; href?: string };
export type ProductServicePolicies = Readonly<Record<"shipping" | "returns" | "payment", ProductServicePolicy | null>>;

// Configure only verified store policies and real destinations; null makes no promise.
export const productServicePolicies: ProductServicePolicies = {
  shipping: null,
  returns: null,
  payment: null,
};
