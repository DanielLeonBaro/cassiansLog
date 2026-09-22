// Verifies accessible UI contracts for Task 16 builder steps and Finish.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const files = [
  "char/js/builder/abilities.js",
  "char/js/builder/equipment.js",
  "char/js/builder/description.js",
  "char/js/builder/spells.js",
  "char/js/builder/review.js",
  "char/js/builder/choice-step.js",
].map((file) => fs.readFileSync(file, "utf8")).join("\n");
const controller = fs.readFileSync("char/js/builder/index.js", "utf8");

for (const id of [
  "character-builder-abilities",
  "builder-ability-status",
  "builder-roll-abilities",
  "character-builder-equipment",
  "builder-equipment-method-equipment",
  "builder-equipment-method-gold",
  "builder-equipment-status",
  "character-builder-description",
  "builder-character-name",
  "builder-character-id",
  "builder-description-status",
  "builder-spells-title",
  "character-builder-review",
  "builder-review-summary-title",
  "builder-finish-title",
  "builder-finish",
  "builder-finish-confirmation",
  "builder-finish-confirm",
  "builder-finish-confirm-cancel",
]) assert.ok(files.includes(`id=\"${id}\"`), `Task 16 UI should render ${id}.`);

assert.match(files, /role=\"status\" aria-live=\"polite\"/);
assert.match(files, /role=\"alert\"/);
assert.match(files, /id=\"builder-finalize-error\"[^>]+tabindex=\"-1\"/);
assert.match(files, /focus-visible:ring-2 focus-visible:ring-gold/);
assert.match(files, /Switching methods preserves existing items and coins/);
assert.match(files, /Preparation remains Character runtime state/);
assert.match(files, /mountSearchableSelection/);
assert.match(files, /Search cantrips/);
assert.match(files, /Search levelled spells/);
assert.match(files, /Search equipment/);
assert.match(files, /data-builder-inventory-container/);
assert.match(files, /data-builder-searchable-root/);
assert.match(files, /useSearchableCatalogChoice/);
assert.doesNotMatch(files, /multiple size="8"/);
assert.doesNotMatch(files, /<select id="builder-equipment-definition"/);
assert.match(files, /You may not see this information/);
assert.match(files, /calculated/);
assert.match(files, /role="alertdialog"/);
for (const contract of [
  "applyBuilderAbilityMethod",
  "addBuilderInventoryItem",
  "applyBuilderDescription",
  "applyBuilderSpellSelection",
  "prepareCharacterBuildFinalization",
  "finalizeCharacterBuildDraft",
]) assert.ok(controller.includes(contract), `Builder controller should use ${contract}.`);
assert.match(controller, /builder-finalize-error/);
assert.match(controller, /confirmIncomplete: true/);
assert.match(controller, /campaignPagePath\(npcMode \? "npc" : "char"\)/);

console.log("Character Builder Task 16 accessible UI contracts passed.");
