"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { safeReturnTo, submitAuth, type AuthMode } from "@/features/auth/ui";
import styles from "./auth.module.css";

function PasswordInput({ name, label, confirm = false, current = false }: { name: string; label: string; confirm?: boolean; current?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <div className={styles.field}><label htmlFor={name}>{label}</label><div className={styles.password}>
    <input id={name} name={name} type={visible ? "text" : "password"} required minLength={current ? undefined : 12} maxLength={128} autoComplete={current ? "current-password" : "new-password"} aria-describedby={!current && !confirm ? "password-policy" : undefined}/>
    <button className={styles.reveal} type="button" aria-label={`${visible ? "Ẩn" : "Hiện"} ${label.toLowerCase()}`} aria-pressed={visible} aria-controls={name} onClick={() => setVisible(!visible)}>{visible ? "Ẩn" : "Hiện"}</button>
  </div>{!current && !confirm && <p id="password-policy" className={styles.help}>Từ 12 đến 128 ký tự. Nên dùng mật khẩu riêng cho AUREL.</p>}</div>;
}

const buttons = { login: "Đăng nhập", register: "Tạo tài khoản", forgot: "Gửi yêu cầu", reset: "Cập nhật mật khẩu", verify: "Gửi lại email xác minh" };

export function AuthForm({ mode, deliveryAvailable }: { mode: AuthMode; deliveryAvailable: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [token, setToken] = useState(() => mode === "reset" ? params.get("token") ?? "" : "");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const next = safeReturnTo(params.get("next"));
  const callbackFailed = Boolean(params.get("error"));
  useEffect(() => {
    if (mode === "reset" && window.location.search) {
      // Keep the token only in component memory, remove it from the visible URL.
      window.history.replaceState(window.history.state, "", "/reset-password");
    }
  }, [mode]);
  useEffect(() => {
    if (session && (mode === "login" || mode === "register")) { router.replace(next); router.refresh(); }
  }, [session, mode, router, next]);
  useEffect(() => { if (status) statusRef.current?.focus(); }, [status]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true; setBusy(true); setStatus(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await submitAuth(mode, {
      email: String(data.get("email") ?? ""), name: String(data.get("name") ?? ""), password: String(data.get("password") ?? ""),
      confirm: String(data.get("confirm") ?? ""), remember: data.get("remember") === "on",
    }, authClient, window.location.origin, token);
    if (result.ok && mode === "register") result.message = deliveryAvailable
      ? "Tài khoản đã được tạo. Hãy kiểm tra email để xác minh địa chỉ; nếu chưa nhận, bạn có thể yêu cầu gửi lại. Bạn chưa được tự động đăng nhập."
      : "Tài khoản đã được tạo. Dịch vụ email hiện chưa sẵn sàng; bạn vẫn có thể đăng nhập. Địa chỉ email chưa được xác minh.";
    setStatus(result);
    if (result.ok && mode === "login") { router.replace(next); router.refresh(); }
    if (result.ok && mode === "reset") { setToken(""); form.reset(); router.replace("/login?reset=success"); router.refresh(); }
    if (result.ok && mode === "register") form.reset();
    setBusy(false); locked.current = false;
  }

  const verified = mode === "verify" && session?.user.emailVerified === true;
  const invalidReset = mode === "reset" && (!token || callbackFailed);
  return <>
    {mode === "login" && params.get("reset") === "success" && <p className={styles.status} role="status">Mật khẩu đã được cập nhật. Các phiên đăng nhập cũ đã được thu hồi. Hãy đăng nhập lại.</p>}
    {mode === "verify" && <p className={styles.status} role="status">{verified ? "Email của tài khoản đã được xác minh." : callbackFailed ? "Liên kết không hợp lệ hoặc đã hết hạn. Bạn có thể yêu cầu gửi lại email xác minh." : params.get("result") === "processed" ? "Liên kết đã được xử lý. Đăng nhập để kiểm tra trạng thái xác minh của tài khoản." : session ? "Email của tài khoản chưa được xác minh. Hãy kiểm tra email hoặc yêu cầu gửi lại liên kết." : "Sau khi đăng ký, hãy kiểm tra email hoặc yêu cầu gửi lại liên kết. Đăng nhập để xem trạng thái tài khoản."}</p>}
    {invalidReset && <p className={styles.status} role="alert">Liên kết không hợp lệ, đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.</p>}
    {!deliveryAvailable && ["forgot", "verify"].includes(mode) && <p className={styles.status} role="status">Dịch vụ email hiện chưa sẵn sàng. Vui lòng quay lại sau; yêu cầu chưa được gửi.</p>}
    {status && <div ref={statusRef} tabIndex={-1} role={status.ok ? "status" : "alert"} className={styles.status}>{status.message}</div>}
    {!verified && !invalidReset && !(mode === "register" && status?.ok) && <form className={styles.form} onSubmit={onSubmit} aria-busy={busy}>
      {mode === "register" && <div className={styles.field}><label htmlFor="name">Họ và tên</label><input id="name" name="name" required maxLength={100} autoComplete="name"/></div>}
      {mode !== "reset" && <div className={styles.field}><label htmlFor="email">Email</label><input id="email" name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} defaultValue={mode === "verify" ? session?.user.email : undefined}/></div>}
      {["login", "register", "reset"].includes(mode) && <PasswordInput name="password" label={mode === "reset" ? "Mật khẩu mới" : "Mật khẩu"} current={mode === "login"}/>}
      {["register", "reset"].includes(mode) && <PasswordInput name="confirm" label={mode === "reset" ? "Xác nhận mật khẩu mới" : "Xác nhận mật khẩu"} confirm/>}
      {mode === "login" && <div className={styles.options}><label className={styles.check}><input type="checkbox" name="remember"/>Ghi nhớ đăng nhập</label><Link className="text-link" href="/forgot-password">Quên mật khẩu?</Link></div>}
      <button className={styles.submit} type="submit" disabled={busy || (sessionPending && ["login", "register"].includes(mode)) || (!deliveryAvailable && ["forgot", "verify"].includes(mode))}>{busy ? "Đang xử lý…" : buttons[mode]}<span aria-hidden="true">→</span></button>
    </form>}
    <nav className={styles.links} aria-label="Tùy chọn tài khoản">
      {mode === "login" ? <><span>Chưa có tài khoản?</span><Link href="/register">Tạo tài khoản</Link></> : <Link href={mode === "verify" ? "/login?next=%2Fverify-email" : "/login"}>Đăng nhập</Link>}
      {mode === "register" && status?.ok && <Link href="/verify-email">Trạng thái xác minh email</Link>}
      {mode === "reset" && <Link href="/forgot-password">Yêu cầu liên kết mới</Link>}
      {mode === "verify" && <Link href="/products">Tiếp tục khám phá</Link>}
    </nav>
  </>;
}
