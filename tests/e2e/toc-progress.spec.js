// Item 3: table of contents (with folding sections), whole-book progress bar, footnote round trip.
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const fixture = name => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const book = page => page.frameLocator("#viewer iframe").first();
const toc = page => page.locator("#toc");
const entry = (page, text) => page.locator("#toc-list .lbl", { hasText: text });

let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await page.setInputFiles("#empty [data-file]", fixture("zh-sample.epub"));
  await page.waitForFunction(() => window.__reader);
});
test.afterEach(() => expect(errors, "page should not throw").toEqual([]));

test("TOC lists chapters; picking 3 different ones jumps to each", async ({ page }) => {
  for (const title of ["第三章　雨夜", "第二章　老槐树", "第四章　告别"]) {
    await page.click("#toc-btn");
    await expect(toc(page)).toBeVisible();
    await entry(page, title).click();
    await expect(toc(page)).toBeHidden();
    await expect(book(page).locator("h1")).toHaveText(title);
  }
});

test("sections fold under their chapter and can be expanded", async ({ page }) => {
  await page.click("#toc-btn");
  await expect(entry(page, "第一章　上山")).toBeVisible();
  // reader is in chapter 1, so chapter 1 is unfolded
  await expect(entry(page, "1.1 清晨")).toBeVisible();
  await page.click('#toc-list [data-toggle="0"]');
  await expect(entry(page, "1.1 清晨")).toBeHidden();
  await page.click('#toc-list [data-toggle="0"]');
  await entry(page, "1.2 午后").click();
  const heading = book(page).locator("#s1-2");
  await expect(heading).toBeInViewport();
});

test("the current section is highlighted and shown in the dock", async ({ page }) => {
  await page.click("#toc-btn");
  await entry(page, "1.2 午后").click();
  await expect(page.locator("#where")).toContainText("1.2 午后");
  await page.click("#toc-btn");
  await expect(page.locator("#toc-list li.on .lbl")).toHaveText("1.2 午后");
  await expect(page.locator("#toc-list li.in .lbl")).toHaveText("第一章　上山");
});

test("Esc and clicking outside close the TOC", async ({ page }) => {
  await page.click("#toc-btn");
  await page.keyboard.press("Escape");
  await expect(toc(page)).toBeHidden();
  await page.click("#toc-btn");
  await page.mouse.click(1200, 100);
  await expect(toc(page)).toBeHidden();
});

test("progress bar shows the whole-book percentage and jumps when dragged", async ({ page }) => {
  const bar = page.locator("#progress");
  await expect(bar).toBeEnabled({ timeout: 15_000 });
  await expect(page.locator("#where")).toContainText("全书 ");
  await bar.fill("750"); // 75%
  await bar.dispatchEvent("change");
  await expect(book(page).locator("h1")).toHaveText(/第四章|第三章/);
  const pct = await page.evaluate(() => Math.round(window.__reader.rendition.currentLocation().start.percentage * 100));
  expect(pct).toBeGreaterThanOrEqual(65);
  expect(pct).toBeLessThanOrEqual(85);
});

test("footnote: follow the link, then ↩ 返回 comes back to the same page", async ({ page }) => {
  await page.click("#toc-btn");
  await entry(page, "第二章　老槐树").click();
  await expect(book(page).locator("h1")).toHaveText("第二章　老槐树");
  const before = await page.evaluate(() => window.__reader.rendition.currentLocation().start.cfi);
  await book(page).locator("#fnref1").click();
  await expect(book(page).locator("#fn1")).toBeInViewport();
  await expect(page.locator("#back")).toBeVisible();
  await page.click("#back");
  await expect(page.locator("#back")).toBeHidden();
  await expect(book(page).locator("#noteref-para")).toBeInViewport();
  const after = await page.evaluate(() => window.__reader.rendition.currentLocation().start.cfi);
  expect(after).toBe(before);
});
