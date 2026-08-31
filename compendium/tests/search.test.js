// Verifies combined Compendium facets, keywords, and friendly ID labels.
import assert from "node:assert/strict";
import { humanizeIdentifier, supportLabels } from "../js/metadata.js";
import { facetValues, filterCompendiumEntries } from "../js/search.js";

const entries = [
  {
    id: "shortsword",
    name: "Shortsword",
    category: "items",
    type: "Weapon",
    publication: "Player’s Handbook",
    summary: "A light martial blade.",
    supports: "ID_INTERNAL_WEAPON_PROPERTY_FINESSE",
    facets: {
      kinds: ["Weapons", "Swords"],
      damageTypes: ["Piercing"],
      rarity: "",
      attunement: "not-required",
      spellLevel: "",
      school: "",
      keywords: ["Finesse", "Light", "Vex"],
      supports: ["Finesse"],
    },
  },
  {
    id: "fireball",
    name: "Fireball",
    category: "spells",
    type: "Spell",
    publication: "Player’s Handbook",
    summary: "A bright streak explodes.",
    facets: {
      kinds: [],
      damageTypes: ["Fire"],
      rarity: "",
      attunement: "",
      spellLevel: "3",
      school: "Evocation",
      keywords: ["Fire"],
      supports: [],
    },
  },
];

assert.deepEqual(
  filterCompendiumEntries(entries, { type: "Weapon", kind: "Swords", damageType: "Piercing" }).map((entry) => entry.id),
  ["shortsword"],
);
assert.deepEqual(
  filterCompendiumEntries(entries, { query: "vex" }).map((entry) => entry.id),
  ["shortsword"],
);
assert.deepEqual(
  filterCompendiumEntries(entries, { spellLevel: "3", school: "Evocation" }).map((entry) => entry.id),
  ["fireball"],
);
assert.deepEqual(facetValues(entries, "damageTypes"), ["Fire", "Piercing"]);
assert.equal(
  humanizeIdentifier("ID_INTERNAL_WEAPON_CATEGORY_MARTIAL_MELEE"),
  "Martial Melee",
);
assert.equal(
  humanizeIdentifier("ID_WOTC_PHB24_WEAPON_PROPERTY_VEX"),
  "Vex",
);
assert.deepEqual(supportLabels(entries[0]), ["Finesse"]);

console.log("Compendium search and friendly metadata tests passed.");
