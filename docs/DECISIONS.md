# DECISIONS — Architecture Decision Record

## ADR-060 — Luồng thử đồ riêng cho Túi/Phụ kiện (`cloth_type = "bag"`, `Accessory-Lock SCHP`) & bảo toàn khung ảnh dọc `9:16` cho Quần (`lower`) (15/11/2026)
- **Bối cảnh**: Người dùng phản hồi thử áo hoạt động tốt nhưng thử **quần** và **túi** bị lỗi. Kiểm tra thực tế cho thấy: (1) thử quần trên ảnh người mặc quần short chỉ mask vùng short khiến quần dài bị cụt ở đùi, đồng thời `resize_and_crop` xén mất đầu & giày trên ảnh `9:16`; (2) toàn bộ 10 sản phẩm túi (`accessories`) bị gán nhầm `cloth_type = "upper"`, khiến CatVTON xóa áo của người mẫu để vẽ méo chiếc túi lên ngực.
- **Quyết định**:
  - Phân tách rõ `"bag"` khỏi `"upper"` trong `TryOnClothType`; ưu tiên khớp `LOWER_TOKENS` trước `BAG_TOKENS` để `"QUẦN TÚI HỘP"` luôn đi qua luồng `"lower"`.
  - Với `"bag"`, dùng pipeline `_run_bag_tryon_sync` (`SCHP LIP + ATR` + alpha matting `distanceTransformWithLabels` + phát hiện/xóa túi cũ + đặt túi theo cổ tay/hông kèm bóng đổ tiếp xúc) thay vì đưa ảnh túi nền trắng vào UNet CatVTON vốn được huấn luyện cho trang phục mặc trên người.
  - Với ảnh người hẹp hơn `3:4`, đệm ngang `cv2.BORDER_REPLICATE` trong `_prepare_person_canvas` và cắt trả kích thước gốc khi ghép kết quả để giữ 100% đầu, gấu quần và giày.
- **Hệ quả / Trade-off**: Thử túi đạt tốc độ ~0.5–0.9s, giữ nguyên 100% quần áo và gương mặt người thật, không tạo halo trắng hay biến dạng logo túi; đổi lại vị trí cầm túi dựa trên 2D SCHP (tay/túi cũ) thay vì suy luận lại ngón tay cầm quai 3D, và thử quần short lên người đang mặc quần dài vẫn chịu giới hạn mask hình học của CatVTON 1-bước.

## ADR-059 — Cho phép Admin bật tự động đánh giá 5 sao mặc định cho sản phẩm chưa có đánh giá thật (13/11/2026)
- **Bối cảnh**: Chủ dự án yêu cầu bổ sung nút trong Admin để tự động đánh giá 5 sao cho tất cả sản phẩm, đồng thời cập nhật `AGENTS.md` để cho phép cấu hình đánh giá 5 sao mặc định từ Admin.
- **Quyết định**:
  - Lưu cấu hình bật/tắt tại `.data/aurel-auto-rating.json` qua `createAutoRatingStore` thay vì chèn đơn hàng giả hoặc bản ghi `ProductReview` giả (giữ sạch dữ liệu đơn hàng và FK `orderItemId` của `ProductReview`).
  - Dùng `resolveProductRatingWithAuto` để luôn ưu tiên đánh giá thật của khách hàng nếu sản phẩm đã có đánh giá `APPROVED`, và chỉ fallback về `{ average: 5, count: 1 }` khi chưa có đánh giá thật và chế độ đang bật.
  - Bảo vệ thao tác bật/tắt qua `POST /api/admin/reviews` (`action: "auto_five_star"`) bằng `shopActor()` kiểm tra `role === "ADMIN"` + `paymentBody(request, true)`.
- **Hệ quả / Trade-off**: Bật/tắt tức thì cho toàn bộ sản phẩm chỉ bằng 1 click và hoàn tác được bất kỳ lúc nào mà không làm bẩn PostgreSQL; vì dùng file `.data/aurel-auto-rating.json` nên phù hợp kiến trúc single-node hiện tại (và runtime snapshot cần trỏ junction `.data` về root như hiện tại).

## ADR-058 — Vị trí cụm 5 sao trên giá & Kiến trúc đánh giá thật T04 có kiểm duyệt và capability guard (13/11/2026)
- **Bối cảnh**: Người dùng phản hồi cụm 5 sao trong Admin Preview / PDP cần đặt phía trên giá thay vì dưới giá, và yêu cầu triển khai tính năng đánh giá thật từ khách hàng (T04: đánh giá sao & chữ lưu PostgreSQL, Admin duyệt trước khi hiển thị công khai), trong khi DB chính `aurel_ai` bị khóa migration tự động (`staged-migration-guard.mjs`) nếu chưa sao lưu/duyệt SQL thủ công.
- **Quyết định**:
  - Đưa `<ProductRating>` lên ngay dưới tiêu đề sản phẩm và phía trên `.priceRow` trong `ProductDetailView` để đồng bộ cả Admin Preview (`DEMO · Chưa có đánh giá thực` khi chưa có đánh giá thật) và Storefront PDP.
  - Bổ sung model `ProductReview` + enum `ReviewStatus` (`PENDING`, `APPROVED`, `HIDDEN`) với khóa duy nhất `[userId, productId]`, ràng buộc `CHECK (rating BETWEEN 1 AND 5)`, và migration cộng thêm `prisma/migrations/20261113211500_product_reviews/migration.sql`.
  - Tách logic thuần và use-case kiểm thử được (`src/features/reviews/rules.ts`, `src/features/reviews/use-cases.ts`) khỏi tầng Prisma/Next (`src/features/reviews/service.ts`), kiểm tra quyền mua hàng qua `Order.status = 'DELIVERED'` + `OrderItem.variant.productId === productId` trong transaction `Serializable` khóa `User`.
  - Dùng capability guard `reviewsAvailable()` (`to_regclass('public."ProductReview"') IS NOT NULL`) để PDP công khai và cổng `/admin/reviews` không bị lỗi 500 nếu `aurel_ai` chưa chạy migration mới.
- **Hệ quả / Trade-off**: Chống tuyệt đối đánh giá giả, đánh giá trùng và XSS (`render` văn bản thuần React), đảm bảo toàn vẹn điểm sao công khai (chỉ tính `APPROVED`), nhưng cần chạy migration `20261113211500_product_reviews` trên `aurel_ai` (sau bước sao lưu) để kích hoạt lưu DB thực tế trên localhost/production.

## ADR-057 — Phân tách trang `/try-on` dùng chung `TryOnStudio` & Đọc ảnh sản phẩm `/images/uploads/*.webp` qua `readPublishedImage` (13/11/2026)
- **Bối cảnh**: Khi thử đồ trực tiếp từ sản phẩm thật trong PostgreSQL (như `AUREL - ESSENTIAL SHIRT`), ảnh sản phẩm mang đường dẫn `/images/uploads/<uuid>.webp` không nằm dưới `public/images/uploads/` mà được lưu trong bảng `ImageAsset` và kiểm soát quyền công khai qua `ProductImage` (`websitePermission: "granted"`), khiến `POST /api/try-on` ban đầu trả `400 Bad Request`. Đồng thời cần đưa Virtual Try-On vào điều hướng chính và trang chi tiết sản phẩm.
- **Quyết định**:
  - Trong `src/app/api/try-on/route.ts`, khi `garmentImageUrl` bắt đầu bằng `/images/uploads/`, kiểm tra UUID hợp lệ qua `imageAssetId` và đọc buffer bằng `readPublishedImage(prisma, cleanPath)` (dynamic import `@/lib/db/client` và `@/features/products/image-storage` để giữ quyền kiểm tra ảnh xuất bản và không làm gãy unit test không bật `react-server`).
  - Tách `TryOnStudio` (`src/components/tryon/tryon-studio.tsx`) để dùng chung cho cả tuyến chính thức `/try-on` (Server Component đọc danh mục thật từ PostgreSQL, có fallback rỗng/lỗi DB) và cổng sandbox `/try-on-test`.
- **Hệ quả / Trade-off**: Sản phẩm thật trong cửa hàng thử đồ được ngay ở `~4.5s` mà không phải nhân bản file upload ra thư mục `public/`, vẫn bảo toàn ranh giới bảo mật giữa ảnh đã xuất bản và ảnh nháp Admin.

## ADR-056 — Tăng tốc CatVTON bằng Hyper-SD 8-steps (`CFG=1.0`) & Async Worker Thread thay vì ép 2 GPU Worker trên RTX 5060 8 GB (13/11/2026)
- **Bối cảnh**: Chủ dự án muốn xử lý 2 ảnh Try-On đồng thời dưới 10 giây và đặt câu hỏi liệu có thể chạy đa luồng (2 threads / 2 GPU workers) trên máy hiện tại hay không.
- **Số liệu kiểm chứng thực tế**:
  - Laptop chỉ có 1 GPU vật lý (`NVIDIA GeForce RTX 5060 Laptop GPU`, `8151 MiB` VRAM). Chạy 2 threads / 2 CUDA streams song song (15 steps) làm nghẽn Tensor Cores và tăng tổng thời gian lên **`41.16s`** (`2.5×` chậm hơn tuần tự `16.40s`), còn nạp 2 model chiếm `4177.9 MB` weights nên khi suy luận song song sẽ tràn ngưỡng 8 GB VRAM.
  - Thử nghiệm 4–8 steps LoRA cho thấy `Hyper-SD 8-steps` (`CFG=1.0`, `DDIMScheduler` `timestep_spacing="trailing"`) giữ chi tiết dệt kim và ve áo khoác camel sắc nét hơn `Hyper-SD 4-steps` và `LCM-LoRA`, đồng thời giảm inference xuống `2.40–2.42s/ảnh`.
- **Quyết định**:
  - Fuse trực tiếp trọng số `Hyper-SD15-8steps-lora.safetensors` vào UNet khi khởi động (`_fuse_kohya_lora`, cấu hình qua `CATVTON_ACCEL=hyper8|hyper4|none`), không phụ thuộc `peft` và không phát sinh overhead runtime.
  - Giữ hàng đợi `asyncio.Semaphore(1)` để mỗi request độc chiếm 100% Tensor Cores không bị context thrashing, đồng thời bọc `_run_tryon_sync` bằng `asyncio.to_thread` để `/health` không bị block trong suốt quá trình suy luận.
- **Hệ quả / Trade-off**: Latency thực tế qua HTTP đạt **`3.29s/ảnh đơn`**, **2 ảnh gửi đồng thời hoàn tất trong `5.52s`** (đạt mục tiêu `< 10s`) và `/health` phản hồi trong `12.1 ms`; vẫn giữ fallback `CATVTON_ACCEL=none` về `DPMSolver++ 15 steps CFG=2.5` nếu cần.

## ADR-055 — Face-Lock Pixel Compositing (`768×1024`) & Tách Face theo LIP (13/11/2026)
- **Bối cảnh**: Sau khi hạ kích thước tính toán CatVTON về `576×768` để đạt ~8s/ảnh, ảnh toàn thân có kích thước mặt nhỏ bị nén/giải mã 8× qua SD-VAE ở `bfloat16` khiến mắt/môi hơi biến dạng. Đồng thời nhãn `Face` của SCHP-ATR bao gồm cả vùng da cổ/xương quai xanh nên từng đục 2 vết khuyết ở vai áo khi phối mask với `Face | Hair`.
- **Quyết định**:
  - Giữ suy luận diffusion ở `576×768` (~7.4–7.6s), nhưng sau suy luận ghép trả kết quả lên khung gốc `resize_and_crop` ở `768×1024` (`_composite_preserve_identity`) với alpha feather `(7, 7)` chỉ nằm trong vùng mask áo và khóa cứng `alpha = 0` trên toàn bộ mặt/tóc/nền/quần gốc.
  - Dùng nhãn `Face` của **SCHP-LIP** (dừng đúng đường cằm, chỉ fallback ATR khi trống) và lọc bỏ thành phần rời rạc nhỏ (`_keep_main_components`) để mask cổ/vai liền mạch.
- **Hệ quả / Trade-off**: Khuôn mặt, tóc, quần và nền giữ 100% pixel gốc ở độ nét `768×1024` (không bị biến dạng bởi VAE) mà tổng thời gian thử đồ vẫn chỉ ~8.3s.

