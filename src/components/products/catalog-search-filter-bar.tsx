"use client";

import { buildCatalogHref } from "@/features/catalog/catalog-href";
export { buildCatalogHref } from "@/features/catalog/catalog-href";

import { MotionPanel } from "@/components/ui/motion-panel";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CatalogQuery } from "@/features/catalog/catalog";
import { clothingCategories } from "@/features/products/category-options";
import styles from "./catalog-browser.module.css";

export const sizeOptions = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export const colorOptions = [
  { value: "black", label: "Đen", swatch: "#1f1b18" },
  { value: "white", label: "Trắng", swatch: "#f8f6f2" },
  { value: "beige", label: "Be", swatch: "#dccbb5" },
  { value: "brown", label: "Nâu", swatch: "#6e4b32" },
  { value: "navy", label: "Xanh Navy", swatch: "#25344b" },
  { value: "grey", label: "Xám", swatch: "#8a8682" },
] as const;

const pricePresets = [
  { label: "Dưới 500.000₫", min: "", max: "500000" },
  { label: "500.000₫ – 1.000.000₫", min: "500000", max: "1000000" },
  { label: "1.000.000₫ – 2.000.000₫", min: "1000000", max: "2000000" },
  { label: "Trên 2.000.000₫", min: "2000000", max: "" },
] as const;

type FilterMenuKey = "filter" | "category" | "color" | "price" | "size";


function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.3 4.3" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5.5 5.5 14.5 14.5M14.5 5.5l-9 9" strokeLinecap="round" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
      <circle cx="7" cy="5" r="1.6" fill="currentColor" />
      <circle cx="13" cy="10" r="1.6" fill="currentColor" />
      <circle cx="9" cy="15" r="1.6" fill="currentColor" />
    </svg>
  );
}

function ShirtIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        d="M7 3.5 4 5.5 2.5 8.5l2.5 1.2V16.5h10V9.7l2.5-1.2L16 5.5l-3-2a3 3 0 0 1-6 0Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 2.8a7.2 7.2 0 1 0 0 14.4c1 0 1.6-.6 1.6-1.4 0-.5-.3-.9-.3-1.3 0-.6.5-1 1.1-1h1.5a3.3 3.3 0 0 0 3.3-3.3c0-4-3.2-7.4-7.2-7.4Z" />
      <circle cx="6.5" cy="9" r="0.9" fill="currentColor" />
      <circle cx="9" cy="6.2" r="0.9" fill="currentColor" />
      <circle cx="12.5" cy="6.8" r="0.9" fill="currentColor" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        d="M10.5 3H4.5A1.5 1.5 0 0 0 3 4.5v6l6.7 6.7a1.5 1.5 0 0 0 2.1 0l5.4-5.4a1.5 1.5 0 0 0 0-2.1L10.5 3Z"
        strokeLinejoin="round"
      />
      <circle cx="6.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

function SizeIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.5 7V3.5H7M13 3.5h3.5V7M16.5 13v3.5H13M7 16.5H3.5V13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CatalogSearchFilterBar({ query }: { query: CatalogQuery }) {
  const [openMenu, setOpenMenu] = useState<FilterMenuKey | null>(null);
  const [searchValue, setSearchValue] = useState(query.q);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    function handleOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        const trigger = rootRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');
        setOpenMenu(null);
        trigger?.focus();
      }
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenu]);

  const activeCategory = clothingCategories.find(c => c.slug === query.category);
  const activeColor = colorOptions.find(c => c.value === query.color);
  const activeCount = [
    query.gender,
    query.category,
    query.size,
    query.color,
    query.minPrice !== undefined ? "min" : "",
    query.maxPrice !== undefined ? "max" : "",
  ].filter(Boolean).length;

  const genderLabel =
    query.gender === "women" ? "Nữ" : query.gender === "men" ? "Nam" : "Tất cả";

  const priceLabel =
    query.minPrice !== undefined || query.maxPrice !== undefined
      ? `${query.minPrice ? `${Math.round(query.minPrice / 1000)}k` : "0"}–${
          query.maxPrice ? `${Math.round(query.maxPrice / 1000)}k` : "∞"
        }`
      : "Giá";

  function toggleMenu(menu: FilterMenuKey) {
    setOpenMenu(prev => (prev === menu ? null : menu));
  }

  return (
    <div ref={rootRef} className={styles.unifiedBarWrap}>
      <section className={styles.unifiedBar} aria-label="Tìm kiếm và bộ lọc sản phẩm">
        <form
          className={styles.unifiedSearchForm}
          action="/products"
          method="get"
          role="search"
        >
          {query.gender && <input type="hidden" name="gender" value={query.gender} />}
          {query.category && <input type="hidden" name="category" value={query.category} />}
          {query.size && <input type="hidden" name="size" value={query.size} />}
          {query.color && <input type="hidden" name="color" value={query.color} />}
          {query.minPrice !== undefined && (
            <input type="hidden" name="minPrice" value={String(query.minPrice)} />
          )}
          {query.maxPrice !== undefined && (
            <input type="hidden" name="maxPrice" value={String(query.maxPrice)} />
          )}
          <button type="submit" className={styles.unifiedSearchSubmit} aria-label="Tìm kiếm">
            <SearchIcon />
          </button>
          <input
            type="search"
            name="q"
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            maxLength={100}
            aria-label="Tìm kiếm sản phẩm"
            placeholder="Tìm kiếm sản phẩm, loại áo, phong cách..."
            className={styles.unifiedSearchInput}
          />
          {query.q ? (
            <Link
              href={buildCatalogHref(query, { q: "", page: 1 })}
              className={styles.unifiedSearchClear}
              aria-label="Xóa từ khóa"
              onClick={() => setSearchValue("")}
            >
              <ClearIcon />
            </Link>
          ) : searchValue ? (
            <button
              type="button"
              className={styles.unifiedSearchClear}
              aria-label="Xóa nội dung đã nhập"
              onClick={() => setSearchValue("")}
            >
              <ClearIcon />
            </button>
          ) : null}
        </form>

        <span className={styles.unifiedDivider} aria-hidden="true" />

        <div className={styles.unifiedFilters}>
          {/* Bộ lọc (Giới tính + Xóa bộ lọc) */}
          <div className={styles.filterDropdown}>
            <button
              type="button"
              className={`${styles.unifiedPill} ${styles.unifiedPillPrimary}`}
              aria-expanded={openMenu === "filter"}
              onClick={() => toggleMenu("filter")}
            >
              <SlidersIcon />
              <span>Bộ lọc{activeCount > 0 ? ` (${activeCount})` : ""}</span>
              <ChevronDownIcon />
            </button>
            <MotionPanel open={openMenu === "filter"} className={styles.dropdownMenu} role="region" aria-label="Lọc theo giới tính">
                <p className={styles.dropdownTitle}>Giới tính ({genderLabel})</p>
                <div className={styles.dropdownPills}>
                  <Link
                    href={buildCatalogHref(query, { gender: "", page: 1 })}
                    className={`${styles.dropdownChip} ${!query.gender ? styles.dropdownChipActive : ""}`}
                    onClick={() => setOpenMenu(null)}
                  >
                    Tất cả
                  </Link>
                  <Link
                    href={buildCatalogHref(query, { gender: "women", page: 1 })}
                    className={`${styles.dropdownChip} ${
                      query.gender === "women" ? styles.dropdownChipActive : ""
                    }`}
                    onClick={() => setOpenMenu(null)}
                  >
                    Nữ
                  </Link>
                  <Link
                    href={buildCatalogHref(query, { gender: "men", page: 1 })}
                    className={`${styles.dropdownChip} ${
                      query.gender === "men" ? styles.dropdownChipActive : ""
                    }`}
                    onClick={() => setOpenMenu(null)}
                  >
                    Nam
                  </Link>
                </div>
                {activeCount > 0 && (
                  <Link
                    href="/products?page=1"
                    className={styles.dropdownReset}
                    onClick={() => setOpenMenu(null)}
                  >
                    Xóa toàn bộ bộ lọc
                  </Link>
                )}
              </MotionPanel>
          </div>

          {/* Danh mục */}
          <div className={styles.filterDropdown}>
            <button
              type="button"
              className={`${styles.unifiedPill} ${
                query.category ? styles.unifiedPillSelected : ""
              }`}
              aria-expanded={openMenu === "category"}
              onClick={() => toggleMenu("category")}
            >
              <ShirtIcon />
              <span>{activeCategory ? activeCategory.name : "Danh mục"}</span>
              <ChevronDownIcon />
            </button>
            <MotionPanel open={openMenu === "category"} className={styles.dropdownMenu} role="region" aria-label="Lọc theo danh mục">
                <Link
                  href={buildCatalogHref(query, { category: "", page: 1 })}
                  className={`${styles.dropdownItem} ${!query.category ? styles.dropdownItemActive : ""}`}
                  onClick={() => setOpenMenu(null)}
                >
                  Tất cả danh mục
                </Link>
                {clothingCategories.map(cat => (
                  <Link
                    key={cat.slug}
                    href={buildCatalogHref(query, { category: cat.slug, page: 1 })}
                    className={`${styles.dropdownItem} ${
                      query.category === cat.slug ? styles.dropdownItemActive : ""
                    }`}
                    onClick={() => setOpenMenu(null)}
                  >
                    {cat.name}
                  </Link>
                ))}
              </MotionPanel>
          </div>

          {/* Màu */}
          <div className={styles.filterDropdown}>
            <button
              type="button"
              className={`${styles.unifiedPill} ${query.color ? styles.unifiedPillSelected : ""}`}
              aria-expanded={openMenu === "color"}
              onClick={() => toggleMenu("color")}
            >
              <PaletteIcon />
              <span>{activeColor ? activeColor.label : "Màu"}</span>
              <ChevronDownIcon />
            </button>
            <MotionPanel open={openMenu === "color"} className={styles.dropdownMenu} role="region" aria-label="Lọc theo màu sắc">
                <Link
                  href={buildCatalogHref(query, { color: "", page: 1 })}
                  className={`${styles.dropdownItem} ${!query.color ? styles.dropdownItemActive : ""}`}
                  onClick={() => setOpenMenu(null)}
                >
                  Tất cả màu
                </Link>
                {colorOptions.map(c => (
                  <Link
                    key={c.value}
                    href={buildCatalogHref(query, { color: c.value, page: 1 })}
                    className={`${styles.dropdownItem} ${
                      query.color === c.value ? styles.dropdownItemActive : ""
                    }`}
                    onClick={() => setOpenMenu(null)}
                  >
                    <span className={styles.colorDot} style={{ background: c.swatch }} />
                    {c.label}
                  </Link>
                ))}
              </MotionPanel>
          </div>

          {/* Giá */}
          <div className={styles.filterDropdown}>
            <button
              type="button"
              className={`${styles.unifiedPill} ${
                query.minPrice !== undefined || query.maxPrice !== undefined
                  ? styles.unifiedPillSelected
                  : ""
              }`}
              aria-expanded={openMenu === "price"}
              onClick={() => toggleMenu("price")}
            >
              <TagIcon />
              <span>{priceLabel}</span>
              <ChevronDownIcon />
            </button>
            <MotionPanel open={openMenu === "price"} className={`${styles.dropdownMenu} ${styles.dropdownMenuWide}`}
                role="region"
                aria-label="Lọc theo khoảng giá">
                <Link
                  href={buildCatalogHref(query, { minPrice: "", maxPrice: "", page: 1 })}
                  className={`${styles.dropdownItem} ${
                    query.minPrice === undefined && query.maxPrice === undefined
                      ? styles.dropdownItemActive
                      : ""
                  }`}
                  onClick={() => setOpenMenu(null)}
                >
                  Tất cả mức giá
                </Link>
                {pricePresets.map(preset => {
                  const isActive =
                    String(query.minPrice ?? "") === preset.min &&
                    String(query.maxPrice ?? "") === preset.max;
                  return (
                    <Link
                      key={preset.label}
                      href={buildCatalogHref(query, {
                        minPrice: preset.min,
                        maxPrice: preset.max,
                        page: 1,
                      })}
                      className={`${styles.dropdownItem} ${isActive ? styles.dropdownItemActive : ""}`}
                      onClick={() => setOpenMenu(null)}
                    >
                      {preset.label}
                    </Link>
                  );
                })}
                <form className={styles.priceCustomForm} action="/products" method="get">
                  {query.q && <input type="hidden" name="q" value={query.q} />}
                  {query.gender && <input type="hidden" name="gender" value={query.gender} />}
                  {query.category && <input type="hidden" name="category" value={query.category} />}
                  {query.size && <input type="hidden" name="size" value={query.size} />}
                  {query.color && <input type="hidden" name="color" value={query.color} />}
                  <input type="hidden" name="page" value="1" />
                  <div className={styles.priceInputs}>
                    <input
                      type="number"
                      name="minPrice"
                      min={0}
                      step={50000}
                      placeholder="Từ (VND)"
                      aria-label="Giá tối thiểu"
                      defaultValue={query.minPrice ?? ""}
                      className={styles.priceInput}
                    />
                    <input
                      type="number"
                      name="maxPrice"
                      min={0}
                      step={50000}
                      placeholder="Đến (VND)"
                      aria-label="Giá tối đa"
                      defaultValue={query.maxPrice ?? ""}
                      className={styles.priceInput}
                    />
                  </div>
                  <button type="submit" className={styles.priceApply}>
                    Áp dụng giá
                  </button>
                </form>
              </MotionPanel>
          </div>

          {/* Size */}
          <div className={styles.filterDropdown}>
            <button
              type="button"
              className={`${styles.unifiedPill} ${query.size ? styles.unifiedPillSelected : ""}`}
              aria-expanded={openMenu === "size"}
              onClick={() => toggleMenu("size")}
            >
              <SizeIcon />
              <span>{query.size ? `Size ${query.size}` : "Size"}</span>
              <ChevronDownIcon />
            </button>
            <MotionPanel open={openMenu === "size"} className={styles.dropdownMenu} role="region" aria-label="Lọc theo kích cỡ">
                <Link
                  href={buildCatalogHref(query, { size: "", page: 1 })}
                  className={`${styles.dropdownItem} ${!query.size ? styles.dropdownItemActive : ""}`}
                  onClick={() => setOpenMenu(null)}
                >
                  Tất cả size
                </Link>
                <div className={styles.sizeGrid}>
                  {sizeOptions.map(size => (
                    <Link
                      key={size}
                      href={buildCatalogHref(query, { size, page: 1 })}
                      className={`${styles.dropdownChip} ${
                        query.size === size ? styles.dropdownChipActive : ""
                      }`}
                      onClick={() => setOpenMenu(null)}
                    >
                      {size}
                    </Link>
                  ))}
                </div>
              </MotionPanel>
          </div>
        </div>
      </section>
    </div>
  );
}
