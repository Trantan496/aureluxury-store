# Complete the Look thủ công / Pending intake — 2026-10-23

> Bố cục hiện tại (2026-10-23, theo hình số2): cột giới thiệu min140px/22%, gap20px; rail dùng hết phần còn lại, bốn thẻ đều nhau với gap12px (min120px), không cap width cố định theo viewport height. Ảnh/ô thêm12:13, cover căn giữa phía trên để phủ kín khung thay các dải trống của contain; chiều cao tự theo tỷ lệ, không ép height rồi giãn ngang. Heading36px, mô tả13px, CTA140×34px; tên/giá11px, dấu+26px bên phải metadata. Tablet<=900 ba ô, mobile44%/thẻ; dữ liệu món thứ5+ vẫn cuộn được. Scrollbar ẩn, controls Admin nhẹ và success message không tạo footer, lỗi vẫn hiển thị. Gallery63vh và panel3:2:3/API/DB/autosave không đổi. Visual QA: Pending Manual Review.
> Cập nhật 2026-10-23 — Complete the Look sửa trực tiếp và tự lưu: bấm/thả một ảnh vào khung ảnh cover/top, bỏ ảnh tại góc; bấm tên/giá để sửa, blur/Enter tự lưu, Escape hủy phần chữ đang sửa. Hàng đợi từng thẻ giữ version tuần tự, lỗi giữ dữ liệu/tệp và chờ retry tường minh. Thẻ mới nhận focus; hoàn thiện chỉ bật khi đủ ảnh/tên/giá đã lưu. Nền kéo sát mép trái bằng pseudo-element, chữ căn lề gallery, mép phải giữ nguyên. Gallery thay hàng nút lớn bằng menu thumbnail nhỏ Xóa/Đưa lên trước/Đưa về sau, giữ kéo sắp xếp và hỗ trợ thả tệp vào các slot. Không migration/main write; gallery desktop63vh/panels37,5/25/37,5/navbar/publish giữ nguyên. Visual QA: Pending Manual Review.
> Deployment 2026-10-23: Main aurel_ai: 9 reviewed migrations applied with owner approval; test: 11. PendingProduct is available; the two taxonomy migrations remain pending. No existing product data, sequences or .env changed.
## Hiện trạng

Complete the Look thủ công đã code/test: nútThêm món trong Preview tạo PendingProduct blank/idempotent ngay; inline autosave ảnh/tên/giá VND, formHoàn thiện chọncategory/variants thật→existingShowroom→explicitpublish. Queue /admin/products/pending phân trang20, source link; source-look hàngngang/pagination20/khôngcap4. Public chỉ linked child đãpublish/cópublicimage+price, archiveẩn; detach giữqueue/product, parent khôngunpublish/touch. YouMayAlsoLike bỏcategoryheuristic, Preview Chờ AI Recommendations/Productionẩn khiAIchưa có. Main aurel_ai: 9 reviewed migrations applied with owner approval; test: 11. PendingProduct is available; the two taxonomy migrations remain pending. No existing product data, sequences or .env changed.

Đã giữ gallery65vh/65dvh, panels37.5/25/37.5, informationScroller, navbar/fonts/purchase/currency/auth/workflow. Không tự tạo sản phẩm main hoặc danh mục/size/tồn kho giả.

## Cách dùng và lifecycle

