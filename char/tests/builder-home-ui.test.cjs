// Verifies Character Builder Home accessibility and confirmation UI contracts.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const home = fs.readFileSync("char/js/builder/home.js", "utf8");
const builder = fs.readFileSync("char/js/builder/index.js", "utf8");
const characterModel = fs.readFileSync("char/js/model.js", "utf8");

for (const id of [
  "builder-ruleset-5e",
  "builder-ruleset-5-5e",
  "builder-filter-publisher",
  "builder-filter-automation",
  "builder-filter-sources",
  "builder-filter-sources-all",
  "builder-filter-summary",
  "builder-preference-progression",
  "builder-preference-hit-points",
  "builder-preference-encumbrance",
  "builder-preference-coin-weight",
  "builder-preference-prerequisites",
  "builder-ruleset-change-preview",
  "builder-ruleset-change-title",
  "builder-ruleset-change-cancel",
  "builder-ruleset-change-confirm",
]) assert.ok(home.includes(`id="${id}"`), `Builder Home should render ${id}.`);

assert.match(home, /multiple size=\"6\" aria-describedby=\"builder-filter-sources-help\"/);
assert.match(home, /role=\"status\" aria-live=\"polite\"/);
assert.match(home, /tabindex=\"-1\"/);
assert.match(home, /No selection enables every publication shown/);
assert.match(home, /Rulesets never mix/);
assert.match(builder, /loadCharacterBuilderCatalog/);
assert.match(builder, /previewCharacterRulesetChange/);
assert.match(builder, /renderStepContent\("builder-ruleset-change-title"\)/);
assert.match(builder, /pendingRuleset = null;[\s\S]*preview\.document/);
assert.match(characterModel, /contentFilters:[\s\S]*publisher:[\s\S]*automation:/);

console.log("Character Builder Home accessible UI contracts passed.");
