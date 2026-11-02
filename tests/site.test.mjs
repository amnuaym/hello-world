/**
 * Tests for the real website files in docs/.
 * Part 1 tests the helper functions on small sample pages (including bad pages).
 * Part 2 checks the actual pages: structure, accessibility basics, links,
 * "zero dependency" rule, and consistency between files.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  stripComments,
  parseAttributes,
  findAllTags,
  findTags,
  firstElementText,
  collectIds,
  findDuplicates,
  headingLevels,
  headingsAreOrdered,
  isExternalRef,
  resolveLocalRef,
} from "../scripts/html-scan.mjs";
import { TOPICS } from "../docs/assets/js/contact-logic.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "docs");
const CANONICAL_HOST = "https://www.leesc.in";

/* ------------------------- Part 1: helper functions ------------------------ */

test("stripComments removes comments, including multi-line ones", () => {
  assert.equal(stripComments("a<!-- x\ny -->b"), "ab");
  assert.throws(() => stripComments(null), TypeError);
});

test("parseAttributes handles quotes, bare values, boolean attributes and '>' in values", () => {
  assert.deepEqual(parseAttributes(' href="a b" class=\'x\' id=plain hidden data-x="a>b" '), {
    href: "a b",
    class: "x",
    id: "plain",
    hidden: "",
    "data-x": "a>b",
  });
});

test("findAllTags ignores tags inside comments and keeps '>' inside quoted values", () => {
  const tags = findAllTags('<!-- <img src="no.png"> --><a title="1 > 0" href="x.html">t</a>');
  assert.equal(tags.length, 1);
  assert.equal(tags[0].attrs.title, "1 > 0");
});

test("findTags returns only the requested tag, case-insensitively", () => {
  const html = '<IMG src="a.png" alt=""><p><img src="b.png">';
  assert.equal(findTags(html, "img").length, 2);
  assert.equal(findTags(html, "p").length, 1);
});

test("firstElementText strips tags and collapses spaces; null when missing", () => {
  assert.equal(firstElementText("<title>  Hello \n <b>World</b> </title>", "title"), "Hello World");
  assert.equal(firstElementText("<p>x</p>", "title"), null);
});

test("collectIds and findDuplicates detect repeated ids", () => {
  const ids = collectIds('<div id="a"></div><p id="b"></p><span id="a"></span>');
  assert.deepEqual(ids, ["a", "b", "a"]);
  assert.deepEqual(findDuplicates(ids), ["a"]);
  assert.deepEqual(findDuplicates(["x", "y"]), []);
});

test("headingLevels and headingsAreOrdered detect skipped levels", () => {
  assert.deepEqual(headingLevels("<h1>a</h1><h2>b</h2><h3>c</h3><h2>d</h2>"), [1, 2, 3, 2]);
  assert.equal(headingsAreOrdered([1, 2, 3, 2, 3]), true);
  assert.equal(headingsAreOrdered([1, 3]), false);
  assert.equal(headingsAreOrdered([2]), false);
  assert.equal(headingsAreOrdered([]), true);
});

test("isExternalRef separates outside links from local ones", () => {
  for (const ref of ["https://a.com", "http://a.com", "mailto:a@b.co", "tel:+66", "//cdn.example.com/x.js", "data:text/plain,hi"]) {
    assert.equal(isExternalRef(ref), true, ref);
  }
  for (const ref of ["index.html", "/assets/x.css", "#top", "../a.html", "./b"]) {
    assert.equal(isExternalRef(ref), false, ref);
  }
});

test("resolveLocalRef resolves relative, root-relative, fragment and directory links", () => {
  assert.deepEqual(resolveLocalRef("index.html", "privacy.html"), { file: "privacy.html", fragment: "" });
  assert.deepEqual(resolveLocalRef("index.html", "#contact"), { file: "index.html", fragment: "contact" });
  assert.deepEqual(resolveLocalRef("privacy.html", "index.html#services"), { file: "index.html", fragment: "services" });
  assert.deepEqual(resolveLocalRef("404.html", "/assets/css/styles.css"), { file: "assets/css/styles.css", fragment: "" });
  assert.deepEqual(resolveLocalRef("404.html", "/"), { file: "index.html", fragment: "" });
  assert.deepEqual(resolveLocalRef("a/b.html", "../c.html"), { file: "c.html", fragment: "" });
});

/* --------------------------- Part 2: the real site ------------------------- */

const SERVICE_PAGES = [
  "services/digital-transformation.html",
  "services/solution-consulting.html",
  "services/it-operations-governance.html",
  "services/ai-adoption.html",
  "services/cyber-security.html",
  "services/project-management.html",
];
const PAGES = ["index.html", "privacy.html", "404.html", ...SERVICE_PAGES];
const PLACEHOLDER = /\{\{[A-Z][A-Z0-9_]*\}\}/;

