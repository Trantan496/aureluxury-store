# Product Data Service — Phase 2.2

## Trạng thái cập nhật Phase2.9.2 (2026-10-21)
Main local aurel_ai đã apply đủ5 migrations, không còn pending; ba SQL staging được chủ dự án cho phép sau backup/restore/no-drift/rehearsal đạt. Không seed/main fixtures hoặc thay secrets/roles/table grants/ownership. ADMIN Product Management đã có tại /admin/products, nhưng main0 ADMIN và provisioning cần approval riêng. MULTI_CURRENCY_ENABLED vẫn hiệu lực false; public catalog/PDP luôn lọc websitePermission=granted từ schema đã deploy, độc lập cờ AI. Production role/cutover/audit/offsite backup chưa GO. Xem [ADMIN_PRODUCTS.md](ADMIN_PRODUCTS.md) cho evidence/routes/tests/limits. Các mô tả staged/main pending bên dưới là lịch sử trước Phase2.9.2.


Ngày: 2026-10-20. Phase 2.3 đã nối Better Auth, xem AUTHENTICATION.md. Không có Admin UI/product mutation API hoặc thay dữ liệu/UI. Schema auth mở rộng bằng migration riêng đã review, không đổi model nghiệp vụ.

## Product Foundation — Phase 2.9.1

Schema repo thêm ProductProfile/ProductCode/collection/image rights trong migration staged, chưa main. API server-only thêm setFoundation(productId, {productCode, collection?, options}), setImageMetadata(productId, imageId, patch, variantId?) và exportFeatures({page?, pageSize?, purpose?}); cùng session/ADMIN/Serializable guard hiện có, gated PRODUCT_FOUNDATION_ENABLED mặc định false. Profile setter thay toàn bộ Options/AI metadata; image setter patch, variantId omit giữ nguyên/NULL bỏ liên kết. Không thay contract CRUD cũ; new foundation fields không mass-assign qua generic CRUD. Chi tiết taxonomy/FK/validation/ML/CSV/analytics/approval tại [PRODUCT_FOUNDATION.md](PRODUCT_FOUNDATION.md).

Khi foundation bật mới normalize color/size/SKU ở generic create/update variant và lọc ảnh public theo quyền website; khi tắt giữ query/main compatibility. ProductCode chưa tự sinh cho legacy/generic CRUD, workflow quản trị phải gán trước xuất bản. Chưa write importer/Admin UI/public mutation API. Chỉ test DB được migrate, main còn ba SQL pending.

## Tiền tệ — cập nhật Phase 2.5

Phase2.5.1 đã khắc phục lỗi order write skew bằng revision header và migration riêng, tests nhiều isolation/ordinary writer đạt. Main vẫn NO-GO chưa approval riêng; xem ORDER_CONCURRENCY_REMEDIATION.md. Product Service không auto-retry, không nhận revision, chưa order-write service/public endpoint.

ProductPrice hỗ trợ giá VND/USD/EUR độc lập qua setPrice/getPrice/listPrices/removePrice với cùng DB ADMIN/session guard. Catalog chọn currency, thiếu giá trả null/missing, không fallback. Snapshot đơn được kiểm bởi app và PostgreSQL. Migration mới chỉ deploy test, chưa aurel_ai; MULTI_CURRENCY_ENABLED mặc định false. Xem [MULTI_CURRENCY.md](MULTI_CURRENCY.md) cho thiết kế, API, SQL và approval gate.

### Hiện trạng legacy trước Phase 2.5

Đoạn sau ghi lại cơ sở quyết định từ Phase 2.2; schema code mới và trạng thái deployment được mô tả ở trên.

`ProductVariant.price`, `Order.totalAmount`, `OrderItem.unitPrice` đang là Decimal(12,2), không có currency. Giá chỉ là số thập phân chưa xác định đơn vị, không đủ để suy ra VND/EUR từ giao diện hoặc seed. Service nhận giá dạng chuỗi chính xác, không nhận number, không làm tròn ngầm, không tự đổi tiền. Ví dụ cấu trúc hợp lệ là chuỗi số thập phân tối đa 10 chữ số nguyên và 2 chữ số lẻ; giá âm, exponent, NaN, overflow bị từ chối. Currency đầu vào bị từ chối vì schema chưa có nơi lưu, tránh xác nhận ghi thành công nhưng làm mất currency.

Đề xuất cho giai đoạn migration tiền tệ, **chưa áp dụng**:

