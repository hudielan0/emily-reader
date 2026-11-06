// Table-of-contents panel: chapters always listed, sections fold under them.
import { ancestorsOf, hasChildren, visibleEntries } from "../toc.js";

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function createTocPanel({ panel, list, onPick, onClose }) {
  let toc = [];
  let current = -1;
  const expanded = new Set();

  function render() {
    list.innerHTML = visibleEntries(toc, expanded)
      .map(i => {
        const t = toc[i];
        const kids = hasChildren(toc, i);
        const open = expanded.has(i);
        const toggle = kids
          ? `<button class="tw" data-toggle="${i}" aria-expanded="${open}" title="${open ? "收起" : "展开"}">${open ? "▾" : "▸"}</button>`
          : `<span class="tw"></span>`;
        const cls = [i === current ? "on" : "", ancestorsOf(toc, current).includes(i) ? "in" : ""].join(" ");
        return `<li class="${cls}" style="--depth:${t.depth}">${toggle}<button class="lbl" data-go="${i}">${esc(t.label || "（无标题）")}</button></li>`;
      })
      .join("");
  }

  list.addEventListener("click", e => {
    const tog = e.target.closest("[data-toggle]");
    if (tog) {
      const i = +tog.dataset.toggle;
      expanded.has(i) ? expanded.delete(i) : expanded.add(i);
      render();
      return;
    }
    const go = e.target.closest("[data-go]");
    if (go) onPick(toc[+go.dataset.go], +go.dataset.go);
  });

  return {
    setToc(entries) {
      toc = entries;
      current = -1;
      expanded.clear();
    },
    open(currentIndex) {
      current = currentIndex;
      // unfold the path down to where the reader is, and the current entry's own sections
      for (const a of ancestorsOf(toc, current)) expanded.add(a);
      if (current >= 0 && hasChildren(toc, current)) expanded.add(current);
      render();
      panel.hidden = false;
      const on = list.querySelector("li.on");
      on?.scrollIntoView({ block: "center" });
      (on?.querySelector(".lbl") || list.querySelector(".lbl"))?.focus({ preventScroll: true });
    },
    close() {
      panel.hidden = true;
      onClose?.();
    },
    get isOpen() {
      return !panel.hidden;
    },
  };
}
