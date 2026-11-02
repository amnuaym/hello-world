/**
 * Tests for docs/assets/js/contact-logic.js
 * Run with:  npm test
 * Real logic only: no mocks. Includes negative inputs and extreme edge cases.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  TOPICS,
  DEFAULT_TOPIC,
  LIMITS,
  ValidationError,
  isValidEmail,
  validateContact,
  buildMailtoUrl,
} from "../docs/assets/js/contact-logic.js";

const RECIPIENT = "contact@leesc.in";

/** A fully valid form. Tests change one field at a time. */
function valid(overrides = {}) {
  return {
    name: "Somchai Jaidee",
    company: "Example Co., Ltd.",
    email: "somchai@example.co.th",
    topic: TOPICS[0],
    message: "We would like to discuss a governance review.",
    ...overrides,
  };
}

/** Reads the subject/body back out of a mailto link. */
function parseMailto(url) {
  const parsed = new URL(url);
  return {
    to: decodeURIComponent(parsed.pathname),
    keys: [...parsed.searchParams.keys()],
    subject: parsed.searchParams.get("subject"),
    body: parsed.searchParams.get("body"),
  };
}

/* ------------------------------ isValidEmail ------------------------------ */

test("isValidEmail accepts normal addresses", () => {
  for (const email of [
    "a@b.co",
    "name@company.com",
    "first.last@sub.domain.co.th",
    "plus+tag@example.org",
    "o'brien@example.com",
    "x_y-z@my-host.example.com",
    "A@B.CO",
  ]) {
    assert.equal(isValidEmail(email), true, email);
  }
});

test("isValidEmail rejects bad addresses", () => {
  const bad = [
    "",
    "plainaddress",
    "@example.com",
    "name@",
    "name@@example.com",
    "name@example",
    "name@.example.com",
    "name@example..com",
    "name@-example.com",
    "name@example-.com",
    "name@example.c",
    "na me@example.com",
    "name@exa mple.com",
    ".name@example.com",
    "name.@example.com",
    "na..me@example.com",
    "name@example.com\n",
    "ชื่อ@example.com",
    "name@ตัวอย่าง.com",
    `${"a".repeat(65)}@example.com`,
    `a@${"b".repeat(250)}.com`,
  ];
  for (const email of bad) {
    assert.equal(isValidEmail(email), false, JSON.stringify(email));
  }
});

test("isValidEmail rejects non-strings without throwing", () => {
  for (const value of [undefined, null, 5, {}, [], true, Symbol("x")]) {
    assert.equal(isValidEmail(value), false);
  }
});

test("isValidEmail accepts a 64-character local part and rejects 65", () => {
  assert.equal(isValidEmail(`${"a".repeat(64)}@example.com`), true);
  assert.equal(isValidEmail(`${"a".repeat(65)}@example.com`), false);
});

/* ----------------------------- validateContact ---------------------------- */

test("validateContact accepts a fully valid form", () => {
  const result = validateContact(valid());
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, {});
  assert.equal(result.values.name, "Somchai Jaidee");
});

test("validateContact trims spaces and unifies new lines", () => {
  const result = validateContact(
    valid({ name: "  Ann  ", message: "  Line one\r\nLine two\rLine three  " }),
  );
  assert.equal(result.ok, true);
  assert.equal(result.values.name, "Ann");
  assert.equal(result.values.message, "Line one\nLine two\nLine three");
});

test("validateContact does not change its input and returns frozen results", () => {
  const input = valid({ name: "  Ann  " });
  const copy = { ...input };
  const result = validateContact(input);
  assert.deepEqual(input, copy);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.values), true);
  assert.equal(Object.isFrozen(result.errors), true);
});

test("validateContact reports every problem at once", () => {
  const result = validateContact({});
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ["email", "message", "name"]);
});

test("validateContact: required fields reject empty and whitespace-only values", () => {
  for (const blank of ["", "   ", "\n\t ", undefined, null]) {
    const result = validateContact(valid({ name: blank, email: blank, message: blank }));
    assert.equal(result.ok, false);
    assert.match(result.errors.name, /required/);
    assert.match(result.errors.email, /required/);
    assert.match(result.errors.message, /required/);
  }
});

test("validateContact: company is optional", () => {
  assert.equal(validateContact(valid({ company: "" })).ok, true);
  assert.equal(validateContact(valid({ company: undefined })).ok, true);
});

