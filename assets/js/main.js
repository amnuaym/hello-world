/**
 * main.js
 *
 * Connects the page to the logic files.
 *  - contact-logic.js: checks the contact form and builds the email link (unit tested).
 *  - hero-logic.js: checks the email box at the top and hands it to the contact form.
 *  - steps.js: makes the "How we work" steps interactive.
 * This file only reads the page, shows messages, and wires events together.
 *
 * Without JavaScript the forms stay hidden and the visitor sees the direct
 * email address and the free-talk links instead, so nothing breaks.
 */
import { buildMailtoUrl, ValidationError } from "./contact-logic.js";
import { prepareHandoff } from "./hero-logic.js";
import { initStepper } from "./steps.js";
import { chooseLanguage } from "./language.js";

const FIELDS = Object.freeze(["name", "company", "email", "topic", "message"]);

/**
 * Returns the element with this id, or throws. A missing element means the
 * page and the script disagree, so it must be reported, not ignored.
 * @param {string} id
 * @returns {HTMLElement}
 */
function requireElement(id) {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`The page is missing the element with id "${id}".`);
  }
  return element;
}

/** Reads the form into a plain object. Missing fields become null. */
function readForm(form) {
  const data = new FormData(form);
  const values = {};
  for (const field of FIELDS) values[field] = data.get(field);
  return values;
}

/** Writes a message into the polite "status" area read aloud by screen readers. */
function setStatus(form, message) {
  const status = form.querySelector("#cf-status");
  if (status) status.textContent = message;
}

/** Hides every field error and clears the "invalid" marks. */
function clearErrors(form) {
  for (const field of FIELDS) {
    const input = form.elements.namedItem(field);
    const error = form.querySelector(`#cf-${field}-error`);
    if (input) input.removeAttribute("aria-invalid");
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
  }
}

/** Shows one error under each invalid field and moves focus to the first one. */
function showErrors(form, errors) {
  let firstInvalid = null;
  for (const field of FIELDS) {
    const message = errors[field];
    if (message === undefined) continue;

    const input = form.elements.namedItem(field);
    const error = form.querySelector(`#cf-${field}-error`);
    if (input) {
      input.setAttribute("aria-invalid", "true");
      if (firstInvalid === null) firstInvalid = input;
    }
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }
  if (firstInvalid !== null) firstInvalid.focus();
}

/** Handles the contact form: check, then open the visitor's email program. */
function handleSubmit(event, form, recipient) {
  event.preventDefault();
  clearErrors(form);

  try {
    const url = buildMailtoUrl(readForm(form), recipient);
    setStatus(
      form,
      `Your email program should open now with your message filled in. If it does not, please email us at ${recipient}.`,
    );
    window.location.href = url;
  } catch (error) {
    if (error instanceof ValidationError) {
      showErrors(form, error.errors);
      setStatus(form, "Please check the fields marked below.");
      return;
    }
    if (error instanceof RangeError) {
      setStatus(form, `Your message is too long for an email link. Please shorten it, or email us directly at ${recipient}.`);
      return;
    }
    // Anything else is unexpected: report it in the console and tell the visitor.
    console.error("The contact form failed unexpectedly:", error);
    setStatus(form, `Sorry, something went wrong. Please email us directly at ${recipient}.`);
  }
}

/** Shows the contact form and attaches the submit handler. */
function initContactForm() {
  const form = document.getElementById("contact-form");
  if (form === null) return;

  const recipient = form.dataset.recipient;
  if (typeof recipient !== "string" || recipient === "") {
    console.error("The contact form is missing its data-recipient address, so it stays hidden.");
    return;
  }

  form.hidden = false;
  form.addEventListener("submit", (event) => handleSubmit(event, form, recipient));
}

/**
 * Shows the email box at the top of the page. Its address is copied into the
 * contact form, and the page scrolls down to that form.
 */
function initHeroForm() {
  const form = document.getElementById("hero-form");
  if (form === null) return;

  const input = requireElement("hero-email");
  const error = requireElement("hero-error");
  const status = requireElement("hero-status");
  const contactEmail = requireElement("cf-email");
  const contactName = requireElement("cf-name");
  const contact = requireElement("contact");

  form.hidden = false;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = prepareHandoff(input.value);

    if (!result.ok) {
      error.textContent = result.error;
      error.hidden = false;
      input.setAttribute("aria-invalid", "true");
      status.textContent = "";
      input.focus();
      return;
    }

    error.textContent = "";
    error.hidden = true;
    input.removeAttribute("aria-invalid");
    contactEmail.value = result.email;
    status.textContent = "Thank you. Please fill in the short form below.";
    contact.scrollIntoView();
    contactName.focus();
  });
}

/** Keeps the footer year current. */
function initYear() {
  const target = document.getElementById("year");
  if (target !== null) target.textContent = String(new Date().getFullYear());
}

/** Reads the saved language. Storage can be blocked, so failure falls back to English. */
function readSavedLanguage() {
  try {
    return localStorage.getItem("site-language");
  } catch {
    return null;
  }
}

/** Saves the chosen language. If storage is blocked, the choice lasts for this page only. */
function saveLanguage(language) {
  try {
    localStorage.setItem("site-language", language);
  } catch {
    // Storage is unavailable (private window or blocked site data); nothing else to do.
  }
}

/**
 * Connects the English / Thai button. The page text is written in both
 * languages; the chosen one is shown through <html data-lang>. Without
 * JavaScript the button stays hidden and English is shown.
 */
function initLanguage() {
  const switcher = document.getElementById("lang-switch");
  if (switcher === null) return;
  const choices = switcher.querySelectorAll("[data-lang-choice]");

  // Option labels in the contact form are swapped too (values stay English).
  const options = document.querySelectorAll("option[data-th]");
  for (const option of options) option.dataset.en = option.textContent;

  let language = chooseLanguage(readSavedLanguage());

  const apply = () => {
    document.documentElement.dataset.lang = language;
    document.documentElement.lang = language;
    for (const option of options) {
      option.textContent = language === "th" ? option.dataset.th : option.dataset.en;
    }
    for (const choice of choices) {
      choice.setAttribute("aria-pressed", String(choice.dataset.langChoice === language));
    }
  };

  apply();
  switcher.hidden = false;
  for (const choice of choices) {
    choice.addEventListener("click", () => {
      language = chooseLanguage(choice.dataset.langChoice);
      saveLanguage(language);
      apply();
    });
  }
}

initContactForm();
initHeroForm();
initLanguage();
// The "How we work" steps exist only on the home page, so other pages skip them.
if (document.getElementById("steps") !== null) {
  initStepper(requireElement("steps"), requireElement("flow-caption"));
}
initYear();
