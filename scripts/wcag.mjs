/**
 * wcag.mjs
 *
 * Colour-contrast maths from the Web Content Accessibility Guidelines (WCAG) 2.x,
 * plus a small reader for the colour tokens in the stylesheet.
 * Pure functions, no libraries. Used by the tests to prove the site's colours
 * are readable (text needs at least 4.5:1, interface parts at least 3:1).
 */

/**
 * Converts "#rrggbb" to [r, g, b] (0-255).
 * @param {string} hex
 * @returns {[number, number, number]}
 * @throws {TypeError} when the value is not a 6-digit hex colour.
 */
export function parseHex(hex) {
  if (typeof hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new TypeError(`Expected a 6-digit hex colour like #1a2b3c, got: ${String(hex)}`);
  }
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/**
 * Relative luminance (how bright a colour looks), 0 (black) to 1 (white).
 * @param {string} hex
 * @returns {number}
 */
export function relativeLuminance(hex) {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Contrast ratio between two colours, from 1 (same) to 21 (black on white).
 * @param {string} foreground
 * @param {string} background
 * @returns {number}
 */
export function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Reads "--token: #rrggbb;" lines from a block of CSS.
 * @param {string} cssBlock
 * @returns {Record<string, string>} token name (without "--") -> hex colour.
 */
export function parseColorTokens(cssBlock) {
  if (typeof cssBlock !== "string") {
    throw new TypeError("parseColorTokens expects a string.");
  }
  const tokens = {};
  for (const match of cssBlock.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[match[1]] = match[2];
  }
  return tokens;
}

/**
 * Splits the stylesheet into its light and dark colour tokens.
 * The light tokens are the first `:root { ... }` block; the dark tokens are the
 * `:root { ... }` block inside `@media (prefers-color-scheme: dark)`.
 * @param {string} css
 * @returns {{light: Record<string, string>, dark: Record<string, string>}}
 * @throws {Error} when either block is missing.
 */
export function readThemes(css) {
  if (typeof css !== "string") throw new TypeError("readThemes expects a string.");

  const darkMarker = css.indexOf("@media (prefers-color-scheme: dark)");
  if (darkMarker === -1) throw new Error("No dark-mode block found in the stylesheet.");

  const lightStart = css.indexOf(":root");
  if (lightStart === -1 || lightStart > darkMarker) {
    throw new Error("No light-mode :root block found before the dark-mode block.");
  }
  const lightEnd = css.indexOf("}", lightStart);
  const darkStart = css.indexOf(":root", darkMarker);
  if (darkStart === -1) throw new Error("No :root block found inside the dark-mode block.");
  const darkEnd = css.indexOf("}", darkStart);

  return {
    light: parseColorTokens(css.slice(lightStart, lightEnd)),
    dark: parseColorTokens(css.slice(darkStart, darkEnd)),
  };
}