## ADR-054 — Tối ưu tốc độ CatVTON trên RTX 5060: DPM-Solver++ (15 steps) + `576×768` + Startup Warmup (13/11/2026)
- **Bối cảnh**: CatVTON mặc định (`768×1024`, `30` steps DDIM, `CFG=2.5`) mất `~39.5s/ảnh`, và khi bật `cudnn.benchmark` nhưng không warm-up trước thì request đầu tiên bị trễ thêm `~48–62s` dò kernel SCHP/UNet.
- **Quyết định**:
  - Thay `DDIMScheduler` bằng `DPMSolverMultistepScheduler` (`dpmsolver++`) giúp giảm số bước khử nhiễu xuống `15` steps (`18` steps nếu chạy `768×1024`).
  - Đặt cấu hình mặc định `576×768` (`CATVTON_WIDTH`/`CATVTON_HEIGHT`/`CATVTON_STEPS`/`CATVTON_GUIDANCE` cho phép chỉnh về `768×1024` khi cần).
  - Bật `torch.backends.cudnn.benchmark = True` kèm `_warmup()` 2 bước trong `TryOnEngine.load()` để toàn bộ autotune xảy ra 1 lần lúc khởi động server.
  - Giữ `guidance_scale=2.5` thay vì hạ xuống `1.0` vì thử nghiệm thực tế cho thấy `CFG=1.0` (~4–5s ở `576×768`, ~12.2s ở `768×1024`) đôi khi gây nhiễu mép tay áo.
- **Hệ quả / Trade-off**: Thời gian xử lý đầu-cuối HTTP giảm từ `~39.47s` xuống **`8.04s`** (~4.9× nhanh hơn) trong khi ảnh `576×768` vẫn sắc nét, giữ nguyên chi tiết dệt kim, khuôn mặt và trang phục bảo vệ.

## ADR-053 — Nâng cấp sang CatVTON (`768×1024`, BF16) + SCHP thuần PyTorch (13/11/2026)
- **Bối cảnh**: DM-VTON (`192×256`, parser-free VITON-Clean) cho ảnh mờ khi phóng to và ghép nhầm áo lên vùng quần khi người dùng tải ảnh toàn thân. Chủ dự án chọn Phương án 2 (đổi sang model HD phù hợp RTX 5060 8 GB VRAM).
- **Quyết định**: Dùng `CatVTONPipeline` (`mix-48k-1024`, `bfloat16`) kết hợp **SCHP** (LIP + ATR) viết thuần PyTorch trong `backend/tryon-service/app.py`, bỏ phụ thuộc `DensePose`/`detectron2` để chạy mượt trên Windows.
- **Hệ quả / Trade-off**: Chất lượng đầu ra `768×1024` sắc nét, giữ nguyên khuôn mặt/tóc/quần/nền; thời gian xử lý tăng từ ~0.6s lên ~38s/ảnh trên RTX 5060 Laptop GPU.

## ADR-052 — Kiến trúc AI Virtual Try-On cục bộ với DM-VTON trên RTX 5060 (`sm_120`) (13/11/2026)
- **Bối cảnh**: Cần tích hợp tính năng thử đồ ảo (DM-VTON) chạy local trên Windows với GPU NVIDIA RTX 5060 (`sm_120`), không dùng API trả phí và không public dịch vụ AI ra Internet. DM-VTON gốc dùng PyTorch 1.13 + `cupy-cuda11x` (`compile_with_cache`), không hỗ trợ `sm_120` và Python 3.15 trên host chưa có wheel PyTorch CUDA.
- **Quyết định**:
  - Dùng môi trường Python `3.12.10` riêng (`backend/tryon-service/.venv`) với PyTorch `2.11.0+cu128` và `cupy-cuda12x[ctk]` (CUDA 12.9 NVRTC).
  - Vá tối thiểu 2 điểm tương thích trong `backend/dm-vton`: `cupy.RawModule` thay `cupy.cuda.compile_with_cache` (`models/common/correlation.py`) và `weights_only=False` (`utils/torch_utils.py`).
  - Đặt FastAPI trên `127.0.0.1:8001` (nội bộ), giao tiếp qua Next.js API route `POST /api/try-on`, dùng `asyncio.Semaphore(1)` chống quá tải GPU và cache LRU tensor/mask trang phục.
- **Hệ quả / Trade-off**: Chạy thật mượt trên RTX 5060 (~25–106 ms GPU inference, 155 MB VRAM) mà không giả lập. Lưu ý giấy phép DM-VTON là **CC BY-NC-SA 4.0** (phi thương mại), cần lưu ý nếu đưa lên môi trường thương mại chính thức.

## ADR-051 — Giao diện Nhắn tin Quiet Luxury & Route Chuyển hướng riêng `/messages/connecting` (13/11/2026)
- **Bối cảnh**: Giao diện chat trước đây dùng bảng màu tối `#18191a` và xanh dương `#0084ff` giống Facebook Messenger, còn màn hình chờ 2 giây hiển thị dạng popup overlay đè lên trang hiện tại.
- **Quyết định**:
  - Tách màn hình chuyển hướng thành route riêng `/messages/connecting` (`src/app/messages/connecting/page.tsx`) với thiết kế editorial đồng bộ nền gợn sóng kem ấm của AUREL, tự động `router.replace("/messages")` sau 2 giây.
  - Thống nhất toàn bộ UI chat khách hàng (hộp thoại phải + `/messages`) và Admin (`/admin/messages`) sang bảng màu kem `#fcf7f2`, trắng ngà `#fffdfb`, espresso `#322720`, nâu đồng `#68452f` và tiêu đề serif.
- **Hệ quả / Trade-off**: Người dùng có trải nghiệm liền mạch, sang trọng đúng nhận diện thương hiệu AUREL từ lúc bấm icon chat đến khi vào phòng tư vấn; giữ nguyên logic backend (`/api/chat`, `/api/admin/messages`, bot chăm sóc) không làm xáo trộn dữ liệu.

## ADR-050 — Gộp thanh tìm kiếm và bộ lọc `/products` thành 1 thanh pill rút gọn + nền gợn sóng CSS thuần (13/11/2026)
- **Bối cảnh**: Thanh tìm kiếm + bảng lọc 2 hàng trước đây chiếm nhiều chiều cao trên `/products?gender=women`, `/products?gender=men` và có khung viền focus hình chữ nhật quanh `<input>`.
- **Quyết định**:
  - Tách `CatalogSearchFilterBar` thành client component riêng với thanh pill hợp nhất (ô tìm kiếm bên trái + 5 nút dropdown `Bộ lọc`, `Danh mục`, `Màu`, `Giá`, `Size` bên phải), dùng `<Link>` + HTML `<form method="get">` để đảm bảo SSR-safe và giữ nguyên URL params qua `buildCatalogHref`.
  - Đồng bộ nền trang `.page` bằng `background-color: #fbf7f3` và 4 lớp `radial-gradient` tạo mảng gợn sóng ấm dịu nhẹ thay vì dùng ảnh nền ngoài, giúp tải tức thì (0 KB) và sắc nét trên mọi độ phân giải.
- **Hệ quả / Trade-off**: Giao diện gọn hơn đáng kể trên desktop/laptop, tự động xuống hàng mượt trên màn hình nhỏ (`max-width: 960px`); bộ lọc giới tính nằm gọn trong nút `Bộ lọc` kèm đếm số bộ lọc đang kích hoạt.

## ADR-049 — Phân tách chế độ Explore Search Hero và Filtered Catalog Browse trên `/products` (12/11/2026)
- **Bối cảnh**: Trước đây `/products` dùng điều kiện `!query.q && !query.invalid` để quyết định hiện Search Hero (`WHAT ARE YOU LOOKING FOR?`), làm cho các đường dẫn bộ lọc không có `q` (ví dụ `/products?gender=women`, `/products?category=ao`) bị ẩn toàn bộ sản phẩm. Ngoài ra `findSearchPage` không truyền `catalogWhere(query)` vào SQL khi người dùng vừa tìm kiếm `q` vừa lọc theo giới tính/danh mục/size/màu/giá.
- **Quyết định**:
  - Tạo hàm `hasAnyFilter(query)` kiểm tra đầy đủ `q`, `gender`, `category`, `brand`, `size`, `color`, `minPrice`, `maxPrice`, và `page` (> 0). Chỉ render Search Hero khi URL `/products` hoàn toàn trống (đồng thời thêm liên kết duyệt nhanh sang `/products?page=1`, `/products?gender=women`, `/products?gender=men`).
  - Khi `hasAnyFilter(query)` là `true` hoặc `query.invalid`, render thanh lọc Storefront (`CatalogFilterBar`) giữ trạng thái URL chuẩn qua `buildCatalogHref`, đồng thời chuyển link `"Shop"` trên header sang `/products?page=1`.
  - Áp dụng `catalogWhere(query)` trong `findSearchPage` và hydrate `tags` trong `findCatalogPage`.
- **Hệ quả / Trade-off**: Không cần route mới hay thay đổi DB schema; URL `/products?gender=women` tương thích ngược hoàn toàn với các link hiện hữu trên homepage, editorial và SEO. Việc dùng HTML `<form method="GET">` kết hợp `<Link>` giúp thanh lọc hoạt động ổn định cả khi chưa hydrate JS.

## ADR-048 — Thu gọn Danh mục, Thẻ Tag tìm kiếm (`;`) không đổi Schema DB & Mapping Phối đồ Chéo (12/11/2026)
- **Quyết định**:
  1. Thu hẹp danh mục trang phục xuống 6 nhóm chính (`Áo`, `Áo Khoác`, `Quần`, `Đầm`, `Chân Váy`, `Phụ Kiện`), chuyển chi tiết loại trang phục (`áo polo`, `áo thun`, `cardigan`, `trench coat`...) sang trường **Thẻ Tag tìm kiếm** phân cách bởi dấu `;`.
  2. Lưu trữ Thẻ Tag tại `.data/aurel-product-tags.json` qua `createProductTagStore` để giữ nguyên 100% Prisma schema & tránh migration đột xuất, đồng thời truyền danh sách `tagMatchedIds` trực tiếp vào truy vấn SQL `findSearchPage` và chấm điểm `rankCatalogProducts`.
  3. Tách ý định hội thoại tiếng Việt (`extractSearchIntent`) để câu tìm kiếm tự nhiên như *"Hôm nay tôi muốn mua áo polo"* tìm chính xác nhóm sản phẩm `áo polo`.
  4. Triển khai `outfit-mapping.ts` ánh xạ phối đồ theo slot (`TOP` $\rightarrow$ `BOTTOM`/`OUTERWEAR`, `OUTERWEAR` $\rightarrow$ `TOP`/`BOTTOM`, `BOTTOM` $\rightarrow$ `TOP`/`OUTERWEAR`) cho mục `You May Also Like` ở cả PDP và `/products`.

## ADR-047 — Quy chuẩn tên sản phẩm `AUREL - TÊN SẢN PHẨM` (IN HOA & Loại bỏ số) (12/11/2026)
- **Quyết định**: Cập nhật `formatAurelProductName` để gỡ bỏ tiền tố `AUREL` cũ (có dấu cách hoặc dấu gạch `—` / `-`), xóa toàn bộ các chữ số (số thứ tự đầu dòng như `11. `, số nhúng, cụm giá số như `1.000đ`), chuyển phần tên còn lại sang IN HOA tiếng Việt và gắn tiền tố thống nhất `AUREL - TÊN SẢN PHẨM`; đồng thời cập nhật toàn bộ bản ghi `Product.name` hiện có trong PostgreSQL và hỗ trợ `aurel - <term>` trong SQL ranking.
- **Lý do**: Đảm bảo nhận diện thương hiệu đồng nhất trên storefront và trang quản trị theo chuẩn chữ hoa kèm gạch nối ngang và loại bỏ số thứ tự thừa khỏi tên hàng hóa, trong khi vẫn giữ nguyên `slug` để không làm gãy URL/liên kết cũ.

