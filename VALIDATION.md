# Verification record — 18 October 2026

## Single-owner console completion

- Final TypeScript, ESLint and production client/Worker build passed.
- Final unit/integration run: 70 passed across 7 files (`vitest run --testTimeout=20000`). Owner cases cover stale stock writes, atomic transfers and concurrent transfer rejection, discount timing/non-stacking and consistent catalogue/detail/quote prices, publish readiness, protected image deletion, standalone R2 media, category ordering/artwork preservation, price-change logging and a business-snapshot restore into a fresh SQLite schema with foreign-key verification.
- Final focused owner browser run: 10 passed across desktop and mobile (1.5 minutes). Covers every desktop management page, mobile layout/overflow, product search and visual specifications, homepage product ordering without JSON, Pakistan schedule conversion, disabled-discount persistence/removal, transparent image preview/upload/removal and private backup downloads. Initial locator issues were corrected; a real pre-hydration search-input issue and missing inline product upload form were fixed before the final clean run.
- Screenshots: artifacts/owner-dashboard-desktop.png, artifacts/owner-dashboard-mobile.png, artifacts/owner-inventory-desktop.png, artifacts/owner-inventory-mobile.png, artifacts/owner-sales-desktop.png and artifacts/owner-sales-mobile.png.
- Migrations 0008 and 0009 were applied locally. Browser mutations used temporary disabled sales and unused media assets, which were removed. Actual product prices and stock were not invented or changed by the browser checks. No live deployment, production identity configuration, remote D1 Time Travel recovery or R2 backup/restore is claimed.
- Owner instructions and tracked launch prerequisites: OWNER_GUIDE.md and OWNER_CONSOLE_CHECKLIST.md. No separate owner/staff permissions were introduced.

## Passed

- `pnpm typecheck`: strict TypeScript and React Router route type generation.
- `pnpm lint`: application, configuration and test source. Generated build and Playwright report assets are excluded.
- `pnpm peers check`: no dependency peer conflicts.
- `pnpm test`: **49 tests passed across 5 files**.
- `pnpm build`: client assets and Cloudflare Worker SSR bundle built successfully.
- All four local D1 migrations applied successfully; local demonstration seed loaded separately.
- `E2E_URL=http://127.0.0.1:8787 pnpm test:e2e`: **10 tests passed**, 44.3 seconds, against the compiled Worker served by Wrangler with local D1/R2 bindings.
- Browser bundle scan found no server-only Turnstile secret, Access issuer, admin allowlist or local admin configuration names.

## Automated coverage

Unit/integration tests cover Pakistani phone normalization; delivery/pickup validation; cart limits; note validation; ignored client prices; customer consent; complete URL-encoded WhatsApp messages; long-message copy fallback; Pakistan-time unique identifiers; CSV quoting and formula protection; immutable snapshots; unique constraints; transaction rollback; no handoff stock reservation; atomic confirmation; competing orders; cancellation stock restoration; allowed status transitions; actual ephemeral D1 order persistence; identical and concurrent retries; conflicting idempotency keys; missing shipping/variants; changed totals; persistence failure without handoff; CSRF; Turnstile hostname/action failure; verified-number gating; shipping specificity; signed Access identity, allowlist, audience and expiry checks; product/variant changes; audit records; CSV all-row validation; and validated R2 upload/deletion.

Turnstile and Access JWKS HTTP responses are mocked only inside isolated tests. Signature verification uses real generated RSA keys. These tests are not evidence that the owner's Cloudflare Access/Turnstile accounts have been configured.

Browser checks cover homepage and product rendering, bag quantities and persistence across refresh, checkout navigation and configuration gating, URL search filters, search dialog/Escape behavior, unauthorized admin/API requests, and no document overflow at 320/360/375/390/430/768/1024/1440px on homepage, catalogue, product and checkout pages.

## Environment

Windows, Node 24.19.0, pnpm 11.25.0, React Router 8.4.0, Wrangler 4.151.1, Playwright 1.64.1 and Microsoft Edge 155.0.4283.62. Desktop Chromium/Edge and iPhone 13-sized Chromium emulation were used; this is not native Safari or physical device coverage. Exact package resolution is in the lockfile.

The final browser suite ran against the **compiled production build locally**, not the Vite development server and not a deployed Cloudflare account. Local bindings keep demonstration data enabled. Remote deployment configuration disables it.

## Resolved findings

