# Fashion Store

## Clone từ GitHub

```powershell
git clone --recurse-submodules https://github.com/Trantan496/aureluxury-store.git
cd aureluxury-store
git lfs install
git lfs pull
git -C backend/dm-vton apply ../dm-vton-local.patch
```

Cài Git LFS trước khi clone để tải video đầy đủ. Hai thư viện AI dùng submodule upstream; patch giữ chỉnh sửa tương thích máy cục bộ. Env, DB, uploads, Python venv và trọng số AI không nằm trong Git; cấu hình riêng theo tài liệu dự án. Push GitHub chỉ lưu mã nguồn, không triển khai hosting. Tham khảo `docs/PROJECT_CONTEXT.md` để biết tính năng hiện tại; một số phần lịch sử bên dưới mô tả giai đoạn đầu.

> Phase2.5.2: separate app/owner logins verified on an independent PostgreSQL cluster. Main credentials/privileges unchanged; deployment remains NO-GO. See [Database Security & Deployment Readiness](docs/DATABASE_SECURITY_READINESS.md) for grants, cutover and proposed backup policy.

> Phase2.5.1: database-level Order Header Revision remediation verified on test/restore (RC/RR/Serializable). Main deployment remains NO-GO pending separate approval. See [concurrency remediation report](docs/ORDER_CONCURRENCY_REMEDIATION.md).

> Phase 2.5: Multi-currency code/test migration ready; production migration pending approval. Keep MULTI_CURRENCY_ENABLED=false on aurel_ai. npm run db:migrate is intentionally blocked. Read [Multi-Currency](docs/MULTI_CURRENCY.md) before any Prisma deployment; no inferred legacy currency, seed or reset.

Storefront AUREL dùng Next.js App Router, TypeScript strict, Tailwind CSS và catalog PostgreSQL/Prisma. Trang chủ giữ đầy đủ khung giao diện khi DB rỗng hoặc lỗi; không dùng sản phẩm demo thay thế catalog.

## Chạy cục bộ

Yêu cầu Node.js >= 22.13 và npm. Trong thư mục dự án:

```powershell
npm.cmd ci
npx.cmd prisma generate
npm.cmd run dev
```

Mở http://localhost:3000. Trên macOS/Linux có thể dùng `npm` thay `npm.cmd`. Windows có thể chặn `npm.ps1`; dùng `npm.cmd`, không cần đổi execution policy.

Đặt DATABASE_URL trong `.env` để đọc catalog; xem `docs/DATABASE_SETUP.md` để khởi động PostgreSQL local và migrate. Không commit secrets, không chạy seed để kiểm tra kết nối. Thiếu config/DB không truy cập được sẽ hiển thị lỗi catalog trong khung storefront.

