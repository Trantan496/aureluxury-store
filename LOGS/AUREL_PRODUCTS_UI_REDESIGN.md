# AUREL — Product Listing Redesign

## Summary

Đã làm mới `/products` theo reference AUREL: heading editorial, filter panel warm ivory, product grid premium responsive và card surface/image/action controls tinh gọn.

## Files modified

- `src/app/products/page.tsx`
- `src/components/products/catalog-browser.tsx`
- `src/components/products/catalog-content.tsx`
- `src/components/products/catalog-product-actions.tsx`
- `src/components/products/catalog-browser.module.css`
- `docs/PROJECT_CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/SESSION_LOG.md`

## Design decisions

- Palette dùng ivory, cream, beige và espresso local trong CSS module; không đổi global theme.
- Filter desktop sáu cột, tablet ba cột, mobile hai/một cột; controls native giữ accessibility và query semantics.
- Card dùng ảnh thật, crop cover 4:3.15, serif title, metadata tối giản và hover/reduced-motion restraint.

## Functionality preserved

- Query filters, dynamic option lists, reset, pagination, empty/error states và PDP links giữ nguyên.
- Favorite dùng POST `/api/shop` action hiện có. Bag action dẫn tới PDP để chọn biến thể thật trước khi cart mutation.
- Premium card style chỉ opt-in trên CatalogBrowser; collection consumer cũ của CatalogContent không bị thay giao diện.

## Checks

- `npm.cmd run typecheck` — passed, exit 0.
- `npm.cmd run lint` — passed, exit 0.
- Không chạy business suite, build hay browser QA; 0 business test cases.

## Remaining issues

- Chưa visual QA desktop/tablet/mobile hoặc kiểm thử thao tác bằng session thật.

## Follow-up visual refinement — 2026-11-02

- Thêm nền studio neutral cục bộ phía sau listing; cân lại card grid, padding, image ratio/crop và chiều cao copy.
- Asset `bag.png` đã được kiểm tra và không có vòng tròn trắng. Media surface tắt `::before`/`::after` để loại lớp overlay trình bày mà không che ảnh hay thay asset DEMO.
- Không đổi query/API/route/auth/schema/database/dependency. `npm.cmd run lint` được chạy sau CSS change; không chạy business suite, build hay browser automation.

## Graphic background and media repair — 2026-11-02

- Tạo bằng built-in ImageGen asset `public/images/aurel/products-editorial-backdrop.png`: không gian plaster ivory, vòm kiến trúc bên phải và bóng lá, không có người/sản phẩm/chữ/logo/UI.
- Listing dùng asset này dưới lớp wash nhẹ để graphic vẫn rõ sau filter/card. Các card vẫn opaque để giữ readability.
- Để sửa vòng trắng hiển thị trong screenshot, CSS reset cả pseudo-element và composite/background/mask/filter trên `.productImage`, link chứa ảnh và `img`; không che ảnh bằng một lớp UI mới.
- Check sau follow-up: `npm.cmd run lint` — passed, exit 0. Không chạy business suite, build hay browser automation.

## Full-bleed background — 2026-11-02

- Đổi pseudo-element background từ giới hạn 1480px sang `calc((100vw - 100%) / -2)`, nên asset nền phủ đến cả hai mép viewport trong khi nội dung vẫn theo max-width listing.
- Check: `npm.cmd run lint` — passed, exit 0.

## Vietnamese serif repair — 2026-11-02

- Storefront serif chuyển sang `Times New Roman`/`Cambria`; heading Việt được tắt negative letter-spacing. `npm.cmd run lint` và `npm.cmd run typecheck` đều passed, exit 0.

## Search entry consolidation — 2026-11-02

- Forms and search links now target `/products`; `/search` redirects to `/products` while preserving query parameters for compatibility. `npm.cmd run lint` and `npm.cmd run typecheck` passed, exit 0.
