"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { logout } from "@/features/auth/ui";
import styles from "./auth.module.css";

type AccountPanelProps = {
  onNavigate?: () => void;
  onClose?: () => void;
  compact?: boolean;
  titleId?: string;
};

type AccountIcon = "folder" | "package" | "heart" | "card" | "shield" | "arrow" | "exit" | "check";

function Icon({ name }: { name: AccountIcon }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    {name === "folder" && <><path d="M3 6.8A1.8 1.8 0 0 1 4.8 5h5l1.8 2.2h7.6A1.8 1.8 0 0 1 21 9v9.2a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 18.2Z"/><path d="M3 10h18"/></>}
    {name === "package" && <><path d="m3.5 7.5 8.5-4 8.5 4v9l-8.5 4-8.5-4Z"/><path d="m3.5 7.5 8.5 4 8.5-4M12 11.5v9"/></>}
    {name === "heart" && <path d="M20.7 4.7a5.4 5.4 0 0 0-7.7 0L12 5.8l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 21l8.7-8.6a5.4 5.4 0 0 0 0-7.7Z"/>}
    {name === "card" && <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h3"/></>}
    {name === "shield" && <path d="M12 3 19 6v5c0 4.6-3 7.7-7 10-4-2.3-7-5.4-7-10V6Z"/>}
    {name === "arrow" && <path d="m9 4 7 8-7 8"/>}
    {name === "exit" && <><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/><path d="m14 8 4 4-4 4M18 12H9"/></>}
    {name === "check" && <path d="m7 12 3 3 7-7"/>}
  </svg>;
}

function BrandHeader({ titleId, onClose }: { titleId?: string; onClose?: () => void }) {
  return <header className={styles.accountHeader}>
    <div className={styles.accountBrand} aria-label="AUREL">AUREL <span aria-hidden="true"/></div>
    {onClose && <button type="button" className={styles.accountClose} autoFocus aria-label="Đóng thông tin tài khoản" onClick={onClose}>×</button>}
    <h2 id={titleId}>Tài khoản</h2>
    <p>Bạn đang đăng nhập vào AUREL.</p>
  </header>;
}

function AccountLink({ href, title, icon, onNavigate, verified }: { href: string; title: string; icon: AccountIcon; onNavigate?: () => void; verified?: boolean }) {
  return <Link href={href} className={styles.accountLink} onClick={onNavigate}>
    <span className={styles.accountIcon}><Icon name={icon}/></span>
    <span className={styles.accountLinkCopy}><strong>{title}{verified && <span className={styles.verified} aria-label="Đã xác minh"><Icon name="check"/></span>}</strong></span>
    <span className={styles.accountChevron}><Icon name="arrow"/></span>
  </Link>;
}

function CompactLink({ href, children, onNavigate }: { href: string; children: React.ReactNode; onNavigate?: () => void }) {
  return <Link href={href} className={styles.compactLink} onClick={onNavigate}>{children}</Link>;
}

export function AccountPanel({ onNavigate, onClose, compact = false, titleId }: AccountPanelProps) {
  const { data: session, isPending, error } = authClient.useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState("");
  const [accountAccess, setAccountAccess] = useState({ sessionId: "", isAdmin: false });
  const sessionId = session ? String(session.user.id) : "";

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    void fetch("/api/shop?view=account", { cache: "no-store" })
      .then(async response => {
        const payload = await response.json() as { data?: { isAdmin?: unknown } };
        if (!response.ok || typeof payload.data?.isAdmin !== "boolean") throw new Error("Account access unavailable");
        return payload.data.isAdmin;
      })
      .then(allowed => { if (active) setAccountAccess({ sessionId, isAdmin: allowed }); })
      .catch(() => { if (active) setAccountAccess({ sessionId, isAdmin: false }); });
    return () => { active = false; };
  }, [sessionId]);

  const isAdmin = accountAccess.sessionId === sessionId && accountAccess.isAdmin;

  async function signOut() {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    const result = await logout(authClient); setMessage(result.message);
    if (result.ok) { onNavigate?.(); router.refresh(); }
    setBusy(false); lock.current = false;
  }

  if (compact) return <div className={`${styles.account} ${styles.accountCompact}`}>
    {isPending ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> : error ? <><p role="status">Chưa thể kiểm tra trạng thái tài khoản.</p><CompactLink href="/login" onNavigate={onNavigate}>Đến trang đăng nhập</CompactLink></> : session ? <>
      <p>Bạn đang đăng nhập vào AUREL.</p>
      <CompactLink href="/account" onNavigate={onNavigate}>Hồ sơ và địa chỉ</CompactLink>
      <CompactLink href="/account/orders" onNavigate={onNavigate}>Đơn hàng của tôi</CompactLink>
      <CompactLink href="/favorites" onNavigate={onNavigate}>Sản phẩm yêu thích</CompactLink>
      {isAdmin && <CompactLink href="/admin/orders" onNavigate={onNavigate}>Quản trị đơn hàng</CompactLink>}
      <CompactLink href="/verify-email" onNavigate={onNavigate}>{session.user.emailVerified ? "Email đã được xác minh" : "Xác minh địa chỉ email"}</CompactLink>
      <button className={styles.compactLogout} type="button" disabled={busy} onClick={signOut}>{busy ? "Đang đăng xuất…" : "Đăng xuất"}</button>
    </> : <><p>Không gian AUREL của riêng bạn.</p><CompactLink href="/login" onNavigate={onNavigate}>Đăng nhập</CompactLink><CompactLink href="/register" onNavigate={onNavigate}>Tạo tài khoản</CompactLink></>}
    {message && <p role="status">{message}</p>}
  </div>;

  return <section className={styles.accountModal}>
    <div className={styles.accountContent}>
      <BrandHeader titleId={titleId} onClose={onClose}/>
      {isPending ? <p className={styles.accountStatus} role="status">Đang kiểm tra phiên đăng nhập…</p> : error ? <div className={styles.accountStatus} role="status">Chưa thể kiểm tra trạng thái tài khoản. <Link href="/login" onClick={onNavigate}>Đến trang đăng nhập</Link></div> : session ? <>
        <nav className={styles.accountLinks} aria-label="Tùy chọn tài khoản">
          <AccountLink href="/account" title="Hồ sơ và địa chỉ" icon="folder" onNavigate={onNavigate}/>
          <AccountLink href="/account/orders" title="Đơn hàng của tôi" icon="package" onNavigate={onNavigate}/>
          <AccountLink href="/favorites" title="Sản phẩm yêu thích" icon="heart" onNavigate={onNavigate}/>
          {isAdmin && <AccountLink href="/admin/orders" title="Quản trị đơn hàng" icon="card" onNavigate={onNavigate}/>} 
          <AccountLink href="/verify-email" title={session.user.emailVerified ? "Email đã được xác minh" : "Email chưa được xác minh"} icon="shield" verified={session.user.emailVerified} onNavigate={onNavigate}/>
        </nav>
        <button className={styles.accountLogout} type="button" disabled={busy} onClick={signOut}><Icon name="exit"/>{busy ? "Đang đăng xuất…" : "Đăng xuất"}</button>
      </> : <div className={styles.accountStatus}><p>Không gian AUREL của riêng bạn.</p><div className={styles.accountGuestLinks}><Link href="/login" onClick={onNavigate}>Đăng nhập</Link><Link href="/register" onClick={onNavigate}>Tạo tài khoản</Link></div></div>}
      {message && <p className={styles.accountStatus} role="status">{message}</p>}
    </div>
    <aside className={styles.accountVisual} aria-hidden="true"><Image src="/images/aurel/account-editorial-still-life.png" alt="" fill sizes="(min-width: 1024px) 32vw, 0px"/></aside>
  </section>;
}

export function AccountControl() {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className={styles.trigger} aria-label="Tài khoản AUREL" aria-haspopup="dialog" aria-controls="store-account" onClick={() => dialog.current?.showModal()}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="12" cy="7" r="4"/><path d="M3 22v-2a9 9 0 0 1 18 0v2"/></svg>
    </button>
    <dialog ref={dialog} id="store-account" className={styles.dialog} aria-labelledby="store-account-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <AccountPanel titleId="store-account-title" onClose={() => dialog.current?.close()} onNavigate={() => dialog.current?.close()}/>
    </dialog>
  </>;
}
