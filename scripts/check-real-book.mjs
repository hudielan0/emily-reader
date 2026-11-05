// Check how a real EPUB lays out in the reader: code blocks, tables, math, images, footnotes.
// Measures every section in two-page (spread) and single-page mode, saves screenshots.
// Usage: npm run check:book -- <book.epub> <output-dir>
// The book and screenshots stay outside the repo (copyright).
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [bookPath, outDir] = process.argv.slice(2).map(p => p && resolve(p));
if (!bookPath || !outDir) {
  console.error("usage: npm run check:book -- <book.epub> <output-dir>");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const server = await createServer({ logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on("pageerror", e => pageErrors.push(e.message));

try {
  await page.goto("http://127.0.0.1:8766/");
  await page.setInputFiles("#empty [data-file]", bookPath);
  await page.waitForFunction(() => window.__reader, null, { timeout: 60_000 });

  // Runs inside the page: measure one section's content against the page (column) width.
  const measure = () => page.evaluate(async () => {
    const r = window.__reader.rendition;
    const col = r._layout.columnWidth;
    const out = { col: Math.round(col), first: {}, pre: 0, preOver: 0, table: 0, tableOver: 0, math: 0, mathOver: 0, mathBlank: 0, img: 0, imgBroken: 0, noteref: 0, worst: {} };
    for (const c of r.getContents()) {
      const doc = c.document;
      // A block split across pages has one rect per page; it is too wide only if one of those pieces is.
      const wide = el => Math.max(0, ...Array.from(el.getClientRects(), r => r.width));
      const track = (kind, el) => {
        const w = wide(el);
        if (w > col + 1) {
          out[kind + "Over"]++;
          if (!out.worst[kind] || w > out.worst[kind].w) out.worst[kind] = { w: Math.round(w), cfi: c.cfiFromNode(el) };
        }
      };
      doc.querySelectorAll("pre").forEach(el => { out.pre++; track("pre", el); });
      doc.querySelectorAll("table, math[display=block], figure img, p > img").forEach(el => { const k = el.tagName.toLowerCase(); if (!out.first[k]) out.first[k] = c.cfiFromNode(el); });
      doc.querySelectorAll("table").forEach(el => { out.table++; track("table", el); });
      doc.querySelectorAll("math").forEach(el => {
        out.math++; track("math", el);
        if (el.getBoundingClientRect().width === 0) out.mathBlank++;
      });
      for (const img of doc.querySelectorAll("img")) {
        out.img++;
        if (!img.complete) await new Promise(res => { img.onload = img.onerror = res; setTimeout(res, 3000); });
        if (!(img.naturalWidth > 0)) out.imgBroken++;
      }
      out.noteref += doc.querySelectorAll('a[epub\\:type~="noteref"], a[role="doc-noteref"], a.footnote-ref').length;
    }
    return out;
  });

  const spine = await page.evaluate(() => window.__reader.book.spine.spineItems.filter(s => s.linear).map(s => s.href));
  const toc = await page.evaluate(() => window.__reader.toc.map(t => t.depth));
  const report = { book: bookPath.split("/").pop(), sections: spine.length, tocChapters: toc.filter(d => d === 0).length, tocTotal: toc.length, modes: {} };
  const shots = [];

  for (const mode of ["auto", "none"]) {
    await page.evaluate(m => window.__reader.rendition.spread(m), mode);
    await page.waitForTimeout(300);
    const total = { pre: 0, preOver: 0, table: 0, tableOver: 0, math: 0, mathOver: 0, mathBlank: 0, img: 0, imgBroken: 0, noteref: 0 };
    const worst = {};
    let col = 0;
    const first = {};
    for (const href of spine) {
      await page.evaluate(h => window.__reader.goto(h), href);
      await page.waitForTimeout(250);
      const m = await measure();
      col = m.col;
      for (const k of Object.keys(total)) total[k] += m[k];
      for (const [k, v] of Object.entries(m.first)) if (!first[k]) first[k] = v;
      for (const [k, v] of Object.entries(m.worst)) if (!worst[k] || v.w > worst[k].w) worst[k] = v;
    }
    report.modes[mode === "auto" ? "twoPage" : "singlePage"] = { pageWidth: col, ...total, widest: Object.fromEntries(Object.entries(worst).map(([k, v]) => [k, v.w])) };

    if (mode === "auto") for (const [kind, cfi] of Object.entries(first)) {
      await page.evaluate(c => window.__reader.goto(c), cfi);
      await page.waitForTimeout(400);
      const file = `two-first-${kind}.png`;
      await page.screenshot({ path: join(outDir, file) });
      shots.push(file);
    }
    // Screenshot the widest code block / table / formula in this mode
    for (const [kind, v] of Object.entries(worst)) {
      await page.evaluate(cfi => window.__reader.goto(cfi), v.cfi);
      await page.waitForTimeout(400);
      const file = `${mode === "auto" ? "two" : "single"}-widest-${kind}.png`;
      await page.screenshot({ path: join(outDir, file) });
      shots.push(file);
    }
  }
  // A first look at the opening pages in two-page mode
  await page.evaluate(() => window.__reader.rendition.spread("auto"));
  await page.evaluate(h => window.__reader.goto(h), spine[Math.min(2, spine.length - 1)]);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, "two-chapter-start.png") });
  shots.push("two-chapter-start.png");

  report.pageErrors = [...new Set(pageErrors)];
  report.screenshots = shots;
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await server.close();
}
