"use client";
import Link from "next/link";
import {useState} from "react";
import type {PendingPage} from "@/features/products/pending-types";
import {PendingLookCard} from "@/components/products/complete-look";
import styles from "@/components/products/complete-look.module.css";
export function PendingProducts({initial}:{initial:PendingPage}){
 const [rows,setRows]=useState(initial.rows);
 return <section className={`${styles.lookPanel} ${styles.queuePanel}`}><h1>Chờ xử lý</h1>
 {!initial.available&&<p role="status">Hàng chờ chưa được bật trên database này.</p>}
 {initial.available&&!rows.length&&<p>Chưa có món chờ hoàn thiện.</p>}
 <div className={styles.lookRail}>{rows.map(row=><div key={row.id}>{row.sourceProductId&&<Link href={`/admin/products/${row.sourceProductId}/preview`}>Nguồn: {row.sourceName}</Link>}<PendingLookCard row={row} onSaved={saved=>setRows(old=>old.map(item=>item.id===saved.id?saved:item))}/></div>)}</div>
 <nav aria-label="Trang hàng chờ">{initial.page>1&&<Link href={`/admin/products/pending?page=${initial.page-1}`}>← Trang trước</Link>}{initial.hasMore&&<Link href={`/admin/products/pending?page=${initial.page+1}`}>Trang sau →</Link>}</nav>
 </section>;
}
