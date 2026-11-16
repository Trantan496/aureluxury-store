# AUREL — Search experience implementation

## Tóm tắt
- Chuyển `/products` thành AUREL Explore ba trạng thái, giữ Quiet Luxury/Warm Minimal và commerce actions thật.
- Không thêm dữ liệu, dependency, schema, migration hoặc API public mới.

## Files thay đổi
- UI: `src/app/products/page.tsx`, `loading.tsx`, `src/components/products/catalog-browser.tsx`, `catalog-browser.module.css`, `catalog-content.tsx`.
- Search/data: `src/features/catalog/catalog.ts`, `src/lib/catalog.ts`, `src/lib/db/queries/products.ts`.
- Tests: `tests/catalog.test.ts`, `tests/catalog-db.test.ts`; docs bắt buộc và log này.

## Database search
- Trim/collapse whitespace/lower/bỏ dấu; PostgreSQL `translate` trên name, description, brand, category, ProductProfile JSON row và variant color/size/SKU.
- Rank exact name → prefix → partial → exact category/brand → profile/variant → description. Count/page IDs trong RepeatableRead rồi hydrate cùng catalog mapper có image-rights và giá.
- Toàn bộ input dùng Prisma SQL parameters; active-only, 12/trang; không tải catalog về client, không N+1 hay concurrent query trên transaction client.

## UI và integration
- Server Component đọc `searchParams` Promise theo Next.js 16.4.3; không cần API mới.
- Form GET hỗ trợ Enter/nút, chip là query link; URL giữ query/page. Loading skeleton; error khác zero-result.
- Card giữ PDP, wishlist POST và bag-to-PDP chọn variant.

## Recommendation
- Zero-result lấy tối đa 8 Product active mới nhất. Schema chưa có featured flag/số bán public đáng tin cậy nên không giả best-seller; catalog rỗng/lỗi có fallback message.

## Kết quả kiểm tra
- `tests/catalog.test.ts`: 9/9 pass.
- PostgreSQL `search ranks...`: sandbox fail ENOMEM; rerun lộ cột staged `dynamicAttributes`; sửa bằng `row_to_json(pp)`; rerun đúng case pass 1/1.
- Scoped ESLint, `npm.cmd run typecheck`, `npm.cmd run build`: pass.
- Tổng application cases: 10; không chạy full suite theo giới hạn owner.

## Giới hạn
- Chưa browser visual/interaction QA desktop/mobile; chưa EXPLAIN/latency catalog lớn.
- Normalize expression chưa có index; chỉ đề xuất generated column/index sau benchmark.
- Exact-name tie dùng secondary order newest/id.
