/**
 * language.js
 *
 * Pure rules for the English / Thai switch. No page access, so it can be
 * tested directly with Node.js. Page wiring lives in main.js.
 */

/** Languages the site offers. The first one is the default. */
export const LANGUAGES = Object.freeze(["en", "th"]);

/** Used when nothing valid has been chosen (first visit, or a bad saved value). */
export const DEFAULT_LANGUAGE = "th";

/**
 * Returns a supported language code, or the default when the value is not one.
 * @param {unknown} value
 * @returns {"en" | "th"}
 */
export function chooseLanguage(value) {
  return LANGUAGES.includes(value) ? value : DEFAULT_LANGUAGE;
}

/**
 * Returns the other language, for the switch button.
 * @param {"en" | "th"} language
 * @returns {"en" | "th"}
 */
export function nextLanguage(language) {
  if (!LANGUAGES.includes(language)) {
    throw new TypeError(`Unknown language: ${String(language)}`);
  }
  return language === "en" ? "th" : "en";
}
