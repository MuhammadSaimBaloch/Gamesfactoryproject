# Production setup and owner handover

Implemented: nested category/brand/generation navigation; genuine starter catalogue and imagery; price-on-request; guest physical checkout; pre-order/contact inquiries; scheduled homepage promotions; category photography; and payment/warranty/delivery content controls. Customer login and newsletter signup were removed at the owner's request. Historical customer/subscriber data remains protected.

The single-owner console now provides product search/edit/publish/archive, visual specifications, standalone and product media uploads, category/brand management, branch stock adjustments/transfers/history, configurable stock alerts, scheduled variant discounts, visual homepage product ordering, promotion management, activity and private business-data snapshots. There are no staff roles. See OWNER_GUIDE.md for daily use and OWNER_CONSOLE_CHECKLIST.md for launch prerequisites.

Apply migrations `0008_owner_console.sql` and `0009_showcase_assets.sql` after existing migrations and before deploying this console. They are already installed in the local review database. Configure the actual live owner identity through Access; the loopback-only local identity is not production authentication. D1/R2 backup schedules, retention and a live staging restore drill require the hosting account. The snapshot download includes business data and a media manifest, not R2 file bytes or secrets; it does not replace a full database/image recovery plan.

## Owner data and catalogue

`db/owner-approved-data.sql` contains the addresses, number and payment methods supplied in this chat. Apply deliberately after migrations. The existing `model-town` branch identifier is retained for inventory relationships, but its display name and address are now Emirates Mall, Shalimar Colony.

`db/initial-catalogue.sql` contains the requested PS5 Slim Disc console and ten PS5 games. No price or stock was supplied: all eleven are price-on-request, with zero confirmed inventory. Product pages accept inquiries; the server blocks checkout for these items until staff updates prices, inventory and the price-on-request flag. No warranties, region or package contents are inferred from a marketing image. Official artwork and original source URLs are recorded in `public/catalogue/sources.json`; these are marketing images, not photographs of the store’s actual stock. Confirm image usage permission before public launch. The prepared static assets ship with the build; future uploads use R2.

Opening hours could not be verified. The matching business page https://games-factory-multan.blogspot.com/ confirms the main address and number but lists no hours. Both branches show “Contact us for today’s opening hours.” Replace this in Admin → Branches when confirmed.

Still required: real prices and stock; shipping locations, fees and estimated times; owner-approved returns/warranty/authenticity and privacy/retention terms; pickup approval; confirmed hours; production domain and credentials. Publishing the supplied bank details does not integrate or verify bank transfers.

## Customer email sign-in

Configure `RESEND_API_KEY` as a Worker secret and `EMAIL_FROM` as a verified sender. The implementation uses the official Resend send-email endpoint: https://resend.com/docs/api-reference/emails/send-email. Set `SITE_URL` to the exact HTTPS production origin. Sign-in links expire after 15 minutes, are hashed in storage, require an explicit POST to consume, and are single-use. Sessions expire after seven days. Cookies are HttpOnly, SameSite=Lax and Secure on HTTPS. Session, address and order responses are not cached. Account history only includes orders placed while signed in; matching an unverified guest email never grants access to an order.

Without an email provider, production sign-in fails closed. On local loopback only, the UI exposes a clearly labelled test link. Never enable local identities or email-preview links on staging or production. Do not log raw links or session cookies. Expired sessions/tokens are cleared during sign-in; also include them in your data-retention cleanup routine.

## Digital gift cards

Create a gift-card product and variant, then fill denomination/currency, region, redemption instructions and delivery terms under Product content. Set accurate branch stock for deliverable codes. Digital-only orders have no shipping fee and require sign-in. Mixed carts use physical fulfillment and deliver digital items separately to the same account.

Set `DIGITAL_DELIVERY_KEY` to 64 cryptographically random hexadecimal characters as a Worker secret. Back it up securely; losing or changing it without re-encryption makes delivered codes unreadable. Codes are encrypted with AES-GCM and bound to an order item. Staff verifies payment, advances the existing order through PAID → COMPLETED, then enters one code per unit. Delivery cannot overwrite an existing code; the owner sees the decrypted code only in their account. Never put real codes in public images, CSVs, logs or audit notes. This is staff-operated fulfillment, not an inventory integration with a code wholesaler.

## Pre-orders and inquiries

