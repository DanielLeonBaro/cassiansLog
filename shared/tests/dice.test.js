// Verifies dice formula parsing and rolling.
import assert from "node:assert/strict";
import {
  appendDieToFormula,
  parseDiceFormula,
  rollDiceFormula,
} from "../js/dice/formula.js";
import {
  clearDiceHistory,
  loadDiceHistory,
  MAX_DICE_HISTORY,
  normalizeDiceHistory,
  recordDiceHistory,
} from "../js/dice/history.js";

function deterministicRoller(values) {
  const remaining = [...values];
  return () => remaining.shift();
}

const simple = rollDiceFormula(
  "2d20+4",
  deterministicRoller([5, 20]),
);
assert.equal(simple.total, 29);
assert.equal(simple.parts.map((part) => part.text).join(""), "(5 + 20) + 4");
assert.equal(simple.parts.find((part) => part.text === "20").tone, "maximum");

const criticals = rollDiceFormula(
  "2d20",
  deterministicRoller([1, 20]),
);
assert.equal(criticals.parts.find((part) => part.text === "1").tone, "minimum");
assert.equal(criticals.parts.find((part) => part.text === "20").tone, "maximum");

const complex = rollDiceFormula(
  "2(2d6+4)+1d4+1",
  deterministicRoller([5, 2, 1, 1, 2]),
);
assert.equal(complex.total, 20);
assert.equal(
  complex.parts.map((part) => part.text).join(""),
  "((5 + 2) + 4) + ((1 + 1) + 4) + 2 + 1",
);

assert.throws(() => parseDiceFormula("0d6"), /Dice count/);
assert.throws(() => parseDiceFormula("2d1"), /Die sides/);
assert.throws(() => rollDiceFormula("1/0"), /divide by zero/);
assert.throws(() => parseDiceFormula("101(d6)"), /repeats/);
assert.equal(appendDieToFormula("", 4), "1d4");
assert.equal(appendDieToFormula("2d20", 20), "2d20+1d20");
assert.equal(appendDieToFormula("2d6+", 8), "2d6+1d8");
assert.equal(appendDieToFormula(" 1d10 ", 100), "1d10+1d100");
assert.throws(() => appendDieToFormula("d20", 3), /Unsupported/);

const stored = new Map();
globalThis.localStorage = {
  getItem: (key) => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, String(value)),
  removeItem: (key) => stored.delete(key),
};
const historyEntry = {
  label: "Shortsword Attack",
  formula: "1d20+8",
  total: 14,
  parts: [{ text: "6", tone: "normal" }, { text: " + " }, { text: "8" }],
  rolledAt: "2026-09-13T00:00:00.000Z",
};
recordDiceHistory("test-rolls", historyEntry);
assert.deepEqual(loadDiceHistory("test-rolls")[0], {
  ...historyEntry,
  parts: [
    { text: "6", tone: "normal" },
    { text: " + ", tone: "normal" },
    { text: "8", tone: "normal" },
  ],
});
const oversized = Array.from({ length: MAX_DICE_HISTORY + 10 }, (_, index) => ({ ...historyEntry, total: index }));
assert.equal(normalizeDiceHistory(oversized).length, MAX_DICE_HISTORY);
clearDiceHistory("test-rolls");
assert.deepEqual(loadDiceHistory("test-rolls"), []);

console.log("Dice formula tests passed.");
