// Verifies character tracker inventory state.
import assert from "node:assert/strict";
import { createTrackerState } from "../js/tracker/state.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

globalThis.localStorage = memoryStorage();
globalThis.sessionStorage = memoryStorage();
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });

const character = {
  id: "inventory-state-test",
  hp: { current: 10, max: 10, temp: 0 },
  deathSaves: { failures: 0, successes: 0, stable: 0 },
  hitDice: [{ die: "d8", current: 2, max: 3 }],
  conditions: [{ id: "poisoned", name: "Poisoned", reset: "manual" }],
  concentration: { id: "bless", name: "Bless" },
  exhaustion: 1,
  inventory: [
    { name: "Rope", quantity: 1 },
    { name: "Ring", quantity: 1, attunement: true },
    { name: "Cloak", quantity: 1, attunement: 1, wearable: 1 },
  ],
};
const dependencies = {
  character,
  getAllCharacterItems: () => [],
  getSpellSlots: () => [],
  findCharacterItem: () => null,
  findSpellSlot: () => null,
  enforcePreparedLimits: () => {},
};
const state = createTrackerState(dependencies);

assert.equal(state.toggleInventoryItemState(0, "attuned"), false, "Plain items cannot become attuned.");
assert.equal(state.toggleInventoryItemState(1, "wearing"), false, "Non-wearable items cannot be worn.");
assert.equal(state.toggleInventoryItemState(1, "attuned"), true);
assert.equal(state.toggleInventoryItemState(2, "wearing"), true);
assert.deepEqual(state.getInventoryItemState(1), { attuned: true, wearing: false });
assert.deepEqual(state.getInventoryItemState(2), { attuned: false, wearing: true });

state.save();
const saved = JSON.parse(localStorage.getItem("dnd-inventory-state-test-state"));
assert.deepEqual(saved.inventory[1], { key: "name:Ring:1", attuned: true, wearing: false });
assert.deepEqual(saved.hitDice, [{ die: "d8", current: 2 }]);
assert.deepEqual(saved.conditions, [{ id: "poisoned", name: "Poisoned", reset: "manual" }]);
assert.deepEqual(saved.concentration, { id: "bless", name: "Bless" });
assert.equal(saved.exhaustion, 1);

localStorage.setItem("dnd-inventory-state-test-state", JSON.stringify({
  ...saved,
  hitDice: [{ die: "d8", current: 1 }],
  conditions: [{ id: "frightened", name: "Frightened", reset: "short" }],
  concentration: null,
  exhaustion: 3,
  futureRuntimeField: { preserved: true },
}));

const restored = createTrackerState(dependencies);
restored.load();
assert.deepEqual(restored.getInventoryItemState(1), { attuned: true, wearing: false });
assert.deepEqual(restored.getInventoryItemState(2), { attuned: false, wearing: true });
assert.equal(character.hitDice[0].current, 1);
assert.deepEqual(character.conditions, [{ id: "frightened", name: "Frightened", reset: "short" }]);
assert.equal(character.concentration, null);
assert.equal(character.exhaustion, 3);
restored.save();
assert.deepEqual(
  JSON.parse(localStorage.getItem("dnd-inventory-state-test-state")).futureRuntimeField,
  { preserved: true },
  "unknown runtime fields must survive load/save",
);

const automaticCharacter = {
  id: "automatic-inventory-state-test",
  hp: { current: 10, max: 10, temp: 0 },
  deathSaves: {},
  inventory: [
    { instanceId: "pack", definitionId: "backpack", name: "Backpack", quantity: 1, automatic: true, containerId: "", canEquip: false, canAttune: false, containerCapacity: 30 },
    { instanceId: "boots", definitionId: "boots", name: "Boots", quantity: 1, automatic: true, containerId: "", canEquip: true, canAttune: true, containerCapacity: null },
    { instanceId: "ring-1", definitionId: "ring-1", name: "Ring 1", quantity: 1, automatic: true, canEquip: false, canAttune: true, containerCapacity: null },
    { instanceId: "ring-2", definitionId: "ring-2", name: "Ring 2", quantity: 1, automatic: true, canEquip: false, canAttune: true, containerCapacity: null },
    { instanceId: "ring-3", definitionId: "ring-3", name: "Ring 3", quantity: 1, automatic: true, canEquip: false, canAttune: true, containerCapacity: null },
    { instanceId: "wand", definitionId: "wand", name: "Wand", quantity: 1, automatic: true, canEquip: false, canAttune: false, containerCapacity: null, charges: { current: 2, max: 2, reset: "long" } },
  ],
};
const automatic = createTrackerState({ ...dependencies, character: automaticCharacter });
assert.equal(automatic.updateInventoryItemState(1, { equipped: true, attuned: true }).applied, true);
assert.equal(automatic.updateInventoryItemState(2, { attuned: true }).applied, true);
assert.equal(automatic.updateInventoryItemState(3, { attuned: true }).applied, true);
assert.equal(automatic.updateInventoryItemState(4, { attuned: true }).warning.code, "attunement-limit");
assert.equal(automatic.updateInventoryItemState(1, { quantity: 2, containerId: "pack" }).applied, true);
assert.deepEqual(automatic.getInventoryItemState(1), { quantity: 2, containerId: "pack", equipped: true, attuned: true });
assert.equal(automatic.spendInventoryItemCharge(5).applied, true);
assert.equal(automatic.getInventoryItemState(5).charges.current, 1);
automatic.save();
const automaticSaved = JSON.parse(localStorage.getItem("dnd-automatic-inventory-state-test-state"));
assert.deepEqual(automaticSaved.inventory.find((item) => item.instanceId === "boots"), {
  key: "instance:boots", instanceId: "boots", quantity: 2, containerId: "pack", equipped: true, attuned: true,
});
assert.equal(automaticSaved.inventory.find((item) => item.instanceId === "wand").charges.current, 1);

automaticCharacter.extras = [{ id: "owl", name: "Owl", hp: { current: 3, max: 5, temp: 1 }, uses: { current: 1, max: 2 } }];
const extraState = createTrackerState({
  ...dependencies,
  character: automaticCharacter,
  getAllCharacterItems: () => automaticCharacter.extras,
  findCharacterItem: (id) => automaticCharacter.extras.find((item) => item.id === id),
});
extraState.save();
automaticCharacter.extras[0].hp.current = 5;
automaticCharacter.extras[0].hp.temp = 0;
extraState.load();
assert.deepEqual(automaticCharacter.extras[0].hp, { current: 3, max: 5, temp: 1 });

console.log("Character tracker inventory state tests passed.");
