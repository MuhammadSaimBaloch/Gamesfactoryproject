import { test, expect as baseExpect } from "@playwright/test";
import sharp from "sharp";
test.setTimeout(180000);
const expect = baseExpect.configure({ timeout: 15000 });
test.use({ actionTimeout: 15000, navigationTimeout: 30000 });
test("owner can publish a framed pre-order, show its banner and keep unconfirmed prices out of checkout", async ({
  page,
  request,
}, info) => {
  const name = `Workspace QA ${info.project.name} ${Date.now()}`;
  let id = "";
  try {
    await page.goto("/admin/products/new?preorder=1");
    await page.getByLabel("Product name", { exact: true }).fill(name);
    await page
      .getByLabel("Description", { exact: true })
      .fill("A browser verification product. Removed after verification.");
    await page
      .getByLabel("Deposit, cancellation & fulfilment terms", { exact: false })
      .fill(
        "The store confirms the final price before payment. No deposit is collected by this request. Contact the team to cancel before payment.",
      );
    await page
      .getByRole("button", { name: "Save draft & add photos", exact: true })
      .click();
    await expect(page).toHaveURL(/products\/[^/]+\/edit/);
    id = page.url().split("/products/")[1].split("/")[0];
    await expect(
      page.getByRole("heading", { name: "Prices & options", exact: true }),
    ).toBeVisible();
    const upload = page.locator("#product-upload form");
    await upload
      .getByRole("combobox", { name: "Image use", exact: true })
      .selectOption("cover");
    const cover = await sharp({
      create: { width: 1000, height: 1500, channels: 3, background: "#123456" },
    })
      .png()
      .toBuffer();
    await upload.locator('input[type="file"]').setInputFiles({
      name: "qa-cover.png",
      mimeType: "image/png",
      buffer: cover,
    });
    await upload
      .getByLabel("Image description (alt text)", { exact: true })
      .fill(name + " cover");
    await upload
      .getByRole("button", { name: "Upload image", exact: true })
      .click();
    await expect(page.locator(".product-media-grid article")).toHaveCount(1);
    await expect(
      page.locator('.product-workspace select[name="showcaseStyle"]'),
    ).toHaveValue("cover");
    await upload
      .getByRole("combobox", { name: "Image use", exact: true })
      .selectOption("banner");
    const banner = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: "#121212" },
    })
      .png()
      .toBuffer();
    await upload.locator('input[type="file"]').setInputFiles({
      name: "qa-banner.png",
      mimeType: "image/png",
      buffer: banner,
    });
    await upload
      .getByLabel("Image description (alt text)", { exact: true })
      .fill(name + " banner");
    await upload
      .getByRole("button", { name: "Upload image", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Upload image", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("switch", { name: /Show in the homepage games/ })
      .check();
    await page
      .getByRole("switch", { name: /Show in the homepage pre-order slideshow/ })
      .check();
    const banners = page.locator('select[name="preorderBannerKey"]');
    await expect(
      banners.locator("option").filter({ hasText: name + " banner" }),
    ).toHaveCount(1);
    await banners.selectOption({ label: name + " banner" });
    await page
      .getByRole("switch", { name: /moving current-price notice/ })
      .check();
    await page
      .getByRole("switch", { name: "Publish on storefront", exact: true })
      .check();
    await page
      .getByRole("button", { name: "Save product", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "View product" }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/product-workspace/admin-${info.project.name}.png`,
      fullPage: false,
    });
    const href = await page
      .getByRole("link", { name: "View product" })
      .getAttribute("href");
    await page.goto(href!);
    await expect(page.locator(".detail-price")).toHaveText("Not confirmed yet");
    await expect(
      page.getByRole("heading", { name: "REQUEST A PRE-ORDER.", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Add to bag|Buy now/ }),
    ).toHaveCount(0);
    await expect(page.locator(".gallery-main .game-case")).toBeVisible();
    await expect(page.locator(".price-notice")).toBeVisible();
    await page
      .getByRole("button", { name: "Pause price notice", exact: true })
      .click();
    await expect(page.locator(".price-notice")).toHaveClass(/is-paused/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/product-workspace/product-${info.project.name}.png`,
      fullPage: false,
    });
    await page.goto("/pre-orders");
    await expect(
      page.locator(".product-card").filter({ hasText: name }),
    ).toContainText("Not confirmed yet");
    await page.goto("/");
    const slides = page.getByRole("region", { name: "Pre-order highlights" });
    await expect(slides).toBeVisible();
    await expect(
      slides.getByRole("link", { name: /View pre-order/ }),
    ).toHaveAttribute("href", href!);
    const games = page.locator(".collection-showcase--games");
    const rail = games.getByRole("group", {
      name: "Browse games horizontally",
      exact: true,
    });
    await expect(
      games.getByRole("button", { name: `Show ${name}`, exact: true }),
    ).toHaveCount(1);
    await expect(rail).toHaveAttribute("aria-busy", "false");
    await rail.focus();
    await rail.press("Home");
    await expect(games.locator(".collection-details h3")).toHaveText(name);
    await expect(games.locator(".collection-details")).toContainText(
      "Not confirmed yet",
    );
  } finally {
    if (id)
      await request.post("/admin/products", {
        headers: { Origin: "http://127.0.0.1:5173" },
        form: { entity: "product-status", id, active: "0" },
      });
  }
});
