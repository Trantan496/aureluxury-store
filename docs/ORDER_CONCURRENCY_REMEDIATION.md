# Phase 2.5.1 — Order Header Revision

Ngày 2026-10-21 (Asia/Bangkok; tên backup/migration và timestamps máy dùng UTC 2026-10-20).

**Khắc phục đã nghiệm thu trên PostgreSQL test và restored backup. Đề xuất chuyển sang vòng review/approval riêng; deployment `aurel_ai` vẫn NO-GO, chưa được chấp thuận.** Không sửa UI, seed/reset, dữ liệu main hoặc migrations cũ.

## Root cause và cơ chế bảo vệ

Lỗi cũ là write skew ở REPEATABLE READ: hai transaction cùng thấy hai item giá0, mỗi bên xóa một item. Deferred checker chỉ FOR UPDATE header, không ghi phiên bản mới; transaction chờ khóa vẫn giữ snapshot cũ và thấy item đã bị bên kia xóa, nên cả hai commit được. Bằng chứng cũ giữ nguyên tại MULTI_CURRENCY_PREFLIGHT.md và concurrency-review JSON của restore 20261020164337_8f3f13.

Migration mới thêm `Order.revision BIGINT NOT NULL DEFAULT 0`, CHECK không âm. Đây là token nội bộ database, Prisma `BigInt @default(0)`, không phải field request/DTO:

1. BEFORE INSERT/UPDATE header: khởi tạo0/tăng OLD.revision+1 bất kể giá trị caller gửi. ID header bất biến; cố đổi ID bị23514. Không recursion vì trigger chỉ sửa NEW, không UPDATE lại header.
2. BEFORE INSERT/UPDATE/DELETE item: UPDATE revision của header trong **cùng transaction, trước thay đổi item**. Update mọi field của item cũng tham gia, kể cả dữ liệu không đổi. Move item ghi cả header cũ/mới, distinct và tăng theo ID để giảm deadlock.
3. Header UPDATE tự thân là write, header DELETE tự thân tạo xung đột MVCC. FK hiện có ngăn xóa header khi còn item. Xóa item rồi header cùng transaction hợp lệ; deferred checker bỏ qua header thực sự không còn tồn tại, không bỏ qua header sống sót.
4. Giữ deferred checks currency/nonempty/tổng cho đơn multi-currency. CHECK từng item vẫn kiểm quantity, precision/range, lineTotal=unitPrice*quantity. Không suy currency cho lịch sử NULL; nhánh legacy chưa xác minh giữ contract Phase2.5 và không được làm nguồn checkout.

Mọi item writer cùng order phải ghi chung một header. READ COMMITTED chờ, ghi phiên bản mới nhất rồi kiểm tại COMMIT khi writer khác chưa thể thay đổi order đó. REPEATABLE READ/SERIALIZABLE dùng snapshot cũ sẽ nhận40001 khi cố ghi header đã đổi. Moves ghi cả hai aggregate. Revision/đổi item rollback cùng nhau; sequences có thể tăng nhưng không reset. Đây là cơ chế database-level cho SQL INSERT/UPDATE/DELETE thông thường, không phụ thuộc service chọn SERIALIZABLE.

## SQL mới và review

`prisma/migrations/20261020170000_order_revision/migration.sql`

SHA-256 raw bytes và normalized LF cùng là:

```text
0adba1d7f6cc24228a5ae46fe77ba4fe53fae2ec54c3e3a6aecd9e19d2c9f2d6
```

Đã đọc/review toàn bộ SQL trước cập nhật manifest: ADD revision/default/CHECK, hai BEFORE triggers mới, CREATE OR REPLACE checker/enforcer, REVOKE EXECUTE PUBLIC, BEGIN/COMMIT và SET LOCAL lock_timeout3s/statement_timeout30s. Không UPDATE tiền tệ/dữ liệu nghiệp vụ, không backfill currency, DROP/TRUNCATE/seed/reset. Hai functions mới và hai functions cũ đều schema-qualified, SECURITY INVOKER, search_path=pg_catalog,pg_temp; mọi business table/helper tham chiếu public rõ ràng. Trigger names thuộc bảng public (PostgreSQL trigger không có schema độc lập).

