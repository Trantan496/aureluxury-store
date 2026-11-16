# Báo cáo tái thiết kế trang Yêu thích (Wishlist) — AUREL

## 1. Tổng quan tác vụ
Tái thiết kế toàn bộ trang Sản phẩm yêu thích (`/favorites`) của AUREL dựa theo ảnh thiết kế tham chiếu (Quiet Luxury, Warm Minimalism, phong cách thời trang cao cấp AUREL).
Trang kết hợp bảng điều khiển tài khoản hai cột (sidebar bên trái + nội dung bên phải), hỗ trợ trạng thái danh sách rỗng (empty state) với minh họa trái tim nghệ thuật, thông điệp kêu gọi hành động (CTA), và hàng gợi ý sản phẩm "Có thể bạn sẽ thích" lấy từ cơ sở dữ liệu thật.

## 2. Các tệp đã tạo
- `src/features/wishlist/products.ts`: Định nghĩa kiểu dữ liệu `WishlistProduct`, hàm định dạng giá `formatCatalogPrice`, chuyển đổi sản phẩm `toWishlistProduct`, và thuật toán lọc gợi ý `pickRecommendations`.
- `src/features/wishlist/service.ts`: Service server-side `loadWishlist(userId?)` nạp danh sách yêu thích của khách hàng và lấy tối đa 4 sản phẩm đề xuất còn hàng, có giá từ catalog.
- `src/components/account/account-icons.tsx`: Bộ icon outline nhất quán (ShoppingBag, ShoppingCart, Package, UserRound, Heart, House, ChevronRight, ArrowRight).
- `src/components/account/account-sidebar.tsx`: Thanh điều hướng tài khoản bên trái (Tài khoản của tôi: Mua sắm, Giỏ hàng, Đơn của tôi, Hồ sơ, Yêu thích) với nhận diện route động và vạch chỉ báo active 3px.
- `src/components/account/account-shell.tsx`: Khung bố cục tài khoản 2 cột (sidebar + breadcrumb + tiêu đề trang) responsive tối đa 1440px.
- `src/components/account/account.module.css`: Phong cách cho sidebar, breadcrumb, typography và bố cục responsive.
- `src/components/wishlist/wishlist-view.tsx`: Client component quản lý danh sách yêu thích (empty state card, lưới sản phẩm đã lưu, hàng gợi ý, thao tác bỏ/lưu yêu thích tức thời, thông báo phản hồi).
- `src/components/wishlist/wishlist.module.css`: CSS Module cho thẻ rỗng, minh họa trái tim ánh hào quang, thẻ sản phẩm tỉ lệ 4:5, nút trái tim và túi giỏ hàng espresso.
- `tests/wishlist-products.test.ts`: Bộ 5 test case độc lập kiểm tra định dạng giá, trích xuất dữ liệu sản phẩm, và thuật toán gợi ý (sửa trường `alt` thay cho `altText` để khớp định nghĩa kiểu `Product['images']`).
- `LOGS/wishlist-rebuild.md`: Báo cáo chi tiết này.

## 3. Các tệp đã sửa đổi
- `src/app/favorites/page.tsx`: Cập nhật route server component nạp dữ liệu qua `loadWishlist`, tích hợp `AccountShell` và `WishlistView`.
- `src/components/auth/login-icons.tsx`: Export component cơ sở `Outline` để chia sẻ giữa auth và account icons.

## 4. Chi tiết các thành phần UI
1. **Header & Footer toàn cục**: Giữ nguyên header của AUREL (logo, menu, tìm kiếm, tài khoản, giỏ hàng) và footer chuẩn.
2. **Breadcrumb**: `Trang chủ › Tài khoản › Sản phẩm yêu thích` có icon trang chủ và mũi tên điều hướng.
3. **Sidebar tài khoản**:
   - Nền màu ngà dịu (`#F4EEE8`), bo góc 16px.
   - 5 mục: Mua sắm (`/products`), Giỏ hàng (`/cart`), Đơn của tôi (`/account/orders`), Hồ sơ (`/account`), Yêu thích (`/favorites`).
   - Mục đang chọn có nền be ấm (`#EFE3D7`), chữ espresso sẫm, vạch chỉ báo đứng 3px.
4. **Thẻ trạng thái rỗng (Empty State)**:
   - Thẻ nền gradient kem viền siêu mảnh, bo góc 14px.
   - Minh họa trái tim nét espresso vẽ tay kèm vệt cọ be và ánh sáng lấp lánh (SVG thuần, không dùng emoji).
   - Tiêu đề: *"Bạn chưa có sản phẩm yêu thích nào"*.
   - Phụ đề: *"Hãy lưu lại những sản phẩm bạn yêu thích để dễ dàng theo dõi và mua sắm sau nhé."*.
   - Nút CTA: *"Tiếp tục mua sắm →"* tông espresso (`#68452F`) chuyển tiếp mượt mà.
