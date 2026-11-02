/**
 * hero-logic.js
 *
 * Pure check for the email box at the top of the home page.
 * The visitor's email is checked here, then copied into the contact form below.
 * Responsibility: checking one email address. No page access, no network.
 *
 * Design rules used here:
 *  - Immutability: the result is a frozen object.
 *  - Explicit errors: a non-text input throws TypeError (a programming mistake);
 *    a bad email from the visitor is returned as a readable message.
 */
import { isValidEmail, LIMITS } from "./contact-logic.js";

/**
 * Checks the email typed into the hero box.
 * @param {unknown} raw The text the visitor typed.
 * @returns {Readonly<{ok: boolean, email: string, error: string}>}
 *   When ok is true, `email` is the cleaned address and `error` is "".
 * @throws {TypeError} when `raw` is not a string.
 */
export function prepareHandoff(raw) {
  if (typeof raw !== "string") {
    throw new TypeError("prepareHandoff expects the email as text.");
  }

  const email = raw.trim();

  if (email === "") {
    return Object.freeze({ ok: false, email: "", error: "Please enter your email address." });
  }
  if (Array.from(email).length > LIMITS.emailMax) {
    return Object.freeze({
      ok: false,
      email: "",
      error: `Your email address must be ${LIMITS.emailMax} characters or fewer.`,
    });
  }
  if (!isValidEmail(email)) {
    return Object.freeze({
      ok: false,
      email: "",
      error: "Please enter a valid email address, for example name@company.com.",
    });
  }

  return Object.freeze({ ok: true, email, error: "" });
}
