# Khôi phục checkout — 02/11/2026

Owner báo `/checkout?variantId=114` hiển thị error boundary. Đọc docs bắt buộc, checkout/service, cấu hình và guide self-hosting/distDir trong Next cài đặt. Không sửa business logic hoặc dữ liệu.

Console Chrome ghi JS `/_next/static/chunks/0d2f1fae2r101.js` và CSS `/_next/static/chunks/1vj-ypsgf6xf1.css`404. Hai file có trên đĩa. Next PID14956 start15:12:42 trong khi `.next/BUILD_ID` sửa15:27:27. HTTP xác nhận404 cả local/public: inventory asset trong tiến trình cũ lệch build mới. Không phải kết luận lỗi ngân hàng/payOS hoặc BigInt.

Xác minh PID14956 là node Next start hostname127.0.0.1 port3000 của workspace rồi dừng đúng PID đó, Start-Process Hidden nạp build hiện có; PID mới3288. Không dừng database/cloudflared, không sửa environment, không tạo đơn hoặc chuyển tiền.

Kiểm tra (3 tình huống, rerun sau recovery):
1. JS asset local/public404 trước →200 sau.
2. CSS asset local/public404 trước →200 sau.
3. Chrome checkout114 trước thiếu nội dung/Console404 → hard reload sau có form nhận hàng, sản phẩm thật400.000đ, lựa chọn COD/PAYOS và nút đặt hàng. Không submit. Browser access host không có, dùng native Chrome qua Computer Use; thao tác chỉ xem/reload.

Không chạy lint/typecheck/build vì không sửa source và build mới vào `.next` đang phục vụ sẽ tái tạo chính lỗi này. Runtime stderr không ghi lỗi liên quan. Chưa nghiệm thu giao dịch thật hoặc dashboard PAID. Variant114 giá400.000đ; sản phẩm thử1000đ là variant120, cần owner chọn đúng.

Docs cập nhật PROJECT_CONTEXT, ROADMAP, SESSION_LOG và report này. Architecture không đổi. Bước tiếp: tránh build đè thư mục live; mỗi deployment phải khởi động lại đồng bộ và kiểm HTTP asset trước handoff. Owner có thể Ctrl+Shift+R trang checkout rồi tiếp tục, dùng variant120 nếu thử1000đ.