Enable pre-orders in Admin → Settings. Set a product’s sale mode to `preorder`, expected release date if confirmed, and deposit/cancellation/fulfillment terms. Pre-orders are separate requests, not stock reservations or online deposit payments. Staff manages NEW → CONTACTED → CONFIRMED → FULFILLED/CANCELLED in Admin → Inquiries. Internal notes are private. Contact submissions use the same inbox, with explicit contact consent, validation, a honeypot and server rate limiting. Delete expired inquiries from the admin area according to the published retention policy.

## Newsletter

Enable after configuring email and publishing privacy/consent terms. Subscribers stay pending until their confirmation link is consumed (24-hour expiry). Confirmation and unsubscribe GETs do not mutate data; both require POST confirmation. Export includes only confirmed subscribers. Import into your marketing platform, keep its suppressions synchronized, and include the platform’s unsubscribe link on every campaign. This app does not send bulk campaigns or implement abandoned-cart marketing. Local confirmation links are only exposed on loopback without email configuration.

## Merchandising and content

Admin → Promotions supports approved image selection, CTA/internal URL, ordering, enable/disable and optional UTC scheduling. Homepage rotation pauses on focus/hover, respects reduced motion and has manual controls. Admin → Categories assigns approved photographs. New arrivals are enabled; best sellers only appear when actual completed orders exist. Product and category photographs can be uploaded via Media; the CSV template imports draft metadata before staff adds variants, content and stock.

## Release procedure

Apply migrations 0004–0007 to staging, configure secrets, and deliberately import the approved data files. Do not run `db/seed.sql` on a public database: it contains demonstration inventory. Test actual email delivery, Turnstile, Cloudflare Access, R2, WhatsApp handoff and account isolation on staging. Complete backup/restore and retention procedures, keyboard/screen-reader and physical-device checks, and performance measurements. Keep `DEMO_MODE=false` outside local development. No remote deployment, bank payment or real customer message was performed as part of local implementation.

## Controller and physical-game showcases

The expanded Xbox/PS4 controller and PS4/Xbox/Nintendo game catalogue is documented in `PLATFORM_CATALOGUE.md`. After reviewing these products, import `db/platform-catalogue.sql` into the target database deliberately; it has currently been applied locally. Source assets and background treatment are recorded in `public/catalogue/platform-sources.json`.

The homepage controller and games sections use platform tabs and a centered horizontal carousel. Empty platform tabs show an honest empty state. Controller images use the transparent-asset metadata; physical game cases use the image description marker `physical PS5 retail case`. Keep square promotional artwork as secondary gallery images rather than marking it as a physical case. Actual platform/generation values drive filtering.

The local starter additions are in `db/showcase-catalogue.sql`. Import them deliberately only after reviewing the catalogue; no prices or available stock are asserted. `scripts/prepare-showcase-assets.mjs` records and downloads the original manufacturer/publisher assets, while `scripts/measure-showcase-images.py` measures their bounds for CSS framing in `app/lib/showcase-crops.json`. The measurement script does not alter the image files. Review source permissions and replace assets with owner-approved photography where required before public launch.

## Local admin review

Customer feature removal: the newsletter footer/form and new subscription/confirmation endpoints have been retired at the owner's request. Existing unsubscribe links still work. Public `/account` and `/account/verify` routes and all customer login links are removed; checkout no longer loads customer profiles or saved addresses. Physical orders use guest details. Digital products are directed to contact the store rather than the former account-based code-delivery flow. Existing stored customer/order/subscriber records and the staff admin security boundary are preserved.

The local storefront now defaults to `DEMO_MODE=false`, matching public catalogue behavior. Demo records stay in the database for internal review but are excluded from shopping, search, brand navigation and direct product pages. The development banner and mock product-cover artwork are removed. Saved bags discard demo entries during hydration. Local email sign-in/newsletter preview links require explicit demo mode as well as loopback access; with demo mode off, configure real email delivery before offering those flows. Local admin review remains separate from customer email authentication.

This workstation’s ignored `.dev.vars` contains a local review identity so `/admin` is available on loopback while `ENVIRONMENT=local`. Cloudflare Access is still required on staging/production. The regression suite’s unauthorized-admin checks were run before enabling this explicit local exception. Remove `LOCAL_ADMIN_EMAIL` and restart the server when repeating that locked-down local regression configuration.
