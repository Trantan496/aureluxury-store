# PostgreSQL local và xử lý P1001

## Mở đánh giá tài khoản — 13/11/2026
Đã scoped-apply 20261114020000_open_account_ratings: ProductReview.orderItemId nullable, thay view public để không bắt buộc mua. Backup/restore/rehearsal/legacy-data-check đạt; runner activate-product-reviews.ts --confirm-database=aurel_ai --open-ratings. Không đổi dữ liệu cũ/FK/role/env; manifest ở PROJECT_CONTEXT.


## Discussion ảnh/likes/thread — 13/11/2026
Đã áp riêng 20261114010000_product_discussion lên aurel_ai bằng activate-product-reviews.ts --confirm-database=aurel_ai --discussion, sau backup/restore/rehearsal. Thêm 3 bảng/view/triggers, bảo toàn dữ liệu cũ; không migrate-all. Manifest và rollback/giới hạn tại PRODUCT_DISCUSSION.md.


## Bình luận/đánh giá — 13/11/2026
Hai migration ProductReview (20261113211500_product_reviews) và ProductComment (20261113123000_public_product_comments) đã scoped-apply lên aurel_ai, sau backup/verified restore/rehearsal theo yêu cầu kích hoạt của chủ dự án. Runner: scripts/activate-product-reviews.ts --confirm-database=aurel_ai [--comments], từ chối áp lại khi bảng đã tồn tại. Không dùng migrate-all. Backup/manifest/giới hạn xem PROJECT_CONTEXT và SESSION_LOG.


## Voucher — 01/11/2026 (cập nhật mới nhất)
Migration riêng `20261101170000_checkout_vouchers` đã áp vào test/main, thêm Voucher/VoucherRedemption và snapshot giảm giá trên Order. Runner `scripts/apply-voucher-migration.ts` dùng confirmation target rõ, manifest checksum, backup, verified restore trước main và bảo toàn cột/dòng gốc; không chạy migrate-all/pending taxonomy. Chi tiết/backup/giới hạn tại [VOUCHERS.md](VOUCHERS.md). Các số migration và trạng thái phase bên dưới là lịch sử.

> Deployment 2026-10-23: Main aurel_ai: 9 reviewed migrations applied with owner approval; test: 11. PendingProduct is available; the two taxonomy migrations remain pending. No existing product data, sequences or .env changed.
## Complete the Look mới (2026-10-23)
Complete the Look thủ công đã code/test: nútThêm món trong Preview tạo PendingProduct blank/idempotent ngay; mỗi card ảnh+tên+giáVND/Lưu, formHoàn thiện chọncategory/variants thật→existingShowroom→explicitpublish. Queue /admin/products/pending phân trang20, source link; source-look hàngngang/pagination20/khôngcap4. Public chỉ linked child đãpublish/cópublicimage+price, archiveẩn; detach giữqueue/product, parent khôngunpublish/touch. YouMayAlsoLike bỏcategoryheuristic, Preview Chờ AI Recommendations/Productionẩn khiAIchưa có. Main aurel_ai: 9 reviewed migrations applied with owner approval; test: 11. PendingProduct is available; the two taxonomy migrations remain pending. No existing product data, sequences or .env changed. Chi tiếtAPI/files/schema/checks tại [COMPLETE_THE_LOOK.md](COMPLETE_THE_LOOK.md).


## Product Showroom migration đã áp dụng (2026-10-22)
**Main aurel_ai đã được owner phê duyệt và áp dụng riêng migration20261021120000_product_draft_requests: main8/test10**. Bảng idempotency đã sẵn sàng cho Tiếp theo → Showroom. Hai SQL taxonomy vẫn pending riêng; không apply kèm. Backup/verified restore mới aurel_ai_restore_test_20261022073329_9d848d, SHA587d3dbc2d2d8523954713dca6013bba7327a54f4ec3f5e3da64251f18f3b882; no-drift/rehearsal/old rows/sequences/env checks đạt, không fixture main. Report `.local/backups/aurel_ai_restore_test_20261022073329_9d848d.showroom-migration.json`. Không chạy db:migrate chung; không seed/reset hoặc development fixtures main.


