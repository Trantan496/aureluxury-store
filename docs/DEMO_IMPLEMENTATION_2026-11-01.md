# Bàn giao chức năng demo — 01/11/2026

> Snapshot đợt commerce ban đầu. T02 đã bổ sung voucher/admin/discount checkout và migration mới; xem [VOUCHERS.md](VOUCHERS.md) cho trạng thái mới. Những câu “chưa voucher/không migration” phía dưới áp dụng trước T02.

## Kết quả chính

Đã nối được luồng **sản phẩm → giỏ → checkout COD DEMO → đơn của khách → admin xử lý → hoàn tất/hủy** vào PostgreSQL thật. Đã thêm hồ sơ/địa chỉ, yêu thích, bộ lọc, phân trang, báo cáo đơn, cảnh báo tồn thấp, in phiếu và 8 sản phẩm DEMO. Giao diện dùng các form/table đơn giản để ưu tiên nghiệp vụ.

Không thay stack, không thêm dependency hoặc migration; giữ nguyên tài khoản, quyền ADMIN và sản phẩm có sẵn. Chỉ bổ sung 8 sản phẩm demo mới cùng dữ liệu liên quan, không seed khách hàng/đơn/review vào DB chính.

## Mở để trình diễn

1. Nhấp đúp `start-demo.cmd` ở thư mục gốc. Script khởi động PostgreSQL local và bản production đã build; nếu chưa có build thì tự build. Giữ cửa sổ mở trong lúc demo.
2. Mở **http://localhost:3000/products**. Dùng `localhost`, tránh trộn với `127.0.0.1` vì cookie/origin đăng nhập.
3. Đăng nhập tài khoản khách đang có hoặc tự đăng ký qua giao diện; dùng tài khoản ADMIN hiện hữu để quản trị. Không có tài khoản/mật khẩu dùng chung mới được tạo.
4. Chọn sản phẩm có chữ DEMO, chọn màu/size còn hàng, thêm giỏ hoặc mua ngay.
5. Nhập thông tin nhận hàng giả lập hợp lệ, xác nhận COD DEMO, xem mã đơn và lịch sử.
6. Mở `/admin/orders` bằng ADMIN, chuyển Chờ xác nhận → Đang chuẩn bị → Đã giao vận chuyển → Hoàn tất. Khách xem lại `/account/orders` để thấy trạng thái mới.

Nếu port 3000 đã dùng, dừng đúng server cũ rồi chạy lại. Nếu sửa source, chạy `npm.cmd run build` trước khi dùng `start-demo.cmd` (script không tự build lại khi đã có BUILD_ID). Không dùng `run.cmd`: đó là launcher C++ cũ của workspace, đã giữ nguyên.

## Chức năng đã triển khai

| Nhóm | Hoạt động hiện tại | Đường dẫn |
| --- | --- | --- |
| Giỏ hàng | Thêm theo variant; tăng/giảm/xóa; lưu PostgreSQL theo user; reload vẫn còn; chặn thiếu giá/ngừng bán/quá tồn | `/cart` |
| Mua từ PDP | Nút thêm giỏ/mua ngay hoạt động ở public; Preview admin vẫn không mua; chỉ thanh toán VND | `/products/[slug]` |
| Checkout | Form tên/điện thoại/địa chỉ, nạp địa chỉ mặc định, COD demo, xác nhận mã đơn; phí vận chuyển demo 0 | `/checkout` |
| An toàn đơn | Giá/identity lấy server; snapshot giá; tạo đơn + trừ kho + xóa giỏ cùng Serializable transaction; retry conflict giới hạn; request key chống đơn trùng | `/api/shop` |
| Lịch sử/chi tiết đơn | 100 đơn gần nhất của chính khách, mở chi tiết hàng và địa chỉ; hủy khi còn PENDING | `/account/orders` |
| Admin xử lý đơn | 100 đơn gần nhất, trạng thái tuần tự; hủy trước giao và hoàn kho đúng một lần; không sửa các đơn legacy qua luồng mới | `/admin/orders` |
| Báo cáo | Số đơn và doanh thu quy ước từ đơn VND hoàn tất trong 24 giờ/7 ngày/30 ngày gần nhất; top 10 bán chạy theo tên sản phẩm | `/admin/orders` |
| Cảnh báo tồn | Danh sách tối đa 100 biến thể active có stock ≤ 5; không phải email/push tự động | `/admin/orders` |
| Phiếu đóng gói | Trang in có SKU, màu/size, số lượng, người nhận; chỉ ADMIN đọc được | `/admin/orders/[id]/print` |
| Hồ sơ/địa chỉ | Sửa tên, thành phố, năm sinh, địa chỉ nhận mặc định và điện thoại; email chỉ đọc | `/account` |
| Yêu thích | Lưu từ PDP, đọc/xóa danh sách theo user; nối biểu tượng tim trên header | `/favorites` |
| Catalog/search | Thẻ có ảnh/giá/màu/size; lọc category/gender/brand/color/size/min-max VND, kết hợp cùng biến thể; 12 sản phẩm/trang | `/products`, `/search` |
| Category custom | Parser chấp nhận slug hợp lệ do admin tạo, không còn whitelist cố định gây trả sai danh mục | Catalog |
| Gợi ý tìm kiếm | Datalist tên từ tối đa 200 sản phẩm đang bán, browser gợi ý khi gõ; không AI/không engine relevance | Catalog/search |
| Môi trường | PostgreSQL hoạt động lại; build không cần gọi Google Fonts, dùng font hệ thống | `src/app/layout.tsx` |

