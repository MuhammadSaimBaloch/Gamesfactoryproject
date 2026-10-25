# Owner inventory import

This document records the initial import. The subsequent photo/content completion and current outstanding checks are documented in [catalogue-completion.md](catalogue-completion.md); `db/inventory-review.json` contains the current draft notes.

129 requested listings, 171 requested configurations. 84 ready; 45 drafts. Existing products keep their publication status, pricing and stock. New variants have zero stock and use PKR 21,999 for controllers or PKR 249,999 for consoles, handhelds and VR headsets.

The one-time D1 migration runs through the existing deployment workflow. Owner changes are not synchronized or overwritten by this JSON after migration. Branch inventory is created for each new variant. The owner can change price, stock, photos and publication in /admin.

## Draft review

| Product | Reason |
| --- | --- |
| DualSense Wireless Controller - Hogwarts Legacy | Exact transparent product photograph pending. |
| DualSense Wireless Controller - Marvel's Spider-Man 2 | Exact transparent product photograph pending. |
| DualSense Wireless Controller - Concord | Exact transparent product photograph pending. |
| DualSense Wireless Controller - PlayStation 30th Anniversary | Exact transparent product photograph pending. |
| DualSense Wireless Controller - Astro Bot Joyful Edition | Exact transparent product photograph pending. |
| DualSense Wireless Controller - Grand Theft Auto VI Black | Officially announced, but launch is November 19, 2026. Keep unpublished until the store confirms availability or enables an approved pre-order. |
| DualSense Wireless Controller - Grand Theft Auto VI White | Officially announced, but launch is November 19, 2026. Keep unpublished until the store confirms availability or enables an approved pre-order. |
| DualSense Edge - PlayStation 30th Anniversary Limited Edition | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Electric Volt | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Astral Purple | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Daystrike Camo | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Mineral Camo | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Aqua Shift | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Lunar Shift | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Stellar Shift | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Sunkissed Vibes OPI | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Remix Special Edition | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Gold Shadow | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Xbox 20th Anniversary | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Stormcloud Vapor | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Dream Vapor | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Ghost Cipher | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Pulse Cipher | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Ice Breaker | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Storm Breaker | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Heart Breaker | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Forza Horizon 5 | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Starfield | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Halo Infinite Console Bundle Edition | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Space Jam A New Legacy Tune Squad | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Space Jam A New Legacy Goon Squad | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Space Jam A New Legacy Serververse | Exact transparent product photograph pending. |
| Xbox Wireless Controller - DOOM The Dark Ages | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Forza Horizon 6 | Exact transparent product photograph pending. |
| Xbox Wireless Controller - Gears of War E-Day | Exact transparent product photograph pending. |
| Xbox Elite Wireless Controller Series 2 - Core Red | Exact transparent product photograph pending. |
| Xbox Elite Wireless Controller Series 2 - Core Blue | Exact transparent product photograph pending. |
| Xbox Elite Wireless Controller Series 2 - Halo Infinite Limited Edition | Exact transparent product photograph pending. |
| Xbox Elite Wireless Controller Series 2 - DOOM The Dark Ages Limited Edition | Exact transparent product photograph pending. |
| Xbox Elite Wireless Controller Series 2 - Xbox Design Lab Custom Colours | Custom colours vary. Confirm the actual configuration and upload its photograph before publishing. Exact transparent product photograph pending. |
| Xbox Series S 512GB | The supplied list includes Jailbreak options for Xbox Series S. Verify the exact modification and supplied package before publishing. |
| Nintendo Switch 2 Mario Kart 8 Bundle | Confirm whether this is the official Mario Kart World bundle or a store bundle with Mario Kart 8 Deluxe. Do not substitute the official bundle image. Exact transparent product photograph pending. |
| R36S | Confirm manufacturer, colour and exact model with a store photo before publishing. Exact transparent product photograph pending. |
| SF 3500 | Confirm manufacturer, colour and exact model with a store photo before publishing. Exact transparent product photograph pending. |
| Oculus Quest 2 | Exact transparent product photograph pending. |

## Image sources

Source URLs, attribution and processing notes are recorded in db/inventory-image-sources.json. Local WebP files retain transparency and receive responsive delivery sizes during the normal build. Manufacturer images illustrate model/design, not the cosmetic condition of an individual pre-owned unit.

For ShareAlike photographs, the linked image file remains under the source licence. Processing is limited to resizing/compression unless the source record explicitly says otherwise.
