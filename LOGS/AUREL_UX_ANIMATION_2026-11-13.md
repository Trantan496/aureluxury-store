# Áp dụng Charles UX Animation trên AUREL — 13/11/2026

Nguồn: [charles-ux-animation](https://github.com/LemonFace0309/charles-skills/blob/main/skills/charles-ux-animation/SKILL.md), SHA file `08c791be03bba2db85326c0fcb57e3a6118e93d3`. Đã đọc skill và các recipes/techniques liên quan. Không cài thêm thư viện animation hoặc thay stack.

Danh sách interaction, lựa chọn chuyển động và kế hoạch 10 case được ghi trước triển khai tại `docs/MOTION_GUIDE.md`.

## Thay đổi và phạm vi

| Mức | Nguyên tắc | Vị trí | Trước | Sau |
|---|---|---|---|---|
| Broken | Ranh giới server/client, hoàn thành tác vụ | `catalog-browser.tsx`, `catalog-href.ts` | Server gọi helper export từ file use client, gây lỗi render một số đường dẫn danh mục | Helper URL thuần trong features; server và client cùng import, giữ re-export tương thích |
| Friction | Interruptibility, exit và focus | `motion.css`, `motion-preferences.tsx`, native dialogs | Một số dialog chỉ có keyframe vào hoặc đóng ngay; chưa đồng bộ exit/inert | Modal 220/160ms, sheet 280/200ms; giữ fixed trong exit, closed inert/pointer disabled, Escape/focus do browser quản lý |
| Friction | Context/layout ổn định | `storefront-header.tsx` | Header chỉ cập nhật theo scroll/resize, có thể chưa theo kịp layout streamed | ResizeObserver theo main, coalesce bằng RAF; không đổi navigation hoặc kiểu menu đang có |
| Friction | Exit hiện diện, origin từ trigger | `MotionPanel`, catalog popovers, chat drawer | Conditional mount/unmount và keyframe entry | CSS transition đảo chiều; exit giữ DOM tới animation.finished, inert ngay khi đóng; popover top-right |
| Friction | Frequency, first paint và staging | Account/catalog/chat/home CSS | Page entrance lặp lại, shimmer chạy background-position, chữ có sheen loop | Không entrance cho nội dung đã đứng yên; bỏ sheen/pulse trang trí; skeleton pulse bằng opacity |
| Friction | Performance và feedback | Các CSS module storefront/account/shop/admin | Timing/curve rải rác, transition all và shadow transition | Named tokens, property cụ thể, focus/selection bằng keyboard tức thời |
| Polish | Targets và touch | Header, wishlist, catalog, account close, try-on close, pagination | Một số icon36–40px, hover có thể fire khi tap | Các target chính44px trên coarse pointer; hover movement chỉ fine pointer; press nhẹ trên icon nhỏ |
| Polish | Reduced motion, giữ thông tin | `motion.css`, auth spinners/chat loader | Quy tắc reduced motion rời rạc, một số loop còn chạy | Tắt fade/slide/transition toàn app; chỉ spinner/pulse công việc được đánh dấu là ngoại lệ |

Lớp dùng chung được import ở root layout nên áp dụng cho mọi route hiện có, gồm storefront, danh mục/PDP, cart/checkout, auth/account, chat và admin. CSS module đã có được chuẩn hóa tại chỗ; không thay palette/typography, không dựng page transition làm người dùng chờ, không thêm confetti/spring/drag hoặc tour.

Dense controls trong editor/admin và selection thường dùng được giữ tức thời. Không viết lại luồng payment, optimistic order, giá/tồn kho, validation server, quyền admin hoặc cơ chế Undo. Pending/error text và disabled guard hiện có được giữ; không thêm thời gian chờ để hoàn tất animation.

## Hợp đồng kỹ thuật

- `src/app/motion.css`: tokens feedback150ms/press120ms/popover160–120ms/modal220–160ms/drawer280–200ms/reveal200ms/stagger40ms; curves enter/exit/move; native transitions, retained panel và reduced motion.
- `MotionPreferences`: bật native dialog effects khi browser có beforetoggle/discrete CSS; cập nhật inert trước focus steps; `data-lenis-prevent` cho vùng dialog, khóa background scroll. WeakMap tránh giữ DOM của route đã rời. Cleanup khôi phục thuộc tính do controller sở hữu.
- `MotionPanel`: CSS điều khiển từng frame; React chỉ quản lý presence, không đợi một timeout hardcode để unmount. Close lập tức aria-hidden/inert, exit hoàn tất mới bỏ DOM; reopen hủy cleanup cũ. Drawer trả focus về trigger nếu phù hợp.
- Root loading min-height100svh, Lenis1.2/0.8, upload/no-store, ảnh gốc, giá và queries không bị thay đổi.
- Collection reveal chỉ chuẩn bị các card offscreen; card/heading đã vào viewport không bị ẩn lại để chạy hiệu ứng. Reveal một lần, vẫn200ms và delay0/40/80/120ms theo hàng đã đo.
- Pure `features/catalog/catalog-href.ts` không có use client/server-only; không thay cách ghép filter/query. File client vẫn re-export để giữ các import hiện hành tương thích.
- Native CSS dùng individual translate/scale, giữ transform riêng của component. Dialog giữ fixed khi rời top layer để không chuyển sang absolute giữa exit. Unsupported browser dùng hành vi native căn bản; chưa kiểm chứng mọi phiên bản browser cũ.

## Kết quả 10 tình huống độc lập

| ID | Case | Kết quả / giới hạn |
|---|---|---|
| 1 | Reveal sản phẩm thật sau scroll | Đạt; 285,1ms trong một lượt smoke, duration0,2s và delay0/0,04/0,08/0,12s; không pageerror. Không phải một A/B benchmark mới hoặc cam kết LCP |
| 2 | Native menu mở/đóng giữa chừng, Escape, focus, inert | Đạt sau xử lý layout/exit. Có hai lần đầu fail/chập chờn, một lần chẩn đoán pass và một lần kiểm tra sau fix pass; các attempt được giữ nguyên |
| 3 | Popover catalog, keyboard và exit/reopen | Đạt sau sửa helper server/client. Focus transition0s; closed inert hoặc đã unmount; Escape về trigger |
| 4 | Zoom của một sản phẩm thật | Đạt; dialog trong viewport (x36/y40/w1368/h920), open tương tác được, Escape đóng/inert |
| 5 | Chat drawer, đóng rồi mở lại giữa exit | Đạt; closed không nhận input, reopen đúng trạng thái; không gửi message/POST |
| 6 | Reduced motion | Đạt; card vẫn thấy, native dialog transition0s, Lenis tắt, work spinner được giữ |
| 7 | Mobile touch390×844 | Đạt; menu target44×44, document không overflow, hover false, tap không scale ảnh hero |
| 8 | Checkout keyboard feedback | Đạt trên style fixture dùng CSS checkout thật: selection cập nhật tức thời, transition0s. Không phải authenticated checkout hoặc payment test |
| 9 | Empty catalog | Unit đã chọn đạt; không trả inventory demo |
| 10 | Catalog reader error | Unit đã chọn đạt; không che lỗi bằng inventory demo |

Chỉ 10 tình huống độc lập; không chạy full suite. Case1 lần đầu lỗi công cụ so chuỗi `200ms` với giá trị minifier `.2s`; sửa quy đổi đơn vị rồi chạy lại riêng case lỗi. Case3 lần đầu phát hiện lỗi render server thật, không sửa selector để né lỗi. Các case đã đạt không bị chạy lại toàn bộ khi sửa case tiếp theo. Case2 giữ log mọi attempt, không xóa lần fail để làm đẹp kết quả.

Browser harness chặn POST/PUT/DELETE (chỉ cho GET/HEAD/OPTIONS), không gửi tin nhắn, tạo đơn, thanh toán, thay giá/tồn kho hoặc ghi dữ liệu admin.

## Checks thực sự chạy

- `npm.cmd run lint`: đạt sau sửa lỗi React refs của phiên bản helper đầu tiên; không tắt ESLint rule.
- `npm.cmd run typecheck`: đạt.
- `node .local/ux-motion/run.mjs build --webpack`: build snapshot production riêng, đầy đủ TypeScript, worker2. Build lại sau các sửa code; không ghi `.next` live, không skip type validation.
- `node .local/ux-motion/verify.mjs ...`: 8 case browser như bảng, chạy tiếp từ case chưa chạy hoặc chỉ case lỗi, không full rerun.
- `node --conditions=react-server --experimental-strip-types --test --test-name-pattern="empty catalog stays empty|reader errors are never" tests/collection.test.ts`: 2/2 đạt.
- Static review: không còn transition all hoặc transition width/height/margin/padding trong CSS đã rà soát; không dùng JS React state mỗi animation frame mới. CSS/module source được parse bằng PostCSS hiện có, không thêm dependency.
- Đã xem screenshot catalog và các artifact nghiệm thu. Các ảnh hiển thị là dữ liệu đã có, không tạo sản phẩm/testimonial/rating giả.

## Artifact và giới hạn bàn giao

- Preview riêng: `http://localhost:3010`. Chưa deploy public hoặc restart server live/dev.
- `.local/ux-motion/results/cases.json`, `case-1.png`…`case-8.png`: kết quả và screenshot, có retry history.
- `.local/ux-motion/changed.json`: danh sách migration; `before/`: backup file trước migration; `app/`: build snapshot; `run.mjs`, `verify.mjs`, `migrate.mjs`: công cụ. Không copy env files vào snapshot.
- `docs/MOTION_GUIDE.md`: danh sách tương tác, tokens và kế hoạch test; source skill được link/pin SHA.
- Chưa kiểm thử authenticated admin, giao dịch thanh toán thật, failure của mọi form, Safari/browser cũ hoặc scrub mọi animation ở10% tốc độ. Không coi fixture checkout là bằng chứng transaction đạt.
- Một lượt reveal285ms chỉ là smoke check giữ ngân sách hiện có; chưa có public5cold+5warm/LCP A/B cho bộ motion mới. Không khẳng định sửa được request ảnh3,45s lịch sử.
- Có thay đổi khác trong workspace (menu/try-on) trong lúc làm; giữ nguyên nội dung/luồng của các thay đổi đó, không khôi phục backup đè lên bản mới. Mọi build phục vụ kiểm tra ở thư mục riêng.

Việc tiếp theo: review preview3010; triển khai có kiểm soát source hiện tại rồi nghiệm thu các phiên admin/checkout thực và public performance riêng. Không thêm chuyển động vào các khu vực đó chỉ để đủ hiệu ứng nếu nó làm chậm thao tác.