5. **Khối gợi ý "Có thể bạn sẽ thích"**:
   - Tiêu đề phụ + liên kết *"Xem thêm →"*.
   - Lưới 4 cột (desktop), 2 cột (tablet/mobile).
   - Ảnh sản phẩm tỉ lệ 4:5, bo góc 10px, hiệu ứng zoom nhẹ (scale 1.025) khi hover.
   - Nút thả tim viền trắng bo góc tròn và nút túi mua hàng espresso.

## 5. Tích hợp dữ liệu & cơ sở dữ liệu
- Tận dụng model `Favorite` sẵn có trong Prisma (`userId`, `productId`, `@@unique([userId, productId])`).
- Thao tác toggle yêu thích gọi API `/api/shop` (`action: "favorite"`, `remove: boolean`).
- Cập nhật UI lạc quan (optimistic update) kèm cơ chế rollback nếu request thất bại.
- Với khách chưa đăng nhập, trang vẫn hiển thị giao diện rỗng và 4 gợi ý từ catalog. Khi khách bấm lưu yêu thích, hệ thống hiển thị thông báo hướng dẫn đăng nhập.

## 6. Đáp ứng responsive
- **Desktop (≥ 1024px)**: Bố cục 2 cột (sidebar 260px, content linh hoạt gap 40px), lưới sản phẩm 4 cột.
- **Tablet (768px – 1023px)**: Sidebar thu gọn 210px, lưới sản phẩm 2 cột.
- **Mobile (< 768px)**: Sidebar chuyển thành thanh cuộn ngang mượt mà phía trên, lưới 2 cột, không bị vỡ hoặc cuộn ngang toàn trang.

## 7. Kiểm tra & Kết quả thực tế
1. **TypeScript Typecheck**:
   - Lệnh: `next typegen && tsc --noEmit`
   - Lần 1: Lỗi TS2353 tại `tests/wishlist-products.test.ts` do dùng nhầm tên thuộc tính `altText` thay vì `alt`.
   - Đã sửa: Đổi thành `alt` theo đúng kiểu `Product['images']`.
   - Chạy lại: **Đạt (exit code 0)**, không còn lỗi typecheck toàn dự án.
2. **ESLint**:
   - Lệnh: `node node_modules/eslint/bin/eslint.js src/components/account src/components/wishlist src/features/wishlist src/app/favorites`
   - Kết quả: **Đạt (exit code 0)**.
3. **Unit Tests (Tuân thủ giới hạn ≤ 10 test case)**:
   - Lệnh: `node --experimental-strip-types --test tests/wishlist-products.test.ts`
   - Đã chạy: 5 test case độc lập:
     - Case 1: `formatCatalogPrice formats VND and non-VND prices without decimals` (PASS)
     - Case 2: `formatCatalogPrice returns null on missing amount or currency` (PASS)
     - Case 3: `toWishlistProduct maps valid active product and resolves primary image` (PASS)
     - Case 4: `toWishlistProduct rejects product with invalid slug` (PASS)
     - Case 5: `pickRecommendations filters out saved, out-of-stock, unpriced items and respects limit` (PASS)
   - Kết quả: **5/5 tests passed (100%)**.
4. **Visual Screenshots (Chrome Headless)**:
   - Đã chụp kiểm tra trên cả 3 độ phân giải:
     - Desktop: `1440 × 1350` (`fav-desktop.png`) — Khớp thẩm mỹ và bố cục ảnh mẫu.
     - Tablet: `900 × 1000` (`fav-tablet.png`) — Grid 2 cột cân đối.
     - Mobile: `390 × 844` (`fav-mobile.png`) — Thanh điều hướng cuộn ngang mượt.

## 8. Vấn đề đã giải quyết & Tồn đọng
- **Đã giải quyết**:
  - Tách bạch rõ ràng component sidebar tài khoản có thể tái sử dụng cho các trang `/account`, `/cart`, `/account/orders`.
  - Giữ nguyên luồng xử lý giỏ hàng và danh mục hiện có.
- **Tồn đọng / Bước tiếp theo**:
  - Áp dụng `AccountShell` tương tự cho các trang `/account` (hồ sơ) và `/account/orders` (đơn hàng) nếu muốn đồng bộ toàn bộ khu vực cá nhân.
  - Owner kiểm tra trải nghiệm lưu yêu thích thực tế với tài khoản người dùng có sẵn trên môi trường staging/production.

