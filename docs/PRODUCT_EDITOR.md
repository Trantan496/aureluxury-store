# Trình nhập sản phẩm AUREL — Step1

> Deployment 2026-10-23: Main aurel_ai: 9 reviewed migrations applied with owner approval; test: 11. PendingProduct is available; the two taxonomy migrations remain pending. No existing product data, sequences or .env changed.
## Complete the Look mới (2026-10-23)
Complete the Look thủ công đã code/test: nútThêm món trong Preview tạo PendingProduct blank/idempotent ngay; mỗi card ảnh+tên+giáVND/Lưu, formHoàn thiện chọncategory/variants thật→existingShowroom→explicitpublish. Queue /admin/products/pending phân trang20, source link; source-look hàngngang/pagination20/khôngcap4. Public chỉ linked child đãpublish/cópublicimage+price, archiveẩn; detach giữqueue/product, parent khôngunpublish/touch. YouMayAlsoLike bỏcategoryheuristic, Preview Chờ AI Recommendations/Productionẩn khiAIchưa có. Main aurel_ai: 9 reviewed migrations applied with owner approval; test: 11. PendingProduct is available; the two taxonomy migrations remain pending. No existing product data, sequences or .env changed. Chi tiếtAPI/files/schema/checks tại [COMPLETE_THE_LOOK.md](COMPLETE_THE_LOOK.md).


## Hiện tại — Product Showroom hai bước (2026-10-22)
- Step1 /admin/products/new hoặc /[id] chỉ nhập thông tin/taxonomy/variants/giá/tồn kho, giữ rich description; bỏ ảnh/summary/sidebar phải và các nút save, chỉ Tiếp theo #34251F. Backend prepare tạo/reuse internal unpublished draft, ID thật và idempotency ticket; back/edit dùng cùng ID/ảnh. Published edit có xác nhận unpublish.
- Step2 /admin/products/[id]/preview dùng cùng ProductDetailView/EditorialGallery với /products/[slug]: rail thumbnail, main4:5,3 editorial panels và thông tin sticky. Click slot upload; replace/remove/cover/role/order/library persist ngay vào ImageAsset + ProductImage, transaction/version/ownership, stale/failure giữ ảnh cũ. Không fake photos/ratings/prices/shipping.
- Save Draft/Save Product ở Step2, selector trạng thái mặc định unpublished; publish cần confirmation và variants/prices/public cover hợp lệ. Preview không tạo cart/order/stock mutation; checkout chưa triển khai nên purchase buttons disabled. Related sections chỉ active catalog thật và ẩn khi không có hàng phù hợp.
- **Main aurel_ai đã được owner phê duyệt và áp dụng riêng migration20261021120000_product_draft_requests: main8/test10**. Bảng idempotency đã sẵn sàng cho Tiếp theo → Showroom. Hai SQL taxonomy vẫn pending riêng; không apply kèm. Backup/verified restore mới aurel_ai_restore_test_20261022073329_9d848d, SHA587d3dbc2d2d8523954713dca6013bba7327a54f4ec3f5e3da64251f18f3b882; no-drift/rehearsal/old rows/sequences/env checks đạt, không fixture main. Report `.local/backups/aurel_ai_restore_test_20261022073329_9d848d.showroom-migration.json`.
- Checks: Prisma generate,92 unit/12 PostgreSQL tests gồm parent/3 Node SSR tests, lint/typecheck/build đạt. DB fixtures test cleanup/rollback, main read-only fingerprint/env unchanged. Backup/restore rehearsal aurel_ai_restore_test_20261022072134_fefd7f, SHA9b2eb4ad603ef91f263b9cb9bc37008bd4986756f3d6792526ecc09c562757a3, report .showroom-rehearsal.json noDrift/rehearsal/mainUnchanged=true. Không browser/Test Screen/Computer Use/Playwright/screenshot/HTTP QA hoặc email.
- Visual QA Pending Manual Review; persistence chứng minh qua connection Prisma mới/SSR reload data, không browser refresh thực tế. Báo cáo đầy đủ/files/routes/acceptance1–15/migration/limits tại PRODUCT_SHOWROOM.md. Next exact: owner manual QA luồng hai bước trên main; Prisma/Next đã reload sau migration được duyệt. Hai taxonomy SQL giữ pending.


Các rules code/taxonomy bên dưới được giữ; giao diện một bước/ảnh/preview trước đây đã được thay bằng PRODUCT_SHOWROOM.md. Lịch sử chi tiết ở SESSION_LOG.md.

## Quy tắc mã và concurrency

`product-code.ts` là pure helper dùng chung client/server. NFKD/bỏ dấu/đ→d, bỏ ký tự đặc biệt, ghép “sơ mi”; bỏ từ áo/the/và/cho/của. Tối đa4 token, từ điển nhỏ rõ ràng (`somi→SM`, `linen→L`, `oversized→OVS`, v.v.), token khác lấy3 chữ đầu; ghép SM+L thành SML. Ví dụ **Áo sơ mi linen oversized → AUR-SML-OVS-001**. Tên không có token ASCII dùng SP. Stem tối đa32 ký tự; suffix ít nhất3 chữ số.

