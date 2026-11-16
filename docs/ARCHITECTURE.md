# Kiến trúc — Fashion Store

## Phân phối mã nguồn — 16/11/2026
- Git lưu application và tài liệu; video `public/videos/aurel-intelligence.mp4` dùng Git LFS. CatVTON/DM-VTON tham chiếu upstream bằng submodule; patch DM-VTON được lưu riêng tại backend.
- Không đưa env thật, uploads, DB, Python venv hoặc trọng số model vào repository. Clone source không sao chép dữ liệu vận hành và không tự triển khai website.

## Giao diện đơn hàng theo ảnh tham chiếu — 15/11/2026
- `SellerOrders` dùng CSS shared hiện có kết hợp `seller-orders-design.module.css` scoped theo root; trang báo cáo/voucher không nhận lớp thiết kế mới. Không thêm route hay dependency.
- DAL seller orders select quan hệ item → variant → product → primary image trong cùng read transaction, serialize URL đã kiểm tra sang `items[].imageUrl` (nullable/optional để tương thích client cũ). Không trả raw relation. Đây là ảnh catalog hiện tại, không phải snapshot ảnh lúc đặt hàng; tên/SKU/giá vẫn lấy snapshot OrderItem.
- Thumbnail Next Image có fallback null/onError; `/images/uploads/` dùng request trực tiếp giữ policy kiểm tra quyền hiện có. Mutation tiếp tục `sellerActor`/`shopWrite` và các guard tồn kho/thanh toán sẵn có.

## Giao diện TryOnStudio — 14/11/2026
- Hợp đồng ảnh AI: PDP truyền product.images nguyên thứ tự thumbnail vào VirtualTryOnTrigger; component chọn index4 cho preview và POST. Không dùng preferred/primary hay selection gallery. Thiếu slot5 disable trigger + thông báo; /try-on catalog cũng chỉ nhận sản phẩm có slot5. Backend vẫn xác minh URL/quyền ảnh như trước, không thêm endpoint/schema.
- Studio tại /try-on và /try-on-test giữ components/tryon/tryon-studio.module.css. Modal PDP dùng virtual-tryon-modal.module.css độc lập cho layout reference trắng/đen (đã hoàn tác palette kem/nâu) và motion riêng, giữ state/API/native dialog. Không đổi route/catalog/POST/backend.
- Motion CSS theo stage thật; overlay quét mang tính minh họa, không hiển thị tiến độ phần trăm hoặc detection giả. aria-busy/status, aria-pressed, focus upload và reduced motion được hỗ trợ.
- Native dialog PDP tối đa1680px/96dvh, topbar72px (mobile58px) và body cuộn native với data-lenis-prevent. Modeleditorial gốc có nền tuyệt đối, decorative/aria-hidden, ẩn<=1000px; nền tường/sàn CSS và topbargradientAdmin đã hoàn tác, trở lại topbar trắng/lề32px; hero và workspace responsive, controls + result2cột. Hướng dẫn/focus/fileinput/error/status giữ accessible. CSS font scope chống inheritance từ PDP; reduced motion tắt animation. Timer clear trong finally.
- Trong thời gian yêu cầu đang chạy, khóa input và lựa chọn trang phục để ảnh đầu vào/đầu ra nhất quán. Giữ server route và dữ liệu thật/fallback đã ghi nhãn.

## Mọi tài khoản được đánh giá sao — 13/11/2026
- Theo yêu cầu mới: đăng nhập là được đánh giá, không cần mua/nhận hàng. Một review/khách/sản phẩm; giữ sửa/xóa, ẩn và chống gửi nhanh. Badge/bộ lọc Đã mua hàng vẫn chỉ căn cứ đơn DELIVERED thật.
- ProductReview.orderItemId nullable; có đơn phù hợp thì liên kết, không có thì null, không tạo đơn giả. PublicProductDiscussion hiển thị mọi review APPROVED, histogram và API review cũ tính mọi review công khai. Điều kiện canRate chỉ cần tài khoản và chưa có review. Giữ Auto5sao/config của tác vụ song song, không thay trong lượt này.
- Đã áp scoped migration 20261114020000_open_account_ratings sau backup/restore/rehearsal, giữ data và sequences cũ. Manifest .local/backups/aurel_ai_reviews_restore_1794588009361_74be54.dump.verified.json. Không migrate-all hoặc fixture main.
- Đạt8tình huống: 2restore/rehearsal, 3backendPG (nonbuyer/guest/buyerbadge), 2regression APIcũ (nonbuyer/duplicate), 1UIgửi4sao. ESLint file đổi, root typecheck, prisma generate và snapshot webpack build đạt. Không fullsuite hoặc session/publicE2E thật.
- Runtime3000: .local/open-account-ratings/release, launcher .local/open-account-ratings/serve.mjs3000, envroot/.datajunction/loopback; giữ rootbuild/snapshot cũ rollback. Bản source khớp toàn bộsrc/prisma trước đổi.
- Bước tiếp: Ctrl+F5, đăng nhập, chọn sao và nhận xét để gửi. Chưa thêm đánh giá chỉ sao không có nhận xét; không thay chức năng khác.

## Bình luận & Đánh giá Premium Minimal Luxury — 13/11/2026
- Đã thay Box3 PDP bằng summary/histogram thật, composer avatar+ảnh, feed Facebook-style, filter/sort/phân trang10root, likes, reply4cấp và menu chủ nội dung/ADMIN xóa/ẩn. Gửi/sửa/xóa/like/reply cập nhật tại chỗ; sao trên giá đồng bộ theo slug. Giữ nguyên chức năng mua hàng, gallery, try-on và dữ liệu/auth cũ.
- Tính mọi review APPROVED từ tài khoản; badge mua hàng vẫn xác minh DELIVERED. Bình luận mở cho mọi tài khoản; không sao mặc định, không dữ liệu giả. Cấu hình Auto5sao của tác vụ song song còn trong Admin/store nhưng không dùng trong public summary theo yêu cầu mới này.
- Đã scoped-apply 20261114010000_product_discussion sau backup/restore/rehearsal. Thêm ProductDiscussion/Like/Image và PublicProductDiscussion view + trigger liên kết bảng cũ. Ảnh WebP BYTEA,3ảnh/4MB, quyền view/no-store; Origin/session/server authorization/Serializable/idempotent like, rate10s. Không migrate-all/seed/main fixtures.
- Kiểm tra: 6backend thật trên DB restore +2workflow ChromeUI fixture TEST và restore/rehearsal đạt; số tình huống độc lập thực tế14 (vượt10 do UI gộp thao tác, ghi rõ trong PRODUCT_DISCUSSION); lint toàn dự án, typecheck và webpack snapshot build đạt. Không fullsuite; nhánh chưa kiểm tra ghi rõ trong docs/PRODUCT_DISCUSSION.md.
- Paths: src/features/reviews/discussion-{input,types,service,http}.ts; src/app/api/product-discussion/; src/components/products/product-reviews-section.tsx và CSS; product-rating.tsx; scripts/activate-product-reviews.ts; tests/product-discussion.test.ts.
- Manifest .local/backups/aurel_ai_reviews_restore_1794584261355_cf4870.dump.verified.json. Không sửa nội dung/đơn/tài khoản cũ. Snapshot mới .local/discussion-redesign/release; vận hành/kiểm thử/giới hạn xem docs/PRODUCT_DISCUSSION.md.
- Bước tiếp: Ctrl+F5 PDP; nghiệm thu signed-cookie khách/shop thật và public/mobile trong lượt test mới. Legacy adminReply giữ text, tương tác đầy đủ dành cho reply mới; thread lớn chưa phân trang con. Root build cũ không phải release mới.

## Luồng chatbot Groq RAG — 13/11/2026
- `/api/chat` và store giữ nguyên. Kênh BOT gọi `generateGroqReply`; STAFF/handoff giữ riêng, kiểm mode sau provider; API từ chối bật BOT ở STAFF. Bật lại AI trong BOT đổi mode, từ STAFF chọn thread BOT; mở mặc định BOT hoạt động, remount drawer xóa override cũ.
- `features/chat/retrieval-plan.ts`: phân biệt nói chuyện/tìm hàng/câu tiếp nối, tạo category/gender/keywords/focus IDs và cờ showProducts. `lib/db/queries/chat-products.ts`: DAL SQL tham số hóa, active + danh mục + profile.gender + AND từ khóa, tối đa3; transaction RepeatableRead lấy ID và projection currency/ảnh có quyền/variants/profile. Không dùng tag-OR của storefront search cho RAG; storefront search không đổi.
- `chat-service.ts` tạo RAG_CONTEXT từ dữ liệu công khai có gender, fabric/fit, giá/biến thể, stock/sizes/colors. Không account/orders hoặc SQL/mutation tool cho model. `groq-bot.ts` giữ Groq Qwen instruct/cooldown, nhận context cùng tối đa10tin gần nhất; giới tính từ dữ liệu, câu ngắn/không URL/không lặp thẻ ngoài ý định mua hàng.
- Client vẫn JSON buffered; ReplyText state cục bộ theo RAF và callback hoàn tất. ChatPanel chỉ mount thẻ mới sau callback; thẻ cũ render ngay. Auto-follow chỉ khi khách ở gần đáy; log native data-lenis-prevent; dots wave có accessible label và reduced motion tĩnh. Thẻ snapshot giá/size/màu/stock từ server, checkout xác minh lại.
- Runtime3000 sau phát hành discussion chạy `.local/discussion-redesign/release` (loopback), `.data` junction về root, env root; canonical public origin/strictCSRF giữ nguyên. Root npmstart vẫn dùng rootbuild tại thời điểm đó; khi sửa source cần build/deploy cập nhật, tránh quay về snapshot cũ. Không đổi schema, public routes hoặc commerce boundaries trong tác vụ chat.
- Chi tiết và giới hạn parser: `CHATBOT_RAG_RELEVANCE_2026-11-13.md`. Không embedding/vector DB mới; intent parser chưa bao phủ mọi tên riêng/bộ lọc tự nhiên.

## Thumbnail đơn hàng và đường phục vụ ảnh — 13/11/2026
- OrdersView dùng OrderThumbnail nội bộ: upload `/images/uploads/` bypass Next optimizer, gửi request trực tiếp tới route kiểm tra quyền hiện có; ảnh static tiếp tục tối ưu qua Next Image.
- Khung48×58 giữ ổn định; URLnull hoặc onError chuyển sang placeholder có accessible label. Key theo URL reset state lỗi khi nguồn thay đổi.
- Không thêm route, thay auth/permission/cache policy, schema/index hoặc snapshot dữ liệu đơn. Đây là đồng bộ UI với pattern cart/checkout hiện có.

## Lớp UX/motion chung — 13/11/2026
- Root server layout import `motion.css` qua globals và gắn client `components/layout/motion-preferences.tsx`. Không biến toàn bộ page thành client component, không thêm route transition hoặc animation library.
- `components/ui/motion-panel.tsx` chỉ dùng trong các vùng vốn interactive: 5 popover catalog và chat drawer. CSS điều khiển frame; React giữ presence tới khi exit animations kết thúc. Closed panel inert/aria-hidden, reopen hủy cleanup cũ; không giữ timer hardcode hoặc render React mỗi frame.
- Native dialogs dùng beforetoggle + discrete CSS transitions khi browser hỗ trợ, giữ fixed trong exit; thuộc tính inert được cập nhật trước focus steps, đóng không bắt click. Dialog cuộn native với data-lenis-prevent; root khóa background scroll. WeakMap không giữ DOM của trang đã rời; cleanup tôn trọng thuộc tính do ứng dụng đặt sẵn.
- `features/catalog/catalog-href.ts` là helper URL client-safe dùng chung. Server CatalogBrowser không gọi function từ module use client; file filter UI re-export để tương thích import cũ. Không thay logic parse/filter hoặc DAL.
- Các CSS module dùng token timing/easing chung, hover movement chỉ fine pointer, keyboard focus tức thời và reduced motion toàn cục; work spinner/pulse có opt-in. Các controls editor/admin tần suất cao không thêm hiệu ứng lặp.
- Public routes, PostgreSQL schema/index, auth, payment và inventory boundaries không đổi. Chi tiết tokens/coverage: `docs/MOTION_GUIDE.md`, `LOGS/AUREL_UX_ANIMATION_2026-11-13.md`.

## Hợp đồng hiển thị và loading sau A/B — 13/11/2026
- Giữ nguyên ranh giới server/client và Suspense. `src/app/loading.tsx` dành tối thiểu 100svh để footer nằm ngoài viewport khi chờ dữ liệu; tránh CLS 0,294 đã xác định bằng PerformanceObserver.
- CollectionGrid đổi stagger 90→40ms; CSS card reveal 600→200ms. Hover zoom, layout responsive và reduced motion giữ nguyên; không eager thêm ảnh hoặc thay đổi truy vấn/giá/dữ liệu.
- Uploads vẫn qua route kiểm tra quyền hiện tại, trả WebP gốc với private/no-store. Không đưa prototype resize/cache public vào runtime; không sửa schema/index.
- Báo cáo: `LOGS/AUREL_IMAGE_AB_BENCHMARK_2026-11-13.md`. Source đã được kiểm tra trên production snapshot riêng, chưa deploy live.

