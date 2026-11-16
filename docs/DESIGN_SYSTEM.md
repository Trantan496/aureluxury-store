# Hệ thống thiết kế — Phase 0

## Modal thử đồ theo ảnh tham chiếu — 14/11/2026
- Theo yêu cầu hoàn tác mới nhất: modal/topbar trắng #FFFFFF, chữ/CTA #111111/#0A0A0A, helper #818181, frame gradient #F4F4F4→#F0F0F0, divider #E5E5E5. Không dùng palette kem/nâu của lượt trước. Canvas PDP bên ngoài vẫn #F8F5F0.
- Chữ giảm: hero desktop max38px/mobile25px (<=360px23px); mô tả14/13px; frame18/15px; productname14px; upload17/16px/helper13/12px; CTA16/15px; brand20px/headerlabel14px. Bố cục và kích thước nút/khung giữ nguyên.
- Header AUREL trái/THỬ ĐỒ AI giữa/close phải; hero sans-serif đậm, cột model minh họa bên trái, controls và2portraitframes bên phải. Model ẩn<=1000px, controls stack<=720px; body cuộn trong dialog.
- Ảnh trang trí gốc tryon-editorial-model.webp được khôi phục; cutout và tường/sàn kéo dài không còn render; không đi vào request inference. Input sản phẩm vẫn slot5; khung result chỉ hiển thị ảnh do API trả về. Không có progress/detection/success giả. Prompt/nguồn trong LOGS/TRYON_REFERENCE_2026-11-14.md.

## Nền trang chi tiết sản phẩm — 14/11/2026
- Mã nền trước khi đổi: **#F4F0E9**, tương ứng rgb(244,240,233); nguồn là --background tại src/app/globals.css. Đã đo computed style body trên PDP trước khi sửa, lưu .local/pdp-white/before.json.
- Mã nền PDP hiện tại: **#F8F5F0** (rgb248,245,240), tông kem gốc sáng nhẹ theo phản hồi mới; bản trắng #FFFFFF đã được thay. Áp dụng cho canvas main chứa trực tiếp product-detail .page và cho .page, phủ cả vùng lề ngoài nội dung. Không đổi token toàn cục, màu header #F3EEE7, footer, ảnh sản phẩm hoặc palette try-on.
- Khôi phục nền cũ: gỡ hai background #f8f5f0/selector main:has(> .page) ở đầu src/components/products/product-detail.module.css; canvas sẽ kế thừa nền body #F4F0E9 như trước.

> Bố cục hiện tại (2026-10-23, theo hình số2): cột giới thiệu min140px/22%, gap20px; rail dùng hết phần còn lại, bốn thẻ đều nhau với gap12px (min120px), không cap width cố định theo viewport height. Ảnh/ô thêm12:13, cover căn giữa phía trên để phủ kín khung thay các dải trống của contain; chiều cao tự theo tỷ lệ, không ép height rồi giãn ngang. Heading36px, mô tả13px, CTA140×34px; tên/giá11px, dấu+26px bên phải metadata. Tablet<=900 ba ô, mobile44%/thẻ; dữ liệu món thứ5+ vẫn cuộn được. Scrollbar ẩn, controls Admin nhẹ và success message không tạo footer, lỗi vẫn hiển thị. Gallery63vh và panel3:2:3/API/DB/autosave không đổi. Visual QA: Pending Manual Review.
> Cập nhật 2026-10-23 — Complete the Look sửa trực tiếp và tự lưu: bấm/thả một ảnh vào khung ảnh cover/top, bỏ ảnh tại góc; bấm tên/giá để sửa, blur/Enter tự lưu, Escape hủy phần chữ đang sửa. Hàng đợi từng thẻ giữ version tuần tự, lỗi giữ dữ liệu/tệp và chờ retry tường minh. Thẻ mới nhận focus; hoàn thiện chỉ bật khi đủ ảnh/tên/giá đã lưu. Nền kéo sát mép trái bằng pseudo-element, chữ căn lề gallery, mép phải giữ nguyên. Gallery thay hàng nút lớn bằng menu thumbnail nhỏ Xóa/Đưa lên trước/Đưa về sau, giữ kéo sắp xếp và hỗ trợ thả tệp vào các slot. Không migration/main write; gallery desktop63vh/panels37,5/25/37,5/navbar/publish giữ nguyên. Visual QA: Pending Manual Review.
> Deployment 2026-10-23: Main aurel_ai: 9 reviewed migrations applied with owner approval; test: 11. PendingProduct is available; the two taxonomy migrations remain pending. No existing product data, sequences or .env changed.
## Complete the Look mới (2026-10-23)
Complete the Look thủ công đã code/test: nútThêm món trong Preview tạo PendingProduct blank/idempotent ngay; inline autosave ảnh/tên/giá VND, formHoàn thiện chọncategory/variants thật→existingShowroom→explicitpublish. Queue /admin/products/pending phân trang20, source link; source-look hàngngang/pagination20/khôngcap4. Public chỉ linked child đãpublish/cópublicimage+price, archiveẩn; detach giữqueue/product, parent khôngunpublish/touch. YouMayAlsoLike bỏcategoryheuristic, Preview Chờ AI Recommendations/Productionẩn khiAIchưa có. Main aurel_ai: 9 reviewed migrations applied with owner approval; test: 11. PendingProduct is available; the two taxonomy migrations remain pending. No existing product data, sequences or .env changed. Chi tiếtAPI/files/schema/checks tại [COMPLETE_THE_LOOK.md](COMPLETE_THE_LOOK.md).


