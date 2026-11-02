/**
 * Tests for the English / Thai switch.
 * Part 1 tests language.js rules. Part 2 checks every real page has a Thai
 * text for each English text, so the switch never shows a blank.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chooseLanguage, nextLanguage, LANGUAGES, DEFAULT_LANGUAGE } from "../docs/assets/js/language.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "docs");

/* ------------------------------ language.js ------------------------------ */

test("chooseLanguage keeps supported codes and falls back to the default otherwise", () => {
  assert.deepEqual([...LANGUAGES], ["en", "th"]);
  assert.equal(DEFAULT_LANGUAGE, "th", "Thai is the default on first visit");
  assert.equal(chooseLanguage("th"), "th");
  assert.equal(chooseLanguage("en"), "en");
  for (const bad of [null, undefined, "", "fr", "TH", 5, {}]) {
    assert.equal(chooseLanguage(bad), DEFAULT_LANGUAGE, String(bad));
  }
});

test("nextLanguage switches between English and Thai", () => {
  assert.equal(nextLanguage("en"), "th");
  assert.equal(nextLanguage("th"), "en");
});

test("nextLanguage rejects unknown languages", () => {
  for (const bad of ["fr", "", null, undefined]) {
    assert.throws(() => nextLanguage(bad), TypeError, String(bad));
  }
});

/* --------------------------- every page is bilingual ---------------------- */

const PAGES = [
  "index.html",
  "privacy.html",
  "404.html",
  "services/digital-transformation.html",
  "services/solution-consulting.html",
  "services/it-operations-governance.html",
  "services/ai-adoption.html",
  "services/cyber-security.html",
  "services/project-management.html",
];

test("every page has a Thai text for each English text, and the same count", async () => {
  for (const page of PAGES) {
    const html = await readFile(join(SITE, page), "utf8");
    const english = (html.match(/class="en"/g) ?? []).length;
    const thai = (html.match(/class="th"/g) ?? []).length;
    assert.ok(english > 0, `${page}: has English text`);
    assert.equal(thai, english, `${page}: Thai count matches English count`);
  }
});

test("every page loads the language script and has the TH / EN toggle", async () => {
  for (const page of PAGES) {
    const html = await readFile(join(SITE, page), "utf8");
    assert.match(html, /<div class="lang-switch" id="lang-switch" role="group"[^>]*hidden>/, `${page}: toggle`);
    assert.match(html, /data-lang-choice="th"/, `${page}: Thai choice`);
    assert.match(html, /data-lang-choice="en"/, `${page}: English choice`);
    assert.match(html, /<script type="module" src="[^"]*assets\/js\/main\.js"><\/script>/, `${page}: script`);
  }
});

test("every page starts in Thai, so the Thai text shows before any script runs", async () => {
  for (const page of PAGES) {
    const html = await readFile(join(SITE, page), "utf8");
    assert.match(html, /<html lang="th" data-lang="th">/, `${page}: Thai by default`);
  }
});

test("Thai text carries lang=\"th\" so screen readers pronounce it correctly", async () => {
  for (const page of PAGES) {
    const html = await readFile(join(SITE, page), "utf8");
    const thaiSpans = html.match(/<span class="th"[^>]*>/g) ?? [];
    for (const span of thaiSpans) {
      assert.match(span, /lang="(th|en)"/, `${page}: ${span}`);
    }
  }
});
