# Lộ trình — Fashion Store

## Lưu source GitHub — 16/11/2026
- [x] Khởi tạo Git, loại dữ liệu runtime/secrets, cấu hình Git LFS và submodule AI.
- [x] Bảo toàn thay đổi DM-VTON bằng patch; bổ sung hướng dẫn clone.
- [ ] Cấu hình môi trường/DB/model riêng khi triển khai từ bản clone trên máy mới.

## Hoàn thiện Virtual Try-On cho quần (`lower`) & túi (`bag`) — 15/11/2026
- [x] Bổ sung `Left-leg`/`Right-leg` + `"Belt"` vào `_build_schp_masks`, `_prepare_person_canvas` bảo toàn chiều cao `9:16` (không mất đầu/giày) và `_prepare_garment_canvas` cho `lower`.
- [x] Mở rộng `TryOnClothType` với `"bag"`, giữ ưu tiên `"QUẦN TÚI HỘP"` -> `"lower"`, bổ sung `productId`/`productSlug` từ `TryOnStudio`.
- [x] Triển khai `_extract_bag_rgba` + `_run_bag_tryon_sync` (`Accessory-Lock SCHP`) xử lý 10 mẫu túi/phụ kiện nhanh (~0.5–0.9s), khử viền halo trắng và bảo toàn trang phục/gương mặt.
- [x] Sửa `/health` + `/try-on` chờ `engine.ready_event.is_set() and not engine.loading`.
- [ ] Cải thiện trường hợp thử quần short lên ảnh người đang mặc quần dài qua model hai pha tách/inpaint chân trần (CatVTON 1-step hiện vẫn giữ dáng quần dài theo mask).

## Bố trí Quản lý đơn hàng dạng bảng (`/admin/orders`) — 15/11/2026
- [x] Thiết kế kem/nâu theo mẫu: hero ảnh túi có sẵn, KPI icon/count, bảng 6 cột, tìm kiếm, nút thao tác, responsive cuộn bảng nội bộ.
- [x] Ảnh sản phẩm thật từ primary catalog, fallback khi không có/lỗi ảnh; không tạo dữ liệu đơn hàng minh họa trong runtime.
- [ ] Nghiệm thu phiên admin thật trên build mới: ảnh upload, tìm kiếm/phân trang, tự làm mới và xác nhận/hủy/in phiếu; chưa chạy mutation DB trong lượt thiết kế này.
- [x] Chuyển danh sách đơn hàng trong `SellerOrders` (`/admin/orders`) và mục `100 đơn gần nhất` trong `SellerReports` (`/admin/orders/reports`) sang dạng bảng 6 cột dễ quan sát và thao tác nhanh.
- [x] Bổ sung thanh lọc tìm kiếm tức thì trên trang (`Mã đơn`, `Khách hàng`, `SĐT`, `Sản phẩm`, `SKU`) trên đầu bảng đơn hàng.
- [x] Kiểm tra UI unit tests (`tests/seller-portal-ui.test.tsx` 5/5 pass), `eslint` và `npm run typecheck` đạt.

## Nền trang chi tiết sản phẩm — 14/11/2026
- [x] Lưu màu cũ #F4F0E9 và cách khôi phục trong DESIGN_SYSTEM.
- [x] Đổi canvas PDP và vùng lề về kem sáng #F8F5F0 theo phản hồi mới, giữ mã gốc #F4F0E9/token chung và các trang khác.

## Virtual Try-On rõ ràng và có chuyển động — 14/11/2026
- [x] Dùng đúng ảnh5 cho thumbnail/POST và catalogstudio; thiếuảnh5 báo rõ, không fallbackprimary; thu gọn upload người thành hàng ngang.
- [x] Khung studio 1600px, typography lớn, thẻ ảnh trang phục và khung Trước/Sau responsive.
- [x] Thiết kế modal theo ảnh tham chiếu mới: hoàn tác về nền trắng/topbar trắng/model gốc/2framexám theo yêu cầu mới, giảm chữ hero/mô tả/upload/CTA/frame; giữ product5; không thanh3bước.
- [x] Đồng bộ cửa sổ VIRTUAL TRY-ON trên PDP với khung lớn, motion scan, heading rõ, cuộn mobile riêng và native dialog focus/close.
- [x] Hiệu ứng quét khi chờ AI, kết quả hiện dần, loading/error/empty rõ ràng và reduced motion.
- [x] Kiểm tra chọn lọc SSR/browser, lint, typecheck và production build (chi tiết SESSION_LOG).
- [ ] Nghiệm thu chất lượng ảnh người thật với dịch vụ GPU và public domain trong lượt riêng.

## Fit khung trò chuyện chính `/messages` & sửa header chat — 14/11/2026
- [x] Ẩn `Footer` trên `/messages` và `/messages/*`, chỉnh `.messengerShell` / `.threadList` `min-height: 0` để khung chat vừa khít `calc(100dvh - 56px)`, không cuộn xuống thấy footer.
- [x] Bỏ nút Lưu (`Sản phẩm đã lưu`) trên header `/messages` và sửa `.panelHeader` (`overflow: visible; z-index: 10;`) + `.headerEditorialAccentWrap` để menu 3 chấm (`...`) hiển thị đầy đủ không bị cắt.
- [ ] Nghiệm thu trực quan trên trình duyệt live và build/deploy khi triển khai.

## Ảnh sản phẩm — 14/11/2026
- [x] Rà44sản phẩm; bổ sung/thay packshot nền trắng không người; đủ5ảnh mỗi sản phẩm; log before/after và giữ asset cũ.
- [ ] Chủ shop đối chiếu chi tiết ảnh AI với hàng thật.

## Khung chat `aurel Official` & Trang chờ Chatbot `/messages/connecting` — 14/11/2026
- [x] Đổi tiêu đề drawer sang `aurel Official`, trạng thái `Đang hoạt động`, bỏ badge `AI` cạnh tên bot và thu gọn kích thước `.drawer` (`350×490px`).
- [x] Thiết kế lại `/messages/connecting` với SVG minh họa nhân vật + hoa lá + chữ `A U R E L` uốn cong, chữ chạy mượt, nút `← Quay lại` và thanh tiến trình shimmer mượt mà.
- [ ] Nghiệm thu trực quan trên trình duyệt live và chạy production build khi triển khai.

## Bình luận & Đánh giá — 13/11/2026
- [x] Migration nullable orderItemId/view mới, 8case chọn lọc, lint/typecheck/build và runtime mở sao cho mọi tài khoản.
- [x] Mọi tài khoản được chọn sao không cần mua; chỉ khóa khi đã có review, giữ sửa/xóa; rút gọn chữ và empty state. 5case chọn lọc/lint/typecheck/build đạt.
- [x] Kích hoạt ProductReview/ProductComment; mở bình luận tài khoản, review tài khoản không tiền kiểm, không bắt buộc mua.
- [x] Premium ivory/taupe theo ảnh mẫu, summary thật/histogram, composer ảnh, feed chung có badge và shop Official.
- [x] Backend ảnh/like/reply4cấp, quyền xóa/ẩn, lọc/sort/phân trang10root; giữ dữ liệu/API cũ, cập nhật tại chỗ.
- [x] Migration scoped backup/restore/rehearsal, 6case backend/2workflowUI chọn lọc, lint/typecheck/build snapshot; ghi nhận vượt ngân sách tình huống trong report.
- [ ] Nghiệm thu signed-cookie/public và các nhánh ghi ở PRODUCT_DISCUSSION; theo dõi payload thread nhiều con.
- [ ] Video/thông báo người khác/phân trang con nếu cần; không đưa số sao giả vào thống kê.

## Chatbot Qwen RAG — 13/11/2026
- [x] Groq Qwen/ba key server-side/cooldown/fallback, STAFF/BOT và hồi phục AI, giữ auth/CSRF.
- [x] Sửa retrieval theo category/gender/từ khóa cụ thể và focus hội thoại; lấy gender/profile/giá/stock từ PostgreSQL, không lấy kết quả ngoài nhu cầu.
- [x] Không spam thẻ khi chào/hỏi tiếp; không URL văn bản; thẻ có stock/size/màu và chỉ hiện sau text. Ba chấm wave, reduced motion, scroll native/không kéo về đáy.
- [x] Lượt sửa RAG/UX đạt10case (7Node/DB/provider +3browser;4Qwen thật), lint/typecheck/build release đạt; deploy local3000 release mới giữ dữ liệu.
- [ ] Bổ sung policy/bảng size đã xác minh và mở rộng parser từ truy vấn thực tế (tên riêng/bộ lọc/ngân sách chưa bao phủ đầy đủ).
- [ ] Nghiệm thu wheel/trackpad vật lý nếu còn triệu chứng; không chạy thêm case trong lượt10case này. Streaming token qua mạng là tác vụ riêng nếu cần.

## Logo AUREL cho Favicon & Trợ lý AUREL — 13/11/2026
- [x] Xuất `src/app/icon.png`, `src/app/apple-icon.png` và `public/images/aurel/aurel-logo.webp` từ ảnh logo gốc do chủ dự án cung cấp.
- [x] Gắn logo AUREL vào tiêu đề Trợ lý AUREL (`avatarWrapHeader`), màn hình chào (`avatarWrapLg`), chân tin nhắn bot (`avatarWrapXs`) và danh sách hội thoại Bot (`MessagesPageView`).
- [ ] Nghiệm thu trực quan favicon trên tab trình duyệt và khung chat Trợ lý AUREL trên live/preview.

## Thumbnail đơn hàng — 13/11/2026
- [x] Xác nhận ảnh gốc hai đơn vẫn có; optimizer trả400 do policy upload.
- [x] Bypass optimizer đúng loại ảnh, giữ static optimization và thêm fallback/recovery.
- [x] 8case, lint/typecheck, build snapshot đầy đủ đạt; cập nhật preview3010.
- [ ] Refresh/nghiệm thu bằng phiên tài khoản của chủ dự án; deploy có kiểm soát nếu trang đang dùng production build khác.
- Báo cáo: `LOGS/ORDER_THUMBNAIL_FIX_2026-11-13.md`.

## Charles UX Animation toàn lớp giao diện — 13/11/2026
- [x] Đọc skill và references từ repo chủ dự án chỉ định; lập inventory và 10 case trước triển khai.
- [x] Token timing/easing chung; chuẩn hóa CSS storefront/account/shop/chat/admin, bỏ transition all và entrance/loop trang trí làm chậm đọc.
- [x] Native modal/sheet enter-exit, inert/focus/scroll; popover và chat drawer đảo chiều được, closed không nhận input.
- [x] Giữ ngân sách reveal card 200ms/40ms, first-paint content và reduced motion; cải thiện các target icon chính trên touch.
- [x] Sửa helper URL catalog vi phạm server/client boundary phát hiện trong production snapshot.
- [x] Lint/typecheck/build snapshot đầy đủ; 8 case browser và 2 unit empty/error đạt, không full suite hoặc transaction thật.
- [ ] Review preview `http://localhost:3010`, triển khai có kiểm soát và đo hiệu năng public của bộ motion mới.
- [ ] Nghiệm thu admin có session, payment thật được phê duyệt, các failure của form và browser cũ trong lượt riêng.
- Hướng dẫn/báo cáo: `docs/MOTION_GUIDE.md`, `LOGS/AUREL_UX_ANIMATION_2026-11-13.md`.