Main chưa migrate: cùng tên được hash FNV-1a thành8 chữ số + counter4 chữ số, thỏa `AUR-[0-9]{4,12}`; không hiển thị mã viết tắt như thể đã lưu thành công. UI chỉ preview counter001/0001; mã thực tế có thể khác khi server cấp.

Server bỏ qua code client; existing code giữ nguyên khi đổi tên, legacy null được cấp khi save. New SKU được tạo từ mã chính thức+màu+size đã validate; ID child phải thuộc parent, SKU child cũ giữ nguyên. Map alias của SKU preview bảo toàn liên kết ảnh khi suffix server đổi. Alias mơ hồ bị từ chối. CSV vẫn là workflow explicit code/SKU có validation, không đổi contract nhập dữ liệu cũ.

Cấp code trong Serializable transaction với advisory transaction lock theo stem và unique index Product.productCode làm ràng buộc cuối. Chọn suffix trống1..9999; bounded retry tối đa4 lần cho create conflict/serialization, mỗi lần session/DB ADMIN được kiểm tra lại. Không retry edit. Existing aggregate version SHA256 tiếp tục chặn stale writes; code/slug/SKU unique, normalized color-size unique và FK vẫn là final guards. Suffix trống có thể được dùng lại sau hard-delete; không phải counter doanh thu hoặc order number. Archive không giải phóng mã.

## Hai migrations đề xuất — cần phê duyệt main riêng

1. `20261022160000_product_editor_registry`: TaxonomyOption(key,token,label,createdAt), PK ghép; mở rộng Product_code_format vẫn nhận mã số cũ. Thay11 profile CHECK taxonomy cố định bằng trigger validate builtin+registry, thêm trigger variant; reserved not-applicable chỉ cho profile. Registry append-only, không endpoint sửa/xóa. Constraints stock/uniqueness/FK/quyền ảnh giữ nguyên.
2. `20261022161000_product_editor_taxonomy_version`: cho phép cả taxonomy v1/v2, không rewrite bản ghi cũ. Capability check yêu cầu đủ cả registry và version constraintv2; partial deployment giữ compatibility mode.

Không cross-table CHECK vì pg_restore có thể nạp data trước referenced registry; dùng post-data triggers. Function security invoker/fixed search_path, revoke public execution; không sửa DB roles/grants/ownership. Runtime least-privilege deployment sau này phải review quyền gọi function và đọc registry riêng. Thêm taxonomy chỉ sau session/ADMIN/allowlist; nhãn2–80 ký tự, ít nhất2 chữ (size còn nhận số2–3 chữ số, ví dụ38), không control/HTML/repeated junk; token Unicode-normalized/case/accent-insensitive, tối đa60. Duplicate token/nhãn Việt sau chuẩn hóa bị từ chối, cả race còn unique PK/Serializable. Tổng custom options tối đa2000, không sinh lựa chọn hoặc hàng hóa giả.

SHA review LF:

| SQL | SHA256 |
| --- | --- |
| registry | `759f41ba8c170c3a9b627b38ae2fb64e09c03c08ea92fbb4a0a54369be341244` |
| version | `fd709e1a5b39b82e1f0a3f1a9273652c25040952fd2d34579a313ccbebe1551b` |

Test runner kiểm tra reviewed manifest, physical database/role, advisory lock, history/checksum (LF/CRLF cùng nội dung đã review), và chỉ deploy pending suffix của hai SQL này trên aurel_ai_test. Main connection default_transaction_read_only=on, có fingerprint/env hash và fixture cleanup/rollback. Không gọi seed/db push/reset.

Main apply là bước sau approval riêng: backup mới + verified restore, đối chiếu history/checksum/no drift và rehearsal cả hai SQL trước triển khai. Không chạy lại one-off main runner Phase2.9.2 vốn chỉ nhận lịch sử2 migrations. Generic db:migrate tiếp tục blocked. Không có pending main approval ngầm qua việc test thành công.

## CSV và ML

CSV sáu file giữ headers, preview/import dùng cùng registry snapshot sống, token confirmation gồm registry để không nhập trên vocab cũ. Main compatibility preview từ chối mã viết tắt trước khi ghi DB. Custom profile/color/size và mã viết tắt đã round-trip CSV trên test. Brand vẫn không có trong CSV contract cũ; CSV không phải full DB backup.

Feature export với registry mở rộng dùng `aurel-product-features-v2`/`aurel-fashion-v2`; JSON schema mới `data/templates/product-features-v2.schema.json` mô tả lexical token, runtime validator kiểm tra membership/NA-exclusive. Schema v1 cũ không bị nới lỏng. Report kèm taxonomyRegistry snapshot để downstream lưu cùng dataset. Export live vẫn cần PRODUCT_FOUNDATION_ENABLED vốn không đổi trong task. Missing là null/[]; not-applicable không bị coi là missing, không fake values/analytics.

Hai CLI offline nhận thêm đường dẫn registry JSON tùy chọn ở cuối, chỉ snapshot đã review, không query DB:

