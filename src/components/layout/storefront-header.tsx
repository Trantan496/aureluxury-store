"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./homepage-header.module.css";
import { AccountPanel } from "@/components/auth/account-control";
import authStyles from "@/components/auth/auth.module.css";
import loginStyles from "@/components/auth/login.module.css";
import { ArrowLeftIcon } from "@/components/auth/login-icons";
import { AdminHeader } from "@/components/admin/admin-header";
import { useOptionalChat } from "@/components/chat/chat-context";

const heroNavigation = [
  ["New In", "/#collection"], ["Shop", "/products?page=1"],
  ["The Edit", "/#aurel-edit"],
] as const;
const navigation = [
  ["Women", "/products?gender=women"], ["Men", "/products?gender=men"],
  ["Accessories", "/products?category=accessories"],
  ["Collections", "/#collection"],
  ["AI Recommendations", "/#intelligence"],
] as const;

function Icon({ name }: { name: "menu" | "search" | "account" | "bag" | "heart" | "chat" }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    {name === "menu" && <path d="M3 5h18M3 12h13M3 19h18"/>}
    {name === "search" && <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>}
    {name === "account" && <><circle cx="12" cy="7" r="4"/><path d="M3 22v-2a9 9 0 0 1 18 0v2"/></>}
    {name === "heart" && <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>}
    {name === "bag" && <path d="M4 8h16v13H4zM8 8V6a4 4 0 0 1 8 0v2"/>}
    {name === "chat" && <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.38-4.3-1.08L3 20l1.15-4.35A8.5 8.5 0 1 1 21 11.5Z"/>}
  </svg>;
}

export function StorefrontHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const chat = useOptionalChat();
  const menu = useRef<HTMLDialogElement>(null);
  const account = useRef<HTMLDialogElement>(null);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    if (pathname !== "/") return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const collection = document.getElementById("collection");
      if (!header.current || !collection) return;
      const mode = collection.getBoundingClientRect().top <= 72
        ? "sticky" : window.scrollY < 80 ? "hero" : "hidden";
      header.current.dataset.mode = mode;
      if (menu.current) menu.current.dataset.mode = mode;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    // Streamed content and its stylesheet can settle after the first effect.
    const layoutObserver = new ResizeObserver(schedule);
    const main = document.getElementById("main-content");
    if (main) layoutObserver.observe(main);
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      layoutObserver.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [pathname]);
  if (pathname === "/login" || pathname === "/register") return <>
    <a className="skip-link" href="#main-content">Dẫn đến nội dung chính</a>
    <header className={loginStyles.header}><Link href="/" className={loginStyles.brand} aria-label="AUREL - Trang chủ">AUREL</Link><nav className={loginStyles.nav} aria-label="Điều hướng đăng nhập"><Link href="/" className={loginStyles.back}><ArrowLeftIcon aria-hidden="true"/><span>Trở về</span></Link><Link href="/" className={loginStyles.home}>AUREL</Link></nav></header>
  </>;
  if (["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"].includes(pathname)) return <>
    <a className="skip-link" href="#main-content">Đến nội dung chính</a>
    <header className={authStyles.navigation}><Link href="/" className={authStyles.brand} aria-label="AUREL — Trang chủ">AUREL</Link><Link href="/" className={authStyles.back}>← <span>Trở về</span> AUREL</Link></header>
  </>;
  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && !/^\/admin\/products\/\d+\/preview$/.test(pathname)) return <AdminHeader/>;

  return <>
    <a className="skip-link" href="#main-content">Đến nội dung chính</a>
    <header ref={header} className={styles.header} lang="en" data-mode={pathname === "/" ? "hero" : "page"}>
      <button className={styles.iconButton} aria-label="Open navigation menu" aria-haspopup="dialog" aria-controls="aurel-menu" onClick={() => menu.current?.showModal()}><Icon name="menu"/></button>
      <Link href="/" className={styles.mobileBrand} aria-label="AUREL home">AUREL</Link>
      <nav className={styles.heroNavigation} aria-label="Homepage navigation">{heroNavigation.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}</nav>
      <nav className={styles.navigation} aria-label="Main navigation">
        {navigation.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}
      </nav>
      <div className={styles.actions}>
        <Link href="/products" className={styles.heroSearch} aria-label="Search products"><span>Search</span><Icon name="search"/></Link>
        <form action="/products" method="get" role="search" className={styles.search}><button type="submit" aria-label="Search products"><Icon name="search"/></button><input name="q" type="search" aria-label="Search products, styles, or ideas" placeholder="Search for products, styles, or ideas…" maxLength={100}/></form>
        <button className={`${styles.iconButton} ${styles.account}`} aria-label="Account information" aria-haspopup="dialog" aria-controls="aurel-account" onClick={() => account.current?.showModal()}><Icon name="account"/></button>
        <button type="button" className={styles.iconButton} aria-label="Nhắn tin với shop" title="Nhắn tin với AUREL (Click 2 lần để mở hộp thoại bên phải)" onClick={() => { if (chat) chat.handleIconClick(); else router.push("/messages"); }} onDoubleClick={() => { chat?.handleIconDoubleClick(); }}><Icon name="chat"/></button>
        <Link href="/favorites" className={`${styles.iconButton} ${styles.favorites}`} aria-label="Danh sách yêu thích" title="Danh sách yêu thích"><Icon name="heart"/></Link>
        <Link href="/cart" className={styles.iconButton} aria-label="Shopping bag"><Icon name="bag"/></Link>
      </div>
    </header>
    <dialog ref={menu} id="aurel-menu" data-motion="sheet" data-mode={pathname === "/" ? "hero" : "page"} className={styles.menu} aria-labelledby="aurel-menu-title" onClick={event => { if (event.target === event.currentTarget) menu.current?.close(); }}>
      <div className={styles.dialogContent}>
        <div className={styles.dialogHeading}><h2 id="aurel-menu-title">AUREL</h2><button autoFocus onClick={() => menu.current?.close()} aria-label="Close navigation menu">×</button></div>
        <nav className={styles.heroMenuNavigation} aria-label="Expanded homepage navigation" onClick={event => { if ((event.target as HTMLElement).closest("a")) menu.current?.close(); }}>{heroNavigation.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}<Link href="/products">Search</Link><Link href="/messages">Nhắn tin với Shop</Link><Link href="/cart">Shopping bag</Link></nav>
        <nav className={styles.storeMenuNavigation} aria-label="Expanded navigation" onClick={event => { if ((event.target as HTMLElement).closest("a")) menu.current?.close(); }}>
          {navigation.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}
          <Link href="/products">Search</Link><Link href="/messages">Nhắn tin với Shop</Link><Link href="/cart">Shopping bag</Link>
        </nav>
        <section className={authStyles.menuAccount} aria-label="Tài khoản"><AccountPanel compact onNavigate={() => menu.current?.close()}/></section>
      </div>
    </dialog>
    <dialog ref={account} id="aurel-account" className={styles.accountDialog} aria-labelledby="aurel-account-title" onClick={event => { if (event.target === event.currentTarget) account.current?.close(); }}>
      <AccountPanel titleId="aurel-account-title" onClose={() => account.current?.close()} onNavigate={() => account.current?.close()}/>
    </dialog>
  </>;
}
