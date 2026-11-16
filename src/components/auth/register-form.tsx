"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { safeReturnTo, submitAuth } from "@/features/auth/ui";
import { ArrowRightIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon, UserIcon } from "./login-icons";
import styles from "./login.module.css";

function PasswordField({ name, label, placeholder, describedBy }: { name: string; label: string; placeholder: string; describedBy?: string }) {
  const [visible, setVisible] = useState(false);
  return <div className={styles.field}>
    <label htmlFor={name}>{label}</label>
    <div className={styles.control}>
      <LockIcon className={styles.leading}/>
      <input id={name} name={name} type={visible ? "text" : "password"} required minLength={12} maxLength={128} autoComplete="new-password" placeholder={placeholder} aria-describedby={describedBy}/>
      <button className={styles.reveal} type="button" aria-label={`${visible ? "Ẩn" : "Hiện"} ${label.toLowerCase()}`} aria-pressed={visible} aria-controls={name} onClick={() => setVisible(!visible)}>
        {visible ? <EyeOffIcon/> : <EyeIcon/>}
      </button>
    </div>
  </div>;
}

export function RegisterForm({ onCreated }: { onCreated: (email: string) => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [busy, setBusy] = useState(false);
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
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await submitAuth("register", {
      email: String(data.get("email") ?? ""), name: String(data.get("name") ?? ""), password: String(data.get("password") ?? ""), confirm: String(data.get("confirm") ?? ""),
    }, authClient, window.location.origin);
    if (result.ok) {
      form.reset();
      onCreated(String(data.get("email") ?? "").trim().toLowerCase());
    } else setStatus(result);
    setBusy(false); locked.current = false;
  }

  return <>
    {status && <div ref={statusRef} tabIndex={-1} role={status.ok ? "status" : "alert"} className={status.ok ? styles.notice : styles.error}>{status.message}</div>}
    <form className={`${styles.form} ${styles.compact}`} onSubmit={onSubmit} aria-busy={busy}>
      <div className={styles.field}>
        <label htmlFor="name">Họ và tên</label>
        <div className={styles.control}>
          <UserIcon className={styles.leading}/>
          <input id="name" name="name" required maxLength={100} autoComplete="name" placeholder="Nhập họ và tên của bạn"/>
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <div className={styles.control}>
          <MailIcon className={styles.leading}/>
          <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="Nhập email của bạn"/>
        </div>
      </div>
      <PasswordField name="password" label="Mật khẩu" placeholder="Tạo mật khẩu" describedBy="password-policy"/>
      <p id="password-policy" className={styles.help}>Từ 12 đến 128 ký tự. Nên dùng mật khẩu riêng cho AUREL.</p>
      <PasswordField name="confirm" label="Xác nhận mật khẩu" placeholder="Nhập lại mật khẩu"/>
      <button className={styles.submit} type="submit" disabled={busy || sessionPending}>
        {busy ? <><span className={styles.spinner} data-motion-activity="spin" aria-hidden="true"/>Đang xử lý…</> : <>Tạo tài khoản<ArrowRightIcon/></>}
      </button>
    </form>
    <p className={styles.signup}>Đã có tài khoản?<Link href="/login">Đăng nhập</Link></p>
  </>;
}

