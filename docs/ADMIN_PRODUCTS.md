# Phase 2.9.2 — Main migration và ADMIN Product Management

> Cập nhật 2026-10-23 — Complete the Look sửa trực tiếp và tự lưu: bấm/thả một ảnh vào khung12:13 cover/center, bỏ ảnh tại góc; bấm tên/giá để sửa, blur/Enter tự lưu, Escape hủy phần chữ đang sửa. Hàng đợi từng thẻ giữ version tuần tự, lỗi giữ dữ liệu/tệp và chờ retry tường minh. Thẻ mới nhận focus; hoàn thiện chỉ bật khi đủ ảnh/tên/giá đã lưu. Nền kéo sát mép trái bằng pseudo-element, chữ căn lề gallery, mép phải giữ nguyên. Gallery thay hàng nút lớn bằng menu thumbnail nhỏ Xóa/Đưa lên trước/Đưa về sau, giữ kéo sắp xếp và hỗ trợ thả tệp vào các slot. Không migration/main write; gallery65vh/panels37,5/25/37,5/navbar/publish giữ nguyên. Visual QA: Pending Manual Review.
> Deployment 2026-10-23: Main aurel_ai: 9 reviewed migrations applied with owner approval; test: 11. PendingProduct is available; the two taxonomy migrations remain pending. No existing product data, sequences or .env changed.
## Complete the Look mới (2026-10-23)
Complete the Look thủ công đã code/test: nútThêm món trong Preview tạo PendingProduct blank/idempotent ngay; inline autosave ảnh/tên/giá VND, formHoàn thiện chọncategory/variants thật→existingShowroom→explicitpublish. Queue /admin/products/pending phân trang20, source link; source-look hàngngang/pagination20/khôngcap4. Public chỉ linked child đãpublish/cópublicimage+price, archiveẩn; detach giữqueue/product, parent khôngunpublish/touch. YouMayAlsoLike bỏcategoryheuristic, Preview Chờ AI Recommendations/Productionẩn khiAIchưa có. Main aurel_ai: 9 reviewed migrations applied with owner approval; test: 11. PendingProduct is available; the two taxonomy migrations remain pending. No existing product data, sequences or .env changed. Chi tiếtAPI/files/schema/checks tại [COMPLETE_THE_LOOK.md](COMPLETE_THE_LOOK.md).


## Workflow cập nhật: ảnh chuyển sang Showroom (2026-10-22)
Step1 chỉ dữ liệu + Tiếp theo, Step2 /admin/products/[id]/preview dùng shared PDP với public /products/[slug]. Click slot upload/replace/remove/order/cover/role persist ngay, reuse ImageAsset BYTEA và ProductImage metadata; không còn ảnh/summary/save buttons ở Step1. Step2 có Save Draft/Save Product/publish explicit. ProductDraftRequest migration đã được owner duyệt và apply riêng, main8/test10. Report/acceptance/checks/limits/migration approval tại [PRODUCT_SHOWROOM.md](PRODUCT_SHOWROOM.md). Các mô tả upload trong editor một bước bên dưới là lịch sử, không UI hiện tại.


