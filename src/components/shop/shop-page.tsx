import Link from "next/link";
import { shopActor } from "@/features/shop/service";
import { ShopClient } from "./shop-client";
export async function ShopPage({ title, view }: { title: string; view: "cart" | "checkout" | "orders" | "admin" | "profile" | "favorites" }) {
  let error = "";
  try { const user = await shopActor(); if (view === "admin" && user.role !== "ADMIN") error = "Chỉ quản trị viên được truy cập."; }
  catch { error = "Vui lòng đăng nhập. Nếu đã đăng nhập, hãy thử lại khi kết nối dữ liệu sẵn sàng."; }
  return <div className="container page-section"><h1>{title}</h1>{error ? <p role="status">{error} <Link href="/login">Đăng nhập</Link> · <Link href="/products">Tiếp tục mua sắm</Link></p> : <ShopClient view={view}/>}</div>;
}
