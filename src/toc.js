// Flatten nested TOC (chapters → sections) into one list with depth for display.
export function flattenToc(items, depth = 0, out = []) {
  for (const it of items || []) {
    out.push({ label: (it.label || "").trim(), href: it.href, depth });
    flattenToc(it.subitems, depth + 1, out);
  }
  return out;
}