## Cuộn mượt Lenis — 13/11/2026
- Áp dụng Lenis 1.3.25 giống Plant Classification tại `src/components/layout/smooth-scroll.tsx`, gắn root layout; CSS chính thức trong globals. Cấu hình duration 1.2, wheelMultiplier 0.8, smoothWheel true, autoRaf và anchor offset -80.
- Giữ cảm ứng native (syncTouch false), hỗ trợ nested scroll (allowNestedScroll true), tự cập nhật khi đổi prefers-reduced-motion và destroy/listener cleanup. CSS smooth làm fallback; html.lenis dùng auto để tránh chồng hiệu ứng.
- Không đổi routes, API, dữ liệu hay các trạng thái sản phẩm. Lint/typecheck đạt; chưa QA browser. Không build/restart để giữ phiên admin.
- Bước tiếp theo: nghiệm thu wheel, touch, chat/modal, anchor, reduced motion và điều hướng trên trình duyệt.

## Kiến trúc AI Virtual Try-On (CatVTON + Hyper-SD 8-steps · `576×768 → 768×1024` Face-Lock) (13/11/2026)
- **Tầng AI Backend (`backend/tryon-service/app.py` + `backend/cat-vton/`)**:
  - FastAPI (`127.0.0.1:8001`, không public) nạp `CatVTONPipeline` (`bfloat16`, `mix-48k-1024`) và **SCHP** (ATR + LIP, pure PyTorch) 1 lần khi startup kèm `cudnn.benchmark = True` và `_warmup()`. Hỗ trợ biến môi trường `CATVTON_ACCEL=hyper8|hyper4|none` (mặc định `hyper8` fuse trực tiếp Kohya LoRA `Hyper-SD15-8steps-lora.safetensors` qua `_fuse_kohya_lora` + `DDIMScheduler` `timestep_spacing="trailing"`, fallback an toàn sang `DPMSolverMultistepScheduler` nếu thiếu LoRA hoặc đặt `none`).
  - Tiền xử lý & Hậu xử lý Face-Lock: chạy suy luận trên `576×768` (`8` steps, `CFG=1.0`), tách `Face` theo LIP và loại nhiễu thành phần nhỏ (`_keep_main_components`), sau đó ghép trả kết quả lên ảnh gốc `768×1024` (`_composite_preserve_identity`) để 100% khuôn mặt, tóc, quần và nền không đi qua biến dạng VAE.
  - Điều phối GPU: Hàng đợi `asyncio.Semaphore(1)` giữ 100% Tensor Cores cho từng lượt không gây thrashing, còn `_run_tryon_sync` chạy qua `asyncio.to_thread` để `/health` luôn phản hồi tức thì (`~12 ms`).
- **Tầng Proxy Nội bộ (`src/app/api/try-on/route.ts`)**:
  - `GET /api/try-on` kiểm tra `/health` của dịch vụ GPU cục bộ (`offline` fallback nhãn `CatVTON`); `POST /api/try-on` kiểm tra định dạng/kích thước ảnh (`<= 10 MB`), bảo vệ path traversal/SSRF khi đọc ảnh tĩnh dưới `public/images/` hoặc đọc ảnh sản phẩm đã xuất bản `/images/uploads/<uuid>.webp` từ PostgreSQL qua `readPublishedImage(prisma, cleanPath)`, chuyển tiếp tới `TRYON_SERVICE_URL` (timeout `90s`).
- **Tầng UI Storefront (`src/components/tryon/tryon-studio.tsx`, `src/app/try-on/page.tsx`, `src/components/layout/storefront-header.tsx`, `src/components/products/virtual-tryon-modal.tsx` & `product-detail-view.tsx`)**:
  - Route chính thức `/try-on` (`TryOnStudio` dùng chung với `/try-on-test`) nạp danh mục sản phẩm thật từ PostgreSQL (`getCatalogPage`), fallback mẫu AUREL khi rỗng/lỗi DB, hỗ trợ deep-link `?garmentUrl=&garmentName=`; liên kết `Try-On AI` gắn trên `StorefrontHeader`; trang chi tiết sản phẩm hiển thị thẻ `AUREL · PHÒNG THỬ ĐỒ AI` với nút `THỬ ĐỒ ẢO · TRY IT ON` (mở modal thử đồ ngay tại PDP) và liên kết `Mở phòng thử đồ AI ↗`.

## Kiến trúc Giao diện Nhắn tin Quiet Luxury & Luồng Bot / Nhân viên (13/11/2026)
- **`/messages/connecting` (`src/app/messages/connecting/page.tsx`)**: Route chuyển hướng riêng khi click 1 lần vào icon tin nhắn trên laptop/desktop; hiển thị giao diện AUREL Private Concierge trong 2 giây rồi `router.replace("/messages")`.
- **`src/components/chat/chat-context.tsx`**: Điều phối click 1 lần (`/messages/connecting` trên desktop, `/messages` trực tiếp trên mobile) và click 2 lần (mở drawer bên phải với `preferredChannel="BOT"` để ưu tiên chat ngay với Bot).
- **Quản lý đa đoạn chat (`src/features/chat/{types,chat-store,chat-service}.ts`, `src/app/api/chat/route.ts`)**: Mỗi khách có tối thiểu 2 đoạn chat mặc định (`Nhân viên AUREL` kênh `STAFF` ghim đầu và `AUREL Concierge Bot` kênh `BOT` ngay sau), hỗ trợ tạo đoạn chat mới (`operation: "create"`), sắp xếp ghim `STAFF` lên đầu, nhóm `BOT` liền sau, trong mỗi nhóm sort mới nhất theo `updatedAt`.
- **`src/components/chat/chat.module.css` & `src/components/admin/seller-messages.module.css`**: Hệ thống style Warm Silk Editorial / Quiet Luxury đồng nhất giữa khách hàng (`/messages`, drawer) và Admin (`/admin/messages`).

## Thanh tìm kiếm & Bộ lọc rút gọn trên `/products` (13/11/2026)
- **`src/components/products/catalog-search-filter-bar.tsx`**: Client component `CatalogSearchFilterBar` thay thế cặp `SearchForm` compact + `CatalogFilterBar` cũ. Gồm ô tìm kiếm có nút submit, nút xóa `×`, hidden inputs bảo toàn bộ lọc khi tìm kiếm, cùng 5 popover dropdown (`Bộ lọc` cho Giới tính/Xóa lọc, `Danh mục`, `Màu`, `Giá` kèm preset & form nhập min/max, `Size`).
- **`src/components/products/catalog-browser.module.css`**: `.page` sử dụng nền `#fcf7f2` kết hợp inline SVG sóng lụa 2 góc (`background-attachment: fixed; background-size: cover`) đồng bộ với `.unifiedBar`.

## Kiến trúc Duyệt Danh mục & Bộ lọc Storefront trên `/products` (12/11/2026)
- **Hai chế độ hiển thị tại `src/components/products/catalog-browser.tsx`**:
  - **Explore Hero**: Chỉ kích hoạt tại `/products` trần (`!hasAnyFilter(query) && !query.invalid`), cung cấp thanh tìm kiếm thông minh và 3 nút duyệt nhanh (`/products?page=1`, `/products?gender=women`, `/products?gender=men`).
  - **Filtered Catalog View**: Kích hoạt khi có bất kỳ filter nào (`gender`, `category`, `brand`, `size`, `color`, `minPrice`, `maxPrice`, `page`, `q`) hoặc `query.invalid`. Render `CatalogFilterBar` (pills Giới tính/Danh mục dùng `buildCatalogHref` + form GET cho Size/Màu/Giá) bên trên `CatalogContent` (gọi `getSearchPage` nếu có `q`, `getCatalogPage` nếu duyệt theo filter).
- **Đồng bộ Query tầng DB (`src/lib/db/queries/products.ts`)**:
  - `findCatalogPage`: Lấy danh sách theo `catalogWhere(query)` và nạp `tags` từ `defaultProductTagStore`.
  - `findSearchPage`: Kết hợp `catalogWhere(query)` cùng smart text/tag search để hỗ trợ tìm kiếm kèm bộ lọc giới tính/danh mục/giá/màu/size.

## Kiến trúc Tag Tìm kiếm (`;`), Tách ý định câu dài & Mapping Phối đồ (12/11/2026)
- **Thẻ Tag (`src/features/products/{tag-parser,product-tags}.ts`)**: `tag-parser.ts` thuần client-safe xử lý tách chuỗi `;` và khử trùng lặp hiển thị chips trong `ProductEditor`; `product-tags.ts` lưu bền vững theo `productId` tại `.data/aurel-product-tags.json` và truy vấn ngược danh sách ID khớp từ khóa cho `findSearchPage`.
- **Trích xuất Ý định Hội thoại (`search-ranking.ts`)**: `extractSearchIntent` loại bỏ stop-words giao tiếp tiếng Việt (*hôm nay, tôi, muốn, mua...*) để giữ đúng cụm từ khóa thời trang lõi trước khi truy vấn SQL + xếp hạng.
- **Outfit Complementary Mapping (`src/features/catalog/outfit-mapping.ts`)**: Phân loại `OutfitSlot` (`TOP`, `OUTERWEAR`, `BOTTOM`, `SKIRT`, `DRESS`, `ACCESSORY`) từ danh mục/profile/tag/tên và tính điểm ưu tiên phối đồ chéo cho `productRelated` (PDP) và `findSearchRecommendations` (`/products`).

## Quy chuẩn tên sản phẩm `AUREL - TÊN SẢN PHẨM` (12/11/2026)
- `src/features/products/product-name.ts` (`formatAurelProductName`) là điểm chuẩn hóa duy nhất cho cả dữ liệu đọc ra (`mapCatalogProduct`, `dto`, `managementList`, `getCollectionPreview`, `findRealCatalogSuggestions`) lẫn dữ liệu ghi vào (`validateEditor`), đảm bảo mọi tên đều mang dạng `AUREL - TÊN SẢN PHẨM`, in hoa và không chứa chữ số.

## Lịch sử Messenger UI 3 cột & Bot 1 lần (đã thay bằng BOT liên tục + RAG ngày 13/11/2026)
- **Vòng đời hội thoại (`src/features/chat/chat-service.ts` & `chat-store.ts`)**:
  - Khởi tạo (`hasStarted: false`, `botReplyCount: 0`) $\rightarrow$ Người dùng bấm **"Bắt đầu cuộc hội thoại"** (`startConversation`) để Bot chào mở đầu $\rightarrow$ Khách gửi tin đầu tiên $\rightarrow$ Bot trả lời tự động 1 lần (`botReplyCount = 1`, `mode = "WAITING_STAFF"`) $\rightarrow$ Từ tin thứ 2 trở đi hoàn toàn là nhân viên xử lý trên `/admin/messages`.
- **Giao diện Messenger Dark (`chat.module.css`, `messages-page-view.tsx`, `seller-messages.tsx`)**:
  - Desktop 3 cột: `messengerRail` (icon điều hướng dọc) + `messengerSidebar` (tiêu đề `"Đoạn chat"`, tìm kiếm `"Tìm kiếm trên Messenger"`, danh sách avatar chấm xanh) + `messengerMain` (`ChatPanel` với thanh nhập `Aa` và nút 👍 / Gửi). Mobile `< 768px` hiển thị toàn màn hình khung chat chính.

## Kiến trúc Nhắn tin 2 chiều & Bot Chăm sóc Khách hàng AUREL — 12/11/2026
- **Tầng Trình bày & Tương tác toàn cục (`src/components/chat/`)**:
  - `ChatProvider` (`chat-context.tsx`) bọc toàn ứng dụng trong `src/app/layout.tsx`, xử lý phân nhánh theo viewport (`max-width: 767px` đi thẳng `/messages`; desktop phân tách click đơn $\rightarrow$ màn hình loading 2000ms kèm gợi ý thao tác, và double-click $\rightarrow$ `aside.drawer` neo góc phải vừa vặn laptop).
  - `ChatPanel` (`chat-panel.tsx`) dùng chung cho cả hộp thoại bên phải và trang `/messages`, hỗ trợ live-polling 3.5 giây, quick replies, thẻ sản phẩm gợi ý có link thật và nút chuyển chế độ Bot $\leftrightarrow$ Nhân viên.
- **Tầng Nghiệp vụ & Dữ liệu (`src/features/chat/`)**:
  - `chat-store.ts`: Lưu trữ phiên hội thoại atomic JSON tại `.data/aurel-chat-sessions.json` kèm hàng đợi tuần tự (write lock), khử ký tự điều khiển và giới hạn tin nhắn.
  - `care-bot.ts`: Phân tích ý định tiếng Việt/Anh, truy vấn sản phẩm thật qua `findRealCatalogSuggestions` và fallback an toàn khi DB offline.
  - `chat-service.ts`: Điều phối luồng Khách hàng (session hoặc cookie `aurel_chat_guest`) qua `/api/chat` và luồng Quản trị (bảo vệ `sellerActor()`) qua `/api/admin/messages` và trang `/admin/messages`.

