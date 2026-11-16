# PostgreSQL Integration Testing — Phase 2.4

## Cập nhật Phase2.5.2
- Security rehearsal không tạo LOGIN roles trên main cluster: init cluster riêng127.0.0.1:5544, assert system ID khác main rồi restore backup mới172320_dd5e13. Owner login không đặc quyền deploy hai pending migrations đúng metadata; app login thật qua Better Auth/Product Service và ACL negative probes đạt. Roles/fixtures cleanup, lab stopped, main/.env unchanged.
- Scripts prepare-security-lab, database-security-rehearsal, security-policy, audit-database-security, stop-security-lab và tests/database-security.integration.test.ts. Profile chỉ nhận roles lab; không tạo provisioning/migration main tự động. Chi tiết grants, backup/TLS/PITR gaps và lệnh fresh-lab drill: DATABASE_SECURITY_READINESS.md.
- Bài test mới là một Node workflow chứa auth/service/ACL/default-deny assertions, không thay suite concurrency Phase2.5.1.45 unit tests/lint/typecheck/build đạt; không tuyên bố đã kiểm TLS/offsite/KMS/PITR production.

## Cập nhật Phase2.5.1
- Runner test:postgres nay chạy auth/CRUD/currency18 Node tests, direct SQL concurrency41 Node tests (13 lịch mỗi isolation + ACL/search_path), limited nonowner writer probes và catalog/error3. Main chỉ fingerprint read-only; fixtures/role tạm cleanup, sequences không reset.
- integration-target.ts giữ exact aurel_ai_test allowlist; restore prefix chỉ được chấp nhận với TEST_RESTORE_DATABASE_CONFIRM khớp tên cộng confirmation test gốc. Worker kiểm current_database/current_user trước ghi. Unit tests bảo đảm main/remote/role lạ/thiếu confirmation vẫn bị chặn.
- `node --experimental-strip-types scripts/order-revision-rehearsal.ts <fresh-restore-name> --confirm-restore-test=<fresh-restore-name>` xác minh archive/fingerprint, Prisma deploy pending chain đúng metadata/checksums/status/schema diff và chạy toàn suite. Không dùng raw SQL đánh dấu applied. Lần mới nhất170607_24796c; xem ORDER_CONCURRENCY_REMEDIATION.md.
- CLI child có startup options cố định timeout3s/30s đã verify current_setting và lock probe; app/test URL gốc không nới arbitrary options, main .env giữ nguyên. Không approval/apply main.

Ngày: 2026-10-20. Đã nghiệm thu Better Auth và Product Data Service trên PostgreSQL thật, không memory adapter. Không thay UI, schema hoặc migration đã áp dụng.

## Môi trường tách biệt

- Database: `aurel_ai_test`, login riêng `aurel_ai_test_runner`, không SUPERUSER/CREATEDB/CREATEROLE/REPLICATION. Role là owner của test DB, không có quyền INSERT/UPDATE/DELETE/TRUNCATE trên các bảng public của `aurel_ai` (runner kiểm tra bằng quyền thực trong PostgreSQL).
- `.env.test` chứa TEST_DATABASE_URL và TEST_AUTH_SECRET riêng, được tạo local với giá trị random; không commit. `.env.test.example` không có secret thật. `.env` và DATABASE_URL hiện tại không sửa, hash file được kiểm tra khi kết thúc runner.
- Prisma/Better Auth ứng dụng vẫn dùng đúng singleton. Chỉ process con của runner nhận DATABASE_URL trỏ TEST_DATABASE_URL vì Prisma CLI/client dùng tên biến đó. Parent process và file `.env` không bị ghi đè. Worker từ chối nếu URL/role/database/confirmation không đúng hoặc không được chạy trong NODE_ENV=test.
- `aurel_ai` chỉ được mở read-only để fingerprint/kiểm tra quyền và pg_dump. Không ghi user/ADMIN/product/order, không migrate/reset/seed lên database này.

## Chạy lại