COD DEMO không phải thu tiền online, không gọi cổng thanh toán/hãng vận chuyển/email đơn hàng. “Hoàn tất” là trạng thái nghiệp vụ demo, không xác nhận đối soát tiền thật. Báo cáo không trừ hoàn trả hay áp dụng voucher vì các luồng đó chưa có.

## Dữ liệu demo đã thêm

- 8 sản phẩm tên bắt đầu `DEMO —`, slug bắt đầu `demo-cod-`, brand `AUREL DEMO`, collection `demo-2026`.
- Áo khoác City/Weekend, áo len Classic/Soft, quần Office/Relaxed, túi Daily/Work; danh mục áo/quần/áo khoác/phụ kiện.
- 40 biến thể: 6 mẫu apparel × 2 màu × 3 size, 2 mẫu túi × 2 màu × ONE SIZE. Có một biến thể stock 0 và một biến thể stock 1; các biến thể khác stock 10 khi seed.
- 40 giá ProductPrice VND, khoảng 299.000–1.099.000 đồng; đây là giá thử được công bố, không phải giá hàng kinh doanh thật.
- 8 ảnh bìa dùng 4 ảnh minh họa có sẵn. Mô tả nói rõ ảnh dùng chung và không thể hiện mọi màu. Không tạo ảnh mới, đánh giá giả hoặc doanh thu giả.
- Trước thêm hàng: pg_dump custom vào `.local/backups/before-demo-shop-*.dump`, kiểm tra archive bằng pg_restore --list. **Chưa diễn tập restore** trong phiên này. Không đưa dump vào tệp bàn giao công khai vì có dữ liệu DB cũ.
- Script `scripts/seed-demo-shop.ts` chỉ chạy khi có `--confirm-demo-catalog=aurel_ai`, chỉ local DB aurel_ai; transaction/advisory lock, gặp slug đã tồn tại thì bỏ qua, không reset stock hoặc ghi đè sản phẩm cũ.

## Kiểm tra đã chạy

| Kiểm tra | Kết quả cuối |
| --- | --- |
| `npm.cmd run db:start`, `npm.cmd run db:check` | PostgreSQL khởi động, SELECT 1 đạt. Lần sandbox đầu pg_ctl lỗi token 87; chạy ngoài sandbox khởi động thành công, không reset cluster. |
| `npm.cmd run lint` | Exit 0 sau sửa các vấn đề hook/navigation. |
| `npm.cmd run typecheck` | Exit 0. |
| `npm.cmd run build` | Exit 0, build production thành công với các route mới. |
| `npm.cmd test` | **107/107 đạt**, gồm 3 test mới cho checkout validation/lifecycle/filters. |
| `node --experimental-strip-types scripts/shop-http-smoke.ts --confirm-test-database=aurel_ai_test` | **6 nhóm tích hợp đạt**, chạy bằng Next production + Better Auth cookie thật + PostgreSQL test. Dọn fixture sau kiểm tra; main fingerprint và `.env` không đổi. |
| Smoke read-only DB chính | 9 URL HTTP 200: homepage/catalog/search/PDP/ảnh/cart/checkout/đơn khách/admin; đếm đủ 8 thẻ DEMO; `/api/shop` anonymous 401. Không đặt đơn trên main trong kiểm tra này. |
| Browser QA | Chưa thực hiện; Computer Use inventory có Chrome nhưng browser access host unavailable. Không khẳng định mobile/keyboard/click checkout đã nghiệm thu trực quan. |

6 nhóm tích hợp bao gồm: anonymous/customer-admin/CSRF bị từ chối; cart riêng từng user và giá/identity server; double checkout một đơn/trừ kho một lần; không truy cập đơn người khác và hủy hoàn kho một lần; hai khách mua stock cuối chỉ một thành công và admin lifecycle; profile/favorites/dashboard/phiếu in; route/filter/empty kết hợp được kiểm trong nhóm cuối. Báo cáo máy tại `.local/shop-http-smoke.json`.

