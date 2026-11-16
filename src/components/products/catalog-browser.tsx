import Link from "next/link";
import { parseCatalogQuery, type CatalogQuery } from "@/features/catalog/catalog";
import { clothingCategories } from "@/features/products/category-options";
import { getCatalogPage, getSearchPage, getSearchRecommendations } from "@/lib/catalog";
import { CatalogSearchFilterBar } from "./catalog-search-filter-bar";
import { buildCatalogHref } from "@/features/catalog/catalog-href";
import { CatalogContent } from "./catalog-content";
import styles from "./catalog-browser.module.css";

const popular = ["Tailored Coats", "Knitwear", "Wide-Leg Trousers", "Everyday Essentials"];

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.3 4.3" />
    </svg>
  );
}

function EmptySearchIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor">
      <circle cx="27" cy="27" r="16" />
      <path d="m39 39 13 13M21 27h12" />
    </svg>
  );
}

function hasAnyFilter(query: CatalogQuery) {
  return Boolean(
    query.gender ||
      query.category ||
      query.size ||
      query.color ||
      query.minPrice !== undefined ||
      query.maxPrice !== undefined ||
      query.brand ||
      query.page !== undefined,
  );
}

function HeroSearchForm({ query }: { query: CatalogQuery }) {
  return (
    <form className={styles.heroSearch} action="/products" method="get" role="search">
      <SearchIcon />
      <input
        type="search"
        name="q"
        defaultValue={query.q}
        maxLength={100}
        aria-label="Search products"
        placeholder="Tìm kiếm sản phẩm, loại áo, phong cách..."
      />
      <button type="submit" aria-label="Search">
        <SearchIcon />
      </button>
    </form>
  );
}

function catalogHeading(query: CatalogQuery) {
  if (query.q) {
    return { eyebrow: "SEARCH RESULTS", title: `Results for “${query.q}”` };
  }
  const cat = clothingCategories.find(c => c.slug === query.category);
  if (query.gender === "women") {
    return {
      eyebrow: "AUREL / WOMEN",
      title: cat ? `${cat.name} Nữ` : "Bộ sưu tập Nữ",
    };
  }
  if (query.gender === "men") {
    return {
      eyebrow: "AUREL / MEN",
      title: cat ? `${cat.name} Nam` : "Bộ sưu tập Nam",
    };
  }
  if (cat) {
    return { eyebrow: "AUREL / CATALOG", title: cat.name };
  }
  if (query.category) {
    return { eyebrow: "AUREL / CATALOG", title: query.category.replace(/-/g, " ") };
  }
  return { eyebrow: "AUREL / COLLECTION", title: "Tất cả sản phẩm" };
}

