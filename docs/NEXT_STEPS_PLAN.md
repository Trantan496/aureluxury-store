# Kế hoạch hoàn thiện sản phẩm — 01/11/2026

> Cập nhật triển khai: T01 đã kết thúc theo xác nhận chủ dự án; T02 voucher đã có code/schema/admin/checkout, migration test/main và build đạt. Theo yêu cầu mới không dùng worker và0 test nghiệp vụ; chưa nghiệm thu giao diện. Xem [VOUCHERS.md](VOUCHERS.md). Bước chức năng kế tiếp T03; ngân sách test phía dưới là kế hoạch cũ, không phải các test đã chạy.

## Phạm vi

Ưu tiên chức năng không AI, giữ luồng COD demo đang chạy; không thiết kế lại UI. Đây là kế hoạch **chưa triển khai**. Trạng thái đã làm nằm trong DEMO_IMPLEMENTATION_2026-11-01.md.

Đã đối chiếu shop/service.ts, rules.ts, Prisma schema và scripts: có cart/order/profile/favorites; chưa có voucher/review/chat/notification/ledger. Order total có constraint bằng tổng lineTotal; stock trừ khi tạo đơn, giỏ không giữ hàng. Các model/routes tương lai dưới đây là đề xuất, chưa phải kiến trúc đang chạy.

## Quy tắc tốc độ và kiểm thử

- Tối đa **10 test case/tác vụ**, thường4–8; tính cả regression cũ được chọn và nghiệm thu thủ công. Không chạy full107 tests mặc định, không xóa test cũ.
- Đếm từng tình huống độc lập, kể cả subtest/parameterized case. Script shop-http-smoke.ts cũ báo6 nhóm nhưng kiểm nhiều hành vi; không coi nguyên script là6 case theo quy tắc mới. Tách entry test hoặc dùng bộ lọc tên phù hợp khi triển khai.
- Chỉ rerun case lỗi sau sửa và ghi lại; không mở rộng suite không cần thiết. Một case có thể có nhiều assertion cho cùng hành vi.
- Lint/typecheck/build ghi riêng, chạy theo thay đổi. Build khi sửa route/schema/config hoặc bàn giao đợt; không dùng build pass thay test nghiệp vụ.
- Test mutation dùng DB test có guard/cleanup. Migration mới kiểm trên test, sao lưu và có phương án rollback trước áp dụng DB demo. Không seed đơn/user/review giả trên main để chứng minh chức năng.
- Tác vụ tài liệu-only:0 test ứng dụng. Mỗi tác vụ bàn giao đầu ra dùng được, file thay đổi, kết quả N/10 case, hạn chế và docs cập nhật.

## Thứ tự triển khai

| Mã | Đầu ra dùng được | Test tối đa | Phụ thuộc/giới hạn |
| --- | --- | --- | --- |
| T01 | Nghiệm thu luồng hiện tại, sửa lỗi cản demo, bổ sung QA browser/mobile | 8 | Browser/session phù hợp; phần HTTP vẫn làm được nếu browser bị chặn |
| T02 | Voucher: admin tạo/tắt mã, %/số tiền VND, hạn dùng, đơn tối thiểu, trần giảm, giới hạn lượt; checkout lưu discount đúng | 10 | Review mô hình tiền/constraint và migration; không chỉ trừ giá ở UI |
| T03 | Thông báo đơn trong website: danh sách, chưa đọc/đã đọc, link đơn, chống sự kiện trùng | 6 | Order hiện hữu; sau T02 để thống nhất dữ liệu đơn |
| T04 | Review chữ/sao sau mua hoàn tất; admin duyệt/ẩn/phản hồi; rating từ review đã duyệt | 8 | OrderItem→variant→product, auth; ảnh feedback làm sau |
| T05 | Bảng size theo sản phẩm/đơn vị và nội dung chính sách DEMO nhất quán | 5 | Độc lập, làm sớm nếu tác vụ khác bị chặn |
| T06 | Hộp thư khách–admin lưu DB, gửi/đọc/phân trang, quyền theo hội thoại | 7 | Polling/refresh đơn giản trước realtime; không chatbot AI |
| T07 | Ledger kho: nhập/điều chỉnh/xuất/hủy, actor/reason, ngưỡng cảnh báo | 8 | Checkout/cancel ghi ledger cùng transaction; chặn stock âm |
| T08 | Bulk kho: preview theo SKU, validation, commit nguyên tử, chống áp lại | 6 | T07 |
| T09 | Yêu cầu đổi/trả: gửi, duyệt/từ chối, nhận hàng, hoàn stock một lần | 8 | T07; chưa tự hoàn tiền qua cổng |
| T10 | Payment sandbox: payment attempt/callback có chữ ký, idempotency, timeout/failure | 10 | Provider/credentials sandbox; chốt giữ/giải phóng tồn, không tin redirect client |
| T11 | Phân trang đơn, lọc ngày/trạng thái, báo cáo lịch ngày-tuần-tháng, CSV an toàn | 7 | T02/T07; T09 nếu tính hàng trả; định nghĩa doanh thu rõ |
| T12a | Video từng sản phẩm, upload/quản lý/playback | 5 | Storage/quyền media, giới hạn dung lượng |
| T12b | Collection CRUD và liên kết sản phẩm | 5 | Độc lập với video, migration nếu cần |
| T13a | Flash Sale | 6 | T02, quy tắc ưu tiên ưu đãi |
| T13b | Combo/quà tặng | 8 | T02/T07, tồn kho từng món |
| T13c | Ưu đãi sinh nhật/ngày lễ | 6 | Ngày-tháng sinh, campaign/scheduler và opt-in nếu gửi email |
| T13d | Thông báo hàng mới/khuyến mãi | 6 | T03, đăng ký nhận thông báo |
| T14a | Ảnh feedback | 6 | T04 + upload validation/moderation |
| T14b | Email đơn và retry delivery | 7 | T03 + provider; không gửi trong transaction checkout |
| T14c | Phí giao hàng/nhãn vận chuyển | 8 | Provider sandbox, địa chỉ và trạng thái đơn |
| T15 | Triển khai demo chia sẻ: hosting/domain/origin/HTTPS, role DB, backup/restore | 8 | T01 đạt và tài khoản hosting; có thể làm trước T06 nếu cần link nộp |

