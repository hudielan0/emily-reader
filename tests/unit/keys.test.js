import { describe, it, expect } from "vitest";
import { pageKey } from "../../src/keys.js";

const ev = (key, extra = {}) => ({ key, target: { matches: () => false }, ...extra });

describe("pageKey", () => {
  it("maps arrows and page keys", () => {
    expect(pageKey(ev("ArrowRight"))).toBe("next");
    expect(pageKey(ev("PageDown"))).toBe("next");
    expect(pageKey(ev("ArrowLeft"))).toBe("prev");
    expect(pageKey(ev("PageUp"))).toBe("prev");
  });
  it("ignores other keys and browser shortcuts", () => {
    expect(pageKey(ev("a"))).toBe(null);
    expect(pageKey(ev("ArrowRight", { metaKey: true }))).toBe(null);
    expect(pageKey(ev("ArrowLeft", { altKey: true }))).toBe(null);
  });
  it("ignores keys typed into form controls", () => {
    expect(pageKey(ev("ArrowRight", { target: { matches: () => true } }))).toBe(null);
  });
});
