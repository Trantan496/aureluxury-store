# Dashboard người bán sau thanh toán payOS — 02/11/2026

## Kết quả triển khai

Đã triển khai dashboard tại `/admin/orders` cho tài khoản ADMIN hiện hữu. Đơn payOS được webhook hoặc signed GET xác nhận PAID sẽ xuất hiện trong nhóm **Cần xử lý**; người bán cập nhật **Chờ xác nhận → Đang chuẩn bị hàng → Đã giao vận chuyển → Hoàn tất**. Dashboard đọc đúng Order đã được tạo khi checkout, không tạo một bản sao đơn sau khi thu tiền.

COD tiếp tục được xử lý theo workflow cũ. Các báo cáo/tồn kho cũ được giữ tại `/admin/orders/reports`. Sidebar sản phẩm có link Đơn hàng & thanh toán; menu tài khoản ADMIN đã có link quản trị đơn.

**Chưa chạy thanh toán thật:** kiểm tra read-only database xác nhận thiếu OnlinePayment/PaymentAttempt/PaymentReceipt và PAYOS_ENABLED false. Migration/setup payOS từ tác vụ trước vẫn cần triển khai trước khi nhận thanh toán live.

## Files

Tạo mới:

- `src/features/orders/seller-order-rules.ts`: DTO/filter/input/action rules cho UI.
- `src/features/orders/seller-orders.ts`: ADMIN guard, server filtering/count/pagination và status service tái sử dụng transaction cũ.
- `src/components/admin/seller-orders.tsx`, `seller-orders.module.css`: dashboard responsive, nhóm đơn/counts, snapshot items/recipient/payment, status controls, polling/empty/loading/error/success.
- `src/app/api/admin/orders/route.ts`: GET dashboard và POST cập nhật trạng thái.
- `src/app/admin/orders/reports/page.tsx`: giữ quyền truy cập báo cáo/low-stock/bestsellers hiện có.
- `tests/seller-orders.test.mjs`: 9ca mock end-to-end ở mức service với crypto SDK thật.
- `.local/check-payment-readiness.mjs`: diagnostic chỉ đọc, in schema booleans/cờ enable; không credentials hoặc dữ liệu khách.

Sửa: `src/app/admin/orders/page.tsx`, `src/components/admin/product-sidebar.tsx`, `src/features/shop/service.ts`, `package.json` (script test:seller-orders), docs context/architecture/roadmap/decisions/session/setup và báo cáo payOS.

Không thêm bảng, migration, dependency hoặc role mới trong tác vụ này. Source/account/orders đã có được giữ nguyên.

## Cơ chế ghi nhận và xử lý

1. Checkout hiện hữu commit Order/items/giá/voucher, giữ kho và xóa giỏ atomic trước khi tạo payment link.
2. Webhook verified hoặc signed provider reconciliation cập nhật OnlinePayment/PaymentAttempt/PaymentReceipt của đúng orderId. Không có đường frontend callback tự đánh dấu PAID.
3. Dashboard truy vấn điều kiện thanh toán trên server **trước khi phân trang**, nên các đơn chưa trả tiền mới hơn không đẩy đơn đã trả tiền ra khỏi giới hạn100 bản ghi cũ. Mỗi trang20 đơn, sort createdAt/id ổn định, counts và rows cùng RepeatableRead snapshot.
4. Poll DB mỗi20giây khi trang visible; pause hidden, abort on unmount/filter changes, chống response cũ ghi đè filter mới. Không gọi payOS từ dashboard. Có nút Làm mới.
5. POST status dùng shopWrite hiện hữu: xác thực signed session, role ADMIN ngoài API/service và fresh DB role trong transaction; Origin/JSON bounded/no-store, order lock/Serializable, expected status chống stale writes và state machine cũ.
6. Chuyển CONFIRMED/SHIPPED/DELIVERED không trừ kho lần nữa. Paid order không được hủy tùy tiện vì cần quy trình refund. Unpaid/reconciliation không được giao hàng. Chỉ tracked OnlinePayment hoặc COD theo namespace đã reserve mới có workflow phù hợp; COD lịch sử không biết quy tắc kho vẫn bị chặn.
7. Đã sửa guard prefix cũ: tracked payOS Order không cần bắt đầu bằng DEMO mới được cập nhật; payment relation là bằng chứng thuộc workflow đã triển khai. Không nới guard legacy không có payment relation.

