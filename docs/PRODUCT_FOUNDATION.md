# Product Database Foundation — Phase 2.9.1

## Workflow cập nhật: ảnh chuyển sang Showroom (2026-10-22)
Step1 chỉ dữ liệu + Tiếp theo, Step2 /admin/products/[id]/preview dùng shared PDP với public /products/[slug]. Click slot upload/replace/remove/order/cover/role persist ngay, reuse ImageAsset BYTEA và ProductImage metadata; không còn ảnh/summary/save buttons ở Step1. Step2 có Save Draft/Save Product/publish explicit. ProductDraftRequest migration staged test-only, main7/test10 chưa apply mới. Report/acceptance/checks/limits/migration approval tại [PRODUCT_SHOWROOM.md](PRODUCT_SHOWROOM.md). Các mô tả upload trong editor một bước bên dưới là lịch sử, không UI hiện tại.


## Tải ảnh từ máy và kho ảnh PostgreSQL — 2026-10-22
- Thêm ảnh mở file picker nhiều JPG/PNG/WebP; upload tuần tự, tối đa8MB/ảnh, decoder thật giới hạn24MP, xoay EXIF/resize trong1920×1920/WebP82/loại metadata. Binary lưu ImageAsset.data BYTEA trong DB, không base64 trong Product hoặc ghi file public. ProductImage giữ storageKey và metadata/quyền cũ.
- Ô Kho ảnh thu gọn trong card Hình ảnh: danh sách12 ảnh/trang, trạng thái rỗng/loading/error/retry và chọn lại ảnh đã upload. Metadata ảnh mặc định collapse; ảnh upload xong gắn vào draft, vẫn cần Lưu sản phẩm. Ảnh kho còn lại nếu bỏ draft, không tự xóa binary khi xóa metadata/sản phẩm.
- Upload/list/read riêng dùng session thật + DB ADMIN qua service.run. Ảnh public chỉ khi có ProductImage gắn sản phẩm active, websitePermission=granted và rightsReference; unknown/denied không tự được công khai hoặc cấp quyền AI. Next optimizer chặn uploads để không cache vượt kiểm tra quyền, các consumers dùng unoptimized có điều kiện; không đổi bố cục storefront.
- Main đã apply riêng20261021110000_image_storage sau backup/restore/no-drift/rehearsal: main7/9 migrations, test9/9. Hai taxonomy SQL vẫn pending main. Dữ liệu cũ/sequences/env giữ nguyên, không fixture ảnh/user/product main.
- Prisma generate,87 unit tests,11 PostgreSQL tests gồm parent, lint/typecheck/build đạt. Next config tự restart dev: listener28056/launcher7976, cổng3000; không HTTP/browser/automation/screenshot. Visual QA Pending Manual Review. Xem IMAGE_STORAGE.md cho cách dùng/evidence/files/giới hạn.


Nhóm tuổi/URL tự sinh đã cập nhật cả main và migration ngày2026-10-22. Xem [PRODUCT_AUDIENCE.md](PRODUCT_AUDIENCE.md) cho contract nullable, nhóm nhãn, CSV/feature v3 và bằng chứng deploy. Không backfill nhóm tuổi hoặc đổi URL cũ.


## Mở rộng Phase2.9.3
Taxonomy registry dùng chung + token not-applicable riêng, code viết tắt và feature schema v2 đã triển khai/test-only; taxonomy main vẫn compatibility v1 cho đến approval/deploy cả2 SQL. Profile giữ các cột cũ và bổ sung ageGroup nullable trong migration độc lập đã apply main, color/size chỉ variants; không suy diễn giá/units sold/rights. CSV vẫn sáu bảng; AI header có thêm age_group tùy chọn và nhận header cũ, live validator/digest nhận registry; offline CLI nhận optional reviewed registry snapshot. JSON schema v1 giữ nguyên, v2 kiểm tra lexical và runtime membership theo report taxonomyRegistry. Xem [PRODUCT_EDITOR.md](PRODUCT_EDITOR.md); các giới hạn static CHECK/missing=NA bên dưới mô tả thiết kếv1 lịch sử.

