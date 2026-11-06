// Keyboard page turning. Returns "next", "prev" or null for a keydown event.
const NEXT = new Set(["ArrowRight", "PageDown"]);
const PREV = new Set(["ArrowLeft", "PageUp"]);

export function pageKey(e) {
  if (e.altKey || e.ctrlKey || e.metaKey) return null; // leave browser shortcuts alone
  const t = e.target;
  if (t?.matches?.("input, select, textarea, [contenteditable], [contenteditable] *")) return null;
  if (NEXT.has(e.key)) return "next";
  if (PREV.has(e.key)) return "prev";
  return null;
}
