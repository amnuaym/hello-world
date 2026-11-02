/**
 * Tests for assets/js/steps.js (the five "How we work" steps).
 * The pure functions are tested directly. readCaption is tested with plain
 * objects that have the same shape as a button's dataset, which is the real input.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { activeStepIndex, readCaption } from "../assets/js/steps.js";

test("activeStepIndex returns the first and last valid steps", () => {
  assert.equal(activeStepIndex(5, 0), 0);
  assert.equal(activeStepIndex(5, 4), 4);
  assert.equal(activeStepIndex(1, 0), 0);
});

test("activeStepIndex rejects steps outside the list", () => {
  assert.throws(() => activeStepIndex(5, -1), RangeError);
  assert.throws(() => activeStepIndex(5, 5), RangeError);
  assert.throws(() => activeStepIndex(5, 99), RangeError);
});

test("activeStepIndex rejects counts that are not whole numbers of at least 1", () => {
  for (const bad of [0, -3, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "5", null, undefined]) {
    assert.throws(() => activeStepIndex(bad, 0), TypeError, String(bad));
  }
});

test("activeStepIndex rejects requested steps that are not whole numbers", () => {
  for (const bad of [0.5, NaN, Infinity, "1", null, undefined, {}]) {
    assert.throws(() => activeStepIndex(5, bad), TypeError, String(bad));
  }
});

test("readCaption returns the caption text from the button's data", () => {
  assert.equal(readCaption({ dataset: { caption: "Two to three weeks." } }), "Two to three weeks.");
});

test("readCaption throws when the caption is missing, empty or only spaces", () => {
  for (const dataset of [{}, { caption: "" }, { caption: "   " }, { caption: undefined }]) {
    assert.throws(() => readCaption({ dataset }), Error, JSON.stringify(dataset));
  }
});
