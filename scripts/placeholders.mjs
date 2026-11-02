/**
 * placeholders.mjs
 *
 * Finds unfinished placeholders written like {{PHONE}} in text.
 * Pure function, so it can be tested on its own.
 */

const PLACEHOLDER_PATTERN = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;

/**
 * @param {string} text The text to scan.
 * @returns {Array<{token: string, line: number}>} Every placeholder with its line number (1 = first line).
 * @throws {TypeError} when `text` is not a string.
 */
export function findPlaceholders(text) {
  if (typeof text !== "string") {
    throw new TypeError("findPlaceholders expects a string.");
  }

  const found = [];
  const lines = text.split(/\r\n|\r|\n/);
  lines.forEach((lineText, index) => {
    for (const match of lineText.matchAll(PLACEHOLDER_PATTERN)) {
      found.push({ token: match[1], line: index + 1 });
    }
  });
  return found;
}
