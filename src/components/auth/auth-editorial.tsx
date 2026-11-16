import Image from "next/image";
import { RefreshIcon, ShieldCheckIcon, TruckIcon } from "./login-icons";
import styles from "./login.module.css";

const benefits = [[TruckIcon, "Giao hàng toàn quốc"], [RefreshIcon, "Đổi trả dễ dàng"], [ShieldCheckIcon, "Thanh toán an toàn"]] as const;

/** Shared editorial image panel for the login and registration screens. */
export function AuthEditorial() {
  return <aside className={styles.editorial} aria-label="AUREL editorial">
    <Image src="/images/image1.png" alt="Hai người mẫu trong trang phục AUREL tông nâu và kem" fill priority quality={90} sizes="(max-width: 767px) 100vw, 50vw" className={styles.image}/>
    <div className={styles.scrim} aria-hidden="true"/>
    <div className={styles.caption} lang="en">
      <p className={styles.kicker}>AUREL — BEYOND GENDER</p>
      <p className={styles.statement} aria-label="Style is personal. Make it yours.">Style is<br/>personal.<br/><em>Make it yours.</em></p>
      <span className={styles.rule} aria-hidden="true"/>
      <p className={styles.tagline}>Modern essentials for every silhouette.</p>
    </div>
    <ul className={styles.benefits} lang="vi">
      {benefits.map(([Icon, label]) => <li key={label}><Icon/>{label}</li>)}
    </ul>
  </aside>;
}

