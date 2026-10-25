import { test, expect } from "@playwright/test";
test.setTimeout(120000);
test("every enabled published controller and physical game is reachable in its homepage platform display", async ({
  page,
  request,
}, info) => {
  const snapshot = await (await request.get("/api/admin/backup")).json();
  const tables = snapshot.tables;
  const products = tables.products.filter(
    (p: { id: string; active: number; demo: number }) =>
      p.active &&
      !p.demo &&
      tables.product_details.some(
        (d: { product_id: string; homepage_showcase: number }) =>
          d.product_id === p.id && d.homepage_showcase,
      ) &&
      tables.product_variants.some(
        (v: { product_id: string; available: number }) =>
          v.product_id === p.id && v.available,
      ),
  );
  const generation = (id: string) =>
    tables.product_details.find(
      (d: { product_id: string }) => d.product_id === id,
    )?.generation;
  await page.goto("/");
  const groups = [
    {
      kind: "controllers",
      type: "controller",
      tabs: [
        { name: "PS5 controllers", generation: "PS5" },
        { name: "Xbox controllers", platform: "Xbox" },
        { name: "PS4 controllers", generation: "PS4" },
      ],
    },
    {
      kind: "games",
      type: "physical-game",
      tabs: [
        { name: "PlayStation 5 games", generation: "PS5" },
        { name: "PlayStation 4 games", generation: "PS4" },
        { name: "Xbox games", platform: "Xbox" },
        { name: "Nintendo games", platform: "Nintendo" },
      ],
    },
  ];
  for (const group of groups) {
    const section = page.locator(`.collection-showcase--${group.kind}`);
    await expect(section.locator(".collection-track")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    for (const tab of group.tabs) {
      const expected = products.filter(
        (p: { id: string; product_type: string; platform: string }) =>
          p.product_type === group.type &&
          ("generation" in tab
            ? generation(p.id) === tab.generation
            : p.platform === tab.platform),
      );
      await section.getByRole("tab", { name: tab.name, exact: true }).click();
      await expect(section.locator(".collection-track")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      await expect(section.locator(".collection-slide")).toHaveCount(
        expected.length,
      );
      const labels = await section
        .locator(".collection-slide")
        .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
      for (const product of expected)
        expect(labels).toContain(`Show ${product.name}`);
    }
  }
  const games = page.locator(".collection-showcase--games");
  await games
    .getByRole("tab", { name: "PlayStation 5 games", exact: true })
    .click();
  for (const name of ["ASTRO BOT", "God of War Ragnarök", "Gran Turismo 7"]) {
    const button = games.getByRole("button", {
      name: `Show ${name}`,
      exact: true,
    });
    await expect(button.locator("svg.product-image")).toHaveCount(1);
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await expect(games.locator(".collection-details h3")).toHaveText(name);
  }
  await games.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/product-workspace/full-games-${info.project.name}.png`,
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
