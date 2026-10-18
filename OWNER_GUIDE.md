# Games Factory Pakistan — owner guide

Open `/admin`. This is a single-owner console; no staff roles are required. Local review uses this workstation's loopback-only identity. Before launch, the deployment operator must protect the live admin and admin API routes with Cloudflare Access and allow only the owner's email. Customer accounts and newsletter registration are not offered.

## Daily dashboard

Overview shows published products, order requests, completed order value, missing photographs and low-stock alerts. Completed value is based on completed orders, not page visits or unconfirmed WhatsApp requests. Quote-only listings can intentionally show zero stock until the owner confirms actual quantities.

Use the shortcuts to add a product, manage stock, create a sale or edit promotions.

## Add, update or remove a product

1. Open Products → Add product. Enter its name; the web address is filled from the name when you leave that field. Choose category, platform, condition and product type. Enter a brand name to create/use that brand.
2. Save the product as a draft. The console opens its edit page automatically. New products default to price-on-request until confirmed.
3. Complete product content: console generation, compatibility, region, edition, package contents and warranty. Do not invent facts. Leave price-on-request enabled until prices are confirmed.
4. Add variants with unique SKUs, names and PKR prices. Use Add specification to enter name/value rows; there is no JSON to write. For example, Connectivity → Wireless. Variant availability controls whether that variant can be ordered.
5. Upload photographs directly on the edit page. Choose a variant if the image only belongs to that variant. General product photos apply to every variant.
6. Use Inventory to enter actual available units at each branch. Do not count units already allocated to confirmed orders.
7. Return to Products and Publish. A variant and photograph are required. Use View to check the storefront.

Use Edit product to change content, price or variants later. Use Archive to remove a product from the storefront while keeping historical order information. Existing product records and stock history are not permanently deleted by archiving.

Products supports search by product name, brand or SKU and filtering by publication status. CSV import/export is still available. Imports produce drafts and require variants, photographs and confirmed stock before publication.

## Inventory and transfers

Filter by product/SKU, branch or low-stock status. Set the store's alert threshold at the top.

For a stock adjustment, enter the new available quantity and a reason such as restock, damaged item or physical stock count. Save. The history records the old/new quantities, owner identity, reason and time.

For a branch transfer, expand Transfer to another branch, choose its destination and enter units and a reason. Transfers reduce the source and increase the destination together. Insufficient stock and stale updates from another browser tab are rejected; refresh before trying again. The total available stock is preserved.

Order confirmation/cancellation also appears in stock history. Movement history starts when migration 0008 is installed; earlier changes are not reconstructed.

## Categories and brands

Categories can be added, renamed, hidden and assigned photographs. Move categories up/down and save their display order. Their images can be selected from product photos or the general media library. Empty image selection uses the provided category default where one exists.

Brands come from product brand fields. The Brands page can rename a brand across its products. To create a new brand, enter it while editing a product. To remove a brand from browsing, remove/change that brand on its published products.

## Media library

Upload JPG, PNG, WebP or AVIF images up to 8 MB. JPG is converted to WebP in the browser; smaller responsive versions are prepared automatically. Choose General library for banner/category artwork without creating a dummy product. Product-specific uploads can be limited to one variant.

The upload preview uses a checkerboard to reveal transparency. Transparency is detected in the browser, and can be corrected manually. Marking an opaque image as transparent does not remove its background. Use genuine transparent PNG/WebP cutouts for floating hardware photography; preserve printed white areas that belong to physical game packaging.

Mark physical game case photographs as showcase photos to make them eligible for the homepage game carousel. Avoid using square digital artwork as a physical case.

Find photographs by description. Edit product image descriptions, primary status, gallery position and showcase eligibility. Upload a replacement before removing an old product image. Images currently selected by categories, the hero or promotions cannot be deleted until those references are changed. A published product's last photograph is protected. Delete actions ask for confirmation. Bundled catalogue files stay in the deployed project even when their database metadata is removed.

## Discounts and sales

Sales controls actual prices; Promotions controls banner content.

Create a discount with a name, percentage or PKR amount, enabled status and eligible product variants. Optionally set start/end times in Pakistan time. They are stored in UTC. Enabled discounts are applied automatically within their date range without requiring a scheduled job. If multiple discounts match, the lowest resulting price wins; discounts never stack. Prices are rounded to whole PKR and cannot go below zero.

Catalogue cards, product pages, carousel details and server-side checkout quotes use the same discount rules. The original price is shown for comparison when a discount lowers it. Base variant prices remain unchanged. Quote-only products still require a confirmed price from the owner.

Disable or remove a discount to stop it. No product price needs to be manually restored.

## Homepage and promotions

Homepage controls the announcement, hero copy/photo and section titles, visibility and positions. Select products by name and use up/down buttons to set their order. Save each section. Empty selection uses featured products. New arrivals use recent catalogue entries; best sellers use completed order quantities.

Promotions controls rotating banners: title, description, image, store destination, button text, position, enabled status and optional Pakistan start/end times. The image picker shows a preview. Disable a slide to pause it or use Remove a promotional slide to delete it. Internal links such as `/shop` or `/category/controllers` are accepted; external redirect URLs are rejected.

## Orders and inquiries

A new request is AWAITING_WHATSAPP_MESSAGE. It does not prove the customer sent a message or paid. After receiving the conversation, mark CONTACTED. Confirm only after checking availability and agreeing the order; confirmation allocates stock atomically. Mark PAYMENT_PENDING, PAID, DISPATCHED and COMPLETED only when the corresponding event actually happened. Cancellation before dispatch returns allocated stock. Include an internal note with status changes.

The contact/pre-order inbox remains available. Pre-order requests do not reserve current stock. Customer login is removed; physical orders use guest details and digital-code purchases are arranged through direct store contact.

## Settings and activity

Update verified branch addresses, opening hours, contact links, pickup availability, delivery rules, payment instructions and business policies. Province/city shipping rules must use owner-approved fees. The store will not invent an unmatched delivery total.

Activity shows the latest 100 administrative events. Inventory separately shows the latest 100 stock movements. The stored history is also included in private business snapshots; the page display limit does not delete older history.

## Backups and recovery

Recovery offers a private JSON business-data snapshot, product/order CSV exports and restore instructions. Snapshots contain business and customer data and encrypted historical digital deliveries; store them securely. Temporary login tokens, sessions and runtime secrets are excluded. The snapshot is limited to 10,000 rows per table; larger stores must use a full D1 SQL export. A snapshot is not a complete image backup or a one-click D1 restore package.

The image manifest lists original uploaded R2 keys and expected responsive copies. Some small originals do not need every responsive copy. Bundled catalogue images are part of the deployed project. Back up R2 originals/derivatives separately and keep deployment configuration and any historical digital encryption key securely.

Before live recovery, pause writes, take a fresh export, restore the selected D1 point/SQL backup into staging, restore matching R2 files and verify products, prices, quantities, images and guest ordering. Switch production only after verification. The local integration suite verifies the business snapshot can be reloaded into a fresh SQLite schema with foreign-key checks; it does not claim a live Cloudflare Time Travel or R2 restore was performed.

Production Access, automated D1/R2 backup arrangements, retention and live restore verification still require the hosting account. See OWNER_CONSOLE_CHECKLIST.md and PRODUCTION_SETUP.md.