## Hiển thị ảnh: A/B và quyết định giữ lại — 13/11/2026
- [x] Đo 5 cold + 5 warm cho 7 phương án: filmstrip, DOM/effect/request/visible, LCP, CLS, transfer và SQL.
- [x] Giữ fade 200ms/stagger 40ms, giảm reveal khoảng 60%; sửa root loading 100svh để tránh footer CLS 0,294.
- [x] Loại eager, refactor Suspense và resize khi request chưa đạt điều kiện không regression.
- [x] Đánh giá variants card/thumbnail và cache public/revocation; chưa đưa các phương án này vào runtime.
- [x] Lint/typecheck, 2 unit empty/error, 2 browser mobile/reduced-motion và build snapshot riêng.
- [ ] Xác minh trạng thái live 3000, triển khai có kiểm soát rồi đo public 5 cold + 5 warm. Preview cuối ở 3006 chưa phải production deployment.
- [ ] Nếu tiếp tục variants: prepared/bounded variants theo content hash, kiểm tra quyền mỗi request; A/B public/DPR2/fast scroll trước khi giữ.
- Báo cáo: `LOGS/AUREL_IMAGE_AB_BENCHMARK_2026-11-13.md`.

## Cuộn mượt Lenis — 13/11/2026
- [x] Áp dụng Lenis 1.3.25 giống Plant Classification tại `src/components/layout/smooth-scroll.tsx`, gắn root layout; CSS chính thức trong globals. Cấu hình duration 1.2, wheelMultiplier 0.8, smoothWheel true, autoRaf và anchor offset -80.
- Giữ cảm ứng native (syncTouch false), hỗ trợ nested scroll (allowNestedScroll true), tự cập nhật khi đổi prefers-reduced-motion và destroy/listener cleanup. CSS smooth làm fallback; html.lenis dùng auto để tránh chồng hiệu ứng.
- Không đổi routes, API, dữ liệu hay các trạng thái sản phẩm. Lint/typecheck đạt; chưa QA browser. Không build/restart để giữ phiên admin.
- Bước tiếp theo: nghiệm thu wheel, touch, chat/modal, anchor, reduced motion và điều hướng trên trình duyệt.

## AI Virtual Try-On (CatVTON + SCHP) cục bộ trên RTX 5060 — 13/11/2026
- [x] Xác minh & benchmark DM-VTON trên RTX 5060 (`sm_120`); sau khi nghiệm thu ảnh toàn thân bị mờ (`192×256`) và lệch mask, nâng cấp lên **CatVTON (`bfloat16`) + SCHP** theo chọn lựa của chủ dự án.
- [x] Xây dựng FastAPI service (`backend/tryon-service/app.py`), hàng đợi `Semaphore(1)`, cổng test riêng `/try-on-test` (port `3005`), API nội bộ `POST /api/try-on` và nút `TRY IT ON` tại trang sản phẩm.
- [x] Tối ưu tốc độ CatVTON từ `~39.5s` xuống `~8.0–8.3s/ảnh` (`DPMSolver++` 15 steps, `576×768`, `cudnn.benchmark` + startup `_warmup()`, `CFG=2.5`).
- [x] Khắc phục triệt để biến dạng mặt ở ảnh toàn thân bằng **Face-Lock Pixel Compositing** (`576×768 -> 768×1024`) và chuẩn hóa mask theo `LIP Face` (khử đục lỗ vai/cổ).
- [x] Kiểm chứng giới hạn 2-thread / 2-worker GPU trên 1 RTX 5060 8 GB (`41.16s` khi chạy 2 CUDA streams) và tích hợp **Hyper-SD 8-steps** + `asyncio.to_thread`, hạ tổng thời gian **2 ảnh đồng thời xuống `5.52s`** (`3.29s`/ảnh đơn, `/health` `12.1 ms`).
- [x] Tích hợp vào Storefront chính: thẻ **AUREL · PHÒNG THỬ ĐỒ AI** ngay phần trống trang chi tiết sản phẩm (`THỬ ĐỒ ẢO · TRY IT ON` + link sang `/try-on`), mục điều hướng **Try-On AI** trên `StorefrontHeader`, route `/try-on` đọc catalog PostgreSQL (`TryOnStudio`), sửa `/api/try-on` đọc ảnh `/images/uploads/*.webp` đã xuất bản và kiểm chứng thử đồ thật với `AUREL - ESSENTIAL SHIRT` (`4.54s`).
- [ ] Chạy `npm run build` và khởi động lại cổng `3000` khi sẵn sàng thay thế bản build cũ đang chạy trên `127.0.0.1:3000` (hiện bản mới chạy sẵn tại `http://localhost:3005`).
- [ ] Đánh giá thay thế/cấp phép thương mại trước production (CatVTON dùng `CC BY-NC-SA 4.0`).

## Thiết kế lại hệ thống Nhắn tin Quiet Luxury & Trang chuyển hướng riêng — 13/11/2026
- [x] Chuyển giao diện `/messages`, hộp thoại bên phải và `/admin/messages` sang tông Quiet Luxury kem–espresso đồng bộ AUREL.
- [x] Tách màn hình chờ 2 giây thành trang riêng `/messages/connecting`.
- [x] Tinh chỉnh giao diện chat (`/messages` và drawer) theo mẫu Warm Silk Editorial (rail Espresso, danh sách thẻ hội thoại có chevron, header lồng ảnh editorial, thẻ phản hồi bot + lưới 3 thẻ sản phẩm ngang, thanh nhập pill nổi).
- [x] Tách 2 mục đoạn chat mặc định (**Nhân viên AUREL** ghim đầu + **AUREL Concierge Bot** liền sau), ưu tiên Bot khi double-click, sort theo đoạn chat mới và hỗ trợ tạo đoạn chat mới (`+`).
- [ ] Build & deploy và nghiệm thu trực quan giao diện live trên desktop/mobile.

## Thanh tìm kiếm & bộ lọc rút gọn đồng bộ nền trang `/products` — 13/11/2026
- [x] Thay thanh tìm kiếm + bộ lọc 2 hàng cũ bằng thanh pill hợp nhất (`CatalogSearchFilterBar`: ô tìm kiếm + `Bộ lọc`, `Danh mục`, `Màu`, `Giá`, `Size`).
- [x] Đồng bộ nền trang `.page` sang tông kem ấm gợn sóng dịu nhẹ.
- [ ] Deploy lên production `aureluxury.store` và xác minh trực quan.

## Sửa luồng duyệt sản phẩm theo bộ lọc (`/products?gender=women`) — 12/11/2026
- [x] Khắc phục lỗi `/products?gender=women` (và các filter không có `q`) hiển thị nhầm Search Hero không có sản phẩm.
- [x] Bổ sung thanh lọc Storefront (`CatalogFilterBar`) cho Giới tính, Danh mục, Size, Màu sắc, Khoảng giá và nút Xóa bộ lọc.
- [x] Áp dụng SQL filter (`catalogWhere`) trong `findSearchPage` và nạp `tags` trong `findCatalogPage`.
- [x] Cập nhật liên kết `"Shop"` trên `storefront-header.tsx` sang `/products?page=1`.
- [ ] Deploy lên production `aureluxury.store` và xác minh trực quan `/products?gender=women`.

## Thu hẹp Danh mục, Thẻ Tag tìm kiếm (`;`) & Gợi ý Phối đồ — 12/11/2026
- [x] Thu gọn bảng danh mục xuống 6 nhóm chính (`Áo`, `Áo Khoác`, `Quần`, `Đầm`, `Chân Váy`, `Phụ Kiện`) và đồng bộ 8 sản phẩm thật trong PostgreSQL.
- [x] Thêm ô nhập **Thẻ Tag tìm kiếm (cách nhau bằng dấu `;`)** trong `ProductEditor`, lưu trữ và lập chỉ mục tìm kiếm câu tự nhiên (`"Hôm nay tôi muốn mua áo polo"`).
- [x] Triển khai mapping gợi ý phối đồ chéo (`Áo` $\rightarrow$ `Quần`, `Áo Khoác` $\rightarrow$ `Áo`) trên cả trang `/products` và trang chi tiết `/products/[slug]`.
- [x] Checks: lint exit 0, typecheck exit 0, 8 test cases passed ($\le$ 10 test case), production build exit 0.

## Dọn dẹp sản phẩm TEST — 12/11/2026
- [x] Xóa sạch 2 sản phẩm test `AUR-125136740001` (`#63`) và `AUR-294967340001` (`#65`) cùng các bản ghi phụ thuộc test trong transaction an toàn.
- [x] Danh mục PostgreSQL hiện còn đúng 8 sản phẩm thật đang hoạt động chuẩn `AUREL - TÊN SẢN PHẨM`.

## Chuẩn hóa tên `AUREL - TÊN SẢN PHẨM` & Bỏ số — 12/11/2026
- [x] Nâng cấp `formatAurelProductName` sang định dạng `AUREL - TÊN SẢN PHẨM` (IN HOA) và loại bỏ toàn bộ số khỏi tên sản phẩm.
- [x] Cập nhật 10/10 bản ghi `Product.name` trong PostgreSQL, `demoPieces`, đơn hàng mẫu và câu lệnh SQL ranking.
- [x] Checks: lint exit 0, typecheck exit 0, 7 test cases passed ($\le$ 10 test case), production build exit 0.

## Giao diện Messenger & Quy tắc Bot mở đầu 1 lần — 12/11/2026
- [x] Bổ sung nút **"Bắt đầu cuộc hội thoại"** (`operation: "start"`), giới hạn Bot tự động trả lời 1 lần đầu tiên (`botReplyCount`) rồi tự động chuyển hẳn sang Nhân viên (`WAITING_STAFF`).
- [x] Thiết kế lại toàn bộ `/messages`, `/admin/messages` và Right-Side Popup Drawer theo chuẩn **Messenger Dark 3 cột** (Rail icon, cột `Đoạn chat` + `Tìm kiếm trên Messenger`, khung chat bong bóng tròn, ô nhập `Aa`, nút 👍 / Gửi).
- [x] Checks: lint exit 0, typecheck exit 0, 6/6 test cases `tests/chat-system.test.tsx` passed ($\le$ 10 test case), production build exit 0.
- Luồng Bot 1 lần đã được thay bằng BOT liên tục và handoff theo yêu cầu; nghiệm thu theo mục Qwen RAG phía trên.

