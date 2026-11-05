// M1: open an EPUB, show it as a two-page spread, turn pages, jump chapters.
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const fixture = name => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const book = page => page.frameLocator("#viewer iframe").first();

let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
});
test.afterEach(() => expect(errors, "page should not throw").toEqual([]));

async function open(page, name, inputSel = "#empty [data-file]") {
  await page.setInputFiles(inputSel, fixture(name));
  await page.waitForFunction(() => window.__reader);
}

test("first visit shows the empty screen", async ({ page }) => {
  await expect(page.locator("#empty")).toBeVisible();
  await expect(page.locator("#reading")).toBeHidden();
});

test("opens a Chinese EPUB as a two-page spread with text and image", async ({ page }) => {
  await open(page, "zh-sample.epub");
  await expect(book(page).locator("h1")).toHaveText("第一章　上山");
  await expect(book(page).locator("p").first()).toContainText("清晨的山路");
  expect(await page.evaluate(() => window.__reader.isSpread())).toBe(true);
  await expect(page).toHaveTitle(/测试书：山间小记/);
  const imgOk = await book(page).locator("img").evaluate(img => img.complete && img.naturalWidth > 0);
  expect(imgOk).toBe(true);
});

test("next/prev buttons turn pages and reach the end", async ({ page }) => {
  await open(page, "zh-sample.epub");
  const where = page.locator("#where");
  await expect(where).toHaveText(/本章 1 \//);
  await page.click("#next");
  await expect(where).not.toHaveText(/本章 1 \//);
  await page.click("#prev");
  await expect(where).toHaveText(/本章 1 \//);

  for (let i = 0; i < 200 && (await where.textContent()) !== "读完了"; i++) {
    await page.click("#next");
    await page.waitForTimeout(30);
  }
  await expect(where).toHaveText("读完了");
});

test("chapter dropdown jumps to the chosen chapter", async ({ page }) => {
  await open(page, "zh-sample.epub");
  await expect(page.locator("#chapters option")).toHaveCount(4);
  for (const [i, title] of [[2, "第三章　雨夜"], [1, "第二章　老槐树"], [3, "第四章　告别"]]) {
    await page.selectOption("#chapters", String(i));
    await expect(book(page).locator("h1")).toHaveText(title);
  }
});

test("switching to an English book via 换书", async ({ page }) => {
  await open(page, "zh-sample.epub");
  await page.evaluate(() => (window.__reader = null));
  await open(page, "en-sample.epub", "#reading [data-file]");
  await expect(book(page).locator("h1")).toHaveText("Chapter 1 The Island");
  await expect(page.locator("#chapters option").first()).toHaveText("Chapter 1 The Island");
});

test("narrow window shows a single page", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await open(page, "zh-sample.epub");
  expect(await page.evaluate(() => window.__reader.isSpread())).toBe(false);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("a broken file shows an error and keeps the empty screen", async ({ page }, info) => {
  const bad = join(info.outputDir, "broken.epub");
  mkdirSync(info.outputDir, { recursive: true });
  writeFileSync(bad, "this is not an epub");
  await page.setInputFiles("#empty [data-file]", bad);
  await expect(page.locator("#error")).toContainText("这本书打不开");
  await expect(page.locator("#empty")).toBeVisible();
  errors = []; // the failed open is expected
});

test("a ZIP that is not an EPUB times out with an error instead of hanging", async ({ page }, info) => {
  test.setTimeout(60_000);
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  zip.file("hello.txt", "not a book");
  const bad = join(info.outputDir, "not-a-book.epub");
  mkdirSync(info.outputDir, { recursive: true });
  writeFileSync(bad, await zip.generateAsync({ type: "nodebuffer" }));
  await page.setInputFiles("#empty [data-file]", bad);
  await expect(page.locator("#error")).toContainText("这本书打不开", { timeout: 25_000 });
  await expect(page.locator("#empty")).toBeVisible();
  errors = [];
});