test("validateContact: name length limit counts characters, not bytes", () => {
  assert.equal(validateContact(valid({ name: "a".repeat(LIMITS.nameMax) })).ok, true);
  assert.equal(validateContact(valid({ name: "a".repeat(LIMITS.nameMax + 1) })).ok, false);
  // Thai letters and emoji: 100 characters is allowed even though it is many bytes.
  assert.equal(validateContact(valid({ name: "ก".repeat(100) })).ok, true);
  assert.equal(validateContact(valid({ name: "😀".repeat(100) })).ok, true);
  assert.equal(validateContact(valid({ name: "😀".repeat(101) })).ok, false);
});

test("validateContact: message length boundaries", () => {
  assert.equal(validateContact(valid({ message: "a".repeat(LIMITS.messageMin - 1) })).ok, false);
  assert.equal(validateContact(valid({ message: "a".repeat(LIMITS.messageMin) })).ok, true);
  assert.equal(validateContact(valid({ message: "a".repeat(LIMITS.messageMax) })).ok, true);
  assert.equal(validateContact(valid({ message: "a".repeat(LIMITS.messageMax + 1) })).ok, false);
});

test("validateContact: message spaces do not count toward the minimum", () => {
  const result = validateContact(valid({ message: "   short   " }));
  assert.equal(result.ok, false);
  assert.match(result.errors.message, /at least/);
});

test("validateContact: control characters are rejected in single-line fields", () => {
  for (const bad of ["Ann\nBcc: x@y.com", "Ann\rX", "Ann\u0000", "Ann\u0007", "Ann\u007f", "Ann‮evil", "An﻿n", "Ann⁦x"]) {
    const result = validateContact(valid({ name: bad, company: bad }));
    assert.equal(result.ok, false, JSON.stringify(bad));
    assert.match(result.errors.name, /not allowed/);
    assert.match(result.errors.company, /not allowed/);
  }
});

test("validateContact: a byte-order mark at the very start or end is trimmed away like a space", () => {
  // JavaScript's trim() treats U+FEFF as whitespace, so an edge BOM is harmless and removed.
  assert.equal(validateContact(valid({ name: "﻿Ann﻿" })).values.name, "Ann");
});

test("validateContact: message allows new lines and tabs but rejects other control characters", () => {
  assert.equal(validateContact(valid({ message: "Line one\nLine two\twith tab" })).ok, true);
  for (const bad of ["Hello there\u0000friend", "Hello there\u0008friend", "Hello ‮ there friend"]) {
    assert.equal(validateContact(valid({ message: bad })).ok, false, JSON.stringify(bad));
  }
});

test("validateContact: Thai and emoji text is accepted", () => {
  const result = validateContact(
    valid({ name: "สมชาย ใจดี", company: "บริษัท ตัวอย่าง จำกัด", message: "สนใจบริการตรวจสุขภาพด้านเทคโนโลยี 😀" }),
  );
  assert.equal(result.ok, true);
});

test("validateContact: topic defaults when empty and must come from the list", () => {
  assert.equal(validateContact(valid({ topic: "" })).values.topic, DEFAULT_TOPIC);
  assert.equal(validateContact(valid({ topic: undefined })).values.topic, DEFAULT_TOPIC);
  for (const topic of TOPICS) assert.equal(validateContact(valid({ topic })).ok, true, topic);
  const result = validateContact(valid({ topic: "Free money" }));
  assert.equal(result.ok, false);
  assert.match(result.errors.topic, /listed topics/);
});

test("validateContact: wrong value types become field errors, not crashes", () => {
  for (const wrong of [5, true, {}, [], () => 1]) {
    const result = validateContact({ name: wrong, company: wrong, email: wrong, topic: wrong, message: wrong });
    assert.equal(result.ok, false);
    assert.match(result.errors.name, /must be text/);
    assert.match(result.errors.message, /must be text/);
  }
});

test("validateContact throws TypeError for non-object input", () => {
  for (const bad of [null, undefined, "text", 42, true, [], [valid()]]) {
    assert.throws(() => validateContact(bad), TypeError, String(bad));
  }
});

test("validateContact rejects an invalid email with a helpful message", () => {
  const result = validateContact(valid({ email: "not-an-email" }));
  assert.equal(result.ok, false);
  assert.match(result.errors.email, /valid email/);
});

/* ------------------------------ buildMailtoUrl ---------------------------- */

