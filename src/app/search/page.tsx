import { redirect } from "next/navigation";
export const metadata = { title: "Sản phẩm" };
export default async function Search({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value)) for (const item of value) params.append(key, item);
  }
  redirect(`/products${params.size ? `?${params}` : ""}`);
}
