import Link from "next/link";
import { AccountShell } from "@/components/account/account-shell";
import { WishlistView } from "@/components/wishlist/wishlist-view";
import { shopActor } from "@/features/shop/service";
import { loadWishlist, type WishlistData } from "@/features/wishlist/service";
import styles from "@/components/wishlist/wishlist.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sản phẩm yêu thích" };

type State = { kind: "ready"; data: WishlistData } | { kind: "error" };

async function resolve(): Promise<State> {
  try {
    const actor = await shopActor().catch(() => null);
    return { kind: "ready", data: await loadWishlist(actor?.id) };
  } catch {
    return { kind: "error" };
  }
}

export default async function FavoritesPage() {
  const state = await resolve();
  return <AccountShell title="Sản phẩm yêu thích" current="Sản phẩm yêu thích">
    {state.kind === "ready" && (
      <WishlistView
        initialFavorites={state.data.favorites}
        recommendations={state.data.recommendations}
        isAuthenticated={state.data.isAuthenticated}
      />
    )}
    {state.kind === "error" && (
      <section className={styles.empty} role="alert">
        <h2>Chưa thể tải danh sách yêu thích</h2>
        <p>Dữ liệu hiện chưa sẵn sàng. Vui lòng thử lại sau; bạn vẫn có thể tiếp tục mua sắm.</p>
        <Link href="/products" className={styles.cta}>Tiếp tục mua sắm</Link>
      </section>
    )}
  </AccountShell>;
}
