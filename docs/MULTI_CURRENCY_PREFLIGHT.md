# Rà soát trước production migration — 2026-10-20

**Cập nhật 2026-10-21:** tài liệu này giữ kết quả audit lỗi cũ. Phase2.5.1 đã có migration khắc phục mới và regression nghiệm thu; xem ORDER_CONCURRENCY_REMEDIATION.md. Main vẫn NO-GO chưa approval, không suy từ kết quả mới thành quyền deployment.

**Kết luận: NO-GO cho SQL hiện tại. Chưa có approval và chưa chạy migration trên `aurel_ai`.** Tests cũ đạt không thay thế kiểm tra đồng thời hoặc quyền chấp thuận của chủ dự án.

## Bằng chứng mới nhất

- Backup/restore mới: `aurel_ai_restore_test_20261020164337_8f3f13`. Archive `.local/backups/aurel_ai_restore_test_20261020164337_8f3f13.dump`, SHA-256 `fc25501497f69d41324ef931cd69c7d78f61b03807970851d683b2e51fe22451`; tính lại hash khớp verified JSON.
- Trước rehearsal, fingerprint bản restore khớp đầy đủ source mới nhất: rows, columns/precision/scale, constraints/indexes/sequences, enums/functions/triggers. Source kết nối read-only; sau rehearsal fingerprint main và hash `.env` không đổi.
- Main hiện có 0 ProductVariant, 0 Order, 0 OrderItem: **không có bản ghi legacy thực tế để xác minh đơn vị**. Không suy ra currency từ việc DB rỗng. Fixture legacy chỉ tạo trên bản restore: 12.34 và tổng 24.68 giữ nguyên sau migration; currency/lineTotal vẫn NULL, ProductPrice không được sinh tự động. Cleanup fixture hoàn tất.
- Main chỉ có migrations init_aurel/better_auth. SQL mới SHA-256 normalized LF `169d7de4f3227fa658aae9c0164dc5a175994b4156ea14b7f14c643a2aa2a9a6`, khớp manifest và không sửa migration đã áp dụng ở test.
- Migration trên bản sao mất 13.84 ms trong lượt đo có fixture nhỏ, không phải cam kết thời gian production. Kích thước nguồn lúc audit: Order 32768 bytes, OrderItem 24576, ProductVariant 40960, gồm indexes/overhead, không có hàng nghiệp vụ.

## Rà soát toàn bộ SQL

| Nhóm SQL | Kết quả và lưu ý |
| --- | --- |
| BEGIN/COMMIT, enum Currency | Transactional DDL, chỉ VND/USD/EUR, không default/backfill. Tên đã tồn tại sẽ lỗi, không chạy lại raw SQL lên DB đã mở rộng. |
| ALTER Order/OrderItem | Currency/lineTotal nullable bảo toàn legacy. Decimal(12,2) sang NUMERIC không typmod không làm tròn lại số cũ. ALTER TYPE/ADD COLUMN cần khóa mạnh; thống kê cột đổi type cần ANALYZE sau deployment đã duyệt. |
| ALTER ProductVariant.price DROP NOT NULL | Giữ nguyên số tiền cũ, cho phép variant chưa định giá; không gán đơn vị. Có khóa bảng dù không cần cập nhật từng giá. |
| ProductPrice + serial PK/timestamps | Bảng mới, FK Restrict không cascade xóa variant. updatedAt do Prisma cung cấp, raw SQL phải tự đặt. |
| Unique và indexes | Unique variant/currency đồng thời phục vụ lookup FK. Index currency/amount cho giá độc lập; index Order currency/createdAt xây kiểu thường trên bảng cũ, chặn ghi. Không thể đổi thành CONCURRENTLY bên trong transaction hiện tại. |
| FK ProductPrice.variantId | Kiểm tham chiếu thật; bảng giá mới rỗng, chi phí validation hiện nhỏ. Không giả định chi phí tương lai. |
| CHECK ProductPrice | Chặn âm, overflow, scale VND>0/USD-EUR>2; NUMERIC không typmod tránh rounding trước CHECK. NaN/Infinity không nằm trong miền hợp lệ. |
| CHECK Order/OrderItem | Giá/line total đúng scale/range/quantity/product, giữ nhánh legacy NULL không chỉnh dữ liệu. Nhánh NULL cũng cho phép bản ghi mới chưa gán currency: order-write service tương lai bắt buộc chặn trường hợp này. |
| check_order_currency_snapshot | Khóa header FOR UPDATE, kiểm nonempty/cùng currency/tổng tại thời điểm trigger. **Có lỗi snapshot đồng thời ở REPEATABLE READ, xem dưới.** |
| enforce_order_currency_snapshot và 2 deferred triggers | Kiểm insert/update/delete, cả orderId cũ/mới khi chuyển item; bỏ qua header đã xóa để cleanup. Mỗi row có thể quét lại items, cần đo chi phí khi đơn lớn; nhiều order có thể deadlock nếu thứ tự khóa khác nhau. Tên bảng/function chưa schema-qualified: khi harden cần public-qualified và search_path/quyền CREATE được kiểm soát. |

