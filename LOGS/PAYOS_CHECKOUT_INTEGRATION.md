# Tích hợp checkout payOS — AUREL, 02/11/2026

> Follow-up cùng ngày: dependency patch đã nâng Next16.4.3/minimatch11.0.3, full/production audit17→0, lint/typecheck/build đạt. Các kết quả17vulnerabilities bên dưới là snapshot của phiên tích hợp trước khi vá. Xem [DEPENDENCY_SECURITY_PATCH.md](DEPENDENCY_SECURITY_PATCH.md); rollout payOS/migration/public webhook vẫn pending.

> Follow-up dashboard: `/admin/orders` đã có seller READY/WAITING/REVIEW/ALL queue và cập nhật fulfillment status bằng transaction hiện hữu;9/9mock đạt và workspace build đạt sau khi dừng PID build treo theo yêu cầu owner. Read-only DB vẫn thiếu3bảng payment/flagfalse. Xem [PAYOS_SELLER_DASHBOARD.md](PAYOS_SELLER_DASHBOARD.md).

## 1. Tổng quan

Đã triển khai source tích hợp payOS vào checkout hiện hữu: chọn phương thức, tạo/reuse đơn, inline VietQR từ payload thật, hosted fallback, trạng thái/copy/countdown/hủy/thử lại, webhook xác minh SDK và đối soát server. COD, voucher, cart và tồn kho tiếp tục dùng service/transaction hiện hữu. **Chưa bật production**: migration chưa apply, public webhook kiểm tra gần nhất404, cần QA PostgreSQL/browser; audit đã được vá trong follow-up cùng ngày. Không có link/chuyển tiền thật được tạo.

## 2. Files tạo mới

- `src/features/payments/{rules,provider,service,http}.ts`.
- `src/app/api/payos/{create,status,webhook}/route.ts`.
- `src/app/checkout/{success,cancel}/page.tsx`.
- `src/components/shop/{payos-payment.tsx,payos-payment.module.css,payment-return.tsx}`.
- `prisma/migrations/20261102150000_payos_payments/migration.sql`.
- `scripts/confirm-payos-webhook.ts`, `tests/payos.test.mjs`.
- `docs/PAYOS_SETUP.md` và báo cáo này.

## 3. Files sửa

`prisma/schema.prisma`, `src/features/shop/service.ts`, `src/components/shop/shop-client.tsx`, `src/app/checkout/page.tsx`, `src/app/globals.css`, `next.config.ts`, `.env.example`, `package.json`, `package-lock.json`, `docs/{PROJECT_CONTEXT,ARCHITECTURE,ROADMAP,DECISIONS,SESSION_LOG}.md`. Prisma Client được generate lại trong đường dẫn đã ignore. `.env`, dữ liệu, account/role và Cloudflare không bị sửa.

## 4. Quyết định kiến trúc

- SDK `@payos/node` đã cài 2.0.5, dùng đúng `paymentRequests.create/get/cancel`, `webhooks.verify/confirm`. Provider server-only, tạo lazy, timeout 10 giây, SDK retry tự động tắt, logging tắt, base URL cố định endpoint chính thức.
- OnlinePayment 1:1 Order; sự hiện diện xác định phương thức PAYOS. Không backfill hoặc thêm scalar vào Order để giữ đường đọc/COD hoạt động khi payment migration pending. Source kiểm tra capability của ba bảng trước checkout online/đọc payment trên danh sách đơn.
- Row lock Order + Serializable và retry rollback giới hạn bảo vệ trạng thái. Network I/O nằm ngoài transaction, có lease 30 giây cho create/reconcile/cancel. Partial unique index chỉ cho một attempt PENDING/PROCESSING mỗi đơn.
- Giữ namespace idempotency orderNumber cũ `DEMO-user-UUID` cả online, để không phá guard tồn kho và replay; tên prefix không có nghĩa payOS là tiền giả. UI cảnh báo chuyển khoản thật khi chọn payOS.
- Không gửi item list vào create vì voucher giảm trên header; amount là net snapshot để tránh list gross cộng không khớp. Description tối đa 9 ký tự để tương thích giới hạn tài khoản ngân hàng của API.

