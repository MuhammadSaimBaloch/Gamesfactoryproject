# Application architecture

## Runtime and boundaries

`workers/app.ts` is the Cloudflare Worker entry point. React Router 8 uses a typed `RouterContextProvider`; environment bindings and CSP nonces are provided through `app/lib/context.ts`. The Worker applies security headers. `app/entry.server.tsx` streams React HTML and waits for complete rendering for search bots.

Route loaders and actions import `app/lib/server/*`. React Router removes server exports from browser bundles. UI components use type-only imports for catalogue shapes. No secret or D1/R2 binding is serialized to the browser. Public root data contains approved public site content, branches and the nonce, never Access credentials or Turnstile secrets.

`db/schema/index.ts` defines Drizzle tables. Repository functions own catalogue queries, full-text search, product details and site content. Service functions own checkout, shipping, identity verification, uploads and audited admin mutations. Validation and message formatting are pure modules that can be tested without rendering React.

## Route map

Public pages: `/`, `/shop`, `/category/:slug`, `/platform/:slug`, `/controllers`, `/games`, `/search`, `/product/:slug`, `/cart`, `/checkout`, `/about`, `/branches`, `/contact`, `/faq`, `/policies/shipping`, `/policies/returns`, `/privacy`.

Administration: `/admin`, `/admin/products`, `/admin/products/new`, `/admin/products/:id/edit`, `/admin/categories`, `/admin/inventory`, `/admin/orders`, `/admin/orders/:id`, `/admin/media`, `/admin/homepage`, `/admin/branches`, `/admin/shipping`, `/admin/settings`. The shared admin loader and every admin mutation independently require verified identity.

Resource endpoints:

| Endpoint                          | Contract                                                      |
| --------------------------------- | ------------------------------------------------------------- |
| `GET /api/products`               | Paginated active catalogue; URL filters                       |
| `GET /api/products/:slug`         | Active product, variants and image metadata                   |
| `GET /api/categories`             | Active categories                                             |
| `GET /api/search?q=`              | D1 FTS-backed product suggestions                             |
| `POST /api/orders/quote`          | Validate customer/fulfillment/cart and compute current prices |
| `POST /api/orders/whatsapp`       | Validate, verify Turnstile, persist, return saved message     |
| `GET /api/admin/export/products`  | Access-protected product CSV                                  |
| `GET /api/admin/export/orders`    | Access-protected order CSV, private/no-store                  |
| `GET /media/products/:key`        | Validated R2 image keys, immutable cache headers              |
| `GET /sitemap.xml`, `/robots.txt` | Indexable route discovery; staging blocks robots              |

Errors use meaningful 400/403/404/409/413/429/503 responses. Unexpected checkout errors return a generic 500 response. There is no public order-details endpoint.

## Customer order flow

1. A Zustand store persists the bag in localStorage. This is a convenience, never an authority for pricing.
2. Customer chooses delivery or an enabled branch and supplies contact information. Residential details are required only for delivery.
3. Quote action loads active variants and current branch stock, computes integer prices and selects the most specific configured shipping rule. Missing delivery rates reject the quote.
4. Customer acknowledges the WhatsApp disclosure and completes Turnstile.
5. Order action verifies same-origin, payload bounds, rate limit, schema, bot token hostname/action and the store's verified WhatsApp number.
6. A random request UUID deduplicates retries. A SHA-256 fingerprint binds it to the normalized request contents. A conflicting reuse returns 409.
7. The service recalculates the entire order and writes the order plus immutable snapshots in one D1 batch transaction. A unique constraint handles racing retries.
8. The response is built from the saved snapshot. Navigation happens only after persistence succeeds. Long messages use a copy-and-paste fallback with no omitted items.
9. Staff follows a constrained status machine. A database trigger rechecks and allocates branch stock when confirmed.

Turnstile verification is never skipped in application checkout code, including local development. Tests replace the verification HTTP response in an isolated test process. The local preview cannot create requests until configured.

## Media and security

Cloudflare Access JWTs are checked against the configured issuer, audience, expiry and RS256 JWKS, then an administrator email allowlist. A plain forwarded email header is insufficient. POST mutations require exact Origin matching. Public checkout uses hashed-IP minute buckets in D1 and server-side Turnstile checks.

Uploads require authorized administration, accepted MIME type, signature, size and safe random object keys. SVG and HTML uploads are rejected. Failed image metadata persistence removes the orphan R2 object. Product-variant ownership is checked. Media is public; customer data is not stored in R2. Exported CSV cells are protected against spreadsheet formula injection.

## Deliberate choices and limits

- No genuine 3D models or approved product images were supplied. The reusable perspective carousel uses labelled fallback assets and supports real transparent R2 images. It never claims an icon is a 3D model.
- System fonts avoid external requests and licensing uncertainty. Self-hosted brand fonts can be added after selection.
- Shipping zones are represented by named province/city rate rows, with an empty-location fallback, rather than a separate zones table.
- Customer data is normalized as a validated JSON object on the order; commercial amounts and statuses remain typed relational columns.
- Search uses FTS5 prefix terms with bound parameters and synchronized insert/update/delete triggers.
- No shared HTML cache is enabled; admin edits are immediately reflected by subsequent loaders. Versioned R2 object keys are cached immutably.
- Optional advanced merchandising, image derivatives and native-device testing remain launch follow-up items listed in the checklist.

The final checkout also compares the customer-reviewed total with the freshly recalculated server total. A changed total returns 409 and requires review; the accepted total is never used as a source for calculation.
