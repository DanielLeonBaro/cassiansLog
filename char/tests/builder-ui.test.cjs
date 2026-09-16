// Verifies accessible Character Builder entry, shell, save feedback, and archive integration contracts.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const archive = fs.readFileSync("char/index.html", "utf8");
const builder = fs.readFileSync("char/js/builder/index.js", "utf8");
const archiveController = fs.readFileSync("char/js/archive/index.js", "utf8");

for (const id of [
  "detailed-build-entry",
  "quick-setup-panel",
  "character-builder-shell",
  "character-builder-progress",
  "character-builder-step-title",
  "character-builder-step-state",
  "character-builder-save-status",
  "character-builder-retry",
  "character-builder-quick-setup",
  "character-builder-back",
  "character-builder-next",
]) assert.ok(archive.includes(`id="${id}"`), `Character Builder should include ${id}.`);

assert.match(archive, /<nav aria-label="Character builder progress">/);
assert.match(archive, /id="character-builder-step-title" tabindex="-1"/);
assert.match(archive, /id="character-builder-save-status"[^>]*role="status" aria-live="polite"/);
assert.match(archive, /id="character-builder-shell" hidden/);
assert.match(archive, /id="quick-setup-panel"/);
assert.match(archive, /Import from D&amp;D Beyond/);
assert.match(archive, /name="starterMode" value="blank"/);

for (const contract of [
  "storedCharacterBuildDrafts",
  "saveCharacterBuildDraft",
  "resumeCharacterBuilderStep",
  "aria-current",
  "dataset.builderStep",
  "Saved in this browser. Syncing with the cloud",
  "Cloud sync failed",
  "Cloud sync was interrupted",
]) assert.ok(builder.includes(contract), `Builder controller should preserve ${contract}.`);
assert.match(builder, /stepTitle\.focus\(\)/, "Step changes should move focus to the new heading.");
assert.match(builder, /retryButton\.addEventListener\("click", persist\)/);
assert.match(archiveController, /initializeCharacterBuilderShell\(\)/);
assert.match(archiveController, /builder\?\.reset\(\)/);

console.log("Character Builder accessible shell UI contracts passed.");
