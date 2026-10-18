# Image loading improvements

The 47 bundled catalogue images total **19.08 MiB** in their original formats. Their 960-pixel WebP delivery versions total **3.21 MiB**, an **83% reduction**. This compares the same image set at a delivery size, not total page loading time. Originals remain unchanged and are available for future editing or higher-resolution needs.

Changes:

- Generate 320/640/960/1600-pixel WebP variants, with no upscaling and lossless alpha quality.
- Use responsive image sizes on product cards, category tiles, carousels, hero imagery and promotions.
- Send storefront requests directly to generated static files rather than through the legacy `/media/catalogue/…` redirect.
- Load off-screen product and carousel images lazily; prioritize the hero and main product photo.
- Serve fingerprinted WebP files with a one-year immutable browser cache policy on Cloudflare. New source content gets a new URL.
- Support conditional ETag responses for unchanged R2 uploads.
- Run asset generation automatically in local development, production builds and the deployment script. Cache already-generated files during repeated builds.

The generated output directory is excluded from Git; committed source photos, the optimizer and the generated manifest allow a fresh clone to reproduce it. GitHub CI builds the image variants before running browser checks.

Validation:

- 97 resized transparent variants were inspected with Pillow: alpha transparency retained and output width never exceeds source width.
- Desktop and mobile browser tests decode images, exercise all five expanded platform collections and verify the six-item Fresh in the collection shelf.
- Source images and masked case framing remain intact; resized images retain their original aspect ratio.
- The production build includes the generated assets and `public/_headers` cache rules.
- Unit tests cover responsive selection, original/R2 fallback, legacy URL routing and ETag/304 behavior.

Type checking, lint and the production build passed. The 72-case unit/integration suite and three additional media-cache cases passed. All 18 broader storefront browser checks passed. Image-delivery checks passed on desktop/mobile, as did platform catalogue checks; the mobile platform check was rerun successfully in isolation after a competing Playwright run caused an artifact-directory conflict. These are local checks, not a completed GitHub Actions or deployed Cloudflare run.

Rebuild with `pnpm images:optimize`. Review loading in the production Cloudflare deployment over a real mobile connection before treating any result as a real-user speed score. The local Vite server includes development overhead, and image byte reduction is not equivalent to an identical percentage reduction in page load time.
