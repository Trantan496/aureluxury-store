# Authentication Backend — Phase 2.3

## S?a l?i kh?c origin local ? 2026-10-26
Signin t?i127.0.0.1:3000 b?403 INVALID_ORIGIN; reset-request b?403 INVALID_REDIRECT_URL khi BETTER_AUTH_URL d?nglocalhost. C?ng request t?ilocalhost tr?401 cho credential c? ? sai v?200 cho reset email kh?ng t?n t?i. next.config.ts chuy?n c?c trang auth/admin v?localhost tr??c khi hi?n th? form. Gi? origin/CSRF guards. PostgreSQL hi?n k?t n?i ??t; kh?ng thay password/session/role ho?c g?i email th?t trong ch?n ?o?n. M? http://localhost:3000/login; restart server khi config m?i ch?a n?p.


## Cấp ADMIN theo chỉ định chủ dự án (2026-10-22)
- Đã cấp ADMIN cho duy nhất tài khoản hiện hữu được chủ dự án chỉ định trực tiếp. Đối chiếu email chính xác/ID, emailVerified=true trước khi cấp. Không tạo user, không tự xác minh email, không đổi password/session/secrets/schema/database roles/grants.
- Transaction Serializable, khóa row và conditional UPDATE đúng ID/email/role=CUSTOMER, affected row=1; cập nhật role và updatedAt. Hậu kiểm read-only xác nhận ADMIN và trạng thái verified giữ nguyên. Audit intent/committed fsync trong .local/audit/admin-provisioning.jsonl, chỉ metadata; danh tính chi tiết giữ local, không chép email cá nhân vào docs/source công khai.
- API ADMIN với anonymous vẫn401. Product Service đọc lại DB role mỗi operation, không cần restart hoặc tự tạo signed session. Chưa thử bằng cookie/password của người dùng, không yêu cầu chia sẻ credentials. Bước tiếp theo: người dùng mở http://localhost:3000/admin/products bằng tài khoản được cấp; visual/user-session QA thủ công.

## Email website chính đã cấu hình (2026-10-22)
- Theo yêu cầu bật xác minh email, đã reuse credentials Resend của chính dự án từ .env.test, chỉ cấu hình RESEND_API_KEY và EMAIL_FROM trong .env local; không in/commit secrets. Địa chỉ gửi AUREL <no-reply@fourdteam.win>; GET provider domains200 xác nhận fourdteam.win verified trước khi thay đổi.
- Đã restart đúng Next start của workspace ở cổng3000 để nạp env mới; không restart PostgreSQL. GET /verify-email và /forgot-password200, deliveryAvailable=true, không còn thông báo dịch vụ email chưa sẵn sàng. Session/auth secret và các biến env khác giữ nguyên, requireEmailVerification vẫn false.
- Chưa gửi email trong task này hoặc tự xác minh tài khoản; người dùng reload trang rồi bấm Gửi lại email xác minh để gửi tới địa chỉ của mình. Không tạo/sửa user/role/schema, không migrations hoặc test fixtures. Provider configuration/domain readiness không phải bằng chứng email đã đến inbox.
- Bước tiếp theo: chủ dự án gửi từ UI, kiểm tra Inbox/Spam và mở link xác minh; link local chỉ dùng khi truy cập được localhost:3000. Nếu cần public deployment phải cấu hình origin public phù hợp riêng.

## Khôi phục đăng nhập/đăng ký local (2026-10-22)
- Lỗi thực tế: PostgreSQL không nhận kết nối, db:check báo ECONNREFUSED. Đã chạy db:start ngoài sandbox để bật cluster hiện có; SELECT1 sau đó đạt. Không sửa auth code/env/security/schema, không migrate/seed/main fixtures.
- Website http://localhost:3000 đang phục vụ, khớp BETTER_AUTH_URL. GET /login và /register200 có form; get-session200/null; signin với tài khoản không tồn tại trả401 INVALID_EMAIL_OR_PASSWORD thay vì lỗi DB. Main read-only audit hiện0 User/Account, cần đăng ký tài khoản thật trước khi đăng nhập.
- Kiểm tra Better Auth + PostgreSQL thật trên aurel_ai_test: signup200/CUSTOMER, signin200, signed session đúng user, logout200 và replay null; fixture cleanup, main fingerprint và .env unchanged. Provider main đã được cấu hình trong bước tiếp theo2026-10-22; requireEmailVerification=false giữ nguyên. Không gửi email thật/tạo tài khoản main.
- Bước tiếp theo: đăng ký tại http://localhost:3000/register với mật khẩu12–128 ký tự rồi đăng nhập. Nếu DB lại dừng: npm.cmd run db:start, npm.cmd run db:check; PostgreSQL portable không tự chạy theo website. Chưa xác định nguyên nhân process DB đã dừng trước task.