## Kiểm tra

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd start
```

`typecheck` tạo kiểu tuyến bằng `next typegen` trước khi chạy TypeScript. `npm.cmd test` dùng Node test runner, không cần DB. `npm.cmd run db:check` kiểm tra SELECT 1; `npm.cmd run test:catalog-db` kiểm tra Prisma reader chỉ đọc với DB đã migrate. `start` yêu cầu build thành công trước đó.

Product Data Service Phase 2.2: điểm vào server-only `src/lib/products.ts`, hướng dẫn tại [docs/PRODUCT_DATA_SERVICE.md](docs/PRODUCT_DATA_SERVICE.md). Service có validation, DB ADMIN guard, CRUD 4 entity và CAS tồn kho; Phase 2.3 dùng resolver Better Auth mặc định. Không tự seed dữ liệu hoặc gán currency. Catalog dùng pagination mặc định 20/trang; `getCatalogPage` cung cấp metadata mà không thay UI hiện tại.

Phase 2.3 đã nối Better Auth: `createProductDataService()` mặc định lấy session request thật. Backend signup/signin/signout/session tại `/api/auth/[...all]`, không có UI Login/Register hoặc tự tạo ADMIN. Cấu hình BETTER_AUTH_URL và BETTER_AUTH_SECRET local theo [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md); giữ secret ngoài Git. Schema auth additive dùng User Int hiện có, không dùng CLI Better Auth generate ghi đè schema. Chưa mail verification/reset; không chạy seed để thử login.

Phase 2.4 kiểm thử ghi PostgreSQL trong `aurel_ai_test`, credentials riêng `.env.test`. Chạy `npm.cmd run test:postgres:setup -- --confirm-test-database=aurel_ai_test`, sau đó `npm.cmd run test:postgres -- --confirm-test-database=aurel_ai_test`. Backup/restore drill và guard bắt buộc tại [POSTGRES_INTEGRATION_TESTING.md](docs/POSTGRES_INTEGRATION_TESTING.md). Không bỏ confirmation hoặc trỏ suite mutation vào aurel_ai.

Khi server đã chạy ở `127.0.0.1:3000`, mở terminal thứ hai và chạy `npm.cmd run test:smoke` để kiểm tra HTTP, nội dung zero-data và liên kết nội bộ. Đây không phải kiểm tra trực quan bằng trình duyệt.

## Các trang

| Đường dẫn | Chức năng hiện tại |
| --- | --- |
| `/` | Trang chủ, cảm hứng danh mục, sản phẩm trống, giới thiệu |
| `/products` | Danh mục trống, liên kết danh mục qua query string |
| `/search` | Form GET, trạng thái chưa nhập và không có kết quả |
| `/cart` | Giỏ hàng trống, liên kết quay lại danh mục |
| URL không tồn tại | Trang 404 |

Các danh mục là hướng phong cách tạm thời, không phải cam kết tồn kho. Chưa có mua hàng, thanh toán, đăng nhập, admin hay dữ liệu sản phẩm thật.

## Cấu trúc

```text
src/app/                 Tuyến trang, layout, CSS, loading/error/404
src/components/          UI dùng lại, header/footer, catalog/search
src/config/site.ts       Tên cửa hàng và hướng danh mục tạm thời
src/features/catalog/    Kiểu dữ liệu, kiểm tra đầu vào, kết quả dữ liệu
src/lib/catalog.ts       Reader server-only nối Prisma, phân biệt empty/error
tests/                   Kiểm thử hợp đồng dữ liệu và query
docs/                    Trạng thái, kiến trúc, thiết kế, lộ trình, lịch sử
```

Sửa token ở `src/app/globals.css`; quy ước thiết kế trong `docs/DESIGN_SYSTEM.md`. Chủ dự án quyết định UI/UX; giao diện ban đầu là đề xuất để tiếp tục tùy chỉnh.

Xem `docs/PROJECT_CONTEXT.md` và `docs/SESSION_LOG.md` để biết kết quả kiểm tra thực tế, giới hạn và bước tiếp theo.


# DATABASE
# AUREL AI Database Starter (Prisma ORM 7 / PostgreSQL)

This directory is a **drop-in starting point**, not a separate Next.js application.
Copy the files into your **existing** Next.js TypeScript project, preserving folders.
Review files that already exist before copying. Do NOT overwrite existing schema or .env.

## A. Prerequisites

- Next.js TypeScript project (assumes a `src/` directory)
- Node.js supported by Prisma 7 (see Prisma docs)
- Running PostgreSQL server and a database called `aurel_ai`
- A real password in local `.env` (never commit credentials)

## B. Install packages (from existing project root)

```bash
npm install @prisma/client@7 @prisma/adapter-pg pg dotenv
npm install -D prisma@7 tsx @types/pg
```

## C. Connection

Copy `.env.example` to `.env`, set DATABASE_URL for **your** PostgreSQL.
Example: `REPLACE_WITH_LOCAL_VALUE`
The `aurel_ai` PostgreSQL database must exist before migration. If using a managed DB,
use its provider's connection string and SSL requirements instead.

Do not commit `.env` to Git. Add it to `.gitignore` if missing.
`src/generated/prisma/` is generated; treat it as generated code.

## D. Run in order

```bash
npx prisma validate
npx prisma migrate dev --name init_aurel
npx prisma generate
npm run db:check
npm run test:catalog-db
npx prisma studio
```

Catalog integration tests chỉ đọc database, không tạo Product/Order. `prisma/seed.ts` và `scripts/test-db.ts` là công cụ demo cũ được giữ nguyên, không thuộc quy trình kiểm tra catalog và không được chạy trong lần tích hợp này.

## E. Data model

User, UserAddress, Category, Product, ProductVariant, ProductImage,
Cart, CartItem, Order, OrderItem, Favorite, AiRecommendation,
VirtualTryOnSession plus status/role enums.

The order item table stores **snapshots** of product name/color/size/price at purchase
time so later catalog edits do not change historic orders.

Images must go in PRIVATE object storage with access control; the database keeps keys.
Users must consent to optional AI/image processing and receive deletion controls.

## F. Critical security notes

- NEVER create public endpoints that accept arbitrary `userId` to read orders.
- `getOrderForUser()` expects a user ID obtained from a verified server session.
- Never store plaintext passwords; use an established auth solution.
- Checkout requires an atomic stock decrement, transaction, payment verification,
  idempotency protection, server-side price computation and validation.
- `stock >= 0`, `quantity > 0`, and AI score range need validation and/or custom
  database CHECK constraints not expressed by these Prisma models.
- Do not run demo seed against production. Demo phone/address are fake placeholders.
- Don't use development DATABASE_URL or local demo credentials in a deployment.

## G. TypeScript generated import extensions

`importFileExtension = "ts"` helps direct scripts executed with `tsx`. If a TypeScript
configuration complains about `.ts` imports, enable `allowImportingTsExtensions`
with a compatible `moduleResolution: "bundler"` in the existing tsconfig, or adjust
generator settings for your bundler/runtime. Never edit generated Prisma files.

## H. Next tasks

1. Add proper authentication and authorization middleware.
2. Add migrations and constraints for order quantity/stock.
3. Implement checkout using transactions and inventory reservation.
4. Add a non-public object storage integration for virtual try-on.
5. Add indexes based on measured query plans; test multiple simultaneous checkouts.

### Official references

- https://www.prisma.io/docs/guides/v7/frameworks/nextjs
- https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference
- https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/seeding
