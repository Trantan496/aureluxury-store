import { AccountShell } from "@/components/account/account-shell";
import { CartView } from "@/components/shop/cart-view";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Giỏ hàng | AUREL",
};

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ preview?: string }>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const isPreview = resolved?.preview === "1";
  return (
    <AccountShell title="Giỏ hàng của bạn" current="Giỏ hàng">
      <CartView initialPreview={isPreview} embedded />
    </AccountShell>
  );
}
