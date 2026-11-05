import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { makeEpub, BOOKS } from "../../scripts/make-test-epubs.mjs";

describe("test EPUB generator", () => {
  for (const key of Object.keys(BOOKS)) {
    it(`${key}: is a valid EPUB container`, async () => {
      const buf = await makeEpub(key);
      // EPUB rule: first file is an uncompressed "mimetype"
      expect(buf.subarray(30, 38).toString()).toBe("mimetype");
      expect(buf.readUInt16LE(8)).toBe(0); // compression method 0 = stored

      const zip = await JSZip.loadAsync(buf);
      const opf = await zip.file("OEBPS/content.opf").async("string");
      expect(opf).toContain(`<dc:language>${BOOKS[key].lang}</dc:language>`);
      expect(zip.file("OEBPS/nav.xhtml")).toBeTruthy();
      expect(zip.file("OEBPS/images/dot.png")).toBeTruthy();
      expect(Object.keys(zip.files).filter(f => /^OEBPS\/text\/ch\d+\.xhtml$/.test(f))).toHaveLength(4);
    });
  }
});
