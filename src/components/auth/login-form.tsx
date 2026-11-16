"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { safeReturnTo, submitAuth } from "@/features/auth/ui";
import { AppleIcon, ArrowRightIcon, EyeIcon, EyeOffIcon, FacebookIcon, GoogleIcon, LockIcon, MailIcon } from "./login-icons";
import styles from "./login.module.css";

// Better Auth is configured for email/password only (see features/auth/config.ts), so social providers stay visibly disabled.
const socialProviders = [
  { name: "Apple", Icon: AppleIcon }, { name: "Google", Icon: GoogleIcon }, { name: "Facebook", Icon: FacebookIcon },
] as const;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const locked = useRef(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const next = safeReturnTo(params.get("next"));

  useEffect(() => { if (session) { router.replace(next); router.refresh(); } }, [session, router, next]);
  useEffect(() => { if (status) statusRef.current?.focus(); }, [status]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true; setBusy(true); setStatus(null);
    const data = new FormData(event.currentTarget);
    const result = await submitAuth("login", {
      email: String(data.get("email") ?? ""), password: String(data.get("password") ?? ""), remember: data.get("remember") === "on",
    }, authClient, window.location.origin);
    setStatus(result);
    if (result.ok) { router.replace(next); router.refresh(); }
    setBusy(false); locked.current = false;
  }

  return <>
    {params.get("reset") === "success" && <p className={styles.notice} role="status">Mật khẩu đã được cập nhật. Các phiên đăng nhập cũ đã được thu hồi. Hãy đăng nhập lại.</p>}
    {status && <div ref={statusRef} tabIndex={-1} role={status.ok ? "status" : "alert"} className={status.ok ? styles.notice : styles.error}>{status.message}</div>}
    <form className={styles.form} onSubmit={onSubmit} aria-busy={busy}>
      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <div className={styles.control}>
          <MailIcon className={styles.leading}/>
          <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="Nhập email của bạn"/>
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="password">Mật khẩu</label>
        <div className={styles.control}>
          <LockIcon className={styles.leading}/>
          <input id="password" name="password" type={visible ? "text" : "password"} required maxLength={128} autoComplete="current-password" placeholder="Nhập mật khẩu"/>
          <button className={styles.reveal} type="button" aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={visible} aria-controls="password" onClick={() => setVisible(!visible)}>
            {visible ? <EyeOffIcon/> : <EyeIcon/>}
          </button>
        </div>
      </div>
      <div className={styles.options}>
        <label className={styles.check}><input type="checkbox" name="remember" defaultChecked/><span className={styles.box} aria-hidden="true"/>Ghi nhớ đăng nhập</label>
        <Link href="/forgot-password">Quên mật khẩu?</Link>
      </div>
      <button className={styles.submit} type="submit" disabled={busy || sessionPending}>
        {busy ? <><span className={styles.spinner} data-motion-activity="spin" aria-hidden="true"/>Đang xử lý…</> : <>Đăng nhập<ArrowRightIcon/></>}
      </button>
    </form>
    <div className={styles.divider}><span>Hoặc đăng nhập với</span></div>
    <div className={styles.social} role="group" aria-label="Đăng nhập bằng tài khoản khác">
      {socialProviders.map(({ name, Icon }) => <button key={name} type="button" disabled aria-label={`${name} (chưa khả dụng)`} title={`Đăng nhập với ${name} chưa được cấu hình`}><Icon/></button>)}
    </div>
    <p className={styles.signup}>Chưa có tài khoản?<Link href="/register">Tạo tài khoản</Link></p>
  </>;
}