## Kiến trúc Tìm kiếm Thông minh & Chuẩn hóa Thương hiệu AUREL — 10/11/2026
- **Module chuẩn hóa tên sản phẩm (`src/features/products/product-name.ts`)**:
  - Cung cấp hàm `formatAurelProductName(rawName: unknown): string` kiểm soát chặt chẽ quy chuẩn thương hiệu: mọi tên sản phẩm hiển thị ra giao diện người dùng và lưu trữ dữ liệu đều bắt đầu bằng `"AUREL "`.
  - Cơ chế idempotent loại bỏ khả năng lặp tiền tố (`AUREL AUREL...`), tự động chuyển "aurel " thành chữ hoa "AUREL " và nén khoảng trắng.
- **Engine Tìm kiếm Thông minh Đa Tầng (`src/features/catalog/search-ranking.ts`)**:
  - Gồm 4 lớp kiến trúc xử lý:
    1. *Normalization & Tokenization Layer*: Khử dấu tiếng Việt chuẩn NFD (`normalizeSearchText`), loại bỏ ký tự phân cách, tách mảng từ khóa đơn (`tokenizeSearchQuery`) và lọc stop words tiếng Việt/Anh.
    2. *Fashion Domain Lexicon Layer*: Cụm từ điển đồng nghĩa chuyên ngành thời trang (`FASHION_SYNONYM_GROUPS`) ánh xạ 2 chiều giữa tiếng Việt và tiếng Anh cho các nhóm sản phẩm (áo khoác, áo len, sơ mi, quần, túi, khăn, hoodie) và các gam màu thời trang cao cấp (nâu, camel, caramel, đen, trắng, kem, be, xanh navy).
    3. *Multi-field Weighted Scoring Model*: Hàm `calculateRelevanceScore` tính điểm tổng hợp dựa trên độ tương đồng của Tiêu đề (exact, prefix, token permutation), Mã SKU, Tên danh mục, Thuộc tính biến thể (Màu sắc, Kích cỡ) và Mô tả chi tiết.
    4. *Ranking & Sorting Layer*: Sắp xếp ổn định (`rankCatalogProducts`) định vị sản phẩm khớp chính xác nhất lên vị trí Top 1 ngay khi nhấn Enter.
- **Tích hợp Tầng Dữ liệu (`src/lib/db/queries/products.ts`)**:
  - `findSearchPage` mở rộng mệnh đề SQL sang đa từ khóa kết hợp từ đồng nghĩa; re-ranking deterministic trên trang hiện tại đảm bảo kết quả chính xác, ổn định và an toàn trước các trường hợp người dùng gõ đảo từ hoặc tìm kiếm song ngữ.

## Tối ưu hóa Media & Banner Card Texture — 10/11/2026
- Texture Card: Nền card `/images/aurel/admin-card-bg.webp` (16.9KB) được nạp thông qua CSS module scoped, tạo chiều sâu thị giác phong cách Quiet Luxury.
- Tối ưu tải trang: 16 ảnh PNG chất lượng cao được nén tối ưu nén tại chỗ (lossless/near-lossless via Sharp), giảm tải từ 32.9MB xuống 7.8MB mà không cần thay đổi bất kỳ URL hay import nào trong source code.

## Dark Chocolate Admin Sidebar Architecture — 10/11/2026
- Sidebar Component: `src/components/admin/product-sidebar.tsx` render Client Component bên trong `ProductAdminFrame`.
- Màu sắc & phong cách: Nền Dark Chocolate / Deep Espresso (`#241812`), text `#c8bbb0`, active state màu be sáng (`#ebdcd0`) với chữ và icon nâu đậm (`#241812`).
- Cấu trúc Menu:
  - Header: Monogram A và brand name AUREL màu trắng ở đỉnh.
  - 9 Navigation Links: Tổng quan (`/admin/products`), Đơn hàng (`/admin/orders` có badge `12`), Sản phẩm (`/admin/products`), Danh mục (`/admin/products`), Kho hàng (`/admin/orders/reports`), Khuyến mãi (`/admin/vouchers`), Khách hàng (`/admin/orders`), Báo cáo (`/admin/orders/reports`), Cài đặt (`/admin/products`).
  - Footer Promo Card: Card bo góc 14px với thông điệp "Quản trị bán hàng hiệu quả hơn" và nút pill "Xem báo cáo →" dẫn đến `/admin/orders/reports`.
- Loại bỏ các khối cũ không còn phù hợp: Link Nhập / xuất CSV, khối danh sách bộ sưu tập và chi tiết tra cứu danh mục được loại bỏ để tập trung chức năng vào Table Filter Bar.

## AUREL Product Dashboard Architecture — 09/11/2026
- Route: `/admin/products/page.tsx` (Server Component, force-dynamic).
- Data boundaries:
  - `managementList`: Query bảng sản phẩm phân trang, tìm kiếm theo tên hoặc SKU, lọc theo danh mục, trạng thái hoặc bộ sưu tập.
  - `managementDashboard`: Tổng hợp số liệu KPI và biểu đồ (`all`, `active`, `archived`, `lowStockVariants`, `categories`, `created` theo ngày) trên toàn bộ database, độc lập với bộ lọc của bảng.
  - `managementRowExtras`: Nạp thumbnail ảnh đại diện và tổng số lượng tồn kho của các biến thể cho 25 sản phẩm trên trang hiện tại.
- Components & Presentation:
  - `ProductExplorer` quản lý bố cục và phân tách các component con: `ProductDashboardHeader`, `ProductKPIOverview`, `ProductChartsArea`, `ProductFilterBar`, `ProductTable`.
  - Charting sử dụng SVG native, pure CSS module (`product-dashboard.module.css`), không cần thư viện bên ngoài, đáp ứng đầy đủ tooltip và responsiveness.
  - Xóa sản phẩm: Sử dụng nguyên vẹn `ProductDeleteControl` với quy trình nhập mã SKU xác nhận, kiểm tra ràng buộc trước khi xóa Serializable.

## payOS thật và sản phẩm thử 1.000đ — 02/11/2026
- Đã backup/restore kiểm chứng và áp riêng `20261102150000_payos_payments` trên DB local; ba bảng thanh toán sẵn sàng, dữ liệu/schema cũ giữ nguyên. Không deploy các migration pending khác.
- Đã bật `PAYOS_ENABLED=true` trong environment local, đăng ký webhook HTTPS thành công và restart production Next. Product ID63/variant120, giá 1.000 VND, stock1: `test-thanh-toan-payos-1-000d-khong-giao-hang-moi-do-tuoi`; ghi rõ TEST kỹ thuật, không giao hàng.
- Credentials được provider chấp nhận (GET mã không tồn tại trả101); retry nhận diện chính xác lỗi này và giữ mã đã lưu. CheckoutView hiện tại đã có chọn PAYOS/QR và scope Buy Now, được giữ nguyên.
- Lint/typecheck/build đạt; một regression code101 đạt. Local/public PDP200 đúng giá; chưa tạo payment link, chưa chuyển tiền, chưa xác minh PAID thật. Owner đăng nhập, Buy Now, chọn payOS và tự xác nhận 1.000đ trong ứng dụng ngân hàng; sau đó kiểm `/admin/orders`.
- Chi tiết và backup: `LOGS/PAYOS_LIVE_1000_TEST.md`.

## Product search read model — 02/11/2026
- `/products` là search-first Server Component: chưa có `q` chỉ render Explore; có `q` gọi `getSearchPage` → `findSearchPage`. URL query/page là state canonical, không có catalog client-side hoặc search API song song.
- PostgreSQL `translate(lower(...))` chuẩn hóa dấu Việt không cần extension/migration; rank exact name, prefix, partial, category/brand, profile/variant rồi description. Count, ranked IDs và hydrate DTO chạy tuần tự trong RepeatableRead.
- Profile dùng `row_to_json(pp)::text` để tương thích schema đang deploy và tự gồm dynamic attributes khi migration tồn tại. DTO vẫn qua image-rights/price mapper chung.
- No-result bounded tối đa 8 Product active mới nhất vì chưa có featured/best-seller signal đáng tin cậy; catalog rỗng/lỗi hiển thị thông điệp thay vì hàng giả.

## Seller Portal UI thống nhất — 02/11/2026
- `components/admin/seller-portal-nav.tsx` cung cấp `SellerPortalNav` và `SellerPortalIcon` dùng chung cho `/admin/orders`, `/admin/orders/reports` và `/admin/vouchers`; toàn bộ style scoped trong `components/admin/seller-orders.module.css`.
- `/admin/orders/reports` dùng Client Component `SellerReports` (`components/admin/seller-reports.tsx`) thay vì `ShopPage view="admin"`, vẫn gọi `GET/POST /api/shop?view=admin` và giữ nguyên kiểm tra quyền `shopActor()` phía server.
- `StorefrontHeader` render `AdminHeader` cho mọi route `/admin` và `/admin/*` (ngoại trừ `/admin/products/[id]/preview`), đồng bộ khung quản trị giữa quản lý sản phẩm, đơn hàng, báo cáo tồn kho và voucher.

## PostgreSQL pool và concurrency — 02/11/2026
- `lib/db/client.ts` tạo một `PrismaPg` pool dùng chung, `max:5`, timeout hiện hữu và `pipeline:true`. Pipeline cho phép Prisma query interpreter gửi các node relation đồng thời trên client transaction theo contract của `pg@8.23.1`; pool vẫn phân phối các Prisma call độc lập lên nhiều connection.
- Interactive transaction là boundary một connection/snapshot. Code ứng dụng không `Promise.all` các lệnh `tx.*`: seller counts và image library count/list chạy tuần tự. Query độc lập ngoài transaction tiếp tục được parallelize, nên không biến fix thành serialization toàn ứng dụng.
- Checkout/order/payment vẫn dùng Serializable/RepeatableRead, row locks, retry sau rollback và network ngoài transaction như trước. Không đổi schema, migration, isolation, payment state machine hoặc inventory semantics.

## Checkout scope cho Buy Now — 02/11/2026
- Checkout có hai scope tường minh: cart mặc định và buy-now theo một `ProductVariant.id`. PDP chỉ điều hướng với ID biến thể; không ghi CartItem khi nhấn `BUY NOW`.
- `GET /api/shop?view=buy-now&variantId=...` trả projection của đúng biến thể để render. Các mutation `voucher-quote` và `checkout` nhận `buyNowVariantId`, nhưng luôn tải lại variant/giá/tồn kho server-side trước khi tính tiền hoặc tạo đơn.
- Cart checkout tiếp tục snapshot và xóa toàn bộ giỏ sau commit. Buy-now snapshot tạo đúng một line quantity 1, không có `cartId`, vì vậy không thay đổi giỏ hiện hữu. Idempotency key được namespace theo scope để một yêu cầu cũ không ánh xạ sang đơn ở scope khác.

## Seller order projection — 02/11/2026
- `features/orders/seller-order-rules.ts` giữ query/DTO/action hints thuần; `seller-orders.ts` ADMIN guard, Prisma filter/count/pagination20đơn RepeatableRead và delegate mutation sang shopWrite. Seller là role ADMIN hiện có cho một cửa hàng, không thêm role/tenant/order table.
- `/admin/orders` server gate + client SellerOrders; `/api/admin/orders` GET list/group và POST status, Node runtime/no-store. READY gồm COD tracked hoặc payOS paidAt/non-reconciliation với status chưa hoàn tất; WAITING/REVIEW/ALL có query riêng trước paging. Capability false không join payment tables, giữ dashboard đơn cũ khi migration payOS pending.
- Webhook không cần side effect ghi bản sao seller order: verified payment commit vào Order relation hiện hữu là nguồn read model. Poll20s/refresh đọc DB, pause hidden/abort on navigation, bỏ stale response bằng request epoch. Customer/Admin dùng cùng Order status; chuyển fulfillment không giảm stock lần nữa.
- Mutation giữ Origin/role/expected status/Serializable row lock/payment gates. Tracked OnlinePayment được cập nhật dù không có DEMO prefix; legacy COD chưa biết reservation vẫn chặn. Existing report/stock view giữ ở `/admin/orders/reports`, print vẫn `/admin/orders/[id]/print`.

## Toolchain security — 02/11/2026
- Next.js/eslint-config-next16.4.3 đồng bộ, ESLint9.39.5 giữ nguyên. Pin minimatch11.0.3 qua devDependency + npm override `$minimatch` để mọi consumer lint dùng cùng engine đã vá.
- `eslint.config.mjs` import `scripts/lint-minimatch-compat.mjs` trước plugin: cached CommonJS export thành callable upstream/named helpers. makeRe().test() được thực hiện bằng nonrecursive matcher vì11đã bỏ regex API. Chỉ lint process nhận adapter; application/API/payment boundaries không đổi.
- Tests compatibility giữ rule Next/React/a11y/import hoạt động và generated-file ignores. Trade-off/removal criteria tại ADR038 và DEPENDENCY_SECURITY.md; audit full/production0, tree hợp lệ.

## Boundary thanh toán payOS — 02/11/2026

