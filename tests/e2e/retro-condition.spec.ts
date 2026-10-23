import { test, expect } from "@playwright/test";

test("Retro opens from the category grid and unavailable conditions cannot be purchased", async ({
  page,
}) => {
  await page.goto("/");
  const retro = page
    .locator(".category-links")
    .getByRole("link", { name: /Retro/ });
  await expect(retro).toBeVisible();
  await retro.scrollIntoViewIfNeeded();
  await retro.locator("img").evaluate(async (image) => {
    await (image as HTMLImageElement).decode();
    if (!(image as HTMLImageElement).naturalWidth)
      throw Error("Broken Retro artwork");
  });
  await retro.click();
  await expect(page).toHaveURL(/\/category\/retro/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("RETRO.");
  await page.goto("/product/dualsense-white");
  const condition = page.getByRole("combobox", {
    name: "Condition",
    exact: true,
  });
  await expect(condition).toHaveValue("New");
  await condition.selectOption("Used");
  await expect(page.locator(".detail-price")).toContainText(
    "Not currently listed in this condition",
  );
  await expect(
    page.getByRole("combobox", { name: "Choose your variant", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /Add to bag|Buy now/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Ask about price/ }),
  ).toHaveAttribute("href", /Used/);
  await condition.selectOption("New");
  await expect(
    page.getByRole("combobox", { name: "Choose your variant", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".detail-price")).toContainText(
    "Contact for price",
  );
});
