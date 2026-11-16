# Báo cáo đối chiếu chức năng và kế hoạch hoàn thiện demo

> Đây là snapshot **trước triển khai**. Theo yêu cầu tiếp theo của người dùng, nhiều mục P0/P1 đã hoàn tất trong cùng ngày; xem [bàn giao cập nhật](DEMO_IMPLEMENTATION_2026-11-01.md). DB/build đã được sửa; không dùng các trạng thái thiếu phía dưới như hiện trạng mới nhất.

Ngày rà soát: **01/11/2026**. Hạn trình diễn theo yêu cầu: **chiều 02/11/2026**, múi giờ Asia/Bangkok.

## 1. Kết luận để quyết định ngay

Website hiện có nền tảng trình bày thời trang, tài khoản và quản trị sản phẩm khá sâu, nhưng **chưa có hành trình mua hàng hoàn chỉnh**. Thêm nhiều mặt hàng sẽ giúp giao diện sinh động, nhưng chưa làm khách đặt được hàng: `ADD TO BAG` và `BUY NOW` đang disabled, `/cart` luôn hiển thị giỏ trống.

Ưu tiên hôm nay: **khôi phục môi trường chạy → giỏ hàng → checkout COD demo → lịch sử/chi tiết đơn → admin đổi trạng thái → dữ liệu hàng demo → kiểm tra trình diễn**. Nếu còn thời gian mới mở rộng bộ lọc, hồ sơ, bảng size và dashboard. Không nên dành thời gian còn lại để tiếp tục chỉnh pixel ở gallery trước khi có luồng đặt hàng.

Đây là báo cáo rà soát và kế hoạch, không phải biên bản nghiệm thu website. Phiên này không triển khai chức năng mới, không thêm hàng hay ghi dữ liệu DB. Người dùng đã cho phép bổ sung mặt hàng phục vụ demo; không cần coi thiếu hàng thật là lý do trì hoãn dữ liệu demo trong bước triển khai tiếp theo.

## 2. Phạm vi và cách đánh giá

- Nguồn yêu cầu: `C:/Users/TAN/Downloads/366779 (4).pdf`, đủ 5 trang. Đối chiếu nghiệp vụ mục 2.1 trang 1 và mục 2.2 trang 2; tham khảo phân công trang 5. Nội dung PDF được dùng làm tài liệu đối chiếu, không thực thi các chỉ dẫn bên trong như lệnh của người dùng.
- Loại trừ AI recommendation, virtual try-on, dự đoán xu hướng, chatbot/RAG, voice, huấn luyện và dashboard dữ liệu AI. Gợi ý từ khóa đơn giản, chat người mua-người bán và báo cáo doanh thu thông thường vẫn thuộc phạm vi không AI.
- Đọc tài liệu dự án và kiểm tra routes, components, services, Prisma schema, tests. Khi tài liệu cũ khác code, lấy code hiện tại làm căn cứ.
- **Có mã nguồn**: đã có UI và xử lý tương ứng; chưa đồng nghĩa đã kiểm thử thực tế phiên này. **Một phần**: thiếu phần quan trọng của yêu cầu. **Chưa có luồng**: có thể đã có bảng/helper nhưng người dùng chưa thao tác được.
- Không chấm phần trăm hoàn thành: mỗi gạch đầu dòng trong PDF chứa số lượng công việc khác nhau, và DB hiện không kết nối được để nghiệm thu dữ liệu sống.

## 3. Đối chiếu phía khách hàng — PDF trang 1