## Trạng thái cập nhật Phase2.9.2 (2026-10-21)
Main local aurel_ai hiện6 migrations gồm audience; Phase2.9.3 có2 SQL taxonomy pending main, test đã8 migrations; ba SQL staging được chủ dự án cho phép sau backup/restore/no-drift/rehearsal đạt. Không seed/main fixtures hoặc thay secrets/roles/table grants/ownership. ADMIN Product Management đã có tại /admin/products, main đã có đúng tài khoản ADMIN được chủ dự án chỉ định ngày2026-10-22. MULTI_CURRENCY_ENABLED vẫn hiệu lực false; public catalog/PDP luôn lọc websitePermission=granted từ schema đã deploy, độc lập cờ AI. Production role/cutover/audit/offsite backup chưa GO. Xem [ADMIN_PRODUCTS.md](ADMIN_PRODUCTS.md) cho evidence/routes/tests/limits. Các mô tả staged/main pending bên dưới là lịch sử trước Phase2.9.2.


Ngày 2026-10-21. **Main `aurel_ai` NO-GO, chưa áp dụng migration này.** Schema repo mô tả đích sau toàn bộ migration staged; không đồng nghĩa schema main đã cập nhật. Không tạo database/role mới, đổi grant/ownership, .env, seed hay nhập hàng vào main. Không thay UI, Admin Dashboard hoặc train/recommendation model.

## Đối chiếu schema và lựa chọn

| Nhóm | Existing fields/models | Proposed fields | Required changes |
| --- | --- | --- | --- |
| Định danh | Product.id Int PK, slug unique, name | productCode nullable unique `AUR-` + 4–12 số | Không thay PK/SKU, không backfill mã legacy; foundation setter bắt buộc mã hợp lệ |
| Thông tin | description, brand, categoryId, isActive, createdAt | collection nullable slug; updatedAt nullable | Không tạo status/timestamp tương đương; trigger updatedAt chỉ khi ghi sau deploy |
| Category/collection | Category relation đã có | Product.collection | Chưa có collection lifecycle nên slug tối giản, không tạo bảng Collection |
| Options mô tả | Chưa có collar/fabric/gender/fit | ProductProfile 1:1 theo productId | Cột có kiểu, allowlist taxonomy, NULL nếu thiếu/không áp dụng |
| Biến thể | ProductVariant color/size/sku/stock/isActive, unique productId+color+size | Không sao chép color/size sang profile | Giữ tổ hợp hiện hữu; expression unique chống khác case/space và CHECK stock mới |
| Pricing | ProductPrice variantId+currency unique; legacy price | Không thêm bảng/giá thứ hai | Tái sử dụng money/service và flag Multi-Currency; không tự sinh giá thiếu |
| Ảnh | ProductImage storageKey/altText/sortOrder, resolver | variantId, imageType, isPrimary, sourceReference, rightsReference, 3 permissions | FK ghép bảo đảm variant thuộc đúng product; primary tối đa 1/product |
| AI metadata | Category, description, images, variants | garmentType/styleTags/seasonTags/occasionTags/layerRole/pattern/silhouette trong cùng ProductProfile | Không tạo FashionAIProfile thứ hai/EAV/ProductEmbedding/vector storage |
| Analytics | Order/OrderItem/status/quantity | Thiết kế read-model bên dưới | Không thêm counter Units Sold/Order Count/Views vào Product |

Giữ mọi bảng cũ. Sửa Product, ProductVariant (ràng buộc/index), ProductImage; tạo duy nhất ProductProfile. ProductPrice, auth, Order/OrderItem không đổi trong migration mới. Product.brand giữ để backward compatibility, không thêm marketplace/brand entity; dữ liệu mới thuộc AUREL theo quy trình curate.

## Quan hệ và Options

