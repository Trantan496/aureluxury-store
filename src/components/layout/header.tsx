import Link from "next/link";
import { site } from "@/config/site";
import { AccountControl } from "@/components/auth/account-control";
export function Header() {
  return <><a className="skip-link" href="#main-content">Đến nội dung chính</a><header className="site-header"><div className="header-inner"><Link className="wordmark" href="/" aria-label={`${site.name} — Trang chủ`}>{site.name}</Link><nav aria-label="Điều hướng chính"><Link href="/products">Khám phá</Link><Link href="/#collection">Danh mục</Link></nav><div className="header-actions"><AccountControl/><Link href="/products" aria-label="Tìm kiếm sản phẩm"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></Link><Link href="/cart" aria-label="Giỏ hàng"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l1 13H4L5 8Z M8 8V6a4 4 0 0 1 8 0v2"/></svg><span className="cart-label">Giỏ hàng</span></Link></div></div></header></>;
}