| Nhóm | Điều kiện |
| --- | --- |
| Cần xử lý | PENDING/CONFIRMED/SHIPPED; COD tracked hoặc payOS PAID không cần đối soát |
| Chờ thanh toán | Order PENDING có OnlinePayment chưa PAID và chưa bị flag |
| Cần đối soát | OnlinePayment.reconciliationRequired, gồm tiền đến muộn/sai tiền |
| Tất cả đơn | Các đơn hiện hữu, gồm hoàn tất/hủy/lịch sử |

Trạng thái giao hàng và trạng thái thanh toán hiển thị riêng. Giao diện không ghi shipping date/ETA giả, không hiển thị số đếm hay đơn fixture trên dashboard.

## Kiểm tra thực chạy — tối đa10tình huống

`npx tsx --tsconfig tests/tsconfig.ui.json --test tests/seller-orders.test.mjs` trong sandbox dừng trước tests do Windows uv_os_get_passwd ENOMEM. Rerun ngoài sandbox: **9/9 đạt**, không kết nối DB/payOS thật:

1. Verified PAID webhook làm đúng đơn hiện hữu vào seller READY queue.
2. Webhook trùng giữ một đơn và một receipt, không trừ kho lại.
3. CUSTOMER không đọc dashboard seller.
4. CUSTOMER không cập nhật status qua seller service.
5. ADMIN không xác nhận xử lý đơn online chưa trả tiền.
6. Đơn PAID bị reconciliation flag không được giao vận chuyển.
7. Expected status cũ không ghi đè trạng thái mới.
8. ADMIN xác nhận tracked PAID order không có DEMO prefix; kho không bị giảm thêm.
9. Filter server trước pagination:121unpaid mới hơn không che một paid order cũ.

Tình huống10: `node .local/check-payment-readiness.mjs` trong BEGIN READ ONLY/ROLLBACK. Database reachable, Order có, ba bảng payOS chưa có, flag enable false. Đây là kết quả **chưa sẵn sàng live payment**, không phải acceptance thanh toán thực thành công. Không đọc danh tính khách hoặc ghi main data.

Checks tách riêng:

- `npm run typecheck`: exit0.
- `npm run lint`: exit0; sau bổ sung chống stale response có một warning ref cleanup, đã sửa qua callback và lượt lint cuối exit0 không warning.
- `npm run build` ban đầu hai lần exit1 vì build process khác giữ `.next/lock`; không xóa khóa hoặc tự kill process lúc chưa được yêu cầu.
- Đã build production source snapshot với Next16.4.3/webpack tại thư mục Temp riêng, node_modules junction tới dependencies hiện hữu; không copy `.env`, chỉ kế thừa environment trong process. Build cuối snapshot exit0 gồm `/admin/orders`, `/admin/orders/reports`, `/api/admin/orders` và toàn bộ routes hiện hữu.
- Sau đó owner yêu cầu dừng tiến trình build treo. Xác minh PID30184 là node/build thuộc workspace này, khởi chạy14:14:26; dừng đúng PID đó theo yêu cầu. **`npm run build` ngay trong workspace sau khi dừng đã exit0**, Next16.4.3/Turbopack compile/types/routes đạt. Không cần xóa lock file thủ công, không dừng server khác.

Không full test suite, không browser/mobile visual QA, không signed-session HTTP acceptance hoặc PostgreSQL transaction/concurrency integration; service tests dùng mock DB không thay thế những kiểm tra đó. Không có payment request/chuyển tiền thật.

## Sẵn sàng vận hành / bước tiếp theo

Dashboard source/build sẵn sàng, user cần đăng nhập ADMIN và khởi động/restart deployment với build mới. Vào `/admin/orders`, nhận đơn đã thanh toán tại Cần xử lý, bấm Xác nhận/Chuẩn bị hàng, rồi Đã giao vận chuyển, cuối cùng Đã giao thành công. Khách xem trạng thái lưu ở cùng Order khi tải lại trang đơn của mình.

Để đơn payOS thật xuất hiện: backup/restore/rehearse/apply riêng `20261102150000_payos_payments`, review runtime grants, triển khai route webhook qua HTTPS, review/register webhook thủ công rồi bật PAYOS_ENABLED theo `docs/PAYOS_SETUP.md`. Không apply pending migrations khác hoặc đăng ký webhook tự động. Cần owner nghiệm thu desktop/mobile và một giao dịch thật có chủ đích sau khi chấp thuận giao dịch cụ thể. Refund/reconciliation resolution UI vẫn thuộc bước sau.
