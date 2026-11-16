# Sửa thumbnail “Đơn của tôi” — 13/11/2026

## Nguyên nhân đã xác nhận

`OrdersView` dùng Next Image nhưng thiếu `unoptimized` cho `/images/uploads/`. Cấu hình Next hiện tại chủ động loại đường dẫn upload khỏi image optimizer để tránh cache ảnh có kiểm tra quyền. Các khu vực cart/checkout/wishlist đã bypass optimizer cho loại ảnh này; riêng thumbnail đơn hàng bị thiếu.

Đọc metadata ảnh của hai đơn trong screenshot bằng SELECT read-only, chỉ lấy khóa ảnh/trạng thái publication, không lấy thông tin người mua. Cả hai ảnh gốc đều tồn tại và được công khai hợp lệ:

- Đơn3: ảnh gốc HTTP200,16.262byte.
- Đơn5: ảnh gốc HTTP200,25.054byte.
- Cùng upload qua `/_next/image`: HTTP400 đúng theo policy hiện hành.

Không phải do CSS animation hoặc ảnh trong PostgreSQL bị mất ở hai trường hợp này. Không mở allowlist optimizer hoặc bỏ kiểm tra quyền để sửa lỗi.

## Thay đổi

Chỉ sửa runtime tại `src/components/account/orders-view.tsx`:

- `OrderThumbnail` tải upload trực tiếp bằng `unoptimized`; ảnh static vẫn được Next tối ưu như trước.
- `sizes="48px"` khớp chiều rộng CSS; khung48×58 giữ nguyên khi ảnh đang tải.
- Thiếu URL hoặc tải lỗi: thay ảnh vỡ bằng icon package có accessible label, không để alt text tràn ra ngoài như screenshot.
- Key theo URL để reset lỗi khi đổi sang nguồn ảnh mới.

Không sửa order, giá/tổng, dữ liệu sản phẩm, cache policy, permissions, schema/index hoặc source mapping của đơn hàng.

## Kiểm tra — 8 tình huống độc lập

| Case | Kết quả |
|---|---|
| 1. Ảnh gốc đơn3 | HTTP200 |
| 2. Ảnh gốc đơn5 | HTTP200 |
| 3. Upload qua optimizer | HTTP400, giữ đúng policy |
| 4. OrdersView với upload hợp lệ | Ảnh hiển thị, không request optimizer/srcset; khung chờ48×58 ổn định |
| 5. URL404 | Placeholder có accessible label, không còn img vỡ |
| 6. URLnull | Placeholder chủ đích, không request ảnh |
| 7. Static asset | Optimizer hoạt động, ảnh hiển thị |
| 8. URL đổi sau lỗi | Placeholder mất đi, nguồn mới hiển thị |

Fixture dùng OrdersView và chính Image component của Next, không dùng image mock; adapter CJS chỉ có trong công cụ esbuild. Fixture có nhãn “KHÔNG PHẢI ĐƠN THẬT”, không lưu dữ liệu hoặc tạo giao dịch. Case4 chạy lại2lần vì lỗi công cụ interop React130 và so URL tuyệt đối/tương đối; đã sửa công cụ, không sửa app để né lỗi. Tám case cuối đều đạt; không chạy lại3case đầu đã đạt.

- `npm.cmd run lint`: exit0.
- `npm.cmd run typecheck`: exit0.
- Production snapshot build webpack + TypeScript đầy đủ: đạt, worker2, không ghi `.next` live.
- Không full suite; không sửa hoặc submit đơn/thanh toán. Chưa kiểm thử bằng phiên tài khoản của khách thật; component fixture và hai nguồn ảnh thật đã được kiểm chứng.

## Bàn giao

- Đã cập nhật riêng preview3010 bằng build mới ở `.local/order-image-check/app`; không restart live3000/dev3005. Preview ready, cần refresh trang để nhận bundle mới.
- Fixture3011 đã dừng sau nghiệm thu; artifacts tại `.local/order-image-check/results/`, metadata không có PII tại `sources.json`.
- Công cụ: read-sources.mjs, fixture.tsx, server.mjs, verify.mjs. Preview runner nhận thư mục snapshot qua biến riêng, không copy env files.
- Tài liệu PROJECT_CONTEXT/ARCHITECTURE/ROADMAP/SESSION_LOG đã cập nhật. Không thêm ADR vì dùng lại policy/pattern ảnh hiện hành.
- Chưa deploy public. Nếu UI đang mở trên bản build production khác, cần triển khai build chứa thay đổi; refresh chỉ nhận bản mới ở preview/dev đã cập nhật.
