import { openBook } from "./reader.js";
import { pageKey } from "./keys.js";

const $ = id => document.getElementById(id);
let reader = null;

function showError(msg) {
  const el = $("error");
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => (el.hidden = true), 6000);
}

function updateWhere(loc) {
  const d = loc?.start?.displayed;
  $("where").textContent = d ? `本章 ${d.page} / ${d.total}` : "";
  if (loc?.atEnd) $("where").textContent = "读完了";
  // keep the chapter dropdown in sync with the current position
  const href = loc?.start?.href;
  if (href && reader) {
    const idx = reader.toc.findIndex(t => t.href.split("#")[0].endsWith(href) || href.endsWith(t.href.split("#")[0]));
    if (idx >= 0) $("chapters").value = String(idx);
  }
}

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

async function load(file) {
  if (!file) return;
  try {
    const data = await file.arrayBuffer();
    reader?.destroy();
    $("viewer").innerHTML = "";
    $("empty").hidden = true;
    $("reading").hidden = false;
    reader = await openBook($("viewer"), data, { onRelocated: updateWhere, onImageClick: showImage, onKeydown });
    document.title = `${reader.meta.title} · Emily阅读`;
    $("chapters").innerHTML = reader.toc
      .map((t, i) => `<option value="${i}">${"　".repeat(t.depth)}${t.label.replace(/</g, "&lt;")}</option>`)
      .join("");
    window.__reader = reader; // for automated tests
  } catch (err) {
    console.error(err);
    reader = null;
    $("reading").hidden = true;
    $("empty").hidden = false;
    showError(`这本书打不开：${err.message || err}`);
  }
}

document.querySelectorAll("[data-file]").forEach(input =>
  input.addEventListener("change", e => {
    load(e.target.files[0]);
    e.target.value = ""; // allow choosing the same file again
  }),
);
$("prev").addEventListener("click", () => reader?.prev());
$("next").addEventListener("click", () => reader?.next());
$("chapters").addEventListener("change", e => reader?.goto(reader.toc[+e.target.value].href));
$("lightbox").addEventListener("click", closeImage);
function onKeydown(e) {
  if (!$("lightbox").hidden) {
    if (e.key === "Escape") closeImage();
    return;
  }
  const dir = pageKey(e);
  if (!dir || !reader) return;
  e.preventDefault();
  dir === "next" ? reader.next() : reader.prev();
}
document.addEventListener("keydown", onKeydown);
