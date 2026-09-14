// Verifies rules-ready inventory instances, equipment calculations, and runtime transitions.
import assert from "node:assert/strict";
import { evaluateCharacter } from "../js/rules/engine.js";
import {
  applyCharacterRest,
  normalizeCharacterRuntime,
  setRuntimeInventoryItem,
  spendRuntimeItemCharge,
} from "../js/rules/runtime.js";

function entry({
  id,
  originalId = `ID_${id.toUpperCase()}`,
  name = id,
  type = "Item",
  ruleset = "5e",
  grants = [],
  stats = [],
  inventory,
  hitDie = "",
  automation = "rules-ready",
}) {
  return {
    id,
    originalId,
    name,
    type,
    category: type === "Class" ? "classes" : type === "Race" ? "races" : "items",
    publication: ruleset === "5.5e" ? "Player's Handbook (2024)" : "Player's Handbook",
    source: ruleset === "5.5e" ? "Player's Handbook (2024)" : "Player's Handbook",
    publisher: "Wizards of the Coast",
    ruleset,
    automation: { status: automation, reasons: [], expressions: [] },
    prerequisite: "",
    requirements: "",
    setters: hitDie ? { hd: hitDie } : {},
    rules: { grants, selections: [], stats, ...(inventory ? { inventory } : {}) },
  };
}

const items = [
  entry({ id: "fighter", name: "Fighter", type: "Class", hitDie: "d10", grants: [{ id: "ID_LONGSWORD_PROF" }, { id: "ID_LONGSWORD_MASTERY" }] }),
  entry({ id: "human", name: "Human", type: "Race", stats: [{ name: "innate speed", value: "30", bonus: "base" }] }),
  entry({ id: "longswordProficiency", originalId: "ID_LONGSWORD_PROF", name: "Longsword Proficiency", type: "Proficiency" }),
  entry({ id: "longswordMastery", originalId: "ID_LONGSWORD_MASTERY", name: "Longsword Mastery", type: "Proficiency" }),
  entry({ id: "backpack", name: "Backpack", inventory: { weight: 5, cost: { gp: 2 }, container: { capacityWeight: 30 } } }),
  entry({ id: "pouch", name: "Pouch", inventory: { weight: 1, cost: { sp: 5 }, container: { capacityWeight: 6 } } }),
  entry({ id: "rations", name: "Rations", inventory: { weight: 2, cost: { sp: 5 } } }),
  entry({ id: "longsword", name: "Longsword +1", type: "Weapon", inventory: {
    weight: 3,
    cost: { gp: 15 },
    weapon: {
      attackType: "melee", damage: "1d8", damageType: "Slashing", versatile: "1d10",
      properties: ["Versatile"], proficiency: "ID_LONGSWORD_PROF", bonus: 1,
      mastery: "Sap", masteryId: "ID_LONGSWORD_MASTERY",
    },
  } }),
  entry({ id: "chainMail", name: "Chain Mail", type: "Armor", inventory: { weight: 55, cost: { gp: 75 }, armor: { type: "heavy", base: 16, dexterity: "none" } } }),
  entry({ id: "shield", name: "Shield", type: "Armor", inventory: { weight: 6, cost: { gp: 10 }, armor: { type: "shield", bonus: 2 } } }),
  entry({ id: "boots", name: "Boots of Speed", stats: [{ name: "speed:misc", value: "5", equipped: "boots" }], inventory: { weight: 2, equippable: true, canAttune: true, attunementRequired: true } }),
  entry({ id: "ringOne", name: "Ring One", inventory: { canAttune: true } }),
  entry({ id: "ringTwo", name: "Ring Two", inventory: { canAttune: true } }),
  entry({ id: "ringThree", name: "Ring Three", inventory: { canAttune: true } }),
  entry({ id: "wand", name: "Wand", inventory: { weight: 1, charges: { max: 7, reset: "long" } } }),
  entry({ id: "uncertified", name: "Uncertified Trinket", automation: "partial", inventory: { weight: 100 } }),
];

function character(ruleset = "5e") {
  return {
    id: "inventory-rules",
    name: "Inventory Rules",
    size: "Medium",
    currency: { gp: 5 },
    characterSchemaVersion: 2,
    build: {
      version: 1,
      mode: "rules",
      status: "complete",
      ruleset,
      preferences: { hitPoints: "fixed", encumbrance: "variant", coinWeight: true, prerequisites: true, enabledSources: [] },
      levels: [{ classId: "fighter", level: 5 }],
      speciesId: "human",
      abilityScores: { method: "manual", base: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 8 } },
      selections: {},
      spells: {},
      inventory: [
        { instanceId: "pack", definitionId: "backpack", quantity: 1 },
        { instanceId: "pouch", definitionId: "pouch", quantity: 1, containerId: "pack" },
        { instanceId: "food", definitionId: "rations", quantity: 5, containerId: "pouch" },
        { instanceId: "blade", definitionId: "longsword", quantity: 1 },
        { instanceId: "armor", definitionId: "chainMail", quantity: 1 },
        { instanceId: "shield", definitionId: "shield", quantity: 1 },
        { instanceId: "boots", definitionId: "boots", quantity: 1 },
        { instanceId: "ring-1", definitionId: "ringOne", quantity: 1 },
        { instanceId: "ring-2", definitionId: "ringTwo", quantity: 1 },
        { instanceId: "ring-3", definitionId: "ringThree", quantity: 1 },
        { instanceId: "wand", definitionId: "wand", quantity: 1 },
      ],
      overrides: {},
    },
  };
}

