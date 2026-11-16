# Đưa giao diện Admin Preview ra trang sản phẩm công khai — 01/11/2026

## Yêu cầu và kết quả mã nguồn

Ảnh tham chiếu của chủ dự án là `/admin/products/1/preview`. Trang công khai `/products/[slug]` dùng cùng `ProductDetailView`/`EditorialGallery` và CSS với preview: rail ảnh, ảnh chính, ba panel theo vai trò ảnh đã lưu, panel thông tin cuộn trên desktop, chọn màu/size và nội dung phía dưới. Complete the Look đã được bỏ khỏi shared view theo yêu cầu ngày 02/11/2026. Không lấy screenshot làm nền giao diện.

Source trước tác vụ đã dùng chung phần bố cục nhưng nhóm nút mua công khai là UI đơn giản từ shop-client. Tác vụ này thay bằng `ProductPurchase` scoped theo CSS preview, nối các thao tác thật và lối vào trang công khai. Giữ các thay đổi account dialog/media đang có trong workspace.

## Chức năng được nối

- `ADD TO BAG`: gửi variantId đúng lựa chọn, quantity1 và add=true tới POST `/api/shop`; khóa click lặp trong lúc request, hiển thị đang thêm/thành công/lỗi. Server hiện hữu kiểm session/giá/tồn kho.
- `BUY NOW`: cùng thao tác thêm đúng biến thể, sau thành công dùng Next router tới `/checkout`; checkout tiếp tục có COD và voucher T02.
- Yêu thích: lưu theo slug qua action favorite, thông báo đã lưu, có link danh sách để quản lý/bỏ lưu. Không hiển thị là đã lưu khi API thất bại.
- Người chưa đăng nhập nhận link `/login?next=...` quay lại sản phẩm với query variant; public route chỉ chọn ID có trong variants đã được public reader trả về. Đăng nhập xong khách bấm thao tác mua lại, không tự đặt đơn.
- Đổi màu/size tiếp tục cập nhật giá/stock/ảnh biến thể bằng selector và gallery hiện hữu; thiếu giá VND/hết hàng/inactive khóa nút mua kèm thông báo.
- Ảnh sản phẩm trong collection homepage và catalog/search nay là lối vào PDP, thay vì chỉ tên là link. Không tạo product link giả khi chưa có slug hợp lệ.
- Toolbar admin preview có `Xem trên website ↗` khi row đã xuất bản, lấy URL từ slug thực của row; không hardcode product1 hoặc tên sản phẩm. Dòng hướng dẫn preview không còn nói giỏ/checkout chưa triển khai.
- Size Guide giữ dialog, bổ sung danh sách size và fit đang có từ dữ liệu; chưa có bảng số đo thì nói rõ, không tự tạo số đo.
- Complete the Look không còn render trên public PDP hoặc Admin Preview. Reader/API/queue và dữ liệu liên quan vẫn được giữ, không bị xóa trong thay đổi presentation này.
- You May Also Like chưa có dữ liệu gợi ý thì có link khám phá đúng danh mục. Không dùng placeholder AI hay mẫu5 sao của preview như dữ liệu khách thật.

## Ranh giới public/admin

Các nút upload/chỉnh ảnh, thêm màu/size Demo, tạo món chờ và dữ liệu minh họa rating vẫn thuộc preview. Public chỉ dùng ảnh được phép công khai, sản phẩm active và variants thật; không copy các local Demo options vào DB hoặc tạo giá/stock để bật nút mua.

Ảnh/panel phụ và các món phối cùng chỉ có khi admin đã lưu đúng vai trò ảnh/hoàn thiện món liên quan. Không tự lấy ảnh khác lấp panel thiếu. Không đổi trạng thái xuất bản, giá, tồn, auth, schema hoặc dữ liệu của product1 trong tác vụ này.

## Tệp thay đổi

- Thêm `src/components/products/product-purchase.tsx`: commerce interactions cho PDP, dùng CSS preview.
- Sửa `product-detail-view.tsx`/`product-detail.module.css`: nút mua chung hình thức, breadcrumb/brand-category, Size Guide, lối khám phá liên quan.
- Sửa `src/app/products/[slug]/page.tsx`: nhận initial variant từ link quay lại, reset state theo slug/currency/variant, giữ variant khi đổi currency.
- Sửa `src/components/admin/product-showroom.tsx`: link ra public và lời hướng dẫn chính xác.
- Sửa `src/components/shop/shop-client.tsx`: bỏ PurchaseButtons giản lược cũ và imports chỉ phục vụ component đó; các luồng cart/checkout/voucher/orders giữ nguyên.
- Sửa `complete-look.tsx`/`complete-look.module.css`: empty public và CTA shop hữu ích.
- Sửa `src/components/home/collection-grid.tsx`/`collection.module.css`, `src/components/products/catalog-content.tsx`: ảnh card mở đúng PDP, giữ ảnh và nội dung khi không có link.
- Docs: báo cáo này, PROJECT_CONTEXT, ROADMAP, ARCHITECTURE, SESSION_LOG và ghi chú Showroom hiện hành.

## Kiểm tra và trạng thái chạy

Theo chỉ đạo **tuyệt đối không test**, phiên này chỉ đọc/chỉnh source và Markdown. **Không chạy test, lint, typecheck, build, HTTP, browser/Computer Use hoặc truy vấn DB xác minh.** Không có khẳng định kiểm tra pass hoặc khớp pixel trên màn hình thực tế. Không dùng worker.

Đã cập nhật source public; không tạo bản build mới hoặc restart server. Next dev sẽ nhận thay đổi theo cơ chế phát triển. Nếu dùng bản production từ start-demo.cmd/npm start, build cũ chưa tự có source mới; cần build lại trong bước vận hành do chủ dự án thực hiện khi muốn nạp phiên bản này.

## Đường dẫn sử dụng

Admin mở `/admin/products/1/preview` → nếu sản phẩm active, bấm **Xem trên website**; nếu chưa xuất bản, chọn Xuất bản và Lưu sản phẩm qua luồng hiện hữu trước. Khách có thể đi từ ảnh/tên ở homepage hoặc `/products` đến cùng trang công khai. Không có đường public theo ID1 riêng.

**Giới hạn còn lại:** chưa có bảng size chi tiết/review thật/AI recommendation; không nghiệm thu thao tác hoặc responsive vì yêu cầu không test. Product1 nếu stock0 thì nút mua vẫn khóa đúng dữ liệu, cần admin tự cập nhật tồn hợp lệ nếu muốn bán thử.
