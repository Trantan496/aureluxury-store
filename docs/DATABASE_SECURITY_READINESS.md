# Phase 2.5.2 — Database Security & Deployment Readiness

## Trạng thái cập nhật Phase2.9.2 (2026-10-21)
Main local aurel_ai đã apply đủ5 migrations, không còn pending; ba SQL staging được chủ dự án cho phép sau backup/restore/no-drift/rehearsal đạt. Không seed/main fixtures hoặc thay secrets/roles/table grants/ownership. ADMIN Product Management đã có tại /admin/products, nhưng main0 ADMIN và provisioning cần approval riêng. MULTI_CURRENCY_ENABLED vẫn hiệu lực false; public catalog/PDP luôn lọc websitePermission=granted từ schema đã deploy, độc lập cờ AI. Production role/cutover/audit/offsite backup chưa GO. Xem [ADMIN_PRODUCTS.md](ADMIN_PRODUCTS.md) cho evidence/routes/tests/limits. Các mô tả staged/main pending bên dưới là lịch sử trước Phase2.9.2.


Ngày 2026-10-21, Asia/Bangkok. **Main vẫn NO-GO. Không đổi credentials, role grants/ownership hoặc schema trên `aurel_ai`.** Kết quả dưới đây là thiết kế và nghiệm thu độc lập, không phải production approval.

## Hiện trạng được audit chỉ đọc

`scripts/audit-database-security.ts --confirm-read-only=aurel_ai` kết nối default_transaction_read_only=on, chỉ đọc metadata/fingerprint:

- Login hiện tại là postgres, có SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS. Có đầy đủ SELECT/INSERT/UPDATE/DELETE/TRUNCATE trên User, Account, Session, Product, Order.
- ProductPrice chưa tồn tại trên main, vì mới có init/auth migrations. Hai migration money/revision vẫn pending; flag false, không tự deploy.
- Không có aurel_app/aurel_migration_owner hoặc roles thử security trên main cluster. `.env` và main fingerprint không đổi.
- archive_mode=off: chưa có continuous WAL archiving/PITR hoạt động. ssl_server_enabled=off trên server local loopback; chưa có bằng chứng TLS production. Không in archive_command, passwords hoặc dữ liệu cá nhân vào report.
- Backup hiện là pg_dump custom local + hash/restore drill, chưa có bằng chứng mã hóa file, offsite/immutability, retention tự động hoặc RPO/RTO production. `.gitignore` không phải cơ chế mã hóa/kiểm soát truy cập.

JSON riêng: `.local/phase252-main-security.json`. Các quan sát này không tự kích hoạt thay đổi main.

## Hai nhóm danh tính đề xuất

| Danh tính | Quyền | Quản lý secret / giới hạn |
| --- | --- | --- |
| aurel_app (runtime LOGIN) | CONNECT đúng DB, USAGE public, DML allowlist bên dưới, USAGE đúng serial sequences | Không owner/migration membership; không SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS, CREATE/DDL/TRUNCATE/GRANT/TRIGGER/replica settings. Chỉ web runtime giữ secret này. |
| aurel_migration_owner (deployment identity) | Owner schema public và các objects của AUREL, kể cả migration metadata; tạo/thay đổi objects trong schema đã review | Không superuser/createdb/createrole/replication/bypassrls; không nằm trong web env. Secret chỉ cấp theo deployment window có review/audit, không dùng cho request. |
| DBA/break-glass hiện có | Provision roles, database/network/TLS/backup và chuyển ownership được duyệt | Không dùng làm DATABASE_URL runtime. Giữ đường truy cập vận hành riêng, audit và rotation. Không thu hồi trước khi canary/rollback đã nghiệm thu. |

Owner luôn có khả năng đọc/sửa data hoặc tự grant lại trên objects của mình; PostgreSQL owner không phải “DDL-only”. Vì vậy kiểm soát owner bằng secret access, mạng/CI, thời hạn và audit. Có thể nâng cấp owner NOLOGIN + deploy login SET ROLE sau vòng thiết kế riêng; lab hiện nghiệm thu hai LOGIN identities tách biệt, không tuyên bố đã thử mô hình NOLOGIN/SET ROLE.

