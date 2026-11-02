/**
 * steps.js
 *
 * Makes the "How we work" list interactive: clicking a step makes it the
 * active one (orange) and shows its short caption under the plan picture.
 * Responsibility: choosing which step is active and showing its caption.
 *
 * The list still reads fine without JavaScript, because every step's text is
 * already visible on the page.
 */

/**
 * Checks that a requested step number is inside the list.
 * @param {number} count How many steps there are (at least 1).
 * @param {number} requested The step to make active, counted from 0.
 * @returns {number} The same step number, when it is valid.
 * @throws {TypeError} when `count` or `requested` is not a whole number.
 * @throws {RangeError} when `requested` is outside 0 to count - 1.
 */
export function activeStepIndex(count, requested) {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new TypeError("count must be a whole number of at least 1.");
  }
  if (!Number.isSafeInteger(requested)) {
    throw new TypeError("requested must be a whole number.");
  }
  if (requested < 0 || requested >= count) {
    throw new RangeError(`requested must be between 0 and ${count - 1}.`);
  }
  return requested;
}

/**
 * Reads the caption stored on each step button.
 * @param {HTMLButtonElement} button
 * @returns {string} The caption text.
 * @throws {Error} when the button has no caption, so the mistake is visible at start-up.
 */
export function readCaption(button) {
  const caption = button.dataset.caption;
  if (typeof caption !== "string" || caption.trim() === "") {
    throw new Error("Each step button needs a non-empty data-caption attribute.");
  }
  return caption;
}

/**
 * Connects the step buttons to the caption area.
 * @param {HTMLOListElement} list The ordered list of steps.
 * @param {HTMLElement} captionTarget The element that shows the caption.
 * @throws {Error} when a step has no button or no caption (checked before any click).
 */
export function initStepper(list, captionTarget) {
  const items = Array.from(list.querySelectorAll("li[data-step]"));
  const buttons = items.map((item) => {
    const button = item.querySelector("button");
    if (button === null) {
      throw new Error("Each step needs a button.");
    }
    return button;
  });
  buttons.forEach(readCaption);

  const showStep = (index) => {
    const chosen = activeStepIndex(items.length, index);
    items.forEach((item, position) => {
      const isActive = position === chosen;
      item.classList.toggle("is-active", isActive);
      buttons[position].setAttribute("aria-pressed", String(isActive));
    });
    const caption = readCaption(buttons[chosen]);
    const english = captionTarget.querySelector(".en");
    const thai = captionTarget.querySelector(".th");
    if (english !== null && thai !== null) {
      // The page has both languages; the Thai caption falls back to English if missing.
      english.textContent = caption;
      thai.textContent = buttons[chosen].dataset.captionTh ?? caption;
    } else {
      captionTarget.textContent = caption;
    }
  };

  buttons.forEach((button, index) => {
    button.addEventListener("click", () => showStep(index));
  });
}