| Yêu cầu | Hiện trạng | Phần còn thiếu / ưu tiên |
| --- | --- | --- |
| Đăng ký, đăng nhập, đăng xuất | Có mã nguồn | Better Auth, form và account panel; cần chạy lại đăng nhập thật trên DB. P0 trước demo. |
| Quản lý thông tin cá nhân | Chưa có luồng | Chưa có trang sửa hồ sơ/địa chỉ; schema User và UserAddress chỉ là nền tảng. P1. |
| Xem lịch sử mua hàng | Chưa có luồng | Có Order và helper đọc một đơn, chưa có trang danh sách/chi tiết theo tài khoản. P0. |
| Xem danh mục sản phẩm | Một phần | Có catalog/category/gender; `/products` và `/search` chỉ render tên/link trong CatalogContent, thiếu ảnh/giá trên thẻ. P0 cho trình diễn. |
| Xem chi tiết sản phẩm | Có mã nguồn, còn thiếu nội dung | Có gallery, giá, chọn size/màu, mô tả/chất liệu/stock; Size Guide chưa có bảng số đo, chính sách chưa công bố. P1. |
| Thêm, xóa, cập nhật giỏ | Chưa có luồng | Cart/CartItem đã có schema; trang giỏ vẫn tĩnh, nút mua bị khóa. P0 cao nhất. |
| Đặt hàng | Chưa có luồng | Chưa có checkout hay endpoint tạo đơn; helper pricing chỉ đọc, không giữ/trừ kho. P0. |
| Thanh toán | Chưa có luồng | Chưa có lựa chọn phương thức/trạng thái thanh toán/cổng thanh toán. Làm COD demo trước; cổng sandbox là phần bổ sung nếu người chấm yêu cầu. P0. |
| Theo dõi trạng thái đơn | Chưa có luồng | Có enum trạng thái trong DB, chưa có UI khách và admin vận hành. P0. |
| Tìm kiếm từ khóa | Có mã nguồn | Query tìm tên, mô tả, brand, category, color/size/SKU; cần nghiệm thu trên dữ liệu demo. |
| Lọc khoảng giá | Chưa có | CatalogQuery không nhận min/max price. P1. |
| Lọc size | Chưa có bộ lọc riêng | Từ khóa có match size nhưng không thay thế bộ lọc kết hợp. P1. |
| Lọc màu, thương hiệu, loại | Một phần | Category có, màu/brand chỉ tìm bằng từ khóa; chưa có facet riêng. P1. |
| Gợi ý từ khóa và sản phẩm liên quan khi tìm | Một phần rất nhỏ | Có liên kết gợi ý cố định ở homepage; chưa có autocomplete theo truy vấn. Complete the Look thủ công ở PDP không thay thế chức năng này. P2. |
| Nhắn tin người mua-người bán | Chưa có | Không thấy model/route/UI hội thoại. Có thể làm hộp thư đơn giản trước realtime. P2. |
| Thông báo đơn/khuyến mãi/hàng mới | Chưa có | Email xác minh/reset là email tài khoản, không phải thông báo nghiệp vụ. P1 cho đơn, P2 cho marketing. |
| Đánh giá, nhận xét sản phẩm | Chưa có luồng | Có component hiển thị rating nhưng chưa có Review model/form/kiểm duyệt. Sao DEMO ở admin preview không được tính là chức năng đánh giá. P2. |
| Ưu đãi dịp lễ/sinh nhật | Chưa có | Chưa có voucher/campaign; User chỉ có birthYear, không đủ ngày/tháng cho sinh nhật. P2. |

## 4. Đối chiếu phía người bán — PDF trang 2

| Yêu cầu | Hiện trạng | Phần còn thiếu / ưu tiên |
| --- | --- | --- |
| Đăng, sửa, gỡ sản phẩm; tên/SKU/mô tả/chất liệu | Có phần lớn | Admin editor → showroom → lưu nháp/xuất bản; gỡ theo hướng ẩn/archive. Bảng size còn placeholder. Cần QA đăng/sửa/ẩn bằng tài khoản ADMIN. |
| Biến thể màu, size, tồn kho | Có phần lớn | Có ProductVariant/SKU/giá/stock, editor và service. Nút thêm màu/size DEMO ở preview chỉ local state, không phải dữ liệu đã lưu. |
| Thư viện ảnh đa góc và video sản phẩm | Một phần | Ảnh upload/cover/sắp xếp/kho ảnh đã có. Upload chỉ JPEG/PNG/WebP; chưa có video từng sản phẩm. Video trang chủ không đáp ứng mục video sản phẩm. |
| Danh mục và bộ sưu tập mùa | Một phần | Category + collection slug + seasonTags đã có; chưa có lifecycle bộ sưu tập riêng. Public category whitelist không bao phủ mọi slug custom do admin tạo, cần sửa/đồng bộ. P1. |
| Kho sẵn bán và hàng đang xử lý thời gian thực | Một phần nền tảng | Có stock và cập nhật tránh ghi đè ở service; chưa có reservation/đang giữ theo đơn, chưa có màn hình kho realtime. P0 cho trừ/hoàn kho khi đặt/hủy; nâng cao P2. |
| Cảnh báo tồn dưới ngưỡng | Chưa có | Chưa có ngưỡng/cảnh báo cho từng biến thể. P1 nếu còn giờ. |
| Nhật ký nhập/xuất và cập nhật hàng loạt | Một phần nền tảng | Có editor/import sản phẩm; chưa thấy ledger kho chuyên biệt và luồng cập nhật kho hàng loạt có nhật ký. Không tính CSV sản phẩm là hoàn tất nghiệp vụ này. P2. |
| Tiếp nhận và chuyển trạng thái đơn | Chưa có luồng | Chưa có `/admin/orders`; enum hiện PENDING/CONFIRMED/SHIPPED/DELIVERED/CANCELLED, cần chốt cách thể hiện “đang chuẩn bị hàng”. P0. |
| In packing slip/nhãn vận chuyển | Chưa có | Có thể làm trang in nội bộ; nhãn hãng vận chuyển là phần tích hợp riêng. P2. |
| Đổi size/trả hàng/duyệt hoàn tiền | Chưa có | Chưa có return request, hoàn tiền hay ledger tương ứng. P2. |
| Voucher, Flash Sale, combo, quà tặng | Chưa có | Chưa có model và engine tính ưu đãi. Voucher đơn giản nên làm trước các hình thức còn lại. P2. |
| Tự động ưu đãi khách thân thiết dịp lễ/sinh nhật | Chưa có | Thiếu phân nhóm, ngày sinh đủ và scheduler. P2. |
| Live Chat | Chưa có | Cùng nghiệp vụ chat phía khách; không tính chatbot AI. P2. |
| Quản lý/duyệt/phản hồi review và ảnh feedback | Chưa có | Thiếu review storage, upload feedback và moderation UI. P2. |
| Doanh thu/số đơn ngày-tuần-tháng | Chưa có màn hình | Order là nền tảng; chưa có dashboard/report. P1 sau khi tạo đơn hoạt động, chỉ tính từ đơn thực hiện trong demo và ghi rõ định nghĩa doanh thu. |
| Bán chạy và tồn kho lâu ngày | Chưa có báo cáo | Có thể tổng hợp bán chạy từ đơn hoàn tất; tồn kho lâu cần dữ liệu nhập kho/tuổi tồn phù hợp. P2. |