- `features/payments/rules.ts` giữ pure validation/types/labels; `provider.ts` server-only khởi tạo lazy SDK2.0.5; `service.ts` giữ attempt, QR local, signed webhook/GET reconciliation; `http.ts` giữ JSON16KiB/CSRF/no-store/error sanitization. Không import provider/credentials vào Client Component.
- `/api/payos/create` và POST `/api/payos/status` yêu cầu Origin/session/ownership; GET status chỉ đọc DB của chủ đơn. `/api/payos/webhook` public POST, không session/Origin nhưng bắt buộc verify SDK; Node runtime. `/checkout/success|cancel` kiểm session/ownership, frontend không quyết định đã thu tiền từ query string.
- Checkout tái sử dụng transaction stock/voucher/cart/idempotency cũ, thêm OnlinePayment1:1 chỉ khi chọn PAYOS. PaymentAttempt lưu safe numeric code riêng/high namespace, expected integer VND, QR/link/expiry/lease; partial unique active attempt. PaymentReceipt giữ reference unique/amount nhận, không lưu counterparty bank/customer payload. Bảng mới có migration riêng chưa apply; capability query giúp COD cũ đọc/checkout trên schema chưa deploy.
- Row lock Order và Serializable/CAS bảo vệ create/reconcile/cancel/webhook; network luôn ngoài transaction, lease30giây + signed GET trước retry uncertain create. Đơn cần reconciliation/không PAID chặn fulfill; thanh toán không tự giảm kho hay tự giao hàng.
- PayosPayment trong checkout dùng QR render local từ payload SDK, hosted allowlist, copy/countdown/retry; GET polling5–15giây pause hidden/unmount/terminal, POST reconcile khoảng60giây với server throttle30giây. Lịch sử Customer/Admin có method/status/paidAt/references/receipts.
- Hủy/hết hạn payment session giữ reservation để retry; chỉ workflow hủy đơn mới hoàn kho/voucher. Tiền sau hủy/expiry hoặc sai số tiền giữ financial receipt/cờ cần đối soát. Chưa refund/cron auto-release/clear-flag UI. PAYOS_ENABLED chỉ gate tạo mới, không tắt nhận webhook của link cũ. Xem `docs/PAYOS_SETUP.md` và `LOGS/PAYOS_CHECKOUT_INTEGRATION.md`.

## Public ingress qua Cloudflare Tunnel — 02/11/2026

- Production self-hosted dùng named Cloudflare Tunnel: `cloudflared` outbound tới Cloudflare, còn Next.js chỉ lắng nghe `127.0.0.1:3000`. `start-aureluxury.cmd` build/runs app và gọi connector bằng `CLOUDFLARE_TUNNEL_TOKEN` chỉ có trong environment cục bộ.
- Origin công khai canonical là `https://aureluxury.store`; `BETTER_AUTH_URL` phải khớp chính xác để Better Auth giữ origin/CSRF/cookie đúng. Không đưa token tunnel, database URL hay Better Auth secret vào repository.
- Không có Nginx trong boundary hiện tại. Nếu chọn Nginx/reverse proxy sau này, cần approval owner và một quyết định deployment riêng vì thay đổi ingress/TLS/logging.

## Thuộc tính động ProductProfile — 02/11/2026

- `features/products/dynamic-attributes.ts` là nguồn cấu hình duy nhất cho các key machine-readable, nhãn tiếng Việt, options controlled và điều kiện hiển thị theo `Profile.garmentType`.
- `ProductProfile.dynamicAttributes` là JSONB object chỉ lưu thông số riêng đã được server-side validate. Các trường profile hiện hữu và variants vẫn là nguồn duy nhất cho metadata chung, màu sắc và kích cỡ.
- `ProductEditor` là client boundary cho tương tác; API admin tiếp tục đi qua `management.persist`, tại đó `dynamicAttributes()` khước từ key không thuộc loại trang phục đã chọn.
- Vì migration JSONB chưa được apply trên main, `management.persist` capability-check cột: schema mới dùng Prisma upsert; schema cũ dùng INSERT ... ON CONFLICT tham số hóa với cột tường minh vì Prisma vẫn thêm default vào INSERT dù bỏ khỏi data/select; select profile chỉ chứa cột đã deploy, còn JSONB được đọc bằng query riêng khi capability có thật. Nhờ đó luồng tạo/sửa cũ không biến lỗi schema thành 503. Khi capability chưa có, API giữ profile dynamic rỗng và không lưu các thông số riêng; không tự chạy migration hay giả báo đã lưu.

## AUREL Product listing redesign — 02/11/2026
- `/products/page.tsx` chỉ đặt page shell. `CatalogBrowser` vẫn là Server Component đọc filter option và `getCatalogPage`; CSS module mới giữ toàn bộ layout filter/card scoped, không thay reader/API/schema.
- `CatalogContent` có opt-in `premium` để `/products` nhận card mới nhưng các consumer collection cũ không bị đổi presentation. `CatalogProductActions` là Client Component nhỏ: gọi action `favorite` có sẵn hoặc link tới PDP cho bag; không tự chọn variant hoặc tự ghi cart.
- `/products` là entry point duy nhất cho storefront catalog/search; form/link search gửi query tới route này. `/search` là Server Component redirect compatibility-only, chuyển nguyên query sang `/products` và không còn render catalog riêng.

## Home editorial composition — 02/11/2026
- Home render `EditorialDiscovery` và `AurelEdit`; section `AurelJournal`/anchor `#journal` đã được bỏ. Bài viết Modern Minimalist là card lead riêng trong AUREL Edit; CTA mới là presentation-only cho tới khi có route bài viết thật.

## AUREL global footer — 02/11/2026
- Root `Footer` client dùng `EditorialFooter` bốn cột cho mọi route không thuộc `/admin/*`; all admin paths return `null`. Không còn nhánh footer riêng cho home, auth hay storefront thường.
- `EditorialFooter` giữ AUREL statement và Explore/Customer Care/Follow theo ảnh owner xác nhận, nhưng không render giant wordmark, divider hay bottom metadata. CSS `.site-footer` cũ không còn consumer runtime.

## Public product showroom — 01/11/2026
- Public `/products/[slug]` và Admin Preview tiếp tục dùng chung ProductDetailView/EditorialGallery/CSS. Module mới `components/products/product-purchase.tsx` chịu trách nhiệm tương tác mua của PDP, thay component PurchaseButtons giản lược trong shop-client; không kéo UI toàn bộ cart/order/voucher vào bundle PDP qua import đó.
- ProductPurchase chỉ gọi `/api/shop` actions cart/favorite hiện hữu, buy chuyển `/checkout` sau add thành công; API/server guards và voucher checkout giữ nguyên. Public nhận optional query variant, chỉ resolve qua DTO variant thật; login-next giữ lựa chọn, không tự thực hiện mutation khi login.
- Collection/catalog image links vào PDP; preview toolbar mở public theo row.slug khi active. Shared PDP/preview không còn render CompleteLook theo yêu cầu owner; reader/API/queue hiện vẫn được giữ để không xóa dữ liệu. Related trống có link khám phá category, không giả lập AI.
- Không route/schema/data mutation mới phía server; controls editor/DEMO vẫn chỉ preview. Theo user không test/check/build/browser trong tác vụ; chi tiết PUBLIC_PRODUCT_SHOWROOM.md. Các mô tả lịch sử hide-empty hoặc purchase-disabled bên dưới cần đọc theo mốc trước cập nhật này.

## AUREL Account interface redesign — 01/11/2026
- `components/auth/account-control.tsx` vẫn là Client Component duy nhất cho session/logout trong dialog header, nhưng tách presentation full editorial và compact menu. `AccountPanel` dùng Better Auth `useSession`; email/verification không được copy sang nguồn tĩnh.
- GET `/api/shop?view=account` trả `{ isAdmin }` sau `shopActor()` đọc session và role DB. Đây chỉ là context hiển thị để tránh lộ link admin cho CUSTOMER; `/admin/*`, shop service và mutation vẫn tự kiểm role server-side. Không thêm role vào Better Auth client session, không đổi schema hay auth boundary.
- CSS account nằm scoped trong `components/auth/auth.module.css`; `homepage-header.module.css` chỉ chịu trách nhiệm kích thước/backdrop dialog header. Asset still-life local đi qua `next/image`, decorative `alt=""`, và bị ẩn dưới 700px.

## T02 Voucher — 01/11/2026 (bổ sung commerce demo)
- `features/vouchers/rules.ts` tính BigInt/floor VND và validate; `service.ts` quản lý/lượt dùng bằng Prisma transaction. Shop service gọi module này; `/api/shop` GET view vouchers (ADMIN), POST voucher-save (ADMIN), voucher-quote (khách session). UI mới `/admin/vouchers`; CheckoutVoucher client nhận quote server, gửi code+expectedTotal khi chốt. Origin/session guards giữ nguyên.
- Voucher có immutable code, fixed/percent, dates/min/trần/limits/active/version. VoucherRedemption unique orderId, code/discount snapshot, releasedAt lưu lịch sử hoàn lượt. FK user/order/voucher RESTRICT. Không seed dữ liệu marketing tự động.
- Order thêm subtotalAmount nullable cho legacy, discountAmount default0, voucherCode; tổng lineTotal là gross, totalAmount là net. Hai checker functions/deferred constraints mở rộng sum(lines)-discount=total và subtotal nếu có bằngsum(lines); unitPrice×quantity invariants giữ nguyên. Main/test đã áp riêng20261101170000_checkout_vouchers.
- Checkout khóa user→voucher, kiểm limits và ghi version thật để invalidate stale Serializable snapshot, rồi stock/order/redemption/clear cart atomic. Replay trả order trước khi quote. Cancel đọc redemption/khóa và ghi voucher trước stock, releasedAt cùng status/restock. ADMIN CAS version buộc reload khi có sử dụng/cancel/sửa khác.
- Scope1 mã/đơn, VND/ship0, toàn bộ tiền hàng. Preview không giữ chỗ; backend reject expectedTotal khác quote tại commit. Chưa business tests theo user; thông tin migration/restore/giới hạn tại VOUCHERS.md. Phần Commerce demo bên dưới mô tả nền tảng trước T02; câu không migration chỉ áp giai đoạn đó.

## Commerce demo — 01/11/2026 (ưu tiên hơn mô tả phase lịch sử)
- `features/shop/rules.ts` giữ validation/lifecycle thuần; `features/shop/service.ts` dùng Prisma/auth session/money có sẵn. `/api/shop` GET views cart/profile/favorites/orders/admin, POST actions cart/checkout/status/profile/favorite; origin/session/ownership/ADMIN ở server, JSON bounded, no-store/error không lộ DB.
- Cart/CartItem/Order/OrderItem/UserAddress/Favorite tái sử dụng schema hiện tại; không migration. Checkout Serializable, lock user, lấy giá VND/product active/stock tại server, conditional decrement, snapshot/header/items/cart clear atomic; retry P2034 tối đa 2 lần sau rollback. Mã `DEMO-userId-UUIDv4` là idempotency key namespace theo khách, tồn tại thì trả cùng đơn trước khi đọc giỏ. Không gọi payment/email bên trong transaction.
- Status chỉ đi theo state machine; recheck ADMIN trong transaction, CUSTOMER chỉ hủy PENDING của mình; cancellation hoàn kho cùng transaction, serializable conflict chống hoàn hai lần. Chỉ áp dụng đơn prefix DEMO- do luồng này tạo, không suy diễn legacy đã trừ kho.
- Server ShopPage gate session; ShopClient là phần tương tác. Routes mới `/checkout`, `/account`, `/account/orders`, `/favorites`, `/admin/orders`, `/admin/orders/[id]/print`; cart public trước đây chuyển thành giỏ cần đăng nhập. Phiếu in xác thực ADMIN trước query đơn, notFound có thể stream shell200 nhưng không lộ nội dung.
- CatalogBrowser server đọc options DB/datalist và getCatalogPage12; CatalogQuery nhận range VND/color/size/brand + category slug có validation, Prisma cùng `variants.some` để các tiêu chí match cùng một biến thể. Listing có ảnh/giá và empty/error state.
- Root layout chuyển Google Fonts sang CSS font hệ thống để build offline. Canonical redirects mở rộng account/cart/checkout/favorites/products; không nới CSRF/trustedOrigins. UI mới dùng CSS scoped shop-* trong globals.
- Reports đọc 30 ngày đơn VND, doanh thu quy ước DELIVERED, top theo tên snapshot; không payment reconciliation/returns. Order lists giới hạn100, low-stock≤5 tối đa100, chưa realtime push. Chi tiết tại DEMO_IMPLEMENTATION_2026-11-01.md.

## Canonical origin cho t?i kho?n local ? 2026-10-26
- next.config.ts redirects ch? nh?n host127.0.0.1 khi BETTER_AUTH_URL c? hostname localhost; chuy?n307 login/register/forgot-password/reset-password/verify-email/admin t?i origin c?u h?nh, gi? query. Kh?ng th?m proxy/middleware ho?c m? r?ng trustedOrigins. API v?n t? ch?i origin kh?ng h?p l?; production domain kh?clocalhost kh?ng b? ?nh h??ng.


