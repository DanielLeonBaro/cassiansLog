const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const textCode = fs.readFileSync("shared/js/text.js", "utf8").replace(/export /g, "");
const mappingCode = fs.readFileSync("integrations/character-compendium/mapping.js", "utf8")
  .replace(/^import .*\r?\n/gm, "")
  .replace(/export /g, "");
const context = {};
vm.createContext(context);
vm.runInContext(`${textCode}\n${mappingCode}\nglobalThis.api = { addCompendiumEntry, hasCompendiumEntry };`, context);

const character = {
  class: "Fighter",
  spellcasting: { profiles: [{ id: "wizard" }] },
  spells: [],
  inventory: [],
  features: [],
};
const classEntry = { id: "class-wizard", add: { target: "class", value: "Wizard" } };
assert.equal(context.api.addCompendiumEntry(character, classEntry), true);
assert.equal(character.class, "Wizard");
assert.equal(context.api.hasCompendiumEntry(character, classEntry), true);

const spellEntry = { id: "spell-light", add: { target: "spells", value: { id: "spell-light", name: "Light", source: "" } } };
context.api.addCompendiumEntry(character, spellEntry);
assert.equal(character.spells[0].source, "wizard");
assert.equal(context.api.hasCompendiumEntry(character, spellEntry), true);

const itemEntry = { id: "item-potion", add: { target: "inventory", value: { id: "item-potion", name: "Potion", quantity: 1 } } };
context.api.addCompendiumEntry(character, itemEntry);
context.api.addCompendiumEntry(character, itemEntry);
assert.equal(character.inventory.length, 1);
assert.equal(character.inventory[0].quantity, 2);

const adapter = fs.readFileSync("integrations/character-compendium/index.js", "utf8");
assert.match(adapter, /registerCharacterEditorExtension/);
assert.match(adapter, /optional Compendium integration is unavailable/);
assert.match(adapter, /data-compendium-target/);
assert.match(adapter, /Add another/, "Inventory entries should remain addable so quantity can increase.");

const editor = fs.readFileSync("char/js/editor/index.js", "utf8");
assert.doesNotMatch(editor, /compendium/i, "The Character editor core must not contain Compendium behavior.");

console.log("Optional Character–Compendium integration tests passed.");
