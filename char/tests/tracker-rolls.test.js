// Verifies tracker formula derivation and safe roll() button rendering.
import assert from "node:assert/strict";
import {
  attackRollFormula,
  damageRollFormula,
  formulaFromRollCall,
  modifierRollFormula,
  renderRollableText,
} from "../js/tracker/rolls.js";

assert.equal(modifierRollFormula(8), "1d20+8");
assert.equal(modifierRollFormula(-2), "1d20-2");
assert.equal(attackRollFormula("+8 vs AC"), "1d20+8");
assert.equal(attackRollFormula("Melee Weapon Attack: +6 to hit"), "1d20+6");
assert.equal(attackRollFormula("roll(2d20+5)"), "2d20+5");
assert.equal(damageRollFormula("1d8 + 3 piercing"), "1d8+3");
assert.equal(damageRollFormula("1 bludgeoning"), "1");
assert.equal(formulaFromRollCall("Heal roll(1d6+2) HP"), "1d6+2");
assert.equal(formulaFromRollCall("roll(alert(1))"), "");

const markup = renderRollableText('Deal roll(1d6+2) damage, then <script>bad()</script>.');
assert.match(markup, /data-roll-formula="1d6\+2"/);
assert.match(markup, /data-roll-label="Dice Roller 1d6\+2"/);
assert.match(markup, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
assert.doesNotMatch(markup, /<script>/);

console.log("Character tracker roll-control tests passed.");