## Ảnh sản phẩm đơn giản và tìm theo tên — 2026-10-22
- Card ảnh chỉ còn Thêm ảnh, Kho ảnh và thumbnail; bấm thumbnail chọn ảnh chính, nút thùng rác bỏ khỏi sản phẩm. Đã bỏ toàn bộ UI đường dẫn/alt/biến thể/thứ tự/loại/nguồn/quyền; metadata cũ vẫn được giữ trong draft/service khi không sửa.
- Kho ảnh có ô Nhập tên sản phẩm, tự tìm sau250ms và nút Tìm/Enter; query server theo tên sản phẩm đã lưu, không phân biệt hoa/thường, match substring literal (không fuzzy/AI/unaccent). Kết quả12/trang, không duplicate blob khi một ảnh gắn nhiều sản phẩm, query parameterized và ADMIN gate. Ảnh chưa gắn sản phẩm chỉ xuất hiện khi tìm trống; tên mới/edit có hiệu lực sau Lưu sản phẩm.
- Theo yêu cầu upload-only cho ảnh website, lựa chọn upload unknown khi lưu editor được ghi website=granted cùng reference sự kiện quản trị chọn hiển thị; không đòi nhập quyền thủ công, không tuyên bố có giấy phép sở hữu. Explicit denied và quyền AI giữ nguyên. Các ảnh static/import/API vẫn dùng validator quyền/reference cũ; public route vẫn kiểm tra active/quyền mỗi request, không backfill main.
- Bỏ ảnh đã lưu được đưa vào removedImageIds và lưu chung aggregate, kiểm tra version/ownership/overlap/100-row limit; transaction thất bại không mất ảnh hoặc nội dung draft. Chỉ xóa liên kết metadata, binary còn trong kho.
- Không schema/migration mới hoặc main data/env/security/auth changes. Main7/test9 migrations giữ nguyên.88 unit/11 PostgreSQL tests, lint/typecheck/build đạt; fixtures test cleanup/rollback và main fingerprint/env unchanged. Visual QA Pending Manual Review.


Đã bỏ toàn bộ card “Lưu ý” và details “Định dạng mã & lựa chọn bổ sung” ở form new/edit theo yêu cầu ngày2026-10-22. Không đổi chức năng; lint/typecheck/build đạt, Visual QA Pending Manual Review.

## Tinh gọn chữ phụ admin và trạng thái lưu — 2026-10-22
- Xóa dòng trợ giúp ngoài ô: chú thích dưới bảng biến thể, dưới danh mục, subheading mặc định của editor, chú thích header CSV/intro/export và giải thích kỹ thuật trên màn hình access. Thêm ảnh chỉ còn icon/tên; định dạng/dung lượng giữ ở tooltip và lỗi khi chọn file sai. Không ẩn bằng selector toàn cục.
- Giữ nhãn/control/button, nội dung trong ô/card, empty/loading/error, số liệu thật và xác nhận thao tác. SectionHeading bỏ paragraph rỗng. Không đổi dữ liệu/backend/DB/migrations/validation hoặc layout.
- Editor có badge Có thay đổi chưa lưu viền vàng khi draft khác baseline; Đã lưu viền xanh chỉ khi có sản phẩm đã lưu và draft khớp baseline. Form tạo mới chưa nhập không hiển thị Đã lưu giả; save lỗi giữ trạng thái chưa lưu. Badge aria-live và phân biệt bằng chữ, không chỉ màu.
- Lint/typecheck/build đạt. Không thêm tests mirror presentation hoặc chạy DB suites; không HTTP/browser/automation/screenshot. Visual QA Pending Manual Review. Owner refresh new/edit/list/import, kiểm tra chữ phụ, empty/error và badge khi sửa/lưu thành công/lưu lỗi.


## Tải ảnh từ máy và kho ảnh PostgreSQL — 2026-10-22
- Thêm ảnh mở file picker nhiều JPG/PNG/WebP; upload tuần tự, tối đa8MB/ảnh, decoder thật giới hạn24MP, xoay EXIF/resize trong1920×1920/WebP82/loại metadata. Binary lưu ImageAsset.data BYTEA trong DB, không base64 trong Product hoặc ghi file public. ProductImage giữ storageKey và metadata/quyền cũ.
- Ô Kho ảnh thu gọn trong card Hình ảnh: danh sách12 ảnh/trang, trạng thái rỗng/loading/error/retry và chọn lại ảnh đã upload. Metadata ảnh mặc định collapse; ảnh upload xong gắn vào draft, vẫn cần Lưu sản phẩm. Ảnh kho còn lại nếu bỏ draft, không tự xóa binary khi xóa metadata/sản phẩm.
- Upload/list/read riêng dùng session thật + DB ADMIN qua service.run. Ảnh public chỉ khi có ProductImage gắn sản phẩm active, websitePermission=granted và rightsReference; unknown/denied không tự được công khai hoặc cấp quyền AI. Next optimizer chặn uploads để không cache vượt kiểm tra quyền, các consumers dùng unoptimized có điều kiện; không đổi bố cục storefront.
- Main đã apply riêng20261021110000_image_storage sau backup/restore/no-drift/rehearsal: main7/9 migrations, test9/9. Hai taxonomy SQL vẫn pending main. Dữ liệu cũ/sequences/env giữ nguyên, không fixture ảnh/user/product main.
- Prisma generate,87 unit tests,11 PostgreSQL tests gồm parent, lint/typecheck/build đạt. Next config tự restart dev: listener28056/launcher7976, cổng3000; không HTTP/browser/automation/screenshot. Visual QA Pending Manual Review. Xem IMAGE_STORAGE.md cho cách dùng/evidence/files/giới hạn.


