import { test, expect } from "@playwright/test";
test("responsive images load without redirects and keep the latest shelf at six", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("response", (response) => {
    if (
      response.request().resourceType() === "image" &&
      response.status() >= 400
    )
      failures.push(response.url());
  });
  await page.goto("/");
  const hero = page.locator(".hero-art img");
  await expect(hero).toHaveAttribute("fetchpriority", "high");
  await expect(hero).toHaveAttribute(
    "src",
    /\/catalogue\/optimized\/.*\.webp$/,
  );
  const shelf = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "FRESH IN THE COLLECTION.",
        exact: true,
      }),
    });
  await expect(shelf.locator(".product-card")).toHaveCount(6);
  for (const section of await page.locator("main > section").all()) {
    await section.scrollIntoViewIfNeeded();
    await section.locator("img").evaluateAll(async (images) => {
      await Promise.all(
        images.map(async (image) => {
          const img = image as HTMLImageElement;
          img.loading = "eager";
          await img.decode();
        }),
      );
    });
  }
  expect(failures).toEqual([]);
  const paths = await page
    .locator("main img")
    .evaluateAll((images) =>
      images.map(
        (image) => new URL((image as HTMLImageElement).currentSrc).pathname,
      ),
    );
  expect(paths.filter((path) => path.startsWith("/media/catalogue/"))).toEqual(
    [],
  );
  await page.goto("/product/mario-kart-8-deluxe-switch");
  const framed = page.locator(".gallery-main svg image");
  await expect(framed).toHaveAttribute(
    "href",
    /\/catalogue\/optimized\/.*\.webp$/,
  );
  const href = await framed.getAttribute("href");
  expect((await page.request.get(href!)).ok()).toBeTruthy();
});