Runtime không được làm member owner. Không GRANT ALL ON ALL TABLES hoặc default DML cho mọi bảng tương lai; objects mới mặc định deny tới khi review. ALTER DEFAULT PRIVILEGES phải đặt cho đúng role thực sự tạo objects, không chỉ role chạy provisioning. Revoke global default PUBLIC EXECUTE functions cho migration owner; không chỉ per-schema revoke vì không ghi đè được global default.

## Ma trận runtime đã thử

| Bảng | SELECT | INSERT | UPDATE | DELETE | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| User | Có | Có, role chỉ CUSTOMER qua guard | Chỉ fullName/email/emailVerified/image/updatedAt | Không | Không nâng/hạ role, đổi ID/passwordHash/createdAt; không account-delete feature hiện tại. |
| Account, Session, Verification | Có | Có | Có | Có | Better Auth cần credentials/session/token lifecycle; chỉ backend tin cậy được giữ DB secret. |
| Product, ProductVariant | Có | Có | Có | Không | Product Service deactivate, không hard delete. |
| Category, ProductImage, ProductPrice | Có | Có | Có | Có | CRUD metadata/giá hiện có. |
| Order, OrderItem | Có | Không | Không | Không | Chưa order-write/checkout service. Không cấp trước quyền chưa dùng. |
| _prisma_migrations | Không | Không | Không | Không | CLI dùng owner secret riêng. |
| Cart/Address/Favorite/AI và bảng tương lai | Không cấp | Không cấp | Không cấp | Không cấp | Chưa có write flows tương ứng; mở feature phải review grants mới. |

Tất cả bảng: không TRUNCATE/ownership/CREATE TRIGGER/GRANT OPTION. Chỉ USAGE các sequences cần INSERT; không UPDATE sequence/setval. User UPDATE là column-level nên has_table_privilege(UPDATE)=false trong report dù các cột allowlist hoạt động.

Better Auth hiện gửi role=CUSTOMER khi tạo User. Bỏ INSERT role đơn thuần sẽ phá signup. Candidate policy dùng BEFORE INSERT guard SECURITY INVOKER với public-qualified UserRole/search_path trusted: runtime current_user chỉ được tạo CUSTOMER; UPDATE role không được GRANT. Owner/provisioning có thể cấp ADMIN qua quy trình ngoài runtime được kiểm soát. Không thêm admin account hay endpoint promote main.

`scripts/security-policy.ts` là candidate provisioning SQL **chỉ nhận tên roles lab**, không nhận aurel_app/aurel_migration_owner hoặc SQL-injected identifiers. Đây chưa phải migration/provisioning script production; khi chuyển sang production cần reviewed artifact riêng, thay bindings đúng và approval. Không sửa hai migrations pending hoặc manifest để thêm policy âm thầm. Quyền/trigger ngoài Prisma schema phải được version/audit riêng.

Shared backend DB role không phải per-customer RLS. Account/Session chứa thông tin nhạy cảm mà auth backend phải xử lý; service authorization, safe DTO, session verification/CSRF vẫn bắt buộc. Không coi DB grants là thay thế quyền CUSTOMER/ADMIN ở service.

## Thử nghiệm tách biệt hoàn toàn

Automatic approval review đã từ chối phương án tạo LOGIN roles trên main cluster, vì roles toàn cluster và có rủi ro cleanup thất bại. Lệnh đó không được thực thi. Không yêu cầu giảm bảo vệ hoặc chạy vòng qua; chuyển sang **PostgreSQL cluster riêng** tại `.local/security-postgres/phase252/data`, bind127.0.0.1:5544. Script xác minh system_identifier khác main trước tạo role. Main source chỉ đọc fingerprint, không dùng admin main để tạo roles.

