import { test, expect } from "@playwright/test";
test("initial catalogue has product photography, approved prices and stock checks", async ({
  page,
}) => {
  await page.goto("/shop?generation=PS5");
  await expect
    .poll(() => page.locator(".product-card").count())
    .toBeGreaterThanOrEqual(11);
  await expect(page.locator(".product-card").first()).toContainText(
    /9,999|21,999|249,999/,
  );
  await page.goto("/product/astro-bot");
  await expect(
    page.getByRole("heading", { name: "ASTRO BOT", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".gallery-main img")).toBeVisible();
  expect(
    await page
      .locator(".gallery-main img")
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  ).toBe(true);
  await expect(page.locator(".detail-price")).toContainText("9,999");
  await expect(
    page.getByRole("button", { name: "Add to bag", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/contact for price/i);
});
test("business details and payment methods are published without inventing policies", async ({
  page,
}) => {
  await page.goto("/branches");
  await expect(page.locator("main")).toContainText("Shop No 17B");
  await expect(page.locator("main")).toContainText("Emirates Mall");
  await expect(page.locator("main")).toContainText("03186496819");
  await page.goto("/policies/payment");
  await expect(page.locator("main")).toContainText("Meezan Bank");
  await expect(page.locator("main")).toContainText("Faysal Bank");
  await expect(page.locator("main")).toContainText("Wait for staff");
  await page.goto("/policies/warranty");
  await expect(page.locator("main")).toContainText("Please contact our team");
});
test("newsletter and customer account entry points are removed", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".newsletter")).toHaveCount(0);
  await expect(page.locator('a[href^="/account"]')).toHaveCount(0);
  await page.evaluate(() =>
    localStorage.setItem(
      "gfp-bag-v1",
      JSON.stringify({
        state: {
          items: [
            {
              variantId: "catalog-dualsense-white-v",
              name: "DualSense Wireless Controller — White",
              variant: "White",
              slug: "dualsense-white",
              price: 0,
              quantity: 1,
              image: "catalogue/dualsense-white.png",
              type: "controller",
              demo: 0,
            },
          ],
        },
        version: 0,
      }),
    ),
  );
  await page.goto("/checkout");
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
  await expect(page.locator('a[href^="/account"]')).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Sign in");
  expect((await page.goto("/account"))?.status()).toBe(404);
  expect(
    (await page.goto("/account/verify?token=" + "ab".repeat(32)))?.status(),
  ).toBe(404);
  expect((await page.goto("/services/newsletter"))?.status()).toBe(404);
});
test("promotion controls and new pages work at mobile and desktop widths", async ({
  page,
}) => {
  await page.goto("/");
  const first = await page.locator(".campaign h2").textContent();
  await page
    .getByRole("button", { name: "Next promotion", exact: true })
    .click();
  await expect(page.locator(".campaign h2")).not.toHaveText(first!);
  await page
    .getByRole("button", { name: "Pause promotions", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Play promotions", exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/account", "/contact", "/shop?generation=PS5"]) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${path} at ${width}px`,
      ).toBe(true);
    }
  }
});
