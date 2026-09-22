// Verifies spell metadata, list, repertoire, grant, and conflict auditing.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  buildSpellCoverageReport,
  validateSpellCoverageReport,
} = require("../scripts/spell-coverage-report.cjs");

const spells = Array.from({ length: 10 }, (_, level) => ({
  id: `spell${level}`,
  originalId: `ID_SPELL_${level}`,
  name: level === 0 ? "Spark" : `Spell ${level}`,
  type: "Spell",
  category: "spells",
  publication: "Core",
  supports: "Wizard",
  facets: { spellLevel: String(level), school: "Evocation", supports: ["Wizard"] },
  setters: { level: String(level), school: "Evocation", time: "Action", range: "60 feet", duration: "Instantaneous", hasVerbalComponent: "true", isConcentration: "false", isRitual: "false" },
}));
const entries = [
  ...spells,
  { ...spells[0], id: "sparkVariant", originalId: "ID_SPARK_VARIANT", publication: "Other", facets: { ...spells[0].facets, school: "Illusion" } },
  { id: "wizard", originalId: "ID_CLASS_WIZARD", name: "Wizard", type: "Class", category: "classes", publication: "Core", rules: { spellcasting: { ability: "intelligence", spellList: "Wizard", progression: "full", repertoire: "spellbook", ritual: "spellbook" } } },
  { id: "grant", originalId: "ID_GRANT", name: "Granted Spark", type: "Class Feature", category: "features", publication: "Core", rules: { grants: [{ type: "Spell", id: "ID_SPELL_0", level: 1 }] } },
];
const metadata = Object.fromEntries(entries.map((entry) => [entry.id, {
  ruleset: "5e", source: entry.publication, publisher: "Example", dependencies: [], automation: { status: "manual", reasons: ["no-automation-data"] },
}]));
const report = buildSpellCoverageReport({ catalogVersion: "sha256-1234567890abcdef1234", entries, rulesMetadata: metadata });
assert.equal(report.summary.spells, 11);
assert.equal(report.summary.repertoires, 1);
assert.equal(report.summary.grantedSpells, 1);
assert.equal(report.summary.unresolvedGrantedSpells, 0);
assert.equal(report.summary.conflicts, 1);
assert.equal(report.summary.rulesConflicts, 1);
assert.deepEqual(report.spells.find(({ id }) => id === "spell0").classLists, ["Wizard"]);
assert.equal(report.repertoires[0].repertoire, "spellbook");
assert.equal(report.grantedSpells[0].targetId, "spell0");
const invalid = structuredClone(report);
invalid.spells[0].gaps = [];
assert.throws(() => validateSpellCoverageReport(invalid), /hides incomplete automation/);

const manifest = JSON.parse(fs.readFileSync("compendium/data/manifest.json", "utf8"));
const generated = JSON.parse(fs.readFileSync(`compendium/data/${manifest.spellCoverageReportFile}`, "utf8"));
assert.equal(manifest.spellCoverageReportFile, "spell-coverage-report.json");
assert.equal(generated.catalogVersion, manifest.catalogVersion);
assert.equal(generated.summary.spells, 2046);
assert.deepEqual(generated.summary.levels, { "0": 252, "1": 334, "2": 325, "3": 283, "4": 229, "5": 224, "6": 154, "7": 95, "8": 83, "9": 67 });
assert.deepEqual(generated.summary.rulesets, { "5e": 1655, "5.5e": 391, agnostic: 0 });
assert.deepEqual(generated.summary.statuses, { "rules-ready": 0, partial: 48, manual: 1998 });
assert.equal(generated.summary.repertoires, 16);
assert.equal(generated.summary.grantedSpells, 2349);
assert.equal(generated.summary.unresolvedGrantedSpells, 33);
assert.equal(generated.summary.conflicts, 77);
assert.equal(generated.summary.rulesConflicts, 36);
assert.ok(generated.spells.every((spell) => spell.originalId && spell.source && spell.publisher && spell.level >= 0 && spell.level <= 9));
assert.ok(generated.spells.filter(({ status }) => status !== "rules-ready").every(({ gaps }) => gaps.length));

console.log("Spell metadata, lists, repertoires, grants, and conflicts tests passed.");