## Hệ thống Nhắn tin & Bot Chăm sóc Khách hàng AUREL — 12/11/2026
- [x] Bổ sung icon tin nhắn vào Header storefront với logic responsive: Mobile chuyển thẳng `/messages`; Laptop click 1 lần hiện trang tải chuyển hướng 2 giây + mẹo double-click, click 2 lần mở hộp thoại bên phải vừa vặn laptop.
- [x] Xây dựng trang `/messages`, API `/api/chat`, lưu trữ hội thoại an toàn và Bot chăm sóc khách hàng AUREL (tìm sản phẩm thật, size guide, đơn hàng, đổi trả, handoff nhân viên).
- [x] Xây dựng hộp thư Người bán `/admin/messages` (bảo vệ `sellerActor()`) và API `/api/admin/messages` cho phép trò chuyện 2 chiều, bật/tắt Bot và đánh dấu hoàn tất.
- [x] Checks: lint exit 0, typecheck exit 0, 8/8 test cases passed ($\le$ 10 test cases), production build exit 0.
- [ ] Nghiệm thu trực quan thao tác 1-click / 2-click / mobile và chat 2 chiều trên trình duyệt.

## Chuẩn hóa tiền tố AUREL & Hệ thống Tìm kiếm Thông minh — 10/11/2026
- [x] Định dạng tất cả tên sản phẩm trên toàn bộ hệ thống bắt đầu bằng tiền tố `"AUREL "`, chống trùng lặp, chuẩn hóa chữ hoa và khoảng trắng thừa.
- [x] Xây dựng Hệ thống Tìm kiếm Thông minh (Smart E-Commerce Fashion Search Engine): Tách từ, chuẩn hóa NFD không dấu, mở rộng từ điển thời trang 2 chiều Việt - Anh, tính điểm tương đồng đa trường, hỗ trợ gõ từ đảo lộn và định vị Top 1 khi nhấn Enter.
- [x] Tích hợp SQL parameterized cho PostgreSQL và re-ranking deterministic.
- [x] Checks: lint exit 0, typecheck exit 0, 6/6 unit test cases passed trong `tests/smart-search-rules.test.ts` (<= 10 test cases), production build exit 0.
- [ ] Khách hàng nghiệm thu trực quan trên giao diện storefront `/products`.

## Tối ưu hình ảnh & Tinh chỉnh Card Sidebar — 10/11/2026
- [x] Nén tối ưu toàn bộ 16 ảnh PNG lớn trong `public/images/` từ 32.91 MB xuống 7.87 MB (-76% dung lượng), chấm dứt hiện tượng lag trang.
- [x] Tinh chỉnh Card "Quản trị bán hàng hiệu quả hơn" với ảnh nền vải dạ cashmere caramel cao cấp, bo góc 18px, nút pill trắng tinh khôi theo ảnh người dùng gửi.
- [x] Checks: lint exit 0, typecheck exit 0, 7 test cases passed (<= 10 test cases), production build exit 0.
- [ ] Nghiệm thu trực quan trên giao diện thực tế bởi quản trị viên.

