import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { imageSize } from "image-size";

// Explicit catalogue expansion. Re-imports never reset owner prices or inventory.
const sony = (hash, model) =>
  `https://store.sony.com.au/on/demandware.static/-/Sites-sony-master-catalog/default/${hash}/images/${model}/${model}.png`;
const microsoft = (asset) =>
  `https://cdn-dynmedia-1.microsoft.com/is/image/microsoftcorp/${asset}?fmt=png-alpha&wid=960&bgc=FFFFFF00`;
const nintendo = (game, sku) =>
  `https://assets.nintendo.com/image/upload/f_png/ncom/en_US/products/games/switch/${game}/${sku}-switch-${game}-us-1200x675`;
const controller = (
  slug,
  name,
  color,
  platform,
  generation,
  imageSource,
  source,
  description,
) => ({
  slug,
  name,
  color,
  platform,
  generation,
  imageSource,
  source,
  description,
  type: "controller",
  brand: platform === "Xbox" ? "Microsoft" : "Sony",
});
const game = (
  slug,
  name,
  platform,
  generation,
  imageSource,
  source,
  description,
  edited = false,
) => ({
  slug,
  name,
  platform,
  generation,
  imageSource,
  source,
  description,
  edited,
  type: "physical-game",
  brand:
    platform === "Nintendo"
      ? "Nintendo"
      : platform === "Xbox"
        ? "Xbox Game Studios"
        : "Sony Interactive Entertainment",
});
const products = [
  controller(
    "xbox-controller-carbon-black",
    "Xbox Wireless Controller — Carbon Black",
    "Carbon Black",
    "Xbox",
    "Xbox Series",
    microsoft("gldn-Xbox-Cntrl-Black-b00"),
    "https://www.microsoft.com/en-us/d/xbox-wireless-controller/8xn59crbsqgz",
    "Textured grips, a hybrid D-pad and a dedicated Share button in Carbon Black.",
  ),
  controller(
    "xbox-controller-robot-white",
    "Xbox Wireless Controller — Robot White",
    "Robot White",
    "Xbox",
    "Xbox Series",
    microsoft("gldn-Xbox-Cntrl-White-b01-1"),
    "https://www.microsoft.com/en-us/d/xbox-wireless-controller/8xn59crbsqgz",
    "The Xbox Wireless Controller in Robot White, with textured grips, a hybrid D-pad and Share button.",
  ),
  controller(
    "xbox-controller-shock-blue",
    "Xbox Wireless Controller — Shock Blue",
    "Shock Blue",
    "Xbox",
    "Xbox Series",
    microsoft("gldn-Xbox-Cntrl-Blue-b02"),
    "https://www.microsoft.com/en-us/d/xbox-wireless-controller/8xn59crbsqgz",
    "A vivid Shock Blue finish with textured grips, a hybrid D-pad and a dedicated Share button.",
  ),
  controller(
    "dualshock-4-jet-black",
    "DUALSHOCK 4 Wireless Controller — Jet Black",
    "Jet Black",
    "PlayStation",
    "PS4",
    sony("dw57712974", "PS4DUALSHOCKV2"),
    "https://store.sony.com.au/playstation-4-accessories/PS4DUALSHOCKV2.html",
    "Sony DUALSHOCK 4 controller for PS4, with a touch pad, light bar, built-in speaker and stereo headset jack.",
  ),
  controller(
    "dualshock-4-magma-red",
    "DUALSHOCK 4 Wireless Controller — Magma Red",
    "Magma Red",
    "PlayStation",
    "PS4",
    sony("dw74e31b3b", "PS4DUALSHOCKV2R"),
    "https://store.sony.com.au/playstation-4-accessories/PS4DUALSHOCKV2R.html",
    "The Magma Red DUALSHOCK 4 brings wireless PS4 control, a touch pad and a stereo headset jack.",
  ),
  controller(
    "dualshock-4-titanium-blue",
    "DUALSHOCK 4 Wireless Controller — Titanium Blue",
    "Titanium Blue",
    "PlayStation",
    "PS4",
    sony("dw51d0969b", "PS4DUALSHOCKV2TI"),
    "https://store.sony.com.au/playstation-4-accessories/PS4DUALSHOCKV2TI.html",
    "A metallic Titanium Blue finish on Sony's DUALSHOCK 4 controller, with a touch pad and motion sensors.",
  ),
  game(
    "god-of-war-ps4",
    "God of War — PS4",
    "PlayStation",
    "PS4",
    sony("dw63376a9d", "PS4GODOFWAR"),
    "https://store.sony.com.au/ps4-last-chance/PS4GODOFWAR.html",
    "Journey through Norse mythology with Kratos and Atreus in this single-player action adventure. Physical PS4 disc edition.",
  ),
  game(
    "uncharted-4-ps4",
    "Uncharted 4: A Thief's End — PS4",
    "PlayStation",
    "PS4",
    sony("dwa4887ae7", "PS4UNCHARTED4"),
    "https://store.sony.com.au/ps4-last-chance/PS4UNCHARTED4.html",
    "Join Nathan Drake on a globe-spanning treasure hunt, with cinematic exploration, climbing and action. Physical PS4 disc edition.",
  ),
  game(
    "days-gone-ps4",
    "Days Gone — PS4",
    "PlayStation",
    "PS4",
    sony("dwa3de84b3", "PS4DAYSGONE"),
    "https://store.sony.com.au/ps4-last-chance/PS4DAYSGONE.html",
    "Ride across a dangerous open world as Deacon St. John, scavenging supplies and facing roaming hordes. Physical PS4 disc edition.",
  ),
  game(
    "halo-infinite-xbox",
    "Halo Infinite — Xbox",
    "Xbox",
    "Xbox Series",
    "https://multimedia.bbycastatic.ca/multimedia/products/1500x1500/156/15684/15684618.jpg",
    "https://www.bestbuy.ca/en-ca/product/halo-infinite-xbox-series-x-xbox-one/15684618",
    "Return as Master Chief for a campaign on Zeta Halo. Physical Xbox disc edition; an internet connection and content download are required for installation.",
    true,
  ),
  game(
    "forza-horizon-5-xbox",
    "Forza Horizon 5 — Xbox",
    "Xbox",
    "Xbox Series",
    "https://pisces.bbystatic.com/image2/BestBuy_US/images/products/6466/6466929_ra.jpg",
    "https://www.bestbuy.com/product/forza-horizon-5-standard-edition-xbox-series-x-xbox-one/J3ZKK5K5W5/sku/6466929",
    "Explore Mexico in an open-world racing adventure with changing landscapes and a wide range of cars. Physical Xbox disc edition; downloads may be required.",
    true,
  ),
  game(
    "gears-5-xbox",
    "Gears 5 — Xbox",
    "Xbox",
    "Xbox One",
    "https://pisces.bbystatic.com/image2/BestBuy_US/images/products/6255/6255311_sd.jpg",
    "https://www.xbox.com/en-US/games/gears-5",
    "Follow Kait Diaz through a story-driven third-person shooter with solo and cooperative campaign play. Physical Xbox One disc edition, also playable on Xbox Series X with a disc drive.",
    true,
  ),
  game(
    "mario-kart-8-deluxe-switch",
    "Mario Kart 8 Deluxe — Nintendo Switch",
    "Nintendo",
    "Switch",
    nintendo("mario-kart-8-deluxe", "105275"),
    "https://www.nintendo.com/us/store/products/mario-kart-8-deluxe-105275/",
    "Race and battle with familiar Nintendo characters on a wide selection of tracks. Physical Nintendo Switch game card; Booster Course Pass is sold separately.",
    true,
  ),
  game(
    "super-mario-odyssey-switch",
    "Super Mario Odyssey — Nintendo Switch",
    "Nintendo",
    "Switch",
    nintendo("super-mario-odyssey", "105879"),
    "https://www.nintendo.com/us/store/products/super-mario-odyssey-105879/",
    "Explore imaginative kingdoms with Mario and Cappy in a 3D platforming adventure. Physical Nintendo Switch game card.",
    true,
  ),
  game(
    "zelda-breath-of-the-wild-switch",
    "The Legend of Zelda: Breath of the Wild — Nintendo Switch",
    "Nintendo",
    "Switch",
    nintendo("the-legend-of-zelda-breath-of-the-wild", "105208"),
    "https://www.nintendo.com/us/store/products/the-legend-of-zelda-breath-of-the-wild-switch/",
    "Discover Hyrule through exploration, puzzles and survival as Link sets out on an open-world adventure. Physical Nintendo Switch game card; expansion content is sold separately.",
    true,
  ),
];
const prompt =
  "Remove ONLY the exterior plain white backdrop outside the physical case and make it fully transparent. Preserve the complete case, printed artwork, all text, logos, age ratings, colors, geometry, perspective and interior white areas exactly as supplied. Do not redraw, redesign, reword, add shadows or objects. Single original case centered, uncropped, with a small transparent margin. Output high-resolution PNG with real transparency.";
