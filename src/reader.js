// Thin wrapper around epub.js: open a book into a container in two-page ("spread") mode.
import ePub, { EpubCFI } from "epubjs";
import { flattenToc, splitHref, sameFile } from "./toc.js";
import { enableZoom } from "./zoom.js";

const OPEN_TIMEOUT_MS = 20_000;
const CHARS_PER_LOCATION = 1600; // granularity of the whole-book progress bar

// An EPUB is a ZIP file, which always starts with "PK\x03\x04".
export function looksLikeEpub(data) {
  const b = new Uint8Array(data, 0, Math.min(4, data.byteLength));
  return b.length === 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => (timer = setTimeout(() => reject(new Error(message)), ms))),
  ]).finally(() => clearTimeout(timer));
}

const cfi = new EpubCFI();

export async function openBook(container, data, { onRelocated, onImageClick, onKeydown, onLinkFollowed } = {}) {
  if (!looksLikeEpub(data)) throw new Error("这不是有效的 EPUB 文件");
  const book = ePub(data);
  // epub.js never settles on some broken files, so give up after a while instead of hanging
  await withTimeout(book.ready, OPEN_TIMEOUT_MS, "文件内容损坏，或者不是标准的 EPUB");
  const rendition = book.renderTo(container, {
    width: "100%",
    height: "100%",
    flow: "paginated",
    spread: "auto",       // two pages side by side when the viewer is wide enough
    minSpreadWidth: 800,  // narrower than this → single page
    allowScriptedContent: false,
  });

  let lastLocation = null;
  rendition.on("relocated", loc => {
    lastLocation = loc;
    onRelocated?.(loc);
  });
  // keys pressed while the book page (an iframe) has focus never reach the main page, so listen there too
  if (onKeydown) rendition.on("keydown", onKeydown);
  rendition.hooks.content.register(contents => {
    if (onImageClick) enableZoom(contents.document, onImageClick);
    // remember where we were before following a link (footnote, cross-reference) so we can go back
    contents.on("linkClicked", () => {
      if (lastLocation) onLinkFollowed?.(lastLocation.start.cfi);
    });
  });

  await rendition.display();
  const [nav, meta] = await Promise.all([book.loaded.navigation, book.loaded.metadata]);
  const toc = flattenToc(nav.toc);

  // The TOC entry the reader is in: the last entry whose heading is on screen or before it.
  // (Compared with the END of what is shown: with two pages, a heading in the middle of the screen already counts.)
  function currentTocIndex(loc = lastLocation) {
    const href = loc?.start?.href;
    if (!href) return -1;
    const endCfi = loc.end?.cfi || loc.start.cfi;
    let best = -1;
    for (let i = 0; i < toc.length; i++) {
      const { file, anchor } = splitHref(toc[i].href);
      if (!sameFile(file, href)) continue;
      if (best === -1 || !anchor) { best = i; continue; } // first entry of this file is the fallback
      for (const c of rendition.getContents()) {
        const el = c.document.getElementById(anchor);
        if (el && cfi.compare(c.cfiFromNode(el), endCfi) <= 0) best = i;
      }
    }
    return best;
  }

  // Whole-book percentage needs a pass over the book; do it after the first page is on screen.
  const locationsReady = book.locations.generate(CHARS_PER_LOCATION).then(() => {
    const loc = rendition.currentLocation();
    if (loc?.start) onRelocated?.(loc); // refresh so the current position gets a percentage
  });

  return {
    book,
    rendition,
    meta,
    toc,
    locationsReady,
    currentTocIndex,
    next: () => rendition.next(),
    prev: () => rendition.prev(),
    goto: target => rendition.display(target),
    percentOf: loc => (book.locations.length() ? book.locations.percentageFromCfi(loc.start.cfi) : null),
    gotoPercent: p => rendition.display(book.locations.cfiFromPercentage(Math.min(1, Math.max(0, p)))),
    isSpread: () => rendition._layout?.divisor === 2,
    destroy: () => book.destroy(),
  };
}
