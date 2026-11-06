// Item 2: turn pages with the keyboard, whether focus is on the page or inside the book.
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

const where = page => page.locator("#where");

test("→ and ← turn pages", async ({ page }) => {
  await expect(where(page)).toHaveText(/本章 1 \//);
  await page.keyboard.press("ArrowRight");
  await expect(where(page)).not.toHaveText(/本章 1 \//);
  await page.keyboard.press("ArrowLeft");
  await expect(where(page)).toHaveText(/本章 1 \//);
});

test("keys still work after clicking inside the book page", async ({ page }) => {
  await book(page).locator("p").nth(3).click();
  await page.keyboard.press("ArrowRight");
  await expect(where(page)).not.toHaveText(/本章 1 \//);
  await page.keyboard.press("PageUp");
  await expect(where(page)).toHaveText(/本章 1 \//);
});

test("keys go through the whole book to the end", async ({ page }) => {
  for (let i = 0; i < 200 && (await where(page).textContent()) !== "读完了"; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(20);
  }
  await expect(where(page)).toHaveText("读完了");
});

test("arrows do not turn pages while a picture is enlarged; Esc closes it", async ({ page }) => {
  await book(page).locator('img[alt="diagram"]').click();
  await expect(page.locator("#lightbox")).toBeVisible();
  const before = await where(page).textContent();
  await page.keyboard.press("ArrowRight");
  await expect(where(page)).toHaveText(before);
  await page.keyboard.press("Escape");
  await expect(page.locator("#lightbox")).toBeHidden();
  await page.keyboard.press("ArrowRight");
  await expect(where(page)).not.toHaveText(before);
});