- Product → Category N:1; Product → ProductProfile 1:0..1; profile PK đồng thời FK productId.
- Product → ProductVariant 1:N; variant → ProductPrice 1:N, unique variant/currency.
- Product → ProductImage 1:N; ảnh có thể → variant qua `(variantId, productId)` → `(id, productId)`, không gán ảnh sang variant của sản phẩm khác. Không cascade xóa lịch sử.
- Sáu nhóm Options được tổng hợp từ **một** profile mô tả (Collar/Fabric/Gender/Fit) và các variant thật (Color/Size). Không có Options JSON sao chép màu/size, không Cartesian SKU generator.
- Taxonomy version `aurel-fashion-v1` tại `src/features/products/foundation.ts`, SQL CHECK và feature JSON schema cùng version. Normalize label trim/lowercase/hyphen; size uppercase. Code không chấp nhận giá trị tùy ý. Mở taxonomy cần sửa nguồn/SQL/schema, review version và chạy check; không giả `N/A`. Cột NULL chưa phân biệt missing với not-applicable trong v1, missing report yêu cầu curate thủ công, không suy diễn.
- `profile` có các index gender/garmentType, fabric/fit để dùng Prisma `where.profile.is` cho filtering sau này; color/size filter trực tiếp trên cùng `variants.some` để tránh ghép các giá trị không tồn tại trong cùng SKU. Chưa thêm public filter UI/API.
- Fabric hiện là thuộc tính mô tả duy nhất. Khi AUREL thực sự bán cùng màu/size với nhiều vải: thêm cột fabric chuẩn hóa trên ProductVariant, bật chế độ fabric-variant cho sản phẩm, bỏ nguồn fabric mô tả của sản phẩm đó và migrate unique combination sang các chiều thật; cập nhật DTO/variant selector/import/export đồng thời. Không nhét fabric vào SKU để lách unique hoặc cho tạo hai SKU không thể phân biệt trên PDP hiện tại. Đây là extension quan hệ rõ ràng, cần phase riêng khi có nhu cầu thật; v1 chưa bán biến thể fabric hoặc size system khác XS–XXL.

## Service và compatibility

`createProductDataService` truyền `productFoundation` từ `PRODUCT_FOUNDATION_ENABLED === "true"`; mặc định tắt khi biến không tồn tại. Không sửa env hay bật cờ trong phase. Ba operation mới `setFoundation`, `setImageMetadata`, `exportFeatures` đi qua Better Auth resolver hiện có, expiry/DB ADMIN check và Serializable transaction; fail closed trước truy vấn trường mới khi tắt. Không thêm endpoint công khai.

`setFoundation` thay toàn bộ profile, bắt buộc Product Code; collection mặc định NULL. `setImageMetadata` patch allowlist; variantId omit giữ liên kết, NULL bỏ liên kết. Primary switch trong transaction, partial unique chặn race; mọi quyền granted cần rightsReference. `exportFeatures` phân trang page/pageSize (1..100), purpose embedding/training, chọn dữ liệu sản phẩm tối thiểu, không users/orders/secret. Caller phải thu thập các trang trong cùng snapshot khi xây export dataset lớn; pagination offset nhiều request chưa bảo đảm snapshot xuyên trang.

CRUD cũ/DTO/stock CAS giữ contract; khi foundation bật, create/patch variant chuẩn hóa taxonomy Color/Size/SKU. ProductCode được gán bằng foundation setter trong workflow quản trị, legacy CRUD không bắt buộc mã mới để tránh phá API. Importer write tương lai phải create + setFoundation trong một transaction và không public sản phẩm trước khi đủ dữ liệu. CSV dry-run v1 chỉ lập kế hoạch insert, chưa có write importer.

Catalog/PDP tiếp tục explicit select cũ. Cả hai flag tắt không query ProductProfile, permissions hay ProductPrice. `updatedAt` của Product không dùng Prisma `@updatedAt` để không tự ghi cột chưa tồn tại vào main; database trigger cập nhật sau migration, legacy timestamps giữ NULL tới lần ghi thật. Khi foundation được duyệt/bật, public catalog/detail chỉ chọn ảnh websitePermission=granted, vẫn qua resolver public raster; unknown/denied không được hiển thị, thiếu ảnh dùng fallback hiện có. Không expose raw storageKey/rights/source trong public DTO. Multi-Currency là cờ độc lập; chỉ bật sau khi chain migration và legacy currency plan được duyệt, không gán VND/USD/EUR cho legacy numeric.