## Sự cố auth local ngày2026-10-22
Nếu đăng nhập/đăng ký không dùng được, chạy `npm.cmd run db:check` trước. Lần này ECONNREFUSED do PostgreSQL đã dừng; `npm.cmd run db:start` khôi phục kết nối, auth test DB signup/signin/session/logout đạt. Website không tự khởi động PostgreSQL portable. Dùng đúng http://localhost:3000 như BETTER_AUTH_URL; không mở rộng trustedOrigins hoặc tắt CSRF để chữa lỗi DB. Không làm theo gợi ý migrate init cũ trong stdout helper: main hiện đã đủ5 migrations, không cần migrate/seed/reset. Chưa có tài khoản main sau các lần đăng ký lỗi, cần đăng ký lại khi DB sẵn sàng.

## Trạng thái cập nhật Phase2.9.2 (2026-10-21)
Main local aurel_ai đã apply đủ5 migrations, không còn pending; ba SQL staging được chủ dự án cho phép sau backup/restore/no-drift/rehearsal đạt. Không seed/main fixtures hoặc thay secrets/roles/table grants/ownership. ADMIN Product Management đã có tại /admin/products, nhưng main0 ADMIN và provisioning cần approval riêng. MULTI_CURRENCY_ENABLED vẫn hiệu lực false; public catalog/PDP luôn lọc websitePermission=granted từ schema đã deploy, độc lập cờ AI. Production role/cutover/audit/offsite backup chưa GO. Xem [ADMIN_PRODUCTS.md](ADMIN_PRODUCTS.md) cho evidence/routes/tests/limits. Các mô tả staged/main pending bên dưới là lịch sử trước Phase2.9.2.


Phase2.5.2 thiết kế runtime aurel_app và migration owner, thử LOGINs trên cluster riêng5544; không đổi main credentials/quyền. .env.example chỉ là placeholder tương lai, không tự copy sang .env đang chạy. Xem DATABASE_SECURITY_READINESS.md cho quyền, canary/rollback và backup policy dự thảo; main NO-GO.

Phase2.5.1 đã thêm migration `20261020170000_order_revision` để khắc phục write skew; đã apply test và rehearsal Prisma đủ4metadata. Main còn hai migration pending (multi_currency + order_revision), chưa approval, flag tắt và npm db:migrate vẫn chặn. Không tự gọi migrate deploy/dev/db push hoặc resolve main. Xem ORDER_CONCURRENCY_REMEDIATION.md về regression/timeout/permissions và vòng review riêng.

**Phase 2.5: migration multi-currency chỉ deploy test, chưa aurel_ai.** `npm.cmd run db:migrate` đang chặn có chủ ý. Không chạy migrate deploy/dev/db push vào main khi chưa có approval SQL và legacy currency plan. Giữ MULTI_CURRENCY_ENABLED=false; xem MULTI_CURRENCY.md về backup mới, restore rehearsal và điều kiện triển khai.

Phase 2.4 có DB test `aurel_ai_test`, role/secret riêng và guard. Xem POSTGRES_INTEGRATION_TESTING.md để setup/run/backup-restore; mutation tests không dùng DATABASE_URL ứng dụng trực tiếp. Trước migration tiếp theo cần backup mới và restore drill, review SQL/manifest; không reset hoặc restore đè aurel_ai.

Phase 2.3 đã áp dụng migration additive `20261020153000_better_auth`, giữ User Int và thêm Session/Account/Verification; xem AUTHENTICATION.md về secret/origin. Không tự tạo ADMIN/users. Từ checkout mới, đọc staging/approval trong MULTI_CURRENCY.md trước migrate deploy; chạy prisma generate không áp dụng schema vào DB. Không overwrite schema bằng Better Auth CLI.

## Nguyên nhân đã xác minh ngày 2026-10-20

Prisma đọc đúng `prisma.config.ts`, `prisma/schema.prisma` và URL database `aurel_ai` tại `localhost:5432`. Schema hợp lệ. TCP không kết nối được; `db:check` báo ECONNREFUSED. Không tìm thấy dịch vụ PostgreSQL, binary trên PATH hoặc Docker trong khảo sát. Đây là lỗi server chưa nhận kết nối; chưa phải bằng chứng mật khẩu sai.

## Cách chạy trên máy Windows này

Database portable nằm trong `.local/postgres/data`, binary trong `.local/postgres/pgsql/bin`, log server trong `.local/postgres/server.log`. `.local/` được ignore bởi Git và ESLint. Không xóa thư mục data nếu muốn giữ dữ liệu. Không tự chạy sau khi khởi động lại Windows.