SQL không có UPDATE dữ liệu legacy, DELETE/TRUNCATE/DROP bảng/cột, seed/reset hoặc quy đổi. Không sửa SQL/manifest trong lần review này.

## Blocker tái hiện được: snapshot invariant ở REPEATABLE READ

Trên bản restore: tạo một đơn USD tổng 0 với hai item đơn giá/lineTotal=0 (giá 0 hiện hợp lệ). Hai kết nối cùng BEGIN REPEATABLE READ, cùng chụp snapshot hai item, mỗi kết nối xóa một item khác nhau. Commit lần lượt: **cả hai thành công, còn 0 item**, trái với nonempty invariant. FOR UPDATE chỉ khóa header, không cập nhật header để bắt buộc conflict cho snapshot cũ. Không có public order mutation endpoint hiện tại nhưng tuyên bố DB invariant tổng quát chưa đúng.

Bằng chứng `.local/backups/<restore-name>.concurrency-review.json`: secondCommitError=null, remainingItems=0, invariantBypassReproduced=true. Đây là diagnostic phát hiện lỗi, không phải test chứng minh SQL an toàn. Fixture đã cleanup, rows trở về baseline, sequences không reset. Không ghi main.

Phương án cần triển khai/kiểm chứng trước xin duyệt: serialize các order mutations bằng thiết kế header write/version và isolation phù hợp; tránh chỉ thêm FOR UPDATE vào deferred check. Thêm regression hai kết nối (bao gồm READ COMMITTED/REPEATABLE READ/SERIALIZABLE, insert/update/delete, deadlock/retry), giữ audit và idempotency. Chỉ dùng SERIALIZABLE ở service tương lai là một phần biện pháp, không chứng minh mọi raw DB writer an toàn. Vì migration đã áp dụng test, không sửa âm thầm lịch sử: chuẩn bị migration khắc phục mới, review SHA và rehearsal từ backup mới toàn chuỗi trước approval main.

## Kiểm chứng đã chạy trên bản sao

- Lock probe: kết nối A giữ ACCESS SHARE trên Order, kết nối B chạy đúng SQL với lock_timeout=500ms; nhận 55P03. ROLLBACK trả toàn bộ schema/enum/data về fingerprint trước thử. Không kill session.
- Apply SQL với session lock_timeout=3s, statement_timeout=30s, verify 3 money CHECK, FK, 2 functions và 2 user constraint triggers tồn tại.
- 17 assertions nghiệp vụ/rollback: bảo toàn fixture legacy; tổng sai/currency trộn cho VND/USD/EUR bị 23514; đơn hai sản phẩm từng currency giữ snapshot sau update giá; amount sai precision/âm/overflow bị 23514; unique bị 23505; FK bị 23503. Dữ liệu probe chạy trong transaction rồi rollback; không giữ sản phẩm/đơn thử.
- Diagnostic đồng thời riêng tìm ra blocker như trên. Báo cáo máy đọc `.preflight.json` và `.concurrency-review.json` ở `.local/backups/`, không chứa credentials.

