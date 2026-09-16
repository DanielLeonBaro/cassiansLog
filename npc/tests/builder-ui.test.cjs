// Verifies the NPC archive exposes the shared guided builder without replacing Quick Setup/import flows.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const archive = fs.readFileSync("npc/index.html", "utf8");
const controller = fs.readFileSync("npc/js/archive.js", "utf8");
const builder = fs.readFileSync("char/js/builder/index.js", "utf8");

for (const id of [
  "detailed-build-entry", "quick-setup-panel", "character-builder-shell",
  "character-builder-progress", "character-builder-step-title", "character-builder-save-status",
  "character-builder-quick-setup", "character-builder-back", "character-builder-next",
]) assert.ok(archive.includes(`id="${id}"`), `NPC builder should include ${id}.`);

assert.match(archive, /Detailed NPC builder/);
assert.match(archive, /Import from D&amp;D Beyond/);
assert.match(archive, /name="starterMode" value="blank"/);
assert.match(archive, /integrations\/character-compendium\/builder\.js/);
assert.match(controller, /initializeCharacterBuilderShell\(\{/);
assert.match(controller, /entityKind: "npc"/);
assert.match(controller, /finalizeDraft: finalizeNpcBuildDraft/);
assert.match(controller, /builder\?\.reset\(\)/);
assert.match(builder, /campaignPagePath\(npcMode \? "npc" : "char"\)/);
assert.match(builder, /cloudDrafts = true/);

console.log("Rules-built NPC accessible builder UI contracts passed.");
