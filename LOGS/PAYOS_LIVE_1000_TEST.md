# payOS thật — sản phẩm thử 1.000đ (02/11/2026)

Đã triển khai theo yêu cầu owner; chưa thực hiện chuyển tiền hoặc tạo đơn giả.

- Runner mới: `scripts/apply-payos-migration.ts`, chỉ localhost/database aurel_ai với xác nhận CLI; backup, restore cô lập, rehearsal, fingerprint dữ liệu/schema cũ, checksum và đăng ký đúng một migration payOS. Không chạy generic deploy các migration pending.
- Backup: `.local/backups/aurel_ai-before-payos-20261102080354-939afc.dump`; restore DB `aurel_ai_restore_test_payos_20261102080354_939afc`; report `.local/backups/payos-migration-main.json`. Không xóa bản backup.
- Migration `20261102150000_payos_payments`, checksum `94d2aad8a642a8d52b5d3f0a396c4b70696010527beb32c5c83a3f6a0673ea55`; ba bảng mới và quyền tối thiểu cho aurel_app nếu role tồn tại. Dữ liệu/schema trước đó được bảo toàn.
- Product ID63, variant120, giá1000, stock1, code AUR-125136740001; tên TEST thanh toán payOS 1.000đ — Không giao hàng. Một suất mua thử kỹ thuật, không giả hàng thời trang/ảnh/review/đơn. Audit local `.local/audit/payos-test-product.json`.
- URL: https://aureluxury.store/products/test-thanh-toan-payos-1-000d-khong-giao-hang-moi-do-tuoi
- Bật PAYOS_ENABLED local, đăng ký canonical webhook bằng script manual và flag replace; provider xác nhận thành công. Restart đúng Next workspace port3000 sau build; cloudflared service giữ nguyên. Không ghi credentials vào report.
- Provider trả HTTP200/code101 “Mã thanh toán không tồn tại” cho mã thăm dò không tồn tại. Service retry nhận diện đúng code+description này bên cạnh231/404, giữ mã đã lưu để tránh duplicate. Mock regression mới trong tests/payos.test.mjs đạt1/1; không gọi provider từ test.
- CheckoutView hiện tại có PAYOS và PayosPayment autoCreate, hỗ trợ Buy Now variant scope. Không ghi đè giao diện đang được sửa song song.

## Kiểm tra đã thực hiện
1. Read-only readiness trước/sau rollout: sau có đủ bảng, enabled true.
2. Public webhook thiếu chữ ký:400; lần sandbox bị giới hạn mạng, kiểm tra ngoài sandbox đạt.
3. Credential probe mã không tồn tại:101; sửa phân loại kết quả rồi kiểm lại đạt, không tạo payment.
4. Backup/restore/rehearsal fingerprint bảo toàn đạt.
5. Main migration fingerprint bảo toàn và chỉ đúng migration đạt.
6. Tạo sản phẩm đúng giá/stock/nhãn test đạt; sandbox tsx ENOMEM trước thực thi, chạy lại ngoài sandbox đạt.
7. Regression retry code101:1/1 đạt.
8. Manual webhook registration đạt, không tạo thanh toán.
9. PDP local/public200 hiển thị1.000 VND đạt.
10. Review tĩnh checkout hiện tại: chọn PAYOS gửi phương thức và render QR từ orderID; chưa nghiệm thu browser đăng nhập.

Lint, typecheck và production build đều exit0. Không chạy full suite. Payment thật, webhook PAID, đơn READY trên dashboard và cập nhật giao hàng sau trả tiền chưa được nghiệm thu; owner cần tự xác nhận giao dịch trong ứng dụng ngân hàng. Sau thử, kiểm stock1 đã trừ và gỡ/ẩn sản phẩm test khi không cần.
