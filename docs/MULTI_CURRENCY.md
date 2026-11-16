# Multi-Currency — Phase 2.5

## Trạng thái cập nhật Phase2.9.2 (2026-10-21)
Main local aurel_ai đã apply đủ5 migrations, không còn pending; ba SQL staging được chủ dự án cho phép sau backup/restore/no-drift/rehearsal đạt. Không seed/main fixtures hoặc thay secrets/roles/table grants/ownership. ADMIN Product Management đã có tại /admin/products, nhưng main0 ADMIN và provisioning cần approval riêng. MULTI_CURRENCY_ENABLED vẫn hiệu lực false; public catalog/PDP luôn lọc websitePermission=granted từ schema đã deploy, độc lập cờ AI. Production role/cutover/audit/offsite backup chưa GO. Xem [ADMIN_PRODUCTS.md](ADMIN_PRODUCTS.md) cho evidence/routes/tests/limits. Các mô tả staged/main pending bên dưới là lịch sử trước Phase2.9.2.


Ngày 2026-10-20. Code/migration đã kiểm thử trên PostgreSQL test. **Chưa áp dụng migration vào aurel_ai.** Không thay UI, không FX hoặc currency mặc định.

**Phase2.5.1:** write skew trong preflight đã được khắc phục bằng migration mới order_revision, nghiệm thu13 lịch mỗi isolation và rehearsal Prisma đầy đủ. Xem [ORDER_CONCURRENCY_REMEDIATION.md](ORDER_CONCURRENCY_REMEDIATION.md). Main vẫn NO-GO chưa approval riêng; MULTI_CURRENCY_PREFLIGHT giữ chứng cứ lỗi cũ, không sửa migration đã apply.

## Dependency mới — Phase 2.9.1
- Product Foundation staged `20261021090000_product_foundation` chạy sau multi_currency và order_revision; không sửa ProductPrice hoặc SQL lịch sử. Main hiện có ba pending migrations, không tự migrate/bật cờ. Product Foundation có gate PRODUCT_FOUNDATION_ENABLED độc lập, không khiến ProductPrice được query khi MULTI_CURRENCY_ENABLED=false. CSV price template dùng đúng money validation, không FX/default currency; features dataset không chứa price. Xem PRODUCT_FOUNDATION.md.

## Mô hình và precision
- ProductPrice thuộc ProductVariant, enum VND/USD/EUR, unique (variantId,currency), index (currency,amount), FK Restrict. Mỗi giá được ADMIN thiết lập độc lập; biến thể có thể chưa có giá.
- Amount dùng NUMERIC không typmod + CHECK: 0 <= amount < 10^18, scale VND=0, USD/EUR<=2. numeric(p,s) có thể làm tròn trước CHECK nên không dùng cho giá mới. Input/output string, không float/Number, exponent, âm, leading zero hoặc rounding ngầm. USD/EUR chuẩn hóa hai số lẻ. Giá 0 khác thiếu giá.
- ProductVariant.price legacy giữ Decimal(12,2), nay nullable để tạo variant chưa định giá. Không copy sang ProductPrice, không gán currency từ số tiền/UI/seed. Seed cũ không được chạy, chỉ thêm null guard cho typecheck.
- Order.currency/OrderItem.currency nullable giữ lịch sử chưa xác minh; OrderItem.lineTotal mới nullable. totalAmount/unitPrice mở rộng NUMERIC, giá trị cũ giữ nguyên. Đơn multi-currency lưu snapshot currency/unitPrice/lineTotal/totalAmount, không FK tới giá live.
- CHECK kiểm quantity dương, scale/range, lineTotal=unitPrice*quantity; tổng tối đa 22 chữ số nguyên. Deferred constraint triggers khóa header, kiểm tại COMMIT: đơn có currency phải có item, mọi item cùng currency, sum lineTotal=totalAmount. Không trộn legacy NULL với item có currency.

## API và staging
Phase2.8 Product Detail dùng exact selected currency chỉ khi flagtrue; không chọn currency thì không suy diễn default. Flagfalse không query ProductPrice, DTO detail không chứa legacy numeric price và UI báo Giá chưa khả dụng. Detail mapper validate scale/range bằng money(Decimal.toString()) trước toFixed, client chỉ string formatting; không FX/float rounding. GET currency selector chỉ render khi feature đã bật, không tự đổi flag/migrations. Cart action disabled kể cả giá/stock hợp lệ vì backend chưa nối. Existing catalog interface giữ tương thích.

MULTI_CURRENCY_ENABLED mặc định false; không sửa .env thật. Catalog/service cũ chỉ query bảng/cột có trên main trước migration. Price API trả FEATURE_UNAVAILABLE sau kiểm quyền. npm run db:migrate tạm chặn; guard script không chặn người có quyền tự gọi Prisma CLI.