## Cập nhật nhóm đối tượng — 2026-10-22
- Đường dẫn không còn là ô nhập: tạo mới tự sinh phía server từ tên + giới tính + nhóm tuổi, thêm hậu tố khi trùng; chỉnh sửa giữ URL đã lưu. Ô cũ thay bằng hai lựa chọn Giới tính và Nhóm tuổi, dùng lại gender hiện có và chuyển khỏi phần2 để tránh nhập trùng.
- Nhóm tuổi: Gen Alpha, Gen Z, Gen Y, Gen X, Trung niên, Cao tuổi, Trẻ em, Thanh thiếu niên, Mọi độ tuổi. Đây là nhãn phân loại sản phẩm do quản trị chọn; không suy luận tuổi/năm sinh. Chưa khai báo lưu NULL.
- Main PostgreSQL aurel_ai đã áp dụng riêng migration 20261021100000_product_audience: ProductProfile.ageGroup nullable + CHECK. Main6/8 migrations, test8/8; hai SQL registry/taxonomy-version vẫn pending main. Không tạo file SQLite main.db, không backfill hoặc thay dữ liệu/tài khoản/URL cũ.
- Backup mới, verified restore, kiểm tra không drift và rehearsal đạt trước apply main; dữ liệu cột cũ/sequences/.env giữ nguyên. CSV thêm age_group tùy chọn, nhận cả header AI cũ; feature export có age_group dùng schema v3, giữ consumer v1/v2 cho nguồn cũ.
- Prisma generate,84 unit tests,10 kiểm thử PostgreSQL gồm parent, lint/typecheck/build đạt. Next dev đã nạp Prisma client mới: launcher7976/listener9176 cổng3000. Không HTTP/browser/automation/screenshot. Visual QA Pending Manual Review.
- Báo cáo, file và evidence: [PRODUCT_AUDIENCE.md](PRODUCT_AUDIENCE.md). Bước tiếp theo: owner kiểm tra lựa chọn/save/reload/URL mới và URL cũ bằng tài khoản ADMIN thật; hai migrations taxonomy cần phạm vi phê duyệt riêng.


## Cập nhật Phase2.9.3 — 2026-10-22
Khối1 theo ảnh chi tiết đã thêm prefix icons, brand clear/null, toolbar mô tả có xử lý thực bằng nguồn Markdown +preview. Mô tả cũ literal, schema giữ nguyên; safe PDP renderer/SEO/ML plain text và description-only multiline validation. 80 unit/10 guarded PostgreSQL cùng lint/typecheck/build đạt. Xem [PRODUCT_DESCRIPTION.md](PRODUCT_DESCRIPTION.md), chưa visual/WYSIWYG QA.

