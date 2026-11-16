# Thiết lập payOS cho AUREL

## Trạng thái ngày 02/11/2026

Source checkout, webhook, đối soát và giao diện dùng SDK `@payos/node` 2.0.5. Ngày 02/11 đã backup/restore kiểm chứng, áp riêng migration payOS, bật `PAYOS_ENABLED=true`, đăng ký webhook thật và restart production. POST public thiếu chữ ký trả400. Chưa tạo payment link hoặc chuyển tiền. Sản phẩm thử thật 1.000đ ID63/variant120 được ghi rõ TEST không giao hàng; xem `LOGS/PAYOS_LIVE_1000_TEST.md`.

## Database và triển khai

1. Backup database và xác minh restore vào database cô lập theo quy trình dự án. Review riêng `prisma/migrations/20261102150000_payos_payments/migration.sql` trên bản restore, bao gồm quyền runtime và transaction checkout/stock/voucher. Không dùng `migrate reset`, `db push` hay deploy cả các migration pending ngoài phạm vi.
2. Migration additive tạo OnlinePayment, PaymentAttempt và PaymentReceipt; không sửa Order/OrderItem cũ. Dùng quy trình reviewed migration hiện có để triển khai riêng migration này sau rehearsal. Không tự thêm vào allowlist checksum khi chưa review.
3. Runtime role cần SELECT/INSERT/UPDATE trên OnlinePayment và PaymentAttempt, SELECT/INSERT trên PaymentReceipt, USAGE/SELECT trên sequence `public."PaymentAttempt_orderCode_seq"`. Migration owner cấp theo policy đã review; không dùng credentials owner để chạy web. Giữ các quyền Order/OrderItem/ProductVariant/Voucher hiện hữu.
4. Chạy `npx prisma generate`, `npm run typecheck`, `npm run lint`, `npm run build`. Restart đúng instance Next.js và Cloudflare Tunnel để phục vụ bản build mới. Follow-up02/11/2026 đã vá Next16.4.3/minimatch11.0.3, audit full/production0; duy trì baseline tại `docs/DEPENDENCY_SECURITY.md`.

## Biến môi trường server

```dotenv
BETTER_AUTH_URL="https://aureluxury.store"
PAYOS_ENABLED=false
PAYOS_CLIENT_ID=""
PAYOS_API_KEY=""
PAYOS_CHECKSUM_KEY=""
```

Điền giá trị thật chỉ trong environment cục bộ của server. `.env*`/`.env.local` được ignore, `.env.example` chỉ có placeholder. Bật `PAYOS_ENABLED=true` sau khi schema/quyền/HTTPS route sẵn sàng. Cờ này chặn tạo đơn và link mới; tắt cờ vẫn cho webhook/đối soát các link đã tồn tại khi còn credentials hợp lệ. Không đổi checksum key khi còn cần xác minh các thông báo cũ.

## Đăng ký webhook thủ công

URL: `https://aureluxury.store/api/payos/webhook`.

- Webhook là route POST công khai, Node.js runtime, không yêu cầu đăng nhập hoặc Origin; luôn kiểm tra signature bằng SDK trước khi ghi dữ liệu. Các mutation của khách vẫn yêu cầu signed session, ownership và same-origin.
- Dùng POST `{}` với `Content-Type: application/json` để kiểm tra: bản triển khai mới phải trả 400 cùng lỗi chữ ký. 404 nghĩa là chưa phục vụ route mới; 403/HTML challenge có thể do Access/WAF. Không tắt WAF/CSRF toàn site; chỉ review rule áp cho webhook.
- Kiểm tra đăng ký hiện có trong payOS Dashboard và xác nhận chủ đích thay URL trước khi chạy script. Script **không** chạy từ startup/build/test và sẽ không đăng ký nếu public route chưa từ chối signature thiếu đúng cách.

```powershell
npx tsx scripts/confirm-payos-webhook.ts --replace-production-webhook
```