1. ADMIN mở /admin/products/[id]/preview, Complete the Look luôn cóThêm món kểcảtrống. Mỗi click tạo1queueblank;UUIDrequestKey dùnglạikhi retry, serverboundactor+source/unique/advisorylock/Serializable.
2. Cập nhật 2026-10-23 — Complete the Look sửa trực tiếp và tự lưu: bấm/thả một ảnh vào khung12:13 cover/center, bỏ ảnh tại góc; bấm tên/giá để sửa, blur/Enter tự lưu, Escape hủy phần chữ đang sửa. Hàng đợi từng thẻ giữ version tuần tự, lỗi giữ dữ liệu/tệp và chờ retry tường minh. Thẻ mới nhận focus; hoàn thiện chỉ bật khi đủ ảnh/tên/giá đã lưu. Nền kéo sát mép trái bằng pseudo-element, chữ căn lề gallery, mép phải giữ nguyên. Gallery thay hàng nút lớn bằng menu thumbnail nhỏ Xóa/Đưa lên trước/Đưa về sau, giữ kéo sắp xếp và hỗ trợ thả tệp vào các slot. Không migration/main write; gallery65vh/panels37,5/25/37,5/navbar/publish giữ nguyên. Visual QA: Pending Manual Review.
3. Queue /admin/products/pending liệt kêpending20/trang, nguồnproduct; /pending/[id] mở ProductEditor existing, nameprefill, category chưachọn/khôngvariant tựtạo. BấmThêm biếnthể lầnđầuprefillgiáVND đãnhập, cóthểđổi. Ảnhqueue chuyển thànhcover khiNextconvert.
4. Convert reusepersist validator(code/slug/taxonomy/variant/prices/images), tạoProductunpublished+ProductImage+markconverted trong1transaction. LockpendingID+retry đảm bảonetwork/concurrentchỉ1Product; converted replay trảcùngID khôngghiđè. Sauđó normalStep1/edit/Next/Showroom/SaveDraft/Publish nhưcũ.
5. Convertedcard đọcname/price/image từProductthật, khôngsnapshotgiácũ; mởnormaledit. Sourceactive khôngbịđổitrạngthái hoặcversion vìlookcuration. Bỏkhỏioutfit chỉsetsourceProductIdnull/revision++, khôngxóaqueue/product. Queueorphan vẫnhoànthiệnđược.
6. Public chỉsourceactive+convertedlinkedchildactive, ảnhwebsitegranted/reference vàcurrencyprice cóthật; đọcnormalProductDetail, khôngtrảPendingDTO. Khiarchivechild/publicảnhprivate/noVND thìẩn; linktớiPDPthật. Loader lỗi hoặcschema chưaapply trảlookrỗng, khôngcrashPDP.
7. Onehorizontalrail/nativetouchscroll, arrows vàTải thêm20món, khôngslice4. AI nhánh tươngtựreturn[] cócommentseam; không tạoalgorithm hoặcmanualsimilar UI.

## Schema và dữ liệu

- New PendingProduct: id/requestKeyunique/createdById/sourceProductIdnullable/productIdunique nullable/statepending-or-converted/name/proposedPriceNUMERIC/imageAssetId/revision/createdAt. Creationorder=id; FKsource/resultSETNULL, assetRESTRICT. ConversionclearassetFK saureferencechuyểnsangProductImage. Không nớilỏngProduct.categoryId hoặc tạoPlaceholdervariants.
- pendingAvailable checks to_regclass: mainoldschema queue unavailablegraceful/publicempty, gallerycleanupkhôngreference tablechưacó. cleanupAsset kiểmtraProductImage vàPendingProduct trướcxóablob.
- SQLmigration `20261023090000_complete_look_pending`, SHA256LF `4a046c1294584e9c45489fa84001d5317cd89d28866585beea5c67be329a6e6f`. Chỉnewtable/index/FK/check/sequence; không UPDATE dữliệucũ/roles/grants.
- Test11SQL applied; main9 SQL applied theo phê duyệt. Hai taxonomySQL20261022160000/161000 vẫn pending riêng.

### Tự lưu từng trường và API patch (2026-10-23)

