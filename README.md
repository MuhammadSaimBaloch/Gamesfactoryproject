# Games Factory Pakistan

A monochrome, server-rendered gaming storefront with Cloudflare D1, R2 media, a persistent shopping bag, structured WhatsApp order requests and an owner administration area.

## Start locally

Requires Node 24 and pnpm 11.25.0. From this directory:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm exec wrangler d1 execute DB --local --file=db/store-settings.example.sql
pnpm exec wrangler d1 execute DB --local --file=db/initial-catalogue.sql
pnpm exec wrangler d1 execute DB --local --file=db/showcase-catalogue.sql
pnpm exec wrangler d1 execute DB --local --file=db/category-transparent-images.sql
pnpm exec wrangler d1 execute DB --local --file=db/platform-catalogue.sql
pnpm dev
```

Open the printed localhost URL. The local configuration excludes demo products. The explicit catalogue imports above add the reviewed catalogue with unconfirmed prices and zero stock. Do not use `db:seed` for the current storefront or a public deployment; it contains old demonstration inventory. Migrations alone create an empty real catalogue. The example settings exclude payment account details; configure verified payment instructions through the owner panel. The private local `db/owner-approved-data.sql` file is excluded from Git and is not required for a fresh clone.

The development and production build commands automatically generate responsive WebP copies of bundled images. Original photos remain unchanged. Generated files under `public/catalogue/optimized/` are excluded from Git and recreated from the committed sources using `pnpm images:optimize`.

See [GitHub setup](GITHUB_SETUP.md) for the single-repository layout, first push and Cloudflare deployment configuration.

On this Windows workstation, `./start-local.ps1` also finds the bundled Codex Node/pnpm runtime when those commands are not on PATH. Dependencies and the local database have already been initialized in this checkout. The script starts the development server; it does not deploy anything.

Copy `.dev.vars.example` to `.dev.vars` when configuring secrets. For local owner UI development, set `LOCAL_ADMIN_EMAIL` to your own development identity. This exception works only when `ENVIRONMENT=local` and the request hostname is loopback. It is absent from deployment configuration. Without it, `/admin` correctly returns 403 until Cloudflare Access is configured.

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
# With pnpm dev running in another terminal:
pnpm test:e2e
```

Browser tests use installed Microsoft Edge locally and Playwright Chromium in CI. They exercise real local D1-backed pages. D1 integration tests use an isolated, ephemeral Cloudflare runtime; Turnstile responses are mocked only inside tests. No real WhatsApp messages are sent.

## Stack

React 19, React Router 8 framework mode, strict TypeScript 6, Tailwind 4, Motion, Lucide, Radix Dialog, Zustand, Zod, Drizzle, Cloudflare Workers/D1/R2, Vitest and Playwright. Exact resolved versions are recorded in `pnpm-lock.yaml`. TypeScript 6 is selected because the current typescript-eslint release rejects TypeScript 7. The official C3 generator was attempted, but a package-resolution failure required direct setup of the documented Cloudflare Vite integration.

## Project guide

- [Architecture](ARCHITECTURE.md): boundaries, checkout, resource routes and design decisions.
- [Database](DATABASE.md): schema, transactions, inventory and migrations.
- [Design system](DESIGN_SYSTEM.md): visual and interaction rules.
- [Deployment](DEPLOYMENT.md): separate staging/production resources, Access and Turnstile.
- [Owner guide](OWNER_GUIDE.md): products, variants, media, orders and content.
- [Product and image guide](docs/owner-product-guide.md): simplified product editing, homepage displays, image preparation, price notices, pre-orders and banners.
- [Launch checklist](LAUNCH_CHECKLIST.md): missing owner inputs and verification gates.
- [Reference audit](REFERENCE_AUDIT.md): observed reference-site patterns and inspection limits.
- [Verification record](VALIDATION.md): test results, environment and remaining verification limits.
- [Production setup](PRODUCTION_SETUP.md): deployment requirements, digital delivery, pre-orders, approved owner data and catalogue imports.

## Important operational behavior

Prices use integer PKR. The server ignores client price and shipping claims. It saves an unconfirmed request and complete item snapshots before returning a WhatsApp link. The customer must press Send in WhatsApp. No stock is reserved by opening a chat; stock is revalidated and allocated atomically when staff confirms the order. Cancelling a confirmed, undispatched order restores allocated stock. No payment gateway is integrated.

Deployment is prepared, not performed. Real Cloudflare resources, Access configuration, Turnstile secrets, owner-approved data and authorized product imagery are required before launch. See the checklist for remaining verification and scope limitations.