## Variant option dialog — 2026-10-23
- `VariantOptionDialog` giữ client state và callback hiện có; modal màu Demo rộng tối đa560px, dùng Be Vietnam Pro được khai báo bằng next/font, preview màu/HEX chỉ phản ánh input hiện tại. CSS scoped trong `product-detail.module.css` có breakpoint mobile; luồng lưu variant không đổi.
- Modal size dùng cùng dialog/font, preset apparel XXS–XXXL multi-select và trường custom phân cách dấu phẩy; `sortSizeOptions` xếp apparel, size số rồi custom ổn định trước khi render PDP. Mọi variant demo vẫn local-only.

> Bố cục hiện tại (2026-10-23, theo hình số2): cột giới thiệu min140px/22%, gap20px; rail dùng hết phần còn lại, bốn thẻ đều nhau với gap12px (min120px), không cap width cố định theo viewport height. Ảnh/ô thêm12:13, cover căn giữa phía trên để phủ kín khung thay các dải trống của contain; chiều cao tự theo tỷ lệ, không ép height rồi giãn ngang. Heading36px, mô tả13px, CTA140×34px; tên/giá11px, dấu+26px bên phải metadata. Tablet<=900 ba ô, mobile44%/thẻ; dữ liệu món thứ5+ vẫn cuộn được. Scrollbar ẩn, controls Admin nhẹ và success message không tạo footer, lỗi vẫn hiển thị. Gallery63vh và panel3:2:3/API/DB/autosave không đổi. Visual QA: Pending Manual Review.
> Deployment 2026-10-23: Main aurel_ai: 9 reviewed migrations applied with owner approval; test: 11. PendingProduct is available; the two taxonomy migrations remain pending. No existing product data, sequences or .env changed.
## Complete the Look / pending intake (2026-10-23)
- Cập nhật 2026-10-23 — Complete the Look sửa trực tiếp và tự lưu: bấm/thả một ảnh vào khung12:13 cover/center, bỏ ảnh tại góc; bấm tên/giá để sửa, blur/Enter tự lưu, Escape hủy phần chữ đang sửa. Hàng đợi từng thẻ giữ version tuần tự, lỗi giữ dữ liệu/tệp và chờ retry tường minh. Thẻ mới nhận focus; hoàn thiện chỉ bật khi đủ ảnh/tên/giá đã lưu. Nền kéo sát mép trái bằng pseudo-element, chữ căn lề gallery, mép phải giữ nguyên. Gallery thay hàng nút lớn bằng menu thumbnail nhỏ Xóa/Đưa lên trước/Đưa về sau, giữ kéo sắp xếp và hỗ trợ thả tệp vào các slot. Không migration/main write; gallery65vh/panels37,5/25/37,5/navbar/publish giữ nguyên. Visual QA: Pending Manual Review.
- PendingProducttáchminimalintake khỏiProductmandatorycategory/variants, convertatomic dùngpersistcũ; relation source→convertedProduct vàassetFKrelease. /api/admin/look + /admin/products/pending(/id) protected; public/APIlookmanualpublishedonly. CompleteLookclient rail20/trang, PendingLookCard inline autosave + PendingAutosave serial writer; ProductEditorsupportpendingseed/convert, khôngduplicatewizard.
- ProductRelatedkhôngcòncategoryheuristic/slice4: look đọcmanualrelation, similar[] chờAI. Capabilityguard oldmaingraceful; assetcleanupđếm2reference types. Migration additive main9 đã apply; xem COMPLETE_THE_LOOK.md.

## Product Showroom — shared preview/production (2026-10-22)
- Shared informationBody là vùng cuộn native desktop>=901,65dvh bằng gallery, tab-focus/label. Related tương ứng ngoài region; information khôngsticky, <=900 natural flow. Không thêm route/clientstate/API/DB; xem PRODUCT_SHOWROOM.md vàADR029.
- ProductDetailView compose ProductRating(optional ProductDetail.rating UI DTO, chưa có data source review), ProductServiceBenefits(config null-by-default, read-only presentation). Không schema/endpoint hoặc review/policy persistence; Admin status warnings tách khỏi customer panel. Branch Preview chỉ thêm placeholders có nhãn.
- Rating hiện theo Refinement03: reusable ProductRating nhận actual average/count; Preview missing-data mẫu5 sao/1 review có nhãn DEMO, Production không có review thật thìẩn. Không thêm review DB/aggregate giả.
- ProductEditor Step1 data-only, operation prepare idempotent tạo/update unpublished draft → /admin/products/[id]/preview. ProductDraftRequest key/actor/product unique/cascade đã deploy main theo approval riêng, capability-check trước main read; không nhét workflow state vào auth hoặc public slug. Exact code/SKU/slug/taxonomy/CSV validators reuse persist.
- ProductShowroom client quản lý row/version/busy/status/publish; backend managementGallery atomically insert ImageAsset+ProductImage/replace/assign/role/primary/remove/reorder và cleanup only-last-reference. Raw route /api/admin/products/[id]/gallery origin/session/role/version trước body/decode, cache invalidation sau commit. Published media edits chặn tới khi explicit draft.
- ProductDetailView + EditorialGallery là một UI/DTO, public route active-only và preview route ADMIN gate riêng. gallery.ts maps role vào imageType cũ; showroom-model normalize admin data, public query bổ sung role/profile. Related sections từ real active catalog, optional hide. Production loại upload/editor UI; native zoom/shared color-size helpers, preview purchases inert. AdminFrame dùng wrapper riêng tránh CSS .shell button thay đổi PDP, storefront navbar reused ở preview.
- Finalize validate variants/prices/public cover/asset, explicit publish selection+confirmation, không cart/checkout implementation. Main8/test10: migration ProductDraftRequest đã được duyệt và áp dụng riêng; report PRODUCT_SHOWROOM.md. Node SSR/static/build không thay visual browser QA.


## Shared storefront navigation (2026-10-22)
- Đã sửa giá storefront: base currency VND lấy từ ProductPrice được gắn currency rõ ràng, độc lập MULTI_CURRENCY_ENABLED; flag chỉ bật lựa chọnUSD/EUR, không tự FX/backfill/đọc legacy amount thànhVND. Public PDP/catalog/paging/related và Showroom dùng cùng defaultVND, selector nếu bật mặc địnhVND. Main read-only loader verify ID1 real product “[AUREL COLLECTION] Limited Edition Coat” có3 active variants đềuVND999000, catalog/PDP trả999000. Không đổi DB/env/flag.
- Root layout next/font/google tải Cormorant Garamond/DM Sans qua CSS variables trên html; chỉ scoped navbar/PDP opt-in. Admin body/form font không đổi. PDP và preview dùng cùng typography; DM Sans thiếu Việt fallback sang Cormorant, xem DESIGN_SYSTEM.md.
- StorefrontHeader giữ nhánh auth/admin riêng, các storefront routes khác dùng cùng nav mới (không còn render fallback Header cũ). Home effect giữ hero/hidden/sticky và đồng bộ drawer data-mode: hero dùng nav cũ/transparent, sticky dùng nav Women…AI; page routes dùng nav mới sticky trong flow; native dialogs/account reuse. Search GET và static links, heart disabled do wishlist chưa triển khai.
- CatalogQuery thêm optional gender women|men, parse reject repeated/unknown; catalogWhere profile.is.gender.in selected/unisex kết hợp category/q/isActive. Accessories là category allowed mới; không thêm schema hoặc inference. Hai anchors collection/intelligence có thật, AI Recommendations là navigation tới showcase, không recommendation endpoint.

## Tìm ảnh theo tên và editor gọn (2026-10-22)
- /api/admin/images GET thêm q (200 chars, bounded controls); imageLibrary authorize qua run rồi dùng parameterized EXISTS ImageAsset→ProductImage.storageKey→Product.name, count/paging12 ổn định. Không thêm relation/bảng/cột hoặc blobs trong search results; input % và SQL text là literal substring.
- ImageStorage client debounce250ms + request-id guard bỏ response cũ; form vẫn không bị submit khi Enter tìm. ProductEditor bỏ metadata form, thumbnail primary/remove; editor-state phát removedImageIds, management validates ownership/explicit deletion trong cùng aggregate version/Serializable transaction.
- Upload-only website intent: editorPayload chỉ normalize uploaded URL unknown→granted và reference sự kiện chọn, không đổi denied/AI hoặc nới service validators. Không raw image public trước khi lưu product active. Chi tiết/giới hạn tại IMAGE_STORAGE.md.


## Lưu trữ ảnh trong PostgreSQL (2026-10-22)
- ImageAsset tách binary BYTEA/mime/width/height/byteSize/createdAt khỏi ProductImage để aggregate/catalog/list không kéo blobs. UUID path /images/uploads/{id}.webp; shared library thuộc ADMIN, không duplicate file vào public hoặc payload product. Liên kết bằng storageKey; asset không bị xóa khi metadata bị xóa, có thể reuse.
- image-upload.ts kiểm tra stream8MB/decode24MP/WebP1920px/strip metadata; image-storage.ts compose cùng run/session/ADMIN transaction. /api/admin/images GET list12/page, POST raw binary upload có origin guard trước service đọc body. /images/uploads/[file] node route chỉ trả blob cho ADMIN hoặc ảnh đã public qua product active + quyền/reference; no-store/nosniff, lỗi404.
- next.config.ts localPatterns loại uploads khỏi optimizer; gallery/editorial/collection chỉ unoptimized cho URL uploads, tránh cache giữ ảnh sau thu hồi quyền. Kích thước/layout/ảnh static cũ giữ nguyên. CSV metadata không phải backup binary; backup PostgreSQL chứa ImageAsset.
- Main migration runner main-image-storage-migration.ts chọn7 SQL độc lập, verify fresh backup/restore/drift/rehearsal trước deploy; hai registry SQL vẫn không apply. Main7/test9, không data backfill. IMAGE_STORAGE.md ghi evidence/trade-off/manual QA.


## OptionPicker client (2026-10-22)
Shared details giữ summary/validation; menu dùng native Popover top layer/fixed để thoát table overflow và không đổi chiều cao hàng. Menu được căn viewport khi mở, đóng khi resize/outer scroll. Color dùng buttons có swatch chuẩn và native select cho required validation; custom color chưa có mã dùng unknown marker. Không đổi route/backend/module boundary. Manual QA còn pending.

## Nhóm đối tượng và định tuyến sản phẩm (2026-10-22)
- features/products/audience.ts chứa nhãn nhóm tuổi/validator và chuẩn hóa URL. ProductProfile giữ gender và thêm ageGroup nullable có CHECK; UI không tạo trường gender thứ hai. Không numeric age range hoặc suy luận năm sinh.
- Management create tự sinh slug từ tên + gender + ageGroup trong transaction, advisory lock theo base + unique index + hậu tố; edit giữ slug cũ. Draft chỉ preview URL, client slug không quyết định URL của editor. CSV insert-only vẫn có contract slug riêng.
- CSV AI thêm age_group tùy chọn cuối header; chấp nhận header cũ chính xác. Feature export dùng v3 khi nguồn có ageGroup, giữ v1/v2 khi không có thuộc tính; taxonomy version độc lập.
- scripts/main-audience-migration.ts dùng backup manifest/SHA, history checksum, drift DB độc lập, restore rehearsal và scoped Prisma migrate deploy; chỉ đưa6 SQL đã duyệt vào cây migration riêng, không apply hai taxonomy SQL còn chờ. Main6/test8; đọc PRODUCT_AUDIENCE.md cho evidence.


## Product description — khối1 theo ảnh chi tiết
- description.ts pure parser phiên bản marker aurel-description-v1, plain legacy literal không đổi; nguồn giới hạn Markdown, React renderer ProductDescription whitelist/no raw HTML, URL allowlist và allowedImages đã lọc rights. DescriptionEditor client textarea/toolbar/history/preview/expand; không contentEditable/third-party editor hoặc schema mới.
- Product.description vẫn Text; chỉ description nhận newline/tab qua validator, field khác giữ C0 guard. Explicit brand null được preserve, default AUREL chỉ new/missing. PDP giữ layout và thay đúng renderer mô tả; SEO/feature-export chuyển descriptionText, CSV raw string giữ marker/multiline. PRODUCT_DESCRIPTION.md ghi format/limits/manual QA.

