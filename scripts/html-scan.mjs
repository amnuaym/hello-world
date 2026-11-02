/**
 * html-scan.mjs
 *
 * Small, dependency-free helpers for checking our OWN static HTML pages.
 * These are not a full HTML parser. They are written for the simple,
 * well-formed pages in this project and handle quoted attribute values that
 * contain ">" characters. Pure functions, easy to test.
 */
import path from "node:path";

// <tagname attributes...>  (quoted values may contain ">")
const START_TAG = /<([a-zA-Z][a-zA-Z0-9-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/**
 * Removes HTML comments.
 * @param {string} html
 * @returns {string}
 */
export function stripComments(html) {
  if (typeof html !== "string") throw new TypeError("stripComments expects a string.");
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

/**
 * Reads attributes from the text inside a start tag.
 * Names are lower-case; attributes without a value get "".
 * @param {string} attributeText
 * @returns {Record<string, string>}
 */
export function parseAttributes(attributeText) {
  const attributes = {};
  for (const match of attributeText.matchAll(ATTRIBUTE)) {
    const name = match[1].toLowerCase();
    if (name === "/") continue;
    attributes[name] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

/**
 * Finds every start tag in the page (comments ignored).
 * @param {string} html
 * @returns {Array<{name: string, attrs: Record<string, string>}>}
 */
export function findAllTags(html) {
  const clean = stripComments(html);
  const tags = [];
  for (const match of clean.matchAll(START_TAG)) {
    tags.push({ name: match[1].toLowerCase(), attrs: parseAttributes(match[2]) });
  }
  return tags;
}

/**
 * Finds start tags with one name, for example "img".
 * @param {string} html
 * @param {string} name
 */
export function findTags(html, name) {
  const wanted = name.toLowerCase();
  return findAllTags(html).filter((tag) => tag.name === wanted);
}

/**
 * Returns the text inside the first <name>...</name>, with tags removed
 * and spaces collapsed. Returns null when the element is missing.
 * @param {string} html
 * @param {string} name
 * @returns {string | null}
 */
export function firstElementText(html, name) {
  const pattern = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i");
  const match = stripComments(html).match(pattern);
  if (match === null) return null;
  return match[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/**
 * @param {string} html
 * @returns {string[]} every id attribute value in the page, in order.
 */
export function collectIds(html) {
  return findAllTags(html)
    .filter((tag) => tag.attrs.id !== undefined)
    .map((tag) => tag.attrs.id);
}

/**
 * @param {string[]} values
 * @returns {string[]} values that appear more than once (each reported once).
 */
export function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

/**
 * @param {string} html
 * @returns {number[]} heading levels (1-6) in page order.
 */
export function headingLevels(html) {
  return findAllTags(html)
    .filter((tag) => /^h[1-6]$/.test(tag.name))
    .map((tag) => Number(tag.name[1]));
}

/**
 * Checks that headings never skip a level going down (h1 -> h3 is a skip).
 * @param {number[]} levels
 * @returns {boolean}
 */
export function headingsAreOrdered(levels) {
  let previous = 0;
  for (const level of levels) {
    if (level > previous + 1) return false;
    previous = level;
  }
  return true;
}

/**
 * True when a link points outside the site (https:, mailto:, tel:, //host ...).
 * @param {string} ref
 */
export function isExternalRef(ref) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(ref);
}

/**
 * Works out which file inside the site folder a local link points to.
 * @param {string} pageFile Page path inside the site, e.g. "privacy.html".
 * @param {string} ref The href/src value, e.g. "index.html#contact" or "/assets/css/styles.css".
 * @returns {{file: string, fragment: string}} file is relative to the site folder.
 */
export function resolveLocalRef(pageFile, ref) {
  const hashIndex = ref.indexOf("#");
  const rawPath = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? "" : ref.slice(hashIndex + 1);

  let file;
  if (rawPath === "") {
    file = pageFile;
  } else if (rawPath.startsWith("/")) {
    file = path.posix.normalize(rawPath.slice(1));
  } else {
    file = path.posix.normalize(path.posix.join(path.posix.dirname(pageFile), rawPath));
  }
  if (file === "." || file === "" || file.endsWith("/")) {
    file = path.posix.join(file === "." ? "" : file, "index.html");
  }
  return { file, fragment };
}