## Quiet Luxury typography (2026-10-22)
- Refinement03 shared UI có ProductRating (real summary khi được cấp dữ liệu; khi chưa có chỉ Admin Preview mẫu5/1 review gắn DEMO, Production ẩn) và ProductServiceBenefits3 cột outline truck/package/shield. Config product-service-policies.ts shipping/returns/payment hiệnnull: Preview3 Chưa cấu hình, Productionẩn unsupported promises; hỗ trợ link policy thật nếu cấu hình. AddToBag thêm icon bag18px, disabled giữ nguyên; warning kỹ thuật Preview chuyển status Admin, public vẫn note nhỏ và stock thật. Main hiện3 colors chỉsizeM/stock0; không tự thêmXS/S/L hoặc sửa tên [AUREL COLLECTION]. Related sections đã có/shared/real-only/hide empty. Không sửa65dvh/gallery panels/navbar/DB/currency/auth/workflow.
- .rating margin-top12px/gap8px/details12px, stars14px/gap1px/fractional fill, demo10px. .serviceBenefits3 equal cols/gap14px, icons24px/icon-text gap12px/text11px/line1.45/no cards; <=400 stack icon above text trong từng cột. Bag18px/gap10px trong nút46px. Không giả promises/price/reviews ở Production.
- Information Panel02 hoàn tất theo design target1440px CSS/zoom100%, không coi đó là thông số screenshot gốc. Chỉ scoped information CSS/shared markup: category11px/gap12; title clamp34–36px/500/1.1 (mobile28–34), price21px/600/gap10; desc14px/1.55/margin14/padding20; divider→color16/color→size20/size→buttons16/buttons gap8/utility gap18. Swatch34px/gap10; size44px/min56 (mobile52); purchase46px/12px600/#34251f; native accordion46px/13px/right chevron/border separators. SKU chuyển ProductDetails, stock vẫn rõ, unavailable note11px. Giữ gallery65dvh/panels37.5/25/37.5/navbar/backend/data; rating không có data thật vẫn ẩn.
- Đã sửa giá storefront: base currency VND lấy từ ProductPrice được gắn currency rõ ràng, độc lập MULTI_CURRENCY_ENABLED; flag chỉ bật lựa chọnUSD/EUR, không tự FX/backfill/đọc legacy amount thànhVND. Public PDP/catalog/paging/related và Showroom dùng cùng defaultVND, selector nếu bật mặc địnhVND. Main read-only loader verify ID1 real product “[AUREL COLLECTION] Limited Edition Coat” có3 active variants đềuVND999000, catalog/PDP trả999000. Không đổi DB/env/flag.
- Rating hiện theo Refinement03: reusable ProductRating nhận actual average/count; Preview missing-data mẫu5 sao/1 review có nhãn DEMO, Production không có review thật thìẩn. Không thêm review DB/aggregate giả.
- Typography shared storefront/PDP dùng đúng2 web fonts next/font/google: Cormorant Garamond500/600 (latin+vietnamese), DM Sans400/500/600 (latin+latin-ext), display swap/adjustFontFallback=false; root html chỉ khai báo CSS variables, không đổi body/global font nên Admin forms giữ nguyên. Wordmark600/34px/uppercase/.12em; nav500/13px; title500/clamp34–40px/1.08; editorial headings500/clamp44–52px; priceDM600/21px; summaryDM400/14px/1.65; labels600/12px/buttons600/12px/.04em/metadata-accordions13px. Warm ivory/espresso, gallery/layout/logic giữ nguyên.
- DM Sans upstream chỉ có latin/latin-ext và thiếu phần lớn ký tự Việt. Stack DM Sans → Cormorant Garamond → generic sans-serif giữ đủ dấu bằng font thứ2, không thêm font thứ3; một số chữ Việt trong body sẽ có nét serif. Kiểm tra cmap file WOFF2 đã build qua fontTools + Node Brotli: Cormorant104/104, DM Sans14/104 codepoints Việt được kiểm tra. Nguồn metadata chính thức: https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/METADATA.pb.
- Scope CSS module .page/.header; specificity override breakpoints để title không tăng36/giảm32 ngoài clamp. Không áp CSS font class vào body/Admin. No browser/pixel proof; Visual QA Pending Manual Review.

