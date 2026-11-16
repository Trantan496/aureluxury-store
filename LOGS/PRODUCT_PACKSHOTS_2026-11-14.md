# Rà soát ảnh sản phẩm — 14/11/2026

- Phạm vi: toàn bộ 44 Product trong PostgreSQL local aurel_ai, không lọc isActive. Không đồng nghĩa đã kiểm tra một database production riêng khác.
- Trước sửa: 11 sản phẩm có 5 ảnh, 32 sản phẩm có 4 ảnh, ID82 chỉ có 1 ảnh. Trong 11 bộ đủ ảnh, ID87 có nền đen.
- Sau sửa: 44/44 sản phẩm có đúng 5 ảnh; thêm 36 ProductImage và 37 ImageAsset mới; thay storageKey của 1 ProductImage (ID87). 34 sản phẩm được cập nhật, 10 sản phẩm giữ nguyên.
- Nguồn ảnh mới: imagegen AI dựa vào ảnh gốc + tên sản phẩm. Ưu tiên hình gốc khi mô tả không khớp (ví dụ ID64 mô tả parka nhưng hình/tên là trench; ID80 mô tả T-shirt nhưng hình/tên là overshirt). ID70 và71 trùng tên được xử lý theo ảnh riêng từng ID.
- ID82: thêm ba góc chi tiết mặt trước và một ảnh sản phẩm riêng; không suy đoán mặt sau. Metadata ảnh số4 dùng other, không gắn back giả.
- Packshot dùng imageType=lifestyle theo mapping gallery hiện có; sortOrder=4, isPrimary=false. Ảnh chính và bốn ảnh trước của các bộ đủ4 được giữ nguyên.
- Ảnh AI có altText/sourceReference nêu nguồn AI; websitePermission=granted theo yêu cầu chủ dự án, embedding/training vẫn unknown. Đây là ảnh tái tạo, không phải ảnh chụp xác thực từng đường may.
- Lưu WebP trong ImageAsset BYTEA và đường /images/uploads/UUID.webp theo hệ lưu trữ hiện hành. Không sửa frontend, route, schema, giá hay tồn kho; không restart server.
- Transaction SERIALIZABLE, khóa Product/ProductImage, so khớp snapshot trước ghi; kiểm tra tổng số ảnh trước COMMIT. Asset cũ không bị xóa. Snapshot trước và plan được lưu trước transaction.
- Lần apply đầu dừng trước ghi do 30 ảnh chi tiết của 10 túi thay đổi song song. Đã xác minh chỉ storageKey ở slot 1–3 đổi, giữ nguyên các thay đổi đó và cập nhật baseline. Chi tiết trong initial-audit.json và concurrent-changes-preserved.json.
- ID82 đang ẩn (isActive=false): đủ 5 ảnh trong DB, public trả 404 đúng policy; không tự xuất bản sản phẩm.
- Fingerprint toàn bộ ProductVariant và ProductPrice trước/sau giống nhau; không ghi bảng đơn hàng/tài khoản.

## Danh sách toàn bộ sản phẩm

