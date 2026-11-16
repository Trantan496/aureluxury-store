"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
export function PaginationLinks({ page, total }: { page: number; total: number }) {
  const query = useSearchParams();
  const href = (p: number) => { const next = new URLSearchParams(query.toString()); next.set("page", String(p)); return `?${next}`; };
  return <>{page > 1 && <Link href={href(page - 1)}>← Trang trước</Link>}{page * 25 < total && <Link href={href(page + 1)}>Trang sau →</Link>}</>;
}
