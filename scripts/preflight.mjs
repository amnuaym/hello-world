/**
 * preflight.mjs
 *
 * Run with:  npm run preflight
 * Lists every unfinished {{PLACEHOLDER}} left in the website files.
 * Exits with code 1 if any are found, so you know the site is not ready to publish.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findPlaceholders } from "./placeholders.mjs";

const SITE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEXT_EXTENSIONS = new Set([".html", ".css", ".js", ".xml", ".txt", ".svg", ".json"]);
// Folders and files at the root that are project tooling, not part of the website.
const NOT_SITE = /^(scripts|tests|backup|node_modules|\.git|\.claude)([\\/]|$)|^(README\.md|package\.json|\.gitignore)$/;

/** Returns true for files whose content should be scanned. */
function isTextFile(relativePath) {
  const base = relativePath.split(/[\\/]/).pop() ?? "";
  if (base === "CNAME") return true;
  const dot = base.lastIndexOf(".");
  return dot !== -1 && TEXT_EXTENSIONS.has(base.slice(dot));
}

async function main() {
  let entries;
  try {
    entries = await readdir(SITE_DIR, { recursive: true });
  } catch (error) {
    console.error(`Cannot read the site folder: ${SITE_DIR}`);
    console.error(error);
    process.exitCode = 2;
    return;
  }

  let total = 0;
  for (const entry of entries.sort()) {
    if (NOT_SITE.test(entry) || !isTextFile(entry)) continue;
    const text = await readFile(join(SITE_DIR, entry), "utf8");
    for (const { token, line } of findPlaceholders(text)) {
      console.log(`${entry.replace(/\\/g, "/")}:${line}  {{${token}}}`);
      total += 1;
    }
  }

  if (total === 0) {
    console.log("Preflight passed: no unfinished placeholders.");
    return;
  }
  console.log(`\nPreflight FAILED: ${total} unfinished placeholder(s). Replace each {{TOKEN}} with your real detail, or delete the line that contains it.`);
  process.exitCode = 1;
}

await main();
