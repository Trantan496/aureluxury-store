import { CheckoutView } from "@/components/shop/checkout-view";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Thanh toán | AUREL",
};

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ preview?: string }>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const isPreview = resolved?.preview === "1";
  return <CheckoutView initialPreview={isPreview} />;
}