## 5. Database

Migration additive, transaction, lock/statement timeout, FK RESTRICT và constraints:

| Bảng | Vai trò |
| --- | --- |
| OnlinePayment | Liên kết Order, PAID timestamp, cờ cần đối soát |
| PaymentAttempt | Numeric orderCode riêng, amount kỳ vọng, link/QR, trạng thái, lease, expiry, references |
| PaymentReceipt | Reference unique, khoản VND thực nhận, attempt và thời điểm ghi nhận; giữ cả khoản sai số tiền |

BIGSERIAL bắt đầu 1000000000000, ràng buộc <= Number.MAX_SAFE_INTEGER; namespace tránh internal ID và probe đăng ký 123. Amount VND nguyên dương <= safe integer, DB uniqueness chặn duplicate active attempts/link/reference. Không chạy migration/reset/db push; chưa xác minh SQL trên PostgreSQL thật. Quyền runtime cho ba bảng/sequence cần review và rehearsal; không cấp tự động.

## 6. API

| Endpoint | Quyền / chức năng |
| --- | --- |
| POST `/api/shop` action checkout | Session + Origin; chọn COD/PAYOS, giá/stock/voucher trusted server, chốt đơn atomic |
| POST `/api/payos/create` | Session + Origin + ownership; body orderId, create/reuse attempt |
| GET `/api/payos/status?order=…` | Session + ownership; chỉ đọc DB, không gọi provider |
| POST `/api/payos/status` | Session + Origin + ownership; action reconcile/cancel, có lease và throttle 30 giây |
| POST `/api/payos/webhook` | Public, JSON bounded 16 KiB, bắt buộc chữ ký SDK hợp lệ; không tin outer success |
| `/checkout/success`, `/checkout/cancel` | Session/ownership trên server, chỉ order query dùng để tìm đơn; không tin paid/status từ URL |

400 input/chữ ký, 401 session, 403 Origin, 404 ownership/order, 409 state/amount, 413 body size, 502 provider tạm lỗi, 503 config/schema/dịch vụ. Responses no-store, không có credentials. Callback pages noindex/no-referrer.

## 7. Lifecycle

1. Checkout khóa user, validate cart/giá VND/active variants/quantities, quote voucher thật và expectedTotal; order/items/reservation/voucher redemption/cart clear commit cùng transaction. Replay key trả cùng ID/method.
2. Create khóa Order, kiểm tra owner/PENDING/chưa PAID/không cần đối soát, đối chiếu tổng snapshot, lưu amount và attempt trước network. Reuse link còn hạn. Timeout giữ mã; retry GET cùng orderCode trước khi thử create cùng mã. Không phát sinh order từ callback.
3. QR PNG local qua `qrcode`, dựa nguyên `qrCode` SDK trả về; không tự ghép VietQR, không gọi dịch vụ QR ngoài. Hiện bank name theo BIN đã biết, BIN fallback cho bank chưa map; account/name/amount/description thực. Hosted URL chỉ cho HTTPS `pay.payos.vn`. Nếu lost create response, GET phục hồi hosted URL chính thức; QR/account details chưa lấy lại được từ GET thì dùng hosted fallback.
4. UI GET polling từ 5 lên tối đa 15 giây; pause khi document hidden, abort/clear timer khi unmount, ngừng terminal. Reconcile tối đa khoảng mỗi 60 giây khi UI active; server throttle 30 giây. Retry sau terminal khởi động lại polling.
5. Webhook SDK verify async; so orderCode/link/currency/amount. Reference unique + order lock tránh ghi PAID hai lần. Kho đã reserve nên không giảm lần nữa. Signed GET có status PAID, amountPaid đúng và remaining0 cũng có thể đồng bộ; giữ transaction references thực.
6. Sai số tiền được lưu receipt và flag thay vì mất dấu tiền/đánh dấu PAID. Tiền đến sau order CANCELLED/session CANCELLED/EXPIRED được ghi nhận và flag, không hồi sinh đơn hay tự giao hàng. Đơn bị flag chặn giao, tạo phiên và hủy đơn tùy tiện.
7. Hủy/hết hạn session giữ reservation và order PENDING để retry. Hủy đơn chủ động sau khi session terminal mới hoàn kho/voucher theo workflow cũ. Chưa có scheduler tự giải phóng đơn bỏ dở hoặc refund UI.