```powershell
npm.cmd run db:start
npm.cmd run db:check
npm.cmd run db:migrate -- --name init_aurel
npx.cmd prisma generate
```

Dừng khi không sử dụng: `npm.cmd run db:stop`. Sau khi khởi động lại máy, chạy `npm.cmd run db:start` trước migration hoặc truy vấn.

Helper chỉ chấp nhận host localhost/127.0.0.1, lắng nghe loopback, dùng SCRAM-SHA-256 và thông tin trong `.env`. Lần đầu tạo cluster và database nếu chưa có; lần sau giữ nguyên dữ liệu. Không seed, không reset, không đổi schema. Mật khẩu không được ghi ra terminal/tài liệu; file mật khẩu tạm cho initdb được xóa trong finally. Đổi mật khẩu trong `.env` không tự đổi mật khẩu của cluster đã tạo.

Để thiết lập lại trên máy khác, tải ZIP binary Windows x64 từ [EDB](https://www.enterprisedb.com/download-postgresql-binaries), giải nén sao cho có `.local/postgres/pgsql/bin/pg_ctl.exe`; sao chép `.env.example` thành `.env` và đặt thông tin local trước khi chạy các lệnh trên. Đây là cấu hình phát triển local, chưa phải triển khai production.

`db:check` chỉ dùng SELECT 1, hoạt động cả khi chưa có bảng/sản phẩm. `scripts/test-db.ts` có sẵn phụ thuộc dữ liệu demo nên không dùng để chẩn đoán kết nối trống. Storefront đã nối PostgreSQL qua Prisma: DB rỗng hiển thị empty state, lỗi DB hoặc thiếu cấu hình hiển thị lỗi riêng. Không chạy seed để kiểm tra catalog.

Chạy `npm.cmd run test:catalog-db` để kiểm tra read-only với DB đã migrate; unit tests `npm.cmd test` không cần DB. Cần `npx.cmd prisma generate` sau npm ci hoặc thay schema trước typecheck/build. Nếu tsx gặp userInfo/ENOMEM trong sandbox Windows, chạy integration test ở terminal Windows thường. Chưa resolve object storage/remote images; catalog chỉ hiển thị đường ảnh public `/images/`. Schema chưa có currency nên không suy diễn đơn vị tiền.

Phase 2.2 thêm service quản trị và pagination, xem `PRODUCT_DATA_SERVICE.md`. Mutation có role guard/transaction, nhưng chưa có auth provider hoặc Admin endpoint. Unit CRUD chỉ dùng bộ nhớ; integration PostgreSQL chỉ đọc để giữ dữ liệu hiện có. Không chạy seed, migrate hay tạo admin/product/order cho bộ test. Trace pg concurrent-query deprecation từ Prisma adapter đã được ghi nhận; các kiểm tra hiện đạt với pg 8.

Nếu gặp lỗi: kiểm tra `server.log`, kiểm tra cổng bị chiếm, xác minh database và credentials. Không dùng migrate reset để sửa P1001. Không chạy seed để kiểm tra kết nối. Trong sandbox Windows, pg_ctl có thể báo restricted token error 87/3; lần thiết lập này đã khởi động thành công ngoài sandbox. Chạy từ terminal Windows thông thường nếu gặp lỗi này. Helper dùng pg_isready để kiểm tra cổng, tránh dựa vào khả năng nhìn thấy process ngoài sandbox.

## Kết quả 2026-10-20
- PostgreSQL portable tải từ EDB; initdb thành công, server đã chạy tại localhost:5432, tạo database aurel_ai.
- `npm.cmd run db:check`: đạt SELECT 1.
- `npm.cmd run db:migrate -- --name init_aurel`: tạo và áp dụng `20261020132519_init_aurel`.
- `npx.cmd prisma migrate status`: 1 migration, schema up to date. Không chạy seed.

## Variant HEX — trạng thái 2026-10-23
Main9/test12. Migration20261023150000_variant_colour_hex chỉ kiểm tra DB test, phụ thuộc hai taxonomy migration pending main. Không scoped-apply HEX độc lập hoặc tự migrate deploy main. Cần backup/verified restore/rehearsal và approval mới. Giữ unique(productId,color,size)/sku, thêm TaxonomyOption.hex nullable/CHECK, không đổi append-only guard. Hash/cleanup fixture tại [DYNAMIC_VARIANTS.md](DYNAMIC_VARIANTS.md).
