import Image from "next/image";
import styles from "./auth.module.css";

export function AuthShell({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return <section className={styles.shell} aria-labelledby="auth-title">
    <aside className={styles.editorial} aria-label="AUREL editorial">
      <Image src="/images/aurel/warm_toned_cinematic_fashion_duo.png" alt="" fill sizes="(max-width: 700px) 1px, (max-width: 900px) 42vw, 50vw" className={styles.image}/>
      <div className={styles.caption} lang="en"><p>AUREL — BEYOND GENDER</p><h2>Style is personal.<br/><em>Make it yours.</em></h2><p>Modern essentials for every silhouette.</p></div>
    </aside>
    <div className={styles.panel}><p className={styles.eyebrow}>YOUR AUREL ACCOUNT</p><h1 id="auth-title">{title}</h1><p className={styles.intro}>{intro}</p>{children}</div>
  </section>;
}