| ID | Tên sản phẩm | Số ảnh trước | Sau | Thay đổi |
| --- | --- | ---: | ---: | --- |
| 24 | AUREL - ÉLAN LONG COAT | 5 | 5 | Giữ nguyên ảnh sản phẩm riêng trên nền trắng/sáng |
| 57 | AUREL - MERINO CARDIGAN | 4 | 5 | Thêm packshot vào vị trí 5 |
| 58 | AUREL - BASE TEE | 4 | 5 | Thêm packshot vào vị trí 5 |
| 59 | AUREL - ESSENTIAL PIQUÉ POLO – IVORY | 4 | 5 | Thêm packshot vào vị trí 5 |
| 60 | AUREL - ESSENTIAL CLASSIC HOODIE | 4 | 5 | Thêm packshot vào vị trí 5 |
| 61 | AUREL - NAVY BOMBER JACKET (NAM) | 4 | 5 | Thêm packshot vào vị trí 5 |
| 62 | AUREL - COZY BOW FLEECE JACKET – IVORY CREAM | 4 | 5 | Thêm packshot vào vị trí 5 |
| 64 | AUREL - BROWN TRENCH COAT (NAM) | 4 | 5 | Thêm packshot vào vị trí 5 |
| 66 | AUREL - BLAZER BLACK | 4 | 5 | Thêm packshot vào vị trí 5 |
| 67 | AUREL - BLACK VARSITY | 4 | 5 | Thêm packshot vào vị trí 5 |
| 68 | AUREL - WINDBREAKER JACKET | 4 | 5 | Thêm packshot vào vị trí 5 |
| 69 | AUREL - VARSITY A | 4 | 5 | Thêm packshot vào vị trí 5 |
| 70 | AUREL - HOODIE JACKET | 4 | 5 | Thêm packshot vào vị trí 5 |
| 71 | AUREL - HOODIE JACKET | 4 | 5 | Thêm packshot vào vị trí 5 |
| 72 | AUREL - ESSENTIAL WINDBREAKER | 4 | 5 | Thêm packshot vào vị trí 5 |
| 74 | AUREL - OFF-SHOULDER SHIRT | 4 | 5 | Thêm packshot vào vị trí 5 |
| 75 | AUREL - SLIM FIT | 4 | 5 | Thêm packshot vào vị trí 5 |
| 76 | AUREL - OFF SHOULDER NEW | 4 | 5 | Thêm packshot vào vị trí 5 |
| 77 | AUREL - BODY FIT | 4 | 5 | Thêm packshot vào vị trí 5 |
| 78 | AUREL - NEW COLLECTION T-SHIRT | 4 | 5 | Thêm packshot vào vị trí 5 |
| 79 | AUREL - ESSENTIAL SHIRT | 4 | 5 | Thêm packshot vào vị trí 5 |
| 80 | AUREL - KHAKI GRAPHIC OVERSHIRT | 4 | 5 | Thêm packshot vào vị trí 5 |
| 81 | AUREL - NEW KHAKI COLLECTIONS | 4 | 5 | Thêm packshot vào vị trí 5 |
| 82 | AUREL - ÁO KHOÁC BLAZER | 1 | 5 | Thêm 3 ảnh chi tiết mặt trước và 1 packshot |
| 83 | AUREL - QUẦN DÀI LINEN | 5 | 5 | Giữ nguyên ảnh sản phẩm riêng trên nền trắng/sáng |
| 84 | AUREL - QUẦN TÂY NAM | 5 | 5 | Giữ nguyên ảnh sản phẩm riêng trên nền trắng/sáng |
| 85 | AUREL - QUẦN DÀI KAKI | 5 | 5 | Giữ nguyên ảnh sản phẩm riêng trên nền trắng/sáng |
| 86 | AUREL - QUẦN JEAN NAM | 5 | 5 | Giữ nguyên ảnh sản phẩm riêng trên nền trắng/sáng |
| 87 | AUREL - QUẦN DÀI JOGGER NAM | 5 | 5 | Thay ảnh nền đen bằng ảnh nền trắng; giữ asset cũ |
| 88 | AUREL - QUẦN JEAN NỮ | 5 | 5 | Giữ nguyên ảnh sản phẩm riêng trên nền trắng/sáng |
| 89 | AUREL - QUẦN TÂY NỮ | 5 | 5 | Giữ nguyên ảnh sản phẩm riêng trên nền trắng/sáng |
| 90 | AUREL - QUẦN SHORT KAKI | 5 | 5 | Giữ nguyên ảnh sản phẩm riêng trên nền trắng/sáng |
| 91 | AUREL - ELARA – ELEGANT HOBO | 4 | 5 | Thêm packshot vào vị trí 5 |
| 92 | AUREL - KAIRA – URBAN UTILITY | 4 | 5 | Thêm packshot vào vị trí 5 |
| 93 | AUREL - SERENA – CLASSIC GRACE | 4 | 5 | Thêm packshot vào vị trí 5 |
| 94 | AUREL - AURELIA – SIGNATURE TOTE | 4 | 5 | Thêm packshot vào vị trí 5 |
| 95 | AUREL - QUẦN TÚI HỘP ỐNG CONG DÁNG BARREL | 5 | 5 | Giữ nguyên ảnh sản phẩm riêng trên nền trắng/sáng |
| 96 | AUREL - LUMI – CAMPUS BLOOM | 4 | 5 | Thêm packshot vào vị trí 5 |
| 97 | AUREL - VANTOR – URBAN BUMBAG | 4 | 5 | Thêm packshot vào vị trí 5 |
| 98 | AUREL - MONTERO – SIGNATURE SLING | 4 | 5 | Thêm packshot vào vị trí 5 |
| 99 | AUREL - QUẦN LỬNG ỐNG RỘNG SMART CULOTTES | 5 | 5 | Giữ nguyên ảnh sản phẩm riêng trên nền trắng/sáng |
| 100 | AUREL - ATHLEX – ACTIVE GEAR | 4 | 5 | Thêm packshot vào vị trí 5 |
| 101 | AUREL - TRAVEN – EXPLORER HOLDALL | 4 | 5 | Thêm packshot vào vị trí 5 |
| 102 | AUREL - NOIRÉ – EXECUTIVE CLUTCH | 4 | 5 | Thêm packshot vào vị trí 5 |

