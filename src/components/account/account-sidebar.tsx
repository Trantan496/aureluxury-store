"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartIcon, PackageIcon, ShoppingBagIcon, ShoppingCartIcon, UserRoundIcon } from "./account-icons";
import styles from "./account.module.css";

const items = [
  { href: "/products", label: "Mua sắm", Icon: ShoppingBagIcon },
  { href: "/cart", label: "Giỏ hàng", Icon: ShoppingCartIcon },
  { href: "/account/orders", label: "Đơn của tôi", Icon: PackageIcon },
  { href: "/account", label: "Hồ sơ", Icon: UserRoundIcon },
  { href: "/favorites", label: "Yêu thích", Icon: HeartIcon },
] as const;

// "/account" must stay exact so that "/account/orders" does not also highlight "Hồ sơ".
const isActive = (pathname: string, href: string) => pathname === href || (href !== "/account" && pathname.startsWith(`${href}/`));

export function AccountSidebar() {
  const pathname = usePathname();
  return <nav className={styles.sidebar} aria-label="Tài khoản của tôi">
    <p className={styles.sidebarTitle}>Tài khoản của tôi</p>
    <ul>
      {items.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return <li key={href}><Link href={href} className={styles.navLink} aria-current={active ? "page" : undefined}><Icon className={styles.navIcon}/>{label}</Link></li>;
      })}
    </ul>
  </nav>;
}

