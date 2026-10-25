import { test, expect } from "@playwright/test";

test("inventory collections show unique products and matching condition, storage and PSP photos", async ({
  page,
}, testInfo) => {
  await page.goto("/category/consoles");
  const cards = page.locator(".product-card");
  await expect(cards.first()).toBeVisible();
  const addresses = await cards
    .locator(".card-stage > a")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(new Set(addresses).size).toBe(addresses.length);
  await page.screenshot({
    path: `artifacts/inventory-consoles-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "Generation", exact: true })
    .selectOption("PS3");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(cards).toHaveCount(3);
  for (const card of await cards.all())
    await expect(card).toContainText("PlayStation 3");

  await page.goto("/product/playstation-4-slim");
  const condition = page.getByRole("combobox", {
    name: "Condition",
    exact: true,
  });
  const variant = page.getByRole("combobox", {
    name: "Choose your variant",
    exact: true,
  });
  await expect(condition).toBeEnabled();
  await expect(condition).toHaveValue("Used");
  await expect(variant.locator("option")).toHaveCount(4);
  await expect(variant).toContainText("500GB / Jailbreak / 7+ games");
  await expect(page.locator(".detail-price")).toContainText("249,999");
  await expect(
    page.getByRole("button", { name: "Add to bag", exact: true }),
  ).toBeDisabled();
  await condition.selectOption("New");
  await expect(variant).toBeDisabled();
  await expect(variant).toContainText("No new variants listed");

  await page.goto("/product/nintendo-switch-oled");
  await expect(condition).toBeEnabled();
  await condition.selectOption("Used");
  await expect(variant.locator("option")).toHaveCount(1);
  await expect(page.locator(".detail-price")).toContainText("249,999");
  await expect(
    page.getByRole("button", { name: "Add to bag", exact: true }),
  ).toBeDisabled();

  await page.goto("/product/psp");
  await expect(variant).toBeEnabled();
  await expect(variant.locator("option")).toHaveCount(3);
  await variant.selectOption({ index: 2 });
  await expect(variant.locator("option:checked")).toContainText("3000");
  await expect(
    page.locator(".product-detail img.product-image").first(),
  ).toHaveAttribute("src", /psp-3000/);
  await page
    .locator(".product-detail img.product-image")
    .first()
    .evaluate((image: HTMLImageElement) => image.decode());
  await page.screenshot({
    path: `artifacts/inventory-psp-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