1. Lưu mã ISO 4217 (3 ký tự) có kiểm tra danh sách currency được hỗ trợ, cùng metadata số chữ số thập phân. Không chỉ kiểm tra regex ba chữ cái. ISO có các minor unit khác nhau; tham chiếu [ISO 4217](https://www.iso.org/iso-4217-currency-codes.html) và [SIX — cơ quan duy trì mã](https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html).
2. Thêm `currencyCode` nullable vào từng giá biến thể trước; lưu snapshot currency trên Order/OrderItem. Bắt buộc một currency cho một order, không cộng các currency khác nhau. Không dùng biến môi trường để diễn giải lại lịch sử giá.
3. Giữ Decimal và chuỗi ở ranh giới JSON. Nếu hỗ trợ currency có hơn 2 chữ số lẻ, thiết kế lại precision/scale cùng giới hạn tổng tiền (ví dụ Decimal(19,4) sau khi chọn tập currency hỗ trợ); validate đúng minor unit, không round âm thầm. Decimal(12,2) hiện tại chưa hỗ trợ đầy đủ mọi currency. Không chọn scale mới chỉ dựa vào tên currency.
4. Triển khai theo expand → xác nhận currency thực của từng bản ghi → backfill có kiểm chứng → constraints bắt buộc. Giá chưa xác nhận phải bị chặn tại checkout. Không backfill mặc định một currency vào tất cả bản ghi; không sửa migrations đã áp dụng.

Đây là đề xuất cần quyết định kinh doanh về currency hỗ trợ và nguồn xác minh giá trước migration; task này không thay schema hoặc gán đơn vị tiền.

## Ảnh công khai

`features/products/images.ts` dùng chung cho mapper catalog và service. DTO trả `id`, `url|null`, alt, sort order, không trả thuộc tính `storageKey`.

- Chỉ đường public `/images/` với các segment chữ/số/gạch ngang/gạch dưới và đuôi png/jpg/jpeg/webp/avif/gif được resolve. URL scheme, host tùy ý, query token, encoded path, traversal, backslash, SVG và ký tự điều khiển bị từ chối.
- Metadata có thể lưu key `public/products/...` theo cùng quy tắc raster, nhưng URL hiện là null. Không giả định bucket/CDN hay nối key vào một origin chưa cấu hình. Key private/customer/try-on không được tạo qua product service.
- Ảnh legacy không hợp lệ không bị xóa hoặc sửa trong DB; mapper trả null. Không kiểm chứng sự tồn tại của tệp hoặc upload ảnh trong service metadata này.
- Khi có storage provider: resolver phía server dùng image ID để tra key, bucket/prefix được allowlist, kiểm tra visibility; chỉ trả URL public hoặc URL có hạn dùng từ provider đã cấu hình. Không trả raw key/credentials. Nếu chọn proxy, dùng ID opaque, giới hạn public images, không nhận URL đích do client đưa vào. Đó là tích hợp tương lai, chưa thêm proxy route hoặc remotePatterns Next.js khi chưa có origin thực.

## Điểm vào và phân quyền
Phase2.8 thêm public read-only getProductDetail(slug,currency?) trong lib/catalog.ts, không gọi ADMIN Product Data Service để phục vụ storefront. Reuse catalog select/mapper/image resolver, active filters và safe DTO; raw/legacy amounts không ra detail client. Không làm yếu authorization của service CRUD, không thêm mutation API. Cart/purchase vẫn disabled. Chi tiết module tại ARCHITECTURE.md.


Import từ `src/lib/products.ts` trong server code:

```ts
const service = createProductDataService(); // Better Auth session trong Next request
const result = await service.list("product", { page: 1, pageSize: 20 });
```

Factory mặc định lấy session Better Auth đã xác minh từ Next headers, tra DB không cookie-cache. Không lấy userId/role từ JSON/query/header tự khai. Inject resolver chỉ dành cho trusted composition/tests và phải trả local userId/expiresAt epoch milliseconds đã xác minh. Session thiếu/sai/hết hạn bị từ chối trước/sau role query. Core và điểm vào có server-only; không có Server Action/API sản phẩm tự động được public.

Mọi get/list/create/update/remove/adjustStock đều xác minh session; sau đó đọc `User.role` từ DB trong transaction trước khi truy cập dữ liệu sản phẩm. User không tồn tại, role CUSTOMER hoặc role bị thu hồi bị từ chối. Không tin role có trong session payload. Transaction dùng Serializable, maxWait 5s, timeout 10s. Conflict đồng thời trả CONFLICT để caller đọc lại và thử với dữ liệu mới; không retry mutation tự động. Caller tương lai vẫn phải bảo vệ HTTP/Server Action bằng auth/session, CSRF/origin và kiểm soát quyền truy cập điểm vào.

## API service

Entity: `product`, `category`, `variant`, `image`. ID đầu vào là number nguyên dương PostgreSQL Int; ID DTO là chuỗi. Dữ liệu nhận kiểu unknown và validate allowlist phía server. Không cho nested writes, ID gán lại, role hoặc field không hỗ trợ.

| Method | Hành vi |
| --- | --- |
| `create(entity, data)` | Tạo một bản ghi; variant/image bắt buộc productId trong data |
| `get(entity, id, productId?)` | Đọc một bản ghi; variant/image bắt buộc productId để kiểm tra quan hệ cha |
| `list(entity, options?)` | Trang có items + pagination; variant/image bắt buộc productId trong options; admin thấy cả bản ghi inactive |
| `update(entity, id, patch, productId?)` | Patch có ít nhất một field; không reparent variant/image; stock phải dùng adjustStock |
| `remove(entity, id, productId?)` | Product/variant deactivate isActive=false; category xóa metadata nếu không còn FK; image xóa metadata, không xóa tệp storage |
| `adjustStock({productId, variantId, expectedStock, delta})` | Compare-and-set active variant; kiểm tra tồn kho cũ, delta nguyên khác 0, kết quả 0..2147483647; không âm/overflow/ghi đè stock đã đổi |

Create product cần name, slug, categoryId; optional description, brand, isActive. Category cần name/slug. Variant cần productId, sku, color, size, price (chuỗi), stock (integer), optional isActive. Image cần productId/storageKey, optional altText/sortOrder. Nullable metadata có thể xóa bằng null. Không cho undefined hoặc chuỗi rỗng; slug lowercase kebab-case; string có giới hạn và không chứa ký tự điều khiển.

FK và unique SKU, slug, productId/color/size được DB hiện có thực thi; vi phạm trả CONFLICT, không âm thầm upsert hoặc overwrite. Case-sensitivity giữ theo schema/DB hiện có; không tự thay normalization hoặc collation. Xóa product/variant không cascade để giữ quan hệ đơn hàng/giỏ hàng. `update(..., {isActive:true})` có thể phục hồi bản ghi đã deactivate khi admin yêu cầu. Đây là công cụ chỉnh tồn kho quản trị, chưa phải checkout/giữ chỗ/tính giá đơn hàng.

Kết quả: `{ok:true,data}` hoặc `{ok:false,error:{code,message,field?}}`. Code gồm UNAUTHENTICATED, FORBIDDEN, INVALID_INPUT, NOT_FOUND, CONFLICT, DATABASE_ERROR. Không đưa raw Prisma error, DB URL, constraint detail hoặc input nhạy cảm ra kết quả. P2002/P2003/P2034 → CONFLICT, P2025 → NOT_FOUND. Đối với lỗi kết nối/thiếu config, DATABASE_ERROR khác hoàn toàn list rỗng thành công.

## Pagination catalog

`getCatalog(query)` giữ interface success/products hoặc error và các caller cũ vẫn dùng được. Thêm optional page/pageSize; mặc định page=1/pageSize=20, tối đa page=10000 và pageSize=100. Mỗi truy vấn dùng skip/take và sort createdAt DESC/id DESC ổn định. Không còn đọc toàn bộ catalog không giới hạn.

`getCatalogPage(query)` mới trả cùng status/products và pagination `{page,pageSize,total,totalPages,hasNext}`. Count và data dùng cùng where trong RepeatableRead transaction. Tổng rỗng là 0 trang; trang vượt tổng trả [] thành công, không tự quay về trang 1. Query URL page/pageSize được parse nghiêm ngặt, từ chối tham số lặp, số âm, số thực, exponent hoặc vượt giới hạn. Không thêm nút hoặc thay layout pagination trong task backend này.

Offset pagination có thể dịch trang khi bản ghi thay đổi giữa các request; khi catalog lớn cần đo hiệu năng và cân nhắc cursor. Metadata count/data nhất quán trong một request, không đảm bảo snapshot xuyên nhiều request.

## Kiểm thử và giới hạn

- `npm.cmd test`: unit tests catalog/mapping/service với test double trong bộ nhớ, gồm CRUD 4 entity, quyền, scope cha, validation, lỗi DB, SKU/giá/stock và hai cập nhật stock cạnh tranh. Không viết fixture vào PostgreSQL.
- `npm.cmd run test:catalog-db`: read-only integration catalog/page và role check với user không tồn tại, session rỗng, DB không truy cập được/thiếu cấu hình. Không tạo admin/product/order để kiểm tra.
- Phase 2.4 đã chạy CRUD/stock/concurrency/constraints/rollback trên PostgreSQL thật tại aurel_ai_test với guard/role riêng, cleanup theo phiên. Không ghi fixture vào aurel_ai. Hướng dẫn: POSTGRES_INTEGRATION_TESTING.md.
- Driver pg hiện cảnh báo concurrent client.query từ Prisma adapter/interpreter trong interactive transaction có relation reads; trace đi qua dependency, không từ Promise.all trong service. Test vẫn đạt với pg 8; cần theo dõi tương thích trước pg 9, chưa nâng dependency để né cảnh báo.
- Better Auth đã nối theo AUTHENTICATION.md; auth/product write-path đã nghiệm thu bằng PostgreSQL test riêng. Currency migration mới chỉ deploy test; main chờ approval. Chưa Admin UI, upload/storage provider, stock CHECK toàn DB hoặc audit trail. Đường ghi DB khác vẫn cần invariant tương đương.
