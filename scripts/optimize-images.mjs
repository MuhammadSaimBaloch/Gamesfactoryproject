import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import sharp from "sharp";

// Delivery-only compression/resizing. Never replace or flatten source artwork.
const output = "public/catalogue/optimized";
await mkdir(output, { recursive: true });
const manifest = {};
let originals = 0,
  responsive = 0;
for (const name of (await readdir("public/catalogue")).sort()) {
  if (!/^[a-z0-9-]+\.(png|jpg|webp|avif)$/.test(name)) continue;
  const input = await readFile(`public/catalogue/${name}`);
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) continue;
  const hash = createHash("sha256")
    .update(input)
    .update(`webp-v1-${sharp.versions.sharp}`)
    .digest("hex")
    .slice(0, 12);
  const sizes = [
    ...new Set([320, 640, 960, 1600].map((w) => Math.min(w, metadata.width))),
  ].sort((a, b) => a - b);
  const variants = [];
  for (const width of sizes) {
    const filename = `${name.replace(/\.[^.]+$/, "")}-${hash}-${width}.webp`;
    const path = `${output}/${filename}`;
    try {
      await stat(path);
    } catch {
      await sharp(input)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 84, alphaQuality: 100, effort: 5 })
        .toFile(path);
    }
    variants.push({
      width,
      url: `/catalogue/optimized/${filename}`,
      bytes: (await stat(path)).size,
    });
  }
  originals += input.length;
  responsive += variants.find(
    (v) => v.width >= Math.min(960, metadata.width),
  ).bytes;
  manifest[`catalogue/${name}`] = variants;
}
const json = JSON.stringify(manifest, null, 2) + "\n";
const destination = "app/lib/image-assets.json";
let previous = "";
try {
  previous = await readFile(destination, "utf8");
} catch {
  /* Initial build. */
}
if (previous !== json) await writeFile(destination, json);
console.log(
  `Optimized ${Object.keys(manifest).length} images. Originals: ${(originals / 1048576).toFixed(2)} MiB; 960px delivery set: ${(responsive / 1048576).toFixed(2)} MiB (${Math.round(100 * (1 - responsive / originals))}% smaller). Original images unchanged.`,
);
