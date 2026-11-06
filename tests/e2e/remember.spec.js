// Item 4: the book and the page are remembered; reopening the page needs no action.
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const fixture = name => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const book = page => page.frameLocator("#viewer iframe").first();
const cfiNow = page => page.evaluate(() => window.__reader.rendition.currentLocation().start.cfi);

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

async function gotoChapter(page, title) {
  await page.click("#toc-btn");
  await page.locator("#toc-list .lbl", { hasText: title }).click();
  await expect(book(page).locator("h1")).toHaveText(title);
}

test("acceptance: read to chapter 3, close and reopen → same page, no action needed", async ({ page }) => {
  await choose(page, "zh-sample.epub");
  await gotoChapter(page, "第三章　雨夜");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#where")).not.toContainText("本章 1 /");
  const before = await cfiNow(page);
  const whereBefore = await page.locator("#where").textContent();

  await reopen(page);

  await expect(page.locator("#empty")).toBeHidden();
  expect(await cfiNow(page)).toBe(before);
  await expect(book(page).locator("h1")).toHaveText("第三章　雨夜");
  await expect(page.locator("#where")).toContainText(whereBefore.match(/本章 \d+ \/ \d+/)[0]);
});

test("position is saved immediately, even when the page is closed right after turning", async ({ page }) => {
  await choose(page, "zh-sample.epub");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
  const before = await cfiNow(page);
  await reopen(page);
  expect(await cfiNow(page)).toBe(before);
});

test("choosing the same file again keeps one copy and continues where it was", async ({ page }) => {
  await choose(page, "zh-sample.epub");
  await gotoChapter(page, "第二章　老槐树");
  const before = await cfiNow(page);
  await choose(page, "zh-sample.epub");
  expect(await cfiNow(page)).toBe(before);
  const count = await page.evaluate(() => new Promise((res, rej) => {
    const r = indexedDB.open("emily-reader");
    r.onsuccess = () => { const c = r.result.transaction("books").objectStore("books").count(); c.onsuccess = () => res(c.result); };
    r.onerror = rej;
  }));
  expect(count).toBe(1);
});

test("each book keeps its own place; reopening shows the last book read", async ({ page }) => {
  await choose(page, "zh-sample.epub");
  await gotoChapter(page, "第三章　雨夜");
  const zhPos = await cfiNow(page);

  await choose(page, "en-sample.epub");
  await expect(book(page).locator("h1")).toHaveText("Chapter 1 The Island"); // new book starts at the beginning
  await gotoChapter(page, "Chapter 2 Letters");
  const enPos = await cfiNow(page);

  await reopen(page);
  await expect(book(page).locator("h1")).toHaveText("Chapter 2 Letters");
  expect(await cfiNow(page)).toBe(enPos);

  await choose(page, "zh-sample.epub");
  expect(await cfiNow(page)).toBe(zhPos);
});

test("the progress table is computed once and reused after reopening", async ({ page }) => {
  await choose(page, "zh-sample.epub");
  await expect(page.locator("#progress")).toBeEnabled({ timeout: 15_000 });
  await page.waitForFunction(() => new Promise(res => {
    const r = indexedDB.open("emily-reader");
    r.onsuccess = () => { const g = r.result.transaction("locations").objectStore("locations").count(); g.onsuccess = () => res(g.result === 1); };
  }));
  await reopen(page);
  expect(await page.evaluate(() => window.__reader.locationsFromCache)).toBe(true);
  await expect(page.locator("#progress")).toBeEnabled();
});

test("a broken file while reading shows an error and returns to the open book", async ({ page }, info) => {
  await choose(page, "zh-sample.epub");
  await gotoChapter(page, "第二章　老槐树");
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync(info.outputDir, { recursive: true });
  const bad = `${info.outputDir}/broken.epub`;
  writeFileSync(bad, "not a book");
  await page.evaluate(() => (window.__reader = null));
  await page.setInputFiles("#reading [data-file]", bad);
  await expect(page.locator("#error")).toContainText("这本书打不开");
  await page.waitForFunction(() => window.__reader);
  await expect(book(page).locator("h1")).toHaveText("第二章　老槐树");
  errors = [];
});

test("switching books quickly, before the progress bar is ready, does not break anything", async ({ page }) => {
  for (const name of ["zh-sample.epub", "en-sample.epub", "zh-sample.epub", "en-sample.epub"]) {
    await choose(page, name); // each switch closes a book that may still be computing its progress table
  }
  await expect(book(page).locator("h1")).toHaveText("Chapter 1 The Island");
  await expect(page.locator("#progress")).toBeEnabled({ timeout: 15_000 });
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#where")).not.toContainText("本章 1 /");
});
