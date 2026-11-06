import { openBook } from "./reader.js";
import { pageKey } from "./keys.js";
import { createTocPanel } from "./ui/toc-panel.js";
import { createStore, bookId } from "./storage.js";
import { DEFAULT_LOOK, FONT_SIZE, normalizeLook } from "./look.js";

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
    settle(reader?.goto(entry.href));
  },
});

function openToc() {
  if (!reader) return;
  tocPanel.open(reader.currentTocIndex(lastLoc));
  $("scrim").hidden = false;
}

function closePanels() {
  if (tocPanel.isOpen) tocPanel.close();
  $("look").hidden = true;
  $("scrim").hidden = true;
}

const anyPanelOpen = () => tocPanel.isOpen || !$("look").hidden;

/* ---------- reading settings: font size, font, light/dark ---------- */

let look = { ...DEFAULT_LOOK };

function showLook() {
  $("font-size").textContent = `${look.fontSize}%`;
  $("font-down").disabled = look.fontSize <= FONT_SIZE.min;
  $("font-up").disabled = look.fontSize >= FONT_SIZE.max;
  document.querySelectorAll("[data-font]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.font === look.font)));
  document.querySelectorAll("[data-theme]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.theme === look.theme)));
  document.body.classList.toggle("dark", look.theme === "dark");
}

function openLook() {
  closePanels();
  showLook();
  $("look").hidden = false;
  $("scrim").hidden = false;
  $("look-close").focus();
}

async function changeLook(patch) {
  look = normalizeLook({ ...look, ...patch });
  showLook();
  safe(() => store.setSettings(look));
  if (reader) {
    await reader.setLook(look);
    saveCurrentPosition();
  }
}

/* ---------- footnotes / cross-references: go back ---------- */

function rememberBack(cfi) {
  backTo = cfi;
  $("back").hidden = false;
}

function goBack() {
  if (!backTo || !reader) return;
  settle(reader.goto(backTo));
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

/* ---------- remembering books and positions ---------- */

let store = null;
try {
  store = createStore();
  navigator.storage?.persist?.(); // ask the browser not to clear our data when disk space runs low
} catch (err) {
  console.warn(err);
}
let currentId = null;
let storageWarned = false;

// Storage problems must never stop reading: log, warn once, carry on.
async function safe(fn, fallback = null) {
  if (!store) return fallback;
  try {
    return await fn();
  } catch (err) {
    console.warn("storage:", err);
    if (!storageWarned) {
      storageWarned = true;
      showError("浏览器存储出了问题：这次读到的位置可能记不住");
    }
    return fallback;
  }
}

function savePosition(loc) {
  const id = currentId;
  if (id && loc?.start?.cfi) {
    safe(() => store.savePosition(id, { cfi: loc.start.cfi, percent: loc.start.percentage ?? null }));
  }
}

function onRelocated(loc) {
  updateWhere(loc);
  savePosition(loc);
}

// epub.js reports a new position only on the next animation frame, which can be too late if the page
// is closed right away. So also save as soon as each page turn or jump finishes, and when the page is hidden.
function saveCurrentPosition() {
  try {
    savePosition(reader?.rendition.currentLocation());
  } catch (err) {
    console.warn(err);
  }
}

async function settle(navigation) {
  await navigation;
  saveCurrentPosition();
}

addEventListener("pagehide", saveCurrentPosition);
document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && saveCurrentPosition());

/* ---------- opening a book ---------- */

function resetReadingView() {
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
}

async function openData(data, { id, isNewFile }) {
  resetReadingView();
  currentId = id;
  const [pos, locations] = await Promise.all([safe(() => store.getPosition(id)), safe(() => store.getLocations(id))]);
  reader = await openBook($("viewer"), data, {
    start: pos?.cfi,
    locations,
    onRelocated,
    onImageClick: showImage,
    onKeydown,
    onLinkFollowed: rememberBack,
    look,
  });
  const opened = reader;
  document.title = `${reader.meta.title} · Emily阅读`;
  tocPanel.setToc(reader.toc);
  if (lastLoc) updateWhere(lastLoc);
  reader.locationsReady.then(ok => {
    if (!ok || opened !== reader) return;
    enableProgress();
    if (!opened.locationsFromCache) safe(() => store.saveLocations(id, opened.saveLocations()));
  });
  if (isNewFile) {
    const { title = "", creator = "", language = "" } = reader.meta || {};
    await safe(() => store.saveBook({ id, data, title, author: creator, lang: language }));
  }
  await safe(() => store.setLastBookId(id));
  window.__reader = reader; // for automated tests
}

function showOpenError(err) {
  console.error(err);
  reader = null;
  currentId = null;
  $("reading").hidden = true;
  $("empty").hidden = false;
  showError(`这本书打不开：${err.message || err}`);
}

// A file chosen by the reader: new books are saved; books seen before continue where they were left.
async function load(file) {
  if (!file) return;
  try {
    const data = await file.arrayBuffer();
    await openData(data, { id: await bookId(data), isNewFile: true });
  } catch (err) {
    showOpenError(err);
    restore(); // go back to the book that was open before, if any
  }
}

// On page load: reopen the last book at its saved page, with no action needed.
async function restore() {
  look = normalizeLook(await safe(() => store.getSettings(DEFAULT_LOOK), DEFAULT_LOOK));
  showLook();
  const id = await safe(() => store.getLastBookId());
  const saved = id ? await safe(() => store.getBook(id)) : null;
  if (!saved) {
    $("empty").hidden = false;
    return;
  }
  try {
    await openData(saved.data, { id, isNewFile: false });
  } catch (err) {
    showOpenError(err);
  }
}

/* ---------- controls ---------- */

function onKeydown(e) {
  if (!$("lightbox").hidden) {
    if (e.key === "Escape") closeImage();
    return;
  }
  if (anyPanelOpen()) {
    if (e.key === "Escape") closePanels();
    return;
  }
  const dir = pageKey(e);
  if (!dir || !reader) return;
  e.preventDefault();
  settle(dir === "next" ? reader.next() : reader.prev());
}

document.querySelectorAll("[data-file]").forEach(input =>
  input.addEventListener("change", e => {
    load(e.target.files[0]);
    e.target.value = ""; // allow choosing the same file again
  }),
);
$("prev").addEventListener("click", () => settle(reader?.prev()));
$("next").addEventListener("click", () => settle(reader?.next()));
$("toc-btn").addEventListener("click", () => (tocPanel.isOpen ? closePanels() : (closePanels(), openToc())));
$("look-btn").addEventListener("click", () => ($("look").hidden ? openLook() : closePanels()));
$("look-close").addEventListener("click", closePanels);
$("font-down").addEventListener("click", () => changeLook({ fontSize: look.fontSize - FONT_SIZE.step }));
$("font-up").addEventListener("click", () => changeLook({ fontSize: look.fontSize + FONT_SIZE.step }));
document.querySelectorAll("[data-font]").forEach(b => b.addEventListener("click", () => changeLook({ font: b.dataset.font })));
document.querySelectorAll("[data-theme]").forEach(b => b.addEventListener("click", () => changeLook({ theme: b.dataset.theme })));
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
  if (reader) await settle(reader.gotoPercent(bar.value / 1000));
});

$("lightbox").addEventListener("click", closeImage);
document.addEventListener("keydown", onKeydown);

restore();