Form đã chỉnh tiếp theo ảnh mẫu trực tiếp từ chủ dự án: admin header/sidebar active, info3 cột/metadata2 cột+pill chips/3 card đánh số, cột phải gallery/preview ngang/notes. Hủy xác nhận dirty; Lưu nháp dùng cùng save API với isActive=false thật, không enum mới. Header/footer switch chỉ admin; không chỉnh storefront. Auto code/SKU server/searchable options/tags/variant table/modal/dirty guard giữ nguyên. Main dùng mã số compatible; custom options và mã viết tắt mới chỉ chạy trên test. Main5 migrations với2 SQL pending mới, không main apply/dữ liệu/env/security changes. Xem [PRODUCT_EDITOR.md](PRODUCT_EDITOR.md) cho file mapping, SHA,6 focused tests, kết quả76 unit/10 PostgreSQL và manual QA. Phần nghiệm thu Phase2.9.2 bên dưới là lịch sử trước hai SQL đề xuất mới; không coi “không pending” tại thời điểm cũ là hiện trạng.

Create mới tự retry conflict/serialization tối đa4 lần; edit vẫn không retry. Code và SKU readonly/authoritative, CSV explicit contract giữ nguyên. API thêm GET taxonomy, POST get/taxonomy-add. Category modal hoạt động main, taxonomy modal báo pending khi thiếu capability. Chưa storage upload, không tạo nút giả.

## Trạng thái nghiệm thu ngày 2026-10-21

Main local `aurel_ai` đã apply đủ năm migrations, gồm ba migration được chủ dự án cho phép trong Phase2.9.2. Tại nghiệm thu Phase2.9.2 chưa có pending; hiện Phase2.9.3 thêm2 SQL test-only pending main. Không đồng nghĩa đã sẵn sàng production: runtime role hiện tại, TLS, backup offsite/PITR, audit tập trung và quy trình cấp ADMIN vẫn cần triển khai/phê duyệt riêng. Không thay secrets, roles, ownership hoặc table grants; các function REVOKE nằm trong SQL đã staging/review được áp dụng nguyên bản.

Main được kiểm tra thực tế, không giả định trống: trước/sau có 0 bản ghi trong các bảng nghiệp vụ/auth; `_prisma_migrations` tăng từ 2 lên 5. Không seed, không tạo user/ADMIN/product/order main. Cả values của cột cũ lẫn sequences cũ được so sánh và giữ nguyên.

## Backup, review và triển khai

- Backup mới: `.local/backups/aurel_ai_restore_test_20261021151158_7b754f.dump`; SHA256 `f08dac36e16756930c9f9c02c0ea86db2fc32679602b325e34f2be7b49910541`. Manifest `.dump.verified.json` xác nhận restore đầy đủ schema/data/sequences/indexes/constraints/triggers/functions/enums trước migrate.
- Restore cô lập đúng test role, fingerprint khớp nguồn. Tạo database drift cô lập từ hai SQL đã apply, so cấu trúc với main để phát hiện drift ngoài Prisma. Không có drift hoặc conflict checksum. Các database cô lập được giữ để review; không drop/reset main.
- Review lại nguyên văn ba SQL và đối chiếu SHA manifest: Multi-Currency thêm enum/prices/snapshots và mở rộng NUMERIC, không suy diễn legacy currency; Order Revision thêm revision/triggers/chặn write skew; Foundation thêm metadata/profile/rights/taxonomy/normalized uniqueness. Không DROP/TRUNCATE hoặc rewrite hàng cũ. Unique indexes có thể chặn khi legacy trùng; CHECK NOT VALID vẫn chặn writes mới. Preflight/rehearsal thành công trên snapshot thực tế.
- Chạy thử cả chuỗi trên restore; so cột cũ, sequences, cấu trúc với chain SQL độc lập và `prisma migrate diff --exit-code`. Nguồn không đổi trước khi apply main. Prisma CLI có lock timeout3s/statement timeout30s; lỗi bất kỳ dừng các bước sau.
- Main đã apply theo thứ tự `20261020160500_multi_currency`, `20261020170000_order_revision`, `20261021090000_product_foundation`. Prisma status/diff đạt; toàn bộ cấu trúc khớp kết quả rehearsal, cột cũ và sequences giữ nguyên.
- Runner một lần: `scripts/main-migration.ts <verified-restore-name> --confirm-main=aurel_ai`. Chỉ chấp nhận trạng thái main có đúng hai migration cũ; chạy lại sau thành công sẽ bị chặn. Không biến thành command web hoặc lệnh tự deploy tương lai.
- Evidence: `.local/backups/aurel_ai_restore_test_20261021151158_7b754f.main-migration.json`. Archive vẫn giữ nguyên và dùng cho phục hồi có kế hoạch; không tự restore đè main. Nếu có dữ liệu mới sau migration, cần backup mới và kế hoạch bảo toàn trước recovery.

