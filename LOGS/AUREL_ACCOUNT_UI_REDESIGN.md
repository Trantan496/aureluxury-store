# AUREL — Account Interface Redesign

## Summary

Đã thay giao diện dialog Tài khoản AUREL từ danh sách link cơ bản thành panel quiet-luxury responsive: backdrop blur, surface ivory bo góc, cột nội dung/card ở trái, still-life editorial ở phải và CTA đăng xuất espresso. Giao diện mobile chỉ còn nội dung tài khoản, không có ảnh trang trí.

## Files Modified

- `src/components/auth/account-control.tsx`
- `src/components/auth/auth.module.css`
- `src/components/layout/storefront-header.tsx`
- `src/components/layout/homepage-header.module.css`
- `src/features/shop/service.ts`
- `public/images/aurel/account-editorial-still-life.png`
- `public/images/aurel/README.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/SESSION_LOG.md`

## Design Decisions

- Palette: ivory, warm cream, beige and espresso tokens local to the account CSS; translucent white borders and low-shadow cards reproduce the reference hierarchy without altering global storefront tokens.
- Typography: Georgia/system serif for the editorial AUREL mark and heading; the existing system sans stack for Vietnamese supporting text.
- Account card subtitles, including the rendered email line, were subsequently removed at owner request; card labels now use a lighter 500 weight while the verified state and verification destination remain real.
- Layout: desktop/tablet use 68/32 content-to-editorial columns. After two owner sizing passes, desktop is capped at 760px wide / 540px minimum panel height and tablet at 700px / 560px; heading, cards, icons, spacing and logout scale down together. At 700px and below, the visual is hidden and the dialog becomes a scrollable full-height single column with smaller but still 44px-safe controls.
- Motion: native dialog open animation, restrained card elevation/chevron movement and logout hover; the project-wide reduced-motion rule and a local reduced-motion guard disable transitions.
- Asset: `account-editorial-still-life.png` was generated with the built-in ImageGen workflow from the supplied scene specification, then stored locally. It is decorative (`alt=""`), carries no text/UI and is served with `next/image`.

## Functionality

- Authenticated state, actual session email and actual verification state continue to come from Better Auth `useSession`.
- Profile/address, orders, favorites, verification and logout preserve their real destinations and handlers.
- Better Auth deliberately does not return `role` to its client session. The dialog reads a display-only `isAdmin` boolean from `GET /api/shop?view=account`, which resolves the signed session and user role on the server. It only controls link visibility; all admin pages and mutations still run their own server authorization.
- Native `<dialog>` preserves focus trapping and Escape-to-close. Close buttons, outside-backdrop close, visible focus indicators and semantic links/buttons are retained. Loading, unauthenticated and session-error states remain intentional.

## Testing

- `npm.cmd run typecheck` — passed, exit 0.
- `npm.cmd run lint` — first run found one new React hook lint violation; after the targeted fix, rerun passed, exit 0.
- `npm.cmd run lint` — rerun after the owner-requested compact sizing change passed, exit 0.
- `npm.cmd run build` — passed, exit 0.
- Local read-only HTTP: `/` returned 200 and contained the account trigger; `/images/aurel/account-editorial-still-life.png` returned 200 as `image/png` (1,932,416 bytes).
- Business test cases: 0. The two HTTP checks are read-only; no full test suite was run, respecting the project limit of at most 10 cases per task.

## Visual Verification

Static implementation review confirmed the reference composition is represented in code: wordmark/rule, large serif title, card proportions/icon containers, full-width logout, 68/32 column split, and mobile visual removal.

Browser screenshots and live desktop/tablet/mobile QA were not completed. Computer Use was stopped by the user with a physical Escape key, and the user then instructed that it must not be used. No visual result is claimed as manually verified.

## Known Limitations

- The account dialog needs owner visual review at desktop, tablet and mobile breakpoints to fine-tune crop/spacing if required.
- The editorial still-life is an AI-generated local decorative asset rather than a supplied brand campaign photograph.
- A session-specific ADMIN presentation was not browser-tested, although the display endpoint and build compile successfully; backend admin authorization remains unchanged.
- The second compact sizing pass was CSS-only and deliberately not rechecked by lint/build/HTTP/browser, following the project's current owner instruction not to run tests.
