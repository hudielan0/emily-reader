// Click a picture in the book to see it large; click or press Esc to close.
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const fixture = name => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const book = page => page.frameLocator("#viewer iframe").first();

let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await page.setInputFiles("#empty [data-file]", fixture("zh-sample.epub"));
  await page.waitForFunction(() => window.__reader);
});
test.afterEach(() => expect(errors, "page should not throw").toEqual([]));

const lightbox = page => page.locator("#lightbox");

test("clicking a diagram shows it large with its caption", async ({ page }) => {
  const diagram = book(page).locator('img[alt="diagram"]');
  await expect(diagram).toHaveClass(/er-zoomable/);
  const inBook = await diagram.evaluate(img => img.getBoundingClientRect().width);

  await diagram.click();
  await expect(lightbox(page)).toBeVisible();
  await expect(page.locator("#lightbox-caption")).toHaveText("图 1-1 测试示意图");
  const big = page.locator("#lightbox-img");
  await expect(big).toHaveJSProperty("complete", true);
  const shown = await big.evaluate(img => ({ w: img.getBoundingClientRect().width, natural: img.naturalWidth }));
  expect(shown.natural).toBe(800);
  expect(shown.w, "enlarged view is wider than the picture in the book").toBeGreaterThan(inBook * 1.4);
});

test("Esc closes the enlarged picture", async ({ page }) => {
  await book(page).locator('img[alt="diagram"]').click();
  await expect(lightbox(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(lightbox(page)).toBeHidden();
});

test("clicking anywhere closes it, and reading continues", async ({ page }) => {
  await book(page).locator('img[alt="diagram"]').click();
  await page.mouse.click(20, 20);
  await expect(lightbox(page)).toBeHidden();
  await page.click("#next");
  await expect(page.locator("#where")).not.toHaveText(/本章 1 \//);
});

test("tiny pictures are not enlarged", async ({ page }) => {
  const dot = book(page).locator('img[alt="test image"]');
  await expect(dot).not.toHaveClass(/er-zoomable/);
  await dot.click();
  await expect(lightbox(page)).toBeHidden();
});

test("pictures in a later chapter can be enlarged too", async ({ page }) => {
  await page.selectOption("#chapters", "2");
  await page.selectOption("#chapters", "0");
  await book(page).locator('img[alt="diagram"]').click();
  await expect(lightbox(page)).toBeVisible();
});
