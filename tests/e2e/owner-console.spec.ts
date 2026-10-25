import { test, expect } from "@playwright/test";
test.setTimeout(180000);
test.use({ actionTimeout: 15000 });
test("owner pages render with a separate management layout at desktop and mobile widths", async ({
  page,
}, info) => {
  const paths =
    info.project.name === "desktop"
      ? [
          "",
          "products",
          "inventory",
          "categories",
          "brands",
          "sales",
          "promotions",
          "homepage",
          "media",
          "orders",
          "branches",
          "shipping",
          "settings",
          "activity",
          "recovery",
        ]
      : ["", "products", "inventory", "sales", "media", "homepage"];
  for (const path of paths) {
    const response = await page.goto(`/admin${path ? "/" + path : ""}`, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status(), path).toBe(200);
    await expect(page.locator(".owner-topbar")).toBeVisible();
    await expect(page.locator(".admin-content h1")).toHaveText(
      `${path ? path.toUpperCase() : "OVERVIEW"}.`,
    );
    await expect(page.getByText("Choose a management section.")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      path,
    ).toBe(true);
    await expect(page.locator("footer")).toHaveCount(0);
    if (!path || path === "inventory" || path === "sales")
      await page.screenshot({
        path: `artifacts/owner-${path || "dashboard"}-${info.project.name}.png`,
        fullPage: false,
      });
  }
});
test("owner can find products, edit specifications visually and order homepage products without JSON", async ({
  page,
}) => {
  await page.goto("/admin/products");
  await page.getByLabel("Find a product or SKU").fill("Rhythm Blue");
  const row = page.locator("tbody tr");
  await expect(row).toHaveCount(1);
  await row.getByRole("link", { name: "Edit product", exact: true }).click();
  await page
    .getByText("Compatibility, warranty & additional information", {
      exact: true,
    })
    .click();
  await expect(page.locator(".spec-editor").first()).toBeVisible();
  await expect(page.locator('textarea[name="attributesJson"]')).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Upload a photo or banner",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/admin/homepage");
  await expect(page.locator('textarea[name="settings"]')).toHaveCount(0);
  await expect(
    page.getByText(/For Controllers and Games, open a product/),
  ).toBeVisible();
  await expect(
    page
      .locator("form")
      .filter({
        has: page.getByRole("heading", { name: "controllers", exact: true }),
      })
      .locator(".selection-editor"),
  ).toHaveCount(0);
});
test("owner can save and remove a disabled sale with Pakistan scheduling", async ({
  page,
  request,
}) => {
  const id = `browser-sale-${crypto.randomUUID()}`,
    origin = "http://127.0.0.1:5173";
  const data = {
    entity: "sale",
    id,
    title: "Owner console QA sale",
    mode: "percent",
    value: "10",
    enabled: "0",
    startsAt: "2099-01-01T00:00:00.000Z",
    endsAt: "",
    variantIds: "catalog-dualsense-white-v",
  };
  try {
    const response = await request.post("/admin/sales", {
      headers: { Origin: origin },
      form: data,
    });
    expect(response.ok()).toBe(true);
    await page.goto("/admin/sales");
    const editor = page.locator("form").filter({
      has: page.getByRole("heading", { name: data.title, exact: true }),
    });
    await expect(editor).toBeVisible();
    await expect(
      editor.locator('input[type="datetime-local"]').first(),
    ).toHaveValue("2099-01-01T05:00");
    await expect(editor.locator('input[name="startsAt"]')).toHaveValue(
      "2099-01-01T00:00:00.000Z",
    );
    await expect(editor.locator('input[name="variantIds"]')).toHaveValue(
      data.variantIds,
    );
  } finally {
    await request.post("/admin/sales", {
      headers: { Origin: origin },
      form: { entity: "sale", id, action: "delete" },
    });
  }
});
test("media library previews transparent uploads and allows removal of an unused asset", async ({
  page,
  request,
}) => {
  const alt = `Owner console QA photo ${crypto.randomUUID()}`;
  let id = "";
  page.on("dialog", (dialog) => dialog.accept());
  try {
    await page.goto("/admin/media");
    const upload = page.locator("form").filter({
      has: page.getByRole("heading", {
        name: "Upload a photo or banner",
        exact: true,
      }),
    });
    await upload
      .getByRole("combobox", { name: "Product", exact: true })
      .selectOption("");
    await upload
      .getByRole("combobox", { name: "Image use", exact: true })
      .selectOption("gallery");
    await upload
      .getByLabel("Image", { exact: true })
      .setInputFiles("public/catalogue/dualsense-white.png");
    await expect(upload.locator(".upload-preview img")).toBeVisible();
    await upload
      .getByLabel("Image description (alt text)", { exact: true })
      .fill(alt);
    await upload
      .getByRole("button", { name: "Upload image", exact: true })
      .click();
    const card = page
      .locator(".media-grid article")
      .filter({ has: page.getByText(alt, { exact: true }) });
    await expect(card).toBeVisible({ timeout: 30000 });
    id = await card.locator('input[name="id"]').inputValue();
    await card
      .getByRole("button", { name: "Delete image", exact: true })
      .click();
    await expect(card).toHaveCount(0, { timeout: 15000 });
    id = "";
  } finally {
    if (id)
      await request.post("/admin/media", {
        headers: { Origin: "http://127.0.0.1:5173" },
        form: { entity: "media-delete", id },
      });
  }
});
test("private business backup contains catalogue and stock but excludes login sessions", async ({
  request,
}) => {
  const response = await request.get("/api/admin/backup");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  const snapshot = await response.json();
  expect(snapshot.format).toBe("games-factory-business-snapshot");
  expect(snapshot.tables.products.length).toBeGreaterThan(10);
  expect(snapshot.tables).not.toHaveProperty("customer_sessions");
  expect(snapshot.mediaManifest.length).toBeGreaterThan(10);
});
