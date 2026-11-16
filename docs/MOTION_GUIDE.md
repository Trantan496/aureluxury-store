# Chuyển động AUREL — Charles UX Animation

Nguồn được yêu cầu: [charles-ux-animation/SKILL.md](https://github.com/LemonFace0309/charles-skills/blob/main/skills/charles-ux-animation/SKILL.md), bản đọc có SHA `08c791be03bba2db85326c0fcb57e3a6118e93d3`. Đã đọc recipes (modal, drawer, popover, press, async feedback) và techniques (curves, interruptibility, performance). Áp dụng bằng CSS hiện có, không thêm thư viện animation.

## Danh sách tương tác trước triển khai

| Khu vực | Trigger/tần suất | Điều cần thể hiện | Cách áp dụng |
|---|---|---|---|
| Storefront, catalog, PDP, wishlist | Hover/press, thường xuyên | Thao tác đã nhận, ảnh có thể xem | Feedback nhanh; không che ảnh khi first paint; giữ reveal sản phẩm 200ms/40ms đã đo |
| Điều hướng, account, zoom, admin dialogs | Click/keyboard, vài lần/phiên | Lớp đến từ đâu, đã đóng | Native dialog chuyển trạng thái; đóng không nhận focus/click; Escape/focus gốc được giữ |
| Bộ lọc catalog | Click/keyboard | Nhóm tùy chọn đang mở | Popover 160ms/120ms, origin từ trigger, focus/selection tức thời |
| Chat drawer | Click/Escape | Panel ở bên phải đã mở/đóng | CSS transition có thể đảo chiều; đóng inert trước khi hết hiệu ứng |
| Cart/checkout/auth/admin | Nhập liệu, chọn, submit | Trạng thái hiện tại và pending thật | Token đồng nhất; không transition all/layout, không thay transaction hoặc lạc quan hóa thanh toán |
| Account/orders | Điều hướng/expander | Nội dung đang thay đổi | Bỏ page entrance lặp lại; không làm người dùng đợi hiệu ứng |
| Loading/AI processing | Network, có thể kéo dài | Công việc vẫn diễn ra | Giữ chỉ báo công việc; không thêm progress hoặc kết quả giả |
| Toàn website | Touch/reduced motion | Cùng thông tin và thao tác | Hover movement chỉ ở fine pointer; reduced motion tắt fade/slide, giữ spinner công việc thật |

## Hợp đồng

- Token CSS chung quản lý duration/curve. Press/hover 100–150ms; popover 160/120ms; modal 220/160ms; drawer 280/200ms; reveal card 200ms, stagger 40ms như benchmark hiện tại.
- Không thêm entrance cho trang/nội dung đã đứng yên ở first paint, không thêm độ trễ mạng, không animation width/height/top/left hoặc `transition: all`.
- Không thay schema, giá, inventory, xác thực, thanh toán, optimistic order, cache ảnh hoặc quyền truy cập. Quy tắc project và hành vi đã được chủ dự án yêu cầu có ưu tiên cao hơn ví dụ chung trong skill.
- Không tự thêm tour, confetti, drag/spring, spinner giả hoặc quy trình Undo mới vào tác vụ chỉ chuẩn hóa chuyển động.

## Kế hoạch nghiệm thu (tối đa 10 case)

1. Reveal sản phẩm: first paint giữ nội dung, reveal sau scroll vẫn nằm trong ngân sách 200ms + stagger 40ms.
2. Native menu dialog: mở/đóng giữa chừng, Escape, inert khi đóng và trả focus đúng trigger.
3. Popover catalog: đảo chiều khi toggle nhanh; đóng không focus được, keyboard không bị delay.
4. Zoom/dialog sản phẩm: vị trí ổn định, chuyển trạng thái và đóng bằng Escape (chỉ đọc, không mua).
5. Chat drawer: mở/đóng giữa chừng, inert khi đóng, không gửi tin nhắn.
6. Reduced motion: thông tin/end state giữ nguyên, animation trang/dialog tắt; chỉ báo công việc được giữ.
7. Mobile touch: không sticky hover movement, target icon phù hợp và layout không overflow.
8. Giao diện cart/checkout: feedback điều khiển không trì hoãn trạng thái (render fixture, không submit đơn).
9. Empty collection: không có animation che thông báo hoặc sản phẩm demo (render fixture).
10. Error collection: không che lỗi bằng sản phẩm demo (render fixture).

Admin được chuẩn hóa token/style và kiểm tra qua lint/build; thao tác authenticated admin không được coi là đã nghiệm thu nếu thiếu session.

Lint/typecheck/build được ghi riêng. Phần nào thiếu session hoặc không thể kiểm tra sẽ được ghi rõ, không coi kiểm tra style là giao dịch thật đã đạt.

## Kết quả triển khai

- Đã thực hiện motion foundation và chuẩn hóa các nhóm UI trong bảng; 41 file runtime thay đổi, danh sách ở `.local/ux-motion/runtime-files.json`. Không có dependency mới, không thay nghiệp vụ tiền/đơn/quyền.
- Tất cả 10 case độc lập đã đạt: 8 browser (menu/popover/zoom/drawer/home/reduced-motion/mobile/checkout style fixture), 2 unit empty/error. Case2 có retry chẩn đoán và sau fix layout/exit; case3 sửa lỗi helper RSC; case1 sửa công cụ quy đổi200ms/.2s. Không xóa lịch sử fail hoặc chạy toàn bộ suite.
- Reveal smoke285,1ms, giữ duration200ms và stagger0/40/80/120ms. Không coi một smoke measurement là public A/B mới.
- Lint/typecheck và build snapshot production đầy đủ TypeScript đạt. Chưa authenticated admin/checkout thật, chưa kiểm hết mọi form/browser cũ hoặc scrub mọi animation ở10% tốc độ.
- Preview: `http://localhost:3010`. Chưa deploy live; các thay đổi menu/try-on khác trong workspace được giữ nguyên.
- Báo cáo đầy đủ: `LOGS/AUREL_UX_ANIMATION_2026-11-13.md`.
