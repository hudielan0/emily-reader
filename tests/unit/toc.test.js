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

import { splitHref, sameFile, ancestorsOf, visibleEntries, hasChildren } from "../../src/toc.js";

describe("splitHref / sameFile", () => {
  it("splits file and decodes Chinese anchors", () => {
    expect(splitHref("text/ch001.xhtml#%E5%BC%95%E8%A8%80")).toEqual({ file: "text/ch001.xhtml", anchor: "引言" });
    expect(splitHref("text/ch2.xhtml")).toEqual({ file: "text/ch2.xhtml", anchor: "" });
  });
  it("matches hrefs written relative to different folders", () => {
    expect(sameFile("text/ch1.xhtml", "OEBPS/text/ch1.xhtml")).toBe(true);
    expect(sameFile("text/ch1.xhtml#a", "text/ch1.xhtml")).toBe(true);
    expect(sameFile("text/ch1.xhtml", "text/ch11.xhtml")).toBe(false);
    expect(sameFile("", "text/ch1.xhtml")).toBe(false);
  });
});

describe("TOC folding", () => {
  const toc = [
    { label: "第一章", depth: 0 }, // 0
    { label: "1.1", depth: 1 },    // 1
    { label: "1.1.1", depth: 2 },  // 2
    { label: "1.2", depth: 1 },    // 3
    { label: "第二章", depth: 0 }, // 4
  ];
  it("finds ancestors", () => {
    expect(ancestorsOf(toc, 2)).toEqual([1, 0]);
    expect(ancestorsOf(toc, 3)).toEqual([0]);
    expect(ancestorsOf(toc, 4)).toEqual([]);
  });
  it("knows which entries have children", () => {
    expect([0, 1, 2, 3, 4].map(i => hasChildren(toc, i))).toEqual([true, true, false, false, false]);
  });
  it("shows only chapters when nothing is expanded, and nested levels when their parents are", () => {
    expect(visibleEntries(toc, new Set())).toEqual([0, 4]);
    expect(visibleEntries(toc, new Set([0]))).toEqual([0, 1, 3, 4]);
    expect(visibleEntries(toc, new Set([0, 1]))).toEqual([0, 1, 2, 3, 4]);
    expect(visibleEntries(toc, new Set([1]))).toEqual([0, 4]); // child open but parent closed
  });
});