const runtime = {
  currency: { gp: 100 },
  inventory: [
    { instanceId: "food", quantity: 4 },
    { instanceId: "blade", equipped: true },
    { instanceId: "armor", equipped: true },
    { instanceId: "shield", equipped: true },
    { instanceId: "boots", equipped: true, attuned: true },
    { instanceId: "ring-1", attuned: true },
    { instanceId: "ring-2", attuned: true },
    { instanceId: "ring-3", attuned: true },
    { instanceId: "wand", charges: { current: 2 } },
  ],
};

const source = character();
const snapshot = structuredClone({ source, items, runtime });
const result = evaluateCharacter({ character: source, catalog: items, runtime });
assert.deepEqual({ source, items, runtime }, snapshot, "inventory evaluation must not mutate inputs");
assert.equal(result.sheet.inventory.length, 11);
assert.equal(result.sheet.inventory.find((item) => item.instanceId === "food").quantity, 4, "runtime quantity is authoritative");
assert.equal(result.sheet.inventory.find((item) => item.instanceId === "pouch").contentsWeight, 8);
assert.equal(result.sheet.inventory.find((item) => item.instanceId === "pack").contentsWeight, 9);
assert.ok(result.warnings.some((warning) => warning.code === "container-over-capacity" && warning.sourceId === "pouch"));
assert.equal(result.sheet.inventoryWeight, 83, "81 lb. equipment plus 2 lb. of coins");
assert.deepEqual(result.sheet.currency, { cp: 0, sp: 0, ep: 0, gp: 100, pp: 0, totalCopper: 10000, weight: 2 });
assert.deepEqual(result.sheet.inventoryCost, { cp: 0, sp: 25, ep: 0, gp: 102, pp: 0 });
assert.equal(result.sheet.encumbrance.status, "encumbered");
assert.equal(result.sheet.encumbrance.capacity, 240);
assert.equal(result.sheet.ac, 18);
assert.deepEqual(result.trace.ac.sources.map((item) => item.kind), ["equipment", "equipment"]);
assert.equal(result.sheet.movement.walk, 25, "active boots and variant encumbrance both modify movement");
assert.ok(result.trace["movement.walk"].sources.some((item) => item.sourceId === "inventory:boots"));
assert.equal(result.trace["movement.walk"].sources.at(-1).sourceId, "encumbrance");
assert.equal(result.sheet.inventory.find((item) => item.instanceId === "ring-3").attuned, false);
assert.ok(result.warnings.some((warning) => warning.code === "attunement-limit" && warning.sourceId === "ring-3"));
const blade = result.sheet.actions.find((action) => action.instanceId === "blade");
assert.deepEqual({ attack: blade.attack, damage: blade.damage, versatile: blade.versatileDamage }, {
  attack: "+7 vs AC", damage: "1d8+4 Slashing", versatile: "1d10+4 Slashing",
});
assert.equal(blade.proficient, true);
assert.equal(blade.mastery, "Sap");
assert.equal(blade.masteryActive, true);
assert.deepEqual(result.sheet.actions.find((action) => action.id === "unarmed-strike").effects, ["Damage"]);
assert.equal(result.trace["actions.weapon:blade.attack"].value, 7);
assert.equal(result.sheet.inventory.find((item) => item.instanceId === "blade").cost.gp, 15);

const normalized = normalizeCharacterRuntime({ runtime, sheet: result.sheet });
assert.equal(normalized.inventory.find((item) => item.instanceId === "wand").charges.current, 2);
const spent = spendRuntimeItemCharge({ runtime, sheet: result.sheet, instanceId: "wand", amount: 2 });
assert.equal(spent.applied, true);
assert.equal(spent.runtime.inventory.find((item) => item.instanceId === "wand").charges.current, 0);
assert.equal(spendRuntimeItemCharge({ runtime: spent.runtime, sheet: result.sheet, instanceId: "wand" }).warning.code, "insufficient-item-charges");
const restored = applyCharacterRest({ runtime: spent.runtime, sheet: result.sheet, ruleset: "5e", kind: "long" });
assert.equal(restored.runtime.inventory.find((item) => item.instanceId === "wand").charges.current, 7);
assert.ok(restored.changes.includes("inventory.wand.charges"));

