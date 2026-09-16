// Verifies V4 layout, accessibility, live-node reuse, and styling contracts.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const layout = fs.readFileSync("char/js/tracker/v4-layout.js", "utf8");
const bridge = fs.readFileSync("char/js/tracker/layout.js", "utf8");
const tracker = fs.readFileSync("char/js/tracker/index.js", "utf8");
const styles = fs.readFileSync("shared/styles/tailwind.css", "utf8");

for (const id of [
  "v4-sheet", "v4-core", "v4-core-grid", "v4-summary-details", "v4-conditions",
  "v4-tabs", "v4-workspace", "v4-background-section", "v4-notes-host",
]) assert.ok(layout.includes(`id = \"${id}\"`) || layout.includes(`id=\"${id}\"`), `V4 should create ${id}.`);

for (const id of ["actions", "spells", "inventory", "features", "extras"]) {
  assert.match(layout, new RegExp(`id: \\"${id}\\"`));
}
for (const liveId of [
  "characterDescription", "combatAccordion", "quickStatsCard", "hpManager", "death-saves-section",
  "combatResources", "spellcastingSection", "preparedSpellsSection", "inventory-page", "notesSection",
]) assert.ok(layout.includes(`document.getElementById(\"${liveId}\")`), `V4 should move live ${liveId}.`);

assert.doesNotMatch(layout, /cloneNode|outerHTML/);
assert.match(layout, /role\", \"tablist\"/);
assert.match(layout, /aria-selected/);
assert.match(layout, /ArrowLeft/);
assert.match(styles, /\.v4-tab[\s\S]*?focus-visible:ring-2/);
assert.match(bridge, /style === \"v4\"/);
assert.match(tracker, /renderV4CoreSummary\(character\)/);
assert.match(tracker, /renderV4Stats\(container, character\)/);
assert.match(styles, /\[data-character-sheet-style="v4"\]/);
assert.match(styles, /\.v4-tabs/);
assert.match(styles, /@media \(max-width: 639px\)[\s\S]*?\[data-character-sheet-style="v4"\] main/);

console.log("V4 Character layout accessible UI contracts passed.");