```powershell
npm.cmd run db:start
npm.cmd run test:postgres:setup -- --confirm-test-database=aurel_ai_test
npm.cmd run test:postgres:backup -- --confirm-test-database=aurel_ai_test
npm.cmd run test:postgres -- --confirm-test-database=aurel_ai_test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Setup chỉ tạo role/database nếu chưa có, không tự đổi mật khẩu role đã tồn tại; nếu role/config/owner không khớp thì dừng để kiểm tra thủ công. Không in credentials. Chạy lệnh không có confirmation bị từ chối exit 1 trước thao tác ghi. Trong Codex Windows sandbox, tsx có vấn đề userInfo đã biết; integration đã chạy ngoài sandbox với quyền được duyệt, không nới guard database.

## Chốt an toàn

`scripts/test-database-safety.ts` xác minh chính xác URL database, role riêng, host loopback, schema public, confirmation; tiếp tục kiểm tra current_database/current_user qua kết nối thật. Không chấp nhận URL production, role postgres, schema khác hoặc connection options tùy ý.

`scripts/postgres-integration.ts`:

1. Kiểm tra manifest SHA-256 các migrations đã review tại `tests/support/reviewed-migrations.json` (normalize CRLF/LF). Migration mới/đổi nội dung bắt buộc review và cập nhật manifest có chủ ý; không dùng CLI generate overwrite schema.
2. Kiểm tra role không ghi được bảng của `aurel_ai`; khóa advisory ngăn hai runner chạy đồng thời trên test DB. Xác nhận target trước migrate deploy vào test. Không gọi reset/seed.
3. Sau migrate, từ chối chạy nếu test DB có dữ liệu không rõ nguồn gốc. Không tự truncate/xóa dữ liệu cũ để làm test pass.
4. Worker xác minh target trước khi import Prisma singleton/auth. Guard trước từng operation có thể ghi, kể cả getSession có thể dọn session hết hạn. Cleanup xác minh lại trong transaction rồi chỉ xóa fixture theo run prefix/ID/email của phiên hiện tại.
5. Dừng lệnh phụ thuộc ngay khi child process exit khác 0. Worker luôn cleanup trong finally và đóng connection cả khi cleanup lỗi. Nếu còn fixture do lỗi cleanup, lần sau từ chối dữ liệu lạ thay vì tự quét xóa.
6. So sánh toàn bộ rows/schema/constraints/indexes test DB về baseline sau cleanup; không reset serial sequences. So sánh fingerprint aurel_ai trước/sau cả khi test lỗi và kiểm tra hash `.env` không đổi.

Fingerprint gồm hash nội dung bảng (kể cả migration metadata), định nghĩa cột, constraints, indexes và trạng thái sequence; không in dữ liệu người dùng/secret ra terminal. Bài test tạo/promote ADMIN chỉ trong aurel_ai_test và xóa user này khi hoàn tất.

## Kết quả PostgreSQL thực tế

14 nhóm workflow đã đạt (Node báo 15 tests gồm parent suite), sau đó 3 read-only catalog/error integration tests đạt trên cùng test DB:

| Nhóm | Kết quả đã kiểm tra |
| --- | --- |
| DB rỗng/anonymous | Catalog success [], anonymous không mutation |
| Sign Up | User Int/fullName, Account credential hash, không plaintext, CUSTOMER mặc định và emailVerified=false |
| Sign In/Get Session | Sai password 401, đúng password tạo Session thật; session resolver lấy đúng User Int |
| Cookie/origin | Cookie sửa/x-user-id/x-role không xác thực; cookie request origin lạ 403 |
| Product/Category CRUD | ADMIN test mới thao tác được, get/list/update/create đúng |
| Variant/Image CRUD | SKU/color/size/Decimal/stock đúng, image DTO không storageKey, parent mismatch bị chặn |
| Constraints | Duplicate slug, SKU, product-color-size và FK lỗi trả CONFLICT; invalid price/stock trả INVALID_INPUT |
| Concurrent stock | Hai CAS cùng expectedStock: đúng một thành công, một CONFLICT; stock 10 → 7, không mất update hoặc âm |
| Rollback | Tạo category rồi FK failure rollback toàn bộ; cập nhật stock rồi throw giữ nguyên stock=7 |
| Pagination | Data/count đúng với 2 products, pageSize=1, trang vượt tổng trả [] |
| Role revocation | ADMIN → CUSTOMER bị chặn ngay với cookie còn hợp lệ |
| Delete | Image/category metadata xóa thật; product/variant deactivate, không mất tham chiếu |
| Sign Out | Session DB bị xóa, replay cookie cũ bị từ chối |
| Revoke/expiry | revoke-session và expiresAt cũ làm cookie không hợp lệ; expired session không mutation |

39 unit/auth/safety tests đạt; lint/typecheck/build đạt. Fixture User/Account/Session/Product/Variant/Image/Category được cleanup; test DB không còn hàng nghiệp vụ, chỉ giữ migration metadata và sequence đã tăng. `aurel_ai` fingerprint/.env hash không đổi.

Lượt đầu phát hiện Better Auth mặc định skipOriginCheck khi NODE_ENV=test. Thêm cấu hình rõ `disableOriginCheck:false`, `disableCSRFCheck:false` tại `features/auth/config.ts`; không tắt kiểm soát để làm test pass. Chạy lại origin case và toàn bộ PostgreSQL workflows đạt. Cảnh báo pg concurrent query từ Prisma adapter đã biết vẫn xuất hiện, không phải test failure.

## Backup và restore trước migration tiếp theo

### Cập nhật Phase 2.5
- Preflight mới trên restore 20261020164337_8f3f13: backup/hash/fingerprint, lock-timeout rollback và single-transaction money probes đạt; diagnostic hai connection REPEATABLE READ phát hiện blocker nonempty order. Không diễn giải suite cũ đạt thành production approval. Scripts/report: MULTI_CURRENCY_PREFLIGHT.md.
- Migration multi-currency review SHA/deploy chỉ aurel_ai_test; child env bật flag, main .env giữ nguyên. Suite 17 workflow (18 Node tests gồm parent) + 3 catalog/error tests đạt, gồm price CRUD, missing, scale/unique/FK và snapshots nhiều sản phẩm/ba currency/rollback. Fixture ProductPrice/Order/OrderItem cũng cleanup.
- Backup mới `.local/backups/aurel_ai_restore_test_20261020155922_6b1b2b.dump` đã verify restore trước migration. DB restore sau đó rehearsal legacy 12.34/24.68 giữ nguyên, NULL currency/lineTotal, không ProductPrice suy đoán; archive không đổi. Rehearsal từ chối DB đã mở rộng; dùng restore mới cho lần sau. Chi tiết MULTI_CURRENCY.md.
- Fingerprint mới thêm numeric precision/scale, enums, functions/user triggers. Main fingerprint và .env không đổi; sequence test không reset. Sandbox tsx userInfo/ENOMEM cần terminal thường hoặc chạy ngoài sandbox được duyệt.

Runner backup dùng [pg_dump custom archive](https://www.postgresql.org/docs/18/app-pgdump.html) read-only từ aurel_ai, sau đó [pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html) vào database mới `aurel_ai_restore_test_<timestamp>_<suffix>`, do test role sở hữu. Xác minh tên/pattern, role và database trống trước restore; dùng exit-on-error/single-transaction/no-owner/no-privileges, không clean/create/reconnect vào production.

Đã restore thành công và so sánh data/columns/constraints/indexes/sequences trùng nguồn. Archive và `.verified.json` nằm trong `.local/backups/`, chứa SHA-256 archive và fingerprint nguồn, không public/commit. Bản kiểm chứng đầy đủ: `aurel_ai_restore_test_20261020153336_3b3927`. Một bản restore kiểm chứng ban đầu cũng được giữ; không tự drop các DB này. Chúng là bản sao local dùng nghiệm thu, không có dữ liệu thử thêm.

Trước migration tiếp theo: tạo backup mới và chạy restore drill; kiểm tra manifest verified/hash, review SQL, diễn tập migration trên DB test, rồi mới quyết định apply lên database ứng dụng. Không dùng archive cũ để giả định dữ liệu mới đã backup. Quy trình này chưa tự động restore vào production; nếu cần phục hồi, ưu tiên restore vào database mới và kiểm tra trước khi đổi kết nối ứng dụng.

Giới hạn: chưa backup cluster roles/tablespaces hoặc owner/ACL gốc (restore cố ý bỏ owner/privileges), chưa PITR/offsite/retention/encryption workflow. Phải quản lý các archive local như dữ liệu riêng tư và chọn chính sách vận hành trước production. Chưa kiểm thử email delivery/MFA/UI hoặc checkout; không thuộc task này.