## Product Showroom — thiết kế ảnh2 (2026-10-22)
- Desktop một khung nhìn theo plan owner: ProductDetailView thêm informationBody từcategory đến hết4accordion; desktop>=901 height65vh/65dvh bằng gallery, overflow-y:auto/x:hidden, scrollbar thin/gutter stable/padding-end8px/scroll-padding8px/overscroll contain. Region có aria-label Thông tin sản phẩm/tabIndex0/focus outline1px. information bỏsticky/top/padding-top để căn đầu gallery, YouMayAlsoLike ngoài region vàCompleteLook dưới gallery. <=900 region auto-height/cuộn trang tự nhiên. Giữ gallery65dvh/panels37.5/25/37.5/fonts/buttons/price/review-policy data gates. Target1440×900CSS/100%, không cam kết pixel-fit khi chưa manualQA hoặc không có relateddata; Admin chrome/màn thấp vẫn page scroll.
- Gallery Visual Refinement02 chỉ CSS: giữ65vh/65dvh và panels3:2:3 (37.5/25/37.5 sau gap6px). Metadata read-only cover1122×1402≈4:5; nguyên nhân side gutters là cột1.35fr rộng hơn aspect ảnh với contain, không có padding main. Cột chính giới hạn theo width52dvh=65dvh×4/5 và57.45% khi thiếu ngang; contain/center giữ toàn bộ ảnh, không crop hoặc đổi binary. Rail68px desktop/64px<=1200/56px<=900/54px mobile, thumbnail vuông/gap9px/border chọn mảnh, top0/scroll nội bộ. Rail track dư7px + grid gap7px = khoảng14px từ thumbnail sang main; main→panel7px. Navigation36px tròn/arrow20px/gap8px/espresso#34251fb3/inset16px; counter10px. Caption inset16px desktop, breakpoint nhỏ giữ inset cũ. Mobile<=600 auto-height/rail ngang scroll/panels ngang giữ nguyên.
- Gallery refinement01 chỉ sửa product-detail.module.css dùng chung preview/public: desktop/tablet height65dvh (fallback65vh), theo65% chiều cao viewport thay vì clamp theo chiều rộng; main/panels cùng height, panels rows3:2:3/gap6px, gap cột7px. Layout1.857:1 (~65/35 sau gutter), gap24–44px; padding đầu trang10→6px/breadcrumb bottom10→6px/link30→28px. Rail64px desktop (48px<=1200,56px<=900), thumbnail1:1/gap8px/selected outline1px offset1px/internal scroll. Main object-fit contain, panels cover không stretch; tablet cùng65dvh, mobile<=600 auto-height/main4:5/rail ngang/panels3 ô. Typography thông tin/navbar/TSX/upload handlers/backend/DB/workflow không đổi.
- PDP dùng cùng ProductDetailView ở preview/production: gutter40px desktop, layout65:35/rail68px/main desktop65dvh/mobile4:5/panels3:2:3, ivory/espresso/serif title. Preview toolbar tách khỏi layout, không sidebar admin hoặc CSS button admin xâm nhập gallery.
- Placeholder là ô ảnh beige/ivory nguyên tỷ lệ, plus/text nhỏ; không dashed upload form. Edit affordance chỉ hover/focus hoặc touch, native dialogs edit/zoom. Mobile<=900 info dưới gallery,<=600 main full-width/thumbnail scroll/panels3 ô, order moves/swipe, no hardcoded reference photos.
- Step1 chỉ Next espresso#34251F, arrow/loading/disabled/native validation; Step2 save/status/publish confirmation. Ratings/free-shipping/returns promises trong ảnh mẫu không sao chép vì chưa dữ liệu. Related sections dùng real catalog, hide empty.
-92 unit/12 DB/3 SSR/lint/typecheck/build đạt; Visual QA Pending Manual Review, không claim pixel-match từ source/SSR.