## Trạng thái cập nhật Phase2.9.2 (2026-10-21)
Main local aurel_ai đã apply đủ5 migrations, không còn pending; ba SQL staging được chủ dự án cho phép sau backup/restore/no-drift/rehearsal đạt. Không seed/main fixtures hoặc thay secrets/roles/table grants/ownership. ADMIN Product Management đã có tại /admin/products, nhưng main0 ADMIN và provisioning cần approval riêng. MULTI_CURRENCY_ENABLED vẫn hiệu lực false; public catalog/PDP luôn lọc websitePermission=granted từ schema đã deploy, độc lập cờ AI. Production role/cutover/audit/offsite backup chưa GO. Xem [ADMIN_PRODUCTS.md](ADMIN_PRODUCTS.md) cho evidence/routes/tests/limits. Các mô tả staged/main pending bên dưới là lịch sử trước Phase2.9.2.


## Database runtime profile Phase2.5.2 (chưa cutover main)
Better Auth đã được kiểm bằng LOGIN DB ít quyền trên cluster riêng: User INSERT CUSTOMER guard/UPDATE cột không role; Account/Session/Verification DML; signup/signin/session/logout và revoked ADMIN vẫn đúng. Owner riêng chỉ promote fixture trong lab, không tài khoản ADMIN main. Candidate policy không đổi provider/config/runtime .env; main vẫn login cũ/NO-GO. Xem DATABASE_SECURITY_READINESS.md trước bất kỳ cutover credentials nào.

## Kế hoạch migration đã rà soát và áp dụng

Người dùng chọn Better Auth, Next.js App Router, Prisma ORM 7/PostgreSQL (2026-10-20). Không dùng CLI Better Auth generate để ghi đè schema.

