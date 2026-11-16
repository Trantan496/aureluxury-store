"use client";

import { useState } from "react";
import { DashIcon } from "./product-dashboard-icons";
import type { ProductDashboardStats } from "@/features/products/dashboard";
import { percentOf } from "@/features/products/dashboard-rules";
import styles from "./product-dashboard.module.css";

const DONUT_COLORS = ["#6b4530", "#8a583e", "#a87152", "#c49071", "#dcc0aa", "#a29482"];

export function ProductChartsArea({ stats }: { stats: ProductDashboardStats | null }) {
  const [activePoint, setActivePoint] = useState<{ day: string; count: number; x: number; y: number } | null>(null);

  if (!stats) {
    return (
      <section className={styles.charts} aria-label="Biểu đồ phân tích">
        <div className={styles.card}>
          <div className={styles.chartEmpty}>Chưa có dữ liệu thống kê sản phẩm.</div>
        </div>
      </section>
    );
  }

  const { created, categories, totals, range } = stats;

  // Chart 1: Area Chart calculations
  const series = created.series;
  const maxCount = Math.max(...series.map(s => s.count), 4);
  const chartWidth = 500;
  const chartHeight = 160;
  const paddingX = 20;
  const paddingY = 20;

  const points = series.map((p, idx) => {
    const x = paddingX + (idx / Math.max(series.length - 1, 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - (p.count / maxCount) * (chartHeight - paddingY * 2);
    return { ...p, x, y };
  });

  const pathD = points.length > 0
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
    : "";
  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`
    : "";

  // Chart 2: Donut Chart calculations
  const totalCategoryProducts = categories.total;
  const radius = 50;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;

  // Pre-calculate stroke offsets immutably using reduce
  const donutSlices = categories.slices.reduce<
    (typeof categories.slices[number] & { strokeDasharray: string; strokeDashoffset: number; color: string })[]
  >((acc, slice, idx) => {
    const prevOffset = acc.length > 0
      ? -acc[acc.length - 1].strokeDashoffset +
        (totalCategoryProducts > 0 ? (acc[acc.length - 1].count / totalCategoryProducts) * circumference : 0)
      : 0;
    const dashLength = totalCategoryProducts > 0 ? (slice.count / totalCategoryProducts) * circumference : 0;
    const strokeDasharray = `${dashLength} ${circumference - dashLength}`;
    const strokeDashoffset = -prevOffset;
    const color = DONUT_COLORS[idx % DONUT_COLORS.length];
    acc.push({ ...slice, strokeDasharray, strokeDashoffset, color });
    return acc;
  }, []);

  // Chart 3: Horizontal Bars
  const totalStatus = totals.all;
  const activePercent = percentOf(totals.active, totalStatus);
  const archivedPercent = percentOf(totals.archived, totalStatus);

  return (
    <section className={styles.charts} aria-label="Biểu đồ phân tích sản phẩm">
      {/* Chart 1: Sản phẩm mới tạo */}
      <article className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>
              <DashIcon name="chart" />
              <span>Sản phẩm mới thêm ({range} ngày)</span>
            </h2>
            <div className={styles.cardMeta}>Dữ liệu tạo thực tế từ hệ thống</div>
          </div>
          <div className={styles.cardValue}>{created.total}</div>
        </div>

        <div className={styles.chartBox}>
          {points.length > 0 ? (
            <>
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="pd-area-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6b4530" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#6b4530" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid lines */}
                <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} className={styles.gridLine} />
                <line x1={paddingX} y1={chartHeight / 2} x2={chartWidth - paddingX} y2={chartHeight / 2} className={styles.gridLine} />
                <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} className={styles.gridLine} />

                {/* Area and Line */}
                <path d={areaD} className={styles.areaFill} />
                <path d={pathD} className={styles.areaLine} />

                {/* Hover dots & interaction */}
                {points.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={activePoint?.day === pt.day ? 5 : 3}
                    className={styles.hoverDot}
                    onMouseEnter={() => setActivePoint(pt)}
                  />
                ))}

                {activePoint && (
                  <line
                    x1={activePoint.x}
                    y1={paddingY}
                    x2={activePoint.x}
                    y2={chartHeight - paddingY}
                    className={styles.hoverRule}
                  />
                )}
              </svg>

              {activePoint && (
                <div
                  className={styles.tooltip}
                  style={{ left: `${(activePoint.x / chartWidth) * 100}%`, top: `${(activePoint.y / chartHeight) * 100}%` }}
                >
                  <strong>{activePoint.day}</strong>: {activePoint.count} sản phẩm
                </div>
              )}
            </>
          ) : (
            <div className={styles.chartEmpty}>Chưa có dữ liệu trong khoảng thời gian này.</div>
          )}
        </div>
      </article>

      {/* Chart 2: Cơ cấu theo danh mục */}
      <article className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>
              <DashIcon name="donut" />
              <span>Cơ cấu theo danh mục</span>
            </h2>
            <div className={styles.cardMeta}>Tỷ lệ phân bổ sản phẩm</div>
          </div>
          <div className={styles.cardValue}>{categories.total}</div>
        </div>

        {totalCategoryProducts > 0 ? (
          <div className={styles.donutWrap}>
            <div className={styles.donut}>
              <svg viewBox="0 0 140 140">
                <circle cx="70" cy="70" r={radius} stroke="#f0e8de" strokeWidth={strokeWidth} fill="none" />
                {donutSlices.map((slice) => {
                  return (
                    <circle
                      key={slice.name}
                      cx="70"
                      cy="70"
                      r={radius}
                      stroke={slice.color}
                      strokeWidth={strokeWidth}
                      strokeDasharray={slice.strokeDasharray}
                      strokeDashoffset={slice.strokeDashoffset}
                      fill="none"
                    />
                  );
                })}
              </svg>
              <div className={styles.donutCenter}>
                <strong>{totalCategoryProducts}</strong>
                <span>Sản phẩm</span>
              </div>
            </div>

            <ul className={styles.legend}>
              {categories.slices.map((slice, idx) => (
                <li key={slice.name}>
                  <span className={styles.legendDot} style={{ background: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                  <span className={styles.legendName} title={slice.name}>{slice.name}</span>
                  <span className={styles.legendValue}>{slice.percent}% ({slice.count})</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className={styles.chartEmpty}>Chưa có phân loại danh mục.</div>
        )}
      </article>

      {/* Chart 3: Trạng thái sản phẩm */}
      <article className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>
              <DashIcon name="bars" />
              <span>Trạng thái sản phẩm</span>
            </h2>
            <div className={styles.cardMeta}>Tổng quan trạng thái bán</div>
          </div>
          <div className={styles.cardValue}>{totalStatus}</div>
        </div>

        <ul className={styles.bars}>
          <li>
            <span>Đang hoạt động</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${activePercent}%`, background: "var(--pd-blue)" }} />
            </div>
            <span className={styles.barValue}>{totals.active} ({activePercent}%)</span>
          </li>
          <li>
            <span>Đã lưu trữ</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${archivedPercent}%`, background: "var(--pd-amber)" }} />
            </div>
            <span className={styles.barValue}>{totals.archived} ({archivedPercent}%)</span>
          </li>
        </ul>
        <div className={styles.scopeNote}>
          * Số liệu thống kê được tính toán trực tiếp từ cơ sở dữ liệu trên toàn bộ danh mục.
        </div>
      </article>
    </section>
  );
}