- `POST /api/admin/look`, operation `patch`, nhận `id`, `version`, `input` chỉ gồm các trường được sửa: `name` (chuỗi/null), `price` (VND nguyên/null), `removeImage: true`. Không có trường và không có ảnh thì từ chối. Không cho sửa hàng chờ đã chuyển đổi.
- Ảnh raw dùng `x-pending-operation: patch`, `x-pending-id`, `x-pending-version`; không cần gửi tên/giá. Luồng save đầy đủ cũ vẫn được giữ để tương thích. Auth/origin/version được kiểm tra trước khi đọc và giải mã ảnh; giới hạn8MB/định dạng cũ giữ nguyên.
- PendingAutosave xếp request tuần tự, dùng version từ lần lưu thành công gần nhất; lỗi dừng đầu hàng đợi. Retry do người dùng bấm sẽ đọc version mới rồi gửi lại nội dung giữ cục bộ, không tự ghi đè sau conflict. Retry không được chuyển tiếp sang Product đã hoàn thiện.
- Bỏ ảnh đặt imageAssetId=null trong transaction, tăng revision và cleanup chỉ khi hết mọi tham chiếu. Không xóa tên/giá/thẻ/Product; không cần thay schema nullable hiện có.
- Giao diện không còn file input/form dài hoặc nút Lưu món. Nút+ dưới thẻ dẫn tới Hoàn thiện khi dữ liệu đã lưu đủ; thẻ converted vẫn mở form Product thật. Trạng thái lỗi/thử lại được thông báo bằng role=status.
- Gallery: menu native dialog neo vào nút thumbnail, Escape/Đóng đóng menu; thumbnail kéo nội bộ dùng data type riêng, Files chỉ upload khi thả vào slot. Xóa dùng API cũ và chọn ảnh kế bên, hết ảnh hiện placeholder; sản phẩm đang publish vẫn khóa chỉnh gallery.
- CSS: lookPanel::before dùng product-page-edge để bleed nền trái; photoEdit/removePhoto/inlineDetails/inlineText/completeCard/cardUtility thay form. Gallery thêm thumbItem/thumbMenuButton/thumbMenu và drop outline; không đổi height65dvh hoặc các hàng3:2:3.
- Kiểm tra:97 unit (thêm4 bài serial/retry/converted),13 DB,10 SSR, lint/typecheck/build đạt; main fingerprint/.env không đổi. Build lần đầu dừng ở cảnh báo bảo mật Next16.4.0 sau compile/routes; retry thành công, cảnh báo chưa xử lý. Không browser/HTTP visual test. Native picker/drop/keyboard và căn mép pixel cần review thủ công.

## API và routes

| Route | Behavior |
|---|---|
| GET /api/admin/look?sourceId=&page= | Adminlookentries mọi trạngthái,20/trang |
| GET /api/admin/look?page= | Pendingqueue toàncục20/trang |
| GET /api/admin/look?id= | Adminread/refresh1card |
| POST /api/admin/look | create/save/patch/detach/convert; allowlistedJSON, version/source/requestKey/input |
| POST /api/admin/look rawimage | pendingSave với x-pending-id/version/name/price, nameURIencoded; auth/versiontrướcbody |
| GET /api/products/[slug]/look?page=&currency= | Public published/linkedcards only,20/trang, defaultcurrencyrulescũ |
| /admin/products/pending | Queue |
| /admin/products/pending/[id] | Complete existingProductEditor, convertedopensrealedit |

MutationsreuseProductService.run/sessionexpiry/DBADMIN/Serializable; APIorigincheck/boundedbodies/status/no-store/nosniff. Noextraanonymousadminaccess. No APIwrite quantity/order/cart.

## Files chính

- UInew complete-look.tsx/.module.css, admin/look-client.ts/pending-products.tsx; updateProductDetailView/ProductShowroom/ProductEditor/Sidebar,2pendingpages.
- Backendnew pending.ts/pending-types.ts/asset-cleanup.ts,2APIroutes; updateproduct-service(showroomcleanup)/management(exportpersist)/product-relatedmanualreader.
- Prisma schema+SQL/reviewmanifest, guardedrunner & main-look-migration.ts; newproduct-pending.integration.test.ts, expandedSSR, legacyadminintegration assertionVND cậpnhật đúngbehaviorfixtrước.