## Giữ nav ban đầu ở hero (2026-10-22)
- Navbar storefront/sticky nền đặc #f3eee7, height64→56px; logo29→26px (mobile24px), menu12→11px/gap12–24px, search36→32px/width170–270px/text10px, icon23→20px/search16px. Giữ vùng bấm44px, breakpoint/menu/search/account logic và nav hero trong suốt cũ.
- Owner bổ sung homepage phần đầu phải giữ thiết kế nav cũ: overlay trong suốt80px/chữ ivory, hamburger và New In/Shop/The Edit/Journal, Search dạng link/account/bag; mobile72px/wordmark/menu như trước. Nav Women…AI Recommendations/search pill chỉ dùng ở sticky sau collection và các trang cửa hàng. Header auth/admin không đổi.
- StorefrontHeader có hai nhóm nav được CSS data-mode chọn; hiệu ứng scroll/rAF hiện hữu đồng bộ mode cho drawer, không thêm state render mỗi scroll. Hero/header/brand/links của nội dung trang không đổi.
- Chỉ storefront-header.tsx và homepage-header.module.css; lint/typecheck/build đạt. Không tests mới cho presentation restore hoặc DB/HTTP/browser/automation/screenshots. Visual QA Pending Manual Review. Next: owner refresh đầu homepage, cuộn xuống collection rồi trở lại và mở menu ở desktop/mobile.


## Nav cửa hàng theo ảnh2 — 2026-10-22
- StorefrontHeader dùng logo AUREL bên trái,6 mục Women/Men/Accessories/Essentials/Collections/AI Recommendations theo thứ tự, nền ivory gradient nhẹ64px; ô search pill, account thật, heart icon disabled khi wishlist chưa có backend và shopping bag. Menu mobile chứa đủ6 mục; account vẫn có trong mobile drawer. Homepage giữ hide/sticky lifecycle, storefront routes dùng cùng header page sticky; header auth/admin riêng giữ nguyên.
- Women/Men nối /products?gender=women/men: parse allowlist/reject repeated + Prisma profile.gender in selected/unisex, chỉ active products; Accessories thêm category slug hợp lệ, Essentials dùng slug hiện có. Không suy diễn gender từ tên hoặc backfill profile. Collections→/#collection, AI Recommendations→/#intelligence hiện hữu, không bật AI/recommendation engine.
- Search GET /search?q hoạt động theo catalog thật,<=100 chars; mobile nhỏ dẫn tới search page. Không tạo wishlist giả/route chết. Không sửa layout hero/sections, DB/schema/migrations/env/flags hoặc dữ liệu.
-90 unit tests (2 mới filter navigation), lint/typecheck/build đạt. Không DB suite vì chỉ parser/query-shape + UI, không HTTP/browser/automation/screenshots. Visual QA Pending Manual Review. Next: owner refresh homepage/products/search/cart/PDP và review desktop/mobile/drawer/search/account/nav filters/anchor scroll bằng dữ liệu thật.


## Ảnh sản phẩm đơn giản và tìm theo tên — 2026-10-22
- Card ảnh chỉ còn Thêm ảnh, Kho ảnh và thumbnail; bấm thumbnail chọn ảnh chính, nút thùng rác bỏ khỏi sản phẩm. Đã bỏ toàn bộ UI đường dẫn/alt/biến thể/thứ tự/loại/nguồn/quyền; metadata cũ vẫn được giữ trong draft/service khi không sửa.
- Kho ảnh có ô Nhập tên sản phẩm, tự tìm sau250ms và nút Tìm/Enter; query server theo tên sản phẩm đã lưu, không phân biệt hoa/thường, match substring literal (không fuzzy/AI/unaccent). Kết quả12/trang, không duplicate blob khi một ảnh gắn nhiều sản phẩm, query parameterized và ADMIN gate. Ảnh chưa gắn sản phẩm chỉ xuất hiện khi tìm trống; tên mới/edit có hiệu lực sau Lưu sản phẩm.
- Theo yêu cầu upload-only cho ảnh website, lựa chọn upload unknown khi lưu editor được ghi website=granted cùng reference sự kiện quản trị chọn hiển thị; không đòi nhập quyền thủ công, không tuyên bố có giấy phép sở hữu. Explicit denied và quyền AI giữ nguyên. Các ảnh static/import/API vẫn dùng validator quyền/reference cũ; public route vẫn kiểm tra active/quyền mỗi request, không backfill main.
- Bỏ ảnh đã lưu được đưa vào removedImageIds và lưu chung aggregate, kiểm tra version/ownership/overlap/100-row limit; transaction thất bại không mất ảnh hoặc nội dung draft. Chỉ xóa liên kết metadata, binary còn trong kho.
- Không schema/migration mới hoặc main data/env/security/auth changes. Main7/test9 migrations giữ nguyên.88 unit/11 PostgreSQL tests, lint/typecheck/build đạt; fixtures test cleanup/rollback và main fingerprint/env unchanged. Visual QA Pending Manual Review.


Menu tài khoản header admin (2026-10-22) dùng avatar SVG hình người/nền trắng tròn36px thay chữ Admin và mũi tên; target44px, aria-label/title và native details/AccountPanel thật giữ nguyên. Không dùng ảnh người giả hoặc thay auth. Lint/typecheck/build đạt; Visual QA Pending Manual Review.

