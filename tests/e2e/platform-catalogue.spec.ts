import { test, expect } from "@playwright/test";

test("new platform collections have working cutouts, carousel browsing and matching product pages", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const groups = [
    ["controllers", "Xbox controllers", "Xbox Wireless Controller"],
    ["controllers", "PS4 controllers", "DUALSHOCK 4"],
    ["games", "PlayStation 4 games", "PS4"],
    ["games", "Xbox games", "Xbox"],
    ["games", "Nintendo games", "Nintendo Switch"],
  ];
  for (const [kind, tab, name] of groups) {
    const section = page.locator(`.collection-showcase--${kind}`);
    await section.getByRole("tab", { name: tab, exact: true }).click();
    await expect(section.locator(".collection-slide")).toHaveCount(3);
    await expect(section.locator(".collection-progress")).toHaveAttribute(
      "aria-label",
      "2 of 3",
    );
    const details = section.locator(".collection-details");
    await expect(details.locator("h3")).toContainText(name);
    await expect(details).toContainText(/contact for price/i);
    await section.locator("img").evaluateAll(async (images) => {
      await Promise.all(
        images.map((image) => (image as HTMLImageElement).decode()),
      );
      if (images.some((image) => !(image as HTMLImageElement).naturalWidth))
        throw Error("Broken catalogue image");
    });
    await section.locator("svg image").evaluateAll(async (images) => {
      await Promise.all(
        images.map(async (image) => {
          const photo = new Image();
          photo.src = image.getAttribute("href")!;
          await photo.decode();
        }),
      );
    });
    const before = await details.locator("h3").textContent();
    const rail = section.locator(".collection-track");
    await rail.focus();
    await page.keyboard.press("ArrowRight");
    await expect(details.locator("h3")).not.toHaveText(before!);
    await expect(section.locator(".collection-progress")).toHaveAttribute(
      "aria-label",
      "3 of 3",
    );
    await expect(details.locator("div").first()).toHaveCSS("opacity", "1");
    const href = await details
      .getByRole("link", { name: "Shop now", exact: true })
      .getAttribute("href");
    expect(href).toMatch(/\/product\//);
    const response = await page.request.get(href!);
    expect(response.ok()).toBeTruthy();
    expect(await response.text()).toContain("Contact for price");
    await section.screenshot({
      path: `artifacts/platform-${tab.replaceAll(" ", "-").toLowerCase()}-${testInfo.project.name}.png`,
    });
  }
  for (const url of [
    "/controllers?platform=Xbox",
    "/controllers?generation=PS4",
    "/games?generation=PS4",
    "/games?platform=Xbox",
    "/games?platform=Nintendo",
  ]) {
    await page.goto(url);
    await expect(page.locator(".product-card")).toHaveCount(3);
  }
});
