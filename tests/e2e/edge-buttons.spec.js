// Page-turn buttons live in the left/right page margins, vertically centred, and never cover text.
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const fixture = name => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
});
test.afterEach(() => expect(errors, "page should not throw").toEqual([]));

async function open(page) {
  await page.setInputFiles("#empty [data-file]", fixture("zh-sample.epub"));
  await page.waitForFunction(() => window.__reader);
  await expect(page.locator("#where")).toHaveText(/本章 1 \//);
}
const box = (page, sel) => page.locator(sel).boundingBox();

for (const [name, viewport, spread] of [["two pages", { width: 1280, height: 800 }, true], ["one page (narrow window)", { width: 600, height: 800 }, false]]) {
  test(`${name}: arrows sit in the middle of the page margins and do not cover the text`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    expect(await page.evaluate(() => window.__reader.isSpread())).toBe(spread);
    // #viewer is the visible text area (the iframe inside is a wider strip of columns, clipped)
    const [sp, text, prev, next] = await Promise.all(["#reading .spread", "#viewer", "#prev", "#next"].map(s => box(page, s)));

    // left zone: from the page's left edge up to where the text starts; right zone likewise
    expect(prev.x).toBeCloseTo(sp.x, 0);
    expect(prev.x + prev.width).toBeLessThanOrEqual(text.x + 0.5);
    expect(next.x).toBeGreaterThanOrEqual(text.x + text.width - 0.5);
    expect(next.x + next.width).toBeCloseTo(sp.x + sp.width, 0);
    // full height of the page, so the arrow (centred) is in the vertical middle
    for (const b of [prev, next]) {
      expect(b.width).toBeGreaterThanOrEqual(20);
      expect(b.y).toBeCloseTo(sp.y, 0);
      expect(b.height).toBeCloseTo(sp.height, 0);
    }
    const arrow = await box(page, "#next span");
    expect(Math.abs(arrow.y + arrow.height / 2 - (sp.y + sp.height / 2))).toBeLessThan(4);
  });
}

test("clicking anywhere along the right/left margin turns the page; the arrow brightens on hover", async ({ page }) => {
  await open(page);
  const where = page.locator("#where");
  const next = await box(page, "#next");
  const opacity = () => page.locator("#next span").evaluate(el => Number(getComputedStyle(el).opacity));
  expect(await opacity()).toBeLessThan(0.5);
  await page.mouse.move(next.x + next.width / 2, next.y + next.height / 2);
  await expect.poll(opacity).toBe(1);

  await page.mouse.click(next.x + next.width / 2, next.y + 30); // near the top, not on the arrow
  await expect(where).toHaveText(/本章 [2-9]\d* \//);
  const prev = await box(page, "#prev");
  await page.mouse.click(prev.x + prev.width / 2, prev.y + prev.height - 30); // near the bottom
  await expect(where).toHaveText(/本章 1 \//);
});

test("the old arrows are gone from the bottom bar", async ({ page }) => {
  await open(page);
  await expect(page.locator(".dock #prev, .dock #next")).toHaveCount(0);
});

test("with a panel or an enlarged picture open, clicking the margin does not turn the page", async ({ page }) => {
  await open(page);
  const where = page.locator("#where");
  const before = await where.textContent();
  const next = await box(page, "#next");
  const clickMargin = () => page.mouse.click(next.x + next.width / 2, next.y + next.height / 2);

  for (const btn of ["#toc-btn", "#look-btn"]) {
    await page.click(btn);
    await clickMargin(); // lands on the dimmed background, which just closes the panel
    await expect(where).toHaveText(before);
  }
  await page.frameLocator("#viewer iframe").first().locator('img[alt="diagram"]').click();
  await expect(page.locator("#lightbox")).toBeVisible();
  await clickMargin();
  await expect(where).toHaveText(before);
});