Phần3 dùng chung heading với phần2 (2026-10-22): thanh nhấn3px bên trái trước huy hiệu, badge36px gradient/inset shadow, font20–26px/gap14px (mobile20px/gap12px); bỏ divider giữa số và chữ. Nút Thêm biến thể giữ nguyên. Lint/typecheck/build đạt; Visual QA Pending Manual Review.

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


## Thanh tiêu đề sản phẩm theo ảnh — 2026-10-22
- Breadcrumb và header/actions nằm chung titleCard ivory bo16px/viền nhẹ/shadow; khung cao tối thiểu150px/padding dọc26–28px và tiêu đề serif28–34px (điều chỉnh theo yêu cầu tiếp theo). Hủy nền trong/viền be, Lưu nháp be, Lưu sản phẩm espresso, icon save20px; responsive wrap actions tránh tràn. Hướng dẫn mặc định chuyển srOnly theo reference, thông báo thay đổi chưa lưu vẫn hiện khi dirty.
- Code src/components/admin/product-editor.tsx và products.module.css; giữ form association/submit intent/disabled/category guard/dirty confirmation và trạng thái loading. Không đổi backend/DB/schema/migrations/env hoặc header/sidebar vừa duyệt.
- npm.cmd run lint/typecheck/build đạt; không tests mới cho presentation, không DB suite/HTTP/browser/automation/screenshots. Visual QA Pending Manual Review.
- Tiếp theo: refresh /admin/products/new và edit; review khung/title/actions desktop/mobile, keyboard focus, dirty warning và submit Hủy/Lưu nháp/Lưu sản phẩm bằng dữ liệu thật.


## Sidebar ivory theo ảnh — 2026-10-22
- Sidebar quản lý sản phẩm thành card ivory bo26px/shadow nhẹ, lề18px; cột desktop280px, icon trong ô40px bo12px, active be gradient/viền ivory, headings16px và spacing thoáng. Trạng thái có chấm màu trong ô nền be; empty category/collection giữ dữ liệu thực. Mobile<=1000 vẫn collapse native details, không ép chiều cao ảnh reference.
- Chỉ sửa src/components/admin/products.module.css, giữ links/actions/data/permissions/header và các phần form. Không copy chữ N ở ảnh thành avatar/tài khoản giả.
- Lint/typecheck/build đạt; không tests mới cho presentation, không DB/schema/env hoặc runtime restart/HTTP/browser/automation/screenshots. Visual QA Pending Manual Review.
- Bước tiếp theo: refresh /admin/products/new, review sidebar desktop/mobile, active route, focus/collapse, danh mục/bộ sưu tập rỗng và có dữ liệu thật.


## Header admin espresso — 2026-10-22
- Theo ảnh owner gửi cho /admin/products/new: header64px nền espresso gradient nhẹ, logo/menu/icons màu ivory; grid desktop1fr–auto–1fr căn menu giữa và actions sát phải. Giữ responsive hiện có, menu account nền sáng/chữ tối và focus ring sáng trên header.
- Dùng shared AdminHeader của /admin/products và các trang con, gồm new/edit/import; không đổi header homepage/storefront, form hoặc dữ liệu. Code chỉ src/components/admin/products.module.css.
- npm.cmd run lint/typecheck/build đạt. Không tests mới cho CSS presentation, không DB/schema/env/runtime restart/HTTP/browser/automation/screenshots. Visual QA Pending Manual Review.
- Bước tiếp theo: owner refresh /admin/products/new, đối chiếu màu/khoảng cách desktop/mobile và mở account menu, kiểm tra keyboard focus.


## Sửa dropdown biến thể và ô màu — 2026-10-22
- Nguyên nhân từ source: .variantTable .pickerMenu dùng position:relative, menu nằm trong flow của ô và làm tăng chiều cao hàng khi mở. Đã bỏ override và dùng native Popover top layer/fixed cho shared OptionPicker, không giãn hàng hoặc bị khung cuộn ngang cắt; giới hạn theo viewport, đóng khi scroll khung ngoài/resize/Escape/click ngoài.
- Màu chuẩn có ô vuông14px cạnh tên ở giá trị đã chọn và danh sách nút chọn; có search, keyboard Tab/Enter, trạng thái selected, native required select giữ validation. Màu custom chưa có mã màu dùng ô trung tính dấu hỏi, không tự đoán từ label. Size/metadata vẫn dùng select native trong popup. Không sửa DB/migrations/taxonomy tokens/API hoặc layout storefront.
- Code: src/components/admin/product-editor.tsx, products.module.css. npm.cmd run lint/typecheck/build đều đạt; không thêm test mirror presentation, không DB suite hoặc browser/HTTP/screenshot. Visual QA Pending Manual Review.
- Tiếp theo: refresh admin, mở màu/size ở hàng đầu/cuối và nhiều hàng; kiểm tra không giãn/không cắt popup, swatches đen/trắng, search/empty/custom/Tab/Enter/Escape/click ngoài, cuộn ngang/mobile và required khi chưa chọn.


