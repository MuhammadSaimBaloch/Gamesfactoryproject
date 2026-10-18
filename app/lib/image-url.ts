import manifest from "./image-assets.json";
type Variant = { width: number; url: string; bytes: number };
const assets = manifest as Record<string, Variant[]>;
export function imageUrl(key: string, width = 960) {
  const variants = assets[key];
  if (variants?.length)
    return (
      variants.find((v) => v.width >= width) || variants[variants.length - 1]
    ).url;
  if (/^catalogue\/[a-z0-9-]+\.(png|jpg|webp|avif)$/.test(key))
    return `/${key}`;
  return `/media/${key}?w=${width <= 480 ? 480 : 960}`;
}
export function imageSrcSet(key: string) {
  const variants = assets[key];
  return variants?.length
    ? variants.map((v) => `${v.url} ${v.width}w`).join(", ")
    : `${imageUrl(key, 480)} 480w, ${imageUrl(key, 960)} 960w`;
}
