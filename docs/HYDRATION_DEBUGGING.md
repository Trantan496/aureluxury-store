# Điều tra hydration: class `mdl-js`

## Kết quả ngày 2026-10-13
- Đã đọc AGENTS.md và tài liệu dự án trước khi khảo sát. Next.js cài đặt là 16.4.0, React 19.3.0.
- `src/app/layout.tsx` trả `<html lang="vi">`, không class, script hoặc suppression. Không đổi layout/CSS/thiết kế.
- Tìm trong src, tests, cấu hình và manifest/lockfile: không có `mdl-js`, Material Design Lite, script ngoài, `next/script`, `dangerouslySetInnerHTML`, `document.documentElement`, classList/setAttribute hay logic window/localStorage. `is-document.all` trong lockfile là dependency công cụ, không phải DOM mutation của ứng dụng.
- Tìm trong JavaScript/JSON của node_modules và JavaScript/HTML build (không source map): không có marker MDL. Không có dependency MDL/FirebaseUI.
- Client Component duy nhất của ứng dụng là error boundary với nút reset; không sửa DOM trước hydration. `new Date().getFullYear()` trong Footer chạy trong Server Component, không thêm class vào html. Không tìm thấy nesting bất hợp lệ trong các component đã đọc.
- Production HTTP trên port 3016: `/`, `/products`, `/search`, `/cart`, trang 404 đều có đúng `<html lang="vi">`, không `mdl-js`; 8 script chunks được tải đều là đường dẫn `/_next/` và không có marker MDL.
- Không có bằng chứng class bắt nguồn từ dự án. Script được chèn phía trình duyệt (ví dụ extension/userscript có MDL) là giả thuyết chính; chưa xác định extension cụ thể và chưa tái hiện hydration trong trình duyệt người dùng. Tên class một mình không chứng minh nguồn.
- Next.js ghi nhận extension sửa HTML là nguyên nhân hydration mismatch: https://nextjs.org/docs/messages/react-hydration-error
- Báo cáo upstream FirebaseUI có đoạn MDL thêm `document.documentElement.classList.add('mdl-js')`: https://github.com/firebase/firebaseui-web/issues/907. Đây chỉ là dấu hiệu nhận diện, không chứng minh ứng dụng dùng FirebaseUI.

## Xác minh phía trình duyệt
1. Chạy `npm.cmd run dev`, mở cùng URL localhost trong profile Guest hoặc profile mới không extension/userscript. Nếu dùng Incognito, bảo đảm không extension nào được phép chạy trong Incognito. Reload và kiểm tra Console không có hydration warning; `document.documentElement.getAttribute('class')` dự kiến là null.
2. Trong profile bị lỗi, so sánh Network → request Document → Response (hoặc View Source) với Elements → html. Response không class nhưng Elements có `mdl-js` xác nhận DOM đã bị sửa sau khi nhận HTML.
3. Tắt toàn bộ extension/userscript rồi reload. Bật lại từng extension, reload mỗi lần để xác định nguồn; tắt quyền chạy trên localhost hoặc tắt script gây lỗi. Có thể dùng chia đôi nhóm nếu nhiều extension.
4. DevTools → Sources: tìm toàn bộ `mdl-js`, `componentHandler`, `material.min.js`, `material.js`; kiểm tra Content scripts và các nguồn `chrome-extension://`/`moz-extension://`. Network không luôn hiển thị content script của extension.
5. Nếu cần bắt stack, trong Elements chọn html → Break on → Attribute modifications, tái hiện thay đổi. Kiểm tra breakpoint vẫn tồn tại sau reload; nếu mutation xảy ra quá sớm, đặt breakpoint trong content script tìm được rồi reload. Call stack/URL script là bằng chứng để quy nguồn.
6. Nếu vẫn xảy ra trong profile sạch, kiểm tra service worker của origin trong Application (unregister nếu có), cache với Disable cache và hard reload; so sánh localhost trực tiếp với URL qua proxy/hosting. Lưu Document Response, stack và URL script để điều tra tiếp. Dự án hiện không đăng ký service worker hay cấu hình CDN.

Không thêm `suppressHydrationWarning`, class MDL giả vào server HTML, hoặc script xóa class để che nguồn mutation.

## Kiểm tra thực tế
- `npm.cmd run lint`: đạt.
- `npm.cmd run typecheck`: đạt.
- `npm.cmd test`: 5/5 đạt (rỗng, lỗi reader, dữ liệu thành công và query).
- `npm.cmd run build`: đạt Next.js 16.4.0; loading/error được biên dịch, chưa kiểm tra tương tác reset/loading trong trình duyệt.
- Production start tại 127.0.0.1:3016: đạt. Chạy nguyên logic `tests/http-smoke.mjs` qua Node stdin, chỉ thay base URL trong bộ nhớ: 9 HTTP cases và 4 liên kết nội bộ đạt.
- Node stdin kiểm tra root HTML 5 tuyến và 8 served JS chunks: đạt. HTTP không thực thi hydration và không thay thế kiểm tra profile trình duyệt.
- `git status --short`: không chạy được vì thư mục chưa có Git. `npm.cmd ls --depth=0` xác nhận phiên bản; báo một số package WASM optional extraneous, không có MDL. Không thay dependencies.