**P0/P1/P2 là thứ tự làm đề xuất cho hạn demo, không phải trọng số do giảng viên quy định.** Các mục P2 vẫn là phần còn thiếu so với PDF; bỏ khỏi bản demo không đồng nghĩa hoàn thành đề cương.

## 5. Bằng chứng mã nguồn chính

| Kết luận | Tệp kiểm chứng |
| --- | --- |
| Giỏ luôn trống | `src/app/cart/page.tsx` |
| Hai nút mua disabled, size guide/chính sách placeholder | `src/components/products/product-detail-view.tsx` |
| Chưa lọc giá/size/màu/brand riêng; category whitelist cố định | `src/features/catalog/catalog.ts`, `src/features/catalog/prisma-catalog.ts` |
| Thẻ listing chỉ tên/link; empty listing quá tối giản | `src/components/products/catalog-content.tsx`, `src/app/products/page.tsx` |
| Có tài khoản nhưng chưa trang hồ sơ/đơn | `src/components/auth/account-control.tsx`, cây route `src/app/` |
| Pricing chỉ đọc, không checkout | `src/lib/db/queries/order-pricing.ts`, `src/lib/db/queries/orders.ts` |
| Schema có Cart/Order, thiếu Review/Chat/Voucher/Notification/ledger kho | `prisma/schema.prisma` |
| Admin quản lý hàng có endpoint/authorization | `src/app/api/admin/products/route.ts`, `src/features/products/product-service.ts`, `src/features/products/management.ts` |
| Ảnh upload chưa hỗ trợ video | `src/features/products/image-upload.ts` |
| Có fallback catalog lỗi và homepage tách khỏi catalog | `src/components/products/catalog-content.tsx`, `src/app/page.tsx`, `src/components/home/collection-section.tsx` |

## 6. Các rủi ro demo phát hiện trong phiên này