## Dark Chocolate Admin Sidebar — 10/11/2026
- [x] Gỡ bỏ các khối cũ theo yêu cầu người dùng: "Nhập / xuất CSV", "Bộ sưu tập", "Tra cứu danh mục" và chấm màu trạng thái.
- [x] Chuyển đổi giao diện Sidebar quản trị sang phong cách Dark Chocolate (#241812) theo bản vẽ: Logo AUREL, menu 9 mục chuẩn Enterprise SaaS, badge "12", active state be sáng (#ebdcd0) bo góc 12px, banner card ở đáy ("Quản trị bán hàng hiệu quả hơn" -> /admin/orders/reports).
- [x] Checks: lint exit 0, typecheck exit 0, 7 test cases passed (<= 10 test cases), production build exit 0.
- [ ] Nghiệm thu trực quan trên giao diện thực tế bởi quản trị viên.

## Redesign AUREL Product Dashboard — 09/11/2026
- [x] Redesign UI theo ảnh tham chiếu phong cách Premium Enterprise SaaS: Header + Breadcrumb, 4 KPI thực tế, 3 Analytics Charts (Area, Donut, Horizontal Bar), thanh Search & Filter, Table với thumbnails + stock + SKU + Delete verification, phân trang số trang.
- [x] Zero Regression: bảo toàn 100% flow CRUD, `ProductDeleteControl`, API contracts và database schema.
- [x] Tests: lint, typecheck, unit tests `product-dashboard-rules.test.ts` (6/6 pass), `next build` production exit 0.
- [ ] Nghiệm thu trực quan trên giao diện thực tế bởi quản trị viên.

## Khôi phục checkout asset — 02/11/2026
- [x] Chẩn đoán JS/CSS404 do Next giữ inventory cũ sau build; restart đúng tiến trình, xác minh asset200 local/public và Chrome checkout114 có form/sản phẩm/phương thức payOS.
- [ ] Tách build verification khỏi thư mục production đang phục vụ; deployment phải restart đồng bộ build rồi kiểm asset, tránh lặp mismatch.

## payOS thật và sản phẩm thử 1.000đ — 02/11/2026
- Đã backup/restore kiểm chứng và áp riêng `20261102150000_payos_payments` trên DB local; ba bảng thanh toán sẵn sàng, dữ liệu/schema cũ giữ nguyên. Không deploy các migration pending khác.
- Đã bật `PAYOS_ENABLED=true` trong environment local, đăng ký webhook HTTPS thành công và restart production Next. Product ID63/variant120, giá 1.000 VND, stock1: `test-thanh-toan-payos-1-000d-khong-giao-hang-moi-do-tuoi`; ghi rõ TEST kỹ thuật, không giao hàng.
- Credentials được provider chấp nhận (GET mã không tồn tại trả101); retry nhận diện chính xác lỗi này và giữ mã đã lưu. CheckoutView hiện tại đã có chọn PAYOS/QR và scope Buy Now, được giữ nguyên.
- Lint/typecheck/build đạt; một regression code101 đạt. Local/public PDP200 đúng giá; chưa tạo payment link, chưa chuyển tiền, chưa xác minh PAID thật. Owner đăng nhập, Buy Now, chọn payOS và tự xác nhận 1.000đ trong ứng dụng ngân hàng; sau đó kiểm `/admin/orders`.
- Chi tiết và backup: `LOGS/PAYOS_LIVE_1000_TEST.md`.

## AUREL real product search — 02/11/2026
- [x] Ba trạng thái `/products`: hero, kết quả phân trang, no-result + YOU MAY LIKE từ catalog thật.
- [x] PostgreSQL search name/description/category/brand/profile/variant; không dấu, partial, rank exact-name; parameterized, active-only, 12/trang.
- [x] Enter/nút/chip, URL `?q=`, refresh/Back/Forward, skeleton/error/empty, commerce actions và responsive 4/3/2 cột.
- [x] 9 unit + 1 PostgreSQL case, scoped lint, typecheck và build đạt; không migration/data write.
- [ ] Owner browser QA desktop/mobile: exact/partial/không dấu/no-result, pagination, wishlist, PDP và reduced-motion.

## Seller Portal AUREL — 02/11/2026
- [x] Redesign & đồng bộ giao diện Quiet Luxury cho `/admin/orders`, `/admin/orders/reports` và `/admin/vouchers` cùng `SellerPortalNav` và `AdminHeader`.
- [x] Kiểm tra `lint`, `typecheck` và 4/4 case SSR UI (`tests/seller-portal-ui.test.tsx`).
- [ ] Nghiệm thu trực quan trên trình duyệt với tài khoản ADMIN thật ở desktop và mobile.

## Buy Now tách khỏi giỏ — 02/11/2026
- [x] Tách checkout một biến thể khỏi cart checkout ở UI, voucher quote và transaction tạo đơn; Buy Now không thêm/xóa các món trong giỏ.
- [x] Tách idempotency key theo scope; 5/5 case checkout, scoped lint, typecheck và production build đạt.
- [ ] Nghiệm thu browser/database thật: giỏ nhiều món, Buy Now một biến thể, COD và payOS, sau đặt hàng giỏ cũ còn nguyên.

## Dependency security — 02/11/2026
- [x] Vá Next/config16.4.3 và minimatch11.0.3; full/production audit17→0, giữ ESLint9 và rule coverage.
- [x] Adapter lint tạm thời + tests, 10case chọn lọc đạt, lint/typecheck/build và ci dry-run đạt; báo cáo LOGS/DEPENDENCY_SECURITY_PATCH.md.
- [ ] Deployment khởi động với dependencies/build đã vá; gỡ adapter khi upstream consumer tương thích API mới.

## payOS — 02/11/2026
- [x] Dashboard seller `/admin/orders`: verified PAID→READY queue, server groups/count/paging, cập nhật status bảo vệ role/payment/stale writes;9/9mock đạt và workspace build đạt. Report LOGS/PAYOS_SELLER_DASHBOARD.md.
- [ ] Nghiệm thu authenticated seller/customer HTTP và visual desktop/mobile sau deployment; DB preflight cho thấy ba bảng payOS chưa có và PAYOS_ENABLED false.
- [x] Source tích hợp checkout/COD, payment attempts/receipts, QR local, webhook SDK verify, reconciliation, return pages và payment state trong orders.
- [x] Migration additive, setup/registration script thủ công và mock tests; schema validate/generate/typecheck/lint/build đã chạy, kết quả tại LOGS/PAYOS_CHECKOUT_INTEGRATION.md.
- [ ] Backup/restore/rehearsal và deploy riêng migration payOS + quyền runtime; PostgreSQL transaction/concurrency QA thực.
- [x] Xử lý audit critical Next.js và moderate lint; full/production audit0 sau dependency patch02/11/2026.
- [ ] Triển khai build/tunnel đúng instance, public webhook kiểm tra gần nhất404; xác minh signature gate rồi review/đăng ký webhook thủ công.
- [ ] Bật PAYOS_ENABLED và nghiệm thu owner desktop/mobile/QR/real payment theo phê duyệt giao dịch cụ thể. Chưa có chuyển tiền thật.
- [ ] Quy trình audited đối soát/hoàn tiền/clear flag và scheduler xử lý reservation bỏ dở trước vận hành production quy mô lớn.

- [x] Bỏ khối Complete the Look khỏi public PDP và Admin Preview, không xóa dữ liệu/backend liên quan (02/11/2026).
- [x] Đặt trạng thái tồn kho của biến thể cạnh giá trên trang chi tiết sản phẩm, giữ trạng thái hết hàng và dữ liệu thật (02/11/2026).

## Sửa lỗi tạo sản phẩm 503 — 02/11/2026
- [x] Sửa P2022 do Prisma default dynamicAttributes bằng SQL tham số hóa trên schema cũ.
- [x] Tạo DEMO nháp ID23, kiểm backend create/replay/update/reload; không publish, stock0.
- [ ] Nghiệm thu signed ADMIN HTTP/browser; backup/rehearse migration JSONB để lưu thông số riêng.

## Public deployment — 02/11/2026

- [x] Chuẩn bị launcher Windows dùng Cloudflare Tunnel cho `aureluxury.store`, không lưu secret/token trong repo.
- [x] Chẩn đoán thông báo đăng nhập production là `INVALID_ORIGIN`; build hiện tại chấp nhận origin canonical HTTPS và từ chối origin localhost như thiết kế.
- [ ] Khởi động lại sạch Next.js + connector bằng `start-aureluxury.cmd`, xác nhận chỉ một deployment phục vụ domain và nghiệm thu đăng nhập thật tại origin canonical.
- [ ] Cấu hình/kiểm thử production DB, secret, backup/PITR, mail sender, HTTPS auth và checkout trước public launch.

## Kế hoạch kế tiếp — tối đa10 test/tác vụ
- [x] Thuộc tính sản phẩm động Admin: 11 loại trang phục, schema-driven UI/validation/persistence JSONB; giữ nguyên chip Phong cách/Mùa/Dịp. Tạo/sửa vẫn hoạt động khi cột JSONB pending (không lưu thông số riêng và không trả 503); migration additive chưa apply, vẫn cần backup/rehearsal + QA trực quan.
- [x] Làm mới listing `/products` theo AUREL: filter thật, card responsive/dữ liệu thật, action favorite + PDP variant-safe; lint/typecheck đạt. Browser visual QA pending; xem `LOGS/AUREL_PRODUCTS_UI_REDESIGN.md`.
- [x] Hợp nhất entry point tìm kiếm vào `/products`, giữ redirect tương thích `/search?...` và query filters; cấu hình search chuyên sâu chờ owner xác định.
- [x] Thống nhất footer AUREL bốn cột (statement/Explore/Care/Follow) cho mọi storefront/auth; `/admin/*` không có footer. Chờ owner visual QA theo chỉ đạo không test.
- [x] Source public PDP dùng giao diện preview, ProductPurchase nối cart/buy/favorite; admin link public, ảnh card điều hướng, empty look/related hữu ích. Xem PUBLIC_PRODUCT_SHOWROOM.md.
- [x] Nạp source hiện tại vào production build local và chạy tại `http://localhost:3000`; `/` và `/admin/products` HTTP 200. Public hostname vẫn chờ Tunnel/HTTPS riêng.
- [x] Làm mới AUREL Account dialog theo reference: panel responsive, session/email/logout thật, link quản trị chỉ hiện khi server xác nhận ADMIN, asset editorial local; lint/typecheck/build đạt. Browser visual QA desktop/tablet/mobile chưa chạy theo yêu cầu không dùng Computer Use; xem `LOGS/AUREL_ACCOUNT_UI_REDESIGN.md`.
- [x] Lập [NEXT_STEPS_PLAN.md](NEXT_STEPS_PLAN.md), đối chiếu source/schema và lưu giới hạn test vào AGENTS.md.
- [x] T01:7 case nghiệp vụ đạt, bổ sung source mobile; chủ dự án tự chạy ổn và yêu cầu dừng test/worker. Xem T01_DEMO_QA.md.
- [ ] T01 case8 mobile browser: chưa nghiệm thu; bỏ qua lượt QA tiếp theo theo yêu cầu mới, không ghi pass.
- [x] T02: voucher và discount snapshot/constraint, admin/checkout/cancel; scoped migration test/main, lint/typecheck/build đạt. User yêu cầu không test,0 test nghiệp vụ; xem VOUCHERS.md.
- [ ] T02: chủ dự án tự nghiệm thu tạo mã/áp mã/đặt COD; chưa kiểm qua giao diện.
- [ ] T03: thông báo đơn trong website, tối đa6 case.
- [x] T04: review chữ/sao, kiểm duyệt/phản hồi, hoàn thành cùng 10 case (`tests/reviews.test.tsx`).
- [ ] T05–T15: bảng size, chat, ledger/bulk kho, returns, payment sandbox, reports, media/collections, marketing/deployment; xem phụ thuộc/ngân sách từng tác vụ trong kế hoạch.
- T02 đã triển khai; các chức năng tiếp theo vẫn là kế hoạch. Lint/typecheck/build ghi riêng; không chạy full suite mặc định.

## Ưu tiên demo chiều 02/11/2026 — cập nhật 01/11
- [x] Đối chiếu PDF và code, loại trừ AI; tạo [báo cáo demo](DEMO_GAP_REPORT_2026-11-01.md).
- [x] Chạy 104 tests và typecheck; ghi nhận lỗi DB/build hiện tại.
- [x] P0: khởi động PostgreSQL; bỏ tải Google Fonts, build đạt với font hệ thống.
- [x] P0: giỏ lưu trạng thái, COD demo atomic/idempotent, kiểm thử chống oversell và hủy hoàn kho một lần.
- [x] P0: lịch sử/chi tiết đơn khách, admin xử lý đơn và hoàn kho khi hủy.
- [x] P0: 8 hàng DEMO/40 variants, listing ảnh/giá; 6 nhóm HTTP integration test và main read-only smoke đạt.
- [ ] P0: QA trực quan bằng tài khoản hiện hữu; browser access host hiện unavailable.
- [x] P1: category slug public linh hoạt + options DB, lọc giá/size/màu/brand, pagination, hồ sơ/địa chỉ, favorites.
- [x] P1: báo cáo đơn 24h/7d/30d, top bán chạy, cảnh báo stock≤5, phiếu đóng gói ADMIN.
- [ ] P1: bảng size; report lịch ngày/tuần/tháng đầy đủ, phân trang quá 100 đơn.
- [ ] P2: chat/review/marketing/voucher, ledger kho, returns, nhãn vận chuyển và video sản phẩm; packing slip cơ bản đã hoàn tất.
- Đây là thứ tự đề xuất cho hạn demo; các mục P2 vẫn còn thiếu so với PDF. Lịch sử phía dưới không thay thế trạng thái hiện tại.
- Bàn giao chức năng và lệnh chạy: [DEMO_IMPLEMENTATION_2026-11-01.md](DEMO_IMPLEMENTATION_2026-11-01.md). 107 tests/lint/typecheck/build đạt; không migration mới.

## ??ng nh?p local ? 2026-10-26
- [x] T?i hi?n403 kh?c hostlocalhost/127.0.0.1; th?m canonical redirects v? th?ng b?o l?i origin/server.
- [x] Ki?m tra auth20/20 v? HTTP redirect307?localhost?200, gi? query reset.
- [ ] Ng??i d?ng ??ng nh?p l?i t?i http://localhost:3000/login; x?c minh email reset ??n inbox n?u c?n.


## Dynamic Variants — cập nhật UI 2026-10-23
- [x] Làm mới modal thêm màu Demo theo mẫu: kích thước gọn (tối đa560px), font Be Vietnam Pro, xem trước màu và cặp nút Hủy/Thêm màu; responsive cho màn nhỏ. Chờ owner kiểm tra trực quan.
- [x] Modal thêm size có preset multi-select/custom; sắp size nhỏ đến lớn trên PDP và kiểm tra thứ tự bằng unit test.

> Bố cục hiện tại (2026-10-23, theo hình số2): cột giới thiệu min140px/22%, gap20px; rail dùng hết phần còn lại, bốn thẻ đều nhau với gap12px (min120px), không cap width cố định theo viewport height. Ảnh/ô thêm12:13, cover căn giữa phía trên để phủ kín khung thay các dải trống của contain; chiều cao tự theo tỷ lệ, không ép height rồi giãn ngang. Heading36px, mô tả13px, CTA140×34px; tên/giá11px, dấu+26px bên phải metadata. Tablet<=900 ba ô, mobile44%/thẻ; dữ liệu món thứ5+ vẫn cuộn được. Scrollbar ẩn, controls Admin nhẹ và success message không tạo footer, lỗi vẫn hiển thị. Gallery63vh và panel3:2:3/API/DB/autosave không đổi. Visual QA: Pending Manual Review.
## Complete the Look / AI slot (2026-10-23)
- [x] Bố cục hiện tại (2026-10-23, theo hình số2): cột giới thiệu min140px/22%, gap20px; rail dùng hết phần còn lại, bốn thẻ đều nhau với gap12px (min120px), không cap width cố định theo viewport height. Ảnh/ô thêm12:13, cover căn giữa phía trên để phủ kín khung thay các dải trống của contain; chiều cao tự theo tỷ lệ, không ép height rồi giãn ngang. Heading36px, mô tả13px, CTA140×34px; tên/giá11px, dấu+26px bên phải metadata. Tablet<=900 ba ô, mobile44%/thẻ; dữ liệu món thứ5+ vẫn cuộn được. Scrollbar ẩn, controls Admin nhẹ và success message không tạo footer, lỗi vẫn hiển thị. Gallery63vh và panel3:2:3/API/DB/autosave không đổi. Visual QA: Pending Manual Review.
- [x] Complete the Look bỏ thanh cuộn dọc: .lookRail đặt overflow-y:hidden, giữ overflow-x:auto và chiều cao tự nhiên theo nội dung. Không đổi ảnh150px+2dvh, gallery63vh, menu hoặc autosave. Visual QA: Pending Manual Review.
- [x] Desktop trên900px: đối chiếu lại cấu trúc mẫu, cột giới thiệu cố định148px/gap20px thay23%; ảnh và ô Thêm món vuông150px × (150px + 2dvh); heading28px/CTA128×30px, tên/giá10px. Giữ margin-top12px, padding dọc8px, nền sát trái và hàng cuộn ngang. Trạng thái thành công vẫn có role=status nhưng ẩn thị giác; đang lưu/lỗi vẫn hiện, nút gỡ nằm trong menu dấu ba chấm có focus/Escape và luôn thấy trên touch. ResizeObserver cùng scroll event chỉ hiện mũi tên theo hướng thực sự còn cuộn được; SSR ban đầu không hiện mũi tên. Không tự bổ sung sản phẩm mẫu để lấp chỗ trống. Mobile/API/DB/autosave giữ nguyên. Visual QA: Pending Manual Review.
- [x] Cập nhật 2026-10-23 — Complete the Look sửa trực tiếp và tự lưu: bấm/thả một ảnh vào khung12:13 cover/center, bỏ ảnh tại góc; bấm tên/giá để sửa, blur/Enter tự lưu, Escape hủy phần chữ đang sửa. Hàng đợi từng thẻ giữ version tuần tự, lỗi giữ dữ liệu/tệp và chờ retry tường minh. Thẻ mới nhận focus; hoàn thiện chỉ bật khi đủ ảnh/tên/giá đã lưu. Nền kéo sát mép trái bằng pseudo-element, chữ căn lề gallery, mép phải giữ nguyên. Gallery thay hàng nút lớn bằng menu thumbnail nhỏ Xóa/Đưa lên trước/Đưa về sau, giữ kéo sắp xếp và hỗ trợ thả tệp vào các slot. Không migration/main write; gallery desktop63vh/panels37,5/25/37,5/navbar/publish giữ nguyên. Visual QA: Pending Manual Review.
- [x] Pendingintake/inlinecards/queue20pagination/atomicconvert/idempotency/refcleanup/manualpublicreader, noparentmutation; AIheuristicremoved.
- [x] Test11SQL,93unit/13DB/10SSR/typecheck/lint/build; scopedmain9SQLverifiedrestorerehearsal/mainunchanged.
- [x] Owner approved 20261023090000_complete_look_pending; fresh verified backup/restore, scoped deploy main9 and Next reload completed; two taxonomy migrations remain pending.
- [ ] ManualAdminAdd/Save/Reload/Queue/Convert/Publish/publicArchive vàmobilehorizontalrail. VisualQA PendingManualReview.
- [ ] Review/nângcấpNextsecuritywarning riêng; chưaupgrade trongtask.

## Product creation → Visual Showroom (2026-10-22)
- [x] Plan gom desktop: informationBody cuộn riêng65dvh>=901/relatedngoài, giữ gallery/font/data; lint/typecheck/build/8SSR đạt.
- [ ] Owner manual1440×900CSS/100%, desktopkeyboard scroll/native accordion vàmobile natural flow; đầu related chỉ hiện khi có data, Visual QA Pending Manual Review.
- [x] Refinement03: reusable rating/service3cols, configured-vs-preview data gates, bag icon, Admin status placement;93unit/7SSR/lint/typecheck/build đạt.
- [ ] Cấu hình verified shipping/returns/payment và policy pages thật; backend review summary thật, thêm sizes qua Admin nếu cần. Manual visual03 Pending Manual Review.
- [ ] Owner manual Information Panel02 desktop/mobile/long names/focus/selector/native accordion, Visual QA Pending Manual Review.
- [x] Information Panel02: owner xác nhận1440px CSS/100% chỉ là design target, brief hoàn chỉnh; scoped CSS/markup/utility/SKU/accordion compact hoàn tất, lint/typecheck/build/4SSR đạt.
- [x] Upper information typography12/36/21/14px và gaps14/12/20/24px; bỏ sao mặc định ở cả hai mode. Lint/typecheck/build/4 SSR đạt.
- [ ] Manual review upper typography/long name wrap; rating thật cần backend review riêng. Visual QA Pending Manual Review.
- [x] Gallery Refinement02 CSS-only: main portrait column từ65dvh, rail68px/gap14px/7px, arrows/captions tinh gọn, giữ65% và37.5/25/37.5.
- [ ] Owner manual refinement02 desktop/tablet/mobile/ảnh ngang-dọc/thumbnail scrolling/selection/upload/navigation; Visual QA Pending Manual Review.
- [x] Theo yêu cầu mới gallery desktop/tablet cao65% viewport (65dvh/fallback65vh), grid row minmax0 chống content kéo cao; mobile<=600 responsive cũ.
- [x] Giá VND từ tagged ProductPrice mặc định cả storefront/showroom;rating ẩn khi không có review khách hàng thật.93 unit/4 SSR/readonly live loader checks đạt.
- [x] Quiet Luxury two-font typography shared PDP/navbar qua next/font/google, title34–40px, Vietnamese cmap coverage/fallback verified; Admin forms giữ nguyên.
- [ ] Manual review typography chữ Việt mixed fallback, wordmark/nav fit desktop-mobile/title wrap và editorial headings; Visual QA Pending Manual Review.
- [x] Owner yêu cầu publish DEMO ID1; managementFinalize validation đạt, public active readback/children unchanged (5 ảnh/3 variants).
- [x] Visual Refinement01: gallery desktop65dvh, layout65/35, rail/panels aligned, mobile auto-height; CSS-only,92 unit/3 SSR/lint/typecheck/build đạt.
- [ ] Manual review refinement01 ở desktop/tablet/mobile; ảnh contain/rail scroll/selection/upload, không interactive browser test.
- [x] Theo yêu cầu owner tạo một draft DEMO ID1 kèm ảnh minh họa DB-backed, chưa xuất bản/không giá/stock0 để manual review.
- [x] Step1 data/taxonomy/variants giữ nguyên, bỏ ảnh/summary/save actions, chỉ Tiếp theo.
- [x] Internal unpublished draft/reuse ID/idempotency+concurrency ticket trên test; no duplicate/back-forward data loss trong service workflow.
- [x] Shared ProductDetailView preview/production theo ảnh2; rail/main/3 panels/info/related real catalog, empty/error/mobile/accessibility source.
- [x] Direct slot upload/replace/remove/library/primary/roles/drag order + accessible moves; immediate atomic persistence/refresh/variant links/cleanup.
- [x] Step2 save draft/finalize/status/explicit publish; price/image checks, public/private gates, no purchase side effects.
- [x] Prisma generate,92 unit/12 PostgreSQL/3 SSR tests, lint/typecheck/build; reviewed SQL và verified backup/restore/no-drift/rehearsal.
- [x] Owner phê duyệt riêng20261021120000_product_draft_requests và scoped apply main; main8/test10, giữ hai taxonomy SQL pending.
- [x] Backup/verified restore mới, no-drift/rehearsal/scoped apply main và reload Prisma/Next sau approval.
- [ ] Owner manual visual/native picker/drag/swipe/focus ở desktop/mobile. Visual QA Pending Manual Review.


## Nav cửa hàng theo reference (2026-10-22)
- [x] Navbar gọn56px/nền#f3eee7/logo-menu-search-icons nhỏ hơn; giữ hero nav cũ, touch targets và chức năng. Lint/typecheck/build đạt; Visual QA Pending Manual Review.
- [x] Nav Women/Men/Accessories/Essentials/Collections/AI Recommendations cho sticky/storefront, search pill/icons/mobile drawer; hero đầu homepage khôi phục nav cũ theo yêu cầu bổ sung.
- [x] Bộ lọc gender thật gồm unisex/category Accessories;90 unit tests/lint/typecheck/build đạt.
- [ ] Manual QA nav/search/mobile/anchor/account và dữ liệu thật; Visual QA Pending Manual Review. Wishlist và AI engine vẫn là scope tương lai.

## Ảnh đơn giản và tìm theo sản phẩm (2026-10-22)
- [x] Bỏ metadata UI, chỉ upload/ảnh chính/bỏ ảnh; tìm kho theo tên sản phẩm đã lưu, auto debounce và paging.
- [x] Explicit image unlink cùng aggregate save, ownership/stale-version/rollback; website-use intent cho uploads, giữ denied/AI.
- [x]88 unit/11 PostgreSQL tests, lint/typecheck/build; không migration/main writes.
- [ ] Owner manual upload/primary/remove/save/reload/search/paging/empty/errors/mobile. Visual QA Pending Manual Review.


- [x] Avatar hình người nền trắng thay Admin/mũi tên trong header, giữ menu tài khoản thật (2026-10-22). Manual visual/account keyboard QA pending.

- [x] Heading phần3 đồng bộ phần2 qua shared selectors: bar trái/badge gradient/font/spacing (2026-10-22); lint/typecheck/build đạt. Manual visual review còn pending.

## Tinh gọn chữ phụ admin (2026-10-22)
- [x] Bỏ toàn bộ card Lưu ý theo yêu cầu bổ sung; bỏ helper/subheading ngoài ô và dòng phụ upload; badge chưa lưu viền vàng/đã lưu xanh theo baseline thật; lint/typecheck/build đạt.
- [ ] Manual QA new/edit/list/import, empty/error/save state. Visual QA Pending Manual Review.

## Upload và kho ảnh gọn (2026-10-22)
- [x] File picker nhiều ảnh, decoder/resize/WebP, binary PostgreSQL và migration main riêng sau verified backup/rehearsal.
- [x] Kho ảnh12/trang, attach vào draft, metadata collapse, ADMIN/CSRF/public rights gate và chặn optimizer cache uploads.
- [x] Prisma generate,87 unit/11 PostgreSQL tests, lint/typecheck/build; main7/test9 migrations.
- [ ] Owner manual upload/save/reload/rights/public view/mobile và kho ảnh; Visual QA Pending Manual Review.
- [ ] Chính sách dung lượng/retention/xóa asset không dùng và object storage khi triển khai lớn; CSV chỉ metadata, full backup phải chứa ImageAsset.


## Thanh tiêu đề theo reference (2026-10-22)
- [x] Breadcrumb/title/actions trong card ivory, cao tối thiểu150px/heading28–34px; ba kiểu nút và responsive theo ảnh, lint/typecheck/build đạt.
- [ ] Owner manual QA desktop/mobile/dirty/save actions. Visual QA Pending Manual Review.

## Sidebar theo reference (2026-10-22)
- [x] Card ivory bo góc/icon tiles/active be và spacing theo ảnh; lint/typecheck/build đạt.
- [ ] Owner manual QA sidebar/active/keyboard/mobile và dữ liệu thật. Visual QA Pending Manual Review.

## Header admin theo reference (2026-10-22)
- [x] Nền espresso/chữ ivory và menu desktop căn giữa cho shared AdminHeader, gồm /admin/products/new; lint/typecheck/build đạt.
- [ ] Manual QA desktop/mobile/account/focus theo ảnh. Visual QA Pending Manual Review.

## Sửa dropdown biến thể và ô màu — 2026-10-22
- Nguyên nhân từ source: .variantTable .pickerMenu dùng position:relative, menu nằm trong flow của ô và làm tăng chiều cao hàng khi mở. Đã bỏ override và dùng native Popover top layer/fixed cho shared OptionPicker, không giãn hàng hoặc bị khung cuộn ngang cắt; giới hạn theo viewport, đóng khi scroll khung ngoài/resize/Escape/click ngoài.
- Màu chuẩn có ô vuông14px cạnh tên ở giá trị đã chọn và danh sách nút chọn; có search, keyboard Tab/Enter, trạng thái selected, native required select giữ validation. Màu custom chưa có mã màu dùng ô trung tính dấu hỏi, không tự đoán từ label. Size/metadata vẫn dùng select native trong popup. Không sửa DB/migrations/taxonomy tokens/API hoặc layout storefront.
- Code: src/components/admin/product-editor.tsx, products.module.css. npm.cmd run lint/typecheck/build đều đạt; không thêm test mirror presentation, không DB suite hoặc browser/HTTP/screenshot. Visual QA Pending Manual Review.
- Tiếp theo: refresh admin, mở màu/size ở hàng đầu/cuối và nhiều hàng; kiểm tra không giãn/không cắt popup, swatches đen/trắng, search/empty/custom/Tab/Enter/Escape/click ngoài, cuộn ngang/mobile và required khi chưa chọn.


## Nhóm đối tượng sản phẩm — 2026-10-22
- [x] Thay ô slug bằng Giới tính – Nhóm tuổi; chuyển gender khỏi phần2 và dùng lại dữ liệu hiện có.
- [x] Nhóm tuổi dạng nhãn Gen Z/Gen Y/Trung niên…; server validate, nullable, không suy ra năm sinh.
- [x] URL tự tạo phía server/unique, giữ URL đã lưu; CSV header cũ tương thích và feature schema v3.
- [x] Backup/verified restore/no-drift/rehearsal/apply riêng audience vào main;6 migrations main,8 test, không backfill.
- [x] Prisma generate,84 unit/10 PostgreSQL tests, lint/typecheck/build.
- [ ] Manual QA Giới tính/Nhóm tuổi/save-reload/URL trên ADMIN thật. Visual QA Pending Manual Review.


## Phase 2.9.3 — Product Editor (2026-10-22)
- [x] Đồng bộ khối3 theo ảnh riêng: heading/badge/add-button/bảng/inputs/actions icons/scroll ngang, giữ nguyên chức năng và backend; lint/typecheck/build đạt.
- [x] Đồng bộ khối2 theo ảnh riêng: tiêu đề/huy hiệu cùng khối1, dropdown/plus be/chips và responsive; lint/typecheck/build đạt. Chờ manual QA đóng/mở/chọn/chip.
- [x] Theo đính chính của chủ dự án, chỉnh riêng mũi tên dropdown bằng SVG đồng nhất cho Danh mục và các lựa chọn bên dưới; không sửa nút plus.
- [x] Khối1 theo ảnh chi tiết: title/badge/prefix icons/brand clear và description toolbar nguồn Markdown +preview/history/expand. Plain backward compatibility, safe React rendering/rights, multiline validator fix,4 unit mới và80/80 suite/10 guarded DB/lint/typecheck/build đạt.
- [ ] Manual QA khối1 và toolbar theo PRODUCT_DESCRIPTION.md; chưa WYSIWYG/full CommonMark, không đổi schema.
- [x] Chỉnh theo ảnh mẫu bổ sung: header/sidebar active/icon, breadcrumb/actions,3 cards đánh số, info3 cột/metadata2 cột/chips espresso, gallery primary lớn/preview ngang/notes. Header/footer conditional chỉ admin; storefront giữ nguyên.
- [x] Auto code/SKU server authoritative + unique/concurrent create retry, rename ổn định; URL tự sinh server từ tên/giới tính/nhóm tuổi, hậu tố unique và giữ URL cũ và brand AUREL.
- [x] 8 searchable dropdown + modal, 3 tag rows, variant table/add/copy/remove unsaved/deactivate saved/price strings và liên kết ảnh ổn định.
- [x] Shared taxonomy registry + explicit unknown/not-applicable và schema ML v2; hai SQL staged/test-only, CSV custom round-trip, main compatibility mode.
- [x] 6 focused tests mới (4 unit/2 DB), suite76/76, guarded PostgreSQL10/10 gồm parent và7 subtests cũ, lint/typecheck/build; cleanup/rollback và main/env unchanged.
- [ ] Phê duyệt riêng hai SQL mới, backup mới/verified restore/no-drift/rehearsal trước apply main để bật mã viết tắt/custom options. Main đang6/8 migrations; audience đã apply riêng, hai taxonomy SQL còn pending.
- [x] Nút Hủy và Lưu nháp thật (isActive=false), searchable dropdown compact/pill chips; collection suggestions từ data thật, không seed mẫu hoặc fake số lượng/trạng thái. Lint/typecheck/build và76 unit tests đạt sau UI redesign.
- [ ] Visual QA Pending Manual Review theo ảnh mẫu đã cung cấp và PRODUCT_EDITOR.md; keyboard/mobile/dropdown/dirty back-forward và signed ADMIN session cần owner review.
- [ ] Storage upload provider và taxonomy rename/delete/archive là scope tương lai; hiện public references thật, registry append-only.

## ADMIN provisioning — 2026-10-22
- [x] Chủ dự án chỉ định chính xác một tài khoản; kiểm tra existing identity/emailVerified=true và cấp ADMIN bằng transaction/conditional row update.
- [x] Audit intent/commit local, hậu kiểm ADMIN/verified giữ nguyên, anonymous API401; không tạo user hoặc thay secrets/schema/DB grants.
- [ ] Chủ dự án mở /admin/products để manual QA bằng signed session của chính mình.

## Email website chính — 2026-10-22
- [x] Provider domains GET200/verified, cấu hình hai biến email main từ credentials dự án hiện có và restart đúng Next3000.
- [x] Verify/Forgot UI200, deliveryAvailable=true; không thay auth enforcement/origin/secret/database hoặc tự gửi email.
- [ ] Chủ dự án gửi verification từ UI và xác nhận nhận/mở link; chưa khẳng định inbox delivery của tài khoản hiện tại.

## Vận hành auth local — 2026-10-22
- [x] Mở lại PostgreSQL và Prisma Studio localhost51212 theo yêu cầu tiếp theo; existing cluster/SELECT1/TCP listener đạt, không migrations/seed/reset/browser.
- [x] Xác định ECONNREFUSED và bật lại PostgreSQL hiện có; db:check đạt.
- [x] GET form/session và negative signin main; positive signup/signin/session/logout chỉ trên test DB, cleanup/main/env unchanged.
- [x] Chủ dự án đã có tài khoản thật verified và chỉ định cấp ADMIN ngày2026-10-22; không tạo user/main fixtures.

## Video Performance Optimization — 2026-10-22
- [x] Inspect source/mount/loading và metadata exact file/codec/FPS/resolution/bitrate/audio/MP4 atom order.
- [x] Encode desktop/mobile H.26430FPS/no-audio/faststart, giữ nguồn và thời lượng, poster WebP từ video thật.
- [x] Stable media node/source-once, lazy load, viewport/tab pause, reduced motion/Save-Data, click/keyboard Play/Pause và poster/error/autoplay-rejection fallback.
- [x] Gỡ nút Play/Pause hiển thị; theo yêu cầu mới nhất đã bỏ lớp che góc, giữ nguyên chữ trong video và các tối ưu playback.
- [x] Giữ layout/khung/contain/colors/overlay/reveal/CTA/homepage order; không DB/migration/security changes.
- [x] Lint/typecheck/build và metadata terminal đạt; không tests/HTTP/browser/screenshots.
- [ ] Visual QA Pending Manual Review: cinematic quality30FPS/loop/logo, mobile/iOS autoplay, offscreen/tab/manual pause, reduced motion, network/dropped frames/no reload/no layout shift.

## Phase 2.9.2 — Main migration và ADMIN Product Management
- [x] Approval schema main từ brief, SQL/SHA/history review và kiểm tra no drift bằng schema chain độc lập.
- [x] Backup mới7b754f, restore fingerprint khớp nguồn, rehearsal3 SQL và bảo toàn cột/sequences cũ.
- [x] Apply thật3 migrations main;5 migrations up to date, Prisma diff không khác, không seed/env/role changes.
- [x] ADMIN server gate cho mọi operation; Explorer/search/paging/empty/loading/error và new/[id]/import routes.
- [x] Aggregate Product/Profile/options/AI/variants/prices/stock/images, Category creation/search, ownership/validation/concurrency protection.
- [x] Archive/restore và hard-delete với code confirmation/reference guards/local audit; Explorer có cột Thao tác/dialog nhập mã cho sản phẩm archived, không bulk hard-delete/asset deletion. Lint/typecheck/build và 8/8 ADMIN database cases đạt ngày 02/11/2026; browser QA còn pending.
- [x] CSV6 templates preview/lỗi từng dòng/live revalidation/atomic insert-only import và formula-safe export theo trang.
- [x] Public website image rights độc lập cờ AI; currency storefront giữ false, Units Sold unavailable.
- [x] Lint/typecheck/72 unit/build,7 focused ADMIN subtests, existing auth/pricing/concurrency regression, main read-only catalog và HTTP smoke đạt; fixtures cleanup/main unchanged.
- [x] Provisioning ADMIN main cho đúng tài khoản verified theo chỉ định trực tiếp ngày2026-10-22, audit và hậu kiểm đạt; các tài khoản khác cần chỉ định riêng.
- [ ] Visual QA Pending Manual Review; không browser automation/screenshots trong phase này.
- [ ] Review hàng/giá/ảnh thật và quyết định bật MULTI_CURRENCY_ENABLED riêng.
- [ ] Production readiness: least-privilege runtime/TLS/offsite backup/PITR/durable audit/retention/shared limiter trước deployment. Schema local approval không cấp production GO.
- [ ] Import update-existing cần diff/confirmation riêng; variant hard-delete, subcategory và storage upload cần scope riêng.

## Phase 2.9.1 — Product Database & AI Data Foundation
- [x] Đối chiếu schema cũ/mới; tái sử dụng Category/Variant/Price/Image và giữ UI/API cũ.
- [x] Staged schema ProductCode/collection/timestamps, ProductProfile typed Options/AI, image rights/variant FK và ràng buộc uniqueness/stock.
- [x] ADMIN setters/export có migration gate độc lập, catalog/detail off không query metadata staged.
- [x] Sáu CSV templates, offline insert-only dry-run/report, JSONL schema/mapping/missing report.
- [x] Review SHA migration mới; apply/test chỉ aurel_ai_test; fingerprint main/.env unchanged và cleanup fixtures.
- [x] 6 focused tests, full72 tests, lint/typecheck/build; không browser/visual automation.
- [x] Thiết kế Units Sold read-model; không fake analytics hoặc counter nhập tay.
- [x] Ba migrations đã được cho phép và apply main Phase2.9.2; currency flag và production cutover còn chờ riêng.
- [ ] Curate dữ liệu thật và quyền ảnh; triển khai write importer riêng khi được yêu cầu, live revalidation/atomic transaction.
- [ ] Fabric variant/size system mới chỉ khi có hàng thật cần: cập nhật combination key và selector/DTO đồng bộ.
- [ ] Return ledger và recognition policy trước Units Sold chính thức; embedding model/dimension/storage trước production AI.
- [ ] Visual QA Pending Manual Review.

## Phase2.8 — Product Detail
- [x] /products/[slug] SSR/metadata/notFound/error/loading, active product/category/variants/images, public safe DTO và reuse catalog/Prisma.
- [x] Gallery/thumbnails/fallback, color-size/SKU/stock, missing/legacy price states, currency exact-price GET sau feature gate; purchase disabled, không Cart/Checkout.
- [x] Link title hàng thật từ Catalog/Collection, không thay layout/tokens/hero/animation hoặc schema/env/main data.
- [x]5 focused tests một file,66 unit tests/lint/typecheck/build; HTTP PostgreSQL test positive/flag-off/notFound/private-image/listing link + owned cleanup đạt. Streaming notFound HTTP200/noindex, không giả định404 status.
- [ ] Visual QA **Pending Manual Review**, ảnh/giá hàng thật main chưa được thêm trong task. Không browser automation/screenshots.
- [ ] Cart/Checkout/inventory reservation cần phase riêng; schema main đã migrate Phase2.9.2, currency public chưa bật.

## Phase2.7 — Authentication UI
- [x] Phase2.7.1 Lightweight QA theo scope cập nhật: source/tokens/responsive CSS/validation/a11y attributes/safe redirect/Better Auth review;61 tests/lint/typecheck/build/GET smoke5 routes đạt. Không thêm tests hoặc sửa UI khi chưa có lỗi rõ ràng.
- [ ] Visual QA: **Pending Manual Review** theo yêu cầu mới;4 viewport, keyboard/interaction và positive browser flow chưa được nghiệm thu. Chi tiết AUTH_UI_QA.md.
- [x]5 routes login/register/forgot/reset/verification, editorial split desktop và form-only mobile, tokens/ảnh campaign có sẵn, AUREL navigation/footer.
- [x] Better Auth same-origin login/register/rememberMe/logout/session; safe next redirect, confirm/password validation, pending/duplicate prevention, neutral forgot/unavailable503, native callbacks/reset token privacy.
- [x] Account links/logout trong homepage dialog/mobile menu và secondary header; không đổi hero/collection/animations/schema/secrets hoặc gửi email thật.
- [x]6 focused cases một file mới,61 unit tests/lint/typecheck/build và HTTP5 routes/privacy/session đạt.
- [ ] Browser visual/keyboard/screen-reader QA1440/768/390/320 + screenshots/chủ dự án duyệt. Computer Use tự dừng vì không xác định chắc URL Chrome; chưa có bằng chứng viewport thực.
- [ ] Positive UI end-to-end bằng database test/email capture nếu cần; chưa chạy browser login/register/reset thành công trên PostgreSQL trong Phase2.7. Main NO-GO giữ nguyên.

## Phase2.6 — Email verification/password reset backend
- [x] Phase2.6.2 real acceptance: physical aurel_ai_test/role guard đạt, Resend domain Verified; đúng2 emails accepted/delivered, owner xác nhận nhận và verify link thành công. Reset old401/new200/session cũnull, cleanup owned auth fixtures0; callback listener đóng. Main/.env không thay đổi, NO-GO giữ nguyên.
- [x] Better Auth verification/expiry, single-use reset, revoke sessions; không đổi Prisma/UI/migrations.
- [x] Provider port/templates, thiếu provider trả 503 cho resend/reset; không bắt buộc verified email.
- [x] Rate limits và 6 tests mới trong một file; lint/typecheck/51 unit tests/build đạt.
- [x] Phase2.6.1 chọn Resend, nối adapter server-only tại lib/auth.ts qua RESEND_API_KEY/EMAIL_FROM, timeout/sanitized errors/429 cooldown, không dependency mới. 4 adapter tests, tổng55 tests/lint/typecheck/build đạt.
- [x] Key/sender chỉ trong .env.test, mailbox được chủ dự án cho phép; nghiệm thu2 workflows trên PostgreSQL test + Resend thật. Không bật email production.
- [ ] Production cần theo dõi lỗi delivery, trusted proxy/shared limiter/secret manager; nghiệm thu test không cấp approval deployment hoặc tự bật verified-email enforcement.
- [ ] Quyết định requireEmailVerification riêng khi delivery sẵn sàng; schema main đã apply Phase2.9.2, production cutover chờ riêng.

## Phase2.5.2 — Security readiness (main NO-GO)
- [x] Audit User/Account/Session/Product/Order và pending ProductPrice chỉ đọc; ghi nhận role rộng và backup/TLS/PITR gaps.
- [x] Thiết kế runtime/migration identities, grants theo feature/cột, User role guard/default deny.
- [x] Test LOGIN app thật + owner deploy trên cluster độc lập5544; source unchanged, lab roles cleanup, instance stopped.
- [x] Runbook hai pending migrations/timeout/maintenance/partial failure/cutover; backup retention/encryption/offsite/PITR/RPO/RTO baseline chờ duyệt.
- [ ] Approval riêng role provisioning và production cutover/rollback; schema main5 migrations đã apply Phase2.9.2, không đổi/revoke main credentials trước canary được duyệt.
- [ ] Chọn/triển khai secret manager, TLS/network, backup storage/KMS/retention/PITR và đo recovery evidence trước production; policy dự thảo chưa là hạ tầng hoạt động.

## Phase 0 — Nền tảng hoạt động
- [x] Kiểm tra repository, bảo toàn tài liệu/mã người dùng
- [x] Khởi tạo Next.js App Router + TypeScript strict + Tailwind CSS
- [x] Header, navigation, hero, danh mục phong cách và footer
- [x] Triển khai CSS responsive và empty states riêng cho storefront/catalog/search/cart
- [x] Loading, lỗi nguồn dữ liệu, error boundary và not-found
- [x] `.env.example`, README và scripts kiểm tra
- [x] Chạy lint, typecheck, unit tests, production build và HTTP smoke; ghi kết quả thật
- [x] Tạo DESIGN_SYSTEM.md, token tập trung và ghi rõ thiết kế tạm thời
- [ ] Hoàn tất kiểm tra trực quan và bàn phím ở desktop/tablet/mobile (Computer Use đã khả dụng, có kết quả từng phần trong AUREL_EXPANSION_QA.md)
- [ ] Chủ dự án duyệt/tùy chỉnh tên, typography, bố cục và danh mục định hướng

## AUREL — Header và hero (2026-10-13)
- [x] Đọc brief và screenshot gốc, thay riêng header/hero; giữ nguyên section và tuyến hiện có.
- [x] CSS Grid 62/38 và 54/46, wordmark giữa viewport, responsive portrait/landscape/mobile, reduced-motion.
- [x] Menu dialog truy cập được, search/cart thật, thông tin tài khoản chưa mở.
- [x] Lint, typecheck, build, unit và HTTP regression checks.
- [x] Người dùng bổ sung ba ảnh gốc; HTTP gốc và optimized đã xác minh thành công.
- [ ] QA screenshot 1680×900, tablet và mobile; kiểm tra crop, overflow, contrast, hydration và bàn phím trong browser.

## AUREL — Collection Scroll Reveal (2026-10-13)
- [x] Tăng spacing heading/filter/grid/details/CTA responsive; lint/typecheck/build đạt.
- [x] Giữ nguyên hero đã duyệt (hash TSX/CSS), thêm section ngay sau hero.
- [x] Sticky/ivory reveal 92→100%, reverse tự nhiên, flow đơn giản trên mobile/portrait/reduced-motion.
- [x] Metadata, heading, filter demo thật, grid 4/3/2 cột, ảnh mock photography 3:4 có nhãn AI/demo, stagger và CTA catalog.
- [x] Fixture demo tách reader, fallback error/real data, lint/typecheck/build, 8 unit tests và HTTP regression.
- [ ] Browser QA theo COLLECTION_REVEAL_QA.md — BLOCKED: ba lượt goal liên tiếp inventory browser rỗng; cần kết nối browser để xác minh animation/render/performance thực tế.
- [x] Collection dùng dữ liệu catalog thật; bỏ fixture fallback khi DB rỗng (2026-10-20).
- [x] Detail route và title links thật đã có Phase2.8.
- [ ] QA thủ công ảnh/giá hàng thật khi có dữ liệu, không thay demo vào catalog.

## AUREL — Fashion Discovery Search (2026-10-13)
- [x] Section search gọn trong panel, trước heading collection, max-width 800px, responsive/chips wrap/reduced-motion.
- [x] Suggestions điền input; Enter/Explore; demo keyword search theo fields có thật trong fixture; không claim AI.
- [x] Empty/no-result/clear, nhãn input/live status và category kết hợp; real-data submit qua /search.
- [x] Giữ nguyên hash hero và scroll reveal; lint/typecheck/build, 11 tests và HTTP checks đạt.
- [ ] Xác minh desktop/tablet/mobile, bàn phím, overflow và motion trong browser (inventory hiện rỗng).

## AUREL — Intelligence showcase (2026-10-13)
- [x] In đậm riêng “SUIT YOU” (700), giữ màu và kiểu nghiêng luxury.
- [x] Copy theo ảnh và trang trí luxury: serif ivory/italic champagne, đường mảnh, CTA viền; lint/typecheck/build đạt.
- [x] QA typography luxury/SUIT YOU và collection ở mobile 320/400px, không thấy chữ vượt khung tại zoom 100%.
- [ ] Hoàn tất QA typography luxury ở tablet/desktop và toàn bộ focus states.
- [x] Video trang trí muted/loop/overlay30%/16:9 contain; từ2026-10-22 thêm lazy/visibility/reduced-motion playback và Play/Pause overlay, không đổi layout.
- [ ] QA autoplay được browser cho phép, điểm nối loop và logo dưới overlay trên desktop/mobile.
- [x] Thay search/metadata cũ bằng showcase duy nhất trước collection, CTA pill đen đúng thông số, giữ video và category filter.
- [ ] Nhận URL AI từ người dùng và thay `/search` tạm; xác minh điều hướng.
- [x] Component riêng sau collection, desktop 58/42, video contain 16:9, mobile stack; typography/copy và CTA theo brief.
- [x] Sao chép video nguyên byte, native controls, fallback lỗi và fade/reveal reduced-motion; không thêm dependency.
- [x] Lint/typecheck/build, 11 tests, HTTP smoke và range video 206.
- [x] Người dùng xác nhận đặt sau collection, CTA tới phần tìm phong cách hiện có.
- [ ] Xác minh trực quan và playback/seek/fullscreen ở desktop/tablet/mobile khi có browser kết nối.

## Homepage editorial expansion — 2026-10-13
- [x] Header duy nhất chuyển sticky từ New Collection, hide khi quay lại hero.
- [x] Divider CSS stone, product search GET /search và bốn suggestions.
- [x] Ba category links và server validation tops/bottoms/outerwear.
- [x] Typed data đủ 10 looks, demo state không mua được, thumbnail local và campaign CSS placeholders.
- [x] Desktop sticky horizontal đo overflow thực, reverse, ResizeObserver/rAF/cleanup; mobile/reduced-motion scroll-snap, Previous/Next và keyboard.
- [x] Journal notes và footer đầy đủ với placeholder nội dung chưa mở rõ ràng.
- [x] Lint/typecheck/build, HTTP smoke 12 cases/13 links.
- [x] Browser QA một phần: desktop endpoint LOOK 10/exit Journal/reverse; Next mobile 400px; End desktop reduced-motion; Intelligence/Collection 320px.
- [ ] Hoàn tất browser QA theo AUREL_EXPANSION_QA.md: resize giữ vị trí, toàn bộ focus, no-JS, image failure và profile không extension. Computer Use đã hoạt động, không còn blocker đọc URL.
- [ ] Thay ảnh campaign null và demo looks bằng assets/products thật khi có dữ liệu.

## Phase 1 — Dữ liệu sản phẩm và danh mục
- [x] Cấu hình PostgreSQL + Prisma local; migration init_aurel đã áp dụng, schema up to date (2026-10-20).
- [x] Xác minh schema Prisma hiện có; thêm helper PostgreSQL local, kiểm tra SELECT 1 và hướng dẫn P1001 (2026-10-20).
- [x] Nối Prisma reader vào catalog, mapping Decimal/ảnh/variants/category và kiểm tra lỗi kết nối, thiếu cấu hình, DB rỗng; 15 unit + 3 integration tests, build và HTTP đạt (2026-10-20).
- [x] Phase 2.2: service CRUD product/category/variant/image, validation, DB role guard và CAS tồn kho; giữ schema/dữ liệu/UI.
- [x] Catalog pagination server-side tương thích getCatalog và thêm getCatalogPage có metadata.
- [x] Resolver ảnh public raster dùng chung, không trả storageKey; đề xuất migration currency không gán đơn vị mặc định.
- [x] Phase 2.5: ProductPrice VND/USD/EUR độc lập, validation, DTO/service và order snapshots/SQL constraints.
- [x] SQL/SHA review, backup/restore mới, rehearsal legacy và integration test; main giữ nguyên.
- [x] Review pre-production, backup mới/verify restore, rehearsal legacy/constraints/lock timeout trên bản sao 20261020164337_8f3f13.
- [x] Phase2.5.1 khắc phục write skew bằng revision header, before-item writes và functions/ACL hardening, migration mới không sửa lịch sử.
- [x] 13 lịch mỗi isolation RC/RR/Serializable, nonowner privilege probes; backup/restore mới170607_24796c, Prisma chain4metadata/checksums/schema diff/auth/CRUD/currency/rollback đạt.
- [x] SQL/legacy review, backup/restore mới và apply main hoàn tất Phase2.9.2; runtime role/recovery/currency enable chờ riêng.
- [ ] Chọn storage provider và nối resolver URL ảnh remote thực tế.
- [x] Phase 2.3: Better Auth backend + Prisma singleton/Int IDs, additive auth migration đã review, session resolver thật và role/expiry guard.
- [x] Auth tests signup/signin/signout/revocation/expiry/cookie/origin/role injection bằng Better Auth memory adapter; kiểm tra HTTP âm tính với Prisma, không tạo user giả.
- [x] Phase 2.4: nghiệm thu positive auth/CRUD, concurrent stock, rollback, FK/unique trên PostgreSQL test riêng; test role/target guards và cleanup scoped.
- [x] Backup/restore drill read-only nguồn aurel_ai, restore sang DB test mới, fingerprint và SHA archive đã xác minh; source/.env không đổi.
- [ ] Chính sách backup production/retention/offsite/PITR và quy trình cấp ADMIN; mail provider đã có Phase2.6.
- [ ] Quy trình cấp ADMIN main và shared limiter khi deploy; mail và Login/Register UI đã có Phase2.6/2.7.
- [x] Detail route Phase2.8.
- [ ] Pagination UI và QA sản phẩm thật.
- [x] Trace và sửa pg concurrent-query deprecation: PrismaPg pipeline + tuần tự hóa fan-out trong interactive transaction; PostgreSQL trace rerun không còn warning (02/11/2026).
- [x] Mô hình product/category/images/price/variants/inventory deployed main Phase2.9.2.
- [x] Listing và trang chi tiết đọc PostgreSQL thật (empty/not-found intentional)
- [ ] Tìm kiếm, lọc và sắp xếp trên dữ liệu thật
- [x] Admin CRUD xác thực và ủy quyền server-side Phase2.9.2; main ADMIN provisioning chờ riêng.

## Phase 2 — Mua sắm
- [ ] Giỏ hàng lưu trạng thái, kiểm tra giá trên server
- [ ] Xác thực/ủy quyền khách hàng
- [ ] Checkout, vòng đời đơn hàng và giữ tồn kho
- [ ] Tích hợp cổng thanh toán sau khi chọn nhà cung cấp

## Phase 3 — AI tùy chọn
- [ ] Thu thập sở thích có đồng ý và giới hạn dữ liệu
- [ ] Gợi ý thời trang với fallback rõ ràng
- [ ] Dịch vụ thử đồ ảo riêng biệt
- [ ] Tối ưu GPU/bộ nhớ và observability

## Ưu tiên bảo trì
- [x] Tinh gọn `/products` và nội dung header/footer tuyến phụ, giữ các liên kết theo yêu cầu; xác minh HTTP và build.
- [x] Gỡ ba section cũ và footer khỏi trang chủ theo yêu cầu; sửa liên kết neo tới collection và cập nhật HTTP smoke.
- [x] Điều tra `mdl-js` trong source/dependencies/build và HTTP production; không tìm thấy nguyên nhân trong dự án, giữ nguyên UI và không che hydration warning.
- [ ] Xác minh hydration trong profile sạch và xác định extension/userscript gây mutation theo `docs/HYDRATION_DEBUGGING.md`.
- [x] Vá chuỗi công cụ lint và Next theo dependency patch02/11/2026; full audit và production audit đều0, giữ ESLint9 với adapter tương thích được kiểm tra.
- [ ] Khởi tạo/kết nối Git repository theo lựa chọn của chủ dự án.

## Dynamic Variants — 2026-10-23
- [x] Preview thêm màu/size local, HEX, tổ hợp thiếu; defaults stock0/chưa giá/inactive.
- [x] ADMIN transaction/version/API, SKU, HEX metadata, helper Editor, giữ ProductVariant hiện có.
- [x] 101 unit/14 DB/11 SSR, lint/typecheck/build; main9/test12.
- [ ] Backup/verified restore/rehearsal và approval chuỗi taxonomy + HEX trước main.
- [ ] Manual review dialog/keyboard/mobile/selection. Visual QA: Pending Manual Review.
- [ ] Xử lý cảnh báo bảo mật Next16.4.0 trong task dependencies riêng.

## Danh mục và bộ sưu tập — 2026-10-23
- [x] Lưới loại trang phục Nam/Nữ, icon nét mảnh, legacy/custom/search và DB rỗng.
- [x] Resolve danh mục preset ADMIN/idempotent; collection tree từ trường riêng hiện có, không migrate main.
- [x]102 unit/14 DB/13 SSR/lint/typecheck/build.
- [ ] Owner phân loại lại Category cũ đang mang tên bộ sưu tập; gán Product.collection có chủ đích.
- [ ] Visual QA: Pending Manual Review (gender/category/keyboard/mobile/collection tree).

- [x] 01/11/2026: cập nhật credential ADMIN local theo yêu cầu, xác minh hash và thu hồi phiên cũ; dùng email đăng nhập.

## Login editorial — 2026-11-02
- [x] Dựng lại giao diện `/login` theo ảnh tham chiếu (desktop/tablet/mobile).
- [ ] Owner nghiệm thu visual và đăng nhập thật; chạy `npm run build`.
- [ ] Cấu hình social providers rồi nối nút Apple/Google/Facebook (hiện bị vô hiệu hóa).
- [x] Dựng lại giao diện `/register` cùng phong cách `/login`; [ ] owner nghiệm thu và thử tạo tài khoản thật.

## Wishlist & Account Dashboard — 2026-11-02
- [x] Tái thiết kế trang `/favorites` (sidebar Tài khoản của tôi, empty state card, gợi ý catalog 4 cột, responsive desktop/tablet/mobile).
- [ ] Đồng bộ `AccountShell` cho trang Đơn của tôi (`/account/orders`) và Hồ sơ (`/account`).
- [ ] Owner nghiệm thu visual và thao tác lưu/xóa yêu thích với tài khoản thật.

- [x] Tái thiết kế trang Thông tin cá nhân (`/account`) theo ảnh mẫu (avatar, form 2 cột, dropdown năm sinh, lưu thông tin, đổi mật khẩu).

- [x] Tái thiết kế trang Đơn của tôi (`/account/orders`) theo ảnh mẫu (tabs trạng thái, thẻ đơn hàng ngang có thumbnail, badge trạng thái, chi tiết đơn, phân trang).

## Storefront Header & Hamburger Menu — 2026-11-13
- [x] Thu gọn cỡ chữ, khoảng cách và padding các mục điều hướng & tài khoản bên trong drawer hamburger `#aurel-menu`.
- [ ] Owner nghiệm thu trực quan menu hamburger trên desktop/mobile sau chỉnh kích thước.

## Ảnh sản phẩm không chữ — 14/11/2026
- [x] Rà soát toàn bộ184 ảnh của44 sản phẩm tại snapshot; sửa30 ảnh có chữ của10 sản phẩm túi, cập nhật database an toàn với agent song song.
- [x] Lưu bản gốc, ảnh mới, URL/hash/metadata, prompt và log; xác minh30 DB,184 HTTP (183 public200/1inactive404),10 PDP200 và ESLint script.
- [ ] Nghiệm thu DOM desktop/mobile/public domain; audit delta sau khi agent khác thêm/thay ảnh. Chi tiết:../LOGS/PRODUCT_IMAGE_TEXT_REPAIR_2026-11-14.md.

## Vị trí cuộn khi mở sản phẩm — 14/11/2026
- [x] Reset Lenis/native về đầu khi điều hướng mới tới PDP; giữ history/hash/same-pathquery.
- [x] ESLint/typecheck/productionbuild và7 tìnhhuống browser đạt, screenshotdesktop/mobile.
- [x] Xác minh rootbuild chung có fix, khởi động3000 sau khi port trống; live2535x1348 mởPDP tại0 từcatalog2164px.
- [ ] Nghiệm thu publicdomain/phiên đăng nhập cũ/hash trong lượt riêng nếu cần. Xem LOGS/PDP_SCROLL_FIX_2026-11-14.md.

## Tạo tài khoản thành công theo mẫu — 14/11/2026
- [x] Card thành công gọn tối đa560px trong panel bên phải, giữ editorial bên trái; logo160px/mobile132px, tiêu đề tối đa38px và nút220×46px. Responsive desktop/mobile.
- [x] Giữ email trong memory, pending/error/success/delivery unavailable, focus heading;9case QAfixture đạt, lint/typecheck/build đạt, live3000 đã cập nhật.
- [ ] Nghiệm thu signup/email inbox thật và publicdomain trong lượt riêng. Xem LOGS/REGISTRATION_SUCCESS_2026-11-14.md.
