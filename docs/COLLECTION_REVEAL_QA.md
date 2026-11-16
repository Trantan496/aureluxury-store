# Kiểm tra Collection Scroll Reveal — 2026-10-13

## Đã có bằng chứng
- Lint/typecheck/build đạt; 8 unit tests đạt (catalog và ưu tiên dữ liệu thật/lỗi/demo).
- HTTP production: 9 cases, 4 link destinations; collection nằm giữa hero và categories; 4 demo cards SSR. Ba ảnh hero gốc và ảnh optimized trả 200.
- Hero TSX SHA256: `03A9C8E5ECD1C430704C4F43F942AC938E1167C36D57A8D096958858F1024743`.
- Hero CSS SHA256: `BBBD15A0FE38D518B658E0CA1137F21BD9718346BDFD6DAA925B5E146D51AAF6`.
- Hai hash trước/sau giống nhau; giữ nguyên sửa đổi ÁUREL/font sizing của người dùng.

## Chờ browser — không coi code review là render QA
Công cụ inventory trả browsers rỗng; mở Chrome trả `Browser is not available: chrome`. Chạy `npm.cmd run dev`, mở localhost:3000 trong browser kết nối và kiểm tra:

1. 1680×900: lúc đầu không thấy collection; hero/header đúng bản duyệt.
2. Scroll xuống: panel ivory che hero, hai mép ảnh vẫn tồn tại, không nền trống; đầu panel rộng 92%, khi tới top viewport rộng 100%. Scroll lên đảo lại cùng vị trí.
3. Heading/category và hàng đầu xuất hiện trước khi panel chiếm toàn màn hình; heading 500ms, card 600ms, stagger 90ms, không chờ qua khoảng trống lớn.
4. Desktop >=1024 có 4 cột; tablet 900–1023 có 3; <=899 có 2. Kiểm tra 1024×768, 900×600, 768×1024, 390×844, 320×568; document scrollWidth không vượt clientWidth.
5. Clothing hiển thị 3 demo, Accessories 1, All Pieces 4; active underline và aria-pressed đúng. Tab/Enter/Space hoạt động, live status đọc số lượng. CTA đến /products. Cards không giả làm detail links.
6. Reduced motion: không sticky/mask/translate; đầy đủ nội dung normal flow. Tắt JS: mọi section/card vẫn đọc được, CTA dùng được (filter cần JS).
7. Console không hydration/runtime error; scroll nhanh xuống/lên, đổi orientation và resize không để lại nội dung ẩn. Kiểm tra 200% zoom.
8. Performance trace: không React rerender theo scroll, không long task đáng kể, không CLS do ảnh; đo trong browser thật, chưa có số liệu FPS/LCP/CLS.

## Fashion Search — checklist bổ sung
- Đã chạy lint/typecheck/build, 11 tests, HTTP smoke 9 cases/4 links; HTTP xác minh search nằm sau hero/trước heading collection, placeholder/suggestions/disclosure có trong SSR.
- Hash scroll wrapper `FBFE5C93EDDC95D624B953B835C5862AE3CCE4AC55552C6899B2BF643517BCDA` và collection CSS `5117E2BCD144E46E5F675EAD81CB6E8FD148F2003ABAEC795DC5A26ADF463112` giữ nguyên, cùng hai hash hero ở trên.
- Cần browser: 1680×900, 1024×768, 768×1024, 390×844 và 320×568; input/chips/action không overflow, hàng đầu vẫn thấy khi panel tới top, không thêm pinned sequence.
- Click từng suggestion: chỉ điền/focus input; Enter hoặc Explore mới lọc. Minimalist everyday → 3 mẫu; Oversized neutral → knit; wide-leg trousers → trousers. Taupe → trousers, Accessories keyword → bag. Category Clothing/Accessories tiếp tục kết hợp query.
- Query trắng → thông điệp nhập từ khóa; “purple boots” → no-result; Clear search reset query, giữ category; chọn All Pieces để thấy tất cả mẫu. Thử Tab/Enter/Space và live status, reduced-motion, focus lúc section đang fade, hydration console. Chưa xác minh các hành vi này bằng browser.
- Browser inventory ở lượt search đầu tiên vẫn apps=[]/browsers=[]; không có phiên live để poll.

## Giới hạn dữ liệu
Reader vẫn rỗng. Bốn ảnh mock photography được tạo bằng built-in image_gen, không phải ảnh hàng hóa thật; UI ghi AI IMAGE / DEMO và mọi giá đều ghi demo. Đã xem từng ảnh; 4 optimized URLs trả 200 và tỷ lệ 1086×1448 (3:4). Prompt/nguồn ở public/images/aurel/collection-demo/README.md. Để nối thật, mở rộng model/adapter với ảnh, giá, category và detail URL đã tồn tại. Không phát minh dữ liệu thiếu; reader error dùng error state thay vì demo. Chưa có wishlist/variants/detail route.