- Adapted context and metadata APIs to installed React Router 8 types.
- Selected TypeScript 6 for typescript-eslint compatibility and removed an unused adapter with an incompatible peer declaration.
- Bounded and consumed mutation request bodies before routing, fixing local runtime connection reuse after early CSRF rejection.
- Added an explicit customer-reviewed total check before order persistence.
- Made the controller's initial render visible without JavaScript.
- Reset product-local selection when navigating between product records, and prioritized variant-specific images.
- Made replacement primary-image updates transactional with upload metadata.
- Added loading feedback and waited for actual checkout navigation in browser assertions. The compiled Worker passed the flow.

## Evidence and limits

Screenshots: `artifacts/storefront-preview.png`, `artifacts/home-desktop.png`, `artifacts/home-mobile.png`.

No live deployment, real customer message, payment, owner-approved product asset verification, physical-device WhatsApp handoff or production Lighthouse/Core Web Vitals measurement was performed. The launch checklist remains authoritative for owner/account-dependent verification.

## Storefront expansion verification — 18 October 2026

- TypeScript and ESLint: passed after the final storefront, account and admin changes.
- Unit/integration suite: 59 passed across 6 files. New isolated D1 cases cover one-time/expired email links, hashed sessions, production email fail-closed behavior, newsletter confirmation/consent, inquiry CSRF/honeypots, pre-order separation, address/order ownership, unsafe promotion destinations, quote-only products, digital stock allocation and encrypted code isolation.
- Desktop/mobile browser regression: 17 passed, 1 intentionally skipped (duplicate mobile sign-in mutation flow), 4.1 minutes. Covers real product imagery, PS5 generation filtering, quote inquiries, store/payment pages, local sign-in, saved addresses/sign-out, campaign controls, existing cart/search/dialog behavior and horizontal overflow at the requested widths.
- Production client and Cloudflare Worker builds: passed. All eleven initial catalogue images decoded successfully in the local browser. Screenshots: artifacts/production-storefront-desktop.png, artifacts/production-storefront-mobile.png, artifacts/astro-bot-product.png.
- Browser testing exposed and repaired a React Router data-navigation issue: information/account/catalogue loaders now use the normalized loader URL rather than raw .data request paths.
- The regression run used the locked-down local admin configuration. A loopback-only owner identity was enabled afterward in the ignored .dev.vars file for local admin review. Production Access enforcement remains unchanged and is covered by signed-token tests. Do not use this local identity outside development.
- Owner-supplied addresses, phone/WhatsApp and bank/payment instructions are loaded locally. Eleven real product listings are price-on-request with no invented stock. Hours could not be verified; shipping fees, returns/warranty and production credentials remain pending.
- No remote deployment, actual bank transfer, live transactional email, real customer WhatsApp message, physical-device test, external account integration verification, or production performance result is claimed. Newsletter/provider setup and digital encryption require secrets before public activation. See PRODUCTION_SETUP.md.

Final local admin smoke check: overview/readiness, real-product content editor, promotions, inquiries, subscribers, categories and settings all returned HTTP 200 and rendered in the browser. Screenshot: artifacts/admin-launch-readiness.png. The dev server remains running for the user’s requested review.

## Centered product showcases — 18 October 2026

Newsletter/account removal follow-up: removed the newsletter footer and component, customer account routes, login navigation and checkout account/address prompts. Guest checkout does not load profiles or addresses. New newsletter/confirmation actions return 410; legacy unsubscribe remains usable. Digital baskets direct customers to contact the store. Existing records and staff Access security remain intact. TypeScript and ESLint passed. Browser checks passed on mobile and desktop for missing entry points, guest form rendering and 404s on retired URLs; the initial desktop run hit its 60-second timeout and the isolated rerun passed in 22.6 seconds.

Targeted feature integration checks: 10 passed initially; the legacy digital-delivery case exceeded its 5-second timeout and passed on an isolated rerun with a 20-second limit. All 11 targeted cases passed across those runs, including rejection of retired subscription/confirmation actions.

Transparent image follow-up: all ten default category images were checked for a genuine zero-alpha background. Removed the CSS white category-image panels, changed the starter games category to an actual transparent Returnal case, and saved the monitor background-extraction result as public/catalogue/category-monitors-transparent.png using the built-in imagegen tool (prompt/source in public/catalogue/transparent-image-notes.md). Shared product visuals clip the opaque Spider-Man 2 case source to its measured retail-package bounds; thumbnails use the same renderer. TypeScript and ESLint passed. Browser checks cover desktop/mobile category image loading, transparent panel styling, case rendering and image zoom. Screenshots: artifacts/transparent-categories-desktop.png and artifacts/transparent-categories-mobile.png. The original manufacturer image files remain intact.

