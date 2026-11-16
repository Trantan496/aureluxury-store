# Mẫu dữ liệu thật — Phase 2.9.1 / 2.9.3

## Ảnh DB upload (2026-10-22)
product_images.storage_key nay có thể trỏ /images/uploads/{uuid}.webp. CSV vẫn chỉ metadata, không chứa binary: import reference này đòi hỏi ImageAsset tồn tại trên DB đích; không thể chuyển ảnh giữa databases chỉ bằng CSV. Backup/restore PostgreSQL mới mang theo binary. Xem docs/IMAGE_STORAGE.md.


## Cập nhật audience (2026-10-22)
product_ai_attributes.csv có cột age_group tùy chọn cuối header; CLI/dry-run/import vẫn nhận đúng header cũ thiếu cột này. Token: gen-alpha, gen-z, gen-y, gen-x, middle-aged, older-adults, children, teenagers, all-ages; rỗng là chưa khai báo, không tự gán nhóm. Gender vẫn ở product_options.csv. CSV vẫn dùng slug explicit theo contract import; editor tự sinh URL riêng.
product-features-v3.schema.json có age_group nullable; nguồn có thuộc tính ageGroup xuất v3, nguồn cũ không có thuộc tính vẫn v1/v2. Taxonomy version vẫn v1/v2 độc lập. Main đã có audience nhưng hai SQL registry vẫn pending. Xem docs/PRODUCT_AUDIENCE.md.


Phase2.9.2: ADMIN có thể upload các CSV này tại /admin/products/import, preview từng bảng và xác nhận atomic insert-only import; hoặc dùng form để quản lý hàng ngày. PostgreSQL là source of truth. CLI dry-run vẫn chỉ kiểm tra offline. UI export6 CSV theo trang; limits/formula protection/legacy-private-reference caveats tại docs/ADMIN_PRODUCTS.md.


Sáu CSV chỉ có header, không chứa hàng hóa hay số liệu giả. UTF-8, dấu phẩy, quote theo CSV; boolean bắt buộc `true`/`false`, không dùng 1/0. Ô trống mô tả là NULL, tag trống là []; không ghi `N/A`, `other` hoặc giá trị giả. Sau hai SQL Phase2.9.3 dùng token `not-applicable` riêng khi không áp dụng; null/[] vẫn là chưa khai báo, tag not-applicable không ghép với tag khác. `other` chỉ là loại ảnh thực sự chưa phân nhóm.

| File | Bắt buộc trong mỗi dòng | Tùy chọn |
| --- | --- | --- |
| products.csv | product_code, name, slug, category_slug, is_active | collection, description |
| product_options.csv | product_code | collar, fabric, gender, fit |
| product_variants.csv | product_code, sku, color, size, stock, is_active | Không có |
| product_prices.csv | sku, currency, amount | Không có; thiếu currency nghĩa là chưa có giá |
| product_images.csv | product_code, storage_key, sort_order, is_primary, website_permission, embedding_permission, training_permission | sku, alt_text, image_type, source_reference, rights_reference (bắt buộc nếu grant bất kỳ quyền nào) |
| product_ai_attributes.csv | product_code | garment_type, style_tags, season_tags, occasion_tags, layer_role, pattern, silhouette |

Giữ toàn bộ cột header dù dữ liệu tùy chọn trống. Category phải tồn tại trong snapshot; SKU ảnh phải thuộc đúng product. Chỉ tạo dòng variant được bán thật. Main hiện nhận Product Code `AUR-` + 4–12 chữ số; test sau2 SQL Phase2.9.3 còn nhận dạng `AUR-SML-OVS-001`. Slug lowercase-hyphen. SKU uppercase chữ/số và dấu gạch nối, normalize trước so trùng. Stock/sort là số nguyên không âm. Giá chuỗi chính xác: VND nguyên, USD/EUR tối đa 2 số lẻ; không ký hiệu tiền/ngăn cách hàng nghìn/FX. Không có cột legacy price, units sold, order count hoặc views.

Options nhận label như `Round Neck`, `Regular Fit`, `Black`, `m`, chuẩn hóa thành `round-neck`, `regular-fit`, `black`, `M`. Danh sách chuẩn tại `src/features/products/foundation.ts`; sau hai SQL Phase2.9.3 giá trị custom được ADMIN thêm vào registry dùng chung trước khi nhập; main hiện chưa apply. Offline CLI nhận optional registry.json ở cuối lệnh, không tự query DB. Tags ngăn bằng `|`, ví dụ `classic|minimal`; không lặp. Sáu file là bundle insert-only cho sản phẩm mới, không phải patch dữ liệu hiện hữu.

Quyền ảnh chỉ `unknown`, `granted`, `denied`; không mặc định grant. `rights_reference` là mã hồ sơ chứng minh quyền đã được review, không phải secret hoặc URL ký. `source_reference` là mã nguồn gốc không chứa dữ liệu cá nhân. Export AI còn yêu cầu nguồn gốc, public resolver và quyền đúng purpose; quyền training không suy ra từ embedding hoặc website. Không mở private storage.

Dry-run offline, không kết nối DB và không ghi dữ liệu:

```powershell
npm.cmd run products:import:dry-run -- data/templates data/templates/import-baseline.empty.json
```

Khi có hàng thật: copy bundle sang thư mục riêng; cung cấp snapshot hiện hành `productCodes`, `slugs`, `skus`, `categorySlugs`. File `import-baseline.empty.json` chỉ phù hợp bundle rỗng, không phải bằng chứng database thực tế rỗng. Report có table/row/field; row là số bản ghi CSV tính cả header (không phải dòng vật lý khi quote chứa xuống dòng). Parse/header lỗi dừng file và không có mutation. Header-only bundle hợp lệ; thiếu Options được cảnh báo để curate. CLI kiểm tra theo snapshot, cần xác minh lại trong transaction và DB unique khi xây importer thật. Chưa có write importer/auto import hoặc ADMIN endpoint.

Xuất JSONL offline từ snapshot FeatureSource đã được review:

```powershell
npm.cmd run products:features:export -- data/templates/feature-source.empty.json .local/features.jsonl embedding
```

Không overwrite file đã có. Output JSONL và `.report.json` có tổng số, lỗi theo record, fields thiếu; dataset rỗng là file 0 byte và report exported=0. `training` là purpose riêng, không train model. `FeatureSource` contract ở `feature-export.ts`, đọc qua ADMIN `exportFeatures` khi migration/flag được duyệt; không cần xuất user/order/SKU/raw storage keys sang feature JSONL. Schema output tại `product-features.schema.json` và mapping tại `docs/PRODUCT_FOUNDATION.md`.

Feature schema v2: product-features-v2.schema.json cho extended vocabulary; v1 cũ giữ nguyên. Export report có taxonomyRegistry snapshot, cần lưu cùng JSONL và validate membership bằng runtime validators; schema v2 chỉ kiểm tra lexical. CLI export nhận optional registry.json sau purpose, dry-run nhận optional registry.json sau baseline. Main chưa bật PRODUCT_FOUNDATION_ENABLED hoặc apply hai SQL mới. Xem docs/PRODUCT_EDITOR.md cho status/SHA/test/manual QA.