## Log đối chiếu và khôi phục

- before.json: snapshot Product và toàn bộ metadata ProductImage trước sửa.
- plan.json: từng ảnh mới, vị trí, đường dẫn nguồn PNG, storageKey, kích thước, SHA256 và metadata ảnh thay thế.
- applied.json: thời điểm COMMIT, imageId/assetId mới, fingerprint giá/biến thể.
- verification.json: đối chiếu dữ liệu sau ghi và kiểm tra HTTP ảnh.
- PNG/WebP nguồn: .local/product-image-audit/. Bộ ảnh gốc ID87: 87-reference.webp; asset cũ vẫn trong DB.
- Khôi phục theo applied.json trong transaction: chỉ xóa ProductImage vừa thêm nếu id+storageKey còn khớp; ảnh ID87 khôi phục đúng metadata old. Không xóa asset cũ hoặc reset sequence; chỉ dọn asset mới khi không còn tham chiếu. Chưa thực hiện rollback trên DB chính.

## Kiểm tra và giới hạn

- Rà soát dữ liệu/ảnh toàn danh mục là công việc được yêu cầu. Nghiệm thu 7 tình huống đạt: 1 rà trực quan bộ ảnh, 1 đối chiếu gallery DB, 1 bảo toàn giá/biến thể, 3 HTTP đại diện (ID57/82/87), 1 PDP ID57. Không chạy full suite.
- Get-NetTCPConnection bị Access denied trong sandbox; kiểm tra HTTP bằng fetch thay cho đọc process.
- HTTP82 lần đầu kỳ vọng 200 bị fail vì sản phẩm ẩn; sửa kỳ vọng thành 404 và chạy lại case này, giữ kết quả HTTP57 đã pass. DB đối chiếu hoàn tất, HTTP87/PDP lần đầu đạt. Lưu verification-first-attempt.json và verification.json.
- node --check apply.mjs/verify.mjs/report.mjs; không chạy lint/typecheck/build ứng dụng vì chỉ thay dữ liệu và ảnh, không đổi mã ứng dụng.
- Ảnh AI có thể sai khác chi tiết nhỏ so với hàng thật; cần chủ shop đối chiếu mẫu hàng thực tế. Không xác minh phiên Admin/checkout hay database remote riêng.
