# Bình luận & Đánh giá AUREL — 13/11/2026

## Mọi tài khoản được đánh giá sao — 13/11/2026
- Theo yêu cầu mới: đăng nhập là được đánh giá, không cần mua/nhận hàng. Một review/khách/sản phẩm; giữ sửa/xóa, ẩn và chống gửi nhanh. Badge/bộ lọc Đã mua hàng vẫn chỉ căn cứ đơn DELIVERED thật.
- ProductReview.orderItemId nullable; có đơn phù hợp thì liên kết, không có thì null, không tạo đơn giả. PublicProductDiscussion hiển thị mọi review APPROVED, histogram và API review cũ tính mọi review công khai. Điều kiện canRate chỉ cần tài khoản và chưa có review. Giữ Auto5sao/config của tác vụ song song, không thay trong lượt này.
- Đã áp scoped migration 20261114020000_open_account_ratings sau backup/restore/rehearsal, giữ data và sequences cũ. Manifest .local/backups/aurel_ai_reviews_restore_1794588009361_74be54.dump.verified.json. Không migrate-all hoặc fixture main.
- Đạt8tình huống: 2restore/rehearsal, 3backendPG (nonbuyer/guest/buyerbadge), 2regression APIcũ (nonbuyer/duplicate), 1UIgửi4sao. ESLint file đổi, root typecheck, prisma generate và snapshot webpack build đạt. Không fullsuite hoặc session/publicE2E thật.
- Runtime3000: .local/open-account-ratings/release, launcher .local/open-account-ratings/serve.mjs3000, envroot/.datajunction/loopback; giữ rootbuild/snapshot cũ rollback. Bản source khớp toàn bộsrc/prisma trước đổi.
- Bước tiếp: Ctrl+F5, đăng nhập, chọn sao và nhận xét để gửi. Chưa thêm đánh giá chỉ sao không có nhận xét; không thay chức năng khác.


## Cập nhật composer — 13/11/2026
Hàng sao luôn hiện cho tài khoản; chỉ khóa khi đã có review; chọn sao đổi nút Gửi đánh giá. Mọi tài khoản được đánh giá, không cần mua; nhận xét vẫn bắt buộc. Đã bỏ chữ trang trí và footnote lặp. Lượt sửa riêng5case đạt, lint/typecheck/build đạt; không chạy lại bộ kiểm thử trước hoặc ghi production. Runtime mới .local/review-composer-fix/release.


## Kết quả
- Thiết kế ivory/beige/taupe, serif AUREL, bo góc mềm, bóng nhẹ. Giữ vị trí Box 3 trong cột thông tin PDP, không đổi gallery, giá, mua hàng hoặc thử đồ.
- Summary thật gồm trung bình, tổng số và phân bố 5→1 sao. Thống kê không phụ thuộc bộ lọc/phân trang và nhận mọi review APPROVED của tài khoản; badge mua hàng được xác minh độc lập. Không dùng số liệu mẫu hoặc Auto 5 sao trong dữ liệu công khai của luồng này.
- Composer avatar chữ viết tắt (không dựng ảnh người dùng giả), nhập bình luận, chọn tối đa 3 ảnh JPEG/PNG/WebP ≤4 MB/ảnh. Mọi tài khoản được chọn thêm sao; không mặc định chọn 5 sao. Tài khoản khác vẫn bình luận được.
- Feed chung bình luận/đánh giá cũ, badge mua hàng xác minh từ DB, ảnh có lightbox, thích/bỏ thích, trả lời tối đa 4 cấp, menu xóa/ẩn. Admin thật có tên AUREL Official và badge Shop chính hãng.
- Mới nhất/Cũ nhất, Có hình ảnh, 5 sao, Đã mua hàng; kết hợp bộ lọc phía server. Phân trang 10 thread gốc/trang, giữ các con theo thread. Mobile một cột, filter cuộn ngang; hiệu ứng 180ms và reduced motion.
- Gửi/thích/trả lời/xóa/ẩn/sửa review cập nhật qua API, không tải lại trang. Điểm sao trên giá nghe sự kiện theo slug từ summary vừa tải. Nếu lưu thành công nhưng tải lại danh sách lỗi, composer thông báo đã lưu để tránh khách gửi trùng.

