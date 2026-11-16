# Sửa ảnh sản phẩm có chữ chồng — 14/11/2026

## Kết quả
- Rà soát toàn bộ snapshot ban đầu: 44 sản phẩm có ảnh, 184 ProductImage. Xem trực quan 8 contact sheet, đọc/giải mã được toàn bộ 184 file gốc. Không coi chữ in/thêu vốn là thiết kế quần áo là caption lỗi.
- Phát hiện và sửa 30 ảnh của 10 sản phẩm túi. Nguyên nhân: chữ trắng nằm sẵn trong bitmap cộng với caption HTML của EditorialGallery. Ảnh quần cargo như hình tham chiếu không có chữ bitmap nên giữ nguyên.
- Tạo bằng built-in image_gen, 28 lượt thành công, không dùng CLI/API riêng. Giữ ảnh chân thật, cùng màu/chất liệu/ánh sáng, loại bỏ caption và logo/chữ trong các ảnh thay thế. Ảnh 195 và 197 vốn cùng góc dáng; dùng chung đầu ra 195, giữ kích thước riêng. 197 và 218 trùng file gốc nên dùng chung asset mới. Không sửa phân vai ảnh vốn có.
- Lưu 29 bộ file PNG/WebP theo job và 30 bản gốc trong data/repairs/product-image-text-2026-11-14/. Manifest có ID, slug, metadata cũ, URL cũ/mới, SHA256 và tên file. Prompts chính xác trong prompts.json.

## Sản phẩm đã sửa

| Product ID | Sản phẩm | ProductImage ID |
|---|---|---|
| 91 | AUREL - ELARA – ELEGANT HOBO | 195, 196, 197 |
| 96 | AUREL - LUMI – CAMPUS BLOOM | 218, 216, 217 |
| 92 | AUREL - KAIRA – URBAN UTILITY | 199, 200, 201 |
| 93 | AUREL - SERENA – CLASSIC GRACE | 203, 204, 205 |
| 94 | AUREL - AURELIA – SIGNATURE TOTE | 207, 208, 209 |
| 97 | AUREL - VANTOR – URBAN BUMBAG | 220, 221, 222 |
| 98 | AUREL - MONTERO – SIGNATURE SLING | 224, 225, 226 |
| 100 | AUREL - ATHLEX – ACTIVE GEAR | 231, 232, 233 |
| 101 | AUREL - TRAVEN – EXPLORER HOLDALL | 237, 238, 239 |
| 102 | AUREL - NOIRÉ – EXECUTIVE CLUTCH | 241, 242, 243 |

## Database và làm việc song song
- node scripts/repair-product-image-text.mjs plan: 30 liên kết / 29 job.
- node scripts/repair-product-image-text.mjs apply: 30 cập nhật, 0 xung đột; lúc 2026-11-14T03:03:16Z (10:03:16 Asia/Bangkok).
- Mỗi mục SELECT FOR UPDATE, so sánh toàn bộ ProductImage với snapshot trước sửa; bỏ qua nếu bị agent khác thay đổi. Chỉ INSERT ImageAsset mới và UPDATE ProductImage.storageKey. Không ghi đè binary cũ, không đổi giá/tồn kho/quyền/variant hoặc dữ liệu khác. Không migration/seed/restart.
- So sánh sau sửa: không có ProductImage ngoài phạm vi thay đổi; tổng tại lúc kiểm tra vẫn 184 ảnh /44 sản phẩm. Tổng này là snapshot, có thể tăng/giảm do agent khác sau đó.

## Kiểm tra thực sự đã chạy
- Đọc và kiểm metadata 184/184 ảnh gốc, xem toàn bộ contact sheet; xem lại toàn bộ ảnh thay thế trên 3 sheet, không thấy caption/ghost chữ còn lại. Đây là kiểm tra trực quan, không phải OCR tự động.
- node scripts/repair-product-image-text.mjs verify: 30/30 liên kết đúng, hash binary khớp, MIME/byteSize/kích thước đúng, metadata còn lại không đổi.
- HTTP kiểm toàn bộ 184 đường ảnh qua localhost:3000: 183 HTTP200 + WebP giải mã được; ID153 thuộc Product82 AUREL - ÁO KHOÁC BLAZER có isActive=false trả404 đúng chính sách, không phải file hỏng.
- HTTP SSR đủ10/10 PDP đã sửa:200, có mọi URL mới, không còn URL cũ, giữ caption HTML. Chi tiết từng ảnh/trang: verification.json.
- npx.cmd eslint scripts/repair-product-image-text.mjs: exit0 (chạy lại sau bổ sung chặn ghi đè manifest).
- Theo yêu cầu kiểm toàn bộ ảnh của chủ dự án, lượt rà soát dữ liệu bao phủ184 bản ghi và10 trang, vượt hạn mức10 tình huống thông thường của AGENTS.md; không gộp hoặc tuyên bố chỉ vài case. Không npm test/full integration, typecheck/build vì không đổi mã runtime Next/TypeScript.
- Có hai lỗi lệnh thăm dò ban đầu: PowerShell làm mất quote node -e (đã chuyển file .mjs), Git báo workspace không phải repository; không có mutation từ các lệnh lỗi. Fontconfig cảnh báo không có thư mục cache ghi được khi render sheet nhưng PNG vẫn xuất thành công.

## Khôi phục và giới hạn
- Bản gốc vẫn nguyên trong PostgreSQL ImageAsset và file *-original.webp; media library có thể vẫn chứa bản cũ để đối chiếu, không xóa lịch sử.
- Để rollback: đọc manifest.json; trong transaction khóa đúng ProductImage ID, chỉ trả storageKey về before.storageKey nếu storageKey hiện tại vẫn bằng storageKey mới trong manifest. Không ghi đè thay đổi mới của agent/người quản trị; không cần xóa ImageAsset mới.
- Chưa chụp nghiệm thu DOM desktop/mobile hoặc public domain; đã kiểm ảnh trực quan và HTML/HTTP live local. Không kiểm lại thanh toán/đơn hàng vì không liên quan.
- Exact next action: Ctrl+F5 trang sản phẩm để thấy ảnh sạch; nếu agent kia thêm/thay ảnh sau snapshot này, chạy lượt audit mới chỉ cho delta.
