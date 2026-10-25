import { expect, test } from "@playwright/test";

test("completed editions display their matching photos, details and unchanged prices", async ({
  page,
}, testInfo) => {
  const cases = [
    {
      slug: "xbox-controller-starfield",
      description: "Constellation",
      specification: "Xbox Wireless / Bluetooth / USB-C",
      price: "21,999",
    },
    {
      slug: "dualsense-astro-bot-joyful-edition",
      description: "smiling Astro-inspired eyes",
      specification: "Bluetooth / USB-C",
      price: "21,999",
    },
    {
      slug: "dualsense-edge-playstation-30th-anniversary-limited-edition",
      description: "replaceable stick modules",
      specification: "DualSense Edge",
      price: "21,999",
    },
    {
      slug: "r36s",
      description: "vertical retro handheld",
      specification: "3.5-inch",
      price: "249,999",
    },
    {
      slug: "sf-3500",
      description: "horizontal SF3500",
      specification: "5-inch",
      price: "249,999",
    },
  ];
  for (const item of cases) {
    await page.goto(`/product/${item.slug}`);
    await expect(page.locator(".product-detail")).toContainText(
      item.description,
    );
    await expect(page.locator(".specs")).toContainText(item.specification);
    await expect(page.locator(".detail-price")).toContainText(item.price);
    const image = page.locator(".product-detail img.product-image").first();
    await expect(image).toHaveAttribute(
      "src",
      new RegExp(`inventory-${item.slug}`),
    );
    await image.evaluate((element: HTMLImageElement) => element.decode());
    await expect(
      page.getByRole("button", { name: "Add to bag", exact: true }),
    ).toBeDisabled();
    await page.getByText("Compatibility", { exact: true }).click();
    await expect(
      page.getByText("Compatibility", { exact: true }).locator(".."),
    ).toContainText(/supported|compatible|PS5/i);
    if (["xbox-controller-starfield", "sf-3500"].includes(item.slug))
      await page.screenshot({
        path: `artifacts/completed-${item.slug}-${testInfo.project.name}.png`,
        fullPage: true,
      });
  }
});
