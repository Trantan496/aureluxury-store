# Product Showroom — luồng hai bước AUREL (2026-10-22)

## Public showroom — cập nhật source01/11/2026
Preview `/admin/products/1/preview` và public `/products/[slug]` dùng chung giao diện. ProductPurchase mới giữ kiểu nút preview và nối add bag/buy now/favorite tới API thật; preview có Xem trên website theo slug khi active. Nút sửa ảnh/màu/size và mẫu rating chỉ admin; public có empty look và linkcategory khi chưa có nội dung. Xem [PUBLIC_PRODUCT_SHOWROOM.md](PUBLIC_PRODUCT_SHOWROOM.md). Theo user tuyệt đối không test, không chạy lint/typecheck/build/HTTP/browser; chỉ source/docs đã đổi, chưa nạp production build mới. Các mô tả cart chưa có hoặc public hide-empty bên dưới là lịch sử trước cập nhật này.

> Bố cục hiện tại (2026-10-23, theo hình số2): cột giới thiệu min140px/22%, gap20px; rail dùng hết phần còn lại, bốn thẻ đều nhau với gap12px (min120px), không cap width cố định theo viewport height. Ảnh/ô thêm12:13, cover căn giữa phía trên để phủ kín khung thay các dải trống của contain; chiều cao tự theo tỷ lệ, không ép height rồi giãn ngang. Heading36px, mô tả13px, CTA140×34px; tên/giá11px, dấu+26px bên phải metadata. Tablet<=900 ba ô, mobile44%/thẻ; dữ liệu món thứ5+ vẫn cuộn được. Scrollbar ẩn, controls Admin nhẹ và success message không tạo footer, lỗi vẫn hiển thị. Gallery63vh và panel3:2:3/API/DB/autosave không đổi. Visual QA: Pending Manual Review.
> Cập nhật chiều cao desktop (>900px, 2026-10-23): gallery và informationBody cùng63vh/63dvh; portrait50,4vh/50,4dvh để giữ tỷ lệ main4:5. Complete the Look rộng150px, cao calc(150px + 2vh), ưu tiên2dvh khi hỗ trợ; tại chiều cao900px ảnh cao168px. Mũi tên tự căn theo chiều cao mới. Chuyển đúng2 điểm phần trăm chiều cao viewport từ phía trên xuống ảnh dưới; giữ panels3:2:3, mobile/tablet, navbar, dữ liệu và thao tác. Visual QA: Pending Manual Review.
> Cập nhật 2026-10-23 — Complete the Look sửa trực tiếp và tự lưu: bấm/thả một ảnh vào khung12:13 cover/center, bỏ ảnh tại góc; bấm tên/giá để sửa, blur/Enter tự lưu, Escape hủy phần chữ đang sửa. Hàng đợi từng thẻ giữ version tuần tự, lỗi giữ dữ liệu/tệp và chờ retry tường minh. Thẻ mới nhận focus; hoàn thiện chỉ bật khi đủ ảnh/tên/giá đã lưu. Nền kéo sát mép trái bằng pseudo-element, chữ căn lề gallery, mép phải giữ nguyên. Gallery thay hàng nút lớn bằng menu thumbnail nhỏ Xóa/Đưa lên trước/Đưa về sau, giữ kéo sắp xếp và hỗ trợ thả tệp vào các slot. Không migration/main write; gallery desktop63vh/panels37,5/25/37,5/navbar/publish giữ nguyên. Visual QA: Pending Manual Review.
> Deployment 2026-10-23: Main aurel_ai: 9 reviewed migrations applied with owner approval; test: 11. PendingProduct is available; the two taxonomy migrations remain pending. No existing product data, sequences or .env changed.
## Complete the Look mới (2026-10-23)
Complete the Look thủ công đã code/test: nútThêm món trong Preview tạo PendingProduct blank/idempotent ngay; inline autosave ảnh/tên/giá VND, formHoàn thiện chọncategory/variants thật→existingShowroom→explicitpublish. Queue /admin/products/pending phân trang20, source link; source-look hàngngang/pagination20/khôngcap4. Public chỉ linked child đãpublish/cópublicimage+price, archiveẩn; detach giữqueue/product, parent khôngunpublish/touch. YouMayAlsoLike bỏcategoryheuristic, Preview Chờ AI Recommendations/Productionẩn khiAIchưa có. Main aurel_ai: 9 reviewed migrations applied with owner approval; test: 11. PendingProduct is available; the two taxonomy migrations remain pending. No existing product data, sequences or .env changed. Chi tiếtAPI/files/schema/checks tại [COMPLETE_THE_LOOK.md](COMPLETE_THE_LOOK.md).