## Validation và evidence

- Prisma generate/typecheck/lint đạt.93unit/13PostgreSQL gồmparent/10NodeSSR đạt. Testfixturescleanup/rollback, mainreadonlyfingerprint và.envunchanged;pgqueue deprecationcũ khôngfail.
- PostgreSQL newtest:concurrent/retrycreate22uniqueentries,20+2pagination;anonymous/customerdeny-before-image-read;price/invalidimage/stalevalidation;faultassetinsert rollback;freshconnectionpersistence;pendingassetprotectgallerycleanup;faultproductcreated-before-markconverted rollback;concurrentconvert1child;publicdraftprivate/publishshow/archivehide;AIempty;detachkeepsproduct/queue;sourceversion/dataunchanged.
- SSR>4actualcards/emptyPreviewAdd/AIplaceholder/publicnointakecontrols/pendingform/completionlink/convertedlink; existing8tests sharedUI/metadata/rating-policygates/disabledpurchase preserved.
- Build: codecompiled/routesgenerated; firstexit1 doNextsecuritycheck, repeatexit0vớiwarning Next16.4.0 affectedknownvulnerability. Khôngauto-upgradedependencies. Cần review/nângcấpbảo mật Next riêng trướcproductionreadiness; khôngetclaimsecurityGO.
- Backupverifiedrestore `aurel_ai_restore_test_20261022174748_9a7c3f`, archiveSHA8bb542637b2b179d26553df4dfeb4017460e3c894a07e55fe50c7cbfd9ea46d1. Scopedrunner selects9SQLmain+newtable, excludes2taxonomy. Report .local/backups/*9a7c3f.look-rehearsal.json: noDrift/rehearsalPassed/mainUnchanged/pendingApproval=true.
- Mainapplycầnapprovalriêngtheoplan: lấybackup/restore mới, chạy main-look-migration.ts freshrestore --confirm-main=aurel_ai, readonlypostcheck vàreloadđúngNextPrismaclient. Khôngreuserestore đãrehearsal hoặcgenericdb:migrate.

## Manual review / giới hạn

Visual QA Pending Manual Review. Khôngbrowser/TestScreen/ComputerUse/Playwright/HTTPQA/screenshots. Chưachứngminhnativepicker/drag/touch/bộcuộnhoặcpixelmatch. Main feature enabled after owner approval and scoped migration; khôngtựnhậpfixturesmain. AIrecommendationengine/cartcheckout/backendreviews/policies vẫnngoàitask. PubliclookN+1bounded20reads cầnmonitor/tốiưu sau nếu cótraffic; price/basecurrency vàpublicimagegates giữnguyên.

## Approved deployment / 2026-10-23

- Fresh verified backup/restore: `aurel_ai_restore_test_20261022175144_6c8443`; archive SHA256 `07f886e861a4e893f5fe9bb6653a232b43b7d262a3b22538dfeb4b9210c494c3`.
- Applied only `20261023090000_complete_look_pending`. Main history 9; test history 11. Two taxonomy migrations untouched.
- Initial postcheck incorrectly compared the newly added sequence against the old sequence map. Fixed runner to compare existing sequences separately and assert the new sequence is unused. No second migration deployment. Read-only recovery reconstructed the pre-apply restore fingerprint and matched the verified backup, then confirmed schema, original rows/sequences and empty PendingProduct.
- Evidence: `.local/backups/aurel_ai_restore_test_20261022175144_6c8443.look-migration.json`. Existing data and .env preserved, no main fixtures.
- Reloaded only workspace Next dev on port3000 (old launcher10944/child29480, new launcher33376). Initial hidden launcher did not remain running; restarted in managed terminal session47729, Ready in871ms. No browser or HTTP QA.
- Next action: manual Admin Preview Add/Save/Queue/Complete/Publish review using real products. Visual QA: Pending Manual Review. Existing Next security warning remains unresolved.