## Lệnh đã chạy và dự kiến

Đã chạy, chỉ source read-only và ghi bản restore riêng:

```powershell
npm.cmd run test:postgres:backup -- --confirm-test-database=aurel_ai_test
node --experimental-strip-types scripts/multi-currency-preflight.ts aurel_ai_restore_test_20261020164337_8f3f13 --confirm-restore-test=aurel_ai_restore_test_20261020164337_8f3f13
node --experimental-strip-types scripts/multi-currency-concurrency-review.ts aurel_ai_restore_test_20261020164337_8f3f13 --confirm-restore-test=aurel_ai_restore_test_20261020164337_8f3f13
```

Preflight là một lần trên restore còn nguyên schema cũ; không chạy lại vào DB đã mở rộng. Lần tiếp theo backup/restore mới và dùng tên mới. Hai scripts xác minh host, test role, tên/pattern, physical database; main URL chỉ được dùng read-only trong preflight.

Rehearsal chạy raw SQL trên bản sao để đo/kiểm rollback; không đánh dấu migration applied trong `_prisma_migrations` của bản sao. DB này là chứng cứ audit, không dùng thay main hoặc môi trường deploy chuẩn. Archive gốc trước rehearsal không đổi; triển khai được duyệt sau này phải quản lý migration metadata đúng bằng quy trình Prisma đã review.

Sau khi sửa blocker: chạy lại backup/restore, rehearsal toàn chuỗi, tests và review SQL/checksum. **Chưa được chạy trên main:** `npx.cmd prisma migrate deploy`. Chỉ đưa vào phiên deployment sau approval riêng, kiểm pending migrations đúng danh sách, maintenance window và timeout đã kiểm chứng trên đúng kết nối DDL của runner. Không giả định PGOPTIONS tự động được Prisma CLI kế thừa; phải verify cấu hình session bằng chứng trước deployment. `prisma generate` chỉ cập nhật client, không phải migration DB.

## Khóa bảng và xử lý lỗi

ALTER TABLE ở đây cần ACCESS EXCLUSIVE, có thể chặn cả đọc và ghi, giữ tới COMMIT; transaction đọc lâu cũng có thể làm migration chờ. CREATE INDEX thường chặn ghi; CHECK mới quét kiểm dữ liệu, ALTER TYPE/index có thể cần xử lý/rebuild tùy dữ liệu và PostgreSQL. Không suy thời gian production từ 13.84 ms trên DB rỗng. [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html), [CREATE INDEX](https://www.postgresql.org/docs/18/sql-createindex.html).

- Trước apply được duyệt: kiểm active/idle-in-transaction sessions, pg_locks/pg_stat_activity và dung lượng; dừng/drain writers có kiểm soát, không tự terminate kết nối. Xác nhận application flag vẫn false.
- Timeout/SQL error/deadlock: dừng rollout, ROLLBACK/đóng connection, xác minh schema và dữ liệu, kiểm `_prisma_migrations`. Không retry mù, không reset, không sửa checksum hoặc đánh dấu applied khi DDL chưa hoàn tất.
- Nếu dùng Prisma deploy gặp migration failed: chỉ cân nhắc `prisma migrate resolve --rolled-back <name>` sau khi xác minh rollback thực tế và có quyết định vận hành riêng; không tự chạy resolve trong audit.
- Nếu đã COMMIT nhưng app lỗi: giữ/tắt flag, rollback app về legacy-compatible version; không DROP schema/giá mới. Phục hồi backup sang DB mới và đối soát trước chuyển kết nối, không restore đè main đang ghi. Backup logical này không gồm global roles/ACL/PITR/offsite policy.

Chỉ chủ dự án quyết định approval sau khi nhận bản SQL khắc phục và bằng chứng mới. Lượt review này kết thúc ở trạng thái **blocked for production deployment**, không thay đổi main.