test("buildMailtoUrl builds a link to the recipient with subject and body only", () => {
  const url = buildMailtoUrl(valid(), RECIPIENT);
  const parsed = parseMailto(url);
  assert.ok(url.startsWith(`mailto:${RECIPIENT}?`));
  assert.equal(parsed.to, RECIPIENT);
  assert.deepEqual(parsed.keys, ["subject", "body"]);
  assert.equal(parsed.subject, `Website enquiry: ${TOPICS[0]} (Somchai Jaidee)`);
});

test("buildMailtoUrl body contains the message and all details", () => {
  const { body } = parseMailto(buildMailtoUrl(valid(), RECIPIENT));
  assert.ok(body.startsWith("We would like to discuss a governance review."));
  assert.ok(body.includes("Name: Somchai Jaidee"));
  assert.ok(body.includes("Company: Example Co., Ltd."));
  assert.ok(body.includes("Email: somchai@example.co.th"));
  assert.ok(body.includes(`Topic: ${TOPICS[0]}`));
});

test("buildMailtoUrl leaves out the company line when no company is given", () => {
  const { body } = parseMailto(buildMailtoUrl(valid({ company: "" }), RECIPIENT));
  assert.equal(body.includes("Company:"), false);
});

test("buildMailtoUrl round-trips special characters exactly", () => {
  const message = "Price & scope? 100% sure = yes #1 + more / less \"quoted\" 'single' <b>tag</b> ก ข 😀";
  const { body } = parseMailto(buildMailtoUrl(valid({ message }), RECIPIENT));
  assert.ok(body.startsWith(message));
});

test("buildMailtoUrl uses CRLF line breaks in the body", () => {
  const { body } = parseMailto(buildMailtoUrl(valid({ message: "First line here\nSecond line here" }), RECIPIENT));
  assert.ok(body.startsWith("First line here\r\nSecond line here\r\n"));
});

test("buildMailtoUrl blocks header injection in the message", () => {
  const attack = "Hello there\r\nBcc: attacker@example.com\r\nSubject: hacked";
  const url = buildMailtoUrl(valid({ message: attack }), RECIPIENT);
  const parsed = parseMailto(url);
  assert.deepEqual(parsed.keys, ["subject", "body"]);
  assert.equal(url.includes("Bcc:"), false);
  assert.equal(url.includes("\r"), false);
  assert.equal(url.includes("\n"), false);
  assert.equal(parsed.subject.includes("hacked"), false);
});

test("buildMailtoUrl blocks injection through the name field", () => {
  assert.throws(
    () => buildMailtoUrl(valid({ name: "Ann\r\nBcc: attacker@example.com" }), RECIPIENT),
    (error) => error instanceof ValidationError && "name" in error.errors,
  );
});

test("buildMailtoUrl throws ValidationError with field messages for bad input", () => {
  try {
    buildMailtoUrl(valid({ email: "bad", message: "" }), RECIPIENT);
    assert.fail("should have thrown");
  } catch (error) {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.name, "ValidationError");
    assert.deepEqual(Object.keys(error.errors).sort(), ["email", "message"]);
  }
});

test("buildMailtoUrl throws RangeError when the link would be too long", () => {
  // 1000 Thai letters become about 9000 characters once encoded.
  assert.throws(() => buildMailtoUrl(valid({ message: "ก".repeat(LIMITS.messageMax) }), RECIPIENT), RangeError);
  // The same length in plain English stays under the limit.
  assert.doesNotThrow(() => buildMailtoUrl(valid({ message: "a".repeat(LIMITS.messageMax) }), RECIPIENT));
});

test("buildMailtoUrl rejects unsafe or invalid recipients", () => {
  for (const bad of [undefined, null, 5, "", "contact", "a?b@example.com", "a&b@example.com", "contact@leesc.in?cc=x@y.com", "a@b", " contact@leesc.in", "con tact@leesc.in", "a#b@example.com", "a/b@example.com"]) {
    assert.throws(() => buildMailtoUrl(valid(), bad), TypeError, String(bad));
  }
});

test("buildMailtoUrl throws TypeError for a non-object form", () => {
  assert.throws(() => buildMailtoUrl(null, RECIPIENT), TypeError);
  assert.throws(() => buildMailtoUrl("text", RECIPIENT), TypeError);
});

test("buildMailtoUrl does not change the form it is given", () => {
  const input = valid({ name: "  Ann  " });
  const copy = { ...input };
  buildMailtoUrl(input, RECIPIENT);
  assert.deepEqual(input, copy);
});
