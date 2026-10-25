# Managing products, images and pre-orders

## Everyday product workflow

1. Open `/admin/products`, search for a product and choose **Edit product**, or choose **Add a product**.
2. Enter the name, category, description, type, platform and generation. For a new product, set its starting price and first option name. Save the draft.
3. Under **Prices & options**, edit prices, New/Used condition, storage, SKU and specifications independently for each option. Use **Branch stock** for actual quantities. New products start at zero stock.
4. Under **Photos**, upload, replace, reorder or remove photos. Set the main photo and descriptions. Replacing a photo keeps its gallery position and updates selected display references.
5. Add discounts under **Discounts**, or manage existing discounts and scheduled sales from **Sales**. Discounts target selected price options; they do not change saved base prices.
6. Turn on **Publish on storefront** and save. Publication requires a price option and photograph. Archive removes a listing from browsing without deleting past orders.

## Homepage controller and game displays

Turn on **Show in the homepage controllers/games 3D display** in the product editor. Choose the correct platform/generation so it appears in the correct tab. Choose a suitable product photo or let the site select a marked display image automatically. Published products appear without editing source code. Homepage section switches still control whether the overall Games/Controllers section is visible. Fresh in the collection remains limited to the latest six products.

Migration `0015_full_product_showcases.sql` enables all existing published controllers and physical games in these displays, including products beyond the first catalogue page. Drafts remain hidden. The owner can still turn off the display switch for individual products afterward.

These are photographic product displays, rather than interactive 3D models. Complete front views and consistent framing give the physical-object effect.

## Preparing future photos

- **Controllers:** use a straight, upright front view showing the complete controller. Remove the surrounding background using an image editor/background-removal service and export transparent PNG or WebP. Aim for 1600 × 1200 px with a small transparent margin. Do not add a white rectangle, text, a watermark, or a baked-in drop shadow. Choose **Transparent product / physical case cutout** when uploading.
- **Physical game cases:** upload a complete upright case cutout with a transparent background, at least 1000 px tall, using the same transparent-product mode. Keep the real case frame in this image.
- **Flat game covers:** use upright front-cover artwork without a case frame or platform header, ideally 1000 × 1500 px or larger. Square or landscape artwork is rejected in this mode to avoid letterboxing. Choose **Cover artwork — build a physical case**, then the correct PS5, PS4, Xbox or Nintendo platform. The website adds the coloured case and platform header. Do not choose this mode for an image already showing a complete retail case.
- **Gallery-only photos:** choose **Gallery photo** for packaging, angled views and other images that do not belong in the floating homepage display.
- Use the preview and Rotate left/right controls to correct orientation before uploading. Transparent-product uploads trim empty transparent margins and add a small consistent margin. The site preserves proportions, converts uploads to WebP at at most 1600 px, and creates smaller responsive files. It does not remove opaque backgrounds automatically.
- Maximum input size is 8 MB and 40 megapixels. JPEG, PNG, WebP and AVIF can be prepared in the browser; saved uploads are WebP. Always use accurate photos of the actual model and colour.

## Moving price notice

Turn on **Show a moving current-price notice on this product page**. This displays a black-and-white scrolling message asking customers to confirm the current price. It is enabled for current PS5 console listings. It does not change the saved price or block normal ordering. Customers can pause it; reduced-motion preferences are respected.

## Pre-orders and homepage slideshow

1. Choose **Pre-orders → Add a pre-order**, or change an existing product's Selling method to **Pre-order**.
2. If the price is uncertain, turn on **Price not confirmed yet**. Customers see **Not confirmed yet**, including in search and quick views. Numeric base prices remain editable under Prices & options. Unknown prices are not advertised as free.
3. Add a release date if confirmed, plus the actual deposit, cancellation and fulfilment terms. Terms are required before publishing. Do not promise deposits/refunds or dates without owner approval.
4. Upload a product photo. To make a homepage banner, use **Banner / category image**, which saves to the general media library.
5. Recommended banner: **1600 × 1200 px (4:3)**. Minimum **800 × 450 px**, landscape, maximum 8 MB. Keep important artwork away from the edges. The full image fits without stretching or cropping. Upload artwork without embedded button/text; enter the headline and description in the product editor.
6. Turn on **Show in the homepage pre-order slideshow**, select the uploaded banner, and enter optional headline/description. Save and publish. The button automatically links to this product; no URL entry is needed.
7. Only published, opted-in pre-orders appear in the slideshow immediately after the hero. Turning off the switch, archiving, or changing to Normal product removes the slide. The `/pre-orders` collection lists all published pre-orders, including those without banners.
8. Customers submit a pre-order request from the product page. This does not take payment, reserve/decrement stock, or create a normal checkout order. Review requests in admin and confirm pricing/payment with the customer. Store settings can pause pre-order requests.

## Retro and existing consoles

PlayStation 2/3 and Xbox 360 are under Consoles. R36S/SF3500 remain Handhelds. The owner-confirmed Retro list is M8, M8 PRO, M15, M9 PLUS, M22, M68, X2, ARCADE WIRELESS X6, SD1, G99, GS5 MINI and GS5 ULTRA. Those twelve entries are drafts with zero stock and the previously requested provisional console price of PKR 249,999. Replace that provisional price, add exact photos, and verify storage, controllers and supported games before publishing. No unverified manufacturer or game-count claims are included.

## Deployment

This change introduces `0014_product_merchandising.sql`. Apply it to the target D1 database before serving the updated application, using the existing deployment process. Local database changes do not update Cloudflare's remote inventory or R2 files. Back up the target database and media before importing local business data. Do not use a migration replay to overwrite owner-adjusted remote prices or stock.