## ADR-046 — Quy tắc Bot trả lời 1 lần lúc mở đầu & Giao diện 3 cột chuẩn Messenger (12/11/2026)
- **Bối cảnh**: Người dùng yêu cầu Bot chỉ tự động nhắn khi khách nhấn "Bắt đầu cuộc hội thoại" hoặc trả lời tin nhắn đầu tiên vừa nhắn, phần hội thoại còn lại nhường cho nhân viên; giao diện được thiết kế theo phong cách Messenger Dark Desktop (theo ảnh tham chiếu).
- **Quyết định**:
  - Bổ sung cờ `hasStarted` và bộ đếm `botReplyCount` trong `ChatConversation`. Khi `botReplyCount === 0`, Bot phản hồi 1 lần cho tin nhắn mở đầu và tự động chuyển `mode = "WAITING_STAFF"` (`botReplyCount = 1`) để các tin nhắn sau chuyển thẳng cho nhân viên trên `/admin/messages` (chỉ chạy lại Bot khi người dùng hoặc nhân viên bấm bật lại Bot).
  - Áp dụng Messenger Dark UI (nền `#18191a` / `#242526`, input `#3a3b3c` placeholder `Aa`, bong bóng `#0084ff` / `#303030`, nút 👍, bố cục 3 cột gồm Rail icon, danh sách `"Đoạn chat"` và khung chat chính) đồng nhất cho `/messages`, `/admin/messages` và Popup Drawer bên phải.

## ADR-045 — Kiến trúc Nhắn tin 2 chiều Khách hàng – Shop & Bot Chăm sóc Tự động không sửa Schema DB (12/11/2026)
- **Bối cảnh**: Cần triển khai nhanh hệ thống nhắn tin khách hàng $\leftrightarrow$ shop, bot chăm sóc khách hàng, màn hình chuyển hướng 2 giây (click 1 lần) và hộp thoại bên phải (click 2 lần trên laptop, mobile đi thẳng `/messages`), đồng thời tuân thủ nghiêm ngặt quy tắc không tự ý sửa Prisma schema hay chạy migration và đảm bảo trang vẫn hoạt động ổn định khi PostgreSQL offline.
- **Quyết định**:
  1. Lưu trữ hội thoại bằng atomic JSON file lock-safe (`.data/aurel-chat-sessions.json` qua `createChatStore`) tách biệt khỏi schema DB hiện hữu; hỗ trợ cả người dùng đã đăng nhập (`user:<id>`) và khách vãng lai qua HttpOnly cookie `aurel_chat_guest`.
  2. Triển khai `AUREL Concierge Bot` hoàn toàn deterministic tại server (`src/features/chat/care-bot.ts`), tận dụng `findSearchPage` khi DB online để gợi ý sản phẩm thật và fallback an toàn không bịa dữ liệu khi DB offline; hỗ trợ chuyển tiếp nhân viên (`WAITING_STAFF` / `STAFF`) để nhân viên shop nhắn trực tiếp từ `/admin/messages` (bảo vệ bằng `sellerActor()`).
  3. Phân biệt tương tác ở `ChatProvider`: Mobile (`< 768px`) điều hướng tức thì `/messages`; Laptop (`>= 768px`) phân tách 1-click (màn hình load 2 giây kèm mẹo) và double-click (hộp thoại bên phải `max-height: calc(100dvh - 90px)`).
- **Trade-off**: Dữ liệu hội thoại lưu cục bộ trên Node filesystem phù hợp single-instance Windows/VPS hiện tại; khi mở rộng multi-instance cloud sẽ dễ dàng chuyển đổi `createChatStore` sang bảng PostgreSQL riêng thông qua migration được phê duyệt.

## ADR-044 — Thuật toán Tìm kiếm Đa Tầng Thông minh & Chuẩn hóa tiền tố AUREL (10/11/2026)
- **Bối cảnh**:
  - Khách hàng yêu cầu toàn bộ sản phẩm của hệ thống phải có tiền tố thương hiệu `"AUREL "` ở đầu tên sản phẩm.
  - Tìm kiếm thời trang thương mại điện tử gặp vấn đề lớn: khách hàng gõ từ khóa tiếng Việt hoặc tiếng Anh không liên tục (ví dụ: "trench coat nâu", "áo khoác", "nâu coat"), gõ không dấu, hoặc gõ theo màu sắc/danh mục; câu lệnh `LIKE %term%` liên tục trước đây trả về 0 kết quả nếu từ ngữ bị đảo hoặc khác ngôn ngữ.
- **Quyết định**:
  1. **Chuẩn hóa tiền tố AUREL**: Triển khai `formatAurelProductName` tại mapper dữ liệu (`mapCatalogProduct`, `dto`, `managementList`) và validation (`validateEditor`). Đảm bảo tính idempotent, tự động chuẩn hóa chữ hoa và chống lặp `AUREL AUREL`.
  2. **Thuật toán Tìm kiếm Đa Tầng Kết Hợp (Multi-stage Hybrid Fashion Search Algorithm)**:
     - *Tách từ & Chuẩn hóa NFD*: Khử dấu tiếng Việt, đưa về chữ thường, tách token và loại bỏ stopwords.
     - *Từ điển đồng nghĩa thời trang 2 chiều Việt - Anh (`FASHION_SYNONYM_GROUPS`)*: Tự động mở rộng từ khóa tương đương giữa tiếng Việt và tiếng Anh (áo khoác <-> coat/jacket/trench, áo len <-> knit/sweater, quần <-> trousers/pants, nâu <-> brown/camel/caramel, v.v.).
     - *Mô hình tính điểm tương đồng trọng số đa trường*: Chấm điểm độc lập cho Title exact (+250), prefix (+140), all tokens (+80), SKU (+300), Category (+50), Color/Size (+40), Description (+25).
     - *Không phụ thuộc thứ tự từ*: Người dùng gõ "trench coat nâu" hay "nâu trench coat" đều định vị chính xác sản phẩm "AUREL Brown Trench Coat (Nam)" lên Top 1 ngay khi nhấn Enter.
     - *SQL Token Matching + Deterministic Re-ranking*: Nâng cấp câu lệnh SQL PostgreSQL kết hợp re-ranking tại memory boundary để đảm bảo kết quả chính xác tuyệt đối.
- **Trade-off**: Mở rộng từ khóa tạo thêm điều kiện OR trong truy vấn SQL; giới hạn tối đa 4 từ đồng nghĩa mỗi token để đảm bảo thời gian thực thi trong ngưỡng tối ưu.

