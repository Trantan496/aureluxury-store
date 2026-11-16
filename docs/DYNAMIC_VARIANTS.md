# Dynamic Product Variants — 2026-10-23

## Phạm vi và trạng thái

Đã triển khai trên shared Product Detail: nút `+` nhỏ cạnh COLOUR và SIZE chỉ trong Preview/Demo. Dialog màu nhận tên, HEX và xem trước; size nhận tên tùy chỉnh. Các lựa chọn mới chỉ nằm trong local state, không gửi request ghi DB, không được lưu bởi nút Xuất bản và mất khi tải lại/reset Demo. Production không có controls này.

Theo lựa chọn chủ dự án, mọi tổ hợp mới có stock **0**, **chưa có giá**, **isActive=false**. Không sao chép giá hoặc tạo Product độc lập. Ma trận bổ sung tổ hợp thiếu, tính cả biến thể inactive là đã tồn tại; giới hạn an toàn 40 lựa chọn mỗi trục và 200 biến thể mỗi Product. 3 màu × 3 size tạo tổng cộng 9 biến thể. Đây là giới hạn validation hiện có, không phải giới hạn số món outfit.

Ảnh ưu tiên liên kết variantId, sau đó cùng màu rồi cover thật; giá, tồn kho và trạng thái theo biến thể được chọn. Chọn ảnh thủ công vẫn hoạt động trong biến thể hiện tại. Nút mua tiếp tục disabled vì backend cart/checkout chưa có; data-variant-id là điểm tích hợp, không phải checkout hoạt động.

## Identity, SKU và lưu thật

Tái sử dụng ProductVariant và unique `(productId,color,size)` hiện có. Các canonical token color/size đóng vai trò identity màu/size; không thêm bảng hoặc colorId/sizeId song song. SKU unique toàn hệ thống, giữ SKU của hàng đã tồn tại; SKU tự tạo thêm hậu tố `-V1`… khi chuỗi tổ hợp bị va chạm. Unicode/case được chuẩn hóa trước so trùng.

Admin Product Editor có nút **Bổ sung tổ hợp màu × size**: giữ hàng/ID/giá hiện hữu, bổ sung hàng local an toàn; chỉ lưu qua luồng Tiếp theo → Showroom → Xuất bản hiện có. Tên màu và HEX mới có thể lưu qua operation ADMIN bên dưới, sẵn sàng cho tích hợp editor sâu hơn. Preview Demo không gọi operation này.

`POST /api/admin/products`, operation `variant-expand`:

```json
{
  "operation": "variant-expand",
  "id": 123,
  "version": "<version hiện tại từ server>",
  "input": {
    "colors": [{"name": "Xanh rêu", "hex": "#778855"}],
    "sizes": ["XS", "L"]
  }
}
```

Ví dụ hợp đồng API, không phải dữ liệu seed. Cả hai arrays bắt buộc, ít nhất một không rỗng. API hợp nhất với các trục đang có và trả DTO, variantColors, created. ADMIN được kiểm tra server-side; giữ origin/body limit/version/Serializable transaction. Published Product bị từ chối với draftRequired; không tự unpublish. Lặp với version mới không tạo trùng; version cũ trả conflict. Lỗi đăng ký màu/tạo biến thể rollback cả transaction. Existing save quản lý giá, stock và disable; biến thể đã liên kết OrderItem được giữ, FK ngăn xóa cứng.

HEX lưu tại TaxonomyOption hiện có. Registry append-only: cùng token/cùng HEX được dùng lại, HEX khác hoặc hàng legacy chưa có HEX không bị ghi đè âm thầm; chọn tên màu mới. Label/token được hợp nhất để tránh lặp built-in option. Loader kiểm tra capability trước khi đọc HEX, main chưa có cột vẫn dùng fallback palette.

## Schema và triển khai

- Migration mới: `prisma/migrations/20261023150000_variant_colour_hex/migration.sql`.
- Thêm TaxonomyOption.hex nullable; CHECK chỉ color nhận HEX uppercase #RRGGBB. Size cho phép nhãn một ký tự, các nhãn khác giữ minimum hai ký tự. Giữ append-only trigger.
- SHA-256 của SQL chuẩn hóa LF: `079beffd1a745e7a8d14b832175cb77d8f033665d48d633158028c2e3440106f`.
- Phụ thuộc hai migration taxonomy `20261022160000_product_editor_registry` và `20261022161000_product_editor_taxonomy_version` đang pending trên main. Không thể scoped-apply HEX độc lập khi chưa có bảng registry.
- Main aurel_ai giữ **9** migrations; DB test riêng có **12**. Không migration hoặc ghi dữ liệu lên main; .env giữ nguyên. Chưa thực hiện backup/restore rehearsal cho bộ migration taxonomy + HEX trong task này.
- Trước main: review cả chuỗi phụ thuộc, backup/verified restore và rehearsal mới, kiểm tra dữ liệu, rồi xin phê duyệt cụ thể. Không chạy migrate deploy hàng loạt.

## Kiểm tra đã chạy

- Prisma generate, lint, typecheck: exit 0.
- npm test: **101/101**.
- test:product-editor với confirm-test-database=aurel_ai_test: **14/14**, main readonly fingerprint và .env không đổi.
- test:showroom-ui: **11/11**, gồm Preview-only controls, Production không controls Demo, HEX thật, selected variant/price/image và empty Preview.
- Build: retry exit 0; lần đầu dừng sau compile/routes bởi cảnh báo bảo mật Next 16.4.0 hiện hữu. Cảnh báo chưa xử lý, không nâng dependencies trong task.

Unit/backend kiểm tra ma trận, duplicate, SKU va chạm, mặc định, retry/version, ADMIN, rollback lỗi tạo, ảnh/giá thực, published gate và giữ biến thể đã có OrderItem. Tests dùng DB riêng với transaction rollback/savepoint.

Lần test đầu đã phát hiện upsert đụng append-only trigger; service được sửa thành reuse hoặc create, không UPDATE registry. Cleanup kiểu delete cũng không phù hợp append-only: test được đổi sang outer rollback. Hai option matrix-* và hai user @test.invalid do test lỗi để lại đã được dọn trên đúng DB test, sau xác minh mọi bảng ứng dụng khác rỗng và toàn bộ rows là fixture của lần chạy. Cleanup có transaction/advisory lock, đối chiếu guards/schema không đổi; không tắt trigger và không chạm main. Full suite sau đó đạt 14/14 và không để lại fixture.

Không chạy browser visual tests hoặc HTTP visual QA. **Visual QA: Pending Manual Review**. SSR không thay thế kiểm tra thao tác dialog/focus thực tế trên thiết bị.

## Đường dẫn chính và bước tiếp theo

Logic: features/products/variant-matrix.ts, variant-management.ts, variant-colours.ts; API hiện có app/api/admin/products/route.ts. UI: components/products/product-detail-view.tsx, variant-option-dialog.tsx, editorial-gallery.tsx và product-detail.module.css. Editor: components/admin/product-editor.tsx, features/products/editor-state.ts. Metadata: catalog loaders, showroom-model và product-showroom.

Bước tiếp: manual review Demo/selection/keyboard/mobile; chuẩn bị rehearsal và approval cho chuỗi taxonomy + HEX trước khi bật lưu màu HEX mới trên main. Không thay gallery63vh, panels37,5/25/37,5, navbar, Complete the Look hoặc purchase backend.
