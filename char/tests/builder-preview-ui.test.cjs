// Verifies accessible live-preview rendering and immediate draft integration contracts.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const view = fs.readFileSync("char/js/builder/preview.js", "utf8");
const controller = fs.readFileSync("char/js/builder/index.js", "utf8");

for (const group of ["Abilities", "Saves", "Skills", "Actions & attacks", "Spells & slots", "Resources", "Proficiencies", "Inventory", "Warnings"]) {
  assert.ok(view.includes(`["${group}"`), `Live preview should render ${group}.`);
}
assert.match(view, /aria-live", "polite"/);
assert.match(view, /role", "status"/);
assert.match(controller, /renderCharacterBuilderPreview\(preview/);
assert.match(controller, /function renderProgress\(\)[\s\S]*renderCharacterBuilderPreview\(preview/);
assert.match(controller, /activeDraft = \{ \.\.\.activeDraft, document: nextDocument \};\s*renderProgress\(\);\s*await persist/);
assert.match(controller, /entityName: npcMode \? "NPC" : "Character"/);

console.log("Character Builder live-preview accessible UI contracts passed.");
