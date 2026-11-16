# Codex Project Rules — Fashion Store

## Mission
Build and maintain a professional fashion e-commerce website using Node.js, Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL and Prisma. Deliver an accessible, responsive storefront even when the database contains zero products.

## Mandatory workflow for EVERY task
1. Read `docs/PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` and the most recent entry in `docs/SESSION_LOG.md` before changes. Read relevant code; do not assume docs are correct if code differs.
2. Inspect the repository before modifying anything. Preserve existing code and user changes. If the repository is empty, scaffold incrementally.
3. Implement the smallest coherent change. Reuse existing components and patterns; avoid unnecessary dependencies and speculative abstractions.
4. Check empty, loading, error and success states; never let an empty product collection create a blank homepage. Show real product data only when available. Do not fabricate inventory, prices, order counts or testimonials (admin-configured default 5-star product ratings are permitted when explicitly enabled from Admin).
5. Validate changes when possible (`npm run lint`, `npm run typecheck`, `npm run build`, relevant tests). Do not claim a check passed if it was not run. Record any blockers.
6. BEFORE finishing, update all relevant Markdown files:
   - `docs/PROJECT_CONTEXT.md`: current state, implemented features, key paths, unresolved problems and next recommended step. Replace stale statements instead of appending endlessly.
   - `docs/SESSION_LOG.md`: append one dated entry with task, changed files, important implementation details, commands/results, known issues and exact next action.
   - `docs/DECISIONS.md`: append only meaningful architectural decisions and their trade-offs.
   - `docs/ROADMAP.md`: check off completed tasks and adjust remaining priorities.
   - `docs/ARCHITECTURE.md`: update if architecture, public routes or module boundaries change.
7. End your answer with: summary, files changed, checks actually run, unresolved issues, and documentation updated.

## Giới hạn kiểm thử theo yêu cầu chủ dự án (2026-11-01)
- Mỗi tác vụ tối đa10 test case, tính cả test mới, regression được chọn và nghiệm thu thủ công; thường4–8 case là đủ. Không mặc định chạy toàn bộ npm test hoặc integration suite.
- Đếm từng tình huống độc lập, gồm subtest/parameterized case; không gom nhiều tình huống thành một nhóm để vượt giới hạn. Một case có thể có nhiều assertion cho cùng hành vi.
- Chỉ chạy lại case thất bại sau sửa, ghi lần chạy lại; không xóa test cũ hoặc mở rộng suite không cần thiết.
- Lint/typecheck/build ghi riêng, chạy theo thay đổi; không thay kiểm tra giá/phân quyền/transaction/tồn kho. Tác vụ chỉ sửa tài liệu không cần test ứng dụng.
- Chức năng lớn chia theo đầu ra nghiệp vụ độc lập, xác định danh sách≤10 case trước khi làm; cuối tác vụ ghi kết quả và phần chưa kiểm tra.

## Engineering conventions
- TypeScript strict mode. Prefer server components; use client components only where interactivity requires them.
- Separate UI (`components/`), business logic (`features/`), data access (`lib/` or feature services), and routes (`app/`).
- Validate untrusted input on the server; authorize admin actions server-side; never trust client-provided totals or prices.
- Put secrets only in local environment variables. Commit `.env.example`, never `.env`, credentials, tokens or personal user data.
- Protect checkout, inventory updates, account data, and payment flows before production deployment.
- Avoid unnecessary coupling between future AI modules and the core storefront. AI integrations should fail gracefully without breaking shopping.
- Write code names and file names in English. User-facing UI may be Vietnamese. Record docs in Vietnamese for project readability.
- If the user explicitly requests a different stack or architecture, update documentation to reflect the new decision.

## Initial storefront behavior (zero products)
- Render site navigation, search affordance, hero, shopping categories, explanatory content, footer, and a clear empty-product message.
- Product listing, cart and search have distinct intentional empty states.
- Handle database connection failures with a usable fallback/error view, not a crash or a blank screen.
- Demo content, if used, must be explicitly labelled and cannot create fake orders or stock (admin-managed default 5-star product ratings are permitted).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