## Routes và ranh giới quyền

- `/admin/products`: Explorer SSR với danh mục, collection, active/archived, tìm tên/code và phân trang25. Cây expand/collapse dùng details/summary, chỉ liệt kê sản phẩm của trang hiện tại. Sidebar tối đa200 nhóm, báo giới hạn; editor tìm category50/trang và luôn giữ category hiện tại. Không tạo subcategory vì schema chưa có.
- `/admin/products/new`: tạo sản phẩm; có form tạo Category thật để vận hành cả database ban đầu chưa có danh mục.
- `/admin/products/[id]`: xem và chỉnh sửa aggregate; archive/restore/xóa có xác nhận. Không cần route edit riêng.
- `/admin/products/import`: chọn tối đa6 CSV, preview từng bảng, lỗi dòng/field, xác nhận import; export6 CSV từ một snapshot100 sản phẩm/trang.
- `/api/admin/products`: GET list/get/export; POST save/category/category-search/status/remove-image/delete/preview/import. Không có bulk hard-delete.

Từng operation đi qua `createProductService.run`: Better Auth request session thật, kiểm tra expiry, đọc lại `User.role` từ PostgreSQL trong transaction Serializable. CUSTOMER, anonymous, role bị revoke đều bị chặn. Layout kiểm tra server trước khi render child UI; API kiểm tra độc lập, không dựa layout/ẩn nút. Trang ADMIN noindex/no-store/no-referrer; API lỗi sanitize, no-store, status401/403/400/404/409/503. Trang từ chối truy cập render thông báo với HTTP200 của App Router; không tuyên bố trang này trả403. API mới là ranh giới status401/403.

POST chỉ nhận JSON UTF-8, stream body tối đa2,5MB; allowlist payload, từ chối cross-origin/missing Origin theo BETTER_AUTH_URL. Không nhận role/userId/totals hoặc nested Prisma writes từ client. IDs của ảnh/biến thể phải thuộc parent được chỉnh sửa. Không có auth override/backdoor.

## CRUD, giá, ảnh và concurrency

`features/products/management.ts` mở rộng service hiện có, tái sử dụng validateData/profile/option/imageMetadata/money/dryRunImport. UI trong components/admin, composition trong lib/products và route/API riêng. Không thay header/hero/collection/PDP layout/CSS hoặc thêm dependency.

Form gồm code/name/giới tính/nhóm tuổi/category/collection/description/brand/status; URL tự sinh phía server khi tạo mới, giữ URL đã lưu khi sửa, toàn bộ descriptive options/AI taxonomy, các cặp variant color-size được khai báo, SKU/stock/active, VND/USD/EUR độc lập và metadata ảnh. Không nhân Cartesian variants, không tính giá bằng float, không backfill giá legacy. Legacy price được giữ trong DB và không được chỉnh sửa/xuất như giá bán đã xác minh.

Save aggregate dùng transaction. Version SHA256 của toàn bộ aggregate/category/children (server tạo và tính lại) cùng Serializable ngăn ghi đè dữ liệu cũ; stale snapshot/serialization/unique/FK trả409, không retry ngầm. Test hai save cùng version chỉ một winner. Giá để trống được xóa khỏi ProductPrice của variant tương ứng; variant đã lưu được deactivate, không xóa khi bỏ khỏi payload. Payload thiếu child cũ bị chặn, tránh silent data loss. Chuyển active/restore phải có code hợp lệ và ít nhất một variant active; stock0/missing price vẫn được mô tả trung thực.

