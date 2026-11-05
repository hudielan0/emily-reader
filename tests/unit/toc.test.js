import { describe, it, expect } from "vitest";
import { flattenToc } from "../../src/toc.js";

describe("flattenToc", () => {
  it("flattens chapters and sections, keeping depth and order", () => {
    const toc = [
      { label: " 第一章 ", href: "ch1.xhtml", subitems: [{ label: "1.1 节", href: "ch1.xhtml#s1", subitems: [] }] },
      { label: "第二章", href: "ch2.xhtml" },
    ];
    expect(flattenToc(toc)).toEqual([
      { label: "第一章", href: "ch1.xhtml", depth: 0 },
      { label: "1.1 节", href: "ch1.xhtml#s1", depth: 1 },
      { label: "第二章", href: "ch2.xhtml", depth: 0 },
    ]);
  });

  it("handles a missing TOC", () => {
    expect(flattenToc(undefined)).toEqual([]);
  });
});
