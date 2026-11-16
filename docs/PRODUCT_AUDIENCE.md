# Giới tính, nhóm tuổi và URL sản phẩm — 2026-10-22

Đã triển khai theo yêu cầu thay ô Đường dẫn bằng Giới tính – Độ tuổi và cập nhật database chính. Database thực tế là PostgreSQL aurel_ai, không có SQLite main.db.

## Hành vi
- Dùng lại ProductProfile.gender; chuyển lựa chọn từ phần2 lên phần1, không tạo cột trùng. Nhóm tuổi lưu ProductProfile.ageGroup nullable.
- Các nhãn được chọn thủ công: Gen Alpha (gen-alpha), Gen Z (gen-z), Gen Y (gen-y), Gen X (gen-x), Trung niên (middle-aged), Cao tuổi (older-adults), Trẻ em (children), Thanh thiếu niên (teenagers), Mọi độ tuổi (all-ages). Đây là nhãn merchandising có thể giao nhau về khái niệm, không ranh giới tuổi/năm sinh. Trống là NULL; không phân loại tự động sản phẩm cũ.
- Editor tạo mới: server chuẩn hóa tên + giới tính + nhãn nhóm tuổi thành slug; kiểm tra unique, advisory transaction lock theo base và hậu tố -2/-3… khi cần. Client chỉ preview, slug client gửi không quyết định kết quả. Serializable/create retry cũ vẫn áp dụng.
- Editor sửa: giữ URL đã lưu dù đổi tên/giới tính/nhóm tuổi; tránh phá liên kết. Omit ageGroup giữ giá trị cũ, explicit NULL xóa. Server allowlist và SQL CHECK chặn token lạ. Không đổi code/SKU cũ.
- CSV sáu bảng giữ contract slug explicit cho import insert-only. Bảng AI thêm age_group tùy chọn; nhận đúng cả header cũ và mới. Feature export khi nguồn có ageGroup dùng aurel-product-features-v3; schema cũ giữ nguyên cho nguồn không có thuộc tính. age_group null ghi nhận missing, không suy đoán.

## Migration main đã thực hiện
- 20261021100000_product_audience: thêm cột TEXT nullable và CHECK9 token, không UPDATE/default/backfill. SHA256 normalized LF: 558fc0cdd18c967c76c4e9267d92c6b4669a14e1126d5e767890935ee065ea61. Tên sắp sau foundation và trước hai taxonomy SQL chưa duyệt; không sửa SQL đã apply.
- Main6/8 migration nguồn; aurel_ai_test8/8. 20261022160000_product_editor_registry và 20261022161000_product_editor_taxonomy_version vẫn pending main; không triển khai ngầm cùng audience. Main custom taxonomy/mã viết tắt vẫn chưa bật.
- Backup .local/backups/aurel_ai_restore_test_20261022015716_a64507.dump; SHA256 99bde432c9a5f64eeb427c7088c789e93496389ca7738e174fe2d1691cc2a6cc. Verified manifest cùng tên .dump.verified.json; báo cáo deploy cùng prefix .audience-migration.json. Đây là evidence local chứa metadata, không commit backup.
- Runner scripts/main-audience-migration.ts yêu cầu restore DB đã xác minh và --confirm-main=aurel_ai. Kiểm tra exact target/history/checksums/backup SHA/main fingerprint; dựng drift DB từ SQL độc lập, so schema; scoped Prisma migrate deploy trên restore trước main; hậu kiểm old-column row digests/sequences/schema/history/.env. Không chỉnh trực tiếp lịch sử Prisma, không chạy generic db:migrate vào toàn bộ migrations.
- Kết quả noDrift/rehearsalPassed/originalRowsPreserved/originalSequencesPreserved/envUnchanged=true; ageGroupNullable=true, inferredAgeGroups=0. Không thay user/role/URL/sản phẩm cũ hoặc env/security. Runner one-off yêu cầu history5 trước apply, không dùng để apply lặp trên main6.

## File thay đổi
- Prisma: prisma/schema.prisma; prisma/migrations/20261021100000_product_audience/migration.sql; tests/support/reviewed-migrations.json.
- Logic: src/features/products/{audience,editor-state,management,import-dry-run,feature-export,product-service}.ts.
- UI: src/components/admin/product-editor.tsx, products.module.css, admin-client.ts (nhãn lỗi ageGroup).
- CSV/ML: scripts/product-import-dry-run.ts; data/templates/product_ai_attributes.csv, product-features-v3.schema.json, README.md.
- Kiểm thử/công cụ: tests/product-audience.test.ts, admin-products.integration.test.ts, product-editor.integration.test.ts; scripts/product-editor-check.ts, main-audience-migration.ts; package.json. Prisma client generated được tái tạo, không dependency mới.
- Tài liệu: PRODUCT_AUDIENCE, PROJECT_CONTEXT, ARCHITECTURE, ROADMAP, SESSION_LOG, DECISIONS, PRODUCT_EDITOR, ADMIN_PRODUCTS, PRODUCT_FOUNDATION, DESIGN_SYSTEM.

## Kiểm tra thực chạy và giới hạn
- Prisma generate thành công; npm.cmd test84/84; npm.cmd run test:product-editor -- --confirm-test-database=aurel_ai_test10/10 gồm parent. Fixtures chỉ test, cleanup/rollback; main fingerprint/.env unchanged trong bộ test. Cảnh báo pg query-queue deprecation hiện có không làm fail.
- npm.cmd run lint, npm.cmd run typecheck, npm.cmd run build đều đạt. Backup/verified restore + runner main rehearsal/apply đạt; Prisma đọc main gender/ageGroup thành công sau apply.
- Restart đúng Next dev workspace để nạp Prisma singleton: launcher7976, listener9176/TCP3000. PostgreSQL/Studio không restart; không HTTP/browser/Test Screen/Computer Use/Playwright/screenshots hoặc email.
- Visual QA **Pending Manual Review**. Chủ dự án refresh /admin/products/new: kiểm tra hai select/keyboard/mobile/placeholder; tạo sản phẩm thật với tên và nhóm đối tượng, kiểm tra URL lưu thực tế; save/reload gender/ageGroup; sửa tên/nhóm trên sản phẩm cũ xác nhận URL ổn định; kiểm tra preview, NULL và CSV cũ/mới nếu dùng import. Không dùng test/build để tuyên bố pixel-match.
