import { mkdir, writeFile } from "node:fs/promises";
import { imageSize } from "image-size";
const products = [
  [
    "ps5-slim-disc",
    "PlayStation 5 Slim Disc Edition",
    "ps5",
    "console",
    "Experience PS5 games with SSD loading, DualSense haptic feedback and a disc drive. Confirm the exact model, storage and included accessories with our team.",
  ],
  [
    "astro-bot",
    "ASTRO BOT",
    "games/astro-bot",
    "physical-game",
    "Explore colorful planets, discover new abilities and rescue Astro’s scattered crew in this PS5 platforming adventure.",
  ],
  [
    "marvels-spider-man-2",
    "Marvel’s Spider-Man 2",
    "games/marvels-spider-man-2",
    "physical-game",
    "Join Peter Parker and Miles Morales in an action adventure across Marvel’s New York.",
  ],
  [
    "god-of-war-ragnarok",
    "God of War Ragnarök",
    "games/god-of-war-ragnarok",
    "physical-game",
    "Journey through the Nine Realms with Kratos and Atreus in a story-driven action adventure.",
  ],
  [
    "gran-turismo-7",
    "Gran Turismo 7",
    "games/gran-turismo-7",
    "physical-game",
    "Collect, tune and race cars in a driving simulator featuring a solo campaign and online competition. Internet access is required for most features.",
  ],
  [
    "horizon-forbidden-west",
    "Horizon Forbidden West",
    "games/horizon-forbidden-west",
    "physical-game",
    "Explore a distant-future frontier with Aloy, encounter mechanical creatures and uncover the mysteries of a threatened world.",
  ],
  [
    "ratchet-and-clank-rift-apart",
    "Ratchet & Clank: Rift Apart",
    "games/ratchet-and-clank-rift-apart",
    "physical-game",
    "Travel between dimensions with Ratchet, Clank and Rivet in a colorful action-platforming adventure.",
  ],
  [
    "returnal",
    "Returnal",
    "games/returnal",
    "physical-game",
    "Fight through a changing alien world as Selene in a challenging sci-fi action game built around repeated runs.",
  ],
  [
    "demons-souls",
    "Demon’s Souls",
    "games/demons-souls",
    "physical-game",
    "Enter Boletaria in a remake of the dark fantasy action RPG, with demanding combat and memorable bosses.",
  ],
  [
    "the-last-of-us-part-i",
    "The Last of Us Part I",
    "games/the-last-of-us-part-i",
    "physical-game",
    "Experience Joel and Ellie’s story in a rebuilt edition of the survival action adventure for PS5.",
  ],
  [
    "ghost-of-tsushima-directors-cut",
    "Ghost of Tsushima Director’s Cut",
    "games/ghost-of-tsushima",
    "physical-game",
    "Explore Tsushima as Jin Sakai in a samurai action adventure. Director’s Cut includes the Iki Island expansion.",
  ],
];
await mkdir("public/catalogue", { recursive: true });
const results = await Promise.allSettled(
  products.map(async ([slug, name, path, type, description]) => {
    const source = `https://www.playstation.com/en-us/${path}/`;
    const response = await fetch(source, {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw Error(`${slug}: source ${response.status}`);
    const html = await response.text();
    let image = html.match(
      /<meta\s+property="og:image"\s+content="([^"]+)"/,
    )?.[1];
    if (!image) throw Error(`${slug}: no publisher artwork`);
    if (type === "console")
      image =
        "https://gmedia.playstation.com/is/image/SIEPDC/ps5-slim-edition-left-image-block-01-en-24jun24?$1200px--t$";
    // Preserve publisher artwork; no generated packaging or image alterations.
    const asset = await fetch(image.replaceAll("&amp;", "&"), {
      signal: AbortSignal.timeout(30000),
    });
    if (!asset.ok) throw Error(`${slug}: image ${asset.status}`);
    const bytes = new Uint8Array(await asset.arrayBuffer());
    const size = imageSize(bytes);
    const extension = size.type === "jpg" ? "jpg" : size.type;
    if (!["jpg", "png", "webp", "avif"].includes(extension))
      throw Error(`${slug}: unsupported image ${extension}`);
    const key = `catalogue/${slug}.${extension}`;
    await writeFile(`public/${key}`, bytes);
    return {
      id: `catalog-${slug}`,
      slug,
      name,
      type,
      description,
      source,
      imageSource: image,
      key,
      width: size.width,
      height: size.height,
      downloadedAt: new Date().toISOString(),
      rights:
        "Official publisher marketing artwork. Source attribution retained; no license grant inferred.",
    };
  }),
);
const entries = [];
for (let i = 0; i < results.length; i++) {
  const result = results[i];
  if (result.status === "fulfilled") {
    entries.push(result.value);
    console.log(
      `${result.value.slug}: ${result.value.width}×${result.value.height}`,
    );
  } else console.error(products[i][0], result.reason.message);
}
await writeFile(
  "public/catalogue/sources.json",
  JSON.stringify(entries, null, 2),
);
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const statements = entries.flatMap((p) => [
  `INSERT OR IGNORE INTO products(id,slug,name,description,category_id,brand,platform,condition,product_type,featured,active,demo,seo_title,seo_description) VALUES(${q(p.id)},${q(p.slug)},${q(p.name)},${q(p.description)},${q(p.type === "console" ? "consoles" : "games")},'Sony Interactive Entertainment','PlayStation','New',${q(p.type)},1,1,0,${q(p.name + " in Pakistan")},${q(p.description)});`,
  `INSERT OR IGNORE INTO product_variants(id,product_id,sku,name,attributes_json,price_pkr,available) VALUES(${q(p.id + "-v")},${q(p.id)},${q("GFP-" + p.slug.toUpperCase())},${q("PS5 · confirm region and edition")},'{}',0,1);`,
  `INSERT OR IGNORE INTO product_details(product_id,generation,compatibility,region,edition,box_contents,warranty,price_on_request) VALUES(${q(p.id)},'PS5',${q(p.type === "console" ? "PS5 games; confirm model and disc compatibility before purchase." : "PS5. Physical discs require a compatible PS5 disc drive.")},'Confirm the supplied region before purchase.','Confirm available edition with the store.','Confirm the supplied package contents with the store.','Owner-approved warranty terms pending confirmation.',1);`,
  `INSERT OR IGNORE INTO product_images(id,product_id,r2_key,alt_text,is_primary,width,height) VALUES(${q(p.id + "-image")},${q(p.id)},${q(p.key)},${q(p.name + " — official PlayStation artwork")},1,${p.width},${p.height});`,
  `INSERT OR IGNORE INTO inventory(id,variant_id,branch_id,quantity_available) SELECT ${q(p.id + "-")}||id,${q(p.id + "-v")},id,0 FROM branches;`,
]);
const consoleAsset = entries.find((p) => p.type === "console"),
  gameAsset = entries.find((p) => p.type === "physical-game");
if (consoleAsset)
  statements.push(
    `UPDATE site_settings SET value=${q(consoleAsset.key)} WHERE key='hero_image_key';`,
    `INSERT INTO site_settings(key,value) VALUES('category_image_consoles',${q(consoleAsset.key)}) ON CONFLICT(key) DO UPDATE SET value=excluded.value;`,
  );
if (gameAsset)
  statements.push(
    `INSERT INTO site_settings(key,value) VALUES('category_image_games',${q(gameAsset.key)}) ON CONFLICT(key) DO UPDATE SET value=excluded.value;`,
  );
await writeFile(
  "db/initial-catalogue.sql",
  "-- Owner-requested initial catalogue. Prices and stock require confirmation.\n" +
    statements.join("\n") +
    "\n",
);
if (entries.length !== products.length) process.exitCode = 1;
