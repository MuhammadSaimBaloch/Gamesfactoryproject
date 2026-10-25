import { test, expect } from "@playwright/test";
test.setTimeout(90000);
test("GTA VI pre-order slide appears directly after the hero and opens its enquiry product", async ({
  page,
}, info) => {
  await page.goto("/");
  const slide = page.getByRole("region", { name: "Pre-order highlights" });
  await expect(slide).toBeVisible();
  await expect(
    slide.getByRole("heading", { name: "GRAND THEFT AUTO VI", exact: true }),
  ).toBeVisible();
  expect(
    await slide.evaluate((el) =>
      el.previousElementSibling?.classList.contains("hero"),
    ),
  ).toBe(true);
  await slide.locator("img").evaluate((img: HTMLImageElement) => img.decode());
  await expect(slide).toContainText("Price not confirmed yet");
  await slide.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/product-workspace/gta-preorder-${info.project.name}.png`,
    fullPage: false,
  });
  await slide.getByRole("link", { name: /View pre-order/ }).click();
  await expect(page).toHaveURL(/product\/grand-theft-auto-vi-ps5$/);
  await expect(page.locator(".detail-price")).toHaveText("Not confirmed yet");
  await expect(
    page.getByRole("heading", { name: "REQUEST A PRE-ORDER.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Add to bag|Buy now/ }),
  ).toHaveCount(0);
  await expect(page.locator(".product-info")).toContainText("2026-11-19");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
