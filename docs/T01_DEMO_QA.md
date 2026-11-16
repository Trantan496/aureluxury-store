# T01 — kiểm tra luồng và cải thiện mobile (01/11/2026)

## Trạng thái bàn giao
- Chủ dự án xác nhận tự chạy demo ổn, không thấy vấn đề; yêu cầu dừng worker và không cần test thêm. Đã dừng worker, không chạy thêm test/browser theo yêu cầu mới.
- Worker được khởi tạo đúng GPT-6.1 Sol theo yêu cầu ban đầu. Trước khi được dừng, đã kiểm tra7 case HTTP riêng trên PostgreSQL test và thêm các cải thiện mobile nhỏ ở source.
- Không thay nghiệp vụ mua hàng, schema, database chính hoặc `.env`. Main server3000 do người dùng đang chạy được giữ nguyên.

## Đã làm
- Thêm `scripts/t01-demo-acceptance.ts` cho7 case T01 chọn lọc, có DB test guard/fixture cleanup/main fingerprint và env hash. Không tự chạy cùng ứng dụng và không đưa vào full suite.
- `src/app/globals.css`: panel/form có min-width0 và ngắt chuỗi dài, nút shop tối thiểu44px, input/select16px để thuận tiện nhập trên mobile. Bảng giỏ vẫn cuộn bên trong shop-scroll.
- `src/components/shop/shop-client.tsx`:2 trường điện thoại checkout/profile dùng type=tel và inputMode=tel để thiết bị chọn bàn phím điện thoại.
- Đây là cải thiện dựa trên source review, không khẳng định đã tái hiện lỗi hiển thị trên thiết bị thật.

## Kết quả đã có trước yêu cầu dừng
1. Đăng nhập và giỏ giữ qua đăng nhập lại/reload: đạt.
2. Tổng tiền/userId giả từ client không thay giá/identity server: đạt.
3. Replay key không tạo thêm đơn/trừ kho: đạt.
4. Hai khách mua đơn vị cuối chỉ một thành công, stock không âm: đạt.
5. Không đọc/sửa đơn người khác: đạt.
6. Hủy PENDING hoàn stock một lần: đạt.
7. Mất DB vẫn render lỗi catalog/retry/navigation/footer: đạt sau sửa encoding của assertion và chỉ rerun case7.

Case7 lần đầu thất bại do literal tiếng Việt bị PowerShell pipe đổi dấu, không phải lỗi ứng dụng; sửa test Unicode escapes. Báo cáo `.local/t01-demo-acceptance.json` ghi6 case, `.local/t01-demo-acceptance-case7-rerun.json` ghi case7. Fixture đã dọn, test server3357 đã dừng và main fingerprint/.env không đổi.

Lint/typecheck trước sửa mobile được worker báo exit0. Không dùng kết quả này để khẳng định source mobile mới đã build/kiểm tra lại. Không yêu cầu thêm lượt kiểm tra sau khi người dùng bảo dừng.

## Mobile và giới hạn
- Case8 browser/mobile end-to-end chưa nghiệm thu. Browser access host unavailable; có chuyển sang tab Fashion Store bằng cửa sổ Chrome native, chưa bật viewport mobile hoặc thao tác checkout. Đã dừng ngay khi người dùng yêu cầu không dùng chức năng đó.
- Không ghi case8 pass bằng source review hoặc bằng xác nhận chung của người dùng. Ghi **bỏ qua nghiệm thu tự động theo yêu cầu chủ dự án**, giữ kết quả tự chạy của người dùng riêng.
- Bản production đang mở có thể chưa chứa các cải thiện mobile mới; không tự rebuild/restart server đang dùng sau yêu cầu dừng.

**Bước tiếp theo theo kế hoạch:** T02 voucher khi người dùng muốn triển khai; quy tắc chung≤10 case/tác vụ vẫn còn, riêng T01 không chạy thêm test.