export async function CatalogBrowser({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const query = parseCatalogQuery(params);
  const browsingCatalog = hasAnyFilter(query);

  if (!query.q && !browsingCatalog && !query.invalid) {
    return (
      <section className={styles.searchHero} aria-labelledby="explore-title">
        <p className={styles.eyebrow}>AUREL / EXPLORE</p>
        <h1 id="explore-title">
          WHAT ARE YOU
          <br />
          LOOKING FOR?
        </h1>
        <p className={styles.intro}>Find something that feels like you.</p>
        <HeroSearchForm query={query} />
        <nav className={styles.popular} aria-label="Popular searches">
          {popular.map(term => (
            <Link key={term} href={`/products?q=${encodeURIComponent(term)}`}>
              {term}
            </Link>
          ))}
        </nav>
        <nav className={styles.heroBrowse} aria-label="Khám phá theo bộ sưu tập">
          <Link href="/products?page=1" className={styles.filterPill}>
            Xem tất cả sản phẩm
          </Link>
          <Link href="/products?gender=women" className={styles.filterPill}>
            Bộ sưu tập Nữ
          </Link>
          <Link href="/products?gender=men" className={styles.filterPill}>
            Bộ sưu tập Nam
          </Link>
        </nav>
      </section>
    );
  }

  if (query.invalid) {
    return (
      <section className={styles.results}>
        <CatalogSearchFilterBar key={query.q} query={query} />
        <p className={styles.invalid} role="alert">
          Tham số lọc hoặc tìm kiếm không hợp lệ. Vui lòng thử lại.
        </p>
      </section>
    );
  }

  const result = query.q
    ? await getSearchPage({ ...query, pageSize: 12 })
    : await getCatalogPage({ ...query, pageSize: 12 });

  const heading = catalogHeading(query);

  if (result.status === "error") {
    return (
      <section className={styles.results}>
        <CatalogSearchFilterBar key={query.q} query={query} />
        <div className={styles.errorState} role="alert">
          <h1>CATALOG IS TEMPORARILY UNAVAILABLE.</h1>
          <p>We couldn’t reach the collection. Please try again in a moment.</p>
          <Link href={buildCatalogHref(query)}>Try again</Link>
        </div>
      </section>
    );
  }

  if (!result.products.length) {
    const recommendations = await getSearchRecommendations(8, {
      query: query.q || query.category || query.gender,
    });
    return (
      <section className={styles.results}>
        <CatalogSearchFilterBar key={query.q} query={query} />
        <div className={styles.noResults}>
          <EmptySearchIcon />
          <h1>
            {query.q
              ? "WE COULDN'T FIND WHAT YOU'RE LOOKING FOR."
              : "CHƯA CÓ SẢN PHẨM TRONG BỘ LỌC NÀY."}
          </h1>
          <p>
            {query.q
              ? "No products matched your search. Discover something else you'll love."
              : "Chưa có sản phẩm phù hợp với tiêu chí đang chọn. Bạn có thể xóa bộ lọc hoặc khám phá các gợi ý bên dưới."}
          </p>
          <p style={{ marginTop: 14 }}>
            <Link href="/products?page=1" className={styles.filterPill}>
              Xem tất cả sản phẩm
            </Link>
          </p>
        </div>
        <section className={styles.recommendations} aria-labelledby="recommendations-title">
          <p className={styles.eyebrow}>AUREL / CURATED</p>
          <h2 id="recommendations-title">YOU MAY LIKE!</h2>
          <p>Có thể bạn sẽ thích · Gợi ý phối đồ phù hợp cho bạn.</p>
          {recommendations.status === "success" && recommendations.products.length ? (
            <CatalogContent result={recommendations} premium label="Recommended products" />
          ) : (
            <p className={styles.recommendationEmpty}>
              New pieces are being prepared. Please return soon.
            </p>
          )}
        </section>
      </section>
    );
  }

  const complementary = await getSearchRecommendations(4, {
    query: query.q || query.category || query.gender,
    sources: result.products,
  });

  return (
    <section className={styles.results}>
      <CatalogSearchFilterBar key={query.q} query={query} />
      <header className={styles.resultsHeader}>
        <p className={styles.eyebrow}>{heading.eyebrow}</p>
        <h1>{heading.title}</h1>
        <p>
          {result.pagination.total} {result.pagination.total === 1 ? "sản phẩm" : "sản phẩm"}
        </p>
      </header>
      <CatalogContent
        result={result}
        search={Boolean(query.q)}
        query={query.q}
        premium
        label={heading.title}
      />
      {result.pagination.totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Catalog pages">
          <span>
            Trang {result.pagination.page} / {result.pagination.totalPages}
          </span>
          <span>
            {result.pagination.page > 1 && (
              <Link href={buildCatalogHref(query, { page: result.pagination.page - 1 })}>
                ← Trang trước
              </Link>
            )}
            {result.pagination.hasNext && (
              <Link href={buildCatalogHref(query, { page: result.pagination.page + 1 })}>
                Trang sau →
              </Link>
            )}
          </span>
        </nav>
      )}
      {complementary.status === "success" && complementary.products.length > 0 && (
        <section
          className={styles.recommendations}
          style={{ marginTop: 56 }}
          aria-labelledby="complementary-title"
        >
          <p className={styles.eyebrow}>AUREL / STYLING PAIRINGS</p>
          <h2 id="complementary-title">YOU MAY LIKE!</h2>
          <p>Có thể bạn sẽ thích · Gợi ý phối đồ đi kèm.</p>
          <CatalogContent result={complementary} premium label="Complementary styling suggestions" />
        </section>
      )}
    </section>
  );
}
