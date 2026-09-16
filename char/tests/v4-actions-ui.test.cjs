// Verifies V4 action, condition, rest, and confirmation UI contracts.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const index = fs.readFileSync("char/js/tracker/index.js", "utf8");
const layout = fs.readFileSync("char/js/tracker/v4-layout.js", "utf8");
const views = fs.readFileSync("char/js/tracker/views.js", "utf8");
const styles = fs.readFileSync("shared/styles/tailwind.css", "utf8");

assert.match(index, /ACTION_USAGE_OPTIONS/);
assert.match(index, /requestV4ActionUse[\s\S]*confirmV4ActionUse/);
assert.match(index, /setRuntimeCondition[\s\S]*setRuntimeConcentration/);
assert.match(index, /canEditCharacter\(\)/, "New V4 mutations need an authority guard.");
assert.match(layout, /role", "dialog"/);
assert.match(layout, /aria-modal", "true"/);
assert.match(layout, /Target damage remains outside the tracker/);
assert.match(layout, /v4-condition-status[\s\S]*aria-live="polite"/);
assert.match(views, /data-tracker-action="request-use"/);
assert.match(styles, /\.v4-use-dialog[\s\S]*fixed inset-0/);
assert.match(styles, /focus-visible:ring-2/);

console.log("V4 Character action and runtime UI contracts passed.");