- Backup mới `aurel_ai_restore_test_20261020172320_dd5e13.dump`, SHA256 `f4724e2f464ee451ee26403cd4035987db10e901d3af0551c3513edc9b461c47`. Hash/restore source verified, sau đó pg_restore vào cluster riêng5544, no-owner/no-privileges/single-transaction. Cùng tên DB cũng có bản restore nguồn trên5432; **security drill diễn ra trên5544**, không nhầm target theo tên đơn thuần.
- Hai login random aurel_app_security_* và aurel_owner_security_* chỉ tồn tại trong lab. Password random chỉ memory/child env, không vào báo cáo. Lab DBA/test bootstrap secret private trong `.local/security-postgres/phase252/lab.env`, không .env chính/commit. Roles app/owner và grants/membership được cleanup sau test; ownership clone chuyển về test owner, giữ lab làm chứng cứ.
- Chuyển ownership từng table/sequence/function/enum và public schema trong lab; không REASSIGN OWNED vì có thể tác động shared objects/databases khác. DB owner giữ test harness, không cấp CREATEDB cho migration login.
- Owner login NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS chạy Prisma migrate deploy hai pending migrations, đúng4metadata/checksums. CLI startup options lock_timeout3s/statement_timeout30s được assert current_setting trên chính Prisma connection. migrate status up to date, schema diff No difference detected.
- App login thật dùng Prisma singleton/Better Auth hiện có: signup CUSTOMER, signin, signed session, CUSTOMER denied, chỉ owner promote user fixture trong lab, ADMIN Product Service category/product/variant/image/price/stock/catalog hoạt động, role revoke hiệu lực ngay, logout/replay null.
- App bị42501 khi UPDATE User.role, INSERT ADMIN, DELETE User, DML Order, đọc _prisma_migrations, ALTER/CREATE schema objects, TRUNCATE Session, SET ROLE owner, SET replica, CREATE ROLE. Owner tạo future table/function rồi app bị deny SELECT/EXECUTE theo default-deny. Không chỉ SET ROLE từ privileged owner: test bằng connection/password app riêng.
- Fixtures cleanup về post-policy baseline, roles app/owner cleanup thành công, main fingerprint/.env không đổi. Main cluster không chứa lab roles. Test chạy local PostgreSQL18.6; loopback lab không chứng minh TLS/pg_hba network/collation/capacity production. Không có account/product/order giả trên main.

Lệnh thực đã chạy:

```powershell
npm.cmd run test:postgres:backup -- --confirm-test-database=aurel_ai_test
node scripts/prepare-security-lab.mjs aurel_ai_restore_test_20261020172320_dd5e13 --confirm-isolated-cluster=5544
node --experimental-strip-types scripts/database-security-rehearsal.ts aurel_ai_restore_test_20261020172320_dd5e13 --confirm-restore-test=aurel_ai_restore_test_20261020172320_dd5e13
node --experimental-strip-types scripts/audit-database-security.ts --confirm-read-only=aurel_ai
node scripts/stop-security-lab.mjs --confirm-isolated-cluster=5544
```

Scripts từ chối main target/port, existing lab data directory hoặc bản restore không khớp backup. Đây là fresh-lab drill; không reset/reuse DB đã đổi schema giả làm fresh restore. Muốn diễn tập lại phải chuẩn bị fresh lab/restore có review, không xóa/reset dữ liệu để ép check đạt. Logs `.local/phase252-security.log`, `.local/phase252-main-security.json`, backup `.security.json` không chứa passwords. Tên role trong report là tên fixture đã bị xóa, không phải credential production.

Lab đã được dừng sau khi verify system ID/data directory và không còn app/owner fixture roles; không stop cluster main. Dữ liệu/credentials lab vẫn private local để review, không tự xóa/reset.

## Runbook hai migrations và chuyển runtime — chỉ sau approval

**Chưa chạy các bước ghi main dưới đây.** Đề xuất window30phút, chưa đặt lịch ngày/giờ; phải được chủ dự án/ops duyệt theo traffic và dữ liệu thực, không coi benchmark DB rỗng là SLA.

