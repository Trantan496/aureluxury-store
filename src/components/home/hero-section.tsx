import Image from "next/image";
import Link from "next/link";
import styles from "./hero.module.css";

const panels = [
  { name: "New Arrivals", image: "warm_toned_cinematic_fashion_duo.png", alt: "Two models in warm neutral tailoring, seated in golden sunlight", href: "/products", className: styles.primary },
  { name: "Essentials", image: "warm_knit_portrait_with_freckles.png", alt: "Editorial portrait in textured brown knitwear", href: "/products?category=essentials", className: styles.essentials },
  { name: "Accessories", image: "sunlit_leather_bag_and_scarf.png", alt: "Leather bag, brown scarf and sunglasses on sunlit stone steps", href: "/products", className: styles.accessories },
];

export function HeroSection() {
  return (
    <section className={styles.hero} aria-labelledby="aurel-title" lang="en">
      {panels.map((panel, index) => (
        <article className={`${styles.panel} ${panel.className}`} key={panel.name}>
          <Image src={`/images/aurel/${panel.image}`} alt={panel.alt} fill preload={index === 0}
            sizes={index === 0 ? "(min-width: 1024px) 62vw, (min-width: 768px) and (orientation: landscape) 62vw, 100vw" : "(min-width: 1024px) 38vw, (min-width: 768px) and (orientation: landscape) 38vw, (min-width: 768px) 50vw, 100vw"}
            className={styles.image} quality={90}/>
          <div className={styles.caption}>
            <h2>{panel.name}</h2>
            <Link href={panel.href} aria-label={`Shop ${panel.name}`} className={styles.shop}>Shop now</Link>
          </div>
        </article>
      ))}
      <div className={styles.brand}>
        <h1 id="aurel-title">ÁUREL</h1>
        <p className={styles.tagline}>BEYOND GENDER</p>
        <span className={styles.divider} aria-hidden="true"/>
        <p className={styles.statement}>Modern essentials for every silhouette.</p>
      </div>
    </section>
  );
}
