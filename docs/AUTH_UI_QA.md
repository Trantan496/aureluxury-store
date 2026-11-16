# Phase 2.7.1 — Lightweight Authentication QA

Ngày: 2026-10-21. Phạm vi theo cập nhật của chủ dự án: chỉ source/CSS, tests hiện có và HTTP; không browser automation, screenshot hoặc nghiệm thu trực quan.

## Kết quả rà soát source
- AuthShell/AuthForm/AuthPage và account components dùng tokens globals.css, serif Times New Roman/Georgia, Arial và ảnh campaign local; không palette/font/framework mới.
- Có label/htmlFor, required/type/maxLength/minLength, autocomplete name/email/current-password/new-password; show/hide type=button với aria-pressed/controls. Status có role=status/alert và focus, form aria-busy; nút disabled + ref lock ngăn gửi trùng. Global focus-visible/reduced-motion được kế thừa. Đây là kiểm tra source, chưa chứng minh thao tác bàn phím/screen reader thực tế.
- Register/reset yêu cầu password12..128 và confirmation khớp; signin nonempty/max128. Payload allowlist không nhận role/userId/emailVerified. Better Auth React client cùng origin, native rememberMe/session/logout/callback/reset; backend vẫn authoritative.
- safeReturnTo chặn URL ngoài origin, protocol-relative/backslash/control/encoded pathname/API/auth loops/token query. Không dựng session/token/hash riêng; không secret frontend. Reset token chỉ RAM, scrub URL, no-referrer/no-store/noindex và request-log filters; callback verification query không chứng minh verified, trạng thái thực lấy từ session.
- Không phát hiện bằng chứng rõ ràng cần sửa code trong lượt rà soát; không redesign, sửa CSS hoặc thêm tests/dependencies.

## Responsive — chỉ phân tích CSS

| Viewport | Quy tắc hiện có | Visual QA |
| --- | --- | --- |
| 1440px | Grid50/50, minmax(0,1fr), panel max620px, padding clamp | Pending Manual Review |
| 768px | Breakpoint<=900:42/58, panel padding28px | Pending Manual Review |
| 390px | <=700:form-only, ẩn editorial, padding24px, input16px | Pending Manual Review |
| 320px | <=350:padding20px, heading36px, rút gọn back link | Pending Manual Review |

Không tuyên bố đã xác nhận overflow, crop ảnh, spacing, contrast thực tế hoặc trải nghiệm liền mạch qua browser.

## Kiểm tra đã chạy
- npm.cmd run lint: đạt.
- npm.cmd run typecheck: đạt.
- npm.cmd test:61/61 đạt, không thêm test file/case.
- npm.cmd run build: đạt.
- HTTP GET-only tại http://127.0.0.1:3331: /login,/register,/verify-email,/forgot-password,/reset-password đều200, heading/noindex đạt; reset no-referrer/no-store đạt. Không tương đương browser interaction hoặc positive form flow.
- Instance QA riêng được guard URL + physical identity aurel_ai_test/aurel_ai_test_runner trước khởi động; chỉ child process dùng test URL/secret, Resend key/from được đặt rỗng trong child, không sửa .env/.env.test. Không tạo fixture/call mutation endpoint/gửi email thật; không cần cleanup DB. Server QA tạm được đóng sau kiểm tra.

## Chưa kiểm chứng
Visual QA: **Pending Manual Review**. Chưa nghiệm thu keyboard/Enter/Tab/focus, autocomplete thực tế, show/hide/loading/duplicate-submit thực tế, hoặc Register→Login→Session→Logout→Login trên browser. Các phần này để chủ dự án review thủ công theo phạm vi mới; unit/HTTP không thay bằng chứng browser.

Main deployment tiếp tục **NO-GO**; không đổi Homepage/Hero/Collection/tokens, schema/migrations/credentials hoặc bật email enforcement.

## Bổ sung QA màn hình success đăng ký — 14/11/2026
- Đạt9 tình huống độc lập:desktop transition/focus/logo;mobile reduced-motion;resendpending/success đúngemail;resend429;signupfailure;loginlink;deliveryoff;desktopfit sau tinh chỉnh;live3000. Retry ghi riêng trong LOGS/REGISTRATION_SUCCESS_2026-11-14.md. Chỉ authAPIfixture bị intercept, không signup hoặc gửi email thật.
- Lint4TSX/typecheck/2productionbuild đạt. Artifacts:../LOGS/registration-success-2026-11-14/. Các kết quả này chỉ bổ sung phạm vi success, không thay pending QA authsession/inbox/publicdomain hoặc các kết quả cũ.

## Success gọn ở panel phải — 14/11/2026
- Desktop1672×941 xác minh card nửa phải/max560px/cao<550px/logo160px và editorial giữ nguyên;mobile390×844 không tràn ngang/logo132px;resendregressionfixtuređạt. Livecase sau deploy xem ../LOGS/REGISTRATION_COMPACT_2026-11-14.md. Không gửi email hoặc tạo user thật. Lint/typecheck/2snapshotproductionbuildđạt.
- Hoàn tất bổ sung:live3000 cũng đạt, tổng4/4 tình huống trong lượt compact; xem LOGS/REGISTRATION_COMPACT_2026-11-14.md.