## ADR-043 — Tinh gọn Sidebar Quản trị và Chuyển đổi Dark Chocolate Theme đồng bộ (10/11/2026)
- Quyết định: Loại bỏ các khối cũ ("Bộ sưu tập", "Tra cứu danh mục", "Nhập / xuất CSV", "Trạng thái") theo ảnh người dùng chỉ định; chuyển toàn bộ thanh sidebar quản trị sang nền Deep Espresso / Dark Chocolate (#241812) với logo AUREL ở đỉnh, menu 9 mục chuẩn Enterprise SaaS (Tổng quan, Đơn hàng [badge 12], Sản phẩm [active state be sáng #ebdcd0 bo góc 12px], Danh mục, Kho hàng, Khuyến mãi, Khách hàng, Báo cáo, Cài đặt) và card banner quảng bá hiệu quả quản trị ở đáy.
- Lý do: Tinh giản luồng người dùng, đồng nhất nhận diện thương hiệu thời trang cao cấp AUREL theo mockup tham chiếu; chuyển việc lọc danh mục và trạng thái về thanh Filter Bar và 4 thẻ KPI trên trang chính thay vì dàn trải phức tạp trong sidebar.
- Trade-off: Sidebar không hiển thị trực tiếp danh sách collection hoặc link CSV; các liên kết điều hướng tập trung vào các trang quản trị chính (/admin/products, /admin/orders, /admin/orders/reports, /admin/vouchers).

## ADR-042 — Search tiếng Việt bằng PostgreSQL `translate`, không thêm extension — 02/11/2026
- Chọn query parameterized dùng `translate(lower(text), source, target)` và rank CASE, sau đó hydrate IDs bằng catalog select chung trong RepeatableRead.
- Lý do: hỗ trợ truy vấn có/không dấu ngay trên database, xếp hạng rõ, bounded pagination và không cần `unaccent`, search service hay migration/index chưa có benchmark.
- Trade-off: normalize expression chưa dùng index; recommendation chỉ latest-active vì chưa có featured/sales signal chuẩn. Chỉ thêm generated search vector/index sau EXPLAIN và migration review.

## 02/11/2026 — Cloudflare Tunnel cho ingress public

- Chọn named Cloudflare Tunnel làm đường vào chuẩn bị cho `aureluxury.store`: connector chạy outbound từ host Windows tới Cloudflare và upstream Next.js chỉ bind loopback. Launcher không mang token trong source; token chỉ đọc từ environment cục bộ.
- Trade-off: giảm việc mở port/cấu hình reverse proxy Nginx trong giai đoạn này và giữ HTTPS/public DNS tại Cloudflare, nhưng phụ thuộc connector Cloudflare và owner phải hoàn tất tunnel/public hostname trong account. Nginx không bị cấu hình khi chưa có xác nhận riêng.

Only meaningful and durable decisions belong here. When a decision changes, mark the old one as superseded instead of silently deleting it.

## ADR-030 — Thuộc tính riêng dùng JSONB có validation cấu hình (02/11/2026)

Chọn thêm `ProductProfile.dynamicAttributes` JSONB thay vì tạo bảng/column cho từng thuộc tính may mặc. Cấu hình server-side xác định key, option và type applicability; backend reject payload không phù hợp. Cách này giữ schema additive, không động vào variants/giá/hàng cũ và sẵn sàng cho filter deterministic; đổi lại, index/filter chuyên sâu theo từng key sẽ cần migration chỉ mục riêng khi use case search đã được xác nhận.

## ADR-006 — Fashion search dùng matcher demo và giữ đường GET production
- Ngày: 2026-10-13. Quyết định: local matcher thuần trên fixture riêng, state draft/submitted query ở CollectionDiscovery, category giữ trong CollectionGrid và kết hợp query. Production/no-JS gửi /search, không dựng API/AI giả.
- Lý do: reader hiện rỗng, mock đã có trong panel; cần tìm kiếm thật trên mock và không thay đổi schema/storefront khác. Adapter/logic tách UI để sau này nối API search có backend thực.
- Đánh đổi: keyword matching AND, bỏ từ nối; không hiểu ngữ nghĩa hay tư vấn phối đồ. Suggestion “What goes with wide-leg trousers?” tìm từ khóa trousers, không tạo outfit recommendation. Fields màu/mô tả chỉ thêm cho fixture demo, không phát minh thuộc tính bản ghi thật.

## ADR-005 — Reveal không thư viện animation và preview tách dữ liệu thật
- Cập nhật 2026-10-20: phần fallback fixture khi catalog rỗng được thay thế bởi ADR-007; motion/layout giữ nguyên.
- Ngày: 2026-10-13. Trạng thái: triển khai code, chờ browser QA.
- Quyết định: giữ nguyên HeroSection/CSS và bọc bằng client CollectionReveal nhận server children. Sticky hero + panel document flow + clip-path ngang thực hiện 92→100% mà không scale chữ hoặc layout lại grid. rAF cập nhật CSS variable, IntersectionObserver quản lý fade/translate và vùng hoạt động; không React render theo scroll.
- Đánh đổi: clip-path vẫn cần profiling compositor trong browser, chưa có số đo hiệu năng. Portrait/mobile không pin hero cao nhiều panel; reduced-motion/no-JS giữ flow đọc được.
- Dữ liệu: fixture demo thuộc features/collection, không seed/đưa vào reader; lỗi không được thay bằng demo, dữ liệu thật luôn ưu tiên. SVG placeholder ban đầu đã được thay bằng ảnh mock AI dạng photography có nhãn công khai để đáp ứng brief; giá ví dụ ghi demo. Không thêm route giả hoặc wishlist giả. Không sửa schema production chỉ để phục vụ mock.

## ADR-004 — Cô lập header/hero AUREL trong phạm vi trang chủ
- Ngày: 2026-10-13. Trạng thái: code đã triển khai, chờ ảnh gốc và visual QA.
- Quyết định: Hero Server Component và CSS module; client wrapper chọn header theo pathname, dùng native dialog cho menu và thông tin tài khoản. Giữ layout/routes và toàn bộ section khác.
- Lý do: yêu cầu chỉ sửa header/hero; không thêm hệ thống auth, catalog hay dependency. Collections/Journal trỏ section đã tồn tại, Accessories về catalog chung vì chưa có category phụ kiện.
- Đánh đổi: header cũ đi qua client boundary, tăng JS nhỏ; tránh tái cấu trúc route groups. Native dialog cần kiểm tra bàn phím trong browser. Font serif hệ thống giữ build offline nhưng không đảm bảo giống font screenshot tuyệt đối.
- Thay thế phần minh họa CSS của ADR-002 chỉ tại hero; dữ liệu sản phẩm và kiến trúc server-only không đổi.

## ADR-001 — Initial architecture proposal (pending implementation)
- Date: 2026-10-13
- Status: Proposed
- Context: Need a Node.js storefront that is usable without product data and can later integrate AI.
- Decision: Prefer Next.js App Router + TypeScript, Tailwind CSS, PostgreSQL + Prisma; keep AI inference as an optional later service.
- Reasons: One full-stack project for the MVP, feature-driven separation, practical path to growth.
- Trade-offs: Server and UI live in one application; complex integrations may eventually justify extracting a backend.
- Revisit when: Existing code is found to use another stack, or scaling / service isolation creates clear benefits.

## ADR-002 — Triển khai nền tảng không phụ thuộc database
- Cập nhật 2026-10-20: reader tạm [] được thay thế bởi ADR-007; khung storefront vẫn dùng được khi DB lỗi/rỗng.
- Ngày: 2026-10-13.
- Trạng thái: Đã triển khai theo phạm vi Phase 0 được yêu cầu; hiện thực phần frontend của ADR-001, PostgreSQL/Prisma vẫn thuộc Phase 1.
- Quyết định: Next.js App Router + TypeScript strict + Tailwind, Server Components mặc định; reader server-only tạm trả [] và feature service nhận reader để phân biệt success/error.
- Lý do: Trang chủ phải hoạt động không cần kết nối/seed; kiểm thử được lỗi mà không có dữ liệu demo hoặc endpoint debug công khai.
- Đánh đổi: Chưa có truy vấn dữ liệu/lọc thật; khi tích hợp DB phải bổ sung schema, reader, logging và chiến lược cache phù hợp. Nhánh sản phẩm thành công mới là hiển thị tên tối thiểu.
- Thiết kế: Token tập trung, font hệ thống và minh họa CSS không có phụ thuộc ảnh/font ngoài. Giữ toàn bộ quyết định nhận diện ở trạng thái tạm thời chờ chủ dự án duyệt.

## ADR-003 — Giữ bộ lint tương thích và ghi nhận rủi ro upstream
- Ngày: 2026-10-13.
- Trạng thái: Tạm thời, cần theo dõi cập nhật.
- Quyết định: Dùng eslint-config-next cùng major Next.js và ESLint 9.39.5 theo peer ranges của plugin import/jsx-a11y/react. Thử ESLint 10 phát sinh xung đột peer nên đã quay lại.
- Đánh đổi: ESLint 9 đã bị npm đánh dấu hết hỗ trợ; full audit báo 5 mục high bắt nguồn từ braces trong chuỗi lint. Production audit không có cảnh báo. Không áp dụng hạ major eslint-config-next do audit fix --force đề xuất.
- Xem lại: Khi upstream hỗ trợ ESLint mới và vá dependency; chạy lại lint, typecheck, build, audit trước khi nâng.
# 2026-10-13 — Editorial lookbook độc lập và dữ liệu demo
- Đặt AurelEdit ngoài CollectionReveal: tránh clip-path/sticky containment ảnh hưởng chuỗi ngang, giữ hero/collection hiện có.
- Desktop dùng native document scroll + sticky, chiều cao dựa trên overflow đo thực; mobile, viewport thấp và reduced-motion dùng native horizontal carousel. Không thêm animation dependency. Trade-off: runtime scroll/resize cần QA browser riêng, build không chứng minh hành vi.
- Campaign chưa có dùng image null và CSS placeholder, thumbnail tái sử dụng local demo; CTA mua ở trạng thái không mua được. Dữ liệu content typed độc lập catalog giúp thay assets/products thật mà không đổi layout.

# 2026-10-20 — PostgreSQL portable cho môi trường dev Windows
- Dùng binary PostgreSQL EDB trong `.local/postgres`, không cài Windows service, không đổi cấu hình hệ thống. Khởi tạo cluster bằng credentials local trong `.env`, SCRAM-SHA-256, chỉ lắng nghe localhost; dữ liệu/log/binary không vào Git.
- Trade-off: không cần Docker hoặc quyền cài service, nhưng cần chạy `db:start` sau khi restart Windows và tự quản lý backup thư mục data. Không phải cấu hình production.
- Health check dùng SELECT 1 độc lập seed và inventory; giữ reader storefront hiện tại để database lỗi hoặc rỗng không phá homepage.

## ADR-007 — Catalog Prisma server-side và DTO không phụ thuộc ORM
- Cập nhật Phase 2.2: offset pagination và service quản trị theo ADR-008; currency vẫn chưa được gán hoặc migrate.
- Ngày: 2026-10-20. Đã triển khai. Giữ `getCatalog(query)` và union success/error; lazy import Prisma bên trong reader để cả lỗi thiếu cấu hình được xử lý. Không cache snapshot catalog ở homepage; `/` render động, lỗi không biến thành [] hoặc demo.
- Mapper thuần giữ Prisma Decimal thành chuỗi thập phân 2 chữ số, ID chuỗi và metadata thật. Chỉ chọn Product/Category/active ProductVariant/ProductImage; giữ stock=0 để phân biệt hết hàng với không tồn tại. Giá hiển thị là giá thấp nhất active variants, không tự gán currency khi schema chưa có.
- Ảnh chỉ resolve đường public `/images/`; private/remote storage key trả null tới khi có resolver được cấu hình. Không đưa raw key hoặc dữ liệu người dùng vào DTO. Query ở module server-only, mapper chỉ import type Prisma nên không kéo DB client vào client bundle.
- Đánh đổi: mỗi request có DB read; chưa pagination/caching, chưa currency/storage resolver. Giữ thiết kế và các slot dữ liệu hiện có thay vì mở rộng UI mua hàng. Unit fixtures chỉ tồn tại trong tests, integration chỉ đọc DB, không seed/reset.

## ADR-008 — Product Data Service đóng quyền mặc định, không đổi schema
- Cập nhật Phase 2.3: resolver mặc định Better Auth và schema auth additive theo ADR-009; model nghiệp vụ không đổi.
- Ngày: 2026-10-20. Triển khai service CRUD server-only, không public API/Admin UI. Backend phải truyền session resolver xác minh thật; mỗi operation tra lại User.role trong DB transaction. Không cung cấp resolver mở quyền hoặc nhận role từ input.
- Product/variant dùng deactivate, category delete chịu FK, image delete metadata. Stock dùng compare-and-set expectedStock/delta và Serializable transaction để tránh ghi đè; trả CONFLICT thay vì auto retry. Giá nhận chuỗi đúng Decimal(12,2); không tự currency hoặc round.
- Currency migration mới chỉ đề xuất: mã ISO 4217 theo giá + snapshots đơn hàng, xác nhận minor units và currency dữ liệu cũ trước backfill; chưa áp dụng vì chưa có quyết định kinh doanh. Xem PRODUCT_DATA_SERVICE.md.
- Ảnh dùng resolver chung public raster `/images/`; key public/products chỉ metadata cho tới khi có storage provider. Không công khai key private hoặc tự tạo URL remote. Catalog thêm getCatalogPage và bounded offset pagination; interface getCatalog cũ không đổi.
- Đánh đổi: offset cần cursor khi dữ liệu lớn, auth/provider và storage chưa có, CRUD integration mutation cần DB thử riêng. Giữ nguyên schema/migrations và không tạo dữ liệu test trong PostgreSQL theo giới hạn task.

## ADR-009 — Better Auth backend, bảo toàn User Int và dữ liệu nghiệp vụ
- Cập nhật Phase 2.4: positive PostgreSQL integration đã có trên DB test riêng theo ADR-010; không tạo fixture ở DB ứng dụng.
- Ngày: 2026-10-20. Người dùng chọn Better Auth và cho phép migration cần thiết sau review SQL. Chọn generateId serial cho toàn bộ auth IDs; map name → fullName, không đổi User Int PK/FK nghiệp vụ và không dùng CLI overwrite schema. Session/Account/Verification mới, User chỉ thêm emailVerified=false/image nullable. Giữ passwordHash legacy chưa tự migrate.
- Dùng Prisma singleton và transaction adapter, cookie DB session không cache; Product service mặc định lấy session qua Next headers/Better Auth. Role do DB quyết định mỗi operation, client không ghi role; expiresAt là số epoch milliseconds bắt buộc và recheck trong biên authorization. Không tạo ADMIN hoặc product mutation endpoint.
- Secret local random, origin cố định và giữ CSRF/origin checks. Không thêm UI. Chưa email verification/reset do chưa chọn mail provider; không gắn emailVerified=true khi signup.
- Trade-off: memory limiter chỉ đủ deployment một process; auth/CRUD positive integration PostgreSQL cần tài khoản thật hoặc DB thử riêng. Tests positive dùng Better Auth official memory adapter thay vì ghi fake users vào DB. Migration hậu kiểm và vấn đề snapshot guard được ghi minh bạch trong AUTHENTICATION.md/SESSION_LOG.

## ADR-010 — PostgreSQL integration bằng database và role riêng
- Ngày: 2026-10-20. User cho phép fixture/ADMIN chỉ trong DB test. Dùng aurel_ai_test và login không superuser/createdb/createrole, .env.test riêng; xác nhận exact target + current_database/current_user trước ghi/cleanup, test role không ghi main tables.
- Tái sử dụng singleton/provider/service thật qua process con có env test, không sửa DATABASE_URL file/parent. Review manifest SHA migrations, advisory lock, cleanup prefix/ID/email, so baseline, không reset sequences hay truncate dữ liệu lạ. Các lỗi child dừng workflow, không tiếp tục mù theo chuỗi shell.
- Better Auth mặc định skip origin ở NODE_ENV=test; đặt explicit false cho disableOriginCheck/disableCSRFCheck trong config dùng chung để test cùng bảo vệ thực.
- Backup custom archive read-only, restore vào DB mới, verify fingerprint + archive SHA. Không tự restore production hoặc drop các bản restore. Trade-off: logical backup không gồm global roles/ACL/PITR; local test chỉ đủ một server, cần chính sách production riêng.

## ADR-011 — Giá độc lập theo currency và staged deployment
- Review sau triển khai test: deferred FOR UPDATE không chứng minh invariant ở mọi isolation. Đã tái hiện lỗi nonempty order với REPEATABLE READ; không deploy main tới khi có migration khắc phục mới + regression concurrency và approval riêng. Giữ SQL/checksum đã apply test, không rewrite lịch sử. Bằng chứng MULTI_CURRENCY_PREFLIGHT.md.
- Ngày 2026-10-20. VND/USD/EUR định giá độc lập trong ProductPrice unique variant/currency; không FX hoặc gán currency cho giá cũ. Legacy nullable giữ nguyên chưa xác minh. Order/Item snapshot riêng không phụ thuộc giá live.
- NUMERIC không typmod + CHECK scale/range từ chối thừa số lẻ trước rounding; VND 0, USD/EUR 2 minor digits. String DTO và BigInt tính tổng. Deferred triggers kiểm currency/tổng khi commit, cho phép nested create nhiều dòng.
- Trade-off: custom SQL functions/triggers phải giữ trong migration và review khi đổi; raw schema diff không đại diện đầy đủ invariant. Legacy path tạm giúp app tương thích main trước migration; flag off mặc định, không dùng giá legacy checkout.
- Migration review/test trên test DB và restored backup, main chờ approval SQL + legacy audit. npm db:migrate tạm chặn. Chưa Admin UI/FX/checkout. Chi tiết MULTI_CURRENCY.md.

## ADR-012 — Ghi revision header để bảo vệ order aggregate ở database
- Ngày2026-10-21. Chọn Order.revision BigInt database-owned và BEFORE item trigger ghi parent trước mọi INSERT/UPDATE/DELETE; move ghi hai parent distinct theo ID. BEFORE header trigger cưỡng chế tăng revision, không tin giá caller và không cho đổi ID. Header delete/FK và deferred money invariants vẫn hoạt động. Không chỉ nâng isolation ở app hoặc thêm khóa FOR UPDATE đơn thuần.
- Row write tạo conflict40001 ở RR/Serializable cho stale snapshot, RC serialize rồi kiểm constraint tại commit. Rollback khôi phục cả header/item; đa order vẫn có thể deadlock40P01, cần rollback/caller policy. Không auto-retry service khi chưa có idempotent order-write/outbox; future retry toàn transaction, giới hạn và không lặp external side effects.
- Functions SECURITY INVOKER, schema references rõ, search_path trusted, revoke PUBLIC EXECUTE; enforcer inline không đòi grant helper cho normal writer. Nonowner DML/ACL probes và13 lịch mỗi isolation đã nghiệm thu. Owner/superuser vẫn là trust boundary, main local đang đặc quyền phải tách runtime/migration role khi production.
- Trade-off: hot-order contention/header write amplification, BIGINT overflow fail closed, deferred validation lặp theo số rows, deadlock đa statements vẫn có. Revision không vào JSON/DTO, legacy currency NULL giữ nguyên, không thêm Order/Admin UI/service.
- Migration mới20261020170000_order_revision, checksum/Prisma schema/rehearsal metadata được review; không sửa SQL cũ. GO cho vòng review riêng, main NO-GO chưa approval. Bằng chứng/timeout/recovery tại ORDER_CONCURRENCY_REMEDIATION.md.

## ADR-013 — Tách runtime/migration identities và security rehearsal trên cluster riêng
- Ngày2026-10-21. Runtime aurel_app không owner/đặc quyền, migration identity owner schema/objects có secret deployment riêng; không owner secret trong web env. Profile theo features hiện có: User role không được app UPDATE/INSERT ADMIN, auth tables DML, product deactivate, Order SELECT-only tới khi có checkout. Future objects default deny, không global auto-grant app DML.
- Better Auth cần INSERT User.role=CUSTOMER; candidate before-insert guard và column UPDATE grants vừa giữ signup vừa ngăn database runtime tự nâng ADMIN. Shared backend DB role không thay service authorization/RLS. Candidate SQL chỉ lab, production provisioning cần reviewed artifact/approval riêng, không thêm migration âm thầm.
- Roles PostgreSQL là global cluster objects. Auto-review từ chối tạo LOGIN roles thử trên shared main cluster; chuyển sang independent cluster5544/system ID khác source. Roles lab/ownership/grants chỉ tại đó, LOGIN app và owner thực qua tests đạt, cleanup/stop instance. Main chỉ read-only audit/fingerprint, credentials/grants không đổi.
- Trade-off: owner có inherent data/DDL power phải kiểm soát bằng ops/secret/network/audit; grants User cột và auth lifecycle phải review lại khi thêm feature. Lab loopback chứng minh ACL/compatibility, chưa chứng minh TLS/PITR/KMS/offsite/retention production.
- NO-GO giữ tới approval riêng provisioning/cutover/migrations/backup policy; không thu hồi login rộng cũ trước canary/rollback được duyệt. Chính sách RPO/RTO/retention/encryption chỉ baseline đề xuất ở DATABASE_SECURITY_READINESS.md, chưa triển khai main.

## ADR-014 — Email lifecycle native Better Auth và delivery chưa cấu hình
- Ngày 2026-10-21. Dùng Better Auth 1.7.12 verification JWT 60 phút và reset token 30 phút, native single-use reset transaction/revoke sessions. Verification replay idempotent theo provider; không viết token/session implementation thay thế hoặc thêm migration.
- Server-only AuthEmailDelivery port, production chưa nối provider. Thiếu provider chặn reset/resend bằng 503 trước account lookup; signup vẫn chưa verified và requireEmailVerification=false để tránh khóa người dùng. Không tự gửi email thật, không fake-success delivery.
- Khi đã có provider, reset-request giữ native neutral response cả lúc transport lỗi để không lộ membership qua HTTP status. Chỉ log thông báo lỗi cố định, response không phải delivery receipt. Trade-off: cần theo dõi delivery thất bại và retry bởi người dùng/provider; chưa triển khai durable email queue hoặc shared rate limiter. Provider integration, verified-email enforcement và UI là bước riêng.

## ADR-015 — Resend adapter qua native fetch
- Ngày2026-10-21. Chọn Resend theo yêu cầu chủ dự án, giữ AuthEmailDelivery/templates/Better Auth lifecycle. Native fetch fixed HTTPS endpoint/redirect:error/timeout10s tránh thêm dependency; env RESEND_API_KEY/EMAIL_FROM chỉ server, thiếu config vẫn unavailable.
- Chỉ chấp nhận success khi2xx có id; sanitized errors không raw body/cause.429 cooldown per adapter theo Retry-After (bounded1..3600s), không retry để tránh duplicate khi timeout có thể đã được provider chấp nhận. Trade-off: chưa queue/shared throttling/webhook; provider acceptance không chứng minh inbox. Test thực còn chờ config và mailbox cho phép, main NO-GO không đổi.

## ADR-016 — Auth UI dùng client Better Auth, thiết kế theo storefront
- Ngày2026-10-21, theo task Phase2.7. Server AuthPage/AuthShell và Client AuthForm/AccountPanel dùng official better-auth/react same-origin, không auth/session/token engine hoặc mutation API thứ hai. Validation helper chỉ chuẩn bị allowlisted payload/messages/redirect; server vẫn authoritative.
- Editorial split tái sử dụng ảnh hero và global tokens, auth routes có navigation/footer scoped; mobile bỏ ảnh để form ưu tiên thao tác. Không framework/font/palette mới hoặc sửa home hero/collection animations. Trade-off: thiết kế cần review và browser QA4 viewport, Computer Use policy stop URL confidence trong phiên nên chưa screenshot.
- Token reset chỉ RAM + scrub URL/no-referrer/no-store; verification callback query chỉ thông báo đã xử lý, verified thực từ session, không cấp quyền bằng query. Noindex cho auth; proxy access-log redaction vẫn là trách nhiệm triển khai. Không auto bật email production hoặc requireEmailVerification, main NO-GO.

## ADR-017 — Detail reader giữ staging currency và DTO riêng
- Ngày2026-10-21. Product Detail mở rộng public catalog reader, reuse Prisma singleton/select/map/image resolver; không dựng catalog service thứ hai hoặc gọi ADMIN service. React request cache chia sẻ read giữa metadata/page; client chỉ gallery/variant state, không query DB theo từng color/size.
- Detail DTO loại legacy amounts, raw storageKey và metadata nội bộ; flagfalse không prices relation, flagtrue chỉ currency đã chọn, không default/FX/fallback. Validate raw Decimal trước formatting để tránh rounding; UI định dạng chuỗi. Trade-off: khi chưa migrate/xác minh currency chỉ hiển thị giá chưa khả dụng, không hiển thị số legacy như giá bán.
- Purchase luôn disabled tới khi có Cart Backend. Title links là thay đổi duy nhất trong Catalog/Collection UI hiện có; không global redesign. Next streaming notFound giữ404 marker/noindex dù HTTP thường200; không sửa global streaming/header policy để ép404 ngoài scope. Visual QA do chủ dự án thủ công, main NO-GO.

## ADR018 — Product Foundation có kiểu và migration gate riêng
- Ngày2026-10-21. ProductProfile 1:1 giữ Options mô tả và AI tags trong một nguồn, Color/Size/SKU vẫn tại ProductVariant. Collection chỉ là slug nullable; chưa EAV/Collection lifecycle/embedding table. Trade-off: taxonomy v1 có giới hạn rõ và cần review/version khi mở rộng; fabric-variant hoặc hệ size mới cần cập nhật selector/unique key đồng bộ khi có hàng thật, không hỗ trợ bằng tổ hợp giả.
- ProductCode nullable cho legacy, foundation setter bắt buộc mã; Product.updatedAt nullable dùng DB trigger để Prisma cũ không tự ghi cột staged khi main chưa migrate. Schema/code đi trước main qua PRODUCT_FOUNDATION_ENABLED mặc định false, độc lập flag currency. Đổi lại cần approval/deploy/gate/curation sequence rõ; không bật flag thay thế migration.
- Image website/embedding/training permissions tách riêng default unknown, grant cần rights evidence. Gate bật mới public-filter website rights; AI export luôn deny-by-default/purpose-specific. FK ghép bảo vệ ảnh đúng variant/product, primary partial unique; public resolver không đổi.
- Import foundation chỉ dry-run offline insert bundle với snapshot; write importer để phase riêng. ML JSONL tách identity/eligibility khỏi content features và missing report, không default price/sales. Units Sold chỉ thiết kế tới khi có return ledger/recognition policy, không counter thủ công hoặc lấy views/order count thay units.
- Migration staged additive/test-only có expression unique chống normalized SKU/combination collisions và NOT VALID stock/sort guards; không rewrite legacy. Main approval/backup/preflight/least-privilege vẫn riêng; reviewed SHA chỉ cho test và không cấp production GO.



## ADR019 — Phase2.9.2: migrated schema, ADMIN aggregate service và CSV transaction (2026-10-21)
- Chủ dự án cho phép3 staged schema migrations sau safety gates. Chọn one-off exact-state runner: backup/restored fingerprint, independent SQL-chain drift, checksums và rehearsal trước main deploy; generic db:migrate tiếp tục blocked cho tương lai. Main5 migrations đã deployed, currency public flag giữ false.
- Reuse Product Service.run/Better Auth/DB ADMIN/Serializable; aggregate version hash/allowlists/child ownership cho form nhiều bảng. Đổi lại stale edits nhận409, không auto-retry, limits200 variants/100 images. Không duplicate data store hoặc auth bypass.
- CSV insert-only atomic transaction với preview digest/live revalidation; sáu templates cũ, giới hạn size/rows/headers/UTF8, formula-safe export. Đổi lại phải chia gói lớn, chưa update-existing, export theo trang không là full DB backup.
- Public readers luôn enforce website image grant sau migration, độc lập cờ AI; không bật currency storefront. Legacy unknown-rights images bị ẩn cho tới khi có evidence/grant.
- Hard-delete chỉ archived/code-confirmed/no-references; local append/fsync audit intent trước mutation và completion sau commit, không thêm migration audit thứ tư/storage provider. Filesystem/DB không atomic; unresolved completion được báo bằng flag/notice. Cần durable/immutable/offsite audit trước nhiều instances.
- Không tự cấp ADMIN main; provisioning đúng danh tính/ownership cần approval riêng. Approval schema local không phải production GO cho runtime security/backup/audit gaps.


## ADR020 — Video web variants và visibility playback (2026-10-22)
- Bằng chứng: source133,7MB/3830×2160/60FPS/~41Mbps và moov cuối file, src autoplay ngay cả khi section ngoài viewport. Không có bằng chứng remount theo scroll; không đổi scroll/reveal design.
- Quyết định: hai MP4 H.264/yuv420p30FPS/faststart/no-audio, source chọn một lần theo viewport tại lúc load; giữ nguồn gốc và26s. Desktop10,76MB/mobile3,36MB, poster frame thật. Đổi lại giảm temporal resolution60→30 và spatial detail; cinematic quality/loop phải review thủ công, không hứa hết dropped frames khi chưa đo.
- Media lifecycle tách khỏi reveal: ổn định video node, refs/observers/pause thay vì remount/clear src/load lặp; motion/Save-Data cần explicit Play, poster fallback và control accessible trong khung. Source không đổi khi resize nhằm tránh rewind/download; không adaptive bitrate trong scope này. Không dependency runtime hoặc public route/security/DB change.


## ADR021 — Product Editor, mã phía server và registry có phiên bản (2026-10-22)
- Shared pure code generator cho preview/server; server cấp code/newSKU bằng transaction/advisory lock/unique, bounded create retry4; stable existing code/SKU và optimistic version cho edit. Trade-off preview suffix không bảo đảm đúng số cuối, create có thể conflict khi hết retry; không counter doanh thu và có thể tái dùng suffix sau hard-delete.
- TaxonomyOption append-only với labels chuẩn hóa và unique(key,token); giữ ProductProfile/Variant columns thay EAV. Trigger validate registry thay cross-table CHECK để hỗ trợ restore data ordering. Trade-off registry không sửa/xóa qua UI, thiếu governance/archive cần scope riêng; runtime least-privilege cần review SELECT/EXECUTE riêng khi deploy.
- Feature/taxonomy v2 cho extended registry, giữ schema v1 và snapshot registry trong export report. Custom values không tự thành missing hoặc giá trị giả; null/[] unknown, not-applicable explicit/exclusive. CLI optional reviewed registry giữ offline contract, CSV runtime token snapshot gắn confirmation.
- Hai SQL staged chỉ test theo brief, không main approval ngầm. Capability yêu cầu cả registry/version2; main dùng automatic numeric compatibility + thông báo, không fake custom-option success/name-code. Trade-off main chưa đủ chức năng mã viết tắt và custom values tới khi approval/backup/restore/rehearsal/apply riêng.
- Controlled editor chung create/edit, pure draft helpers và scoped UI; no storefront redesign/upload giả. Bổ sung theo ảnh mẫu: AdminHeader chỉ trên admin routes theo pattern conditional header hiện có, sidebar client cho active pathname nhưng data vẫn được server gate. Lưu nháp là alias nghiệp vụ lưu trữ isActive=false có mô tả rõ, không dựng draft storage/enum hoặc fake action. Native dirty guard covers links/unload, Navigation API back/forward khi hỗ trợ; cross-browser history/focus/layout phải manual QA, không browser automation trong phase này.


## ADR022 — Mô tả có phiên bản nguồn và React renderer (2026-10-22)
- Chọn textarea nguồn Markdown giới hạn +preview/toolbar thật thay vì đưa raw HTML vào description hoặc thêm dependency/schema. Marker aurel-description-v1 phân biệt plain legacy, parser bounded/whitelist và React escaping; không backfill. Trade-off không WYSIWYG/CommonMark đầy đủ, snapshot CSV mang format marker nên consumer nên dùng descriptionText cho text-only.
- URL allowlist và ảnh phải thuộc public website-rights filtered DTO; description không tạo đường vòng bỏ image permissions. SEO/ML descriptionText tách cú pháp khỏi nội dung, image export purpose policy giữ riêng.
- Validator chỉ description nhận newline/tab; không nới field khác. Brand null được coi là xóa có chủ ý, AUREL default cho new/missing. Trade-off cần manual QA editor selection/history/source-preview; không tự sửa main data hoặc schema để bổ sung trình soạn thảo.


## ADR023 — Nhóm đối tượng nullable và URL tự sinh ổn định (2026-10-22)
- Dùng lại gender và thêm ageGroup nullable với enum nhãn marketing do owner chọn, không suy ra numeric age/birth year. Trade-off Gen Z/Gen Y/trung niên có thể giao nhau về khái niệm; đây là phân loại sản phẩm, không hồ sơ tuổi khách hàng.
- Server tạo URL cho editor create từ tên/gender/nhóm tuổi, transaction lock/unique/hậu tố và bounded retry; edit giữ URL cũ. Trade-off URL dự kiến có thể thêm hậu tố và không phản ánh tên mới sau edit, đổi lại không phá liên kết. CSV explicit slug giữ contract riêng.
- Migration audience độc lập, scoped Prisma deploy chỉ6 SQL reviewed sau verified backup/restore/no-drift/rehearsal; không đưa hai taxonomy SQL pending vào main. Trade-off cần runner one-off/history guard và tài liệu trạng thái main/test khác nhau.
- CSV thêm age_group optional với header cũ tương thích; feature schema v3 khi nguồn có ageGroup, giữ v1/v2 cho nguồn cũ. Không sửa lịch sử schema hoặc backfill dữ liệu.


## ADR024 — Kho binary PostgreSQL và ảnh có quyền truy cập (2026-10-22)
- Theo yêu cầu lưu ảnh trong DB, tách ImageAsset BYTEA khỏi metadata ProductImage; UUID storageKey để reuse/CSV metadata và tránh query aggregate kéo binary. Không thêm cloud provider. Trade-off DB/backup lớn dần, cần quota/retention và cân nhắc object storage khi mở rộng; xóa metadata không xóa asset.
- Decode/normalize WebP1920px/82/strip metadata trước insert,8MB/24MP bounds; cùng phiên bản Sharp hiện hữu thành dependency trực tiếp. Trade-off mất bản gốc/animation và chi tiết nguồn lớn, đổi lại payload nhỏ/định dạng thống nhất.
- Asset upload luôn private ADMIN tới khi ProductImage active+quyền/reference rõ. Route live check/no-store, optimizer không được fetch uploads; consumers dùng direct URL không cache proxy. Trade-off thêm DB read cho mỗi ảnh, không thể thu hồi bản khách đã tải.
- Migration kho độc lập theo authorization mới, scoped Prisma deploy7 SQL sau fresh backup/verified restore/no-drift/rehearsal; hai taxonomy SQL vẫn pending. Không đẩy thay đổi không liên quan vào main.


## ADR025 — Tối giản ảnh và tìm qua liên kết sản phẩm (2026-10-22)
- Theo owner yêu cầu upload-only, bỏ metadata UI; dùng tên Product đã lưu qua EXISTS ProductImage.storageKey để tìm ImageAsset thay thêm bảng/cột/name snapshot. Trade-off ảnh chưa gắn không tìm theo tên sản phẩm, đổi tên chỉ có hiệu lực khi save; substring hiện scan, chưa fuzzy/unaccent.
- Chọn upload cho website là intent từ quản trị; editorPayload ghi website-use/reference sự kiện khi unknown, giữ explicit denied và AI. Không suy diễn giấy phép/ownership, public gate và validator vẫn nguyên. Trade-off metadata/quyền nâng cao không còn chỉnh qua form này, các API/CSV đã authorize vẫn có contract cũ.
- removedImageIds explicit thay thao tác xóa metadata tức thì trong editor, ownership/version/Serializable cho unlink+edit atomic. Trade-off payload thêm danh sách bounded100 và binary orphan giữ lại để reuse; không xóa tài nguyên khi chỉ bỏ khỏi sản phẩm.


## ADR026 — Hai bước, shared PDP và gallery atomic (2026-10-22)
- Một ProductDetailView/EditorialGallery/ProductDetail DTO cho public và preview, khác editor controls/purchase behavior, không disposable demo/iframe. Trade-off public PDP được nâng cấp cùng thiết kế, cần manual visual QA cả2 modes; cart/checkout thiếu backend vẫn disabled.
- ProductDraftRequest unique UUID→actor/product, atomic với internal draft create + advisory lock/retry. Không đổi slug/code để làm idempotency hoặc mượn auth tables. Trade-off thêm một bảng4 cột cần approval/main migration, không tự kích hoạt trên main thiếu bảng. SessionStorage chỉ giữ request key cho uncertain response, ID route là identity lâu dài.
- Dùng ProductImage.imageType/front/detail/other/back/lifestyle thay thêm gallery-slot schema. Primary tách sortOrder, preview strict roles tránh Fabric đầu tiên tự chiếm cover. Trade-off fabric dùng existing other token; CSV vẫn compatible nhưng docs quy ước presentation mới.
- Upload binary và media association/version/order commit một transaction; replacement cleanup chỉ khi không còn references. Trade-off decoder chạy trong bounded ADMIN transaction,8MiB/24MP/1920 bounds; không orphan khi association fail hoặc mất ảnh cũ trước successful replace.
- Edit published qua explicit unpublish/draft trước; Save Product mặc địnhkhông publish, selection+confirmation cần thiết. Trade-off sửa hàng đang bán tạm unpublish thay vì clone revision model chưa có; không silently thay inventory hoặc build new order/cart flows.

## ADR027 — Hai font storefront và fallback tiếng Việt (2026-10-22)
- Typography shared storefront/PDP dùng đúng2 web fonts next/font/google: Cormorant Garamond500/600 (latin+vietnamese), DM Sans400/500/600 (latin+latin-ext), display swap/adjustFontFallback=false; root html chỉ khai báo CSS variables, không đổi body/global font nên Admin forms giữ nguyên. Wordmark600/34px/uppercase/.12em; nav500/13px; title500/clamp34–40px/1.08; editorial headings500/clamp44–52px; priceDM600/21px; summaryDM400/14px/1.65; labels600/12px/buttons600/12px/.04em/metadata-accordions13px. Warm ivory/espresso, gallery/layout/logic giữ nguyên.
- DM Sans upstream chỉ có latin/latin-ext và thiếu phần lớn ký tự Việt. Stack DM Sans → Cormorant Garamond → generic sans-serif giữ đủ dấu bằng font thứ2, không thêm font thứ3; một số chữ Việt trong body sẽ có nét serif. Kiểm tra cmap file WOFF2 đã build qua fontTools + Node Brotli: Cormorant104/104, DM Sans14/104 codepoints Việt được kiểm tra. Nguồn metadata chính thức: https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/METADATA.pb.
- Trade-off: tránh font thứ3 theo brief và giữ đủ dấu, nhưng DM body mixed serif ở chữ thiếu glyph. Không thay family được chỉ định hoặc giả subset unsupported, không chỉnh node_modules. next/font self-host sau build; build cần Google Fonts network, người xem không cần gọi Google.

## ADR028 — VND là giá cơ sở storefront (2026-10-22)
- Đã sửa giá storefront: base currency VND lấy từ ProductPrice được gắn currency rõ ràng, độc lập MULTI_CURRENCY_ENABLED; flag chỉ bật lựa chọnUSD/EUR, không tự FX/backfill/đọc legacy amount thànhVND. Public PDP/catalog/paging/related và Showroom dùng cùng defaultVND, selector nếu bật mặc địnhVND. Main read-only loader verify ID1 real product “[AUREL COLLECTION] Limited Edition Coat” có3 active variants đềuVND999000, catalog/PDP trả999000. Không đổi DB/env/flag.
- Trước đây flagfalse hoặc chưa chọn currency khiến giá đã nhập biến mất. Schema ProductPrice đã deploy main, baseVND giờ đọc được ngay; optionalUSD/EUR vẫn gate như cũ. MissingVND không fallback USD/legacy, giữ null. Trade-off: storefront hiện giáVND có thật ngay cả khi flag đa tiền tệ tắt, không bật engine/checkout.

## ADR029 — Panel thông tin cuộn riêng trên desktop (2026-10-22)
- Owner chốt1440×900 CSS/100%, giữ gallery65%, thấymain+đầu related và cho phép nestedscroll khi paneldài. InformationBody cao65dvh chỉ>=901px, related ngoài region, mobile naturalflow.
- Trade-off: thêm vùng scroll/tabstop desktop có nhãn để giữ font/control dimensions/tên đầy đủ thay vìscale chữ hoặc hạ gallery. Overscroll contain không tự chuyểnpage khiwheel chạm biên; người dùng dùng vùngngoài đểcuộntrang. Không thayreviews/policy data gates hoặc main data.

## ADR030 — Editorial intake tách khỏi saleable Product (2026-10-23)
- CompleteLook cầnảnh/name/price trướccategory/size/stock. PendingProductnullablefields+source/result relations lưuqueue trước, normalpersistconvert atomic/idempotent khihoànthiện; khôngrelax Productconstraints hoặc giảvariants. Khi convertedclearimageFK vàdùngrealProductprice/name/photo, publiconlypublished. Detachretainqueue/product. Trade-off:newtable+Adminqueue/codepath, tránhsnapshotcatalog/ảnhgiả vàdoubleproduct.
- AIYouMayAlsoLikekhôngdùngcategoryheuristicfallback; clearPreviewplaceholder/publicempty đếnengine thật. ImageAssetcleanupphảiđếmqueueFK mới. Nochangescurrency/stock/cart. Mainmigrationapproval/separatescopeddeploykhông2taxonomy.

## ADR031 — Tự lưu intake theo từng phần, tuần tự theo version (2026-10-23)
- Giữ Product bắt buộc đầy đủ; cho PendingProduct nullable lưu từng ảnh/tên/giá bằng operation patch riêng, giữ save đầy đủ tương thích. Không migration hoặc tự tạo Product/stock.
- Mỗi thẻ chỉ có một writer, request kế tiếp dùng revision được server chấp nhận. Lỗi giữ đầu hàng đợi và các sửa đổi/tệp phía sau; người dùng chủ động reload version và retry, không âm thầm ghi đè conflict. Trade-off: nhiều request hơn và nội dung lỗi chỉ giữ trong phiên trang; tránh autosave song song làm mất ảnh hoặc metadata.
- Bỏ ảnh chỉ xóa liên kết asset trong transaction; cleanup đếm ProductImage/PendingProduct. Gallery dùng lại service media đang có, không mở thêm đường ghi public.

## ADR032 — Variant tokens, HEX và Demo độc lập (2026-10-23)
- Giữ canonical color/size tokens và unique(productId,color,size); không thêm IDs/bảng trùng. Trade-off: đổi identity cần quy trình riêng.
- HEX tại TaxonomyOption append-only; không đổi global HEX qua expand. Capability guard giữ main cũ hoạt động. Trade-off: legacy nullHEX cần option mới thay UPDATE.
- Demo local-only, lưu thật qua ADMIN/version/transaction. Mặc định user chọn stock0/chưa giá/inactive. Không thay cart/order backend. Xem DYNAMIC_VARIANTS.md.

## ADR033 — Danh mục trang phục và nhóm biên tập riêng (2026-10-23)
Danh mục dùng Category hiện có, preset chỉ định hướng chọn theo ProductProfile.gender; không nhân đôi Category theo Nam/Nữ. Bộ sưu tập dùng Product.collection và sidebar tree riêng, không đổi Category cũ sang collection tự động. Trade-off: bộ sưu tập hiện không có lifecycle độc lập và mỗi sản phẩm chỉ một slug; đủ cho nhóm nhiều sản phẩm hiện tại, tránh migration/many-to-many chưa cần. Preset tạo khi ADMIN chọn qua resolve/upsert allowlist, không seed theo page load hoặc sinh sản phẩm mẫu. Chi tiết CATEGORIES_AND_COLLECTIONS.md.

## ADR034 — Luồng COD demo dùng schema hiện hữu (2026-11-01)
- Theo yêu cầu ưu tiên chức năng trước hạn nộp, tái sử dụng Cart/Order/UserAddress/Favorite, không mở migration hoặc cổng thanh toán. Chỉ VND, COD DEMO và phí ship0 công bố rõ; đánh đổi là chưa payment reconciliation/voucher/refund/reservation.
- Checkout Serializable, khóa user, snapshot giá server, conditional stock decrement và clear cart atomic. Dùng orderNumber unique `DEMO-userId-UUIDv4` làm idempotency token; lặp lại trả đơn đã tạo, request khác giỏ đã trống. Trade-off mã đơn dài; chỉ replay theo key, không có bảng request fingerprint riêng.
- Hủy chỉ trước giao, hoàn stock cùng transaction; CUSTOMER chỉ PENDING của mình, ADMIN theo state machine. Không xử lý legacy chưa biết có trừ kho không. Chống race bằng serialization retry giới hạn sau rollback, không có external side effect trong transaction.
- Public category dùng validation slug thay whitelist để tương thích danh mục admin; options lấy DB. Font hệ thống thay next/font/google để loại phụ thuộc mạng lúc build; chấp nhận khác typography theo yêu cầu UI không ưu tiên.
- Chủ dự án đã cho phép bán thử mặt hàng demo: thêm 8 sản phẩm có nhãn DEMO, sử dụng ảnh minh họa có sẵn và giá/stock được công bố là thử nghiệm. Không seed user/order/review trên main, không giả vờ đã thu tiền.

## ADR035 — Voucher giảm ở header, giữ giá dòng gốc (2026-11-01)
- Thêm Order.subtotalAmount/discountAmount/voucherCode, giữ OrderItem.unitPrice/lineTotal trước giảm. Checker đối chiếu sum(lines)=subtotal và sum(lines)-discount=totalAmount; legacy subtotalNULL/discount0 không bị backfill. Trade-off: phải mở rộng2 DB functions và hiển thị discount riêng, nhưng không làm tròn/phân bổ giảm vào từng đơn vị hàng.
- Một mã/đơn, VND, áp toàn bộ tiền hàng; fixed hoặc integer percent, BigInt và làm tròn xuống đồng, cap không vượt subtotal. Chưa cộng dồn/giảm riêng danh mục/ship. Snapshot code/discount trong order/redemption giữ lịch sử khi admin sửa/tắt mã.
- Lượt chỉ tính redemption chưa released, hủy trước giao hoàn lượt cùng stock. Checkout/cancel Serializable ghi version thật voucher để loại stale snapshots; lock voucher trước stock. ADMIN CAS buộc tải lại khi có sử dụng hoặc hoàn lượt, đánh đổi là form dễ báo409 hơn nhưng không ghi đè trạng thái mới.
- Quote không giữ chỗ; checkout revalidate toàn bộ và so expectedTotal khi đã áp mã. Replay request key trả order cũ trước khi kiểm voucher, không dùng lại lượt. Migration deploy riêng có backup/verified restore và original-data preservation; không kéo các migrations pending khác.

## ADR036 — payOS tách payment lifecycle khỏi order/inventory (2026-11-02)
- OnlinePayment1:1 chỉ có cho PAYOS, PaymentAttempt1:n và PaymentReceipt reference unique; giữ trạng thái giao hàng Order hiện hữu. Migration additive không backfill COD; capability reads giữ COD khi chưa triển khai. Trade-off thêm ba bảng nhưng tránh làm API cũ lỗi vì scalar column mới/pending migration và giữ đầy đủ khoản tiền cần đối soát.
- Dùng transaction checkout/reservation/cart clear/voucher cũ, Order lock + Serializable cho payment state, partial unique active attempt, lease trước network. Timeout không sinh mã mới, GET cùng mã trước retry. Trade-off network outcome còn uncertain sẽ hiện processing và cần đối soát thay vì giả định fail/sinh thêm link.
- Webhook verified signed inner data hoặc signed provider GET mới cập nhật PAID; return URL không có thẩm quyền. Receipt sai tiền/tiền đến muộn vẫn giữ và flag, chặn giao/tạo mới. Không tự chạy fulfillment hay giảm stock tại webhook. Cờ bật phương thức chỉ gate tạo mới, không tắt webhook link cũ.
- Cancel/expiry của phiên không tự hủy Order; reservation/voucher chỉ hoàn qua explicit order-cancel guard. Trade-off cần vận hành dọn đơn bỏ dở và quy trình hoàn tiền/clear reconciliation riêng; chưa tự giải phóng kho có thể có tiền đang tới.
- QR render local `qrcode` từ chuỗi provider, không dịch vụ ảnh ngoài; hosted URL allowlist pay.payos.vn hỗ trợ một điện thoại/lost create response. SDK2.0.5 hiện có, log tắt, fixed baseURL, timeout10s, không network ở startup/build/tests.

## ADR037 — Khung bảng điều khiển tài khoản và tái thiết kế Wishlist (2026-11-02)
- Tách `AccountShell` và `AccountSidebar` làm khung điều hướng 2 cột độc lập cho khu vực cá nhân (`/favorites`, chuẩn bị cho `/account`, `/account/orders`). Bố cục tối đa 1440px, sidebar 260px và chuyển sang thanh cuộn ngang khi trên mobile (<768px).
- Giữ nguyên model `Favorite` sẵn có của Prisma (`userId`, `productId`) và logic server mutation `/api/shop`. Không thay đổi schema hoặc tạo bảng lưu trữ song song.
- Khách vãng lai chưa đăng nhập vẫn xem được trang danh sách yêu thích rỗng với thông điệp nhẹ nhàng và danh sách gợi ý 4 sản phẩm thực tế từ catalog. Thao tác lưu/xóa có phản hồi lạc quan trên client và kiểm tra quyền tại server. Trade-off: Khách vãng lai chưa lưu cục bộ localStorage để tránh phân mảnh trạng thái khi đăng nhập chéo thiết bị.

## ADR038 — Vá minimatch với adapter chỉ trong lint process (2026-11-02)
- Nâng patch Next/eslint-config-next16.4.3 và pin upstream minimatch11.0.3, dùng npm override từ direct devDependency. Không downgrade ESLint9 hoặc tắt rule để xóa audit.
- Plugin còn dùng CommonJS callable API3 trong khi upstream11 đã đổi export/loại regex compiler. Helper nạp đầu ESLint config đổi require.cache export shape, giữ modern named matcher; makeRe().test() của import rule dùng upstream nonrecursive matcher. Không import adapter vào production application.
- Trade-off: cần duy trì một compatibility layer được kiểm bằng helper tests và ESLint API rule fixture, thay vì giữ dependency bị advisory hoặc nâng toàn bộ lint sang major không tương thích. Chỉ hỗ trợ surface consumer đang dùng, không giả lập full RegExp; gỡ khi upstream consumer bỏ API3.
- Đã loại thử nghiệm file override do npm10 tạo junction sai; cách cuối không có local package/version giả hoặc sửa node_modules source. Audit full/production0, npm ls hợp lệ và ci dry-run đạt; chưa coi dry-run là fresh install thực.

## ADR039 — Dashboard seller đọc Order/payment hiện hữu (2026-11-02)
- Không tạo seller-order bản sao khi paid: Order checkout/reservation và OnlinePayment/attempt/receipt đã verified là nguồn duy nhất. Dashboard filter trước pagination đọc snapshot RepeatableRead, cập nhật bằng DB polling20s. Trade-off latency tối đa khoảng20s thay vì websocket/outbox, nhưng webhook retry không có side effect tạo đơn/giảm kho lần nữa.
- Seller dùng role ADMIN hiện hữu trong cửa hàng đơn, mutation delegate shopWrite để giữ role/payment/state/inventory guards. Payment tracked có thể cập nhật fulfillment không phụ thuộc prefix DEMO; legacy COD không biết reservation vẫn chặn. Không mở multi-vendor/role mới.
- Giữ báo cáo tồn kho cũ ở subroute reports, không bỏ chức năng khi thay dashboard. Source chịu được payment migration pending bằng capability-check; phần live payment vẫn chờ reviewed migration/grants/webhook/enable, không bịa đơn PAID để nghiệm thu.
## ADR-040 — Buy Now dùng checkout scope riêng, không dùng CartItem (02/11/2026)

- Quyết định: `BUY NOW` truyền `ProductVariant.id` tới checkout; server tạo snapshot quantity 1 trực tiếp từ variant cho cả voucher và order. Giỏ chỉ là nguồn dữ liệu khi checkout không có buy-now scope.
- Lý do: thêm tạm sản phẩm vào giỏ khiến checkout gom cả sản phẩm cũ, thay đổi quantity nếu biến thể đã có và xóa nhầm toàn bộ giỏ sau khi đặt.
- Đánh đổi: API shop có thêm nhánh projection/snapshot và idempotency key theo scope. Bù lại ranh giới dữ liệu rõ ràng, giá/tồn vẫn được xác minh server-side và không cần schema/migration mới.

## ADR041 — Pipeline cho Prisma/pg, tuần tự trong interactive transaction (2026-11-02)
- Prisma relation interpreter có thể phát nhiều query cho một logical read trên cùng `PgTransaction`; `pg@8.23.1` cảnh báo nếu connection không opt-in concurrency. Chọn `pipeline:true` ở shared PrismaPg pool thay vì suppress warning, downgrade hoặc serialize toàn bộ pool.
- Code ứng dụng vẫn tuần tự hóa các lệnh `tx.*` được fan-out rõ ràng trong seller counts và image-library count/list, vì interactive transaction chỉ có một connection/snapshot. Các Prisma call độc lập ngoài transaction giữ `Promise.all` để pool dùng nhiều connection.
- Trade-off: pipeline cần driver hỗ trợ và không phù hợp cursor/row-limited portal, nhưng AUREL chỉ dùng Prisma buffered queries. Cần giữ regression trace khi nâng pg/Prisma; checkout/payOS/order không đổi isolation, row locks, retry hay network boundary.


## 2026-11-13 — Lenis toàn trang
- Chọn Lenis 1.3.25 theo yêu cầu dùng nhịp cuộn của Plant Classification, tích hợp qua client component độc lập tại root layout.
- Đánh đổi: thêm dependency và RAF; giữ touch native, hỗ trợ nested scroll, reduced motion và cleanup. Không thêm hiệu ứng thẻ ngang vì storefront không có module tương ứng.

## 2026-11-13 — Token CSS và presence theo lifecycle thay vì thêm animation library
- Theo skill Charles được chủ dự án yêu cầu, dùng CSS transitions/token trong stack hiện có; native dialogs giữ focus/Escape của browser, các popover/drawer vốn là client dùng MotionPanel giữ presence tới animation.finished. Không thêm Motion/Framer Motion hoặc spring tự viết cho thao tác thông thường.
- Đánh đổi: native discrete transitions phụ thuộc browser hiện đại; không hỗ trợ mọi kiểu choreography/layout animation. Đổi lại không trì hoãn route/data/submit để đợi hiệu ứng, có reduced motion chung và không thêm per-frame React state. WeakMap/cleanup tránh giữ dialog DOM cũ; closed panel phải inert ngay cả khi exit còn thấy.

## 2026-11-13 — Helper URL catalog không đặt trong module use client
- Tách buildCatalogHref sang features/catalog/catalog-href.ts, server và client cùng dùng function thuần; giữ re-export ở filter component để tương thích callers/test cũ.
- Lý do: gọi function export từ use client trên server bị Next RSC từ chối ở production, khiến một số URL catalog không render. Đánh đổi là thêm một module nhỏ, đổi lại không đẩy toàn bộ catalog thành client và không thay truy vấn/validation/giá.

## 2026-11-13 — Groq Qwen với RAG catalog đọc qua service
- Chọn smart search PostgreSQL hiện có làm retriever (tối đa 3 sản phẩm + chi tiết active), không thêm vector database/embedding khi chưa đo thiếu recall. Model chỉ sinh văn bản từ context; không được chạy SQL hoặc thao tác đơn/kho/thanh toán. Đánh đổi: đơn giản và cập nhật dữ liệu trực tiếp, nhưng câu dài/đổi chủ đề có thể cần truy xuất lại.
- Key server-only, 429 cooldown + key failover có giới hạn; không coi key rotation là vượt được quota tổ chức. Fallback giữ storefront/chat hoạt động khi nhà cung cấp lỗi. Cooldown process-local chưa phối hợp multi-replica.
- Giữ hợp đồng JSON/store hiện có, hiệu ứng hiện dần phía client thay vì streaming token qua mạng. Đánh đổi: vẫn chờ đủ câu trước khi bắt đầu hiện; đổi lại không lưu tin dở, không đổi API và hỗ trợ reduced motion. Quy tắc không cam kết size/chính sách khi thiếu nguồn đã xác minh.

## 2026-11-13 — Hồi phục AI theo channel và mode, giữ hộp thư STAFF riêng
- BOT đã handoff được bật lại bằng mode API; STAFF chuyển sang hội thoại BOT. Server từ chối modeBOT cho STAFF để giữ hộp thư nhân viên không có AI chen ngang. Không tự bật lại handoff khi khách chưa chọn; đổi lại cần nút Bật trợ lý AI rõ và thông báo tại sao chưa có phản hồi.
- Mở mặc định ưu tiên BOT đang hoạt động và remount drawer mỗi lần mở để bỏ lựa chọn STAFF cũ; explicit conversationId vẫn giữ thread khách chọn. Status không khẳng định nhân viên online khi chưa có presence thực.
- Cập nhật local3000 bằng snapshot đã qua browser tests, giữ root build cũ làm rollback và dùng junction .data để giữ dữ liệu. Chưa thay đổi canonical origin/CSRF; test local có harness, không nới bảo mật cho localhost.

## 2026-11-13 — Tách bình luận khỏi điểm đánh giá và bỏ tiền kiểm
- Theo yêu cầu chủ dự án: tài khoản bình luận không cần mua; đánh giá sao vẫn xác minh DELIVERED. ProductComment lưu riêng để không phát sinh sao hoặc ràng buộc một bình luận/sản phẩm.
- Công khai ngay bằng trạng thái APPROVED trong service hiện có; PENDING giữ cho dữ liệu cũ, HIDDEN không tự mở lại khi khách sửa. Shop có quyền xóa vĩnh viễn, chủ nội dung xóa chính mình. Bình luận tự do chưa có reply/thread, upload hoặc phân trang; lấy 100 mới nhất.
- Migration scoped có backup/verified restore/rehearsal, không bỏ guard migrate-all. Runtime dùng snapshot riêng, giữ env/.data và bản cũ để rollback.

## 2026-11-13 — RAG chat lọc metadata trước, không dùng search rộng làm chứng cứ
- Lỗi thực tế: áo khoác nam nhận quần/áo nữ do query hội thoại rộng, không khóa gender/category và gắn mọi kết quả thành thẻ. Chọn planner tách ý định + DAL SQL có hard filters trước LIMIT3, AND từ khóa cụ thể, context có gender; không sửa storefront search hoặc thêm vectorDB để che lỗi relevance.
- Đánh đổi: SQL/metadata cập nhật trực tiếp, truy nguyên và kiểm chứng được, nhưng parser nhóm trang phục/tên riêng hữu hạn; phải mở rộng theo dữ liệu câu hỏi thất bại, không hứa hiểu mọi câu. Vector retrieval chỉ nên xét sau khi đo thiếu recall và vẫn phải giữ filters.
- Tách truy xuất ngữ cảnh khỏi quyền hiện thẻ: follow-up có thể cần RAG nhưng không lặp card. Thẻ/stock do server ánh xạ từ data, model trả câu ngắn không link. Client chờ text hoàn tất trước thẻ, state text thuộc React và không ép scroll của người đang đọc phía trên. Đánh đổi là card tới sau vài giây reveal; reduced motion hoàn tất ngay.

## 2026-11-13 — Discussion liên kết dữ liệu cũ và ảnh có kiểm tra hiển thị
- Giữ ProductReview/ProductComment, bổ sung ProductDiscussion root/reply + trigger backfill/liên kết cho API cũ; không sao chép/sửa nội dung cũ. PK like chặn trùng, cascade dọn thread khi xóa. View recursive là ranh giới visibility chung cho feed/ảnh/tương tác.
- Dùng sharp/PostgreSQL BYTEA sẵn có thay storage dependency mới, tối đa3ảnh4MB và WebP tối đa2MB sau normalize; đổi lại DB/backup tăng dung lượng. Thread4cấp/rootpagination10; phân trang con là bước quy mô sau.
- Chọn public summary hoàn toàn từ review hợp lệ, không dùng fallback Auto5sao trong thay đổi song song vì yêu cầu hiện tại không dùng dữ liệu giả. Giữ cấu hình/Admin cũ, không xóa dữ liệu.
- Event nội bộ theo slug đồng bộ sao trên giá với summary API; không router reload. Client feed theo generation/AbortController tránh phản hồi cũ ghi đè bộ lọc mới.

## 2026-11-13 — Mở đánh giá cho mọi tài khoản theo yêu cầu chủ dự án
- Bỏ điều kiện mua/nhận hàng ở cả API discussion và API review cũ. ProductReview.orderItemId nullable để biểu diễn đúng đánh giá không mua; FK cũ giữ nguyên, không fake order.
- Tách quyền chấm sao khỏi chứng thực mua hàng: summary tính mọi APPROVED, badge/filter buyer chỉ dùng Order DELIVERED. Giữ unique user/product và moderation hiện tại. Đánh đổi: điểm tổng hợp không còn chỉ từ người mua; dùng badge/filter để nhận biết.

## 2026-11-14 — Reset cuộn mới vào PDP tại SmoothScroll
- Đặt chính sách tập trung ở scroller dùng chung để mọi link sản phẩm được áp dụng, đồng thời reset animation target Lenis thay vì chỉ window.scrollTo. Không thêm handler cho từng card.
- Giữ khôi phục Back/Forward và hash, chỉ reset điều hướng mới khi pathname đổi. Đổi lại người dùng quay lại qua history vẫn ở vị trí đọc cũ; điều hướng tới sản phẩm mới bắt đầu ở đầu.

## 2026-11-14 — Success đăng ký là trạng thái trong /register
- Đổi bố cục ở RegisterExperience thay vì tạo route success/queryflag. Chỉ backend signup thành công mới mở success; email cho resend giữ trong memory, không đặt trong URL/storage. Đổi lại refresh sẽ trở về form, không giữ trạng thái thành công giả hoặc làm lộ email trong lịch sử.
- Dùng nguyên logo AUREL đã có và service verify hiện hành, không thêm asset AI hoặc backend xác minh khác.

## 2026-11-14 — CSS riêng cho phòng thử đồ lớn
- Tách TryOnStudio khỏi CSS modal PDP để tăng kích thước và responsive mà không làm đổi dialog sản phẩm. Dùng CSS keyframes và stage API hiện có thay vì thêm animation library. Trade-off: studio và modal có style riêng cần duy trì; motion không mô phỏng tiến độ GPU thực.

## 2026-11-14 — Đồng bộ workspace modal thử đồ với studio
- Sau phản hồi ảnh chụp, phạm vi gồm cả cửa sổ PDP. Modal tái sử dụng CSS workspace/motion của studio, giữ shell native dialog và state/API riêng. Tránh sao chép animation và giữ luồng chọn sản phẩm hiện tại; trade-off là thay shared CSS cần xét cả studio lẫn modal. Không thêm animation library hoặc thay inference/backend.

## 2026-11-14 — Ảnh thứ5 là đầu vào try-on theo quy ước shop
- Chủ dự án chỉ định ảnh nền trắng số5. Dùng vị trí thứ5 trong danh sách hiển thị gallery, thống nhất PDP và catalogstudio; thiếu vị trí này thì không lấy primary thay thế. Không thêm metadata/phân loại màu nền bằng AI. Trade-off: shop cần giữ packshot ở slot5 khi sắp xếp ảnh; code không xác minh màu nền thực bằng pixel. Gallery lựa chọn/variant không làm thay đầu vào này.

## 2026-11-14 — Modal reference trắng/đen có stylesheet độc lập
- Ảnh mẫu mới yêu cầu modal khác studio; tách style/motion của modal vào virtual-tryon-modal.module.css thay vì ghi đè sharedstudio. Giữ state/API/slot5/native dialog và không thêm dependency. Trade-off: keyframes scan/spinner cần duy trì ở hai stylesheet, đổi lại design riêng không gây thay đổi studio.
- Người mẫu minh họa là asset AI tĩnh mới, aria-hidden và không gửi vào inference. Không dùng ảnh model này để ngụ ý kết quả/sản phẩm thực; kết quả chỉ đến từ API.

## 2026-11-14 — Tách modelalpha khỏi nền tường của modal
- Theo yêu cầu kéo dài tường, imagegen xóa nền ảnh model thành alpha; tường/sàn được vẽ bằng CSS trên toàn content, model giữ tỷ lệ. Tránh kéo giãn người hoặc lặp mép ảnh, responsive theo chiều rộng/chiều cao thực. Trade-off: nền tường là gradient CSS nhẹ; model không còn shadow gốc, dùng drop-shadow để hòa vào tường. Không thay ảnh input/result hay inference.
- Màu nền theo PDP #F8F5F0; topbar lấy chính xác gradient/text của AdminHeader, không đổi Admin hoặc token toàn cục.

- Cập nhật hoàn tác 14/11/2026: chủ dự án chọn trở về bản reference trắng/topbar trắng/model gốc, chỉ giảm typography. Quyết định tách modelalpha+tườngCSS ở mục trên không còn áp dụng runtime; assetcutout được giữ file để tránh xóa dữ liệu.
# 2026-11-15 — Thumbnail trong bảng quản trị đơn hàng
- Dùng ảnh primary hiện tại của sản phẩm liên kết qua variant, kiểm tra URL bằng helper publicProductImageUrl rồi chỉ serialize imageUrl. Tái sử dụng pattern account OrdersView, không thêm snapshot/schema hoặc dependency ảnh.
- Đánh đổi: ảnh có thể thay đổi khi catalog đổi; tên, SKU, biến thể và giá vẫn là snapshot đơn hàng. Khi không còn ảnh hoặc tải lỗi, UI hiển thị placeholder thay vì ảnh/sản phẩm giả.

## 2026-11-16 — GitHub riêng tư, LFS và submodule AI
- Lưu source tại `Trantan496/aureluxury-store` riêng tư; không bao gồm dữ liệu vận hành hoặc secrets.
- Video 127 MB dùng Git LFS để đáp ứng giới hạn GitHub. AI upstream dùng submodule cố định commit, thay đổi DM-VTON giữ bằng patch; clone cần lấy submodule/LFS và áp patch riêng, đổi lại không sao chép toàn bộ upstream/model vào repository chính.