Enforcer mới kiểm inline, không gọi helper cần EXECUTE grant từ role writer. Helper cũ vẫn được harden và revoke PUBLIC để không làm public RPC. Không SECURITY DEFINER, không tăng quyền. Các deferred constraint triggers và money CHECK trước đó vẫn hoạt động, không bị tắt/làm yếu.

Migration 20261020160500_multi_currency không đổi: manifest normalized LF vẫn169d7de4f3227fa658aae9c0164dc5a175994b4156ea14b7f14c643a2aa2a9a6. Prisma metadata dùng raw bytes CRLF checksum3c46d740f59367f09ae67b7fa8ad67501247ff26019a9e8183bdff5e11f6cfda, không phải lỗi checksum; rehearsal so raw file và metadata tương ứng. Không đổi line endings SQL cũ.

## Concurrency regression bằng PostgreSQL connections thật

`tests/order-concurrency.integration.test.ts`: ba connections, chụp snapshot trước writer, chờ `pg_blocking_pids` xác nhận lock thực thay vì dựa vào sleep. Sau mỗi lịch kiểm lại toàn bộ order thuộc fixture: không có priced order rỗng, mixed currency hoặc tổng sai. Guard kiểm tên DB, role và confirmation trước ghi/cleanup; fixtures chỉ test/restore. SQL trực tiếp, không Product/Order Service.

| Lịch | READ COMMITTED | REPEATABLE READ | SERIALIZABLE |
| --- | --- | --- | --- |
| Hai DELETE khác item, cùng order | Bên hai23514, còn1 item | Bên hai40001, còn1 item | Bên hai40001, còn1 item |
| Hai INSERT vào cùng order | Serialize, cả hai commit hợp lệ | Bên hai40001 | Bên hai40001 |
| Quantity / unitPrice / total header | Commit nhất quán | Bên hai40001 | Bên hai40001 |
| Currency item+header nhất quán | Commit nhất quán | Bên hai40001 | Bên hai40001 |
| Một item currency khác header | Bên hai23514 | Bên hai40001 | Bên hai40001 |
| Chuyển hai item làm source rỗng | Bên hai23514 | Bên hai40001 | Bên hai40001 |
| Moves ngược hướng, cả hai order còn item | Commit hợp lệ | Bên hai40001 | Bên hai40001 |
| Header UPDATE đồng thời item UPDATE | Serialize hợp lệ | Bên hai40001 | Bên hai40001 |
| First rollback, second commit | Commit hợp lệ | Commit hợp lệ | Commit hợp lệ |
| Xóa header đồng thời INSERT item | Bên hai23503 | Bên hai40001 | Bên hai40001 |
| Multi-order deadlock thật | Có một40P01, rollback an toàn | Có một40P01, rollback an toàn | Có một40P01, rollback an toàn |
| Lock timeout150ms | 55P03, rollback toàn transaction | 55P03 | 55P03 |
| Rollback sau item write | Data/revision khôi phục | Data/revision khôi phục | Data/revision khôi phục |

**13/13 lịch mỗi isolation, 39/39 tổng**, thêm1 test tamper revision/search_path/ACL: 40 subtests + parent = **41 Node tests**, đều đạt trên aurel_ai_test và restored backup. Không lịch nào trong phạm vi này commit thành order vi phạm invariant. Đây là phạm vi có kiểm chứng, không tuyên bố liệt kê mọi lịch PostgreSQL có thể xảy ra.

## Quyền và search_path

