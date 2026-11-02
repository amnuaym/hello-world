/**
 * contact-logic.js
 *
 * Pure functions that check a contact-form submission and turn it into a
 * "mailto:" link. This file has NO access to the page (DOM), the network, or
 * any external library, so it can be tested directly with Node.js.
 *
 * Responsibility: validation and link building only.
 * Page wiring lives in main.js.
 *
 * Design rules used here:
 *  - Immutability: inputs are never changed; results are frozen objects.
 *  - Explicit errors: bad programmer input throws TypeError; bad user input
 *    is reported as a field-by-field error object; an oversized link throws
 *    RangeError. Nothing is silently ignored.
 */

/** Topics a visitor can choose. The page's <select> must match this list exactly. */
export const TOPICS = Object.freeze([
  "Digital Transformation",
  "Solution Consulting",
  "IT Operation and Governance",
  "AI Adoption",
  "Cyber Security",
  "Project Management",
  "Technology Health Check",
  "Something else",
]);

/** Topic used when the visitor leaves the topic empty. */
export const DEFAULT_TOPIC = "Something else";

/**
 * Size limits. Lengths are counted in characters (Unicode code points), so one
 * Thai letter or one emoji counts as one.
 * `mailtoMax` is a conservative engineering limit for the whole link, because
 * very long mailto links can fail in some email programs. Thai text becomes
 * about nine characters per letter once encoded, so long Thai messages hit
 * this limit first; the visitor is then asked to shorten the message.
 */
export const LIMITS = Object.freeze({
  nameMax: 100,
  companyMax: 150,
  emailMax: 254,
  messageMin: 10,
  messageMax: 1000,
  mailtoMax: 6000,
});

/** Error thrown when the form values are not acceptable. */
export class ValidationError extends Error {
  /** @param {Readonly<Record<string, string>>} errors Field name -> message. */
  constructor(errors) {
    super("The contact form has invalid values.");
    this.name = "ValidationError";
    this.errors = errors;
  }
}

// Control characters (except tab/new line in the message), bidirectional
// text overrides, and the byte-order mark. These can hide or reorder text.
const FORBIDDEN_SINGLE_LINE =
  /[\u0000-\u001F\u007F-\u009F‎‏‪-‮⁦-⁩﻿]/u;
const FORBIDDEN_MULTI_LINE =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‎‏‪-‮⁦-⁩﻿]/u;

const LOCAL_PART_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const DOMAIN_PATTERN = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

// Stricter pattern for OUR OWN receiving address, because it is placed in the
// link path where characters such as "?" and "&" would change the link.
const SAFE_RECIPIENT_PATTERN = /^[A-Za-z0-9._+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,63}$/;

/**
 * Counts characters the way a person would (code points, not UTF-16 units).
 * @param {string} text
 * @returns {number}
 */
function countCharacters(text) {
  return Array.from(text).length;
}

/**
 * Checks an email address (English letters, digits, and common symbols).
 * @param {unknown} value
 * @returns {boolean} true when the address looks valid.
 */
export function isValidEmail(value) {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > LIMITS.emailMax) return false;

  const parts = value.split("@");
  if (parts.length !== 2) return false;

  const [local, domain] = parts;
  if (local.length === 0 || local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;

  return LOCAL_PART_PATTERN.test(local) && DOMAIN_PATTERN.test(domain);
}

/**
 * Cleans one raw value: trims, normalizes Unicode, and unifies new lines.
 * @param {unknown} raw
 * @param {boolean} multiline
 * @returns {{kind: "empty" | "text" | "wrong-type", text: string}}
 */
function normalizeText(raw, multiline) {
  if (raw === undefined || raw === null) return { kind: "empty", text: "" };
  if (typeof raw !== "string") return { kind: "wrong-type", text: "" };

  let text = raw.normalize("NFC");
  if (multiline) text = text.replace(/\r\n?/g, "\n");
  text = text.trim();

  return { kind: text === "" ? "empty" : "text", text };
}

/**
 * Checks one text field against simple rules.
 * @param {unknown} raw
 * @param {{label: string, required: boolean, min?: number, max: number, multiline?: boolean}} rules
 * @returns {{value: string, error: string | null}}
 */
