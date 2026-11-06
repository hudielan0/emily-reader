// Flatten nested TOC (chapters → sections) into one list with depth for display.
export function flattenToc(items, depth = 0, out = []) {
  for (const it of items || []) {
    out.push({ label: (it.label || "").trim(), href: it.href, depth });
    flattenToc(it.subitems, depth + 1, out);
  }
  return out;
}

// "text/ch1.xhtml#s1-1" → { file: "text/ch1.xhtml", anchor: "s1-1" }; anchors may be URL-encoded (e.g. Chinese ids).
export function splitHref(href = "") {
  const i = href.indexOf("#");
  const file = i < 0 ? href : href.slice(0, i);
  let anchor = i < 0 ? "" : href.slice(i + 1);
  try { anchor = decodeURIComponent(anchor); } catch { /* keep as is */ }
  return { file, anchor };
}

// TOC hrefs and section hrefs can be relative to different folders: compare by the trailing path.
export function sameFile(a = "", b = "") {
  if (!a || !b) return false;
  const x = a.split("#")[0], y = b.split("#")[0];
  return x === y || x.endsWith("/" + y) || y.endsWith("/" + x);
}

// Indices of the entries that contain entry i (its parent chapter, grandparent...).
export function ancestorsOf(toc, i) {
  const out = [];
  let depth = toc[i]?.depth ?? 0;
  for (let k = i - 1; k >= 0 && depth > 0; k--) {
    if (toc[k].depth < depth) { out.push(k); depth = toc[k].depth; }
  }
  return out;
}

export const hasChildren = (toc, i) => (toc[i + 1]?.depth ?? -1) > toc[i].depth;

// Which entries to show: top-level ones always; others only when every ancestor is expanded.
export function visibleEntries(toc, expanded) {
  const out = [];
  for (let i = 0; i < toc.length; i++) {
    if (ancestorsOf(toc, i).every(a => expanded.has(a))) out.push(i);
  }
  return out;
}