1. **DB không kết nối:** `npm.cmd run db:check` thất bại `ECONNREFUSED`. Chưa xác định chắc là dịch vụ chưa chạy hay cấu hình host/port. Không thể khẳng định số mặt hàng, stock, trạng thái migrations hoặc đăng nhập thật hiện tại từ tài liệu lịch sử.
2. **Build bị chặn bởi tải font:** ba Google Fonts Be Vietnam Pro, Cormorant Garamond, DM Sans tải thất bại trong môi trường hiện tại. Chuẩn bị font local hoặc build ở môi trường truy cập được; chạy lại build trước nộp. Đây là lỗi quan sát được, không khẳng định mọi máy đều lỗi.
3. **Category không đồng bộ:** admin có thể tạo slug custom; parser public chỉ chấp nhận danh sách cố định. Breadcrumb/category link có thể trả bộ lọc không hợp lệ và toàn bộ danh mục. Đặc biệt kiểm tra các danh mục mới khi thêm hàng demo.
4. **Empty listing chưa rõ:** `/products` khi rỗng chỉ có link “Khám phá phong cách”, bỏ qua thông báo rỗng đầy đủ của CatalogContent. Homepage/search/cart có cấu trúc fallback, nhưng vẫn cần QA browser cho loading/error/zero-data.
5. **Dữ liệu mẫu cũ không phù hợp luồng mới:** `prisma/seed.ts` dùng legacy price và tự tạo user/order. Không dùng nguyên script đó để chuẩn bị demo mới; cần ProductPrice VND, ảnh, variants và nhãn DEMO qua luồng quản trị phù hợp.
6. **Tài liệu lịch sử có đoạn cũ và lỗi dấu:** còn câu Admin UI chưa có trong khi code đã có. Trạng thái “DB chạy/build đạt” của phiên trước không phải kết quả hôm nay. Một số entry 26/10 chứa dấu `?` ngay trong tệp.
7. **Chưa có bằng chứng triển khai công khai hoặc QA trình duyệt hôm nay.** Workspace không có Git repository, nên chưa có diff/version rollback bằng Git trong phiên này. Cần sao lưu trước khi làm nhiều chức năng gấp.

## 7. Kế hoạch hoàn thiện trong thời gian còn lại

Ước lượng dưới đây là giờ công tập trung, không phải cam kết; cả P0 có thể cần khoảng **8–13 giờ**, tùy DB/migration và lỗi tích hợp. Nếu không còn đủ giờ hôm nay, giảm phạm vi về một luồng COD xuyên suốt và dùng sáng mai để nghiệm thu, không cố nhồi toàn bộ PDF. Phân công dưới đây chỉ là gợi ý dựa trên trang 5; chưa giao việc/gửi tin cho ai.

| Thứ tự | Công việc | Ước lượng | Điều kiện hoàn thành |
| --- | --- | --- | --- |
| 1 | DB, build/font, sao lưu | 0,5–1 giờ | SELECT 1 và build đạt; đăng nhập ADMIN/khách trên đúng origin. |
| 2 | Giỏ theo user/variant | 1,5–2,5 giờ | Thêm, tăng/giảm, xóa, reload giữ giỏ; tồn kho/giá lấy server; có empty/error/loading. |
| 3 | Checkout COD demo | 2–3 giờ | Nhận tên/điện thoại/địa chỉ; tạo đơn + snapshot giá + cập nhật kho atomic; chặn double submit; trang xác nhận có mã đơn. |
| 4 | Đơn khách và đơn admin | 2–3 giờ | Khách chỉ xem đơn mình; admin danh sách/chi tiết/chuyển trạng thái; hủy đúng quy tắc và hoàn kho đúng một lần. |
| 5 | Hàng demo và thẻ catalog | 1–1,5 giờ | 8–12 mặt hàng có ảnh/giá VND/size/màu/stock, có tên DEMO; listing hiển thị ảnh/giá, PDP mua được. |
| 6 | Chạy kịch bản hoàn chỉnh | 1–2 giờ | Hai phiên khách/admin; lưu/reload; số tiền, stock và trạng thái khớp; chuẩn bị bản chạy ổn định. |

Có thể chia theo vai trò: Tân xử lý storefront/cart/checkout; Quang Minh kiểm tra DB, atomic order/stock và dữ liệu demo; Quốc Chánh xử lý hồ sơ/lịch sử đơn và kiểm tra auth; Quốc Bảo chuẩn bị máy/URL demo và build. Nhóm phải thống nhất API/DTO trước nếu chia việc; báo cáo này không tự mở nhánh hay chạy agent song song.

**Nếu còn 2–4 giờ sau P0:** bộ lọc giá/size/màu/brand + sửa category động → hồ sơ/địa chỉ → bảng size → dashboard đơn cơ bản. Chat/reviews/khuyến mãi/returns/video sản phẩm để backlog và nói rõ khi trình bày.

COD là phương thức demo đề xuất, không phải tích hợp thanh toán online đã hoàn tất. Hiển thị “Thanh toán khi nhận hàng — DEMO”; không tự ghi nhận đã thanh toán. Nếu rubric bắt buộc thanh toán online, phải dành thời gian riêng cho sandbox và cập nhật phạm vi.

## 8. Chuẩn bị mặt hàng demo

Được phép tạo sản phẩm demo có giá và tồn kho để thao tác mua bán trong môi trường demo theo yêu cầu mới. Gắn nhãn rõ ở tên hoặc banner cửa hàng, không trình bày hàng demo thành inventory kinh doanh thật.

