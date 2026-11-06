// How the book page looks: font size, font, light/dark, Chinese typography.
export const DEFAULT_LOOK = { fontSize: 100, font: "sans", theme: "light" };
export const FONT_SIZE = { min: 80, max: 160, step: 10 };

const FONTS = {
  sans: '-apple-system, "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif',
  serif: '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", Georgia, "Times New Roman", serif',
};

export const isChinese = (lang = "") => /^zh\b/i.test(String(lang).trim());

export function clampFontSize(n) {
  const v = Math.round(Number(n) / FONT_SIZE.step) * FONT_SIZE.step;
  return Math.min(FONT_SIZE.max, Math.max(FONT_SIZE.min, Number.isFinite(v) ? v : DEFAULT_LOOK.fontSize));
}

// Saved settings may be old or hand-edited: keep only known values.
export function normalizeLook(look = {}) {
  return {
    fontSize: clampFontSize(look.fontSize ?? DEFAULT_LOOK.fontSize),
    font: look.font in FONTS ? look.font : DEFAULT_LOOK.font,
    theme: look.theme === "dark" ? "dark" : "light",
  };
}

// CSS injected into every book page. !important because books ship their own styles.
export function lookCss(look, lang) {
  const { font, theme } = normalizeLook(look);
  const rules = [
    // Books may declare "color-scheme: light dark", which makes the browser paint a black page with white
    // text when the computer is in dark mode. Light/dark is our switch's job, so the page is always light.
    ":root { color-scheme: light only !important; }",
    // the page itself shows the paper colour behind the book
    "html, body { background: transparent !important; }",
    `body { font-family: ${FONTS[font]} !important; }`,
  ];
  if (isChinese(lang)) {
    rules.push(
      "body { line-height: 1.85 !important; }",
      // body-text paragraphs: indent 2 characters; not inside lists, tables, quotes, notes, figures.
      // No justify: in a ~25-character column, an unbreakable English word or code name at the start of the
      // next line forces the Chinese characters of this line to spread far apart.
      "p { text-indent: 2em !important; text-align: start !important; }",
      "li p, td p, th p, blockquote p, aside p, figure p, figcaption, nav p, p:has(> img:only-child), p:has(> math:only-child) { text-indent: 0 !important; }",
    );
  }
  if (theme === "dark") {
    // the whole page is colour-inverted from outside; invert pictures back so they look normal
    rules.push("img, svg, video, picture, canvas { filter: invert(1) hue-rotate(180deg) !important; }");
  }
  return rules.join("\n");
}

// Some books carry their own dark style that follows the computer's dark mode. Light/dark must be
// decided only by our switch, so remove those rules from the book's stylesheets.
const SYSTEM_DARK = /prefers-color-scheme\s*:\s*dark/i;

export function stripSystemDarkRules(rules) {
  let removed = 0;
  for (let i = rules.cssRules.length - 1; i >= 0; i--) {
    const rule = rules.cssRules[i];
    if (rule.media && SYSTEM_DARK.test(rule.conditionText ?? rule.media.mediaText ?? "")) {
      rules.deleteRule(i);
      removed++;
    } else if (rule.cssRules) {
      removed += stripSystemDarkRules(rule); // e.g. inside @supports
    }
  }
  return removed;
}

export function stripSystemDark(doc) {
  const strip = sheet => {
    try {
      stripSystemDarkRules(sheet);
    } catch (err) {
      console.warn("cannot read a book stylesheet", err); // cross-origin sheets cannot be edited
    }
  };
  for (const sheet of doc.styleSheets) strip(sheet);
  // stylesheets that are still loading
  for (const link of doc.querySelectorAll('link[rel~="stylesheet"]')) {
    if (!link.sheet) link.addEventListener("load", () => link.sheet && strip(link.sheet), { once: true });
  }
}
