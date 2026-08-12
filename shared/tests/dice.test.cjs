const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs
  .readFileSync("shared/js/dice/formula.js", "utf8")
  .replace(/export /g, "");
const context = {};
vm.createContext(context);
vm.runInContext(
  `${source}\nglobalThis.testAPI = { appendDieToFormula, parseDiceFormula, rollDiceFormula };`,
  context,
);

function deterministicRoller(values) {
  const remaining = [...values];
  return () => remaining.shift();
}

const simple = context.testAPI.rollDiceFormula(
  "2d20+4",
  deterministicRoller([5, 20]),
);
assert.equal(simple.total, 29);
assert.equal(simple.parts.map((part) => part.text).join(""), "(5 + 20) + 4");
assert.equal(simple.parts.find((part) => part.text === "20").tone, "maximum");

const criticals = context.testAPI.rollDiceFormula(
  "2d20",
  deterministicRoller([1, 20]),
);
assert.equal(criticals.parts.find((part) => part.text === "1").tone, "minimum");
assert.equal(criticals.parts.find((part) => part.text === "20").tone, "maximum");

const complex = context.testAPI.rollDiceFormula(
  "2(2d6+4)+1d4+1",
  deterministicRoller([5, 2, 1, 1, 2]),
);
assert.equal(complex.total, 20);
assert.equal(
  complex.parts.map((part) => part.text).join(""),
  "((5 + 2) + 4) + ((1 + 1) + 4) + 2 + 1",
);

assert.throws(() => context.testAPI.parseDiceFormula("0d6"), /Dice count/);
assert.throws(() => context.testAPI.parseDiceFormula("2d1"), /Die sides/);
assert.throws(() => context.testAPI.rollDiceFormula("1/0"), /divide by zero/);
assert.throws(() => context.testAPI.parseDiceFormula("101(d6)"), /repeats/);
assert.equal(context.testAPI.appendDieToFormula("", 4), "1d4");
assert.equal(context.testAPI.appendDieToFormula("2d20", 20), "2d20+1d20");
assert.equal(context.testAPI.appendDieToFormula("2d6+", 8), "2d6+1d8");
assert.equal(context.testAPI.appendDieToFormula(" 1d10 ", 100), "1d10+1d100");
assert.throws(() => context.testAPI.appendDieToFormula("d20", 3), /Unsupported/);

console.log("Dice formula tests passed.");
