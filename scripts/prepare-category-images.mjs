import { mkdir, writeFile } from "node:fs/promises";
import { imageSize } from "image-size";

const ps = "https://www.playstation.com/en-us/accessories/";
const logi = "https://www.logitechg.com/en-us/shop/p/";
const entries = [
  ["controllers", "catalogue/dualsense-white.png", ps],
  [
    "consoles",
    "catalogue/ps5-slim-disc.png",
    "https://www.playstation.com/en-us/ps5/",
  ],
  [
    "games",
    "catalogue/returnal-case.png",
    "https://direct.playstation.com/en-us/buy-games/returnal-ps5",
  ],
  ["accessories", "dualsense-charging-station-image-block-02-en-22nov23", ps],
  [
    "gift-cards",
    "gift-card-faceplate-shapes-image-block-en-01-07july23",
    "https://www.playstation.com/en-us/playstation-gift-cards/",
  ],
  [
    "monitors",
    "catalogue/category-monitors-transparent.png",
    "https://www.playstation.com/en-us/accessories/27-inch-gaming-monitor/",
  ],
  [
    "headsets",
    "g733/gallery/g733-lilac-gallery-1.png",
    `${logi}g733-rgb-wireless-headset`,
  ],
  [
    "keyboards",
    "g915/g915-gallery-2.png",
    `${logi}g915-low-profile-wireless-mechanical-gaming-keyboard`,
  ],
  [
    "mice",
    "g502x-plus/2026-update/gallery/g502-x-plus-top-angle-black-purple-gallery-1.png",
    `${logi}g502-x-plus-wireless-lightforce`,
  ],
  [
    "racing-wheels",
    "g923-and-trueforce/g923-gallery/pc/g923-trueforce-sim-racing-wheel-pc-front-angle-gallery-1.png",
    `${logi}g923-trueforce-sim-racing-wheel`,
  ],
];
await mkdir("public/catalogue", { recursive: true });
const sources = await Promise.all(
  entries.map(async ([slug, asset, source]) => {
    if (asset.startsWith("catalogue/")) return { slug, key: asset, source };
    const imageSource = asset.endsWith(".png")
      ? `https://resource.logitechg.com/w_960,c_limit,q_auto,f_png/d_transparent.gif/content/dam/gaming/en/products/${asset}`
      : `https://gmedia.playstation.com/is/image/SIEPDC/${asset}?fmt=png-alpha&wid=960`;
    const response = await fetch(imageSource, {
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) throw new Error(`${slug}: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const dimensions = imageSize(bytes);
    if (dimensions.type !== "png" || !dimensions.width || !dimensions.height)
      throw new Error(`${slug}: invalid PNG`);
    const key = `catalogue/category-${slug}.png`;
    await writeFile(`public/${key}`, bytes);
    console.log(`${slug}: ${dimensions.width}x${dimensions.height}`);
    return {
      slug,
      key,
      source,
      imageSource,
      width: dimensions.width,
      height: dimensions.height,
    };
  }),
);
await writeFile(
  "app/lib/category-images.json",
  JSON.stringify(
    Object.fromEntries(sources.map(({ slug, key }) => [slug, key])),
    null,
    2,
  ) + "\n",
);
await writeFile(
  "public/catalogue/category-sources.json",
  JSON.stringify(
    {
      notes:
        "Original manufacturer images used for category navigation. Source attribution retained; no license grant inferred. Existing catalogue sources are recorded in sources.json and showcase-sources.json.",
      images: sources,
    },
    null,
    2,
  ) + "\n",
);
