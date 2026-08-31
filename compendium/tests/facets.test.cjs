// Verifies searchable Compendium facets derived from full entry metadata.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { compendiumFacets } = require("../scripts/facets.cjs");

function entry(file, id) {
  return JSON.parse(fs.readFileSync(`compendium/dataFullBackup/${file}`, "utf8"))
    .entries.find((item) => item.id === id);
}

const shortsword = compendiumFacets(entry("items.json", "phb24WeaponShortsword"));
assert.deepEqual(shortsword.kinds, ["Weapons", "Martial Melee", "Swords"]);
assert.deepEqual(shortsword.damageTypes, ["Piercing"]);
assert.deepEqual(shortsword.supports, [
  "Martial Melee",
  "Piercing",
  "Finesse",
  "Light",
  "Swords",
  "Vex",
]);
assert.equal(shortsword.attunement, "not-required");

const wand = compendiumFacets(entry("items.json", "totdMagicItemAnythingWand"));
assert.deepEqual(wand.kinds, ["Wands", "Wand"]);
assert.equal(wand.rarity, "Legendary");
assert.equal(wand.attunement, "required");

const spell = compendiumFacets(entry("spells.json", "xgteSpellAbiDalzimSHorridWilting"));
assert.equal(spell.spellLevel, "8");
assert.equal(spell.school, "Necromancy");
assert.deepEqual(spell.damageTypes, ["Necrotic"]);

console.log("Compendium facet derivation tests passed.");