- Probe temp table `pg_temp."Order"` không che được header public; revision vẫn tăng đúng. Caller gửi revision=-100 bị trigger thay bằng OLD+1. ACL kiểm cả4 functions không PUBLIC EXECUTE, không SECURITY DEFINER, search_path cố định.
- `scripts/order-writer-privileges.ts`: tạo role NOLOGIN tạm, không owner/superuser/createdb/createrole/replication, grant đúng SELECT/UPDATE Order, DML OrderItem, sequence USAGE và schema USAGE chỉ trong DB test/restore. INSERT/UPDATE/DELETE vẫn chạy triggers dù không có function EXECUTE grants; xóa mọi item bị23514. Helper EXECUTE, DISABLE TRIGGER, TRUNCATE, SET session_replication_role=replica và CREATE function trong public bị42501.
- Fixture chạy transaction rồi rollback; revoke toàn bộ grants/membership và drop role. Audit cuối còn0 role `aurel_order_writer_test_*`. Connection tạo role chỉ vào maintenance DB postgres, không main tables hoặc app User accounts.
- Database owner/superuser vẫn có thể cố ý bỏ triggers/constraints. Audit read-only cho thấy connection main local hiện dùng role có superuser/createdb/createrole/replication. Trước production phải tách migration owner khỏi runtime least-privilege role; **không tự đổi role/credentials/quyền main trong task này**. RLS, replication hoặc grant policies tương lai phải được review lại, không giả định tự an toàn.

## Transaction và retry policy

Không thêm auto-retry vào Product Data Service hoặc tạo Order Service mới. Service hiện trả CONFLICT cho Prisma P2034; raw SQL40001/40P01 phải abort/rollback và kết thúc transaction trước quyết định thử lại. 23514/23503/23505 không được retry mù. 55P03 cần đánh giá contention/cancellation, không vòng lặp vô hạn.

Nếu sau này thêm retry vào order-write service: tối đa3 attempts với backoff/jitter có giới hạn, retry **toàn bộ transaction** gồm reads, auth, prices, inventory và validation; không retry riêng statement thất bại. Snapshot mới có thể khiến hành vi cũ không còn hợp lệ (ví dụ còn1 item thì yêu cầu xóa cuối phải bị từ chối). Cần idempotency key có unique constraint và lưu kết quả trong cùng transaction. Email/payment/HTTP side effects phải ngoài retry body và qua outbox/idempotent provider sau commit; lỗi kết nối lúc COMMIT có kết quả chưa rõ phải đối soát key, không coi như rollback rồi gửi lại. Đây là policy tương lai, chưa có endpoint thanh toán/email/order để tự triển khai.

## Backup, metadata và rehearsal mới nhất

Backup mới trước triển khai SQL: aurel_ai_restore_test_20261020165522_beb5e8 đã verify. Sau khi bổ sung privilege probes tạo bản mới170219_d9fcfe; cuối cùng tạo bản mới nhất **aurel_ai_restore_test_20261020170607_24796c** để nghiệm thu thêm startup timeout và schema diff.

Archive SHA-256 mới nhất:

```text
61adba7c9b6e311460876c189b18d683e6d47e58c8ebf6b15340458a30ab4314
```

Archive/verified JSON/`.order-revision.json` ở `.local/backups/`, private/ignored. Source read-only fingerprint khớp bản restore trước migrate; main fingerprint/.env giữ nguyên sau mọi bước. Main User/Product/Variant/Order/Item đều0, còn đúng hai migrations cũ, flag false.

`scripts/order-revision-rehearsal.ts` chỉ nhận fresh verified restore với exact confirmation thứ hai. Restore giữ nguyên init/auth metadata đã applied; Prisma migrate deploy apply hai migration pending multi_currency rồi order_revision, không raw SQL/resolve giả metadata. Kiểm cả4 names, finished status và raw checksums; migration status up to date, `migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` báo **No difference detected**. Fixture legacy 12.34/24.68 giữ nguyên, currency NULL, revision0 trước cleanup.

Prisma CLI child được cấp options cố định `-c lock_timeout=3s -c statement_timeout=30s` qua URL chỉ của child; không sửa .env hoặc nới allowlist URL test/app. `prisma db execute --stdin` với DO block ASSERT current_setting xác minh timeout trên chính CLI connection. Probe giữ ACCESS SHARE ở restore, CLI xin ACCESS EXCLUSIVE bị lock timeout, rollback/đóng connection; fingerprint unchanged. Không dựa vào PGOPTIONS không kiểm chứng.

