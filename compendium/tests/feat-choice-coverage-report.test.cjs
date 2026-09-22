// Verifies feat prerequisites/repeatability and class-choice gap auditing.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  buildFeatChoiceCoverageReport,
  validateFeatChoiceCoverageReport,
} = require("../scripts/feat-choice-coverage-report.cjs");

const entries = [
  { id: "actor", originalId: "ID_FEAT_ACTOR", name: "Actor", type: "Feat", category: "feats", publication: "Core", prerequisite: "Level 4+, Charisma 13+", requirements: "([character:4],[cha:13],!ID_FEAT_ACTOR)", rules: { grants: [], selections: [], stats: [{ name: "charisma", value: 1 }] } },
  { id: "tough", originalId: "ID_FEAT_TOUGH", name: "Tough", type: "Feat", category: "feats", publication: "Core", setters: { "allow duplicate": "true" }, rules: { grants: [], selections: [], stats: [{ name: "hp", value: "level" }] } },
  { id: "fighter", originalId: "ID_CLASS_FIGHTER", name: "Fighter", type: "Class", category: "classes", publication: "Core", rules: { selections: [{ type: "Style", name: "Fighting Style", level: 1, supports: "ID_STYLE_ARCHERY|ID_STYLE_MISSING" }] } },
  { id: "archery", originalId: "ID_STYLE_ARCHERY", name: "Archery", type: "Class Feature", category: "features", publication: "Core", rules: {} },
];
const partial = { ruleset: "5e", publisher: "Example", source: "Core", dependencies: [], automation: { status: "partial", reasons: ["uncertified"] } };
const metadata = Object.fromEntries(entries.map(({ id }) => [id, partial]));
const report = buildFeatChoiceCoverageReport({ catalogVersion: "sha256-1234567890abcdef1234", entries, rulesMetadata: metadata });
assert.equal(report.summary.feats, 2);
assert.equal(report.summary.choices, 1);
assert.equal(report.summary.unresolvedChoiceOptions, 1);
assert.equal(report.feats.find(({ id }) => id === "actor").prerequisite.minimumLevel, 4);
assert.equal(report.feats.find(({ id }) => id === "actor").repeatability.status, "blocked");
assert.equal(report.feats.find(({ id }) => id === "tough").repeatability.status, "allowed");
assert.deepEqual(report.choices[0].options.missingReferences, ["ID_STYLE_MISSING"]);
assert.ok(report.choices[0].gaps.some(({ code }) => code === "unresolved-option"));
const invalid = structuredClone(report);
invalid.feats[0].repeatability = null;
assert.throws(() => validateFeatChoiceCoverageReport(invalid), /lacks repeatability or gate metadata/);

const manifest = JSON.parse(fs.readFileSync("compendium/data/manifest.json", "utf8"));
const generated = JSON.parse(fs.readFileSync(`compendium/data/${manifest.featChoiceCoverageReportFile}`, "utf8"));
assert.equal(manifest.featChoiceCoverageReportFile, "feat-choice-coverage-report.json");
assert.equal(generated.catalogVersion, manifest.catalogVersion);
assert.equal(generated.summary.feats, 432);
assert.equal(generated.summary.choices, 1443);
assert.equal(generated.summary.choiceSources, 504);
assert.deepEqual(generated.summary.featStatuses, { "rules-ready": 0, partial: 394, manual: 38 });
assert.ok(generated.feats.every((entry) => entry.originalId && entry.source && entry.publisher && entry.prerequisite.minimumLevel > 0));
assert.ok(generated.feats.filter(({ status }) => status !== "rules-ready").every(({ gaps }) => gaps.length));
assert.ok(generated.choices.every((choice) => choice.sourceId && choice.source && choice.publisher && choice.level > 0));

console.log("Feat prerequisite and class-choice coverage tests passed.");
