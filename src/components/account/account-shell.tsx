import Link from "next/link";
import { AccountSidebar } from "./account-sidebar";
import { ChevronRightIcon, HouseIcon } from "./account-icons";
import styles from "./account.module.css";

/** Two-column account layout (sidebar + content) with breadcrumb and page title. The global header/footer stay in the root layout. */
export function AccountShell({ title, current, children }: { title: string; current: string; children: React.ReactNode }) {
  return <div className={styles.page}>
    <div className={styles.layout}>
      <AccountSidebar/>
      <div className={styles.main}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <ol>
            <li><Link href="/"><HouseIcon aria-hidden="true"/>Trang chủ</Link></li>
            <li><ChevronRightIcon aria-hidden="true"/><Link href="/account">Tài khoản</Link></li>
            <li><ChevronRightIcon aria-hidden="true"/><span aria-current="page">{current}</span></li>
          </ol>
        </nav>
        <h1 className={styles.title}>{title}</h1>
        {children}
      </div>
    </div>
  </div>;
}