- Mục tiêu đề xuất: 8–12 sản phẩm gồm áo thun, sơ mi, áo khoác, quần, váy và phụ kiện; tối thiểu hai nhóm giới tính và một nhóm unisex nếu phù hợp.
- Mỗi sản phẩm có ảnh bìa, mô tả ngắn/chất liệu, danh mục public hợp lệ, giá **ProductPrice VND**, SKU không trùng; apparel có ít nhất 2 size và 2 màu để kiểm tra lựa chọn.
- Dùng tồn demo vừa đủ cho nhiều lượt thử; chủ động có 1 biến thể hết hàng và 1 biến thể chỉ còn 1 để kiểm tra chặn mua quá số lượng. Đây là dữ liệu kiểm thử được công bố, không phải hàng tồn thật.
- Tận dụng ảnh minh họa hiện có phù hợp với loại hàng, không gán ảnh sai sản phẩm. Không cần thêm review giả, khách hàng giả hoặc doanh thu giả để trang trông đông.
- Nhập qua editor/import hiện có với xác thực ADMIN; xuất bản sau kiểm tra ảnh/giá/variant. Nút “+ size/màu Demo” trong preview không lưu DB, không dùng thay bước khai báo variants.
- Tạo đơn trong buổi chạy thử bằng luồng checkout để chứng minh chức năng; giữ nhận diện DEMO và tránh dùng thông tin cá nhân thật. Không dùng seed cũ để giả lập rằng checkout đã chạy.

## 9. Checklist nghiệm thu trước chiều 02/11

- [ ] Khởi động lại máy/server vẫn mở được website; không phụ thuộc lần dev server đang chạy.
- [ ] Đăng nhập/đăng xuất khách và ADMIN; user thường không gọi được API admin.
- [ ] Xem homepage, listing, tìm từ khóa có kết quả/không kết quả, mở PDP và đổi biến thể.
- [ ] Thêm hai biến thể khác nhau vào giỏ, tăng/giảm/xóa/reload; giỏ rỗng có lời dẫn rõ.
- [ ] Đặt COD demo, thấy mã đơn; bấm gửi hai lần không tạo trùng; reload không tạo lại.
- [ ] Số tiền lấy từ server, không sửa được qua request; hết hàng/thiếu giá có lỗi dễ hiểu.
- [ ] Admin nhận đơn, chuyển trạng thái; khách nhìn thấy trạng thái mới và không xem đơn của người khác.
- [ ] Trừ kho khi đặt và hoàn khi hủy đúng quy tắc; hai khách mua đơn vị cuối chỉ một người thành công.
- [ ] Admin tạo/sửa/ẩn sản phẩm; refresh public phản ánh đúng, ảnh và biến thể không mất.
- [ ] Kiểm tra mobile, bàn phím và loading/error/empty/success; thử DB lỗi trên môi trường kiểm thử riêng.
- [ ] Chạy lint/typecheck/test/build; có bản sao dự án/DB và kịch bản demo 5–7 phút.

Kịch bản trình diễn đề xuất: giới thiệu storefront → tìm hàng → chọn size/màu → giỏ → đặt COD → xem đơn khách → admin cập nhật → quay lại đơn khách → tạo/sửa một mặt hàng ở admin. Chỉ đưa các bước đã nghiệm thu vào phần trình diễn chính.

## 10. Kiểm tra thực sự chạy ngày 01/11/2026

| Lệnh | Kết quả |
| --- | --- |
| `git status --short` | Không có Git repository tại workspace. |
| Đọc PDF bằng PyMuPDF | Trích xuất đủ 5 trang; lần đầu lỗi encoding stdout, chạy lại UTF-8 thành công. |
| `npm.cmd test` | **104/104 đạt**, exit 0. Không phải bằng chứng checkout hoặc DB sống đã hoạt động. |
| `npm.cmd run lint` | Đạt, exit 0. |
| `npm.cmd run typecheck` | Đạt, exit 0. |
| `npm.cmd run db:check` | **Thất bại**, exit 1, `ECONNREFUSED`. |
| `npm.cmd run build` | **Thất bại**, exit 1, không tải được 3 Google Fonts. |

Chưa chạy PostgreSQL integration suite, HTTP smoke hay browser E2E trong phiên này. Chưa xác minh tài khoản thật, email đến inbox, số hàng sống, migrations thực tế hoặc deployment. Kết luận về chức năng dựa trên mã nguồn; lỗi DB/build dựa trên lệnh vừa chạy.

**Bước tiếp theo cụ thể:** làm DB và build chạy ổn định, sau đó nối `ADD TO BAG` vào giỏ lưu trạng thái và triển khai đơn COD demo; không bắt đầu lại từ thiết kế trang chủ.
