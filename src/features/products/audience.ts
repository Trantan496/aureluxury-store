import { InputError } from "./validation.ts";
import { productSlug } from "./product-code.ts";
// Merchandising labels chosen by the operator; no inferred birth-year/age boundaries.
export const ageGroups = [
  { token: "gen-alpha", label: "Gen Alpha" }, { token: "gen-z", label: "Gen Z" },
  { token: "gen-y", label: "Gen Y" }, { token: "gen-x", label: "Gen X" },
  { token: "middle-aged", label: "Trung niên" }, { token: "older-adults", label: "Cao tuổi" },
  { token: "children", label: "Trẻ em" }, { token: "teenagers", label: "Thanh thiếu niên" },
  { token: "all-ages", label: "Mọi độ tuổi" },
] as const;
export function audienceGroup(input: unknown): string | null {
  if (input === undefined || input === null || input === "") return null;
  if (typeof input !== "string" || !ageGroups.some(g => g.token === input)) throw new InputError("ageGroup");
  return input;
}
export function audienceSlug(name: string, gender?: string | null, ageGroup?: string | null) {
  const genderLabel = ({ men: "nam", women: "nu", unisex: "unisex" } as Record<string, string>)[gender ?? ""];
  const ageLabel = ageGroups.find(g => g.token === ageGroup)?.label;
  return productSlug([name, genderLabel, ageLabel].filter(Boolean).join(" "));
}
