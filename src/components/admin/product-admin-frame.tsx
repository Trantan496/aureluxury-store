"use client";
import { usePathname } from "next/navigation";
import { ProductSidebar } from "./product-sidebar";
import type { ComponentProps, ReactNode } from "react";
import styles from "./products.module.css";
export function ProductAdminFrame({ children, navigation }: { children:ReactNode; navigation:ComponentProps<typeof ProductSidebar> }) {
  const preview = /^\/admin\/products\/\d+\/preview$/.test(usePathname());
  if (preview) return <section className={styles.showroomFrame} aria-label="Product Showroom">{children}</section>;
  return <section className={styles.shell} aria-label="Quản lý sản phẩm"><div className={styles.workspace}><ProductSidebar {...navigation}/><div className={styles.panel}>{children}</div></div></section>;
}
