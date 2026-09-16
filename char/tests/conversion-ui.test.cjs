// Verifies V4 conversion preview, permission, persistence, and rollback wiring.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const tracker = fs.readFileSync("char/js/tracker/index.js", "utf8");
const layout = fs.readFileSync("char/js/tracker/v4-layout.js", "utf8");
const conversion = fs.readFileSync("char/js/conversion.js", "utf8");
const styles = fs.readFileSync("shared/styles/tailwind.css", "utf8");
const importer = fs.readFileSync("char/js/archive/dnd-beyond-import.js", "utf8");

assert.match(layout, /id = "v4-conversion-dialog"/);
assert.match(layout, /data-conversion-group/);
for (const group of ["matched", "unresolved", "added", "removed", "changed"]) {
  assert.match(layout, new RegExp(`data-conversion-list=\\"\\$\\{group\\}`));
  assert.match(conversion, new RegExp(`\\b${group}\\b`));
}
assert.match(tracker, /loadCharacterBuilderCatalog/);
assert.doesNotMatch(tracker, /compendium\/js/, "Tracker core must use the optional catalog provider seam.");
assert.match(tracker, /canEditCharacter\(\)/);
assert.match(tracker, /dataset\?\.trackerKind !== "npc"/);
assert.match(tracker, /persistCharacterDocument/);
assert.match(tracker, /applyCharacterAutomationPreview/);
assert.match(tracker, /rollbackCharacterAutomation/);
assert.match(tracker, /closeV4Conversion/);
assert.match(styles, /\.v4-conversion-preview/);
assert.match(styles, /\.v4-conversion-open/);
assert.match(importer, /automation: "manual"/);
assert.match(importer, /method.*public-page|"public-page"/);
assert.match(importer, /"pdf"/);

console.log("V4 Character conversion preview UI contracts passed.");
