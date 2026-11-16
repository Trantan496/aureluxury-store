# Danh mục theo giới tính và cây bộ sưu tập — 2026-10-23

## Hành vi đã triển khai

Admin chọn giới tính ở trường Giới tính – Độ tuổi hiện có, sau đó mở Danh mục. Nam/Nữ nhận danh sách loại trang phục tương ứng mẫu; chưa chọn hoặc Unisex nhận hợp các loại. Giữ Unisex và nhóm tuổi hiện có, không sửa dữ liệu giới tính cũ.

Danh mục trình bày bằng lưới icon SVG nét mảnh tự vẽ, tên và selected state. Có Áo Thun, Sơ Mi, Khoác, Polo (Nam), Tank Top/Đầm/Chân Váy (Nữ), các loại quần, áo Vest/Nỉ/Len, đồ lót/phụ kiện. Không sao chép logo hoặc trích icon mờ từ screenshot. Các tên chiến dịch/merchandising như Office Wear, Easy Buy, Ưu đãi, Bán chạy không tự trở thành loại trang phục hoặc bộ sưu tập có dữ liệu giả.

Chọn loại đã có dùng lại ID thật; loại chưa có được tạo khi ADMIN bấm chọn, không seed khi tải trang. Nút + vẫn cho tạo danh mục tùy chỉnh; tìm kiếm và select danh mục đã lưu vẫn có để phục vụ dữ liệu legacy. Đổi giới tính chỉ thay nhóm gợi ý, không tự xóa categoryId đang chọn. Danh mục dùng chung giữa Nam/Nữ; giới tính vẫn lưu ở ProductProfile, không nhân đôi Category theo giới tính.

Sidebar Admin dùng **Bộ sưu tập → Xem tất cả → sản phẩm**. Cây lấy Product.collection thật; danh mục chuyển vào mục Tra cứu danh mục thu gọn. Danh sách sản phẩm dưới cây là các hàng có sẵn trong snapshot navigation (25 sản phẩm gần nhất); Xem tất cả mở danh sách phân trang lọc đúng collection. Không coi snapshot này là toàn bộ thành viên.

Form giữ hai trường riêng: Danh mục bắt buộc và Bộ sưu tập tùy chọn. Bộ sưu tập dùng slug hiện có, có gợi ý từ dữ liệu đã lưu; một bộ sưu tập chứa nhiều sản phẩm, mỗi sản phẩm hiện thuộc tối đa một bộ sưu tập. Không thêm lifecycle/CRUD bảng Collection hoặc nhiều-nhiều ngoài yêu cầu hiện tại. Nhóm chưa gán sản phẩm sẽ chưa xuất hiện. Không tự chuyển Category cũ tên COLLECTIONS/AUREL/WOMEN thành bộ sưu tập; cần chủ dự án gán lại có chủ đích.

## Code và API

- `features/products/category-options.ts`: loại trang phục, giới tính, icon key, matching slug/tên chuẩn hóa và label bộ sưu tập.
- `components/admin/category-picker.tsx`, `clothing-icon.tsx`: selector có lưới, select required cho validation, thao tác bàn phím native, busy/error giữ lựa chọn cũ, SVG decorative aria-hidden.
- `product-editor.tsx`: ghép selector vào form hiện có; cả DB rỗng vẫn chọn danh mục đầu tiên được, không khóa Tiếp theo chỉ vì chưa có danh mục.
- `product-sidebar.tsx`: cây bộ sưu tập từ dữ liệu thật, link tra cứu danh mục riêng.
- `products.module.css`: categoryPicker/categoryPalette/categoryTiles/existingCategory/categoryNavigation/collectionSummary. Grid3 cột, <=600px2 cột; button58px, border chọn mảnh, focus outline, reduced-motion. Căn nút +42px không kéo dài theo panel mở.
- `management.ts`: managementSelectCategory, `POST /api/admin/products` operation **category-select**, input `{ "slug": "ao-thun" }`. Chỉ slug preset allowlist; reuse category theo slug/tên, upsert slug để không tạo trùng khi lặp. Service run giữ session/DB ADMIN/transaction, route giữ origin/body limit. Không đổi Product hoặc tạo sản phẩm khi chọn danh mục. Không yêu cầu Product version cho thao tác chỉ tạo/reuse Category riêng biệt.

Không migration, không đổi Prisma schema, không main write/.env change bởi agent. Không thay storefront navbar/gallery/variants/Complete the Look hoặc purchase workflow. Collection field/filter hiện có được tái sử dụng, không đổi public routes/module dữ liệu.

## Kiểm tra và giới hạn

- `npm test`: 102/102.
- `npm run test:product-editor -- --confirm-test-database=aurel_ai_test`: 14/14; kiểm tra category-select anonymous/customer/invalid slug/retry cùng ID, không tạo Product. Fixtures rollback, main readonly fingerprint/.env unchanged.
- `npm run test:showroom-ui`: 13/13; Nam/Nữ, legacy selection, DB rỗng và sidebar theo collection. Lần đầu SSR bị Windows sandbox uv_os_get_passwd ENOMEM; chạy ngoài sandbox đạt.
- Lint, typecheck: exit0. Build đầu compile/routes xong rồi dừng do Next16.4.0 SecurityFatalError hiện hữu; retry exit0. Chưa nâng dependencies, cảnh báo bảo mật vẫn còn.

Không browser visual tests. **Visual QA: Pending Manual Review**. Tiếp theo: owner mở form, chọn Nam/Nữ, chọn/tạo danh mục, gán slug bộ sưu tập và lưu qua Tiếp theo; kiểm tra desktop/mobile, focus/required validation và cây sau refresh. Dữ liệu legacy được giữ nguyên để phân loại lại thủ công.