## Product Editor — nhóm đối tượng (2026-10-22)
Ô đường dẫn ở khối1 thay bằng nhóm hai select Giới tính – Độ tuổi trong cùng slot3 cột; chiều cao42px, radius7, gap8 và palette hiện có. Gender chuyển khỏi khối2 (còn7 dropdown), không thêm nhập trùng. URL chỉ đọc trong thông tin bổ sung; preview có nhóm tuổi. Không đổi storefront hoặc các card còn lại. Visual QA Pending Manual Review.


## ADMIN Product Editor — Phase2.9.3
Khối3 variantsCard theo ảnh: padding24/26/radius13, badge36px nền ivory và divider taupe trước title20–26px, add-button42px nền be. Bảng1250px tối thiểu trong overflow wrapper bo9, header be/padding15, inputs42px; color/size plus38x42, action buttons có copy/trash SVG. Native scrollbar theme trung tính, không vẽ scrollbar giả; mobile chỉ cuộn bảng bên trong. Không đổi card1/2 hoặc chức năng variant. Visual QA Pending Manual Review.
Khối2 metadataCard theo ảnh mới: padding24/26/radius13/nền #fcfaf7, heading/bar/badge dùng shared selector với infoCard. Dropdown42px/label13px bold/grid2 cột/gap20x30; plus44x42 nền #f1e8dd/border #e0cbb6/chữ #81542e. Chips33px, unselected ivory/border nhạt và selected espresso, add-pill viền taupe, tag rows gap18. <=560 một cột/padding14; không đổi khối1/3 hoặc backend. Visual QA Pending Manual Review.
Dropdown shared OptionPicker dùng chevron SVG18px/stroke1.8, màu #604b38, flex-none và margin-left:auto; open quay180 độ. Không dùng glyph phụ thuộc font và không đổi nút plus theo đính chính của chủ dự án. Visual QA Pending Manual Review.
Khối1 được cập nhật theo ảnh chi tiết: padding24/26, radius13, thanh dọc taupe/number gradient36, title bold20–26; icon prefix39px/inputs42px, label13px bold/red required; nút plus espresso, brand clear. Description toolbar nền ivory, vùng trắng180px, source/preview/history/expand; stylesheet scoped .infoCard nên card2/3 giữ thiết kế. PRODUCT_DESCRIPTION.md ghi giới hạn soạn thảo Markdown và manual QA.

Thay đổi chỉ scoped trong components/admin/products.module.css: nền ivory #f6f2eb, cards #fcfaf6, espresso #35281f, border beige #ded4c7, serif Georgia và font hệ thống hiện có. Đã có ảnh mẫu chủ dự án bổ sung: header admin64px/logo serif tracking, sidebar230/icon/active beige, content24px, aside332px/gap14; title35px serif và card title18px sans với số tròn. Info3 cột, metadata2 cột và pill selected espresso, add-image/grid ảnh chính lớn, preview ngang/notes; thu gọn sidebar<=1000, stack<=760/560, bảng biến thể cuộn nội bộ. Native dialog/details/search/select/chips, thumbnail grid/fallback và preview draft. Không sửa global tokens/homepage/frame/video/PDP hoặc thêm animation. StorefrontHeader chọn AdminHeader và Footer ẩn chỉ ở admin; nhánh header/footer storefront khác không đổi. Visual QA Pending Manual Review; reference đã được gửi trực tiếp bổ sung; chưa visual verification bằng browser. Checklist chi tiết tại PRODUCT_EDITOR.md.

## Quyền quyết định và trạng thái
- Expansion theo brief 2026-10-13: sau collection thêm divider stone CSS, search ivory, category 3 card lệch nhẹ, Edit 10 looks nền warm-neutral, Journal bất đối xứng và footer espresso. Dùng Times New Roman/Arial cùng palette hiện có; không thêm ảnh mới.
- Placeholder campaign có aspect ratio, hình khối CSS tông taupe/ivory và nhãn IMAGE FORTHCOMING; ảnh lỗi dùng cùng fallback. Category tái sử dụng local collection-demo và nhãn preview.
- Desktop Edit pinned dưới header 64px, image/copy 58/42, card 85vw tối đa 1260px; mobile 86vw scroll-snap, ảnh 4/3 trên copy. Reduced-motion dùng native carousel.
- Chủ dự án là người quyết định UI/UX. Không tự ý thiết kế lại hoặc thay bảng màu/kiểu chữ đã được duyệt.
- Warm Minimalist / Quiet Luxury và năm màu dưới đây là **định hướng ban đầu do chủ dự án cung cấp**, chưa phải bộ nhận diện cuối cùng.
- Header/hero trang chủ dùng AUREL theo brief và screenshot của chủ dự án ngày 2026-10-13. UI bên dưới và các tuyến khác vẫn giữ nhận diện Phase 0 tạm thời.