1. Preflight: chốt SQL/checksums money169d…(normalized)/3c46…(raw) và revision0adba1d7…, pending list đúng2, schema/data/roles/ACL inventory. Review legacy currency plan, caller40001/40P01/idempotency policy. Chọn owner/runtime secrets tách biệt, xác minh TLS verify-full/pg_hba/network allowlist và DBA rollback access; không để owner secret trong web container.
2. Backup mới ngay trước window, encrypt/hash/offsite/restore drill có bằng chứng và key recovery, giữ config/roles/grants riêng an toàn. Nguồn phải được kiểm target rõ ràng. Các bản test hiện tại không thay thế backup dữ liệu mới nhất.
3. Maintenance/drain **mọi writer**, kể cả signup/signin/session refresh/cleanup, jobs và admin tools; không chỉ storefront. Giữ trang/maintenance response theo infrastructure, không thay CSS/UI trong task này. Kiểm active/idle transactions, pg_locks/pg_stat_activity, disk/WAL, thời gian window. Không tự terminate sessions.
4. Provision song song aurel_app và owner theo SQL đã duyệt, không đổi/revoke login cũ. Ownership chuyển từng object đúng database, giữ migration metadata/types/sequences/functions; snapshot ACL trước và kiểm lại. Runtime chưa đổi DATABASE_URL. Không broad REASSIGN OWNED hoặc grant membership owner cho app.
5. Từ deploy process isolated env, chỉ owner DATABASE_URL trong child, xác minh identity/timeouts3s/30s bằng Prisma db execute assertion. Sau approval mới `npx.cmd prisma migrate deploy`; app env không có owner URL. Money trước, revision sau. CLI migrate dev/reset/db push/seed không dùng production.
6. Verify metadata4/finished/checksums, schema diff, constraints/revision triggers, legacy currency vẫn NULL chưa xác minh, health/auth/catalog bằng canary backend với app login. Apply candidate User/default-ACL policy chỉ sau review/provisioning approval riêng; lưu hash artifact và audit. Không ghi giả dữ liệu main để healthcheck; dùng test fixture ở môi trường tách biệt hoặc thao tác nghiệp vụ thật được chấp thuận.
7. Cutover runtime secret qua secret manager và rolling restart, không sửa secret đang dùng ngay từ đầu. Xác minh connections mới current_user=aurel_app, auth/catalog/authorization/stock paths, error rates; giữ flag multi-currency false đến khi toàn bộ schema/giá dữ liệu được nghiệm thu. Không tự bật flag chỉ vì deploy xong.
8. Quan sát trong window, sau đó mới yêu cầu approval riêng để rotate/revoke login rộng cũ. Mục tiêu không để superuser làm runtime nhưng không thu hồi mù gây downtime. Giữ DBA break-glass được kiểm soát; lưu rollback snapshot/ACL và audit hoàn tất.

### Lỗi từng migration/cutover

| Điểm lỗi | Xử lý được đề xuất |
| --- | --- |
| Timeout/SQL error trước COMMIT money | Dừng, xác minh rollback/schema và failed metadata; flag false, chưa cutover. Không retry DDL hoặc migrate resolve mù. |
| Money commit, revision fail | Money **không rollback cùng migration sau**. Giữ maintenance/flag false, không chấp nhận schema money đơn lẻ để mở order writes. Kiểm lỗi/locks/metadata, review cách sửa hoặc resume trong window đã duyệt. |
| Quyền app thiếu/Better Auth lỗi | Dừng canary/cutover, giữ login cũ hoạt động như trạng thái đã duyệt; sửa grants trên clone và diễn tập lại trước main. Không GRANT ALL/SUPERUSER để “sửa nhanh”. |
| Cutover connections lỗi | Rollback runtime deployment/secret reference theo kế hoạch được duyệt, không rollback schema bằng DROP. Tạm giữ read-only/maintenance nếu không có runtime profile an toàn. Login cũ chưa bị revoke cho tới khi nghiệm thu. |
| Connection mất lúc COMMIT | Kiểm actual migration metadata/schema và trạng thái transaction, không suy diễn đã rollback rồi chạy lại. |
| Cần khôi phục | Restore backup vào DB mới, đối soát/catch-up dữ liệu đã ghi sau backup, nghiệm thu rồi mới quyết định đổi endpoint. Không restore đè main đang nhận giao dịch. |

Chỉ cân nhắc `prisma migrate resolve --rolled-back` sau khi xác minh rollback thực tế và có quyết định vận hành riêng. Owner không được tự cấp quyền production approval. Timers là fail-fast theo statement/lock, không phải timeout toàn window; mỗi migration là transaction riêng. Account ownership có thể khiến locks/ACL thay đổi: đánh giá trên snapshot dữ liệu mới nhất.

## Backup production — đề xuất chưa triển khai

Các con số sau là baseline để chủ dự án duyệt, **không phải cam kết đã đạt**:

