import { describe, it, expect, vi } from "vitest";
vi.mock("epubjs", () => ({ default: () => ({}) })); // epub.js needs a browser; not under test here
const { looksLikeEpub } = await import("../../src/reader.js");

const bytes = arr => new Uint8Array(arr).buffer;

describe("looksLikeEpub", () => {
  it("accepts data starting with the ZIP signature", () => {
    expect(looksLikeEpub(bytes([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]))).toBe(true);
  });
  it("rejects text files and empty files", () => {
    expect(looksLikeEpub(new TextEncoder().encode("this is not an epub").buffer)).toBe(false);
    expect(looksLikeEpub(new ArrayBuffer(0))).toBe(false);
    expect(looksLikeEpub(bytes([0x50, 0x4b]))).toBe(false);
  });
});
