import { openBook } from "./reader.js";
import { pageKey } from "./keys.js";
import { createTocPanel } from "./ui/toc-panel.js";

const $ = id => document.getElementById(id);
let reader = null;
let lastLoc = null;
let dragging = false; // user is dragging the progress bar
let backTo = null;    // where to return after following a footnote or cross-reference

function showError(msg) {
  const el = $("error");
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => (el.hidden = true), 6000);
}

/* ---------- position display ---------- */

function updateWhere(loc) {
  lastLoc = loc;
  const d = loc?.start?.displayed;
  const pct = reader?.book.locations.length() ? loc.start.percentage : null;
  const idx = reader?.currentTocIndex(loc) ?? -1;
  const label = idx >= 0 ? reader.toc[idx].label : "";
  const parts = [];
  if (label) parts.push(label);
  if (d) parts.push(`本章 ${d.page} / ${d.total}`);
  if (pct != null) parts.push(`全书 ${Math.round(pct * 100)}%`);
  $("where").textContent = loc?.atEnd ? "读完了" : parts.join(" · ");
  $("where").title = label;
  if (pct != null && !dragging) $("progress").value = String(Math.round(pct * 1000));
}

function enableProgress() {
  const bar = $("progress");
  bar.disabled = false;
  bar.title = "拖动跳到全书任意位置";
}

/* ---------- table of contents ---------- */

const tocPanel = createTocPanel({
  panel: $("toc"),
  list: $("toc-list"),
  onPick: entry => {
    closePanels();
    reader?.goto(entry.href);
  },
});

function openToc() {
  if (!reader) return;
  tocPanel.open(reader.currentTocIndex(lastLoc));
  $("scrim").hidden = false;
}

function closePanels() {
  if (tocPanel.isOpen) tocPanel.close();
  $("scrim").hidden = true;
}

/* ---------- footnotes / cross-references: go back ---------- */

function rememberBack(cfi) {
  backTo = cfi;
  $("back").hidden = false;
}

function goBack() {
  if (!backTo || !reader) return;
  reader.goto(backTo);
  backTo = null;
  $("back").hidden = true;
}

/* ---------- enlarged pictures ---------- */

function showImage({ src, caption }) {
  if (!src) return;
  $("lightbox-img").src = src;
  $("lightbox-img").alt = caption;
  $("lightbox-caption").textContent = caption;
  $("lightbox").hidden = false;
  $("lightbox-close").focus(); // take focus out of the book page so Esc reaches us
}

function closeImage() {
  $("lightbox").hidden = true;
  $("lightbox-img").removeAttribute("src");
}

/* ---------- opening a book ---------- */

async function load(file) {
  if (!file) return;
  try {
    const data = await file.arrayBuffer();
    reader?.destroy();
    reader = null;
    lastLoc = null;
    closePanels();
    backTo = null;
    $("back").hidden = true;
    $("progress").disabled = true;
    $("progress").value = "0";
    $("viewer").innerHTML = "";
    $("empty").hidden = true;
    $("reading").hidden = false;
    reader = await openBook($("viewer"), data, {
      onRelocated: updateWhere,
      onImageClick: showImage,
      onKeydown,
      onLinkFollowed: rememberBack,
    });
    document.title = `${reader.meta.title} · Emily阅读`;
    tocPanel.setToc(reader.toc);
    if (lastLoc) updateWhere(lastLoc);
    const opened = reader;
    reader.locationsReady.then(() => opened === reader && enableProgress());
    window.__reader = reader; // for automated tests
  } catch (err) {
    console.error(err);
    reader = null;
    $("reading").hidden = true;
    $("empty").hidden = false;
    showError(`这本书打不开：${err.message || err}`);
  }
}

/* ---------- controls ---------- */

function onKeydown(e) {
  if (!$("lightbox").hidden) {
    if (e.key === "Escape") closeImage();
    return;
  }
  if (tocPanel.isOpen) {
    if (e.key === "Escape") closePanels();
    return;
  }
  const dir = pageKey(e);
  if (!dir || !reader) return;
  e.preventDefault();
  dir === "next" ? reader.next() : reader.prev();
}

document.querySelectorAll("[data-file]").forEach(input =>
  input.addEventListener("change", e => {
    load(e.target.files[0]);
    e.target.value = ""; // allow choosing the same file again
  }),
);
$("prev").addEventListener("click", () => reader?.prev());
$("next").addEventListener("click", () => reader?.next());
$("toc-btn").addEventListener("click", () => (tocPanel.isOpen ? closePanels() : openToc()));
$("toc-close").addEventListener("click", closePanels);
$("scrim").addEventListener("click", closePanels);
$("back").addEventListener("click", goBack);

const bar = $("progress");
bar.addEventListener("input", () => {
  dragging = true;
  $("where").textContent = `跳到 全书 ${Math.round(bar.value / 10)}%`;
});
bar.addEventListener("change", async () => {
  dragging = false;
  if (reader) await reader.gotoPercent(bar.value / 1000);
});

$("lightbox").addEventListener("click", closeImage);
document.addEventListener("keydown", onKeydown);