Ảnh mới/ảnh thay reference chỉ nhận public raster `/images/...`, không upload provider mới. Existing private/unsupported reference được che trong DTO/export; UI yêu cầu thay reference public có chủ ý hoặc xóa metadata trước khi save aggregate. Có xóa metadata ảnh riêng theo parent/version; không xóa asset vật lý. Quyền website/embedding/training độc lập, granted cần rightsReference. Catalog/PDP **luôn lọc websitePermission=granted sau migration này**, không còn phụ thuộc cờ AI để tránh đưa ảnh chưa cấp quyền ra website. PRODUCT_FOUNDATION_ENABLED vẫn không sửa trong env và tiếp tục gate các tooling cũ; không gate quyền ảnh công khai nữa.

MULTI_CURRENCY_ENABLED vẫn unset, hiệu lực **false**, không sửa env. ADMIN đọc/ghi ProductPrice trên schema đã migrate độc lập với cờ trình bày storefront. Đã kiểm tra reader off không phát giá legacy/PDP; test on kiểm tra VND/USD/EUR, missing price và rights. **Cần quyết định bật cờ riêng sau review giá hàng thật và catalog/PDP**, không tự bật main trong phase này. Units Sold hiển thị unavailable vì chưa có đủ return/recognition policy.

## Permanent delete và audit

Chỉ ADMIN, product đã archive, code không null, phải nhập đúng Product Code và version hiện tại. Chặn nếu có OrderItem, CartItem, VirtualTryOnSession, Favorite hoặc AiRecommendation; FK là hàng rào bổ sung khi có race. Sản phẩm legacy thiếu code phải được gán code hợp lệ trước. Xóa metadata images/prices/profile/variants rồi product trong cùng transaction, không blind cascade, không xóa category hay asset vật lý.

Audit tại `.local/audit/product-deletions.jsonl`: append + fsync intent trước mutation, actorId/productId/code/operationId/database/time; audit lỗi thì rollback/fail closed. Sau transaction append committed/failed cùng operationId. Local file và PostgreSQL không có distributed transaction: nếu completion append lỗi sau commit, intent vẫn còn, API trả `auditCompletionRecorded=false` cùng deleted=true; Explorer báo cần đối chiếu audit; cần reconcile, không khẳng định rollback. Đây là audit vận hành **một máy/instance**, chưa phải immutable/tamper-proof/offsite audit production; cần durable volume/ACL/retention và audit tập trung trước nhiều instance. Không ghi session/cookie/password/secret.

## CSV

- Sáu templates Phase2.9.1 được reuse; `products.csv` bắt buộc, file khác tùy chọn. UTF-8 fatal decoding ở UI/API, BOM được hỗ trợ, exact headers kể cả header-only, malformed quoting/NUL/replacement character bị chặn.
- Tổng2MB CSV, 2.000 dòng và100 sản phẩm/gói; parser dừng ngay khi vượt row limit. Tối đa200 variants/100 images mỗi sản phẩm. Gói lớn hơn phải chia nhỏ; transaction timeout10s có thể yêu cầu gói nhỏ hơn trên máy chậm.
- Preview đọc baseline sống (codes/slugs/normalized SKU/categories), dùng dry-run cũ + validator aggregate chung, trả lỗi dòng/field, warnings, số dòng và20 dòng đầu mỗi bảng. Chưa ghi DB.
- Confirm gửi cùng nội dung và digest preview. Transaction đọc/validate lại baseline; gói bị đổi hoặc baseline không còn khớp trả409. Insert-only, duplicates không ghi đè; lỗi bất kỳ rollback toàn gói, không partial success. Client chặn double submit; nếu mất mạng, cần kiểm tra Explorer/preview lại trước retry.
- Export100 products/trang theo ID, sáu file từ một transaction snapshot và tải Blob từ kết quả chuẩn bị, tránh sáu downloads query lệch nhau. Không phải backup DB; đang export từng trang, không snapshot xuyên nhiều trang. Khi nhiều người đang sửa, dùng maintenance window nếu cần full export nhất quán.
- CSV cell được quote/escape và prefix apostrophe khi có formula prefix; import không tự bỏ apostrophe. Đây là biện pháp chống formula, không bảo đảm roundtrip byte-identical cho text bắt đầu bằng ký tự nguy hiểm.
- Legacy chưa có code được báo số bỏ qua; private image keys để trống, cần curate trước reimport. Sáu templates không gồm brand/legacy prices/IDs/auth/order/sales, nên export không thay thế backup hoặc exporter đầy đủ mọi cột. Category phải tồn tại, có thể tạo từ form trước import.

