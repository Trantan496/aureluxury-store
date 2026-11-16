"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { submitAuth } from "@/features/auth/ui";
import styles from "./registration-success.module.css";

export function RegistrationSuccess({ email, deliveryAvailable }: { email: string; deliveryAvailable: boolean }) {
  const title = useRef<HTMLHeadingElement>(null);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, []);

  async function resend() {
    if (locked.current || !deliveryAvailable) return;
    locked.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      setFeedback(await submitAuth("verify", { email }, authClient, window.location.origin));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return <section className={styles.screen} aria-labelledby="registration-success-title">
    <div className={styles.card}>
      <Image className={styles.logo} src="/images/aurel/aurel-logo.webp" alt="AUREL" width={300} height={300}/>
      <p className={styles.eyebrow}>YOUR AUREL ACCOUNT</p>
      <h1 ref={title} tabIndex={-1} id="registration-success-title" className={styles.title}>Tạo tài khoản thành công!</h1>
      <p className={styles.subtitle}>{deliveryAvailable
        ? "Vui lòng kiểm tra email để xác minh tài khoản."
        : "Dịch vụ email hiện chưa sẵn sàng. Bạn vẫn có thể đăng nhập; email chưa được xác minh."}</p>
      <Link href="/login" className={styles.login}>Đăng nhập</Link>
      <button type="button" className={styles.resend} disabled={busy || !deliveryAvailable} onClick={() => void resend()}>
        {busy ? "Đang gửi…" : "Gửi lại email"}
      </button>
      {feedback && <p className={styles.feedback} role={feedback.ok ? "status" : "alert"}>{feedback.message}</p>}
    </div>
  </section>;
}
