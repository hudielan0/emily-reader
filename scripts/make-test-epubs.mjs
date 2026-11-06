// Generate two small, copyright-free EPUB 3 books for tests: tests/fixtures/{zh,en}-sample.epub
// Each has 4 chapters, a nav TOC, one PNG image, a long code line and a wide table.
import JSZip from "jszip";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "tests", "fixtures");

// 8x8 orange PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGPYuqEeK2IYSRIAJYOfAfMEmxEAAAAASUVORK5CYII=",
  "base64",
);

// 800x500 diagram with small text, like the figures in technical books
const DIAGRAM_SVG = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <rect width="800" height="500" fill="#ffffff"/>
  <rect x="40" y="60" width="300" height="140" rx="10" fill="#eef4f4" stroke="#336" stroke-width="3"/>
  <rect x="460" y="60" width="300" height="140" rx="10" fill="#f4eeee" stroke="#633" stroke-width="3"/>
  <line x1="340" y1="130" x2="460" y2="130" stroke="#333" stroke-width="3"/>
  <text x="190" y="140" font-size="22" text-anchor="middle" font-family="sans-serif">Box A small text</text>
  <text x="610" y="140" font-size="22" text-anchor="middle" font-family="sans-serif">Box B small text</text>
  <text x="400" y="400" font-size="18" text-anchor="middle" font-family="sans-serif">test diagram</text>
</svg>`;

const ZH_PARAS = [
  "清晨的山路上还挂着薄雾，脚下的石阶被露水打湿，踩上去有一点滑。远处偶尔传来几声鸟叫，很快又安静下来。",
  "村口那棵老槐树据说已经有三百多年了。树下摆着两张竹椅，午后总有几位老人坐在那里，看着来往的人。",
  "傍晚时分，山那边的云一层一层地烧起来，先是金色，再是橘红，最后变成一种说不清的紫。",
  "夜里下了一场雨。雨点打在瓦片上，声音密密的，像有人在屋顶上轻轻走路。",
];
const EN_PARAS = [
  "The lighthouse stood at the edge of the island, white paint peeling in long strips where the salt wind had worked at it for years.",
  "The supply boat came on the first Monday of every month. It brought flour, coffee, oil for the lamp, and a small bundle of letters.",
  "On calm nights he sat on the gallery outside the lamp room and watched the beam sweep across the water.",
  "Storms were different. When the wind rose, the whole tower hummed like a struck bell.",
];

export const BOOKS = {
  zh: {
    lang: "zh-CN", title: "测试书：山间小记", author: "测试作者",
    chapters: ["第一章　上山", "第二章　老槐树", "第三章　雨夜", "第四章　告别"], paras: ZH_PARAS,
    figure: "图 1-1 测试示意图",
    sections: ["1.1 清晨", "1.2 午后"],
    note: "注释：这是一个测试脚注。", noteRef: "这一段带有脚注",
  },
  en: {
    lang: "en", title: "Test Book: The Lighthouse", author: "Test Author",
    chapters: ["Chapter 1 The Island", "Chapter 2 Letters", "Chapter 3 The Storm", "Chapter 4 Goodbye"], paras: EN_PARAS,
    figure: "Figure 1-1 Test diagram",
    sections: ["1.1 Morning", "1.2 Afternoon"],
    note: "Note: this is a test footnote.", noteRef: "This paragraph has a footnote",
  },
};

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function chapterXhtml(book, i) {
  const body = [];
  body.push(`<h1>${esc(book.chapters[i])}</h1>`);
  for (let k = 0; k < 30; k++) body.push(`<p>${esc(book.paras[(i + k) % book.paras.length])}</p>`);
  if (i === 0) {
    body.splice(3, 0, `<p><img src="../images/dot.png" alt="test image" style="width:120px"/></p>`);
    body.splice(2, 0, `<figure><img src="../images/diagram.svg" alt="diagram" style="width:100%"/><figcaption>${esc(book.figure)}</figcaption></figure>`);
    // two sub-sections far enough apart to land on different pages
    body.splice(12, 0, `<h2 id="s1-1">${esc(book.sections[0])}</h2>`);
    body.splice(26, 0, `<h2 id="s1-2">${esc(book.sections[1])}</h2>`);
  }
  if (i === 1) {
    body.splice(4, 0, `<pre><code>const veryLongLine = "${"x".repeat(160)}"; // long code line</code></pre>`);
    const cells = n => Array.from({ length: 8 }, (_, c) => `<${n}>column-${c + 1}-content</${n}>`).join("");
    body.splice(6, 0, `<table><tr>${cells("th")}</tr><tr>${cells("td")}</tr></table>`);
    // footnote reference near the start, footnote at the end of the chapter (like pandoc does)
    body.splice(2, 0, `<p id="noteref-para">${esc(book.noteRef)}<a href="#fn1" class="footnote-ref" id="fnref1" epub:type="noteref" role="doc-noteref"><sup>1</sup></a></p>`);
    body.push(`<aside epub:type="footnote" role="doc-footnote" id="fn1"><p>${esc(book.note)}</p></aside>`);
  }
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${book.lang}" lang="${book.lang}">
<head><title>${esc(book.chapters[i])}</title></head>
<body>
${body.join("\n")}
</body>
</html>`;
}

export async function makeEpub(key) {
  const book = BOOKS[key];
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);
  const items = book.chapters.map((_, i) => `<item id="ch${i + 1}" href="text/ch${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join("\n    ");
  const spine = book.chapters.map((_, i) => `<itemref idref="ch${i + 1}"/>`).join("");
  zip.file("OEBPS/content.opf", `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:emily-reader:test:${key}</dc:identifier>
    <dc:title>${esc(book.title)}</dc:title>
    <dc:creator>${esc(book.author)}</dc:creator>
    <dc:language>${book.lang}</dc:language>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="img" href="images/dot.png" media-type="image/png"/>
    <item id="diagram" href="images/diagram.svg" media-type="image/svg+xml"/>
    ${items}
  </manifest>
  <spine>${spine}</spine>
</package>`);
  const sub = i => (i === 0
    ? `<ol>${book.sections.map((t, k) => `<li><a href="text/ch1.xhtml#s1-${k + 1}">${esc(t)}</a></li>`).join("")}</ol>`
    : "");
  const navList = book.chapters.map((t, i) => `<li><a href="text/ch${i + 1}.xhtml">${esc(t)}</a>${sub(i)}</li>`).join("");
  zip.file("OEBPS/nav.xhtml", `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>TOC</title></head>
<body><nav epub:type="toc"><ol>${navList}</ol></nav></body>
</html>`);
  zip.file("OEBPS/images/dot.png", PNG);
  zip.file("OEBPS/images/diagram.svg", DIAGRAM_SVG);
  book.chapters.forEach((_, i) => zip.file(`OEBPS/text/ch${i + 1}.xhtml`, chapterXhtml(book, i)));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", mimeType: "application/epub+zip" });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(outDir, { recursive: true });
  for (const key of Object.keys(BOOKS)) {
    const file = join(outDir, `${key}-sample.epub`);
    writeFileSync(file, await makeEpub(key));
    console.log("wrote", file);
  }
}