## Product Editor — Phase2.9.3
- Reuse management service/run/session/DB ADMIN/Serializable/aggregate version. Không thêm CRUD store. product-code.ts pure client/server, editor-state.ts draft→payload/copy/remove/alias; taxonomy-labels.ts nhãn Việt dùng chung UI và duplicate guard; taxonomy-registry.ts server capability/read/normalize.
- Server cấp code/SKU thay giá trị client, advisory lock theo stem + Product unique và bounded create retry; không retry edit hoặc đổi existing code/SKU. Slug unique và báo lỗi field. Main compatibility numeric generation, extended name code sau hai SQL staged, capability yêu cầu cả registry và version v2 constraint.
- TaxonomyOption key/token PK, append-only label registry dùng chung; Profile/Variant columns giữ nguyên, trigger validate builtin+registry thay static CHECK; tránh cross-table CHECK/restore ordering. Mỗi add/read vẫn authorize. Main chưa có2 SQL mới; aurel_ai_test8 migrations, main6 gồm audience. Không role/grant/env changes.
- ProductEditor controlled dùng chung new/[id], server layout vẫn gate trước khi gửi navigation props cho sidebar client có pathname active state. AdminHeader/AdminIcon riêng được StorefrontHeader chọn chỉ tại /admin/products[/...]; Footer return null chỉ phạm vi đó. Các nhánh homepage/auth/storefront khác giữ nguyên. Info3 cột, metadata2 cột +chips cùng card, gallery/compact preview aside; native dialog/searchable details, CSS module scoped. Lưu nháp là save aggregate với isActive=false theo trạng thái đã hỗ trợ, Hủy có dirty confirmation, không persistence backend mới. Dirty click/unload guard và Navigation API khi có; unsupported SPA history cần manual QA.
- API GET thêm taxonomy; POST thêm get và taxonomy-add qua boundary cũ, giữ CSRF/allowlist/body limit. CSV runtime registry snapshot và digest; feature export schema v2 nếu vocab mở rộng, report taxonomyRegistry, v1 giữ nguyên. CLI offline thêm optional registry JSON, không DB access.
- scripts/product-editor-check.ts reviewed checksums/physical guard/test-only deploy/cleanup + main readonly fingerprint/env hash;4 unit+2 focusedDB mới. PRODUCT_EDITOR.md ghi đầy đủ status/limits/migration plan/manual QA.

## ADMIN Product Management — Phase2.9.2
- Server routes app/admin/products: layout gate, Explorer, new, [id] editor và import; api/admin/products là HTTP boundary GET list/get/export/taxonomy, POST get/save/category/category-search/taxonomy-add/status/remove-image/delete/preview/import. Mỗi operation tự kiểm tra Better Auth/expiry/DB ADMIN trong transaction, không dựa layout.
- createManagementOperations trong features/products/management.ts reuse Product Service.run và validators/profile/options/money/dryRunImport hiện có. Serializable + aggregate version hash, child ownership và allowlists; admin-http.ts kiểm tra Origin/UTF8/body limit. Không nhận role/userId/totals/Prisma nested writes từ client.
- Explorer SSR details/summary tree, search/paging25, navigation tối đa200 nhóm; editor tìm category50/trang và giữ category hiện tại. `ProductDeleteControl` là Client Component cục bộ ở cột Thao tác: chỉ mở cho hàng archived có code, GET aggregate mới để lấy version rồi buộc nhập mã trước POST delete; hàng active/missing-code chỉ giải thích điều kiện. Forms giới hạn200 variants/100 images; CSS scoped/tokens/noindex/no-store; không đổi storefront/header/hero/collection/PDP layout.
- CSV2MB/2.000 rows/100 products: insert-only preview + digest + live revalidation + atomic import. Export100 products/trang từ một transaction snapshot, sáu Blob downloads từ response đó. Không upload storage, không publicize private references hoặc suy diễn giá.
- Hard-delete yêu cầu archive/code/version và không references Order/Cart/TryOn/Favorite/Recommendation; explicit child delete và FK, không asset deletion. Route revalidate home, catalog, PDP slug cũ và Explorer sau success. lib/product-audit.ts local JSONL fsync intent trước mutation và completion sau commit. Filesystem/DB không atomic; completion chưa ghi có response flag/Explorer notice. Audit single instance cần durable production sink/retention trước nhiều instances.
- Main local đã có đủ5 migrations sau verified backup/restore/no-drift/rehearsal. scripts/main-migration.ts chỉ cho đúng trạng thái2 migration cũ, generic db:migrate vẫn blocked cho tương lai. Không đổi env/roles/table grants/ownership. Currency public flag vẫn false; public image rights luôn enforce từ schema mới, độc lập cờ AI.
- scripts/admin-products-check.ts và admin-http-smoke.ts chỉ mutate aurel_ai_test, exact target/role/physical guards; main fingerprint read-only và env hash trước/sau, cleanup scoped. Ngày2026-10-22 đã provisioning đúng tài khoản verified theo chỉ định trực tiếp của chủ dự án bằng conditional transaction/audit local; không thêm endpoint promote hoặc thay auth boundary. Evidence/limits tại ADMIN_PRODUCTS.md.

## Product Foundation — đã deploy main trong Phase2.9.2
- ProductProfile 1:1 Product qua PK/FK productId, một nơi chứa collar/fabric/gender/fit và garmentType/tags/layerRole/pattern/silhouette; color/size vẫn duy nhất tại ProductVariant. Không EAV, bảng Collection hay ProductEmbedding. Collection là slug nullable; brand hiện có giữ compatibility.
- Product.productCode nullable unique tách PK/SKU; Product.updatedAt nullable do trigger, không Prisma @updatedAt để không tự ghi cột mới vào main. ProductImage bổ sung quyền website/embedding/training độc lập default unknown, FK ghép variant/product, partial unique primary/product. Manual migration CHECK/expression indexes không được thay bằng db push.
- features/products/foundation.ts taxonomy/normalization/metadata validation; import-dry-run.ts offline bundle planning; feature-export.ts pure mapping JSONL + missing report. Hai CLI offline không kết nối DB. data/templates có CSV headers và JSON schema, không fake merchandise.
- Product Service reuse run/session/DB ADMIN/Serializable cho setFoundation/setImageMetadata/exportFeatures. lib/products.ts truyền PRODUCT_FOUNDATION_ENABLED, mặc định false; cờ độc lập currency. Queries products.ts dùng imageRightsSelect: helper off/on được giữ cho tests; public readers sau Phase2.9.2 luôn lọc websitePermission=granted; không đổi image URL resolver/public DTO/UI. Unknown/denied AI rights luôn loại khỏi feature export.
- Migration 20261021090000_product_foundation phụ thuộc chain currency/order_revision, ban đầu apply aurel_ai_test; Phase2.9.2 đã apply main sau verified restore/rehearsal. scripts/product-foundation-check.ts guard exact target/role, advisory lock, reviewed SHA, migration/constraints/service tests và rollback fixtures; source main chỉ fingerprint read-only. Main đã có đầy đủ các trường mới sau Phase2.9.2. Analytics Units Sold mới là thiết kế query, không service/counter production; PRODUCT_FOUNDATION.md ghi rõ extension fabric-variant và missing return policy.

## Product Detail — Phase2.8
- app/products/[slug]/page.tsx là Server Component dynamic, metadata + page dùng React cache(getProductDetail) theo request. lib/catalog.ts thêm entry additive, lazy import findProductDetail trong lib/db/queries/products.ts, reuse Prisma singleton và catalog select/mapper. Query findFirst where slug/isActive=true cùng category/active variants/images; không per-variant DB calls khi tương tác.
- features/catalog/product-detail.ts chứa safe slug/href, loader success/not_found/error, DTO tối thiểu và pure variant/price helpers. prisma-catalog.ts thêm productDetailSelect/mapProductDetailRecord, không sửa contract mapper/catalog cũ. DTO không raw storageKey/isActive/user/provider metadata hoặc legacy numeric amounts. Images qua publicProductImageUrl rồi chỉ public raster URLs/alt; description là text React escaped.
- productDetailSelect chỉ thêm prices relation nếu flagtrue và currency đã chọn; filter exact currency. Flagfalse hoặc chưa chọn giữ old-schema select, không ProductPrice/cột staged. Mapper detail validate Decimal.toString bằng money trước toFixed để từ chối scale/overflow thay vì rounding; client format string grouping, không Number/FX/default currency. Legacy numeric vẫn có thể được đọc nội bộ theo catalog contract nhưng bị loại khỏi client detail DTO.
- Client ProductGallery chỉ state active image/error, Next Image3:4 + thumbnails; VariantSelection chỉ DTO state màu-size/SKU/stock/price, native buttons/fieldset/legend/live region. Sizes không tồn tại trong màu bị disabled, stock0 hiển thị hết hàng; mọi purchase disabled vì chưa cart backend. Currency GET form chỉ xuất hiện khi flagtrue, không tự bật flag.
- /products/[slug]/loading.tsx và not-found.tsx có trạng thái riêng; DB error dùng EmptyState retry, không tráo lỗi thành404/[]/fake data. notFound gọi cả metadata/page. HTTP streaming hiện trả200 kèm404 marker/noindex ở inactive/missing/invalid; không dùng status200 đó làm bằng chứng sản phẩm tồn tại.
- CatalogContent và CollectionPiece/CollectionGrid chỉ thêm optional href + title Link khi slug hợp lệ; không sửa cards/reveal CSS/layout/animation. Client chỉ import pure helper/type, không Prisma/server-only query module. Không schema/migration/env/dependency hoặc auth changes.

## Email runtime main — cập nhật2026-10-22
- Main .env local đã có RESEND_API_KEY/EMAIL_FROM (credentials dự án hiện có, sender domain fourdteam.win verified qua GET API). Restart đúng Next start3000; AuthPage deliveryAvailable=true và getAuth instance mới nạp Resend adapter hiện có. Không đổi modules, auth policies, requireEmailVerification=false, secrets khác hoặc DB/schema. Email vẫn do thao tác người dùng/native auth flow, task cấu hình không tự gửi. Không đưa key ra client/log/docs. Chi tiết vận hành: AUTHENTICATION.md.

## Auth email — Phase 2.6
- Phase2.7 routes nhóm app/(auth): /login, /register, /forgot-password, /reset-password, /verify-email; Server Components AuthPage/AuthShell + Suspense, Client AuthForm cho tương tác. Noindex/referrer metadata; trang auth dynamic chỉ truyền deliveryAvailable boolean, không truyền server env/key. Không thêm mutation endpoint hoặc auth engine.
- lib/auth-client.ts dùng better-auth/react cùng origin; features/auth/ui.ts chỉ validation/allowlisted payload/messages/safeReturnTo/UI orchestration. Backend vẫn validate/authorize/hash/token/session. AuthForm chỉ giữ reset token trong React state và bỏ query khỏi history; không localStorage/analytics. next.config.ts no-referrer cho auth API/reset, reset no-store và ignore request logging token routes. Reverse proxy/hosting phải redaction access logs riêng.
- AccountPanel dùng Better Auth useSession/signOut, thông báo state chứ không role/PII; tái sử dụng trong homepage account dialog, menu mobile và AccountControl của secondary header. Auth pages dùng navigation/footer scoped, không thay header scroll logic/hero/collection hoặc global tokens. Logo auth AUREL theo header hiện có.
- Better Auth sở hữu verification JWT, reset token/expiry, hashing và transaction consume-token + revoke-session + password update. Không thêm token/session implementation, Prisma model hoặc pool.
- features/auth/email.ts cung cấp server-only port AuthEmailDelivery.send và templates text/HTML (escape URL). Phase2.6.1 lib/auth.ts truyền createResendDelivery từ features/auth/resend.ts, đọc RESEND_API_KEY/EMAIL_FROM server env. Thiếu/partial/malformed config trả undefined và giữ unavailable, không console/fake-success provider. Không đổi Prisma singleton.
- Resend dùng native fetch POST endpoint HTTPS cố định, redirect:error, AbortSignal timeout10s cả response body, chỉ thành công khi HTTP2xx + id. Lỗi status/network/body được đổi thành EmailDeliveryError code an toàn, không giữ cause/body/message thô. 429 cooldown theo Retry-After seconds/date, giới hạn1..3600s, fallback60s; memory trên instance adapter. Không retry, queue hoặc webhook delivery confirmation; accepted không đồng nghĩa đến inbox. Multi-process cần điều phối hạn mức riêng.
- Before hook chặn resend/reset request bằng 503 khi thiếu provider, trước lookup tài khoản; signup vẫn hoạt động chưa verified. Có provider thì signup gửi verification. Reset giữ response trung lập kể cả lỗi transport (chỉ log thông báo cố định), xác nhận request chứ không chứng nhận giao email.
- Giữ origin/CSRF/session/DB role authorization. Resend/reset-request 3/phút, reset-submit 5/phút, memory mỗi process. Candidate ACL Phase2.5.2 đã có User.emailVerified UPDATE và Account/Session/Verification DML; không cấp thêm quyền trong task.
- Phase2.6.2 scripts/email-acceptance.ts là manual runner (TTY bắt buộc), không app route/UI/debug endpoint: chỉ TEST_DATABASE_URL/TEST_AUTH_SECRET từ .env.test, testTarget/assertTestDatabase trước writes/sends, Prisma client riêng cho test, loopback127.0.0.1:3316 chỉ GET verify callback. Password/reset token chỉ RAM; report .local chỉ metadata. Gửi đúng recipient được phép và tối đa một request mỗi loại/run, pause chờ inbox owner. Verification gửi explicit sau commit để quan sát emailVerified=false trước gửi; production sendOnSignUp vẫn giữ nguyên. Listener đã đóng và fixtures cleanup sau nghiệm thu.

