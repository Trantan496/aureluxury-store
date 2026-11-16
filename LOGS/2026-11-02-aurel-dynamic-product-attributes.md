# AUREL Dynamic Product Attributes — 02/11/2026

## Task summary

Upgraded the Admin Product Editor's “Thuộc tính & dữ liệu AI” section into a type-aware workflow without changing catalog inventory, pricing, image, or variant behavior.

## Existing architecture discovered

The editor is a client component backed by `features/products/management.ts`; `ProductProfile` persists shared metadata. Existing `garmentType`, style, season, and occasion options already existed in the taxonomy registry.

## Files created

- `src/features/products/dynamic-attributes.ts`
- `prisma/migrations/20261102110000_dynamic_product_attributes/migration.sql`
- `tests/dynamic-attributes.test.ts`
- This report.

## Files modified

- `prisma/schema.prisma`
- `src/components/admin/product-editor.tsx`
- `src/components/admin/products.module.css`
- `src/features/products/editor-state.ts`
- `src/features/products/management.ts`
- `src/features/products/pending.ts`
- Project documentation listed in the session log.

## Product attribute configuration implemented

All 11 requested product types have controlled, machine-readable specific attributes. Shared semantic keys (for example `neckline`, `sleeve_length`, `pant_leg_style`, and `waist_rise`) are reused. The t-shirt print-position field is conditional on Logo/Graphic. Global style, season, and occasion chips remain one shared set and are never category-dependent.

## Database/schema changes

Added additive `ProductProfile.dynamicAttributes JSONB NOT NULL DEFAULT '{}'` with an object-shape constraint. The migration has not been applied to a database.

## UI/UX changes

The section now shows: product type first; global attributes in a responsive grid; selected-type fields; then the retained context chips. Desktop remains two-column, and existing breakpoints collapse it to one column on mobile.

## Backwards compatibility

Existing profile fields, variants, colours, sizes, images, prices and category data are unchanged. Existing profiles load an empty dynamic object. Server validation rejects stale/inapplicable type-specific values instead of silently storing them.

## Tests performed and results

- `npx.cmd prisma generate`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run typecheck`: passed.
- Scoped dynamic-attribute test: 5/5 passed with `node --conditions=react-server --experimental-strip-types --test tests/dynamic-attributes.test.ts`.
- The first attempted `tsx` runner failed before assertions with host `uv_os_get_passwd` ENOMEM; rerunning through the project's TypeScript strip loader passed.
- No DB migration, build, browser, or integration workflow was run.

## Known limitations or unresolved issues

The additive migration must be backed up and rehearsed before application. Per-attribute JSONB indexes have intentionally not been created; add only when real catalog filter queries require them.

## Recommended next improvements

Apply the migration using the project’s guarded workflow, then manually verify all 11 product types and an existing legacy product on desktop/tablet/mobile.