## 8. Bảo mật

Credentials chỉ server, không có secret/banking data thật trong report/log. Frontend chỉ nhận payment details của chủ đơn. Số tiền lấy từ DB, BigInt đối chiếu snapshot rồi chuyển safe integer. Guest checkout không được thêm: hệ thống hiện hữu cần đăng nhập. External return URL không quyết định PAID. Unknown signed webhook/probe chỉ acknowledge, không tạo đơn. Không có fulfillment/email callback mới có thể chạy lặp. Tắt PAYOS_ENABLED chặn tạo mới nhưng vẫn nhận webhook cho link cũ.

## 9. Environment

`PAYOS_ENABLED`, `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, canonical HTTPS `BETTER_AUTH_URL` cùng DATABASE_URL/auth hiện hữu. Placeholder trong `.env.example`; `.env*` gồm `.env.local` được ignore. Đã kiểm tra **chỉ boolean presence**: ba credential hiện có, HTTPS origin có, payosEnabled false. Không thay hoặc in giá trị.

## 10. Webhook setup

Đọc `docs/PAYOS_SETUP.md`. POST public URL với `{}` hiện **404** sau khi kiểm tra ngoài sandbox; không chứng minh route triển khai hay WAF cho payOS hoạt động. Chưa đăng ký webhook. Sau migration/quyền/restart/tunnel, route phải trả 400 cho signature thiếu; operator review đăng ký hiện tại rồi chạy script thủ công có flag `--replace-production-webhook`. Script gọi `webhooks.confirm`, không tự chạy từ build/start/test và không in thông tin tài khoản ngân hàng trả về. Laptop/Next/Tunnel tắt => webhook ngừng hoạt động.

## 11. Kiểm tra thực chạy

- `npx prisma generate`: đạt; `npx prisma validate`: đạt.
- `npm run typecheck`: đạt sau tạo schema/UI; production build có kiểm TypeScript riêng.
- `npm run lint`: đạt ban đầu với một warning img QR; sau thêm lý do render data URL cùng directive scoped, lint tiếp theo đạt không warning.
- Lượt cuối sau toàn bộ source changes: `npm run lint`, `npm run typecheck`, `npm run build` cùng exit0; routes payOS và callback pages xuất hiện trong production route manifest. Không gọi provider khi build.
- `npm run test:payos`: sandbox dừng trước case do Windows `uv_os_get_passwd ENOMEM`; ngoài sandbox **20/20 đạt**. Sau rà soát, thêm một case signed GET đối soát, chạy chọn lọc 7 ca liên quan: **7/7 đạt**, trong đó 6 ca cũ chạy lại và 1 ca mới; sau bổ sung PaymentReceipt, chạy lại đúng 7 ca bị ảnh hưởng, **7/7 đạt**.
- Tổng **22 tình huống mock riêng biệt**: thiếu config, checkout input sai, IDOR, sai amount/receipt, concurrent create, paid guard, provider failure, signed webhook, invalid signature, duplicate webhook, concurrent webhook, cancellation, pending, expiry, redirect manipulation, timeout recovery, SSR payment card, late payment, registration probe, CSRF, GET reconciliation và phiên đã nhận một phần tiền rồi bị hủy. Hai ca GET bị ảnh hưởng bởi bổ sung cuối đã chạy chọn lọc **2/2 đạt**. Test dùng crypto SDK thật nhưng DB/provider network mock; không có real link/bank transfer.
- Hai regression hiện hữu chọn lọc trong `tests/shop-rules.test.ts` bằng `--test-name-pattern='checkout rejects|order lifecycle'`: **2/2 đạt**. Không full suite.
- Theo yêu cầu đính kèm mới liệt kê ít nhất17 tình huống, tác vụ áp dụng yêu cầu kiểm thử mới thay giới hạn10case cũ. Không gộp subtests để lách giới hạn; mỗi tình huống được ghi riêng.
- Một HTTP acceptance public POST webhook `{}`: **404, chưa triển khai**; sandbox network thất bại trước đó, kiểm tra ngoài sandbox cho kết quả này.
- `npm audit --json`: sandbox network lỗi; ngoài sandbox exit1, **17 vulnerabilities: 16 moderate, 1 critical**. Critical thuộc Next.js16.4.0 (GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr; cùng package có GHSA-p3m5-59mp-jv5r high). Moderate chủ yếu chuỗi ESLint/minimatch. Không downgrade ESLint, không `audit fix --force`, không nâng dependency nền tảng ngoài tác vụ. Không có entry audit cho payOS/qrcode.
- Không PostgreSQL integration/rollback/real concurrent transaction, browser visual/mobile scan, real authenticated payment API, email, actual bank settlement hoặc production webhook verification. SSR case không chứng minh layout mobile/QR scan pass.
- Rà `.next/static` sau build: 0 file chứa các marker `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` hoặc provider API host. Đây là kiểm tra boundary bundle bổ sung, không thay thế audit toàn bộ secret của dự án.

## 12. Lỗi phát hiện và sửa

- Timeout có thể đã tạo link: giữ mã và GET trước retry, không tạo mã khác khi còn uncertain active attempt.
- Webhook đến trước lưu create response: xử lý theo saved code/expected amount, cho gắn link khi chưa có; response create không được ghi đè PAID.
- Callback có thể giả status: chỉ đọc order theo ownership và tin DB/verified provider.
- Lặp/concurrent notifications: order lock/transaction, unique receipts/reference và terminal PAID guard.
- PAYOS_ENABLED tắt có thể làm mất thông báo link cũ: tách config guard tạo mới khỏi provider verify/reconcile.
- Sai số tiền có thể mất dấu khoản nhận: lưu PaymentReceipt và reconciliation flag, chặn giao/tạo mới.
- Payment session hủy không phải order hủy: giữ inventory reservation, hủy order chỉ khi session terminal/không có tiền cần đối soát.
- UI đã bỏ nhãn COD cho đơn payOS; paid attempt cũ được ưu tiên trong summary thay vì lấy nhầm attempt mới nhất.

## 13. Vấn đề còn lại

Chưa apply migration/quyền; chưa PostgreSQL QA; source chưa lên public webhook; thiếu browser QA desktop/mobile và quét ngân hàng. Chưa xác nhận kênh payOS thật, callback/Webhook delivery thật hoặc WAF rule. Audit critical đã được xử lý bằng dependency patch cùng ngày; deployment cần nạp build mới. Chưa cron reservation cleanup, refund automation hoặc UI xử lý/clear reconciliation flag; operator cần quy trình audited riêng. Cart recovery là tiếp tục đơn đã lưu, không tự nhét hàng trở lại giỏ.

## 14. Yêu cầu triển khai

Backup/restore/rehearsal migration riêng → review grants → xử lý Next security advisories → build/restart đúng Next/Tunnel instance → kiểm POST unsigned400 và signed sandbox/mock endpoint trên môi trường cô lập → bật PAYOS_ENABLED → review/register webhook thủ công → nghiệm thu owner có chủ đích nếu muốn giao dịch tiền thật. Không dùng nhánh migrations pending khác làm bước phụ ngầm. Host phải online liên tục.

## 15. Trạng thái cuối

**Source implemented; production rollout chưa hoàn tất.** Các acceptance về code/SDK/amount/ownership/idempotency/signature/UI states/COD preservation có implementation và mock evidence. Acceptance về migration runtime, browser responsiveness/QR scan, payment link thật và public webhook chưa được đánh dấu hoàn tất. Xem setup guide và docs session cho bước chính xác kế tiếp.