const moved = setRuntimeInventoryItem({ runtime, sheet: result.sheet, instanceId: "food", changes: { quantity: 3, containerId: "pack" } });
assert.equal(moved.applied, true);
assert.deepEqual(moved.runtime.inventory.find((item) => item.instanceId === "food"), {
  instanceId: "food", quantity: 3, containerId: "pack", equipped: false, attuned: false,
});
assert.equal(setRuntimeInventoryItem({ runtime, sheet: result.sheet, instanceId: "pack", changes: { containerId: "pouch" } }).warning.code, "inventory-container-cycle");
assert.equal(setRuntimeInventoryItem({ runtime, sheet: result.sheet, instanceId: "ring-3", changes: { attuned: true } }).warning.code, "attunement-limit");

const inactiveRuntime = structuredClone(runtime);
inactiveRuntime.inventory.find((item) => item.instanceId === "boots").attuned = false;
assert.equal(evaluateCharacter({ character: character(), catalog: items, runtime: inactiveRuntime }).sheet.movement.walk, 20);

const duplicateAttunement = character();
duplicateAttunement.build.inventory = [
  { instanceId: "boots", definitionId: "boots", quantity: 1 },
  { instanceId: "boots-copy", definitionId: "boots", quantity: 1 },
];
const duplicateAttunementResult = evaluateCharacter({
  character: duplicateAttunement,
  catalog: items,
  runtime: { inventory: [
    { instanceId: "boots", equipped: true, attuned: true },
    { instanceId: "boots-copy", equipped: true, attuned: true },
  ] },
});
assert.equal(duplicateAttunementResult.sheet.inventory.find((item) => item.instanceId === "boots-copy").attuned, false);
assert.ok(duplicateAttunementResult.warnings.some((warning) => warning.code === "duplicate-item-attunement"));

const overloaded = character();
overloaded.build.inventory.push({ instanceId: "bulk", definitionId: "rations", quantity: 50 });
const overloadedResult = evaluateCharacter({ character: overloaded, catalog: items, runtime });
assert.equal(overloadedResult.sheet.encumbrance.status, "heavily-encumbered");
assert.equal(overloadedResult.sheet.encumbrance.speedPenalty, 20);
assert.equal(overloadedResult.sheet.movement.walk, 15, "variant burden applies after equipment speed modifiers");

const modern = character("5.5e");
modern.build.levels[0].classId = "fighter55";
modern.build.speciesId = "human55";
const modernCatalog = [
  entry({ id: "fighter55", name: "Fighter", type: "Class", ruleset: "5.5e", hitDie: "d10", grants: [{ id: "ID_LONGSWORD_PROF" }, { id: "ID_LONGSWORD_MASTERY" }] }),
  entry({ id: "human55", name: "Human", type: "Race", ruleset: "5.5e", stats: [{ name: "innate speed", value: "30", bonus: "base" }] }),
  ...items.filter((item) => !["fighter", "human", "longswordProficiency", "longswordMastery"].includes(item.id)).map((item) => ({ ...structuredClone(item), ruleset: "5.5e" })),
  { ...structuredClone(items.find((item) => item.id === "longswordProficiency")), ruleset: "agnostic" },
  { ...structuredClone(items.find((item) => item.id === "longswordMastery")), ruleset: "agnostic" },
];
const modernResult = evaluateCharacter({ character: modern, catalog: modernCatalog, runtime });
assert.equal(modernResult.sheet.encumbrance.mode, "standard");
assert.ok(modernResult.warnings.some((warning) => warning.code === "unsupported-encumbrance-variant"));
assert.deepEqual(modernResult.sheet.actions.find((action) => action.id === "unarmed-strike").effects, ["Damage", "Grapple", "Shove"]);
const modernOverloaded = structuredClone(modern);
modernOverloaded.build.inventory.push({ instanceId: "modern-bulk", definitionId: "rations", quantity: 100 });
const modernOverloadedResult = evaluateCharacter({ character: modernOverloaded, catalog: modernCatalog, runtime });
assert.equal(modernOverloadedResult.sheet.encumbrance.status, "over-capacity");
assert.equal(modernOverloadedResult.sheet.encumbrance.speedMaximum, 5);
assert.equal(modernOverloadedResult.sheet.movement.walk, 5);

const invalid = character();
invalid.build.inventory.push(
  { instanceId: "pack", definitionId: "rations", quantity: 1 },
  { instanceId: "uncertified", definitionId: "uncertified", quantity: 1, containerId: "missing" },
);
const invalidResult = evaluateCharacter({ character: invalid, catalog: items, runtime });
assert.ok(invalidResult.warnings.some((warning) => warning.code === "duplicate-inventory-instance-id"));
assert.ok(invalidResult.warnings.some((warning) => warning.code === "invalid-inventory-container"));
assert.ok(invalidResult.warnings.some((warning) => warning.code === "partial-automation"));
assert.equal(invalidResult.sheet.inventory.find((item) => item.instanceId === "uncertified").weight, null, "partial content must not guess weight");

console.log("Character inventory rules tests passed.");
