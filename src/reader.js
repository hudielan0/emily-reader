// Thin wrapper around epub.js: open a book into a container in two-page ("spread") mode.
import ePub from "epubjs";
import { flattenToc } from "./toc.js";
import { enableZoom } from "./zoom.js";

const OPEN_TIMEOUT_MS = 20_000;

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

export async function openBook(container, data, { onRelocated, onImageClick, onKeydown } = {}) {
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
  if (onRelocated) rendition.on("relocated", onRelocated);
  // keys pressed while the book page (an iframe) has focus never reach the main page, so listen there too
  if (onKeydown) rendition.on("keydown", onKeydown);
  if (onImageClick) rendition.hooks.content.register(contents => enableZoom(contents.document, onImageClick));
  await rendition.display();
  const [nav, meta] = await Promise.all([book.loaded.navigation, book.loaded.metadata]);

  return {
    book,
    rendition,
    meta,
    toc: flattenToc(nav.toc),
    next: () => rendition.next(),
    prev: () => rendition.prev(),
    goto: target => rendition.display(target),
    isSpread: () => rendition._layout?.divisor === 2,
    destroy: () => book.destroy(),
  };
}
