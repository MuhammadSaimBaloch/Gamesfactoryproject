# Cloudflare deployment

No Cloudflare account was authenticated and no remote resources or live deployment were created during development. Do not deploy the local `wrangler.jsonc` directly: its database ID is explicitly local-only.

## Prerequisites

Use Node.js 24 and pnpm 11.25.0, matching the repository's quality checks. For Cloudflare Workers Builds, set `PNPM_VERSION=11.25.0` and `NODE_VERSION=24` under **Settings > Build > Build Variables and Secrets** before installing dependencies. These are build variables, not runtime secrets. A build reporting `packages field missing or empty` with pnpm 9 is using an older package manager; use the pinned version and the current workspace configuration. Git-connected builds still require the staging resource configuration described below; the default `wrangler.jsonc` is local-only.

Use a Cloudflare account with Workers, D1, R2, Zero Trust Access and Turnstile. Add a production domain to Cloudflare. Create separate GitHub environments named `staging` and `production`; production should require reviewer approval. The repository has a manually dispatched deployment workflow, so a push cannot unexpectedly publish the store.

Reference: [official React Router guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/). Commands below use the installed Wrangler 4 CLI; inspect `pnpm exec wrangler <command> --help` if upgrading.

## Create independent resources

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create games-factory-staging
pnpm exec wrangler r2 bucket create games-factory-staging-media
pnpm exec wrangler d1 create games-factory-production
pnpm exec wrangler r2 bucket create games-factory-production-media
```

Keep the actual IDs returned by Cloudflare outside tracked source. Set these environment variables separately for each environment:

| Variable                 | Value                                          |
| ------------------------ | ---------------------------------------------- |
| `GFP_D1_ID`              | Actual environment-specific database UUID      |
| `GFP_D1_NAME`            | Matching database name                         |
| `GFP_R2_BUCKET`          | Matching bucket name                           |
| `GFP_SITE_URL`           | HTTPS canonical origin, without trailing slash |
| `GFP_ACCESS_ISSUER`      | `https://YOUR-TEAM.cloudflareaccess.com`       |
| `GFP_ACCESS_AUD`         | Access application audience tag                |
| `GFP_ADMIN_EMAILS`       | Comma-separated authorized owner/staff emails  |
| `GFP_TURNSTILE_SITE_KEY` | Public site key for that hostname              |

For CI also set `CLOUDFLARE_ACCOUNT_ID` and a least-privilege `CLOUDFLARE_API_TOKEN` as GitHub environment secrets. The token must be able to deploy the Worker and apply migrations to its database. Do not print secrets or place them in source or command arguments.

Generate the environment config without deploying:

```sh
node scripts/deploy.mjs staging --configure-only
```

The generated `wrangler.staging.json` / `wrangler.production.json` files are ignored by Git and contain actual environment resource identifiers. The script refuses missing variables, local fake IDs and non-HTTPS site origins. It always disables demo products outside local development.

## Access authentication

Create a self-hosted Cloudflare Access application for the site's `/admin*` path and another policy covering `/api/admin/*`. Allow only the designated administrator identities and require appropriate MFA through the identity provider. Populate issuer, audience and email allowlist variables. Test unauthenticated requests, a valid administrator and a signed-in but unlisted account.

The application verifies the JWT server-side; the edge policy alone is insufficient. It checks signature, issuer, audience, expiry and email allowlist. Never enable a broad bypass policy. If a separate Access application protects API exports, use the same audience only when both paths belong to the same application; otherwise configure a single application with both path coverage. Prefer a common application covering both admin paths.

The local-only identity exception is not included in generated deployment configuration, and cannot activate unless both local environment and loopback host conditions hold.

## Turnstile

Create a widget allowing the intended staging or production hostname. Set the public key above. Save its secret using Wrangler's interactive prompt:

```sh
pnpm exec wrangler secret put TURNSTILE_SECRET --config wrangler.staging.json
```

Repeat with the production config and production secret. The server validates hostname and `action=checkout` in addition to the success flag. Never use test credentials in production. Test credentials/responses are confined to isolated tests, not an application bypass.

## Build and deploy

Run quality checks, then:

```sh
pnpm deploy:staging
# After staging verification and completed launch checklist:
pnpm deploy:production
```

The deployment script applies remote migrations, builds with the matching Cloudflare config and deploys the generated Worker build. **It never runs demo seeding.** Deployment creates empty/unverified store settings; the owner must configure catalogue, rates and policies before enabling public ordering.

Production disables the workers.dev URL. Add the intended custom domain to the Worker in Cloudflare's dashboard, or add an owner-confirmed custom-domain route to the generated configuration process. Staging may use its workers.dev URL; its `SITE_URL` and Turnstile allowlist must match. Enforce HTTPS. Set up Cloudflare account access and billing appropriate to expected traffic.

GitHub's `deploy.yml` uses the same process with per-environment variables/secrets. `checks.yml` runs type, lint, unit/D1, build and browser checks. No repository remote or GitHub deployment was configured automatically.

## Verify after deployment

1. Apply migrations and confirm the real catalogue contains no published demo records.
2. Confirm Access blocks all admin pages and export endpoints for unauthorized identities.
3. Configure approved pickup, shipping rates and the verified WhatsApp number through admin.
4. Upload licensed product photography and check image MIME/cache headers.
5. Complete Turnstile on the real hostname and submit a controlled test order with owner consent.
6. Confirm one D1 order and every item snapshot exist; retry the identical request and verify no duplicate.
7. Check the prepared WhatsApp chat destination and full message on real Android and iOS devices. The customer must send it manually.
8. Confirm no stock decrement at handoff; then confirm and cancel the controlled test order to verify allocation/restoration.
9. Inspect CSP, HTTPS, no-store admin responses, sitemap, robots and canonical origins.
10. Measure production mobile Lighthouse/Core Web Vitals under a documented device/network profile. No score is claimed from the development server.

## Backup and recovery

Before remote migrations, export the database to a protected local backup:

```sh
pnpm exec wrangler d1 export DB --remote --config wrangler.production.json --output backup.sql
```

Backups contain personal data. Keep them encrypted/access-controlled, outside Git, and apply the owner-approved retention policy. Also retain R2 assets or configure account backup/export procedures appropriate to the business.

Prefer forward-only schema repairs. If a Worker release fails, inspect `wrangler deployments list` and use the documented `wrangler rollback` command for the selected deployment; a Worker rollback does **not** roll back D1 data. D1 Time Travel can restore to a chosen timestamp/bookmark within the plan's available recovery window; inspect `wrangler d1 time-travel --help`, test the restore in staging, and coordinate writes before recovery. An SQL export can be imported into a new D1 database using `wrangler d1 execute ... --remote --file=backup.sql`, then bound after validation. Do not overwrite a live database blindly.

No remote migration, restore, Access configuration, Turnstile integration or deployment has been verified against the owner's account yet.
