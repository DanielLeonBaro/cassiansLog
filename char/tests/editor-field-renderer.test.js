import assert from "node:assert/strict";
import { createCharacterFieldRenderer } from "../js/editor/field-renderer.js";

const draft = {
  spellcasting: { profiles: [{ id: "wizard", name: "Wizard" }] },
};
const expandedItems = new Map([["spells", 0]]);
const renderer = createCharacterFieldRenderer({
  classes: { button: "button", field: "field" },
  expandedItems,
  getDraft: () => draft,
});

assert.match(renderer.renderPrimitive("Hero", ["name"], "name"), /value="Hero"[\s\S]*required/);
assert.match(renderer.renderPrimitive("wizard", ["spells", 0, "source"], "source"), /selected>Wizard/);
assert.match(renderer.renderNode([{ name: "Fireball", category: "Spell", homebrew: true }], ["spells"], "spells"), /Fireball[\s\S]*Additional fields \(1\)/);
assert.match(renderer.renderNode([], ["inventory"], "inventory"), /No entries yet/);
const inventoryItem = renderer.renderNode({ name: "Ring", quantity: 1, description: "" }, ["inventory", 0], "Inventory 1");
assert.match(inventoryItem, /data-path="inventory\.0\.attunement"[\s\S]*type="checkbox"/);
assert.match(inventoryItem, /data-path="inventory\.0\.wearable"[\s\S]*type="checkbox"/);

console.log("Character editor field-renderer tests passed.");
