// Verifies compendium generation.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const manifestPath = "compendium/data/manifest.json";
const indexPath = "compendium/data/index.json";

assert.ok(
  fs.existsSync(manifestPath) && fs.existsSync(indexPath),
  "Run npm run build:compendium before the compendium tests.",
);

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const index = JSON.parse(fs.readFileSync(indexPath, "utf8")).entries;

assert.equal(manifest.inputFiles, 1951);
assert.ok(index.length > 10000);
assert.equal(new Set(index.map((entry) => entry.id)).size, index.length);

const removedFeatureNames = new Set([
  "Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma",
  "Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan",
  "Good", "Neutral", "Evil",
  "Acid", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Poison", "Psychic", "Radiant", "Thunder",
  "Feat", "Level 4: Ability Score Improvement", "Level 19: Epic Boon",
  "Extra Attack", "Level 5: Extra Attack", "Level 6: Extra Attack",
  "Werebat Speed", "Werebear Speed", "Wereboar Speed", "Wererat Speed", "Wereraven Speed", "Weretiger Speed", "Werewolf Speed",
]);
assert.ok(!index.some((entry) => entry.type === "Ability Score Improvement"));
assert.ok(!index.some((entry) => entry.category === "features" && removedFeatureNames.has(entry.name)));
assert.ok(!index.some((entry) => entry.category === "features" && /^Ability Score (?:Improvement|Increase \()/.test(entry.name)));
assert.ok(!index.some((entry) => entry.category === "features" && /^[0-9]+ feet$/.test(entry.name)));

const duplicateKeys = index.map((entry) =>
  JSON.stringify([entry.type, entry.name, entry.publication, entry.summary]),
);
assert.equal(new Set(duplicateKeys).size, duplicateKeys.length);

const oathbreaker = index.find(
  (entry) => entry.name === "Oathbreaker" && entry.type === "Archetype",
);
assert.ok(oathbreaker, "Oathbreaker subclass should be indexed.");
assert.equal(oathbreaker.id, "dmgSubclassOathbreaker");
assert.equal(oathbreaker.add.target, "subclass");
assert.equal(oathbreaker.add.value, "Oathbreaker");

const subclasses = JSON.parse(
  fs.readFileSync("compendium/data/subclasses.json", "utf8"),
).entries;
const fullOathbreaker = subclasses.find(
  (entry) => entry.id === "dmgSubclassOathbreaker",
);
assert.ok(fullOathbreaker.description.length > oathbreaker.summary.length);
assert.match(fullOathbreaker.description, /sacred oaths/i);
assert.ok(fullOathbreaker.rules.grants.length > 0);

const friends = index.find(
  (entry) => entry.name === "Friends" && entry.type === "Spell",
);
assert.ok(friends, "Friends should be indexed.");
assert.equal(friends.add.target, "spells");
assert.equal(friends.add.value.name, "Friends");
assert.ok(friends.summary.length > 20);

const shortsword = index.find((entry) => entry.id === "phb24WeaponShortsword");
assert.deepEqual(shortsword.facets.kinds, ["Weapons", "Martial Melee", "Swords"]);
assert.deepEqual(shortsword.facets.damageTypes, ["Piercing"]);
assert.ok(shortsword.facets.keywords.includes("Finesse"));

const pageHTML = fs.readFileSync("compendium/index.html", "utf8");
for (const id of [
  "compendium-type", "compendium-kind", "compendium-damage",
  "compendium-rarity", "compendium-attunement", "compendium-level",
  "compendium-school",
]) assert.match(pageHTML, new RegExp(`id="${id}"`));
const pageCode = fs.readFileSync("compendium/js/page.js", "utf8");
assert.match(pageCode, /data-technical-identifiers/);
assert.doesNotMatch(pageCode, /<strong>Supports:<\/strong>/);

for (const category of manifest.categories) {
  assert.ok(fs.existsSync(`compendium/data/${category.file}`));
}

console.log("Compendium generation tests passed.");
