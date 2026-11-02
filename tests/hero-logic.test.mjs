/**
 * Tests for docs/assets/js/hero-logic.js (the email box at the top of the home page).
 * Real logic, no mocks: every case calls the real function.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { prepareHandoff } from "../docs/assets/js/hero-logic.js";

test("a plain valid address is accepted unchanged", () => {
  const result = prepareHandoff("name@company.com");
  assert.equal(result.ok, true);
  assert.equal(result.email, "name@company.com");
  assert.equal(result.error, "");
});

test("spaces around a valid address are removed before checking", () => {
  const result = prepareHandoff("   amnuay@gmail.com \t ");
  assert.equal(result.ok, true);
  assert.equal(result.email, "amnuay@gmail.com");
});

test("an empty box or only spaces asks for the address", () => {
  for (const blank of ["", " ", "\t\n  "]) {
    const result = prepareHandoff(blank);
    assert.equal(result.ok, false, JSON.stringify(blank));
    assert.equal(result.error, "Please enter your email address.");
    assert.equal(result.email, "");
  }
});

test("addresses with a missing part or a double @ are rejected with a helpful message", () => {
  const bad = ["name", "name@", "@company.com", "name@@company.com", "name@company", "name@company.c", "na me@company.com"];
  for (const value of bad) {
    const result = prepareHandoff(value);
    assert.equal(result.ok, false, value);
    assert.equal(result.error, "Please enter a valid email address, for example name@company.com.", value);
  }
});

test("a local part that starts or ends with a dot, or has two dots in a row, is rejected", () => {
  for (const value of [".name@company.com", "name.@company.com", "na..me@company.com"]) {
    assert.equal(prepareHandoff(value).ok, false, value);
  }
});

test("Thai letters in the address are rejected, because the address must be English letters", () => {
  assert.equal(prepareHandoff("สมชาย@company.com").ok, false);
});

test("an address of exactly 254 characters is accepted, and 255 characters is rejected", () => {
  const labelA = "a".repeat(63);
  const labelB = "b".repeat(63);
  const exact = "a".repeat(64) + "@" + labelA + "." + labelB + "." + "c".repeat(57) + ".com";
  assert.equal(exact.length, 254);
  const acceptedResult = prepareHandoff(exact);
  assert.equal(acceptedResult.ok, true);
  assert.equal(acceptedResult.email.length, 254);

  const oneOver = "a".repeat(64) + "@" + labelA + "." + labelB + "." + "c".repeat(58) + ".com";
  assert.equal(oneOver.length, 255);
  const rejectedResult = prepareHandoff(oneOver);
  assert.equal(rejectedResult.ok, false);
  assert.equal(rejectedResult.error, "Your email address must be 254 characters or fewer.");
});

test("a long address made of 256 characters gives the length message, not a crash", () => {
  const result = prepareHandoff("x".repeat(256));
  assert.equal(result.ok, false);
  assert.equal(result.error, "Your email address must be 254 characters or fewer.");
});

test("non-text input throws a TypeError, because it is a programming mistake", () => {
  for (const bad of [null, undefined, 42, {}, ["a@b.co"], true]) {
    assert.throws(() => prepareHandoff(bad), TypeError, String(bad));
  }
});

test("results are frozen so nobody can change them later", () => {
  const ok = prepareHandoff("a@b.co");
  const bad = prepareHandoff("");
  assert.equal(Object.isFrozen(ok), true);
  assert.equal(Object.isFrozen(bad), true);
  assert.throws(() => {
    "use strict";
    ok.email = "changed@x.co";
  }, TypeError);
});
