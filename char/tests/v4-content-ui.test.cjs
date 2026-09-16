// Guards V4 feature/Extras groups, tracking, Background details, and accessible drawer contracts.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const layout = fs.readFileSync("char/js/tracker/v4-layout.js", "utf8");
const views = fs.readFileSync("char/js/tracker/views.js", "utf8");
const tracker = fs.readFileSync("char/js/tracker/index.js", "utf8");
const entry = fs.readFileSync("char/js/entries/tracker.js", "utf8");
const editor = fs.readFileSync("char/js/editor/index.js", "utf8");

for (const id of ["v4-feature-browser", "v4-feature-groups", "v4-extras-browser", "v4-extra-groups", "v4-detail-dialog", "v4-detail-close"]) {
  assert.ok(layout.includes(`id = "${id}"`) || layout.includes(`id="${id}"`), `V4 should create ${id}.`);
}
assert.match(layout, /role", "dialog"/);
assert.match(layout, /aria-modal/);
assert.match(layout, /v4BackgroundDetails/);
assert.match(views, /data-v4-feature/);
assert.match(views, /data-v4-extra/);
assert.match(views, /data-tracker-action="extra-hp"/);
assert.match(views, /data-tracker-action="open-v4-detail"/);
assert.match(tracker, /closeV4Detail\(\)[\s\S]*?focus/);
assert.ok(entry.includes(':not([data-tracker-action="open-v4-detail"])'));
assert.match(editor, /draft\.extras/);

console.log("V4 Character feature, Extras, and detail UI tests passed.");
