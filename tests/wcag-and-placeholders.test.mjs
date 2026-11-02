/**
 * Tests for scripts/wcag.mjs and scripts/placeholders.mjs,
 * plus the real colour-contrast check of docs/assets/css/styles.css.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseHex,
  relativeLuminance,
  contrastRatio,
  parseColorTokens,
  readThemes,
} from "../scripts/wcag.mjs";
import { findPlaceholders } from "../scripts/placeholders.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* --------------------------------- wcag.mjs -------------------------------- */

test("parseHex reads 6-digit colours in any letter case", () => {
  assert.deepEqual(parseHex("#000000"), [0, 0, 0]);
  assert.deepEqual(parseHex("#FFFFFF"), [255, 255, 255]);
  assert.deepEqual(parseHex("#0f3b5c"), [15, 59, 92]);
});

test("parseHex rejects anything else", () => {
  for (const bad of ["", "#fff", "000000", "#12345", "#1234567", "#gggggg", "red", null, undefined, 5, {}]) {
    assert.throws(() => parseHex(bad), TypeError, String(bad));
  }
});

test("relativeLuminance of black is 0 and white is 1", () => {
  assert.equal(relativeLuminance("#000000"), 0);
  assert.ok(Math.abs(relativeLuminance("#ffffff") - 1) < 1e-9);
});

test("contrastRatio: black on white is 21, same colour is 1, order does not matter", () => {
  assert.ok(Math.abs(contrastRatio("#000000", "#ffffff") - 21) < 1e-9);
  assert.equal(contrastRatio("#336699", "#336699"), 1);
  assert.equal(contrastRatio("#0f3b5c", "#ffffff"), contrastRatio("#ffffff", "#0f3b5c"));
});

test("contrastRatio matches the well-known value for #767676 on white (about 4.54)", () => {
  assert.ok(Math.abs(contrastRatio("#767676", "#ffffff") - 4.54) < 0.02);
});

test("parseColorTokens reads only 6-digit hex tokens", () => {
  const tokens = parseColorTokens(`
    --color-bg: #ffffff;
    --space: 1rem;
    --color-text:#17222d;
    --short: #fff;
  `);
  assert.deepEqual(tokens, { "color-bg": "#ffffff", "color-text": "#17222d" });
});

test("parseColorTokens rejects non-strings", () => {
  assert.throws(() => parseColorTokens(null), TypeError);
});

test("readThemes reports missing blocks clearly", () => {
  assert.throws(() => readThemes(":root { --a: #000000; }"), /dark-mode/);
  assert.throws(() => readThemes("@media (prefers-color-scheme: dark) { :root { --a: #000000; } }"), /light-mode/);
  assert.throws(() => readThemes(":root { --a: #000000; } @media (prefers-color-scheme: dark) { }"), /inside the dark-mode/);
  assert.throws(() => readThemes(null), TypeError);
});

/** Pairs of tokens: [text, background, minimum ratio, description]. */
const REQUIRED_PAIRS = [
  ["color-text", "color-bg", 4.5, "body text on page"],
  ["color-text", "color-surface", 4.5, "body text on tinted sections"],
  ["color-muted", "color-bg", 4.5, "secondary text on page"],
  ["color-muted", "color-surface", 4.5, "secondary text on tinted sections"],
  ["color-accent", "color-bg", 4.5, "links and numbers on page"],
  ["color-accent", "color-surface", 4.5, "links on tinted sections"],
  ["color-button-text", "color-button-bg", 4.5, "button text"],
  ["color-hero-text", "color-hero-bg", 4.5, "hero heading text"],
  ["color-hero-muted", "color-hero-bg", 4.5, "hero paragraph text"],
  ["color-error", "color-bg", 4.5, "error text on page"],
  ["color-error", "color-surface", 4.5, "error text on tinted sections"],
  ["color-input-border", "color-bg", 3, "form field border (interface part)"],
  ["color-input-border", "color-surface", 3, "form field border on tinted sections"],
  ["color-focus", "color-bg", 3, "keyboard focus ring on page"],
  ["color-focus", "color-surface", 3, "keyboard focus ring on tinted sections"],
];