async function readPage(name) {
  return readFile(join(SITE, name), "utf8");
}

async function exists(relative) {
  try {
    await stat(join(SITE, relative));
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

test("every page has a doctype, language, charset, viewport and a sensible title", async () => {
  for (const page of PAGES) {
    const html = await readPage(page);
    assert.match(html.trimStart(), /^<!doctype html>/i, `${page}: doctype`);
    assert.match(findTags(html, "html")[0].attrs.lang, /^(en|th)$/, `${page}: lang`);
    assert.ok(findTags(html, "meta").some((m) => m.attrs.charset === "utf-8"), `${page}: charset`);
    assert.ok(findTags(html, "meta").some((m) => m.attrs.name === "viewport"), `${page}: viewport`);
    const title = firstElementText(html, "title");
    assert.ok(title && title.length >= 10 && title.length <= 70, `${page}: title length (${title})`);
  }
});

test("indexable pages have a description and a correct canonical link", async () => {
  const expected = {
    "index.html": `${CANONICAL_HOST}/`,
    "privacy.html": `${CANONICAL_HOST}/privacy.html`,
    ...Object.fromEntries(SERVICE_PAGES.map((page) => [page, `${CANONICAL_HOST}/${page}`])),
  };
  for (const [page, canonical] of Object.entries(expected)) {
    const html = await readPage(page);
    const description = findTags(html, "meta").find((m) => m.attrs.name === "description");
    assert.ok(description, `${page}: description`);
    assert.ok(description.attrs.content.length >= 50 && description.attrs.content.length <= 200, `${page}: description length`);
    const link = findTags(html, "link").find((l) => l.attrs.rel === "canonical");
    assert.equal(link?.attrs.href, canonical, `${page}: canonical`);
  }
});

test("the 404 page is not indexed", async () => {
  const html = await readPage("404.html");
  const robots = findTags(html, "meta").find((m) => m.attrs.name === "robots");
  assert.equal(robots?.attrs.content, "noindex");
});

test("every page has exactly one h1 and headings never skip a level", async () => {
  for (const page of PAGES) {
    const levels = headingLevels(await readPage(page));
    assert.equal(levels.filter((l) => l === 1).length, 1, `${page}: one h1`);
    assert.equal(headingsAreOrdered(levels), true, `${page}: heading order ${levels.join(",")}`);
  }
});

test("ids are unique on every page", async () => {
  for (const page of PAGES) {
    assert.deepEqual(findDuplicates(collectIds(await readPage(page))), [], page);
  }
});

test("every image has an alt attribute", async () => {
  for (const page of PAGES) {
    for (const img of findTags(await readPage(page), "img")) {
      assert.notEqual(img.attrs.alt, undefined, `${page}: <img src="${img.attrs.src}"> needs alt`);
    }
  }
});

test("every local link, script, stylesheet and fragment points to something that exists", async () => {
  const idsByFile = new Map();
  for (const page of PAGES) idsByFile.set(page, new Set(collectIds(await readPage(page))));

  for (const page of PAGES) {
    const html = await readPage(page);
    const refs = findAllTags(html)
      .flatMap((tag) => [tag.attrs.href, tag.attrs.src])
      .filter((ref) => typeof ref === "string" && ref !== "");

    for (const ref of refs) {
      if (isExternalRef(ref) || PLACEHOLDER.test(ref)) continue;
      const { file, fragment } = resolveLocalRef(page, ref);
      assert.equal(await exists(file), true, `${page}: "${ref}" -> missing file ${file}`);
      if (fragment !== "") {
        const ids = idsByFile.get(file);
        assert.ok(ids?.has(fragment), `${page}: "${ref}" -> no element with id "${fragment}" in ${file}`);
      }
    }
  }
});

test("zero-dependency rule: no external scripts, stylesheets or images", async () => {
  for (const page of PAGES) {
    const tags = findAllTags(await readPage(page));
    for (const tag of tags) {
      if (tag.name === "script" && tag.attrs.src !== undefined) {
        assert.equal(isExternalRef(tag.attrs.src), false, `${page}: external script ${tag.attrs.src}`);
      }
      if (tag.name === "link" && tag.attrs.rel === "stylesheet") {
        assert.equal(isExternalRef(tag.attrs.href), false, `${page}: external stylesheet ${tag.attrs.href}`);
      }
      if (tag.name === "img") {
        assert.equal(isExternalRef(tag.attrs.src ?? ""), false, `${page}: external image ${tag.attrs.src}`);
      }
    }
  }
  const css = await readFile(join(SITE, "assets/css/styles.css"), "utf8");
  assert.equal(/@import|url\(\s*["']?https?:/i.test(css), false, "stylesheet imports nothing external");
});

test("no insecure http:// links in any page", async () => {
  for (const page of PAGES) {
    for (const tag of findAllTags(await readPage(page))) {
      for (const value of [tag.attrs.href, tag.attrs.src]) {
        assert.equal(typeof value === "string" && value.startsWith("http://"), false, `${page}: ${value}`);
      }
    }
  }
});

test("every form control has a label, and error areas exist for each field", async () => {
  const html = await readPage("index.html");
  const labelTargets = new Set(findTags(html, "label").map((l) => l.attrs.for));
  const controls = findAllTags(html).filter((t) => ["input", "select", "textarea"].includes(t.name));
  assert.ok(controls.length >= 5);
  for (const control of controls) {
    assert.ok(control.attrs.id, "control has an id");
    assert.ok(labelTargets.has(control.attrs.id), `control #${control.attrs.id} has a label`);
  }
  const ids = new Set(collectIds(html));
  for (const field of ["name", "company", "email", "topic", "message"]) {
    assert.ok(ids.has(`cf-${field}-error`), `error area for ${field}`);
  }
  assert.ok(ids.has("cf-status"), "status area");
});

test("the form's topic list matches TOPICS in contact-logic.js exactly", async () => {
  const html = await readPage("index.html");
  const select = html.match(/<select id="cf-topic"[\s\S]*?<\/select>/)?.[0];
  assert.ok(select, "topic select found");
  const options = findTags(select, "option").map((o) => o.attrs.value).filter((v) => v !== "");
  assert.deepEqual(options, [...TOPICS]);
});

test("the form recipient is a real address that also appears as a visible mailto link", async () => {
  const html = await readPage("index.html");
  const form = findTags(html, "form").find((f) => f.attrs.id === "contact-form");
  assert.ok(form, "form found");
  assert.match(form.attrs["data-recipient"], /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/);
  const mailtos = findTags(html, "a").map((a) => a.attrs.href).filter((h) => h?.startsWith("mailto:"));
  assert.ok(mailtos.includes(`mailto:${form.attrs["data-recipient"]}`));
});

test("the form is hidden until JavaScript shows it, with a no-JavaScript message", async () => {
  const html = await readPage("index.html");
  const form = findTags(html, "form").find((f) => f.attrs.id === "contact-form");
  assert.notEqual(form.attrs.hidden, undefined);
  assert.match(html, /<noscript>[\s\S]*contact@leesc\.in[\s\S]*<\/noscript>/);
});

test("structured data is valid JSON and matches the canonical address", async () => {
  const html = await readPage("index.html");
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(block, "JSON-LD block found");
  const data = JSON.parse(block);
  assert.equal(data["@type"], "Organization");
  assert.equal(data.url, `${CANONICAL_HOST}/`);
});

test("CNAME contains exactly the www domain", async () => {
  const text = await readFile(join(SITE, "CNAME"), "utf8");
  assert.equal(text.trim(), "www.leesc.in");
  assert.equal(text.trim().split(/\s+/).length, 1);
});

test("sitemap lists only real pages on the canonical host; robots points to the sitemap", async () => {
  const sitemap = await readFile(join(SITE, "sitemap.xml"), "utf8");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(urls.length >= 2);
  for (const url of urls) {
    assert.ok(url.startsWith(`${CANONICAL_HOST}/`), url);
    const { file } = resolveLocalRef("index.html", url.slice(CANONICAL_HOST.length));
    assert.equal(await exists(file), true, `sitemap URL ${url} -> missing ${file}`);
  }
  const robots = await readFile(join(SITE, "robots.txt"), "utf8");
  assert.match(robots, new RegExp(`^Sitemap: ${CANONICAL_HOST.replace(/\./g, "\\.")}/sitemap\\.xml$`, "m"));
});

test("every JavaScript import in the site resolves to a real file", async () => {
  const main = await readFile(join(SITE, "assets/js/main.js"), "utf8");
  const imports = [...main.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(imports.length >= 1);
  for (const spec of imports) {
    assert.ok(spec.startsWith("./"), `only local imports allowed: ${spec}`);
    assert.equal(await exists(join("assets/js", spec)), true, spec);
  }
});

test("the site folder contains no unexpected file types", async () => {
  const allowed = new Set([".html", ".css", ".js", ".svg", ".xml", ".txt", ".png", ".jpg", ".jpeg", ".webp", ".woff2", ""]);
  const entries = await readdir(SITE, { recursive: true });
  for (const entry of entries) {
    const info = await stat(join(SITE, entry));
    if (info.isDirectory()) continue;
    const base = entry.split(/[\\/]/).pop();
    // GitHub Pages marker file: tells Pages to serve the folder as-is, without Jekyll.
    if (base === ".nojekyll") continue;
    const ext = base.includes(".") ? base.slice(base.lastIndexOf(".")) : "";
    assert.ok(allowed.has(ext), `unexpected file type: ${entry}`);
    if (ext === "") assert.equal(base, "CNAME", `unexpected extensionless file: ${entry}`);
  }
});
