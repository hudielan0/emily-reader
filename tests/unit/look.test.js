import { describe, it, expect } from "vitest";
import { lookCss, normalizeLook, clampFontSize, isChinese, DEFAULT_LOOK } from "../../src/look.js";

describe("normalizeLook", () => {
  it("fills defaults and drops unknown values", () => {
    expect(normalizeLook()).toEqual(DEFAULT_LOOK);
    expect(normalizeLook({ fontSize: 120, font: "serif", theme: "dark" })).toEqual({ fontSize: 120, font: "serif", theme: "dark" });
    expect(normalizeLook({ fontSize: "abc", font: "comic", theme: "purple" })).toEqual(DEFAULT_LOOK);
  });
  it("keeps font size within range and on the 10% steps", () => {
    expect(clampFontSize(500)).toBe(160);
    expect(clampFontSize(10)).toBe(80);
    expect(clampFontSize(113)).toBe(110);
  });
});

describe("isChinese", () => {
  it("recognises zh language tags", () => {
    expect(["zh", "zh-CN", "ZH-tw", " zh-Hans "].every(isChinese)).toBe(true);
    expect(["en", "", undefined, "zhx"].some(isChinese)).toBe(false);
  });
});

describe("lookCss", () => {
  it("Chinese books get indent, justify and wider lines; English books do not", () => {
    const zh = lookCss(DEFAULT_LOOK, "zh-CN");
    expect(zh).toContain("text-indent: 2em");
    expect(zh).toContain("line-height: 1.85");
    const en = lookCss(DEFAULT_LOOK, "en");
    expect(en).not.toContain("text-indent: 2em");
  });
  it("always forces a light colour scheme inside the book page", () => {
    expect(lookCss({ theme: "dark" }, "en")).toContain("color-scheme: light only !important");
  });
  it("uses the chosen font", () => {
    expect(lookCss({ font: "serif" }, "zh")).toContain('"Songti SC"');
    expect(lookCss({ font: "sans" }, "zh")).toContain('"PingFang SC"');
  });
  it("dark mode re-inverts pictures only in dark", () => {
    expect(lookCss({ theme: "dark" }, "zh")).toMatch(/img[^{]*\{ filter: invert\(1\)/);
    expect(lookCss({ theme: "light" }, "zh")).not.toContain("invert");
  });
});

import { stripSystemDarkRules } from "../../src/look.js";

// Minimal stand-in for a CSSStyleSheet / grouping rule
const sheet = rules => ({
  cssRules: rules,
  deleteRule(i) { this.cssRules.splice(i, 1); },
});

describe("stripSystemDarkRules", () => {
  it("removes dark-mode media blocks, including nested ones, and keeps everything else", () => {
    const nested = sheet([{ media: {}, conditionText: "(prefers-color-scheme: dark)" }, { selectorText: "p" }]);
    const s = sheet([
      { selectorText: "body" },
      { media: {}, conditionText: "(prefers-color-scheme: dark)" },
      { media: {}, conditionText: "(prefers-color-scheme:light)" },
      { media: {}, conditionText: "(max-width: 600px)" },
      Object.assign(nested, { conditionText: "(display: grid)" }),
    ]);
    expect(stripSystemDarkRules(s)).toBe(2);
    expect(s.cssRules.map(r => r.selectorText || r.conditionText)).toEqual(["body", "(prefers-color-scheme:light)", "(max-width: 600px)", "(display: grid)"]);
    expect(nested.cssRules).toEqual([{ selectorText: "p" }]);
  });
});
