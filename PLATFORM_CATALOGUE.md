# Platform catalogue additions

- [x] Xbox controllers: Carbon Black, Robot White and Shock Blue.
- [x] PS4 controllers: DUALSHOCK 4 Jet Black, Magma Red and Titanium Blue.
- [x] PS4 games: God of War, Uncharted 4: A Thief's End and Days Gone.
- [x] Xbox games: Halo Infinite, Forza Horizon 5 and Gears 5.
- [x] Nintendo Switch games: Mario Kart 8 Deluxe, Super Mario Odyssey and The Legend of Zelda: Breath of the Wild.
- [x] All five homepage tabs, collection filters and product pages connected.
- [x] All 15 listings editable through the existing owner panel.
- [x] Pricing and branch inventory remain unconfirmed: contact for price, zero stock, no purchasable zero-price products.

## Images

Original manufacturer and retailer sources, asset paths and the exact background-extraction prompt are recorded in `public/catalogue/platform-sources.json`. Eleven images have real transparent PNG backgrounds. Halo Infinite and the three Nintendo cases retain their original high-resolution photos and use precise SVG clipping in `ProductVisual` to hide only the exterior white margins. This shared presentation also applies to collection cards, quick views, galleries, thumbnails and the homepage carousel; the printed cover artwork remains intact. These four original files are not advertised as transparent uploads in the admin metadata. Source photography remains available in `public/catalogue/originals`.

The built-in image_gen tool produced the Forza Horizon 5 and Gears 5 background cutouts. Its other extraction requests were rejected by the image service; original source photographs and UI framing are used for those products. No alternate image generation service was used. Source attribution is retained; no license grant is inferred.

## Import and maintenance

`db/platform-catalogue.sql` has been applied to the local database. For a future deployment, deliberately import this reviewed catalogue into the target database after applying schema migrations through 0009. Do not re-run demo seeds. The import inserts missing records and appends missing IDs to explicit homepage selections. It preserves existing owner prices, quantities and product edits on repeat imports.

`node scripts/prepare-platform-catalogue.mjs --download` downloads original source assets. Reviewed generated cutouts must already exist at their recorded final paths before running the script without `--download` to regenerate the SQL/source records. `scripts/measure-showcase-images.py` reads the showcase and platform manifests together and updates framing metadata without editing source bitmaps.

## Validation

TypeScript, ESLint and the production client/Worker build passed. Focused browser coverage passed on desktop and emulated mobile: five platform tabs, three products each, image decoding, carousel keyboard navigation, collection filtering and linked product pages. Existing showcase checks cover arrows, wheel, mouse dragging and emulated touch swipes. An isolated in-memory database check imported the SQL twice and confirmed that owner prices, branch stock and the ten unique controller homepage selections are preserved.

Before selling these additions, the owner must set actual prices, stock, supplied region/edition and applicable warranty terms.
