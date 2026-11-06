// Click-to-enlarge for pictures inside the book.
// Tiny pictures (icons, inline symbols) are not worth enlarging.
export const MIN_ZOOM_SIZE = 64;

export function isZoomable({ naturalWidth = 0, naturalHeight = 0 } = {}) {
  return Math.max(naturalWidth, naturalHeight) >= MIN_ZOOM_SIZE;
}

// Caption: the figure's <figcaption> if there is one, otherwise the picture's alt text.
export function captionFor(el) {
  const cap = el.closest?.("figure")?.querySelector("figcaption")?.textContent?.trim();
  return cap || el.getAttribute?.("alt")?.trim() || "";
}

// Picture address: <img> uses src; an <image> inside SVG uses href (or the older xlink:href).
export function sourceOf(el) {
  if (el.tagName.toLowerCase() === "image") {
    return el.href?.baseVal || el.getAttribute("href") || el.getAttribute("xlink:href") || "";
  }
  return el.currentSrc || el.src || "";
}

// Runs once per book section: mark enlargeable pictures and report clicks on them.
export function enableZoom(doc, onImageClick) {
  const style = doc.createElement("style");
  style.textContent = ".er-zoomable { cursor: zoom-in; }";
  doc.head.appendChild(style);

  const mark = img => { if (isZoomable(img)) img.classList.add("er-zoomable"); };
  doc.querySelectorAll("img").forEach(img =>
    img.complete ? mark(img) : img.addEventListener("load", () => mark(img), { once: true }),
  );
  doc.querySelectorAll("svg image").forEach(img => img.classList.add("er-zoomable"));

  doc.addEventListener("click", e => {
    const el = e.target.closest?.(".er-zoomable");
    if (!el) return;
    e.preventDefault(); // a picture inside a link should enlarge, not navigate
    e.stopPropagation();
    onImageClick({ src: sourceOf(el), caption: captionFor(el) });
  });
}