## Database identities — Phase2.5.2, chưa cutover main
- Runtime tương lai aurel_app không ownership/owner membership hoặc superuser/createdb/createrole/replication/bypassrls/DDL/TRUNCATE. Migration owner schema/objects dùng secret trong deploy process riêng, không web runtime. DBA bootstrap/break-glass tách biệt; main credentials chưa đổi.
- Profile lab: User INSERT CUSTOMER guard và UPDATE cột không role; auth DML, Product/Variant deactivate, metadata/prices DML, Order/Item SELECT-only, migrations/future objects deny. Shared backend DB role không thay service CUSTOMER/ADMIN authorization hoặc per-user data access.
- security-policy.ts là candidate SQL chỉ hỗ trợ role lab. Rehearsal trên cluster5544/system ID khác source; owner deploy và app Better Auth/Product Service đã nghiệm thu bằng LOGINs thật. Không runtime/schema/migration/UI changes. Candidate User trigger/default ACL cần review provisioning riêng trước production.
- DATABASE_SECURITY_READINESS.md chứa quyền/cutover/partial failure và backup policy đề xuất. Main vẫn NO-GO; encryption/offsite/PITR production chưa triển khai, không tự đổi .env hoặc rotate/revoke login.

## Hiện thực Phase 0
- Next.js App Router chạy Node.js, React, TypeScript strict, Tailwind CSS qua PostCSS.
- Server Components mặc định; `app/error.tsx` dùng client để reset, `layout/storefront-header.tsx` dùng client cho pathname và dialog menu/tài khoản. Hero vẫn là Server Component.
- Catalog dùng PostgreSQL server-side; khung storefront vẫn render khi DB rỗng/lỗi. Auth backend Better Auth và UI login/register/verify/forgot/reset đã có; chưa Admin UI, product mutation API hoặc thanh toán.
- Phase 1 có Prisma 7, PostgreSQL, `prisma/schema.prisma`, `prisma.config.ts`, client adapter pg và queries trong `src/lib/db/`; `src/lib/catalog.ts` đã nối DB. Client generate vào `src/generated/prisma`, được ignore khỏi Git/ESLint.
- Môi trường dev Windows dùng PostgreSQL portable trong `.local/postgres` (không commit), script `scripts/local-db.mjs` quản lý start/stop và tạo database lần đầu; `scripts/check-db.mjs` chỉ SELECT 1, không cần seed. Không có route mới.

## Cấu trúc và ranh giới
```text
src/
  app/                  Layout, trang, metadata, CSS, loading/error/not-found
    products/page.tsx
    search/page.tsx
    cart/page.tsx
  components/
    layout/             Header, StorefrontHeader (AUREL tại /), Footer
    home/               HeroSection; CollectionReveal, CollectionSection, CollectionGrid và CSS modules
    ui/                 ActionLink, EmptyState
    products/           CatalogContent, SearchForm
  config/site.ts        Tên cửa hàng và danh mục định hướng tạm thời
  features/catalog/     Product, CatalogQuery, CatalogResult, parse/load
  features/collection/  Adapter preview + fixture demo, không thuộc production reader
  lib/catalog.ts        Reader server-only, lazy import Prisma query trong error boundary
  lib/db/queries/       Truy vấn server-only; findCatalogProducts cho storefront
  lib/products.ts       Factory service server-only, Prisma transaction adapter
  features/products/    Validation, image resolver, CRUD/authorization/stock logic
tests/catalog.test.ts   Hợp đồng dữ liệu và kiểm tra query
```

## Luồng dữ liệu
1. Route nhận `searchParams` và chờ Promise theo App Router.
2. `parseCatalogQuery` chuẩn hóa query, giới hạn 100 ký tự, kiểm tra danh mục được phép và tham số lặp.
3. Route gọi `getCatalog`; reader lazy import `findCatalogProducts`, truy vấn active products cùng category, active variants (kể cả stock=0), images sắp xếp sortOrder/id. Không select thông tin người dùng/đơn hàng. Category theo slug; q match literal không phân biệt hoa/thường trên name/description/brand/category và color/size/SKU của active variants.
4. `loadCatalog` trả union `success` (kể cả []) hoặc `error`; lỗi không lộ nội dung kết nối.
5. `CatalogContent` phân biệt lỗi, rỗng và dữ liệu thật. Nhánh thành công giữ thẻ tên tối giản, thêm Link /products/[slug] hợp lệ ở Phase2.8; Product Detail dùng cùng reader/mapper và safe DTO riêng.

`features/catalog/prisma-catalog.ts` giữ select/where và mapping thuần, chỉ import type Prisma. DTO gồm ID chuỗi, Decimal chuỗi 2 số lẻ, category, variants, images public URL hoặc null, màu/size duy nhất, tổng stock active variants và giá thấp nhất active variants (null nếu không có). Không tự gán currency. Image resolver dùng chung trong `features/products/images.ts`, chỉ resolve public raster `/images/`, không raw storageKey/private URL. Adapter pg dùng connect timeout 5s, query timeout 10s, pool max 5. Không cache catalog; `/` force-dynamic, products/search vốn động. Không truy vấn DB lúc prerender homepage. Public lỗi chỉ chứa status error, không raw exception/URL. Reader vẫn tiêm được trong unit tests; integration tests chỉ đọc PostgreSQL và dùng process riêng kiểm tra lỗi/thiếu config, không seed.

Catalog pagination dùng skip/take, page 1..10000, pageSize 1..100 mặc định 20, sort createdAt/id DESC. `getCatalog` giữ union cũ; `getCatalogPage` thêm metadata total/totalPages/hasNext và dùng transaction RepeatableRead cho data/count. Parser chỉ thêm optional page/pageSize khi query có yêu cầu, giữ caller cũ. Không thay route hoặc UI; offset có thể dịch trang giữa nhiều request khi dữ liệu đổi.

## Authentication Backend (Phase 2.3)
- Better Auth 1.7.12, Prisma adapter transaction, dùng đúng client/pool `lib/db/client.ts`. Options ở `features/auth/config.ts`; instance lazy tại `lib/auth.ts` để build không yêu cầu auth secret.
- `/api/auth/[...all]` chỉ GET/POST Node.js, trả lỗi cấu hình bất ngờ dưới dạng AUTH_UNAVAILABLE/503. Better Auth xử lý signup/signin/signout, ký cookie, tra DB session, origin/CSRF và rate limiting. Không thêm UI hoặc CRUD route.
- User giữ Int PK, fullName được map từ auth name, passwordHash legacy giữ nguyên; thêm emailVerified=false/image nullable. Session/Account/Verification dùng Int serial và userId Int; FK nghiệp vụ cũ giữ nguyên. Migration additive đã review/apply, chi tiết SQL/đối chiếu ở AUTHENTICATION.md.
- `lib/auth-session.ts` lấy Next headers; `features/auth/session.ts` gọi getSession disableCookieCache/disableRefresh, chuyển trusted ID/expiry thành DTO service. Cookie giả/expired/revoked trả null, không đọc identity từ JSON hoặc x-role/x-user-id.
- Product service default resolver này, vẫn đọc DB User.role trong Serializable transaction. `VerifiedProductSession` có expiresAt epoch milliseconds; expiry được kiểm tra trước/sau role query để chặn hết hạn trong lúc chờ. Role additionalField không nhận input client và không trả ra auth DTO, default CUSTOMER.
- Secret local không commit; origin cố định cấu hình, HTTPS production trừ loopback. Session 7 ngày, cache tắt, cập nhật tuổi qua endpoint session; limiter memory per-process cần shared storage khi nhiều instance. Chưa có mail verification/reset hoặc tự tạo ADMIN. Không chuyển legacy hash tự động.

## Product Data Service (Phase 2.2)
- `lib/products.ts` mặc định dùng Better Auth session của request; resolver injection chỉ dành trusted composition/tests. Lazy import Prisma và Serializable transaction cho mỗi operation; không có actor mặc định. Chưa thêm Server Action/product mutation API.
- `features/products/product-service.ts` là core server-only: đọc User.role trong transaction rồi mới CRUD 4 entity. Chỉ ADMIN; không nhận role từ request. Dùng select DTO tối thiểu, không trả raw key/DB exception. Validation thuần từ `validation.ts` kiểm soát allowlist, kiểu/giới hạn, SKU, slug, Decimal/stock và key ảnh.
- Product/variant deactivate, không cascade/hard delete lịch sử; category delete tuân FK; image delete chỉ metadata. Variant/image phải có đúng productId khi get/update/remove/list. Stock thay đổi bằng CAS expectedStock/delta; cấm update stock qua patch. Conflict Serializable trả CONFLICT, không tự retry mutation.
- Model tiền tệ mở rộng ở Phase 2.5 nhưng migration chỉ deploy test. ProductPrice độc lập/variant/currency; order snapshots có CHECK/deferred triggers; legacy NULL không backfill. Chưa global stock CHECK/audit trail. Auth/CRUD/money integration tạo fixture chỉ trong test DB.

## Integration PostgreSQL và backup (Phase 2.4)
- Môi trường test tách DB/login/secret: aurel_ai_test + aurel_ai_test_runner; .env.test chỉ TEST_DATABASE_URL/TEST_AUTH_SECRET. Parent .env không sửa; chỉ child process được map DATABASE_URL sang URL test để dùng ứng dụng/Prisma CLI thật.
- `scripts/test-database-safety.ts` kiểm tra confirmation/name/role/host/schema, current_database/current_user thực; `scripts/postgres-integration.ts` tạo môi trường, kiểm tra quyền main DB read-only, migration SHA manifest, advisory lock, migrate deploy, child tests và fingerprint trước/sau. Không tự reset/seed/truncate.
- `tests/postgres.integration.test.ts` dùng Better Auth/Prisma/service thật, không memory adapter. Guards trước operation và lookup có thể xóa session expired; cleanup prefix/IDs/email trong transaction, luôn disconnect. Test role chỉ promote ADMIN ở DB test. Runner kiểm chứng rows/schema/constraints/indexes về baseline, không reset sequences.
- Backup pg_dump custom read-only từ aurel_ai, restore vào DB mới có prefix aurel_ai_restore_test_; fingerprint và SHA/verified manifest lưu trong .local/backups. Không restore vào main. Hai migrations cũ không sửa; migration multi-currency mới review/apply test, chưa main. Fingerprint bổ sung numeric precision/scale, enums, functions và user triggers.

## Multi-Currency — Phase 2.5, staged production
- Preflight cũ phát hiện write skew; Phase2.5.1 đã bổ sung migration order_revision và nghiệm thu trên test/restore. Main vẫn NO-GO chưa approval, không có order mutation endpoint; xem ORDER_CONCURRENCY_REMEDIATION.md.
- features/money kiểm allowlist/scale/string và BigInt; features/orders/pricing tạo snapshot thuần. lib/db/queries/order-pricing chỉ đọc giá thật trong RepeatableRead, chưa checkout/order-write/giữ stock.
- ProductPrice unique variantId/currency, index currency/amount, NUMERIC + CHECK chống rounding; Order/Item currency nullable cho legacy, snapshot lineTotal/totals và deferred triggers bảo đảm cùng currency/tổng khớp.
- CatalogQuery currency tùy chọn; DTO currency/priceStatus, thiếu giá null/missing, không FX/legacy fallback. Không chọn currency giữ interface legacy nhưng đánh dấu legacy_unassigned. Price CRUD dùng cùng session/DB ADMIN/parent scope.
- MULTI_CURRENCY_ENABLED=false mặc định tương thích main schema cũ: không query ProductPrice khi chưa bật, API mới fail closed. Chỉ bật sau migration approved. Không UI/public mutation route mới; SQL/legacy plan tại MULTI_CURRENCY.md.
- Order.revision là BigInt nội bộ, before-header trigger sở hữu giá trị; before-item trigger ghi cả parent cũ/mới theo ID. Row write tạo MVCC conflict cho snapshot cũ, thay vì chỉ khóa. Deferred currency/total/nonempty checks giữ nguyên. Rollback/deadlock/40001 không được bỏ qua; service hiện không auto-retry. Không expose revision trong DTO hoặc nhận request JSON.
- Các4 functions dùng SECURITY INVOKER, public references, search_path pg_catalog/pg_temp, không PUBLIC EXECUTE. Ordinary writer cần DML/SELECT và UPDATE header, không CREATE/ownership/DDL/TRUNCATE/replication privileges. Privileged owner/superuser có thể bỏ guard; role local main hiện đặc quyền, phải tách khi production. Không tự đổi main role trong remediation.
- Origin/CSRF Better Auth được bật rõ kể cả NODE_ENV=test; phát hiện hành vi skip mặc định của dependency bằng PostgreSQL test. Hướng dẫn vận hành/phạm vi backup và kết quả: POSTGRES_INTEGRATION_TESTING.md.

