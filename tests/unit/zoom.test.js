import { describe, it, expect } from "vitest";
import { isZoomable, captionFor, sourceOf, MIN_ZOOM_SIZE } from "../../src/zoom.js";

describe("isZoomable", () => {
  it("enlarges pictures at least MIN_ZOOM_SIZE on one side", () => {
    expect(isZoomable({ naturalWidth: 800, naturalHeight: 500 })).toBe(true);
    expect(isZoomable({ naturalWidth: 20, naturalHeight: MIN_ZOOM_SIZE })).toBe(true);
  });
  it("skips tiny icons and pictures that have not loaded", () => {
    expect(isZoomable({ naturalWidth: 8, naturalHeight: 8 })).toBe(false);
    expect(isZoomable({ naturalWidth: 0, naturalHeight: 0 })).toBe(false);
    expect(isZoomable()).toBe(false);
  });
});

// Minimal stand-ins for DOM elements
const el = ({ tag = "img", attrs = {}, figcaption, src, href } = {}) => ({
  tagName: tag.toUpperCase(),
  src,
  href,
  getAttribute: name => attrs[name] ?? null,
  closest: sel => (sel === "figure" && figcaption !== undefined
    ? { querySelector: () => (figcaption === null ? null : { textContent: figcaption }) }
    : null),
});

describe("captionFor", () => {
  it("prefers the figure caption", () => {
    expect(captionFor(el({ figcaption: "  图2-3 交互序列 ", attrs: { alt: "alt text" } }))).toBe("图2-3 交互序列");
  });
  it("falls back to alt text, then to nothing", () => {
    expect(captionFor(el({ figcaption: null, attrs: { alt: " 示意图 " } }))).toBe("示意图");
    expect(captionFor(el())).toBe("");
  });
});

describe("sourceOf", () => {
  it("reads src from <img> and href from SVG <image>", () => {
    expect(sourceOf(el({ src: "blob:a" }))).toBe("blob:a");
    expect(sourceOf(el({ tag: "image", href: { baseVal: "blob:b" } }))).toBe("blob:b");
    expect(sourceOf(el({ tag: "image", attrs: { "xlink:href": "blob:c" } }))).toBe("blob:c");
  });
});
