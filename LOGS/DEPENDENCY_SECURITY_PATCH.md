# Vá dependency security — 02/11/2026

## Kết quả

Audit trước17 mục (16moderate,1critical), sau **0 vulnerabilities**, cả full và production-only. Next.js16.4.0 →16.4.3; eslint-config-next16.4.0 →16.4.3. Giữ ESLint9.39.5 và các dependency nghiệp vụ/auth/payment. Typecheck, production build16.4.3 và lint đạt. Không thay database, environment, payment registration hoặc dữ liệu người dùng.

## Nguyên nhân và cách vá

- Critical/high của Next.js liên quan ba advisory, có bản vá từ16.4.1; chọn patch mới nhất nhánh16.4 tại lúc kiểm tra là16.4.3. Nguồn chính thức: [image optimization advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [use cache advisory](https://github.com/advisories/GHSA-673q-mjm6-r5xr), [Server Actions DoS advisory](https://github.com/advisories/GHSA-p3m5-59mp-jv5r).
- Các mục moderate lan truyền qua minimatch<11.0.1 trong lint, không phải16 lỗi business độc lập. [Advisory minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) xác nhận bản vá11.0.1; pin upstream11.0.3, npm override dùng cùng engine cho các consumer.
- Không downgrade ESLint/config như đề xuất semver-major của audit. Không chạy `audit fix --force`, không che advisory, không giữ minimatch3 dưới version giả.
- API11 khác3: helper `scripts/lint-minimatch-compat.mjs` nạp đầu ESLint config, chỉ đổi export shape trong lint process. Legacy callable và helpers/modern named matcher vẫn hoạt động. Rule import cần makeRe().test() được chuyển sang nonrecursive upstream matcher; không khôi phục regex engine cũ.

## Files

- Sửa `package.json`, `package-lock.json`, `eslint.config.mjs`.
- Thêm `scripts/lint-minimatch-compat.mjs`, `tests/lint-minimatch-compat.test.mjs`, `docs/DEPENDENCY_SECURITY.md`, báo cáo này.
- Cập nhật `docs/{PROJECT_CONTEXT,ARCHITECTURE,ROADMAP,DECISIONS,SESSION_LOG,PAYOS_SETUP}.md` và ghi chú follow-up trong báo cáo payOS. Các thay đổi giao diện/account/orders hiện có của chủ dự án được giữ nguyên.

## Kiểm tra và kết quả thực

| Kiểm tra | Kết quả |
| --- | --- |
| Full `npm audit --json` | Exit0, total0 |
| `npm audit --omit=dev --json` | Exit0, total0 |
| `npm ls next eslint eslint-config-next minimatch --all` | Exit0, toàn bộ consumer minimatch11.0.3, không invalid/missing |
| `npm ci --dry-run --ignore-scripts --no-audit` | Exit0; chỉ simulation, không fresh install thực |
| `npm run lint` | Exit0, không giảm/bỏ rule |
| `npm run typecheck` | Exit0 |
| `npm run build` | Exit0, Next16.4.3, routes shop/payos/account/admin được compile |

Tối đa **10 case riêng biệt** cho task:

1. CommonJS callable và ESM class consumer.
2. Legacy Minimatch class/dotfile options.
3. makeRe().test() dùng cho rule import.
4. filter helper/ignore glob.
5. match helper/brace expansion.
6. defaults binding.
7. Modern named export dùng bởi TypeScript ESLint.
8. ESLint API vẫn bắt lỗi Next/React/accessibility/import, và ignore generated files.
9. payOS ownership không giả được.
10. Chữ ký webhook giả không cập nhật tài chính.

Lượt đầu `node --test tests/lint-minimatch-compat.test.mjs`:6đạt/2fail. Một fail do giả định ESM default luôn callable thay vì đúng contract class mà consumer sử dụng; sửa assertion để kiểm contract thực. Fail còn lại phát hiện makeRe đã bị upstream11 loại bỏ; triển khai facade test bằng matcher mới. Chạy lại đúng case1,3 và case8 đã bổ sung assertion import:3/3đạt. Năm case khác không chạy lại. Hai case payOS chọn bằng `--test-name-pattern='ownership cannot|invalid SDK signature'`:2/2đạt ngoài sandbox để tránh tsx Windows ENOMEM đã biết. Tổng10case đều đã có kết quả đạt, không full suite, không DB/payment network thật.

Audit/metadata/install cần network nên dùng escalation sau sandbox audit lỗi endpoint. Audit cuối trả0 cả full/production. Không khai thác RCE, không gửi tiền hoặc làm thay đổi external registration.

## Sự cố trong quá trình sửa

- Bản nâng Next báo EPERM khi npm dọn một thư mục SWC tạm đang bị khóa. Install vẫn exit0 và build nạp đúng16.4.3; không kill tiến trình người dùng để xóa thư mục tạm.
- Đã thử package compatibility cục bộ qua npm file override; npm10 tạo sáu junction trỏ sai ở dependency con. Audit0 ở thời điểm đó **không được coi là hoàn tất** vì tree còn invalid. Đã bỏ thử nghiệm, gỡ đúng sáu junction do task tạo sau khi kiểm đường dẫn/target đều trong node_modules của workspace, xóa metadata link cũ và regenerate lockfile. Source của chủ dự án không bị xóa; các link generated có thể tái tạo bằng npm.
- Cách cuối dùng upstream registry11.0.3 thật và adapter chỉ trong config lint. `npm ls` exit0, lock không còn reference local adapter/junction sai; dry-run ci đạt.

## Quyết định / giới hạn / bước tiếp theo

Adapter tạm thời là trade-off để giữ ESLint9/plugin hiện hữu và dùng matcher đã vá; cần gỡ khi upstream consumer chuyển sang API hiện đại. Chi tiết tại docs/DEPENDENCY_SECURITY.md và ADR038. Không thay đổi architecture/data routes nghiệp vụ.

Chưa chạy fresh npm ci trên máy sạch, browser visual hoặc DB integration; những mục này không được suy ra từ build/mock tests. Không restart server/Tunnel hoặc deploy thay người dùng. Kiểm tra cổng3000 ở cuối không thấy listener; lần khởi động deployment tiếp theo cần dùng dependency/build mới. Các bước payOS migration/public webhook/owner real payment QA vẫn chưa hoàn tất và không nằm trong việc vá dependency này.
