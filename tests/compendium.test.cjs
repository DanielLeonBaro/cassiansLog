const assert = require("node:assert/strict");
const fs = require("node:fs");

const manifestPath = "data/compendium/manifest.json";
const indexPath = "data/compendium/index.json";

assert.ok(
  fs.existsSync(manifestPath) && fs.existsSync(indexPath),
  "Run npm run build:compendium before the compendium tests.",
);

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const index = JSON.parse(fs.readFileSync(indexPath, "utf8")).entries;

assert.equal(manifest.inputFiles, 1951);
assert.ok(index.length > 10000);
assert.equal(new Set(index.map((entry) => entry.id)).size, index.length);

const oathbreaker = index.find(
  (entry) => entry.name === "Oathbreaker" && entry.type === "Archetype",
);
assert.ok(oathbreaker, "Oathbreaker subclass should be indexed.");
assert.equal(oathbreaker.id, "dmgSubclassOathbreaker");
assert.equal(oathbreaker.add.target, "subclass");
assert.equal(oathbreaker.add.value, "Oathbreaker");

const subclasses = JSON.parse(
  fs.readFileSync("data/compendium/subclasses.json", "utf8"),
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

for (const category of manifest.categories) {
  assert.ok(fs.existsSync(`data/compendium/${category.file}`));
}

console.log("Compendium generation tests passed.");