## Token
Phase2.8 PDP dùng tokens này, serif Times New Roman/Georgia và Arial; gallery3:4/object-fit contain bên trái, information bên phải115/100, mobile<=700 stack, không ảnh campaign làm ảnh hàng. Thumbnails64px, color/size controls>=44px, no extra animation; global focus-visible/reduced-motion giữ nguyên. Chỉ thêm title Link vào Catalog/Collection, không chỉnh card/reveal CSS. Phân tích source:1440 container max1240;768 inset24/grid2 cột;390/320 inset20/stack, min-width0/wrap cho text. Visual QA **Pending Manual Review**, không browser/screenshot trong Phase2.8.

Phase2.7 auth dùng đúng token bên dưới và ảnh campaign warm_toned_cinematic_fashion_duo.png đã có. Desktop split50/50, tablet42/58 (<=900px), mobile<=700px bỏ editorial panel; không thêm palette/font hoặc thay home CSS. Form input16px/min-height50, action52px, keyboard focus-visible kế thừa; border1px, hover opacity180ms và reduced-motion tắt. AuthHeader/Footer scoped giữ wordmark AUREL và serif Times New Roman/Georgia/Arial. Chưa visual QA1440/768/390/320 hoặc screenshot do Computer Use dừng URL confidence; thiết kế mới cần chủ dự án review.

Nguồn duy nhất: `src/app/globals.css`, khối `:root` và ánh xạ Tailwind `@theme inline`.

| Token | Giá trị | Vai trò |
| --- | --- | --- |
| `--background` | `#F4F0E9` | Warm Ivory, nền |
| `--foreground` | `#27231F` | Espresso Brown, chữ/nút |
| `--muted` | `#887260` | Muted Taupe, điểm nhấn/chữ lớn |
| `--white` | `#FFFFFF` | Soft White, nền input/chữ nút |
| `--surface` | `#E6D9C8` | Sand Beige, bề mặt |
| `--text-secondary` | `#66594C` | Chữ nhỏ dễ đọc hơn màu taupe |
| `--border` | `#D5CBBD` | Viền |
| `--content-width` | `1240px` | Chiều rộng nội dung tối đa |

Màu phụ của minh họa và danh mục nằm cùng tệp CSS, không nằm trong component. Không dùng chúng để biểu thị dữ liệu tồn kho.

## Chữ, bố cục và tương tác
- Heading/wordmark dùng Georgia, Times New Roman, serif; thân bài dùng Arial, Helvetica, sans-serif. Không tải font từ dịch vụ ngoài.
- Hero AUREL: CSS module riêng, desktop grid 62/38 và cột phải 54/46; 100svh với fallback 100vh, min-height 660px. Brand absolute ở giữa toàn hero, không phụ thuộc cột trái.
- Tablet portrait 768–1023px: ảnh chính trên, hai ảnh phụ dưới; landscape giữ bố cục desktop. Mobile <768px: ba ảnh dọc, brand trên ảnh chính, header gọn. Khoảng đệm panel 24px trên mobile.
- Header trang chủ trong suốt, icon SVG nét mảnh, native dialog hỗ trợ focus containment/Escape. Header cũ giữ nguyên ở tuyến phụ.
- Hero dùng Times New Roman/Georgia; UI dùng Arial. Chưa có tệp font Didone được cung cấp, nên chưa thể khẳng định typography khớp tuyệt đối.
- `ActionLink`: liên kết dạng nút chính/phụ, dùng lại toàn trang; retry dữ liệu thực hiện yêu cầu trang mới.
- `EmptyState`: biểu tượng trang trí, tiêu đề, giải thích và hành động rõ ràng; trạng thái catalog/search/cart có nội dung riêng.
- Form có label thật, GET để hỗ trợ URL và hoạt động không cần JavaScript.
- Skip link, focus-visible, landmarks và thứ tự heading; chuyển động tôn trọng reduced-motion.
- Hero dùng ảnh gốc qua next/image; gradient nhẹ theo panel, object-position riêng, hover zoom 1.03 trong 700ms và underline; reduced-motion tắt zoom/transition. Không coi ảnh campaign là dữ liệu sản phẩm.

