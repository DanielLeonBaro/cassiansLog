import assert from "node:assert/strict";
import { calculateExpression, formatCalculatorResult } from "../js/calculator.js";

assert.equal(calculateExpression("1+3/2(3+2)"), 8.5);
assert.equal(calculateExpression("2(3+2)"), 10);
assert.equal(calculateExpression("(2+1)(4-1)"), 9);
assert.equal(calculateExpression("-.5 + 2"), 1.5);
assert.equal(calculateExpression("12/3*2"), 8);
assert.equal(calculateExpression("--2 + +(3)"), 5);
assert.equal(calculateExpression("3.25 * 2"), 6.5);
assert.equal(formatCalculatorResult(1 / 3), "0.333333333333333");
assert.throws(() => calculateExpression("1/0"), /divide by zero/);
assert.throws(() => calculateExpression("2..3"), /Invalid number/);
assert.throws(() => calculateExpression("2+alert(1)"), /Unexpected/);
assert.throws(() => calculateExpression("(2+3"), /Expected/);
assert.throws(() => calculateExpression("2+"), /unexpectedly/);
assert.throws(() => calculateExpression("()"), /Expected/);
assert.throws(() => formatCalculatorResult(Infinity), /finite/);

console.log("Calculator parser tests passed.");
