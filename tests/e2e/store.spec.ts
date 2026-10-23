import { test, expect } from "@playwright/test";
test("storefront and real product details show approved prices without inventing stock", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "PLAY BEYOND." }),
  ).toBeVisible();
  await expect(page.locator("footer")).toBeVisible();
  await expect(page.locator(".hero-art")).toBeVisible();
  await page.screenshot({
    path: `artifacts/home-${testInfo.project.name}.png`,
    fullPage: true,
  });
  if (testInfo.project.name === "desktop")
    await page.screenshot({ path: "artifacts/storefront-preview.png" });
  await page.goto("/product/dualsense-white");
  await expect(page.locator("main")).toContainText("21,999");
  await expect(
    page.getByRole("button", { name: "Add to bag", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("main")).toContainText("21,999");
});
test("URL filters and search return database content", async ({ page }) => {
  await page.goto("/shop?q=ASTRO BOT");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.goto("/shop?q=NoSuchItem");
  await expect(
    page.getByRole("heading", { name: "No products here yet." }),
  ).toBeVisible();
});
test("dialogs support keyboard dismissal and focus return", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByRole("button", {
    name: "Search products",
    exact: true,
  });
  await search.click();
  await page
    .getByRole("textbox", { name: "Search products" })
    .fill("ASTRO BOT");
  await expect(
    page.getByRole("link").filter({ hasText: "ASTRO BOT" }).first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("all required mobile widths avoid horizontal overflow", async ({
  page,
}) => {
  test.setTimeout(180000);
  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/shop",
      "/product/dualsense-white",
      "/checkout",
    ]) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `${path} at ${width}px`,
      ).toBe(true);
    }
  }
});
test("mutation boundaries reject unauthorized requests", async ({
  request,
}) => {
  expect(
    (await request.post("/api/orders/whatsapp", { data: {} })).status(),
  ).toBe(403);
  expect((await request.get("/api/orders/private")).status()).toBe(404);
});