```powershell
npm.cmd run products:import:dry-run -- <bundle-directory> <baseline.json> <registry.json>
npm.cmd run products:features:export -- <sources.json> <output.jsonl> embedding <registry.json>
```

Không có registry thì giữ validator/v1 mặc định. Đừng dùng snapshot empty làm chứng cứ DB thật trống. Website/embedding/training rights và source/evidence checks cũ giữ nguyên.

## Files và kiểm chứng

- UI: components/admin/product-editor.tsx, product-sidebar.tsx, admin-header.tsx, admin-icon.tsx, product-explorer.tsx, product-transfer.tsx, admin-client.ts, products.module.css; layout/storefront-header.tsx và footer.tsx conditional chỉ admin; app/admin/products/layout.tsx,new/page.tsx,[id]/page.tsx.
- Logic/API: features/products/product-code.ts,editor-state.ts,taxonomy-labels.ts,taxonomy-registry.ts,foundation.ts,management.ts,product-service.ts,import-dry-run.ts,feature-export.ts; app/api/admin/products/route.ts.
- Schema/pipeline: prisma/schema.prisma, hai staged SQL trên, tests/support/reviewed-migrations.json, scripts/product-editor-check.ts,product-import-dry-run.ts,export-product-features.ts, data/templates/product-features-v2.schema.json và README, package.json. Không dependency mới.
- Tests: product-editor.test.ts (4 unit mới), product-editor.integration.test.ts (2 PostgreSQL mới); admin-products.integration.test.ts điều chỉnh assertion client-SKU theo contract server-authoritative, vẫn kiểm tra DB unique thật.
- Đã chạy Prisma generate; lint/typecheck/build đạt; npm test76/76. Guarded test:product-editor có7 subtests ADMIN cũ +2 mới đạt (Node đếm10 gồm parent). Main/env unchanged, test fixtures sạch, email tắt. Có pg query-queue deprecation đã tồn tại, không test failure. Lần kiểm tra checksum đầu dừng trước deploy vì manifest LF và SQL Windows CRLF; đã đối chiếu read-only actual bytes, runner chấp nhận đúng hai line endings của nội dung reviewed; không sửa lịch sử migration đã apply.

## Pending Manual Review

Hậu kiểm ban đầu (lịch sử trước audience): main5 migrations, capability helper trả extended=false và không query table staged. Next start đã nạp build mới, PID14308/TCP3000 listening; không HTTP/browser QA. Hai CLI offline đã chạy với header-only/empty sources và reviewed fixture registry: dry-run valid/writes0, feature export0/invalid0; không dùng kết quả empty như bằng chứng dữ liệu thật đầy đủ.

Chủ dự án mở /admin/products/new và một sản phẩm thật đã lưu: kiểm tra desktop1440/1280/tablet/mobile390/320, collapse sidebar, khoảng cách/serif/palette và bảng variants cuộn nội bộ; đối chiếu ảnh mẫu đã gửi trực tiếp trong hội thoại. Kiểm tra bàn phím/focus/modal/Escape/native invalid trong details, tiếng Việt và thông báo lỗi trùng slug/tổ hợp/giá. Kiểm tra copy/remove/deactivate và ảnh liên kết/primary/order/alt/rights, draft preview và ảnh lỗi. Kiểm tra dirty link/reload/close/back/forward trên trình duyệt thực tế, save success/conflict/tải lại với signed ADMIN session thật. Main chưa thể thêm custom taxonomy/mã viết tắt trước approval/deploy. Chưa có visual QA, positive browser-session QA hoặc upload provider; không tuyên bố pixel match. UI không sao chép ảnh áo, collection mẫu hoặc số đếm từ reference; bell chưa backend disabled, chỉ status active/archive có dữ liệu hỗ trợ, không fake dashboard/trash/bulk-generate variants. Giới hạn ảnh100 và mô tả10000 giữ contract cũ thay vì tự giảm8/2000 theo chữ trên hình.

## Dynamic Variants — 2026-10-23
Nút Bổ sung tổ hợp màu × size thêm hàng thiếu trong draft, giữ ID/giá cũ; stock0/chưa giá/inactive cho hàng mới. Chỉ lưu qua Tiếp theo hiện có. ADMIN variant-expand hỗ trợ HEX khi schema sẵn sàng, yêu cầu draft/version; Demo không gọi API. Xem [DYNAMIC_VARIANTS.md](DYNAMIC_VARIANTS.md).

## Danh mục Nam/Nữ và bộ sưu tập — 2026-10-23
Thay dropdown danh mục bằng CategoryPicker lưới icon theo gender; giữ custom +/search/select legacy/required validation. Chọn preset reuse hoặc tạo Category qua category-select, không tự lưu Product. Đổi gender giữ categoryId hiện tại; UI busy/lỗi giữ dữ liệu. Bộ sưu tập vẫn trường slug riêng và gợi ý đã lưu, sidebar bung theo collection. Không migrate hoặc reclassify dữ liệu cũ. Xem [CATEGORIES_AND_COLLECTIONS.md](CATEGORIES_AND_COLLECTIONS.md).
