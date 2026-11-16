# Ảnh chiến dịch AUREL

Đặt ba ảnh gốc của chủ dự án vào thư mục này, giữ nguyên tên:

- `warm_toned_cinematic_fashion_duo.png` — ảnh đôi người mẫu, panel trái.
- `warm_knit_portrait_with_freckles.png` — chân dung, panel trên phải.
- `sunlit_leather_bag_and_scarf.png` — phụ kiện, panel dưới phải.

2026-10-13: người dùng đã bổ sung đủ ba tệp gốc. HTTP production xác minh cả ba URL 200 và URL next/image được render cho ảnh chính trả 200. Không dùng ảnh thay thế hoặc cắt ảnh từ screenshot. Hero dùng next/image, sizes responsive và preload ảnh chính. Chờ browser QA crop ở 1680×900, 768×1024, 390×844.

2026-11-01: `intelligence-runway.webp` ???c xu?t t? `image.png` do ch? d? ?n cung c?p (1670?942, sharp WebP quality90, 274.972 bytes), thay video Intelligence. Gi? ?nh ngu?n nguy?n v?n.

2026-11-01: `account-editorial-still-life.png` là ảnh still-life dọc dùng riêng cho cột trang trí của dialog Tài khoản. Ảnh được tạo bằng built-in ImageGen theo brief AUREL (túi giấy ivory, quai espresso, knitwear và bàn travertine), không chứa UI, chữ thương hiệu hay dữ liệu sản phẩm; UI và điều hướng vẫn là HTML thật. Kích thước nguồn 1.932.416 bytes, dùng local qua `next/image` và không hotlink nguồn ngoài.
# Product listing editorial backdrop

`products-editorial-backdrop.png` được tạo ngày 02/11/2026 bằng built-in ImageGen cho nền riêng của `/products`: plaster ivory, vòm kiến trúc và bóng lá; không có người, sản phẩm, chữ hay logo. Asset chỉ làm nền trình bày, không đại diện cho hàng hóa hay dữ liệu catalog.

# AUREL Edit Modern Minimalist

`aurel-edit-modern-minimalist.png` được tạo ngày 02/11/2026 bằng built-in ImageGen cho card đầu tiên của The AUREL Edit. Đây là campaign styling illustration, không phải ảnh hàng hóa, người thật, inventory hoặc endorsement.

`aurel-edit-modern-gentleman.png` được copy ngày 02/11/2026 từ `image.png` do owner cung cấp, chỉ dùng cho card hai The AUREL Edit. Asset là visual editorial, không phải dữ liệu hàng hóa hoặc inventory.

