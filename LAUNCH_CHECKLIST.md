# Launch checklist

The software is prepared for deployment; the business is **not cleared for public launch** by the development preview. See [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md) for the customer/marketing/catalogue expansion and current owner data.

## Required owner inputs

- [ ] Real WhatsApp number, verified store ownership and a controlled end-to-end test.
- [ ] Complete branch addresses, phone numbers, opening hours and approved map links.
- [ ] Pickup availability approval for each branch.
- [ ] Approved province/city/fallback shipping fees and fulfillment practices.
- [ ] Shipping, returns, privacy, warranty and authenticity claims approved before publication.
- [ ] Privacy contact, retention period and a routine for deleting expired completed/cancelled requests.
- [ ] Genuine catalogue, SKUs, variants, prices, compatibility/specifications and branch stock.
- [ ] Licensed transparent controller/console photography and accurate game-case/disc imagery.
- [ ] Verified social links and permission for any customer/social content.
- [ ] Production domain and Cloudflare/GitHub environment ownership.

## Engineering verification

- [x] React Router 8 / Cloudflare Worker architecture and local D1 migrations implemented.
- [x] Strict TypeScript, lint and initial Cloudflare production build checked.
- [x] Unit and isolated D1 tests cover validation, canonical totals, persistence, retry deduplication, shipping, inventory, transitions and message formatting.
- [x] Storefront desktop/mobile browser tests cover navigation, product/cart persistence, search, dialogs and requested widths.
- [x] Unauthorized admin and cross-origin mutation tests exercised; unread request-body runtime issue repaired.
- [ ] Re-run final checks after owner data/assets/configuration changes.
- [ ] Validate real Cloudflare Access JWTs and allowlist behavior on staging.
- [ ] Validate real Turnstile hostname/action and failure paths on staging.
- [ ] Verify R2 upload/delivery on the owner's Cloudflare account.
- [ ] Complete real Android/iPhone WhatsApp handoff and app-unavailable testing.
- [ ] Manual screen-reader and keyboard audit, including form errors and all admin screens.
- [ ] Document production Lighthouse, LCP, CLS and INP measurements; no 90+ or Core Web Vitals guarantee is claimed.
- [ ] Security review of account configuration, edge protection, permissions and data retention.
- [ ] Backup and restore rehearsal before production migrations.
- [ ] Confirm HTTPS domain and indexability; demo products excluded and unapproved content absent.

## Known scope limits to review

The initial PS5 console and ten PS5 games now use official PlayStation artwork with provenance in `public/catalogue/sources.json`. These are marketing images, not photographs of the store’s stock; confirm usage permission and supplied editions before publication. Remaining demonstration products are local only. No competitor assets or GLB models were republished.

The admin uploader generates 480px/960px WebP derivatives and preserves transparency. Server-side image-header checks validate type and dimensions. Arbitrary cropping is not implemented; owners should prepare accurate product cutouts before upload.

Homepage selection supports the Featured flag or an ordered productIds list in section settings. New-arrival and completed-order-derived best-seller shelves are available but disabled by default. The hero image is selectable from approved uploads. No products are falsely labelled best sellers.

The admin uses a compact form system. CSV imports create draft product metadata; variants/inventory are managed separately. Customer accounts, saved addresses, private order history, encrypted digital fulfillment, pre-order/contact inboxes, confirmed subscriptions and promotion scheduling are implemented. Real email delivery and digital encryption require production secrets. There is no payment gateway, automated WhatsApp message sending, refund processing or shipping-carrier integration.

Browser tests use Chromium/Edge desktop and mobile emulation, not physical iOS Safari or lower-end Android hardware. Reference-site interactions were not verified. No remote deployment, real customer order, real payment or WhatsApp message has occurred.
