// Item 5: font size, font, light/dark, Chinese typography; settings survive reopening.
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const fixture = name => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const book = page => page.frameLocator("#viewer iframe").first();

let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
});
test.afterEach(() => expect(errors, "page should not throw").toEqual([]));

async function choose(page, name) {
  const input = (await page.locator("#empty").isVisible()) ? "#empty [data-file]" : "#reading [data-file]";
  await page.evaluate(() => (window.__reader = null));
  await page.setInputFiles(input, fixture(name));
  await page.waitForFunction(() => window.__reader);
}
async function reopen(page) {
  await page.reload();
  await page.waitForFunction(() => window.__reader, null, { timeout: 15_000 });
}
const style = (page, sel, prop) => book(page).locator(sel).first().evaluate((el, p) => getComputedStyle(el)[p], prop);
const px = s => parseFloat(s);

test("font size: A+ makes text bigger, A− smaller, within limits; the page keeps its place", async ({ page }) => {
  await choose(page, "zh-sample.epub");
  await page.click("#toc-btn");
  await page.locator("#toc-list .lbl", { hasText: "第三章　雨夜" }).click();
  await page.keyboard.press("ArrowRight");
  const base = px(await style(page, "body", "fontSize"));

  await page.click("#look-btn");
  await page.click("#font-up");
  await page.click("#font-up");
  await expect(page.locator("#font-size")).toHaveText("120%");
  await expect.poll(async () => px(await style(page, "body", "fontSize")) / base).toBeCloseTo(1.2, 1);
  await expect(book(page).locator("h1")).toHaveText("第三章　雨夜"); // still in the same chapter

  for (let i = 0; i < 10; i++) await page.click("#font-down", { force: true }).catch(() => {});
  await expect(page.locator("#font-size")).toHaveText("80%");
  await expect(page.locator("#font-down")).toBeDisabled();
});

test("changing font size keeps the same text on screen", async ({ page }) => {
  await choose(page, "zh-sample.epub");
  await page.click("#toc-btn");
  await page.locator("#toc-list .lbl", { hasText: "第二章　老槐树" }).click();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#where")).toContainText("本章 3 /"); // wait until the page turn has finished
  const before = await page.evaluate(() => window.__reader.rendition.currentLocation().start.cfi);
  await page.click("#look-btn");
  await page.click("#font-up");
  await page.click("#font-up");
  await page.waitForTimeout(300);
  const ok = await page.evaluate(c => {
    const r = window.__reader.rendition;
    const loc = r.currentLocation();
    return r.epubcfi.compare(loc.start.cfi, c) <= 0 && r.epubcfi.compare(loc.end.cfi, c) >= 0;
  }, before);
  expect(ok, "text that started the screen is still visible after enlarging").toBe(true);
});

test("dark mode inverts the page but not the pictures, and the font can be switched", async ({ page }) => {
  await choose(page, "zh-sample.epub");
  await page.click("#look-btn");
  await page.click('[data-theme="dark"]');
  await expect(page.locator("body")).toHaveClass(/dark/);
  expect(await page.locator("#viewer iframe").first().evaluate(f => getComputedStyle(f).filter)).toContain("invert");
  expect(await style(page, 'img[alt="diagram"]', "filter")).toContain("invert");
  await expect(page.locator('[data-theme="dark"]')).toHaveAttribute("aria-checked", "true");

  await page.click('[data-font="serif"]');
  await expect.poll(() => style(page, "body", "fontFamily")).toContain("Songti SC");
  await page.click('[data-font="sans"]');
  await expect.poll(() => style(page, "body", "fontFamily")).toContain("PingFang SC");
});

test("acceptance: settings survive closing and reopening, and so does the page", async ({ page }) => {
  await choose(page, "zh-sample.epub");
  await page.click("#toc-btn");
  await page.locator("#toc-list .lbl", { hasText: "第二章　老槐树" }).click();
  await page.click("#look-btn");
  await page.click("#font-up");
  await page.click('[data-theme="dark"]');
  await page.click('[data-font="serif"]');
  await page.keyboard.press("Escape");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => window.__reader.rendition.currentLocation().start.cfi);
  const size = await style(page, "body", "fontSize");

  await reopen(page);

  await expect(page.locator("body")).toHaveClass(/dark/);
  await expect.poll(() => style(page, "body", "fontSize")).toBe(size);
  await expect.poll(() => style(page, "body", "fontFamily")).toContain("Songti SC");
  expect(await page.evaluate(() => window.__reader.rendition.currentLocation().start.cfi)).toBe(before);
  await page.click("#look-btn");
  await expect(page.locator("#font-size")).toHaveText("110%");
});

test("Chinese typography: paragraphs indented 2 characters; English books are not", async ({ page }) => {
  await choose(page, "zh-sample.epub");
  const fs = px(await style(page, "p", "fontSize"));
  expect(px(await style(page, "p", "textIndent"))).toBeCloseTo(2 * fs, 0);
  expect(await style(page, "p", "textAlign")).toBe("start"); // not justify: see look.js
  expect(px(await style(page, "figcaption", "textIndent"))).toBe(0);

  await choose(page, "en-sample.epub");
  expect(px(await style(page, "p", "textIndent"))).toBe(0);
});

test("the system dark setting does not change the book page; only our switch does", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await choose(page, "zh-sample.epub");
  // the book's own dark style (light text on black) must not kick in
  const color = await style(page, "body", "color");
  expect(color).toBe("rgb(31, 35, 40)");
  // the book says "color-scheme: light dark"; the browser must not paint the page black
  expect(await book(page).locator("html").evaluate(el => getComputedStyle(el).colorScheme)).toBe("light only");
  await expect(page.locator("body")).not.toHaveClass(/dark/);
});

test("Esc closes the settings panel; arrows don't turn pages while it is open", async ({ page }) => {
  await choose(page, "zh-sample.epub");
  await page.click("#look-btn");
  const where = await page.locator("#where").textContent();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#where")).toHaveText(where);
  await page.keyboard.press("Escape");
  await expect(page.locator("#look")).toBeHidden();
});
