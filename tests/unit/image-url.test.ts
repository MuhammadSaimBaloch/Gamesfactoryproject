import { describe, expect, it } from "vitest";
import { imageUrl, imageSrcSet } from "../../app/lib/image-url";
describe("responsive catalogue image delivery", () => {
  it("serves bundled images directly at the nearest available size", () => {
    const key = "catalogue/xbox-controller-shock-blue.png";
    expect(imageUrl(key, 400)).toMatch(/\/catalogue\/optimized\/.*-640\.webp$/);
    expect(imageUrl(key, 2000)).toMatch(/-960\.webp$/);
    expect(imageSrcSet(key)).toContain("320w");
    expect(imageSrcSet(key)).toContain("640w");
    expect(imageSrcSet(key)).not.toContain("/media/");
  });
  it("preserves original fallback and supported R2 thumbnail sizes", () => {
    expect(imageUrl("catalogue/future-product.png")).toBe(
      "/catalogue/future-product.png",
    );
    expect(imageUrl("products/abc.png", 320)).toBe(
      "/media/products/abc.png?w=480",
    );
    expect(imageUrl("products/abc.png", 1600)).toBe(
      "/media/products/abc.png?w=960",
    );
  });
});
