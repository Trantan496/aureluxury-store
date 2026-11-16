# Khối thông tin và mô tả sản phẩm — 2026-10-22

## Thiết kế hiện tại

Theo ảnh chi tiết chủ dự án gửi: khối1 có thanh nhấn dọc taupe, huy hiệu số tròn gradient và tiêu đề đậm; sáu ô ba cột với icon barcode/chữ/liên kết/danh mục/lớp/tag. Input cao42px, prefix nền ivory, dấu bắt buộc đỏ, nút `+` danh mục espresso; collection gợi ý từ dữ liệu thật, brand mặc định AUREL cho sản phẩm mới và nút xóa input. Responsive2/1 cột giữ nguyên layout toàn trang; CSS chỉ .infoCard, không đổi card2/3/homepage.

Mô tả là vùng soạn thảo lớn với toolbar: đoạn/tiêu đề2–3, đậm/nghiêng/gạch chân/gạch ngang, bullet/numbered/indent/quote, link, ảnh đã cấp quyền, bảng, undo/redo và mở rộng/thu nhỏ bằng CSS/Escape. Các nút có xử lý thật; ảnh disabled khi chưa có ảnh website-granted/evidence/public. Thêm ảnh bằng số thứ tự từ các ảnh hợp lệ hiện có, không upload giả hoặc nhập URL ngoài. Link dùng prompt và kiểm tra scheme trước chèn. Bảng chèn cấu trúc2 cột rỗng để người dùng nhập.

Đây là **soạn thảo nguồn Markdown giới hạn + Xem trước**, không phải WYSIWYG/HTML editor đầy đủ. Sau khi định dạng, ký hiệu xuất hiện trong ô nguồn; nút Xem trước hiển thị kết quả như trang sản phẩm. Giới hạn nesting: các inline styles không lồng nhau, link URL không chứa whitespace/parenthesis, table tối đa12 cột/51 rows được render, không hỗ trợ raw HTML. Toolbar chữ/glyph gọn, chưa xác nhận giống từng pixel ảnh. Mở rộng là vùng fixed trong trang, không yêu cầu browser Fullscreen API.

## Hợp đồng lưu và tương thích

- Vẫn dùng Product.description nullable Text, không schema/migration/flag/dependency mới. Chỉ áp dụng định dạng khi có marker `aurel-description-v1\n`; nội dung plain cũ, kể cả literal ** hoặc HTML-looking strings, giữ nguyên. Không backfill hoặc đổi dữ liệu main.
- Khi bấm toolbar định dạng, editor lưu marker + nguồn hỗ trợ. Nguồn chỉ toàn khoảng trắng không giữ marker, tránh lưu tên marker như mô tả. Giới hạn10000 UTF-16 characters gồm marker, undo history80 snapshots trong RAM, không autosave/localStorage.
- `description.ts` pure parser whitelist blocks/inline; renderer ProductDescription chỉ tạo React elements/text, không dangerouslySetInnerHTML/DOM HTML parsing. URL chỉ http/https/mailto hoặc slash nội bộ, chặn controls/backslash/protocol-relative/data/javascript. Ảnh chỉ resolver public `/images/...` và phải có trong allowedImages của sản phẩm.
- PDP truyền allowedImages từ public DTO đã lọc website rights; admin preview/editor truyền đúng ảnh websitePermission=granted +rightsReference. Nội dung ảnh không hợp lệ hiện placeholder/alt thay vì URL. Không suy diễn AI rights từ website grant; feature export image policy cũ giữ nguyên.
- Validator trước đây chặn toàn bộ C0, gồm newline, khiến cả plain paragraph không lưu được. Nay chỉ description cho phép LF/CR/tab; vẫn chặn NUL/control khác và giữ10000. Name/brand/slug/alt/SKU không được nới multiline. Existing ADMIN/CSRF/version/ownership rules không đổi.
- Nút xóa brand gửi null thật; management default AUREL chỉ khi thiếu key, không thay null có chủ ý. EditorDraft default AUREL chỉ cho new; saved null hiển thị rỗng. Không thao tác xóa brand trên main thay chủ dự án.
- PDP chỉ thay renderer trong vùng mô tả cũ, không đổi layout/galley/variant controls. SEO và ML export dùng descriptionText bỏ marker/format để không đưa cú pháp nội bộ vào content features. CSV description vẫn chuỗi, giữ marker/newlines qua CSV quote/parser; không đổi sáu headers.

## Kiểm chứng và giới hạn

- 4 focused unit tests mới: legacy literal, supported block/inline/table +plain feature text, URL/image-rights gate, multiline-only-description và limits/control chars. Suite80/80, lint/typecheck/build đạt.
- Guarded test:product-editor10/10 (gồm parent): thêm assert raw multiline/formatted description round-trip và saved brand null vào test rename hiện có; regression auth/CSV/ownership/archive/delete vẫn đạt. Không pending migration mới trên test; chỉ test fixtures mutate và cleanup/rollback. Main fingerprint/.env unchanged, không gửi mail. pg query-queue deprecation cũ vẫn hiện.
- Không browser/Test Screen/Computer Use/Playwright/screenshot/HTTP QA. Visual QA **Pending Manual Review**: input prefix alignment, font/spacing/3–2–1 cột, category modal, brand clear/save/reload, toolbar selection/undo/redo/Ctrl-Z/IME, preview/source/fullscreen Escape, links/image permission/table và lưu/lấy lại với signed ADMIN thật. Chưa cam kết WYSIWYG hoặc full CommonMark.

Files: components/admin/product-editor.tsx,description-editor.tsx,admin-icon.tsx,products.module.css; components/products/product-description.tsx và CSS; features/products/description.ts,validation.ts,management.ts,editor-state.ts,feature-export.ts; app/products/[slug]/page.tsx; tests/product-description.test.ts,product-editor.integration.test.ts; package.json. Các file migration/.env/schema không đổi.
