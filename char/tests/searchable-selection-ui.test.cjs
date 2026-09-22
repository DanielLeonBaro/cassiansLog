// Verifies reusable selector accessibility, keyboard, details, links, tooltip, and focus contracts.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const source = fs.readFileSync("char/js/builder/searchable-selection.js", "utf8");

for (const contract of [
  'role", "combobox"', 'aria-autocomplete", "list"', 'role", "listbox"', 'role", "option"',
  "aria-activedescendant", "ArrowDown", "ArrowUp", "Home", "End", "Escape", "mouseenter",
  "Open in Compendium", "Search Google", "unavailableReason", "minimumLevel", "prerequisite", "automation",
]) assert.ok(source.includes(contract), `Searchable selection should preserve ${contract}.`);
assert.match(source, /Remove \$\{entry\.name\}/);
assert.match(source, /detailReturnFocus\?\.focus\(\)/);
assert.match(source, /input\.focus\(\)/);
assert.match(source, /campaignPagePath\("compendium"\)/);
assert.match(source, /google\.rel = "noopener noreferrer"/);

console.log("Searchable builder selection accessible UI contracts passed.");
