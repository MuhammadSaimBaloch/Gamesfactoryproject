# Owner console checklist

- [x] Single-owner console at `/admin`, with a separate management layout and no staff roles.
- [x] Dashboard shortcuts, completed-order totals, missing-photo and low-stock alerts.
- [x] Product search, draft creation, editing, variants, visual specifications, publishing and archiving.
- [x] New products default to price-on-request; publishing requires a variant and a photograph.
- [x] Available stock per branch, adjustable alerts, reasons and atomic transfers with stale-update protection.
- [x] Stock movement history and administrative activity log.
- [x] Category visibility, names, image previews and up/down display ordering.
- [x] Brand renaming across products; new brands through product editing.
- [x] General/product media uploads, previews, transparency detection, responsive images and protected deletion.
- [x] Product photo primary position, gallery order and physical-case showcase eligibility.
- [x] Percentage/fixed discounts, variant selection, Pakistan scheduling and automatic non-stacking prices.
- [x] Visual homepage product selection/order, section controls, announcement and hero management.
- [x] Promotional banners with image previews, Pakistan scheduling and removal controls.
- [x] Existing order management, inquiries, branches, shipping and store policy settings retained.
- [x] Private business-data snapshot and CSV exports, image manifest and documented recovery procedure.
- [x] Local snapshot round-trip tested in a fresh schema with foreign-key verification.

Before public launch:

- [ ] Configure the actual production D1/R2 resources and apply migrations 0008 and 0009 after existing migrations.
- [ ] Allow only the owner's identity through production Cloudflare Access; local loopback review identity must not be used as live authentication.
- [ ] Set up hosting-account database/image backup schedules and retention; perform a live staging restore drill.
- [ ] Enter confirmed product prices/quantities and approved delivery, return, warranty and privacy terms.
- [ ] Verify actual checkout security settings and WhatsApp handoff on the live domain.
