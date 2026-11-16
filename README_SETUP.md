# Codex Documentation Starter for a Node.js Fashion Store

## Chạy demo cập nhật 01/11/2026
Voucher mới: ADMIN vào `/admin/vouchers` tạo mã, khách áp mã tại `/checkout`. Hướng dẫn và quy tắc tính tiền tại [docs/VOUCHERS.md](docs/VOUCHERS.md). Build mới đã được tạo; khởi động lại launcher để dùng sau cập nhật.
Nhấp đúp `start-demo.cmd`, mở `http://localhost:3000/products`. Đã có 8 mặt hàng DEMO, giỏ/COD/đơn khách và admin. Dùng tài khoản hiện hữu; không có mật khẩu demo mặc định mới. Danh sách chức năng, checks và phần còn thiếu: [docs/DEMO_IMPLEMENTATION_2026-11-01.md](docs/DEMO_IMPLEMENTATION_2026-11-01.md). Sau khi sửa code, chạy `npm.cmd run build` trước launcher. Hướng dẫn starter bên dưới là lịch sử thiết lập.

## Install into your repository
1. Download and extract this bundle.
2. Copy `AGENTS.md` to the ROOT directory of your Node.js project (same directory as `package.json`, if present).
3. Copy the whole `docs/` directory to the root. If files already exist, compare and merge manually; do not overwrite your notes blindly.
4. Open that root project folder in Codex / VS Code.
5. Paste the contents of `CODEX_START_PROMPT.md` as the first Codex request.
6. After Codex finishes, inspect `docs/PROJECT_CONTEXT.md` and the latest `docs/SESSION_LOG.md` entry to ensure they describe REAL changes and checks.

## On each later task
The root AGENTS.md instructs Codex to read context first and update documentation last. You can reinforce this with:

> Read AGENTS.md and docs/PROJECT_CONTEXT.md. Implement this task, run the appropriate checks, and update PROJECT_CONTEXT.md, SESSION_LOG.md, ROADMAP.md and relevant architectural docs with factual changes before finishing.

## Limitations
- These files are instructions and templates; they do not create a running website by themselves.
- An agent following instructions may still miss a documentation update, so review changes and Git diff.
- This package does not contain API keys, user data, product inventory or payment integration.
