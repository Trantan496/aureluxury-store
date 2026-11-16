# AUREL — Login page redesign

## 1. Tổng quan
Dựng lại `/login` theo ảnh tham chiếu (desktop 1792×859): header 92px, ảnh editorial 50.25%, card kính ~662px / radius 48px. Giữ nguyên Better Auth và logic `submitAuth`.

## 2. File
Tạo:
- `src/components/auth/login-page.tsx` (layout server component)
- `src/components/auth/login-form.tsx` (client form)
- `src/components/auth/login-icons.tsx` (icon outline kiểu Lucide inline; `lucide-react` không có trong dự án nên không cài thêm; icon Apple/Google/Facebook)
- `src/components/auth/login.module.css`
- `public/images/image1.png` (bản sao nguyên vẹn, SHA-256 trùng file gốc ở root)
- `LOGS/AUREL_LOGIN_REDESIGN.md`

Sửa:
- `src/components/auth/auth-page.tsx`: mode `login` dùng `LoginPage`; register/forgot/reset/verify không đổi.
- `src/components/layout/storefront-header.tsx`: nhánh header riêng cho `/login`.
- `src/components/layout/footer.tsx`: ẩn footer trên `/login` (tham chiếu không có footer, tránh scrollbar ở 1792×859).

## 3. Triển khai
- Font: stack serif sẵn có (Times New Roman/Georgia) và Arial, khớp ảnh tham chiếu; không thêm font ngoài (không cần mạng).
- Heading card ~61px, heading editorial ~68px (đo theo độ rộng chữ trong ảnh mẫu; lớn hơn khoảng 52–56/64px nêu trong brief).
- Card: blur 16px, viền trắng 1.5px, đổ bóng nhẹ; input 51px/radius 15, nút 60px, social 49px.
- Hover/focus 150–250ms, `prefers-reduced-motion` được tôn trọng; checkbox tùy biến, bật/tắt hiện mật khẩu.

## 4. Ảnh
`/images/image1.png` qua `next/image` (`fill`, `priority`, `object-fit: cover`, `object-position: 30% 38%`). Overlay gradient tối dần xuống đáy. Ảnh không bị sửa.

## 5. Xác thực
Dùng `authClient` và `submitAuth("login", …)`, `safeReturnTo`, redirect khi đã có session, lỗi `role="alert"`, khóa gửi trùng, spinner khi gửi. Quên mật khẩu → `/forgot-password`, tạo tài khoản → `/register`, Trở về → `/`.
- "Ghi nhớ đăng nhập" nay **mặc định được chọn** (theo ảnh tham chiếu); trước đây mặc định tắt.
- Cấu hình hiện chỉ có email/mật khẩu, nên nút Apple/Google/Facebook **bị vô hiệu hóa** (giữ giao diện, không có hành vi giả).
- Các nhánh `login` trong `auth-form.tsx` nay không còn dùng cho `/login` (chưa xóa để tránh thay đổi ngoài phạm vi).

## 6. Responsive
- ≥1280: chia đôi như tham chiếu. 768–1279: ảnh 44%, card thu nhỏ padding, benefits xếp dọc. <768: header gọn, ảnh hero 300px, card radius 24px chồng nhẹ lên ảnh, ẩn dòng benefits.

## 7. Kiểm tra đã chạy
- `tsc --noEmit` và `eslint src/components/auth src/components/layout`: exit 0 (trước chỉnh cỡ chữ/padding CSS cuối cùng; các chỉnh sau chỉ là CSS).
- Chụp ảnh Chrome headless qua `next dev` ở 1792×859, 900×1100, 390×844 (cửa sổ headless tối thiểu ~500px nên ảnh mobile bị cắt), 1366×768.
- Không chạy `npm run build`, test tự động, hay đăng nhập thật với DB/trình duyệt (chưa kiểm submit end-to-end).

## 8. So sánh thị giác
Desktop khớp bố cục, tỉ lệ cột, vị trí card (~x1015–1677, y105), kích thước input/nút, chiều rộng heading. Khác biệt nhỏ: crop ảnh hơi khác (tham chiếu phóng hơi lớn hơn), nền lá/bóng ở góc phải chỉ xấp xỉ bằng gradient, eyebrow trái cao hơn tham chiếu ~10px. Chưa so pixel-diff nên không khẳng định pixel-perfect. Card cao hơn mẫu ~5px trước khi giảm padding dưới; chưa chụp lại sau chỉnh đó.

## 9. Tồn tại
- Tablet dọc (900×1100): ảnh portrait chỉ thấy người mẫu nam.
- Mobile thật 390px chưa xác minh; dev-indicator Next xuất hiện trong ảnh chụp (chỉ ở dev).
- Cần cấu hình provider (Better Auth `socialProviders`) rồi nối nút social.


---

# Bổ sung: trang /register (2026-11-02)

- Áp dụng cùng thiết kế cho `/register`; không có ảnh tham chiếu riêng nên dùng chung design system của login (bố cục, card, input, nút, header, ảnh `image1.png`).
- Tạo: `auth-editorial.tsx` (panel ảnh dùng chung, tách từ `login-page.tsx`), `register-page.tsx`, `register-form.tsx`; thêm `UserIcon` và style `.compact/.help/.registerCard` vào `login.module.css`. Sửa `auth-page.tsx`, `storefront-header.tsx`, `footer.tsx` (header riêng, ẩn footer cho `/register`).
- Giữ nguyên copy cũ ("Một khởi đầu riêng." + mô tả), 4 trường (họ tên, email, mật khẩu, xác nhận), validation `submitAuth("register")` (mật khẩu 12–128 ký tự, khớp xác nhận), thông báo thành công theo `deliveryAvailable`, ẩn form sau khi tạo thành công kèm link xác minh email/đăng nhập, redirect khi đã có session. Không có khối social ở trang đăng ký (chưa có provider).
- Kiểm tra: `tsc --noEmit` + eslint (auth, layout) exit 0; chụp Chrome headless 1792×859 (vừa khung, không scroll), 1792×1000, 900×1100, 500px. Không chạy build, không thử tạo tài khoản thật (sẽ ghi vào DB), chưa xác minh trạng thái lỗi/thành công bằng giao diện.
- Việc login và register chia sẻ `login.module.css`; nhánh register trong `auth-form.tsx` nay không còn dùng cho `/register`.
