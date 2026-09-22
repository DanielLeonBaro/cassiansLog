// Verifies honest level 1–20 class progression coverage for one ruleset.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  buildClassProgressionReport,
  validateClassProgressionReport,
} = require("../scripts/class-progression-report.cjs");

const catalogVersion = "sha256-1234567890abcdef1234";
const entries = [
  {
    id: "fighter", originalId: "ID_FIGHTER", name: "Fighter", category: "classes", publication: "Core",
    rules: { features: [{ name: "Second Wind", level: 1 }, { name: "Extra Attack", level: 5 }], selections: [{ name: "Fighting Style", level: 1 }], resources: [{ name: "Second Wind", level: 1 }], actions: [{ name: "Action Surge", level: 2 }] },
  },
  { id: "inventor", originalId: "ID_INVENTOR", name: "Inventor", category: "classes", publication: "Third Party", rules: null },
];
const metadata = {
  fighter: {
    ruleset: "5e", publisher: "Wizards of the Coast", source: "Player's Handbook",
    automation: { status: "rules-ready", reasons: [] }, dependencies: [], certification: { ruleset: "5e", levels: [1, 20] },
  },
  inventor: {
    ruleset: "5e", publisher: "Example Publisher", source: "Example Book",
    automation: { status: "manual", reasons: ["no-automation-data"] }, dependencies: [{ originalId: "ID_MISSING", status: "missing", resolvedId: "" }],
  },
};
const report = buildClassProgressionReport({ catalogVersion, entries, rulesMetadata: metadata, ruleset: "5e" });

assert.equal(report.summary.classes, 2);
assert.equal(report.summary["rules-ready"], 1);
assert.equal(report.summary.manual, 1);
assert.equal(report.summary.certifiedLevelRanges, 1);
assert.equal(report.summary.unresolvedDependencies, 1);
assert.equal(report.classes[0].coverage.levels.length, 20);
assert.deepEqual(report.classes[0].coverage.features.declaredLevels, [1, 5]);
assert.deepEqual(report.classes[0].coverage.levels[4].features, ["Extra Attack"]);
assert.equal(report.classes[0].coverage.weaponMasteries.count, 0);
assert.equal(report.classes[0].coverage.epicBoons.count, 0);
assert.ok(report.classes[1].gaps.some(({ code }) => code === "uncertified-level-range"));
assert.ok(report.classes[1].gaps.some(({ code, sourceId }) => code === "unresolved-dependency" && sourceId === "ID_MISSING"));
assert.ok(report.classes[1].gaps.some(({ code }) => code === "missing-golden-fixture"));
const hiddenGap = structuredClone(report);
hiddenGap.classes[1].gaps = [];
assert.throws(() => validateClassProgressionReport(hiddenGap), /hides incomplete automation/);

const manifest = JSON.parse(fs.readFileSync("compendium/data/manifest.json", "utf8"));
assert.equal(manifest.classProgression5eReportFile, "class-progression-5e-report.json");
const generated = JSON.parse(fs.readFileSync(`compendium/data/${manifest.classProgression5eReportFile}`, "utf8"));
assert.equal(generated.catalogVersion, manifest.catalogVersion);
assert.equal(generated.ruleset, "5e");
assert.equal(generated.summary.classes, 32);
assert.equal(generated.summary["rules-ready"], 12);
assert.equal(generated.summary.certifiedLevelRanges, 12);
assert.ok(generated.classes.every((entry) => entry.coverage.levels.length === 20));
assert.ok(generated.classes.filter((entry) => entry.status === "rules-ready").every((entry) => entry.fixture && entry.certification?.levels?.includes(20)));
assert.ok(generated.classes.filter((entry) => entry.status !== "rules-ready").every((entry) => entry.gaps.length));
assert.ok(generated.classes.every((entry) => entry.originalId && entry.publisher && entry.source));

assert.equal(manifest.classProgression55eReportFile, "class-progression-5-5e-report.json");
const generated55e = JSON.parse(fs.readFileSync(`compendium/data/${manifest.classProgression55eReportFile}`, "utf8"));
assert.equal(generated55e.catalogVersion, manifest.catalogVersion);
assert.equal(generated55e.ruleset, "5.5e");
assert.equal(generated55e.summary.classes, 12);
assert.equal(generated55e.summary["rules-ready"], 12);
assert.equal(generated55e.summary.certifiedLevelRanges, 12);
assert.equal(generated55e.summary.classesWithWeaponMasteryChoices, 5);
assert.equal(generated55e.summary.classesWithEpicBoonChoices, 12);
assert.ok(generated55e.classes.every((entry) => entry.coverage.levels.length === 20 && entry.fixture));
assert.ok(generated55e.classes.every((entry) => entry.coverage.epicBoons.count === 1 && entry.coverage.epicBoons.declaredLevels.includes(19)));
assert.ok(generated55e.classes.filter((entry) => entry.coverage.weaponMasteries.count).every((entry) => entry.coverage.weaponMasteries.declaredLevels.includes(1)));

console.log("5e and 5.5e class progression coverage report tests passed.");
