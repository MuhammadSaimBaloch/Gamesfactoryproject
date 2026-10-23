import { readFile, writeFile, mkdir } from "node:fs/promises";
import { imageSize } from "image-size";
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const controllers = [
  [
    "dualsense-white",
    "DualSense Wireless Controller — White",
    "White",
    "dualsense-image-block-01-en-21mar23",
  ],
  [
    "dualsense-rhythm-blue",
    "DualSense Wireless Controller — Rhythm Blue",
    "Rhythm Blue",
    "Rhythm-Blue-DualSense-image-block-02-en-02feb26",
  ],
  [
    "dualsense-techno-red",
    "DualSense Wireless Controller — Techno Red",
    "Techno Red",
    "Techno-Red-DualSense-image-block-02-en-30jan26",
  ],
  [
    "dualsense-remix-green",
    "DualSense Wireless Controller — Remix Green",
    "Remix Green",
    "Remix-Green-DualSense-image-block-02-en-02feb26",
  ],
];
const cases = [
  ["marvels-spider-man-2", "ps5-msm2-box-front", "marvels-spider-man-2-ps5"],
  ["returnal", "returnal-ps5-game-box-front", "returnal-ps5"],
  ["demons-souls", "ps5-demons-souls-game-box-front", "demons-souls-ps5"],
  [
    "ratchet-and-clank-rift-apart",
    "ps5-ratchet-clank-rift-apart-game-box-front",
    "ratchet-clank-rift-apart-ps5",
  ],
  [
    "the-last-of-us-part-i",
    "ps5-tlou-part-1-game-box-front",
    "the-last-of-us-part-i-ps5",
  ],
  [
    "ghost-of-tsushima-directors-cut",
    "ps5-ghostoftsushima-directorscut-game-box-front",
    "ghost-of-tsushima-directors-cut-ps5",
  ],
  [
    "horizon-forbidden-west",
    "horizon-forbidden-west-ps5-launch-box-front",
    "horizon-forbidden-west-launch-edition-ps5",
  ],
];
await mkdir("public/catalogue", { recursive: true });
const existing = JSON.parse(
  await readFile("public/catalogue/sources.json", "utf8"),
);
const sourceRows = [];
const statements = [];
async function saveImage(slug, url, source, name) {
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw Error(`${slug}: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const size = imageSize(bytes);
  if (size.type !== "png")
    throw Error(`${slug}: expected publisher PNG, got ${size.type}`);
  const key = `catalogue/${slug}.png`;
  await writeFile(`public/${key}`, bytes);
  sourceRows.push({
    slug,
    name,
    source,
    imageSource: url,
    key,
    width: size.width,
    height: size.height,
    downloadedAt: new Date().toISOString(),
    rights:
      "Official manufacturer product photography. Source attribution retained; no license grant inferred.",
  });
  console.log(`${slug}: ${size.width}×${size.height}`);
  return { key, ...size };
}
for (const [slug, name, color, asset] of controllers) {
  const source =
    "https://www.playstation.com/en-us/accessories/dualsense-wireless-controller/";
  const im = await saveImage(
    slug,
    `https://gmedia.playstation.com/is/image/SIEPDC/${asset}?fmt=png-alpha&wid=960&bgc=FFFFFF00`,
    source,
    name,
  );
  const id = `catalog-${slug}`;
  statements.push(
    `INSERT OR IGNORE INTO products(id,slug,name,description,category_id,brand,platform,condition,product_type,featured,active,demo) VALUES(${q(id)},${q(slug)},${q(name)},'Sony DualSense wireless controller for PS5. Confirm compatibility, pricing and availability with our team.','controllers','Sony','PlayStation','New','controller',1,1,0);`,
    `INSERT OR IGNORE INTO product_variants(id,product_id,sku,name,attributes_json,price_pkr,available) VALUES(${q(id + "-v")},${q(id)},${q("GFP-" + slug.toUpperCase())},${q(color)},'{"Compatibility":"PS5; compatible PC games may require a cable or adapter","Connectivity":"Wireless / USB-C"}',21999,1);`,
    `INSERT OR IGNORE INTO product_details(product_id,generation,compatibility,region,warranty,price_on_request) VALUES(${q(id)},'PS5','PS5; check game-specific PC and mobile support before ordering.','Confirm supplied region with the store.','Owner-approved warranty terms pending confirmation.',0);`,
    `INSERT INTO product_images(id,product_id,r2_key,alt_text,is_primary,is_transparent_asset,width,height) VALUES(${q(id + "-image")},${q(id)},${q(im.key)},${q(name + " — official Sony product cutout")},1,1,${im.width},${im.height}) ON CONFLICT(id) DO UPDATE SET width=excluded.width,height=excluded.height,is_transparent_asset=1;`,
    `INSERT OR IGNORE INTO inventory(id,variant_id,branch_id,quantity_available) SELECT ${q(id + "-")}||id,${q(id + "-v")},id,0 FROM branches;`,
  );
}
for (const [slug, asset, page] of cases) {
  const name = existing.find((p) => p.slug === slug)?.name || slug;
  const im = await saveImage(
    `${slug}-case`,
    `https://media.direct.playstation.com/is/image/sierialto/${asset}?fmt=png-alpha&wid=800`,
    `https://direct.playstation.com/en-us/buy-games/${page}`,
    name,
  );
  const id = `catalog-${slug}`;
  statements.push(
    `UPDATE product_images SET is_primary=0 WHERE product_id=${q(id)};`,
    `INSERT INTO product_images(id,product_id,r2_key,alt_text,is_primary,is_transparent_asset,width,height) VALUES(${q(id + "-case")},${q(id)},${q(im.key)},${q(name + " — official physical PS5 retail case; region and packaging may vary")},1,0,${im.width},${im.height}) ON CONFLICT(id) DO UPDATE SET is_primary=1,is_transparent_asset=0;`,
  );
}
const controllerIds = controllers.map(([slug]) => `catalog-${slug}`).join(",");
statements.push(
  "UPDATE products SET active=0 WHERE id IN ('catalog-dualsense-midnight-black','catalog-dualsense-cosmic-red');",
);
statements.push(
  `UPDATE homepage_sections SET title='CONTROLLERS SECTION',enabled=1,settings_json=${q(JSON.stringify({ productIds: controllerIds }))} WHERE section_key='controllers';`,
  `UPDATE homepage_sections SET title='GAMES SECTION',enabled=1 WHERE section_key='games';`,
);
await writeFile(
  "db/showcase-catalogue.sql",
  "-- Quote-only showcase controllers and actual publisher retail-case images.\n" +
    statements.join("\n") +
    "\n",
);
await writeFile(
  "public/catalogue/showcase-sources.json",
  JSON.stringify(sourceRows, null, 2),
);
