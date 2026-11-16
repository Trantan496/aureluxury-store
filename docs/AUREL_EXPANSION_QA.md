# QA — Homepage editorial expansion

## Trạng thái 2026-10-14
- Đã đọc toàn bộ brief trong attachment pasted-text-1.txt; triển khai đủ thứ tự section và 10 concept.
- Source: hero, Intelligence và collection design không chỉnh trong expansion; các section mới đặt sau CollectionReveal.
- Lint, typecheck và build đạt. HTTP smoke 12 routes/states và 13 internal destinations đạt; kiểm tra đủ 10 data-look, non-purchasable demo labels, section order, anchors và controls SSR.
- HTTP test thứ tự ban đầu thất bại vì footer của layout được stream trước main đang suspend. Đã sửa assertion để xác minh footer tồn tại và thứ tự section trong main; không dùng thứ tự byte footer làm bằng chứng DOM order.
- Computer Use native đã đọc và thao tác được Fashion Store tại localhost:3000 sau khi người dùng mở tab. Blocker đọc URL cũ đã hết.

## Bằng chứng runtime đã quan sát
- Desktop cửa sổ maximized: cuộn LOOK 01→02→03, Next tới 04, End tới 10; Next disabled ở cuối, tiếp tục cuộn xuống Journal và cuộn ngược trở lại LOOK 10→09. Không thấy vùng trắng kéo dài ở endpoint đã thử.
- Mobile 400×811, zoom trang 100%: header đủ menu/brand/search/cart, Next chuyển 01→02 và counter cập nhật. Zoom trước đó làm viewport trông bị cắt; Ctrl+0 khi focus trang khắc phục.
- Mobile 320×811: Intelligence vừa khung, SUIT YOU đậm, CTA đầy đủ; video thay đổi frame liên tục. Collection hai cột, tabs và khoảng cách không bị chồng tại vị trí quan sát.
- Desktop emulation 1440px reduced-motion: carousel dùng bố cục native cao tự nhiên; End chuyển tức thời đến LOOK 10 với focus outline. Đã tắt emulation sau kiểm tra.
- Tablet 768×811: header mobile và category stack vừa khung sau reflow. Chuyển từ desktop sang tablet vẫn thay đổi vị trí tài liệu đang đọc; chưa pass gate resize.
- Console từng hiển thị mutation attributes Grammarly và extension runtime.lastError. Sau refresh không thấy cảnh báo quality90 khi thêm images.qualities [75,90]. Chưa kiểm tra profile sạch; không dùng suppressHydrationWarning.
- Lượt cuối: lint, typecheck, 12 unit tests, build đạt; production 3024 smoke 12 cases/13 destinations đạt. HTTP không thay thế các gate tương tác bên dưới.

## Cách chạy
1. `npm.cmd run build`, sau đó `npm.cmd start -- --hostname 127.0.0.1 --port 3024`.
2. `$env:SMOKE_BASE_URL='http://127.0.0.1:3024'; npm.cmd run test:smoke`.
3. Mở http://127.0.0.1:3024 trong browser có quyền kiểm thử.

## Các gate chưa xác minh — không đánh dấu goal complete
- [ ] Desktop 1440×900 và 1680×1050: hero/collection giữ bố cục; header xuất hiện từ collection, không có hai header; cuộn lên ẩn đúng.
- [ ] Cuộn tới Edit, đi qua toàn bộ LOOK 01…10, thanh progress theo vị trí; look cuối kết thúc sát mép, tiếp tục xuống Journal/footer, không vùng trắng kéo dài. Cuộn ngược từ Journal về LOOK 01.
- [ ] Bánh xe và trackpad không bị intercept; body vẫn cuộn tự nhiên. Resize khi đang giữa chuỗi recalculates travel và không cắt card.
- [ ] Desktop viewport thấp <700px, tablet 768×1024, mobile 390×844 và 320×700: native horizontal swipe, snap, 10 looks truy cập được; không overflow toàn trang.
- [ ] Previous/Next, ArrowLeft/Right/Home/End khi focus carousel; Tab tới product links/CTA không để focus ngoài vùng nhìn thấy; các nút disabled đúng đầu/cuối.
- [ ] prefers-reduced-motion từ lúc tải và đổi runtime: không pin hoặc transform; carousel vẫn thao tác được.
- [ ] Search submit và 4 suggestions tới /search?q thật; 3 category links giữ category trong URL và aria-current; collection filter vẫn hoạt động.
- [ ] Tắt JavaScript: nội dung 10 looks đọc được bằng thanh cuộn ngang, form GET và links vẫn dùng được.
- [ ] Chặn một request ảnh local mới dùng: fallback CSS xuất hiện, không broken image icon hoặc layout shift; không request ảnh campaign null.
- [ ] Loading/error/empty/success: hiện tại unit test catalog cover reader states; xác minh reset/loading tương tác khi có harness browser phù hợp.
- [ ] Không hydration error do source mới; không console error hoặc ResizeObserver loop; kiểm tra tiêu đề, CTA và footer ở tất cả widths.

## Asset/data handoff
- Campaign image của 10 AurelLook hiện null; thay bằng đường dẫn /images/... local đã được đưa vào public. imageAlt, products, href và demo trong src/features/editorial/content.ts là điểm cấu hình.
- Chỉ chuyển demo=false khi href là đích look thật và products là bản ghi thật. Không tạo giá/stock hoặc mua hàng từ concept hiện tại.
- Category/thumbnail dùng 4 ảnh local collection-demo cũ; Journal/stone dùng CSS, không tải/generate ảnh.
- Customer care/social/policies chưa có dữ liệu thật, trình bày văn bản chờ launch. Không newsletter giả.