Lượt cuối đo metadata SQL: multi_currency30.931ms, order_revision3.603ms; wall-time deploy CLI2147ms. Init/auth timestamps là lịch sử restore, không chạy lại migrations đã applied. Đây là DB rất nhỏ/rỗng cộng fixtures, không SLA production. Full pending chain dùng startup timeout; migration revision còn SET LOCAL timeout riêng. ACCESS EXCLUSIVE/constraint scans/index writes vẫn có thể chặn đọc/ghi. Nhiều migrations là nhiều transaction: nếu migration thứ hai lỗi, migration thứ nhất có thể đã COMMIT; phải kiểm metadata/schema từng migration, không giả định rollback toàn chuỗi.

## Lệnh và kết quả

```powershell
npm.cmd run test:postgres:backup -- --confirm-test-database=aurel_ai_test
npm.cmd run test:postgres -- --confirm-test-database=aurel_ai_test
node --experimental-strip-types scripts/order-revision-rehearsal.ts aurel_ai_restore_test_20261020170607_24796c --confirm-restore-test=aurel_ai_restore_test_20261020170607_24796c
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

- Auth/CRUD/currency/stock/rollback:18 Node tests đạt; concurrency41 đạt; catalog/error3 đạt, trên test và restore. Limited-writer privilege probe đạt. Fixture rows/schema/functions/triggers/enums về baseline sau test, sequences tăng có chủ ý.
- Unit44/44, lint/typecheck/build đạt. Generate client đã chạy, không migrate main. Typecheck từng phát hiện fixture env test thiếu NODE_ENV do Next augment ProcessEnv; thu hẹp kiểu helper đúng ba biến cần đọc, không nới validation/runtime guard.
- Logs `.local/phase251-test.log`, `.local/phase251-rehearsal.log`, `.local/phase251-unit.log`; main read-only audit `.local/phase251-main-audit.json`. pg dependency deprecation còn như trước; invalid-origin là negative auth case có chủ ý. tsx trong Windows cần chạy ngoài sandbox được duyệt. Không browser QA vì không đổi UI.

## Files và quyết định còn lại

Mới: migration order_revision, `scripts/integration-target.ts`, `scripts/order-revision-rehearsal.ts`, `scripts/order-writer-privileges.ts`, `tests/order-concurrency.integration.test.ts`, tài liệu này. Sửa: prisma/schema.prisma, scripts/postgres-integration.ts, tests/postgres.integration.test.ts, tests/test-database-safety.test.ts, reviewed-migrations.json và tài liệu liên quan. Không sửa service/UI, migrations cũ, .env hoặc dependencies.

Đề xuất **GO cho vòng review/approval riêng** với cả hai SQL pending và legacy plan. **Main deployment NO-GO tới khi chủ dự án chấp thuận riêng**, backup mới/restore mới theo dữ liệu lúc triển khai, kiểm schema/checksum/status/permissions, maintenance window/timeout và quy trình xử lý failed migration. Không tự migrate resolve/reset/retry DDL, kill sessions hoặc restore đè main. Chưa checkout/order-write endpoint, mail/payment/outbox, production roles/ACL/PITR/offsite; deadlocks/serialization failures là kết quả có kiểm soát cần caller xử lý. Legacy NULL không tự chuyển đổi. Không bảo đảm trước writer đặc quyền có quyền sửa/bỏ triggers.

Tham chiếu chính thức: [PostgreSQL isolation](https://www.postgresql.org/docs/18/transaction-iso.html), [serialization/deadlock retry](https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html), [function security/search_path](https://www.postgresql.org/docs/18/sql-createfunction.html), [locking](https://www.postgresql.org/docs/18/explicit-locking.html), [Prisma PostgreSQL options](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql).
