import Link from "next/link";
import Image from "next/image";
import { DashIcon } from "./product-dashboard-icons";
import { dashboardHref, pageWindow, type DashboardQuery } from "./product-dashboard-query";
import { ProductDeleteControl } from "./product-delete-control";
import type { ProductRowExtra } from "@/features/products/dashboard";
import styles from "./product-dashboard.module.css";

export type ProductTableRow = {
  id: number;
  name: string;
  productCode: string | null;
  categoryId: number;
  collection: string | null;
  isActive: boolean;
};

export function ProductTable({
  rows,
  extras,
  categories,
  page,
  total,
  query,
}: {
  rows: ProductTableRow[];
  extras: Map<number, ProductRowExtra>;
  categories: { id: number; name: string }[];
  page: number;
  total: number;
  query: DashboardQuery;
}) {
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, total);

  return (
    <div className={`${styles.card} ${styles.tableCard}`}>
      {!rows.length ? (
        <div className={styles.tableEmpty}>
          <h3>Chưa có sản phẩm phù hợp</h3>
          <p>Hãy thử tìm kiếm với từ khóa khác hoặc xóa bớt bộ lọc.</p>
          <Link
            href={dashboardHref(query, { q: null, status: null, category: null, collection: null, page: null })}
            className={styles.primaryAction}
            style={{ display: "inline-flex" }}
          >
            Xóa bộ lọc
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col" style={{ width: 60 }}>Ảnh</th>
                  <th scope="col">Mã SKU</th>
                  <th scope="col">Tên sản phẩm</th>
                  <th scope="col">Danh mục</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Tồn kho</th>
                  <th scope="col" style={{ textAlign: "right", paddingRight: 20 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const extra = extras.get(row.id);
                  const catName = categoryMap.get(row.categoryId) ?? "Chưa phân loại";
                  const stock = extra?.stock ?? 0;
                  const activeVariants = extra?.activeVariants ?? 0;

                  return (
                    <tr key={row.id}>
                      {/* Ảnh */}
                      <td>
                        <div className={styles.thumb}>
                          {extra?.thumbnail ? (
                            <Image
                              src={extra.thumbnail}
                              alt={extra.thumbnailAlt || row.name}
                              width={40}
                              height={48}
                              unoptimized
                            />
                          ) : (
                            <DashIcon name="image" />
                          )}
                        </div>
                      </td>

                      {/* SKU */}
                      <td>
                        {row.productCode ? (
                          <span className={styles.code}>{row.productCode}</span>
                        ) : (
                          <span className={styles.codeMissing}>Chưa gán</span>
                        )}
                      </td>

                      {/* Tên sản phẩm */}
                      <td>
                        <Link
                          href={`/admin/products/${row.id}`}
                          className={styles.nameLink}
                          title={row.name}
                        >
                          {row.name}
                        </Link>
                      </td>

                      {/* Danh mục */}
                      <td>
                        <span className={styles.chip}>{catName}</span>
                      </td>

                      {/* Trạng thái */}
                      <td>
                        <span className={styles.status} data-active={row.isActive ? "true" : "false"}>
                          {row.isActive ? "Đang hoạt động" : "Đã lưu trữ"}
                        </span>
                      </td>

                      {/* Tồn kho */}
                      <td>
                        <div className={styles.stock} data-low={stock <= 5 && row.isActive ? "true" : undefined}>
                          {stock}
                          <span className={styles.stockSub}>{activeVariants} biến thể</span>
                        </div>
                      </td>

                      {/* Thao tác */}
                      <td>
                        <div className={styles.actions} style={{ justifyContent: "flex-end" }}>
                          <Link
                            href={`/admin/products/${row.id}`}
                            className={styles.iconLink}
                            title="Chỉnh sửa sản phẩm"
                            aria-label={`Chỉnh sửa ${row.name}`}
                          >
                            <DashIcon name="edit" />
                          </Link>

                          <Link
                            href={`/admin/products/${row.id}/preview`}
                            className={styles.iconLink}
                            title="Xem trước sản phẩm"
                            aria-label={`Xem trước ${row.name}`}
                          >
                            <DashIcon name="eye" />
                          </Link>

                          {/* Delete control - retains strict verification & authorization logic */}
                          <ProductDeleteControl
                            id={row.id}
                            productCode={row.productCode}
                            isActive={row.isActive}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <nav className={styles.pagination} aria-label="Phân trang sản phẩm">
            <div>
              Hiển thị {startIdx} – {endIdx} trên tổng số {total} sản phẩm
            </div>

            <div className={styles.pages}>
              {page > 1 ? (
                <Link
                  href={dashboardHref(query, { page: String(page - 1) })}
                  title="Trang trước"
                  aria-label="Trang trước"
                >
                  <DashIcon name="chevron-left" />
                </Link>
              ) : (
                <span aria-disabled="true" title="Trang trước">
                  <DashIcon name="chevron-left" />
                </span>
              )}

              {pageWindow(page, totalPages).map((p, idx) => {
                if (p === "gap") {
                  return <span key={`gap-${idx}`} className={styles.gap}>…</span>;
                }
                const isCurrent = p === page;
                return isCurrent ? (
                  <span key={p} aria-current="page">
                    {p}
                  </span>
                ) : (
                  <Link
                    key={p}
                    href={dashboardHref(query, { page: String(p) })}
                    data-page={p}
                  >
                    {p}
                  </Link>
                );
              })}

              {page < totalPages ? (
                <Link
                  href={dashboardHref(query, { page: String(page + 1) })}
                  title="Trang sau"
                  aria-label="Trang sau"
                >
                  <DashIcon name="chevron-right" />
                </Link>
              ) : (
                <span aria-disabled="true" title="Trang sau">
                  <DashIcon name="chevron-right" />
                </span>
              )}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
