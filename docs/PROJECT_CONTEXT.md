# Trạng thái dự án — Fashion Store

## Tạo 2 voucher thật & Chuyển hướng thẳng sang cổng payOS khi thanh toán — 16/11/2026
- **Tạo 2 voucher hoạt động trong PostgreSQL** (xác nhận qua `/admin/vouchers` và checkout thật):
  - `AUREL50K`: giảm cố định `50.000 VND`, đơn tối thiểu `200.000 VND`, `usageLimit: 500`, `perUserLimit: 10`, hiệu lực `2026-11-01`–`2027-12-31`.
  - `AUREL15`: giảm `15%` (tối đa `250.000 VND`), đơn tối thiểu `300.000 VND`, `usageLimit: 500`, `perUserLimit: 10`, hiệu lực `2026-11-01`–`2027-12-31`.
- **Chuyển hướng thẳng sang trang thanh toán payOS (`https://pay.payos.vn/...`) và quay lại `/checkout/success` khi thành công**:
  - `src/features/payments/rules.ts`: Bổ sung helper `payosRedirectUrl(payment)` kiểm tra trạng thái pending, không cần đối soát và xác thực URL `https://pay.payos.vn` qua `hostedCheckout()`.
  - `src/components/shop/checkout-view.tsx` & `src/components/shop/shop-client.tsx`: Sau khi tạo đơn `PAYOS`, gọi ngay `paymentRequest(orderId, "create")` để lấy `checkoutUrl` và chuyển hướng trình duyệt trực tiếp qua `window.location.assign(targetUrl)` thay vì mở modal VietQR trên site; chỉ hiển thị fallback `<PayosPayment>` nếu bước tạo phiên payOS bị lỗi.
  - `src/components/shop/payos-payment.tsx`: Tự động chuyển hướng khi `autoCreate && !returnMode`, xóa khóa `aurel-payos-order` trong `sessionStorage` khi quay về `/checkout/success` hoặc `/checkout/cancel` hay đã `PAID`, mở link cùng tab và giảm chu kỳ reconcile ở `/checkout/success` xuống `32s`.

## Lưu mã nguồn GitHub — 16/11/2026
- Khởi tạo Git nhánh `main`; đích lưu mã nguồn riêng tư: `Trantan496/aureluxury-store`. Đây là lưu source, không triển khai hosting.
- `.gitignore` loại secrets, DB/runtime, uploads, môi trường Python và trọng số AI. README đã thay giá trị trùng secret cục bộ bằng placeholder. Video lớn dùng Git LFS.
- CatVTON và DM-VTON là submodule upstream; thay đổi cục bộ DM-VTON lưu trong `backend/dm-vton-local.patch`. Khi clone xem hướng dẫn README.
- Kiểm tra source staged không phát hiện giá trị secret đã đối chiếu; không chạy lại app test vì không đổi logic. Whitespace cũ còn tồn tại; không sửa lan rộng.
- Initial commit `489e0e9` đã push thành công lên GitHub, LFS 1/1 object hoàn tất. Thay đổi checkout xuất hiện sau commit được giữ riêng trong working tree; khi cài máy mới cần cấu hình env, DB và tải model riêng.

## Hoàn thiện Virtual Try-On cho quần (`lower`) & túi xách (`bag`) — 15/11/2026
- **Khắc phục thử quần (`cloth_type = "lower"`) trong `backend/tryon-service/app.py`**:
  - Bổ sung `"Belt"` vào `MASK_CLOTH_PARTS["lower"]` / `["overall"]` và đưa `Left-leg` / `Right-leg` (`leg_mask`) vào `_build_schp_masks` cho `part in ("lower", "overall")` (cùng cơ chế cắt vùng bắp chân dưới nếu người và đồ đều là quần short, và fallback mask khi vùng quần quá nhỏ) để thử quần dài lên người đang mặc quần short/váy phủ kín đến cổ chân thay vì bị cắt thành quần short.
  - Thêm `_prepare_person_canvas` (đệm ngang `cv2.BORDER_REPLICATE` cho ảnh dọc hẹp hơn `3:4` như `9:16` thay vì `resize_and_crop` xén mất đầu và giày/gấu quần) và cắt bỏ phần đệm thừa trong `_composite_preserve_identity`.
  - Thêm `_is_short_lower_garment` + `_prepare_garment_canvas` căn tỷ lệ quần short theo nửa trên thay vì phóng kín khung dọc. (Lưu ý thực nghiệm: khi người mẫu đang mặc quần dài tối/rộng và chọn thử quần short qua CatVTON 1-bước, vùng mask dài đến cổ chân vẫn có xu hướng suy luận thành quần dài màu kaki).
- **Hỗ trợ thử túi xách / phụ kiện (`cloth_type = "bag"`) trong `src/features/tryon/cloth-type.ts`, `src/components/tryon/tryon-studio.tsx` và `backend/tryon-service/app.py`**:
  - Mở rộng `TryOnClothType` thành `"upper" | "lower" | "overall" | "bag"`; `inferTryOnClothType` nhận diện danh mục `accessories` / `Phụ kiện` và sản phẩm túi (`clutch`, `tote`, `hobo`, `bumbag`, `holdall`, `sling`, `active gear`...) sang `"bag"`, đồng thời kiểm tra `LOWER_TOKENS` trước để `"QUẦN TÚI HỘP"` vẫn luôn là `"lower"`. `TryOnStudio` truyền thêm `productId` và `productSlug` cho sản phẩm catalog.
  - Thêm nhánh `_run_bag_tryon_sync` + `_extract_bag_rgba` trên CatVTON backend: tách alpha túi nền trắng bằng `distanceTransformWithLabels` (mở rộng màu nền trước sát mép để triệt tiêu viền halo trắng, giữ lõi canvas `1.0` không thủng lỗ), phát hiện túi cũ qua SCHP (`Bag`, ngưỡng diện tích `0.0008`), inpaint `INPAINT_NS` viền hẹp (`5x5`) và đặt túi mới theo vị trí tay/hông/túi cũ kèm bóng đổ tiếp xúc & đồng bộ độ sáng (~`0.5–0.9s/ảnh`).
- **Sửa race condition `/health` trong `backend/tryon-service/app.py`**: `/health` và `/try-on` yêu cầu `engine.ready_event.is_set() and not engine.loading` để tránh báo sẵn sàng trước khi `SCHP` và `_warmup()` hoàn tất.

## Bố trí Quản lý đơn hàng (`/admin/orders` & `/admin/orders/reports`) dạng bảng — 15/11/2026
- Giao diện `/admin/orders` theo ảnh mẫu kem/nâu: stylesheet riêng `seller-orders-design.module.css`, banner dùng asset `account-editorial-still-life.png` hiện có, KPI bo tròn/icon/nhóm đang chọn nâu, bảng rộng và cuộn nội bộ trên mobile. Header tài khoản chung vẫn dùng AdminHeader hiện có.
- Seller API bổ sung `items[].imageUrl` từ ảnh primary hiện tại của sản phẩm qua `publicProductImageUrl`; không thay snapshot tên/SKU/giá. Thiếu/lỗi ảnh hiển thị placeholder có nhãn; uploads bypass optimizer theo pattern OrdersView. Không đổi schema, phân quyền hay transaction cập nhật trạng thái.
- Tìm kiếm vẫn giới hạn trong trang hiện tại (20 đơn). Chưa nghiệm thu tương tác bằng phiên admin thật; bước tiếp theo mở `/admin/orders` trên runtime build mới, xác minh ảnh upload và thao tác bằng tài khoản admin.
- `src/components/admin/seller-orders.tsx`: Chuyển danh sách đơn hàng từ thẻ dọc lớn sang bảng (`table.ordersTable`) 6 cột (`Mã đơn & Thời gian`, `Khách hàng & Nhận hàng`, `Sản phẩm đặt mua`, `Thanh toán & Tổng tiền`, `Trạng thái`, `Thao tác`) kèm thanh tìm kiếm nhanh trên trang (`Mã đơn`, `Tên khách`, `SĐT`, `Sản phẩm`, `SKU`). Giữ nguyên toàn bộ 4 tab KPI (`READY`, `WAITING`, `REVIEW`, `ALL`), cảnh báo đối soát payOS, chi tiết giao dịch, nút cập nhật trạng thái và nút `In phiếu đóng gói ↗`.
- `src/components/admin/seller-reports.tsx`: Đồng bộ mục `100 đơn gần nhất` sang cùng giao diện bảng `table.ordersTable`.
- `src/components/admin/seller-orders.module.css`: Bổ sung style `.ordersTableCard`, `.tableToolbar`, `.tableSearchInput`, `.tableWrap`, `.ordersTable`, `.tableItemList` và nhóm nút `.btnTablePrimary` / `.btnTableOutline` / `.btnTableSubtle` với cuộn ngang mượt trên màn hình nhỏ.
- Kiểm tra cập nhật: 7/7 case SSR cuối cùng đạt (1 case chạy lại sau sửa lỗi encoding nhãn fallback), 2/2 browser bố cục trên fixture SSR riêng; targeted ESLint/typecheck và production build webpack cuối cùng đạt. Chưa kiểm tra tương tác/ảnh thật trong phiên admin; chưa restart runtime.

## Fix Virtual Try-On cho sản phẩm quần (`cloth_type = "lower"`) — 14/11/2026
- Nguyên nhân lỗi thử đồ với quần: frontend (`VirtualTryOnTrigger`, `TryOnStudio`) và `/api/try-on` chưa truyền `cloth_type` sang CatVTON (`http://127.0.0.1:8001/try-on`), khiến mọi sản phẩm đều mặc định `cloth_type = "upper"` (che áo thay vì che quần).
- Đã thêm helper `src/features/tryon/cloth-type.ts` (`inferTryOnClothType`, `normalizeTryOnClothType`) ánh xạ danh mục/tên sản phẩm sang `"upper" | "lower" | "overall"`, nối vào `ProductDetailView` → `VirtualTryOnTrigger`, `TryOnStudio` và `src/app/api/try-on/route.ts`.
- Đã test trực tiếp CatVTON `http://127.0.0.1:8001/try-on` với `cloth_type="lower"` và sản phẩm `quan-tay-nam-nam-moi-do-tuoi` (200 OK, 4.4s, thay quần chuẩn xác giữ nguyên áo/mặt/giày); 10/10 tests trong `tests/tryon-storefront-ui.test.tsx` pass, `eslint` pass, `npm run typecheck` pass. Cần `npm run build` và khởi động lại `npm run start` để áp dụng lên server production đang chạy.

## Prewarm HTTP `/try-on` tự động trong `npm run start` (`scripts/start-all.mjs`) — 14/11/2026
- `scripts/start-all.mjs`: Sau khi `waitForTryOnReady()` nhận `/health` `status: "ready"`, tự động gửi một request `POST /try-on` thật (`prewarmTryOnInference()`) bằng ảnh mẫu trong `public/images/aurel/` trước khi mở Next.js, giúp triệt tiêu độ trễ ~21 giây của request đầu tiên để người dùng thử đồ ngay từ lần bấm đầu tiên với tốc độ ~2–3 giây.
- Kiểm tra: `node --check scripts\start-all.mjs` và `npx.cmd eslint scripts/start-all.mjs` (pass, 0 lỗi).

## Warmup CatVTON đầy đủ khi khởi động & `npm run start` chờ AI sẵn sàng — 14/11/2026
- `backend/tryon-service/app.py`: Nâng `_warmup()` từ 2 bước (`blur_factor=9`) lên đầy đủ `INFERENCE_STEPS` (8 bước, `blur_factor=5`) kèm `_build_schp_masks`, `_protect_mask_head` và `_composite_preserve_identity` để tránh request đầu tiên của người dùng bị chậm ~24 giây hoặc dính `504 Gateway Timeout`.
- `scripts/start-all.mjs`: Thêm `waitForTryOnReady()` chờ `http://127.0.0.1:8001/health` trả `status: "ready"` (hoặc `unavailable`/timeout) trước khi khởi động Next.js, đảm bảo khi `npm run start` báo Ready thì toàn bộ tính năng Try-On AI đã được nạp và warmup xong.
- Kiểm tra: `py_compile` trên `backend/tryon-service/app.py` (pass) và `node --check scripts/start-all.mjs` (pass).

## CatVTON Try-On non-blocking startup (`backend/tryon-service/app.py`) — 14/11/2026
- Sửa nguyên nhân `npm run start` báo lỗi chưa kết nối CatVTON ngay sau khi vừa bật: trước đây `lifespan` gọi `engine.load()` đồng bộ khiến cổng `8001` không mở suốt ~2–2.5 phút nạp model + warmup.
- Chuyển `engine.load()` sang chạy nền (`asyncio.to_thread`) trong `lifespan` để cổng `8001` mở ngay, `/health` trả `status: "loading"` trong lúc warmup và `/try-on` tự chờ `ready_event` (tối đa 80s) trước khi trả `503`.
- Kiểm tra `py_compile` trên `backend/tryon-service/app.py` (pass) và xác nhận `GET http://127.0.0.1:3000/api/try-on` trên tiến trình đang chạy trả `status: "ready"` (`NVIDIA GeForce RTX 5060 Laptop GPU`).

## Căn giữa tiêu đề modal Virtual Try-On & sửa ảnh mẫu bên trái — 14/11/2026
- `src/components/products/virtual-tryon-modal.module.css`: Căn giữa khối `.hero` (`margin-left: 0`, `text-align: center` trên desktop và responsive `@media (max-width: 1250px)`).
- `src/components/products/virtual-tryon-modal.tsx`: Thay đường dẫn ảnh `.editorialModel` bị thiếu `/images/aurel/tryon-editorial-model-leaning-floor.webp` bằng ảnh có sẵn `/images/aurel/tryon-editorial-model-cutout.webp`.
- `tests/tryon-storefront-ui.test.tsx`: Cập nhật assertion kiểm tra `tryon-editorial-model-cutout.webp`.
- Kiểm tra: `VirtualTryOnTrigger` UI tests (3/3 pass), `eslint` (0 lỗi), `npm run typecheck` (pass) và `npm run build` (pass). Server `npm run start` (PostgreSQL + CatVTON AI `127.0.0.1:8001` + Next.js `http://127.0.0.1:3000`) đang chạy nền.

