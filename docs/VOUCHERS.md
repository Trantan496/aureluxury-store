# Voucher và giảm giá checkout — T02 (01/11/2026)

## Chức năng đã triển khai

- ADMIN tạo/sửa/bật/tắt voucher tại `/admin/vouchers`; có liên kết từ tài khoản và màn hình đơn admin.
- Mã gồm3–32 ký tự chữ/số/gạch ngang/gạch dưới, được chuẩn hóa chữ hoa; không đổi code đã tạo để tránh nhầm lịch sử. Không xóa mã đã có lịch sử sử dụng.
- Hai hình thức: giảm số tiền VND hoặc phần trăm nguyên1–100. Có đơn tối thiểu, trần giảm, thời gian bắt đầu/kết thúc, tổng lượt và lượt mỗi khách. Đợt này một mã/đơn, áp toàn bộ tiền hàng, không cộng dồn.
- Checkout nhập mã → Áp dụng mã để xem tiền hàng/giảm/tổng phải trả từ server. Mã sai/hết hạn/hết lượt/chưa đạt tối thiểu có thông báo; khách có thể chọn Không dùng mã. Đang sửa/kiểm tra mã thì không cho submit đơn.
- Đơn khách/admin và phiếu đóng gói hiển thị voucher cùng số tiền gốc/giảm/phải trả. Báo cáo đơn hiện hữu lấy totalAmount nên dùng doanh thu quy ước sau giảm.

Không tạo voucher mẫu tự động. Chủ dự án tự tạo mã thật trong môi trường demo qua tài khoản ADMIN; không seed đơn/khách/lượt dùng giả.

## Cách dùng

1. Khởi động `start-demo.cmd`, mở `http://localhost:3000/admin/vouchers` bằng ADMIN.
2. Ví dụ cấu hình: code `DEMO10`, loại phần trăm, mức10, đơn tối thiểu200000 VND, trần50000 VND; đặt ngày bắt đầu/kết thúc và giới hạn phù hợp. Đây là ví dụ, mã chưa tồn tại cho đến khi admin lưu.
3. Khách thêm sản phẩm vào giỏ → `/checkout` → nhập code → Áp dụng mã → xem tổng mới → xác nhận COD.
4. Xem phần giảm giá trong `/account/orders` hoặc `/admin/orders`. Hủy đơn PENDING của khách hoặc hủy trước giao bằng ADMIN sẽ hoàn kho và lượt voucher.

Thời gian admin nhập theo múi giờ thiết bị, gửi ISO có offset/UTC lên server, lưu UTC. Hiệu lực bao gồm thời điểm bắt đầu và loại trừ thời điểm kết thúc. Phí ship demo vẫn0; voucher chỉ giảm tiền hàng.

## Tính tiền và lịch sử

- Toàn bộ phép tính voucher dùng BigInt, không dùng float để tính phần trăm hoặc số tiền.
- `giảm = min(tiền hàng, trần nếu có, mức cố định hoặc floor(tiền hàng × phần trăm / 100))`.
- `tổng phải trả = tiền hàng − giảm`, không âm. Ví dụ tiền hàng299999, giảm15% →44999 đồng (làm tròn xuống); tổng255000 đồng. Ví dụ giảm cố định50000 trên đơn30000 → giảm30000, phải trả0.
- VND chỉ nhận số nguyên. Không nhận tổng tiền/khoản giảm/identity từ client làm dữ liệu ghi đơn. Backend đọc lại giá, tồn kho và voucher lúc chốt.
- Client gửi expectedTotal cho mã đã áp dụng. Nếu giá/mức giảm thay đổi so với preview, backend trả409 để khách áp dụng lại/xác nhận; không âm thầm tạo đơn với tổng khác.
- OrderItem giữ giá và lineTotal trước giảm. Order thêm `subtotalAmount`, `discountAmount`, `voucherCode`: subtotal bằng tổng lineTotal, total bằng subtotal trừ discount.
- Đơn cũ không backfill giá hoặc tiền tệ: subtotal NULL, discount0, codeNULL. Giữ nguyên tất cả cột/giá trị cũ; constraint cũ khi discount0 vẫn có ý nghĩa như trước.

## Lượt dùng, đồng thời và hủy

