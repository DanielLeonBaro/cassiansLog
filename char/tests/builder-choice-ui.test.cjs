// Verifies accessible UI contracts for Class, Background, Species/Race, and evaluator choices.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const view = fs.readFileSync("char/js/builder/choice-step.js", "utf8");
const controller = fs.readFileSync("char/js/builder/index.js", "utf8");

for (const contract of [
  "builder-${kind}-choice",
  "builder-class-level",
  "builder-subclass-choice",
  "data-builder-rule-choice",
  "data-builder-choice-key",
  "data-builder-choice-state",
  "data-builder-coverage",
  "builder-choice-warnings-title",
]) assert.ok(view.includes(contract), `Choice steps should render ${contract}.`);
for (const step of ["class", "background", "species"]) {
  assert.match(view, new RegExp(`\\b${step}: \\{ label:`), `Choice view should define the ${step} step.`);
}

assert.match(view, /<fieldset[\s\S]*<legend/, "Rule choices must use labelled fieldsets.");
assert.match(view, /focus-visible:ring-2 focus-visible:ring-gold/, "Controls must expose keyboard focus.");
assert.match(view, /Cassian’s Log will not guess missing rule effects/);
assert.match(view, /Only subclasses linked to/);
assert.match(view, /Current certified builder slice: levels 1–5/);
assert.match(controller, /renderCharacterBuilderChoiceStep/);
assert.match(controller, /applyBuilderRuleSelection/);
assert.match(controller, /focusAfterRender\(focusId\)/);

console.log("Character Builder Class, Background, Species/Race accessible UI contracts passed.");