## Quyền ảnh

imageType: front/back/detail/lifestyle/other hoặc NULL. Permissions website/embedding/training độc lập: unknown/granted/denied; default unknown, AI export deny-by-default. Không suy quyền AI từ việc có URL website. rightsReference trỏ hồ sơ quyền đã review; sourceReference trỏ nguồn gốc, không chứa thông tin riêng tư/secret. Không tải ảnh/nhúng binary vào PostgreSQL. isPrimary chỉ là metadata; không thay bố cục gallery đã duyệt, gallery vẫn sortOrder/id. Người nhập cần đồng bộ sortOrder nếu muốn ảnh primary đứng trước.

## ML Feature Schema và mapping

Contract máy đọc: `data/templates/product-features.schema.json`; schema_version `aurel-product-features-v1`. Hàm `extractFeatures`/`exportFeatureDataset` là pure; CLI offline xuất JSONL và report. Không train/fine-tune, không gọi AI provider.

| Output | Nguồn | Quy tắc |
| --- | --- | --- |
| product_id | Product.id | Chuỗi định danh ngoài features, không dùng làm số học |
| category | Category.slug | Categorical code thật |
| garment_type/collar/fabric/gender/fit | ProductProfile | Normalize/validate taxonomy, NULL không suy đoán |
| color/size | active ProductVariant | Distinct/sorted, chỉ giá trị hiện hữu; không tạo tổ hợp mới |
| style_tags/season_tags/occasion_tags | ProductProfile arrays | Distinct/sorted/allowlist |
| layer_role/pattern/silhouette | ProductProfile | Categorical nullable |
| description | Product.description | Text, trim, NULL nếu trống |
| image_references | ProductImage.id + resolver URL | Website grant + purpose grant + source + rights evidence; private/unverified loại khỏi export |
| eligibility.active/in_stock | Product.isActive, active variants stock>0 | Điều kiện lọc ngoài features, không embedding stock |
| missing | Các trường NULL/array rỗng | Báo thiếu để review; không tự điền |

Stock0 vẫn có thể dùng thuộc tính content, eligibility.in_stock=false. Sản phẩm inactive vẫn được giữ để curate, active=false; caller ranking lọc eligibility. Price/Units Sold/Order Count/Views không nằm trong features. Embedding và training purpose dùng permission khác nhau. Metadata nguồn riêng tư không vào output; snapshot input cũng phải được chủ dữ liệu curate. Export không tự chứng nhận quyền pháp lý từ string reference.

JSONL lỗi validation không xuất record đó, report row/code; duplicate ID bị báo. Empty collection → JSONL 0 byte/report0; chưa có profile → NULL/[] và missing list; private/ungranted image → không có reference. Không thay dữ liệu storefront khi export lỗi. ID/SKU không thành numeric features; category/text/image có thể kết hợp sau này, user interactions qua nguồn/tầng riêng có consent. Khi train về sau cần snapshot time, split theo product family/time, fitted preprocess chỉ trên train, không future sales/stock leakage hoặc trùng ảnh/sản phẩm giữa train/test. Popularity/price là ranking input riêng sau khi xác minh policy/tiền tệ.

## Units Sold — thiết kế chưa được publish

OrderStatus hiện chỉ có PENDING/CONFIRMED/SHIPPED/DELIVERED/CANCELLED, chưa có ReturnItem/refund ledger và order service hoàn chỉnh. **Không có số Units Sold chính thức trong phase này**, kể cả số0 cũng không giả vờ đã thống kê. Không tạo view/table/counter hoặc fixture bán hàng. Chờ duyệt chính sách recognition (ví dụ chỉ DELIVERED, loại CANCELLED và trừ returned quantity theo từng OrderItem, không trừ stock adjustment).

Query dự thảo cho **gross delivered units**, chưa chạy/publish, không gọi là net Units Sold:

```sql
SELECT oi."variantId", SUM(oi.quantity)::bigint AS gross_delivered_units,
       COUNT(DISTINCT oi."orderId")::bigint AS delivered_order_count
FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
WHERE o.status = 'DELIVERED'
GROUP BY oi."variantId";
```