Script dùng `payOS.webhooks.confirm(webhookUrl)` của SDK, không in response chứa thông tin ngân hàng. Không chạy script trong phiên này. Máy tính hoặc Next.js/Tunnel tắt thì webhook ngừng hoạt động; cần host chạy liên tục và lịch đối soát vận hành trước production.

## Vận hành và kiểm thử chấp nhận còn lại

- Người bán đăng nhập role ADMIN và mở `/admin/orders` (menu tài khoản hoặc sidebar sản phẩm). Dashboard tự đọc DB20giây khi đang xem trang; verified PAID/non-reconciliation xuất hiện ở **Cần xử lý**. Dùng **Xác nhận · Chuẩn bị hàng → Đã giao vận chuyển → Đã giao thành công** để lưu trạng thái cùng Order; khách thấy trạng thái mới khi tải lại đơn của mình. COD tracked giữ workflow cũ; báo cáo/tồn kho ở `/admin/orders/reports`.
- Nhóm **Chờ thanh toán** chỉ theo dõi đơn payOS chưa PAID; **Cần đối soát** chặn xử lý giao/hủy/tạo thêm payment cho khoản tiền cần review. Seller không được tự đánh dấu đã thu tiền từ dashboard. API `/api/admin/orders` kiểm ADMIN/Origin/session và tái sử dụng transaction hiện hữu.
- Preflight sau rollout02/11 xác nhận Order và cả ba bảng thanh toán có sẵn, PAYOS_ENABLED true. Dashboard không tự deploy migration; rollout được thực hiện thủ công theo yêu cầu owner. Xem LOGS/PAYOS_LIVE_1000_TEST.md.

- Khách phải đăng nhập; dự án chưa có guest checkout. PAYOS và COD dùng cùng form địa chỉ, cart snapshot, voucher và khóa idempotency hiện hữu. Phí vận chuyển hiện tại là 0 VND, chưa tích hợp hãng vận chuyển.
- Đơn được tạo, trừ/giữ tồn kho và xóa giỏ trong cùng transaction trước khi tạo link. Thất bại tạo link giữ đơn để thử lại từ checkout/lịch sử; không tạo lại đơn từ callback. Không tự khôi phục giỏ vì có thể tạo đơn và giữ kho hai lần.
- Hủy/hết hạn **phiên payOS** giữ đơn PENDING và reservation để thử lại. Muốn giải phóng kho/voucher: hủy phiên thành công trước, rồi hủy đơn qua workflow hiện hữu. Không có cron tự giải phóng reservation. Cần chính sách vận hành đơn bỏ dở.
- Chỉ PAID được xác minh và không bị cờ đối soát mới được chuyển sang xử lý/giao hàng. Kho không bị trừ lần nữa khi webhook đến. Fulfillment không tự chạy từ webhook.
- Tiền đến sau hủy/hết hạn, trả thiếu/thừa hoặc tham chiếu khác được giữ trong PaymentReceipt/cờ đối soát. Đơn cần đối soát không cho tạo phiên mới hoặc giao hàng. Chưa có nút hoàn tiền/clear cờ: operator phải kiểm tra ledger payOS/ngân hàng, hoàn tiền theo quy trình riêng và thực hiện thay đổi trạng thái được kiểm toán; không clear cờ bằng thao tác tùy tiện.
- Chạy `npm run test:payos` dùng DB/provider mock và crypto SDK thật; không gọi payOS thật. Test concurrency với mock không thay thế PostgreSQL concurrency/rollback QA. Chưa nghiệm thu signed-session HTTP, browser desktop/mobile, quét QR bằng ngân hàng hay callback thực tế.
- Chỉ tạo giao dịch thử có tiền sau khi owner cho phép số tiền và thao tác cụ thể. Không có chuyển tiền thật trong automated tests.

Tài liệu chính thức đã đối chiếu: [Node SDK](https://payos.vn/docs/sdks/back-end/node/), [API](https://payos.vn/docs/api/), [SDK source](https://github.com/payOSHQ/payos-lib-node).