Storefront demo removal follow-up: local DEMO_MODE is false; the development banner and mock product artwork are removed. Browser smoke checks found no demo/preview content or demo product links on home, shop, controllers, games, branches, returns and privacy pages. A direct demo product request returned 404. A browser seeded with an old demo bag verified that hydration removes demo items from persisted storage. Screenshot: artifacts/storefront-no-preview.png. Email preview tokens are now gated by explicit demo mode, with a local non-demo fail-closed unit case added. Real price/stock and policy requirements remain in force.

Demo removal checks: TypeScript and ESLint passed. Unit/integration run: 59 passed and one existing concurrent-order case exceeded its 5-second timeout; that case passed when rerun alone with a 15-second limit. All 60 cases therefore passed across those runs, rather than in a single clean full-suite run.

Category navigation follow-up: all ten homepage categories now have locally served manufacturer/publisher images, with equal image areas and aligned labels. Desktop and mobile browser smoke checks decoded all ten images successfully and found no horizontal page overflow. Source records: public/catalogue/category-sources.json; default mappings: app/lib/category-images.json. Admin category image settings override these defaults. Targeted ESLint passed. Screenshots: artifacts/category-images-desktop.png and artifacts/category-images-mobile.png (captured before replacing the monitor's wide hero photo with its clearer front product view).

- Replaced the controller and games homepage layouts with centered, horizontally scrolling product stages, visible neighboring items, platform tabs, synchronized details and collection/product links. Controllers retain the black-and-white palette; the games stage now follows the user's subsequent blue-and-white reference with a pointed transition, compact cases, flat side previews and tighter content spacing.
- Added four genuine manufacturer controller photographs and seven publisher photographs of physical PS5 retail cases. Original image files are preserved; CSS framing uses measured bounds. Sources are recorded in public/catalogue/showcase-sources.json. Prices and stock remain unconfirmed, so these listings use contact-for-price rather than invented purchase availability.
- Focused Playwright suite: 5 passed, 1 intentionally skipped (touch-only case on desktop). Covers desktop/mobile arrows, keyboard, tabs, wheel, mouse drag, actual emulated touch swipes, centered alignment and preservation of vertical page scrolling. This run used the local development server; mobile coverage is Chromium emulation, not a physical device.
- TypeScript, ESLint and the production client/Worker build passed. Screenshots: artifacts/controllers-showcase-desktop.png, artifacts/controllers-showcase-mobile.png, artifacts/games-showcase-desktop.png and artifacts/games-showcase-mobile.png.

## Owner product workspace and pre-orders — 25 October 2026

- Added a guided product editor with atomic product/details/initial-price-option saves, independent prices/conditions, photo management, product discount creation and publication controls. Existing owner security and stock workflows remain in force.
- Homepage controller/game inclusion is controlled per product. Uploads normalize orientation/proportions, trim transparent margins when requested, create responsive WebP files and preview transparency. Portrait flat-cover artwork can use a reusable platform case frame. Replacing a photo retains its gallery position and updates selected image references.
- Product price notices are black and white, pauseable and reduced-motion aware; PS5 consoles default to enabled. Pre-orders have unconfirmed-price labels, release/terms fields, dedicated collection/admin navigation and an opt-in homepage slideshow with validated banner dimensions and automatic product links. Normal checkout rejects preorder/unconfirmed-price items.
- Applied migration 0014 locally after a SQLite backup. Twelve exact owner-confirmed Retro models are zero-stock, unpublished drafts pending accurate photos/specifications. PS2/PS3/Xbox360 moved to Consoles. Compared every existing variant price and stock row against the backup: zero changes. Final local stock remains38 across170 products/212 variants. Browser-only QA product records were removed.
- Full unit run with limited concurrency:85 passed. After final atomic-save/validation changes,11 focused admin/migration tests passed. An earlier concurrent run exceeded the existing5-second limit in two cases; the limited-concurrency run passed. The new multi-operation lifecycle test has an explicit20-second limit.
- Targeted browser regression:19 passed,1 intentionally skipped touch-only desktop case. Two media-library tests initially referenced retired field labels, then needed enough time for image processing/library refresh. Both desktop/mobile media cases passed on the focused rerun:21 passing checks across the runs,1 intentional skip. Covers the full new create/upload/publish/preorder/banner/carousel workflow on both desktop and mobile, plus existing owner pages, stock browsing, conditions and horizontal showcase interactions. Chromium mobile emulation is not physical-device testing.
- Final TypeScript, ESLint and production client/Worker build passed. Local screenshots and database verification are under artifacts/product-workspace (ignored). No remote deployment or remote D1/R2 migration was performed or verified in this pass. The deployment process must apply0014 to its target D1 database.
- Owner instructions and recommended image sizes: docs/owner-product-guide.md.