Read-model chính thức tương lai: aggregate return ledger theo OrderItem trước, net quantity = purchased quantity − accepted returned quantity, reject return > quantity; nhận trạng thái/timestamp trong policy đã version. Đơn hủy loại hoàn toàn; hoàn một phần trừ đúng quantity; cancelled/refunded đơn giao trước đây phải dựa ledger/history, không chỉ trạng thái hiện tại. Rollup variant → product qua variant.productId, count DISTINCT orderId ở cấp product (không cộng variant order counts). Product Views cần event stream riêng, không suy từ OrderItem. Nếu thiếu order/return policy, API phải unavailable thay vì counter nhập tay. Không tham gia core shopping hoặc dataset v1.

## Migration review và bằng chứng

`20261021090000_product_foundation` đứng sau `20261020160500_multi_currency` và `20261020170000_order_revision`, không sửa migration cũ. Review nội bộ: additive nullable metadata/default unknown; một bảng 1:1; FK ghép chống ảnh sai parent; expression unique SKU/combination; taxonomy CHECK; stock/sort CHECK NOT VALID; primary partial unique; trigger SECURITY INVOKER/search_path cố định/revoke PUBLIC execute; lock_timeout3s/statement_timeout30s trong transaction. Hash trong `tests/support/reviewed-migrations.json` là review kỹ thuật để test, **không phải approval deploy main**.

Không rewrite legacy để chuẩn hóa. Unique expression sẽ từ chối deployment nếu legacy có collision khác case/space; phải preflight/report và chủ dữ liệu xử lý riêng, không auto merge/delete. Stock/sort NOT VALID tránh quét/ép sửa legacy nhưng áp dụng mọi new INSERT/UPDATE; cần audit/VALIDATE CONSTRAINT riêng trước production. Nullable mã/các thuộc tính cũ không được tự fill. SQL có custom CHECK/expression/partial indexes và trigger ngoài những gì Prisma schema biểu diễn; không dùng db push để thay migration.

Đã migrate deploy vào đúng aurel_ai_test/aurel_ai_test_runner bằng target guard và physical identity; test không cấp thêm quyền. DB checks cover code/SKU/combination uniqueness, mọi taxonomy scalar/array, stock, VND scale, cross-product image FK, rights evidence và primary. Service thật thử setFoundation/setImageMetadata/exportFeatures, auth denial; scoped fixtures trong transaction rồi rollback. Main read-only fingerprint gồm rows/schema/constraints/indexes/sequences/functions/triggers/enums và .env SHA trước/sau không đổi. Bảng test về baseline; không reset sequences. Lượt đầu test vô tình tiêu thụ 1 sequence ProductPrice do negative-price probe thiếu explicit ID, chỉ test DB; đã sửa explicit ID và chạy lại đạt, không reset sequence.

Windows sandbox tsx lỗi userInfo/ENOMEM; chạy đúng command test ngoài sandbox đạt. pg concurrent-query deprecation hiện có từ Prisma vẫn được quan sát; không sửa dependency trong phase. Lint/typecheck, 6 focused tests, full72 tests và build đạt. Visual QA **Pending Manual Review**, không dùng browser/Computer Use/Test Screen/screenshot. CLI template dry-run/export và read-only compatibility checks được ghi ở SESSION_LOG.

## Trước khi deploy main

Chủ dự án review/chấp thuận cả ba pending SQL theo thứ tự, legacy data/currency/taxonomy/rights audit; backup mới + restore rehearsal dữ liệu mới nhất; least-privilege runtime/owner provisioning và rollback/maintenance plan riêng. Không tự đổi grants hoặc kích hoạt flag. Chỉ bật PRODUCT_FOUNDATION_ENABLED khi schema đã deploy và ảnh đã curate website rights; chỉ bật MULTI_CURRENCY_ENABLED theo approval currency riêng. Trước fabric variants/size systems mới cần cập nhật selector và combination key; write importer, analytics/return ledger, storage provider và embedding strategy là công việc tiếp theo được tách rõ.