| Hạng mục | Đề xuất |
| --- | --- |
| RPO/RTO | RPO≤15phút, RTO≤60phút cho giai đoạn đầu; điều chỉnh theo giá trị đơn hàng/chi phí. Cần load/data-size restore drill để đo thực. |
| PITR | Physical base backup + continuous WAL archive tới storage riêng, monitor gaps/failures/lag. Không gọi nightly pg_dump là PITR. Kiểm restore tới timestamp trước lỗi, timeline và WAL continuity. |
| Logical backup | Nightly và trước migration, phục vụ portability/đối soát; không thay WAL/PITR. Backup roles/config/ACL/tablespaces inventory riêng, không public password hashes. |
| Retention dự thảo | Daily14ngày, weekly8tuần, monthly12tháng; WAL đủ cho PITR window đã duyệt. Chưa bật purge, không tự xóa archive hiện có. Cần quyết định nghiệp vụ/privacy và budget trước vận hành. |
| Mã hóa | TLS verify-full khi truyền; file/object backup mã hóa authenticated encryption/envelope KMS, khóa ngoài host và ngoài runtime secret, quyền decrypt tách backup writer. Không coi compressed pg_dump là encrypted. Kiểm key rotation và restore bằng key recovery thực. |
| Offsite/immutability | Ít nhất bản phục hồi khác host/failure domain, immutable/object-lock với retention phù hợp; runtime app không có quyền đọc/xóa backup hoặc KMS decrypt. Backup writer không có delete lịch sử; restore role tạm có audit. |
| Restore drills | Tự động validate hash/manifest mỗi backup, restore định kỳ ít nhất hàng tháng và trước migration lớn; quý diễn tập timestamp PITR/key recovery/roles/ACL + auth/catalog kiểm tra. Lưu thời gian/RPO/RTO đo được và báo động khi fail. |
| Quan sát | Alert backup job failure/staleness, WAL archive failure/lag, storage capacity/expiry, key access và missing verification. Có người chịu trách nhiệm xử lý, không chỉ log “job chạy”. |

Chưa chọn storage/KMS/provider hoặc cấu hình TLS/archiving/offsite trên main. Local lab/archives chứa bản sao auth/business phải được giữ private và quản lý như dữ liệu production; disk encryption/Windows ACL chưa được chứng nhận bởi mode0600 trong Node. Backup source trong task rỗng dữ liệu nghiệp vụ không chứng minh RTO khi có tải thật.

## Kết luận và files

Checks thực sự chạy: security integration1 Node workflow (auth/services/ACL/default-deny assertions) đạt; unit45/45, lint, typecheck, build và db:check SELECT1 đạt. Main vẫn hoạt động sau khi stop cluster lab. Không chạy lại suite concurrency Phase2.5.1 vì không sửa migration/runtime logic; không browser QA do không đổi UI. pg dependency deprecation còn như trước. Chính sách mã hóa/offsite/PITR không được đánh dấu passed bằng các checks này.

Đã thiết kế và chứng minh hai profile bằng connections thật ở cluster độc lập, quyền từng bảng, owner deploy, runtime auth/service và negative ACLs. Đề xuất tiếp tục vòng review riêng, **NO-GO production vẫn giữ nguyên** tới khi SQL/role provisioning/cutover và backup production policy được chấp thuận, có hạ tầng/keys/restore evidence phù hợp. Không tự đổi credentials/quyền main để đạt checklist.

Mới: scripts/security-policy.ts, prepare-security-lab.mjs, database-security-rehearsal.ts, audit-database-security.ts, tests/database-security.integration.test.ts, tests/security-policy.test.ts và report này. Sửa package.json (unit test), .env.example (placeholder future runtime role), docs context/architecture/roadmap/decisions/database/integration/session/README. Không đổi prisma.config.ts, migrations, schema, runtime service hoặc UI; .env thực không đổi.

Tham chiếu: [PostgreSQL privileges](https://www.postgresql.org/docs/18/ddl-priv.html), [default privileges](https://www.postgresql.org/docs/18/sql-alterdefaultprivileges.html), [backup](https://www.postgresql.org/docs/18/backup.html), [PITR](https://www.postgresql.org/docs/18/continuous-archiving.html), [encryption](https://www.postgresql.org/docs/18/encryption-options.html), [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html).