Các lỗi trung gian đã xử lý: test server dùng `127.0.0.1` bị canonical redirect nên readiness không đạt, đổi sang localhost; Next notFound sau streaming có thể trả HTTP 200 nên test phiếu in kiểm tra không lộ nội dung đơn; TypeScript parameter property không tương thích Node strip-only được đổi thành property thường. Không bỏ các kiểm tra bảo vệ để làm test xanh.

## Các tệp thay đổi

- Business/data: `src/features/shop/rules.ts`, `src/features/shop/service.ts`; dùng lại Prisma client, auth session và money/orderSnapshot.
- HTTP: `src/app/api/shop/route.ts` — GET theo view và POST action, origin guard, session, role/ownership, lỗi an toàn, no-store.
- UI: `src/components/shop/shop-client.tsx`, `shop-page.tsx`, `src/components/products/catalog-browser.tsx`; sửa catalog-content, product-detail-view, account-control, storefront-header, globals.css.
- Routes: sửa `/cart`, `/products`, `/search`; thêm `/checkout`, `/account`, `/account/orders`, `/favorites`, `/admin/orders`, `/admin/orders/[id]/print`.
- Filter/config: `src/features/catalog/catalog.ts`, `prisma-catalog.ts`, `src/app/layout.tsx`, `next.config.ts`.
- Tests/scripts: `tests/shop-rules.test.ts`, chỉnh `tests/catalog.test.ts`, `scripts/shop-http-smoke.ts`, `scripts/seed-demo-shop.ts`, `package.json`, `start-demo.cmd`.
- Docs: báo cáo này, PROJECT_CONTEXT, ROADMAP, ARCHITECTURE, DECISIONS, SESSION_LOG; đánh dấu báo cáo gap cũ là snapshot trước triển khai và ghi quyền dùng ảnh demo.
- Không sửa Prisma schema/migrations, `.env`, tài khoản/quyền thật hoặc sản phẩm cũ. Files sinh bởi Next/TypeScript có thể được làm mới qua kiểm tra; workspace chưa có Git để liệt kê diff.

## Phần vẫn thiếu so với PDF

1. Thanh toán online sandbox/production, trạng thái đối soát thanh toán, vận chuyển thực và nhãn hãng giao hàng.
2. Chat người mua/người bán; thông báo inbox/email/push về đơn, khuyến mãi, sản phẩm mới.
3. Review/ảnh feedback, kiểm duyệt/phản hồi review. Sao ở Preview không phải review thật.
4. Voucher, Flash Sale, combo/quà tặng, ưu đãi sinh nhật/ngày lễ/khách thân thiết.
5. Ledger nhập/xuất, bulk stock có nhật ký, reservation/giữ hàng có thời hạn, tuổi tồn và cảnh báo tự động. Hiện trừ stock khi tạo đơn, hoàn khi hủy; giỏ không giữ kho.
6. Return/exchange/refund. Không hủy đơn SHIPPED/DELIVERED để tránh giả lập hoàn tiền/hoàn kho chưa có nghiệp vụ.
7. Bảng size chi tiết, video sản phẩm, lifecycle Collection riêng. Size Guide vẫn báo chưa có bảng số đo.
8. Phân trang lịch sử/admin quá 100 đơn, biểu đồ/xuất báo cáo theo lịch ngày-tuần-tháng; hiện là cửa sổ 24h/7d/30d, top bán chạy theo tên snapshot.
9. Hosting/domain, nghiệm thu email thật, QA trình duyệt/mobile và chuẩn hóa hardening production còn ở backlog. Hạ tầng hiện là demo local.

## Checklist tự trình diễn ngay

- [ ] Mở bằng start-demo.cmd, đăng nhập ADMIN/khách ở localhost.
- [ ] Thêm 2 biến thể, sửa giỏ, reload; kiểm tra mặt hàng hết stock không mua được.
- [ ] Hồ sơ lưu địa chỉ → checkout tự điền → đặt COD → lưu mã đơn.
- [ ] Admin cập nhật trạng thái; khách tải lại trang đơn để xem. Với đơn khác, thử hủy ở PENDING và kiểm tra stock được hoàn.
- [ ] Mở báo cáo/cảnh báo kho và in phiếu bằng Ctrl+P.
- [ ] Lọc giá/màu/size, thử không có kết quả; xem yêu thích.
- [ ] Giữ một bản backup và bản build ổn định; không nâng dependency/migrate sát giờ nộp nếu chưa kiểm thử.

**Bước tiếp theo:** chạy checklist trực quan bằng tài khoản hiện hữu. Sau đó ưu tiên review + thông báo đơn hoặc voucher theo rubric giảng viên; không cần thiết kế lại trang chủ để chứng minh luồng mua hàng vừa hoàn tất.
