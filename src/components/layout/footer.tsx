"use client";

import { usePathname } from "next/navigation";
import { EditorialFooter } from "./editorial-footer";
export function Footer() {
  const pathname = usePathname();
  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/messages" ||
    pathname.startsWith("/messages/")
  ) {
    return null;
  }
  return <EditorialFooter/>;
}