Sau migration được duyệt và bật flag/restart trong môi trường tương ứng:
```ts
const service = createProductDataService(); // server-only, Better Auth session thật
await service.setPrice({ productId, variantId, currency: "USD", amount: "12.10" });
await service.getPrice(productId, variantId, "EUR"); // amount:null/status:missing nếu chưa đặt
await service.listPrices(productId, variantId);
await service.removePrice(productId, variantId, "VND");
await getCatalogPage({ q: "", category: "", invalid: false, currency: "USD", page: 1 });
```
Mọi operation dùng session/expiry/DB ADMIN/parent scope/allowlist và safe errors; không role/userId từ JSON, không endpoint/Admin UI mới. Legacy create/update vẫn nhận price theo contract cũ; giá có đơn vị phải dùng setPrice. Create variant được bỏ legacy price chỉ khi đã migrate và bật flag.

CatalogQuery thêm currency tùy chọn, parser từ chối mã lạ/repeated. DTO currency/priceStatus: chọn currency chỉ lấy đúng ProductPrice, thiếu trả null/missing, product minimum chỉ trong currency đó; không fallback legacy/currency khác. Không chọn currency giữ legacy interface và đánh dấu currency:null/legacy_unassigned, không dùng nhánh này làm giá checkout. Không thêm selector/format UI.

lib/db/queries/order-pricing.ts đọc giá/metadata thật trong RepeatableRead, kiểm active/stock/missing, tạo snapshot bằng BigInt minor units qua features/orders/pricing.ts; tối đa 100 variant khác nhau. Chỉ chuẩn bị giá, **chưa checkout/order-write/stock reservation**. Checkout sau phải đọc lại giá, authorize và giữ tồn kho trong cùng transaction, kiểm ownership/idempotency, không tin giá/tổng khách gửi.

## SQL, backup và rehearsal
Migration mới 20261020160500_multi_currency; hai migrations cũ không sửa. Review SQL: enum/table/index/FK mới; snapshot nullable, widening NUMERIC, legacy price nullable; CHECK/deferred triggers trong BEGIN/COMMIT. Không UPDATE/backfill/default currency, DROP bảng/cột, seed hoặc reset. SHA normalized LF thêm vào reviewed-migrations.json; review/test không phải approval production.

Trước thay schema đã chạy test:postgres:backup với --confirm-test-database=aurel_ai_test. Archive .local/backups/aurel_ai_restore_test_20261020155922_6b1b2b.dump và verified JSON: restore fingerprint data/columns/constraints/indexes/sequences khớp, main không đổi. Archive private không commit.

Sau đó dùng DB restore này rehearsal có fixture legacy: price=12.34, order=24.68; apply SQL, xác nhận giữ nguyên số tiền, currency/lineTotal NULL, ProductPrice rỗng; cleanup scoped. DB restore đã mở rộng sau rehearsal, archive gốc nguyên vẹn. Lần sau dùng restore mới đã verify:
```powershell
node --experimental-strip-types scripts/rehearse-multi-currency.ts <restore-test-name> --confirm-restore-test=<restore-test-name>
npm.cmd run test:postgres -- --confirm-test-database=aurel_ai_test
```
Rehearsal kiểm host/role/physical target/confirmation, từ chối main hoặc DB đã mở rộng. Module cũng chuẩn bị legacy fixture trước pending migration nếu test DB còn schema cũ và sạch; nếu lỗi giữ chứng cứ, không reset/xóa dữ liệu lạ. Migration đã deploy aurel_ai_test, child env bật flag, không đổi .env main. Fingerprint bổ sung numeric precision/scale, enums, functions/triggers.

## Kiểm thử và production gate
Unit kiểm precision ba currency, invalid/overflow/mixed order, tổng chính xác, parser, missing DTO không fallback, feature gate và quyền. PostgreSQL thật kiểm price CRUD, unpriced/missing, catalog ba currency, CUSTOMER denied, scale/negative/overflow/unique/FK, snapshot hai sản phẩm cho từng currency, update giá không đổi đơn, tổng sai/mixed rollback, stock thiếu. Auth/CRUD/CAS/expiry/revoke cũ vẫn đạt; cleanup test về baseline, main fingerprint/.env không đổi. Sandbox tsx userInfo/ENOMEM được xử lý bằng chạy ngoài sandbox được duyệt; pg deprecation từ Prisma còn như Phase 2.4.

Trước main deployment:
1. Chủ dự án review/chấp thuận SQL và legacy plan: kiểm kê, bằng chứng currency từng giá/đơn, đối soát snapshot. Chưa xác minh giữ NULL/legacy và chặn checkout, không mặc định VND.
2. Backup mới ngay trước apply, verify restore/hash, rehearsal dữ liệu mới nhất, đánh giá lock/widening/maintenance window. Backup local chưa thay offsite/PITR/roles/ACL.
3. Sau approval mới migrate deploy main, verify constraints/triggers/data, generate client và bật flag/restart. Rollback app bằng tắt flag; không down-migrate xóa giá hoặc restore đè DB đang nhận giao dịch.
4. Nhập giá nguồn thật, hoàn thiện checkout transaction/inventory trước bán hàng. Không Admin Dashboard trong task này.
Main vẫn hai migrations cũ; migration mới pending có chủ ý.

Tham chiếu: [SIX ISO 4217](https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html), [PostgreSQL numeric](https://www.postgresql.org/docs/18/datatype-numeric.html), [constraint triggers](https://www.postgresql.org/docs/18/sql-createtrigger.html).