## Các tuyến công khai đã có
| Tuyến | Trạng thái |
| --- | --- |
| `/` | Hero → Intelligence → collection trong CollectionReveal; sau wrapper là divider/search → categories → 10-look Edit → Journal; footer thuộc layout |
| `/products?category=everyday` | Danh mục; chấp nhận everyday/workwear/essentials/tops/bottoms/outerwear; dữ liệu rỗng chỉ hiển thị liên kết theo yêu cầu |
| `/search?q=...` | Form GET; chưa nhập, không tìm thấy hoặc lỗi dữ liệu |
| `/cart` | Giỏ hàng trống, chưa lưu giỏ |
| `/api/auth/[...all]` | Better Auth backend GET/POST, không UI |
| Tuyến không tồn tại | Not-found 404 |

`loading.tsx` cung cấp trạng thái đang tải; `error.tsx` cung cấp reset cho lỗi render tuyến. Header/footer thuộc layout chung; Footer chọn EditorialFooter tại `/`, footer gọn tại các tuyến khác. Lỗi nguồn dữ liệu được xử lý ngay trong collection để giữ trang chủ hữu ích. Nút retry dữ liệu tải lại trang bằng request mới.

## Homepage editorial expansion (2026-10-13)
- `features/editorial/content.ts`: typed AurelLook/EditorialProduct, 10 concept demo, ba category và hai journal notes. Không đi qua production reader, không giá/tồn kho cho lookbook; image null dành cho ảnh campaign tương lai.
- `editorial-sections.tsx` là server component; form GET và suggestions dùng /search; category dùng /products?category=... được validator server cho phép. Không có hệ tìm kiếm thứ hai hoặc route giả.
- `editorial-image.tsx` client mỏng dùng next/image và onError; null/failed chuyển CSS placeholder trong container đã đặt aspect-ratio. Chỉ dùng local assets hiện có.
- `aurel-edit.tsx` client biệt lập, nằm ngoài CollectionReveal để sticky không phụ thuộc clip-path của reveal. Đo overflow thực, scroll height = scene height + travel, rAF translate, ResizeObserver cập nhật kích thước; không wheel interception hoặc khóa body. Cleanup listeners/observer/rAF. Native scroll-snap là fallback/mobile/reduced-motion, keyboard/focus và progress dùng cùng offset thật.
- StorefrontHeader giữ một instance và hai dialog; cập nhật data-mode bằng rAF khi collection qua 72px. Header fixed z-index 30/64px, Edit sticky top 64px. Global scroll-padding-top 80px bảo vệ anchor.
- Journal hiển thị hai note trực tiếp với anchor thật, không route article giả. Footer không giả lập newsletter, social, chính sách hoặc customer-care URLs.

## Thiết kế và zero-data
- Token tập trung trong `app/globals.css`, cấu hình tên/danh mục trong `config/site.ts`.
- Header/footer tuyến phụ chỉ giữ các liên kết, không còn announcement/tagline/copy/copyright. Route products bỏ intro và thay empty panel bằng liên kết khám phá; giữ CatalogContent cho lỗi hoặc dữ liệu thật. Search/cart không đổi trạng thái riêng.
- Hero và navigation không phụ thuộc dữ liệu; footer chỉ xuất hiện trên tuyến phụ. Danh mục cảm hứng và giới thiệu cũ đã gỡ theo yêu cầu người dùng.
- Danh mục không khẳng định có hàng. Minh họa CSS được gắn nhãn, không phải sản phẩm.
- Không tạo giá, tồn kho, đánh giá, đơn hàng hoặc khách hàng giả.
- Không tải font/ảnh ngoài để tránh phụ thuộc mạng khi render.
- Hero AUREL dùng ba ảnh gốc local qua next/image, preload ảnh chính và sizes responsive. Ba ảnh đã có và tải thành công. Chữ editorial dùng Times New Roman/Georgia hệ thống.

## Collection Scroll Reveal
- CollectionSection render heading + CollectionGrid trực tiếp, giữ category state và fallback lỗi qua CatalogContent. CollectionDiscovery không còn mount trên homepage. IntelligenceShowcase là phần đầu surface của CollectionReveal, trước collection; không thay observer/scroll logic.
- features/collection/search.ts là matcher thuần: normalize Unicode, tách từ, bỏ một số từ nối, AND các từ có nghĩa trên name/category/colors/description. Đây là demo keyword matching, không suy luận phối đồ. GET /search là đường gửi cho dữ liệu thật/no-JS, tiếp tục parseCatalogQuery phía server. Không có route/API mới.
- Home truyền HeroSection server-rendered và CollectionSection vào client wrapper CollectionReveal; không sửa hero. Wrapper sticky ở desktop/landscape, surface đi theo document flow và mở mask ngang theo vị trí scroll. requestAnimationFrame cập nhật một CSS custom property, không setState khi scroll. IntersectionObserver giới hạn cập nhật ngoài vùng, listeners/observers được cleanup.
- CollectionSection là server component, nhận cùng CatalogResult với homepage. CollectionGrid client chỉ xử lý filter Clothing/Accessories và IntersectionObserver reveal theo từng card. Reduced-motion/no-JS luôn đọc được nội dung, không pin/transform phức tạp.
- Adapter collection lấy tối đa 8 bản ghi thật, dùng giá/ảnh/alt/màu/mô tả thật; category tops/bottoms/outerwear/clothing → Clothing, accessories → Accessories, slug khác không tự đoán. DB rỗng là [] với notice có sẵn; DB lỗi dùng CatalogContent. Fixture không còn làm fallback. Không có detail link giả, wishlist hoặc checkout.
- Ảnh fixture nằm trong public/images/aurel/collection-demo, được tạo bằng built-in image_gen; next/image fill + sizes + lazy load, frame 3:4 chống layout shift. Không gán ảnh mock vào bản ghi thật. SVG placeholders ban đầu đã được thay bằng ảnh mock photography theo brief.

## Bảo mật và bước mở rộng
### AUREL Intelligence showcase
- Component client biệt lập quản lý reveal, gắn một lần bên trong CollectionReveal trước CollectionSection trong page.tsx. Collection bỏ min-height viewport sau khi gỡ search.
- Từ2026-10-22, IntelligenceShowcase giữ reveal/content và mount ShowcaseVideo ổn định. ShowcaseVideo chứa một video DOM node và local media state/refs; poster SSR/no-JS, preload none/src chưa gắn, chọn desktop1920/mobile960 một lần, near observer200px + viewport10%/visibility pause, reduced-motion/Save-Data và gesture Play/Pause. Không đổi src khi resize/rerender, không clear src/load() để pause; cleanup observers/listeners/promises. Error giữ poster; autoplay rejection không retry loop. Khung video nhận click/Enter/Space và accessible label, video trang trí vẫn aria-hidden; không có nút Play/Pause hiển thị.
- Anchor `#discovery-query` không còn render. CTA tạm tới `/search` có thật; đang chờ URL AI người dùng hứa cung cấp. Không thêm route/API hoặc giả lập AI.
- IntersectionObserver reveal một lần, cleanup; nội dung SSR/no-JS luôn hiện, reduced-motion tắt transform/transition và focus-within giữ nội dung truy cập được.

- Không có secrets trong repository; `.env*` bị bỏ qua ngoại trừ `.env.example`.
- Input được kiểm tra trên server, React escape nội dung hiển thị.
- `lib/catalog.ts` đánh dấu server-only.
- Chưa có thao tác mua hàng hoặc mutation endpoint công khai. Service mutation nội bộ đã có role guard; auth provider và cơ chế bảo vệ HTTP/Server Action phải được nối trước Admin. Checkout sau này vẫn phải tính giá/tồn kho trên server.
- Chưa khởi tạo Git; cần chủ dự án tạo hoặc kết nối repository trước khi quản lý phiên bản.

## Dynamic Variants — 2026-10-23
- variant-matrix.ts: chuẩn hóa lựa chọn/tổ hợp thiếu/SKU; editor-state dùng lại mà không tự ghi DB.
- variant-management.ts ghép ProductService/run: ADMIN, version, Serializable, draftRequired; POST /api/admin/products operation variant-expand. Không thêm bảng identity hoặc ProductVariant song song.
- variant-colours.ts đọc HEX có capability guard; variantColors qua catalog/showroom/shared PDP. VariantOptionDialog/local state chỉ Demo; Gallery nhận variantId/preferredImageId. Chi tiết [DYNAMIC_VARIANTS.md](DYNAMIC_VARIANTS.md).

## Danh mục theo giới tính / collection navigation — 2026-10-23
category-options.ts cung cấp preset loại trang phục/giới tính/icon, CategoryPicker/ClothingIcon là UI Admin. ProductProfile.gender và Category giữ độc lập; không tạo Category theo mỗi giới tính. managementSelectCategory qua existing ADMIN service/transaction và POST /api/admin/products operation category-select resolve/upsert allowlist preset. Không schema mới. ProductSidebar nhóm Product.collection thay category; Xem tất cả dùng filter/pagination hiện có. Danh sách con là snapshot25 hàng navigation, không phải full membership. Xem CATEGORIES_AND_COLLECTIONS.md.

- Route `/login`: dùng `LoginPage` riêng (header riêng trong `StorefrontHeader`, `Footer` trả `null`); các route auth khác giữ `AuthShell`.
- Route `/register`: dùng `RegisterPage` (chung `AuthEditorial` và `login.module.css` với `/login`), header riêng, không footer.

- Route `/favorites`: Sử dụng `AccountShell` (sidebar tài khoản độc lập) và `WishlistView`. Tích hợp với `loadWishlist()` từ `features/wishlist/service.ts`, tương tác ghi qua `/api/shop`.

- Route `/account`: Dùng `AccountShell` và `ProfileForm`. Nạp dữ liệu qua `shopActor()` và `prisma.user.findUnique`, gửi mutation profile qua `/api/shop`.

- Route `/account/orders`: Dùng `AccountShell` và `OrdersView`. Nạp dữ liệu qua `loadUserOrders(userId)` từ `src/features/orders/user-orders.ts`.

## Đánh giá sản phẩm thật (T04) — 13/11/2026
- Phân lớp nghiệp vụ tại `src/features/reviews/`: `types.ts` (DTO/trạng thái dùng chung cho client/server), `rules.ts` (kiểm tra điểm `1..5`, độ dài văn bản `1..1000`, tổng hợp trung bình), `use-cases.ts` (luồng gửi, kiểm tra đơn `DELIVERED` theo ID `OrderItem → ProductVariant.productId`, duyệt/ẩn/phản hồi chỉ `ADMIN`), và `service.ts` (`server-only`, transaction `Serializable`, capability guard `reviewsAvailable()`).
- Storefront & Admin routes: `src/app/products/[slug]/page.tsx` nạp tóm tắt sao (`findProductDetail`) và danh sách đánh giá `APPROVED` cùng trạng thái người xem rồi truyền `ProductReviewsSection` qua `reviewsSlot` của `ProductDetailView` (nằm trong cột phải `.information` thành 3 box: `.informationBody` giữ hộp cuộn `63dvh`, `You May Also Like`, và `ProductReviewsSection` dạng thread có ô nhập + chỉnh sửa/xóa; cột trái `.gallerySticky` ghim đồng bộ hết đáy cột phải); `GET/POST/PATCH/DELETE /api/reviews` phục vụ đọc công khai và gửi/sửa/xóa đánh giá (kiểm tra CSRF Origin + đăng nhập + quyền sở hữu); `/admin/reviews` (`SellerReviews`) và `GET/POST /api/admin/reviews` phục vụ kiểm duyệt & phản hồi chính thức của shop (kiểm tra role `ADMIN`).

## Vận hành sửa ảnh có caption bitmap — 14/11/2026
- Không thay kiến trúc/route/schema. Script scripts/repair-product-image-text.mjs thêm ImageAsset UUID mới và đổi riêng ProductImage.storageKey qua row lock + so sánh snapshot đầy đủ, bỏ qua xung đột để bảo vệ tác vụ song song. Route uploads vẫn kiểm quyền theo sản phẩm active và cấp phép cũ.
- Bản gốc không bị ghi đè/xóa; manifest, file trước/sau, SHA256, prompts và kết quả HTTP nằm data/repairs/product-image-text-2026-11-14/. Rollback phải CAS theo URL mới hiện hành. Báo cáo:../LOGS/PRODUCT_IMAGE_TEXT_REPAIR_2026-11-14.md.

## Chính sách cuộn vào PDP — 14/11/2026
- Shared client SmoothScroll dùng usePathname/useLayoutEffect để reset cả scroll position và animation target của Lenis khi pathname đổi sang /products/[slug]. Nhánh reducedmotion dùng native instant.
- popstate giữ khôi phục Back/Forward của browser/Next; hash và query không đổi pathname không bị reset. Không thay ranh giới server/client của PDP, routes/schema hoặc DAL.

## Trạng thái đăng ký thành công — 14/11/2026
- RegisterPage là server wrapper tính deliveryAvailable, truyền AuthEditorial server-rendered vào RegisterExperience client. Experience sở hữu state email; RegisterForm báo onCreated chỉ sau signup thành công, chỉ thay card form ở panel phải bằng RegistrationSuccess, giữ AuthEditorial bên trái trong cùng /register.
- Success dùng logo static hiện có và submitAuth verify, không thêm route/API/storage. Backend auth, callback xác minh và quy tắc auto-sign-in không đổi.
