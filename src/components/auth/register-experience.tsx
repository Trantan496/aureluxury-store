"use client";

import { Suspense, useState, type ReactNode } from "react";
import { RegisterForm } from "./register-form";
import { RegistrationSuccess } from "./registration-success";
import styles from "./login.module.css";

export function RegisterExperience({ deliveryAvailable, editorial }: { deliveryAvailable: boolean; editorial: ReactNode }) {
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  return <section className={styles.shell} aria-labelledby={createdEmail !== null ? "registration-success-title" : "auth-title"}>
    {editorial}
    <div className={styles.panel}>
      {createdEmail !== null ? <RegistrationSuccess email={createdEmail} deliveryAvailable={deliveryAvailable}/> : <div className={`${styles.card} ${styles.registerCard}`}>
        <p className={styles.eyebrow}>YOUR AUREL ACCOUNT</p>
        <h1 id="auth-title">Một khởi đầu riêng.</h1>
        <p className={styles.intro}>Tạo tài khoản AUREL. Những điều tinh giản, dành cho bạn.</p>
        <Suspense fallback={<p role="status" className={styles.intro}>Đang tải biểu mẫu…</p>}>
          <RegisterForm onCreated={setCreatedEmail}/>
        </Suspense>
      </div>}
    </div>
  </section>;
}
