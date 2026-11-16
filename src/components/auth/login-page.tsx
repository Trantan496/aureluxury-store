import { Suspense } from "react";
import { AuthEditorial } from "./auth-editorial";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export function LoginPage() {
  return <section className={styles.shell} aria-labelledby="auth-title">
    <AuthEditorial/>
    <div className={styles.panel}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>YOUR AUREL ACCOUNT</p>
        <h1 id="auth-title">Chào mừng trở lại.</h1>
        <p className={styles.intro}>Đăng nhập để tiếp tục hành trình phong cách cùng AUREL.</p>
        <Suspense fallback={<p role="status" className={styles.intro}>Đang tải biểu mẫu…</p>}><LoginForm/></Suspense>
      </div>
    </div>
  </section>;
}