**Đợt tiếp theo nên làm T01 → T02 → T03 → T04.** Không hứa hoàn thành toàn bộ bảng trước hạn nộp. Nếu sát giờ, chốt bản COD ổn định và ưu tiên chức năng đã nghiệm thu thay vì thêm migration chưa kiểm tra. Provider còn thiếu không chặn các chức năng local độc lập.

## Đợt tiếp theo: case cụ thể

### T01 — ổn định demo,8 case
1. Đăng nhập khách, thêm biến thể và reload giữ giỏ đúng.
2. Checkout lấy giá server, sửa tổng tiền từ client không thay tiền ghi đơn.
3. Gửi lại request key chỉ tạo một đơn/trừ kho một lần.
4. Hai khách mua đơn vị cuối chỉ một người thành công.
5. Truy cập chéo chủ sở hữu đơn bị từ chối.
6. Hủy PENDING và replay không hoàn kho hai lần.
7. Catalog mất DB có lỗi hữu ích, không trắng trang.
8. Mobile browser: chọn biến thể → giỏ → COD → xem đơn, các nút thao tác không bị che.

Không chạy lại case đã có bằng chứng trên đúng build nếu code liên quan chưa đổi; ưu tiên bù case8 chưa có bằng chứng. Nếu browser host vẫn không hoạt động, ghi chưa chạy và tiếp tục phần độc lập, không coi HTTP thay nghiệm thu trực quan.

### T02 — voucher,10 case
Phạm vi một mã/đơn, VND, không cộng dồn. Đề xuất Voucher/Redemption và snapshot discount, chốt schema khi triển khai. Cần bảo toàn tổng đơn legacy.

Không đổi totalAmount thành sau giảm trong khi sum(lineTotal) còn trước giảm. Chọn một mô hình nhất quán và ghi ADR: phân bổ discount vào dòng với snapshot giá gốc, hoặc thêm subtotal/discount/total và sửa constraint tương ứng. Chốt rõ hủy đơn có trả lượt sử dụng voucher hay không.

1. ADMIN quản lý mã, CUSTOMER bị chặn quyền quản trị.
2. Mã số tiền cố định tính đúng, tổng không âm.
3. Mã phần trăm áp trần/làm tròn VND, tổng dòng khớp header.
4. Mã ngoài thời hạn bị từ chối.
5. Đơn chưa đạt giá trị tối thiểu bị từ chối.
6. Giới hạn sử dụng cá nhân được thực thi.
7. Hai checkout tranh lượt cuối chỉ ghi một redemption.
8. Replay checkout không trừ thêm lượt/tạo đơn mới.
9. Hủy/replay xử lý lượt dùng theo quy tắc đã chốt đúng một lần.
10. Migration/re-read giữ tổng đơn legacy, đơn giảm giá mới thỏa constraint.

### T03 — thông báo đơn,6 case
Đề xuất Notification theo user/order/event key. Ghi cùng transaction nghiệp vụ hoặc outbox nếu tách delivery; không gửi email trong transaction. Email/push chưa thuộc tác vụ này.

1. Đặt đơn sinh thông báo cho đúng khách.
2. Chuyển trạng thái tạo nội dung/link đúng đơn.
3. Replay sự kiện không tạo trùng.
4. Người khác không đọc/đánh dấu thông báo không thuộc mình.
5. Đã đọc giữ qua reload và số chưa đọc cập nhật đúng.
6. Danh sách chưa có thông báo hiển thị empty state.

### T04 — review,8 case
Một review/user/product sau đơn hoàn tất; xác minh bằng quan hệ ID, không đối chiếu tên sản phẩm. Public chỉ aggregate review đã duyệt, không dùng rating DEMO ở Preview như dữ liệu thật.

1. Khách đủ điều kiện gửi review vào chờ duyệt.
2. Khách chưa mua hoàn tất không gửi được.
3. Gửi trùng không tạo review thứ hai.
4. Sao ngoài1–5/nội dung quá dài bị từ chối.
5. CUSTOMER không được thao tác moderation.
6. Review chờ duyệt không xuất hiện/tính vào rating.
7. Duyệt/ẩn cập nhật count/average đúng.
8. Nội dung HTML/script được hiển thị an toàn như văn bản.

## Cách bàn giao

Mỗi tác vụ: đọc trạng thái/code → chốt≤10 case → triển khai UI tối giản + validation/service/DB/API → test chọn lọc → cập nhật docs và hướng dẫn thao tác. Nghiệp vụ mới độc lập tách module phù hợp, không dồn tất cả vào shop/service.ts. Không tick hoàn tất nếu mới có bảng dữ liệu hoặc mock UI.

**Bước tiếp theo cụ thể:** T01 chọn tối đa8 case, bù browser QA; sau đó T02 chốt discount snapshot/constraint và triển khai voucher end-to-end. Phiên này chỉ lập kế hoạch, chưa tạo chức năng mới.
