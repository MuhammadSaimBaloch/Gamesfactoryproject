# GitHub setup for Games Factory Pakistan

## One repository is sufficient

Create a **private**, empty repository named `games-factory-pakistan` in the owner's GitHub account (or business organization). Leave the README, license and `.gitignore` options unchecked because this project already contains its own files.

Keep all of the following together:

| Folder | Purpose |
| --- | --- |
| `app/` | Storefront, owner panel, React components and server logic |
| `workers/` | Cloudflare Worker entry point and request handling |
| `db/` | Schema, migrations and reviewed initial catalogue imports |
| `public/` | Logo, original catalogue images and other static files |
| `scripts/` | Image optimization, catalogue preparation and deployment |
| `tests/`, `.github/` | Tests and GitHub Actions workflows |

There is no need for separate frontend, backend, admin, media or database repositories. The app already uses one coordinated build. Cloudflare Workers, D1 (database), R2 (uploaded media), Access (owner authentication) and Turnstile are hosting/services to configure, not GitHub repositories. GitHub stores the code; Cloudflare runs the store.

Use the same repository with separate GitHub environments called `staging` and `production` when configuring deployments. Each environment should have its own Cloudflare resources and values.

## First push

Install Git for Windows if `git --version` is unavailable, and sign in through Git Credential Manager when prompted. Do not put access tokens in the remote URL. This folder is already initialized on branch `main`, with no remote configured.

In PowerShell:

```powershell
Set-Location -LiteralPath 'D:\Games factory project'
git status --short
git add .
git diff --cached --stat
git diff --cached --name-only
git commit -m "Prepare Games Factory Pakistan storefront and owner console"
git remote add origin https://github.com/YOUR_USERNAME/games-factory-pakistan.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your account or organization name. If Git asks for your identity, configure your real commit name and GitHub-associated email before committing. If `origin` already exists when you follow these instructions, inspect `git remote -v` and use `git remote set-url origin ...` only when it needs correcting. Do not force-push over an existing repository's history.

```powershell
git config user.name "YOUR NAME"
git config user.email "YOUR GITHUB EMAIL"
```

Before committing, check that `.dev.vars`, `.env*`, local databases, `.wrangler/`, `node_modules/`, build outputs, test artifacts and the private `db/owner-approved-data.sql` payment setup file do not appear in the staged file list. The `.gitignore` excludes them. The placeholder `.dev.vars.example`, safe `db/store-settings.example.sql`, catalogue/migration SQL and `pnpm-lock.yaml` belong in the repository. Configure actual payment account details in the owner panel/private setup data, rather than committing them. Never add service credentials to source files.

GitHub Desktop is an alternative: add this existing local repository, review the changed files, commit them and publish a private repository with the same name. If you already created the empty repository on GitHub, set its URL as this repository's remote instead of publishing a second one.

## What the first push does

The `Quality checks` workflow installs dependencies, runs type/lint/unit/build checks, prepares an isolated local catalogue and exercises the current storefront/owner browser tests. Its owner identity only works in the CI loopback development server; it does not grant production access. Responsive images are rebuilt automatically from their originals during development/build; the generated WebP files do not need committing.

Pushing code does **not** deploy the website, upload the current local D1 database, copy R2 uploads or transfer secrets. Preserve current business data separately. The reviewed SQL imports are initial catalogue content, not a replacement for backups of later owner edits and orders.

## Configure deployment later in the same repository

In GitHub Settings → Environments, create `staging` and `production`. For each environment, configure the existing `Deploy Cloudflare` workflow with:

- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- Variables: `GFP_D1_ID`, `GFP_D1_NAME`, `GFP_R2_BUCKET`, `GFP_SITE_URL`, `GFP_ACCESS_ISSUER`, `GFP_ACCESS_AUD`, `GFP_ADMIN_EMAILS`, `GFP_TURNSTILE_SITE_KEY`.

Configure server-only application secrets (for example `TURNSTILE_SECRET`, any email provider key and any digital-delivery encryption key actually used) in the appropriate Cloudflare Worker, not in Git. Follow `DEPLOYMENT.md` and `PRODUCTION_SETUP.md` for resource creation, Access policies, migrations and deliberately importing the reviewed catalogue. The deployment workflow is manual via GitHub Actions → Deploy Cloudflare → Run workflow. Keep production approval enabled if available for your account/plan.

## Faster image delivery

`pnpm images:optimize` generates WebP variants at 320, 640, 960 and 1600 pixels without upscaling or flattening transparency. Source images stay untouched. A generated manifest selects direct, fingerprinted URLs, and responsive `srcset` lets the browser choose an appropriate size. Off-screen product/carousel images load lazily; the main hero/product image gets higher priority. Fingerprinted static images carry a one-year immutable cache rule in `public/_headers`; owner uploads keep their existing immutable R2 caching and now support conditional ETag responses.

The existing local development server includes Vite development overhead. Measure real user loading performance again on the deployed Cloudflare build, especially over a mobile connection. Local image-transfer reductions are not a guarantee of the same percentage reduction in page loading time.

Official references: [Adding existing code to GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github), [Cloudflare static asset hosting](https://developers.cloudflare.com/workers/static-assets/), [Cloudflare static response headers](https://developers.cloudflare.com/workers/static-assets/headers/).
