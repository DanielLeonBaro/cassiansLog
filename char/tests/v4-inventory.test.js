// Verifies V4 inventory normalization, filtering, container choices, and derived totals.
import assert from "node:assert/strict";
import {
  createV4InventoryFilterState,
  v4InventoryItemMatches,
  v4InventoryItemModel,
  v4InventorySummary,
} from "../js/tracker/v4-inventory.js";

const inventory = [
  { instanceId: "pack", definitionId: "backpack", name: "Backpack", quantity: 1, automatic: true, containerId: "", weight: 5, unitWeight: 5, containerCapacity: 30, contentsWeight: 4 },
  { instanceId: "rope", definitionId: "rope", name: "Silk Rope", quantity: 1, automatic: true, containerId: "pack", weight: 5, unitWeight: 5, containerCapacity: null, canEquip: false, canAttune: false },
  { instanceId: "wand", definitionId: "wand", name: "Unstable Wand", quantity: 1, automatic: false, containerId: "", weight: null, unitWeight: null, containerCapacity: null, canEquip: true, canAttune: true, charges: { current: 3, max: 7, reset: "long" } },
];
const models = inventory.map((item, index) => v4InventoryItemModel(item, index === 1
  ? { quantity: 3, containerId: "pack" }
  : index === 2 ? { equipped: true, attuned: true, charges: { current: 2 } } : {}, inventory));

assert.deepEqual(createV4InventoryFilterState(), { search: "", status: "", container: "" });
assert.deepEqual(models[1].containers, [{ id: "pack", name: "Backpack" }]);
assert.equal(models[2].automatic, false, "Partial entries remain visibly manual.");
assert.equal(models[2].runtimeManaged, true, "Rules inventory instances still retain safe runtime controls.");
assert.equal(models[2].charges.current, 2);
assert.equal(v4InventoryItemMatches(models[1], { search: "silk backpack", status: "", container: "" }), true);
assert.equal(v4InventoryItemMatches(models[1], { search: "", status: "", container: "contained" }), true);
assert.equal(v4InventoryItemMatches(models[0], { search: "", status: "containers", container: "" }), true);
assert.equal(v4InventoryItemMatches(models[2], { search: "", status: "manual", container: "" }), true);
assert.equal(v4InventoryItemMatches(models[0], { search: "", status: "attuned", container: "" }), false);

assert.deepEqual(v4InventorySummary({
  inventoryWeight: 81,
  encumbrance: { mode: "variant", capacity: 120, status: "encumbered" },
}, models), {
  count: 5,
  attuned: 1,
  attunementLimit: 3,
  weight: 91,
  capacity: 120,
  encumbrance: "heavily-encumbered",
});

console.log("V4 Character inventory model tests passed.");
