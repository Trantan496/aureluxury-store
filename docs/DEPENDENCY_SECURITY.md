# Dependency security — AUREL

## Baseline đã kiểm tra 02/11/2026

- Next.js và eslint-config-next16.4.3; giữ ESLint9.39.5, React/Prisma/payos hiện hữu.
- minimatch11.0.3 được pin trong devDependencies; `overrides.minimatch = "$minimatch"` buộc consumer dùng cùng bản upstream đã vá. `npm ls ... --all` phải exit0, không invalid/missing dependency.
- Full audit và production-only audit đều0 vulnerabilities. Xem `LOGS/DEPENDENCY_SECURITY_PATCH.md` cho bằng chứng, giới hạn kiểm tra và các lượt retry.

## Vì sao có lớp tương thích lint

ESLint9 và một số plugin còn dùng API minimatch3 (`require` callable). minimatch11 xuất named API và đã bỏ makeRe để dùng bộ matching không đệ quy. Ép override11 mà không xử lý API sẽ làm hỏng một số rule dù lint thông thường có thể chạy qua.

`scripts/lint-minimatch-compat.mjs` được import đầu tiên từ `eslint.config.mjs`. Trong **tiến trình lint**, nó đổi cached CommonJS export thành callable upstream kèm named helpers, để các plugin cũ và parser hiện đại dùng được cùng engine11. `makeRe()` ở đây chỉ cung cấp object có `.test()` bằng `Minimatch.match`, đúng contract rule `import/no-internal-modules` đang gọi; không tạo RegExp hoặc mang code matching cũ trở lại. Không cam kết implement toàn bộ RegExp API chưa có consumer nào dùng.

Không có import helper này trong app/API/payment runtime. Không bỏ rule hoặc hạ severity. `tests/lint-minimatch-compat.test.mjs` kiểm các helper đã dùng và ESLint API với lỗi Next/React/a11y/import thực. Ngoài npm lint, editor nạp config cũng nhận adapter; adapter không chỉ gắn vào một CLI wrapper.

## Khi cập nhật tiếp

1. Đọc advisory chính thức, chọn patch/minor cùng nhánh khi được; nâng Next và eslint-config-next đồng bộ.
2. Không `npm audit fix --force` hoặc downgrade lint để chỉ xóa cảnh báo audit.
3. Chạy audit full/production, kiểm tree, lint/typecheck/build và chọn regression trong giới hạn test của dự án.
4. Khi các consumer không còn cần API3, bỏ adapter và override sau khi kiểm lại source consumer/tests. Nếu dùng rule mới cần thêm RegExp surface, review trước thay vì giả lập regex không an toàn.
5. Restart đúng deployment sau build; thay dependency/source không tự thay code đã nạp trong tiến trình cũ. Không reset DB hay đổi secrets cho công việc dependency này.

Commands tái lập:

```powershell
npm ci
npm audit --json
npm audit --omit=dev --json
npm ls next eslint eslint-config-next minimatch --all
npm run test:lint-compat
npm run lint
npm run typecheck
npm run build
```

Trong tác vụ này chỉ chạy `npm ci --dry-run --ignore-scripts --no-audit`, không xóa/cài lại toàn bộ node_modules đang được tiến trình khác sử dụng. Các lệnh trên là hướng dẫn cài sạch cho deployment phù hợp.