## Phạm vi và trạng thái

Triển khai theo brief `COMPLETE PRODUCT CREATION & VISUAL SHOWROOM WORKFLOW` đính kèm và ảnh2: thumbnail dọc, ảnh chính desktop65dvh/mobile4:5, ba panel Detail/Fabric/Silhouette và thông tin bên phải. Không dùng ảnh/quần/giá/rating/shipping promises trong hình làm dữ liệu website. **Visual QA Pending Manual Review**, không browser/Test Screen/Computer Use/Playwright/screenshot.

**Main aurel_ai đã được owner phê duyệt và áp dụng riêng migration20261021120000_product_draft_requests: main8/test10**. Bảng idempotency đã sẵn sàng cho Tiếp theo → Showroom. Hai SQL taxonomy vẫn pending riêng; không apply kèm. Backup/verified restore mới aurel_ai_restore_test_20261022073329_9d848d, SHA587d3dbc2d2d8523954713dca6013bba7327a54f4ec3f5e3da64251f18f3b882; no-drift/rehearsal/old rows/sequences/env checks đạt, không fixture main. Report `.local/backups/aurel_ai_restore_test_20261022073329_9d848d.showroom-migration.json`.

## Cách dùng

1. `/admin/products/new`: chỉ thông tin sản phẩm/taxonomy/variants/giá/tồn kho, không upload, không summary ảnh, không nút Lưu nháp/Lưu sản phẩm. Bấm **Tiếp theo →** (#34251F) để validate và tạo internal draft unpublished. Idempotency UUID lưu tạm sessionStorage trước request; backend ticket/advisory lock/unique/Serializable bảo vệ retry/concurrent create. Không dùng UUID này làm public slug.
2. Điều hướng bằng replace tới `/admin/products/[id]/preview`, ID thật. Quay lại `/admin/products/[id]` giữ dữ liệu/ảnh, Tiếp theo update cùng ID. Khi đang published, Step1 yêu cầu xác nhận chuyển về unpublished trước chỉnh showroom.
3. Bấm ô ảnh trống để mở file picker; upload JPEG/PNG/WebP8MiB/24MP, rotate/resize1920px/WebP82/strip metadata như storage hiện có. Binary ImageAsset và ProductImage/role/order/cover được commit **cùng transaction ngay**, không đợi Save. Lỗi decode/DB/stale version giữ ảnh cũ, không tạo binary orphan.
4. Ảnh đã có: hover/focus có affordance nhỏ, bấm mở menu Thay/Xóa/Đặt ảnh chính/Chọn kho/Vị trí. Không có form upload lớn hoặc nút edit phủ ảnh thường trực. Touch có affordance để dùng không cần hover. Kho dùng chung search tên sản phẩm/paging; chưa duplicate kho/binary infrastructure.
5. Thumbnail kéo thả đổi thứ tự, hoặc chọn ảnh rồi dùng nút đưa trước/sau. Mỗi thao tác persist ngay. Rail scroll nội bộ khi nhiều ảnh. Gallery mobile có main full-width, thumbnail ngang và swipe, panels nhỏ bên dưới.
6. **Lưu nháp** giữ unpublished. **Lưu sản phẩm** validate variants/giá/ảnh chính; selector mặc định unpublished cho draft. Chỉ khi chọn Xuất bản và xác nhận mới set isActive=true. Upload không publish. Published preview khóa sửa ảnh tới khi Lưu nháp; không âm thầm thay media đang bán.
7. Production `/products/[slug]` vẫn lọc active và public image rights, không có toolbar/upload/placeholder edit. Cùng component/ProductDetail DTO với preview. Cart/checkout chưa triển khai nên cả hai mode giữ Add to Bag/Buy Now disabled; không tạo order/cart/stock mutation giả. Size Guide/shipping/care thiếu dữ liệu hiển thị trung tính, không tự bịa.

## Kiến trúc, ảnh và dữ liệu

- `ProductDetailView({product,mode,editor,related,currencyControl})`: một UI cho cả route public và admin. `EditorialGallery` dùng chung selection/zoom/counter/swipe; `editor` chỉ có ở preview chưa xuất bản. `showroomProduct` normalize ManagementDTO sang ProductDetail; public reader dùng mapper tương ứng và metadata ảnh/profile thật.
- Role dùng trường **ProductImage.imageType hiện có**: cover=front + isPrimary, detail=detail, fabric=other, silhouette=back, gallery=lifestyle. Không thêm cột role hay gallery model. Preview giữ cover trống khi chỉ upload Fabric; production có fallback ảnh hợp lệ nếu legacy thiếu cover. Panel optional trống bị ẩn ở production.
- Cover sorting `isPrimary desc,sortOrder asc,id asc` ở catalog giúp collection/related/summary lấy cùng cover. Thứ tự thumbnail dùng sortOrder/id, độc lập cover. `variantId` giữ nguyên khi thay ảnh vào record hiện có, không chuyển quan hệ sang sản phẩm khác.
- Thay ảnh: tạo binary mới, update ProductImage rồi cleanup binary cũ **chỉ nếu không còn ProductImage tham chiếu**; tất cả cùng transaction. Reuse từ kho không copy bytes. Replace/reset AI permissions unknown, website-use intent được ghi như upload hiện hữu; không chuyển training consent của ảnh cũ sang ảnh mới.
- Media operations check session/expiry/DB ADMIN qua service.run, version SHA/child ownership/bounded lists, unpublished guard trước đọc/decode body. Cross-product image ID/reorder/asset key lạ bị chặn. Raw endpoint có same-origin guard/bounded stream như trước. No-store/private media route và optimizer exclusion giữ nguyên.
- Public route và preview route gọi cùng `ProductDetailView`; AdminFrame bỏ sidebar/style `.shell button` ở preview để không có hai kiểu PDP. Navbar preview dùng storefront, auth/admin Step1 giữ header riêng. Noindex/no-store admin gate vẫn server-side mỗi route/operation.
- Related sections chỉ lấy active catalog thật: same-category→You May Also Like, other-category→Complete the Look, loại chính product hiện tại/slug sai/không ảnh. Không AI ranking hoặc curated/fake inventory; không hàng phù hợp thì ẩn. Giá chỉ theo currency được chọn khi flag cho phép, không FX/legacy inference hoặc tự bật currency.
- Gallery API/prepare/finalize revalidate public slug/products/home sau commit; data loaders dynamic. Không full-page reload sau từng upload; row/version/gallery update từ response. Khi lỗi/commit không rõ có nút đọc lại record đã lưu.

## Routes và giao thức

| Route | Hành vi |
|---|---|
| `/admin/products/new` | Step1 mới, Tiếp theo |
| `/admin/products/[id]` | Step1 sửa cùng ID, ảnh giữ trong payload nội bộ |
| `/admin/products/[id]/preview` | Showroom ADMIN, SSR load row đã lưu |
| `/products/[slug]` | Production shared view, active-only |
| POST `/api/admin/products` operation `prepare` | input/id/version/requestKey, idempotent internal draft |
| POST `/api/admin/products` operation `finalize` | id/version + draft/publish/confirmed, validate/publish explicit |
| POST `/api/admin/products/[id]/gallery` | Raw image + version/role/image-id headers hoặc JSON action/version/input |

Gallery JSON actions: assign/remove/primary/role/reorder. All routes reuse service/database/auth, không thêm unauthenticated preview endpoint. Existing generic CRUD/CSV vẫn giữ contract để không phá clients cũ; UI workflow mới dùng prepare/finalize/gallery riêng.

## Migration đã được duyệt và áp dụng main

`20261021120000_product_draft_requests` chỉ tạo bảng ProductDraftRequest:

- key UUID text primary key; actorId integer>0; productId unique FK Product(id) ON DELETE CASCADE; createdAt timestamp.
- Không sửa Product/Image/giá/tồn kho/user/role/grants hoặc backfill dữ liệu. Ticket tồn tại cùng draft để retry/back/forward không tạo bản sao; không dùng auth Verification hoặc public slug làm chỗ chứa state.
- SHA256 normalized LF: `78e95807d4fef5dc6f7bd02e8a0bf8e70e5dcfcb53e6063698cbcf9e70841400`.
- Lý do cần schema: sessionStorage chỉ chống lặp UI, không đủ cho network retry hoặc hai request đồng thời; ticket DB unique/transaction làm atomic với Product creation. Existing edit ID không cần tạo ticket mới.
- Backup/verified restore mới `aurel_ai_restore_test_20261022072134_fefd7f`, SHA256 `9b2eb4ad603ef91f263b9cb9bc37008bd4986756f3d6792526ecc09c562757a3`.
- `scripts/main-showroom-migration.ts ... --rehearsal-only` đã dựng expected schema độc lập từ7 SQL main, scoped deploy8 SQL reviewed trên restore, compare schema/old rows/sequences và main fingerprint. Report `.local/backups/*fefd7f.showroom-rehearsal.json`: noDrift/rehearsalPassed/mainUnchanged=true, pendingApproval=true.
- Owner đã phê duyệt riêng migration; backup mới/verified restore mới và scoped deploy main hoàn tất, main8/source10. **Main aurel_ai đã được owner phê duyệt và áp dụng riêng migration20261021120000_product_draft_requests: main8/test10**. Bảng idempotency đã sẵn sàng cho Tiếp theo → Showroom. Hai SQL taxonomy vẫn pending riêng; không apply kèm. Backup/verified restore mới aurel_ai_restore_test_20261022073329_9d848d, SHA587d3dbc2d2d8523954713dca6013bba7327a54f4ec3f5e3da64251f18f3b882; no-drift/rehearsal/old rows/sequences/env checks đạt, không fixture main. Report `.local/backups/aurel_ai_restore_test_20261022073329_9d848d.showroom-migration.json`.

## Visual Refinement01 — Gallery & Layout

Gallery refinement01 chỉ sửa product-detail.module.css dùng chung preview/public: desktop/tablet height65dvh (fallback65vh), theo65% chiều cao viewport thay vì clamp theo chiều rộng; main/panels cùng height, panels rows3:2:3/gap6px, gap cột7px. Layout1.857:1 (~65/35 sau gutter), gap24–44px; padding đầu trang10→6px/breadcrumb bottom10→6px/link30→28px. Rail64px desktop (48px<=1200,56px<=900), thumbnail1:1/gap8px/selected outline1px offset1px/internal scroll. Main object-fit contain, panels cover không stretch; tablet cùng65dvh, mobile<=600 auto-height/main4:5/rail ngang/panels3 ô. Typography thông tin/navbar/TSX/upload handlers/backend/DB/workflow không đổi.

Kiểm tra lượt refinement: npm.cmd test92/92; test:showroom-ui3/3; lint/typecheck/build đạt. Không chạy lại DB integration vì chỉ đổi CSS; không DB writes hoặc browser/HTTP QA. Visual QA Pending Manual Review: owner đối chiếu1440/1536/wide/tablet/mobile, ảnh ngang/dọc, rail nhiều ảnh, upload/selection/drag/native picker.

## Quiet Luxury typography
- Upper Product Information refinement: shared PDP/preview eyebrow+breadcrumbDM12px/500/.06em; category→title14px; titleCormorant500/36px/1.12/-.015em desktop, mobile clamp28–34px, tên đầy đủ wrap/overflow-wrap không truncate. Title→price12px, priceDM600/21px/1.3; summaryDM400/14px/1.6, margin-top20px/padding-bottom24px tới divider. Không đổi65vh/65dvh hoặc panels37.5/25/37.5, navbar, lower purchase/related/variants/pricing logic/DB.
- Đã sửa giá storefront: base currency VND lấy từ ProductPrice được gắn currency rõ ràng, độc lập MULTI_CURRENCY_ENABLED; flag chỉ bật lựa chọnUSD/EUR, không tự FX/backfill/đọc legacy amount thànhVND. Public PDP/catalog/paging/related và Showroom dùng cùng defaultVND, selector nếu bật mặc địnhVND. Main read-only loader verify ID1 real product “[AUREL COLLECTION] Limited Edition Coat” có3 active variants đềuVND999000, catalog/PDP trả999000. Không đổi DB/env/flag.
- Rating hiện theo Refinement03: reusable ProductRating nhận actual average/count; Preview missing-data mẫu5 sao/1 review có nhãn DEMO, Production không có review thật thìẩn. Không thêm review DB/aggregate giả.

Typography shared storefront/PDP dùng đúng2 web fonts next/font/google: Cormorant Garamond500/600 (latin+vietnamese), DM Sans400/500/600 (latin+latin-ext), display swap/adjustFontFallback=false; root html chỉ khai báo CSS variables, không đổi body/global font nên Admin forms giữ nguyên. Wordmark600/34px/uppercase/.12em; nav500/13px; title500/clamp34–40px/1.08; editorial headings500/clamp44–52px; priceDM600/21px; summaryDM400/14px/1.65; labels600/12px/buttons600/12px/.04em/metadata-accordions13px. Warm ivory/espresso, gallery/layout/logic giữ nguyên.

DM Sans upstream chỉ có latin/latin-ext và thiếu phần lớn ký tự Việt. Stack DM Sans → Cormorant Garamond → generic sans-serif giữ đủ dấu bằng font thứ2, không thêm font thứ3; một số chữ Việt trong body sẽ có nét serif. Kiểm tra cmap file WOFF2 đã build qua fontTools + Node Brotli: Cormorant104/104, DM Sans14/104 codepoints Việt được kiểm tra. Nguồn metadata chính thức: https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/METADATA.pb.

Files: src/app/layout.tsx, src/components/layout/homepage-header.module.css, src/components/products/product-detail.module.css. Lint/typecheck/build và3 SSR tests đạt; không sửa data/DB hoặc image/purchase behavior.

## Gallery Visual Refinement02

Gallery Visual Refinement02 chỉ CSS: giữ65vh/65dvh và panels3:2:3 (37.5/25/37.5 sau gap6px). Metadata read-only cover1122×1402≈4:5; nguyên nhân side gutters là cột1.35fr rộng hơn aspect ảnh với contain, không có padding main. Cột chính giới hạn theo width52dvh=65dvh×4/5 và57.45% khi thiếu ngang; contain/center giữ toàn bộ ảnh, không crop hoặc đổi binary. Rail68px desktop/64px<=1200/56px<=900/54px mobile, thumbnail vuông/gap9px/border chọn mảnh, top0/scroll nội bộ. Rail track dư7px + grid gap7px = khoảng14px từ thumbnail sang main; main→panel7px. Navigation36px tròn/arrow20px/gap8px/espresso#34251fb3/inset16px; counter10px. Caption inset16px desktop, breakpoint nhỏ giữ inset cũ. Mobile<=600 auto-height/rail ngang scroll/panels ngang giữ nguyên.

Selectors đổi chính xác: `.editorialGallery`, `.editorialGallery[data-panels=false]`, `.thumbnailRail`, `.thumbnailRail .editorialThumb`, `.editorialThumb[aria-pressed=true]`, `.mainSwipe`, `.editorialMain`, `.editorialMain .editorialPhoto`, `.panelCaption`, `.galleryBrowse`, `.galleryBrowse > div`, `.galleryBrowse button`, `.gallery .galleryBrowse button`, `.galleryBrowse > span`; media overrides <=1200/900/600 cho rail/gallery. Không sửa `.editorialPanels` rows/height hoặc typography/product-info/navbar/related.

Application file duy nhất src/components/products/product-detail.module.css. Không sửa TSX/markup/handlers/DTO/DB hoặc endpoints. Lint/typecheck/build và3 SSR tests đạt. Static CSS/metadata/SSR không thay visual/picker/navigation QA: Pending Manual Review. Ảnh ngang khi chọn làm main vẫn contain nên có thể có khoảng trống theo aspect thực, ưu tiên không crop.

## Product Information Panel02 — selectors và values

Design target1440px CSS/zoom100% do owner chỉ định, không xác minh hoặc suy diễn screenshot zoom/DPR. Thay đổi application chỉ product-detail.module.css và product-detail-view.tsx. Không gallery/navbar/related/font family/DB/pricing/checkout/upload changes.

| CSS selectors thêm scoped trong module | Giá trị |
|---|---|
| `.information > .eyebrow` | 11px, margin-bottom12px; weight500 cũ |
| `.information > .title` | clamp34px/2.5vw/36px, weight500/line1.1; mobile<=600 clamp28px/7.5vw/34px; tên nguyên vẹn |
| `.information > .price` | margin-top10px,21px/600; line1.3 cũ |
| `.information > .summary` | margin-top14px,padding-bottom20px,14px/line1.55 |
| `.information .selection` | margin-top16px,gap16px |
| `.information .selection > fieldset:first-child` | margin-bottom4px: color→size tổng20px |
| `.information .selection legend` | margin-bottom10px,11px/600 |
| `.information .colorChoice`, `.information .choices` | 34×34px; gap10px; thin selected outline giữ nguyên |
| `.information .choice`, mobile override | min-height44px,min-width56px (mobile52px),padding10px12px,radius0 |
| `.information .sizeRow`, `.information .sizeGuide` | align-items center; guide11px |
| `.information .purchaseStack`, `.information .purchaseStack button` | gap8px; min-height46px,padding10px14px,radius0,12px/600/line1.3 |
| `.information .addToBag`, `.information .buyNow` | primary background/border#34251f; secondary transparent/border#34251f |
| `.utilityInformation`, `.utilityInformation .note` | margin-top2px + grid gap16px = utility18px; internal gap4px; note11px/1.5 |
| `.information .availability` | margin0,12px,color#66594c, actual stock unchanged |
| `.information .accordions` | margin-top18px,border-inline0; thin horizontal separators giữ nguyên |
| `.information .accordions summary` | flex/space-between/center,gap16px,min-height46px,padding10px0,list-style none,13px/line1.4 |
| `.information .accordions summary::-webkit-details-marker` | display none; native details vẫn hoạt động |
| `.information .accordions summary::after`, `.information .accordions details[open] > summary::after` | chevron6×6px,border1px,margin-right3px,rotate45°/225° |
| `.information .accordions details > p`, `.information .accordions details > div` | padding0 0 14px |
| `.information .accordions .productMeta` | SKU11px/secondary color |

Markup tối thiểu: unavailable note ra khỏi purchaseStack, nhóm stock+note trong utilityInformation, SKU chuyển vào ProductDetails. Giữ native details, disabled buttons, variant handlers và aria-live stock. Không thêm icon mua hàng (optional) hoặc fake benefits/reviews.

Checks: lint/typecheck/build và4SSR đạt. SSR bổ sung full long name, SKU nằm trong ProductDetails và Hết hàng; không browser visual proof. Visual QA Pending Manual Review: owner review tại1440px CSS/100% và mobile, title wrap/accordion keyboard/selector focus.

## Refinement03 — Missing Reference Elements

Environment owner báo zoom100%, không additional OS scaling, screen1920×1080; dùng1440 CSSpx làm design target, không chạy interactive visual QA.

| Reference element | Triển khai / data gate |
|---|---|
| Rating row dưới giá | ProductRating accepts actual average/count, validates range/count,14px SVG stars/fractional fill và12px detail. ProductDetail.rating optional UI DTO, chưa có backend summary source. No-review Preview5/1 DEMO với nhãn chưa có đánh giá thực; no-review Production không render để tránh fabricated review. |
| Service row trước accordions | ProductServiceBenefits reusable3equal columns/truck-package-shield24px/text11px/gap12px. src/config/product-service-policies.ts là nguồn config typed, cả3null. Preview Chưa cấu hình, Productionẩn item thiếu; text/href chỉ từ cấu hình đã xác minh. Không giả499k/30days/SSL. Chưa có policy pages thật. |
| Size range | Existing real variants union/color availability logic giữ nguyên. Read-only main xác nhận3colors beige/black/navy cùngsizeM/stock0. MuốnXS/S/L cần Admin tạo variants; không tự thêm inventory. |
| Purchase buttons | AddToBag thêm SVG bag18px trước text, gap10px; height46px/background#34251f/outlined BuyNow và disabled giữ nguyên. |
| Utility information | Preview implementation warning ở Admin previewStatus, không customer panel. Production note nhỏ vẫn báo mua hàng chưa có. Actualstock vẫn visible/aria-live, SKU trong ProductDetails. |
| Product name/header | 34–36pxCormorant/DM supporting giữ đúng typography trước. Saved name [AUREL COLLECTION] nguyên vẹn; owner sửa prefix trong Admin nếu dư, không strip/mutate dữ liệu. |
| Related | CompleteLook/YouMayAlsoLike đã có trong shared view, real active catalog only vàẩn khi không có phù hợp; không suy ra thiếu từ crop. |

App files: new components/products/product-rating.tsx, product-service-benefits.tsx; new config/product-service-policies.ts; updated features/catalog/product-detail.ts(optional type only), products/product-detail-view.tsx, product-detail.module.css, admin/product-showroom.tsx. Tests product-showroom-ui.test.tsx expanded to7.

New CSS selectors: .rating/.ratingStars/.ratingStar(+svg,>span)/.ratingDemo; .serviceBenefits/.serviceBenefit(>svg,>span,small)/a.serviceBenefit:hover; .information .purchaseStack .addToBag/.addToBag>svg; .information .selection>.serviceBenefits/adjacent utilityInformation; <=400px service icon stack. Gallery/header/image systems untouched.

Checks:93unit/7SSR/lint/typecheck/build passed. SSR covers real/invalid/absent rating, AdminDEMO gate,3preview policies/public absence/configured href, actual size-onlyM and missing color-size disabled, bag icon/disabled buttons, persistedVND/stock/SKU/longname. No DB write/migration/env/flags/auth/currency changes; no HTTP/browser/Test Screen/Computer Use/Playwright/screenshots. Visual QA Pending Manual Review.

Remaining: real review data source/verified policies/pages/cart-checkout backend/additional variants. Không claim feature phát sinh reviews/real purchasing. Brief yêu cầu5/1 fallback mâu thuẫn no-fabricated-rating acceptance; giữ placeholder chỉ Admin có nhãn, Production chỉ actual data.

## Desktop một khung nhìn — Information scroller

Desktop một khung nhìn theo plan owner: ProductDetailView thêm informationBody từcategory đến hết4accordion; desktop>=901 height65vh/65dvh bằng gallery, overflow-y:auto/x:hidden, scrollbar thin/gutter stable/padding-end8px/scroll-padding8px/overscroll contain. Region có aria-label Thông tin sản phẩm/tabIndex0/focus outline1px. information bỏsticky/top/padding-top để căn đầu gallery, YouMayAlsoLike ngoài region vàCompleteLook dưới gallery. <=900 region auto-height/cuộn trang tự nhiên. Giữ gallery65dvh/panels37.5/25/37.5/fonts/buttons/price/review-policy data gates. Target1440×900CSS/100%, không cam kết pixel-fit khi chưa manualQA hoặc không có relateddata; Admin chrome/màn thấp vẫn page scroll.

- Markup duy nhất mới: div.informationBody role=region/aria-label="Thông tin sản phẩm"/tabIndex0 bọc category/title/price/rating/description/currency/selection/services/utility/accordions. YouMayAlsoLike là sibling ngay sau wrapper, không bị cuộn theo nội dung. Native details vẫn đóng mặc định, mở sẽ tăng scrollHeight bên trong; guide dialog và gallery giữ nguyên.
- CSS selectors: .information position:static/top:auto/padding-top0; .informationBody min-width0; :focus-visible outline1px var(--border)/offset3px. @min-width901 .informationBody height65vh rồi65dvh, overflow-y auto/xhidden, scrollbar-widththin, gutterstable,padding-inline-end8px,overscroll-behavior-ycontain,scroll-padding-block8px. Base không fixedheight/overflow nên<=900 flow tự nhiên.
- Chuyển .information>.eyebrow/.title/.price/.summary và mobile title sang .informationBody>...; giữ nguyên toàn bộ numeric typography/gaps. Không chỉnh gallery/header/relatedcards/font sizes/button sizes, không rút gọn tên hoặc tạo gợi ý giả.
- App files product-detail-view.tsx/product-detail.module.css; regression tests product-showroom-ui.test.tsx thêm cấu trúcregion, nesteddiv matching để xác nhận full name/multiple sizes/4details/purchase disabled ở bên trong và related bên ngoài cho cả2mode.
- Checks: lint/typecheck/build và8SSR đạt. Không interactive browser/pixel measurements; actual keyboard scroll/accordion expansion tại1440×900/mobile là Pending Manual Review. SSR xác nhận native details/content không bị xóa hoặc chuyển ngoài vùng, không chứng minh sự kiện browser.
- Acceptance thực tế: mainrow585CSSpx tại900px height theo65dvh, cộng navbar/breadcrumb/relatedheading; mục tiêu đầu gợi ý hiện cùng viewport khi có data. Không cố chứa hết relatedcards/footer/toàn bộaccordionmở. Admin toolbar/status nằm ngoài shared view, có thể tăng page scroll; không thayworkflow.

## Kiểm thử và giới hạn bằng chứng

- Prisma generate;92 unit tests (2 mới gallery/model, cover order test cập nhật);12 PostgreSQL tests gồm parent/1 end-to-end service workflow;3 Node SSR component tests. Lint/typecheck/build kiểm tra bản cuối. Kết quả được ghi tiếp trong SESSION_LOG nếu có cập nhật sau report này.
- DB runner guard exact aurel_ai_test/role, reviewed10 migration SHA/history, cleanup/rollback fixtures và readonly main fingerprint/.env before-after. pg queue deprecation cũ không fail. Không test cookies hoặc fixture main.
- PostgreSQL showroom test tạo một draft từ hai requests cùng UUID, replay key cùng actor trả cùng ID, actor khác bị từ chối. Test upload Fabric trước Cover, cover/role records, stale-version deny-before-body, malformed upload giữ ảnh cũ, fault sau binary insert rollback, replace giữ variantId, shared binary cleanup, reorder/fresh Prisma connection, Step1 update cùng ID, save draft/default unpublished/confirmation publish, public/private image gate, published media guard, no stock/order/cart changes.
- Node SSR dùng ReactDOM/Next Image thật với Node interop + CSS-name loader; kiểm tra Step1 không có file input/image panel/save buttons, preview có4 direct slots/file input, production không có upload controls, hai mode render cùng real fixture photos/hierarchy và purchase buttons disabled. CSS layout được Next compile riêng. Đây không phải browser/pixel/touch/file-picker/drag-drop verification.
- Persist sau refresh được chứng minh bằng **Prisma connection mới và route SSR đọc cùng rows**, không phải thao tác refresh bằng browser. URL là DB-backed WebP ổn định qua runtime; không blob URL/object URL làm storage.
- Visual QA **Pending Manual Review**. Không cam kết pixel-match, browser focus/trap, swipe/drag, actual native picker hoặc GPU rendering khi không được mở browser.
- Cart/checkout, product size chart, shipping/returns rules, video sản phẩm và semantic recommendation chưa có backend; UI không giả thành công. Category model hiện tại không có hierarchy mới; giữ category/collection/taxonomy như cũ. Hai SQL taxonomy/main runtime privileges vẫn ngoài migration mới.

## Audit acceptance trong brief

| Yêu cầu | Bằng chứng hiện tại |
|---|---|
| Tests1–2 Step1 không ảnh, Next-only | Node SSR test3 + ProductEditor source |
| Tests3–4 validate/create/reuse unpublished draft | PostgreSQL prepare/concurrent/replay/actor tests; main đã kích hoạt bằng migration được owner duyệt |
| Tests5–8 click slots/upload/persist/refresh/Fabric | Slot input handler + PostgreSQL role/upload/fresh connection + SSR4 slots; native picker/visual thao tác manual pending |
| Tests9–10 replace/order persist | PostgreSQL atomic failure/shared cleanup/variant link/reorder/new connection |
| Test11 Back/edit/reuse ID/images | Protected ID routes + prepare update integration, same product count |
| Tests12–13 draft/private/finalize/shared UI | PostgreSQL finalize/public filter; cả hai route import ProductDetailView, SSR cả hai mode |
| Test14 không real purchase trong preview | SSR disabled buttons + DB stock/order/cart unchanged |
| Test15 unauthorized draft/media | Service actor guards trước read/decode + protected layout/page/service, original media gate tests |
| Main safety | Main8 sau approved scoped DDL; backup/restore/no-drift/rehearsal đạt, dữ liệu/sequences/env cũ giữ nguyên, không development fixtures main; hai taxonomy SQL chưa apply |

## File chính

- UI: admin/product-editor.tsx, product-showroom.tsx, product-admin-frame.tsx, image-storage.tsx, products.module.css; products/product-detail-view.tsx, editorial-gallery.tsx, product-detail.module.css; layout/storefront-header.tsx.
- Logic: features/products/{management,product-service,showroom,showroom-model,gallery}.ts; features/catalog/{catalog,product-detail,prisma-catalog}.ts; lib/{product-related,db/queries/products}.ts.
- Routes: admin/products/layout.tsx, admin/products/[id]/preview/page.tsx, products/[slug]/page.tsx, api/admin/products/route.ts, api/admin/products/[id]/gallery/route.ts.
- Schema/tools/tests: Prisma schema/migration/reviewed manifest, product-editor-check.ts, main-showroom-migration.ts, showroom unit/DB/SSR tests, tests/tsconfig.ui.json, package.json.
- Tài liệu: PROJECT_CONTEXT/ARCHITECTURE/ROADMAP/SESSION_LOG/DECISIONS/DESIGN_SYSTEM/PRODUCT_EDITOR/ADMIN_PRODUCTS/IMAGE_STORAGE và PRODUCT_SHOWROOM này.

## Dynamic Variants — 2026-10-23
Preview có + COLOUR/SIZE, dialog tên/HEX/custom size; local-only, reset/reload mất, Publish không lưu Demo. Preview xem được biến thể inactive thật; Production chỉ active. Ảnh/giá/stock theo lựa chọn, purchase disabled. Gallery63vh/panels3:2:3/Complete the Look không đổi. 11 SSR đạt; Visual QA: Pending Manual Review. Xem [DYNAMIC_VARIANTS.md](DYNAMIC_VARIANTS.md).