## Kiểm tra và nghiệm thu còn lại

- `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test`72/72, `npm.cmd run build` đạt.
- `npm.cmd run test:admin-products -- --confirm-test-database=aurel_ai_test`: bảy focused subtests (Node đếm8 gồm parent), authorization/validation/unique/IDOR/CAS concurrency/import/export/archive/restore/pricing/rights/delete/audit/CSRF/CSV. Main fingerprint unchanged, fixtures cleanup, không reset sequences.
- `npm.cmd run test:postgres -- --confirm-test-database=aurel_ai_test`: auth/product/pricing18 tests, concurrency41 tests, limited-writer probes và catalog3 tests đạt, fixtures cleanup và main không đổi. Không gửi email thật.
- `npm.cmd run test:catalog-db`:3 read-only tests trên main sau migration đạt, empty/error/unreachable/missing-config có fallback.
- `node --conditions=react-server --import tsx scripts/admin-http-smoke.ts --confirm-test-database=aurel_ai_test`: terminal HTTP với Next3352 production build + real Better Auth cookie/test DB/email tắt. API anonymous401/CUSTOMER403/ADMIN CRUD/CSV/revoked403/cross-origin rejection, bốn route SSR và PDP đạt. Test user/role chỉ tạo trong test, cleanup scoped; server tạm dừng. Report `.local/p292-http-smoke.json`.
- GET-only smoke main qua connection PostgreSQL default_transaction_read_only=on: home/products/search/cart/login/admin gate200, anonymous session=null, User/Product vẫn0. Server3353 đã đóng; report .local/p292-main-http-readonly.json. Không positive signin main vì chưa có tài khoản thật.
- Windows tsx trong sandbox gặp uv_os_get_passwd ENOMEM, chạy guarded DB runners ngoài sandbox đạt. pg concurrent-query deprecation hiện có vẫn còn. Không dùng browser/Computer Use/Test Screen/Playwright/screenshots; Visual QA = **Pending Manual Review**.

## Cấp quyền ADMIN — đã thực hiện theo chỉ định ngày2026-10-22

Ngày2026-10-22, chủ dự án đã chỉ định trực tiếp tài khoản hiện hữu đã verified; đã cấp đúng một ADMIN bằng Serializable transaction/row lock/conditional ID-email-role, affected row1, giữ verified/password/session. Audit intent/committed tại .local/audit/admin-provisioning.jsonl; hậu kiểm ADMIN/verified=true và anonymous API401. Không ghi email cá nhân vào docs hoặc tạo endpoint promote. Quy trình cho các lần cấp khác cần chỉ định riêng: chủ dự án đăng ký tài khoản thật qua Better Auth; xác minh chính xác email và ownership; DBA kiểm tra target main và user ID/email; trong transaction có điều kiện `id/email/role=CUSTOMER`, nâng đúng một user sang ADMIN bằng công cụ quản trị tin cậy; ghi audit cấp quyền và xác nhận affected row=1; kiểm tra lại bằng signed session thật. Không cung cấp endpoint promote, password mặc định hoặc sửa role từ browser. Có phương án thu hồi role tương tự và kiểm tra session cũ bị từ chối ngay.

Bước tiếp theo chính xác: chủ dự án mở /admin/products bằng tài khoản đã được cấp để review manual UI; sau đó nhập sản phẩm/giá/ảnh thật qua giao diện. Bật pricing và production role/audit/cutover là các quyết định riêng.