## AUREL Intelligence — brief 2026-10-13
- Cập nhật 2026-10-13: riêng “SUIT YOU” dùng strong/font-weight 700; “WHAT” giữ 400, cả dòng giữ italic champagne.
- Video cập nhật2026-10-22: giữ wrapper16:9/contain/overlay30%/palette/layout/CTA và video nén tối ưu. Không có nút Play/Pause hiển thị; click khung/Enter/Space vẫn điều khiển playback. Theo yêu cầu mới nhất, không che hoặc blur chữ góc video; gỡ cả mask/gradient góc. Poster/reduced-motion/error fallback giữ nguyên. Visual QA Pending Manual Review.
- Theo yêu cầu luxury 2026-10-13: nằm ngay sau hero và trước collection. CTA viền champagne 45%, nền đen 24%, chữ ivory, radius 9999px, padding 15px 24px, 13px/400; hover champagne 12%/250ms và arrow translateX(3px). Đích tạm /search.
- Split 58/42, align center, nội dung trái; không height/min-height theo viewport. Padding 36–80px, max-width 1680px; dưới 768px video trên, text dưới, gap 32px.
- Espresso #352A25 và radial glow champagne 6%, ivory #F6F0E7, champagne #DEC5A2. Heading Times New Roman/Georgia 400, clamp(23px, 10.5cqi, 66px); dòng thứ hai italic champagne. Eyebrow uppercase 10–12px tracking .16em kèm đường mảnh 28px; mô tả #D9CFC3 line-height 1.85.
- Copy giữ nguyên ảnh người dùng. Nội dung không phụ thuộc dữ liệu; IO reveal 14px/650ms một lần, reduced-motion và focus-visible được giữ. Chưa QA trực quan thiết kế luxury.

## Giới hạn và thay đổi tiếp theo
- Ba ảnh campaign đã có trong public/images/aurel và HTTP tải thành công; hero vẫn chờ browser QA. Không dùng screenshot làm nền hoặc tạo ảnh thay thế.
- Cần chủ dự án duyệt nhận diện và kiểm tra trực quan trên thiết bị thực trước khi chốt giao diện.
- Mọi thay đổi nhận diện sau này cần ghi ngày, nguồn quyết định và token/component chịu ảnh hưởng tại đây.

## Collection được yêu cầu ngày 2026-10-13
- Spacing cập nhật theo yêu cầu 2026-10-13: section padding dọc 56/72px desktop, 40/56px mobile; heading cách filter 36px desktop/28px mobile; tabs margin-bottom clamp(32px, 4vw, 56px). Grid gap hàng/cột 56/32px desktop, 44/24px tablet, 36/16px mobile; details margin-top 24/16px và line-height 1.5; CTA cuối margin-top 48/36px.
### Fashion discovery bổ sung
- Search cùng nền panel #F6F2EB, input #FFFDFA, border #C5B7A8, chữ #241C18/#6F6258, radius 2px, max-width 800px. Heading serif 30–48px; mobile 27–38px, input 16px tránh zoom tự động.
- Icon nét mảnh, Explore bên phải, suggestions text button min-height 44px wrap. Không thêm pinned sequence; IO riêng cho fade headline và translate input 16px, tắt khi reduced-motion, focus-within luôn hiện.
- UI công khai demo keyword search, không AI recommendations. Không đổi tokens/CSS của hero hoặc collection.

- Panel #F6F2EB, chữ #241C18/#6F6258; clip-path mở mép 4% mỗi bên về 0, không scale chữ. Hero được giữ nguyên làm lớp nền sticky trên desktop, flow bình thường ở mobile/portrait/reduced-motion.
- Heading Times New Roman/Georgia clamp 2.5rem–4.5rem; metadata tracking .17em. Grid 4 cột desktop, 3 ở tablet rộng 900–1023, 2 ở tablet hẹp/mobile; frame 3:4.
- Collection dùng catalog PostgreSQL từ 2026-10-20; giữ khung ảnh/tên/giá, tabs, reveal và CTA hiện có. DB rỗng dùng notice có sẵn, lỗi dùng CatalogContent; không điền ảnh/giá demo thay thế. Không thêm wishlist hoặc detail link giả. Editorial lookbook độc lập giữ nguyên nhãn concept.
- Hover ảnh 1.03/600ms; heading 500ms; cards opacity/20px translate 600ms, stagger 90ms, reveal đảo khi scroll ngược; giảm chuyển động tắt toàn bộ hiệu ứng này.

## COLOUR & SIZE động — 2026-10-23
Giữ hai font/palette/layout. Preview-only +22px cạnh legend, native dialog label/close/Escape; màu có tên/HEX/preview. Swatch tròn, size vuông, selected state, transition140ms/reduced-motion. Demo note/reset phân biệt local data; không tạo giá/tồn kho giả. Không redesign title/gallery/Complete the Look. Visual QA: Pending Manual Review. Xem [DYNAMIC_VARIANTS.md](DYNAMIC_VARIANTS.md).
