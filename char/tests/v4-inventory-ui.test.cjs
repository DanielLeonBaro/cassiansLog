// Guards the V4 inventory browser, runtime controls, confirmation, and read-only contracts.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const layout = fs.readFileSync(path.join(root, "char/js/tracker/v4-layout.js"), "utf8");
const views = fs.readFileSync(path.join(root, "char/js/tracker/views.js"), "utf8");
const tracker = fs.readFileSync(path.join(root, "char/js/tracker/index.js"), "utf8");
const entry = fs.readFileSync(path.join(root, "char/js/entries/tracker.js"), "utf8");

assert.match(layout, /id = "v4-inventory-browser"/);
assert.match(layout, /data-v4-inventory-filter="search"/);
assert.match(layout, /id = "v4-inventory-charge-dialog"/);
assert.match(views, /data-tracker-action="inventory-quantity"/);
assert.match(views, /data-tracker-action="inventory-runtime"/);
assert.match(views, /data-v4-inventory-container/);
assert.match(views, /data-tracker-action="request-item-charge"/);
assert.match(tracker, /trackerState\.updateInventoryItemState/);
assert.match(tracker, /trackerState\.spendInventoryItemCharge/);
assert.match(entry, /main \[data-v4-inventory-container\]/);

console.log("V4 Character inventory UI tests passed.");
