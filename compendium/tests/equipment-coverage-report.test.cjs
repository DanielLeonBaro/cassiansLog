// Verifies equipment metadata and dual-edition fixture boundaries.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { buildEquipmentCoverageReport, validateEquipmentCoverageReport } = require("../scripts/equipment-coverage-report.cjs");

const entries = [
  { id: "sword", originalId: "ID_SWORD", name: "Sword", type: "Weapon", category: "items", publication: "Core", facets: { supports: ["Slashing"], damageTypes: ["Slashing"], attunement: "not-required" }, setters: { damage: "1d8", weight: "3 lb.", cost: "15", range: "5 feet" }, rules: {} },
  { id: "armor", originalId: "ID_ARMOR", name: "Mail", type: "Armor", category: "items", publication: "Core 2024", facets: { supports: [], damageTypes: [], attunement: "not-required" }, setters: { armor: "Heavy", armorClass: "16", weight: "55 lb.", cost: "75" }, rules: {} },
  { id: "pack", originalId: "ID_PACK", name: "Pack", type: "Item", category: "items", publication: "Core", facets: { supports: [], damageTypes: [], attunement: "not-required" }, setters: { container: "30 lb.", weight: "5 lb.", cost: "2" }, rules: {} },
];
const metadata = {
  sword: { ruleset: "5e", source: "Core", publisher: "Example", dependencies: [], automation: { status: "manual", reasons: ["no-automation-data"] } },
  armor: { ruleset: "5.5e", source: "Core 2024", publisher: "Example", dependencies: [], automation: { status: "partial", reasons: ["uncertified"] } },
  pack: { ruleset: "5e", source: "Core", publisher: "Example", dependencies: [], automation: { status: "manual", reasons: ["no-automation-data"] } },
};
const report = buildEquipmentCoverageReport({ catalogVersion: "sha256-1234567890abcdef1234", entries, rulesMetadata: metadata });
assert.equal(report.summary.items, 3);
assert.equal(report.summary.weapons, 1);
assert.equal(report.summary.armor, 1);
assert.equal(report.summary.containers, 1);
assert.equal(report.items.find(({ id }) => id === "sword").profile.weapon.range, "5 feet");
assert.equal(report.items.find(({ id }) => id === "armor").profile.armor.armorClass, "16");
assert.equal(report.editions["5e"].warnings[0].code, "missing-starting-packages");
assert.ok(report.editions["5.5e"].fixtures.includes("char/tests/inventory-rules.test.js"));
const invalid = structuredClone(report);
invalid.items[0].gaps = [];
assert.throws(() => validateEquipmentCoverageReport(invalid), /hides incomplete automation/);

const manifest = JSON.parse(fs.readFileSync("compendium/data/manifest.json", "utf8"));
const generated = JSON.parse(fs.readFileSync(`compendium/data/${manifest.equipmentCoverageReportFile}`, "utf8"));
assert.equal(manifest.equipmentCoverageReportFile, "equipment-coverage-report.json");
assert.equal(generated.summary.items, 3139);
assert.deepEqual(generated.summary.statuses, { "rules-ready": 0, partial: 606, manual: 2533 });
assert.equal(generated.summary.weapons, 137);
assert.equal(generated.summary.armor, 27);
assert.equal(generated.summary.containers, 22);
assert.equal(generated.summary.chargedItems, 148);
assert.equal(generated.summary.modifierItems, 603);
assert.equal(generated.summary.startingPackages, 0);
assert.ok(generated.items.every((item) => item.originalId && item.source && item.publisher));
assert.ok(generated.items.every(({ gaps }) => gaps.length));
assert.ok(generated.editions["5e"].warnings.some(({ code }) => code === "missing-starting-packages"));
assert.ok(generated.editions["5.5e"].warnings.some(({ code }) => code === "missing-starting-packages"));

console.log("Equipment, attacks, armor, containers, currency, and modifier coverage tests passed.");