test("the real stylesheet meets WCAG contrast in light and dark mode", async () => {
  const css = await readFile(join(ROOT, "docs/assets/css/styles.css"), "utf8");
  const themes = readThemes(css);

  for (const [themeName, tokens] of Object.entries(themes)) {
    for (const [fg, bg, minimum, description] of REQUIRED_PAIRS) {
      assert.ok(tokens[fg], `${themeName}: missing token --${fg}`);
      assert.ok(tokens[bg], `${themeName}: missing token --${bg}`);
      const ratio = contrastRatio(tokens[fg], tokens[bg]);
      assert.ok(
        ratio >= minimum,
        `${themeName} mode, ${description}: ${tokens[fg]} on ${tokens[bg]} is ${ratio.toFixed(2)}:1, needs ${minimum}:1`,
      );
    }
  }
});

/** Extra pairs used by the redesigned home page (navy sections, orange accents). */
const DESIGN_PAIRS = [
  ["color-orange", "color-hero-bg", 4.5, "orange labels on navy sections"],
  ["color-hero-muted", "color-hero-bg", 4.5, "muted text on navy sections"],
  ["color-muted", "color-surface", 4.5, "muted text on tinted white sections"],
  ["color-muted", "color-bg", 4.5, "muted text on white sections"],
  ["color-accent", "color-bg", 4.5, "orange-brown links on white sections"],
  ["color-accent", "color-surface", 4.5, "orange-brown links on tinted sections"],
  ["color-hero-text", "color-hero-bg", 4.5, "white text on navy sections"],
];

test("the redesigned home page colour pairs meet WCAG contrast in light and dark mode", async () => {
  const css = await readFile(join(ROOT, "docs/assets/css/styles.css"), "utf8");
  const themes = readThemes(css);
  for (const [themeName, tokens] of Object.entries(themes)) {
    for (const [fg, bg, minimum, description] of DESIGN_PAIRS) {
      assert.ok(tokens[fg], `${themeName}: missing token --${fg}`);
      assert.ok(tokens[bg], `${themeName}: missing token --${bg}`);
      const ratio = contrastRatio(tokens[fg], tokens[bg]);
      assert.ok(
        ratio >= minimum,
        `${themeName} mode, ${description}: ${tokens[fg]} on ${tokens[bg]} is ${ratio.toFixed(2)}:1, needs ${minimum}:1`,
      );
    }
  }
});

test("light and dark themes define the same set of tokens", async () => {
  const css = await readFile(join(ROOT, "docs/assets/css/styles.css"), "utf8");
  const { light, dark } = readThemes(css);
  assert.deepEqual(Object.keys(dark).sort(), Object.keys(light).sort());
});

/* ------------------------------ placeholders.mjs --------------------------- */

test("findPlaceholders finds tokens with correct line numbers", () => {
  const text = "first line\nCall {{PHONE}} now\n\nA {{LINE_URL}} and {{PHONE}}";
  assert.deepEqual(findPlaceholders(text), [
    { token: "PHONE", line: 2 },
    { token: "LINE_URL", line: 4 },
    { token: "PHONE", line: 4 },
  ]);
});

test("findPlaceholders ignores text that only looks similar", () => {
  const text = "{PHONE} {{phone}} {{ PHONE }} {{1ABC}} {{}} {{PHONE} {PHONE}}";
  assert.deepEqual(findPlaceholders(text), []);
});

test("findPlaceholders handles empty text, Windows line endings and non-strings", () => {
  assert.deepEqual(findPlaceholders(""), []);
  assert.deepEqual(findPlaceholders("a\r\n{{X}}\r\nb"), [{ token: "X", line: 2 }]);
  for (const bad of [null, undefined, 5, {}, []]) {
    assert.throws(() => findPlaceholders(bad), TypeError);
  }
});