## Dữ liệu và migration
- Migration: `prisma/migrations/20261114010000_product_discussion/migration.sql`.
- Giữ nguyên ProductReview, ProductComment và dữ liệu xác thực. ProductDiscussion liên kết review/comment gốc, lưu body cho phản hồi. Backfill chỉ tạo liên kết, không sửa nội dung/sao/người dùng cũ.
- Trigger AFTER INSERT trên hai bảng cũ tự tạo liên kết, giữ tương thích endpoint cũ. FK cascade dọn replies/likes/images khi xóa gốc. CHECK giới hạn cấu trúc root/reply, nội dung và kích thước ảnh; PK(discussionId,userId) chặn lượt thích trùng.
- PublicProductDiscussion là view recursive dùng chung cho feed, quyền tương tác và ảnh. Nội dung bị ẩn, con của nội dung bị ẩn, review không còn hợp lệ hoặc sản phẩm inactive không truy cập công khai. API bình luận cũ cũng lọc qua view.
- Ảnh lưu BYTEA riêng trong PostgreSQL; xử lý bằng sharp sẵn có, kiểm tra định dạng thật/pixel limit, xoay đúng hướng, mã hóa WebP và bỏ metadata. Không ghi file upload vào thư mục snapshot, không tạo orphan khi transaction thất bại. Route ảnh private/no-store/nosniff kiểm tra lại quyền hiển thị mỗi lần.
- Mutation dùng session hiện tại, kiểm tra Origin, transaction Serializable có retry và khóa user/target. Quyền chủ nội dung/ADMIN được kiểm tra ở server; client không cấp userId, role, badge, likes count hoặc giá trị summary. Gửi cách nhau ít nhất 10 giây. UTC cho mutation mới; không sửa timestamp lịch sử.
- Runner scoped: `node --experimental-strip-types scripts/activate-product-reviews.ts --confirm-database=aurel_ai --discussion`. Không migrate-all hoặc seed main.
- Đã áp lên main sau full backup → restore → fingerprint → rehearsal → đối chiếu main không đổi → transaction DDL+metadata. Manifest `.local/backups/aurel_ai_reviews_restore_1794584261355_cf4870.dump.verified.json`, SHA256 SQL `1d90f50c1b18e69586e086a6be87f3fbd2dc69b44d7364252e63b12a292cfa41`. Dữ liệu/sequences cũ được bảo toàn. Backup/DB restore chứa dữ liệu thật, chỉ lưu local, không public.

## API và file chính
| Path | Vai trò |
| --- | --- |
| `GET /api/product-discussion` | viewer, eligibility, summary, feed/bộ lọc/phân trang |
| `POST /api/product-discussion` | multipart bình luận/review/reply và ảnh, lưu atomic |
| `PATCH /api/product-discussion` | trạng thái like idempotent hoặc ADMIN ẩn |
| `DELETE /api/product-discussion` | chủ nội dung/ADMIN xóa, cascade replies |
| `GET /api/product-discussion/images/[id]` | WebP chỉ khi nội dung còn công khai |
| `src/features/reviews/discussion-{input,types,service,http}.ts` | validation, payload, DAL/nghiệp vụ, upload/CSRF |
| `src/components/products/product-reviews-section.tsx`, `.module.css` | UI chung, composer/thread/filter/lightbox |
| `src/components/products/product-rating.tsx`, `product-detail-view.tsx` | cập nhật sao trên giá theo slug |
| `src/app/products/[slug]/page.tsx` | SSR discussion, lỗi riêng không làm crash PDP |
| `src/features/reviews/{comments,service}.ts` | tương thích API cũ và summary chỉ dùng review thật |
| `tests/product-discussion.test.ts` | 6 tình huống backend trên restore riêng |

## Kiểm tra thực sự đã chạy
Yêu cầu giới hạn 10 tình huống độc lập. Harness có 10 mã nhóm (2 DB, 6 backend, 2 UI), nhưng UI desktop kiểm tra các thao tác độc lập: thích, gửi, lightbox, XSS; mobile kiểm tra bố cục và reduced motion. Đếm tách đúng quy định là 14 tình huống, vượt giới hạn10. Đây là sai sót lập phạm vi kiểm thử, đã dừng không chạy thêm. Không full suite, không tạo inventory/đơn/bình luận thử trên main.

