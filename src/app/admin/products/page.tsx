import { createProductDataService } from "@/lib/products";
import { ProductExplorer } from "@/components/admin/product-explorer";
import { parseDashboardRange } from "@/features/products/dashboard-rules";
import type { ProductRowExtra } from "@/features/products/dashboard";
import type { DashboardQuery } from "@/components/admin/product-dashboard-query";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const service = createProductDataService();

  const query: DashboardQuery = {
    q: typeof q.q === "string" ? q.q : undefined,
    page: typeof q.page === "string" ? q.page : undefined,
    status: typeof q.status === "string" ? q.status : undefined,
    category: typeof q.category === "string" ? q.category : undefined,
    collection: typeof q.collection === "string" ? q.collection : undefined,
    range: typeof q.range === "string" ? q.range : undefined,
  };

  const range = parseDashboardRange(query.range);

  // Load management list for the table
  const result = await service.managementList({
    q: query.q ?? "",
    page: Number(query.page ?? 1),
    status: query.status ?? "all",
    ...(query.category ? { category: Number(query.category) } : {}),
    ...(query.collection ? { collection: query.collection } : {}),
  });

  // Load dashboard stats for KPIs & Charts (runs inside verified transaction)
  const statsRes = await service.managementDashboard({ range });
  const stats = statsRes.ok ? statsRes.data : null;

  // Load thumbnails & stock for the displayed rows
  let extras: ProductRowExtra[] = [];
  if (result.ok && result.data.rows.length > 0) {
    const ids = result.data.rows.map(r => r.id);
    const extrasRes = await service.managementRowExtras(ids);
    if (extrasRes.ok) {
      extras = extrasRes.data;
    }
  }

  const notice =
    q.deleted === "1"
      ? q.audit === "pending"
        ? "Sản phẩm đã được xóa. Audit intent đã được lưu; cần quản trị viên đối chiếu completion log."
        : "Đã xóa sản phẩm và ghi audit."
      : undefined;

  return (
    <ProductExplorer
      result={result}
      stats={stats}
      extras={extras}
      query={query}
      notice={notice}
    />
  );
}