await mkdir("public/catalogue/originals", { recursive: true });
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const statements = [];
const sources = [];
for (const p of products) {
  const key = `catalogue/${p.slug}.png`;
  const destination = p.edited
    ? `public/catalogue/originals/${p.slug}.${p.imageSource.includes(".jpg") ? "jpg" : "png"}`
    : `public/${key}`;
  try {
    await readFile(destination);
  } catch {
    const r = await fetch(p.imageSource, {
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw Error(`${p.slug}: ${r.status}`);
    await writeFile(destination, new Uint8Array(await r.arrayBuffer()));
  }
  if (process.argv.includes("--download")) continue;
  const framed =
    p.edited && !["forza-horizon-5-xbox", "gears-5-xbox"].includes(p.slug);
  if (framed) await copyFile(destination, `public/${key}`);
  // Cutouts must have been reviewed and copied here before generating the import.
  const bytes = new Uint8Array(await readFile(`public/${key}`));
  const size = imageSize(bytes);
  const id = `catalog-${p.slug}`;
  const compatibility =
    p.type === "controller"
      ? p.platform === "Xbox"
        ? "Xbox Series X|S, Xbox One and supported Windows, Android and iOS devices; check device-specific support."
        : "PS4; check game-specific PC and mobile support before ordering."
      : p.platform === "Xbox"
        ? "Xbox One and Xbox Series X with a disc drive. Not compatible with Xbox Series S or consoles without a disc drive. Internet downloads may be required."
        : p.platform === "Nintendo"
          ? "Nintendo Switch, Nintendo Switch OLED and Nintendo Switch Lite; check any required accessories before ordering."
          : "PS4. PS5 backwards compatibility requires a compatible console with a disc drive; check title support before ordering.";
  statements.push(
    `INSERT OR IGNORE INTO products(id,slug,name,description,category_id,brand,platform,condition,product_type,featured,active,demo) VALUES(${q(id)},${q(p.slug)},${q(p.name)},${q(p.description + " Confirm price, supplied region and availability with our team.")},${q(p.type === "controller" ? "controllers" : "games")},${q(p.brand)},${q(p.platform)},'New',${q(p.type)},1,1,0);`,
    `INSERT OR IGNORE INTO product_variants(id,product_id,sku,name,attributes_json,price_pkr,available) VALUES(${q(id + "-v")},${q(id)},${q("GFP-" + p.slug.toUpperCase())},${q(p.color || "Standard Edition")},${q(JSON.stringify(p.type === "controller" ? { Color: p.color, Connectivity: p.platform === "Xbox" ? "Xbox Wireless / Bluetooth / USB-C" : "Bluetooth / Micro-USB" } : { Format: p.platform === "Nintendo" ? "Physical game card" : "Physical game disc", Platform: p.generation }))},0,1);`,
    `INSERT OR IGNORE INTO product_details(product_id,generation,compatibility,region,edition,box_contents,warranty,price_on_request) VALUES(${q(id)},${q(p.generation)},${q(compatibility)},'Confirm supplied region and packaging with the store.',${q(p.color || "Standard Edition; confirm supplied edition with the store.")},${q(p.type === "controller" ? "Controller; confirm cables, batteries and other included items with the store." : "Physical game and case; confirm any additional inserts or codes with the store.")},'Confirm applicable warranty terms with the store before purchase.',1);`,
    `INSERT OR IGNORE INTO product_images(id,product_id,r2_key,alt_text,is_primary,is_transparent_asset,is_showcase_asset,width,height) VALUES(${q(id + "-image")},${q(id)},${q(key)},${q(p.name + " — " + (p.type === "controller" ? "transparent controller cutout" : "physical retail case; packaging and region may vary"))},1,${framed ? 0 : 1},1,${size.width},${size.height});`,
    `INSERT OR IGNORE INTO inventory(id,variant_id,branch_id,quantity_available) SELECT ${q(id + "-")}||id,${q(id + "-v")},id,0 FROM branches;`,
  );
  // Append only when the owner already uses an explicit homepage selection.
  const section = p.type === "controller" ? "controllers" : "games";
  statements.push(
    `UPDATE homepage_sections SET settings_json=json_set(settings_json,'$.productIds',json_extract(settings_json,'$.productIds')||','||${q(id)}) WHERE section_key=${q(section)} AND length(trim(coalesce(json_extract(settings_json,'$.productIds'),'')))>0 AND instr(','||json_extract(settings_json,'$.productIds')||',',${q("," + id + ",")})=0;`,
  );
  sources.push({
    ...p,
    key,
    width: size.width,
    height: size.height,
    downloadedAt: new Date().toISOString(),
    original: p.edited ? destination.replace("public/", "") : undefined,
    editing:
      p.edited && !framed
        ? {
            tool: "Built-in image_gen",
            purpose: "Exterior background extraction",
            prompt,
          }
        : undefined,
    presentation: framed
      ? "Original photograph unchanged; SVG clipping frames only the physical case, hiding exterior white margins."
      : "Transparent PNG",
    rights:
      "Manufacturer or retailer product photography. Source attribution retained; no license grant inferred.",
  });
}
if (!process.argv.includes("--download")) {
  await writeFile(
    "db/platform-catalogue.sql",
    "-- Platform expansion: quote-only products. Safe to re-import; owner prices and stock are preserved.\n" +
      statements.join("\n") +
      "\n",
  );
  await writeFile(
    "public/catalogue/platform-sources.json",
    JSON.stringify(sources, null, 2),
  );
  console.log(`Prepared ${products.length} products and image provenance.`);
}
