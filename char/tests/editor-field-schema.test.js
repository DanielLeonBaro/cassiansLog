// Verifies character editor field schema.
import assert from "node:assert/strict";
import {
  CHARACTER_SECTION_KEYS,
  COLLECTION_KNOWN_FIELDS,
  EDITOR_SECTION_DEFINITIONS,
  collectionItemSummary,
  fieldPathKey,
  fieldTitle,
  isSystemField,
} from "../js/editor/field-schema.js";

assert.deepEqual(EDITOR_SECTION_DEFINITIONS.map(({ id }) => id), [
  "basics", "combat", "actions", "spellcasting", "features", "inventory", "advanced",
]);
assert.equal(CHARACTER_SECTION_KEYS.has("v1SectionOrder"), true);
assert.equal(COLLECTION_KNOWN_FIELDS.spells.has("prepared"), true);
assert.equal(COLLECTION_KNOWN_FIELDS.inventory.has("attunement"), true);
assert.equal(COLLECTION_KNOWN_FIELDS.inventory.has("wearable"), true);
assert.equal(fieldTitle("saveDC"), "Save DC");
assert.equal(fieldTitle("custom_field"), "Custom field");
assert.equal(fieldPathKey(["spellcasting", "profiles", 0, "name"]), "spellcasting.profiles.0.name");
assert.equal(isSystemField(["id"], "id"), true);
assert.equal(isSystemField(["spells", 0, "profileId"], "profileId"), false);
assert.deepEqual(collectionItemSummary({ name: "Fireball", category: "Spell", level: 3 }, "spells", 0), {
  name: "Fireball",
  details: "Spell · Level 3",
});

console.log("Character editor field-schema tests passed.");
