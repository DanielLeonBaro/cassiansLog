// Verifies complete dual-edition origin and language auditing.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  buildOriginCoverageReport,
  validateOriginCoverageReport,
} = require("../scripts/origin-coverage-report.cjs");

const entries = [
  { id: "human", originalId: "ID_HUMAN", name: "Human", type: "Race", category: "races", publication: "Core", rules: { grants: [{ type: "Language", id: "ID_COMMON" }], stats: [{ name: "Strength", value: 1 }] } },
  { id: "sage", originalId: "ID_SAGE", name: "Sage", type: "Background", category: "backgrounds", publication: "Core", rules: { selections: [{ type: "Language", name: "Language", number: 2 }] } },
  { id: "common", originalId: "ID_COMMON", name: "Common", type: "Language", category: "languages", publication: "Core", rules: {} },
  { id: "human24", originalId: "ID_HUMAN24", name: "Human", type: "Species", category: "races", publication: "Core 2024", rules: { selections: [{ type: "Feat", name: "Origin Feat", number: 1 }] } },
];
const metadata = {
  human: { ruleset: "5e", source: "Core", publisher: "Example", automation: { status: "partial", reasons: ["uncertified"] }, dependencies: [{ originalId: "ID_COMMON", resolvedId: "common", status: "resolved" }] },
  sage: { ruleset: "5e", source: "Core", publisher: "Example", automation: { status: "manual", reasons: ["no-automation-data"] }, dependencies: [] },
  common: { ruleset: "agnostic", source: "Core", publisher: "Example", automation: { status: "manual", reasons: ["no-automation-data"] }, dependencies: [] },
  human24: { ruleset: "5.5e", source: "Core 2024", publisher: "Example", automation: { status: "partial", reasons: ["uncertified"] }, dependencies: [] },
};
const report = buildOriginCoverageReport({ catalogVersion: "sha256-1234567890abcdef1234", entries, rulesMetadata: metadata });
assert.equal(report.summary.entries, 4);
assert.equal(report.summary.grantDeclarations, 1);
assert.equal(report.summary.selectionDeclarations, 2);
assert.equal(report.summary.statDeclarations, 1);
assert.equal(report.editions["5e"].entryIds.length, 3);
assert.equal(report.editions["5.5e"].entryIds.length, 2);
assert.deepEqual(report.entries.find(({ id }) => id === "human").coverage.grants.types, { Language: 1 });
assert.ok(report.entries.every(({ status, gaps }) => status === "rules-ready" || gaps.length));
const hiddenGap = structuredClone(report);
hiddenGap.entries[0].gaps = [];
assert.throws(() => validateOriginCoverageReport(hiddenGap), /hides incomplete automation/);

const manifest = JSON.parse(fs.readFileSync("compendium/data/manifest.json", "utf8"));
const generated = JSON.parse(fs.readFileSync(`compendium/data/${manifest.originCoverageReportFile}`, "utf8"));
assert.equal(manifest.originCoverageReportFile, "origin-coverage-report.json");
assert.equal(generated.catalogVersion, manifest.catalogVersion);
assert.equal(generated.summary.entries, 608);
assert.deepEqual(Object.fromEntries(Object.entries(generated.summary.categories).map(([id, value]) => [id, value.entries])), { races: 340, backgrounds: 176, languages: 92 });
assert.equal(generated.summary["rules-ready"], 6);
assert.equal(generated.summary.partial, 506);
assert.equal(generated.summary.manual, 96);
assert.equal(generated.editions["5e"].entryIds.length, 580);
assert.equal(generated.editions["5.5e"].entryIds.length, 28);
assert.ok(generated.entries.every((entry) => entry.originalId && entry.source && entry.publisher));
assert.ok(generated.entries.filter(({ status }) => status !== "rules-ready").every(({ gaps }) => gaps.length));

console.log("Race, background, language, and origin-grant coverage tests passed.");