function checkText(raw, rules) {
  const multiline = rules.multiline === true;
  const { kind, text } = normalizeText(raw, multiline);

  if (kind === "wrong-type") {
    return { value: "", error: `${rules.label} must be text.` };
  }
  if (kind === "empty") {
    return {
      value: "",
      error: rules.required ? `${rules.label} is required.` : null,
    };
  }

  const forbidden = multiline ? FORBIDDEN_MULTI_LINE : FORBIDDEN_SINGLE_LINE;
  if (forbidden.test(text)) {
    return { value: "", error: `${rules.label} contains characters that are not allowed.` };
  }

  const length = countCharacters(text);
  if (length > rules.max) {
    return { value: "", error: `${rules.label} must be ${rules.max} characters or fewer.` };
  }
  if (rules.min !== undefined && length < rules.min) {
    return { value: "", error: `${rules.label} must be at least ${rules.min} characters.` };
  }

  return { value: text, error: null };
}

/**
 * Checks the whole contact form.
 *
 * @param {{name?: unknown, company?: unknown, email?: unknown, topic?: unknown, message?: unknown}} input
 * @returns {Readonly<{ok: boolean, values: Readonly<Record<string, string>>, errors: Readonly<Record<string, string>>}>}
 * @throws {TypeError} when `input` is not a plain object (a programming mistake).
 */
export function validateContact(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("validateContact expects a plain object.");
  }

  const errors = {};
  const values = {};

  const record = (field, result) => {
    values[field] = result.value;
    if (result.error !== null) errors[field] = result.error;
  };

  record("name", checkText(input.name, { label: "Your name", required: true, max: LIMITS.nameMax }));
  record("company", checkText(input.company, { label: "Company", required: false, max: LIMITS.companyMax }));

  const email = checkText(input.email, { label: "Email", required: true, max: LIMITS.emailMax });
  if (email.error === null && !isValidEmail(email.value)) {
    email.error = "Please enter a valid email address, for example name@company.com.";
  }
  record("email", email);

  const topic = checkText(input.topic, { label: "Topic", required: false, max: 100 });
  if (topic.error === null) {
    if (topic.value === "") {
      topic.value = DEFAULT_TOPIC;
    } else if (!TOPICS.includes(topic.value)) {
      topic.error = "Please choose one of the listed topics.";
    }
  }
  record("topic", topic);

  record(
    "message",
    checkText(input.message, {
      label: "Message",
      required: true,
      min: LIMITS.messageMin,
      max: LIMITS.messageMax,
      multiline: true,
    }),
  );

  return Object.freeze({
    ok: Object.keys(errors).length === 0,
    values: Object.freeze(values),
    errors: Object.freeze(errors),
  });
}

/**
 * Builds a "mailto:" link that opens the visitor's email program with the
 * message ready to send. The website cannot send email by itself.
 *
 * @param {object} input Form values (see validateContact).
 * @param {string} recipient Our receiving address, for example "contact@leesc.in".
 * @returns {string} The mailto link.
 * @throws {TypeError} when `recipient` is not a safe email address.
 * @throws {ValidationError} when the form values are not acceptable.
 * @throws {RangeError} when the finished link would be too long.
 */
export function buildMailtoUrl(input, recipient) {
  if (typeof recipient !== "string" || !SAFE_RECIPIENT_PATTERN.test(recipient)) {
    throw new TypeError("recipient must be a plain email address such as contact@leesc.in.");
  }

  const result = validateContact(input);
  if (!result.ok) throw new ValidationError(result.errors);

  const { name, company, email, topic, message } = result.values;

  const subject = `Website enquiry: ${topic} (${name})`;
  const bodyLines = [
    message.replace(/\n/g, "\r\n"),
    "",
    "---",
    `Name: ${name}`,
    ...(company === "" ? [] : [`Company: ${company}`]),
    `Email: ${email}`,
    `Topic: ${topic}`,
  ];

  const url =
    `mailto:${recipient}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(bodyLines.join("\r\n"))}`;

  if (url.length > LIMITS.mailtoMax) {
    throw new RangeError("The message is too long to place in an email link. Please shorten it.");
  }

  return url;
}
