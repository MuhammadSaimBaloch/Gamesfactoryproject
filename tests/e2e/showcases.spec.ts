import { test, expect } from "@playwright/test";
test("centered controller and physical-game showcases browse by arrows, keyboard and platform tabs", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  for (const kind of ["controllers", "games"]) {
    const section = page.locator(`.collection-showcase--${kind}`),
      rail = section.locator(".collection-track"),
      details = section.locator(".collection-details");
    await section.scrollIntoViewIfNeeded();
    await expect(rail).toBeVisible();
    await expect
      .poll(() => rail.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    const original = await details.locator("h3").textContent();
    if (kind === "games" && testInfo.project.name === "mobile") {
      await rail.focus();
      await page.keyboard.press("ArrowRight");
    } else {
      await section
        .getByRole("button", {
          name: kind === "games" ? "Next game" : "Next controller",
          exact: true,
        })
        .click();
    }
    await expect(details.locator("h3")).not.toHaveText(original!);
    await expect(
      details.getByRole("link", { name: "Shop now", exact: true }),
    ).toHaveAttribute("href", /\/product\//);
    await rail.focus();
    await page.keyboard.press("Home");
    await expect(section.locator(".collection-slide").first()).toHaveAttribute(
      "aria-current",
      "true",
    );
    await page.keyboard.press("ArrowRight");
    await expect(section.locator(".collection-slide").nth(1)).toHaveAttribute(
      "aria-current",
      "true",
    );
    await section
      .getByRole("tab", {
        name: kind === "games" ? "PlayStation 4 games" : "PS4 controllers",
        exact: true,
      })
      .click();
    await expect(section.locator(".collection-slide")).toHaveCount(3);
    await expect(section.locator(".collection-details h3")).toContainText(
      kind === "games" ? "PS4" : "DUALSHOCK 4",
    );
    await section
      .getByRole("tab", {
        name: kind === "games" ? "PlayStation 5 games" : "PS5 controllers",
        exact: true,
      })
      .click();
    await expect(rail).toBeVisible();
    await expect(section.locator(".collection-progress")).toHaveAttribute(
      "aria-label",
      /^2 of /,
    );
    await expect
      .poll(() =>
        rail.evaluate((el) => {
          const slide = el
              .querySelector('[aria-current="true"]')!
              .getBoundingClientRect(),
            bounds = el.getBoundingClientRect();
          return Math.abs(
            slide.left + slide.width / 2 - (bounds.left + bounds.width / 2),
          );
        }),
      )
      .toBeLessThan(3);
    await section.locator("img").evaluateAll(async (images) => {
      await Promise.all(
        images.map((img) => (img as HTMLImageElement).decode()),
      );
    });
    await section.evaluate((el) =>
      window.scrollTo({
        top: window.scrollY + el.getBoundingClientRect().top - 95,
        behavior: "instant",
      }),
    );
    await expect(
      section.locator(
        '.collection-slide[aria-current="true"] .collection-object',
      ),
    ).toHaveCSS("opacity", "1");
    await section.screenshot({
      path: `artifacts/${kind}-showcase-${testInfo.project.name}.png`,
    });
  }
});
test("horizontal wheel and mouse dragging update the selected product without trapping vertical scrolling", async ({
  page,
}) => {
  await page.goto("/");
  const section = page.locator(".collection-showcase--controllers"),
    rail = section.locator(".collection-track");
  await rail.scrollIntoViewIfNeeded();
  await expect
    .poll(() => rail.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
  const before = await section.locator(".collection-details h3").textContent();
  const box = (await rail.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(380, 0);
  await expect(section.locator(".collection-details h3")).not.toHaveText(
    before!,
  );
  await rail.focus();
  await page.keyboard.press("Home");
  await expect(section.locator(".collection-slide").first()).toHaveAttribute(
    "aria-current",
    "true",
  );
  const start = await rail.evaluate((el) => el.scrollLeft);
  const area = (await rail.boundingBox())!;
  await page.mouse.move(area.x + area.width * 0.75, area.y + area.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(
    area.x + area.width * 0.15,
    area.y + area.height * 0.5,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect
    .poll(() => rail.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(start + 80);
  const y = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y + 50);
});
test("touch swipe advances the centered game on mobile", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "Touch gesture is exercised in the mobile browser context.",
  );
  await page.goto("/");
  const section = page.locator(".collection-showcase--games"),
    rail = section.locator(".collection-track");
  await rail.scrollIntoViewIfNeeded();
  await expect
    .poll(() => rail.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
  const box = (await rail.boundingBox())!,
    before = await section.locator(".collection-details h3").textContent();
  const session = await context.newCDPSession(page);
  const x = Math.round(box.x + box.width * 0.8),
    y = Math.round(box.y + box.height * 0.5);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let step = 1; step <= 12; step++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x - step * 20, y }],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(section.locator(".collection-details h3")).not.toHaveText(
    before!,
  );
  const current = (await rail.boundingBox())!,
    x2 = Math.round(current.x + current.width * 0.5),
    y2 = Math.round(current.y + current.height * 0.65),
    oldY = await page.evaluate(() => scrollY);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: x2, y: y2 }],
  });
  for (let step = 1; step <= 10; step++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x2, y: y2 - step * 20 }],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(oldY + 30);
  await session.detach();
});