- Giữ User.id Int/autoincrement và tất cả FK Cart/Order/Favorite/AI hiện có. Better Auth dùng `advanced.database.generateId: "serial"`; adapter tự chuyển ID string ở API sang numeric khi truy vấn DB. Tham chiếu [numeric IDs](https://better-auth.com/docs/concepts/database#numeric-ids).
- Ánh xạ field Better Auth name → fullName, giữ fullName hiện tại. Thêm User.emailVerified boolean NOT NULL DEFAULT false và image nullable; không sửa passwordHash/role hoặc suy diễn email đã xác minh.
- Thêm Session, Account, Verification với Int serial PK, Session/Account.userId Int tham chiếu User. Chỉ các FK bảng auth mới có cascade; FK nghiệp vụ hiện có không đổi.
- Giữ passwordHash legacy nguyên vẹn; Better Auth credential password hash lưu Account.password. Không copy hash chưa biết thuật toán hoặc tự tạo Account cho user cũ; cần quy trình đặt/reset mật khẩu có xác minh sau này nếu có user legacy.
- Tạo SQL bằng Prisma migrate diff từ database hiện có sang schema; đọc SQL và kiểm tra không DROP/TRUNCATE/DELETE, không đổi PK/cột/FK cũ. Gói BEGIN/COMMIT trước khi apply bằng migrate deploy; không reset/seed/migrate dev tự động.
- Trước/sau migration kiểm tra trạng thái migrations và số bản ghi nghiệp vụ. Không tạo tài khoản ADMIN hoặc người dùng thử trong PostgreSQL hiện tại.

## Kiến trúc đã triển khai

Better Auth dùng đúng Prisma Client singleton `src/lib/db/client.ts`, không tạo pool riêng. API backend tại `/api/auth/[...all]` cho sign-up/email, sign-in/email, sign-out và quản lý session. Phase2.7 đã có UI Login/Register/Verify/Forgot/Reset; không có product mutation endpoint.

Session database-backed, cookie cache tắt. Resolver phía server gọi `auth.api.getSession` bằng request headers và tắt cookie-cache; lấy User.id đã xác minh, expiresAt từ session, không đọc JSON role/userId. Product service vẫn kiểm tra expiry và tra User.role trong transaction mỗi operation, bảo đảm role thu hồi có hiệu lực mà không cần đăng nhập lại.

Session cookie do Better Auth ký/kiểm tra; giữ origin/CSRF checks, cookie HttpOnly/SameSite và secure trên HTTPS. Không viết JWT/cookie parser riêng. Secret chỉ nằm trong .env; base URL/trusted origin cố định theo cấu hình deployment.

## Kết quả migration và giới hạn đối chiếu

Migration `20261020153000_better_auth` đã được đọc SQL trước khi apply bằng migrate deploy, có BEGIN/COMMIT. Chỉ ADD COLUMN/CREATE TABLE/INDEX/FK mới; không đổi User PK, cột/FK nghiệp vụ cũ. Prisma validate/generate đạt, migrate status: 2 migrations, up to date. ID User/Session/Account/Verification vẫn integer; sau kiểm tra, 15 bảng nghiệp vụ/auth đều 0 bản ghi. Không seed/reset hoặc tạo user/ADMIN.

Script chuẩn bị snapshot trước migration nhận nhầm `ON DELETE CASCADE` là DELETE do regex quá rộng. Script dừng nhưng các lệnh shell sau vẫn chạy, nên không có snapshot file trước migration. SQL đã được rà soát thủ công trước đó; hậu kiểm sửa cách nhận diện câu lệnh, xác nhận SQL không hủy dữ liệu/đổi cột/FK cũ. Counts trước đó đã đọc là 0, sau vẫn 0. Không tuyên bố đã có backup hay so sánh snapshot constraints hoàn chỉnh.

## Cấu hình và điểm vào

- Better Auth 1.7.12 được khóa trong package-lock. `features/auth/config.ts` chứa options; `lib/auth.ts` lazy khởi tạo Prisma adapter có transaction bằng singleton hiện có, không pool mới.
- `features/auth/session.ts` gọi getSession với disableCookieCache/disableRefresh rồi chuyển ID numeric-string sang User Int và expiresAt epoch milliseconds. `lib/auth-session.ts` lấy headers từ Next request. `createProductDataService()` mặc định dùng resolver thật; injection resolver chỉ dành cho trusted server composition/tests.
- Service vẫn kiểm tra expiry trước transaction, lúc vào transaction và sau role query; kiểm tra User.role DB trên mỗi operation. Không cache quyền và không nhận JSON/header tự khai userId/role. Resolver/provider failure từ chối session; lỗi truy vấn role trả DATABASE_ERROR, không raw exception.
- User.role trong Better Auth additionalFields có default CUSTOMER, input:false, returned:false; signup/update-user không tự nâng quyền. Không cài admin plugin hoặc tạo endpoint promote user.
- BETTER_AUTH_SECRET random ít nhất 32 ký tự và BETTER_AUTH_URL chỉ nằm trong .env. Đã tạo secret nếu chưa có, không in hoặc commit, không đổi DATABASE_URL. .env.example chỉ có placeholder. Origin phải trùng scheme/host/port triển khai; production yêu cầu HTTPS trừ loopback local, không wildcard trustedOrigins. Đổi cấu hình cần restart.
- Session DB-backed, thời hạn 7 ngày, updateAge 1 ngày qua endpoint session. Resolver quản trị không refresh trong Server Component và không dùng cookie-cache, nên session bị xóa/revoke được tra lại ở lần gọi tiếp theo.
- Rate limit bật: 100/phút, signup/signin 5/phút, lưu bộ nhớ theo process. Nhiều instance cần shared limiter/trusted proxy policy; chưa có deployment. Origin/CSRF vẫn theo Better Auth: request có cookie từ origin lạ bị chặn; signout ẩn danh không cookie có thể trả 200 vì không có session để thay đổi.

| Endpoint | Hành vi |
| --- | --- |
| POST `/api/auth/sign-up/email` | name/email/password, name map fullName; password 12..128 ký tự; CUSTOMER mặc định, autoSignIn=false |
| POST `/api/auth/sign-in/email` | Better Auth kiểm tra credential hash và tạo DB session/Set-Cookie |
| POST `/api/auth/sign-out` | Hủy session và cookie; replay cookie cũ bị từ chối |
| GET `/api/auth/get-session` | Session hợp lệ hoặc null |
| GET `/api/auth/list-sessions` | Session của user đang đăng nhập |
| POST `/api/auth/revoke-session`, `/revoke-other-sessions`, `/revoke-sessions` | Thu hồi session với quyền kiểm tra của Better Auth |

Không thêm Login/Register/Admin UI hoặc product mutation endpoint. Không thêm client cookie/JWT parser. Chỉ API auth cần thiết được public; các route storefront giữ nguyên.

## Kiểm thử và phần còn lại

- `tests/auth.test.ts` dùng engine Better Auth thật và official memory adapter, cùng config production: signup, hash, signin đúng/sai, serial IDs/name mapping, role injection signup/update-user, cookie sửa, session expiry, logout/replay, revoke-session, CUSTOMER/ADMIN role thu hồi. Fixture chỉ nằm trong RAM, không phải provider giả trong production.
- Unit service kiểm tra expiry thiếu/sai/hết hạn kể cả lúc chờ transaction/role query, revocation, DB authorization failure; 37 tests tổng đạt. Read-only PostgreSQL integration 3/3 đạt.
- HTTP production/Prisma: session ẩn danh/forged cookie null; account không tồn tại signin 401; signup input sai 400; signout ẩn danh 200; cookie request cross-origin 403. Storefront smoke 12 routes/13 links đạt. Không signup thành công bằng tài khoản giả trên DB thật.
- Phase 2.4 đã positive signup/login/session/logout, revoke/expiry, role revocation bằng PostgreSQL thật tại aurel_ai_test. Fixture chỉ ở DB test và được xóa; User/Session/Account/Verification của aurel_ai vẫn trống. Chi tiết: POSTGRES_INTEGRATION_TESTING.md.
- Phase2.6 đã cấu hình backend verification/password reset nhưng chưa có email provider production. Password/session authentication không đồng nghĩa đã xác minh ownership email; không tự đặt true. Chi tiết bên dưới.
- Chưa có MFA, UI, quy trình cấp ADMIN, audit trail, migration passwordHash legacy. Không tự tạo/promote user. Cảnh báo pg/Prisma concurrent query từ Phase 2.2 còn xuất hiện nhưng tests đạt; production dependency audit 0, npm install còn 5 high trong dev tooling đã biết.

Phase 2.4 đặt disableOriginCheck=false và disableCSRFCheck=false rõ ràng sau khi PostgreSQL test phát hiện Better Auth mặc định skip origin check trong NODE_ENV=test. Tests không được giảm bảo vệ bảo mật để pass. Chỉ tạo/promote ADMIN fixture trên database test với guard; không tạo ADMIN trong aurel_ai.

Nguồn: [Prisma adapter](https://better-auth.com/docs/adapters/prisma), [schema/serial IDs](https://better-auth.com/docs/concepts/database), [session management](https://better-auth.com/docs/concepts/session-management), [Next.js](https://better-auth.com/docs/integrations/next).

## Phase 2.6 — Verification và password reset (2026-10-21)

- `authOptions({ emailDelivery })` nhận server-only port `AuthEmailDelivery` từ features/auth/email.ts. Phase2.6.1 Resend implementation đã nối tại lib/auth.ts, giữ Prisma singleton; thiếu cấu hình thì delivery vẫn unavailable. Không log recipient, message, token, URL hoặc lỗi provider thô.
- Signup gửi verification khi có provider. Thiếu provider thì signup vẫn thành công với emailVerified=false. `requireEmailVerification=false`, `autoSignInAfterVerification=false`, không chuyển user cũ sang verified.
- POST `/api/auth/send-verification-email`: email, callbackURL tùy chọn. GET `/api/auth/verify-email?token=...`: JWT Better Auth hạn 3600 giây. Sai/hết hạn trả lỗi native 401 hoặc redirect error nếu có callbackURL. Link đã dùng trả thành công idempotent, không tạo session; verification không phải token một lần như reset. Không thêm token store.
- POST `/api/auth/request-password-reset`: email, redirectTo tùy chọn. POST `/api/auth/reset-password`: token/newPassword. Token native hạn 1800 giây, consume một lần trong transaction cùng Account.password và xóa session cũ (`revokeSessionsOnPasswordReset=true`). Password 12–128 ký tự, không sửa passwordHash legacy, không tự đánh dấu emailVerified.
- Thiếu provider: resend/reset-request trả 503 EMAIL_DELIVERY_UNAVAILABLE trước account lookup cho mọi email, không tạo reset token. Có provider: reset-request giữ nội dung trung lập native kể cả transport lỗi; response xác nhận request, không khẳng định đã gửi/đến inbox. Lỗi transport chỉ log thông báo cố định để tránh disclosure tài khoản. Cần giám sát lỗi và cho phép yêu cầu lại. Verification delivery lỗi trả generic 503; signup có thể đã tạo account trước lỗi gửi, dùng resend khi provider phục hồi.
- Callback/redirect vẫn qua origin checks Better Auth. Phase2.7 đã có login/reset UI và callback /reset-password cùng trusted origin; storefront homepage không nhận token hoặc làm reset UI.
- Resend/reset-request 3/phút/IP, reset-submit 5/phút/IP. Limiter memory mỗi process, cần trusted proxy/shared storage khi scale; không tuyên bố chống timing enumeration tuyệt đối.
- tests/auth-email.test.ts có đúng 6 cases, Better Auth thật + official memory adapter + capture delivery: verify/replay/rate limit; invalid/expired; reset/hash/login/expiry; reset replay; session/cookie revocation; neutral response/unavailable/provider failure. Không gửi mail hoặc ghi DB thật. 51 unit tests, lint/typecheck/build đạt. Không đổi schema/custom DB transaction nên không chạy lại PostgreSQL/concurrency suite; chưa có bằng chứng PostgreSQL mới riêng Phase2.6.
- Đối chiếu [email/password](https://better-auth.com/docs/authentication/email-password), [email](https://better-auth.com/docs/concepts/email) và source cài đặt 1.7.12, đặc biệt dist/utils/password.mjs cho native reset transaction. Candidate ACL Phase2.5.2 đã cấp các thao tác auth cần thiết, không thay grants main.

## Phase2.6.1 — Resend integration
- src/features/auth/resend.ts dùng fetch có sẵn theo [Send Email API](https://resend.com/docs/api-reference/emails/send-email); không SDK/dependency mới. Tái sử dụng nguyên templates verification/reset. Chỉ resolve khi provider trả2xx có message id; đây là acceptance, không xác nhận inbox/delivery. Không đổi token/session/requireEmailVerification=false.
- Cấu hình server-only RESEND_API_KEY và EMAIL_FROM theo .env.example; EMAIL_FROM có dạng mailbox hoặc `AUREL <mailbox@verified-domain>`. Domain/sender phải được xác minh trong Resend, dùng key chỉ có quyền gửi phù hợp. Không đặt NEXT_PUBLIC, không commit key, không gửi secret trong chat. Restart server sau khi cấu hình vì auth instance được cache. Thiếu/partial/malformed config trả undefined để signup/signin vẫn hoạt động và resend/reset trả503 như trước.
- Timeout10s, chặn redirect để không chuyển credentials sang host khác; lỗi provider/network/JSON đều sanitized không giữ raw cause/body. 429 đọc Retry-After seconds hoặc HTTP-date, cooldown memory1..3600s/fallback60s, từ chối send trong cooldown, không tự retry nhằm tránh gửi trùng sau timeout. Theo [Usage Limits](https://resend.com/docs/api-reference/rate-limit). Không queue hoặc global throttle; nhiều process cần điều phối hạn mức riêng. Auth endpoint limiter Phase2.6 giữ nguyên.
- Verification lỗi gửi vẫn generic503; reset request giữ neutral acknowledgement kể cả lỗi transport để tránh disclosure. Không biến log thành delivery receipt; cần theo dõi provider dashboard có quyền hạn phù hợp, tránh xuất token/email ra application logs. API Resend nhận nội dung email để gửi; không thêm webhook/logging payload trong app.
- tests/resend.test.ts đúng4 cases: config unavailable; payload/templates/acceptance; sanitized status/network/invalid response/timeout;429 cooldown/no retry. Mọi request đều mock, không dùng key thật hoặc gửi email. Tổng55 tests/lint/typecheck/build đạt.
- Kiểm tra chỉ sự có mặt biến env (không in giá trị): cả key/sender chưa có. Chưa test delivery thật hoặc PostgreSQL+Resend. Sau khi có config hợp lệ và mailbox được chủ dự án cho phép: dùng test-only env/guard xác nhận target aurel_ai_test trước ghi, chạy signup → verify và reset → session revoked, chỉ gửi tới mailbox được phép, cleanup scoped test; không chạy trên aurel_ai, không apply pending migrations. Không tự gửi email production hoặc tự bật requireEmailVerification.

## Phase2.6.2 — Real acceptance hoàn tất (2026-10-21)
- Chủ dự án cấu hình .env.test và cho phép đúng một mailbox trong chat; không chép recipient/password/token/key vào docs. Sender `AUREL <no-reply@fourdteam.win>`. Presence-only key/from/test URL/test secret đạt; Resend GET domains200 xác nhận fourdteam.win Verified. Không lấy/tạo key, không sửa .env chính.
- PostgreSQL local ban đầu dừng: khởi động cluster đã có bằng pg_ctl, không init/create/migrate. testTarget URL guard + SELECT current_database/current_user xác nhận aurel_ai_test/aurel_ai_test_runner, superuser/createdb/createrole/replication=false. Runner chỉ dùng TEST_DATABASE_URL/TEST_AUTH_SECRET, không import app DB singleton hoặc dùng DATABASE_URL main.
- scripts/email-acceptance.ts tái sử dụng helpers/config/adapter/templates, callback loopback127.0.0.1:3316 chỉ GET verify, không debug endpoint/Reset UI. TTY bắt buộc; command input không chứa secrets. Password/token chỉ RAM, metadata report trong .local/email-acceptance không chứa recipient/password/token/key. Verification explicit send sau signup commit để đọc được emailVerified=false trước gửi, override chỉ runner; app sendOnSignUp/requireEmailVerification=false không đổi.

| Hạng mục | Kết quả |
| --- | --- |
| Resend configuration/domain | Configured / API Verified |
| Verification API accepted | Pass, message01a15b93-32e6-7e8f-95de-1f9582b81ed5 |
| Verification provider status | delivered (API read200) |
| Verification inbox | Chủ dự án xác nhận nhận sau kiểm tra lại mailbox và mở link |
| emailVerified | false trước gửi → true sau callback test |
| Reset API accepted | Pass, message01a15b96-7b2d-7694-84f4-208b3295cd27 |
| Reset provider status/inbox | delivered (API read200) / chủ dự án xác nhận nhận |
| Reset password/session | Better Auth reset200; old signin401, new signin200; cookie session cũ get-session=null |
| Cleanup | User/Account/Session/Verification thuộc fixtures còn0; listener đã đóng |
| Main | Không có connection main từ runner hoặc writes main; hash .env trước/sau bằng nhau; NO-GO |

- Chỉ2 send requests tới recipient đã cho phép:1 verification,1 reset, không resend khi inbox chưa rõ. HTTP accepted, provider delivered và owner inbox confirmation được ghi nhận riêng; delivered không tự thay inbox confirmation. Không chạy full PostgreSQL/concurrency suite/migration rehearsal hoặc tạo test cases mới; 55 unit tests/lint/typecheck/build đạt.
- Điều chỉnh test harness trong phiên: truy vấn fixture bằng connection khác lúc signup chưa commit làm bước trước-send lỗi, chưa gọi Resend; owned fixture đầu id13 đã cleanup. Runner dùng explicit send sau commit cho fixture id14. Sau verify, runner cũ mất stdin nên restart cùng fixture, không tạo user/gửi verification lại; chuẩn bị lại credential baseline bằng Better Auth password.hash/internalAdapter.updatePassword chỉ trên owned test fixture rồi signin baseline200 trước reset. Password cũ/new trong kết quả reset là baseline này, không tuyên bố đã kiểm tra plaintext ngẫu nhiên từ process trước. TTY guard ngăn lặp vấn đề input. Không đổi application auth/token/session logic.
- Run chính p262-83eb6d33ae522398; report .local/email-acceptance/p262-83eb6d33ae522398.json lưu accepted IDs/booleans/cleanup, không secret. Cleanup có ownership id+fullName+recipient guard; FK cascade chỉ account/session của user phiên này, reset token đã consume; read-only hậu kiểm guard xác nhận ids13/14 không còn auth fixtures. Không truncate/reset sequences hoặc đụng dữ liệu test không rõ nguồn gốc. Không chụp fingerprint main trước/sau nên không tuyên bố full main fingerprint equality; bằng chứng là đường kết nối runner chỉ test và .env hash unchanged.
- Tiếp theo: review evidence và vận hành monitoring/shared limiter/secret manager. Không cấp production-ready hoặc GO; pending migrations/credentials/main giữ nguyên, không bắt đầu Phase2.7/Admin.

## Phase2.7 — Authentication UI (2026-10-21, yêu cầu mới của chủ dự án)
- /login, /register, /forgot-password, /reset-password, /verify-email dùng chung AuthPage/AuthShell/AuthForm + CSS module. Split editorial desktop tái sử dụng campaign đã có, mobile chỉ form; auth navigation/footer AUREL riêng. Homepage account dialog/menu và secondary header dùng AccountPanel/AccountControl. Không Admin/Customer Dashboard, Checkout, UI framework hoặc thay hero/collection/global CSS.
- lib/auth-client.ts khởi tạo official Better Auth React client, API cùng origin, không env key/secret frontend. UI chỉ truyền allowlisted name/email/password/callbackURL, không userId/role/emailVerified/hash. Backend/API/services hiện có không thay đổi. rememberMe checkbox truyền native flag; autoSignIn signup=false, requireEmailVerification=false giữ nguyên. Login/register có session thì điều hướng internal destination; trạng thái loading/error/session do Better Auth, logout signOut chỉ báo thành công nếu API thành công, client session signals + router refresh cập nhật UI.
- Login next được safeReturnTo kiểm soát: chỉ relative same-origin, chặn protocol-relative/backslash/control/encoded pathname/API/auth loops/token query, fallback/. Validation email/name1..100/password policy12..128 cho đăng ký/reset, confirm phải khớp; signin chỉ cần nonempty/max128 để không chặn credential policy legacy. Native input validation + server Better Auth vẫn là authoritative. Pending state + ref lock chặn double submit; errors generic/role-free,429 hướng dẫn chờ/503 email unavailable.
- Register không giả định login. Khi provider có cấu hình, nhắc kiểm tra/xác minh/gửi lại; thiếu provider nói rõ email chưa verified/delivery chưa sẵn sàng, vẫn có thể login. DeliveryAvailable server boolean chỉ phản ánh cấu hình, không chứng minh provider hoạt động/inbox. Forgot/resend response trung lập xác nhận request, không account existence/delivery. Không gửi email trực tiếp từ frontend, không thêm email thật trong phase này.
- Callback verification native /api/auth/verify-email → /verify-email?result=processed. Error callback chỉ render lỗi chuẩn hóa, không echo query. result=processed là UI thông báo link được xử lý, không chứng minh User.emailVerified: yêu cầu login rồi đọc useSession.user.emailVerified để hiển thị verified thực. Không endpoint riêng sửa trạng thái, không JWT/parser/session implementation thứ hai.
- Reset request redirectTo=/reset-password; native Better Auth callback đưa token vào query, form giữ token trong component memory rồi history.replaceState xóa query. Không log/localStorage/analytics token; metadata no-referrer/noindex, headers private no-store/reset và no-referrer/API; Next request logging bỏ reset/verify/token paths. Cần cấu hình proxy/hosting access logs tương tự trước production; app không kiểm soát logs ngoài hệ thống. Submit token/newPassword qua native API; invalid/expired/used render lỗi + link yêu cầu mới, success sang /login?reset=success và nhắc session cũ bị thu hồi.
- Form labels/autocomplete/name/email/current/new-password, reveal aria-pressed/controls, status role=status/alert + focus, min44px targets/16px inputs, reduced motion và overflow-safe grid có trong code. Chưa tuyên bố keyboard/screen-reader/4 viewport đã kiểm tra thực tế.
- tests/auth-ui.test.ts đúng6 cases dùng injected mock client cho UI orchestration (không phải fake production auth): login; register validation/allowlist; forgot/503/429; reset missing/invalid/success; logout/network; safe redirects/unauthorized. Existing engine tests Better Auth vẫn dùng thật.61 tests/lint/typecheck/build đạt; HTTP5 auth routes200/noindex/landmark, reset no-referrer/no-store, real anonymous session=null, homepage hero/collection SSR đạt. Không gọi signup/mutation endpoints main trong HTTP QA, không PG concurrency/rehearsal hoặc email thật.
- Browser inventory DOM tools rỗng; Windows computer-use thấy Chrome nhưng get_window_state bị policy stop vì không xác định chắc current URL. Dừng mọi browser actions, không có screenshot hoặc visual1440/768/390/320/keyboard/positive browser-flow evidence. Bước tiếp theo: chủ dự án review UI và QA bằng browser được kết nối, positive flow chỉ DB test/capture email; production delivery/migrations/main NO-GO chưa thay đổi.

## Phase2.7.1 — Lightweight QA theo cập nhật chủ dự án
- Chỉ source/CSS/test/HTTP; từ cập nhật scope không dùng Computer Use/browser automation/screenshot. AUTH_UI_QA.md ghi kết quả theo4 viewport dưới dạng phân tích CSS, tất cả Visual QA = **Pending Manual Review**.
- Rà soát tokens/components, validation/confirm, labels/autocomplete/ARIA/focus hooks, same-origin Better Auth, safe redirect và token privacy; không thấy lỗi có bằng chứng cần sửa. Không thay auth/UI logic hoặc thêm test file.61 existing tests/lint/typecheck/build đạt, GET smoke5 trang200/metadata và reset privacy headers đạt.
- Không xác nhận browser Register/Login/Session/Logout, bàn phím/loading/show-hide/duplicate submit thực tế. Không tạo fixture hoặc gửi email thật; instance riêng3331 dùng test URL/secret sau URL/physical guard, delivery tắt, không sửa env main hoặc migrations. Server QA tạm đóng sau kiểm tra; main NO-GO/requireEmailVerification=false không đổi.

## UI sau đăng ký thành công — 14/11/2026
- /register dùng RegisterExperience để đổi sang màn hình success chỉ khi submitAuthregister trảok. Giữ policy backend/không thay auto-sign-in hoặc email enforcement.
- Email cho resend chỉ giữ trong state; nút gọi submitAuthverify với callback /verify-email?result=processed. Delivery chưa sẵn sàng thì tắt gửi lại và hiển thị đúng trạng thái chưa xác minh. Không lưu email trong query/localStorage.
- QA9case APIfixture, không đăng ký/gửi email thật. Chi tiết và giới hạn:../LOGS/REGISTRATION_SUCCESS_2026-11-14.md.

- Điều chỉnh UI 14/11/2026:success nằm gọn trong panel phải của shell đăng ký, giữ editorial trái; không đổi nghiệp vụauth hoặc email. Chi tiết:../LOGS/REGISTRATION_COMPACT_2026-11-14.md.