| # | Tình huống | Kết quả |
| --- | --- | --- |
| 1 | Full backup được restore và fingerprint khớp | Đạt |
| 2 | Migration rehearsal, bảo toàn dữ liệu/sequences cũ | Đạt |
| 3 | Tài khoản chưa mua gửi bình luận kèm ảnh qua parser/DB/route đọc ảnh thật | Đạt |
| 4 | Hai request like cùng tài khoản không cộng trùng | Đạt |
| 5 | Phản hồi shop được lưu đúng parent/root/depth và official | Đạt |
| 6 | Khách khác bị chặn xóa bình luận | Đạt |
| 7 | Shop ẩn thread, các con và URL ảnh mất hiển thị | Đạt |
| 8 | Review từ đơn DELIVERED cập nhật histogram và bộ lọc 5 sao/đã mua | Đạt |
| 9 | Desktop: composer/like/ảnh hiển thị và cập nhật tại chỗ, XSS là plain text | Đạt |
| 10 | Mobile390px: không tràn ngang, filter cuộn, nút gửi và reduced motion | Đạt |

- #3–8 dùng session adapter mock nhưng DAL/transaction/PostgreSQL/sharp thật; fixture chỉ trong DB restore đã guard tên. Auth provider không bị thay đổi trong source ứng dụng.
- #9–10 dùng Chrome headless trên PDP preview3022; API fixture TEST lấy từ #3–5, không ghi production. Lần đầu cả hai lỗi selector region: aria-labelledby tạo tên “Bình luận & Đánh giá”, không phải aria-label. Chỉ retry #9/#10 sau sửa harness, cả hai đạt. Không rerun các case backend đã pass.
- Lệnh: `$env:RUN_DISCUSSION_DB_TESTS='true'; npx.cmd tsx --conditions=react-server --tsconfig tests/tsconfig.ui.json --test tests/product-discussion.test.ts` (6/6); `node .local/discussion-redesign/ui-check.mjs 9 10` (2/2).
- `npm.cmd run lint`, `npm.cmd run typecheck` đạt. ESLint file thay đổi và typecheck cuối chạy sau hardening. Production snapshot build webpack đầy đủ TypeScript/2workers đạt; build release cuối bao gồm cập nhật UTC/API cũ/stars sync và nguồn mới nhất.
- Không chạy thêm kiểm thử sau khi nhận ra UI đã gộp nhiều tình huống độc lập. Bỏ thích, xóa thành công, mọi định dạng upload lỗi, CSRF thật, signed-cookie auth end-to-end, cấp thread2–4, bộ lọc kết hợp nhiều trang và cập nhật sao trên giá sau hardening chưa có case độc lập trong lượt này.

## Giới hạn và vận hành
- Tài khoản chưa có ảnh hồ sơ dùng initials. Chưa hỗ trợ video, thông báo realtime tới người khác, sửa text bình luận tự do, hoặc thích trực tiếp phản hồi legacy lưu trong `adminReply`; phản hồi legacy vẫn giữ nguyên và được trình bày chính thức. Phản hồi mới dùng thread có thích/trả lời đầy đủ.
- Lấy 10 root/trang; các con được tải theo root, tối đa 4 cấp. Thread rất nhiều con chưa có phân trang riêng; theo dõi kích thước payload trước khi mở rộng quy mô. View recursive ưu tiên tính nhất quán quyền; cần đo query khi dữ liệu lớn.
- Cấu hình Auto 5 sao từ tác vụ song song được giữ nguyên trong store/Admin, nhưng public summary không dùng fallback giả theo yêu cầu hiện tại. Không xóa cấu hình hay bảng cũ.
- Đã phát hành bản release .local/discussion-redesign/release vào runtime3000; sourceDifferences=[] tại điểm đổi, log Ready, env root/.data junction và bind loopback giữ nguyên. Bản chat-rag-v2/release giữ để rollback app. Không rollback bằng DROP bảng sau khi đã có bình luận thật.
- Bước tiếp: nghiệm thu bằng session khách/shop thật trên public domain trong một lượt test có ngân sách mới; ưu tiên các nhánh chưa kiểm tra trên.
