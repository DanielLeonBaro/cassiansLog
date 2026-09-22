// Verifies source-aware subclass parent links and level gates.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  buildSubclassCoverageReport,
  validateSubclassCoverageReport,
} = require("../scripts/subclass-coverage-report.cjs");

const entries = [
  { id: "fighter", originalId: "ID_CLASS_FIGHTER", name: "Fighter", category: "classes", publication: "Core", inputPath: "core/fighter.xml", rules: { grants: [{ type: "Class Feature", id: "ID_FIGHTER_GATE", level: 3 }] } },
  { id: "weaponMaster", originalId: "ID_CLASS_WEAPON_MASTER", name: "Weapon Master", category: "classes", publication: "Homebrew", inputPath: "wiki/weapon-master.xml", rules: { grants: [{ type: "Class Feature", id: "ID_WEAPON_GATE", level: 3 }] } },
  { id: "fighterGate", originalId: "ID_FIGHTER_GATE", name: "Martial Archetype", category: "features" },
  { id: "weaponGate", originalId: "ID_WEAPON_GATE", name: "Martial Archetype", category: "features" },
  { id: "champion", originalId: "ID_ARCHETYPE_FIGHTER_CHAMPION", name: "Champion", category: "subclasses", publication: "Core", inputPath: "core/fighter.xml", supports: "Martial Archetype", facets: { supports: ["Martial Archetype"] } },
  { id: "tactician", originalId: "ID_ARCHETYPE_WEAPON_MASTER_TACTICIAN", name: "Tactician", category: "subclasses", publication: "Homebrew", inputPath: "wiki/weapon-master.xml", supports: "Weapon Master Martial Archetypes", facets: { supports: ["Weapon Master Martial Archetypes"] } },
];
const base = { ruleset: "5e", publisher: "Example", dependencies: [], automation: { status: "partial", reasons: ["uncertified"] } };
const metadata = Object.fromEntries(entries.map((entry) => [entry.id, { ...base, source: entry.publication || "Internal" }]));
const report = buildSubclassCoverageReport({ catalogVersion: "sha256-1234567890abcdef1234", entries, rulesMetadata: metadata });

assert.equal(report.summary.subclasses, 2);
assert.equal(report.summary.selectable, 2);
assert.equal(report.summary.unresolvedParentClasses, 0);
assert.deepEqual(report.subclasses.find(({ id }) => id === "champion").parentClasses.map(({ id }) => id), ["fighter"]);
assert.deepEqual(report.subclasses.find(({ id }) => id === "tactician").parentClasses.map(({ id }) => id), ["weaponMaster"]);
assert.equal(report.subclasses[0].parentClasses[0].gate.level, 3);
assert.ok(report.subclasses.every(({ gaps }) => gaps.some(({ code }) => code === "uncertified")));
const invalid = structuredClone(report);
invalid.subclasses[0].selectable = false;
invalid.subclasses[0].parentClasses = [];
assert.throws(() => validateSubclassCoverageReport(invalid), /no proven selectable parent/);

const manifest = JSON.parse(fs.readFileSync("compendium/data/manifest.json", "utf8"));
const generated = JSON.parse(fs.readFileSync(`compendium/data/${manifest.subclassCoverageReportFile}`, "utf8"));
const generatedMetadata = JSON.parse(fs.readFileSync(`compendium/data/${manifest.rulesMetadataFile}`, "utf8")).entries;
assert.equal(manifest.subclassCoverageReportFile, "subclass-coverage-report.json");
assert.equal(generated.catalogVersion, manifest.catalogVersion);
assert.equal(generated.summary.subclasses, 543);
assert.equal(generated.summary.selectable, 543);
assert.equal(generated.summary.unresolvedParentClasses, 0);
assert.equal(generated.summary["rules-ready"], 24);
assert.equal(generated.summary.partial, 519);
assert.deepEqual(generated.summary.rulesets, { "5e": 495, "5.5e": 48, agnostic: 0 });
assert.ok(generated.subclasses.every((entry) => entry.parentClasses.every((parent) => parent.gate.level > 0)));
assert.ok(generated.subclasses.filter(({ status }) => status !== "rules-ready").every(({ gaps }) => gaps.length));
assert.deepEqual(generatedMetadata.phbSubclassChampion.parentClassIds, ["phbClassFighter"]);
assert.equal(generatedMetadata.phbClassFighter.subclassLevel, 3);

console.log("Subclass parent, gate, source, and automation coverage tests passed.");
