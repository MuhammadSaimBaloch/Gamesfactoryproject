import { test, expect } from "@playwright/test";

test("approved catalogue prices appear on cards, quick view, search and product pages", async ({
  page,
}) => {
  for (const [slug, price] of [
    ["dualsense-white", "21,999"],
    ["astro-bot", "9,999"],
    ["ps5-slim-disc", "249,999"],
  ]) {
    await page.goto(`/product/${slug}`);
    await expect(page.locator(".detail-price")).toContainText(price);
    await expect(
      page.getByRole("button", { name: "Add to bag", exact: true }),
    ).toBeVisible();
    await expect(page.locator("main")).not.toContainText(
      /contact for price|ask for price/i,
    );
  }
  await page.goto("/shop?q=ASTRO BOT");
  const card = page
    .locator(".product-card")
    .filter({ has: page.locator('a[href="/product/astro-bot"]') });
  await expect(card).toContainText("9,999");
  await card.getByRole("button", { name: /Quick view/ }).click();
  await expect(page.getByRole("dialog")).toContainText("9,999");
  await expect(page.getByRole("dialog")).not.toContainText(
    /contact for price/i,
  );
});
