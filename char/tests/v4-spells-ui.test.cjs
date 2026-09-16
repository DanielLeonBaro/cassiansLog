// Verifies V4 spell browser, casting dialog, and accessibility contracts.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const layout = fs.readFileSync("char/js/tracker/v4-layout.js", "utf8");
const tracker = fs.readFileSync("char/js/tracker/index.js", "utf8");
const views = fs.readFileSync("char/js/tracker/views.js", "utf8");
const entry = fs.readFileSync("char/js/entries/tracker.js", "utf8");
const styles = fs.readFileSync("shared/styles/tailwind.css", "utf8");

for (const id of ["v4-spell-browser", "v4-spell-filters", "v4-spell-list", "v4-spell-cast-dialog", "v4-spell-cast-modes", "v4-spell-slot"]) {
  assert.ok(layout.includes(id), `V4 Spells should create ${id}.`);
}
assert.match(layout, /data-v4-spell-filter="search"/);
assert.match(layout, /data-v4-spell-filter="level"/);
assert.match(layout, /data-v4-spell-filter="preparation"/);
assert.match(layout, /data-v4-spell-filter="repertoire"/);
assert.match(layout, /aria-modal", "true"/);
assert.match(layout, /Target damage and healing remain outside the tracker/);
assert.match(tracker, /consumeV4SpellCast[\s\S]*planV4SpellCast/);
assert.match(tracker, /requestV4SpellCast[\s\S]*confirmV4SpellCast/);
assert.match(tracker, /closeV4SpellCastDialog[\s\S]*v4SpellReturnFocus/);
assert.match(views, /data-tracker-action="request-spell-cast"/);
assert.match(views, /data-tracker-action="prepared-spell"/);
assert.match(views, /Ritual/);
assert.match(views, /Concentration/);
assert.match(styles, /\.v4-spell-filters/);
assert.match(styles, /\.v4-spell-cast[\s\S]*focus-visible:ring-2/);
assert.match(entry, /reset-spell-filters/);
assert.match(entry, /v4-condition-form button/);

console.log("V4 Character spell UI contracts passed.");