- `VoucherRedemption` unique theo orderId, lưu code/discount snapshot. Count chỉ tính lượt có releasedAt=NULL.
- Quote không giữ chỗ lượt. Checkout Serializable khóa voucher rồi kiểm tổng/cá nhân; ghi thực version voucher để làm stale snapshot bị serialization conflict, sau đó order/stock/redemption/cart cùng commit hoặc rollback. Dùng lại cơ chế retryP2034 giới hạn hiện hữu.
- Replay cùng checkout key trả đơn cũ trước khi đọc giỏ hoặc kiểm mã, không tiêu thêm lượt, kể cả voucher đã tắt/hết hạn sau đó.
- Hủy trước giao hoàn lượt đúng một lần bằng releasedAt, cùng transaction với status và kho. Khóa voucher trước kho để thống nhất thứ tự với checkout. Hủy đơn không xóa lịch sử redemption; trạng thái cuối không thể bật lại.
- Version thay đổi cả khi admin sửa, checkout dùng hoặc hủy hoàn lượt. Form admin cũ bị409, cần Tải lại danh sách và mở sửa lại; tránh ghi đè trạng thái mới.
- Tắt mã/giảm giới hạn không làm thay đổi đơn đã chốt. Nếu giới hạn mới thấp hơn lượt đang dùng, lượt mới bị từ chối cho tới khi đủ điều kiện.

## Dữ liệu và migration

- Prisma: Voucher, VoucherRedemption và trường tiền trên Order; không thay các bảng giá sản phẩm hoặc công thức lineTotal.
- Migration `20261101170000_checkout_vouchers` thêm tables/checks/FKs và cập nhật2 functions kiểm tổng đơn thành tổng dòng trừ discount; giữ deferred triggers, currency và revision guards.
- Script scoped `scripts/apply-voucher-migration.ts` chỉ áp migration này, không áp các taxonomy/HEX còn pending. Có guard local/test, checksum manifest, advisory lock, DDL transaction và đối chiếu cột/dòng gốc trước commit.
- Đã áp dụng vào `aurel_ai_test`, sau đó `aurel_ai`. Trước main: pg_dump, khôi phục DB riêng `aurel_ai_restore_test_20261101163350_a7514c`, đối chiếu fingerprint với nguồn, áp DDL trên bản khôi phục, xác nhận main chưa đổi rồi áp main.
- Báo cáo local: `.local/backups/voucher-migration-aurel_ai_test.json`, `.local/backups/voucher-migration-aurel_ai.json`. Backup main: `.local/backups/aurel_ai-before-vouchers-20261101163350-a7514c.dump`. Không đưa dump lên nơi công khai.
- Manifest `tests/support/reviewed-migrations.json` đã thêm checksum SQL mới. Prisma Client đã generate lại; main chỉ thêm migration này, không migrate-all.
- Rollback không được đơn giản khôi phục constraint tổng cũ nếu đã có đơn giảm giá. Nếu cần ngừng voucher, tắt mã; giữ schema/lịch sử. Khôi phục snapshot là thao tác riêng cần đối chiếu dữ liệu mới trước khi thực hiện.

## Kiểm tra và giới hạn

Theo yêu cầu mới nhất: **0 test nghiệp vụ tự động, không worker/Computer Use/browser/HTTP đặt thử**. Không tạo đơn hoặc redemption trên main/DB test.

Đã chạy Prisma generate, Prisma validate, typecheck, lint và build; kết quả cuối đều exit0. Kiểm tra tĩnh lần đầu phát hiện cú pháp BigInt literal không hợp target TypeScript, đã sửa sang BigInt(...) rồi chạy lại thành công. Migration/backup/restore và bảo toàn dữ liệu là bước triển khai cấu trúc, không được trình bày như test checkout đã pass.

Chưa xác minh bấm form/thao tác voucher thực tế hoặc chạy cạnh tranh lượt cuối bằng test; không khẳng định đã nghiệm thu các tình huống đó. Chủ dự án có thể tự dùng hướng dẫn ở trên. Bản build mới đã chứa `/admin/vouchers`; khi hoàn tất build không thấy listener3000, nên cần khởi động `start-demo.cmd` để dùng.

Phạm vi sau: chưa voucher theo sản phẩm/nhóm khách, cộng dồn, miễn phí ship, Flash Sale/combo/sinh nhật, thanh toán online hay hoàn tiền. ADMIN list tối đa200 mã, chưa phân trang.

## Tệp chính

- `src/features/vouchers/rules.ts`, `service.ts`: validation, tính giảm, hạn/lượt, quản trị.
- `src/features/shop/service.ts`: quote, checkout, cancel, orders; giữ API `/api/shop` và origin/auth guards hiện hữu.
- `src/components/admin/voucher-manager.tsx`, `src/app/admin/vouchers/page.tsx`: giao diện ADMIN.
- `src/components/shop/checkout-voucher.tsx`, `shop-client.tsx`: áp/bỏ mã, tổng tiền, order snapshot UI; định dạng số nguyên bằng BigInt.
- AccountControl, phiếu đóng gói, globals.css: điều hướng, hiển thị discount, tổng tiền.
- Prisma schema/generated client/migration, manifest và script scoped deployment.

**Bước chức năng kế tiếp:** T03 thông báo đơn trong website; trước đó chủ dự án tự nhập một mã trên admin và đặt COD nếu muốn nghiệm thu T02 bằng giao diện.