## Tích hợp `npm run start` khởi động toàn bộ hệ thống (PostgreSQL + CatVTON AI + Next.js) — 14/11/2026
- Tạo [start-all.mjs](file:///c:/Users/TAN/Downloads/E-commerce%20website/scripts/start-all.mjs) và cập nhật `"start": "node scripts/start-all.mjs"` trong [package.json](file:///c:/Users/TAN/Downloads/E-commerce%20website/package.json).
- Khi chạy `npm run start` (hoặc `npm run start -- --hostname 127.0.0.1 --port 3000` qua `start-aureluxury.cmd`):
  1. Tự động khởi động/kiểm tra PostgreSQL cục bộ (`scripts/local-db.mjs start`).
  2. Tự động kiểm tra cổng `8001` (`TRYON_PORT`); nếu chưa chạy sẽ tự khởi động dịch vụ **CatVTON Virtual Try-On** (`backend/tryon-service/.venv/Scripts/python.exe -m uvicorn app:app --host 127.0.0.1 --port 8001 --workers 1`), nếu đã chạy sẵn sẽ dùng lại không gây xung đột cổng.
  3. Khởi động `next start` và chuyển tiếp đầy đủ tham số CLI; tự động dọn tiến trình con khi nhận `SIGINT`/`SIGTERM`.
- **Kiểm tra**: `node --check scripts/start-all.mjs` + `eslint` (exit 0), `npx.cmd next build --webpack` (exit 0), chạy thật `npm.cmd run start -- --hostname 127.0.0.1 --port 3000` → `http://127.0.0.1:3000/api/try-on` (`HTTP 200`, `CatVTON` ready) và `https://aureluxury.store/products/noire-executive-clutch-2026-nam-gen-y` (`HTTP 200`).

## Khởi động & kiểm tra dịch vụ AI Virtual Try-On (CatVTON) cổng `8001` — 14/11/2026
- Đã khởi động dịch vụ cục bộ CatVTON qua [start-tryon.ps1](file:///c:/Users/TAN/Downloads/E-commerce%20website/backend/tryon-service/start-tryon.ps1) trên `http://127.0.0.1:8001`.
- Xác minh `GET http://127.0.0.1:8001/health` (`HTTP 200`) và `GET http://127.0.0.1:3000/api/try-on` (`HTTP 200`): `status: "ready"`, `model: "CatVTON (576x768)"`, `cudaAvailable: true`, `device: "NVIDIA GeForce RTX 5060 Laptop GPU"`; `tests/try-on-api.test.ts` đạt `4/4 pass`.

## Nâng cấp nút `VIRTUAL TRY-ON ↗` đen tuyền & vầng sáng lướt qua — 14/11/2026
- [virtual-tryon-modal.module.css](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/products/virtual-tryon-modal.module.css): Đổi nền nút `.tryOnPillBtn` sang đen tuyền (`#000000`, chữ `#ffffff`), chỉnh kích thước cân đối (`min-height: 44px; padding: 0 24px`) và tăng nhẹ cỡ chữ (`12.5px`, icon `17px`), đồng thời thêm hiệu ứng vầng sáng chéo lướt qua (`tryOnPillSheen`, `3.2s`) có hỗ trợ `prefers-reduced-motion`.
- **Kiểm tra**: `VirtualTryOnTrigger` (`tests/tryon-storefront-ui.test.tsx` `1/1 pass`), `npm.cmd run typecheck` (`exit 0`).

## Redesign bố cục Bình luận & Đánh giá (`ProductReviewsSection`) — 14/11/2026
- Căn chỉnh lại bố cục [product-reviews-section.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/products/product-reviews-section.tsx) & [product-reviews.module.css](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/products/product-reviews.module.css) theo đúng mẫu chủ dự án cung cấp, **giữ nguyên toàn bộ bảng màu hiện có**:
  - Header hiển thị gọn `Bình luận & Đánh giá` + đường kẻ ngang + `5.0/5`.
  - Khối composer xếp dọc trong `.inputShell` để nút đính kèm ảnh và nút `Gửi bình luận` nằm góc dưới-phải ô nhập, hàng 5 sao chọn đánh giá nằm bên dưới, khung có viền mảnh `var(--review-line)`.
  - Nút lọc `5 sao` dùng icon SVG `star` (`17×17px`) đồng bộ kích thước với `Có hình ảnh` và `Đã mua hàng`; khối `.list`/`.emptyList` có viền mảnh đồng nhất.
- **Kiểm tra**: `eslint src/components/products/product-reviews-section.tsx` (`exit 0`), `npm.cmd run typecheck` (`exit 0`).

## Bỏ mục `Try-On AI` khỏi thanh điều hướng `StorefrontHeader` — 14/11/2026
- Đã gỡ liên kết `Try-On AI` (`/try-on`) khỏi cả `heroNavigation` và `navigation` trong [storefront-header.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/layout/storefront-header.tsx); giữ nguyên route `/try-on` và nút Virtual Try-On trên trang chi tiết sản phẩm.
- **Kiểm tra**: `Case 5` (`tests/chat-system.test.tsx` `1/1 pass`), `eslint src/components/layout/storefront-header.tsx` (`exit 0`), `npm.cmd run typecheck` (`exit 0`).

## Try-on dùng ảnh nền trắng số5, upload gọn — 14/11/2026
- VirtualTryOnTrigger nhận productImages theo thứ tự gallery, dùng đúng productImages[4].url cho thumbnail và POST garmentImageUrl; không theo primary/variant/ảnh gallery đang xem, không fallback ảnh1. Thiếu ảnh5 thì disable trigger và báo rõ, không chặn mua hàng. Việc ảnh5 là nền trắng theo quy ước shop, không có phân tích pixel tự động.
- /try-on chọn ảnh5 cho catalog option cùng quy tắc; sản phẩm thiếu ảnh5 không được thêm vào danh sách thử. Fallback mẫu có nhãn/upload riêng vẫn như trước. Không sửa DB/schema/backend.
- Theo ảnh tham chiếu mới nhất: modal đã trở về phiên bản nền trắng #FFFFFF/topbar trắng AUREL/THỬ ĐỒ AI/đóng theo yêu cầu hoàn tác mới nhất, hero “Thử phong cách mới”, người mẫu trang trí bên trái, product5 + upload + CTA đen ở cột thao tác, hai frame xám #F4F4F4→#F0F0F0 bên phải. Mobile ẩn model và xếp controls trên hai frame. Khôi phục ảnh model gốc có nền; bỏ nền tường/sàn kéo dài và shadowalpha. Giảm chữ: hero52→38px (mobile30→25), mô tả17→14, frame22→18, upload20→17, CTA19→16; mobile CTA15px. Focus/disabled/validation/scan/result giữ nguyên.
- Paths: src/components/products/{product-detail-view,virtual-tryon-modal}.tsx; virtual-tryon-modal.module.css; src/app/try-on/page.tsx; tests/tryon-storefront-ui.test.tsx. Bước tiếp: refresh PDP và mở thử đồ, đối chiếu ảnh5; kết quả kiểm tra trong SESSION_LOG.

## Thu nhỏ chữ bên trong khung chat & làm mượt hiệu ứng hiện chữ Bot — 14/11/2026
- **Thu nhỏ nội dung trong `.drawer` ([chat.module.css](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/chat/chat.module.css))**: Giảm cỡ chữ và padding cho bong bóng tin nhắn (`11.5px`, `8px 12px`), thẻ gợi ý sản phẩm (`48×60px` thumbnail, tên/giá `11px`, danh mục/tồn `10px`), chip gợi ý nhanh (`11px`), thanh trạng thái (`11px`), ô nhập (`11.5px`) và màn hình chào.
- **Hiệu ứng chữ xuất hiện chậm và mượt hơn ([reply-text.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/chat/reply-text.tsx), `chat.module.css`)**: Nâng tốc độ gõ `ReplyText` từ `10ms` lên `26ms`/ký tự (`900–6500ms`) theo đường cong easing mượt (`easeInOutQuad`), kèm hiệu ứng `chatMessageReveal` (`420ms`) cho bong bóng và thẻ sản phẩm (tôn trọng `prefers-reduced-motion`).
- **Kiểm tra**: `tests/chat-system.test.tsx` (`9/9 pass`), `eslint` (`exit 0`), `npm.cmd run typecheck` (`exit 0`).

## Nền PDP kem sáng, lưu mã nền cũ — 14/11/2026
- Theo ảnh chủ dự án: đổi canvas trang chi tiết sản phẩm về kem sáng #F8F5F0 (sáng hơn nền gốc #F4F0E9; thay bản trắng #FFFFFF), cả lề ngoài gallery/information. Nền cũ #F4F0E9 đã lưu tại docs/DESIGN_SYSTEM.md và comment CSS; token toàn cục giữ để các trang khác dùng palette hiện hành.
- Thay đổi chỉ src/components/products/product-detail.module.css; dùng main:has(> .page) và background .page, áp dụng cả lỗi tải dữ liệu dùng cùng class. Không đổi ảnh, giá, tồn kho, nút hay modal.
- Bước tiếp: refresh trang sản phẩm để xem nền kem sáng. Kiểm tra/build/runtime ghi trong entry cuối SESSION_LOG.

## Virtual Try-On rộng và chuyển động — 14/11/2026
- TryOnStudio có CSS module riêng, khung tối đa 1600px, thẻ ảnh trang phục có trạng thái chọn, upload lớn và ảnh Trước/Sau rõ ràng. Mobile xếp dọc các panel; 2 ảnh giữ cạnh nhau từ 361px, màn nhỏ hơn xếp dọc.
- Motion CSS: panel xuất hiện, ánh sao thở, lưới/vệt quét trên ảnh trong khi chờ API, ảnh kết quả hiện dần. Tôn trọng prefers-reduced-motion; không tạo phần trăm hay kết quả giả. Khung quét chỉ trang trí, không phải vùng nhận diện do model trả về.
- Giữ API, CatVTON, danh mục thật, fallback mẫu ghi nhãn và deep-link sản phẩm. Khóa chọn ảnh/trang phục khi xử lý; thay trang phục xóa kết quả cũ và reset stage. Loading kết nối có nhãn riêng, không giả tên GPU.
- Paths: src/components/tryon/tryon-studio.tsx, tryon-studio.module.css; tests/tryon-storefront-ui.test.tsx. Không đổi schema/quyền/commerce. Modal PDP có stylesheet riêng theo mẫu trắng/đen mới; studio riêng giữ nguyên.
- Kiểm tra: 7 tình huống SSR và 3 browser (desktop chờ→success/download, mobile reduced motion, lỗi dịch vụ). Chi tiết lệnh, lần sửa/rerun và giới hạn xem session log. Backend GPU thật chưa kiểm thử trong lượt thiết kế này.
- Bước tiếp: mở /try-on trên runtime mới; dùng ảnh người thật để đánh giá chất lượng CatVTON trong lượt kiểm thử riêng.

- Bổ sung sau phản hồi: cửa sổ VIRTUAL TRY-ON ngay trong PDP cũng được đổi: dialog tối đa1680px/96dvh, layout trắng/đen theo ảnh mẫu; scan chỉ xuất hiện khi API pending. Mobile96dvh, body cuộn riêng, Escape/nút đóng giữ native dialog. Sửa CSS scope để PDP không ép font/nén hàng bước. Xác minh qua nút thử đồ của sản phẩm thật; API fixture không tạo kết quả GPU thật.
- Theo ảnh tham chiếu mới nhất: modal PDP có topbar thương hiệu nhỏ và hero “Thử phong cách mới”; không có thanh3bước. Trang /try-on riêng giữ giao diện hiện có.
- Asset minh họa mới: public/images/aurel/tryon-editorial-model.webp đang dùng trở lại; bản cutout giữ file nhưng không render, không phải kết quả try-on hoặc ảnh hàng thật. Báo cáo/nguồn/prompt: LOGS/TRYON_REFERENCE_2026-11-14.md.
- Files bổ sung: src/components/products/virtual-tryon-modal.tsx và virtual-tryon-modal.module.css. Bước tiếp chính xác: refresh trang sản phẩm và mở lại VIRTUAL TRY-ON; không cần chuyển sang /try-on để thấy giao diện mới.

## Bỏ dòng ghi chú `Mua thử bằng VND / COD DEMO. Không thu tiền trực tuyến.` trên PDP — 14/11/2026
- Đã gỡ khối `utilityInformation` hiển thị dòng `Mua thử bằng VND / COD DEMO. Không thu tiền trực tuyến.` trong [product-detail-view.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/products/product-detail-view.tsx).
- **Kiểm tra**: `eslint src/components/products/product-detail-view.tsx` (exit 0), `npm.cmd run typecheck` (exit 0).

## Màn hình tạo tài khoản thành công — 14/11/2026
- /register giữ bố cục hai cột cả sau đăng ký: ảnh editorial bên trái, card thành công gọn trong panel bên phải. Card tối đa560px, logo160px (mobile132px), heading tối đa38px, nút220×46px. Dùng logo gốc, Đăng nhập/Gửi lại email và state email hiện có. Không query/localStorage hoặc route success giả.
- RegistrationSuccess dùng submitAuth verify hiện có; pending khóa nút, success/error có thông báo accessible. Delivery tắt thì giải thích đúng, không cho gửi lại. Backend auth/policy/database giữ nguyên.
- Đạt9 tình huống UI có APIfixture, gồm desktop/mobile/resend429/signupfailure/login/deliveryoff/finalfit/live; hai lỗi assertion harness và stale live manifest đã sửa, chỉ retry case lỗi. Lint/typecheck và2snapshot productionbuild đạt. Live3000 đã restart rootbuild chung mới và kiểm tra đạt; không tạo user/gửi mail thật.
- Files:src/components/auth/{register-page,register-form,register-experience,registration-success}.tsx và registration-success.module.css. Báo cáo:LOGS/REGISTRATION_SUCCESS_2026-11-14.md; ảnh/results:LOGS/registration-success-2026-11-14/.
- Điều chỉnh gọn bên phải đã đạt4/4case desktop/mobile/resend/live; lint/typecheck/productionbuild đạt. Live3000 chạy .local/registration-compact/final-release qua serve-final.mjs3000,envroot/.datajunction. Root.next cũ chỉ rollback, cần build trước khi npmstartroot. Báo cáo mới:LOGS/REGISTRATION_COMPACT_2026-11-14.md.
- Bước tiếp:Ctrl+F5 /register. Chưa kiểm signup/email inbox thật/publicdomain. Thay đổi try-on phát sinh sau snapshot vẫn ở source, cần build lượt agent đó để lên live.

## Bỏ mục `Essentials` khỏi thanh điều hướng `StorefrontHeader` & Production Build — 14/11/2026
- Đã gỡ liên kết `Essentials` (`/products?category=essentials`) khỏi mảng `navigation` trong [storefront-header.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/layout/storefront-header.tsx) theo yêu cầu chủ dự án; giữ nguyên các mục `Women`, `Men`, `Accessories`, `Collections`, `Try-On AI`, `AI Recommendations`.
- **Kiểm tra & Build**: `Case 5` (`tests/chat-system.test.tsx`) đạt, `eslint src/components/layout/storefront-header.tsx` (exit 0), `npm.cmd run typecheck` (exit 0), và `npx.cmd next build --webpack` (`BypassSandbox: true`, exit 0, TypeScript 4.1s, 10/10 static pages).
- **Lưu ý runtime cổng `3000`**: Tiến trình `next start` (PID `11260`) đang lắng nghe trên cổng `3000` từ trước lúc build; cần restart tiến trình này để phục vụ bản `.next` vừa build.

## Mở trang sản phẩm từ đầu — 14/11/2026
- SmoothScroll theo dõi pathname, reset ngay vị trí/đích Lenis khi điều hướng mới đến /products/[slug]; reduced motion dùng native instant. Giữ Back/Forward, hash và thay đổi query cùng pathname. Không đổi database hoặc module commerce.
- ESLint, typecheck và2snapshot webpack productionbuild đạt;7case browser đạt (desktop/related/inflightwheel/mobile/reduced/Back/Forward). Hai thăm dò runtimecũ không tái hiện được lỗi screenshot; tổng9tìnhhuống đãchạy.
- Báo cáo:LOGS/PDP_SCROLL_FIX_2026-11-14.md; ảnh/results:LOGS/pdp-scroll-2026-11-14/. Preview3026 hoạt động. Agent khác đã buildroot mới; đã xác minh chunk có fix, giữ thay đổi chat/footer và khởi động rootbuild trên3000 sau khi port trống. Live2535x1348 đạt:scrollY2164→PDP0. Tổng10case gồm2baseline+7preview+1live. Bước tiếp:Ctrl+F5; chưa kiểm publicdomain hoặc phiên đăng nhập cũ.

## Fit khung trò chuyện chính `/messages` vừa khít màn hình, ẩn Footer & sửa header chat — 14/11/2026
- **Ẩn Footer trên các route nhắn tin (`src/components/layout/footer.tsx`)**: Bổ sung kiểm tra `pathname === "/messages" || pathname.startsWith("/messages/")` trả về `null` để không render `EditorialFooter` bên dưới giao diện trò chuyện chính và trang chờ `/messages/connecting`.
- **Fit viewport (`src/components/chat/chat.module.css`)**: Đặt `min-height: 0` cho `.messengerShell` (giữ `height: calc(100dvh - 56px)`) và `.threadList` (`flex: 1; min-height: 0; overflow-y: auto`) để khung chat chính luôn vừa khít chiều cao màn hình khả dụng, không sinh thanh cuộn trang ngoài.
- **Bỏ nút Lưu & sửa menu 3 chấm bị cắt (`src/components/chat/chat-panel.tsx`, `chat.module.css`)**: Bỏ nút bookmark `Sản phẩm đã lưu` trên header chế độ `variant="page"` (giữ nút mở toàn màn hình trên `drawer`); đổi `.panelHeader` sang `overflow: visible; z-index: 10;` và bọc ảnh nền `.headerEditorialAccent` trong `.headerEditorialAccentWrap` (`overflow: hidden`) để menu thả xuống từ nút `...` hiển thị đầy đủ, không bị che/cắt bởi header.
- **Kiểm tra đã chạy**: `tests/chat-system.test.tsx` (**9/9 pass**, Case 6 xác nhận bỏ nút `Sản phẩm đã lưu` và giữ nút menu `...`, Case 9 kiểm tra `Footer` ẩn trên `/messages`), `npx.cmd eslint` các file đổi, `npm.cmd run typecheck` (exit 0). Chưa chạy `next build` và chưa nghiệm thu trực quan trên trình duyệt.
- **Bước tiếp theo**: Mở `/messages` trên trình duyệt (refresh nếu cần) để xác nhận khung chat vừa khít màn hình, không còn nút Lưu, và menu `...` xổ xuống hiển thị rõ ràng.

## Ảnh sản phẩm nền trắng — 14/11/2026
- Đã rà toàn bộ44 Product trong DB local aurel_ai: thêm36 ảnh, thay1 ảnh nền đen; 44/44 sản phẩm có5ảnh. 34sản phẩm cập nhật,10giữ nguyên. ID82 bổ sung3chi tiết mặt trước+1packshot.
- Ảnh mới là AI dựa theo tên/ảnh gốc; nguồn AI được ghi metadata, WebP trong ImageAsset; ảnh cũ giữ nguyên để rollback. Không đổi schema/routes/frontend/giá/tồn kho.
- Log đầy đủ: LOGS/PRODUCT_PACKSHOTS_2026-11-14.md và LOGS/product-packshots-2026-11-14/{before,plan,applied,verification}.json. Nguồn ảnh và script tại .local/product-image-audit/.
- Kiểm tra7tình huống đạt; giữ nguyên30thay đổi ảnh chi tiết túi phát sinh song song. ID82 vẫn ẩn, ảnh public404 đúng policy. Bước tiếp: chủ shop đối chiếu chi tiết ảnh AI với hàng thật; refresh PDP để xem. Chưa kiểm tra DB remote riêng.


## Cập nhật khung chat `aurel Official` & Trang chờ Chatbot `/messages/connecting` — 14/11/2026
- **Khung chat nổi & tin nhắn Bot (`src/components/chat/chat-panel.tsx`, `chat.module.css`)**:
  - Đổi tiêu đề khung chat nổi (`variant="drawer"`) khi ở kênh Bot từ `Trợ lý AUREL` sang **`aurel Official`** và trạng thái dưới thành **`Đang hoạt động`**.
  - Gỡ bỏ badge **`AI`** (`.roleBadgeBot`) cạnh tên người gửi trong khung tin nhắn Bot.
  - Thu gọn kích thước hộp thoại chat nổi `.drawer` xuống `min(350px, calc(100vw - 32px))` × `min(490px, calc(100dvh - 96px))` cùng padding/header gọn hơn (`34px` avatar, `14.5px` title).
- **Trang chờ Chatbot `/messages/connecting` (`src/app/messages/connecting/page.tsx`, `chat.module.css`)**:
  - Thiết kế lại theo mẫu minh họa Quiet Luxury nền kem với 2 lớp sóng SVG uốn lượn chữ S ở góc trên-trái và góc dưới-phải đúng nguyên tác (`connectingWaveTopSvg`/`connectingWaveBottomSvg`), bổ sung các cánh hoa & hạt sáng trôi lơ lửng (`connectingPetal`, `connectingOrb`), vòng hào quang thở (`connectingAura`) và vòng quỹ đạo xoay nhẹ (`connectingOrbitRing`).
  - Dựng **SVG illustration** (`AurelConnectingGraphic`, `158×158px`) với nhân vật nằm nghiêng chéo đầm xanh navy viền ren kem–vàng champagne, mũ nơ navy, tay đan trước ngực, dải lụa mờ sau lưng sát nguyên tác; bao quanh bởi vòng hoa 5 cánh nở nhịp (`connectingFlowerBloom`), cành lá đung đưa (`connectingSway`), sao 4 cánh xoay lấp lánh (`connectingStarSpin`) và chữ **`A U R E L`** uốn cong.
  - Chu kỳ chờ **4 giây (`4000ms`)**: tiêu đề **`Bạn đợi một chút nhé`** ánh lụa lướt ngang; phụ đề chuyển chậm rãi mỗi **`2000ms`** qua các thông điệp; nút pill **`← Quay lại`** và thanh tiến trình `4000ms` chạy mượt kèm hiệu ứng shimmer (hỗ trợ `prefers-reduced-motion`).
- **Kiểm tra đã chạy**: `tests/chat-system.test.tsx` (`8/8 pass`), `npx.cmd eslint` 3 file đổi (exit 0), `npm.cmd run typecheck` (exit 0). Chưa chạy `next build` và chưa nghiệm thu trực quan trên trình duyệt.
- **Bước tiếp theo**: Mở storefront trên trình duyệt, click 1 lần vào icon nhắn tin để xem trang chờ `/messages/connecting` và double-click để xem khung chat `aurel Official` thu gọn.

## Sửa ảnh sản phẩm có chữ chồng — 14/11/2026
- Đã rà soát snapshot 184 ảnh/44 sản phẩm; thay30 ảnh có caption bitmap của10 sản phẩm túi bằng ảnh chân thật không chữ qua built-in image_gen. ProductImage ID:195,196,197,199,200,201,203,204,205,207,208,209,216,217,218,220,221,222,224,225,226,231,232,233,237,238,239,241,242,243. Ảnh tốt giữ nguyên.
- Database đã cập nhật trực tiếp bằng asset UUID mới, so sánh/khóa từng bản ghi để không đè agent song song;0 xung đột,0 thay đổi ngoài phạm vi tại lúc xác minh. Không sửa runtime/schema/quyền/giá/tồn kho, không cần restart.
- Kiểm lại30/30 hash/metadata; HTTP toàn bộ184:183 ảnh công khai200+WebP,1ảnh của sản phẩm đang tắt404 đúng quyền.10/10 PDP200 dùng URL mới, không còn URL ảnh cũ. ESLint script đạt; không build/typecheck/fullsuite vì chỉ sửa data và script vận hành. Rà soát toàn bộ ảnh theo yêu cầu cụ thể vượt mức10 case thông thường; ghi rõ trong log.
- Báo cáo: LOGS/PRODUCT_IMAGE_TEXT_REPAIR_2026-11-14.md. Script:scripts/repair-product-image-text.mjs. Ảnh gốc/mới, manifest URL trước/sau, prompts và verification:data/repairs/product-image-text-2026-11-14/.
- Tồn đọng: chưa nghiệm thu DOM desktop/mobile/publicdomain. Tổng184 là snapshot; agent khác có thể thêm ảnh sau đó. Bước tiếp:Ctrl+F5 PDP; audit delta ảnh mới sau khi tác vụ song song xong.

## Mọi tài khoản được đánh giá sao — 13/11/2026
- Theo yêu cầu mới: đăng nhập là được đánh giá, không cần mua/nhận hàng. Một review/khách/sản phẩm; giữ sửa/xóa, ẩn và chống gửi nhanh. Badge/bộ lọc Đã mua hàng vẫn chỉ căn cứ đơn DELIVERED thật.
- ProductReview.orderItemId nullable; có đơn phù hợp thì liên kết, không có thì null, không tạo đơn giả. PublicProductDiscussion hiển thị mọi review APPROVED, histogram và API review cũ tính mọi review công khai. Điều kiện canRate chỉ cần tài khoản và chưa có review. Giữ Auto5sao/config của tác vụ song song, không thay trong lượt này.
- Đã áp scoped migration 20261114020000_open_account_ratings sau backup/restore/rehearsal, giữ data và sequences cũ. Manifest .local/backups/aurel_ai_reviews_restore_1794588009361_74be54.dump.verified.json. Không migrate-all hoặc fixture main.
- Đạt8tình huống: 2restore/rehearsal, 3backendPG (nonbuyer/guest/buyerbadge), 2regression APIcũ (nonbuyer/duplicate), 1UIgửi4sao. ESLint file đổi, root typecheck, prisma generate và snapshot webpack build đạt. Không fullsuite hoặc session/publicE2E thật.
- Runtime3000: .local/open-account-ratings/release, launcher .local/open-account-ratings/serve.mjs3000, envroot/.datajunction/loopback; giữ rootbuild/snapshot cũ rollback. Bản source khớp toàn bộsrc/prisma trước đổi.
- Bước tiếp: Ctrl+F5, đăng nhập, chọn sao và nhận xét để gửi. Chưa thêm đánh giá chỉ sao không có nhận xét; không thay chức năng khác.

## Bình luận & Đánh giá Premium Minimal Luxury — 13/11/2026
- Đã thay Box3 PDP bằng summary/histogram thật, composer avatar+ảnh, feed Facebook-style, filter/sort/phân trang10root, likes, reply4cấp và menu chủ nội dung/ADMIN xóa/ẩn. Gửi/sửa/xóa/like/reply cập nhật tại chỗ; sao trên giá đồng bộ theo slug. Giữ nguyên chức năng mua hàng, gallery, try-on và dữ liệu/auth cũ.
- Tính mọi review APPROVED từ tài khoản, không yêu cầu đơn mua; khi sản phẩm chưa có đánh giá thật và chế độ Auto 5 sao trong Admin (`/admin/reviews`, `.data/aurel-auto-rating.json`) đang bật, cả cụm sao trên giá (`getApprovedProductRatingSummary`) và summary Box 3 (`getDiscussion`) đều hiển thị mặc định `5.0 (1)` (không tạo đơn hay review giả trong PostgreSQL).
- Đã scoped-apply 20261114010000_product_discussion sau backup/restore/rehearsal. Thêm ProductDiscussion/Like/Image và PublicProductDiscussion view + trigger liên kết bảng cũ. Ảnh WebP BYTEA,3ảnh/4MB, quyền view/no-store; Origin/session/server authorization/Serializable/idempotent like, rate10s. Không migrate-all/seed/main fixtures.
- Kiểm tra: 6backend thật trên DB restore +2workflow ChromeUI fixture TEST và restore/rehearsal đạt; số tình huống độc lập thực tế14 (vượt10 do UI gộp thao tác, ghi rõ trong PRODUCT_DISCUSSION); lint toàn dự án, typecheck và webpack snapshot build đạt. Không fullsuite; nhánh chưa kiểm tra ghi rõ trong docs/PRODUCT_DISCUSSION.md.
- Paths: src/features/reviews/discussion-{input,types,service,http}.ts; src/app/api/product-discussion/; src/components/products/product-reviews-section.tsx và CSS; product-rating.tsx; scripts/activate-product-reviews.ts; tests/product-discussion.test.ts.
- Manifest .local/backups/aurel_ai_reviews_restore_1794584261355_cf4870.dump.verified.json. Không sửa nội dung/đơn/tài khoản cũ. Snapshot hiện tại .local/review-composer-fix/release; bản discussion-redesign trước còn để rollback; vận hành/kiểm thử/giới hạn xem docs/PRODUCT_DISCUSSION.md.
- Bước tiếp: Ctrl+F5 PDP; nghiệm thu signed-cookie khách/shop thật và public/mobile trong lượt test mới. Legacy adminReply giữ text, tương tác đầy đủ dành cho reply mới; thread lớn chưa phân trang con. Root build cũ không phải release mới.


## Auto đánh giá 5 sao mặc định từ Admin (`/admin/reviews`) — 13/11/2026
- **Quy tắc dự án ([AGENTS.md](file:///c:/Users/TAN/Downloads/E-commerce%20website/AGENTS.md))**: Đã cập nhật theo yêu cầu chủ dự án, cho phép cấu hình đánh giá 5 sao mặc định từ trang quản trị khi chưa có đánh giá thật.
- **Lưu trữ & Nghiệp vụ (`src/features/reviews/auto-rating.ts`, `service.ts`, `types.ts`)**:
  - Lưu trạng thái bật/tắt tại `.data/aurel-auto-rating.json` qua `createAutoRatingStore` (atomic write, lock-safe), không tạo đơn hàng giả hay bản ghi `ProductReview` giả.
  - `resolveProductRatingWithAuto(realSummary, autoState)`: Nếu sản phẩm đã có đánh giá thật (`APPROVED` từ đơn `DELIVERED`) thì luôn giữ nguyên số sao thực tế; nếu chưa có đánh giá thật và auto 5 sao đang bật thì trả về `{ average: 5, count: 1 }` trong resolver lịch sử. Cập nhật thiết kế discussion mới: public summary chỉ dùng review thật, không gọi fallback này; store và điều khiển Admin được bảo toàn.
- **Cổng Admin (`/admin/reviews`, `/api/admin/reviews`)**:
  - Thêm khối `Auto đánh giá 5 sao toàn bộ sản phẩm` trên [seller-reviews.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/admin/seller-reviews.tsx) với nút `Auto đánh giá 5 sao tất cả sản phẩm` và `Tắt tự động 5 sao`, gọi `POST /api/admin/reviews` (`action: "auto_five_star"`) được bảo vệ bằng quyền `ADMIN` và kiểm tra CSRF Origin.
- **Kiểm tra đã chạy**: `tests/auto-rating.test.tsx` đạt **4/4 case**; `eslint` 6 file liên quan đạt (0 lỗi); `npx.cmd next build --webpack` (`BypassSandbox: true`) đạt (exit 0). (Hai lỗi module tạm thời trong lúc task discussion thay file đã hết; root typecheck hiện đạt trong lượt discussion, xem entry hiện hành).

## Nút Virtual Try-On đặt góc phải dưới gallery cột trái — 13/11/2026
- **Vị trí & Giao diện (`ProductDetailView` + `VirtualTryOnTrigger`)**:
  - Giữ `<VirtualTryOnTrigger />` bên dưới `<EditorialGallery />` trong `.gallerySticky` của cột trái (`.galleryTryOn` trong [product-detail-view.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/products/product-detail-view.tsx)).
  - Thay thế toàn bộ banner cũ thành 1 nút pill duy nhất **`VIRTUAL TRY-ON ↗`** căn lề phải (`.tryOnActionRow { justify-content: flex-end; }`, `.tryOnPillBtn` bo tròn `999px`, nền nâu espresso chuyển sắc nhẹ + viền sáng ấm phía trên, icon dáng người nét mảnh bên trái) trong [virtual-tryon-modal.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/products/virtual-tryon-modal.tsx) & [virtual-tryon-modal.module.css](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/products/virtual-tryon-modal.module.css). Liên kết `Mở phòng thử đồ AI ↗` (`/try-on?garmentUrl=...`) được giữ trong phần đầu hộp thoại `<dialog>`; toàn bộ logic modal và `/api/try-on` giữ nguyên.
- **Kiểm tra đã chạy**: `npx.cmd tsx --tsconfig tests/tsconfig.ui.json --test --test-name-pattern="VirtualTryOnTrigger" tests/tryon-storefront-ui.test.tsx` (**1/1 đạt**); `eslint` 2 file liên quan đạt (0 lỗi); `npx.cmd next build --webpack` đạt (exit 0, TypeScript 20.7s, 10/10 static pages).

## Chatbot Groq Qwen + PostgreSQL RAG — 13/11/2026
- Đã sửa lỗi RAG trả quần/áo nữ cho câu hỏi áo khoác nam: `retrieval-plan.ts` tách ý định, danh mục, gender, từ khóa cụ thể/focus; `lib/db/queries/chat-products.ts` SQL tham số hóa khóa active/category/gender và AND từ khóa trước LIMIT3. Context có gender/profile/giá/biến thể thật; không dùng OR tag rộng của search storefront cho chat. Không sửa query tìm kiếm toàn website.
- Không truy xuất/gắn thẻ cho lời chào, không lặp thẻ ở câu hỏi tiếp nối/size. Thẻ chỉ hiện sau text, có giá/size/màu/tồn thật. Qwen trả 2–3 câu ngắn, bỏ URL trong văn bản, link nằm trên thẻ. Ba chấm wave thay chữ đang soạn; reduced motion tĩnh. ReplyText dùng state cục bộ, không sửa DOM textContent; không kéo về đáy khi đọc lịch sử, vùng log cuộn native qua data-lenis-prevent.
- Giữ nút Bật trợ lý AI theo channel/mode, mặc định BOT, reset drawer; STAFF không được bật BOT qua API. Ba key chỉ ở env server-side, cooldown/fallback như trước. Chưa thêm vector database hoặc embeddings; parser nhóm trang phục hữu hạn, cần mở rộng dựa trên câu hỏi thất bại thực tế.
- Lượt RAG/UX này đạt10/10:7case PostgreSQL/provider (4Qwen thật) +3browser (sequencing, ổn định scroll, mobile reduced motion). Lint toàn dự án ở lượt đầu, lint file đổi và typecheck cuối đạt. Build release cuối đạt sau giữ thay đổi reviews/PDP song song và sửa tối thiểu ngoặc CSS bị lỗi trong product-detail.module.css.
- Live3000 hiện chạy `.local/chat-rag-v2/release`, source đã đối chiếu không lệch workspace lúc phát hành, Ready; bind127.0.0.1, env root, `.data` junction về root. Giữ root/snapshot cũ để rollback; dev3005/preview3010 không đổi. Không gửi test lên public domain trong tác vụ này; đã dùng đủ10case, không thêm smoke nghiệp vụ sau deploy.
- Báo cáo hiện hành: `docs/CHATBOT_RAG_RELEVANCE_2026-11-13.md`; test `tests/chat-rag-retrieval.test.ts`. Bước tiếp: Ctrl+F5, thử áo khoác nam/trench/blazer và câu chào; bổ sung policy/bảng size thật, QA wheel/trackpad vật lý nếu còn triệu chứng. Tin cũ/bảng size cũ giữ lịch sử, không coi là bằng chứng chính sách. Các kết quả lượt tích hợp/hồi phục trước xem SESSION_LOG/CHATBOT_RAG.

## Logo AUREL cho Favicon trình duyệt & Trợ lý AUREL trong khung chat — 13/11/2026
- **Thay đổi đã thực hiện**:
  - Tạo asset logo AUREL cắt gọn cân đối từ ảnh gốc chủ dự án bằng `sharp`: [aurel-logo.webp](file:///c:/Users/TAN/Downloads/E-commerce%20website/public/images/aurel/aurel-logo.webp) (`256×256` WebP dùng cho avatar UI), [icon.png](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/app/icon.png) (`256×256` PNG bo tròn nền kem trong suốt góc ngoài cho tab trình duyệt), và [apple-icon.png](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/app/apple-icon.png) (`180×180` PNG).
  - [chat-panel.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/chat/chat-panel.tsx) & [chat.module.css](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/chat/chat.module.css): Thêm helper `AurelLogoAvatar` dùng chung, thay chữ `A` trên tiêu đề **Trợ lý AUREL** (`avatarWrapHeader`), màn hình chào (`avatarWrapLg`), và thay chữ `AI` ở chân tin nhắn bot (`avatarWrapXs`) bằng logo AUREL; giữ nguyên chữ `N` cho `Nhân viên AUREL`.
  - [messages-page-view.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/chat/messages-page-view.tsx): Dùng `AurelLogoAvatar` cho dòng hội thoại `AUREL Concierge Bot` trong cột **Đoạn chat**.
  - [chat-system.test.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/tests/chat-system.test.tsx): Bổ sung kiểm tra render `/images/aurel/aurel-logo.webp` trong Case 6.
- **Kiểm tra đã xác minh**: `npx.cmd eslint src/components/chat/chat-panel.tsx src/components/chat/messages-page-view.tsx tests/chat-system.test.tsx` (exit 0), `npm.cmd run typecheck` (exit 0), `npx.cmd tsx --tsconfig tests/tsconfig.ui.json --test tests/chat-system.test.tsx` (`8/8 pass`), `npx.cmd next build --webpack` (exit 0, xuất `/icon.png` và `/apple-icon.png`).
- **Tồn đọng / Bước tiếp theo**: Chưa nghiệm thu trực quan trên trình duyệt live (hard-refresh tab trình duyệt và mở khung chat Trợ lý AUREL để kiểm tra favicon + avatar mới).

## Sửa ảnh thumbnail “Đơn của tôi” — 13/11/2026
- Nguyên nhân: OrdersView thiếu unoptimized cho ảnh upload; optimizer bị chặn theo policy. Hai ảnh của đơn3/5 trong screenshot vẫn trả HTTP200 (16.262/25.054byte), qua optimizer trả400.
- Runtime chỉ đổi `src/components/account/orders-view.tsx`: upload tải trực tiếp như cart/checkout; static giữ optimizer; thiếu/lỗi ảnh có icon fallback accessible; key theo URL cho phép phục hồi khi đổi nguồn. Không đổi dữ liệu/quyền/cache/đơn/giá.
- Đạt8case độc lập, lint/typecheck và production snapshot build đầy đủ TypeScript. Fixture chỉ kiểm tra UI, không tạo đơn hoặc lấy PII; chưa dùng phiên khách thật để QA trang protected.
- Preview3010 đã cập nhật snapshot mới ở `.local/order-image-check/app`; cần refresh. Không build đè hoặc restart live3000/dev3005, chưa deploy public.
- Báo cáo: `LOGS/ORDER_THUMBNAIL_FIX_2026-11-13.md`. Bước tiếp theo: refresh trang đơn hàng ở preview/dev; đưa thay đổi vào lượt deployment có kiểm soát nếu dùng domain production.

## Hệ chuyển động AUREL theo Charles UX Animation — 13/11/2026
- Đã áp dụng skill GitHub được chủ dự án chỉ định. Token CSS chung và quy tắc phản hồi được dùng cho storefront/catalog/PDP/wishlist, auth/account, shop/checkout, chat và admin; không thêm thư viện animation.
- `src/app/motion.css`, `MotionPreferences` và `MotionPanel` quản lý timing/curves, native dialog enter/exit, inert/focus, popover/drawer có thể đảo chiều và reduced motion. Các CSS module hiện có đã được chuẩn hóa, không còn transition all trong CSS được rà soát.
- Card giữ reveal 200ms/stagger 40ms đã A/B; chỉ reveal một lần khi từ offscreen vào viewport, không ẩn lại nội dung first paint. Smoke case đo 285,1ms sau scroll; đây không phải A/B public mới. Không đổi ảnh gốc, cache/quyền, query/giá/tồn kho hoặc luồng thanh toán.
- Đã sửa lỗi production render catalog phát hiện trong nghiệm thu: chuyển `buildCatalogHref` từ file use client sang `features/catalog/catalog-href.ts`; client vẫn re-export, server import trực tiếp helper thuần. Header cập nhật theo layout streamed bằng ResizeObserver, giữ các thay đổi menu/try-on khác trong workspace.
- Kiểm tra: lint/typecheck đạt; production snapshot build có TypeScript đầy đủ đạt; 8 case browser + 2 unit empty/error đạt (10 tình huống độc lập, retry được ghi). Không gửi message/đơn hoặc thanh toán thật.
- Preview hiện tại: `http://localhost:3010`; chưa deploy/restart live. Hướng dẫn: `docs/MOTION_GUIDE.md`; báo cáo: `LOGS/AUREL_UX_ANIMATION_2026-11-13.md`; artifacts: `.local/ux-motion/`.
- Tồn đọng: chưa nghiệm thu authenticated admin/payment, mọi form failure, browser cũ hoặc public performance A/B của bộ motion mới. Bước tiếp theo: review preview, triển khai có kiểm soát rồi nghiệm thu các phiên thật và hiệu năng public riêng.

## Thu gọn kích thước mục trong menu Hamburger (`#aurel-menu`) — 13/11/2026
- **Thay đổi đã thực hiện**:
  - [homepage-header.module.css](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/layout/homepage-header.module.css): Thu hẹp bề rộng drawer `.menu` (`min(350px, 100%)`), giảm padding/spacing (`.dialogContent`, `.dialogHeading`), thu nhỏ tiêu đề `AUREL` (`22px`), nút đóng (`36×36px`, `22px`) và các mục điều hướng `.menu nav a` (từ `28px` / `padding-block: 13px` xuống `16px` / `padding-block: 7px`, `line-height: 1.4`).
  - [auth.module.css](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/auth/auth.module.css): Thu gọn phần tài khoản bên dưới trong menu (`.menuAccount` `16px` top gap/padding, `.accountCompact` `gap: 4px`, `.accountCompact .compactLink` `min-height: 32px` kèm font `12px`, `.compactLogout` `min-height: 38px`).
- **Kiểm tra đã xác minh**: `npx.cmd eslint src/components/layout/storefront-header.tsx src/components/auth/account-control.tsx` (exit 0), `npm.cmd run typecheck` (exit 0), `npx.cmd tsx --tsconfig tests/tsconfig.ui.json --test tests/chat-system.test.tsx` (`8/8 pass`, gồm Case 5 kiểm tra `StorefrontHeader`).
- **Bước tiếp theo**: Mở menu hamburger trên trình duyệt để nghiệm thu trực quan tỷ lệ chữ, khoảng cách và thanh cuộn dọc.

## Tối ưu ảnh bằng A/B — 13/11/2026
- Báo cáo: `LOGS/AUREL_IMAGE_AB_BENCHMARK_2026-11-13.md`. Đã đo 7 phương án, mỗi phương án 5 cold + 5 warm; tổng 70 navigation trên production snapshot riêng, có filmstrip và SQL probe.
- Chỉ giữ 3 file: collection card reveal 200ms (từ 600ms), stagger 40ms (từ 90ms); root loading có min-height 100svh để footer không nhảy từ y=650 gây CLS 0,294. Giữ nguyên thiết kế, ảnh gốc, quality, data flow, schema/index và quyền ảnh.
- Final local: visible sau scroll median 329/329ms cold/warm, baseline 825/819ms (nhanh hơn khoảng 60%); CLS >0,1 từ 2/10 xuống 0/10. Transfer 259.510 byte và 77 SQL/lượt không đổi. Request start 171/40ms, LCP 236/56ms là số đo quan sát; không quy toàn bộ cho CSS hoặc so trực tiếp với public 790ms trước đây.
- Không giữ eager (cold LCP tăng), refactor Suspense (chưa giải quyết CLS ổn định), resize khi request (giảm 77% byte nhưng có tail chưa giải thích). Thumbnail mới được đánh giá offline. Không bật cache public khi chưa kiểm chứng purge/revocation.
- Kiểm tra: lint/typecheck, 2 unit empty/error, 2 browser reduced-motion/mobile đều đạt; 5 build snapshot riêng thành công, root typecheck chạy riêng. Không build/restart/deploy live. Preview cuối: `http://127.0.0.1:3006`.
- Tồn đọng: live 3000 ngừng lắng nghe trong lúc đo, chưa rõ nguyên nhân; không có lệnh dừng/restart live. Chưa A/B public sau deploy, fast scroll, network throttling, DPR2 hoặc bảo đảm tail latency.
- Bước tiếp theo: kiểm tra trạng thái live, triển khai có kiểm soát và đo public; nếu tiếp tục variants, dùng prepared/bounded variants theo content hash, kiểm tra lại quyền mỗi request rồi A/B riêng.

## Cuộn mượt Lenis — 13/11/2026
- Áp dụng Lenis 1.3.25 giống Plant Classification tại `src/components/layout/smooth-scroll.tsx`, gắn root layout; CSS chính thức trong globals. Cấu hình duration 1.2, wheelMultiplier 0.8, smoothWheel true, autoRaf và anchor offset -80.
- Giữ cảm ứng native (syncTouch false), hỗ trợ nested scroll (allowNestedScroll true), tự cập nhật khi đổi prefers-reduced-motion và destroy/listener cleanup. CSS smooth làm fallback; html.lenis dùng auto để tránh chồng hiệu ứng.
- Không đổi routes, API, dữ liệu hay các trạng thái sản phẩm. Lint/typecheck đạt; chưa QA browser. Không build/restart để giữ phiên admin.
- Bước tiếp theo: nghiệm thu wheel, touch, chat/modal, anchor, reduced motion và điều hướng trên trình duyệt.

## Tích hợp AI Virtual Try-On (CatVTON + Hyper-SD 8-steps + Face-Lock) vào Storefront chính — 13/11/2026
- **Nâng cấp từ DM-VTON (`192×256`) sang CatVTON (`bfloat16`) + Hyper-SD theo yêu cầu chủ dự án**:
  - Mã nguồn [CatVTON](https://huggingface.co/spaces/zhengchong/CatVTON) tại `backend/cat-vton/`, weights (`zhengchong/CatVTON` + `booksforcharlie/stable-diffusion-inpainting` + `stabilityai/sd-vae-ft-mse` + `ByteDance/Hyper-SD`) lưu cục bộ trong `backend/cat-vton/`.
  - FastAPI service [app.py](file:///c:/Users/TAN/Downloads/E-commerce%20website/backend/tryon-service/app.py) (`127.0.0.1:8001`): dùng **SCHP** (ATR + LIP, pure PyTorch) kết hợp **Face-Lock Pixel Compositing** (`_composite_preserve_identity`, tách `Face` theo LIP và ghép trả 100% pixel gốc `768×1024`), fusion trực tiếp LoRA **Hyper-SD 8-steps** (`CATVTON_ACCEL=hyper8`, `DDIMScheduler(..., timestep_spacing="trailing")`, `576×768 -> 768×1024`, `8` steps, `CFG=1.0`, `cudnn.benchmark`, `_warmup()`, `asyncio.to_thread` + `asyncio.Semaphore(1)`).
- **Tích hợp hoàn chỉnh vào Storefront chính & Nút thử đồ trên trang sản phẩm**:
  - **Trang chi tiết sản phẩm (PDP)** ([virtual-tryon-modal.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/products/virtual-tryon-modal.tsx), [virtual-tryon-modal.module.css](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/products/virtual-tryon-modal.module.css)): Hiển thị thẻ **AUREL · PHÒNG THỬ ĐỒ AI** ngay phần trống bên dưới `Lưu yêu thích / Xem giỏ hàng / Danh sách yêu thích`, gồm nút **THỬ ĐỒ ẢO · TRY IT ON** (mở modal thử đồ ngay tại chỗ) và liên kết **Mở phòng thử đồ AI ↗** sang `/try-on?garmentUrl=...&garmentName=...`.
  - **Phòng thử đồ AI chuyên biệt `/try-on`** ([src/app/try-on/page.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/app/try-on/page.tsx), [src/components/tryon/tryon-studio.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/tryon/tryon-studio.tsx)): Server Component nạp danh mục sản phẩm kích hoạt từ PostgreSQL (có fallback mẫu AUREL khi catalog trống hoặc DB offline) + giữ cổng `/try-on-test` ([page.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/app/try-on-test/page.tsx)) dùng chung `TryOnStudio`; [storefront-header.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/layout/storefront-header.tsx) bổ sung mục điều hướng **Try-On AI** (`/try-on`) ở cả header chính lẫn menu hamburger.
  - **Sửa đọc ảnh sản phẩm thật `/images/uploads/*.webp` trong Proxy API** ([route.ts](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/app/api/try-on/route.ts)): Bổ sung đọc ảnh đã xuất bản từ PostgreSQL (`readPublishedImage(prisma, cleanPath)`) cho đường dẫn `/images/uploads/...` (thay vì chỉ đọc thư mục tĩnh `public/`) và cập nhật nhãn offline fallback từ `DM-VTON` sang `CatVTON`.
- **Kiểm tra đã xác minh trên live server `http://127.0.0.1:3005` (`next dev`) & cổng GPU `8001`**:
  - `npm.cmd run lint`: exit 0; `npm.cmd run typecheck`: exit 0; `npx.cmd tsx --test tests/try-on-api.test.ts`: `4/4 pass`; `npx.cmd tsx --tsconfig tests/tsconfig.ui.json --test tests/tryon-storefront-ui.test.tsx`: `3/3 pass` (tổng 7 test cases tự động + kiểm tra live routes & thử đồ E2E).
  - Kiểm tra thực tế sản phẩm `aurel-essential-shirt-nam-gen-z` (`/products/aurel-essential-shirt-nam-gen-z` `HTTP 200`), `/try-on` (`HTTP 200`), `/api/try-on` (`HTTP 200`, `RTX 5060 Ready`), và **chạy thử đồ thật qua `POST /api/try-on` với ảnh áo `/images/uploads/5cfe78cc-5afa-4aad-b65c-0c11dc0f5e01.webp` (`AUREL - ESSENTIAL SHIRT`) trong `4.54s`** (`inferenceMs: 2519.58 ms`, `totalMs: 4439.71 ms`); kiểm tra ảnh đầu ra giữ nguyên khuôn mặt, tóc, quần kem, nền studio và mặc lên áo sơ mi nâu xám có cổ bẻ + hàng cúc.
- **Tồn đọng & Bước tiếp theo**: Server cũ tại `127.0.0.1:3000` đang chạy bản build trước khi tích hợp thẻ Try-On mới (nên ảnh chụp trên `3000` trước đó chưa thấy nút); còn bản mới đang chạy sẵn sàng tại `http://127.0.0.1:3005` (hoặc `http://localhost:3005`) cùng dịch vụ GPU cổng `8001`. Chủ dự án mở `http://localhost:3005/products/aurel-essential-shirt-nam-gen-z` hoặc `http://localhost:3005/try-on` để nghiệm thu trên trình duyệt, và chạy `npm run build` + restart cổng `3000` khi sẵn sàng cập nhật production local. *(Lưu ý: CatVTON mang giấy phép CC BY-NC-SA 4.0).*

## Tách 2 luồng Chat (Bot & Nhân viên AUREL ghim đầu), Ưu tiên Bot khi double-click & Tạo đoạn chat mới — 13/11/2026
- **Thay đổi đã thực hiện**:
  - [types.ts](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/features/chat/types.ts) & [chat-store.ts](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/features/chat/chat-store.ts): Mở rộng `ChatConversation` với `channel` (`"BOT" | "STAFF"`), `title`, `pinned`, `isDefault`; bổ sung `listParticipantConversations` tự khởi tạo 2 đoạn chat mặc định (**Nhân viên AUREL** `STAFF` ghim đầu + **AUREL Concierge Bot** `BOT` ngay sau), `createParticipantConversation` tạo đoạn chat mới (tự đặt tiêu đề theo tin nhắn đầu tiên của khách với các đoạn chat mới), và `sortCustomerThreads` (nhóm `STAFF`/ghim luôn ở trên cùng, nhóm `BOT` ngay sau, mỗi nhóm sắp xếp mới nhất theo `updatedAt` lên trên).
  - [chat-service.ts](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/features/chat/chat-service.ts) & [route.ts](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/app/api/chat/route.ts): Hỗ trợ `GET /api/chat?conversationId=...&preferredChannel=BOT|STAFF` và `POST /api/chat` với `operation: "create" | "start" | "mode" | "send"`; trong kênh `BOT`, Bot tiếp tục trả lời xuyên suốt (chỉ chuyển `WAITING_STAFF` khi khách yêu cầu gặp nhân viên); trong kênh `STAFF`, tin nhắn chuyển thẳng nhân viên không để Bot chen ngang; lọc danh sách Admin `/admin/messages` chỉ hiện hội thoại đã có nội dung.
  - [chat-context.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/chat/chat-context.tsx), [chat-panel.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/chat/chat-panel.tsx), [messages-page-view.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/chat/messages-page-view.tsx), [chat.module.css](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/chat/chat.module.css) & [seller-messages.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/admin/seller-messages.tsx): Double-click icon tin nhắn trên header truyền `preferredChannel="BOT"` để mở hộp thoại bên phải ưu tiên chat ngay với Bot; sidebar **Đoạn chat** hiển thị 2 mục mặc định (ghim `Nhân viên AUREL` lên đầu, `AUREL Concierge Bot` liền sau, sort theo đoạn chat mới), bỏ 4 shortcut tĩnh cũ, và nút `+` cho phép tạo đoạn chat mới với Bot hoặc Nhân viên AUREL.
  - [chat-system.test.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/tests/chat-system.test.tsx): Cập nhật Case 6 và bổ sung Case 8 kiểm tra 2 đoạn chat mặc định, ghim Nhân viên lên đầu, sort theo mới nhất và tạo đoạn chat mới.
- **Kiểm tra đã xác minh**: `npx.cmd tsx --tsconfig tests/tsconfig.ui.json --test tests/chat-system.test.tsx` (8/8 pass), `eslint` (exit 0), `npm.cmd run typecheck` (exit 0). Đã bổ sung `outputFileTracingExcludes` trong [next.config.ts](file:///c:/Users/TAN/Downloads/E-commerce%20website/next.config.ts) để loại trừ `./backend/**/*`, `./LOGS/**/*`, `./.data/**/*` khỏi file tracing của Next.js/Turbopack (tránh lỗi đọc file checkpoint 3.2 GB trong `backend/cat-vton/`). Đã dừng tiến trình build nền theo yêu cầu để chủ dự án tự chạy `npm run build`.
- **Bước tiếp theo**: Chủ dự án chạy `npm run build` để xác nhận production build, sau đó mở `/messages` và thử double-click icon tin nhắn trên laptop để nghiệm thu trực quan.

## Thiết kế lại hệ thống Nhắn tin Quiet Luxury & Trang chuyển hướng riêng `/messages/connecting` — 13/11/2026
- **Thay đổi đã thực hiện**:
  - Tạo trang chuyển hướng riêng [page.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/app/messages/connecting/page.tsx) (`/messages/connecting`) với nền gợn sóng kem ấm đồng bộ AUREL, biểu tượng monogram `A`, tiêu đề serif *Đang kết nối phòng tư vấn AUREL…*, thanh tiến trình 2 giây nâu đồng, hộp mẹo click đúp để mở hộp thoại bên phải, và nút *Vào trang nhắn tin ngay* / *Quay lại*.
  - Cập nhật [chat-context.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/chat/chat-context.tsx): bỏ overlay tối màu cũ; click 1 lần trên laptop điều hướng sang `/messages/connecting`, click 2 lần mở hộp thoại bên phải, điện thoại vào thẳng `/messages`.
  - Làm mới toàn bộ bảng màu và typography trong [chat.module.css](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/chat/chat.module.css), [messages-page-view.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/chat/messages-page-view.tsx) và [seller-messages.module.css](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/admin/seller-messages.module.css) từ giao diện tối xanh Facebook sang phong cách **AUREL Quiet Luxury** (kem `#fcf7f2`, trắng ngà `#fffdfb`, espresso `#322720`, nâu đồng `#68452f`, viền `#e5dad0`, tiêu đề serif).
  - Cập nhật & bổ sung Case 7 trong [chat-system.test.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/tests/chat-system.test.tsx).
- **Kiểm tra đã xác minh**: `npx.cmd tsx --tsconfig tests/tsconfig.ui.json --test tests/chat-system.test.tsx` (7/7 pass), `npm.cmd run lint` (exit 0), `npm.cmd run typecheck` (exit 0). *(Không chạy `npm run build` theo yêu cầu giữ ổn định phiên nhập sản phẩm của admin).*

## Sửa lỗi `Dữ liệu không hợp lệ (Dữ liệu nhập)` khi lưu/chuẩn bị sản phẩm Admin — 13/11/2026
- **Nguyên nhân**: Khi bổ sung trường `searchTags` vào `editorPayload`, allowlist `object(input, [...])` trong `managementPrepare` ([management.ts](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/features/products/management.ts)) và `pendingConvert` ([pending.ts](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/features/products/pending.ts)) chưa có `"searchTags"`, khiến mọi thao tác nhấn **Tiếp theo** ở form sản phẩm bị ném `InputError("input")` → `Dữ liệu không hợp lệ (Dữ liệu nhập)`.
- **Thay đổi đã thực hiện**:
  - [management.ts](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/features/products/management.ts): Tách hằng số dùng chung `editorInputFields` (đã gồm `"searchTags"`) và áp dụng cho `validateEditor`, `persist`, và `managementPrepare`.
  - [pending.ts](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/features/products/pending.ts): Tái sử dụng `editorInputFields` trong `pendingConvert`.
  - [product-editor.test.ts](file:///c:/Users/TAN/Downloads/E-commerce%20website/tests/product-editor.test.ts): Bổ sung test case kiểm tra `editorInputFields` chấp nhận `searchTags` từ `editorPayload`.
- **Kiểm tra đã xác minh**: `node --conditions=react-server --test tests/product-editor.test.ts` (7/7 pass), `npm.cmd run lint` (exit 0), `npm.cmd run typecheck` (exit 0), `npx.cmd next build --webpack` (exit 0).

## Thanh tìm kiếm & bộ lọc rút gọn đồng bộ nền trang `/products` — 13/11/2026
- **Thay đổi đã thực hiện**:
  - Tạo [catalog-search-filter-bar.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/products/catalog-search-filter-bar.tsx) (`CatalogSearchFilterBar` + `buildCatalogHref`) gộp ô tìm kiếm (viền pill nâu mảnh, nút xóa `×`, bỏ khung focus vuông của trình duyệt) và 5 nút lọc dạng dropdown (`Bộ lọc`, `Danh mục`, `Màu`, `Giá`, `Size`) vào chung một thanh pill nổi gọn gàng.
  - Cập nhật [catalog-browser.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/products/catalog-browser.tsx) để dùng `CatalogSearchFilterBar` cho mọi chế độ xem danh mục/tìm kiếm (`/products?gender=women`, `/products?gender=men`, `/products?page=1`, `/products?q=...`), giữ `HeroSearchForm` ở `/products` trần.
  - Cập nhật [catalog-browser.module.css](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/products/catalog-browser.module.css): đồng bộ nền `.page` sang màu kem ấm `#fcf7f2` kết hợp nền SVG gợn sóng lụa 2 lớp (`#f3e8de` / `#ebdbcd` ở góc trên-trái và `#f2e6db` / `#e9d8c9` ở góc dưới-phải, `background-attachment: fixed`), bổ sung hiệu ứng vầng sáng chéo màu trắng mảnh (`#ffffff`, `48%–50%–52%`) chuyển động `3s` (`titleSheen`, chu kỳ `5s` gồm `3s` quét + `2s` nghỉ) từ trái sang phải cho `.resultsHeader h1` và `.recommendations h2` (`YOU MAY LIKE!`, đồng bộ kích thước `clamp(34px,4vw,58px)` bằng với tiêu đề danh mục), cùng style responsive cho `.unifiedBar` và `.dropdownMenu`.
  - Cập nhật [catalog-filter-browse.test.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/tests/catalog-filter-browse.test.tsx) (Case 2) khớp với 5 pill rút gọn mới.
- **Kiểm tra đã xác minh**: `npm.cmd run lint` (exit 0), `npm.cmd run typecheck` (exit 0), `npx.cmd next build --webpack` (exit 0), 4/4 test cases trong `catalog-filter-browse.test.tsx`.
- **Tồn đọng / Bước tiếp theo**: Cần deploy bản build mới và kiểm tra trực quan trên `https://aureluxury.store/products?gender=women` và `?gender=men`.

## Sửa trang `/products` khi duyệt theo bộ lọc (`/products?gender=women`) & Thanh lọc Storefront — 12/11/2026
- **Vấn đề đã xử lý**: Trước đây [catalog-browser.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/products/catalog-browser.tsx) kiểm tra `if (!query.q && !query.invalid)` nên mọi đường dẫn có bộ lọc nhưng không có `q` (như `/products?gender=women`, `/products?gender=men`, `/products?category=...`, `/products?page=1`) đều bị chuyển về Search Hero (`WHAT ARE YOU LOOKING FOR?`) và không hiển thị sản phẩm. Ngoài ra `findSearchPage` trong [products.ts](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/lib/db/queries/products.ts) chưa áp dụng bộ lọc SQL (`gender`, `category`, `size`, `color`, `minPrice`, `maxPrice`, `brand`) khi kết hợp với từ khóa `q`.
- **Thay đổi đã thực hiện**:
  - [catalog-browser.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/products/catalog-browser.tsx): Bổ sung helper `hasAnyFilter(query)` và `buildCatalogHref(query, overrides)` giữ nguyên mọi filter hợp lệ khi chuyển trang/chuyển tab; chỉ hiển thị Search Hero khi không có bất kỳ filter hoặc từ khóa `q` hay `page` nào; các đường dẫn có filter (`gender`, `category`, `size`, `color`, `minPrice`, `maxPrice`, `brand`, `page`, `q`) hiển thị tiêu đề ngữ cảnh, thanh lọc **Storefront Filter Bar** (Giới tính: Tất cả / Nữ / Nam / Phi giới tính, Danh mục thu gọn, Size, Màu sắc, Giá min–max, Xóa bộ lọc), danh sách sản phẩm thực từ PostgreSQL và khối `YOU MAY LIKE!` khi kết quả trống.
  - [catalog-browser.module.css](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/products/catalog-browser.module.css): Bổ sung style `.filterPanel`, `.filterRow`, `.filterPills`, `.filterPill`, `.filterPillActive`, `.filterControls`, `.filterSelect`, `.filterInput`, `.filterApply`, `.filterReset`, `.heroBrowse` theo phong cách Quiet Luxury.
  - [products.ts](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/lib/db/queries/products.ts): `findCatalogPage` nạp đầy đủ `tags` từ `defaultProductTagStore`; `findSearchPage` áp dụng thêm `catalogWhere(query)` lên PostgreSQL khi lọc kết hợp `q`.
  - [storefront-header.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/src/components/layout/storefront-header.tsx): Cập nhật liên kết `"Shop"` trên navigation chính từ `/products` sang `/products?page=1` để vào thẳng lưới sản phẩm kèm bộ lọc.
  - [catalog-filter-browse.test.tsx](file:///c:/Users/TAN/Downloads/E-commerce%20website/tests/catalog-filter-browse.test.tsx): Bổ sung 4 test case mới xác minh SSR `/products?gender=women`, `/products` bare Search Hero, thanh lọc giữ nguyên filter, và `findSearchPage` áp dụng filter kết hợp `q`.
- **Kiểm tra đã xác minh**: `npm.cmd run lint` (0 lỗi), `npm.cmd run typecheck` (đạt), `npx.cmd next build --webpack` (đạt), 6/6 test cases (4 mới + 2 regression từ `shop-rules.test.ts` & `catalog.test.ts`).
- **Tồn đọng / Bước tiếp theo**: Cần verify trực quan trên trình duyệt production (`https://aureluxury.store/products?gender=women`) sau khi deploy bản build mới.

## Thu hẹp Danh mục, Thẻ Tag tìm kiếm (`;`) & Gợi ý Phối đồ Thông minh — 12/11/2026
- **Thu hẹp danh mục sản phẩm (`src/features/products/category-options.ts`)**:
  - Thu gọn từ 18 danh mục nhỏ thành **6 nhóm danh mục chính**: `Áo` (`tops`), `Áo Khoác` (`outerwear`), `Quần` (`bottoms`), `Đầm` (`dam` - Nữ), `Chân Váy` (`chan-vay` - Nữ) và `Phụ Kiện` (`accessories`).
  - Quy hoạch 8 sản phẩm thật trong PostgreSQL: `#57, #58, #59, #60` về chung danh mục `Áo` (`#11`); `#24, #61, #62, #64` thuộc `Áo khoác` (`#9`).
- **Thẻ Tag tìm kiếm phân cách dấu `;` (`src/features/products/tag-parser.ts`, `product-tags.ts`, `product-editor.tsx`)**:
  - Thêm trường **"Thẻ Tag tìm kiếm (cách nhau bằng dấu ;)"** kèm hiển thị chips xem trước trực tiếp trong Bước 1 của `ProductEditor` (ví dụ: `áo polo; polo; áo thun có cổ`).
  - Lưu trữ an toàn tại `.data/aurel-product-tags.json` thông qua `management.ts` (không cần thay đổi schema DB) và khởi tạo sẵn tag cho cả 8 sản phẩm thật.
- **Tìm kiếm câu dài tự nhiên & Gợi ý phối đồ "Có thể bạn sẽ thích"**:
  - Mở rộng `STOP_WORDS` hội thoại trong `src/features/catalog/search-ranking.ts` (`extractSearchIntent`): gõ `"Hôm nay tôi muốn mua áo polo"` tự tách intent `["ao", "polo"]`, truy vấn cả tag registry + PostgreSQL và xếp sản phẩm Polo lên Top 1.
  - Xây dựng `src/features/catalog/outfit-mapping.ts` (`rankComplementaryProducts`), tích hợp vào `src/lib/product-related.ts` (PDP `You May Also Like`), `src/lib/db/queries/products.ts` (`findSearchRecommendations`) và `src/components/products/catalog-browser.tsx`: xem `Áo` gợi ý `Quần` / `Chân váy` / `Áo Khoác`; xem `Áo Khoác` gợi ý `Áo` / `Quần`; xem `Quần` gợi ý `Áo` / `Áo Khoác`.
- Checks: `npm.cmd run lint` exit 0, `npm.cmd run typecheck` exit 0, 8 test cases passed (5 cases `tests/tags-and-outfit-mapping.test.ts` + 3 regression UI/editor cases, $\le$ 10 test case), `npx.cmd next build --webpack` exit 0.
- Exact next action: Mở `/admin/products/new` để xem bảng chọn danh mục 6 ô gọn gàng + ô nhập Thẻ Tag `;`, sau đó vào `/products` tìm `"Hôm nay tôi muốn mua áo polo"` để kiểm tra kết quả Top 1 và mục gợi ý phối đồ `YOU MAY LIKE!`.

## Dọn dẹp 2 sản phẩm TEST khỏi danh mục sản phẩm — 12/11/2026
- Xóa vĩnh viễn 2 sản phẩm lưu trữ phục vụ test theo yêu cầu chủ dự án trong transaction an toàn PostgreSQL:
  - `#63` (`AUR-125136740001` — `AUREL - TEST THANH TOÁN PAYOS — KHÔNG GIAO HÀNG`) và đơn test liên kết (`Order #2`, `DEMO-1-...`).
  - `#65` (`AUR-294967340001` — `AUREL - TEST`) và đơn test liên kết (`Order #4`, `DEMO-1-...`).
- Danh mục hiện tại còn đúng **8 sản phẩm thật đang hoạt động**, 100% đạt chuẩn tên `AUREL - TÊN SẢN PHẨM` (không số, không sản phẩm test).
- Exact next action: Làm mới `/admin/products` và `/products` trên trình duyệt để xem danh mục sạch gồm 8 sản phẩm thật.

## Chuẩn hóa tên sản phẩm `AUREL - TÊN SẢN PHẨM` (IN HOA & Bỏ số) — 12/11/2026
- Nâng cấp hàm `formatAurelProductName(rawName: unknown)` trong `src/features/products/product-name.ts`:
  - Chuẩn hóa toàn bộ tên sản phẩm theo định dạng **`AUREL - TÊN SẢN PHẨM`** (viết hoa chuẩn tiếng Việt sau tiền tố `AUREL - `).
  - Loại bỏ toàn bộ số thứ tự đầu dòng (như `11. `), số nhúng và các cụm giá chứa số (như `1.000đ`), dọn ký tự phân cách dư thừa và giữ tính bất biến (idempotent).
  - Cập nhật đồng bộ toàn bộ 10 bản ghi `Product.name` thực tế trong PostgreSQL (ví dụ: `11. Navy Bomber Jacket (Nam)` $\rightarrow$ `AUREL - NAVY BOMBER JACKET (NAM)`, `AUREL — ÉLAN LONG COAT` $\rightarrow$ `AUREL - ÉLAN LONG COAT`), cùng `demoPieces` (`src/features/collection/preview.ts`), đơn hàng demo (`src/app/account/orders/page.tsx`) và xếp hạng SQL trong `src/lib/db/queries/products.ts`.
- Checks: `npm.cmd run lint` exit 0, `npm.cmd run typecheck` exit 0, 7 test cases passed (6 cases `tests/smart-search-rules.test.ts` + 1 regression case `tests/prisma-catalog.test.ts`, $\le$ 10 test case), `npx.cmd next build --webpack` exit 0.
- Exact next action: Mở trang chủ, `/products` và `/admin/products` trên trình duyệt để kiểm tra hiển thị tên mới `AUREL - TÊN SẢN PHẨM` không còn số.

## Hệ thống Nhắn tin Phong cách Messenger & Quy tắc Bot mở đầu 1 lần — 12/11/2026
- **Quy tắc Bot mở đầu 1 lần & Nhân viên trực tiếp (`src/features/chat/`)**:
  - Hội thoại mới khởi tạo ở trạng thái chờ (`hasStarted: false`, `botReplyCount: 0`), hiển thị màn hình chào kiểu Messenger với nút **"Bắt đầu cuộc hội thoại"**.
  - Khi người dùng bấm **"Bắt đầu cuộc hội thoại"**, Bot gửi lời chào mở đầu; khi người dùng gửi **tin nhắn đầu tiên** (`botReplyCount === 0`), Bot tự động trả lời thông minh 1 lần duy nhất (kèm sản phẩm thật/size/đơn hàng) rồi tự động chuyển trạng thái sang `WAITING_STAFF` (`botReplyCount = 1`).
  - Từ **tin nhắn thứ 2 trở đi**, Bot không chen ngang mà nhường hoàn toàn cho **Nhân viên AUREL** trực tiếp trao đổi qua `/admin/messages`.
- **Giao diện chuẩn Messenger Dark Theme (`src/components/chat/` & `src/components/admin/seller-messages.tsx`)**:
  - Trang `/messages` và `/admin/messages` thiết kế bố cục 3 cột giống hệt Messenger Desktop: Thanh icon điều hướng cực trái (`messengerRail`), cột danh sách **"Đoạn chat"** kèm thanh tìm kiếm `"Tìm kiếm trên Messenger"`, avatar tròn + chấm xanh online/vàng chờ nhân viên, và khung chat chính với cụm bong bóng bo tròn `#0084ff` / `#303030`, khung nhập `Aa`, nút 👍 / Gửi.
  - Hộp thoại nổi bên phải trên laptop (mở bằng double-click) giữ nguyên chuẩn popup Messenger thu gọn vừa vặn laptop (`min(390px)` × `min(560px, calc(100dvh - 88px))`), 1-click trên laptop hiện trang load 2 giây kèm gợi ý, mobile 1 chạm vào thẳng `/messages`.
- Checks: `npm.cmd run lint` exit 0, `npm.cmd run typecheck` exit 0, 6/6 cases `tests/chat-system.test.tsx` passed, `npx.cmd next build --webpack` exit 0.
- Exact next action: Mở `/messages` và `/admin/messages` trên trình duyệt (hoặc double-click icon tin nhắn trên laptop) để nghiệm thu giao diện Messenger và luồng Bot 1 lần $\rightarrow$ Nhân viên.

## Hệ thống Nhắn tin Khách hàng – Shop & Bot Chăm sóc Khách hàng AUREL — 12/11/2026
- **Icon Tin nhắn trên Header (`src/components/layout/storefront-header.tsx`)**:
  - Bổ sung biểu tượng tin nhắn (Speech Bubble) tại cụm icon góc phải trên trang chủ hero, các trang cửa hàng và menu di động.
  - **Cơ chế phân biệt thiết bị & số lần click (`src/components/chat/chat-context.tsx`)**:
    - Trên **Laptop / Desktop ($\ge$ 768px)**:
      * **Click 1 lần**: Hiển thị trang/màn hình chuyển hướng 2 giây (`2000ms`) kèm thanh tiến trình và thông điệp: *"Bạn biết không, khi click 2 lần vào ô nhắn tin sẽ tạo thành một hộp thoại bên phải để nhắn đấy!"*, sau đó chuyển sang trang đầy đủ `/messages` (có nút `Vào ngay`, `Mở hộp thoại bên phải`, `Hủy`).
      * **Click 2 lần (Double click)**: Mở ngay **Hộp thoại nhắn tin bên phải (`ChatDrawer`)** trên trang hiện tại, tối ưu kích thước vừa vặn màn hình laptop (`width: min(410px, calc(100vw - 32px))`, `max-height: calc(100dvh - 90px)`), cuộn tin nhắn nội bộ mượt mà, có nút `Mở rộng ↗` sang `/messages` và `Escape` để đóng.
    - Trên **Điện thoại (< 768px)**: Chạm vào icon sẽ điều hướng thẳng đến trang `/messages` ngay lập tức.
- **Nhắn tin 2 chiều Khách hàng $\leftrightarrow$ Shop & Bot Chăm sóc Tự động**:
  - Backend Persistence & API: `src/features/chat/chat-store.ts` lưu trữ hội thoại an toàn tại `.data/aurel-chat-sessions.json` (không cần thay đổi schema DB, hoạt động ổn định cả khi PostgreSQL offline), `src/app/api/chat/route.ts` dùng session đăng nhập hoặc cookie HttpOnly `aurel_chat_guest` cho khách vãng lai.
  - **AUREL Concierge Bot (`src/features/chat/care-bot.ts`)**: Tự động phân loại ý định (Chào hỏi, Tìm sản phẩm dùng catalog thật qua `findSearchPage`, Bảng chọn size, Theo dõi đơn hàng `/account/orders`, Chính sách đổi trả & bảo quản, Chuyển tiếp nhân viên `WAITING_STAFF` và gợi ý câu hỏi nhanh). Không bao giờ bịa giá hoặc tồn kho khi DB offline.
  - **Hộp thư Người bán (`/admin/messages`)**: Cổng quản trị bảo vệ chặt chẽ bởi `sellerActor()`, đồng bộ link tại `SellerPortalNav`, `AdminHeader` và `ProductSidebar`, cho phép chủ shop xem tất cả hội thoại khách hàng, nhắn tin trả lời trực tiếp (`STAFF` mode tự động tạm dừng Bot), bật lại Bot hoặc đánh dấu hoàn tất.
- Checks: `npm.cmd run lint` exit 0 (0 error, 0 warning), `npm.cmd run typecheck` exit 0, 8 test cases passed (6 cases `tests/chat-system.test.tsx` + 2 regression UI cases, $\le$ 10 test case), `npx.cmd next build --webpack` exit 0.
- Exact next action: Mở trang chủ trên trình duyệt ở laptop (thử click 1 lần xem màn hình 2s + double-click mở hộp thoại bên phải) và kiểm tra `/admin/messages` với tài khoản ADMIN.

## Chuẩn hóa tiền tố tên AUREL & Xây dựng Hệ thống Tìm kiếm Thông minh — 10/11/2026
- **Chuẩn hóa tiền tố tên sản phẩm (`AUREL `)**:
  - Xây dựng module `src/features/products/product-name.ts` với hàm `formatAurelProductName(rawName: unknown): string`.
  - Đảm bảo 100% tên sản phẩm trên toàn hệ thống (storefront `/products`, chi tiết `/products/[slug]`, giỏ hàng, checkout, admin `/admin/products`, demo pieces, đơn hàng tài khoản) đều bắt đầu bằng tiền tố `"AUREL "` chuẩn, chống trùng lặp (`AUREL AUREL...`) và tự động chuẩn hóa biến thể viết thường.
  - Tích hợp tại các lớp cốt lõi: mapper catalog (`mapCatalogProduct`), admin DTO (`dto`), admin list (`managementList`), product editor validation (`validateEditor`), preview fixtures (`demoPieces`) và mock order items.
- **Hệ thống Tìm kiếm Thông minh (Smart E-Commerce Fashion Search Engine)**:
  - Giải quyết triệt để vấn đề tìm kiếm thời trang song ngữ và gõ từ khóa không liên tục:
    1. **Tokenization & Normalization**: Khử dấu tiếng Việt chuẩn NFD, chữ thường, loại bỏ ký tự đặc biệt và lọc stop words.
    2. **Từ điển đồng nghĩa thời trang 2 chiều Việt - Anh (`FASHION_SYNONYM_GROUPS`)**: Ánh xạ đầy đủ các danh mục (áo khoác <-> coat/jacket/trench/bomber, áo len <-> knit/sweater/cardigan, quần <-> trousers/pants, túi <-> bag/tote) và màu sắc (nâu <-> brown/camel/caramel, đen <-> black, trắng/kem <-> white/ivory/cream, v.v.).
    3. **Mô hình tính điểm tương đồng trọng số đa trường (Multi-field Weighted Relevance Scoring)**: Chấm điểm Title match (exact +250, prefix +140, all tokens +80), SKU match (+300), Category (+50), Variant Color/Size (+40), Description (+25).
    4. **Không phụ thuộc thứ tự từ**: Gõ `"trench coat nâu"` hay `"nâu trench coat"` đều xếp hạng sản phẩm `"AUREL Brown Trench Coat (Nam)"` lên vị trí số 1.
    5. **Tích hợp đồng bộ**: Nâng cấp truy vấn PostgreSQL parameterized trong `src/lib/db/queries/products.ts` kết hợp tinh chỉnh re-ranking deterministic bằng `rankCatalogProducts`.
- Checks: `npm.cmd run lint` exit 0 (0 error, 0 warning), `npm.cmd run typecheck` exit 0, 6/6 unit test cases passed trong `tests/smart-search-rules.test.ts` (tuân thủ giới hạn <= 10 test case), `npx.cmd next build --webpack` exit 0 (toàn bộ 36 routes biên dịch production thành công).
- Exact next action: Mở trang `/products` trên trình duyệt, nhập từ khóa (ví dụ "trench coat nâu", "áo khoác", "tailored coat" hoặc mã SKU) và nhấn Enter để trải nghiệm kết quả tìm kiếm chính xác.

## Tinh chỉnh Card Quản trị bán hàng & Nén tối ưu toàn bộ ảnh hệ thống (-76% dung lượng) — 10/11/2026
- Tinh chỉnh Card "Quản trị bán hàng hiệu quả hơn" tại chân Sidebar Admin:
  - Bổ sung ảnh nền kết cấu vải dạ cashmere cao cấp màu caramel/nâu ấm (`/images/aurel/admin-card-bg.webp`, 16KB) đồng bộ 100% với ảnh tham chiếu người dùng gửi.
  - Tinh chỉnh border-radius bo tròn 18px mềm mại, typography chữ trắng in hoa sắc nét và nút CTA pill trắng tinh khôi ("Xem báo cáo →") với chữ nâu caramel (`#7d4832`).
- Nén tối ưu hóa toàn bộ 16 ảnh tĩnh độ phân giải cao của website (`public/images/`):
  - Giảm tổng dung lượng tải từ **32.91 MB xuống còn 7.87 MB** (tiết kiệm **25.04 MB, giảm 76%**).
  - Khắc phục hoàn toàn tình trạng giật lag khi tải trang chủ và trang sản phẩm mà vẫn giữ nguyên 100% độ sắc nét chuẩn thời trang cao cấp AUREL.
- Checks: `npm run lint` exit 0 (0 error, 0 warning), `npm run typecheck` exit 0, 7 test cases passed (1 UI sidebar test + 6 dashboard rules test, tuân thủ giới hạn <= 10 test case), `npm run build` (Next.js 16.4.3 production build) exit 0.
- Exact next action: Mở trang chủ và `/admin/products` trên trình duyệt để cảm nhận tốc độ tải mượt mà và giao diện card mới.

## Nâng cấp Dark Chocolate Sidebar & Loại bỏ các khối cũ theo yêu cầu người dùng — 10/11/2026
- Gỡ bỏ hoàn toàn theo ảnh tham chiếu: mục "Nhập / xuất CSV", khối "Bộ sưu tập" ("Chưa có bộ sưu tập..."), "Tra cứu danh mục" và khối "Trạng thái" dạng chấm màu cũ khỏi src/components/admin/product-sidebar.tsx.
- Chuyển đổi giao diện Sidebar quản trị sang chuẩn Dark Chocolate / Deep Espresso (#241812) theo đúng bản vẽ thiết kế:
  - Đỉnh sidebar: Logo AUREL (Monogram A cách điệu + chữ AUREL trắng tinh khôi).
  - Menu dọc gồm 9 mục: Tổng quan (/admin/products), Đơn hàng (/admin/orders kèm badge số lượng 12), Sản phẩm (active state: nền be sáng #ebdcd0, bo góc 12px, chữ và icon nâu tối #241812), Danh mục (/admin/products), Kho hàng (/admin/orders/reports), Khuyến mãi (/admin/vouchers), Khách hàng (/admin/orders), Báo cáo (/admin/orders/reports), Cài đặt (/admin/products).
  - Đáy sidebar: Card banner AUREL ("Quản trị bán hàng hiệu quả hơn", nút pill trắng "Xem báo cáo →" dẫn đến /admin/orders/reports).
- Zero Regression: Giữ nguyên type signature của ProductSidebarProps (categories, collections, rows, limited), không ảnh hưởng các caller và các trang admin khác.
- Checks: npm run lint exit 0 (0 error, 0 warning), npm run typecheck exit 0, 7 test cases passed (1 UI sidebar test + 6 dashboard rules test, tuân thủ giới hạn <= 10 test case), npm run build (Next.js 16.4.3 Turbopack production build) exit 0.
- Exact next action: Mở /admin/products trên trình duyệt để nghiệm thu trực quan giao diện Dark Chocolate Sidebar mới.

## Redesign Dashboard Quản lý sản phẩm AUREL (`/admin/products`) — UI Only, Zero Regression — 09/11/2026
- Bám sát giao diện tham chiếu phong cách Premium Enterprise SaaS Dashboard:
  - Header: Breadcrumb ("Trang chủ / Sản phẩm"), Title, Subtitle, bộ chuyển đổi thời gian ({7, 30, 90} ngày qua), nút Thêm sản phẩm dẫn đúng quy trình `/admin/products/new`.
  - 4 thẻ KPI đồng bộ dữ liệu thực từ PostgreSQL: Tổng sản phẩm, Đang hoạt động, Đã lưu trữ, Cảnh báo tồn ≤ 5 (tính trên toàn bộ danh mục, không phụ thuộc trang hiện tại hay bộ lọc bảng).
  - 3 Analytics Charts trực quan bằng SVG native không phụ thuộc thư viện nặng:
    1. Biểu đồ diện tích (Area Chart): Sản phẩm mới tạo theo mốc thời gian thực ({7, 30, 90} ngày) kèm hover tooltip chính xác.
    2. Biểu đồ tròn (Donut Chart): Cơ cấu sản phẩm theo danh mục và tỷ lệ phần trăm từ dữ liệu thật.
    3. Biểu đồ thanh ngang (Horizontal Bar Chart): Trạng thái sản phẩm (Đang hoạt động vs Đã lưu trữ).
  - Thanh bộ lọc & tìm kiếm: Tích hợp ô tìm kiếm SKU/tên, dropdown danh mục, trạng thái, bộ sưu tập và nút xóa bộ lọc nhanh.
  - Bảng quản lý sản phẩm cao cấp: Hiển thị thumbnail ảnh sản phẩm thật, mã SKU, link chi tiết sản phẩm, danh mục dạng chip, badge trạng thái, số lượng tồn kho + số biến thể, và các nút thao tác chỉnh sửa, xem trước (preview), và xóa an toàn có xác nhận mã (`ProductDeleteControl`).
  - Phân trang pagination dạng số trang (`pageWindow`) với điều hướng mượt mà.
- An toàn tuyệt đối & Zero Regression:
  - Không sửa đổi database schema, không chạy migration, không đổi API contracts hay logic CRUD/PayOS/Checkout.
  - Tính năng xóa sản phẩm bảo tồn 100% logic xác thực mã SKU và kiểm tra liên kết của `ProductDeleteControl`.
- Checks: `npm run lint` exit 0, `npm run typecheck` exit 0, `node --test tests/product-dashboard-rules.test.ts` (6/6 pass), `npm run build` exit 0 (Next.js 16.4.3 production build).

## Khôi phục checkout sau build — 02/11/2026
- Console thật và HTTP local/public xác nhận JS `0d2f1fae2r101.js`, CSS `1vj-ypsgf6xf1.css` trả404 dù file có trên ổ đĩa: Next PID14956 khởi động15:12 trước BUILD_ID mới15:27, giữ inventory asset cũ.
- Restart đúng Next workspace sang PID3288; cả hai asset local/public200. Chrome hard reload `/checkout?variantId=114` hiển thị form nhận hàng, một sản phẩm400.000đ và phương thức PAYOS. Không tạo đơn/chuyển tiền. Sản phẩm test1000đ là variant120.
- Sau mỗi build thay `.next` phải restart server trước nghiệm thu; tránh build đè thư mục đang phục vụ. Chi tiết `LOGS/CHECKOUT_ASSET_RECOVERY.md`.

## payOS thật và sản phẩm thử 1.000đ — 02/11/2026
- Đã backup/restore kiểm chứng và áp riêng `20261102150000_payos_payments` trên DB local; ba bảng thanh toán sẵn sàng, dữ liệu/schema cũ giữ nguyên. Không deploy các migration pending khác.
- Đã bật `PAYOS_ENABLED=true` trong environment local, đăng ký webhook HTTPS thành công và restart production Next. Product ID63/variant120, giá 1.000 VND, stock1: `test-thanh-toan-payos-1-000d-khong-giao-hang-moi-do-tuoi`; ghi rõ TEST kỹ thuật, không giao hàng.
- Credentials được provider chấp nhận (GET mã không tồn tại trả101); retry nhận diện chính xác lỗi này và giữ mã đã lưu. CheckoutView hiện tại đã có chọn PAYOS/QR và scope Buy Now, được giữ nguyên.
- Lint/typecheck/build đạt; một regression code101 đạt. Local/public PDP200 đúng giá; chưa tạo payment link, chưa chuyển tiền, chưa xác minh PAID thật. Owner đăng nhập, Buy Now, chọn payOS và tự xác nhận 1.000đ trong ứng dụng ngân hàng; sau đó kiểm `/admin/orders`.
- Chi tiết và backup: `LOGS/PAYOS_LIVE_1000_TEST.md`.

## Trải nghiệm tìm kiếm sản phẩm thật trên `/products` — 02/11/2026
- `/products` nay có ba trạng thái AUREL Explore: hero khi chưa có `q`, lưới kết quả thật có tổng/phân trang, và no-result có **YOU MAY LIKE!** lấy tối đa 8 sản phẩm active mới nhất. Không render grid trước khi tìm và không tạo inventory/giá/ảnh giả.
- Search chạy ở PostgreSQL, bỏ dấu Việt bằng `translate`, tìm name/description/brand/category/profile/variant, xếp exact/prefix/partial name trước metadata/mô tả. Input dùng Prisma SQL parameters; active-only, 12/trang, không tải catalog về browser.
- Enter/nút tròn/chip đều sinh `/products?q=...`; URL giữ query/page cho refresh và Back/Forward. Card giữ ảnh/giá/màu/PDP/wishlist/bag thật; có skeleton, error riêng và reduced-motion.
- 9/9 unit + 1/1 PostgreSQL search case, scoped lint, typecheck và build đạt. Chưa browser QA; bước tiếp theo là nghiệm thu desktop/mobile với exact/partial/không dấu/no-result, wishlist và PDP.

## Tái thiết kế Seller Portal AUREL (`/admin/orders`, `/admin/orders/reports`, `/admin/vouchers`) — 02/11/2026
- Cả ba trang quản trị người bán đã được đồng bộ giao diện Quiet Luxury (`AUREL · NGƯỜI BÁN`) với thanh điều hướng pill bar dùng chung (`SellerPortalNav`), header card editorial có nhãn `AUREL · NGƯỜI BÁN`, và header espresso `AdminHeader` trên toàn bộ nhánh `/admin/*` (trừ preview showroom).
- `/admin/orders` (`SellerOrders`): 4 thẻ KPI lọc đơn (`Cần xử lý`, `Chờ thanh toán`, `Cần đối soát`, `Tất cả đơn`) kèm icon/mô tả phụ, dòng trạng thái live-poll 20 giây có chấm xanh, thẻ empty state đồng bộ và thẻ đơn hàng 2 cột.
- `/admin/orders/reports` (`SellerReports`): thay `ShopPage` thô bằng giao diện chuyên biệt gồm 3 thẻ KPI doanh thu quy ước (24h/7d/30d), lưới 2 cột Cảnh báo tồn ≤ 5 (badge màu theo mức tồn) + Top bán chạy từ đơn hoàn tất, và danh sách 100 đơn gần nhất có thao tác chuyển trạng thái/in phiếu.
- `/admin/vouchers` (`VoucherManager`): bổ sung dải 3 KPI tổng quan (Tổng số mã, Đang hoạt động, Lượt đã áp dụng) và bố cục 2 cột (form tạo/sửa voucher chia nhóm 2 cột bên trái + danh sách thẻ voucher dạng ticket bên phải). Giữ nguyên toàn bộ API, field names và logic nghiệp vụ.
- Checks: `npm.cmd run lint` exit 0, `npm.cmd run typecheck` exit 0, `tests/seller-portal-ui.test.tsx` 4/4 đạt (1 case sửa thứ tự attribute `aria-current`/`href` của Next Link và chạy lại đúng case đó đạt). Bước tiếp theo: owner mở `/admin/orders`, `/admin/orders/reports`, `/admin/vouchers` trên trình duyệt để nghiệm thu trực quan.

## Sửa cảnh báo concurrent query của PostgreSQL `pg` — 02/11/2026
- Trace thật với `NODE_OPTIONS=--trace-deprecation` xác định cảnh báo phát từ `pg Client.query` qua `@prisma/adapter-pg PgTransaction.performIO` và Prisma query interpreter khi các node relation cùng dùng một client transaction; không phải payOS SDK hay network callback. Hai fan-out ứng dụng cùng client còn nằm ở counts dashboard seller và count/list thư viện ảnh.
- Pool Prisma giữ `max: 5` và bật `pipeline: true`, cơ chế được `pg@8.23.1` hỗ trợ cho concurrent work trên cùng client. Hai `Promise.all` bên trong interactive transaction được đổi thành await tuần tự; các query độc lập ngoài transaction vẫn chạy song song qua pool.
- Rerun 3/3 PostgreSQL catalog cases với trace không còn warning; typecheck, scoped lint và production build đạt. Seller9/9 và payOS22/22 đều đạt nhưng command filter bị đặt sau test file nên runner chạy toàn bộ31 case, vượt giới hạn10; đã ghi rõ và không chạy thêm suite. Chưa có authenticated live checkout/payment PostgreSQL QA; xem [postgresql-deprecation-fix.md](../LOGS/postgresql-deprecation-fix.md).
- Bước tiếp theo: restart deployment để process nạp pool config mới, theo dõi stderr không còn deprecation trong catalog/checkout/seller traffic; tiếp tục migration/grants/webhook payOS theo kế hoạch riêng.

## Tách Buy Now khỏi giỏ hàng — 02/11/2026
- `BUY NOW` trên PDP nay mở `/checkout?variantId=...` mà không thêm hoặc tăng số lượng trong giỏ. Checkout tải riêng đúng một biến thể; checkout thông thường từ `/cart` vẫn dùng toàn bộ giỏ như trước.
- API shop xác thực `buyNowVariantId`, tải lại giá/trạng thái/tồn kho từ database và dùng cùng scope cho báo giá voucher lẫn tạo đơn. Đơn mua ngay chỉ trừ tồn/tạo `OrderItem` cho biến thể đã chọn và không xóa các CartItem hiện hữu; đơn từ giỏ vẫn xóa giỏ sau khi commit.
- Idempotency key phía trình duyệt được tách theo cart hoặc từng biến thể mua ngay để không tái sử dụng nhầm đơn. 5/5 case checkout đạt; scoped lint, typecheck và production build Next.js 16.4.3 đạt. Chưa QA trình duyệt với tài khoản/database thật; bước tiếp theo là nghiệm thu giỏ có nhiều món → Buy Now một món → đặt COD/payOS → xác nhận giỏ cũ còn nguyên.

## Thanh toán → dashboard người bán — 02/11/2026
- `/admin/orders` nay là dashboard ADMIN với nhóm Cần xử lý/Chờ thanh toán/Cần đối soát/Tất cả, counts thật và phân trang server20đơn. PayOS PAID đã verified vào Cần xử lý bằng chính Order checkout; không tạo bản sao đơn hoặc trừ kho lại. Seller xác nhận chuẩn bị hàng→giao vận chuyển→hoàn tất qua transaction/status guards cũ.
- API `/api/admin/orders` GET/POST kiểm role, Origin/session và fresh DB role khi mutation, chặn unpaid/reconciliation/stale status. Poll DB20giây pause hidden, có refresh; filter chạy trước pagination để không che paid order bởi100unpaid mới hơn. Báo cáo/tồn kho cũ ở `/admin/orders/reports`, sidebar có link Đơn hàng & thanh toán.
- 9/9service mock cases đạt; check10 chỉ đọc DB xác nhận Order có nhưng OnlinePayment/PaymentAttempt/PaymentReceipt chưa có, PAYOS_ENABLED false. Lint/typecheck đạt; production build cô lập đạt, sau owner yêu cầu dừng PID30184 bị treo thì build ngay workspace cũng exit0. Chưa browser/PostgreSQL transaction/real payment QA.
- Bước kế tiếp: deployment dùng build mới; hoàn tất reviewed payment migration + grants/webhook setup/enable theo PAYOS_SETUP để nhận đơn payOS thật. Báo cáo [PAYOS_SELLER_DASHBOARD.md](../LOGS/PAYOS_SELLER_DASHBOARD.md). Không thay main data/env/schema trong task này.

## Vá dependency security — 02/11/2026
- Đã nâng Next.js/eslint-config-next16.4.0 lên16.4.3 và pin minimatch11.0.3 bằng npm override; giữ ESLint9.39.5. Audit full và production đều0 vulnerabilities, tree dependency hợp lệ. Không downgrade lint/không audit fix force.
- `scripts/lint-minimatch-compat.mjs` chỉ nạp từ ESLint config để plugin API3 dùng matcher upstream11; makeRe().test() được chuyển sang nonrecursive matcher, không khôi phục regex cũ. Source/API/payment runtime không import helper.
- 10case chọn lọc đạt (8compatibility/lint,2payOS security); có hai fail đầu đã sửa và chạy lại đúng ca liên quan. Lint/typecheck/build16.4.3 đạt; npm ci dry-run đạt, chưa fresh install/browser/DB QA. Chi tiết [DEPENDENCY_SECURITY.md](DEPENDENCY_SECURITY.md) và [báo cáo](../LOGS/DEPENDENCY_SECURITY_PATCH.md).
- Không đổi DB/env/credentials/Cloudflare hoặc restart deployment. Bước kế tiếp: khởi động deployment với build mới; tiếp tục rehearsal/migration và webhook setup payOS còn pending. Lớp tương thích cần gỡ khi upstream lint không còn dùng API3.

## Checkout payOS — 02/11/2026
- Đã tích hợp source vào checkout hiện hữu: COD/payOS, tạo/reuse đơn và attempt, VietQR local từ SDK, hosted fallback, copy/countdown/polling, retry/cancel, callback chỉ tin server, webhook signature và signed GET reconciliation. Customer/Admin orders hiển thị payment/receipts; chưa paid hoặc cần đối soát thì không được giao hàng. Kho chỉ reserve tại checkout, không giảm lần nữa theo webhook.
- Migration additive `20261102150000_payos_payments` tạo OnlinePayment/PaymentAttempt/PaymentReceipt, chưa apply DB/quyền. Ba credential cục bộ đã có (chỉ kiểm presence), `PAYOS_ENABLED` chưa bật. Không thay `.env`, dữ liệu hay Cloudflare và không tạo payment link/chuyển tiền thật.
- Mock kiểm tra 22 tình huống riêng biệt qua lượt đầu20 + các lượt chọn lọc khi chỉnh source; 2 regression validation/lifecycle cũ đạt. Schema validate/generate, typecheck, lint/build đạt tại các lượt đã ghi; kết quả cuối trong [báo cáo payOS](../LOGS/PAYOS_CHECKOUT_INTEGRATION.md). Chưa PostgreSQL integration hoặc visual/mobile QR QA. Yêu cầu kiểm thử cụ thể mới trong tệp đính kèm áp dụng thay giới hạn10case cho tác vụ lớn này.
- Public POST webhook kiểm tra gần nhất **404**, chưa đăng ký webhook. Follow-up dependency patch đã đưa audit17→0 và build lên Next16.4.3. Bước kế tiếp: rehearsal/migration riêng + runtime grants, khởi động build/tunnel mới, xác minh unsigned webhook400 rồi đăng ký thủ công; owner nghiệm thu chuyển khoản thật có chủ đích. Hướng dẫn: [PAYOS_SETUP.md](PAYOS_SETUP.md).
- Session hết hạn/hủy vẫn giữ đơn/reservation để retry; hủy đơn theo workflow hiện hữu sau khi phiên terminal mới hoàn kho/voucher. Tiền thiếu/thừa/đến muộn lưu receipt và flag; chưa có refund UI, cron cleanup hoặc quy trình UI clear flag.

## Bỏ Complete the Look khỏi trang chi tiết — 02/11/2026
- Khối **Complete the Look** đã được gỡ khỏi shared Product Detail View nên không còn xuất hiện ở public PDP hoặc Admin Preview, kể cả trạng thái rỗng trong ảnh owner gửi.
- Gallery, thông tin sản phẩm, mua hàng và **You May Also Like** giữ nguyên. Source/API/queue Complete the Look hiện chưa bị xóa để không làm mất dữ liệu hoặc mở rộng tác vụ sang thay đổi backend.
- Bước tiếp theo: owner refresh PDP/preview và xác nhận gallery nối trực tiếp sang nội dung còn lại ở desktop/mobile.

## Tồn kho cạnh giá trên trang chi tiết — 02/11/2026
- Trang chi tiết/preview dùng chung nay hiển thị trạng thái biến thể ngay cạnh giá theo dạng `500.000 VND · Còn hàng · 100`; khi hết hàng vẫn hiện `Hết hàng`, khi chưa chọn được biến thể thì không bịa tồn kho.
- Giá và tồn kho tiếp tục đổi đồng bộ theo biến thể đang chọn; dòng tồn kho cũ phía dưới khu vực mua hàng đã được bỏ để tránh lặp. Không đổi dữ liệu, giá, inventory, API hay hành vi mua hàng.
- Bước tiếp theo: owner refresh PDP/preview và xác nhận hàng giá–tồn kho ở desktop/mobile.

## Chẩn đoán đăng nhập production — 02/11/2026
- Owner báo đăng nhập tại `https://aureluxury.store/login` hiện thông báo địa chỉ truy cập không phù hợp. Đây là mapping UI của Better Auth cho `INVALID_ORIGIN`, `INVALID_REDIRECT_URL` hoặc `INVALID_CALLBACK_URL`; không phải lỗi sai mật khẩu.
- `.env` hiện có canonical `BETTER_AUTH_URL="https://aureluxury.store"`. Khi chạy tạm production build với cấu hình này, POST giả lập qua forwarded host/origin HTTPS canonical trả `401 INVALID_EMAIL_OR_PASSWORD`, chứng minh origin canonical được chấp nhận; cùng request với origin cũ `http://localhost:3000` trả `403 INVALID_ORIGIN`, tái hiện đúng thông báo.
- Không có listener Next.js hay `cloudflared` đang chạy tại thời điểm kiểm tra và máy host không kết nối được public URL. Khả năng phù hợp bằng chứng nhất là lượt deploy owner thử đang dùng tiến trình Next/tunnel cũ đã nạp origin localhost, hoặc request thực tế đi qua hostname/scheme khác canonical. Không thay auth guard/trusted origins và không tắt CSRF.
- Bước tiếp theo: dừng hoàn toàn tiến trình Next/cloudflared cũ, chạy lại `start-aureluxury.cmd` sau khi xác nhận `.env` canonical, rồi kiểm tra DevTools request đăng nhập có `Origin: https://aureluxury.store`; nếu vẫn lỗi, lưu response JSON và headers `origin`, `host`, `x-forwarded-host`, `x-forwarded-proto` đã redaction để đối chiếu.

## Public hostname qua Cloudflare Tunnel — 02/11/2026
- Đã thêm launcher `start-aureluxury.cmd` cho hostname mục tiêu `https://aureluxury.store`. Script chỉ tiếp tục khi `.env` có `BETTER_AUTH_URL` khớp origin HTTPS, `cloudflared` có trên `PATH` và connector token có trong biến môi trường cục bộ `CLOUDFLARE_TUNNEL_TOKEN`; không ghi token hay secret vào source.
- Hướng dẫn tạo named tunnel, public hostname/DNS, TLS và redirect `www` nằm tại `docs/CLOUDFLARE_TUNNEL_SETUP.md`. Nginx không bị thêm hoặc sửa; owner yêu cầu xác nhận riêng trước bất kỳ cấu hình Nginx nào.
- Cloudflare chưa được thay đổi trong phiên này vì chưa có phiên đăng nhập/account authorization hay tunnel token. Bước tiếp theo: owner tạo/ủy quyền named tunnel cho `aureluxury.store`, cài `cloudflared`, đặt production DB/secret/origin trong `.env` cục bộ, rồi chạy launcher và nghiệm thu HTTPS/auth/checkout thật.

## Thuộc tính sản phẩm động AUREL — 02/11/2026
- Admin Product Editor phần **Thuộc tính & dữ liệu AI** nay bắt đầu bằng Loại trang phục bắt buộc, tiếp theo là Thông số chung, Thông số riêng theo loại và Phong cách & ngữ cảnh. Có cấu hình cho 11 loại; các chip Phong cách/Mùa phù hợp/Dịp sử dụng vẫn là dữ liệu chung, không bị xóa khi đổi loại.
- `ProductProfile.dynamicAttributes` (JSONB object) lưu các key ổn định và giá trị controlled của thông số riêng. Backend chỉ nhận thuộc tính phù hợp với `garmentType`; không nhận field của loại cũ hoặc giá trị ngoài danh sách. Migration additive `20261102110000_dynamic_product_attributes` đã được tạo nhưng chưa apply DB.
- Sửa 503 bước Tiếp theo: Prisma vẫn thêm default dynamicAttributes vào INSERT dù bỏ khỏi data/select. management.persist nay dùng SQL tham số hóa với cột tường minh trên schema cũ; schema mới giữ Prisma upsert. Không migration; thông số riêng chưa lưu trên schema cũ.
- Xác minh 02/11: ca rollback tái hiện P2022 pass sau sửa; tạo DEMO nháp ID23 (AUR-236483660001), stock0. Backend create/replay/update/reload đạt; typecheck/lint đạt. Chưa xác nhận HTTP signed session/UI vì browser host unavailable. Next: mở /admin/products/23/preview; backup/rehearse/apply JSONB để lưu thông số riêng.

## Dọn dữ liệu DEMO theo yêu cầu owner — 02/11/2026
- Owner đã xác nhận xóa trực tiếp database các mã `AUR-2026110103`–`AUR-2026110108`, kể cả dữ liệu tham chiếu bắt buộc. Transaction Serializable đầu xóa `0104`–`0107` cùng ProductImage/ProductPrice/ProductProfile/ProductVariant; transaction thứ hai xóa `0103`/`0108`, 2 CartItem liên quan, 1 OrderItem và đơn DEMO PENDING một dòng `DEMO-1-11c1a6c8-9ecc-4cc2-8fd9-944b0e977c0d` (không có voucher).
- Post-commit read-only xác nhận cả sáu Product Code, hai CartItem và đơn DEMO trên không còn. Không xóa Category, ImageAsset, User, schema hay source code. Đây là ngoại lệ vận hành theo yêu cầu owner, thực hiện trực tiếp nên không đi qua JSONL audit của service; cần đối chiếu/reconcile audit trước vận hành production.

## Xóa sản phẩm từ danh sách ADMIN — 02/11/2026
- `/admin/products` có cột **Thao tác**. Sản phẩm đang hoạt động chỉ báo cần lưu trữ trước; sản phẩm đã lưu trữ có nút Xóa mở native dialog, tải aggregate mới nhất và buộc ADMIN nhập đúng Product Code trước khi gửi xóa.
- `POST /api/admin/products` operation `delete` tiếp tục kiểm tra Origin, Better Auth/role ADMIN, version và các reference server-side; sau commit xóa metadata ảnh/giá/profile/variants và Product trong một Serializable transaction, đồng thời revalidate `/`, `/products`, PDP slug cũ và Explorer. Không có bulk delete, cascade mù, xóa asset binary hay xóa dữ liệu main trong tác vụ này.
- UI giữ thông báo thành công/audit pending qua query Explorer. Nếu sản phẩm còn Order/Cart/TryOn/Favorite/Recommendation hoặc bản ghi đã đổi, API trả lỗi an toàn để tải lại thay vì xóa nhầm. Files chính: `components/admin/product-delete-control.tsx`, `product-explorer.tsx`, `api/admin/products/route.ts`, `features/products/management.ts`.
- Checks: lint, typecheck và build đạt; `test:admin-products` đạt 8/8 trên `aurel_ai_test`, main fingerprint không đổi và fixtures đã dọn. Chưa có browser/manual QA; bước tiếp theo là owner lưu trữ một sản phẩm thử, nhập đúng mã trong Explorer và xác nhận trạng thái thành công/lỗi ở desktop và mobile.

## AUREL Product listing redesign — 02/11/2026
- `/products` đã đổi sang listing quiet-luxury theo reference: heading serif, filter panel ivory hai hàng có query thật, grid card ba cột desktop/hai cột tablet/một cột mobile, surface/image/action controls tinh gọn. Không thêm ảnh, giá, danh mục hoặc inventory giả.
- `CatalogBrowser` tiếp tục parse query/filter/pagination server-side như cũ. Thẻ product dùng tên, category/brand, ảnh, giá và stock thật; tim gọi POST favorite hiện hữu, icon túi dẫn tới PDP để khách chọn biến thể trước khi add cart. Empty/error/pagination vẫn giữ.
- Lint và typecheck đạt; không chạy suite, build hay browser QA. Báo cáo: `LOGS/AUREL_PRODUCTS_UI_REDESIGN.md`.
- Follow-up visual: nền studio warm-neutral đã được đặt phía sau listing, card/image spacing được cân lại và media surface tắt pseudo-element để không xuất hiện lớp tròn trắng. Asset gốc đã kiểm tra không có overlay; không đổi catalog/API/route/data. Cần owner refresh `/products` để nghiệm thu trực quan.
- Follow-up 2: thêm asset background `public/images/aurel/products-editorial-backdrop.png` (vòm plaster/bóng lá) cho listing. Vùng media card được reset cả surface/link/image để chặn lớp phủ tròn trắng từ presentation; không sửa tên, giá, ảnh DB hay inventory.
- Follow-up 3: nền graphic của listing nay full-bleed đến hai mép viewport; shell nội dung/filter/card vẫn giữ giới hạn đọc 1320px.
- Follow-up 4: ảnh trong media card `/products` vẫn `object-fit: cover` nhưng nay neo `object-position: center top` thay vì 52% dọc, để ưu tiên phần phía trên của ảnh (như khuôn mặt/người mẫu) trong khung ngang; không đổi asset, dữ liệu catalog hay kích thước thẻ.
- Typography follow-up: storefront serif stack ưu tiên `Times New Roman`/`Cambria` thay Georgia để đầy đủ glyph tiếng Việt; heading tiếng Việt không dùng tracking âm để tránh dấu bị tách. Không dùng `next/font/google` hoặc network font.
- Search follow-up: mọi điểm vào tìm kiếm storefront nay dùng `/products` và query catalog thật (ví dụ `/products?gender=women`). Route `/search` chỉ redirect tương thích sang `/products`, giữ nguyên query; chi tiết cấu hình search sẽ thực hiện sau theo owner.
- Home Explore follow-up: section “WHAT ARE YOU LOOKING FOR?” dùng ivory trắng nhẹ `#f8f5ef` để tệp nền warm-neutral; không đổi form search, CTA, spacing hay các section editorial khác.
- AUREL Edit follow-up: card đầu tiên “Modern Minimalist” dùng visual campaign local mới, layout hero riêng với metadata THE AUREL EDIT / EDIT 01 và CTA bài viết độc lập; các card lookbook còn lại giữ nguyên. Section/anchor The AUREL Journal đã bỏ khỏi homepage/navigation.
- AUREL Edit hiện giới hạn 6 thẻ (Modern Minimalist đến Earth Tones); header, accessible carousel label, per-card label và progress counter đều lấy số lượng động là 6.
- AUREL Edit card 02 là Modern Gentleman, dùng asset user cung cấp (`image.png`, đã copy vào public asset path) cùng layout editorial lead và metadata EDIT 02.

## AUREL global footer — 02/11/2026
- Theo ảnh owner xác nhận, footer storefront/auth thống nhất dùng đúng layout bốn cột nền espresso: AUREL + statement, Explore, Customer Care và Follow. Không có giant wordmark, bottom metadata hay footer nhỏ; mọi route `/admin/*` không có footer.
- `Footer` vẫn là client shell theo pathname, chỉ chọn render/không render; không đổi route, dữ liệu, xác thực hoặc asset. Theo chỉ đạo hiện hành không chạy check/browser; cần owner xem desktop/mobile khi tự refresh.

## Public product showroom — 01/11/2026 (source hiện tại)
- Bố cục tham chiếu `/admin/products/1/preview` được dùng chung với public `/products/[slug]`; nút mua public nay có đúng kiểu espresso/outlined của preview và ProductPurchase gọi giỏ/mua ngay/yêu thích thật. Có link đăng nhập quay lại variant, Size Guide dữ liệu size/fit và link ảnh card vào PDP.
- Admin preview có Xem trên website theo slug khi đã publish; Complete the Look không còn render trên PDP/preview theo yêu cầu owner; related chưa có AI dùng link khám phá category. Không đưa controls admin/local demo/rating mẫu ra public, không sửa data/stock/publish của product1. Xem [PUBLIC_PRODUCT_SHOWROOM.md](PUBLIC_PRODUCT_SHOWROOM.md).
- User yêu cầu tuyệt đối không test: không test/lint/typecheck/build/HTTP/browser/DB verification, không worker trong tác vụ. Chỉ source/docs đã đổi, chưa build/restart production; không claim visual/function pass. Các kết quả pass của phiên trước phía dưới không áp dụng phiên này.

## AUREL Account interface redesign — 01/11/2026
- Dialog tài khoản từ header và `AccountControl` đã được làm lại theo mẫu AUREL: panel ivory hai cột desktop/tablet, card điều hướng mềm, typography serif, nút đăng xuất gradient espresso và still-life local ở cột phải. Sau hai lượt phản hồi owner, desktop còn tối đa760px/540px, tablet700px/560px; typography/card/asset đều thu theo tỷ lệ. Mobile vẫn một cột/ẩn ảnh và giữ vùng bấm tối thiểu44px.
- `AccountPanel` vẫn dùng Better Auth `useSession` và logout hiện hữu; trạng thái email/verification dùng dữ liệu phiên thật nhưng không hiển thị email dưới thẻ theo yêu cầu owner. Link hồ sơ, đơn hàng, yêu thích và logout giữ URL/hành vi cũ. Mục quản trị chỉ render sau GET `/api/shop?view=account` đọc role đã xác thực phía server; mọi trang/thao tác ADMIN tiếp tục xác thực role lại ở server, không tin UI.
- Ảnh `public/images/aurel/account-editorial-still-life.png` là asset local được tạo cho decorative area, không gắn inventory/đơn hàng/đánh giá hay thông tin khách. Lint (kể cả sau compact sizing), typecheck, build và HTTP đọc-only (`/`/asset mới đều 200) đạt; chưa có browser/manual visual QA do chủ dự án yêu cầu không dùng Computer Use. Báo cáo: `LOGS/AUREL_ACCOUNT_UI_REDESIGN.md`.

## T02 voucher — 01/11/2026 (hiện tại)
- Đã có `/admin/vouchers`, mã cố định VND/phần trăm, hạn/đơn tối thiểu/trần/tổng lượt/lượt mỗi khách; checkout áp/bỏ mã, server quote và revalidate khi chốt, discount snapshot trên orders/phiếu in. Chi tiết [VOUCHERS.md](VOUCHERS.md).
- Order giữ subtotal/discount/net; giá dòng gốc không đổi. BigInt/floor VND; replay không tiêu thêm lượt, hủy trước giao hoàn lượt cùng stock; Serializable + voucher row write/version và chống ghi đè admin.
- Migration riêng20261101170000_checkout_vouchers đã áp test/main sau backup + verified restore + preservation checks; hàng/tài khoản/đơn cũ giữ nguyên. Không apply pending taxonomy/HEX, không seed voucher/đơn/lượt giả. Prisma generate/validate/typecheck/lint/build cuối đạt.
- Theo yêu cầu hiện tại0 test nghiệp vụ, không worker/browser; chưa nghiệm thu voucher thực tế. Khi kiểm tra runtime không có listener3000; mở start-demo.cmd để dùng build mới. Bước kế tiếp T03 thông báo đơn trong website.

## T01 — cập nhật sau phản hồi chủ dự án (01/11/2026)
- Chủ dự án tự chạy demo ổn và yêu cầu không test thêm/không dùng worker; đã dừng worker và thao tác Computer Use. Kết quả trước khi dừng:7 case HTTP nghiệp vụ đạt, fixtures test dọn/main/env không đổi. Không chạy full suite.
- Source mobile bổ sung ngắt mã dài, min-width0, nút44px/input16px và bàn phím điện thoại; chưa nghiệm thu mobile browser, không khẳng định build đang chạy đã chứa source mới. Chi tiết [T01_DEMO_QA.md](T01_DEMO_QA.md).
- Kết thúc T01 theo xác nhận chủ dự án, ghi case8 chưa nghiệm thu/không chạy thêm. T02 đã được triển khai ở mục hiện tại phía trên; các kết quả T01 dưới đây là lịch sử.

## Triển khai demo — 01/11/2026 (trạng thái hiện tại)
- Đã triển khai cart lưu PostgreSQL, COD demo atomic/idempotent, đơn khách/admin, hủy hoàn kho, hồ sơ/địa chỉ, favorites, filter kết hợp/category động/pagination/thẻ ảnh-giá, báo cáo 24h/7d/30d, cảnh báo stock≤5 và phiếu đóng gói. Routes/service/files/giới hạn tại [DEMO_IMPLEMENTATION_2026-11-01.md](DEMO_IMPLEMENTATION_2026-11-01.md).
- PostgreSQL đã khởi động lại; build dùng font hệ thống để không tải Google Fonts. Lint/typecheck/build exit0; 107/107 tests; 6 nhóm HTTP integration PostgreSQL test đạt; main read-only smoke 9 URL/8 thẻ demo/API anonymous401 đạt.
- Đã thêm 8 sản phẩm DEMO/40 variants/40 giá VND/8 ảnh bìa từ assets có sẵn, sau pg_dump + pg_restore --list. Không thêm user/order/review trên main; giữ hàng cũ, tài khoản/quyền/env/schema. `start-demo.cmd` mở bản build tại localhost:3000.
- Chưa thanh toán online/chat/review/voucher/notifications/returns/ledger kho/video sản phẩm/bảng size/hosting. Chưa visual E2E; lần kiểm tra trước browser host unavailable. Kế hoạch hiện hành: [NEXT_STEPS_PLAN.md](NEXT_STEPS_PLAN.md), T01 nghiệm thu chọn lọc → T02 voucher → T03 thông báo đơn → T04 review; sau đó chat/kho/đổi trả/payment sandbox/hosting.
- Quy tắc mới: tối đa10 test case mỗi tác vụ, gồm regression được chọn và manual cases; không chạy full107 tests mặc định. Đã lưu AGENTS.md. Phiên plan chỉ sửa tài liệu,0 test ứng dụng; kết quả107tests phía trên thuộc phiên triển khai trước.

## Rà soát demo — 01/11/2026 (snapshot trước triển khai)
- Xem [DEMO_GAP_REPORT_2026-11-01.md](DEMO_GAP_REPORT_2026-11-01.md): đối chiếu đủ PDF 5 trang, loại trừ AI. Kết quả hôm nay thay thế các kết quả lịch sử khi đánh giá khả năng demo.
- Có storefront/PDP, tìm từ khóa, auth, Admin sản phẩm/ảnh/variants. Chưa có giỏ lưu trạng thái, checkout, lịch sử đơn hay admin xử lý đơn; nút mua disabled. Listing/search chỉ tên/link; thiếu bộ lọc giá/size/màu/brand riêng.
- 104/104 tests và typecheck đạt. DB check lỗi ECONNREFUSED; build lỗi tải ba Google Fonts. Lint ghi trong báo cáo/session. Chưa browser QA/DB integration hoặc xác minh lượng hàng sống.
- Người dùng cho phép thêm hàng để bán thử trong demo, cần nhãn DEMO rõ. Phiên báo cáo chưa sửa ứng dụng, thêm hàng hay ghi DB/schema.
- Bước tiếp theo: DB/build → cart → COD demo → đơn khách/admin + stock → hàng demo/catalog → QA trước chiều 02/11/2026. Các ưu tiên cũ bên dưới thuộc lịch sử.

## Kh?c ph?c ??ng nh?p local ? 2026-10-26
- ?? t?i hi?n: truy c?p 127.0.0.1:3000 trong khi BETTER_AUTH_URL=http://localhost:3000 l?m signin tr?403 INVALID_ORIGIN v? reset-request tr?403 INVALID_REDIRECT_URL. PostgreSQL hi?n SELECT1 ??t; t?i kho?n hi?n h?u c? credential, kh?ng s?a m?t kh?u/quy?n/d? li?u.
- next.config.ts chuy?n307 c?c trang t?i kho?n/admin t?127.0.0.1 sang origin localhost ?? c?u h?nh, gi? query. API gi? origin/CSRF guard. UI ph?n bi?t l?i origin/server v?i sai th?ng tin ??ng nh?p.
- Ti?p theo: m? http://localhost:3000/login v? ??ng nh?p b?ng t?i kho?n th?t; kh?i ??ng l?i server3000 ?? n?p config m?i n?u ?ang d?ng b?n build c?. Ch?a x?c minh m?t kh?u th?t ho?c email ??n inbox.


## Dynamic Variants — cập nhật modal 2026-10-23
- Modal màu Demo thu gọn về tối đa560px, khoảng cách/trường/nút vừa hơn; toàn bộ chữ dùng Be Vietnam Pro qua next/font. Preview màu, Hủy/Thêm màu và local-only giữ nguyên. Lint/typecheck đạt gần nhất; cần review trực quan.
- Modal size Demo theo cùng kiểu, có preset XXS–XXXL và nhập size custom; có thể chọn nhiều size. Danh sách size trên PDP sắp nhỏ đến lớn (cỡ chữ apparel, số trước, custom theo tên); Demo vẫn stock0/no price/inactive/local-only.

## Danh mục và bộ sưu tập — 2026-10-23
- Form Admin có lưới danh mục theo Nam/Nữ với icon SVG tự vẽ; dùng lại Category thật, chỉ tạo preset thiếu khi ADMIN bấm chọn. Custom/search/legacy selection/Unisex giữ nguyên; đổi giới tính không xóa lựa chọn.
- Sidebar Admin chuyển cây sang Product.collection thật; danh mục nằm trong Tra cứu thu gọn. Tái sử dụng trường collection slug riêng, mỗi sản phẩm tối đa một bộ sưu tập; không đổi tên/chuyển dữ liệu Category cũ tự động. Không migration/main write.
- Checks hiện tại:102 unit/14 DB/13 SSR, lint/typecheck/build đạt; Next security warning hiện hữu chưa xử lý. Visual QA: Pending Manual Review. Chi tiết [CATEGORIES_AND_COLLECTIONS.md](CATEGORIES_AND_COLLECTIONS.md).


## Dynamic Variants — trạng thái 2026-10-23
- Preview có + COLOUR/SIZE, nhập tên/HEX/custom size; chỉ local state, không ghi DB hoặc lưu qua Publish. Mặc định đã chốt: stock0, chưa giá, inactive. Production chỉ hiện dữ liệu thật; ảnh/giá/stock theo biến thể, purchase vẫn disabled.
- ADMIN variant-expand và helper Editor tái sử dụng ProductVariant/token/unique/SKU. HEX nullable tại TaxonomyOption append-only, capability guard giữ main cũ tương thích.
- Main9/test12; hai taxonomy migration và HEX chưa áp dụng main. 101 unit/14 DB/11 SSR, lint/typecheck/build đạt. Next16.4.0 warning còn tồn tại. Không main write/.env change. Visual QA: Pending Manual Review. Xem [DYNAMIC_VARIANTS.md](DYNAMIC_VARIANTS.md).
- Cập nhật 2026-10-23: modal thêm màu Demo được làm lại theo mẫu thẻ1: dialog rộng, trường nhập lớn, xem trước màu/HEX, nút Hủy và Thêm màu, vẫn chỉ lưu local state. Đã thêm responsive mobile; cần owner xem trực tiếp để chốt visual QA.

> Bố cục hiện tại (2026-10-23, theo hình số2): cột giới thiệu min140px/22%, gap20px; rail dùng hết phần còn lại, bốn thẻ đều nhau với gap12px (min120px), không cap width cố định theo viewport height. Ảnh/ô thêm12:13, cover căn giữa phía trên để phủ kín khung thay các dải trống của contain; chiều cao tự theo tỷ lệ, không ép height rồi giãn ngang. Heading36px, mô tả13px, CTA140×34px; tên/giá11px, dấu+26px bên phải metadata. Tablet<=900 ba ô, mobile44%/thẻ; dữ liệu món thứ5+ vẫn cuộn được. Scrollbar ẩn, controls Admin nhẹ và success message không tạo footer, lỗi vẫn hiển thị. Gallery63vh và panel3:2:3/API/DB/autosave không đổi. Visual QA: Pending Manual Review.
> Cập nhật 2026-10-23 — Complete the Look sửa trực tiếp và tự lưu: bấm/thả một ảnh vào khung ảnh cover/top, bỏ ảnh tại góc; bấm tên/giá để sửa, blur/Enter tự lưu, Escape hủy phần chữ đang sửa. Hàng đợi từng thẻ giữ version tuần tự, lỗi giữ dữ liệu/tệp và chờ retry tường minh. Thẻ mới nhận focus; hoàn thiện chỉ bật khi đủ ảnh/tên/giá đã lưu. Nền kéo sát mép trái bằng pseudo-element, chữ căn lề gallery, mép phải giữ nguyên. Gallery thay hàng nút lớn bằng menu thumbnail nhỏ Xóa/Đưa lên trước/Đưa về sau, giữ kéo sắp xếp và hỗ trợ thả tệp vào các slot. Không migration/main write; gallery desktop63vh/panels37,5/25/37,5/navbar/publish giữ nguyên. Visual QA: Pending Manual Review.
> Deployment 2026-10-23: Main aurel_ai: 9 reviewed migrations applied with owner approval; test: 12. PendingProduct is available; the two taxonomy migrations remain pending. No existing product data, sequences or .env changed.
## Hiện tại — Product Showroom hai bước (2026-10-22)
- Complete the Look thủ công đã code/test: nútThêm món trong Preview tạo PendingProduct blank/idempotent ngay; inline autosave ảnh/tên/giá VND, formHoàn thiện chọncategory/variants thật→existingShowroom→explicitpublish. Queue /admin/products/pending phân trang20, source link; source-look hàngngang/pagination20/khôngcap4. Public chỉ linked child đãpublish/cópublicimage+price, archiveẩn; detach giữqueue/product, parent khôngunpublish/touch. YouMayAlsoLike bỏcategoryheuristic, Preview Chờ AI Recommendations/Productionẩn khiAIchưa có. Main aurel_ai: 9 reviewed migrations applied with owner approval; test: 12. PendingProduct is available; the two taxonomy migrations remain pending. No existing product data, sequences or .env changed. Xem COMPLETE_THE_LOOK.md choAPI/migration/evidence.
- Desktop một khung nhìn theo plan owner: ProductDetailView thêm informationBody từcategory đến hết4accordion; desktop>=901 height65vh/65dvh bằng gallery, overflow-y:auto/x:hidden, scrollbar thin/gutter stable/padding-end8px/scroll-padding8px/overscroll contain. Region có aria-label Thông tin sản phẩm/tabIndex0/focus outline1px. information bỏsticky/top/padding-top để căn đầu gallery, YouMayAlsoLike ngoài region vàCompleteLook dưới gallery. <=900 region auto-height/cuộn trang tự nhiên. Giữ gallery65dvh/panels37.5/25/37.5/fonts/buttons/price/review-policy data gates. Target1440×900CSS/100%, không cam kết pixel-fit khi chưa manualQA hoặc không có relateddata; Admin chrome/màn thấp vẫn page scroll.
- Refinement03 shared UI có ProductRating (real summary khi được cấp dữ liệu; khi chưa có chỉ Admin Preview mẫu5/1 review gắn DEMO, Production ẩn) và ProductServiceBenefits3 cột outline truck/package/shield. Config product-service-policies.ts shipping/returns/payment hiệnnull: Preview3 Chưa cấu hình, Productionẩn unsupported promises; hỗ trợ link policy thật nếu cấu hình. AddToBag thêm icon bag18px, disabled giữ nguyên; warning kỹ thuật Preview chuyển status Admin, public vẫn note nhỏ và stock thật. Main hiện3 colors chỉsizeM/stock0; không tự thêmXS/S/L hoặc sửa tên [AUREL COLLECTION]. Related sections đã có/shared/real-only/hide empty. Không sửa65dvh/gallery panels/navbar/DB/currency/auth/workflow.
- Information Panel02 hoàn tất theo design target1440px CSS/zoom100%, không coi đó là thông số screenshot gốc. Chỉ scoped information CSS/shared markup: category11px/gap12; title clamp34–36px/500/1.1 (mobile28–34), price21px/600/gap10; desc14px/1.55/margin14/padding20; divider→color16/color→size20/size→buttons16/buttons gap8/utility gap18. Swatch34px/gap10; size44px/min56 (mobile52); purchase46px/12px600/#34251f; native accordion46px/13px/right chevron/border separators. SKU chuyển ProductDetails, stock vẫn rõ, unavailable note11px. Giữ gallery65dvh/panels37.5/25/37.5/navbar/backend/data; rating không có data thật vẫn ẩn.
- Đã sửa giá storefront: base currency VND lấy từ ProductPrice được gắn currency rõ ràng, độc lập MULTI_CURRENCY_ENABLED; flag chỉ bật lựa chọnUSD/EUR, không tự FX/backfill/đọc legacy amount thànhVND. Public PDP/catalog/paging/related và Showroom dùng cùng defaultVND, selector nếu bật mặc địnhVND. Main read-only loader verify ID1 real product “[AUREL COLLECTION] Limited Edition Coat” có3 active variants đềuVND999000, catalog/PDP trả999000. Không đổi DB/env/flag.
- Gallery Visual Refinement02 chỉ CSS: giữ65vh/65dvh và panels3:2:3 (37.5/25/37.5 sau gap6px). Metadata read-only cover1122×1402≈4:5; nguyên nhân side gutters là cột1.35fr rộng hơn aspect ảnh với contain, không có padding main. Cột chính giới hạn theo width52dvh=65dvh×4/5 và57.45% khi thiếu ngang; contain/center giữ toàn bộ ảnh, không crop hoặc đổi binary. Rail68px desktop/64px<=1200/56px<=900/54px mobile, thumbnail vuông/gap9px/border chọn mảnh, top0/scroll nội bộ. Rail track dư7px + grid gap7px = khoảng14px từ thumbnail sang main; main→panel7px. Navigation36px tròn/arrow20px/gap8px/espresso#34251fb3/inset16px; counter10px. Caption inset16px desktop, breakpoint nhỏ giữ inset cũ. Mobile<=600 auto-height/rail ngang scroll/panels ngang giữ nguyên.
- Rating hiện theo Refinement03: reusable ProductRating nhận actual average/count; Preview missing-data mẫu5 sao/1 review có nhãn DEMO, Production không có review thật thìẩn. Không thêm review DB/aggregate giả.
- Gallery refinement01 chỉ sửa product-detail.module.css dùng chung preview/public: desktop/tablet height65dvh (fallback65vh), theo65% chiều cao viewport thay vì clamp theo chiều rộng; main/panels cùng height, panels rows3:2:3/gap6px, gap cột7px. Layout1.857:1 (~65/35 sau gutter), gap24–44px; padding đầu trang10→6px/breadcrumb bottom10→6px/link30→28px. Rail68px desktop (64px<=1200,56px<=900), thumbnail1:1/gap9px/selected border mảnh/internal scroll. Main object-fit contain, panels cover không stretch; tablet cùng65dvh, mobile<=600 auto-height/main4:5/rail ngang/panels3 ô. Typography thông tin/navbar/TSX/upload handlers/backend/DB/workflow không đổi.
- Owner đã yêu cầu xuất bản DEMO ID1 “DEMO — Áo khoác AUREL”: isActive=true, slug demo-ao-khoac-aurel-showroom. Tại lúc publish có5 ảnh/3 biến thể active đều có giá do owner đã chỉnh sau lần tạo draft; publish giữ nguyên toàn bộ children/giá/tồn kho. Dùng managementFinalize validator/confirmed, kiểm tra main/readback thành công. Sản phẩm vẫn gắn nhãn DEMO; xem /products/demo-ao-khoac-aurel-showroom. Không đổi schema/auth/env.
- Step1 /admin/products/new hoặc /[id] chỉ nhập thông tin/taxonomy/variants/giá/tồn kho, giữ rich description; bỏ ảnh/summary/sidebar phải và các nút save, chỉ Tiếp theo #34251F. Backend prepare tạo/reuse internal unpublished draft, ID thật và idempotency ticket; back/edit dùng cùng ID/ảnh. Published edit có xác nhận unpublish.
- Step2 /admin/products/[id]/preview dùng cùng ProductDetailView/EditorialGallery với /products/[slug]: rail thumbnail, main desktop65dvh/mobile4:5,3 editorial panels và thông tin sticky. Click slot upload; replace/remove/cover/role/order/library persist ngay vào ImageAsset + ProductImage, transaction/version/ownership, stale/failure giữ ảnh cũ. Không fake photos/ratings/prices/shipping.
- Save Draft/Save Product ở Step2, selector trạng thái mặc định unpublished; publish cần confirmation và variants/prices/public cover hợp lệ. Preview không tạo cart/order/stock mutation; checkout chưa triển khai nên purchase buttons disabled. Related sections chỉ active catalog thật và ẩn khi không có hàng phù hợp.
- **Main aurel_ai đã được owner phê duyệt và áp dụng riêng migration20261021120000_product_draft_requests: main8/test10**. Bảng idempotency đã sẵn sàng cho Tiếp theo → Showroom. Hai SQL taxonomy vẫn pending riêng; không apply kèm. Backup/verified restore mới aurel_ai_restore_test_20261022073329_9d848d, SHA587d3dbc2d2d8523954713dca6013bba7327a54f4ec3f5e3da64251f18f3b882; no-drift/rehearsal/old rows/sequences/env checks đạt, không fixture main. Report `.local/backups/aurel_ai_restore_test_20261022073329_9d848d.showroom-migration.json`.
- Checks: Prisma generate,92 unit/12 PostgreSQL tests gồm parent/3 Node SSR tests, lint/typecheck/build đạt. DB fixtures test cleanup/rollback, main read-only fingerprint/env unchanged. Backup/restore rehearsal aurel_ai_restore_test_20261022072134_fefd7f, SHA9b2eb4ad603ef91f263b9cb9bc37008bd4986756f3d6792526ecc09c562757a3, report .showroom-rehearsal.json noDrift/rehearsal/mainUnchanged=true. Không browser/Test Screen/Computer Use/Playwright/screenshot/HTTP QA hoặc email.
- Visual QA Pending Manual Review; persistence chứng minh qua connection Prisma mới/SSR reload data, không browser refresh thực tế. Báo cáo đầy đủ/files/routes/acceptance1–15/migration/limits tại PRODUCT_SHOWROOM.md. Next exact: owner manual QA luồng hai bước trên main; Prisma/Next đã reload sau migration được duyệt. Hai taxonomy SQL giữ pending.

## Storefront và chức năng đã giữ
- Typography shared storefront/PDP dùng đúng2 web fonts next/font/google: Cormorant Garamond500/600 (latin+vietnamese), DM Sans400/500/600 (latin+latin-ext), display swap/adjustFontFallback=false; root html chỉ khai báo CSS variables, không đổi body/global font nên Admin forms giữ nguyên. Wordmark600/34px/uppercase/.12em; nav500/13px; title500/clamp34–40px/1.08; editorial headings500/clamp44–52px; priceDM600/21px; summaryDM400/14px/1.65; labels600/12px/buttons600/12px/.04em/metadata-accordions13px. Warm ivory/espresso, gallery/layout/logic giữ nguyên.
- DM Sans upstream chỉ có latin/latin-ext và thiếu phần lớn ký tự Việt. Stack DM Sans → Cormorant Garamond → generic sans-serif giữ đủ dấu bằng font thứ2, không thêm font thứ3; một số chữ Việt trong body sẽ có nét serif. Kiểm tra cmap file WOFF2 đã build qua fontTools + Node Brotli: Cormorant104/104, DM Sans14/104 codepoints Việt được kiểm tra. Nguồn metadata chính thức: https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/METADATA.pb.
- Navbar storefront/sticky nền đặc #f3eee7, height64→56px; logo29→26px (mobile24px), menu12→11px/gap12–24px, search36→32px/width170–270px/text10px, icon23→20px/search16px. Giữ vùng bấm44px, breakpoint/menu/search/account logic và nav hero trong suốt cũ.
- Hero đầu homepage giữ nav cũ trong suốt New In/Shop/The Edit/Journal; sticky và các storefront pages có Women/Men/Accessories/Essentials/Collections/AI Recommendations, search pill/account/cart; wishlist disabled do chưa backend. Women/Men query gender thực gồm unisex, null không suy đoán. AI nav dẫn showcase hiện có, không bật AI engine.
- Header admin espresso/avatar người nền trắng, sidebar ivory bo góc; heading1–3 đồng bộ bar/badge gradient. Helper/subheading ngoài ô và card Lưu ý đã bỏ. Badge dirty vàng/saved xanh phản ánh baseline thật. Không redesign homepage/hero/video trong showroom task.
- Video vẫn dùng MP4 H.264/WebP poster tối ưu, không che chữ gốc; reduced-motion/viewport lifecycle như VIDEO_PERFORMANCE.md. Auth/email/ADMIN thật giữ nguyên; không thêm role bypass hoặc fake session.
- Main đã có audience nullable và ImageAsset BYTEA qua2 migrations được duyệt trước; PRODUCT_FOUNDATION/currency flags không tự đổi, public legacy amount không tự gán tiền. Kho ảnh tìm theo tên Product đã lưu; generic editor flow trước showroom là lịch sử ở SESSION_LOG/IMAGE_STORAGE.

## Các phase đã triển khai (lịch sử; trạng thái hiện tại ở trên)

## Cấp ADMIN theo chỉ định chủ dự án (2026-10-22)
- Đã cấp ADMIN cho duy nhất tài khoản hiện hữu được chủ dự án chỉ định trực tiếp. Đối chiếu email chính xác/ID, emailVerified=true trước khi cấp. Không tạo user, không tự xác minh email, không đổi password/session/secrets/schema/database roles/grants.
- Transaction Serializable, khóa row và conditional UPDATE đúng ID/email/role=CUSTOMER, affected row=1; cập nhật role và updatedAt. Hậu kiểm read-only xác nhận ADMIN và trạng thái verified giữ nguyên. Audit intent/committed fsync trong .local/audit/admin-provisioning.jsonl, chỉ metadata; danh tính chi tiết giữ local, không chép email cá nhân vào docs/source công khai.
- API ADMIN với anonymous vẫn401. Product Service đọc lại DB role mỗi operation, không cần restart hoặc tự tạo signed session. Chưa thử bằng cookie/password của người dùng, không yêu cầu chia sẻ credentials. Bước tiếp theo: người dùng mở http://localhost:3000/admin/products bằng tài khoản được cấp; visual/user-session QA thủ công.

## Email website chính đã cấu hình (2026-10-22)
- Theo yêu cầu bật xác minh email, đã reuse credentials Resend của chính dự án từ .env.test, chỉ cấu hình RESEND_API_KEY và EMAIL_FROM trong .env local; không in/commit secrets. Địa chỉ gửi AUREL <no-reply@fourdteam.win>; GET provider domains200 xác nhận fourdteam.win verified trước khi thay đổi.
- Đã restart đúng Next start của workspace ở cổng3000 để nạp env mới; không restart PostgreSQL. GET /verify-email và /forgot-password200, deliveryAvailable=true, không còn thông báo dịch vụ email chưa sẵn sàng. Session/auth secret và các biến env khác giữ nguyên, requireEmailVerification vẫn false.
- Chưa gửi email trong task này hoặc tự xác minh tài khoản; người dùng reload trang rồi bấm Gửi lại email xác minh để gửi tới địa chỉ của mình. Không tạo/sửa user/role/schema, không migrations hoặc test fixtures. Provider configuration/domain readiness không phải bằng chứng email đã đến inbox.
- Bước tiếp theo: chủ dự án gửi từ UI, kiểm tra Inbox/Spam và mở link xác minh; link local chỉ dùng khi truy cập được localhost:3000. Nếu cần public deployment phải cấu hình origin public phù hợp riêng.

## Khôi phục đăng nhập/đăng ký local (2026-10-22)
- Lỗi thực tế: PostgreSQL không nhận kết nối, db:check báo ECONNREFUSED. Đã chạy db:start ngoài sandbox để bật cluster hiện có; SELECT1 sau đó đạt. Không sửa auth code/env/security/schema, không migrate/seed/main fixtures.
- Website http://localhost:3000 đang phục vụ, khớp BETTER_AUTH_URL. GET /login và /register200 có form; get-session200/null; signin với tài khoản không tồn tại trả401 INVALID_EMAIL_OR_PASSWORD thay vì lỗi DB. Main read-only audit hiện0 User/Account, cần đăng ký tài khoản thật trước khi đăng nhập.
- Kiểm tra Better Auth + PostgreSQL thật trên aurel_ai_test: signup200/CUSTOMER, signin200, signed session đúng user, logout200 và replay null; fixture cleanup, main fingerprint và .env unchanged. Tại thời điểm recovery provider main chưa cấu hình; đã được bật trong bước cấu hình email tiếp theo ở trên. requireEmailVerification=false giữ nguyên. Không gửi email thật/tạo tài khoản main.
- Bước tiếp theo: đăng ký tại http://localhost:3000/register với mật khẩu12–128 ký tự rồi đăng nhập. Nếu DB lại dừng: npm.cmd run db:start, npm.cmd run db:check; PostgreSQL portable không tự chạy theo website. Chưa xác định nguyên nhân process DB đã dừng trước task.

## ?nh Intelligence ? 2026-11-01
- ?? thay video b?ng ?nh ng??i d?ng cung c?p t?i `image.png`, xu?t `public/images/aurel/intelligence-runway.webp` (1670?942, 274.972 bytes, quality90).
- `IntelligenceShowcase` d?ng next/image lazy/responsive, alt m? t?, khung16:9/contain; gi? split58:42, mobile stack, ch?/CTA/reveal. B? overlay t?i ?? gi? m?u ?nh g?c; g? ShowcaseVideo v? CSS playback.
- Video c? gi? tr?n ??a nh?ng kh?ng c?n ???c source UI tham chi?u. Kh?ng ??i DB, d? li?u s?n ph?m ho?c c?c tr?ng th?i catalog.
- Lint kh?ng b?o l?i; typecheck hi?n b? ch?n TS2737 BigInt target d??i ES2020 t?i shop-client.tsx v? features/vouchers/rules.ts (ngo?i ph?m vi ?nh). Ch?a build/nghi?m thu browser; b??c ti?p theo: x? l? target BigInt r?i xem /#intelligence tr?n b?n dev ho?c build m?i.

## Hiện tại — Phase 2.9.2 (2026-10-21)
- Main local aurel_ai đã apply đủ 5 migrations. Ba migration multi_currency, order_revision, product_foundation đã triển khai thật sau backup mới, restore verification, no-drift/checksum review và rehearsal. Cột cũ và sequences cũ giữ nguyên; main có 0 hàng nghiệp vụ/auth trước và sau, không seed hoặc tạo ADMIN. Evidence và SHA tại ADMIN_PRODUCTS.md và .local/backups/*7b754f.main-migration.json. Phase2.9.3 thêm2 SQL staged mới chỉ test; main hiện chưa apply hai SQL đó.
- Có /admin/products Explorer, /new, /[id], /import và /api/admin/products: cây Category/Collection/Active/Archived, search/paging25, Category creation/search50/trang, aggregate CRUD/options/AI taxonomy/variants/stock/prices/images, archive/restore và hard-delete có xác nhận code/reference guards. UI scoped theo tokens, empty/loading/error/success; không redesign storefront.
- Mỗi operation reuse Product Service.run, Better Auth session thật, expiry, DB ADMIN và Serializable. Allowlists/child ownership/CSRF và aggregate version hash bảo vệ mutations. Delete chặn OrderItem/CartItem/TryOn/Favorite/Recommendation, explicit child transaction và local audit fsync intent/completion; không xóa asset vật lý.
- CSV6 templates: tổng2MB/2.000 dòng/100 products, preview từng bảng/lỗi dòng/digest/live revalidation và atomic insert-only import. Export100 products/trang từ cùng snapshot, formula neutralization, không private keys/secrets. Legacy thiếu code được báo bỏ qua; CSV không phải backup đầy đủ, chưa update-existing.
- Catalog/PDP sau schema deployment luôn lọc websitePermission=granted độc lập cờ AI. MULTI_CURRENCY_ENABLED vẫn unset/effectively false, PRODUCT_FOUNDATION_ENABLED env không đổi. ADMIN prices dùng schema đã migrate nhưng storefront chưa bật giá đa tiền. Không FX/legacy inference; Units Sold unavailable.
- Lint/typecheck/build và72 unit tests đạt;7 focused ADMIN PostgreSQL subtests (Node8 gồm parent), auth/pricing18 + concurrency41 + privilege probes + catalog3 regression đạt. Main read-only catalog3/3; HTTP test-cookie/CRUD/CSV/revoke/CSRF/PDP và GET-only main readonly smoke đạt, fixtures cleanup và main/env unchanged. Không email thật/browser/screenshots; Visual QA Pending Manual Review. Windows tsx cần outside-sandbox do ENOMEM; pg deprecation hiện có.
- Main đã có tài khoản ADMIN được chủ dự án chỉ định và cấp ngày2026-10-22. Bước tiếp theo: review UI thủ công theo ADMIN_PRODUCTS.md; curate hàng/giá/ảnh thật trước quyết định bật currency. Production readiness vẫn NO-GO cho đến least-privilege/TLS/backup/audit readiness; approval schema local đã hoàn tất.
- Runtime: PostgreSQL local và Prisma Studio http://localhost:51212 hoạt động; smoke servers3352/3353 đã đóng. Key paths: features/products/management.ts,admin-http.ts; lib/product-audit.ts; components/admin; app/admin/products; app/api/admin/products; scripts/main-migration.ts,admin-products-check.ts,admin-http-smoke.ts; tests/admin-products.integration.test.ts.

## Nền tảng Phase 2.9.1 đã kế thừa
- ProductProfile1:1, Product metadata/image rights/taxonomy/normalized indexes nay đã deploy main. Color-size vẫn tại variants, fabric descriptive, không EAV/embedding table. Sáu CSV headers, offline dry-run và ML feature JSONL/schema tại data/templates; chưa AI model hoặc importer ML.

## Lịch sử các phase trước
Các mô tả staged/main pending bên dưới ghi lại trạng thái trước Phase2.9.2, được thay thế bởi trạng thái hiện tại ở trên. Production readiness vẫn chưa hoàn tất.

## Product Detail Phase2.8 (2026-10-21)
- Có /products/[slug] SSR active product/category/active variants/images qua getProductDetail → Prisma queries hiện có. Slug sai/không tồn tại/inactive dùng notFound, lỗi DB có error view riêng; metadata tên/mô tả thật và request cache dùng chung metadata/page.
- Gallery chính/thumbnails/fallback ảnh, chọn màu-size chỉ cặp có thật, SKU/stock/price cập nhật từ DTO tải sẵn. Đúng tokens/serif/Arial, split desktop và stack mobile; không ảnh campaign giả làm ảnh hàng. Nút mua luôn disabled vì chưa Cart Backend. Catalog/Collection chỉ thêm link tên hàng thật có slug hợp lệ, không sửa layout/CSS/animation đã duyệt.
- Flagfalse không query ProductPrice; DTO detail bỏ hoàn toàn legacy amount/currency chưa xác minh, hiển thị giá chưa khả dụng. Khi flag được bật sau approval, currency chỉ lấy đúng ProductPrice đã chọn, không default/FX/fallback hoặc float/rounding. Không đổi .env/flag/schema/migrations/main data.
- Lint/typecheck/build và66 unit tests đạt (5 mới một file). HTTP positive/legacy-off/private-image/inactive/missing/invalid/listing link trên aurel_ai_test đạt, fixtures scoped cleanup và server3338 đóng. NotFound streaming HTTP200 kèm404 marker/noindex đã được ghi rõ; không tuyên bố HTTP404 cho request streaming. Không browser/visual tools; Visual QA **Pending Manual Review** và chờ dữ liệu hàng thật main để review nội dung.
- Tiếp theo: chủ dự án nhập dữ liệu thật qua workflow quản trị được duyệt và review PDP thủ công; Cart/Checkout chưa triển khai. Main NO-GO, không auto migrate/currency enable hoặc Admin Dashboard.

## Authentication UI Phase 2.7 (2026-10-21)
- Phase2.7.1 đã chuyển sang Lightweight QA theo cập nhật chủ dự án: source/CSS/security/a11y attributes đã rà soát, không có lỗi có bằng chứng cần sửa; lint/typecheck/61 tests/build và GET smoke5 routes đạt. Không thêm test/code UI, không email/fixtures/main writes. Visual QA1440/768/390/320 = **Pending Manual Review**, không dùng source/unit/HTTP thay bằng chứng browser. Báo cáo AUTH_UI_QA.md.
- Có /login, /register, /forgot-password, /reset-password, /verify-email; editorial split dùng ảnh campaign local, tokens ivory/espresso/serif/Arial hiện có; mobile bỏ cột ảnh. Auth navigation/footer riêng AUREL, chỉ phần account dialog/menu/header cửa hàng được nối session/logout. Không sửa hero/collection/globals hoặc animations.
- Better Auth React client cùng origin; rememberMe native, validation/loading/chặn duplicate, confirm password, safe internal redirect, callback verification/reset, neutral reset/email-unavailable. Register không auto-login/nhận role; verified chỉ lấy từ session đáng tin cậy, callback query không cấp quyền. Reset token chỉ component memory, scrub URL, no-referrer/no-store/noindex và bỏ request log token routes.
- Thêm6 focused tests trong tests/auth-ui.test.ts, tổng61 unit tests/lint/typecheck/build đạt. HTTP5 auth routes200, reset privacy headers và anonymous session=null đạt. Browser QA bị Computer Use dừng do không xác định chắc URL cửa sổ Chrome; chưa nghiệm thu trực quan1440/768/390/320, keyboard/screen-reader hoặc screenshot. Không gửi email thật/tạo user main trong phase này.
- Tiếp theo: chủ dự án review UI và browser QA4 viewport; nếu cần positive UI end-to-end dùng DB test và email capture/provider tắt, không bật production delivery. Main NO-GO và requireEmailVerification=false giữ nguyên, không Admin/Checkout/migrations.

## Authentication Email Phase 2.6.1 (2026-10-21)
- Phase2.6.2 nghiệm thu thật đã đạt trên aurel_ai_test: domain Verified được API xác nhận, đúng một verification + một reset email gửi tới mailbox đã cho phép, cả hai Resend accepted/delivered và chủ dự án xác nhận nhận. Link verification cập nhật emailVerified=true; reset qua Better Auth, old password401/new200/old session null. Fixture User/Account/Session/Verification cleanup xác nhận0. Main NO-GO không đổi.
- Better Auth 1.7.12 hỗ trợ verification 60 phút, reset 30 phút/single-use, thu hồi session sau reset. Resend adapter server-only features/auth/resend.ts đã nối lib/auth.ts, dùng templates/port hiện có. .env.test đã có key/sender, không in hoặc copy secrets; .env chính không sửa/không bật email production. Runner tương tác scripts/email-acceptance.ts chỉ đọc test config, dùng existing guard và callback loopback3316; report metadata không chứa passwords/tokens tại .local/email-acceptance.
- Thiếu provider: signup vẫn tạo CUSTOMER chưa verified; resend/reset request trả 503 đồng nhất trước account lookup. Không bắt buộc verified email, không khóa người dùng hiện tại. Có provider mới gửi verification tự động khi signup.
- Adapter fetch không dependency mới: timeout10s, lỗi sanitized, 429 cooldown theo Retry-After (1..3600s, fallback60s), không tự retry. 4 tests adapter mới, tổng55 unit tests/lint/typecheck/build đạt. Không đổi UI/schema/migrations/credentials/dữ liệu main; không chạy PostgreSQL/concurrency suite. Main vẫn NO-GO.
- Phase2.7 UI được chủ dự án yêu cầu riêng và triển khai ở mục trên; operational shared limiter/delivery monitoring/secret manager vẫn cần review. requireEmailVerification=false, production migrations/cutover cần approval riêng; không Admin.

## Database Security Phase 2.5.2 (2026-10-21)
- Thiết kế aurel_app runtime không owner/đặc quyền và migration owner tách secret. Profile được thử bằng LOGIN/password thật trên PostgreSQL cluster độc lập127.0.0.1:5544, system ID khác main. Owner không superuser vẫn deploy được hai pending migrations; app auth/session/catalog/Product Service/price/stock đạt, không nâng ADMIN/DDL/Order-write/đọc metadata. Role/fixtures lab đã cleanup, instance lab đã dừng.
- User UPDATE allowlist cột, INSERT guard CUSTOMER; auth tables DML, Product/Variant không hard-delete, Order/Item SELECT-only vì chưa checkout. Candidate provisioning chỉ nhận role lab, chưa apply main; future objects default deny. Ma trận/runbook tại DATABASE_SECURITY_READINESS.md.
- Audit readonly main vẫn login postgres đặc quyền, archive_mode off/PITR chưa hoạt động, SSL server local off, chưa chứng minh encryption/offsite/retention production. Không đổi credentials/grants/ownership/schema/.env main; không role security mới trên main cluster. Backup172320_dd5e13 hash/restore verified, diễn tập trên bản sao5544.
- NO-GO giữ nguyên: cần approval riêng SQL/role provisioning/cutover và backup/KMS/retention/RPO/RTO. Không thu hồi login cũ trước canary/rollback.45 unit tests, lint/typecheck/build và app-login security integration đạt. Auto-review chặn shared-cluster LOGIN-role plan; safer isolated cluster đã hoàn tất.

## Concurrency Remediation Phase 2.5.1 (2026-10-21)
- Migration mới 20261020170000_order_revision: token BigInt database-owned, mọi item INSERT/UPDATE/DELETE ghi header trước mutation, move ghi cả hai parents; header UPDATE tăng revision, PK bất biến, DELETE/FK giữ an toàn. Functions public-qualified, fixed search_path, SECURITY INVOKER, revoke PUBLIC EXECUTE. Không sửa migrations cũ hoặc UI/service.
- PostgreSQL regression đạt13 lịch/isolation READ COMMITTED/REPEATABLE READ/SERIALIZABLE, tổng39 + ACL/search_path probe; lỗi cũ không tái hiện (RC23514, RR/Serializable40001). Privilege probe nonowner DML đạt, không tắt trigger/TRUNCATE/replica/CREATE/helper EXECUTE. Role tạm đã xóa, không account main.
- Backup mới nhất170607_24796c hash/restore verified; Prisma deploy toàn pending chain trên restore giữ metadata4migrations đúng checksum, schema diff không khác; auth18 + concurrency41 + catalog/error3 Node tests đạt, unit44, lint/typecheck/build đạt. CLI startup timeout3s/30s và lock probe đã verify. Source/.env fingerprint unchanged.
- Main vẫn hai migrations cũ,0 User/Product/Variant/Order/Item, flag false và **deployment NO-GO chưa approval**. Code fix đủ chuyển review riêng, không tự cấp GO production. Runtime main local đang có superuser: cần tách least-privilege role/migration owner trước production, không tự đổi credentials trong task.
- Tiếp theo: chủ dự án review cả hai pending SQL, legacy plan, timeout/maintenance/recovery/permissions; trước deployment được duyệt cần backup/restore mới. Không auto-retry service; tương lai retry toàn transaction có giới hạn/idempotency/outbox. Chi tiết ORDER_CONCURRENCY_REMEDIATION.md.

## Multi-Currency Phase 2.5 (2026-10-20)
- Preflight cũ tìm ra write skew; Phase2.5.1 đã khắc phục và kiểm chứng trên test/restore. MULTI_CURRENCY_PREFLIGHT.md giữ bằng chứng lỗi cũ, ORDER_CONCURRENCY_REMEDIATION.md là trạng thái hiện tại. Main chưa approval/apply.
- ProductPrice và enum VND/USD/EUR, giá độc lập không FX; string/Decimal chính xác, VND 0/USD-EUR 2 số lẻ. Order/Item snapshot currency, unitPrice, lineTotal/totalAmount có CHECK/deferred triggers. Legacy giữ nguyên số tiền, currency NULL, không backfill suy đoán.
- API price CRUD server-only và Catalog DTO chọn currency/missing state; money/order-pricing modules chuẩn bị snapshot từ DB. Chưa checkout/reservation. UI giữ nguyên.
- Migration 20261020160500_multi_currency đã review SHA/apply test và rehearsal restored backup có legacy fixture. Main CHƯA migrate; MULTI_CURRENCY_ENABLED mặc định false, queries legacy tương thích; npm db:migrate tạm chặn. Không đổi .env, không fixture main.
- Backup mới 20261020155922_6b1b2b đã verify restore trước migration, archive local giữ nguyên. SQL/API/legacy plan/deploy gate tại MULTI_CURRENCY.md.
- Tiếp theo: review/chấp thuận SQL và bằng chứng currency từng giá legacy; trước main apply cần backup mới + rehearsal dữ liệu mới nhất. Chỉ sau approval mới deploy/bật flag. Storage/mail provider/quy trình cấp ADMIN còn chờ.

## PostgreSQL Integration Phase 2.4 (2026-10-20)
- Đã tạo `aurel_ai_test` và role riêng `aurel_ai_test_runner`, credentials trong `.env.test` không commit; không đổi `.env`/DATABASE_URL của aurel_ai. Role test không ghi được bảng production, runner xác minh quyền và target thật trước ghi/cleanup.
- `scripts/postgres-integration.ts` có setup/run/backup, bắt buộc `--confirm-test-database=aurel_ai_test`; xác minh SHA hai migrations đã review, migrate deploy vào test, guard mỗi mutation và session lookup có thể cleanup. Fixture cleanup theo mã phiên, không reset/truncate/sequences.
- Better Auth + Prisma/PostgreSQL thật đã qua 14 workflow (15 Node tests gồm parent) và 3 catalog/error integration tests: signup/signin/session/logout/revoke/expiry/roles, CRUD 4 entity, constraints, rollback và concurrent CAS một winner. 39 unit/auth/safety tests, lint/typecheck/build đạt. Các bảng test trở về baseline; aurel_ai data/schema/sequence fingerprint và .env hash không đổi.
- Đã pg_dump aurel_ai read-only và pg_restore sang restore-test DB mới; data/columns/constraints/indexes/sequences khớp. Archive/verified SHA manifest ở `.local/backups/`, không commit; quy trình trước migration kế tiếp và giới hạn global roles/PITR trong `docs/POSTGRES_INTEGRATION_TESTING.md`.
- Một thay đổi production có chứng cứ: Better Auth bỏ qua origin checks mặc định ở NODE_ENV=test; config nay đặt disableOriginCheck=false/disableCSRFCheck=false rõ ràng. Không đổi UI/schema/migration cũ. Bước tiếp theo: mail verification/reset, quy trình cấp ADMIN và chính sách backup production; chọn currency/storage trước Admin UI.

## Authentication Backend Phase 2.3 (2026-10-20)
- Better Auth 1.7.12 dùng Prisma singleton hiện có; `/api/auth/[...all]` hỗ trợ signup/signin/signout/session management. Không đổi storefront hoặc tạo Login/Register/Admin UI.
- Product service mặc định dùng resolver thật từ Next headers → Better Auth DB session, tắt cookie-cache; giữ expiry guard và DB User.role trên mỗi operation. Signup mặc định CUSTOMER, không nhận client role. Không tạo ADMIN/user trong PostgreSQL.
- Migration `20261020153000_better_auth` additive đã review/apply: User thêm emailVerified=false/image nullable, name map fullName; Session/Account/Verification serial Int; giữ User Int và FK Cart/Order/Favorite/AI/passwordHash. Không dùng CLI generate overwrite/reset/seed. Giới hạn snapshot trước migration ghi rõ trong AUTHENTICATION.md.
- Secret random chỉ trong .env; .env.example có BETTER_AUTH_URL/SECRET placeholder. Lint/typecheck/build, 37 unit/auth tests, 3 read-only integration, db:check và audit production đạt; smoke 12 routes/13 links đạt. Positive auth tests dùng Better Auth thật + official memory adapter; HTTP Prisma chỉ kiểm tra âm tính, không tạo user giả. 15 bảng vẫn 0 bản ghi.
- Phase 2.4 đã nghiệm thu positive auth/CRUD trên database test riêng, xem POSTGRES_INTEGRATION_TESTING.md. Tiếp theo nối mail provider cho email verification/reset, chọn quy trình cấp ADMIN và shared rate limiter khi deploy. Auth hiện xác minh password/session, chưa xác minh ownership email qua mail.

## Product Data Management Phase 2.2 (2026-10-20)
- Service server-only tại `src/lib/products.ts` và `src/features/products/product-service.ts`: CRUD category/product/variant/image, validation allowlist, Better Auth resolver mặc định + DB role ADMIN kiểm tra trong mọi operation; không có Admin UI/product mutation API.
- Product/variant remove là deactivate để giữ lịch sử; category/image chỉ xóa metadata, FK ngăn xóa category đang dùng. Stock chỉnh bằng expectedStock/delta compare-and-set trong Serializable transaction; giá chuỗi chính xác theo Decimal(12,2), không currency mặc định.
- Catalog đã có pagination page/pageSize (mặc định 1/20, giới hạn 10000/100) giữ getCatalog; `getCatalogPage` thêm total/totalPages/hasNext trong snapshot RepeatableRead. Không đổi CSS/layout/hero/header/animations hoặc thêm pagination UI.
- Resolver ảnh dùng chung `features/products/images.ts`: chỉ public raster `/images/` thành URL; raw storageKey không vào DTO. Public storage metadata prefix `public/products/` được validate nhưng URL null tới khi có storage provider.
- Currency: Phase 2.5 đã thêm model/code/migration test, main vẫn legacy và chưa backfill. Chi tiết API/validation và staged deployment: PRODUCT_DATA_SERVICE.md, MULTI_CURRENCY.md.
- Database ứng dụng vẫn Product/Category/Variant/Image/Order=0; không tạo fixture hoặc seed/reset ở aurel_ai. Phase 2.4 đã chạy mutation trên aurel_ai_test và cleanup toàn bộ fixture.
- Xác minh Phase 2.2: db:check, lint, typecheck, build đạt; 29 unit tests và 3 read-only integration tests đạt; HTTP smoke 12 tuyến/13 đích và 3 URL pagination đạt. Có pg deprecation từ Prisma interactive relation query đã trace và ghi nhận; chưa đổi dependency.

## Cập nhật database/catalog (2026-10-20)
- Code hiện đã có Prisma 7.10.1, adapter pg, schema MVP tại `prisma/schema.prisma`, root `prisma.config.ts`, client và queries tại `src/lib/db/`. Đây là thay đổi người dùng có sẵn, không ghi đè.
- P1001 được xác minh là TCP localhost:5432 không nhận kết nối (ECONNREFUSED); schema hợp lệ. Bổ sung PostgreSQL portable tại `.local/postgres`, helper `db:start`/`db:stop`, kiểm tra SELECT 1 qua `db:check`, và `db:migrate`. Hướng dẫn tại `docs/DATABASE_SETUP.md`.
- Catalog đã nối PostgreSQL qua `src/lib/catalog.ts` → `findCatalogProducts`: active products, category, active variants, images; tìm kiếm/lọc server-side, Decimal chuyển chuỗi 2 số lẻ, ID chuỗi, tồn kho số nguyên. Không seed/reset hoặc thay schema/migration/dữ liệu.
- `/` render động để phản ánh dữ liệu mỗi request. DB rỗng không dùng demo thay thế; lỗi DB/thiếu cấu hình trả error có kiểm soát và giữ khung homepage. Collection giữ thiết kế, dùng ảnh/giá thật trong khung có sẵn. `/products` và `/search` giữ UI tên sản phẩm hiện có.
- Kết quả: db:check đạt, 15 unit tests + 3 integration tests đạt, lint/typecheck/build đạt, HTTP smoke 12 routes/13 destinations đạt; 6 HTTP assertions cho DB rỗng/lỗi tại `/`, `/products`, `/search?q=linen` đạt. DB hiện Product=0, Order=0, không tạo fixture vào database. Integration tsx cần chạy ngoài sandbox Windows do userInfo ENOMEM.
- Giới hạn: currency schema mới chưa deploy main, không tự gán VND/EUR; ảnh chỉ resolve raster public `/images/`, private/remote trả null chờ storage. Chưa QA trực quan với hàng thật. Tiếp theo review SQL/legacy plan trước main migration, chọn storage provider. Bật local DB bằng `npm.cmd run db:start` sau restart Windows.

## Hiện tại storefront (2026-10-14)
Homepage expansion đã triển khai local theo brief đính kèm: sau hero/Intelligence và New Collection là stone divider CSS → product discovery GET /search → Shop by Category → The AUREL Edit (10 looks) → Journal → footer. Không tạo/tải ảnh mới; danh mục và thumbnail dùng ảnh local có sẵn, campaign/journal dùng placeholder CSS có kích thước cố định và fallback onError.
- StorefrontHeader duy nhất chuyển sang fixed ivory 64px từ collection, ẩn khi quay về phía trên; anchor có scroll padding 80px.
- AurelEdit dùng sticky + chiều cao bằng scene height + overflow thực, rAF transform, ResizeObserver; desktop >=1100px và cao >=700px khi không reduced-motion. Mobile/low-height/reduced-motion/no-JS dùng native scroll-snap. Có Previous/Next, ArrowLeft/Right/Home/End, focus reveal, progress và cleanup.
- 10 concept demo có dữ liệu typed, preview pieces, CTA mua không hoạt động và nhãn not available to purchase; liên kết khám phá/tìm kiếm thật. Không tạo tồn kho hoặc giá cho lookbook. Tops/Bottoms/Outerwear đã được server query validator chấp nhận.
- Journal có hai editorial notes đọc trực tiếp; footer có đích thật và thông tin care/social/policy chờ launch được trình bày như văn bản.
- Kiểm tra expansion: lint/typecheck/build đạt; HTTP smoke production 12 cases và 13 destinations đạt; unit 12/12 đạt. Computer Use đã đọc được Chrome localhost:3000: desktop tới LOOK 10, thoát xuống Journal và reverse; mobile 400px Next chuyển 01→02; reduced-motion desktop dùng End tới LOOK 10. Chưa nghiệm thu toàn bộ resize/focus/no-JS/image failure; checklist trong docs/AUREL_EXPANSION_QA.md.
- QA 2026-10-14: Intelligence/SUIT YOU và Collection vừa khung 320px, video đang phát; 400px header hiển thị đủ sau khi reset zoom Chrome về 100%. Tablet 768px category/header và desktop 1440px collection đã quan sát. Bổ sung min-width/minmax cho Journal/footer, image qualities 75/90 và logic giữ look khi đo lại carousel. Việc chuyển kích thước vẫn làm thay đổi vị trí cuộn tài liệu; cần kiểm tra tiếp trước nghiệm thu resize.
Collection được tăng khoảng thở: heading cách filter 36px, filter cách grid 32–56px; grid desktop gap 56px/32px, mobile 36px/16px; ảnh cách tên/giá 24px desktop/16px mobile. Section và CTA cuối thoáng hơn. Chỉ sửa collection.module.css; lint/typecheck/build đạt, chưa QA trực quan. Bước tiếp theo: kiểm tra /#collection ở 1440/768/390/320px, tab wrap và tên dài.
Typography Intelligence: riêng “SUIT YOU” dùng strong/font-weight 700 theo yêu cầu mới; giữ italic champagne của dòng thứ hai. Bước tiếp theo: kiểm tra overflow tiêu đề trên mobile.
Phần chữ cạnh video được làm mới theo hướng luxury: heading serif ivory, dòng thứ hai italic champagne #DEC5A2, eyebrow chữ nhỏ giãn nét kèm đường mảnh, mô tả thoáng và CTA pill viền champagne/nền trong. Nội dung giữ nguyên ảnh người dùng: “Our lasted AI innovation”, “STILL UNSURE / WHAT SUIT YOU”, “Aural AI Can Help You Choose What Fit You Most.”. Cỡ chữ theo container; mobile stack, focus-visible/reduced-motion giữ nguyên. Lint/typecheck/build đạt; chưa QA trực quan. Bước tiếp theo: kiểm tra /#intelligence ở desktop/tablet/mobile và nối URL AI khi được cung cấp.
Video Intelligence vẫn trang trí muted/loop/playsInline; từ2026-10-22 dùng hai bản web H.26430FPS và poster, lazy/visibility/reduced-motion playback với Play/Pause overlay. Wrapper16:9/contain/overlay30%/split58:42/CTA giữ nguyên. Chi tiết tại VIDEO_PERFORMANCE.md.
Đã triển khai nền tảng frontend Phase 0 trong thư mục dự án ban đầu chỉ có tài liệu. Không có mã nguồn người dùng bị thay thế; thư mục chưa khởi tạo Git.

- Node.js 22.23.1 trong môi trường kiểm tra; yêu cầu >= 22.13.
- Next.js 16.4.0 App Router, React 19.3.0, TypeScript 5.9.3 strict, Tailwind CSS 4.3.3; phiên bản cài đặt được khóa bằng `package-lock.json`.
- Header/hero AUREL editorial: grid 62/38, cột phải 54/46, wordmark giữa viewport; tablet portrait/mobile xếp lại panel. Giữ hero và collection hiện có; expansion mới bổ sung các section sau collection cùng footer trang chủ.
- Header AUREL có menu dialog, search/cart và account dialog đã nối session/login/register/logout ở Phase2.7. Mobile menu có cùng trạng thái tài khoản. Header/footer tuyến phụ giữ nguyên khung; auth routes có navigation/footer AUREL scoped.
- AUREL Intelligence thay vị trí search cũ: hero → Intelligence → The New Collection trong CollectionReveal, chỉ một instance. Video trái 58%, nội dung phải 42%, mobile stack; từ2026-10-22 autoplay có điều kiện visibility/motion và Play/Pause overlay. CTA pill viền champagne, padding 15px 24px, 13px/400, hover 250ms. Anchor discovery-query đã bỏ; `/search` là đích tạm có thật. Người dùng sẽ cung cấp URL AI, đang chờ để nối CTA chính xác.
- Trang `/products` bỏ tiêu đề/giới thiệu và thông điệp chờ hàng theo yêu cầu; khi catalog rỗng chỉ giữ liên kết danh mục, tìm kiếm và khám phá phong cách. Dữ liệu thật/lỗi vẫn dùng CatalogContent; query sai vẫn được thông báo. Tìm kiếm và giỏ hàng giữ trạng thái trống riêng; có loading/error/404.
- Catalog cần DATABASE_URL và Prisma Client đã generate; nếu thiếu, homepage vẫn render khung và lỗi catalog thay vì crash. Không cần seed.
- Union kết quả phân biệt dữ liệu thành công/rỗng với lỗi nguồn dữ liệu. Lỗi không làm biến mất khung trang chủ.
- Collection Scroll Reveal nằm ngay sau hero: panel ivory #F6F2EB, sticky hero desktop, clip-path mở từ 92% đến 100%, scroll thuận/ngược tự nhiên, không thêm dependency. Mobile/portrait/reduced-motion dùng flow bình thường.
- Search/metadata cũ đã gỡ khỏi homepage. CollectionSection render trực tiếp CollectionGrid, giữ category filter và fallback lỗi/dữ liệu thật; bỏ min-height 100svh để tránh khoảng trống. CollectionDiscovery và matcher vẫn giữ trong source, chưa dùng trên homepage; `/search` không đổi.
- Catalog main chưa được thêm sản phẩm trong task; Collection giữ empty state/tabs/heading/CTA khi rỗng. Fixture thiết kế cũ chỉ source/tests/editorial độc lập. Detail route Phase2.8 đã có, chỉ thêm title links cho hàng thật có slug hợp lệ.
- Ba ảnh hero đã được người dùng bổ sung và HTTP xác minh 200 (ảnh gốc và một ảnh optimized). Hero đã được chủ dự án duyệt với chữ ÁUREL; giữ nguyên file hero TSX/CSS trong nhiệm vụ collection. Phần còn lại vẫn là UI Phase 0.

## Các tuyến và tệp chính
- `/`: `src/app/page.tsx`
- `src/components/home/editorial-sections.tsx`, `editorial.module.css`, `editorial-image.tsx`: divider, search, category, journal và ảnh/fallback tái sử dụng.
- `src/components/home/aurel-edit.tsx`, `aurel-edit.module.css`; `src/features/editorial/content.ts`: lookbook 10 concept và native/pinned scroll.
- `src/components/layout/editorial-footer.tsx`, `editorial-footer.module.css`: footer trang chủ, được chọn bởi Footer hiện có.
- `/products`: `src/app/products/page.tsx`, nhận category everyday/workwear/essentials.
- `/search`: `src/app/search/page.tsx`, form GET và kiểm tra q phía server.
- `/cart`: `src/app/cart/page.tsx`, chỉ trạng thái trống.
- `src/app/loading.tsx`, `error.tsx`, `not-found.tsx`: các trạng thái tuyến.
- `src/components/`: layout, UI dùng lại và catalog/search.
- `src/components/home/hero-section.tsx`, `hero.module.css`: hero server-rendered, next/image, CSS responsive.
- `src/components/home/collection-{reveal,section,grid}.tsx`, `collection.module.css`: wrapper scroll client, section server và grid/filter client; `src/features/collection/preview.ts`: adapter và fixture demo riêng.
- `src/components/home/collection-discovery.tsx`, `collection-search.module.css`: UI/search state, suggestion, reveal nhẹ; `src/features/collection/search.ts`: matcher keyword thuần, không có AI/API giả.
- `src/components/home/intelligence-showcase.tsx`, `intelligence-showcase.module.css`: showcase espresso/ivory, reveal một lần bằng IntersectionObserver, reduced-motion/no-JS, trạng thái lỗi video và CTA tới discovery.
- `src/components/layout/storefront-header.tsx`, `homepage-header.module.css`: client wrapper chọn header theo pathname và native dialog.
- `src/features/catalog/catalog.ts`: kiểu dữ liệu, kiểm tra query, xử lý kết quả.
- `src/lib/catalog.ts`: reader server-only; `src/config/site.ts`: cấu hình thương hiệu/danh mục.
- `src/app/globals.css`: token và responsive styles; `docs/DESIGN_SYSTEM.md`: quy ước và quyền quyết định thiết kế.
- `tests/catalog.test.ts`, `tests/http-smoke.mjs`: kiểm tra dữ liệu và HTTP.

## Kiểm tra đã xác minh
- `npm.cmd install --cache .npm-cache --fetch-retries=0`: thành công với quyền mạng; có lockfile.
- `npm.cmd run lint`: đạt, không warning trong lần cuối.
- `npm.cmd run typecheck`: đạt.
- `npm.cmd test`: 11/11 đạt, gồm dữ liệu collection và tìm kiếm tên/category/color/description, ba suggestion, query rỗng/vô nghĩa/no-result, kết hợp category.
- `npm.cmd run build`: đạt, prerender trang chủ/cart và render động products/search.
- `npm.cmd start -- --hostname 127.0.0.1`: khởi động production thành công.
- `npm.cmd run test:smoke`: 9 trường hợp HTTP/nội dung đạt, 4 đích liên kết nội bộ đạt; zero-data và 404 đã xác minh.
- `npm.cmd audit --omit=dev`: 0 lỗ hổng được báo cáo tại thời điểm kiểm tra.

## Giới hạn và việc chưa làm
- Đã điều tra hydration `mdl-js`: không tìm thấy nguồn trong code/dependencies/build; production HTML 5 tuyến và 8 JS chunks không có MDL. Giữ nguyên layout/thiết kế, không suppression. Chưa xác định script/extension phía trình duyệt; xem `docs/HYDRATION_DEBUGGING.md` để kiểm tra profile sạch và truy nguồn.
- Native Computer Use đã kết nối Chrome; QA một phần có screenshot và bàn phím. Còn kiểm tra profile sạch (đã thấy thuộc tính Grammarly trong hydration diff), toàn bộ focus traversal, image failure/no-JS và reset/loading. Không coi devtools runtime.lastError của extension là lỗi nguồn ứng dụng đã chứng minh.
- Audit5high của phiên cũ là dữ liệu lịch sử; follow-up02/11/2026 đã vá Next/minimatch và kiểm full/production audit0. Không downgrade Next lint config hoặc audit fix force; xem DEPENDENCY_SECURITY.md.
- ESLint 9.39.5 bị npm đánh dấu hết hỗ trợ nhưng còn cần cho peer range của import/jsx-a11y/react plugins. Đã thử ESLint 10 rồi quay lại để tránh xung đột peer; cần theo dõi bản tương thích upstream.
- PostgreSQL/Prisma đã nối catalog, tìm từ khóa/category/gender, pagination service, Product Detail và Product Data Service; Better Auth và Admin UI đã có. Pagination UI public, lọc giá/size/màu/brand riêng, giỏ lưu trạng thái, checkout/payment/AI và audit trail service còn thiếu. Kết nối DB hiện tại xem mục rà soát 01/11/2026.
- Chưa triển khai hosting. Không có giao dịch thực.

## Bước tiếp theo (lịch sử trước rà soát 01/11/2026)
Lần video cinematic: lint/typecheck/build đạt; kiểm tra HTML production xác nhận autoplay/muted/loop, không controls, một video và CTA không đổi. Tiếp theo kiểm tra autoplay/loop và độ rõ logo trên browser thực; chưa xác minh điểm nối loop của asset hoặc chính sách autoplay trên thiết bị.
Lần thay search bằng showcase: lint/typecheck/build và HTTP smoke 3023 đạt (9 cases/5 links), xác minh chỉ một showcase, thứ tự hero→Intelligence→collection và không còn UI/anchor search cũ. Chờ người dùng gửi URL trang AI để thay `/search` tạm, sau đó kiểm tra đích CTA. Chưa QA trực quan.
Lần AUREL Intelligence: lint/typecheck/build đạt, 11/11 tests đạt; HTTP smoke production 3022 đạt 9 trường hợp/5 đích, assertion nội dung/controls/CTA/order đạt, video range trả 206 với MIME video/mp4. SHA256 bản public trùng video gốc. Người dùng xác nhận vị trí sau collection và CTA tới discovery. Browser inventory rỗng nên chưa xác minh playback/seek, layout hay motion thực. Tiếp theo mở `/#intelligence` ở desktop/tablet/mobile, thử play/pause/seek/fullscreen, CTA, bàn phím và reduced-motion.
Lần tinh gọn trang sản phẩm: lint/typecheck/build đạt; HTTP smoke tại 3021 đạt 9 trường hợp/4 đích, kiểm tra phần chữ đã bỏ và toàn bộ đích liên kết được giữ. Tiếp theo kiểm tra trực quan `/products` và menu trên mobile/desktop.
Lần gỡ nội dung cũ: lint, typecheck và build đạt; HTTP smoke production tại 3020 đạt 9 trường hợp/4 đích liên kết, xác nhận không còn ba section cũ và footer trong HTML trang chủ. Chưa kiểm tra trực quan. Bước tiếp theo: mở trang chủ và xác minh điểm kết thúc collection cùng menu ở desktop/mobile.

Goal Fashion Search đã triển khai, đang chờ browser QA. Hai lượt liên tiếp của mục tiêu mới chưa có browser kết nối; không dùng trạng thái blocked của nhiệm vụ trước để kết luận lần này. Kiểm tra search ở desktop/tablet/mobile theo phần bổ sung trong COLLECTION_REVEAL_QA.md trước khi nghiệm thu.

Chủ dự án review thủ công PDP/Auth/Collection khi có dữ liệu hàng thật và giá có currency xác minh; Visual QA vẫn Pending Manual Review. Không dùng browser automation trong task hiện tại. Detail links đã nối; Cart và production migration/currency cần phase/approval riêng, không tạo dữ liệu giả để lấp empty states.

Ảnh mock được lưu tại `public/images/aurel/collection-demo/{coat,knit,trousers,bag}.png`; README cùng thư mục ghi prompt nguyên văn và nguồn built-in image_gen. Đã xem ảnh, xác minh cả 4 URL optimized trả 200 và tỷ lệ 3:4. Lint/typecheck/build, 8 tests và HTTP smoke đã chạy lại đạt sau tích hợp ảnh; hash hero tiếp tục không đổi.

Lần collection: lint/typecheck/build đạt, unit 8/8, HTTP smoke 9 cases/4 links đạt, thứ tự section và 4 SSR cards đạt. Hero TSX/CSS hash không đổi. HTTP không xác minh animation/hydration/layout; chưa nghiệm thu trực quan.

Lần Fashion Search: lint/typecheck/build đạt, 11 tests đạt; HTTP smoke 9 cases/4 links và assertion thứ tự hero→search→collection heading/nội dung form đạt. Hash hero TSX/CSS và collection reveal TSX/CSS không đổi. Chưa kiểm thử click/Enter/focus/overflow hoặc render responsive trong browser.

## Phiên xem database local (2026-10-21)
- PostgreSQL local đã khởi động lại; `npm.cmd run db:check` đạt SELECT 1. Prisma Studio đang phục vụ tại http://localhost:51212, HTTP GET trả 200.
- Chỉ bật runtime xem dữ liệu; không migrate/seed hoặc sửa env/schema. Ba migration pending và main NO-GO giữ nguyên. Bước tiếp theo: mở URL Studio để xem database.

## Tài khoản ADMIN local — 01/11/2026
- Đã đặt lại credential ADMIN hiện hữu theo yêu cầu; hash Better Auth được xác minh, phiên cũ đã thu hồi. Không ghi thông tin đăng nhập vào source/docs. Đăng nhập bằng email tại /login, chưa hỗ trợ username ngắn; không đổi chính sách mật khẩu chung. Bước tiếp theo: chủ dự án đăng nhập lại.

## Trang đăng nhập editorial — 02/11/2026
- `/login` dùng layout riêng (`src/components/auth/login-page.tsx`, `login-form.tsx`, `login.module.css`) với ảnh `public/images/image1.png`, header riêng và không có footer. Register/forgot/reset/verify vẫn dùng `AuthShell`/`AuthForm`.
- Nút social hiển thị nhưng bị vô hiệu hóa (chưa có provider). Chi tiết và vấn đề còn lại: [báo cáo](../LOGS/AUREL_LOGIN_REDESIGN.md). Bước tiếp: owner nghiệm thu visual/đăng nhập thật; chạy build.
- `/register` cũng dùng layout editorial riêng (`register-page.tsx`, `register-form.tsx`, panel ảnh dùng chung `auth-editorial.tsx`), header riêng và không có footer; forgot/reset/verify vẫn dùng `AuthShell`.

## Trang Yêu thích (Wishlist) — 02/11/2026
- Route `/favorites` đã được làm mới hoàn toàn theo ảnh thiết kế tham chiếu (dashboard 2 cột: sidebar Tài khoản của tôi 260px, empty state card với trái tim nghệ thuật, danh sách gợi ý 4 sản phẩm catalog thật).
- Dữ liệu yêu thích kết nối model Prisma `Favorite` và endpoint `/api/shop`. Trạng thái rỗng hiển thị thông điệp và nút kêu gọi hành động chuẩn AUREL. Chi tiết tại [LOGS/wishlist-rebuild.md](../LOGS/wishlist-rebuild.md).

## Trang Thông tin cá nhân (Profile) — 02/11/2026
- Route `/account` đã được tái thiết kế theo ảnh tham chiếu AUREL: dùng chung `AccountShell` (sidebar tài khoản, breadcrumb), card form hồ sơ với avatar tròn + camera badge, form 2 cột (nhãn bên trái, ô nhập có icon bên phải, email vô hiệu hóa, dropdown năm sinh, nút Lưu thông tin espresso) và liên kết "Đổi mật khẩu qua email".
- Kết nối dữ liệu máy chủ qua `shopActor()` và cập nhật hồ sơ qua `/api/shop`.

## Trang Đơn của tôi (Orders) — 02/11/2026
- Route `/account/orders` đã được tái thiết kế theo ảnh tham chiếu AUREL: dùng chung `AccountShell` (sidebar tài khoản, breadcrumb), tabs lọc trạng thái (Tất cả, Chờ xác nhận, Đang xử lý, Đang giao, Đã giao, Đã hủy), danh sách thẻ đơn hàng ngang có thumbnail sản phẩm, tổng thanh toán, badge trạng thái, nút xem chi tiết / theo dõi đơn hàng, ngăn chi tiết mở rộng và thanh phân trang.
- Dữ liệu kết nối máy chủ qua `loadUserOrders(userId)` và bảo vệ phiên đăng nhập an toàn.
